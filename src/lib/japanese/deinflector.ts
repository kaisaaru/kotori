export type DeinflectionRule = {
  ruleName: string;
  suffix: string;
  replacement: string;
  type: string;
};

// Standard 五十音 (gojuon) sound-row table: the five vowel forms (a/i/u/e/o)
// for each consonant, used below to derive Godan (u-verb) conjugation stems.
// This is ordinary Japanese phonology found in any grammar reference, not
// tied to any particular tool's internal rule set.
const GOJUON_ROWS = {
  w: ["わ", "い", "う", "え", "お"],
  k: ["か", "き", "く", "け", "こ"],
  g: ["が", "ぎ", "ぐ", "げ", "ご"],
  s: ["さ", "し", "す", "せ", "そ"],
  t: ["た", "ち", "つ", "て", "と"],
  n: ["な", "に", "ぬ", "ね", "の"],
  b: ["ば", "び", "ぶ", "べ", "ぼ"],
  m: ["ま", "み", "む", "め", "も"],
  r: ["ら", "り", "る", "れ", "ろ"],
} as const;

type GodanRow = keyof typeof GOJUON_ROWS;

// Godan dictionary-form endings paired with their sound row and their
// euphonic (onbin) class - the sound change that happens when a Godan stem
// meets て/た (e.g. 買う -> 買って, 飲む -> 飲んで, 書く -> 書いた).
const GODAN_ENDINGS: Array<{ ending: string; row: GodanRow; onbin: "small-tsu" | "n" | "i" | "shi" }> = [
  { ending: "う", row: "w", onbin: "small-tsu" },
  { ending: "つ", row: "t", onbin: "small-tsu" },
  { ending: "る", row: "r", onbin: "small-tsu" },
  { ending: "ぬ", row: "n", onbin: "n" },
  { ending: "ぶ", row: "b", onbin: "n" },
  { ending: "む", row: "m", onbin: "n" },
  { ending: "く", row: "k", onbin: "i" },
  { ending: "ぐ", row: "g", onbin: "i" },
  { ending: "す", row: "s", onbin: "shi" },
];

// て/た suffixes per euphonic class. ぐ is the one exception within the "i"
// class: it voices to いで/いだ instead of いて/いた.
const ONBIN_TE_TA: Record<"small-tsu" | "n" | "i" | "shi", [string, string]> = {
  "small-tsu": ["って", "った"],
  n: ["んで", "んだ"],
  i: ["いて", "いた"],
  shi: ["して", "した"],
};
const GU_TE_TA: [string, string] = ["いで", "いだ"];

function buildGodanRules(): DeinflectionRule[] {
  const rules: DeinflectionRule[] = [];

  for (const { ending, row, onbin } of GODAN_ENDINGS) {
    const [aRow, , , eRow, oRow] = GOJUON_ROWS[row];
    const [teSuffix, taSuffix] = ending === "ぐ" ? GU_TE_TA : ONBIN_TE_TA[onbin];

    rules.push({ ruleName: "Volitional (Godan)", suffix: oRow + "う", replacement: ending, type: "volitional" });
    rules.push({ ruleName: "Negative (Godan)", suffix: aRow + "ない", replacement: ending, type: "negative" });
    rules.push({ ruleName: "Potential (Godan)", suffix: eRow + "る", replacement: ending, type: "potential" });
    rules.push({ ruleName: "Passive (Godan)", suffix: aRow + "れる", replacement: ending, type: "passive" });
    rules.push({ ruleName: "Te (Godan)", suffix: teSuffix, replacement: ending, type: "te" });
    rules.push({ ruleName: "Past (Godan)", suffix: taSuffix, replacement: ending, type: "past" });
  }

  return rules;
}

const ICHIDAN_RULES: DeinflectionRule[] = [
  { ruleName: "Volitional (Ichidan)", suffix: "よう", replacement: "る", type: "volitional" }, // e.g. 食べよう -> 食べる
  { ruleName: "Negative (Ichidan)", suffix: "ない", replacement: "る", type: "negative" },
  { ruleName: "Potential (Ichidan)", suffix: "られる", replacement: "る", type: "potential" },
  { ruleName: "Te (Ichidan)", suffix: "て", replacement: "る", type: "te" },
  { ruleName: "Past (Ichidan)", suffix: "た", replacement: "る", type: "past" },
];

const ADJECTIVE_RULES: DeinflectionRule[] = [
  { ruleName: "Adjective Past", suffix: "かった", replacement: "い", type: "past" },
  { ruleName: "Adjective Negative", suffix: "くない", replacement: "い", type: "negative" },
  { ruleName: "Adjective Negative Past", suffix: "くなかった", replacement: "い", type: "negative-past" },
];

// Japanese verb/adjective de-inflection rules, derived from standard Godan
// (u-verb) and Ichidan (ru-verb) conjugation grammar rather than any single
// tool's rule table - see the gojuon table and onbin classes above for the
// underlying linguistics. Allows reversing conjugated forms (e.g., 帰ろう ->
// 帰る) back to their dictionary forms.
export const DEINFLECTION_RULES: DeinflectionRule[] = [
  ...buildGodanRules(),
  ...ICHIDAN_RULES,
  ...ADJECTIVE_RULES,
];

export type DeinflectionResult = {
  word: string;
  rules: string[]; // e.g., ["past", "negative"]
};

/**
 * Returns a list of possible dictionary base forms for a given conjugated word.
 * Always includes the original word as the first attempt.
 */
export function getBaseForms(word: string): DeinflectionResult[] {
  const results: DeinflectionResult[] = [{ word, rules: [] }]; // Original word

  // Single-pass de-inflection (can be improved later to recursive for combinations like nai-katta)
  for (const rule of DEINFLECTION_RULES) {
    if (word.endsWith(rule.suffix) && word.length > rule.suffix.length) {
      const baseForm = word.slice(0, -rule.suffix.length) + rule.replacement;
      
      // Avoid duplicate base forms, but merge rules if needed. 
      // For simplicity in Phase 1, we just push all possibilities.
      const exists = results.find(r => r.word === baseForm && r.rules.join(',') === [rule.ruleName].join(','));
      if (!exists) {
        results.push({
          word: baseForm,
          rules: [rule.ruleName],
        });
      }
    }
  }

  // Common irregulars
  if (word === "した" || word === "します" || word === "しよう" || word === "して") {
    results.push({ word: "する", rules: ["Irregular (suru)"] });
  }
  if (word === "きた" || word === "きます" || word === "こよう" || word === "きて") {
    results.push({ word: "来る", rules: ["Irregular (kuru)"] });
  }

  return results;
}
