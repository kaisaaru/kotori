import fs from "fs";
import path from "path";
import JSZip from "jszip";

// Blocks that are now extracted separately (extractExtras: example sentences, forms) or add no
// reader value in a flat string (attribution links) - skipped here so they stop leaking into the
// plain-text glossary, where they used to run together with no separator and get mangled by
// formatMeaning's cleanup heuristics downstream (e.g. a sense-note's ";" getting misread as a
// point separator, then the adjacent "forms" label text landing mid-sentence with nothing to mark
// where the real definition ended).
const FLATTEN_SKIP_MARKERS = new Set(["example-sentence", "forms", "attribution"]);

function parseStructuredNode(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    return node.map(parseStructuredNode).filter(Boolean).join(" ");
  }
  if (typeof node === "object") {
    if (node.data && FLATTEN_SKIP_MARKERS.has(node.data.content)) return "";
    if (node.content) return parseStructuredNode(node.content);
    if (node.text) return String(node.text);
  }
  return "";
}

// Reconstructs contiguous Japanese text from a structured-content node tree, rendering <ruby>
// kanji/reading pairs as "{漢字|かんじ}" inline markup instead of dropping the furigana (which plain
// parseStructuredNode does, since it only reads .content and never looks at ruby's <rt> sibling).
// The {base|reading} braces are load-bearing, not decorative: plain kana sits between consecutive
// rubies in real sentences (次[つぎ]の文[ぶん]...), and a bracket-only "base[reading]" format is
// ambiguous to re-parse - a greedy "match runs of non-bracket text" regex on the client can't tell
// where the previous ruby's trailing plain text ends and the next ruby's base begins, and ends up
// swallowing that plain kana into the next base (rendered as e.g. "の文[ぶん]" instead of "の" then
// "文[ぶん]"). Braces make the base's boundary explicit so the client parser can't misgroup it.
function rubyToFuriganaString(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(rubyToFuriganaString).join("");
  if (typeof node === "object") {
    if (node.tag === "ruby") {
      const parts = Array.isArray(node.content) ? node.content : [node.content];
      const base = parts.find((p) => typeof p === "string") || "";
      const rt = parts.find((p) => p && typeof p === "object" && p.tag === "rt");
      const reading = rt ? rubyToFuriganaString(rt.content) : "";
      return reading ? `{${base}|${reading}}` : base;
    }
    if (node.tag === "rt") return ""; // only meaningful as a ruby child, handled above
    if (node.content) return rubyToFuriganaString(node.content);
  }
  return "";
}

// Extracts just the translation text from an example-sentence-b block, skipping the numbered
// "[1]" attribution-footnote span Jitendex attaches to each translation.
function extractTranslationText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractTranslationText).join(" ").replace(/\s+/g, " ").trim();
  if (typeof node === "object") {
    if (node.data && node.data.content === "attribution-footnote") return "";
    if (node.content) return extractTranslationText(node.content);
  }
  return "";
}

// Walks a structured-content tree looking for one example-sentence block (Yomitan/Jitendex mark
// these via data.content === "example-sentence", with nested "example-sentence-a" for the
// Japanese side and "example-sentence-b" for the translation). Returns the first one found, or
// null - a dictionary entry showing every example it has gets cluttered fast, one is enough.
function extractExampleFromNode(node) {
  let found = null;
  function walk(n) {
    if (found || !n) return;
    if (Array.isArray(n)) {
      for (const child of n) walk(child);
      return;
    }
    if (typeof n !== "object") return;
    const marker = n.data && n.data.content;
    if (marker === "example-sentence") {
      let japanese = "";
      let translation = "";
      (function findParts(inner) {
        if (!inner) return;
        if (Array.isArray(inner)) {
          inner.forEach(findParts);
          return;
        }
        if (typeof inner !== "object") return;
        const innerMarker = inner.data && inner.data.content;
        if (innerMarker === "example-sentence-a") {
          japanese = rubyToFuriganaString(inner.content).trim();
        } else if (innerMarker === "example-sentence-b") {
          translation = extractTranslationText(inner.content).trim();
        } else if (inner.content) {
          findParts(inner.content);
        }
      })(n.content);
      if (japanese) found = { japanese, translation };
      return;
    }
    if (n.content) walk(n.content);
  }
  walk(node);
  return found;
}

// Collects alternate-spelling strings out of a structured-content "forms" block (a labeled <ul>
// of <li> spelling variants). Two-phase on purpose: glossary blocks are ALSO plain <ul><li> lists,
// so this must first locate a node explicitly marked data.content === "forms" and only harvest
// <li> text from inside that specific subtree - walking the whole tree for any <li> would also
// scoop up glossary definition points, which is a real bug this shape avoids.
function collectFormsFromNode(node) {
  const forms = [];
  function collectListItems(n) {
    if (!n) return;
    if (Array.isArray(n)) {
      n.forEach(collectListItems);
      return;
    }
    if (typeof n !== "object") return;
    if (n.tag === "li" && typeof n.content === "string") {
      forms.push(n.content);
      return;
    }
    if (n.data && n.data.content === "forms-label") return;
    if (n.content) collectListItems(n.content);
  }
  function findFormsBlocks(n) {
    if (!n) return;
    if (Array.isArray(n)) {
      n.forEach(findFormsBlocks);
      return;
    }
    if (typeof n !== "object") return;
    if (n.data && n.data.content === "forms") {
      collectListItems(n.content);
      return;
    }
    if (n.content) findFormsBlocks(n.content);
  }
  findFormsBlocks(node);
  return forms;
}

// Single pass over a term's raw glossary node tree to pull out the extras that the plain-text
// flatten (cleanMeaningString) discards: one example sentence and any alternate-spelling forms.
// Kept fully separate from cleanMeaningString on purpose - reusing/rewriting that flatten path
// risks regressing the plain-text glossary output for all ~400k terms, whereas this is additive.
function extractExtras(rawMeanings) {
  let example = null;
  let forms = [];
  const items = Array.isArray(rawMeanings) ? rawMeanings : [rawMeanings];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (!example) example = extractExampleFromNode(item);
    const foundForms = collectFormsFromNode(item);
    if (foundForms.length > 0) forms = forms.concat(foundForms);
  }
  return { example, forms: Array.from(new Set(forms)) };
}

function cleanMeaningString(text) {
  if (!text) return "";
  if (typeof text !== "string") {
    return parseStructuredNode(text).trim();
  }
  if (text.startsWith("{") && (text.includes("structured-content") || text.includes('"content":'))) {
    try {
      const parsed = JSON.parse(text);
      const cleaned = parseStructuredNode(parsed).trim();
      if (cleaned) return cleaned;
    } catch {
      return text
        .replace(/\{"type":"[^"]+","content":|\[|\{|\}|"tag":"[^"]+"|"data":\{[^}]+\}|"style":\{[^}]+\}/g, "")
        .replace(/["\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return text.trim();
}

async function buildCache() {
  console.log("🚀 Starting dictionary build-time cache indexing...");
  const startTime = Date.now();

  const termMap = new Map();
  const kanjiMap = new Map();
  // term_meta_bank data (frequency rank / pitch accent) - separate shape from term_bank
  // ([expression, mode, data], not the 6+-length term array), collected across all dictionaries
  // and merged onto matching termMap entries once every ZIP has been read.
  const freqData = new Map(); // expression -> { dictName, rank, display }[]
  const pitchData = new Map(); // expression -> { reading, position }[]

  // Seed core interjections and fallbacks
  const CORE_FALLBACKS = {
    美雪: [
      { dictName: "JIDict (Indonesian)", expression: "美雪", reading: "みゆき", meanings: ["Miyuki (nama perempuan / salju indah)"], jlpt: "N5" },
      { dictName: "Jitendex (English)", expression: "美雪", reading: "みゆき", meanings: ["Miyuki (female given name / beautiful snow)"] }
    ],
    美: [
      { dictName: "JIDict (Indonesian)", expression: "美", reading: "み", meanings: ["Cantik; indah; agung"], jlpt: "N3" },
      { dictName: "Jitendex (English)", expression: "美", reading: "び", meanings: ["beauty"] }
    ],
    はぁ: [{ dictName: "JIDict (Indonesian)", expression: "はぁ", reading: "はぁ", meanings: ["Haa... (desah/helan napas, seruan terkejut/bingung)"], jlpt: "N5" }],
    の: [{ dictName: "JIDict (Indonesian)", expression: "の", reading: "の", meanings: ["Partikel kepemilikan (milik / -nya)", "Penghubung kata benda", "Nominalizer (pengubah kata kerja/sifat jadi kata benda)"], jlpt: "N5" }],
    はあ: [{ dictName: "JIDict (Indonesian)", expression: "はあ", reading: "はあ", meanings: ["Haa... (desah/helan napas, ya/tentu)"], jlpt: "N5" }],
    ふぅ: [{ dictName: "JIDict (Indonesian)", expression: "ふぅ", reading: "ふぅ", meanings: ["Fuu... (helan napas lega/lelah)"] }],
    へぇ: [{ dictName: "JIDict (Indonesian)", expression: "へぇ", reading: "へぇ", meanings: ["Hee... (seruan kagum/heran/terkejut)"] }],
    そんな: [{ dictName: "JIDict (Indonesian)", expression: "そんな", reading: "そんな", meanings: ["Seperti itu, yang seperti itu"], jlpt: "N5" }],
    お前: [{ dictName: "JIDict (Indonesian)", expression: "お前", reading: "おまえ", meanings: ["Kamu, kau (informal / agak kasar)", "Engkau"], jlpt: "N5" }],
    私: [{ dictName: "JIDict (Indonesian)", expression: "私", reading: "わたし", meanings: ["Saya, aku"], jlpt: "N5" }],
    俺: [{ dictName: "JIDict (Indonesian)", expression: "俺", reading: "おれ", meanings: ["Aku (laki-laki informal)"], jlpt: "N3" }],
    僕: [{ dictName: "JIDict (Indonesian)", expression: "僕", reading: "ぼく", meanings: ["Aku (laki-laki)"], jlpt: "N5" }],
  };

  const CORE_KANJI_FALLBACKS = {
    入: { kanji: "入", onyomi: ["ニュウ"], kunyomi: ["はい-る", "い-れる"], meanings: ["Masuk, dimasukkan, dipenuhi"] },
    焦: { kanji: "焦", onyomi: ["ショウ"], kunyomi: ["あせ-る", "あせ-り"], meanings: ["Cemas, gelisah, terburu-buru, panik"] },
    進: { kanji: "進", onyomi: ["シン"], kunyomi: ["すす-む", "すす-める"], meanings: ["Maju, melangkah maju, memajukan, meneruskan"] },
    前: { kanji: "前", onyomi: ["ゼン"], kunyomi: ["まえ"], meanings: ["Depan, sebelum, terdahulu"] },
    今: { kanji: "今", onyomi: ["コン", "キン"], kunyomi: ["いま"], meanings: ["Sekarang, saat ini"] },
    日: { kanji: "日", onyomi: ["ニチ", "ジツ"], kunyomi: ["ひ", "か"], meanings: ["Hari, matahari"] },
    私: { kanji: "私", onyomi: ["シ"], kunyomi: ["わたし", "わたくし"], meanings: ["Saya, aku, pribadi"] },
    俺: { kanji: "俺", onyomi: ["エン"], kunyomi: ["おれ"], meanings: ["Aku (laki-laki informal)"] },
    僕: { kanji: "僕", onyomi: ["ボク"], kunyomi: ["しもべ"], meanings: ["Aku (laki-laki)"] },
    人: { kanji: "人", onyomi: ["ジン", "ニン"], kunyomi: ["ひと"], meanings: ["Orang, manusia"] },
    生: { kanji: "生", onyomi: ["セイ", "ショウ"], kunyomi: ["い-きる", "う-まれる", "なま"], meanings: ["Hidup, lahir, mentah"] },
  };

  for (const [expr, terms] of Object.entries(CORE_FALLBACKS)) {
    termMap.set(expr, terms);
  }
  for (const [k, obj] of Object.entries(CORE_KANJI_FALLBACKS)) {
    kanjiMap.set(k, obj);
  }

  let refDir = path.join(process.cwd(), "reference", "kotoba-rumus");
  if (!fs.existsSync(refDir)) {
    refDir = path.join(process.cwd(), "reference");
  }

  if (!fs.existsSync(refDir)) {
    console.log("⚠️ No reference directory found. Skipping dictionary build.");
    return;
  }

  const files = fs.readdirSync(refDir).filter((f) => {
    const lower = f.toLowerCase();
    return lower.endsWith(".zip") && !lower.includes("素材辞典");
  });

  console.log(`📦 Found ${files.length} dictionary ZIP files to index.`);

  for (const filename of files) {
    try {
      console.log(`  -> Processing ${filename}...`);
      const filePath = path.join(refDir, filename);
      const buffer = fs.readFileSync(filePath);
      const zip = new JSZip();
      const contents = await zip.loadAsync(buffer);

      let dictTitle = filename.replace(/\.zip$/i, "");
      const indexFile = contents.file("index.json");
      if (indexFile) {
        try {
          const indexText = await indexFile.async("string");
          const indexJson = JSON.parse(indexText);
          if (indexJson.title) dictTitle = indexJson.title;
        } catch {}
      }

      const termFiles = Object.keys(contents.files).filter((name) =>
        /term_bank_\d+\.json$/i.test(name)
      );

      for (const tf of termFiles) {
        const fileObj = contents.file(tf);
        if (!fileObj) continue;
        const text = await fileObj.async("string");
        const entries = JSON.parse(text);

        for (const entry of entries) {
          if (Array.isArray(entry) && entry.length >= 6) {
            const expression = String(entry[0] || "");
            const reading = String(entry[1] || "");
            const rawMeanings = entry[5];

            let meanings = [];
            if (Array.isArray(rawMeanings)) {
              meanings = rawMeanings.map(cleanMeaningString).filter(Boolean);
            } else if (rawMeanings) {
              const cleaned = cleanMeaningString(rawMeanings);
              if (cleaned) meanings = [cleaned];
            }

            if (expression && meanings.length > 0) {
              const rawScore = typeof entry[4] === "number" ? entry[4] : 0;
              const defTags = typeof entry[2] === "string" ? [entry[2]] : [];
              const termTags = typeof entry[7] === "string" ? [entry[7]] : [];
              const allTags = Array.from(new Set([...defTags, ...termTags].filter(Boolean)));
              const { example, forms } = extractExtras(rawMeanings);

              const termObj = {
                dictName: dictTitle,
                expression,
                reading: reading || expression,
                meanings,
                tags: allTags,
                score: rawScore,
              };
              if (example) termObj.example = example;
              if (forms.length > 0) termObj.forms = forms;

              const existing = termMap.get(expression) || [];
              existing.push(termObj);
              termMap.set(expression, existing);
            }
          }
        }
      }

      // term_meta_bank entries are shaped [expression, mode, data] (length 3) - a completely
      // different layout from term_bank, so they need their own pass rather than falling through
      // the term_bank loop above (where they'd fail the length>=6 check and be silently dropped).
      const termMetaFiles = Object.keys(contents.files).filter((name) =>
        /term_meta_bank_\d+\.json$/i.test(name)
      );

      for (const tmf of termMetaFiles) {
        const fileObj = contents.file(tmf);
        if (!fileObj) continue;
        const text = await fileObj.async("string");
        const entries = JSON.parse(text);

        for (const entry of entries) {
          if (!Array.isArray(entry) || entry.length < 3) continue;
          const expression = String(entry[0] || "");
          const mode = entry[1];
          const data = entry[2];
          if (!expression || !data || typeof data !== "object") continue;

          if (mode === "freq") {
            const rank = typeof data.value === "number" ? data.value : (typeof data === "number" ? data : undefined);
            if (typeof rank !== "number") continue;
            const display = typeof data.displayValue === "string" ? data.displayValue : String(rank);
            const list = freqData.get(expression) || [];
            list.push({ dictName: dictTitle, rank, display });
            freqData.set(expression, list);
          } else if (mode === "pitch" && Array.isArray(data.pitches)) {
            const pitchReading = String(data.reading || expression);
            const list = pitchData.get(expression) || [];
            for (const p of data.pitches) {
              if (typeof p.position === "number") {
                list.push({ reading: pitchReading, position: p.position });
              }
            }
            pitchData.set(expression, list);
          }
        }
      }

      const kanjiFiles = Object.keys(contents.files).filter((name) =>
        /kanji_bank_\d+\.json$/i.test(name)
      );

      for (const kf of kanjiFiles) {
        const fileObj = contents.file(kf);
        if (!fileObj) continue;
        const text = await fileObj.async("string");
        const entries = JSON.parse(text);

        for (const entry of entries) {
          if (Array.isArray(entry) && entry.length >= 5) {
            const kanji = String(entry[0] || "");
            const onyomi = typeof entry[1] === "string" ? entry[1].split(/\s+/).filter(Boolean) : [];
            const kunyomi = typeof entry[2] === "string" ? entry[2].split(/\s+/).filter(Boolean) : [];
            const tagStr = typeof entry[3] === "string" ? entry[3] : JSON.stringify(entry[3] || "");
            const statsObj = entry[5] ? JSON.stringify(entry[5]) : "";
            const meanings = Array.isArray(entry[4])
              ? entry[4].map(cleanMeaningString).filter(Boolean)
              : [cleanMeaningString(entry[4])].filter(Boolean);

            let jlpt = undefined;
            const fullMeta = `${tagStr} ${statsObj}`;
            const m = fullMeta.match(/JLPT\s*N?([1-5])/i) || fullMeta.match(/\bN([1-5])\b/i);
            if (m) {
              jlpt = `N${m[1]}`;
            }

            if (kanji) {
              const existing = kanjiMap.get(kanji);
              kanjiMap.set(kanji, {
                kanji,
                onyomi: onyomi.length > 0 ? onyomi : existing?.onyomi || [],
                kunyomi: kunyomi.length > 0 ? kunyomi : existing?.kunyomi || [],
                meanings: meanings.length > 0 ? meanings : existing?.meanings || [],
                jlpt: jlpt || existing?.jlpt,
              });
            }
          }
        }
      }

      const kanjiMetaFiles = Object.keys(contents.files).filter((name) =>
        /kanji_meta_bank_\d+\.json$/i.test(name)
      );

      for (const kmf of kanjiMetaFiles) {
        const fileObj = contents.file(kmf);
        if (!fileObj) continue;
        const text = await fileObj.async("string");
        const entries = JSON.parse(text);

        for (const entry of entries) {
          if (Array.isArray(entry) && entry.length >= 3) {
            const kanji = String(entry[0] || "");
            const mode = String(entry[1] || "");
            const data = entry[2];

            if (kanji && (mode === "jlpt" || mode === "freq" || mode === "stats")) {
              const dataStr = typeof data === "string" ? data : JSON.stringify(data);
              const m = dataStr.match(/N?([1-5])/i);
              if (m) {
                const jlptVal = `N${m[1]}`;
                const existing = kanjiMap.get(kanji) || { kanji, onyomi: [], kunyomi: [], meanings: [] };
                kanjiMap.set(kanji, { ...existing, jlpt: jlptVal });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ Error indexing ${filename}:`, err);
    }
  }

  // Merge frequency/pitch data onto matching terms now that every dictionary has been read (a
  // term's freq/pitch entry can come from a different ZIP than the term itself, e.g. JPDB ranks
  // JIDict/Jitendex headwords). Pitch is matched by reading too since a kanji expression can have
  // multiple readings with different pitch accents.
  //
  // Also backfills example sentences across dictionaries for the same expression: only
  // dictionaries with Yomitan-style structured-content (Jitendex) produce an `example` via
  // extractExtras, so a plain-glossary dictionary's entry (JIDict, 三省堂, ...) for a word that
  // *does* have an example elsewhere in the index would otherwise show no example at all, even
  // though one is sitting right there for the same expression. Mirrors what Jitendex itself
  // already does internally - its own alternate-reading entries for a word share one example
  // rather than each needing a reading-specific one - so this isn't inventing new behavior.
  let termsWithExtras = 0;
  let backfilledExamples = 0;
  for (const terms of termMap.values()) {
    const sharedExample = terms.find((t) => t.example)?.example;
    for (const term of terms) {
      const freqList = freqData.get(term.expression);
      if (freqList && freqList.length > 0) {
        term.frequency = freqList;
      }
      const pitchList = pitchData.get(term.expression);
      if (pitchList) {
        const match = pitchList.find((p) => p.reading === term.reading) || pitchList[0];
        if (match) term.pitchPosition = match.position;
      }
      if (!term.example && sharedExample) {
        term.example = sharedExample;
        backfilledExamples++;
      }
      if (term.frequency || term.pitchPosition !== undefined || term.example || term.forms) {
        termsWithExtras++;
      }
    }
  }

  // Helper functions for scoring
  function getDictPriority(dictName) {
    if (!dictName) return 0;
    const lower = dictName.toLowerCase();
    if (lower.includes("jidict")) return 100;
    if (lower.includes("jitendex")) return 90;
    if (lower.includes("三省堂")) return 80;
    if (lower.includes("jpdb")) return 70;
    if (lower.includes("nhk")) return 60;
    if (lower.includes("jlpt")) return 50;
    if (lower.includes("やさしい")) return 10;
    return 30;
  }

  const PRIMARY_READING_MAP = {
    男: "おとこ",
    女: "おんな",
    人: "ひと",
    言: "い",
    行: "い",
    見: "み",
    食: "た",
    書: "か",
    読: "よ",
    聞: "き",
    思: "おも",
    告: "つ",
    出: "で",
    起: "お",
    家: "いえ",
    誰: "だれ",
    飲: "の",
    外: "そと",
    暇: "ひま",
    恥: "はず",
    恥ずかしい: "はずかしい",
    恥ずかしがって: "はずかしがって",
    付: "つき",
    付き合い: "つきあい",
    付き合う: "つきあう",
    付き合って: "つきあって",
    付き合っている: "つきあっている",
    ろくに: "ろくに",
    陸に: "ろくに",
    できなかった: "できなかった",
    なかった: "なかった",
    できない: "できない",
    できる: "できる",
    できた: "できた",
    はずだ: "はずだ",
    はず: "はず",
    私: "わたし",
    私が: "わたしが",
    俺: "おれ",
    俺が: "おれが",
    俺は: "おれは",
    俺の: "おれの",
    俺を: "おれを",
    俺に: "おれに",
    僕: "ぼく",
    僕が: "ぼくが",
    事故: "じこ",
    起きた: "おきた",
    起きる: "おきる",
    兄さん: "にいさん",
    お兄さん: "おにいさん",
    母さん: "かあさん",
    お母さん: "おかあさん",
    忙しい: "いそがしい",
    私: "わたし",
    俺: "おれ",
    僕: "ぼく",
    日: "ひ",
    水: "みず",
    木: "き",
    金: "かね",
    土: "つち",
    山: "やま",
    川: "かわ",
    空: "そら",
    雨: "あめ",
    手: "て",
    目: "め",
    口: "くち",
    耳: "みみ",
    足: "あし",
    心: "こころ",
  };

  function calculateTermScore(term) {
    let score = getDictPriority(term.dictName) * 1000;

    if (PRIMARY_READING_MAP[term.expression]) {
      const primary = PRIMARY_READING_MAP[term.expression];
      if (term.reading === primary) {
        score += 5000;
      } else if (term.reading.length < primary.length) {
        score -= 1000;
      }
    }
    
    if (typeof term.score === "number") {
      score += term.score * 10;
    }

    const tagsStr = (term.tags || []).join(" ").toLowerCase();
    if (tagsStr.includes("p") || tagsStr.includes("common") || tagsStr.includes("jlpt") || /n[1-5]/.test(tagsStr)) {
      score += 500;
    }

    if (term.expression && term.expression.length === 1 && /[\u4e00-\u9faf]/.test(term.expression)) {
      if (term.reading && term.reading.length >= 2) {
        score += 200;
      }
    }

    return score;
  }

  // Pre-sort all term arrays by score before saving
  for (const [expr, terms] of termMap.entries()) {
    terms.sort((a, b) => calculateTermScore(b) - calculateTermScore(a));
  }

  // Ensure public and src/data directories exist
  const outputDirs = [
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "src", "data"),
    path.join(process.cwd(), ".next"),
  ];

  const payload = JSON.stringify({
    terms: Array.from(termMap.entries()),
    kanji: Array.from(kanjiMap.entries()),
  });

  for (const outDir of outputDirs) {
    try {
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const cachePath = path.join(outDir, "dict-cache-v1.json");
      fs.writeFileSync(cachePath, payload);
      console.log(`✅ Dictionary cache saved to ${cachePath}`);
    } catch (err) {
      console.warn(`Failed writing to ${outDir}:`, err);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✨ Dictionary indexing complete in ${duration}s! Total Terms: ${termMap.size}, Total Kanji: ${kanjiMap.size}, Terms with frequency/pitch/example/forms: ${termsWithExtras}`);
}

buildCache().catch(console.error);
