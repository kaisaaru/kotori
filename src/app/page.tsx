"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { parseEpub } from "@/services/epub-parser";
import {
  getAllBooks,
  saveBook,
  deleteBook,
  getProgress,
} from "@/services/book-storage";
import { formatFileSize, truncate } from "@/lib/utils";
import type { BookMeta, ReadingProgress } from "@/types/book";
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
    deleteConfirmDesc: "Apakah Anda yakin ingin menghapus buku ini dari perpustakaan lokal Anda? Kemajuan membaca yang tersimpan juga akan dihapus.",
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
    deleteConfirmDesc: "Are you sure you want to remove this book from your local library? Saved reading progress will also be deleted.",
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
    deleteConfirmDesc: "この本をライブラリから削除してもよろしいですか？保存された読書の進捗も削除されます。",
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
  },
};

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBooks();
    const savedTheme = localStorage.getItem("kotoba-theme") as "light" | "dark" | null;
    const t = savedTheme || "dark";
    setTheme(t as "light" | "dark");
    document.documentElement.setAttribute("data-theme", t);

    const savedLang = localStorage.getItem("kotoba-language") as "ID" | "EN" | "JP" | null;
    if (savedLang) setLanguage(savedLang);
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
    for (const file of epubFiles) {
      try {
        setUploadProgress(`Parsing "${file.name}"...`);
        const { book, chapters } = await parseEpub(file);
        setUploadProgress(`Saving "${book.title}"...`);
        await saveBook(book, chapters);
      } catch (error) {
        console.error(`Failed to parse ${file.name}:`, error);
        alert(`Failed to parse "${file.name}". Make sure it's a valid EPUB file.`);
      }
    }
    setIsUploading(false);
    setUploadProgress("");
    await loadBooks();
  }, []);

  const handleDelete = async (bookId: string) => {
    await deleteBook(bookId);
    setDeleteConfirm(null);
    await loadBooks();
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("kotoba-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
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
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                backgroundColor: "var(--kb-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
              }}
            >
              <BookOpen style={{ width: "20px", height: "20px" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Kotoba Reader
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
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "10px",
                    backgroundColor: "var(--kb-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                  }}
                >
                  <BookOpen style={{ width: "18px", height: "18px" }} />
                </div>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--kb-text)" }}>
                  Kotoba Reader
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
              backgroundColor: "var(--kb-overlay)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "4px solid var(--kb-primary-light)",
                borderTopColor: "var(--kb-primary)",
              }}
              className="animate-spin"
            />
            <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--kb-text)" }}>
              {uploadProgress || "Processing novel..."}
            </p>
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

            {/* Grid */}
            <div
              className="kb-book-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "24px",
              }}
            >
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  progress={progresses[book.id]}
                  onOpen={() => router.push(`/reader/${book.id}`)}
                  onDelete={() => setDeleteConfirm(book.id)}
                  t={t}
                />
              ))}
            </div>
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
      {deleteConfirm && (
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
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>{t.deleteConfirmTitle}</h3>
            <p style={{ fontSize: "14px", color: "var(--kb-text-secondary)", lineHeight: 1.5, marginBottom: "24px" }}>
              {t.deleteConfirmDesc}
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
      )}
    </div>
  );
}

/* ===== Redesigned Book Card Component ===== */

function BookCard({
  book,
  progress,
  onOpen,
  onDelete,
  t,
}: {
  book: BookMeta;
  progress: ReadingProgress | undefined;
  onOpen: () => void;
  onDelete: () => void;
  t: (typeof TRANSLATIONS)["ID"];
}) {
  const [showMenu, setShowMenu] = useState(false);

  const progressPercent = progress
    ? Math.round(
        ((progress.chapterIndex + progress.scrollPosition) /
          Math.max(book.totalChapters, 1)) *
          100
      )
    : 0;

  return (
    <div
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
      }}
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

        {/* Top Right Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          style={{
            position: "absolute",
            right: "12px",
            top: "12px",
            zIndex: 10,
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
              right: "10px",
              top: "46px",
              zIndex: 20,
              minWidth: "150px",
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
