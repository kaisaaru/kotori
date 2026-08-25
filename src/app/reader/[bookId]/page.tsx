"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  List,
  BookOpen,
  X,
  Bookmark,
  BookmarkCheck,
  Search,
} from "lucide-react";
import { DictionarySearchModal } from "@/components/DictionarySearchModal";
import { useReaderStore } from "@/stores/reader-store";
import { useDictionaryStore } from "@/stores/dictionary-store";
import {
  getBook,
  getChapters,
  getProgress,
  saveProgress,
  saveProgressSync,
  updateBookLastRead,
  getSettings,
  saveSettings,
} from "@/services/book-storage";
import type { Chapter as ChapterType } from "@/types/book";
import { MARGIN_VALUES, READER_WIDTH_VALUES, getSystemTheme } from "@/types/book";
import ReaderSettingsPanel from "@/components/reader/ReaderSettingsPanel";
import TableOfContents from "@/components/reader/TableOfContents";
import { SelectionPopup } from "@/components/reader/SelectionPopup";
import type { LookupResult } from "@/services/dictionary-service";
import { getTextNodeAtPoint, extractContextChunk, getExplicitFurigana, getCharRect } from "@/lib/japanese/pointer-tokenizer";

// Helper to extract clean base text and explicit furigana from a selection container
function extractTextAndFurigana(container: HTMLElement, range?: Range | null, selection?: Selection | null) {
  let baseText = "";
  let explicitFurigana = "";

  try {
    const clone = container.cloneNode(true) as HTMLElement;

    // Extract explicit furigana from <rt> tags
    const rtElements = clone.querySelectorAll("rt");
    if (rtElements.length > 0) {
      const furiganaParts: string[] = [];
      rtElements.forEach((rt) => {
        const text = rt.textContent?.trim();
        if (text) furiganaParts.push(text);
      });
      explicitFurigana = furiganaParts.join("");
    }

    // Remove <rt> and <rp> elements to get clean base text
    clone.querySelectorAll("rt, rp").forEach((el) => el.remove());
    baseText = clone.textContent?.replace(/\s+/g, "").trim() || "";
  } catch {
    baseText = container.textContent?.replace(/\s+/g, "").trim() || "";
  }

  return {
    baseText: baseText || (selection ? selection.toString().trim() : ""),
    explicitFurigana,
  };
}

// Helper to locate live DOM Range for target text substring inside content container
function findTextRange(container: HTMLElement, targetText: string): Range | null {
  if (!container || !targetText) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentNode: Node | null;

  while ((currentNode = walker.nextNode())) {
    const content = currentNode.textContent;
    if (content && content.includes(targetText)) {
      const startOffset = content.indexOf(targetText);
      const range = document.createRange();
      range.setStart(currentNode, startOffset);
      range.setEnd(currentNode, startOffset + targetText.length);
      return range;
    }
  }

  // Fallback: search across multiple adjacent text nodes
  const fullText = container.textContent || "";
  const fullIndex = fullText.indexOf(targetText);
  if (fullIndex === -1) return null;

  let charCount = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  while ((currentNode = walker2.nextNode())) {
    const textLen = currentNode.textContent?.length || 0;
    if (!startNode && charCount + textLen > fullIndex) {
      startNode = currentNode;
      startOffset = fullIndex - charCount;
    }
    if (startNode && charCount + textLen >= fullIndex + targetText.length) {
      endNode = currentNode;
      endOffset = fullIndex + targetText.length - charCount;
      break;
    }
    charCount += textLen;
  }

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  }

  return null;
}

// Finds the occurrence of `targetText` whose position is closest to (nearLeft, nearTop) in viewport
// coordinates, and returns its rects. findTextRange returns the FIRST match, which is fine for a
// bookmarked sentence but wrong for a single dictionary word - short words like 良く recur many
// times in a chapter, and the highlight would jump to the wrong one on every scroll.
function findNearestTextRects(
  container: HTMLElement,
  targetText: string,
  nearLeft: number,
  nearTop: number
): Array<{ left: number; top: number; width: number; height: number }> | null {
  if (!targetText) return null;

  let best: { dist: number; rects: DOMRect[] } | null = null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const content = node.textContent;
    if (!content) continue;
    let from = content.indexOf(targetText);
    while (from !== -1) {
      try {
        const range = document.createRange();
        range.setStart(node, from);
        range.setEnd(node, from + targetText.length);
        const box = range.getBoundingClientRect();
        const dist = Math.hypot(box.left - nearLeft, box.top - nearTop);
        if (!best || dist < best.dist) {
          best = { dist, rects: Array.from(range.getClientRects()) };
        }
        // Close enough that no other occurrence can be nearer - stop scanning the chapter.
        if (dist < 2) break;
      } catch {
        // Skip an occurrence that cannot be ranged; others may still match.
      }
      from = content.indexOf(targetText, from + 1);
    }
    if (best && best.dist < 2) break;
  }

  if (!best) return null;
  return best.rects.map((r) => ({
    left: r.left,
    top: r.top,
    width: Math.max(r.width, 4),
    height: Math.max(r.height, 4),
  }));
}

// Temporary instrumentation for the reading-position save/restore path. Flip to false once the
// restore behaviour has been confirmed working end to end.
const DEBUG_PROGRESS = false;

// Detects at runtime whether this element's scrollLeft uses the negative range [-max, 0] or the
// positive range [0, max]. Browsers disagree for writing-mode: vertical-rl, and getScrollPosition's
// Math.abs() erases the distinction - so guessing the sign here has already caused several rounds
// of "restore always lands at the chapter start", because an out-of-range write is silently
// clamped to 0. Probing costs one synchronous reflow and removes the guess entirely, the way
// ttu-reader's formatPos helper keeps its read and write paths symmetric.
function usesNegativeScrollLeft(el: HTMLElement): boolean {
  const original = el.scrollLeft;
  el.scrollLeft = -1;
  const isNegative = el.scrollLeft < 0;
  el.scrollLeft = original;
  return isNegative;
}

// Plain-text character count of a chapter's HTML (tags stripped) - used to weight book-wide
// reading progress by actual chapter length instead of assuming every chapter is the same size.
function getPlainTextLength(html: string): number {
  if (typeof document === "undefined") return 0;
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent || "").length;
}

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;

  const {
    book,
    chapters,
    currentChapterIndex,
    settings,
    isSettingsOpen,
    isTocOpen,
    showToolbar,
    setBook,
    setCurrentChapter,
    setSettings,
    setSettingsOpen,
    setTocOpen,
    setShowToolbar,
  } = useReaderStore();

  // Polled by DictionaryPrewarmer in the root layout - null means "not known yet", not "not ready".
  const dictStatus = useDictionaryStore((s) => s.status);

  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectionState, setSelectionState] = useState<{
    text: string;
    explicitFurigana?: string;
    // Anchor rect for the popup to dock against (character rect for click/hover, selection rect
    // for drag-selection) - NOT the raw click pixel, so position stays stable regardless of
    // exactly where within a character's glyph the pointer landed.
    position: { x: number; y: number; width: number; height: number };
    chunkPos?: number; // click/hover point's offset within `text`, when text is a padded chunk (not an exact selection)
  } | null>(null);
  const [bookmarkOverlay, setBookmarkOverlay] = useState<{
    chapterIndex: number;
    text: string;
    explicitFurigana?: string;
    position: { x: number; y: number };
    rects: Array<{ left: number; top: number; width: number; height: number }>;
  } | null>(null);
  // The text node + offset the pointer actually landed on, captured at click/scan time. Resolving
  // the highlight later by re-hit-testing the stored viewport point would pick a different
  // character if the reader scrolled while the lookup was in flight; a node reference cannot drift.
  const scanAnchorRef = useRef<{ textNode: Text; offset: number } | null>(null);
  // Highlight on the word currently shown in the dictionary popup. Stored as viewport rects plus
  // the matched text - deliberately NOT as a Range or node reference. The chapter DOM gets rebuilt
  // underneath us (proven: a node that passed contentRef.contains() reported isConnected === false
  // moments later), which orphans any node we hold on to. The bookmark overlay survives that by
  // re-finding its text instead of remembering nodes, so this now works the same way.
  const [scanHighlight, setScanHighlight] = useState<{
    text: string;
    rects: Array<{ left: number; top: number; width: number; height: number }>;
  } | null>(null);
  const clearScanHighlight = useCallback(() => {
    setScanHighlight(null);
  }, []);
  // Viewport box of the reading area, used to clip the fixed-position highlight overlays so they
  // never paint over the header or toolbar. Refreshed whenever the overlays are.
  const [overlayClip, setOverlayClip] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showDictionarySearch, setShowDictionarySearch] = useState(false);
  // Mirrors the home page's language switcher (localStorage "kotoba-language") - read-only here,
  // no switcher in the reader itself.
  const [language, setLanguage] = useState<"ID" | "EN">("EN");
  useEffect(() => {
    const savedLang = localStorage.getItem("kotoba-language");
    if (savedLang === "ID" || savedLang === "EN") {
      setLanguage(savedLang);
    } else {
      const browserLang = navigator.language || navigator.languages?.[0] || "";
      setLanguage(browserLang.toLowerCase().startsWith("id") ? "ID" : "EN");
    }
  }, []);
  const toolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Coordination refs for dictionary-lookup vs. toolbar-toggle vs. drag-selection gestures
  const lastDictLookupAtRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false); // true only once actual movement happens while pointer is down (real drag, not a static tap)
  const isTouchGestureRef = useRef(false); // distinguishes touch (handled by the tap-scanner) from mouse (handled by click-mode lookup)
  // Precise reading-position restore (set from saved progress before chapter mounts, consumed once)
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const [chapterScrollRatio, setChapterScrollRatio] = useState(0);
  // Debounced progress save fired shortly after scrolling stops (see the scroll-sync effect below)
  const scrollSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Latest book/chapter, refreshed every render - lets the scroll-listener effect below stay
  // subscribed for the component's whole lifetime (deps: [isLoaded] only) instead of tearing
  // down and rebuilding on every chapter change, which would cancel any debounced save that was
  // still pending at the moment of the chapter switch.
  const latestBookRef = useRef(book);
  const latestChapterIndexRef = useRef(currentChapterIndex);
  useEffect(() => {
    latestBookRef.current = book;
    latestChapterIndexRef.current = currentChapterIndex;
  });
  // Last successfully-measured scroll ratio, cached outside the DOM so "about to lose the page"
  // saves (unmount cleanup, visibilitychange, pagehide) still have a correct value to persist even
  // if contentRef.current is already null/detached by the time those deferred callbacks run - React
  // clears refs for an unmounting subtree during its synchronous commit phase, but passive effect
  // cleanups (where the unmount-triggered save lives) run later, so calling getScrollPosition()
  // fresh from inside them was silently saving 0 (chapter start) and clobbering whatever the
  // debounced scroll-save had just correctly written a moment earlier.
  const lastScrollRatioRef = useRef(0);
  // True while a saved position is being restored. Restoring scrolls the container, which fires
  // scroll events at intermediate (usually zero) offsets - letting those reach the save paths
  // would persist the restore's own transient position over the value being restored. ttu-reader
  // solves the same problem by only subscribing its auto-bookmark after the restore resolves and
  // skipping the first emission.
  const isRestoringRef = useRef(false);
  // Guards every "about to lose the page" save. A freshly mounted reader has not measured a scroll
  // position yet, so persisting one writes 0 over a perfectly good stored position. StrictMode's
  // mount/cleanup/mount cycle hit exactly that on every client-side revisit: the Zustand store
  // keeps the previous book around, so the `if (!book) return` guard let the bogus save through.
  const hasMeasuredPositionRef = useRef(false);

  // Plain-text character count per chapter, computed once per book load - used to weight
  // book-wide reading progress by actual chapter length instead of assuming uniform chapter size.
  const chapterCharCounts = useMemo(
    () => chapters.map((c) => getPlainTextLength(c.htmlContent)),
    [chapters]
  );

  // Sync bookmark state when chapter changes
  useEffect(() => {
    if (!bookId) return;
    getProgress(bookId).then((p) => {
      if (p && p.chapterIndex === currentChapterIndex) {
        setIsBookmarked(true);
      } else {
        setIsBookmarked(false);
      }
    });
  }, [bookId, currentChapterIndex]);

  // Track the in-chapter scroll ratio for the progress badge, and save reading progress shortly
  // after scrolling settles - far more frequent/accurate than relying
  // solely on the 5-second periodic save below, so closing the tab mid-scroll loses at most a
  // fraction of a second of progress instead of up to 5 seconds.
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !isLoaded) return;

    const handleScroll = () => {
      const ratio = getScrollPosition();
      setChapterScrollRatio(ratio);

      // Keep the badge in sync above, but never let a restore's own scroll events feed
      // the save paths - that would persist an intermediate position over the one being restored.
      if (isRestoringRef.current) return;
      lastScrollRatioRef.current = ratio;
      hasMeasuredPositionRef.current = true;

      const currentBook = latestBookRef.current;
      if (currentBook) {
        clearTimeout(scrollSaveTimeoutRef.current);
        scrollSaveTimeoutRef.current = setTimeout(() => {
          if (DEBUG_PROGRESS) {
            console.log("[progress] save", {
              source: "debounced",
              bookId: currentBook.id,
              chapterIndex: latestChapterIndexRef.current,
              ratio: lastScrollRatioRef.current,
            });
          }
          const payload = {
            bookId: currentBook.id,
            chapterIndex: latestChapterIndexRef.current,
            scrollPosition: lastScrollRatioRef.current,
            lastReadAt: Date.now(),
          };
          saveProgressSync(payload);
          saveProgress(payload);
        }, 600);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Deliberately does NOT clearTimeout(scrollSaveTimeoutRef.current) here - a pending debounced
    // save should still fire even if this effect somehow re-runs, instead of being silently
    // cancelled (that was the bug: re-subscribing on every chapter change used to drop whatever
    // save was in flight at the moment of the chapter switch).
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isLoaded]);

  // Recalculate bookmark rects on scroll / window resize / F11 fullscreen / layout reflow.
  // Rects stay in viewport coordinates and are drawn with position: fixed, same as the scan
  // highlight - converting to content-space and then rendering inside a scroll-shifted wrapper
  // double-counted the scroll offset and slid the highlight away from its text.
  const updateBookmarkRects = useCallback(() => {
    if (!bookmarkOverlay || bookmarkOverlay.chapterIndex !== currentChapterIndex || !contentRef.current) return;

    const range = findTextRange(contentRef.current, bookmarkOverlay.text);
    if (!range) return;

    const rawClientRects = Array.from(range.getClientRects()).map((r) => ({
      left: r.left,
      top: r.top,
      width: Math.max(r.width, 10),
      height: Math.max(r.height, 16),
    }));

    if (rawClientRects.length > 0) {
      const mainRect = range.getBoundingClientRect();
      setBookmarkOverlay((prev) =>
        prev
          ? {
              ...prev,
              position: { x: mainRect.left + mainRect.width / 2, y: mainRect.top },
              rects: rawClientRects,
            }
          : null
      );
    }
  }, [bookmarkOverlay, currentChapterIndex]);

  // The bookmark overlay is painted in viewport coordinates, so its rects go stale the moment the
  // reader scrolls or the layout reflows - recompute them from its live Range. Coalesced into one
  // animation frame to keep scrolling smooth. Also covers resize / F11 fullscreen, which this
  // overlay relied on before. (The scan highlight needs nothing here: it is a real browser
  // selection, so the browser keeps it aligned on its own.)
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isLoaded) return;

    let raf = 0;
    const refreshOverlays = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        setOverlayClip((prev) =>
          prev.top === box.top &&
          prev.left === box.left &&
          prev.width === box.width &&
          prev.height === box.height
            ? prev
            : { top: box.top, left: box.left, width: box.width, height: box.height }
        );
        updateBookmarkRects();
        // Re-find the scanned word by text rather than by a remembered node, exactly as the
        // bookmark overlay does - that is what lets it survive the chapter DOM being rebuilt.
        setScanHighlight((prev) => {
          if (!prev || prev.rects.length === 0) return prev;
          const anchor = prev.rects[0];
          const rects = findNearestTextRects(el, prev.text, anchor.left, anchor.top);
          return rects ? { ...prev, rects } : prev;
        });
      });
    };

    refreshOverlays(); // seed the clip box on mount, before any scrolling happens
    el.addEventListener("scroll", refreshOverlays, { passive: true });
    window.addEventListener("resize", refreshOverlays);
    return () => {
      el.removeEventListener("scroll", refreshOverlays);
      window.removeEventListener("resize", refreshOverlays);
      cancelAnimationFrame(raf);
    };
  }, [isLoaded, updateBookmarkRects]);

  // Detect highlighted/blocked text selection for dictionary popup & persistent bookmark
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      isPointerDownRef.current = true;
      isDraggingRef.current = false;
      isTouchGestureRef.current = e.type.startsWith("touch");
    };

    const handlePointerMove = () => {
      if (isPointerDownRef.current) {
        isDraggingRef.current = true;
      }
    };

    const handleMouseUp = (e?: MouseEvent | TouchEvent) => {
      isPointerDownRef.current = false;
      isDraggingRef.current = false;

      // If user disabled Dictionary in Reader Settings, do not show dictionary popups!
      if (settings.enableDictionary === false) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.type !== "Range") {
        return;
      }

      // Do NOT trigger new dictionary lookup if selection was made inside the dictionary popup!
      const isNodeInPopup = (node: Node | null): boolean => {
        let curr: Node | null = node;
        while (curr) {
          if (
            curr instanceof HTMLElement &&
            (curr.getAttribute("data-selection-popup") === "true" ||
              curr.classList.contains("selection-popup") ||
              Boolean(curr.closest?.(".selection-popup")))
          ) {
            return true;
          }
          curr = curr.parentNode;
        }
        return false;
      };

      if (isNodeInPopup(selection.anchorNode) || isNodeInPopup(selection.focusNode)) {
        return;
      }

      if (e?.target && isNodeInPopup(e.target as Node)) {
        return;
      }

      // Ensure selection is inside the reader content container
      if (
        contentRef.current &&
        !contentRef.current.contains(selection.anchorNode) &&
        !contentRef.current.contains(selection.focusNode)
      ) {
        return;
      }

      let text = "";
      let explicitFurigana = "";
      let rect: DOMRect | null = null;
      let relativeRects: Array<{ left: number; top: number; width: number; height: number }> = [];

      try {
        const range = selection.getRangeAt(0);
        rect = range.getBoundingClientRect();

        if (contentRef.current) {
          // Viewport coordinates, drawn with position: fixed - see updateBookmarkRects.
          const rawClientRects = Array.from(range.getClientRects()).map((r) => ({
            left: r.left,
            top: r.top,
            width: Math.max(r.width, 10),
            height: Math.max(r.height, 16),
          }));

          if (rawClientRects.length > 0) {
            relativeRects = rawClientRects;
          } else {
            relativeRects = [
              {
                left: rect.left,
                top: rect.top,
                width: Math.max(rect.width, 16),
                height: Math.max(rect.height, 24),
              },
            ];
          }
        }

        const container = document.createElement("div");
        container.appendChild(range.cloneContents());

        const extracted = extractTextAndFurigana(container, range, selection);
        text = extracted.baseText;
        explicitFurigana = extracted.explicitFurigana;
      } catch {
        text = selection.toString().trim();
      }

      if (!text) {
        text = selection.toString().trim();
      }

      if (text.length > 0 && text.length <= 50 && rect) {
        setBookmarkOverlay({
          chapterIndex: currentChapterIndex,
          text,
          explicitFurigana: explicitFurigana || undefined,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top,
          },
          rects: relativeRects,
        });

        setSelectionState({
          text,
          explicitFurigana: explicitFurigana || undefined,
          position: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
        });

        // Save progress instantly on text selection
        if (book) {
          saveProgress({
            bookId: book.id,
            chapterIndex: currentChapterIndex,
            scrollPosition: getScrollPosition(),
            lastReadAt: Date.now(),
          });
          setIsBookmarked(true);
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("touchmove", handlePointerMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [settings.enableDictionary, book, currentChapterIndex]);

  // Load book data
  useEffect(() => {
    async function load() {
      const bookData = await getBook(bookId);
      if (!bookData) {
        router.push("/");
        return;
      }
      const chaptersData = await getChapters(bookId);
      const savedSettings = await getSettings();
      const progress = await getProgress(bookId);

      setBook(bookData, chaptersData);
      setSettings(savedSettings);

      if (progress) {
        pendingScrollRestoreRef.current = progress.scrollPosition;
        setCurrentChapter(progress.chapterIndex);
      }

      await updateBookLastRead(bookId);
      setIsLoaded(true);
    }
    load();
  }, [bookId, router, setBook, setCurrentChapter, setSettings]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
    return () => {
      const savedTheme = localStorage.getItem("kotoba-theme") || getSystemTheme();
      document.documentElement.setAttribute("data-theme", savedTheme);
    };
  }, [settings.theme]);

  // Save progress periodically
  useEffect(() => {
    if (!book || !isLoaded) return;
    const interval = setInterval(() => {
      if (isRestoringRef.current || !hasMeasuredPositionRef.current) return;
      if (DEBUG_PROGRESS) {
        console.log("[progress] save", {
          source: "interval",
          bookId: book.id,
          chapterIndex: currentChapterIndex,
          ratio: lastScrollRatioRef.current,
        });
      }
      saveProgress({
        bookId: book.id,
        chapterIndex: currentChapterIndex,
        scrollPosition: lastScrollRatioRef.current,
        lastReadAt: Date.now(),
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [book, currentChapterIndex, isLoaded]);

  // Ref to the latest "save current progress" function, refreshed after every render. Lets the
  // mount-once effect below call an always-current save without needing to re-subscribe its
  // listeners (and re-run its cleanup) on every chapter/book change - re-running that cleanup on
  // each chapter change would risk reading contentRef's scroll dimensions after the DOM has
  // already swapped to the NEW chapter's content, saving a meaningless scroll ratio.
  const saveProgressNowRef = useRef<() => void>(() => {});
  useEffect(() => {
    saveProgressNowRef.current = () => {
      if (!book || !hasMeasuredPositionRef.current) return;
      if (DEBUG_PROGRESS) {
        console.log("[progress] save", {
          source: "unmount/hidden",
          bookId: book.id,
          chapterIndex: currentChapterIndex,
          ratio: lastScrollRatioRef.current,
        });
      }
      const payload = {
        bookId: book.id,
        chapterIndex: currentChapterIndex,
        scrollPosition: lastScrollRatioRef.current,
        lastReadAt: Date.now(),
      };
      // Synchronous mirror first: this runs on pagehide/unmount, where the async IndexedDB write
      // below may never commit before the page is torn down.
      saveProgressSync(payload);
      saveProgress(payload);
    };
  });

  // Save progress immediately when the tab is hidden/closed, or when this page unmounts (e.g.
  // navigating back to Home) - the debounced scroll-save and 5s interval above cover normal
  // reading, but none of them fire on tab close/switch or client-side route changes.
  // visibilitychange fires reliably on tab switch/minimize/mobile backgrounding and well before
  // most close flows finish, so it's the primary safety net; pagehide is a secondary net for
  // actual navigation/unload; this effect's cleanup (mount-once, so it only fires on true
  // unmount) covers in-app navigation.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveProgressNowRef.current();
    };
    const handlePageHide = () => saveProgressNowRef.current();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      saveProgressNowRef.current();
    };
  }, []);

  // Save settings on change
  useEffect(() => {
    if (isLoaded) saveSettings(settings);
  }, [settings, isLoaded]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isSettingsOpen || isTocOpen) return;
      switch (e.key) {
        case "ArrowLeft":
          settings.writingMode === "vertical" ? goNextChapter() : goPrevChapter();
          break;
        case "ArrowRight":
          settings.writingMode === "vertical" ? goPrevChapter() : goNextChapter();
          break;
        case "Escape":
          router.push("/");
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.writingMode, currentChapterIndex, chapters.length, isSettingsOpen, isTocOpen]);

  // Scroll reset helper: vertical Japanese text reads right-to-left!
  const resetScrollPosition = useCallback(() => {
    // Jumping to a chapter start is a legitimate measured position, so record it - otherwise
    // leaving right after a chapter change would have nothing valid to persist.
    lastScrollRatioRef.current = 0;
    hasMeasuredPositionRef.current = true;
    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      if (settings.writingMode === "vertical") {
        // In vertical-rl mode, text starts on the far RIGHT.
        // Setting scrollLeft = scrollWidth jumps to the beginning of text!
        el.scrollLeft = el.scrollWidth;
      } else {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
    });
  }, [settings.writingMode]);

  // Waits for every <img> inside the chapter content to finish loading (or fail) before resolving.
  // Chapter images come from EPUB data URIs (see epub-parser.ts's extractImageAsDataUrl) - no
  // network wait, but the browser still needs a decode pass before scrollWidth reflects the
  // image's final size, and that decode isn't guaranteed to land within a couple of animation
  // frames for large CG/manga-panel images. Without waiting, applyScrollPosition below measured
  // scrollWidth/clientWidth against a pre-decode (too-small) layout and landed close to the
  // chapter start regardless of the saved ratio.
  const waitForContentImages = useCallback((el: HTMLElement): Promise<void> => {
    const imgs = Array.from(el.querySelectorAll("img"));
    if (imgs.length === 0) return Promise.resolve();
    return Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              })
      )
    ).then(() => undefined);
  }, []);

  // Apply a previously-saved 0-1 scroll ratio (inverse of getScrollPosition) to restore the
  // exact reading position on load - as opposed to resetScrollPosition, which always jumps to
  // the chapter start and is used for explicit chapter navigation (next/prev/TOC/links).
  //
  // Restoring only produces the right offset once the layout it measures against is final, so this
  // waits on images AND webfonts (the reader's Noto Serif JP is large enough that a late swap
  // visibly reflows the text), then waits for the container to actually have a size, and finally
  // verifies the write instead of trusting it.
  const applyScrollPosition = useCallback((ratio: number) => {
    const el = contentRef.current;
    if (!el) return;

    isRestoringRef.current = true;
    const finish = (restoredRatio?: number) => {
      // Scroll events fired by the restore itself are ignored, so without seeding these here the
      // ref would sit at 0 until the user scrolls - and any save in between (5s interval, leaving
      // the page) would wipe the position that was just restored.
      if (restoredRatio !== undefined) {
        lastScrollRatioRef.current = restoredRatio;
        hasMeasuredPositionRef.current = true;
      }
      isRestoringRef.current = false;
    };

    const fontsReady: Promise<unknown> =
      typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
    // Never let a gate that fails to settle strand isRestoringRef at true - that would suppress
    // every save for the rest of the session, which is worse than restoring against a stale layout.
    const gate = Promise.race([
      Promise.all([waitForContentImages(el), fontsReady]),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);

    gate.then(() => {
      // `attempt` guards a single retry: if the browser clamped our write back to ~0 while we asked
      // for a real offset, the layout still wasn't final, so measure and write once more.
      const write = (attempt: number, framesWaited: number) => {
        requestAnimationFrame(() => {
          const target = contentRef.current;
          if (!target) {
            finish();
            return;
          }

          // A container that has not been laid out yet reports scrollWidth === clientWidth, which
          // yields max === 0 and silently restores to the chapter start. Wait it out rather than
          // committing a position measured against a zero-sized box.
          if (target.clientWidth === 0 || target.clientHeight === 0) {
            if (framesWaited < 30) {
              write(attempt, framesWaited + 1);
            } else {
              finish();
            }
            return;
          }

          const vertical = settings.writingMode === "vertical";
          const max = vertical
            ? target.scrollWidth - target.clientWidth
            : target.scrollHeight - target.clientHeight;
          const desired = max > 0 ? ratio * max : 0;

          // Measure the sign convention rather than assuming it: browsers disagree on whether a
          // vertical-rl scroller's scrollLeft runs [-max, 0] or [0, max], and writing the wrong
          // sign is out of range, so it gets clamped to 0 - i.e. straight back to the chapter start.
          const negative = vertical ? usesNegativeScrollLeft(target) : false;
          if (vertical) {
            target.scrollLeft = negative ? -desired : desired;
          } else {
            target.scrollTop = desired;
          }

          const actual = vertical ? target.scrollLeft : target.scrollTop;

          if (DEBUG_PROGRESS) {
            console.log("[progress] restore", {
              savedRatio: ratio,
              writingMode: settings.writingMode,
              usesNegative: negative,
              clientWidth: target.clientWidth,
              scrollWidth: target.scrollWidth,
              max,
              desired,
              actualAfterWrite: actual,
              attempt,
            });
          }

          if (Math.abs(actual) < 1 && desired > 1 && attempt === 0) {
            write(attempt + 1, 0);
            return;
          }
          // Record what actually landed rather than what was asked for, so a clamped restore
          // persists the position the reader is really at.
          finish(max > 0 ? Math.abs(actual) / max : 0);
        });
      };

      // One extra frame first, so the layout produced by the just-mounted chapter has been
      // committed before the initial measurement.
      requestAnimationFrame(() => write(0, 0));
    });
  }, [settings.writingMode, waitForContentImages]);

  // Highlight the word currently shown in the dictionary popup (Yomitan-style scan highlight).
  // Locates the resolved word from the anchor captured at click/scan time plus the server's
  // reported focusedStart.
  const onDictResolve = useCallback((res: LookupResult) => {
    if (!selectionState || selectionState.chunkPos === undefined || !contentRef.current) {
      clearScanHighlight();
      return;
    }
    const wordLen = res.focusedLength || res.terms[0]?.expression.length || res.query.length;
    if (!wordLen) {
      clearScanHighlight();
      return;
    }
    // Prefer the anchor recorded when the pointer was actually over the word: it cannot drift if
    // the reader scrolls while the lookup is in flight. But it can go stale, and giving up then
    // means no highlight at all - so fall back to re-hit-testing the stored point, which is what
    // this did originally and demonstrably produced a visible highlight.
    let pointerData = scanAnchorRef.current;
    if (!pointerData || !contentRef.current.contains(pointerData.textNode)) {
      // Aim at the middle of the stored character rect rather than its top-left corner - a corner
      // can sit just outside the glyph and miss the hit-test.
      pointerData = getTextNodeAtPoint(
        selectionState.position.x + selectionState.position.width / 2,
        selectionState.position.y + selectionState.position.height / 2,
        contentRef.current
      );
    }
    if (!pointerData) {
      clearScanHighlight();
      return;
    }
    try {
      const text = pointerData.textNode.textContent || "";
      const wordStart = pointerData.offset - selectionState.chunkPos + (res.focusedStart ?? 0);
      const start = Math.max(0, Math.min(text.length, wordStart));
      const end = Math.max(start, Math.min(text.length, start + wordLen));
      if (end <= start) {
        clearScanHighlight();
        return;
      }

      const range = document.createRange();
      range.setStart(pointerData.textNode, start);
      range.setEnd(pointerData.textNode, end);

      // Snapshot the rects now, while the Range is still valid, and keep only the matched text for
      // later re-location. Holding the Range itself would not survive the chapter DOM being rebuilt.
      const matchedText = range.toString();
      const rects = Array.from(range.getClientRects()).map((r) => ({
        left: r.left,
        top: r.top,
        width: Math.max(r.width, 4),
        height: Math.max(r.height, 4),
      }));
      setScanHighlight(rects.length > 0 ? { text: matchedText, rects } : null);

      // Refine the popup's anchor from the single hovered character to the whole resolved word.
      // In vertical writing a word runs DOWNWARD, so a one-character anchor understates where it
      // ends and the popup, docked just below it, covered the rest of the word.
      if (rects.length > 0) {
        const box = range.getBoundingClientRect();
        const refined = { x: box.left, y: box.top, width: box.width, height: box.height };
        setSelectionState((prev) => {
          if (!prev) return prev;
          const p = prev.position;
          if (
            Math.abs(p.x - refined.x) < 1 &&
            Math.abs(p.y - refined.y) < 1 &&
            Math.abs(p.width - refined.width) < 1 &&
            Math.abs(p.height - refined.height) < 1
          ) {
            return prev; // already the word's box - avoid a pointless re-render
          }
          return { ...prev, position: refined };
        });
      }
    } catch {
      clearScanHighlight();
    }
  }, [selectionState, clearScanHighlight]);

  // Yomitan-like Hover/Tap Scanner
  useEffect(() => {
      const el = contentRef.current;
      if (!el || !isLoaded || isSettingsOpen || isTocOpen || !(settings.enableDictionary ?? true)) return;

      let scanTimeout: NodeJS.Timeout;
      let dismissTimeout: NodeJS.Timeout;

      // True when the pointer is over the open popup, or in the short gap leading to it. Moving
      // from the word to the popup crosses blank space that hits no glyph, and dismissing on that
      // would close the popup just before the pointer arrives - so treat the popup's box, padded
      // generously, as still "on target".
      const isHeadingForPopup = (x: number, y: number) => {
        const popup = document.querySelector(".selection-popup");
        if (!popup) return false;
        const r = popup.getBoundingClientRect();
        const pad = 32;
        return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
      };

      const handleScan = (e: MouseEvent | TouchEvent, x: number, y: number) => {
        if (isDraggingRef.current) return; // don't flicker single-word popups while drag-selecting a sentence
        clearTimeout(scanTimeout);
        const isShiftHeld = (e as MouseEvent).shiftKey === true;
        const isTouch = e.type === "touchstart";
        const isShiftMode = settings.dictTrigger === "shift";
        const isHoverMode = settings.dictTrigger === "hover";

        // Mouse: only continuous-scan in "hover" mode (opt-in) or "shift" mode while Shift is held.
        // "click" mode (default) handles mouse lookups via handleContentClick instead - no hover scan here.
        // Touch always scans instantly on tap regardless of mode.
        const shouldScan = isTouch || isHoverMode || (isShiftMode && isShiftHeld);

        if (shouldScan) {
          scanTimeout = setTimeout(() => {
            // Constrained to the chapter: an open popup overlapping the cursor would otherwise
            // seed the anchor with one of its own text nodes.
            const pointerData = getTextNodeAtPoint(x, y, el);
            if (pointerData) {
              const chunk = extractContextChunk(pointerData.textNode, pointerData.offset, 15);
              if (chunk.text) {
                clearTimeout(dismissTimeout); // landed on a word again - cancel any pending dismiss
                const charRect = getCharRect(pointerData.textNode, pointerData.offset);
                scanAnchorRef.current = pointerData;
                setSelectionState({
                  text: chunk.text, // We pass a padded chunk; server resolves just the single word at chunkPos
                  position: charRect || { x, y, width: 4, height: 20 },
                  chunkPos: chunk.pos,
                  explicitFurigana: getExplicitFurigana(pointerData.textNode),
                });
                lastDictLookupAtRef.current = Date.now();
                return;
              }
            }
            // Hover mode: the cursor is no longer over a resolvable word - live popup follows
            // the cursor, so dismiss it (unlike click/shift mode, which stay open until dismissed).
            if (isHoverMode && !isTouch) {
              if (isHeadingForPopup(x, y)) return;
              // Short grace period so crossing the blank space between two characters - or the
              // gap on the way to the popup - does not flicker the popup shut.
              clearTimeout(dismissTimeout);
              dismissTimeout = setTimeout(() => {
                setSelectionState(null);
                clearScanHighlight();
              }, 200);
            }
          }, isTouch ? 50 : 20); // aggressive debounce for instant feel
        }
      };

      const onMouseMove = (e: MouseEvent) => handleScan(e, e.clientX, e.clientY);
      const onTouchStart = (e: TouchEvent) => handleScan(e, e.touches[0].clientX, e.touches[0].clientY);

      el.addEventListener("mousemove", onMouseMove);
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      return () => {
        el.removeEventListener("mousemove", onMouseMove);
        el.removeEventListener("touchstart", onTouchStart);
        clearTimeout(scanTimeout);
        clearTimeout(dismissTimeout);
      };
  }, [isLoaded, isSettingsOpen, isTocOpen, settings.enableDictionary, settings.dictTrigger]);

  // Reset scroll and clear active selection popup whenever chapter index or writing mode changes.
  // Exception: if a saved reading position is pending restoration (set on initial load from
  // saved progress), apply that exact position instead of jumping to the chapter start.
      useEffect(() => {
    if (isLoaded) {
      if (pendingScrollRestoreRef.current !== null) {
        applyScrollPosition(pendingScrollRestoreRef.current);
        pendingScrollRestoreRef.current = null;
      } else {
        resetScrollPosition();
      }
      setSelectionState(null);
      clearScanHighlight();
      if (typeof window !== "undefined") {
        window.getSelection()?.removeAllRanges();
      }
    }
  }, [currentChapterIndex, settings.writingMode, isLoaded, resetScrollPosition, applyScrollPosition]);

  const getScrollPosition = (): number => {
    const el = contentRef.current;
    if (!el) return 0;
    if (settings.writingMode === "vertical") {
      const max = el.scrollWidth - el.clientWidth;
      return max > 0 ? Math.abs(el.scrollLeft) / max : 0;
    }
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? el.scrollTop / max : 0;
  };

  const [chapterNotice, setChapterNotice] = useState<string | null>(null);
  const [isFading, setIsFading] = useState(false);
  const isTransitioningRef = useRef(false);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const triggerChapterNotice = useCallback((text: string) => {
    setChapterNotice(text);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setChapterNotice(null), 1800);
  }, []);

  const goNextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1 && !isTransitioningRef.current) {
      isTransitioningRef.current = true;
      setIsFading(true);

      setTimeout(() => {
        const nextIdx = currentChapterIndex + 1;
        setCurrentChapter(nextIdx);
        const nextTitle = chapters[nextIdx]?.title || `Chapter ${nextIdx + 1}`;
        triggerChapterNotice(`Chapter Selanjutnya: ${nextTitle}`);
        resetScrollPosition();
        setIsFading(false);
      }, 100);

      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 350);
    }
  }, [currentChapterIndex, chapters, setCurrentChapter, resetScrollPosition, triggerChapterNotice]);

  const goPrevChapter = useCallback(() => {
    if (currentChapterIndex > 0 && !isTransitioningRef.current) {
      isTransitioningRef.current = true;
      setIsFading(true);

      setTimeout(() => {
        const prevIdx = currentChapterIndex - 1;
        setCurrentChapter(prevIdx);
        const prevTitle = chapters[prevIdx]?.title || `Chapter ${prevIdx + 1}`;
        triggerChapterNotice(`Chapter Sebelumnya: ${prevTitle}`);
        resetScrollPosition();
        setIsFading(false);
      }, 100);

      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 350);
    }
  }, [currentChapterIndex, chapters, setCurrentChapter, resetScrollPosition, triggerChapterNotice]);

  // Mouse Wheel Horizontal Scroll Converter for Vertical Japanese Typesetting:
  // Converts physical desktop mouse vertical wheel (deltaY) into horizontal scrolling across pages.
  // NO automatic chapter switching via wheel/swipe: user is strictly locked in the current chapter
  // until reaching the end, and must use the side/bottom Next/Prev buttons to change chapters.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isLoaded) return;

    const handleWheel = (e: WheelEvent) => {
      if (isSettingsOpen || isTocOpen) return;

      const isVertical = settings.writingMode === "vertical";

      if (isVertical) {
        // Convert vertical mouse scroll (deltaY) to horizontal scrolling in vertical-rl mode
        if (e.deltaY !== 0) {
          e.preventDefault();
          // Scroll forward into Japanese text when scrolling mouse wheel down (e.deltaY > 0)
          el.scrollLeft -= e.deltaY;
        }
      }
      // Zero chapter switching here — user is locked inside current chapter until clicking Next/Prev buttons!
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [isLoaded, settings.writingMode, isSettingsOpen, isTocOpen]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Intercept clicks on <a> links inside chapter HTML
    const anchor = target.closest("a");
    if (anchor) {
      e.preventDefault();
      e.stopPropagation();

      const href = anchor.getAttribute("href") || anchor.getAttribute("xlink:href");
      if (!href) return;

      // External HTTP(S) links open in new tab
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }

      // Parse relative EPUB internal link (e.g. "p-002.xhtml#sec1" or "#sec1")
      const [pathPart, fragment] = href.split("#");
      const cleanPath = pathPart ? pathPart.split("/").pop()?.toLowerCase() : "";

      let targetIndex = -1;

      if (cleanPath) {
        // Match chapter by manifest href filename (e.g. p-002.xhtml)
        targetIndex = chapters.findIndex((c) => {
          if (!c.href) return false;
          const cHrefFilename = c.href.split("/").pop()?.toLowerCase();
          return cHrefFilename === cleanPath;
        });

        // Fallback: match by fragment ID if filename search failed
        if (targetIndex === -1 && fragment) {
          targetIndex = chapters.findIndex(
            (c) => c.htmlContent.includes(`id="${fragment}"`) || c.htmlContent.includes(`name="${fragment}"`)
          );
        }
      } else if (fragment) {
        // Anchor inside current or another chapter
        targetIndex = chapters.findIndex(
          (c) => c.htmlContent.includes(`id="${fragment}"`) || c.htmlContent.includes(`name="${fragment}"`)
        );
        if (targetIndex === -1) targetIndex = currentChapterIndex;
      }

      if (targetIndex !== -1) {
        setCurrentChapter(targetIndex);
        resetScrollPosition();

        if (fragment) {
          setTimeout(() => {
            const el = document.getElementById(fragment) || document.querySelector(`[name="${fragment}"]`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 150);
        }
      }
      return;
    }

    // Click-triggered dictionary lookup (Yomitan-style: click a word, popup appears instantly).
    // Only for mouse gestures in "click" mode - touch already gets an instant popup from the
    // tap-scanner effect on touchstart, so re-running it here would double-fetch the same word.
    const dictEnabled = settings.enableDictionary ?? true;
    const isClickMode = !settings.dictTrigger || settings.dictTrigger === "click";
    if (dictEnabled && isClickMode && !isTouchGestureRef.current) {
      const pointerData = getTextNodeAtPoint(e.clientX, e.clientY, contentRef.current);
      if (pointerData) {
        const chunk = extractContextChunk(pointerData.textNode, pointerData.offset, 15);
        if (chunk.text) {
          const charRect = getCharRect(pointerData.textNode, pointerData.offset);
          scanAnchorRef.current = pointerData;
          setSelectionState({
            text: chunk.text,
            position: charRect || { x: e.clientX, y: e.clientY, width: 4, height: 20 },
            chunkPos: chunk.pos,
            explicitFurigana: getExplicitFurigana(pointerData.textNode),
          });
          lastDictLookupAtRef.current = Date.now();
          return; // word resolved under the click - don't also toggle the toolbar for this tap
        }
      }
    }

    // Ignore this click if user is actively selecting text (e.g., highlighting Japanese words) -
    // let the drag-selection's own mouseup/touchend handler own this gesture instead.
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    // Skip if a dictionary lookup just resolved via the tap-scanner in this SAME gesture
    // (touch, hover/shift mode) - don't immediately dismiss the popup it just opened.
    if (Date.now() - lastDictLookupAtRef.current < 250) {
      return;
    }

    // Modal-style dismiss: if the dictionary popup is currently open, a click anywhere that
    // didn't resolve to a word (and isn't a fresh selection) closes it, in every trigger mode -
    // click on empty page area to close, same as clicking the X button.
    if (selectionState) {
      setSelectionState(null);
      clearScanHighlight();
      return;
    }

    // Toggle toolbar only on intentional tap/click in empty reading area
    if (!isSettingsOpen && !isTocOpen) {
      setShowToolbar(!showToolbar);
    }
  };

  const currentChapter = chapters[currentChapterIndex];

  if (!isLoaded || !book || !currentChapter) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "var(--kb-bg)", color: "var(--kb-text)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--kb-primary)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--kb-text-muted)" }}>
            Loading book...
          </p>
        </div>
      </div>
    );
  }

  // Empirically verified (not just theoretically derived - vertical-rl scrollLeft direction has
  // proven inconsistent/tricky across this project, and a "flip for vertical mode" assumption
  // here was previously backwards, causing progress to visibly DECREASE while reading forward):
  // raw chapterScrollRatio already increases as the user reads forward in vertical mode too,
  // same as horizontal - no flip needed either way.
  const normalizedChapterRatio = chapterScrollRatio;
  // A chapter with nothing to scroll (its whole content already fits on screen) counts as fully
  // read the moment it's displayed, rather than being stuck at 0% until the user navigates away.
  const isChapterScrollable = contentRef.current
    ? settings.writingMode === "vertical"
      ? contentRef.current.scrollWidth > contentRef.current.clientWidth
      : contentRef.current.scrollHeight > contentRef.current.clientHeight
    : true;
  const inChapterProgress = isChapterScrollable ? normalizedChapterRatio : 1;

  const totalBookChars = chapterCharCounts.reduce((a, b) => a + b, 0);
  const charsBeforeChapter = chapterCharCounts.slice(0, currentChapterIndex).reduce((a, b) => a + b, 0);
  const currentChapterChars = chapterCharCounts[currentChapterIndex] ?? 0;
  const currentCharPosition = Math.round(charsBeforeChapter + currentChapterChars * inChapterProgress);
  const bookPercent = totalBookChars > 0 ? (currentCharPosition / totalBookChars) * 100 : 0;
  const progressPercent = Math.round(bookPercent);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: "var(--kb-bg)", color: "var(--kb-text)" }}
    >
      {/* ===== Top Toolbar ===== */}
      <header
        className="kb-reader-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "60px",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          backgroundColor: "var(--kb-toolbar-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--kb-border)",
          transform: showToolbar ? "translateY(0)" : "translateY(-100%)",
          opacity: showToolbar ? 1 : 0,
          pointerEvents: showToolbar ? "auto" : "none",
          transition: "transform 0.3s ease, opacity 0.3s ease",
        }}
      >
        {/* Left: Back + title */}
        <div className="kb-reader-left-section" style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexShrink: 1, marginRight: "12px" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--kb-bg-secondary)",
              border: "1px solid var(--kb-border)",
              color: "var(--kb-text)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)")}
            title={language === "ID" ? "Kembali ke Perpustakaan" : "Back to Library"}
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
          </button>
          <button
            onClick={() => setShowDictionarySearch(true)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--kb-bg-secondary)",
              border: "1px solid var(--kb-border)",
              color: "var(--kb-text)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)")}
            title={language === "ID" ? "Cari Kamus" : "Dictionary Search"}
          >
            <Search style={{ width: "16px", height: "16px" }} />
          </button>
          <p
            className="kb-reader-book-title"
            style={{
              fontSize: "14px",
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "240px",
            }}
          >
            {book.title}
          </p>
        </div>

        {/* Center: Chapter info */}
        <div
          className="kb-reader-chapter-pill"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: "var(--kb-bg-secondary)",
            border: "1px solid var(--kb-border-subtle)",
            color: "var(--kb-text-muted)",
            flexShrink: 0,
            margin: "0 8px",
          }}
        >
          <span className="kb-reader-chapter-text" style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentChapter.title}
          </span>
          <span>·</span>
          <span style={{ whiteSpace: "nowrap" }}>
            {currentChapterIndex + 1} / {chapters.length}
          </span>
        </div>

        {/* Right: Controls */}
        <div className="kb-reader-right-section" style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "12px" }}>
          {/* Bookmark Button (Placed to the LEFT of Table of Contents button) */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!book) return;
              const currentPos = getScrollPosition();
              await saveProgress({
                bookId: book.id,
                chapterIndex: currentChapterIndex,
                scrollPosition: currentPos,
                lastReadAt: Date.now(),
              });
              setIsBookmarked(true);
              const title = chapters[currentChapterIndex]?.title || `Bab ${currentChapterIndex + 1}`;
              triggerChapterNotice(`🔖 Bookmark tersimpan pada ${title}`);
            }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isBookmarked ? "rgba(99,102,241,0.15)" : "var(--kb-bg-secondary)",
              border: isBookmarked ? "1px solid var(--kb-primary)" : "1px solid var(--kb-border)",
              color: isBookmarked ? "var(--kb-primary)" : "var(--kb-text)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
            title={language === "ID" ? "Simpan Bookmark Halaman Ini" : "Save Bookmark on This Page"}
          >
            {isBookmarked ? (
              <BookmarkCheck style={{ width: "16px", height: "16px", fill: "var(--kb-primary)" }} />
            ) : (
              <Bookmark style={{ width: "16px", height: "16px" }} />
            )}
          </button>

          <button
            onClick={() => { setTocOpen(!isTocOpen); setSettingsOpen(false); }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isTocOpen ? "var(--kb-primary)" : "var(--kb-bg-secondary)",
              border: isTocOpen ? "1px solid var(--kb-primary)" : "1px solid var(--kb-border)",
              color: isTocOpen ? "white" : "var(--kb-text)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
            title={language === "ID" ? "Daftar Isi" : "Table of Contents"}
          >
            <List style={{ width: "16px", height: "16px" }} />
          </button>
          <button
            onClick={() => { setSettingsOpen(!isSettingsOpen); setTocOpen(false); }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isSettingsOpen ? "var(--kb-primary)" : "var(--kb-bg-secondary)",
              border: isSettingsOpen ? "1px solid var(--kb-primary)" : "1px solid var(--kb-border)",
              color: isSettingsOpen ? "white" : "var(--kb-text)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
            title={language === "ID" ? "Pengaturan" : "Settings"}
          >
            <Settings style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
      </header>

      {/* ===== Main Reading Area ===== */}
      <main
        ref={mainRef}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          paddingTop: "0px",
          paddingBottom: "0px",
          backgroundColor: "var(--kb-bg)",
        }}
        onClick={handleContentClick}
      >
        {/* Floating Quick Page Turn Control (Left Side) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            settings.writingMode === "vertical" ? goNextChapter() : goPrevChapter();
          }}
          disabled={settings.writingMode === "vertical" ? currentChapterIndex === chapters.length - 1 : currentChapterIndex === 0}
          style={{
            position: "absolute",
            left: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 30,
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            backgroundColor: "var(--kb-surface)",
            border: "1px solid var(--kb-border)",
            color: "var(--kb-text)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: showToolbar ? 0.85 : 0.15,
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = showToolbar ? "0.85" : "0.15")}
          title={settings.writingMode === "vertical" ? "Next Chapter" : "Previous Chapter"}
        >
          <ChevronLeft style={{ width: "20px", height: "20px" }} />
        </button>

        {/* Floating Quick Page Turn Control (Right Side) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            settings.writingMode === "vertical" ? goPrevChapter() : goNextChapter();
          }}
          disabled={settings.writingMode === "vertical" ? currentChapterIndex === 0 : currentChapterIndex === chapters.length - 1}
          style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 30,
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            backgroundColor: "var(--kb-surface)",
            border: "1px solid var(--kb-border)",
            color: "var(--kb-text)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: showToolbar ? 0.85 : 0.15,
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = showToolbar ? "0.85" : "0.15")}
          title={settings.writingMode === "vertical" ? "Previous Chapter" : "Next Chapter"}
        >
          <ChevronRight style={{ width: "20px", height: "20px" }} />
        </button>

        <div
          ref={contentRef}
          className={`reader-content ${settings.writingMode === "vertical" ? "vertical" : "horizontal"}`}
          style={{
            position: "relative",
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            letterSpacing: `${settings.letterSpacing}em`,
            padding: MARGIN_VALUES[settings.margin],
            maxWidth: settings.writingMode === "horizontal" ? READER_WIDTH_VALUES[settings.readerWidth] : "100%",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            color: "var(--kb-text)",
            opacity: isFading ? 0 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          {/* ===== Persistent Selection Highlight Overlay ===== */}
          {/* Rects are viewport coordinates (see updateBookmarkRects), so the wrapper is fixed and
              clipped to the reading area - it must not paint over the header or toolbar.
              Rendered into document.body: a `position: fixed` element is only viewport-relative
              while no ancestor establishes a containing block for it, and the reader nests this
              deep inside transformed/animated wrappers. The portal removes that dependency. */}
          {bookmarkOverlay && bookmarkOverlay.chapterIndex === currentChapterIndex && createPortal(
            <div
              style={{
                position: "fixed",
                top: `${overlayClip.top}px`,
                left: `${overlayClip.left}px`,
                width: `${overlayClip.width}px`,
                height: `${overlayClip.height}px`,
                pointerEvents: "none",
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: `${-overlayClip.top}px`,
                  left: `${-overlayClip.left}px`,
                  width: "100vw",
                  height: "100vh",
                  pointerEvents: "none",
                }}
              >
                {bookmarkOverlay.rects.map((r, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectionState({
                        text: bookmarkOverlay.text,
                        explicitFurigana: bookmarkOverlay.explicitFurigana,
                        position: { ...bookmarkOverlay.position, width: 4, height: 20 },
                      });
                    }}
                    title="Penanda Bacaan Terakhir (Klik untuk lihat kamus)"
                    style={{
                      position: "absolute",
                      left: `${r.left}px`,
                      top: `${r.top}px`,
                      width: `${r.width}px`,
                      height: `${r.height}px`,
                      backgroundColor: "rgba(56, 189, 248, 0.4)",
                      borderLeft: r.height > r.width ? "3px dashed #0284c7" : "none",
                      borderBottom: r.height <= r.width ? "2px dashed #0284c7" : "none",
                      borderRadius: "3px",
                      boxShadow: "0 0 10px rgba(56, 189, 248, 0.4)",
                      pointerEvents: "auto",
                      cursor: "pointer",
                    }}
                  >
                    {/* Small Close Button at Top Right Corner of Selection */}
                    {idx === 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBookmarkOverlay(null);
                          setSelectionState(null);
                          clearScanHighlight();
                          if (typeof window !== "undefined") {
                            window.getSelection()?.removeAllRanges();
                          }
                        }}
                        title="Batal seleksi"
                        style={{
                          position: "absolute",
                          top: "-10px",
                          right: "-10px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(15, 23, 42, 0.85)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          color: "#94a3b8",
                          border: "1px solid rgba(255, 255, 255, 0.25)",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          zIndex: 35,
                          pointerEvents: "auto",
                          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.15)";
                          e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.9)";
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.85)";
                          e.currentTarget.style.color = "#94a3b8";
                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
                        }}
                      >
                        <X style={{ width: "12px", height: "12px", strokeWidth: 2.5 }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )}

          <div
            dangerouslySetInnerHTML={{
              __html: currentChapter.htmlContent && currentChapter.htmlContent.trim() !== ""
                ? currentChapter.htmlContent
                : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px;color:var(--kb-text-muted);">
                    <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;color:var(--kb-text);">${currentChapter.title}</h2>
                    <p style="font-size:14px;">Halaman ini tidak berisi teks. Klik tombol Next di bawah atau buka Table of Contents untuk berpindah ke bab berikutnya.</p>
                   </div>`
            }}
          />
        </div>
      </main>

      {/* ===== Bottom Bar ===== */}
      <div
        className="kb-reader-bottom-bar"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          backgroundColor: "var(--kb-toolbar-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid var(--kb-border)",
          transform: showToolbar ? "translateY(0)" : "translateY(100%)",
          opacity: showToolbar ? 1 : 0,
          pointerEvents: showToolbar ? "auto" : "none",
          transition: "transform 0.3s ease, opacity 0.3s ease",
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); goPrevChapter(); }}
          disabled={currentChapterIndex === 0}
          aria-label={language === "ID" ? "Bab Sebelumnya" : "Previous Chapter"}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--kb-bg-secondary)",
            border: "1px solid var(--kb-border)",
            color: "var(--kb-text)",
            cursor: "pointer",
            flexShrink: 0,
            opacity: currentChapterIndex === 0 ? 0.3 : 1,
          }}
        >
          <ChevronLeft style={{ width: "16px", height: "16px" }} />
        </button>

        <div className="kb-reader-bottom-inner" style={{ flex: 1, display: "flex", alignItems: "center", gap: "16px", padding: "0 24px" }}>
          <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "var(--kb-border)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                backgroundColor: "var(--kb-primary)",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: "var(--kb-text-muted)", whiteSpace: "nowrap" }}>
            {progressPercent}%
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); goNextChapter(); }}
          disabled={currentChapterIndex === chapters.length - 1}
          aria-label={language === "ID" ? "Bab Berikutnya" : "Next Chapter"}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--kb-bg-secondary)",
            border: "1px solid var(--kb-border)",
            color: "var(--kb-text)",
            cursor: "pointer",
            flexShrink: 0,
            opacity: currentChapterIndex === chapters.length - 1 ? 0.3 : 1,
          }}
        >
          <ChevronRight style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* ===== Live Scanned-Word Highlight ===== */}
      {/* Same painting mechanism as the bookmark overlay above - viewport rects in a fixed,
          body-portalled wrapper clipped to the reading area - because that one is demonstrably
          visible in this build. Plain fill, no dashed border or close button, so the dictionary
          highlight stays visually distinct from a saved bookmark. */}
      {scanHighlight && scanHighlight.rects.length > 0 && createPortal(
        <div
          style={{
            position: "fixed",
            top: `${overlayClip.top}px`,
            left: `${overlayClip.left}px`,
            width: `${overlayClip.width}px`,
            height: `${overlayClip.height}px`,
            pointerEvents: "none",
            zIndex: 19,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: `${-overlayClip.top}px`,
              left: `${-overlayClip.left}px`,
              width: "100vw",
              height: "100vh",
              pointerEvents: "none",
            }}
          >
            {scanHighlight.rects.map((r, idx) => (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: `${r.left}px`,
                  top: `${r.top}px`,
                  width: `${r.width}px`,
                  height: `${r.height}px`,
                  backgroundColor: "rgba(56, 189, 248, 0.4)",
                  borderLeft: r.height > r.width ? "3px dashed #0284c7" : "none",
                  borderBottom: r.height <= r.width ? "2px dashed #0284c7" : "none",
                  borderRadius: "3px",
                  boxShadow: "0 0 10px rgba(56, 189, 248, 0.4)",
                  pointerEvents: "none",
                }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* ===== Book-wide Reading Progress Badge (ttu-reader style, always visible regardless of toolbar) ===== */}
      {totalBookChars > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "12px",
            right: "12px",
            zIndex: 45,
            pointerEvents: "none",
            padding: "4px 10px",
            borderRadius: "8px",
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "11px",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          {currentCharPosition} / {totalBookChars} &nbsp; {bookPercent.toFixed(2)}%
        </div>
      )}

      {/* ===== Chapter Transition Toast Notification ===== */}
      {chapterNotice && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            padding: "10px 20px",
            borderRadius: "24px",
            backgroundColor: "var(--kb-surface)",
            color: "var(--kb-text)",
            border: "1px solid var(--kb-primary)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontSize: "13px",
            fontWeight: 700,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <BookOpen style={{ width: "16px", height: "16px", color: "var(--kb-primary)" }} />
          <span>{chapterNotice}</span>
        </div>
      )}

      {/* ===== Dictionary Index Notice ===== */}
      {/* Only rendered while the server index is still building, and dismissed by the status itself
          rather than a timer - so the reader can tell at a glance whether the dictionary is usable
          without having to open Settings. Sits above the chapter toast so the two never overlap. */}
      {dictStatus && !dictStatus.isReady && (
        <div
          style={{
            position: "fixed",
            bottom: "132px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 59,
            padding: "10px 20px",
            borderRadius: "24px",
            backgroundColor: "var(--kb-surface)",
            color: "var(--kb-text)",
            border: "1px solid rgba(234, 179, 8, 0.45)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontSize: "13px",
            fontWeight: 700,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#eab308",
              flexShrink: 0,
            }}
          />
          <span>
            Menyiapkan kamus
            {dictStatus.totalTerms > 0 ? `: ${dictStatus.totalTerms.toLocaleString("id-ID")} entri` : "..."}
          </span>
        </div>
      )}

      {/* ===== Block Selection Dictionary Popup ===== */}
      {selectionState && (
        <SelectionPopup
          selectedText={selectionState.text}
          explicitFurigana={selectionState.explicitFurigana}
          position={selectionState.position}
          chunkPos={selectionState.chunkPos}
          onResolve={onDictResolve}
          onClose={() => { setSelectionState(null); clearScanHighlight(); }}
        />
      )}

      {/* ===== Settings Panel ===== */}
      {isSettingsOpen && (
        <ReaderSettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          language={language}
        />
      )}

      {/* ===== Table of Contents ===== */}
      {isTocOpen && (
        <TableOfContents
          chapters={chapters}
          currentIndex={currentChapterIndex}
          onSelect={(index) => {
            setCurrentChapter(index);
            resetScrollPosition();
            setTocOpen(false);
          }}
          onClose={() => setTocOpen(false)}
        />
      )}

      {/* ===== Dictionary Search Modal ===== */}
      <DictionarySearchModal
        isOpen={showDictionarySearch}
        onClose={() => setShowDictionarySearch(false)}
        language={language}
      />
    </div>
  );
}
