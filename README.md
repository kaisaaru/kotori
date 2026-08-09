<div align="center">

<img src="public/icon.png" alt="Kotori Logo" width="100" />

# Kotoba Reader AI

**Kotoba Reader AI** (Kotori) — Platform Pembaca Light Novel & Web Novel Jepang Serba-Ada yang Canggih, Cepat, dan Imersif.

[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-4F46E5?style=for-the-badge&logo=database&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

</div>

---

## Overview

Kotoba Reader AI didesain khusus untuk memberikan pengalaman membaca novel Jepang (*EPUB*) secara otentik. Dilengkapi kamus pop-up Yomitan terintegrasi, alat pembedah tata bahasa dan Kanji, serta pengucapan suara bahasa Jepang berakurasi tinggi (*Text-to-Speech*).

---

## Fitur Utama

### 1. Native Japanese EPUB Reader
- **Teks Vertikal (縦書き) & Horizontal (横書き)**: Mendukung mode baca otentik Jepang dengan konversi scroll mouse pintar tanpa efek *jumping* antar bab.
- **Tipografi Otentik**: Pilihan font Jepang pilihan (*Noto Serif JP*, *Yu Mincho*, *Hiragino Mincho ProN*, *Noto Sans JP*).
- **Kustomisasi Lengkap**: Ukuran font, jarak antar baris (*line height*), margin layout, serta pilihan tema (*Dark, Light, Sepia*).

### 2. Kamus Pop-Up Yomitan (*Block-Text Selection*)
- **Auto-Lookup**: Cukup sorot kata atau kalimat Jepang di desktop maupun HP (*touchscreen*) untuk membuka pop-up kamus secara instan.
- **Integrasi Multi-Kamus**: Terhubung dengan kamus **JIDict (Bahasa Indonesia)**, **Jitendex (English)**, **三省堂国語辞典**, **NHK Pitch Accent**, dan **JLPT Level Badges**.
- **Yomitan AST Parser**: Mengolah struktur data JSON Yomitan menjadi tampilan definisi yang rapi dan mudah dibaca.

### 3. Bedah Kata & Kartu Detail Kanji
- **Deconstructor Kalimat**: Memecah kalimat panjang menjadi komponen kata penyusun lengkap dengan cara baca (*Furigana/Hiragana*) dan artinya.
- **Kartu Kanji**: Menampilkan rincian stroke, bacaan *Onyomi* & *Kunyomi*, serta terjemahan per karakter Kanji.

### 4. High-Precision Text-to-Speech (TTS)
- **Pelafalan Kontekstual**: Memanfaatkan Web Speech API dengan penyesuaian konteks bacaan Jepang (misal: mengeja `今日は` sebagai *"Kyou wa"* dengan tepat).
- **Pengucapan Kalimat Utuh**: Mendukung narasi audio untuk seluruh bagian teks yang dipilih.

### 5. Arsitektur API Cepat & Zero-Memory Overhead
- **Server-Side Lookup**: Pengolahan file kamus raksasa (1 GB+ ZIP) diproses via API `/api/dictionary/lookup` dalam hitungan milidetik (`< 5ms`).
- **Performa Ringan**: Memori browser tetap bersih dan responsif (60 FPS) tanpa membebankan RAM perangkat.

### 6. Desain Responsif & Efek 3D Imersif
- **Layout Adaptif**: Tampilan koleksi 2-kolom yang rapi di perangkat seluler dengan toolbar anti-overlap.
- **Transisi View Transitions API**: Efek perpindahan halaman dan "buku terbang" yang mulus.
- **Modal Preview 3D**: Animasi pratinjau buku 3D (*rotateY* & *scale zoom*) saat membuka novel dari rak buku.

### 7. Privasi & Dukungan Offline
- **Penyimpanan Lokal (IndexedDB)**: Seluruh file EPUB dan progres membaca tersimpan 100% di browser lokal pengguna. Tidak ada data yang diunggah ke server eksternal.

---

## Langkah Memulai

### Prasyarat
- **Node.js**: v18.0.0 atau lebih baru
- **Package Manager**: `npm`, `pnpm`, atau `yarn`

### Instalasi Local Development

```bash
# 1. Clone repository
git clone https://github.com/kaisaaru/kotoba-reader.git
cd kotoba-reader

# 2. Install dependencies
npm install

# 3. Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) pada browser Anda.

---

## Struktur Proyek

```text
kotoba-reader/
├── public/                 # Asset statis (logo, icon)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── dictionary/
│   │   │       └── lookup/ # Server-side Yomitan lookup API & indexer
│   │   ├── reader/[bookId]/# Halaman pembaca novel (Reader View)
│   │   ├── globals.css     # Design tokens, tema, & animasi 3D
│   │   ├── layout.tsx      # Root Layout
│   │   └── page.tsx        # Library / Home Page
│   ├── components/
│   │   └── reader/
│   │       ├── SelectionPopup.tsx      # Pop-up kamus & kontrol TTS
│   │       ├── ReaderSettingsPanel.tsx # Panel opsi tampilan baca
│   │       └── TableOfContents.tsx     # Navigasi bab novel
│   ├── services/
│   │   ├── book-storage.ts       # Service IndexedDB untuk buku & progres
│   │   ├── dictionary-service.ts # Client lookup service & cache
│   │   └── epub-parser.ts        # Parser & extractor file EPUB
│   ├── stores/
│   │   └── reader-store.ts       # State management (Zustand)
│   └── types/
│       └── book.ts               # TypeScript interfaces
└── README.md
```

---

## Deployment

Aplikasi ini siap di-deploy ke **Vercel** atau platform hosting Node.js / Next.js lainnya:

1. Push repository ke GitHub.
2. Import repository di [Vercel Dashboard](https://vercel.com).
3. Build command secara otomatis terdeteksi untuk Next.js App Router.

---

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
