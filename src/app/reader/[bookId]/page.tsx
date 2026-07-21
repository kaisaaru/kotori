"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  List,
  BookOpen,
  X,
} from "lucide-react";
import { useReaderStore } from "@/stores/reader-store";
import {
  getBook,
  getChapters,
  getProgress,
  saveProgress,
  updateBookLastRead,
  getSettings,
  saveSettings,
} from "@/services/book-storage";
import type { Chapter as ChapterType } from "@/types/book";
import { MARGIN_VALUES, READER_WIDTH_VALUES } from "@/types/book";
import ReaderSettingsPanel from "@/components/reader/ReaderSettingsPanel";
import TableOfContents from "@/components/reader/TableOfContents";
import { SelectionPopup } from "@/components/reader/SelectionPopup";

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

  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectionState, setSelectionState] = useState<{
    text: string;
    explicitFurigana?: string;
    position: { x: number; y: number };
  } | null>(null);
  const [bookmarkOverlay, setBookmarkOverlay] = useState<{
    text: string;
    explicitFurigana?: string;
    position: { x: number; y: number };
    rects: Array<{ left: number; top: number; width: number; height: number }>;
  } | null>(null);
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });
  const toolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync scroll position of contentRef container for 100% locked highlight overlay
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollPos({ left: container.scrollLeft, top: container.scrollTop });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isLoaded]);

  // Detect highlighted/blocked text selection for dictionary popup & persistent bookmark
  useEffect(() => {
    const handleMouseUp = (e?: MouseEvent | TouchEvent) => {
      // If user disabled Dictionary in Reader Settings, do not show dictionary popups!
      if (settings.enableDictionary === false) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
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

        if (contentRef.current && mainRef.current) {
          const mainRect = mainRef.current.getBoundingClientRect();
          const scrollTop = contentRef.current.scrollTop;
          const scrollLeft = contentRef.current.scrollLeft;

          const rawClientRects = Array.from(range.getClientRects()).map((r) => ({
            left: r.left - mainRect.left + scrollLeft,
            top: r.top - mainRect.top + scrollTop,
            width: Math.max(r.width, 10),
            height: Math.max(r.height, 16),
          }));

          if (rawClientRects.length > 0) {
            relativeRects = rawClientRects;
          } else {
            relativeRects = [
              {
                left: rect.left - mainRect.left + scrollLeft,
                top: rect.top - mainRect.top + scrollTop,
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
            x: rect.left + rect.width / 2,
            y: rect.top,
          },
        });
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [settings.enableDictionary]);

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
      const savedTheme = localStorage.getItem("kotoba-theme") || "dark";
      document.documentElement.setAttribute("data-theme", savedTheme);
    };
  }, [settings.theme]);

  // Save progress periodically
  useEffect(() => {
    if (!book || !isLoaded) return;
    const interval = setInterval(() => {
      saveProgress({
        bookId: book.id,
        chapterIndex: currentChapterIndex,
        scrollPosition: getScrollPosition(),
        lastReadAt: Date.now(),
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [book, currentChapterIndex, isLoaded]);

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

  // Reset scroll whenever chapter index or writing mode changes
  useEffect(() => {
    if (isLoaded) {
      resetScrollPosition();
    }
  }, [currentChapterIndex, settings.writingMode, isLoaded, resetScrollPosition]);

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

    // Ignore toolbar toggle if user is selecting text (e.g., highlighting Japanese words)
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
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

  const progressPercent = Math.round(((currentChapterIndex + 1) / chapters.length) * 100);

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
            title="Back to Library"
          >
            <ArrowLeft style={{ width: "16px", height: "16px" }} />
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
            title="Table of Contents"
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
            title="Settings"
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
          paddingTop: showToolbar ? "64px" : "0px",
          paddingBottom: showToolbar ? "56px" : "0px",
          transition: "padding 0.3s ease",
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

        {/* ===== Persistent Selection Highlight Overlay ===== */}
        {bookmarkOverlay && (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              pointerEvents: "none",
              zIndex: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: `${-scrollPos.top}px`,
                left: `${-scrollPos.left}px`,
                width: "100%",
                height: "100%",
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
                      position: bookmarkOverlay.position,
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
          </div>
        )}

        <div
          ref={contentRef}
          className={`reader-content ${settings.writingMode === "vertical" ? "vertical" : "horizontal"}`}
          style={{
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
          dangerouslySetInnerHTML={{
            __html: currentChapter.htmlContent && currentChapter.htmlContent.trim() !== ""
              ? currentChapter.htmlContent
              : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px;color:var(--kb-text-muted);">
                  <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;color:var(--kb-text);">${currentChapter.title}</h2>
                  <p style="font-size:14px;">Halaman ini tidak berisi teks. Klik tombol Next di bawah atau buka Table of Contents untuk berpindah ke bab berikutnya.</p>
                 </div>`
          }}
        />
      </main>

      {/* ===== Bottom Bar ===== */}
      <div
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
          transition: "transform 0.3s ease, opacity 0.3s ease",
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); goPrevChapter(); }}
          disabled={currentChapterIndex === 0}
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

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "16px", padding: "0 24px" }}>
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

      {/* ===== Block Selection Dictionary Popup ===== */}
      {selectionState && (
        <SelectionPopup
          selectedText={selectionState.text}
          explicitFurigana={selectionState.explicitFurigana}
          position={selectionState.position}
          onClose={() => setSelectionState(null)}
        />
      )}

      {/* ===== Settings Panel ===== */}
      {isSettingsOpen && (
        <ReaderSettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setSettingsOpen(false)}
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
    </div>
  );
}
