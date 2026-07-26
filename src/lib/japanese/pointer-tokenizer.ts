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

  if (textNode) {
    return { textNode, offset };
  }
  return null;
}

export function extractContextChunk(textNode: Text, offset: number, maxRadius: number = 20): string {
  const text = textNode.textContent || '';
  const start = Math.max(0, offset - 2); // get a tiny bit before cursor just in case
  const end = Math.min(text.length, offset + maxRadius);
  // We extract a substring of the text node directly under the cursor.
  // E.g., if cursor is at '帰' in '帰ろう', we extract '帰ろう、と...' (up to 20 chars).
  return text.substring(start, end).trim();
}
