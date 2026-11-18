// lib/skor-wifi.ts — Rumus skor kesehatan WiFi (0-100).
//
// Implementasi eksak docs/skor-wifi.md (SUMBER RESMI rumus). Fungsi
// murni dan deterministik: masukan yang sama selalu menghasilkan
// skor yang sama, tanpa acak dan tanpa tanggal.
//
// KEJUJURAN: skor ini HANYA mencerminkan WiFi (kecepatan unduh,
// latensi HTTP, kestabilan tes bertahan 30 detik) — bukan skor
// kesehatan HP secara keseluruhan. Karena itu hitungSkorWifi selalu
// mengembalikan teks ringkasan §6 ("Skor ini hanya dari tes WiFi…")
// bersama skornya; tempat mana pun yang menampilkan skor WiFi WAJIB
// menampilkan kalimat itu juga.
//
// Bobot: kecepatan 50%, latensi 25%, kestabilan 25%. Komponen yang
// tidak ada datanya DIKELUARKAN dan bobot sisanya diskalakan ulang
// secara proporsional (tidak pernah dinilai 0, tidak pernah 50),
// lalu skor dibatasi maksimal 79. Verdict yang buruk memberi batas
// atas yang keras: tidak-stabil 69, jatuh 49. Pembulatan dilakukan
// TERAKHIR, setelah semua batas diterapkan.
//
// Kategori memakai klasifikasiSkor kanonis (K-31: 80/50) — tidak ada
// ambang kategori baru.

import { batasiSkor, klasifikasiSkor, labelKategori } from "./skor";
import type { VerdictBertahan } from "./speedtest";

/** Masukan rumus — semuanya sudah ada di WifiPage, tanpa ukur baru. */
export interface MasukanSkorWifi {
  /** Kecepatan unduh hasil tes, KB/detik (hasil.kecepatanKbps). */
  kecepatanKbps: number;
  /** Latensi HTTP, milidetik; null bila tidak berhasil diukur. */
  latensiMs: number | null;
  /**
   * Verdict tes bertahan (bertahan.hasil.verdict); null bila tes
   * bertahan tidak dijalankan, dibatalkan, gagal, atau sampel < 30.
   * Tes yang tidak selesai BUKAN "tidak-stabil" (skor-wifi.md §4.6).
   */
  verdictBertahan: VerdictBertahan | null;
}

/** Tiga subskor (masing-masing 0-100); null = tidak ada datanya. */
export interface KomponenSkorWifi {
  kecepatan: number;
  latensi: number | null;
  kestabilan: number | null;
}

export interface HasilSkorWifi {
  /** Skor akhir 0-100 (bilangan bulat, sesudah batas + pembulatan). */
  skor: number;
  komponen: KomponenSkorWifi;
  /** Teks ringkasan §6 (kalimat wajib + penjelas keadaan). */
  ringkasan: string;
}

/** Batas atas skor bila komponen apa pun tidak ada datanya (§4.3). */
export const BATAS_SKOR_DATA_TIDAK_LENGKAP = 79;

/** Batas atas skor bila verdict tes bertahan "tidak-stabil" (§3). */
export const BATAS_SKOR_TIDAK_STABIL = 69;

/** Batas atas skor bila verdict tes bertahan "jatuh" (§3). */
export const BATAS_SKOR_JATUH = 49;

/** Kalimat wajib §6.1 — selalu ada di setiap ringkasan skor WiFi. */
export const KALIMAT_WAJIB_SKOR_WIFI =
  "Skor ini hanya dari tes WiFi. Bukan skor kesehatan HP secara keseluruhan.";

/**
 * Interpolasi linear antar titik jangkar (diurutkan naik menurut x).
 * Di bawah jangkar pertama memakai nilai jangkar pertama, di atas
 * jangkar terakhir memakai nilai jangkar terakhir (mentok).
 */
function interpolasi(
  nilai: number,
  jangkar: readonly (readonly [number, number])[],
): number {
  if (nilai <= jangkar[0][0]) return jangkar[0][1];
  for (let i = 1; i < jangkar.length; i++) {
    const [x0, y0] = jangkar[i - 1];
    const [x1, y1] = jangkar[i];
    if (nilai <= x1) return y0 + ((nilai - x0) * (y1 - y0)) / (x1 - x0);
  }
  return jangkar[jangkar.length - 1][1];
}

/** Jangkar subskor kecepatan (§2.1): dari batas klasifikasi kecepatan. */
const JANGKAR_KECEPATAN: readonly (readonly [number, number])[] = [
  [0, 0],
  [50, 20],
  [200, 40],
  [1000, 70],
  [5000, 100],
];

/** Jangkar subskor latensi (§2.1). */
const JANGKAR_LATENSI: readonly (readonly [number, number])[] = [
  [50, 100],
  [100, 80],
  [200, 60],
  [500, 30],
  [1000, 0],
];

/**
 * Subskor kecepatan (0-100) dari KB/detik. Kecepatan negatif atau
 * bukan angka diperlakukan sebagai 0; di atas 5.000 mentok di 100.
 */
export function subskorKecepatan(kecepatanKbps: number): number {
  const bersih =
    Number.isFinite(kecepatanKbps) && kecepatanKbps > 0 ? kecepatanKbps : 0;
  return interpolasi(bersih, JANGKAR_KECEPATAN);
}

/**
 * Subskor latensi (0-100) dari milidetik; null bila latensi tidak
 * berhasil diukur (null, negatif, atau bukan angka — bukan 0).
 * Latensi di atas 1.000 ms mentok di 0.
 */
export function subskorLatensi(latensiMs: number | null): number | null {
  if (latensiMs === null || !Number.isFinite(latensiMs) || latensiMs < 0) {
    return null;
  }
  return interpolasi(latensiMs, JANGKAR_LATENSI);
}

/**
 * Subskor kestabilan (0-100) dari verdict tes bertahan: bertahan
 * 100, tidak-stabil 40, jatuh 10. Verdict null (atau tidak dikenal)
 * berarti tidak ada datanya — bukan 0.
 */
export function subskorKestabilan(
  verdict: VerdictBertahan | null,
): number | null {
  if (verdict === "bertahan") return 100;
  if (verdict === "tidak-stabil") return 40;
  if (verdict === "jatuh") return 10;
  return null;
}

/** Verdict yang dikenali rumus; nilai lain diperlakukan sebagai null. */
function verdictValid(
  verdict: VerdictBertahan | null,
): VerdictBertahan | null {
  if (
    verdict === "bertahan" ||
    verdict === "tidak-stabil" ||
    verdict === "jatuh"
  ) {
    return verdict;
  }
  return null;
}

/** Kalimat penjelas keadaan (§6.2) dari kelengkapan data. */
function kalimatKeadaan(adaLatensi: boolean, adaStabil: boolean): string {
  if (adaLatensi && adaStabil) {
    return "Dihitung dari kecepatan, waktu tunggu, dan kestabilan selama 30 detik.";
  }
  if (adaLatensi) {
    return "Dihitung dari kecepatan dan waktu tunggu saja, tanpa tes bertahan 30 detik. Nilainya dibatasi sampai 79 karena kestabilan belum diukur.";
  }
  if (adaStabil) {
    return "Dihitung tanpa waktu tunggu karena waktu tunggu tidak berhasil diukur. Nilainya dibatasi sampai 79.";
  }
  return "Dihitung dari kecepatan saja. Waktu tunggu tidak berhasil diukur dan tes bertahan 30 detik tidak dijalankan. Nilainya dibatasi sampai 79.";
}

/** Kalimat tambahan verdict (§6.2), di belakang kalimat keadaan. */
function kalimatVerdict(verdict: VerdictBertahan | null): string {
  if (verdict === "jatuh") {
    return " Kecepatan jatuh di tengah jalan, jadi nilainya dibatasi sampai 49.";
  }
  if (verdict === "tidak-stabil") {
    return " Kecepatan tidak stabil selama 30 detik, jadi nilainya dibatasi sampai 69.";
  }
  return "";
}

/**
 * Hitung skor WiFi dari hasil tes (docs/skor-wifi.md §2-§4).
 * Pembulatan dilakukan terakhir, setelah semua batas diterapkan.
 */
export function hitungSkorWifi(masukan: MasukanSkorWifi): HasilSkorWifi {
  const verdict = verdictValid(masukan.verdictBertahan);
  const kecepatan = subskorKecepatan(masukan.kecepatanKbps);
  const latensi = subskorLatensi(masukan.latensiMs);
  const kestabilan = subskorKestabilan(verdict);
  const adaLatensi = latensi !== null;
  const adaStabil = kestabilan !== null;

  // Bobot diskalakan ulang bila ada komponen tanpa data (§4):
  // lengkap 50:25:25; satu hilang 2:1; hanya kecepatan = subskornya.
  let mentah: number;
  if (adaLatensi && adaStabil) {
    mentah = 0.5 * kecepatan + 0.25 * latensi + 0.25 * kestabilan;
  } else if (adaLatensi) {
    mentah = (2 * kecepatan + latensi) / 3;
  } else if (adaStabil) {
    mentah = (2 * kecepatan + kestabilan) / 3;
  } else {
    mentah = kecepatan;
  }

  // Batas atas: yang TERENDAH yang menang (§3 + §4.3).
  let batas = 100;
  if (!adaLatensi || !adaStabil) {
    batas = Math.min(batas, BATAS_SKOR_DATA_TIDAK_LENGKAP);
  }
  if (verdict === "tidak-stabil") {
    batas = Math.min(batas, BATAS_SKOR_TIDAK_STABIL);
  }
  if (verdict === "jatuh") {
    batas = Math.min(batas, BATAS_SKOR_JATUH);
  }

  const skor = batasiSkor(Math.min(mentah, batas));
  const ringkasan = `${KALIMAT_WAJIB_SKOR_WIFI} ${kalimatKeadaan(adaLatensi, adaStabil)}${kalimatVerdict(verdict)}`;
  return { skor, komponen: { kecepatan, latensi, kestabilan }, ringkasan };
}

/**
 * Ringkasan skor untuk pembaca layar (§6.4), mengikuti pola
 * ringkasanSkor di lib/skor.ts ditambah penanda WiFi.
 * Contoh: "Skor WiFi 69 dari 100, kategori Cukup. Skor ini hanya
 * dari tes WiFi."
 */
export function ringkasanAriaWifi(skor: number): string {
  const nilai = batasiSkor(skor);
  return `Skor WiFi ${nilai} dari 100, kategori ${labelKategori(klasifikasiSkor(nilai))}. Skor ini hanya dari tes WiFi.`;
}
