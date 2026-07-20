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

class DictionaryService {
  // Ultra-lightweight 50-item LRU Cache in Client Memory
  private cache = new Map<string, LookupResult>();

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

  hasLoadedDictionaries(): boolean {
    return true;
  }
}

export const dictionaryService = new DictionaryService();
