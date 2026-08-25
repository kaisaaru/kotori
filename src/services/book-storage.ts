import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BookMeta, Chapter, ReadingProgress, ReaderSettings } from "@/types/book";
import { DEFAULT_READER_SETTINGS, getSystemTheme } from "@/types/book";

interface KotobaDB extends DBSchema {
  books: {
    key: string;
    value: BookMeta;
    indexes: { "by-uploaded": number; "by-last-read": number };
  };
  chapters: {
    key: string;
    value: Chapter;
    indexes: { "by-book": string; "by-book-index": [string, number] };
  };
  progress: {
    key: string; // bookId
    value: ReadingProgress;
  };
  settings: {
    key: string;
    value: ReaderSettings;
  };
}

const DB_NAME = "kotoba-reader";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<KotobaDB> | null = null;

async function getDB(): Promise<IDBPDatabase<KotobaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<KotobaDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Books store
      const bookStore = db.createObjectStore("books", { keyPath: "id" });
      bookStore.createIndex("by-uploaded", "uploadedAt");
      bookStore.createIndex("by-last-read", "lastReadAt");

      // Chapters store
      const chapterStore = db.createObjectStore("chapters", { keyPath: "id" });
      chapterStore.createIndex("by-book", "bookId");
      chapterStore.createIndex("by-book-index", ["bookId", "index"]);

      // Progress store
      db.createObjectStore("progress", { keyPath: "bookId" });

      // Settings store
      db.createObjectStore("settings");
    },
  });

  return dbInstance;
}

// ===== Books =====

export async function saveBook(book: BookMeta, chapters: Chapter[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["books", "chapters"], "readwrite");
  await tx.objectStore("books").put(book);
  
  const chapterStore = tx.objectStore("chapters");
  await Promise.all(chapters.map((ch) => chapterStore.put(ch)));
  
  await tx.done;
}

export async function getAllBooks(): Promise<BookMeta[]> {
  const db = await getDB();
  const books = await db.getAllFromIndex("books", "by-uploaded");
  return books.reverse(); // newest first
}

export async function getBook(id: string): Promise<BookMeta | undefined> {
  const db = await getDB();
  return db.get("books", id);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["books", "chapters", "progress"], "readwrite");

  // Delete all chapters for this book
  const chapterIndex = tx.objectStore("chapters").index("by-book");
  let cursor = await chapterIndex.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  // Delete progress
  await tx.objectStore("progress").delete(id);

  // Delete book
  await tx.objectStore("books").delete(id);

  await tx.done;

  // Drop the synchronous mirror too, otherwise re-importing the same book would resurrect a
  // reading position from a copy the user already deleted.
  clearProgressMirror(id);
}

export async function updateBookLastRead(id: string): Promise<void> {
  const db = await getDB();
  const book = await db.get("books", id);
  if (book) {
    book.lastReadAt = Date.now();
    await db.put("books", book);
  }
}

// ===== Chapters =====

export async function getChapters(bookId: string): Promise<Chapter[]> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex("chapters", "by-book", bookId);
  return chapters.sort((a, b) => a.index - b.index);
}

export async function getChapter(
  bookId: string,
  index: number
): Promise<Chapter | undefined> {
  const db = await getDB();
  return db.getFromIndex("chapters", "by-book-index", [bookId, index]);
}

// ===== Reading Progress =====

const PROGRESS_MIRROR_PREFIX = "kotoba-progress:";

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  const db = await getDB();
  await db.put("progress", progress);
}

// IndexedDB writes are async, so a save fired from pagehide/visibilitychange can be discarded when
// the browser tears the page down mid-transaction - losing the reader's last position on an abrupt
// tab close. localStorage commits synchronously, so mirroring there makes that final save durable.
// IndexedDB stays the primary store; this is only the last-moment safety net.
export function saveProgressSync(progress: ReadingProgress): void {
  try {
    localStorage.setItem(
      PROGRESS_MIRROR_PREFIX + progress.bookId,
      JSON.stringify(progress)
    );
  } catch {
    // Quota / private-mode failures must never interrupt reading.
  }
}

function clearProgressMirror(bookId: string): void {
  try {
    localStorage.removeItem(PROGRESS_MIRROR_PREFIX + bookId);
  } catch {
    // Ignore - a stale mirror is harmless next to a deleted book.
  }
}

export async function getProgress(
  bookId: string
): Promise<ReadingProgress | undefined> {
  const db = await getDB();
  const stored = await db.get("progress", bookId);

  let mirrored: ReadingProgress | undefined;
  try {
    const raw = localStorage.getItem(PROGRESS_MIRROR_PREFIX + bookId);
    if (raw) mirrored = JSON.parse(raw) as ReadingProgress;
  } catch {
    mirrored = undefined;
  }

  if (!mirrored) return stored;
  if (!stored) return mirrored;
  // The mirror is newer exactly when the async IndexedDB write lost the race with page teardown.
  return mirrored.lastReadAt > stored.lastReadAt ? mirrored : stored;
}

export async function deleteProgress(bookId: string): Promise<void> {
  const db = await getDB();
  await db.delete("progress", bookId);
  clearProgressMirror(bookId);
}

// ===== Settings =====

export async function saveSettings(settings: ReaderSettings): Promise<void> {
  const db = await getDB();
  await db.put("settings", settings, "reader");
}

export async function getSettings(): Promise<ReaderSettings> {
  const db = await getDB();
  const settings = await db.get("settings", "reader");
  if (!settings) {
    return { ...DEFAULT_READER_SETTINGS, theme: getSystemTheme() };
  }
  // Merge over defaults rather than returning the saved record as-is, so a settings object saved
  // before a newer ReaderSettings field existed doesn't leave that field undefined.
  return { ...DEFAULT_READER_SETTINGS, ...settings };
}
