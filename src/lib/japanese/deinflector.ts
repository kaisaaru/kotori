export type DeinflectionRule = {
  ruleName: string;
  suffix: string;
  replacement: string;
  type: string;
};

// Simplified set of common Japanese de-inflection rules based on Yomitan's logic.
// This allows reversing conjugated forms (e.g., 帰ろう -> 帰る) back to their dictionary forms.
export const DEINFLECTION_RULES: DeinflectionRule[] = [
  // Volitional (Let's do X)
  { ruleName: "Volitional (Godan)", suffix: "おう", replacement: "う", type: "volitional" },
  { ruleName: "Volitional (Godan)", suffix: "こう", replacement: "く", type: "volitional" },
  { ruleName: "Volitional (Godan)", suffix: "そう", replacement: "す", type: "volitional" },
  { ruleName: "Volitional (Godan)", suffix: "とう", replacement: "つ", type: "volitional" },
  { ruleName: "Volitional (Godan)", suffix: "のう", replacement: "ぬ", type: "volitional" },
  { ruleName: "Volitional (Godan)", suffix: "ほう", replacement: "ふ", type: "volitional" },
  { ruleName: "Volitional (Godan)", suffix: "もう", replacement: "む", type: "volitional" },
  { ruleName: "Volitional (Godan)", suffix: "ろう", replacement: "る", type: "volitional" }, // e.g. 帰ろう -> 帰る
  { ruleName: "Volitional (Ichidan)", suffix: "よう", replacement: "る", type: "volitional" }, // e.g. 食べよう -> 食べる

  // Past (Did X) - Ta form
  { ruleName: "Past (Godan -u/-tsu/-ru)", suffix: "った", replacement: "う", type: "past" },
  { ruleName: "Past (Godan -u/-tsu/-ru)", suffix: "った", replacement: "つ", type: "past" },
  { ruleName: "Past (Godan -u/-tsu/-ru)", suffix: "った", replacement: "る", type: "past" },
  { ruleName: "Past (Godan -mu/-bu/-nu)", suffix: "んだ", replacement: "む", type: "past" },
  { ruleName: "Past (Godan -mu/-bu/-nu)", suffix: "んだ", replacement: "ぶ", type: "past" },
  { ruleName: "Past (Godan -mu/-bu/-nu)", suffix: "んだ", replacement: "ぬ", type: "past" },
  { ruleName: "Past (Godan -ku)", suffix: "いた", replacement: "く", type: "past" },
  { ruleName: "Past (Godan -gu)", suffix: "いだ", replacement: "ぐ", type: "past" },
  { ruleName: "Past (Godan -su)", suffix: "した", replacement: "す", type: "past" },
  { ruleName: "Past (Ichidan)", suffix: "た", replacement: "る", type: "past" },

  // Negative (Don't do X) - Nai form
  { ruleName: "Negative (Godan)", suffix: "わない", replacement: "う", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "かない", replacement: "く", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "がない", replacement: "ぐ", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "さない", replacement: "す", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "たない", replacement: "つ", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "なない", replacement: "ぬ", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "ばない", replacement: "ぶ", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "まない", replacement: "む", type: "negative" },
  { ruleName: "Negative (Godan)", suffix: "らない", replacement: "る", type: "negative" },
  { ruleName: "Negative (Ichidan)", suffix: "ない", replacement: "る", type: "negative" },

  // Te form (Connecting form)
  { ruleName: "Te (Godan -u/-tsu/-ru)", suffix: "って", replacement: "う", type: "te" },
  { ruleName: "Te (Godan -u/-tsu/-ru)", suffix: "って", replacement: "つ", type: "te" },
  { ruleName: "Te (Godan -u/-tsu/-ru)", suffix: "って", replacement: "る", type: "te" },
  { ruleName: "Te (Godan -mu/-bu/-nu)", suffix: "んで", replacement: "む", type: "te" },
  { ruleName: "Te (Godan -mu/-bu/-nu)", suffix: "んで", replacement: "ぶ", type: "te" },
  { ruleName: "Te (Godan -mu/-bu/-nu)", suffix: "んで", replacement: "ぬ", type: "te" },
  { ruleName: "Te (Godan -ku)", suffix: "いて", replacement: "く", type: "te" },
  { ruleName: "Te (Godan -gu)", suffix: "いで", replacement: "ぐ", type: "te" },
  { ruleName: "Te (Godan -su)", suffix: "して", replacement: "す", type: "te" },
  { ruleName: "Te (Ichidan)", suffix: "て", replacement: "る", type: "te" },

  // Potential (Can do X)
  { ruleName: "Potential (Godan)", suffix: "える", replacement: "う", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "ける", replacement: "く", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "げる", replacement: "ぐ", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "せる", replacement: "す", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "てる", replacement: "つ", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "ねる", replacement: "ぬ", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "べる", replacement: "ぶ", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "める", replacement: "む", type: "potential" },
  { ruleName: "Potential (Godan)", suffix: "れる", replacement: "る", type: "potential" },
  { ruleName: "Potential (Ichidan)", suffix: "られる", replacement: "る", type: "potential" },

  // Passive (Is done to X)
  { ruleName: "Passive (Godan)", suffix: "われる", replacement: "う", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "かれる", replacement: "く", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "がれる", replacement: "ぐ", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "される", replacement: "す", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "たれる", replacement: "つ", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "なれる", replacement: "ぬ", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "ばれる", replacement: "ぶ", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "まれる", replacement: "む", type: "passive" },
  { ruleName: "Passive (Godan)", suffix: "られる", replacement: "る", type: "passive" },

  // Adjective Past/Negative
  { ruleName: "Adjective Past", suffix: "かった", replacement: "い", type: "past" },
  { ruleName: "Adjective Negative", suffix: "くない", replacement: "い", type: "negative" },
  { ruleName: "Adjective Negative Past", suffix: "くなかった", replacement: "い", type: "negative-past" },
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
