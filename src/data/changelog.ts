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
