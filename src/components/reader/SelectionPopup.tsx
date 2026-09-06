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
  const margin = 16;
  const offset = 10;
  const popupWidth = Math.min(400, window.innerWidth - margin * 2);
  const maxPanelHeight = Math.min(280, window.innerHeight - margin * 2);

  const anchorRight = anchor.x + anchor.width;
  const anchorBottom = anchor.y + anchor.height;

  // Horizontal position:
  // On narrow screens (mobile / narrow pane), center popup horizontally on the anchor
  const isNarrow = window.innerWidth < popupWidth + anchor.width + margin * 2 + offset * 2;
  let left: number;
  if (isNarrow) {
    left = Math.max(
      margin,
      Math.min(
        anchor.x + anchor.width / 2 - popupWidth / 2,
        window.innerWidth - popupWidth - margin
      )
    );
  } else {
    // Wide screens: dock beside the word (right by preference, left if right lacks room)
    const spaceRight = window.innerWidth - anchorRight;
    const dockRight = spaceRight >= popupWidth + margin || spaceRight >= anchor.x;
    left = dockRight
      ? Math.min(anchorRight + offset, window.innerWidth - popupWidth - margin)
      : Math.max(margin, anchor.x - popupWidth - offset);
  }

  // Vertical position:
  // Calculate space available below and above the anchor
  const spaceBelow = window.innerHeight - anchorBottom - offset - margin;
  const spaceAbove = anchor.y - offset - margin;

  let top: number;
  let panelHeight: number;

  if (spaceBelow >= 180) {
    // Ample room below the anchor: dock below
    panelHeight = Math.min(maxPanelHeight, spaceBelow);
    top = anchorBottom + offset;
  } else if (spaceAbove >= 180) {
    // Ample room above the anchor: dock above
    panelHeight = Math.min(maxPanelHeight, spaceAbove);
    top = anchor.y - offset - panelHeight;
  } else if (spaceAbove >= spaceBelow) {
    // More room above than below: dock above and scale height to fit
    panelHeight = Math.max(120, Math.min(maxPanelHeight, spaceAbove));
    top = anchor.y - offset - panelHeight;
  } else {
    // More room below than above: dock below and scale height to fit
    panelHeight = Math.max(120, Math.min(maxPanelHeight, spaceBelow));
    top = anchorBottom + offset;
  }

  // HARD VIEWPORT CLAMP: Ensure popup is 100% visible inside the viewport on all screens
  if (top + panelHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - margin - panelHeight);
  }
  if (top < margin) {
    top = margin;
    panelHeight = Math.min(panelHeight, window.innerHeight - margin * 2);
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));

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
