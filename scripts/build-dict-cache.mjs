import fs from "fs";
import path from "path";
import JSZip from "jszip";

function parseStructuredNode(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    return node.map(parseStructuredNode).filter(Boolean).join(" ");
  }
  if (typeof node === "object") {
    if (node.content) return parseStructuredNode(node.content);
    if (node.text) return String(node.text);
  }
  return "";
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
        /term_bank_\d+\.json$/i.test(name) || /term_meta_bank_\d+\.json$/i.test(name)
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

              const termObj = {
                dictName: dictTitle,
                expression,
                reading: reading || expression,
                meanings,
                tags: allTags,
                score: rawScore,
              };

              const existing = termMap.get(expression) || [];
              existing.push(termObj);
              termMap.set(expression, existing);
            }
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
  console.log(`✨ Dictionary indexing complete in ${duration}s! Total Terms: ${termMap.size}, Total Kanji: ${kanjiMap.size}`);
}

buildCache().catch(console.error);
