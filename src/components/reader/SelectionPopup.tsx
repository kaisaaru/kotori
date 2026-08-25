"use client";

import { useEffect, useState } from "react";
import { dictionaryService, LookupResult } from "@/services/dictionary-service";
import { useReaderStore } from "@/stores/reader-store";
import { DictionaryResults } from "@/components/DictionaryResults";

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

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    dictionaryService.lookup(selectedText, chunkPos).then((res) => {
      if (isMounted) {
        setLookupData(res);
        setIsLoading(false);
        onResolve?.(res);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedText, chunkPos]);

  // Audio pronunciation via Web Speech API uses the reader's ttsSpeed setting
  const { settings } = useReaderStore();
  const ttsRate = settings?.ttsSpeed ?? 0.8;

  if (!selectedText.trim()) return null;

  const { left, top, popupWidth, panelHeight } = layout;

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
      <DictionaryResults
        selectedText={selectedText}
        explicitFurigana={explicitFurigana}
        chunkPos={chunkPos}
        lookupData={lookupData}
        isLoading={isLoading}
        ttsRate={ttsRate}
        onClose={onClose}
      />
    </div>
  );
}
