# Kotori Reader UX & Dictionary Revamp Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Overhaul the dictionary lookup UX to behave like Yomitan (instant hover/tap scanning with grammar de-inflection), improve dictionary load times, and implement granular reading progress saving (scroll position instead of just chapter index).

**Architecture:** 
- **UX Lookup:** Replace native selection/long-press mechanics with a custom word-boundary text tokenization approach or `document.caretPositionFromPoint` to enable instant "Hover/Tap to Scan".
- **De-inflection:** Implement a lightweight set of rules in `/api/dictionary/lookup` (or client-side if faster) to strip Japanese conjugations (e.g., `帰ろう` -> `帰る`).
- **Granular Saving:** Enhance `reader-store` and `book-storage` to persist scroll percentage or specific text node indices per chapter.

**Tech Stack:** React, Next.js API Routes, TypeScript, Zustand (for store).

---

## Phase 1: Granular Progress Saving

### Task 1: Update Storage Types for Progress
**Objective:** Add `scrollPercentage` to the `ReadingProgress` type to save exact vertical reading positions.

**Files:**
- Modify: `src/types/book.ts`
- Modify: `src/stores/reader-store.ts`

**Step 1: Write failing test / Update Types**
```typescript
// src/types/book.ts
export interface ReadingProgress {
  chapterIndex: number;
  scrollPercentage?: number; // Add this field (0 to 100)
  updatedAt: number;
}
```

**Step 2: Update Store**
Modify `reader-store.ts` to include `setScrollPercentage(percent: number)` and trigger the debounced `saveProgress` API.

**Step 3: Verification**
Run `npx tsc --noEmit` to ensure type compatibility across the app.

### Task 2: Capture and Restore Scroll Position
**Objective:** Save the scroll position when reading and restore it when a chapter loads.

**Files:**
- Modify: `src/components/reader/ChapterRenderer.tsx` (or equivalent reader component)

**Step 1: Implementation**
- Attach a debounced scroll listener (`onScroll` on the reading container).
- Calculate: `percentage = (scrollTop / (scrollHeight - clientHeight)) * 100`.
- On mount/chapter load: `container.scrollTop = (percentage / 100) * (scrollHeight - clientHeight)`.

**Step 2: Verification**
Open a book, scroll halfway down, navigate back to home, reopen the book -> should jump to the exact scroll position.

---

## Phase 2: Dictionary De-inflection Engine

### Task 3: Implement Basic De-inflection Rules
**Objective:** Create a utility to strip common Japanese conjugations so the dictionary can find root kanji/verbs.

**Files:**
- Create: `src/lib/japanese/deinflector.ts`
- Create: `src/lib/japanese/deinflector.test.ts` (if using Jest/Vitest)

**Step 1: Implementation**
Create an array of suffix rules. Example:
```typescript
// src/lib/japanese/deinflector.ts
export const DEINFLECTION_RULES = [
  { suffix: 'ろう', replacement: 'る', type: 'volitional' },
  { suffix: 'られる', replacement: 'る', type: 'potential' },
  { suffix: 'ない', replacement: 'る', type: 'negative' },
  { suffix: 'た', replacement: 'る', type: 'past' },
  // ... more basic rules for godan/ichidan
];

export function getBaseForms(word: string): { word: string, rule?: string }[] {
   // Logic to strip suffix and return array of possible root words
}
```

**Step 2: Integration in API**
Modify `src/app/api/dictionary/lookup/route.ts` to use `getBaseForms(query)`. If `query` fails, try searching the fallback base forms.

**Step 3: Verification**
Make a GET request to `/api/dictionary/lookup?q=帰ろう` and ensure it returns the definition for `帰る` (kaeru).

---

## Phase 3: "Yomitan-like" Hover & Tap Scanning

### Task 4: Text Node Tokenization / Pointer Tracking
**Objective:** Remove the need for native text selection (highlighting) and replace it with cursor-based text tracking.

**Files:**
- Modify: `src/app/reader/[bookId]/page.tsx` (or the component handling text rendering and popup logic).

**Step 1: Implementation Strategy**
Instead of `window.getSelection()`, use `document.caretPositionFromPoint(x, y)` (or `document.caretRangeFromPoint`) on mouse move or touch end.
- Get the exact text node the user is hovering over.
- Extract a chunk of characters (e.g., 10 chars) from that cursor position.
- Pass that chunk to a tokenizer or directly to the dictionary API.

**Step 2: State Management**
```typescript
const [hoveredWord, setHoveredWord] = useState('');
const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
// If shift is held or mobile tap is active -> trigger lookup
```

**Step 3: Verification**
Console log the exact word the cursor is hovering over without clicking or dragging.

### Task 5: Interactive Popup UX
**Objective:** Redesign the Selection Popup to appear instantly near the cursor and display the grammar rule (e.g., "Volitional").

**Files:**
- Modify: `src/components/reader/SelectionPopup.tsx`

**Step 1: Implementation**
- Position the popup using the `x` and `y` coordinates from the cursor/tap event.
- Display the de-inflection rule returned from the API (e.g., `[🧩 Volitional]`).
- Add a loading skeleton state to make it feel instantly responsive even if the API takes 200ms.

**Step 2: Verification**
Tap on the word `帰ろう`. A popup should instantly appear pointing to the word, showing the definition of `帰る`.

---

## Phase 4: Clean Up & Polish

### Task 6: Dictionary Loading Performance
**Objective:** Ensure the dictionary lookup takes < 200ms.

**Files:**
- Inspect: `src/app/api/dictionary/lookup/route.ts`

**Step 1: Implementation**
- Ensure the dictionary cache (`dict-cache-v1.json`) is loaded into memory persistently using global variables in Next.js (so it doesn't parse the huge JSON on every single API call).
- If it's still slow, consider using an indexed client-side database (IndexedDB) or a lightweight WASM SQLite.

**Step 2: Verification**
Measure API response time in the Network tab. It should drop from ~1-2 seconds down to < 200ms.

---
**Execution Handoff:**
Plan complete. Execute using standard iterative methods or subagent delegation.