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
    } catch (e) {
      return text
        .replace(/\{"type":"[^"]+","content":|\[|\{|\}|"tag":"[^"]+"|"data":\{[^}]+\}|"style":\{[^}]+\}/g, "")
        .replace(/["\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return text.trim();
}

// Core Fallback Dictionary Data
const CORE_FALLBACKS: Record<string, ServerTerm[]> = {
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
  前: { kanji: "前", onyomi: ["ゼン"], kunyomi: ["まえ"], meanings: ["Depan, sebelum, terdahulu", "In front, before"] },
  今: { kanji: "今", onyomi: ["コン", "キン"], kunyomi: ["いま"], meanings: ["Sekarang, saat ini", "Now, present"] },
  日: { kanji: "日", onyomi: ["ニチ", "ジツ"], kunyomi: ["ひ", "か"], meanings: ["Hari, matahari", "Day, sun"] },
  浮: { kanji: "浮", onyomi: ["フ"], kunyomi: ["う-く"], meanings: ["Mengapung, melayang", "Float, rise"] },
  気: { kanji: "気", onyomi: ["キ", "ケ"], kunyomi: ["き"], meanings: ["Perasaan, pikiran, udara", "Spirit, mind"] },
  発: { kanji: "発", onyomi: ["ハツ", "ホツ"], kunyomi: ["たつ"], meanings: ["Menerbitkan, terbongkar", "Discharge, emit"] },
  覚: { kanji: "覚", onyomi: ["カク"], kunyomi: ["おぼ-える"], meanings: ["Mengingat, sadar", "Memorize, awake"] },
  学: { kanji: "学", onyomi: ["ガク"], kunyomi: ["まな-ぶ"], meanings: ["Belajar, ilmu", "Study, learn"] },
  校: { kanji: "校", onyomi: ["コウ"], kunyomi: [], meanings: ["Sekolah", "School"] },
};

function initCoreFallbacks() {
  for (const [expr, terms] of Object.entries(CORE_FALLBACKS)) {
    if (!termMap.has(expr)) termMap.set(expr, terms);
  }
  for (const [k, obj] of Object.entries(CORE_KANJI_FALLBACKS)) {
    if (!kanjiMap.has(k)) kanjiMap.set(k, obj);
  }
}

async function buildServerIndexInBackground() {
  if (isIndexBuilding) return;
  isIndexBuilding = true;

  initCoreFallbacks();

  const refDir = path.join(process.cwd(), "reference", "kotoba-rumus");
  if (!fs.existsSync(refDir)) {
    isIndexReady = true;
    return;
  }

  try {
    const files = fs.readdirSync(refDir).filter((f) => {
      const lower = f.toLowerCase();
      return lower.endsWith(".zip") && !lower.includes("素材辞典");
    });

    for (const filename of files) {
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
          } catch (e) {}
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

              let meanings: string[] = [];
              if (Array.isArray(rawMeanings)) {
                meanings = rawMeanings.map(cleanMeaningString).filter(Boolean);
              } else if (rawMeanings) {
                const cleaned = cleanMeaningString(rawMeanings);
                if (cleaned) meanings = [cleaned];
              }

              if (expression && meanings.length > 0) {
                const termObj: ServerTerm = {
                  dictName: dictTitle,
                  expression,
                  reading: reading || expression,
                  meanings,
                  tags: typeof entry[2] === "string" ? [entry[2]] : [],
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
        }
      } catch (err) {
        console.warn(`Error indexing server dictionary ${filename}:`, err);
      }
    }
  } catch (err) {
    console.error("Server dictionary index error:", err);
  }

  isIndexReady = true;
}

export async function GET(request: Request) {
  initCoreFallbacks();
  if (!isIndexReady) {
    buildServerIndexInBackground();
  }

  const { searchParams } = new URL(request.url);
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
      const subMatches = termMap.get(sub);
      if (subMatches && subMatches.length > 0) {
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

  const topReading = matchedTerms.length > 0 ? matchedTerms[0].reading : "";
  const finalReading = topReading || computedReading || cleanQuery;

  return NextResponse.json({
    query: cleanQuery,
    reading: finalReading,
    terms: matchedTerms,
    kanjiList: matchedKanji,
    segmentedWords,
  });
}
