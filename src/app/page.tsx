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
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBooks();
    const savedTheme = localStorage.getItem("kotoba-theme") as "light" | "dark" | null;
    const t = savedTheme || "dark";
    setTheme(t as "light" | "dark");
    document.documentElement.setAttribute("data-theme", t);
  }, []);

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
          {/* Logo */}
          <div
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
                Japanese Novel Reader
              </p>
            </div>
          </div>

          {/* Search Input (Moves to 2nd row on mobile) */}
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
              placeholder="Search books or authors..."
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

          {/* Right side controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
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
              <span className="kb-add-button-text">Add Book</span>
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
        </div>
      </header>

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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              backgroundColor: "var(--kb-overlay)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                borderRadius: "24px",
                border: "2px dashed var(--kb-primary)",
                padding: "64px",
                textAlign: "center",
                backgroundColor: "var(--kb-surface)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "20px",
                  backgroundColor: "var(--kb-primary-light)",
                  color: "var(--kb-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Upload style={{ width: "40px", height: "40px" }} />
              </div>
              <p style={{ fontSize: "24px", fontWeight: 800 }}>Drop EPUB novels here</p>
              <p style={{ fontSize: "14px", color: "var(--kb-text-muted)" }}>
                Release to immediately add your books to your personal library.
              </p>
            </div>
          </div>
        )}

        {/* Upload Banner */}
        {isUploading && (
          <div
            style={{
              marginBottom: "32px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              borderRadius: "16px",
              padding: "20px",
              backgroundColor: "var(--kb-surface)",
              border: "1px solid var(--kb-border)",
            }}
          >
            <div
              className="animate-spin"
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                border: "2px solid var(--kb-primary)",
                borderTopColor: "transparent",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>{uploadProgress}</span>
          </div>
        )}

        {/* Empty Library State */}
        {!isLoading && books.length === 0 && (
          <div
            style={{
              minHeight: "50vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "48px 16px",
            }}
          >
            <div
              style={{
                marginBottom: "24px",
                width: "96px",
                height: "96px",
                borderRadius: "24px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Library style={{ width: "48px", height: "48px", color: "var(--kb-text-muted)" }} />
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>
              Your Library is Empty
            </h2>
            <p
              style={{
                fontSize: "14px",
                maxWidth: "420px",
                color: "var(--kb-text-secondary)",
                lineHeight: 1.6,
                marginBottom: "32px",
              }}
            >
              Upload your Japanese EPUB novels to read with custom Japanese typography (縦書き), customizable themes, and progress tracking.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                borderRadius: "16px",
                padding: "14px 28px",
                fontSize: "14px",
                fontWeight: 700,
                color: "white",
                backgroundColor: "var(--kb-primary)",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}
            >
              <Upload style={{ width: "18px", height: "18px" }} />
              Upload First EPUB
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "32px",
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  borderRadius: "20px",
                  overflow: "hidden",
                  border: "1px solid var(--kb-border-subtle)",
                  backgroundColor: "var(--kb-surface)",
                }}
              >
                <div style={{ aspectRatio: "2/3", backgroundColor: "var(--kb-bg-secondary)" }} />
                <div style={{ padding: "16px" }}>
                  <div style={{ height: "16px", width: "80%", borderRadius: "8px", backgroundColor: "var(--kb-bg-secondary)", marginBottom: "8px" }} />
                  <div style={{ height: "12px", width: "50%", borderRadius: "6px", backgroundColor: "var(--kb-bg-secondary)" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Book Grid */}
        {!isLoading && filteredBooks.length > 0 && (
          <>
            {/* Header Section */}
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
                  {searchQuery ? "Search Results" : "My Novel Collection"}
                </h2>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--kb-text-muted)", marginTop: "2px" }}>
                  {filteredBooks.length} {filteredBooks.length === 1 ? "novel available" : "novels available"}
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
            <p style={{ fontSize: "18px", fontWeight: 700 }}>No matching novels found</p>
            <p style={{ fontSize: "14px", color: "var(--kb-text-muted)", marginTop: "4px" }}>
              No books match "{searchQuery}". Try searching for another keyword.
            </p>
          </div>
        )}
      </main>

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
            <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>Delete Novel</h3>
            <p style={{ fontSize: "14px", color: "var(--kb-text-secondary)", lineHeight: 1.5, marginBottom: "24px" }}>
              Are you sure you want to remove this book from your local library? Saved reading progress will also be deleted.
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
                Cancel
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
                Delete
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
}: {
  book: BookMeta;
  progress: ReadingProgress | undefined;
  onOpen: () => void;
  onDelete: () => void;
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
            {book.totalChapters} CH
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
              Read Novel
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
              Delete
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
              {book.author || "Unknown Author"}
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
            {progressPercent > 0 ? `${progressPercent}% Read` : "Unread"}
          </span>
        </div>
      </div>
    </div>
  );
}
