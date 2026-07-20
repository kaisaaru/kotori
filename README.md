# Kotoba Reader AI

All-in-one AI-powered Japanese reading platform. Upload EPUB novels and read with built-in dictionary, grammar analysis, and AI explanations.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start reading.

## Features (Phase 1 - MVP)

- 📖 EPUB reader with vertical (縦書き) and horizontal (横書き) text support
- 🌙 Dark, Light, and Sepia themes
- 🔤 Customizable fonts (Noto Serif JP, Noto Sans JP, and more)
- 📏 Adjustable font size, line height, and margins
- 📑 Table of contents navigation
- 📊 Reading progress tracking
- 💾 All data stored locally (IndexedDB) — no account needed
- 🖱️ Drag & drop EPUB upload

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand (state management)
- JSZip (EPUB parsing)
- idb (IndexedDB wrapper)
- Lucide React (icons)
