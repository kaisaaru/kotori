"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { flushSync } from "react-dom";
import {
  BookOpen,
  Upload,
  Trash2,
  MoreVertical,
  Library,
  FileText,
  Search,
  Moon,
  Sun,
  Plus,
  User,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  LayoutGrid,
  Sparkles,
  Heart,
  ShieldAlert,
  Send,
  MessageSquare,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  getAllBooks,
  saveBook,
  deleteBook,
  getProgress,
  deleteProgress,
  getChapter,
  getChapters,
} from "@/services/book-storage";
import { formatFileSize, truncate } from "@/lib/utils";
import type { BookMeta, ReadingProgress, Chapter } from "@/types/book";
import { getSystemTheme } from "@/types/book";
import { Footer } from "@/components/Footer";
import { useScrollReveal } from "@/hooks/useScrollReveal";

// Deferred out of the initial bundle - most page loads never open the search modal or upload a
// book, so their code (plus dictionary-service.ts / jszip+dompurify respectively) shouldn't ship
// on every visit.
const DictionarySearchModal = dynamic(
  () => import("@/components/DictionarySearchModal").then((m) => m.DictionarySearchModal),
  { ssr: false }
);

/* ===== Scroll Reveal Wrapper ===== */
function RevealSection({
  children,
  className = "kb-reveal",
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const [ref, isVisible] = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? "kb-visible" : ""}`}
      style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

const TRANSLATIONS = {
  ID: {
    subtitle: "Pembaca Novel Jepang",
    searchPlaceholder: "Cari buku atau penulis...",
    addBook: "Tambah Buku",
    dragDropText: "Tarik & Lepaskan file EPUB Anda di sini",
    browseFiles: "atau klik untuk telusuri file .epub",
    libraryTitle: "Perpustakaan Buku",
    noBooksYet: "Belum Ada Buku",
    noBooksDesc: "Unggah file EPUB novel Jepang Anda untuk mulai membaca.",
    noBooksHintEmpty: "Bingung mencari file novel EPUB? Anda dapat mencari dan mengunduhnya di ",
    noBooksHintList: "Cari EPUB lainnya di ",
    readNow: "Baca Sekarang",
    continueReading: "Lanjutkan Membaca",
    deleteConfirmTitle: "Hapus Novel",
    deleteConfirmDesc: "Apakah Anda yakin ingin menghapus buku ini?",
    deleteConfirmDescWithTitle: (title: string) => `Apakah Anda yakin ingin menghapus novel "${title}" dari perpustakaan lokal Anda? Kemajuan membaca yang tersimpan juga akan ikut terhapus.`,
    cancel: "Batal",
    delete: "Hapus",
    noMatchTitle: "Tidak ada novel yang cocok",
    noMatchDesc: (query: string) => `Tidak ada buku yang cocok dengan "${query}". Coba cari dengan kata kunci lain.`,
    languageLabel: "Bahasa / Language",
    themeLabel: "Mode Tampilan / Theme",
    themeLight: "Mode Terang (Light)",
    themeDark: "Mode Gelap (Dark)",
    readNovel: "Baca Novel",
    unknownAuthor: "Penulis Tidak Diketahui",
    unread: "Belum Dibaca",
    readProgress: (percent: number) => `${percent}% Dibaca`,
    chaptersCount: (count: number) => `${count} BAB`,
    bookExists: (title: string) => `Novel "${title}" sudah ada di perpustakaan.`,
    bookAdded: (title: string) => `Novel "${title}" berhasil ditambahkan!`,
    uploadReading: (filename: string) => `Membaca "${filename}"...`,
    uploadSaving: (title: string) => `Menyimpan "${title}" ke perpustakaan...`,
    optionsMenu: "Buka Menu Opsi",
    resetProgress: "Reset Kemajuan",
    progressReset: (title: string) => `Kemajuan membaca "${title}" berhasil di-reset.`,
    resetConfirmTitle: "Reset Kemajuan Membaca",
    resetConfirmDesc: (title: string) => `Apakah Anda yakin ingin me-reset kemajuan membaca untuk novel "${title}"? Semua progres membaca Anda akan diulang dari awal.`,
    bookDeleted: (title: string) => `Novel "${title}" berhasil dihapus.`,
    feedbackBtn: "Saran & Kritik",
    feedbackTitle: "Saran & Kritik untuk Kotori",
    feedbackDesc: "Kotori dibuat untuk mempermudah membaca & belajar bahasa Jepang. Bagikan ide fitur baru, lapor bug, atau berikan apresiasi kepada developer!",
    catBug: "Lapor Bug / Error",
    catIdea: "Ide Fitur Baru",
    catLove: "Apresiasi / Lainnya",
    msgPlaceholder: "Tuliskan saran, kritik, atau detail masalah yang Anda temukan di sini...",
    contactPlaceholder: "Opsional: IG / TikTok atau email Anda jika ingin dibalas",
    sendBtn: "Kirim Pesan",
    sendingBtn: "Mengirim...",
    feedbackSuccess: "Terima kasih! Saran & kritik Anda telah terkirim kepada developer.",
    communityTitle: "Dukung Kotori",
    communityDesc: "Punya ide fitur baru, menemukan bug, atau sekadar ingin menyapa? Jangan ragu untuk mengirimkan saran Anda.",
  },
  EN: {
    subtitle: "Japanese Novel Reader",
    searchPlaceholder: "Search books or authors...",
    addBook: "Add Book",
    dragDropText: "Drag & Drop your EPUB file here",
    browseFiles: "or click to browse .epub files",
    libraryTitle: "Book Library",
    noBooksYet: "No Books Found",
    noBooksDesc: "Upload your Japanese novel EPUB file to start reading.",
    noBooksHintEmpty: "Confused about finding EPUB novel files? You can search and download them on ",
    noBooksHintList: "Search for more EPUBs on ",
    readNow: "Read Now",
    continueReading: "Continue Reading",
    deleteConfirmTitle: "Delete Novel",
    deleteConfirmDesc: "Are you sure you want to remove this book?",
    deleteConfirmDescWithTitle: (title: string) => `Are you sure you want to remove "${title}" from your local library? Saved reading progress will also be deleted.`,
    cancel: "Cancel",
    delete: "Delete",
    noMatchTitle: "No matching novels found",
    noMatchDesc: (query: string) => `No books match "${query}". Try searching for another keyword.`,
    languageLabel: "Language",
    themeLabel: "Theme Mode",
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    readNovel: "Read Novel",
    unknownAuthor: "Unknown Author",
    unread: "Unread",
    readProgress: (percent: number) => `${percent}% Read`,
    chaptersCount: (count: number) => `${count} CH`,
    bookExists: (title: string) => `Novel "${title}" already exists in the library.`,
    bookAdded: (title: string) => `Novel "${title}" added successfully!`,
    uploadReading: (filename: string) => `Reading "${filename}"...`,
    uploadSaving: (title: string) => `Saving "${title}" to library...`,
    optionsMenu: "Open Options Menu",
    resetProgress: "Reset Progress",
    progressReset: (title: string) => `Reading progress for "${title}" has been reset.`,
    resetConfirmTitle: "Reset Reading Progress",
    resetConfirmDesc: (title: string) => `Are you sure you want to reset the reading progress for the novel "${title}"? Your progress will start over from the beginning.`,
    bookDeleted: (title: string) => `Novel "${title}" was successfully deleted.`,
    feedbackBtn: "Feedback",
    feedbackTitle: "Feedback & Suggestions",
    feedbackDesc: "Kotori is built to make reading & learning Japanese easier. Share feature ideas, report bugs, or send appreciation to the developer!",
    catBug: "Report a Bug",
    catIdea: "Feature Idea",
    catLove: "Appreciation / Other",
    msgPlaceholder: "Write your feedback, suggestions, or details about any bug you encountered...",
    contactPlaceholder: "Optional: Your IG / TikTok or email if you'd like a reply",
    sendBtn: "Send Feedback",
    sendingBtn: "Sending...",
    feedbackSuccess: "Thank you! Your feedback has been sent to the developer.",
    communityTitle: "Support Kotori",
    communityDesc: "Have a feature idea, found a bug, or just want to say hi? Feel free to drop a message.",
  },
};

/* ===== Helper to Parse Series and Volume from Title ===== */
function parseSeriesAndVolume(title: string): { series: string; volume: number | null } {
  // Convert full-width numbers to half-width numbers and normalize all space characters
  let cleanTitle = title
    .replace(/\.epub$/i, "")
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u00a0\u3000]+/g, " ")
    .trim();

  // 1. Remove bracket contents like 【電子特典付き】, (z-library), etc.
  cleanTitle = cleanTitle.replace(/[【\[\(\{\uff08\uff3b].*?[】\]\)\}\uff09\uff3d]/g, "").trim();

  // 2. Parse volume numbers
  let volume: number | null = null;
  const patterns = [
    /\s+(?:volume|vol|v)\.?\s*(\d+)/i,          // Vol 1, Vol. 1, Volume 1, v1
    /\s+(\d+)\s*$/i,                           // "Sword Art Online 1" at the end
    /第?\s*(\d+)\s*巻/i,                       // 1巻, 第1巻
    /\b(\d+)\b/,                               // Any standalone number in the title
  ];

  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern);
    if (match) {
      volume = parseInt(match[1], 10);
      cleanTitle = cleanTitle.replace(pattern, "").trim();
      break;
    }
  }

  // 3. Extract the clean series name (omit sub-volume subtitles / suffixes)
  // Split by full-width or half-width spaces
  const parts = cleanTitle.split(/[\s　]+/);
  if (parts.length > 1) {
    // If the first part contains Japanese characters (Kanji/Kana), we treat it as the main series name
    const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(parts[0]);
    if (hasJapanese) {
      cleanTitle = parts[0];
    }
  }

  // Clean trailing punctuation/dashes
  cleanTitle = cleanTitle.replace(/\s*[-–—:：~～]\s*$/, "").trim();

  return { series: cleanTitle, volume };
}

export default function HomePage() {
  const router = useRouter();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [progresses, setProgresses] = useState<
    Record<string, ReadingProgress | undefined>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [language, setLanguage] = useState<"ID" | "EN">("EN");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"shelf" | "grid">("shelf");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const [isIntroAnimating, setIsIntroAnimating] = useState(true);
  const [previewBook, setPreviewBook] = useState<BookMeta | null>(null);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);
  const [previewChapters, setPreviewChapters] = useState<Chapter[]>([]);
  const [previewPhase, setPreviewPhase] = useState<"none" | "idle" | "tucked" | "tucking" | "centering" | "opening" | "flipping" | "zooming">("none");
  const [isLandscapeImg, setIsLandscapeImg] = useState(false);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showDictionarySearch, setShowDictionarySearch] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<"idea" | "bug" | "love">("idea");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  useEffect(() => {
    setIsLandscapeImg(false);
    if (previewBook) {
      const progress = progresses[previewBook.id];
      const chIndex = progress ? progress.chapterIndex : 0;
      getChapter(previewBook.id, chIndex).then((ch) => {
        setPreviewChapter(ch ?? null);
      });
      getChapters(previewBook.id).then((chs) => {
        setPreviewChapters(chs || []);
      });
    } else {
      setPreviewChapter(null);
      setPreviewChapters([]);
    }
  }, [previewBook, progresses]);

  const openMobileMenu = () => {
    setIsMobileMenuOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsMenuAnimating(true);
      });
    });
  };

  const closeMobileMenu = () => {
    setIsMenuAnimating(false);
    setTimeout(() => {
      setIsMobileMenuOpen(false);
    }, 280);
  };
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toasts, setToasts] = useState<Array<{
    id: number;
    message: string;
    type: "success" | "error" | "delete" | "reset";
    animatingOut: boolean;
  }>>([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, animatingOut: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" | "delete" | "reset" = "success") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type, animatingOut: false }]);

    const timer = setTimeout(() => {
      dismissToast(id);
    }, 4000);
    toastTimersRef.current.set(id, timer);
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    loadBooks();
    const savedTheme = localStorage.getItem("kotoba-theme") as "light" | "dark" | null;
    const t = savedTheme || getSystemTheme();
    setTheme(t as "light" | "dark");
    document.documentElement.setAttribute("data-theme", t);

    const savedLang = localStorage.getItem("kotoba-language") as "ID" | "EN" | null;
    if (savedLang === "ID" || savedLang === "EN") {
      setLanguage(savedLang);
    } else {
      const browserLang = navigator.language || navigator.languages?.[0] || "";
      setLanguage(browserLang.toLowerCase().startsWith("id") ? "ID" : "EN");
    }

    const savedViewMode = localStorage.getItem("kotoba-view-mode") as "shelf" | "grid" | null;
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  const handleLanguageChange = (lang: "ID" | "EN") => {
    setLanguage(lang);
    localStorage.setItem("kotoba-language", lang);
  };

  const t = TRANSLATIONS[language];

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      const allBooks = await getAllBooks();
      setBooks(allBooks);
      const progs: Record<string, ReadingProgress | undefined> = {};
      for (const book of allBooks) {
        progs[book.id] = await getProgress(book.id);
      }
      setProgresses(progs);
    } catch (error) {
      console.error("Failed to load books:", error);
    }
    setIsLoading(false);
  };

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const epubFiles = fileArray.filter(
      (f) => f.name.endsWith(".epub") || f.type === "application/epub+zip"
    );
    if (epubFiles.length === 0) {
      alert("Please select an EPUB file.");
      return;
    }
    setIsUploading(true);
    let updatedBooks = [...books];
    for (const file of epubFiles) {
      try {
        setUploadProgress(t.uploadReading(truncate(file.name, 35)));
        const { parseEpub } = await import("@/services/epub-parser");
        const { book, chapters } = await parseEpub(file);

        const exists = updatedBooks.some(
          (b) =>
            b.title.toLowerCase().trim() === book.title.toLowerCase().trim() &&
            b.author.toLowerCase().trim() === book.author.toLowerCase().trim()
        );

        if (exists) {
          showToast(t.bookExists(truncate(book.title, 40)), "error");
          continue;
        }

        setUploadProgress(t.uploadSaving(truncate(book.title, 35)));
        await saveBook(book, chapters);
        updatedBooks.push(book);
        showToast(t.bookAdded(truncate(book.title, 40)), "success");
      } catch (error) {
        console.error(`Failed to parse ${file.name}:`, error);
        alert(`Failed to parse "${file.name}". Make sure it's a valid EPUB file.`);
      }
    }
    setIsUploading(false);
    setUploadProgress("");
    await loadBooks();
  }, [books, language, showToast, loadBooks, t]);

  const handleDelete = async (bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    const bookTitle = book ? book.title : "";
    await deleteBook(bookId);
    setDeleteConfirm(null);
    await loadBooks();
    showToast(t.bookDeleted(truncate(bookTitle, 40)), "delete");
  };

  const handleResetProgress = async (bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    const bookTitle = book ? book.title : "";
    try {
      await deleteProgress(bookId);
      setResetConfirm(null);
      await loadBooks();
      showToast(t.progressReset(truncate(bookTitle, 40)), "reset");
    } catch (error) {
      console.error("Failed to reset progress:", error);
      alert("Failed to reset reading progress.");
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("kotoba-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const changeViewMode = (newMode: "shelf" | "grid") => {
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 500);

      const transition = (document as any).startViewTransition(() => {
        flushSync(() => {
          setViewMode(newMode);
        });
        localStorage.setItem("kotoba-view-mode", newMode);
      });
      transition.finished
        .then(() => {
          clearTimeout(timer);
          setIsTransitioning(false);
        })
        .catch(() => {
          clearTimeout(timer);
          setIsTransitioning(false);
        });
    } else {
      setViewMode(newMode);
      localStorage.setItem("kotoba-view-mode", newMode);
    }
  };

  const handleBookClick = (book: BookMeta) => {
    setPreviewBook(book);
    setPreviewPhase("tucked");
    setTimeout(() => {
      setPreviewPhase("idle");
    }, 50);
  };

  const handleClosePreview = () => {
    if (previewPhase !== "idle") return;
    setPreviewPhase("tucked");
    setTimeout(() => {
      setPreviewBook(null);
      setPreviewPhase("none");
    }, 500);
  };

  const startBookTransition = (book: BookMeta) => {
    setPreviewPhase("tucking");
    
    const progress = progresses[book.id];
    const chapterIndex = progress ? progress.chapterIndex : 0;
    
    setTimeout(() => {
      setPreviewPhase("centering");
      
      setTimeout(() => {
        setPreviewPhase("opening");
        
        if (chapterIndex > 0) {
          // Immediately start page flipping alongside cover opening (0ms delay)
          setPreviewPhase("flipping");
          
          const numFlips = Math.min(chapterIndex, 10);
          const flippingDuration = 400 + numFlips * 90;
          
          setTimeout(() => {
            setPreviewPhase("zooming");
            
            setTimeout(() => {
              router.push(`/reader/${book.id}`);
              setTimeout(() => {
                setPreviewBook(null);
                setPreviewPhase("none");
              }, 400);
            }, 500);
          }, flippingDuration);
        } else {
          // No chapters read -> skip flipping sequence
          setTimeout(() => {
            setPreviewPhase("zooming");
            
            setTimeout(() => {
              router.push(`/reader/${book.id}`);
              setTimeout(() => {
                setPreviewBook(null);
                setPreviewPhase("none");
              }, 400);
            }, 500);
          }, 500);
        }
      }, 400);
    }, 400);
  };

  const isEpubDragEvent = (e: React.DragEvent) => {
    if (!e.dataTransfer || !e.dataTransfer.items) return false;
    const items = Array.from(e.dataTransfer.items);
    if (items.length === 0) return false;
    return items.some((item) => {
      if (item.kind !== "file") return false;
      const type = item.type.toLowerCase();
      // Explicitly ignore images, videos, audio, pdf, text
      if (
        type.startsWith("image/") ||
        type.startsWith("video/") ||
        type.startsWith("audio/") ||
        type === "text/plain" ||
        type === "application/pdf"
      ) {
        return false;
      }
      if (type === "application/epub+zip" || type.includes("epub")) {
        return true;
      }
      return type === "";
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isEpubDragEvent(e)) {
      setIsDragOver(true);
    } else {
      setIsDragOver(false);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.relatedTarget || (e.relatedTarget as HTMLElement).nodeName === "HTML") {
      setIsDragOver(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const epubFiles = files.filter(
        (f) => f.name.toLowerCase().endsWith(".epub") || f.type === "application/epub+zip"
      );
      if (epubFiles.length > 0) {
        handleUpload(epubFiles);
      }
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim()) return;
    setIsSendingFeedback(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: feedbackCategory,
          message: feedbackMessage,
          contact: feedbackContact,
          language,
        }),
      });

      if (res.ok) {
        showToast(t.feedbackSuccess, "success");
        setFeedbackMessage("");
        setFeedbackContact("");
        setShowFeedbackModal(false);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal mengirim feedback", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Terjadi kesalahan sistem saat mengirim feedback", "error");
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedFilteredBooks = useMemo(() => {
    return [...filteredBooks].sort((a, b) => {
      const { series: seriesA, volume: volA } = parseSeriesAndVolume(a.title);
      const { series: seriesB, volume: volB } = parseSeriesAndVolume(b.title);
      
      const seriesCompare = seriesA.localeCompare(seriesB, "ja");
      if (seriesCompare !== 0) return seriesCompare;
      
      if (volA === null && volB === null) return b.uploadedAt - a.uploadedAt;
      if (volA === null) return 1;
      if (volB === null) return -1;
      return volA - volB;
    });
  }, [filteredBooks]);

  const groupedShelves = useMemo(() => {
    if (viewMode === "grid" || searchQuery) return null;

    // Grouping by series
    const groups: Record<string, BookMeta[]> = {};
    for (const book of sortedFilteredBooks) {
      const { series } = parseSeriesAndVolume(book.title);
      const key = series.toLowerCase().trim();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(book);
    }

    const shelves: { seriesName: string; books: BookMeta[] }[] = [];

    for (const key of Object.keys(groups)) {
      const groupBooks = groups[key];
      const seriesName = parseSeriesAndVolume(groupBooks[0].title).series;
      shelves.push({ seriesName, books: groupBooks });
    }

    // Sort shelves alphabetically by series name
    shelves.sort((a, b) => a.seriesName.localeCompare(b.seriesName, "ja"));

    return { shelves };
  }, [sortedFilteredBooks, viewMode, searchQuery]);

  return (
    <div
      className={isTransitioning ? "kb-view-transitioning" : ""}
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--kb-bg)",
        color: "var(--kb-text)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ===== Loading / Intro Spinner ===== */}
      {isLoading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--kb-bg)",
            transition: "opacity 0.5s ease, visibility 0.5s ease",
            opacity: isIntroAnimating ? 1 : 0,
            visibility: isIntroAnimating ? "visible" : "hidden",
          }}
          onAnimationEnd={() => {
            // After intro animation completes, fade out loader
            setIsIntroAnimating(false);
            setTimeout(() => {
              // Keep loader visible but hidden until isLoading becomes false
            }, 500);
          }}
        >
          <div
            style={{
              position: "relative",
              width: "120px",
              height: "120px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Outer rotating ring */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                border: "4px solid rgba(99,102,241,0.2)",
                borderTopColor: "var(--kb-primary)",
                animation: "spin 1.5s linear infinite",
              }}
            />
            {/* Inner icon */}
            <Image
              src="/icon.png"
              alt="Loading"
              width={60}
              height={60}
              priority
              style={{
                objectFit: "contain",
                animation: "pulse 2s ease-in-out infinite",
                position: "relative",
                zIndex: 2,
              }}
            />
          </div>
          
          {/* Loading text */}
          <div
            style={{
              position: "absolute",
              bottom: "-40px",
              color: "var(--kb-text-secondary)",
              fontSize: "14px",
              fontWeight: 500,
              animation: "fadeIn 0.5s ease 0.3s forwards",
              opacity: 0,
            }}
          >
            {language === "ID" ? "Memuat..." : "Loading..."}
          </div>
        </div>
      )}

      {/* ===== Header ===== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          width: "100%",
          backgroundColor: "var(--kb-toolbar-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--kb-border)",
        }}
      >
        <div
          className="kb-header-inner"
          style={{
            maxWidth: "1320px",
            margin: "0 auto",
            height: "70px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
          }}
        >
          {/* Mobile Hamburger Button (Left side on Mobile) */}
          <button
            className="kb-mobile-hamburger-btn"
            onClick={() => {
              if (isMobileMenuOpen) {
                closeMobileMenu();
              } else {
                openMobileMenu();
              }
            }}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "var(--kb-bg-secondary)",
              border: "1px solid var(--kb-border)",
              color: "var(--kb-text)",
              cursor: "pointer",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Menu Pengaturan"
          >
            {isMobileMenuOpen ? <X style={{ width: "20px", height: "20px" }} /> : <Menu style={{ width: "20px", height: "20px" }} />}
          </button>

          {/* Logo */}
          <div
            className="kb-logo-container"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
            }}
            onClick={() => router.push("/")}
          >
            <img
              src="/icon.png"
              alt="Kotori"
              style={{
                width: "36px",
                height: "36px",
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
            <div>
              <h1 style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Kotori
              </h1>
              <p className="kb-logo-subtitle" style={{ fontSize: "12px", fontWeight: 500, color: "var(--kb-text-muted)", marginTop: "1px" }}>
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* Search Input (Desktop view in center, mobile view on line 2) */}
          <div className="kb-search-container" style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              style={{
                position: "absolute",
                left: "14px",
                width: "16px",
                height: "16px",
                color: "var(--kb-text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="kb-search-input"
              style={{
                height: "40px",
                width: "240px",
                paddingLeft: "42px",
                paddingRight: "16px",
                fontSize: "13px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border)",
                color: "var(--kb-text)",
                borderRadius: "12px",
                outline: "none",
                transition: "all 0.2s ease",
              }}
            />
          </div>

          {/* Desktop Right side controls */}
          <div
            className="kb-desktop-controls"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            {/* Dictionary Search Button */}
            <button
              onClick={() => setShowDictionarySearch(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "12px",
                backgroundColor: "var(--kb-bg-secondary)",
                color: "var(--kb-text)",
                border: "1px solid var(--kb-border)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)")}
              title={language === "ID" ? "Cari Kamus" : "Dictionary Search"}
            >
              <Search style={{ width: "16px", height: "16px" }} />
            </button>

            {/* Feedback Button */}
            <button
              onClick={() => setShowFeedbackModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 700,
                borderRadius: "12px",
                backgroundColor: "var(--kb-primary-light)",
                color: "var(--kb-primary)",
                border: "1px solid rgba(99,102,241,0.2)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--kb-primary)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--kb-primary-light)";
                e.currentTarget.style.color = "var(--kb-primary)";
              }}
              title={t.feedbackBtn}
            >
              <Sparkles style={{ width: "15px", height: "15px" }} />
              <span>{t.feedbackBtn}</span>
            </button>

            {/* Language Switcher (ID / EN) */}
            <div
              className="kb-lang-switcher"
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border)",
                borderRadius: "12px",
                padding: "3px",
                gap: "2px",
              }}
            >
              {(["ID", "EN"] as const).map((lang) => {
                const isActive = language === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    style={{
                      padding: "5px 10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      borderRadius: "8px",
                      backgroundColor: isActive ? "var(--kb-primary)" : "transparent",
                      color: isActive ? "#ffffff" : "var(--kb-text-secondary)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.15)" : "none",
                    }}
                    title={`Ganti bahasa ke ${lang}`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border)",
                color: "var(--kb-text-secondary)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "all 0.2s ease",
              }}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun style={{ width: "18px", height: "18px" }} />
              ) : (
                <Moon style={{ width: "18px", height: "18px" }} />
              )}
            </button>

            {/* View mode toggle */}
            <button
              onClick={() => {
                changeViewMode(viewMode === "shelf" ? "grid" : "shelf");
              }}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border)",
                color: "var(--kb-text-secondary)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "all 0.2s ease",
              }}
              title={viewMode === "shelf" ? (language === "ID" ? "Ganti ke tampilan grid" : "Switch to grid view") : (language === "ID" ? "Ganti ke tampilan rak" : "Switch to bookshelf view")}
            >
              {viewMode === "shelf" ? (
                <LayoutGrid style={{ width: "18px", height: "18px" }} />
              ) : (
                <Library style={{ width: "18px", height: "18px" }} />
              )}
            </button>

            {/* Add Book Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: "40px",
                paddingLeft: "16px",
                paddingRight: "16px",
                backgroundColor: "var(--kb-primary)",
                color: "white",
                fontSize: "14px",
                fontWeight: 700,
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
                transition: "all 0.2s ease",
              }}
            >
              <Plus style={{ width: "16px", height: "16px", strokeWidth: 2.5 }} />
              <span className="kb-add-button-text">{t.addBook}</span>
            </button>
          </div>

          {/* Mobile Right Action Button (+ Add Book) */}
          <button
            className="kb-mobile-add-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              backgroundColor: "var(--kb-primary)",
              color: "white",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
              flexShrink: 0,
            }}
            title={t.addBook}
          >
            <Plus style={{ width: "20px", height: "20px", strokeWidth: 2.5 }} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            multiple
            onChange={(e) => {
              if (e.target.files) handleUpload(e.target.files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </div>
      </header>

      {/* ===== Mobile Slide-Over Drawer (Slide from Left + Backdrop Blur) ===== */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
              backgroundColor: isMenuAnimating ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0)",
              backdropFilter: isMenuAnimating ? "blur(6px)" : "blur(0px)",
              WebkitBackdropFilter: isMenuAnimating ? "blur(6px)" : "blur(0px)",
              transition: "all 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onClick={closeMobileMenu}
          />

          {/* Slide-over Drawer Panel */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "290px",
              maxWidth: "80vw",
              zIndex: 100,
              backgroundColor: "var(--kb-surface)",
              borderRight: "1px solid var(--kb-border)",
              boxShadow: isMenuAnimating ? "8px 0 32px rgba(0,0,0,0.3)" : "none",
              display: "flex",
              flexDirection: "column",
              padding: "24px 20px",
              gap: "24px",
              overflowY: "auto",
              transform: isMenuAnimating ? "translateX(0)" : "translateX(-100%)",
              opacity: isMenuAnimating ? 1 : 0,
              transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease",
            }}
          >
            {/* Drawer Header (Logo + Close Button) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: "16px",
                borderBottom: "1px solid var(--kb-border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img
                  src="/icon.png"
                  alt="Kotori"
                  style={{
                    width: "32px",
                    height: "32px",
                    objectFit: "contain",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--kb-text)" }}>
                  Kotori
                </span>
              </div>

              <button
                onClick={closeMobileMenu}
                aria-label={language === "ID" ? "Tutup Menu" : "Close Menu"}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "var(--kb-bg-secondary)",
                  border: "1px solid var(--kb-border-subtle)",
                  color: "var(--kb-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>

            {/* Menu Sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Dictionary Search Action */}
              <button
                onClick={() => {
                  setShowDictionarySearch(true);
                  closeMobileMenu();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  backgroundColor: "var(--kb-bg-secondary)",
                  border: "1px solid var(--kb-border)",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--kb-text)",
                  cursor: "pointer",
                }}
              >
                <Search style={{ width: "18px", height: "18px", color: "var(--kb-primary)" }} />
                <span>{language === "ID" ? "Cari Kamus" : "Dictionary Search"}</span>
              </button>

              {/* Bahasa Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--kb-text-secondary)", textTransform: "uppercase" }}>
                  {t.languageLabel}
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "var(--kb-bg-secondary)",
                    border: "1px solid var(--kb-border)",
                    borderRadius: "12px",
                    padding: "4px",
                    gap: "4px",
                  }}
                >
                  {(["ID", "EN"] as const).map((lang) => {
                    const isActive = language === lang;
                    return (
                      <button
                        key={lang}
                        onClick={() => handleLanguageChange(lang)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          fontSize: "13px",
                          fontWeight: 800,
                          borderRadius: "8px",
                          backgroundColor: isActive ? "var(--kb-primary)" : "transparent",
                          color: isActive ? "#ffffff" : "var(--kb-text-secondary)",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          textAlign: "center",
                        }}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Tema Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--kb-text-secondary)", textTransform: "uppercase" }}>
                  {t.themeLabel}
                </label>
                <button
                  onClick={toggleTheme}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    backgroundColor: "var(--kb-bg-secondary)",
                    border: "1px solid var(--kb-border)",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--kb-text)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {theme === "dark" ? (
                      <Sun style={{ width: "18px", height: "18px", color: "#eab308" }} />
                    ) : (
                      <Moon style={{ width: "18px", height: "18px", color: "#6366f1" }} />
                    )}
                    <span>{theme === "dark" ? t.themeLight : t.themeDark}</span>
                  </div>
                </button>
              </div>

              {/* Tampilan Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--kb-text-secondary)", textTransform: "uppercase" }}>
                  {language === "ID" ? "Tampilan Perpustakaan" : "Library View"}
                </label>
                <button
                  onClick={() => {
                    changeViewMode(viewMode === "shelf" ? "grid" : "shelf");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    backgroundColor: "var(--kb-bg-secondary)",
                    border: "1px solid var(--kb-border)",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--kb-text)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {viewMode === "shelf" ? (
                      <>
                        <LayoutGrid style={{ width: "18px", height: "18px", color: "var(--kb-primary)" }} />
                        <span>{language === "ID" ? "Ganti ke Grid" : "Switch to Grid"}</span>
                      </>
                    ) : (
                      <>
                        <Library style={{ width: "18px", height: "18px", color: "var(--kb-primary)" }} />
                        <span>{language === "ID" ? "Ganti ke Rak Buku" : "Switch to Bookshelf"}</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Main Content ===== */}
      <main
        className="kb-main-container"
        style={{
          flex: 1,
          maxWidth: "1320px",
          width: "100%",
          margin: "0 auto",
          padding: "36px 32px 64px 32px",
        }}
      >
        {/* Drag & Drop Overlay */}
        {isDragOver && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              backgroundColor: "rgba(99, 102, 241, 0.9)",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              gap: "16px",
            }}
          >
            <Upload style={{ width: "64px", height: "64px" }} />
            <h2 style={{ fontSize: "24px", fontWeight: 800 }}>Drop EPUB File Here</h2>
          </div>
        )}

        {/* Uploading Status Overlay */}
        {isUploading && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--kb-surface)",
                borderRadius: "20px",
                padding: "32px 24px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
                maxWidth: "380px",
                width: "100%",
                boxSizing: "border-box",
                animation: "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  border: "4px solid var(--kb-border)",
                  borderTopColor: "var(--kb-primary)",
                }}
                className="animate-spin"
              />
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--kb-text)",
                  textAlign: "center",
                  margin: 0,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  lineHeight: 1.5,
                }}
              >
                {uploadProgress || "Processing novel..."}
              </p>
            </div>
          </div>
        )}

        {/* Toast Notification Stack */}
        {toasts.length > 0 && (
          <div className="kb-toast-stack">
            {toasts.map((toastItem) => (
              <div
                key={toastItem.id}
                className="kb-toast"
                style={{
                  animation: toastItem.animatingOut
                    ? "toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                    : "toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                {toastItem.type === "success" && (
                  <CheckCircle2 style={{ width: "18px", height: "18px", color: "#3b82f6", flexShrink: 0 }} />
                )}
                {toastItem.type === "delete" && (
                  <Trash2 style={{ width: "18px", height: "18px", color: "#ef4444", flexShrink: 0 }} />
                )}
                {toastItem.type === "reset" && (
                  <RotateCcw style={{ width: "18px", height: "18px", color: "#64748b", flexShrink: 0 }} />
                )}
                {toastItem.type === "error" && (
                  <AlertTriangle style={{ width: "18px", height: "18px", color: "#f59e0b", flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, wordBreak: "break-word" }}>{toastItem.message}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissToast(toastItem.id);
                  }}
                  className="kb-toast-close"
                  title="Close notification"
                >
                  <X style={{ width: "14px", height: "14px", strokeWidth: 2 }} />
                </button>

                {/* Bottom Progress Loading Bar */}
                <div
                  className="kb-toast-progress"
                  style={{
                    backgroundColor:
                      toastItem.type === "success"
                        ? "#3b82f6"
                        : toastItem.type === "delete"
                        ? "#ef4444"
                        : toastItem.type === "reset"
                        ? "#64748b"
                        : "#facc15",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div
            style={{
              minHeight: "50vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "3px solid var(--kb-border)",
                borderTopColor: "var(--kb-primary)",
              }}
              className="animate-spin"
            />
          </div>
        )}

        {/* Empty State (No Books Uploaded Yet) */}
        {!isLoading && books.length === 0 && (
          <RevealSection className="kb-reveal-up">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              minHeight: "60vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "24px",
              border: "2px dashed var(--kb-border)",
              backgroundColor: "var(--kb-surface)",
              padding: "48px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "24px",
                backgroundColor: "var(--kb-primary-light)",
                color: "var(--kb-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              <Library style={{ width: "40px", height: "40px" }} />
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
              {t.noBooksYet}
            </h2>
            <p style={{ fontSize: "14px", color: "var(--kb-text-secondary)", maxWidth: "420px", lineHeight: 1.6, marginBottom: "8px" }}>
              {t.noBooksDesc}
            </p>
            <p style={{ fontSize: "13px", color: "var(--kb-text-secondary)", maxWidth: "440px", lineHeight: 1.6, marginBottom: "24px" }}>
              <span>{t.noBooksHintEmpty}</span>
              <a
                href="https://en.zlib.bz"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  color: "var(--kb-primary)",
                  fontWeight: 600,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                en.zlib.bz
              </a>
            </p>
            <button
              style={{
                padding: "12px 24px",
                backgroundColor: "var(--kb-primary)",
                color: "white",
                fontSize: "14px",
                fontWeight: 700,
                borderRadius: "14px",
                border: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}
            >
              <Plus style={{ width: "18px", height: "18px" }} />
              <span>{t.addBook}</span>
            </button>
          </div>
          </RevealSection>
        )}

        {/* Book Grid Area */}
        {!isLoading && books.length > 0 && filteredBooks.length > 0 && (
          <>
            <RevealSection>
            <div
              style={{
                marginBottom: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.01em" }}>
                  {searchQuery ? (language === "ID" ? "Hasil Pencarian" : "Search Results") : t.libraryTitle}
                </h2>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--kb-text-muted)", marginTop: "2px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px" }}>
                  <span>{filteredBooks.length} {language === "ID" ? "novel tersedia" : filteredBooks.length === 1 ? "novel available" : "novels available"}</span>
                  <span style={{ margin: "0 4px", opacity: 0.4 }}>•</span>
                  <Sparkles style={{ width: "13px", height: "13px", color: "var(--kb-primary)", display: "inline-block" }} />
                  <span style={{ color: "var(--kb-text-secondary)", fontWeight: 400 }}>{t.noBooksHintList}</span>
                  <a
                    href="https://en.zlib.bz"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--kb-primary)",
                      fontWeight: 600,
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    en.zlib.bz
                  </a>
                </p>
              </div>
            </div>
            </RevealSection>

            {groupedShelves ? (
              /* Bookshelf View */
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {/* Visual Series Shelves */}
                {groupedShelves.shelves.map((shelf, shelfIdx) => (
                  <RevealSection key={shelf.seriesName} className="kb-reveal-left" delay={shelfIdx * 100}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", paddingLeft: "4px" }}>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--kb-text)" }}>
                        {shelf.seriesName}
                      </h3>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--kb-text-muted)" }}>
                        {shelf.books.length} {language === "ID" ? "Volume" : "Volumes"}
                      </span>
                    </div>
                    
                    {/* Visual Shelf Wrapper */}
                    <div style={{ position: "relative", paddingBottom: "16px" }}>
                      {/* Horizontal Scrolling Row */}
                      <div
                        style={{
                          display: "flex",
                          gap: "24px",
                          overflowX: "auto",
                          padding: "4px 4px 16px 4px",
                          scrollBehavior: "smooth",
                        }}
                        className="kb-shelf-row"
                      >
                        {shelf.books.map((book) => (
                          <div key={book.id} style={{ width: "190px", flexShrink: 0 }}>
                            <BookCard
                              book={book}
                              progress={progresses[book.id]}
                              onOpen={() => handleBookClick(book)}
                              onDelete={() => setDeleteConfirm(book.id)}
                              onResetProgress={() => setResetConfirm(book.id)}
                              t={t}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* Visual 3D Wood/Glass Shelf Bar */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "12px",
                          left: 0,
                          right: 0,
                          height: "8px",
                          borderRadius: "4px",
                          background: theme === "dark" 
                            ? "linear-gradient(to bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.05))" 
                            : "linear-gradient(to bottom, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.03))",
                          borderBottom: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(15, 23, 42, 0.06)",
                          boxShadow: theme === "dark" ? "0 4px 10px rgba(0, 0, 0, 0.3)" : "0 4px 8px rgba(0, 0, 0, 0.08)",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>
                  </RevealSection>
                ))}
              </div>
            ) : (
              /* Grid View (Standard Flat Grid) */
              <div
                className="kb-book-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "24px",
                  alignItems: "start",
                }}
              >
                {sortedFilteredBooks.map((book, bookIdx) => (
                  <RevealSection key={book.id} className="kb-reveal-scale" delay={bookIdx * 60}>
                  <BookCard
                    book={book}
                    progress={progresses[book.id]}
                    onOpen={() => handleBookClick(book)}
                    onDelete={() => setDeleteConfirm(book.id)}
                    onResetProgress={() => setResetConfirm(book.id)}
                    t={t}
                  />
                  </RevealSection>
                ))}
              </div>
            )}
          </>
        )}

        {/* No Search Results */}
        {!isLoading && books.length > 0 && filteredBooks.length === 0 && searchQuery && (
          <div
            style={{
              minHeight: "40vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <Search style={{ width: "48px", height: "48px", color: "var(--kb-text-muted)", marginBottom: "16px" }} />
            <p style={{ fontSize: "18px", fontWeight: 700 }}>{t.noMatchTitle}</p>
            <p style={{ fontSize: "14px", color: "var(--kb-text-muted)", marginTop: "4px" }}>
              {t.noMatchDesc(searchQuery)}
            </p>
          </div>
        )}
              </main>

      {/* ===== Community & Creator Banner ===== */}
      <RevealSection className="kb-reveal-up" style={{ width: "100%" }}>
              <section
                style={{
                  maxWidth: "1320px",
                  margin: "0 auto 0",
                  padding: "0 32px 48px",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    borderRadius: "24px",
                    padding: "40px 32px",
                    background: "linear-gradient(135deg, var(--kb-surface) 0%, rgba(99, 102, 241, 0.03) 100%)",
                    border: "1px solid rgba(99, 102, 241, 0.12)",
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.5)",
                  }}
                >
                  {/* Decorative background icon */}
                  <Sparkles 
                    style={{ 
                      position: "absolute", 
                      right: "-20px", 
                      top: "-20px", 
                      width: "120px", 
                      height: "120px", 
                      color: "var(--kb-primary)", 
                      opacity: 0.03,
                      pointerEvents: "none"
                    }} 
                  />
                  <Sparkles 
                    style={{ 
                      position: "absolute", 
                      left: "-20px", 
                      bottom: "-20px", 
                      width: "100px", 
                      height: "100px", 
                      color: "var(--kb-primary)", 
                      opacity: 0.02,
                      pointerEvents: "none"
                    }} 
                  />

                  <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "10px", color: "var(--kb-text)", letterSpacing: "-0.02em" }}>
                    {t.communityTitle}
                  </h3>
                  <p style={{ fontSize: "13.5px", color: "var(--kb-text-secondary)", lineHeight: 1.6, marginBottom: "28px", maxWidth: "560px", margin: "0 auto 28px" }}>
                    {t.communityDesc}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                    {/* Feedback Button */}
                    <button
                      onClick={() => setShowFeedbackModal(true)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        fontSize: "13.5px",
                        fontWeight: 750,
                        borderRadius: "14px",
                        backgroundColor: "var(--kb-primary)",
                        color: "#ffffff",
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 6px 20px -4px rgba(99,102,241,0.4)",
                        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; 
                        e.currentTarget.style.boxShadow = "0 10px 25px -4px rgba(99,102,241,0.5)"; 
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.transform = "none"; 
                        e.currentTarget.style.boxShadow = "0 6px 20px -4px rgba(99,102,241,0.4)"; 
                      }}
                    >
                      <MessageSquare style={{ width: "16px", height: "16px" }} />
                      {t.feedbackBtn}
                    </button>

                    {/* Social Media Links (Temporarily Commented Out)
                    <a
                      href="https://instagram.com/ka1sai"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        fontSize: "13.5px",
                        fontWeight: 750,
                        borderRadius: "14px",
                        backgroundColor: "var(--kb-bg-secondary)",
                        color: "var(--kb-text)",
                        border: "1px solid var(--kb-border)",
                        textDecoration: "none",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; 
                        e.currentTarget.style.borderColor = "#E4405F"; 
                        e.currentTarget.style.color = "#E4405F"; 
                        e.currentTarget.style.backgroundColor = "rgba(228, 64, 95, 0.04)";
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.transform = "none"; 
                        e.currentTarget.style.borderColor = "var(--kb-border)"; 
                        e.currentTarget.style.color = "var(--kb-text)"; 
                        e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)";
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      Instagram
                    </a>

                    <a
                      href="https://tiktok.com/@ka1sai"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 24px",
                        fontSize: "13.5px",
                        fontWeight: 750,
                        borderRadius: "14px",
                        backgroundColor: "var(--kb-bg-secondary)",
                        color: "var(--kb-text)",
                        border: "1px solid var(--kb-border)",
                        textDecoration: "none",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; 
                        e.currentTarget.style.borderColor = "var(--kb-text)"; 
                        e.currentTarget.style.backgroundColor = "var(--kb-border)";
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.transform = "none"; 
                        e.currentTarget.style.borderColor = "var(--kb-border)"; 
                        e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)";
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.7a8.16 8.16 0 0 0 4.76 1.51v-3.45c0-.01-1-0.07-1-0.07z"/></svg>
                      TikTok
                    </a>
                    */}
                  </div>
                </div>
              </section>
      </RevealSection>

              {/* Footer */}
              <RevealSection className="kb-reveal-up" delay={150} style={{ width: "100%" }}>
                <Footer language={language} />
              </RevealSection>

              {/* ===== Feedback Modal ===== */}
              <div
                className={`kb-feedback-overlay ${showFeedbackModal ? "kb-modal-active" : ""}`}
                onClick={() => setShowFeedbackModal(false)}
              >
                <div
                  className="kb-feedback-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close button */}
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    aria-label={language === "ID" ? "Tutup" : "Close"}
                    style={{
                      position: "absolute",
                      top: "18px",
                      right: "18px",
                      width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        border: "none",
                        backgroundColor: "var(--kb-bg-secondary)",
                        color: "var(--kb-text-secondary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--kb-border)";
                        e.currentTarget.style.color = "var(--kb-text)";
                        e.currentTarget.style.transform = "rotate(90deg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)";
                        e.currentTarget.style.color = "var(--kb-text-secondary)";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      <X style={{ width: "16px", height: "16px" }} />
                    </button>

                    {/* Title */}
                    <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px", color: "var(--kb-text)", paddingRight: "40px", letterSpacing: "-0.02em" }}>
                      {t.feedbackTitle}
                    </h2>
                    <p style={{ fontSize: "13px", color: "var(--kb-text-secondary)", lineHeight: 1.6, marginBottom: "24px" }}>
                      {t.feedbackDesc}
                    </p>

                    {/* Category selector */}
                    <div 
                      style={{ 
                        display: "flex", 
                        padding: "4px",
                        backgroundColor: "var(--kb-bg-secondary)",
                        borderRadius: "14px",
                        border: "1px solid var(--kb-border)",
                        gap: "2px", 
                        marginBottom: "20px" 
                      }}
                    >
                      {(["idea", "bug", "love"] as const).map((cat) => {
                        const label = cat === "bug" ? t.catBug : cat === "idea" ? t.catIdea : t.catLove;
                        const isActive = feedbackCategory === cat;
                        
                        // Icon selection based on category
                        let CategoryIcon = Sparkles;
                        if (cat === "bug") CategoryIcon = ShieldAlert;
                        if (cat === "love") CategoryIcon = Heart;

                        return (
                          <button
                            key={cat}
                            onClick={() => setFeedbackCategory(cat)}
                            className="kb-feedback-category-btn"
                            style={{
                              flex: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              padding: "8px 12px",
                              fontSize: "12px",
                              fontWeight: 750,
                              borderRadius: "10px",
                              border: "none",
                              backgroundColor: isActive ? "var(--kb-surface)" : "transparent",
                              color: isActive ? "var(--kb-primary)" : "var(--kb-text-secondary)",
                              boxShadow: isActive ? "0 2px 8px rgba(99,102,241,0.08), 0 1px 2px rgba(0,0,0,0.02)" : "none",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <CategoryIcon style={{ width: "13px", height: "13px", color: isActive ? "var(--kb-primary)" : "inherit" }} />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Message textarea */}
                    <textarea
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      placeholder={t.msgPlaceholder}
                      className="kb-premium-input"
                      style={{
                        width: "100%",
                        minHeight: "130px",
                        padding: "14px 16px",
                        fontSize: "13.5px",
                        lineHeight: 1.6,
                        borderRadius: "14px",
                        backgroundColor: "var(--kb-bg)",
                        color: "var(--kb-text)",
                        outline: "none",
                        resize: "none",
                        fontFamily: "inherit",
                        marginBottom: "14px",
                      }}
                    />

                    {/* Contact input */}
                    <input
                      type="text"
                      value={feedbackContact}
                      onChange={(e) => setFeedbackContact(e.target.value)}
                      placeholder={t.contactPlaceholder}
                      className="kb-premium-input"
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        fontSize: "13px",
                        borderRadius: "12px",
                        backgroundColor: "var(--kb-bg)",
                        color: "var(--kb-text)",
                        outline: "none",
                        marginBottom: "24px",
                        fontFamily: "inherit",
                      }}
                    />

                    {/* Send button */}
                    <button
                      onClick={handleSendFeedback}
                      disabled={isSendingFeedback || !feedbackMessage.trim()}
                      style={{
                        width: "100%",
                        padding: "14px",
                        fontSize: "14px",
                        fontWeight: 750,
                        borderRadius: "14px",
                        border: "none",
                        backgroundColor: isSendingFeedback || !feedbackMessage.trim() ? "var(--kb-bg-secondary)" : "var(--kb-primary)",
                        color: isSendingFeedback || !feedbackMessage.trim() ? "var(--kb-text-muted)" : "#ffffff",
                        cursor: isSendingFeedback || !feedbackMessage.trim() ? "not-allowed" : "pointer",
                        boxShadow: isSendingFeedback || !feedbackMessage.trim() ? "none" : "0 4px 16px rgba(99,102,241,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSendingFeedback && feedbackMessage.trim()) {
                          e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                          e.currentTarget.style.boxShadow = "0 6px 20px rgba(99,102,241,0.4)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = isSendingFeedback || !feedbackMessage.trim() ? "none" : "0 4px 16px rgba(99,102,241,0.3)";
                      }}
                    >
                      <Send style={{ width: "14px", height: "14px" }} />
                      <span>{isSendingFeedback ? t.sendingBtn : t.sendBtn}</span>
                    </button>
                  </div>
                </div>

              {/* Dictionary Search Modal */}
              <DictionarySearchModal
                isOpen={showDictionarySearch}
                onClose={() => setShowDictionarySearch(false)}
                language={language}
              />

              {/* Delete Confirmation Modal */}
      {deleteConfirm && (() => {
        const book = books.find((b) => b.id === deleteConfirm);
        const displayTitle = book ? truncate(book.title, 45) : "";
        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              backgroundColor: "var(--kb-overlay)",
              backdropFilter: "blur(6px)",
            }}
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "380px",
                borderRadius: "24px",
                padding: "28px",
                backgroundColor: "var(--kb-surface)",
                border: "1px solid var(--kb-border)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
                animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>{t.deleteConfirmTitle}</h3>
              <p style={{ fontSize: "14px", color: "var(--kb-text-secondary)", lineHeight: 1.5, marginBottom: "24px" }}>
                {t.deleteConfirmDescWithTitle(displayTitle)}
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    borderRadius: "12px",
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--kb-text-secondary)",
                    backgroundColor: "var(--kb-bg-secondary)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  style={{
                    borderRadius: "12px",
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "white",
                    backgroundColor: "var(--kb-danger)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t.delete}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reset Progress Confirmation Modal */}
      {resetConfirm && (() => {
        const book = books.find((b) => b.id === resetConfirm);
        const displayTitle = book ? truncate(book.title, 45) : "";
        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              backgroundColor: "var(--kb-overlay)",
              backdropFilter: "blur(6px)",
            }}
            onClick={() => setResetConfirm(null)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "380px",
                borderRadius: "24px",
                padding: "28px",
                backgroundColor: "var(--kb-surface)",
                border: "1px solid var(--kb-border)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
                animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>{t.resetConfirmTitle}</h3>
              <p style={{ fontSize: "14px", color: "var(--kb-text-secondary)", lineHeight: 1.5, marginBottom: "24px" }}>
                {t.resetConfirmDesc(displayTitle)}
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setResetConfirm(null)}
                  style={{
                    borderRadius: "12px",
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--kb-text-secondary)",
                    backgroundColor: "var(--kb-bg-secondary)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={() => handleResetProgress(resetConfirm)}
                  style={{
                    borderRadius: "12px",
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "white",
                    backgroundColor: "#64748b",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Book Preview Modal */}
      {previewBook && previewPhase !== "none" && (() => {
        const progress = progresses[previewBook.id];
        const progressPercent = progress
          ? Math.round(
              ((progress.chapterIndex + progress.scrollPosition) /
                Math.max(previewBook.totalChapters, 1)) *
                100
            )
          : 0;

        const hasProgress = progressPercent > 0;
        const lastReadChapter = progress
          ? `${language === "ID" ? "Bab" : "Chapter"} ${progress.chapterIndex + 1}`
          : null;

        const numFlips = progress ? Math.min(progress.chapterIndex, 10) : 0;

        // Dynamic book thickness scaled by total chapters (min 4px for short books, max 14px for thick books)
        const totalChapters = previewBook.totalChapters || 15;
        const maxThickness = Math.min(Math.max(Math.round(totalChapters * 0.35), 4), 14);
        
        const currentChapterIndex = progress ? progress.chapterIndex : 0;
        const readRatio = totalChapters > 0 ? Math.min(currentChapterIndex / totalChapters, 1) : 0;
        
        const isOpen = previewPhase === "opening" || previewPhase === "flipping" || previewPhase === "zooming";
        
        // Calculate left & right stack depth dynamically
        const leftStackDepth = isOpen ? Math.round(maxThickness * readRatio) : 0;
        const rightStackDepth = isOpen ? Math.max(maxThickness - leftStackDepth, 1) : maxThickness;

        // Multi-layered paper stack shadow generator (horizontal only to avoid top/bottom corner protrusions)
        const getPaperStackShadow = (depth: number, side: "right" | "left") => {
          if (depth <= 0) return "none";
          const layers: string[] = [];
          const sign = side === "right" ? 1 : -1;
          for (let d = 1; d <= depth; d++) {
            const color = d % 2 === 0 ? "#cbd5e1" : "#f8fafc";
            layers.push(`${d * sign}px 0px 0px ${color}`);
          }
          layers.push(`${(depth + 3) * sign}px 2px 12px rgba(0, 0, 0, 0.22)`);
          return layers.join(", ");
        };

        const getChapterMeta = (ch: Chapter | undefined, indexFallback: number) => {
          if (!ch) {
            return {
              title: `${language === "ID" ? "Bab" : "Chapter"} ${indexFallback + 1}`,
              heading: null as string | null,
              image: null as string | null,
              excerpt: null as string | null,
            };
          }

          const defaultTitle = `${language === "ID" ? "Bab" : "Chapter"} ${(ch.index ?? indexFallback) + 1}`;
          
          let title = ch.title && !/^Chapter \d+$/i.test(ch.title) && !/^Bab \d+$/i.test(ch.title)
            ? ch.title.trim()
            : defaultTitle;

          const rawText = ch.htmlContent
            ? ch.htmlContent
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
            : "";

          let heading: string | null = null;
          let bodyText = rawText;

          // Search for dash subheadings (e.g. ——九月四日—— or ―八月三十日―), Japanese chapter (e.g. 第11話), or special headers
          const dashMatch = rawText.match(/([―—–-]{1,4}[^-―—–\n]{1,40}[-―—–]{1,4})/);
          const jpMatch = rawText.match(/(第\s*[\d０-９一二三四五六七八九十百千]+\s*[話章節幕][^\n<]{0,60})/);
          const specialMatch = rawText.match(/(プロローグ|エピローグ|序章|終章|転章|幕間|あとがき|【[^】]+】)/);

          const matchedHeader = dashMatch?.[1] || jpMatch?.[1] || specialMatch?.[1];

          if (matchedHeader) {
            heading = matchedHeader.trim();
            const matchIdx = rawText.indexOf(matchedHeader);
            if (matchIdx !== -1) {
              bodyText = rawText.slice(matchIdx + matchedHeader.length).trim();
            }
          }

          const excerpt = bodyText ? (bodyText.length > 180 ? bodyText.slice(0, 180) + "..." : bodyText) : null;

          // Extract image: supports <img>, SVG <image xlink:href="...">, and <image href="...">
          let imgMatch = ch.htmlContent?.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
          if (!imgMatch) {
            imgMatch = ch.htmlContent?.match(/<image[^>]+(?:xlink:href|href)=["']([^"']+)["']/i);
          }
          if (!imgMatch && ch.htmlContent) {
            try {
              const parserDoc = new DOMParser().parseFromString(ch.htmlContent, "text/html");
              const imgEl = parserDoc.querySelector("img[src], image[xlink\\:href], image[href], svg image");
              if (imgEl) {
                const src = imgEl.getAttribute("src") || imgEl.getAttribute("xlink:href") || imgEl.getAttribute("href");
                if (src) {
                  imgMatch = [imgEl.outerHTML, src];
                }
              }
            } catch (e) {}
          }

          const image = imgMatch ? imgMatch[1] : null;

          return { title, heading, image, excerpt };
        };

        const targetChapterIndex = progress ? progress.chapterIndex : 0;
        const currentChapterMeta = getChapterMeta(previewChapter || previewChapters[targetChapterIndex], targetChapterIndex);
        const chapterTitle = currentChapterMeta.title;
        const chapterHeading = currentChapterMeta.heading;
        const chapterImgSrc = currentChapterMeta.image;
        const textPreview = currentChapterMeta.excerpt;

        const isActive = previewPhase !== "tucked" && previewPhase !== "zooming";

        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              maxWidth: "100vw",
              backgroundColor: isActive ? "rgba(15, 23, 42, 0.75)" : "rgba(15, 23, 42, 0)",
              backdropFilter: isActive ? "blur(12px)" : "blur(0px)",
              WebkitBackdropFilter: isActive ? "blur(12px)" : "blur(0px)",
              transition: "background-color 0.5s ease, backdrop-filter 0.5s ease, -webkit-backdrop-filter 0.5s ease",
            }}
            onClick={handleClosePreview}
          >
            {/* White Zoom Overlay */}
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "#ffffff",
                opacity: previewPhase === "zooming" ? 1 : 0,
                pointerEvents: "none",
                transition: "opacity 0.6s ease-in-out",
                zIndex: 320,
              }}
            />

            {/* Modal Container */}
            <div
              className={`kb-preview-container kb-preview-phase-${previewPhase}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Paper B (Preview Page) */}
              <div className="kb-preview-paper-b">
                <div>
                  <h4
                    style={{
                      fontSize: "15px",
                      fontWeight: 800,
                      color: "var(--kb-text)",
                      marginBottom: "6px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {previewBook.title}
                  </h4>
                  <p style={{ fontSize: "12px", color: "var(--kb-text-secondary)", marginBottom: "16px" }}>
                    {previewBook.author || t.unknownAuthor}
                  </p>

                  <div className="kb-preview-status-box" style={{ padding: "14px 16px", borderRadius: "14px", backgroundColor: "var(--kb-bg-secondary)", border: "1px solid var(--kb-border-subtle)", marginBottom: "22px", minHeight: "175px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <p style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--kb-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                          {chapterTitle}
                        </p>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", backgroundColor: "rgba(99,102,241,0.12)", color: "var(--kb-primary)", flexShrink: 0 }}>
                          {hasProgress ? `${progressPercent}%` : (language === "ID" ? "Baru" : "New")}
                        </span>
                      </div>

                      {chapterImgSrc ? (
                        isLandscapeImg ? (
                          /* Horizontal Landscape Image Layout (Maximized Clean Image) */
                          <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", paddingTop: "2px" }}>
                            <img
                              src={chapterImgSrc}
                              alt={chapterTitle}
                              onLoad={(e) => {
                                const img = e.currentTarget;
                                if (img.naturalWidth > img.naturalHeight) {
                                  setIsLandscapeImg(true);
                                }
                              }}
                              style={{
                                width: "100%",
                                maxHeight: "135px",
                                objectFit: "contain",
                                borderRadius: "8px",
                                border: "1px solid var(--kb-border-subtle)",
                              }}
                            />
                          </div>
                        ) : (
                          /* Vertical Portrait Image Layout (Side-by-Side) */
                          <div style={{ display: "flex", flexDirection: "row", gap: "12px", alignItems: "flex-start", width: "100%" }}>
                            <img
                              src={chapterImgSrc}
                              alt={chapterTitle}
                              onLoad={(e) => {
                                const img = e.currentTarget;
                                if (img.naturalWidth > img.naturalHeight) {
                                  setIsLandscapeImg(true);
                                }
                              }}
                              style={{ height: "135px", maxWidth: "85px", width: "auto", borderRadius: "6px", objectFit: "contain", flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                              {textPreview && (
                                <p className="kb-preview-excerpt-text" style={{ fontSize: "11px", color: "var(--kb-text-secondary)", lineHeight: 1.5, textAlign: "justify", display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "serif" }}>
                                  {textPreview}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {textPreview && (
                            <p className="kb-preview-excerpt-text" style={{ fontSize: "11px", color: "var(--kb-text-secondary)", lineHeight: 1.5, textAlign: "justify", display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "serif" }}>
                              {textPreview}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => startBookTransition(previewBook)}
                  style={{
                    width: "100%",
                    borderRadius: "14px",
                    padding: "12px 16px",
                    backgroundColor: "var(--kb-primary)",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
                    transition: "transform 0.15s ease, opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  <span>{hasProgress ? (language === "ID" ? "Lanjutkan Membaca" : "Continue Reading") : (language === "ID" ? "Mulai Membaca" : "Start Reading")}</span>
                </button>
              </div>

              {/* Book A */}
              <div className="kb-preview-book-a">
                {/* 3D Book Spine Wall (Left Edge) */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `-${maxThickness}px`,
                    width: `${maxThickness}px`,
                    background: "linear-gradient(to right, #0f172a 0%, #334155 45%, #1e293b 100%)",
                    transformOrigin: "right center",
                    transform: "rotateY(-90deg)",
                    borderRadius: "3px 0 0 3px",
                    boxShadow: "inset -2px 0 6px rgba(0,0,0,0.4)",
                    zIndex: 4,
                  }}
                />

                {/* Spine shadow overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: "10px",
                    background: "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 100%)",
                    zIndex: 4,
                    pointerEvents: "none",
                    borderRadius: "4px 0 0 4px",
                  }}
                />

                {/* Right Page (revealed when book cover flips open) */}
                <div
                  style={{
                    position: "absolute",
                    top: "3px",
                    bottom: "3px",
                    left: 0,
                    right: `${rightStackDepth + 2}px`,
                    backgroundColor: "#ffffff",
                    borderRadius: "0 8px 8px 0",
                    border: "1px solid #e2e8f0",
                    borderLeft: "none",
                    boxShadow: getPaperStackShadow(rightStackDepth, "right"),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 14px",
                    color: "#0f172a",
                    transform: isOpen ? "rotateY(2deg)" : "rotateY(0deg)",
                    transformOrigin: "left center",
                    backfaceVisibility: "hidden",
                    zIndex: 1,
                    overflow: "hidden",
                    transition: "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.6s cubic-bezier(0.25, 1, 0.5, 1), right 0.6s ease",
                  }}
                >
                  {/* Center Spine Gutter Shadow (Right Page) */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: "28px",
                      background: "linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 40%, transparent 100%)",
                      pointerEvents: "none",
                      zIndex: 3,
                    }}
                  />

                  <div style={{ width: "100%", textAlign: "center" }}>
                    <div style={{ width: "24px", height: "3px", backgroundColor: "var(--kb-primary)", margin: "0 auto 6px auto" }} />
                    <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--kb-primary)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {chapterTitle}
                    </p>
                  </div>

                  {chapterImgSrc ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", gap: "6px", margin: "4px 0" }}>
                      <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <img
                          src={chapterImgSrc}
                          alt={chapterTitle}
                          style={{
                            width: "100%",
                            maxHeight: (chapterHeading || textPreview) ? "150px" : "240px",
                            objectFit: "contain",
                            borderRadius: "6px",
                          }}
                        />
                      </div>

                      {(chapterHeading || textPreview) && (
                        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "3px" }}>
                          {chapterHeading && (
                            <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3, textAlign: "center" }}>
                              {chapterHeading}
                            </p>
                          )}
                          {textPreview && (
                            <p style={{ fontSize: "9.5px", color: "#334155", lineHeight: 1.45, textAlign: "justify", display: "-webkit-box", WebkitLineClamp: chapterHeading ? 3 : 5, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "serif" }}>
                              {textPreview}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ width: "100%", margin: "4px 0", display: "flex", flexDirection: "column" }}>
                      {chapterHeading && (
                        <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.35, marginBottom: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {chapterHeading}
                        </p>
                      )}
                      {textPreview && (
                        <p style={{ fontSize: "10.5px", color: "#334155", lineHeight: 1.5, textAlign: "justify", display: "-webkit-box", WebkitLineClamp: chapterHeading ? 4 : 6, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "serif" }}>
                          {textPreview}
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #cbd5e1", paddingTop: "4px", marginTop: "2px" }}>
                    <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 600 }}>Kotori</span>
                    <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 700 }}>
                      {hasProgress ? `${progressPercent}%` : "1"}
                    </span>
                  </div>
                </div>

                {/* Staggered Flipping Pages */}
                {Array.from({ length: numFlips }).map((_, i) => {
                  const delay = i * 90;
                  const isFlipped = previewPhase === "zooming" || previewPhase === "flipping";
                  
                  const pageChIndex = Math.max(0, targetChapterIndex - numFlips + i);
                  const pageMeta = getChapterMeta(previewChapters[pageChIndex], pageChIndex);

                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: "3px",
                        bottom: "3px",
                        left: 0,
                        right: `${rightStackDepth + 2}px`,
                        backgroundColor: "#ffffff",
                        borderRadius: "0 8px 8px 0",
                        border: "1px solid #e2e8f0",
                        borderLeft: "none",
                        transformOrigin: "left center",
                        transform: isFlipped ? "rotateY(-178deg)" : "rotateY(2deg)",
                        transition: "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
                        transitionDelay: `${delay}ms`,
                        transformStyle: "preserve-3d",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        zIndex: 3 + i,
                        boxShadow: isFlipped 
                          ? getPaperStackShadow(leftStackDepth, "left")
                          : "3px 3px 10px rgba(0,0,0,0.08)",
                        padding: "14px 12px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        overflow: "hidden",
                        color: "#0f172a",
                      }}
                    >
                      {/* Front side of page i */}
                      <div style={{ width: "100%", textAlign: "center" }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "var(--kb-primary)", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {pageMeta.title}
                        </p>
                      </div>

                      {pageMeta.image ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", gap: "4px", margin: "2px 0" }}>
                          <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <img
                              src={pageMeta.image}
                              alt={pageMeta.title}
                              style={{
                                width: "100%",
                                maxHeight: (pageMeta.heading || pageMeta.excerpt) ? "130px" : "210px",
                                objectFit: "contain",
                                borderRadius: "4px",
                              }}
                            />
                          </div>
                          {(pageMeta.heading || pageMeta.excerpt) && (
                            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "2px" }}>
                              {pageMeta.heading && (
                                <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.25, textAlign: "center" }}>
                                  {pageMeta.heading}
                                </p>
                              )}
                              {pageMeta.excerpt && (
                                <p style={{ fontSize: "9px", color: "#334155", lineHeight: 1.4, textAlign: "justify", display: "-webkit-box", WebkitLineClamp: pageMeta.heading ? 2 : 4, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "serif" }}>
                                  {pageMeta.excerpt}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: "100%", margin: "2px 0", display: "flex", flexDirection: "column", gap: "3px" }}>
                          {pageMeta.heading && (
                            <p style={{ fontSize: "10px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {pageMeta.heading}
                            </p>
                          )}
                          {pageMeta.excerpt && (
                            <p style={{ fontSize: "10px", color: "#334155", lineHeight: 1.45, textAlign: "justify", display: "-webkit-box", WebkitLineClamp: pageMeta.heading ? 3 : 5, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "serif" }}>
                              {pageMeta.excerpt}
                            </p>
                          )}
                        </div>
                      )}

                      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#94a3b8" }}>
                        <span>Kotori</span>
                        <span>{pageChIndex + 1}</span>
                      </div>

                      {/* Backside of page i */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundColor: "#ffffff",
                          borderRadius: "8px 0 0 8px",
                          border: "1px solid #e2e8f0",
                          borderRight: "none",
                          transform: "rotateY(180deg)",
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          zIndex: 1,
                          boxShadow: getPaperStackShadow(leftStackDepth, "left"),
                          padding: "14px 12px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          overflow: "hidden",
                          color: "#0f172a",
                        }}
                      >
                        <div style={{ width: "100%", textAlign: "center" }}>
                          <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "var(--kb-primary)", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {pageMeta.title}
                          </p>
                        </div>

                        {pageMeta.heading && (
                          <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {pageMeta.heading}
                          </p>
                        )}

                        {pageMeta.excerpt && (
                          <p style={{ fontSize: "9.5px", color: "#475569", lineHeight: 1.4, textAlign: "justify", display: "-webkit-box", WebkitLineClamp: pageMeta.heading ? 3 : 5, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "serif" }}>
                            {pageMeta.excerpt}
                          </p>
                        )}

                        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#94a3b8" }}>
                          <span>Kotori</span>
                          <span>{pageChIndex + 1}</span>
                        </div>

                        {/* Center Spine Gutter Shadow (Left Page Backside) */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            right: 0,
                            width: "28px",
                            background: "linear-gradient(to left, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 40%, transparent 100%)",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Left Page cover folder */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transformOrigin: "left center",
                    transform: 
                      previewPhase === "opening" || previewPhase === "zooming" || previewPhase === "flipping"
                        ? "rotateY(-178deg)"
                        : "rotateY(0deg)",
                    transition: "transform 1.0s cubic-bezier(0.25, 1, 0.5, 1)",
                    transformStyle: "preserve-3d",
                    zIndex: (previewPhase === "opening" || previewPhase === "flipping" || previewPhase === "zooming") ? 2 : 20,
                  }}
                >
                  {/* Cover front side */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: "var(--kb-surface)",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      borderRadius: "0 12px 12px 0",
                      overflow: "hidden",
                      boxShadow: "14px 14px 35px rgba(0,0,0,0.4), inset -3px 0 6px rgba(0,0,0,0.25)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "3px solid rgba(0,0,0,0.3)",
                      borderBottom: "2px solid rgba(0,0,0,0.2)",
                      zIndex: 2,
                    }}
                  >
                    {previewBook.coverUrl ? (
                      <img
                        src={previewBook.coverUrl}
                        alt={previewBook.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundColor: "#334155",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          padding: "20px",
                          textAlign: "center",
                          fontWeight: 700,
                        }}
                      >
                        {previewBook.title}
                      </div>
                    )}
                  </div>

                  {/* Left Inside Page ( revealed on flip ) */}
                  <div
                    style={{
                      position: "absolute",
                      top: "3px",
                      bottom: "3px",
                      left: 0,
                      right: `${leftStackDepth + 2}px`,
                      backgroundColor: "#ffffff",
                      borderRadius: "8px 0 0 8px",
                      border: "1px solid #e2e8f0",
                      borderRight: "none",
                      transform: "rotateY(180deg)",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      zIndex: 1,
                      boxShadow: getPaperStackShadow(leftStackDepth, "left"),
                      transition: "box-shadow 0.6s cubic-bezier(0.25, 1, 0.5, 1), right 0.6s ease",
                      overflow: "hidden",
                    }}
                  >
                    {/* Center Spine Gutter Shadow (Left Page) */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        right: 0,
                        width: "28px",
                        background: "linear-gradient(to left, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 40%, transparent 100%)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ===== Redesigned Book Card Component ===== */

function BookCard({
  book,
  progress,
  onOpen,
  onDelete,
  onResetProgress,
  t,
}: {
  book: BookMeta;
  progress: ReadingProgress | undefined;
  onOpen: () => void;
  onDelete: () => void;
  onResetProgress: () => void;
  t: (typeof TRANSLATIONS)["ID"];
}) {
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!showMenu) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".kb-dropdown-menu-wrapper")) {
        setShowMenu(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [showMenu]);

  const progressPercent = progress
    ? Math.round(
        ((progress.chapterIndex + progress.scrollPosition) /
          Math.max(book.totalChapters, 1)) *
          100
      )
    : 0;

  return (
    <div
      className="kb-book-card-animated"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "16px",
        overflow: "hidden",
        backgroundColor: "var(--kb-surface)",
        border: "1px solid var(--kb-border-subtle)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        cursor: "pointer",
        position: "relative",
        transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease",
        "--vt-name": `book-card-${book.id}`,
      } as React.CSSProperties}
      onClick={onOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = "var(--kb-primary-light)";
        e.currentTarget.style.boxShadow = "0 16px 36px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.borderColor = "var(--kb-border-subtle)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
      }}
    >
      {/* Cover Image Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "2/3",
          overflow: "hidden",
          backgroundColor: "var(--kb-bg-secondary)",
        }}
      >
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "16px",
                backgroundColor: "var(--kb-surface)",
                color: "var(--kb-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText style={{ width: "24px", height: "24px" }} />
            </div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                lineHeight: 1.4,
                color: "var(--kb-text-secondary)",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {book.title}
            </span>
          </div>
        )}

        {/* Top Left Pill Badge */}
        <div style={{ position: "absolute", left: "12px", top: "12px", zIndex: 10 }}>
          <span
            style={{
              borderRadius: "20px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "#ffffff",
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              display: "inline-block",
            }}
          >
            {t.chaptersCount(book.totalChapters)}
          </span>
        </div>

        {/* Top Right Menu Button & Wrapper */}
        <div
          className="kb-dropdown-menu-wrapper"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            right: "12px",
            top: "12px",
            zIndex: 10,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            aria-label={t.optionsMenu}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "none",
              color: "#ffffff",
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.15s ease, backgroundColor 0.15s ease",
            }}
          >
            <MoreVertical style={{ width: "16px", height: "16px" }} />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "36px",
                zIndex: 20,
                minWidth: "160px",
                overflow: "hidden",
                borderRadius: "14px",
                backgroundColor: "var(--kb-surface)",
                border: "1px solid var(--kb-border)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setShowMenu(false); onOpen(); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--kb-text)",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <BookOpen style={{ width: "15px", height: "15px", color: "var(--kb-primary)" }} />
                {t.readNovel}
              </button>

              <button
                onClick={() => { setShowMenu(false); onResetProgress(); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--kb-text-secondary)",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <RotateCcw style={{ width: "15px", height: "15px", color: "var(--kb-text-secondary)" }} />
                {t.resetProgress}
              </button>

              <button
                onClick={() => { setShowMenu(false); onDelete(); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--kb-danger)",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Trash2 style={{ width: "15px", height: "15px" }} />
                {t.delete}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Reading Progress Bar */}
        {progressPercent > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "5px",
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                backgroundColor: "var(--kb-primary)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* Card Info Content */}
      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <h3
            className="kb-book-title"
            style={{
              fontSize: "14px",
              fontWeight: 700,
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "40px",
            }}
          >
            {book.title}
          </h3>
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--kb-text-secondary)",
            }}
          >
            <User style={{ width: "14px", height: "14px", flexShrink: 0, opacity: 0.7 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {book.author || t.unknownAuthor}
            </span>
          </div>
        </div>

        {/* Card Footer Metadata */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "12px",
            borderTop: "1px solid var(--kb-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            fontFamily: "monospace",
            color: "var(--kb-text-muted)",
          }}
        >
          <span>{formatFileSize(book.fileSize)}</span>
          <span
            style={{
              fontWeight: 700,
              color: progressPercent > 0 ? "var(--kb-primary)" : "var(--kb-text-muted)",
            }}
          >
            {progressPercent > 0 ? t.readProgress(progressPercent) : t.unread}
          </span>
        </div>
      </div>
    </div>
  );
}
