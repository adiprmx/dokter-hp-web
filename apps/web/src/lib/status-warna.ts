// lib/status-warna.ts — Pemetaan SATU-SATUNYA dari keadaan ke warna status.
//
// Redesign v2.0 (docs/redesign-v20-spec.md §4): setiap warna punya arti
// status yang konsisten di SEMUA halaman. Semua komponen dan halaman WAJIB
// memakai helper di file ini — JANGAN memetakan keadaan ke warna di tempat
// lain (tidak ada pemetaan tersebar, tidak ada hex status di luar token).
//
// Nilai yang dikembalikan adalah var() token CSS dari styles/tokens.css,
// BUKAN hex mentah. Token sudah lolos WCAG AA (K-11, a11y.md §4).
// Warna SELALU dipasangkan dengan label teks di UI — jangan pernah hanya
// warna (aksesibilitas: buta warna).

import { klasifikasiSkor } from "./skor";
import type { IdKlasifikasi, VerdictBertahan } from "./speedtest";
import type { DoctorStatus } from "./doctor";

/** Lima keadaan status yang dikenal UI. */
export type StatusWarna = "sukses" | "peringatan" | "galat" | "info" | "netral";

/** Kumpulan token CSS untuk satu status (teks, latar tinta, bingkai, solid). */
export interface TokenStatus {
  /** Warna teks status di atas latar gelap (varian 400). */
  teks: string;
  /** Latar tinta 12% untuk cip/panel status. */
  latar: string;
  /** Bingkai 45% untuk cip/panel status. */
  bingkai: string;
  /** Warna solid — HANYA dipakai dengan teks putih di atasnya (K-11). */
  solid: string;
}

const TOKEN_STATUS: Record<StatusWarna, TokenStatus> = {
  sukses: {
    teks: "var(--color-success)",
    latar: "var(--color-success-bg)",
    bingkai: "var(--color-success-border)",
    solid: "var(--color-success-solid)",
  },
  peringatan: {
    teks: "var(--color-warning)",
    latar: "var(--color-warning-bg)",
    bingkai: "var(--color-warning-border)",
    solid: "var(--color-warning-solid)",
  },
  galat: {
    teks: "var(--color-error)",
    latar: "var(--color-error-bg)",
    bingkai: "var(--color-error-border)",
    solid: "var(--color-error-solid)",
  },
  info: {
    teks: "var(--color-info)",
    latar: "var(--color-info-bg)",
    bingkai: "var(--color-info-border)",
    solid: "var(--color-info-solid)",
  },
  netral: {
    teks: "var(--color-text-secondary)",
    latar: "var(--color-surface)",
    bingkai: "var(--color-border)",
    solid: "var(--color-surface-raised)",
  },
};

/** Token CSS untuk satu status. */
export function tokenStatus(status: StatusWarna): TokenStatus {
  return TOKEN_STATUS[status];
}

/**
 * Status dari skor kesehatan 0-100 (ambang kanonis 80/50, K-31):
 * ≥80 sukses (hijau), 50–79 peringatan (kuning), <50 galat (merah).
 */
export function statusDariSkor(skor: number): StatusWarna {
  const kategori = klasifikasiSkor(skor);
  if (kategori === "baik") return "sukses";
  if (kategori === "cukup") return "peringatan";
  return "galat";
}

/**
 * Status dari verdict tes bertahan WiFi:
 * bertahan → sukses (hijau), tidak-stabil → peringatan (kuning),
 * jatuh → galat (merah).
 */
export function statusDariVerdict(verdict: VerdictBertahan): StatusWarna {
  if (verdict === "bertahan") return "sukses";
  if (verdict === "jatuh") return "galat";
  return "peringatan";
}

/**
 * Status dari klasifikasi kecepatan WiFi (lib/speedtest.ts
 * IdKlasifikasi): sangat-cepat/cepat → sukses (hijau),
 * cukup → peringatan (kuning), lambat/sangat-lambat → galat (merah).
 * Dipakai verdict utama WifiPage (K-96: label klasifikasi domain
 * mempertahankan katanya, tetapi render-nya bertoken status).
 */
export function statusDariKlasifikasiKecepatan(
  id: IdKlasifikasi,
): StatusWarna {
  if (id === "sangat-cepat" || id === "cepat") return "sukses";
  if (id === "cukup") return "peringatan";
  return "galat";
}

/**
 * Status dari klasifikasi dokter (lib/doctor.ts DoctorStatus):
 * baik → sukses (hijau), cukup → peringatan (kuning),
 * perlu_perhatian → galat (merah). Dipakai semua halaman dokter
 * (baterai, penyimpanan, performa, keamanan) dan StorageBar.
 */
export function statusDariDoctor(status: DoctorStatus): StatusWarna {
  if (status === "baik") return "sukses";
  if (status === "cukup") return "peringatan";
  return "galat";
}

/** Label Indonesia untuk satu status (selalu tampil bersama warnanya). */
export function labelStatus(status: StatusWarna): string {
  switch (status) {
    case "sukses":
      return "Baik";
    case "peringatan":
      return "Perlu diperhatikan";
    case "galat":
      return "Bermasalah";
    case "info":
      return "Info";
    case "netral":
      return "Netral";
  }
}
