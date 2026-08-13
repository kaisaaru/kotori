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
  // Position where `query` begins within the original (possibly padded-chunk) request string -
  // used to re-locate the resolved word in the DOM for the scanned-word highlight overlay.
  focusedStart?: number;
  // Length of the raw surface-form text that matched at focusedStart - can differ from
  // `terms[0].expression.length` when the match came from deinflection (e.g. surface form
  // "食べさせられて" vs dictionary headword "食べる"). Used for accurate highlight width.
  focusedLength?: number;
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
  // Secondary cache keyed by the resolved primary term's expression, so a repeat tap on the
  // same word - even via a raw chunk string that differs slightly by cursor offset - can still
  // hit cache if that exact expression string is looked up again (e.g. a drag-selection of the
  // bare word, or a re-lookup triggered from within the popup itself).
  private expressionCache = new Map<string, LookupResult>();

  clearMemoryCache() {
    this.cache.clear();
    this.expressionCache.clear();
  }

  /**
   * Search dictionary via ultra-fast lightweight Server API.
   * `pos` is the click/hover point's offset within `text`, when `text` is a padded chunk
   * (not an exact selection) - it tells the server to resolve just the single word under
   * the cursor instead of every word segmented out of the whole chunk.
   */
  async lookup(text: string, pos?: number): Promise<LookupResult> {
    const cleanText = text.trim().substring(0, 50); // Enforce max 50 characters limit for 60 FPS speed
    if (!cleanText) {
      return { query: "", reading: "", terms: [], kanjiList: [], segmentedWords: [] };
    }

    const cacheKey = pos !== undefined ? `${cleanText}::${pos}` : cleanText;

    // Check LRU Cache (0ms instant)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    if (this.expressionCache.has(cleanText)) {
      return this.expressionCache.get(cleanText)!;
    }

    try {
      const url = pos !== undefined
        ? `/api/dictionary/lookup?q=${encodeURIComponent(cleanText)}&pos=${pos}`
        : `/api/dictionary/lookup?q=${encodeURIComponent(cleanText)}`;
      const res = await fetch(url);
      const data: LookupResult = await res.json();

      // Store in LRU Cache
      if (this.cache.size >= 50) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, data);

      const primaryExpression = data.terms[0]?.expression;
      if (primaryExpression && primaryExpression !== cleanText) {
        if (this.expressionCache.size >= 50) {
          const firstKey = this.expressionCache.keys().next().value;
          if (firstKey) this.expressionCache.delete(firstKey);
        }
        this.expressionCache.set(primaryExpression, data);
      }

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
