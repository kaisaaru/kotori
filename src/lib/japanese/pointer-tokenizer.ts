export function getTextNodeAtPoint(x: number, y: number): { textNode: Text, offset: number } | null {
  if (typeof document === 'undefined') return null;

  let range: Range | null = null;
  let textNode: Text | null = null;
  let offset: number = 0;

  // Modern standard browser approach
  if (typeof document.caretRangeFromPoint === 'function') {
    range = document.caretRangeFromPoint(x, y);
    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      textNode = range.startContainer as Text;
      offset = range.startOffset;
    }
  } 
  // Firefox approach
  else if (typeof (document as any).caretPositionFromPoint === 'function') {
    const position = (document as any).caretPositionFromPoint(x, y);
    if (position && position.offsetNode && position.offsetNode.nodeType === Node.TEXT_NODE) {
      textNode = position.offsetNode as Text;
      offset = position.offset;
    }
  }

  if (!textNode) return null;

  // caretRangeFromPoint/caretPositionFromPoint always snap to the NEAREST character position,
  // even when the click landed far outside any actual glyph - e.g. tapping empty margin/whitespace
  // below a short line in vertical writing mode still resolves to that line's last character.
  // Verify the click point actually falls within (or very near) the rendered glyph before
  // treating it as a real hit, otherwise the click is silently ignored.
  const text = textNode.textContent || '';
  const checkStart = Math.max(0, Math.min(offset, text.length - 1));
  const checkEnd = Math.min(text.length, checkStart + 1);
  if (checkEnd > checkStart) {
    try {
      const charRange = document.createRange();
      charRange.setStart(textNode, checkStart);
      charRange.setEnd(textNode, checkEnd);
      const rects = charRange.getClientRects();
      const tolerance = 10; // px - small allowance for line-height/glyph padding
      let withinBounds = false;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (
          x >= r.left - tolerance && x <= r.right + tolerance &&
          y >= r.top - tolerance && y <= r.bottom + tolerance
        ) {
          withinBounds = true;
          break;
        }
      }
      if (!withinBounds) return null;
    } catch {
      // If range creation fails for any reason, fall through and trust the browser's caret result.
    }
  }

  return { textNode, offset };
}

// Reads an author-supplied furigana override for the word at `textNode`, when the hover/click
// point landed inside a <ruby>base<rt>furigana</rt></ruby> group - common in light novels for
// stylistic/contextual readings that differ from a word's default dictionary reading (e.g. とは
// written but meant to be read とわ). Standard EPUB ruby markup keeps the base text as a direct
// text-node child of <ruby>, so the hovered text node's own parent IS the <ruby> element - no
// need to walk further up. Since extractContextChunk never reads past a single text node, and
// each <ruby>'s base text is its own separate text node, the whole chunk sent to the server is
// guaranteed to come from this same ruby group when this returns a value.
export function getExplicitFurigana(textNode: Text): string | undefined {
  const parent = textNode.parentElement;
  if (!parent || parent.tagName !== "RUBY") return undefined;
  const rt = parent.querySelector("rt");
  const text = rt?.textContent?.trim();
  return text || undefined;
}

export function extractContextChunk(textNode: Text, offset: number, maxRadius: number = 20): { text: string; pos: number } {
  const text = textNode.textContent || '';
  // Start exactly at the hit-tested hover/click point (no backward pad). getTextNodeAtPoint
  // already glyph-hit-tests `offset`, so padding backward only risked pulling in a preceding
  // word's territory and mis-anchoring the greedy match against the wrong starting position.
  const start = offset;
  const end = Math.min(text.length, offset + maxRadius);
  // E.g., if cursor is at '帰' in '帰ろう', we extract '帰ろう、と...' (up to 20 chars) starting there.
  const raw = text.substring(start, end);
  const trimmed = raw.trim();
  const leadingTrimmed = raw.length - raw.trimStart().length;
  // Position of the actual click/hover point within the trimmed chunk (normally 0, unless
  // leading whitespace got trimmed) - tells the server exactly where to anchor the match.
  const pos = trimmed.length > 0 ? Math.max(0, Math.min(trimmed.length - 1, offset - start - leadingTrimmed)) : 0;
  return { text: trimmed, pos };
}
