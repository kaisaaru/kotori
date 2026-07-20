import { create } from "zustand";
import type { ReaderSettings, BookMeta, Chapter } from "@/types/book";
import { DEFAULT_READER_SETTINGS } from "@/types/book";

interface ReaderState {
  // Book data
  book: BookMeta | null;
  chapters: Chapter[];
  currentChapterIndex: number;

  // Settings
  settings: ReaderSettings;

  // UI state
  isSettingsOpen: boolean;
  isTocOpen: boolean;
  isFullscreen: boolean;
  showToolbar: boolean;

  // Scroll position
  scrollPosition: number;

  // Actions
  setBook: (book: BookMeta, chapters: Chapter[]) => void;
  setCurrentChapter: (index: number) => void;
  setSettings: (settings: Partial<ReaderSettings>) => void;
  setSettingsOpen: (open: boolean) => void;
  setTocOpen: (open: boolean) => void;
  toggleFullscreen: () => void;
  setShowToolbar: (show: boolean) => void;
  setScrollPosition: (position: number) => void;
  reset: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  book: null,
  chapters: [],
  currentChapterIndex: 0,
  settings: DEFAULT_READER_SETTINGS,
  isSettingsOpen: false,
  isTocOpen: false,
  isFullscreen: false,
  showToolbar: true,
  scrollPosition: 0,

  setBook: (book, chapters) =>
    set({ book, chapters, currentChapterIndex: 0, scrollPosition: 0 }),

  setCurrentChapter: (index) =>
    set({ currentChapterIndex: index, scrollPosition: 0 }),

  setSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setTocOpen: (open) => set({ isTocOpen: open }),

  toggleFullscreen: () =>
    set((state) => ({ isFullscreen: !state.isFullscreen })),

  setShowToolbar: (show) => set({ showToolbar: show }),
  setScrollPosition: (position) => set({ scrollPosition: position }),

  reset: () =>
    set({
      book: null,
      chapters: [],
      currentChapterIndex: 0,
      isSettingsOpen: false,
      isTocOpen: false,
      scrollPosition: 0,
    }),
}));
