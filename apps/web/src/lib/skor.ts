// lib/skor.ts — Klasifikasi skor kesehatan HP 0-100 (fungsi murni).
//
// Ambang kategori sama dengan yang sudah dipakai komponen cincin skor
// (components/charts/ScoreRing.tsx) agar satu angka tidak pernah berbeda
// kategori di dua tempat (K-31: ambang 80/50):
//   Baik             : skor 80-100
//   Cukup            : skor 50-79
//   Perlu perhatian  : skor 0-49
//
// Label dan penjelasan kategori adalah teks final dari docs/copy.md §4.
// Warna memakai token fungsi dari src/styles/tokens.css (a11y.md §4:
// ketiganya lolos WCAG AA sebagai teks di atas latar gelap proyek).

export type KategoriSkor = "baik" | "cukup" | "perlu-perhatian";

/** Skor minimum kategori "Baik". */
export const SKOR_MIN_BAIK = 80;

/** Skor minimum kategori "Cukup". */
export const SKOR_MIN_CUKUP = 50;

/** Batasi skor ke rentang 0-100 dan bulatkan ke bilangan bulat. */
export function batasiSkor(skor: number): number {
  if (!Number.isFinite(skor)) return 0;
  return Math.max(0, Math.min(100, Math.round(skor)));
}

/** Klasifikasi skor 0-100 menjadi kategori. */
export function klasifikasiSkor(skor: number): KategoriSkor {
  const nilai = batasiSkor(skor);
  if (nilai >= SKOR_MIN_BAIK) return "baik";
  if (nilai >= SKOR_MIN_CUKUP) return "cukup";
  return "perlu-perhatian";
}

const LABEL_KATEGORI: Record<KategoriSkor, string> = {
  baik: "Baik",
  cukup: "Cukup",
  "perlu-perhatian": "Perlu perhatian",
};

/** Label kategori untuk ditampilkan (docs/copy.md §4). */
export function labelKategori(kategori: KategoriSkor): string {
  return LABEL_KATEGORI[kategori];
}

const PENJELASAN_KATEGORI: Record<KategoriSkor, string> = {
  baik: "Kondisi HP secara umum baik. Tidak ada masalah yang perlu segera diperbaiki.",
  cukup: "Ada beberapa hal yang bisa diperbaiki. Lihat saran di bawah.",
  "perlu-perhatian":
    "Ada masalah yang sebaiknya segera diperbaiki. Mulai dari yang paling atas.",
};

/** Penjelasan satu kalimat per kategori (docs/copy.md §4). */
export function penjelasanKategori(kategori: KategoriSkor): string {
  return PENJELASAN_KATEGORI[kategori];
}

// Warna fungsi per kategori. Bukan warna dekoratif: hijau = kondisi baik,
// kuning = perlu diperhatikan, merah = perlu tindakan. Nilai memakai token
// CSS yang sama dengan komponen lain, bukan hex mentah.
const WARNA_KATEGORI: Record<KategoriSkor, string> = {
  baik: "var(--color-success)",
  cukup: "var(--color-warning)",
  "perlu-perhatian": "var(--color-error)",
};

/** Warna fungsi kategori, sebagai nilai CSS siap pakai di style/stroke. */
export function warnaKategori(kategori: KategoriSkor): string {
  return WARNA_KATEGORI[kategori];
}

/**
 * Ringkasan skor satu kalimat, untuk pembaca layar (a11y.md 6.4).
 * Contoh: "Skor kesehatan 78 dari 100, kategori Cukup."
 */
export function ringkasanSkor(skor: number): string {
  const nilai = batasiSkor(skor);
  return `Skor kesehatan ${nilai} dari 100, kategori ${LABEL_KATEGORI[klasifikasiSkor(nilai)]}.`;
}
