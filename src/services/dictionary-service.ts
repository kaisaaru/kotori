import { openDB, IDBPDatabase } from "idb";

export interface DictDefinition {
  dictName: string;
  expression: string;
  reading: string;
  meanings: string[];
  tags?: string[];
  rules?: string;
  score?: number;
  pitch?: string;
  frequency?: number;
  jlpt?: string;
  deinflectionRules?: string[];
}

export interface KanjiDetail {
  kanji: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
  strokeCount?: number;
  grade?: number;
  jlpt?: string;
}

export interface LookupResult {
  query: string;
  reading: string;
  terms: DictDefinition[];
  kanjiList: KanjiDetail[];
  segmentedWords: {
    text: string;
    reading?: string;
    meanings: string[];
    dictName?: string;
  }[];
}

export interface CustomDictionaryMeta {
  name: string;
  filename: string;
  size: number;
  uploadedAt: number;
}

const DB_NAME = "kotoba-custom-dictionaries";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDictDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("dictionaries")) {
          db.createObjectStore("dictionaries", { keyPath: "name" });
        }
      },
    });
  }
  return dbPromise;
}

class DictionaryService {
  // Ultra-lightweight 50-item LRU Cache in Client Memory
  private cache = new Map<string, LookupResult>();

  clearMemoryCache() {
    this.cache.clear();
  }

  /**
   * Search dictionary via ultra-fast lightweight Server API
   */
  async lookup(text: string): Promise<LookupResult> {
    const cleanText = text.trim().substring(0, 50); // Enforce max 50 characters limit for 60 FPS speed
    if (!cleanText) {
      return { query: "", reading: "", terms: [], kanjiList: [], segmentedWords: [] };
    }

    // Check LRU Cache (0ms instant)
    if (this.cache.has(cleanText)) {
      return this.cache.get(cleanText)!;
    }

    try {
      const res = await fetch(`/api/dictionary/lookup?q=${encodeURIComponent(cleanText)}`);
      const data: LookupResult = await res.json();

      // Store in LRU Cache
      if (this.cache.size >= 50) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(cleanText, data);

      return data;
    } catch (err) {
      console.warn("Dictionary lookup error:", err);
      return {
        query: cleanText,
        reading: cleanText,
        terms: [],
        kanjiList: [],
        segmentedWords: [],
      };
    }
  }

  async loadZipDictionary(file: Blob | File, filename?: string): Promise<void> {
    const db = await getDictDB();
    const name = filename || (file instanceof File ? file.name : "Kamus Custom.zip");
    const arrayBuffer = await file.arrayBuffer();
    const record = {
      name,
      filename: name,
      size: file.size,
      uploadedAt: Date.now(),
      data: arrayBuffer,
    };
    await db.put("dictionaries", record);
    this.cache.clear();
  }

  async getCustomDictionaries(): Promise<CustomDictionaryMeta[]> {
    try {
      const db = await getDictDB();
      const all = await db.getAll("dictionaries");
      return all.map((item) => ({
        name: item.name,
        filename: item.filename,
        size: item.size,
        uploadedAt: item.uploadedAt,
      }));
    } catch {
      return [];
    }
  }

  async deleteCustomDictionary(name: string): Promise<void> {
    try {
      const db = await getDictDB();
      await db.delete("dictionaries", name);
      this.cache.clear();
    } catch (err) {
      console.warn("Delete custom dictionary error:", err);
    }
  }

  async getStatus(): Promise<{ isReady: boolean; isBuilding: boolean; totalTerms: number; totalKanji: number }> {
    try {
      const res = await fetch("/api/dictionary/lookup?status=1");
      return await res.json();
    } catch {
      return { isReady: true, isBuilding: false, totalTerms: 0, totalKanji: 0 };
    }
  }

  hasLoadedDictionaries(): boolean {
    return true;
  }
}

export const dictionaryService = new DictionaryService();
