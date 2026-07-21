import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

interface ServerTerm {
  dictName: string;
  expression: string;
  reading: string;
  meanings: string[];
  tags?: string[];
  rules?: string;
  score?: number;
  pitch?: string;
  jlpt?: string;
}

interface ServerKanji {
  kanji: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
}

let isIndexBuilding = false;
let isIndexReady = false;
const termMap = new Map<string, ServerTerm[]>();
const kanjiMap = new Map<string, ServerKanji>();

// Recursively parse Yomitan Structured Content AST into clean text
function parseStructuredNode(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);

  if (Array.isArray(node)) {
    return node.map(parseStructuredNode).filter(Boolean).join(" ");
  }

  if (typeof node === "object") {
    if (node.content) {
      return parseStructuredNode(node.content);
    }
    if (node.text) {
      return String(node.text);
    }
  }

  return "";
}

function cleanMeaningString(text: any): string {
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

// Helper to prioritize mainstream dictionaries (JIDict, Jitendex, Sanseido) over niche dictionaries (e.g. やさしい)
function getDictPriority(dictName?: string): number {
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

const PRIMARY_READING_MAP: Record<string, string> = {
  男: "おとこ",
  女: "おんな",
  人: "ひと",
  言: "い",       // 言 -> い (stem for 言う, 言っている, 言った)
  行: "い",       // 行 -> い (stem for 行く, 行っている, 行った)
  見: "み",       // 見 -> み (stem for 見る, 見ている)
  食: "た",       // 食 -> た (stem for 食べる, 食べている)
  書: "か",       // 書 -> か (stem for 書く, 書いている)
  読: "よ",       // 読 -> よ (stem for 読む, 読んでいる)
  聞: "き",       // 聞 -> き (stem for 聞く, 聞いている)
  思: "おも",     // 思 -> おも (stem for 思う, 思っている)
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

function calculateTermScore(term: ServerTerm): number {
  let score = getDictPriority(term.dictName) * 1000;

  // Primary reading map guarantee (+5000 bonus / -1000 penalty)
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
  if (term.jlpt) {
    score += 300;
  }

  // Single Kanji Heuristic: favor standard 2+ character readings (e.g. おとこ over お for 男, おんな over め for 女)
  if (term.expression && term.expression.length === 1 && /[\u4e00-\u9faf]/.test(term.expression)) {
    if (term.reading && term.reading.length >= 2) {
      score += 200;
    }
  }

  return score;
}

// Core Fallback Dictionary Data
const CORE_FALLBACKS: Record<string, ServerTerm[]> = {
  チャラ男: [
    { dictName: "JIDict (Indonesian)", expression: "チャラ男", reading: "チャラおとこ", meanings: ["Chara-otoko (pria gaul/flirty man)"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "チャラ男", reading: "チャラおとこ", meanings: ["playboy, shallow man who dresses flashily"], tags: ["P"] },
  ],
  男: [
    { dictName: "JIDict (Indonesian)", expression: "男", reading: "おとこ", meanings: ["Laki-laki; pria; gagah"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "男", reading: "おとこ", meanings: ["man; male"], jlpt: "N5", tags: ["P"] },
  ],
  女: [
    { dictName: "JIDict (Indonesian)", expression: "女", reading: "おんな", meanings: ["Perempuan; wanita"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "女", reading: "おんな", meanings: ["woman; female"], jlpt: "N5", tags: ["P"] },
  ],
  子: [
    { dictName: "JIDict (Indonesian)", expression: "子", reading: "こ", meanings: ["Anak; bocah"], jlpt: "N5", tags: ["P"] },
  ],
  人: [
    { dictName: "JIDict (Indonesian)", expression: "人", reading: "ひと", meanings: ["Orang; manusia"], jlpt: "N5", tags: ["P"] },
  ],
  言: [
    { dictName: "JIDict (Indonesian)", expression: "言", reading: "い", meanings: ["Bicara; kata (stems: 言う, 言っている, 言った)"], jlpt: "N5", tags: ["P"] },
  ],
  美雪: [
    { dictName: "JIDict (Indonesian)", expression: "美雪", reading: "みゆき", meanings: ["Miyuki (nama perempuan / salju indah)"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "美雪", reading: "みゆき", meanings: ["Miyuki (female given name / beautiful snow)"], tags: ["P"] },
  ],
  美: [
    { dictName: "JIDict (Indonesian)", expression: "美", reading: "み", meanings: ["Cantik; indah; agung"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "美", reading: "び", meanings: ["beauty"], tags: ["P"] },
  ],
  はぁ: [
    { dictName: "JIDict (Indonesian)", expression: "はぁ", reading: "はぁ", meanings: ["Haa... (desah/helan napas, seruan terkejut/bingung)"], jlpt: "N5" },
    { dictName: "Jitendex (English)", expression: "はぁ", reading: "haa", meanings: ["sigh, gasp, expression of surprise or exasperation"] },
  ],
  はあ: [
    { dictName: "JIDict (Indonesian)", expression: "はあ", reading: "はあ", meanings: ["Haa... (desah/helan napas, ya/tentu)"], jlpt: "N5" },
  ],
  ふぅ: [
    { dictName: "JIDict (Indonesian)", expression: "ふぅ", reading: "ふぅ", meanings: ["Fuu... (helan napas lega/lelah)"] },
  ],
  へぇ: [
    { dictName: "JIDict (Indonesian)", expression: "へぇ", reading: "へぇ", meanings: ["Hee... (seruan kagum/heran/terkejut)"] },
  ],
  そんな: [
    { dictName: "JIDict (Indonesian)", expression: "そんな", reading: "そんな", meanings: ["Seperti itu, yang seperti itu"], jlpt: "N5" },
    { dictName: "Jitendex (English)", expression: "そんな", reading: "そんな", meanings: ["such, that sort of, like that"], jlpt: "N5" },
  ],
  お前: [
    { dictName: "JIDict (Indonesian)", expression: "お前", reading: "おまえ", meanings: ["Kamu, kau (informal / agak kasar)", "Engkau"], jlpt: "N5" },
    { dictName: "Jitendex (English)", expression: "お前", reading: "おまえ", meanings: ["You (informal or familiar male speech)", "Presence (of a high-ranking person)"], jlpt: "N5" },
  ],
  今日は: [
    { dictName: "JIDict (Indonesian)", expression: "今日は", reading: "きょうは", meanings: ["Hari ini (sebagai topik pembicaraan)"], jlpt: "N5" },
  ],
  今日: [
    { dictName: "JIDict (Indonesian)", expression: "今日", reading: "きょう", meanings: ["Hari ini"], jlpt: "N5" },
  ],
  浮気: [
    { dictName: "JIDict (Indonesian)", expression: "浮気", reading: "うわき", meanings: ["Perselingkuhan, kecurangan"], jlpt: "N2" },
  ],
  発覚: [
    { dictName: "JIDict (Indonesian)", expression: "発覚", reading: "はっかく", meanings: ["Terbongkar, terungkapnya rahasia/kejahatan"], jlpt: "N1" },
  ],
  いじめ: [
    { dictName: "JIDict (Indonesian)", expression: "いじめ", reading: "いじめ", meanings: ["Perundungan, pembulian"], jlpt: "N2" },
  ],
  私: [
    { dictName: "JIDict (Indonesian)", expression: "私", reading: "わたし", meanings: ["Saya, aku"], jlpt: "N5" },
  ],
  俺: [
    { dictName: "JIDict (Indonesian)", expression: "俺", reading: "おれ", meanings: ["Aku (laki-laki informal)"], jlpt: "N3" },
  ],
  僕: [
    { dictName: "JIDict (Indonesian)", expression: "僕", reading: "ぼく", meanings: ["Aku (laki-laki)"], jlpt: "N5" },
  ],
  学校: [
    { dictName: "JIDict (Indonesian)", expression: "学校", reading: "がっこう", meanings: ["Sekolah"], jlpt: "N5" },
  ],
};

const CORE_KANJI_FALLBACKS: Record<string, ServerKanji> = {
  男: { kanji: "男", onyomi: ["ダン", "ナン"], kunyomi: ["おとこ"], meanings: ["Laki-laki, pria", "Man, male"] },
  女: { kanji: "女", onyomi: ["ジョ", "ニョ"], kunyomi: ["おんな"], meanings: ["Wanita, perempuan", "Woman, female"] },
  前: { kanji: "前", onyomi: ["ゼン"], kunyomi: ["まえ"], meanings: ["Depan, sebelum, terdahulu", "In front, before"] },
  今: { kanji: "今", onyomi: ["コン", "キン"], kunyomi: ["いま"], meanings: ["Sekarang, saat ini", "Now, present"] },
  日: { kanji: "日", onyomi: ["ニチ", "ジツ"], kunyomi: ["ひ", "か"], meanings: ["Hari, matahari", "Day, sun"] },
  浮: { kanji: "浮", onyomi: ["フ"], kunyomi: ["う-く"], meanings: ["Mengapung, melayang", "Float, rise"] },
  気: { kanji: "気", onyomi: ["キ", "ケ"], kunyomi: ["き"], meanings: ["Perasaan, pikiran, udara", "Spirit, mind"] },
  発: { kanji: "発", onyomi: ["ハツ", "ホツ"], kunyomi: ["たつ"], meanings: ["Menerbitkan, terbongkar", "Discharge, emit"] },
  覚: { kanji: "覚", onyomi: ["カク"], kunyomi: ["おぼ-える"], meanings: ["Mengingat, sadar", "Memorize, awake"] },
  学: { kanji: "学", onyomi: ["ガク"], kunyomi: ["まな-ぶ"], meanings: ["Belajar, ilmu", "Study, learn"] },
  校: { kanji: "校", onyomi: ["コウ"], kunyomi: [], meanings: ["Sekolah", "School"] },
  私: { kanji: "私", onyomi: ["シ"], kunyomi: ["わたし", "わたくし"], meanings: ["Saya, aku, pribadi", "I, me, private"] },
  俺: { kanji: "俺", onyomi: ["エン"], kunyomi: ["おれ"], meanings: ["Aku (laki-laki informal)", "I, me"] },
  僕: { kanji: "僕", onyomi: ["ボク"], kunyomi: ["しもべ"], meanings: ["Aku (laki-laki)", "I, me, servant"] },
  人: { kanji: "人", onyomi: ["ジン", "ニン"], kunyomi: ["ひと"], meanings: ["Orang, manusia", "Person, human"] },
  生: { kanji: "生", onyomi: ["セイ", "ショウ"], kunyomi: ["い-きる", "う-まれる", "なま"], meanings: ["Hidup, lahir, mentah", "Life, birth"] },
  行: { kanji: "行", onyomi: ["コウ", "ギョウ"], kunyomi: ["い-く", "おこな-う"], meanings: ["Pergi, melakukan", "Go, conduct"] },
  見: { kanji: "見", onyomi: ["ケン"], kunyomi: ["み-る"], meanings: ["Melihat, tampak", "See, look"] },
  言: { kanji: "言", onyomi: ["ゲン", "ゴン"], kunyomi: ["い-う", "こと"], meanings: ["Bicara, kata", "Say, word"] },
  心: { kanji: "心", onyomi: ["シン"], kunyomi: ["こころ"], meanings: ["Hati, pikiran, perasaan", "Heart, mind"] },
};

function initCoreFallbacks() {
  for (const [expr, terms] of Object.entries(CORE_FALLBACKS)) {
    const existing = termMap.get(expr) || [];
    const filteredExisting = existing.filter(
      (t) => !terms.some((c) => c.reading === t.reading && c.dictName === t.dictName)
    );
    const combined = [...terms, ...filteredExisting];
    combined.sort((a, b) => calculateTermScore(b) - calculateTermScore(a));
    termMap.set(expr, combined);
  }
  for (const [k, obj] of Object.entries(CORE_KANJI_FALLBACKS)) {
    if (!kanjiMap.has(k)) kanjiMap.set(k, obj);
  }
}

const CACHE_FILES = [
  path.join(process.cwd(), "src", "data", "dict-cache-v1.json"),
  path.join(process.cwd(), "public", "dict-cache-v1.json"),
  path.join(process.cwd(), ".next", "dict-cache-v1.json"),
];

async function buildServerIndexInBackground() {
  if (isIndexReady || isIndexBuilding) return;
  isIndexBuilding = true;

  // Try loading pre-built disk cache (< 10ms instant load on refresh)
  try {
    for (const cacheFile of CACHE_FILES) {
      if (fs.existsSync(cacheFile)) {
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
        if (cachedData.terms && cachedData.terms.length > 0) {
          for (const [k, v] of cachedData.terms) {
            termMap.set(k, v);
          }
          for (const [k, v] of cachedData.kanji) {
            kanjiMap.set(k, v);
          }
          isIndexReady = true;
          isIndexBuilding = false;
          return;
        }
      }
    }
  } catch (err) {
    console.warn("Could not load dict disk cache:", err);
  }

  initCoreFallbacks();

  let refDir = path.join(process.cwd(), "reference", "kotoba-rumus");
  if (!fs.existsSync(refDir)) {
    refDir = path.join(process.cwd(), "reference");
  }

  if (!fs.existsSync(refDir)) {
    isIndexReady = true;
    isIndexBuilding = false;
    return;
  }

  try {
    const files = fs.readdirSync(refDir).filter((f) => {
      const lower = f.toLowerCase();
      return lower.endsWith(".zip") && !lower.includes("素材辞典");
    });

    await Promise.all(
      files.map(async (filename) => {
        try {
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

          await Promise.all(
            termFiles.map(async (tf) => {
              const fileObj = contents.file(tf);
              if (!fileObj) return;
              const text = await fileObj.async("string");
              const entries = JSON.parse(text);

              for (const entry of entries) {
                if (Array.isArray(entry) && entry.length >= 6) {
                  const expression = String(entry[0] || "");
                  const reading = String(entry[1] || "");
                  const rawMeanings = entry[5];

                  let meanings: string[] = [];
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

                    const termObj: ServerTerm = {
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
            })
          );

          const kanjiFiles = Object.keys(contents.files).filter((name) =>
            /kanji_bank_\d+\.json$/i.test(name)
          );

          await Promise.all(
            kanjiFiles.map(async (kf) => {
              const fileObj = contents.file(kf);
              if (!fileObj) return;
              const text = await fileObj.async("string");
              const entries = JSON.parse(text);

              for (const entry of entries) {
                if (Array.isArray(entry) && entry.length >= 5) {
                  const kanji = String(entry[0] || "");
                  const onyomi = typeof entry[1] === "string" ? entry[1].split(/\s+/) : [];
                  const kunyomi = typeof entry[2] === "string" ? entry[2].split(/\s+/) : [];
                  const meanings = Array.isArray(entry[4])
                    ? entry[4].map(cleanMeaningString).filter(Boolean)
                    : [cleanMeaningString(entry[4])].filter(Boolean);

                  if (kanji) {
                    kanjiMap.set(kanji, { kanji, onyomi, kunyomi, meanings });
                  }
                }
              }
            })
          );
        } catch (err) {
          console.warn(`Error indexing server dictionary ${filename}:`, err);
        }
      })
    );

    // Save persistent disk cache for instant loading on future refreshes
    try {
      const targetCacheFile = CACHE_FILES[0];
      const cacheDir = path.dirname(targetCacheFile);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        targetCacheFile,
        JSON.stringify({
          terms: Array.from(termMap.entries()),
          kanji: Array.from(kanjiMap.entries()),
        })
      );
    } catch (e) {
      console.warn("Failed to write dict disk cache:", e);
    }
  } catch (err) {
    console.error("Server dictionary index error:", err);
  }

  isIndexReady = true;
  isIndexBuilding = false;
}

export async function GET(request: Request) {
  initCoreFallbacks();
  if (!isIndexReady && !isIndexBuilding) {
    buildServerIndexInBackground();
  }

  const { searchParams } = new URL(request.url);

  // Status check endpoint for client dictionary readiness indicator
  if (searchParams.has("status")) {
    return NextResponse.json({
      isReady: isIndexReady,
      isBuilding: isIndexBuilding,
      totalTerms: termMap.size,
      totalKanji: kanjiMap.size,
    });
  }

  const q = searchParams.get("q")?.trim() || "";

  const cleanQuery = q.substring(0, 50);

  if (!cleanQuery) {
    return NextResponse.json({
      query: "",
      reading: "",
      terms: [],
      kanjiList: [],
      segmentedWords: [],
    });
  }

  const matchedTerms: ServerTerm[] = [];
  const matchedKanji: ServerKanji[] = [];
  const segmentedWords: any[] = [];

  // Direct Match
  const direct = termMap.get(cleanQuery);
  if (direct && direct.length > 0) {
    matchedTerms.push(...direct);
  }

  // Word Segmentation
  let cursor = 0;
  let computedReading = "";

  while (cursor < cleanQuery.length) {
    let found = false;
    for (let len = Math.min(10, cleanQuery.length - cursor); len >= 1; len--) {
      const sub = cleanQuery.substring(cursor, cursor + len);
      const rawSubMatches = termMap.get(sub);
      if (rawSubMatches && rawSubMatches.length > 0) {
        // Sort subMatches using comprehensive scoring (dictionary priority + Yomitan score + popularity tags + length heuristics)
        const subMatches = [...rawSubMatches].sort(
          (a, b) => calculateTermScore(b) - calculateTermScore(a)
        );
        const top = subMatches[0];
        segmentedWords.push({
          text: sub,
          reading: top.reading,
          meanings: top.meanings,
          dictName: top.dictName,
        });
        computedReading += top.reading || sub;

        for (const m of subMatches) {
          if (!matchedTerms.some((t) => t.expression === m.expression && t.dictName === m.dictName)) {
            matchedTerms.push(m);
          }
        }
        cursor += len;
        found = true;
        break;
      }
    }

    if (!found) {
      const char = cleanQuery[cursor];
      computedReading += char;
      if (/[\u4e00-\u9faf]/.test(char)) {
        const kObj = kanjiMap.get(char);
        if (kObj) {
          segmentedWords.push({ text: char, meanings: kObj.meanings });
        }
      }
      cursor++;
    }
  }

  // Extract Kanji details
  const kanjiChars = Array.from(new Set(cleanQuery.match(/[\u4e00-\u9faf]/g) || []));
  for (const char of kanjiChars) {
    const kObj = kanjiMap.get(char);
    if (kObj) {
      matchedKanji.push(kObj);
    } else {
      matchedKanji.push({
        kanji: char,
        onyomi: [],
        kunyomi: [],
        meanings: ["Karakter Kanji"],
      });
    }
  }

  // Sort matched terms using comprehensive scoring (dictionary priority + popularity tags)
  matchedTerms.sort((a, b) => calculateTermScore(b) - calculateTermScore(a));

  const exactTermMatch = matchedTerms.find((t) => t.expression === cleanQuery);
  const finalReading = (exactTermMatch && exactTermMatch.reading)
    ? exactTermMatch.reading
    : (computedReading || cleanQuery);

  return NextResponse.json({
    query: cleanQuery,
    reading: finalReading,
    terms: matchedTerms,
    kanjiList: matchedKanji,
    segmentedWords,
  });
}
