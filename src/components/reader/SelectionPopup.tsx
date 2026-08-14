"use client";

import React, { useEffect, useState } from "react";
import { X, Volume2, Puzzle, ChevronDown } from "lucide-react";
import { dictionaryService, LookupResult } from "@/services/dictionary-service";
import { useReaderStore } from "@/stores/reader-store";

interface SelectionPopupProps {
  selectedText: string;
  explicitFurigana?: string;
  // Anchor rect to dock the popup against (a character's or selection's bounding rect, viewport-
  // relative) - NOT a raw click pixel, so the popup's position stays stable regardless of exactly
  // where within a glyph the pointer landed.
  position: { x: number; y: number; width: number; height: number };
  chunkPos?: number;
  onClose: () => void;
  onResolve?: (result: LookupResult) => void;
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

// Dock the popup against the anchor rect's edges (like Yomitan's side panel) - never against a
// raw click pixel, so clicking the same character at its edge vs. its middle vs. its start always
// yields the same popup position. Height is a FIXED value (capped only by the viewport, never by
// content) so the popup is a consistent size regardless of how much a given word's entry has to
// say - overflowing content scrolls internally instead of resizing the popup. Recomputed each
// time a new word is looked up (see the effect below), so the popup moves to the newly
// clicked/hovered word instead of staying stuck at the first word's spot.
//
// Wide viewports dock the panel beside the word; narrow ones stack it below (or above) instead,
// since there is no sideways room there and docking would cover the word being read.
function computeLayout(anchor: { x: number; y: number; width: number; height: number }) {
  // Matches Yomitan's own defaults (popupWidth 400, popupHeight 250, popupVerticalOffset 10).
  const margin = 16;
  const popupWidth = Math.min(400, window.innerWidth - margin * 2);
  const panelHeight = Math.min(250, window.innerHeight - margin * 2);
  // Yomitan's popupVerticalOffset default. Docking any tighter makes the popup overlap the very
  // word it describes, and the reader hit-tests that spot; the pointer-toward-popup case is
  // handled by the dismiss grace period instead, not by shrinking this.
  const offset = 10;

  const anchorRight = anchor.x + anchor.width;
  const anchorBottom = anchor.y + anchor.height;

  // On a narrow screen there is no room to sit beside the word - docking sideways there just
  // covers it, which is exactly what the reader is trying to look at. Stack vertically instead:
  // below the word by preference, above it when the space below cannot fit the panel.
  const isNarrow = window.innerWidth < popupWidth + anchor.width + margin * 2 + offset * 2;
  if (isNarrow) {
    const left = Math.max(margin, Math.min(
      anchor.x + anchor.width / 2 - popupWidth / 2,
      window.innerWidth - popupWidth - margin
    ));
    const spaceBelow = window.innerHeight - anchorBottom - offset - margin;
    const spaceAbove = anchor.y - offset - margin;
    const placeBelow = spaceBelow >= panelHeight || spaceBelow >= spaceAbove;
    // Shrink to the available side rather than clamping into the word: a clamp would slide the
    // panel back over the very word it describes, which is the thing this layout exists to avoid.
    // The panel scrolls internally, so a shorter box costs nothing but a little visible content.
    const available = Math.max(120, placeBelow ? spaceBelow : spaceAbove);
    const height = Math.min(panelHeight, available);
    const top = placeBelow ? anchorBottom + offset : Math.max(margin, anchor.y - offset - height);
    return { left, top, popupWidth, panelHeight: height };
  }

  const spaceRight = window.innerWidth - anchorRight;
  const dockRight = spaceRight >= popupWidth + margin || spaceRight >= anchor.x;
  const left = dockRight
    ? Math.min(anchorRight + offset, window.innerWidth - popupWidth - margin)
    : Math.max(margin, anchor.x - popupWidth - offset);

  // Normally dock below the word; flip above it when there isn't enough room underneath (e.g.
  // the word sits near the bottom of the viewport) and there's more room above instead.
  const spaceBelow = window.innerHeight - anchorBottom;
  const dockBelow = spaceBelow >= panelHeight + margin || spaceBelow >= anchor.y;
  const top = dockBelow
    ? Math.min(anchor.y - offset, window.innerHeight - margin - panelHeight)
    : Math.max(margin, anchorBottom - panelHeight + offset);

  return { left, top, popupWidth, panelHeight };
}

export function SelectionPopup({ selectedText, explicitFurigana, position, chunkPos, onClose, onResolve }: SelectionPopupProps) {
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [layout, setLayout] = useState(() => computeLayout(position));

  // Reposition when a genuinely new word is looked up, and again when the reader refines the
  // anchor from the hovered character to the resolved word's full box (see onDictResolve) - that
  // second pass is what keeps the popup clear of the whole word in vertical text. `position` is
  // set once per lookup, so this does not jitter mid-lookup.
  useEffect(() => {
    setLayout(computeLayout(position));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedText, chunkPos, position]);

  // Rotating a phone flips which side has room - and can flip the layout between the beside-the-word
  // and below-the-word arrangements entirely - so the placement has to be recomputed on resize.
  useEffect(() => {
    const onResize = () => setLayout(computeLayout(position));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position]);

  // `selectedText` is a padded chunk (not an exact word) whenever it came from the click/hover
  // scanner - `chunkPos` marks the cursor's position within it, so the server resolves just that
  // one word instead of everything it can segment out of the padded chunk.
  const isChunkLookup = chunkPos !== undefined;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setIsBreakdownExpanded(false);

    dictionaryService.lookup(selectedText, chunkPos).then((res) => {
      if (isMounted) {
        setLookupData(res);
        setIsLoading(false);
        onResolve?.(res);
        // Auto-expand the word-breakdown section when there's no direct dictionary entry to fall back on
        if (res.terms.length === 0 && res.segmentedWords.length > 0) {
          setIsBreakdownExpanded(true);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedText, chunkPos]);

  // Audio pronunciation via Web Speech API using exact Hiragana reading & ttsSpeed setting
  const { settings } = useReaderStore();
  const ttsRate = settings?.ttsSpeed ?? 0.8;

  const handlePronounce = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

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
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  if (!selectedText.trim()) return null;

  const { left, top, popupWidth, panelHeight } = layout;

  const allRawTerms = lookupData?.terms || [];

  // selectedText is a padded chunk (not the exact word) for click/hover lookups - once the server
  // resolves the single word under the cursor, display THAT as the headword instead of the raw chunk.
  const resolvedExpression = isChunkLookup && !isLoading ? allRawTerms[0]?.expression : undefined;
  const displayHeadword = resolvedExpression || selectedText;

  // A chunk lookup is never treated as a "sentence" (it's always a single-word lookup by design);
  // only an actual drag-selection can be a multi-word/sentence selection.
  const isSentenceSelection = !isChunkLookup && (selectedText.length > 6 || /[。、！？\s]/.test(selectedText));
  // For long sentences, do not show partial furigana (like [さかやなぎきじま]) under the main sentence title.
  // For single words / short phrases, show exact reading (e.g. [さかやなぎ] or [たいがく]).
  const displayReading = !isSentenceSelection ? (explicitFurigana || lookupData?.reading) : undefined;

  const hasBilingual = allRawTerms.some((t) => !isJapaneseMonolingual(t.dictName));

  const validTerms = allRawTerms
    .filter((t) => !hasBilingual || !isJapaneseMonolingual(t.dictName))
    .map((t) => ({
      ...t,
      cleanMeanings: t.meanings.map(formatMeaning).filter((m) => m.length > 0),
    }))
    .filter((t) => t.cleanMeanings.length > 0)
    .sort((a, b) => getDictPriority(a.dictName) - getDictPriority(b.dictName));

  const headerScript = getScriptBadge(displayHeadword, allRawTerms[0]?.jlpt);
  const hasKanji = !isLoading && !!lookupData && lookupData.kanjiList.length > 0;
  const hasBreakdown = !isLoading && !!lookupData && lookupData.segmentedWords.length > 0;

  return (
    <div
      data-selection-popup="true"
      className="selection-popup"
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${popupWidth}px`,
        height: `${panelHeight}px`,
        zIndex: 100,
        borderRadius: "20px",
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow: "0 20px 48px rgba(0, 0, 0, 0.5)",
        color: "#ffffff",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        overflow: "hidden",
        animation: "fadeIn 0.12s ease-out",
        userSelect: "text",
        WebkitUserSelect: "text",
      }}
      onClick={(e) => e.stopPropagation()}
    >
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
              [{displayReading}]
            </span>
          )}
        </div>

        {/* Action Buttons (Voice + Close) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
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
    </div>
  );
}
