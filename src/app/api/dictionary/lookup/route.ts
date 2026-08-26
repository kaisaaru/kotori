import { NextResponse, after } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { getBaseForms } from "@/lib/japanese/deinflector";

interface ServerTerm {
  dictName: string;
  expression: string;
  reading: string;
  meanings: string[];
  tags?: string[];
  rules?: string;
  score?: number;
  jlpt?: string;
  deinflectionRules?: string[];
  example?: { japanese: string; translation: string };
  forms?: string[];
  frequency?: { dictName: string; rank: number; display: string }[];
  pitchPosition?: number;
}

interface ServerKanji {
  kanji: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
  jlpt?: string;
}

let isIndexBuilding = false;
let isIndexReady = false;
const termMap = new Map<string, ServerTerm[]>();
const kanjiMap = new Map<string, ServerKanji>();
// Secondary index keyed by reading (not expression) - lets a word spelled in pure kana in the
// source text (e.g. おかげで) resolve to a dictionary entry whose headword is written in kanji
// (お陰で) but shares the same reading. Derived from termMap after it's populated, in-memory only.
const readingMap = new Map<string, ServerTerm[]>();

function buildReadingIndex() {
  readingMap.clear();
  for (const terms of termMap.values()) {
    for (const term of terms) {
      if (!term.reading || term.reading === term.expression) continue; // already kana - findable via termMap directly
      const existing = readingMap.get(term.reading);
      if (existing) existing.push(term);
      else readingMap.set(term.reading, [term]);
    }
  }
}

// Blocks that add no value flattened into plain text (example sentences and forms aren't
// extracted on this fallback path, but leaving them in the flat string is worse - they used to
// run into the glossary text with no separator and get mangled by client-side cleanup heuristics).
const FLATTEN_SKIP_MARKERS = new Set(["example-sentence", "forms", "attribution"]);

// Recursively parse Yomitan Structured Content AST into clean text
function parseStructuredNode(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);

  if (Array.isArray(node)) {
    return node.map(parseStructuredNode).filter(Boolean).join(" ");
  }

  if (typeof node === "object") {
    if (node.data && FLATTEN_SKIP_MARKERS.has(node.data.content)) return "";
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

// Trailing particle characters worth splitting off a longer greedy match, when the substring
// without the particle is also a valid dictionary entry on its own (see segmentation loop below).
const PARTICLE_CHARS = new Set(["は", "が", "を", "に", "で", "と", "も", "へ", "や"]);

// Pure hiragana/katakana test, used to gate the reading-fallback pass below - reading-lookup only
// makes sense against a span that's actually written in kana in the source text.
const KANA_ONLY_RE = /^[ぁ-ゖァ-ヺー]+$/;

// Tries the longest dictionary-valid substring of `query` starting EXACTLY at `pos`, trying
// lengths from min(10, remaining) down to 1 - never backward. Shared by the whole-chunk
// segmentation walk (tryDeinflection: false, preserves segmentedWords exactly as before) and the
// pos-anchored single-word resolver (tryDeinflection: true). Forward-only, no backward
// token-boundary search, is intentional: it matches how real Yomitan scans (starting exactly at
// the hover point and never looking backward), which is also why hovering deeper into a compound
// word (e.g. 二年生 -> hover 年 gives 年生, hover 生 gives just 生) yields progressively shorter,
// independently-anchored matches instead of always resolving to the same whole compound.
//
// At each length, tries literal match, then deinflection, then reading-fallback (for pure-kana
// spans) - all THREE at the SAME length - before shrinking to a shorter length. This ordering
// matters: it keeps "longest match wins" as the top priority (matching real Yomitan's ranking,
// which sorts by match length before match-type purity) while still preferring a literal/exact
// hit over a reading-based one whenever both exist at the same length. A naive two-pass design
// (exhaust all lengths against termMap first, only then try readingMap) would let a short
// literal match - e.g. "と" the particle - incorrectly win over a longer, correct reading match
// - e.g. "とわ" (永遠/常/etc, "eternity") - since the literal pass would return at length 1
// before ever reaching the reading pass. Verified against this project's dictionary data: "と"
// exists as its own literal entry, but "とわ" does not - only reachable via reading.
function findLongestTermAt(
  query: string,
  pos: number,
  opts: { tryDeinflection?: boolean } = {}
): { len: number; sub: string; matches: ServerTerm[]; deinflectionRules?: string[]; isReadingMatch?: boolean } | null {
  const maxLen = Math.min(10, query.length - pos);
  for (let len = maxLen; len >= 1; len--) {
    const sub = query.substring(pos, pos + len);

    // Same particle-split heuristic as before: don't greedily swallow a trailing particle when
    // the substring-without-particle is independently valid.
    if (len >= 2 && PARTICLE_CHARS.has(sub[sub.length - 1]) && termMap.has(sub.slice(0, -1))) {
      continue;
    }

    const direct = termMap.get(sub);
    if (direct && direct.length > 0) {
      return { len, sub, matches: direct };
    }

    if (opts.tryDeinflection) {
      const baseForms = getBaseForms(sub);
      for (const bf of baseForms) {
        if (bf.word === sub) continue; // identical to the direct check above, already tried
        const deinflected = termMap.get(bf.word);
        if (deinflected && deinflected.length > 0) {
          return { len, sub, matches: deinflected, deinflectionRules: bf.rules };
        }
      }
    }

    // Reading-fallback: a word spelled in pure kana in the source text (e.g. おかげで) but
    // indexed by its kanji headword (お陰で) in termMap - tried at this SAME length before
    // shrinking, so a longer reading match still beats a shorter literal one.
    if (len >= 2 && KANA_ONLY_RE.test(sub)) {
      if (PARTICLE_CHARS.has(sub[sub.length - 1]) && readingMap.has(sub.slice(0, -1))) {
        continue;
      }
      const byReading = readingMap.get(sub);
      if (byReading && byReading.length > 0) {
        return { len, sub, matches: byReading, isReadingMatch: true };
      }
    }
  }
  return null;
}

function calculateTermScore(term: ServerTerm): number {
  let score = getDictPriority(term.dictName) * 1000;

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

const CACHE_FILES = [
  path.join(process.cwd(), "src", "data", "dict-cache-v1.json"),
  path.join(process.cwd(), "public", "dict-cache-v1.json"),
  path.join(process.cwd(), ".next", "dict-cache-v1.json"),
];

// Fires off the (potentially multi-second, 292MB-cache-parsing) index build via after() so it
// never blocks the response that triggered it - an unawaited call alone does NOT achieve this,
// since JS runs an async function synchronously up to its first `await`, and the disk-cache-load
// branch below has no `await` until the file read, so calling it bare would still block the event
// loop (and therefore this very request's own response) for the full parse+index duration.
function buildServerIndexInBackground() {
  if (isIndexReady || isIndexBuilding) return;
  isIndexBuilding = true;
  after(doBuildServerIndex);
}

async function doBuildServerIndex() {
  // Try loading pre-built disk cache (< 10ms instant load on refresh)
  try {
    for (const cacheFile of CACHE_FILES) {
      if (fs.existsSync(cacheFile)) {
        const cachedData = JSON.parse(await fs.promises.readFile(cacheFile, "utf-8"));
        if (cachedData.terms && cachedData.terms.length > 0) {
          for (const [k, v] of cachedData.terms) {
            termMap.set(k, v);
          }
          for (const [k, v] of cachedData.kanji) {
            kanjiMap.set(k, v);
          }
          buildReadingIndex();
          isIndexReady = true;
          isIndexBuilding = false;
          return;
        }
      }
    }
  } catch (err) {
    console.warn("Could not load dict disk cache:", err);
  }

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

    // Save persistent disk cache for instant loading on future refreshes.
    // Write into .next/ rather than src/data/: dropping a multi-hundred-MB file inside the watched
    // source tree invalidates the dev compiler, which re-evaluates this route module and resets the
    // module-scope index flags below - making the dictionary appear to rebuild itself at random.
    try {
      const targetCacheFile = CACHE_FILES[2];
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

  buildReadingIndex();
  isIndexReady = true;
  isIndexBuilding = false;
}

export async function GET(request: Request) {
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
  const termPositionMap = new Map<ServerTerm, number>();

  // Direct Match
  const baseForms = getBaseForms(cleanQuery);
  const processedWords = new Set<string>();

  for (const bf of baseForms) {
    if (processedWords.has(bf.word)) continue;
    processedWords.add(bf.word);

    const direct = termMap.get(bf.word);
    if (direct && direct.length > 0) {
      for (const d of direct) {
        const clonedTerm = { ...d };
        if (bf.rules && bf.rules.length > 0) {
          clonedTerm.deinflectionRules = bf.rules;
        }
        matchedTerms.push(clonedTerm);
        termPositionMap.set(clonedTerm, 0);
      }
    }
  }

  // Word Segmentation
  let cursor = 0;
  let computedReading = "";

  while (cursor < cleanQuery.length) {
    const step = findLongestTermAt(cleanQuery, cursor); // no deinflection here - unchanged whole-chunk behavior
    if (step) {
      // Sort matches using comprehensive scoring (dictionary priority + Yomitan score + popularity tags + length heuristics)
      const subMatches = [...step.matches].sort(
        (a, b) => calculateTermScore(b) - calculateTermScore(a)
      );
      const top = subMatches[0];
      segmentedWords.push({
        text: step.sub,
        reading: top.reading,
        meanings: top.meanings,
        dictName: top.dictName,
      });
      computedReading += top.reading || step.sub;

      for (const m of subMatches) {
        if (!matchedTerms.some((t) => t.expression === m.expression && t.dictName === m.dictName)) {
          matchedTerms.push(m);
          termPositionMap.set(m, cursor);
        }
      }
      cursor += step.len;
    } else {
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

  // If the client tells us the exact cursor position within the (padded) query, resolve to just
  // the ONE word anchored EXACTLY at that position (trying deinflection too), instead of every
  // word the whole-chunk walk happened to find - e.g. hovering into different characters of a
  // compound word like ninensei (2-nensei -> nensei -> sei) should each resolve independently.
  const posParam = searchParams.get("pos");
  const targetPos = posParam !== null && posParam !== "" && !Number.isNaN(Number(posParam))
    ? Math.max(0, Math.min(cleanQuery.length - 1, parseInt(posParam, 10)))
    : null;

  let focusedTerms = matchedTerms;
  let focusedQuery = cleanQuery;
  let focusedStart = 0;
  let focusedLength = cleanQuery.length;

  if (targetPos !== null) {
    const anchored = findLongestTermAt(cleanQuery, targetPos, { tryDeinflection: true });
    if (anchored) {
      focusedTerms = anchored.deinflectionRules
        ? anchored.matches.map((m) => ({ ...m, deinflectionRules: anchored.deinflectionRules }))
        : anchored.matches;
      focusedQuery = focusedTerms[0]?.expression || anchored.sub;
      focusedStart = targetPos;
      focusedLength = anchored.sub.length;
    } else {
      // Nothing dictionary-valid starts exactly at the hover point (e.g. hovering mid-conjugation,
      // or a lone kana with no term entry) - degrade to just the single hovered character instead
      // of silently falling back to an unrelated word elsewhere in the chunk.
      focusedTerms = [];
      focusedQuery = cleanQuery[targetPos] || cleanQuery;
      focusedStart = targetPos;
      focusedLength = focusedQuery.length;
    }
  }

  // Extract Kanji details
  const kanjiChars = Array.from(new Set(focusedQuery.match(/[\u4e00-\u9faf]/g) || []));
  for (const char of kanjiChars) {
    let kObj = kanjiMap.get(char);

    if (!kObj && termMap.has(char)) {
      const terms = termMap.get(char)!;
      const readings = Array.from(new Set(terms.map((t) => t.reading).filter(Boolean)));
      const meanings = Array.from(
        new Set(
          terms
            .flatMap((t) => t.meanings || [])
            .map((m) => cleanMeaningString(m))
            .filter(Boolean)
        )
      );
      const onyomi = readings.filter((r) => /^[\u30a0-\u30ff]+$/.test(r));
      const kunyomi = readings.filter((r) => /^[\u3040-\u309f-]+$/.test(r));
      kObj = {
        kanji: char,
        onyomi,
        kunyomi: kunyomi.length > 0 ? kunyomi : readings,
        meanings: meanings.length > 0 ? meanings : ["Karakter Kanji"],
      };
    }

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

  // Sort matched terms:
  // 1. Primary: strictly sequentially by position of appearance in sentence (left-to-right from beginning to end)
  // 2. Secondary: by dictionary priority score for entries at the exact same position
  if (targetPos !== null) {
    // Anchored matches all come straight from termMap, not from the whole-chunk walk, so they
    // were never registered in termPositionMap - sort by score alone.
    focusedTerms.sort((a, b) => calculateTermScore(b) - calculateTermScore(a));
  } else {
    focusedTerms.sort((a, b) => {
      const posA = termPositionMap.get(a) ?? 999;
      const posB = termPositionMap.get(b) ?? 999;
      if (posA !== posB) {
        return posA - posB;
      }
      return calculateTermScore(b) - calculateTermScore(a);
    });
  }

  const exactTermMatch = focusedTerms.find((t) => t.expression === focusedQuery);
  const finalReading = (exactTermMatch && exactTermMatch.reading)
    ? exactTermMatch.reading
    : targetPos !== null
      ? (focusedTerms[0]?.reading || computedReading || focusedQuery)
      : (computedReading || focusedQuery);

  return NextResponse.json({
    query: focusedQuery,
    reading: finalReading,
    terms: focusedTerms,
    kanjiList: matchedKanji,
    segmentedWords,
    focusedStart,
    focusedLength,
    // Lets the client tell a genuine dictionary miss apart from a lookup that ran before the index
    // finished building - the latter must not be cached, or the word stays broken all session.
    indexReady: isIndexReady,
  });
}
