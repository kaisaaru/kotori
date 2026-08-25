"use client";

import { useEffect, useState, type ReactElement } from "react";
import { X, Volume2, Puzzle, ChevronDown } from "lucide-react";
import { LookupResult } from "@/services/dictionary-service";

interface DictionaryResultsProps {
  selectedText: string;
  explicitFurigana?: string;
  chunkPos?: number;
  lookupData: LookupResult | null;
  isLoading: boolean;
  ttsRate?: number;
  onClose: () => void;
}

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

function formatMeaning(text: any): string {
  if (!text) return "";
  let str = typeof text !== "string" ? parseStructuredNode(text) : text;

  if (str.startsWith("{") && (str.includes("structured-content") || str.includes('"content":'))) {
    try {
      const parsed = JSON.parse(str);
      const cleaned = parseStructuredNode(parsed).trim();
      if (cleaned) str = cleaned;
    } catch {
      str = str
        .replace(/\{"type":"[^"]+","content":|\[|\{|\}|"tag":"[^"]+"|"data":\{[^}]+\}|"style":\{[^}]+\}/g, "")
        .replace(/["\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  // 1. Remove POS tag brackets like 【形状詞-一般-* | kata sifat-na】 or 【名詞】
  str = str.replace(/【[^】]+】/g, "").trim();

  // 2. Remove etymology notes like "Note orig. written 乃 or 之"
  str = str.replace(/Note\s+(orig\.|:).*?(?=\[\d+\]|①|②|③|•|$)/gi, "");

  // 3. Remove Japanese example sentences (e.g. 私のウェブページに来て... Visit my webpage...)
  str = str.replace(/[\u3040-\u30ff\u4e00-\u9faf][^.[\]]*?(\.|\?|!|\s)+[A-Z][^.[\]]*?(\.|\?|!|$)/g, "");

  // 4. Remove raw Kokugo monolingual dictionary structural symbols & compound example blocks:
  // e.g. 《格助》, 「わたしー本・本校ー生徒...」, 「ー・、ー！」, 「一」, 「ー〔＝〕」, ○○, ＊＊, etc.
  str = str
    .replace(/《[^》]*》/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/〔[^〕]*〕/g, "")
    .replace(/[＊*○◯]{2,}/g, "")
    .replace(/[・…\.。]{2,}/g, " ")
    .replace(/（\s*）|\(\s*\)/g, "");

  // 5. Format numbered points [1], [2], ①, ② into clean bullet separators
  str = str
    .replace(/\[\d+\]/g, " • ")
    .replace(/[①-⑳]/g, " • ");

  // 6. Shorten long parenthetical notes if text is long (> 70 chars)
  if (str.length > 70) {
    str = str.replace(/\s*\([^)]*\)/g, "");
  }

  // Clean up double bullets, leading/trailing whitespace
  str = str
    .replace(/•\s*•/g, "•")
    .replace(/^\s*•\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  // If the remaining text is just leftover symbols or punctuation with no real words, return empty
  const meaningfulChars = str.replace(/[•.,;:!?()（）「」『』【】〔〕/\\_\-\s\d①-⑳a-zA-Z]/g, "");
  if (str.length > 0 && meaningfulChars.length === 0 && !/[a-zA-Z0-9]/.test(str)) {
    return "";
  }

  return str;
}

function getTermJLPT(expression: string, explicitJlpt?: string): string | undefined {
  return explicitJlpt;
}

function getScriptBadge(text: string, jlpt?: string): { label: string; bg: string; color: string; border: string } | null {
  const clean = text.trim();
  if (!clean) return null;

  // Pure Hiragana
  if (/^[\u3040-\u309f]+$/.test(clean)) {
    return {
      label: "Hiragana",
      bg: "rgba(168, 85, 247, 0.15)",
      color: "#c084fc",
      border: "rgba(168, 85, 247, 0.3)",
    };
  }

  // Pure Katakana
  if (/^[\u30a0-\u30ff]+$/.test(clean)) {
    return {
      label: "Katakana",
      bg: "rgba(20, 184, 166, 0.15)",
      color: "#2dd4bf",
      border: "rgba(20, 184, 166, 0.3)",
    };
  }

  // Contains Kanji
  if (/[\u4e00-\u9faf]/.test(clean)) {
    const computedJlpt = getTermJLPT(clean, jlpt);
    return {
      label: computedJlpt ? `Kanji ${computedJlpt}` : "Kanji",
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#fbbf24",
      border: "rgba(245, 158, 11, 0.3)",
    };
  }

  return null;
}

function parseMeaningPoints(meanings: string[]): string[] {
  const result: string[] = [];
  for (const m of meanings) {
    if (!m) continue;
    const parts = m
      .split(/(?:•|;|\n)\s*/)
      .map((p) => p.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((p) => p.length > 0);

    for (const p of parts) {
      if (!result.includes(p)) {
        result.push(p);
      }
    }
  }
  return result;
}

// Dictionary-priority sort used when de-duplicating/ranking terms for display
function getDictPriority(name: string): number {
  if (name.includes("Indonesian") || name.includes("JIDict")) return 1;
  if (name.includes("Jitendex") || name.includes("English") || name.includes("JMdict")) return 2;
  return 3;
}

function isJapaneseMonolingual(name: string): boolean {
  return /国語|三省堂|広辞苑|大辞林|新明解|明鏡|岩波|大辞泉|学研/i.test(name);
}

// Renders "漢字[かんじ]"-style inline furigana markup (produced by the indexer from Yomitan's
// <ruby>/<rt> structured-content) as real <ruby><rt> elements instead of showing the brackets.
// Matches the indexer's "{base|reading}" furigana markup - braces make each ruby's base
// unambiguous, unlike a bracket-only "base[reading]" format where a greedy "non-bracket run"
// regex can't tell plain kana sitting before a ruby apart from that ruby's own base and ends up
// swallowing it in (see rubyToFuriganaString's comment in build-dict-cache.mjs for the full story).
function renderFurigana(text: string) {
  const parts: (string | ReactElement)[] = [];
  const regex = /\{([^{}|]+)\|([^{}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <ruby key={key++}>
        {match[1]}
        <rt style={{ fontSize: "0.6em", color: "#94a3b8" }}>{match[2]}</rt>
      </ruby>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Renders a resolved (or in-flight) dictionary lookup: headword/reading, script badge, TTS/close
 * buttons, kanji chip strip, ranked definition cards, and a collapsible word-breakdown section.
 * Pure presentation - the caller owns fetching `lookupData` (SelectionPopup docks this against an
 * anchor rect for in-book taps; DictionarySearchModal drives it from a typed, debounced query).
 */
export function DictionaryResults({
  selectedText,
  explicitFurigana,
  chunkPos,
  lookupData,
  isLoading,
  ttsRate = 0.85,
  onClose,
}: DictionaryResultsProps) {
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // `selectedText` is a padded chunk (not an exact word) whenever it came from the click/hover
  // scanner - `chunkPos` marks the cursor's position within it, so the server resolves just that
  // one word instead of everything it can segment out of the padded chunk.
  const isChunkLookup = chunkPos !== undefined;

  // Collapse the breakdown section again whenever a genuinely new word is looked up.
  useEffect(() => {
    setIsBreakdownExpanded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedText, chunkPos]);

  // Auto-expand the word-breakdown section when there's no direct dictionary entry to fall back on
  useEffect(() => {
    if (!isLoading && lookupData && lookupData.terms.length === 0 && lookupData.segmentedWords.length > 0) {
      setIsBreakdownExpanded(true);
    }
  }, [isLoading, lookupData]);

  // Chrome (and others) load the voice list asynchronously - calling getVoices() immediately after
  // page load routinely returns an empty array even though voices arrive moments later via the
  // voiceschanged event. Speaking before that fires doesn't error, it just silently produces no
  // audio, which is exactly the "TTS does nothing" symptom this waits out.
  const getVoicesAsync = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      const existing = window.speechSynthesis.getVoices();
      if (existing.length > 0) {
        resolve(existing);
        return;
      }
      const onChange = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onChange);
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener("voiceschanged", onChange);
      // Some browsers never fire voiceschanged when the list is genuinely empty - don't hang forever.
      setTimeout(() => {
        window.speechSynthesis.removeEventListener("voiceschanged", onChange);
        resolve(window.speechSynthesis.getVoices());
      }, 1000);
    });
  };

  const handlePronounce = async () => {
    if (!("speechSynthesis" in window)) {
      setTtsError("Browser ini tidak mendukung Text-to-Speech");
      return;
    }
    window.speechSynthesis.cancel();
    setTtsError(null);

    const voices = await getVoicesAsync();
    if (voices.length === 0) {
      setTtsError("Tidak ada suara TTS terinstal di perangkat/browser ini");
      setTimeout(() => setTtsError(null), 4000);
      return;
    }

    // selectedText is a padded chunk (not the exact word) when this came from the click/hover
    // scanner - speak the resolved single word's reading instead of the whole raw chunk.
    const resolvedWord = lookupData?.terms?.[0]?.expression;
    // If user drag-selected a sentence or multi-word phrase (> 5 chars or containing punctuation/spaces), speak the FULL selected text!
    const isSentence = !isChunkLookup && (selectedText.length > 5 || /[。、！？\s]/.test(selectedText));
    let textToSpeak = isSentence
      ? selectedText
      : (explicitFurigana || lookupData?.reading || (isChunkLookup ? resolvedWord : selectedText) || "");

    // Fix Web Speech API reading Hiragana 'は' as 'wa' in interjections (e.g. はぁ -> ハァ)
    if (textToSpeak && /^は[ぁあっー!？~…]*$/.test(textToSpeak)) {
      textToSpeak = textToSpeak.replace(/は/g, "ハ");
    }

    if (textToSpeak) {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "ja-JP";
      utterance.rate = ttsRate;
      utterance.onerror = (e) => {
        // "interrupted"/"canceled" fire from our own cancel() calls (e.g. rapid re-clicks) - not
        // a real failure, so only surface genuine synthesis errors to the user.
        if (e.error !== "interrupted" && e.error !== "canceled") {
          setTtsError("Gagal memutar suara");
          setTimeout(() => setTtsError(null), 4000);
        }
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!selectedText.trim()) return null;

  const allRawTerms = lookupData?.terms || [];

  // selectedText is a padded chunk (not the exact word) for click/hover lookups - once the server
  // resolves the single word under the cursor, display THAT as the headword instead of the raw chunk.
  const resolvedExpression = isChunkLookup && !isLoading ? allRawTerms[0]?.expression : undefined;
  const displayHeadword = resolvedExpression || selectedText;

  const hasBilingual = allRawTerms.some((t) => !isJapaneseMonolingual(t.dictName));

  // Some dictionaries (e.g. JIDict) list multiple readings for one expression with identical
  // score/tags, so score alone can't tell them apart - fall back to how many dictionaries agree
  // on each reading (e.g. まいあさ appearing in 4 of 5 sources vs まいちょう in 2) as the last tiebreak.
  const readingVotes = new Map<string, number>();
  for (const t of allRawTerms) {
    if (t.expression && t.reading) {
      const key = `${t.expression}::${t.reading}`;
      readingVotes.set(key, (readingVotes.get(key) || 0) + 1);
    }
  }

  const validTerms = allRawTerms
    .filter((t) => !hasBilingual || !isJapaneseMonolingual(t.dictName))
    .map((t) => ({
      ...t,
      cleanMeanings: t.meanings.map(formatMeaning).filter((m) => m.length > 0),
    }))
    .filter((t) => t.cleanMeanings.length > 0)
    .sort((a, b) => {
      const priorityDiff = getDictPriority(a.dictName) - getDictPriority(b.dictName);
      if (priorityDiff !== 0) return priorityDiff;
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const votesA = readingVotes.get(`${a.expression}::${a.reading}`) ?? 0;
      const votesB = readingVotes.get(`${b.expression}::${b.reading}`) ?? 0;
      return votesB - votesA;
    });

  // A chunk lookup is never treated as a "sentence" (it's always a single-word lookup by design);
  // only an actual drag-selection can be a multi-word/sentence selection.
  const isSentenceSelection = !isChunkLookup && (selectedText.length > 6 || /[。、！？\s]/.test(selectedText));
  // For long sentences, do not show partial furigana (like [さかやなぎきじま]) under the main sentence title.
  // For single words / short phrases, show exact reading (e.g. [さかやなぎ] or [たいがく]) - prefer the
  // top-ranked card's reading (post consensus-sort) over the server's raw first-match, which can be an
  // untagged duplicate entry (e.g. JIDict listing まいちょう before まいあさ with no distinguishing score).
  const displayReading = !isSentenceSelection
    ? (explicitFurigana || validTerms[0]?.reading || lookupData?.reading)
    : undefined;

  const headerScript = getScriptBadge(displayHeadword, allRawTerms[0]?.jlpt);
  const hasKanji = !isLoading && !!lookupData && lookupData.kanjiList.length > 0;
  // Only shown as a fallback when there's no direct dictionary match - segmentedWords covers the
  // whole (often padded, surrounding-context) chunk sent to the server, not just the resolved
  // word, so surfacing it alongside real term results just adds unrelated nearby-word noise.
  const hasBreakdown = !isLoading && !!lookupData && lookupData.segmentedWords.length > 0 && validTerms.length === 0;
  // Pitch accent and alternate spellings describe the WORD, not any one dictionary's entry for it,
  // so pull them off whichever matched term happens to carry them rather than per-card.
  const headerPitch = allRawTerms.find((t) => t.pitchPosition !== undefined)?.pitchPosition;
  const headerForms = allRawTerms.find((t) => t.forms && t.forms.length > 1)?.forms;

  return (
    <>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
                color: "#38bdf8",
                lineHeight: 1.35,
                wordBreak: "break-word",
              }}
            >
              {displayHeadword}
            </span>
            {headerScript && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "6px",
                  backgroundColor: headerScript.bg,
                  color: headerScript.color,
                  border: `1px solid ${headerScript.border}`,
                  flexShrink: 0,
                }}
              >
                {headerScript.label}
              </span>
            )}
          </div>
          {displayReading && displayReading !== displayHeadword && (
            <span style={{ fontSize: "12px", color: "#cbd5e1", wordBreak: "break-word" }}>
              [{displayReading}]{headerPitch !== undefined && <sup style={{ marginLeft: "2px", color: "#38bdf8" }}>{headerPitch}</sup>}
            </span>
          )}
          {headerForms && headerForms.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {headerForms.map((form, fIdx) => (
                <span
                  key={fIdx}
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    color: "#94a3b8",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {form}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons (Voice + Close) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, position: "relative" }}>
          {ttsError && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 10,
                padding: "6px 10px",
                borderRadius: "8px",
                backgroundColor: "rgba(15, 23, 42, 0.97)",
                border: "1px solid rgba(248, 113, 113, 0.4)",
                color: "#fca5a5",
                fontSize: "11px",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              {ttsError}
            </div>
          )}
          <button
            onClick={handlePronounce}
            title="Dengarkan pengucapan"
            style={{
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              backgroundColor: "rgba(56, 189, 248, 0.2)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "transform 0.15s ease",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.9)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Volume2 style={{ width: "16px", height: "16px" }} />
          </button>

          <button
            onClick={onClose}
            style={{
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
      </div>

      {/* Scrollable body: kanji strip + definitions + breakdown all scroll together, so the
          popup's total height never exceeds the viewport (header above stays fixed/visible). */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "4px", display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Kanji chip strip - shown automatically whenever the headword contains kanji, no extra tap needed */}
      {hasKanji && (
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
          {lookupData!.kanjiList.map((k, kIdx) => (
            <div
              key={kIdx}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                padding: "6px 10px",
                borderRadius: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                minWidth: "44px",
              }}
              title={`Onyomi: ${k.onyomi.join(", ") || "-"} | Kunyomi: ${k.kunyomi.join(", ") || "-"}`}
            >
              <span style={{ fontSize: "18px", fontWeight: 800, fontFamily: "serif", color: "#38bdf8" }}>
                {k.kanji}
              </span>
              <span style={{ fontSize: "9px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                {k.onyomi[0] || k.kunyomi[0] || "-"}
              </span>
              {k.jlpt && (
                <span style={{ fontSize: "8px", fontWeight: 800, color: "#fbbf24" }}>{k.jlpt}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Term definitions: every matching dictionary term stacked in one view (no tabs) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: i === 0 ? "48px" : "28px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                }}
              />
            ))}
          </div>
        ) : validTerms.length > 0 ? (
          validTerms.map((term, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "10px 12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                  {term.expression} ({term.reading})
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {term.deinflectionRules && term.deinflectionRules.length > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(168, 85, 247, 0.15)",
                        color: "#c084fc",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Puzzle size={10} />
                      {term.deinflectionRules[0]}
                    </span>
                  )}
                  {term.frequency && term.frequency.length > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(34, 197, 94, 0.15)",
                        color: "#4ade80",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                      title={`Peringkat frekuensi kemunculan kata (semakin kecil = semakin umum)`}
                    >
                      {term.frequency[0].dictName} #{term.frequency[0].rank.toLocaleString()}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {term.dictName}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "4px" }}>
                {(() => {
                  const points = parseMeaningPoints(term.cleanMeanings);
                  const useNumbers = points.length > 1;
                  return points.map((point, pIdx) => (
                    <div key={pIdx} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                      <span style={{ color: "#38bdf8", fontWeight: 700, flexShrink: 0, fontSize: "11px" }}>
                        {useNumbers ? `${pIdx + 1}.` : "-"}
                      </span>
                      <span style={{ flex: 1 }}>{point}</span>
                    </div>
                  ));
                })()}
              </div>
              {term.example && (
                <div
                  style={{
                    marginTop: "8px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                    borderLeft: "2px solid rgba(56, 189, 248, 0.4)",
                  }}
                >
                  <div style={{ fontSize: "16px", color: "#e2e8f0", lineHeight: 1.8 }}>
                    {renderFurigana(term.example.japanese)}
                  </div>
                  {term.example.translation && (
                    <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "6px" }}>
                      {term.example.translation}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: "12px" }}>
            {hasBreakdown
              ? "Tidak ada pencocokan kamus langsung. Lihat rincian kata di bawah."
              : "Tidak ada pencocokan kamus untuk pilihan ini."}
          </div>
        )}
      </div>

      {/* Word-breakdown expander (collapsed by default - secondary detail, not a competing primary tab) */}
      {hasBreakdown && (
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "10px" }}>
          <button
            onClick={() => setIsBreakdownExpanded((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span>Rincian Kata ({lookupData!.segmentedWords.length})</span>
            <ChevronDown
              style={{
                width: "14px",
                height: "14px",
                transition: "transform 0.15s ease",
                transform: isBreakdownExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {isBreakdownExpanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              {lookupData!.segmentedWords.map((seg, sIdx) => (
                <div
                  key={sIdx}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "12px",
                    padding: "8px 12px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#38bdf8" }}>
                    {seg.text} {seg.reading ? `(${seg.reading})` : ""}
                  </div>
                  <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {(() => {
                      const points = parseMeaningPoints(seg.meanings.map(formatMeaning));
                      const useNumbers = points.length > 1;
                      return points.map((point, pIdx) => (
                        <div key={pIdx} style={{ display: "flex", gap: "4px", alignItems: "flex-start" }}>
                          <span style={{ color: "#38bdf8", fontWeight: 600, flexShrink: 0 }}>
                            {useNumbers ? `${pIdx + 1}.` : "-"}
                          </span>
                          <span style={{ flex: 1 }}>{point}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}
