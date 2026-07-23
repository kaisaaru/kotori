# Kotoba Reader AI 📚✨

[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Kotoba Reader AI** adalah platform membaca novel Jepang (Light Novel / Web Novel) serba-ada yang canggih, cepat, dan indah. Dilengkapi dengan kamus pop-up Yomitan terintegrasi, pembedah kalimat otomatis, kartu detail Kanji, serta sintesis suara bahasa Jepang (*Text-to-Speech*).

---

## 🌟 Fitur Utama (Key Features)

### 📖 1. Reader Novel Jepang Otentik (*Native Japanese EPUB Reader*)
- **Dukungan Teks Vertikal (縦書き) & Horizontal (横書き)**.
- Converter scroll mouse pintar yang menyesuaikan mode baca vertikal tanpa *jumping* antar bab.
- Pilihan font otentik Jepang (*Noto Serif JP*, *Yu Mincho*, *Hiragino Mincho ProN*, *Noto Sans JP*).
- Pengaturan fleksibel: ukuran font, jarak antar baris (*line height*), margin, serta tema (Dark, Light, Sepia).

### 🔍 2. Kamus Pop-Up Seleksi Teks Yomitan (*Block-Text Popup*)
- Cukup **blok kata atau kalimat Jepang** di komputer maupun HP (*touchscreen*). Pop-up kamus akan langsung muncul secara otomatis.
- Terintegrasi dengan kamus Yomitan populer: **JIDict (Bahasa Indonesia)**, **Jitendex (English)**, **三省堂国語辞典**, **NHK Pitch Accent**, dan **JLPT Level Badges**.
- Parser **Yomitan Structured Content (AST)** yang mengubah definisi JSON menjadi kalimat bersih dan indah tanpa karakter mentah.

### 🧩 3. Tab Bedah Kata & Kartu Detail Kanji
- **Tab Bedah Kata**: Memecah kalimat panjang menjadi kata-kata penyusunnya lengkap dengan cara baca (*Furigana/Hiragana*) dan definisinya.
- **Tab Kanji**: Menampilkan perincian karakter Kanji lengkap dengan bacaan *Onyomi*, *Kunyomi*, dan arti bahasa Indonesia/Inggris.

### 🔊 4. Suara Pelafalan Jepang (*High-Precision Text-to-Speech*)
- Fitur suara Web Speech API dengan akurasi konteks tinggi (contoh: mengeja `今日は` sebagai *"Kyou wa"* dengan tepat).
- Mendukung pengucapan **seluruh kalimat utuh** dari kata awal hingga akhir.

### ⚡ 5. Arsitektur Server API Super Cepat & Ringan (*Zero-Memory Overhead*)
- Pembacaan file kamus raksasa (1 GB+ ZIP) diolah oleh **Server-Side API (`/api/dictionary/lookup`)** secara instan (`< 5ms`).
- Memori browser pengguna **100% bersih dan ringan (60 FPS)** tanpa membebankan RAM HP atau Laptop.

### 📱 6. Desain 100% Mobile & Desktop Responsive
- Tampilan koleksi novel **2 kolom di HP (*2-column mobile grid*)**.
- Toolbar reader dan pop-up kamus yang bebas bertumpuk (*zero overlap*) di seluruh resolusi layar.

### 🔒 7. Privasi & Dukungan Offline (*IndexedDB Local Storage*)
- Seluruh file EPUB dan kemajuan membaca (*reading progress*) tersimpan **100% secara lokal** di browser perangkat pengguna (IndexedDB). Tidak ada file yang diunggah ke server eksternal.

### 🎭 8. Efek Transisi Terbang & Modal Preview 3D Imersif
- **Animasi Transisi Tata Letak (Grid ↔ Bookshelf)**: Perpindahan antartampilan "buku terbang" yang sangat mulus menggunakan CSS View Transitions API yang disinkronkan dengan algoritma urutan abjad Jepang (Gojūon).
- **Modal Preview & Transisi Buku 3D**: Saat buku diklik, lembaran kertas detail progres meluncur keluar secara horizontal dari balik buku. Klik membaca akan menyelinapkan kertas kembali, memosisikan buku di tengah, membuka cover depannya secara 3D (*rotateY*), dan memperbesar (*scale zoom*) ke arah kamera hingga layar menjadi putih bersih sebelum rute beralih secara mulus.
- **Responsif Horisontal**: Tampilan mobile menyesuaikan ukuran buku secara mini dan proporsional untuk mempertahankan esensi membuka buku horizontal yang alami.

---

## 🛠️ Langkah Memulai (Getting Started)

### Prerequisites
- Node.js 18.x atau lebih baru
- npm / pnpm / yarn

### Instalasi & Menjalankan Lokal

```bash
# 1. Clone repository
git clone https://github.com/kaisaaru/kotoba-reader.git
cd kotoba-reader

# 2. Install dependensi
npm install

# 3. Jalankan server pengembang
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser Anda untuk mulai membaca!

---

## 📦 Struktur Proyek (Project Architecture)

```text
kotoba-reader/
├── reference/            # Folder file kamus Yomitan (.zip) - Diabaikan oleh Git (.gitignore)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── dictionary/
│   │   │       └── lookup/ # Server-side Yomitan ZIP background indexer & lookup API
│   │   ├── reader/[bookId]/ # Halaman pembaca novel (Reader View)
│   │   ├── globals.css     # CSS variabel tema & aturan mobile responsive
│   │   ├── layout.tsx      # Root Layout
│   │   └── page.tsx        # Halaman koleksi novel (Library / Home)
│   ├── components/
│   │   └── reader/
│   │       ├── SelectionPopup.tsx      # Pop-up kamus seleksi & audio TTS
│   │       ├── ReaderSettingsPanel.tsx # Panel pengaturan mode baca
│   │       └── TableOfContents.tsx     # Daftar isi bab
│   ├── services/
│   │   ├── book-storage.ts       # Penyimpanan IndexedDB buku (Batch Promise.all)
│   │   ├── dictionary-service.ts # Client dictionary lookup service (LRU Cache)
│   │   └── epub-parser.ts        # Extractor EPUB (HTML & SVG image support)
│   ├── stores/
│   │   └── reader-store.ts       # State management Zustand
│   └── types/
│       └── book.ts               # TypeScript types & interfaces
└── README.md
```

---

## 🚀 Deployment (Vercel)

Aplikasi ini dapat di-deploy dengan mudah ke **Vercel**:

1. Push repository Anda ke GitHub.
2. Import repository di [Vercel Dashboard](https://vercel.com).
3. Vercel akan secara otomatis mendeteksi **Next.js 16** dan melakukan build.

---

## 📄 Lisensi (License)

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
