export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    id: string[];
    en: string[];
  };
}

// Newest first. Add a new entry at the top when you ship something worth telling users about -
// CURRENT_VERSION below always follows automatically.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.4.2",
    date: "2026-09-13",
    changes: {
      id: [
        "- Fitur Kunci Navigasi Bab: tombol di header reader & opsi pengaturan untuk mencegah perpindahan bab tidak sengaja saat membaca di layar sentuh mobile.",
        "- Tombol navigasi bab samping otomatis disembunyikan dan tombol navigasi bilah bawah dinonaktifkan saat mode kunci aktif.",
        "- Menghapus tombol manual bookmark dari header karena progres bacaan tersimpan secara otomatis dan instan.",
        "- Posisi notifikasi toast dipindahkan ke pojok kanan atas dengan fitur jeda timer saat kursor diarahkan ke atasnya (pause on hover).",
        "- Perbaikan bilah pencarian mobile agar responsif dan memenuhi lebar layar.",
      ],
      en: [
        "- Chapter Navigation Lock: quick header button & settings toggle to prevent accidental chapter turns while reading on mobile touchscreens.",
        "- Floating side chevron buttons are automatically hidden and bottom bar buttons disabled when navigation is locked.",
        "- Removed redundant manual bookmark button from header in favor of real-time automatic progress saving.",
        "- Moved toast notifications to the top-right corner with pause-on-hover timer interaction.",
        "- Fixed mobile search bar responsiveness to comfortably span 100% width on phone screens.",
      ],
    },
  },
  {
    version: "0.4.1",
    date: "2026-09-07",
    changes: {
      id: [
        "- Pengecekan otomatis novel non-Jepang saat memilih/mengunggah file EPUB dengan dialog konfirmasi.",
        "- Tombol kamus dan fitur pencarian kata otomatis dinonaktifkan saat membuka novel yang bukan berbahasa Jepang.",
        "- Perbaikan tata letak & responsivitas header: mencegah teks subtitle logo terlipat menjadi 2 baris serta penyesuaian tombol adaptif pada layar laptop dan tablet.",
      ],
      en: [
        "- Automatic non-Japanese novel detection when uploading EPUB files with confirmation modal prompt.",
        "- Dictionary toggle button and word lookup features are automatically disabled when reading non-Japanese novels.",
        "- Improved header layout & responsiveness: prevented logo subtitle from wrapping into 2 lines and made header controls adapt seamlessly on laptop and tablet screens.",
      ],
    },
  },
  {
    version: "0.4.0",
    date: "2026-09-07",
    changes: {
      id: [
        "- Perbaikan gestur layar sentuh mobile: menggulir (scroll) halaman kini mulus tanpa sengaja memicu terbukanya kamus.",
        "- Tombol pintas di topbar reader untuk mengaktifkan atau menonaktifkan kamus bawaan dalam 1 klik (cocok bagi pengguna ekstensi Yomitan sendiri).",
        "- Deteksi otomatis ekstensi browser Yomitan dengan prompt konfirmasi untuk mencegah bentrok dua popup kamus.",
        "- Perbaikan posisi popup kamus: selalu berada 100% di dalam layar dan secara cerdas memilih posisi terbaik saat kata terpotong antar-kolom/baris.",
        "- Judul tab browser kini dinamis menampilkan judul buku yang sedang dibaca (misal: 'Baca [Judul Buku] | Kotori').",
      ],
      en: [
        "- Mobile touch gesture fix: scrolling through pages is now smooth without accidentally triggering dictionary popups.",
        "- Quick toggle button in reader topbar to enable or disable the built-in dictionary in 1 click (ideal for external Yomitan extension users).",
        "- Automatic Yomitan browser extension detection with confirmation prompt to prevent double popup conflicts.",
        "- Fixed dictionary popup positioning: always 100% visible on-screen and smartly docks to the best anchor when words wrap across columns or lines.",
        "- Dynamic browser tab title now displays the book currently being read (e.g. 'Read [Book Title] | Kotori').",
      ],
    },
  },
  {
    version: "0.3.0",
    date: "2026-08-26",
    changes: {
      id: [
        "- Tambah halaman Change Log agar Anda bisa lihat riwayat versi & pembaruan.",
        "- Tombol Cari Kamus dipindah jadi tombol melayang di kanan bawah (muncul di halaman utama & saat membaca) supaya lebih mudah dijangkau.",
      ],
      en: [
        "- Added a Change Log page so you can see version history and updates.",
        "- Moved the dictionary search button to a floating button in the bottom-right corner (on both the home page and while reading) for easier access.",
      ],
    },
  },
  {
    version: "0.2.0",
    date: "2026-08-26",
    changes: {
      id: [
        "- Tambah pencarian kamus langsung - ketik kata bahasa Jepang tanpa perlu buka buku dulu.",
        "- Hasil kamus sekarang lebih lengkap: contoh kalimat, bentuk kata lain, peringkat frekuensi, dan aksen nada per kata.",
        "- Data kanji diperluas dari 11 menjadi lebih dari 10.000 karakter (KANJIDIC).",
        "- Perbaikan aksesibilitas: semua tombol kini punya label yang bisa dibaca pembaca layar.",
        "- Peningkatan performa: waktu muat halaman lebih cepat dan lebih ringan di perangkat mobile.",
      ],
      en: [
        "- Added standalone dictionary search - type a Japanese word without opening a book first.",
        "- Dictionary results are now richer: example sentences, alternate word forms, frequency ranking, and pitch accent per word.",
        "- Kanji data expanded from 11 to over 10,000 characters (KANJIDIC).",
        "- Accessibility fixes: every button now has a label screen readers can announce.",
        "- Performance improvements: faster page loads and a lighter footprint on mobile devices.",
      ],
    },
  },
  {
    version: "0.1.0",
    date: "2026-08-21",
    changes: {
      id: [
        "- Rilis awal Kotori: pembaca EPUB dengan kamus bawaan, furigana, dan pembedah kata otomatis.",
      ],
      en: [
        "- Initial release of Kotori: an EPUB reader with a built-in dictionary, furigana, and automatic word segmentation.",
      ],
    },
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
