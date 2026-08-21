<div align="center">

<img src="public/icon.png" alt="Kotori Logo" width="100" />

# Kotoba Reader AI

**Kotoba Reader AI** (Kotori): An All-in-One, Fast, and Immersive Platform for Reading Japanese Light Novels & Web Novels.

**[🚀 Live Demo: readkotori.vercel.app](https://readkotori.vercel.app)**

[![Live Demo](https://img.shields.io/badge/Live_Demo-readkotori.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://readkotori.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-4F46E5?style=for-the-badge&logo=database&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

</div>

---

## Overview

Kotoba Reader AI is purpose-built to deliver an authentic Japanese novel (*EPUB*) reading experience. It comes with an integrated Yomitan-style pop-up dictionary, grammar and Kanji breakdown tools, and high-accuracy Japanese Text-to-Speech.

---

## Key Features

### 1. Native Japanese EPUB Reader
- **Vertical (縦書き) & Horizontal (横書き) Text**: Authentic Japanese reading modes with smart mouse-scroll conversion and no jumping between chapters.
- **Authentic Typography**: A curated selection of Japanese fonts (*Noto Serif JP*, *Yu Mincho*, *Hiragino Mincho ProN*, *Noto Sans JP*).
- **Full Customization**: Font size, line height, layout margins, and theme options (*Dark, Light, Sepia*).

### 2. Yomitan-Style Pop-Up Dictionary (*Block-Text Selection*)
- **Auto-Lookup**: Simply highlight a word or sentence (on desktop or touchscreen) to open the dictionary pop-up instantly.
- **Multi-Dictionary Integration**: Connects to **JIDict (Indonesian)**, **Jitendex (English)**, **三省堂国語辞典**, **NHK Pitch Accent**, and **JLPT Level Badges**.
- **Yomitan AST Parser**: Renders Yomitan's structured JSON content into clean, readable definitions.

### 3. Sentence Breakdown & Kanji Detail Cards
- **Sentence Deconstructor**: Breaks long sentences into their component words, complete with readings (*Furigana/Hiragana*) and meanings.
- **Kanji Cards**: Displays stroke order details, *Onyomi* & *Kunyomi* readings, and per-character translations.

### 4. High-Precision Text-to-Speech (TTS)
- **Contextual Pronunciation**: Uses the Web Speech API with Japanese-specific context handling (e.g. correctly reading `今日は` as *"Kyou wa"*).
- **Full-Sentence Narration**: Supports audio narration for any selected block of text.

### 5. Server-Side Dictionary Architecture
- **Server-Side Lookup**: Massive dictionary files (1 GB+ ZIP) are indexed and queried via the `/api/dictionary/lookup` API instead of loading them into the browser.
- **Lightweight Client**: Keeps the browser's own memory footprint small, since dictionary data stays server-side rather than being held in page memory.

### 6. Responsive Design & Immersive 3D Effects
- **Adaptive Layout**: A tidy 2-column library view on mobile devices with an overlap-free toolbar.
- **View Transitions API**: Smooth page transitions and a "flying book" effect.
- **3D Preview Modal**: 3D preview animation (*rotateY* & *scale zoom*) when opening a novel from the shelf.

### 7. Privacy & Offline Support
- **Local Storage (IndexedDB)**: All EPUB files and reading progress are stored 100% in the user's local browser. No data is uploaded to any external server.

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or newer
- **Package Manager**: `npm`, `pnpm`, or `yarn`

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/kaisaaru/kotori.git
cd kotori

# 2. Install dependencies
npm install

# 3. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```text
kotori/
├── public/                 # Static assets (logo, icon)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── dictionary/
│   │   │       └── lookup/ # Server-side Yomitan lookup API & indexer
│   │   ├── reader/[bookId]/# Novel reader page (Reader View)
│   │   ├── globals.css     # Design tokens, themes, & 3D animations
│   │   ├── layout.tsx      # Root Layout
│   │   └── page.tsx        # Library / Home Page
│   ├── components/
│   │   └── reader/
│   │       ├── SelectionPopup.tsx      # Dictionary pop-up & TTS controls
│   │       ├── ReaderSettingsPanel.tsx # Reading display options panel
│   │       └── TableOfContents.tsx     # Novel chapter navigation
│   ├── services/
│   │   ├── book-storage.ts       # IndexedDB service for books & progress
│   │   ├── dictionary-service.ts # Client lookup service & cache
│   │   └── epub-parser.ts        # EPUB file parser & extractor
│   ├── stores/
│   │   └── reader-store.ts       # State management (Zustand)
│   └── types/
│       └── book.ts               # TypeScript interfaces
└── README.md
```

---

## Known Issues

Kotori is under active development. A few known rough edges:

- **Dictionary lookup bugs**: some words/phrases can still return incorrect or missing matches.
- **Slow dictionary loading**: the dictionary index can take a while to load on first use, especially with large or many dictionaries loaded.

Bug reports and PRs are welcome.

---

## Credits & Acknowledgments

Kotori was built with reference to the following open-source projects:

- **[Yomitan](https://github.com/yomidevs/yomitan)** (GPL-3.0): Kotori follows Yomitan's dictionary format (ZIP + JSON) for compatibility with the community's existing dictionary collections, and some pop-up UX defaults (size & offset) were inspired by Yomitan. Kotori's Japanese verb de-inflection table ([src/lib/japanese/deinflector.ts](src/lib/japanese/deinflector.ts)) is independently derived from standard Godan/Ichidan grammar, not copied from Yomitan's rule table.
- **[ebook-reader (ttu-ttu)](https://github.com/ttu-ttu/ebook-reader)** (BSD-3-Clause): several techniques on the reader page ([src/app/reader/[bookId]/page.tsx](<src/app/reader/[bookId]/page.tsx>)), such as handling scroll-position sign in vertical text mode and guard timing when restoring reading position, were conceptually adapted from ebook-reader, implemented with independently written code.

Thanks to the maintainers and contributors of both projects.

---

## License

This project is licensed under the [MIT License](LICENSE).
