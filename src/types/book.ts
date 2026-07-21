export interface BookMeta {
  id: string;
  title: string;
  author: string;
  language: string;
  coverUrl: string | null;
  fileSize: number;
  totalChapters: number;
  uploadedAt: number; // timestamp
  lastReadAt: number | null;
}

export interface Chapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  htmlContent: string;
  href?: string;
}

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  scrollPosition: number; // 0–1 percentage
  lastReadAt: number;
}

export interface ReaderSettings {
  writingMode: "horizontal" | "vertical";
  theme: "light" | "dark" | "sepia";
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  margin: "compact" | "normal" | "wide";
  readerWidth: "narrow" | "medium" | "wide" | "full";
  ttsSpeed: number;
  enableDictionary?: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  writingMode: "vertical",
  theme: "dark",
  fontFamily: "'Noto Serif JP', 'Yu Mincho', serif",
  fontSize: 18,
  lineHeight: 1.9,
  letterSpacing: 0,
  margin: "normal",
  readerWidth: "medium",
  ttsSpeed: 0.8,
  enableDictionary: true,
};

export const FONT_FAMILIES = [
  { label: "Noto Serif JP", value: "'Noto Serif JP', serif" },
  { label: "Noto Sans JP", value: "'Noto Sans JP', sans-serif" },
  { label: "Yu Mincho", value: "'Yu Mincho', serif" },
  { label: "Yu Gothic", value: "'Yu Gothic', sans-serif" },
  { label: "Hiragino Mincho", value: "'Hiragino Mincho Pro', serif" },
  { label: "Hiragino Sans", value: "'Hiragino Sans', sans-serif" },
  { label: "Klee One", value: "'Klee One', cursive" },
  { label: "Sawarabi Mincho", value: "'Sawarabi Mincho', serif" },
];

export const MARGIN_VALUES: Record<ReaderSettings["margin"], string> = {
  compact: "1rem",
  normal: "2.5rem",
  wide: "5rem",
};

export const READER_WIDTH_VALUES: Record<ReaderSettings["readerWidth"], string> = {
  narrow: "580px",
  medium: "720px",
  wide: "900px",
  full: "100%",
};
