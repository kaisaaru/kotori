"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { parseEpub } from "@/services/epub-parser";
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
import { Footer } from "@/components/Footer";

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
    resetProgress: "Reset Kemajuan",
    progressReset: (title: string) => `Kemajuan membaca "${title}" berhasil di-reset.`,
    resetConfirmTitle: "Reset Kemajuan Membaca",
    resetConfirmDesc: (title: string) => `Apakah Anda yakin ingin me-reset kemajuan membaca untuk novel "${title}"? Semua progres membaca Anda akan diulang dari awal.`,
    bookDeleted: (title: string) => `Novel "${title}" berhasil dihapus.`,
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
    resetProgress: "Reset Progress",
    progressReset: (title: string) => `Reading progress for "${title}" has been reset.`,
    resetConfirmTitle: "Reset Reading Progress",
    resetConfirmDesc: (title: string) => `Are you sure you want to reset the reading progress for the novel "${title}"? Your progress will start over from the beginning.`,
    bookDeleted: (title: string) => `Novel "${title}" was successfully deleted.`,
  },
  JP: {
    subtitle: "日本語小説リーダー",
    searchPlaceholder: "本や著者名を検索...",
    addBook: "本を追加",
    dragDropText: "ここにEPUBファイルをドラッグ＆ドロップ",
    browseFiles: "またはファイルを選択",
    libraryTitle: "ライブラリ",
    noBooksYet: "本がありません",
    noBooksDesc: "EPUBファイルをアップロードして読書を開始しましょう。",
    readNow: "読む",
    continueReading: "続きを読む",
    deleteConfirmTitle: "小説を削除",
    deleteConfirmDesc: "この小説を削除してもよろしいですか？",
    deleteConfirmDescWithTitle: (title: string) => `小説「${title}」をライブラリから削除してもよろしいですか？保存された読書の進捗も削除されます。`,
    cancel: "キャンセル",
    delete: "削除",
    noMatchTitle: "一致する小説が見つかりません",
    noMatchDesc: (query: string) => `"${query}" に一致する本がありません。別のキーワードで検索してください。`,
    languageLabel: "言語 / Language",
    themeLabel: "テーマモード / Theme",
    themeLight: "ライトモード",
    themeDark: "ダークモード",
    readNovel: "小説を読む",
    unknownAuthor: "作者不明",
    unread: "未読",
    readProgress: (percent: number) => `${percent}% 既読`,
    chaptersCount: (count: number) => `${count} 章`,
    bookExists: (title: string) => `小説「${title}」は既にライブラリに存在します。`,
    bookAdded: (title: string) => `小説「${title}」が追加されました！`,
    uploadReading: (filename: string) => `「${filename}」を読み込んでいます...`,
    uploadSaving: (title: string) => `「${title}」をライブラリに保存しています...`,
    resetProgress: "読書進捗をリセット",
    progressReset: (title: string) => `「${title}」の読書進捗がリセットされました。`,
    resetConfirmTitle: "読書進捗のリセット",
    resetConfirmDesc: (title: string) => `小説「${title}」の読書進捗をリセットしてもよろしいですか？すべての進捗が最初からやり直しになります。`,
    bookDeleted: (title: string) => `小説「${title}」が削除されました。`,
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
  const [language, setLanguage] = useState<"ID" | "EN" | "JP">("ID");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"shelf" | "grid">("shelf");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const [previewBook, setPreviewBook] = useState<BookMeta | null>(null);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);
  const [previewChapters, setPreviewChapters] = useState<Chapter[]>([]);
  const [previewPhase, setPreviewPhase] = useState<"none" | "idle" | "tucked" | "tucking" | "centering" | "opening" | "flipping" | "zooming">("none");
  const [isLandscapeImg, setIsLandscapeImg] = useState(false);

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

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "delete" | "reset";
  } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastAnimatingOut, setToastAnimatingOut] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismissToast = useCallback(() => {
    setToastAnimatingOut(true);
    setTimeout(() => {
      setToastVisible(false);
      setToast(null);
      setToastAnimatingOut(false);
    }, 300);
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" | "delete" | "reset" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    setToastVisible(true);
    setToastAnimatingOut(false);

    toastTimerRef.current = setTimeout(() => {
      dismissToast();
    }, 4000);
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadBooks();
    const savedTheme = localStorage.getItem("kotoba-theme") as "light" | "dark" | null;
    const t = savedTheme || "dark";
    setTheme(t as "light" | "dark");
    document.documentElement.setAttribute("data-theme", t);

    const savedLang = localStorage.getItem("kotoba-language") as "ID" | "EN" | "JP" | null;
    if (savedLang) setLanguage(savedLang);

    const savedViewMode = localStorage.getItem("kotoba-view-mode") as "shelf" | "grid" | null;
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  const handleLanguageChange = (lang: "ID" | "EN" | "JP") => {
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
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
            {/* Language Switcher (ID / EN / JP) */}
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
              {(["ID", "EN", "JP"] as const).map((lang) => {
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
              title={viewMode === "shelf" ? (language === "ID" ? "Ganti ke tampilan grid" : language === "JP" ? "グリッド表示へ" : "Switch to grid view") : (language === "ID" ? "Ganti ke tampilan rak" : language === "JP" ? "本棚表示へ" : "Switch to bookshelf view")}
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
                  {(["ID", "EN", "JP"] as const).map((lang) => {
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
                  {language === "ID" ? "Tampilan Perpustakaan" : language === "JP" ? "表示モード" : "Library View"}
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
                        <span>{language === "ID" ? "Ganti ke Grid" : language === "JP" ? "グリッド表示へ" : "Switch to Grid"}</span>
                      </>
                    ) : (
                      <>
                        <Library style={{ width: "18px", height: "18px", color: "var(--kb-primary)" }} />
                        <span>{language === "ID" ? "Ganti ke Rak Buku" : language === "JP" ? "本棚表示へ" : "Switch to Bookshelf"}</span>
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
                backgroundColor: "#ffffff",
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
                  border: "4px solid #f1f5f9",
                  borderTopColor: "var(--kb-primary)",
                }}
                className="animate-spin"
              />
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#334155",
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

        {/* Toast Notification */}
        {toastVisible && toast && (
          <div
            className="kb-toast"
            style={{
              animation: toastAnimatingOut
                ? "toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                : "toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            {toast.type === "success" && (
              <CheckCircle2 style={{ width: "18px", height: "18px", color: "#3b82f6", flexShrink: 0 }} />
            )}
            {toast.type === "delete" && (
              <Trash2 style={{ width: "18px", height: "18px", color: "#ef4444", flexShrink: 0 }} />
            )}
            {toast.type === "reset" && (
              <RotateCcw style={{ width: "18px", height: "18px", color: "#64748b", flexShrink: 0 }} />
            )}
            {toast.type === "error" && (
              <AlertTriangle style={{ width: "18px", height: "18px", color: "#f59e0b", flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, wordBreak: "break-word" }}>{toast.message}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast();
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
                  toast.type === "success"
                    ? "#3b82f6"
                    : toast.type === "delete"
                    ? "#ef4444"
                    : toast.type === "reset"
                    ? "#64748b"
                    : "#facc15",
              }}
            />
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
            <p style={{ fontSize: "14px", color: "var(--kb-text-secondary)", maxWidth: "400px", lineHeight: 1.6, marginBottom: "24px" }}>
              {t.noBooksDesc}
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
        )}

        {/* Book Grid Area */}
        {!isLoading && books.length > 0 && filteredBooks.length > 0 && (
          <>
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
                  {searchQuery ? (language === "ID" ? "Hasil Pencarian" : language === "JP" ? "検索結果" : "Search Results") : t.libraryTitle}
                </h2>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--kb-text-muted)", marginTop: "2px" }}>
                  {filteredBooks.length} {language === "ID" ? "novel tersedia" : language === "JP" ? "冊の小説" : filteredBooks.length === 1 ? "novel available" : "novels available"}
                </p>
              </div>
            </div>

            {groupedShelves ? (
              /* Bookshelf View */
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {/* Visual Series Shelves */}
                {groupedShelves.shelves.map((shelf) => (
                  <div key={shelf.seriesName} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", paddingLeft: "4px" }}>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--kb-text)" }}>
                        {shelf.seriesName}
                      </h3>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--kb-text-muted)" }}>
                        {shelf.books.length} {language === "ID" ? "Volume" : language === "JP" ? "巻" : "Volumes"}
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
                {sortedFilteredBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    progress={progresses[book.id]}
                    onOpen={() => handleBookClick(book)}
                    onDelete={() => setDeleteConfirm(book.id)}
                    onResetProgress={() => setResetConfirm(book.id)}
                    t={t}
                  />
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

      {/* Footer */}
      <Footer language={language} />

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
                  {language === "ID" ? "Reset" : language === "JP" ? "リセット" : "Reset"}
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
          ? `${language === "ID" ? "Bab" : language === "JP" ? "第" : "Chapter"} ${progress.chapterIndex + 1}`
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
              title: `${language === "ID" ? "Bab" : language === "JP" ? "第" : "Chapter"} ${indexFallback + 1}${language === "JP" ? "章" : ""}`,
              heading: null as string | null,
              image: null as string | null,
              excerpt: null as string | null,
            };
          }

          const defaultTitle = `${language === "ID" ? "Bab" : language === "JP" ? "第" : "Chapter"} ${(ch.index ?? indexFallback) + 1}${language === "JP" ? "章" : ""}`;
          
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
                          {hasProgress ? `${progressPercent}%` : (language === "ID" ? "Baru" : language === "JP" ? "未読" : "New")}
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
                  <span>{hasProgress ? (language === "ID" ? "Lanjutkan Membaca" : language === "JP" ? "読書を続ける" : "Continue Reading") : (language === "ID" ? "Mulai Membaca" : language === "JP" ? "読書を開始" : "Start Reading")}</span>
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
