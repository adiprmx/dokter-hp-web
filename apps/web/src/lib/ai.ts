// apps/web/src/lib/ai.ts
// Fungsi murni untuk Diagnosis AI (/ai): validasi pertanyaan,
// parsing sisa kuota dari respons API, dan format tampilan
// (tanggal, kategori skor, ringkasan pemeriksaan terakhir).
// Tanpa efek samping dan tanpa pemanggilan jaringan — logika ini
// diuji unit di ai.test.ts.
//
// Frontend tidak pernah memanggil Gemini langsung; semua pertanyaan
// dikirim ke POST /api/ai/diagnose di Worker dan kunci API hanya
// ada di server.

/** Batas pertanyaan Diagnosis AI per pengguna per hari (K-06). */
export const BATAS_PERTANYAAN_HARIAN = 20;

/**
 * Panjang pertanyaan maksimum (karakter, setelah trim).
 * Catatan: docs/api-contracts.md §5.1 menyebut 2000, tetapi backend
 * (apps/api/src/ai/routes.ts, PERTANYAAN_MAKS_KARAKTER) memberlakukan
 * 1000 — frontend mengikuti backend agar pertanyaan tidak ditolak
 * server dengan VALIDATION_ERROR.
 */
export const PERTANYAAN_MAKS_KARAKTER = 1000;

export type HasilValidasiPertanyaan =
  | { ok: true; pertanyaan: string }
  | { ok: false; pesan: string };

/**
 * Memvalidasi pertanyaan: tidak boleh kosong dan maksimal
 * PERTANYAAN_MAKS_KARAKTER karakter setelah dipangkas.
 * Pesan mengikuti docs/copy.md §13.
 */
export function validasiPertanyaan(nilai: string): HasilValidasiPertanyaan {
  const pertanyaan = nilai.trim();
  if (pertanyaan.length === 0) {
    return { ok: false, pesan: "Tulis dulu keluhan atau pertanyaannya." };
  }
  if (pertanyaan.length > PERTANYAAN_MAKS_KARAKTER) {
    return {
      ok: false,
      pesan:
        "Pertanyaannya terlalu panjang. Singkat saja, yang penting jelas.",
    };
  }
  return { ok: true, pertanyaan };
}

/**
 * Membaca sisa kuota harian dari `data` respons POST /api/ai/diagnose.
 * Backend mengembalikan `sisa_hari_ini` (angka bulat 0 sampai 20).
 * Mengembalikan null bila field tidak ada atau nilainya tidak masuk
 * akal, supaya layar tidak menampilkan angka kuota yang salah.
 */
export function parseSisaKuota(data: unknown): number | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const sisa = (data as { sisa_hari_ini?: unknown }).sisa_hari_ini;
  if (
    typeof sisa !== "number" ||
    !Number.isInteger(sisa) ||
    sisa < 0 ||
    sisa > BATAS_PERTANYAAN_HARIAN
  ) {
    return null;
  }
  return sisa;
}

/** Hari kalender UTC dari sebuah Date ("YYYY-MM-DD"). */
function tanggalUtc(waktu: Date): string {
  return waktu.toISOString().slice(0, 10);
}

/**
 * Menghitung sisa kuota harian dari riwayat tanya jawab: jumlah
 * entri yang dibuat pada hari ini (hari kalender UTC — sama dengan
 * cara server menghitung, SQLite date() memakai UTC) dikurangi dari
 * batas harian. Dipakai sebagai nilai awal sebelum ada respons POST
 * /api/ai/diagnose; nilai dari respons POST selalu lebih utama.
 * Entri dengan tanggal tidak valid diabaikan. Tidak pernah negatif.
 */
export function hitungSisaKuotaDariRiwayat(
  riwayat: readonly { dibuat_pada: unknown }[],
  sekarang: Date = new Date(),
  batas: number = BATAS_PERTANYAAN_HARIAN,
): number {
  const hariIni = tanggalUtc(sekarang);
  let terpakai = 0;
  for (const entri of riwayat) {
    if (typeof entri.dibuat_pada !== "string") {
      continue;
    }
    const waktu = new Date(entri.dibuat_pada);
    if (Number.isNaN(waktu.getTime())) {
      continue;
    }
    if (tanggalUtc(waktu) === hariIni) {
      terpakai += 1;
    }
  }
  return Math.max(0, batas - terpakai);
}

/**
 * Format tanggal dan jam Indonesia: "17 November 2026, 22.15"
 * (docs/copy.md §0). Parameter timeZone hanya untuk pengujian;
 * tanpa parameter memakai zona waktu perangkat pengguna.
 * Tanggal tidak valid menghasilkan "tidak tersedia", bukan tanggal
 * contoh.
 */
export function formatTanggalJam(iso: string, timeZone?: string): string {
  const waktu = new Date(iso);
  if (Number.isNaN(waktu.getTime())) {
    return "tidak tersedia";
  }
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(waktu);
  const jam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(waktu);
  return `${tanggal}, ${jam}`;
}

/**
 * Kategori skor kesehatan: 80 ke atas "Baik", 50 ke atas "Cukup",
 * di bawah itu "Perlu perhatian" (ambang yang sama dengan
 * fallback aturan backend, apps/api/src/ai/fallback.ts).
 */
export function kategoriSkor(skor: number): string {
  if (!Number.isFinite(skor)) {
    return "tidak tersedia";
  }
  if (skor >= 80) {
    return "Baik";
  }
  if (skor >= 50) {
    return "Cukup";
  }
  return "Perlu perhatian";
}

const LABEL_STATUS_KOMPONEN: Record<string, string> = {
  baik: "Baik",
  cukup: "Cukup",
  perlu_perhatian: "Perlu perhatian",
};

/** Label tampilan status komponen pemeriksaan. */
export function labelStatusKomponen(status: unknown): string {
  if (
    typeof status === "string" &&
    Object.prototype.hasOwnProperty.call(LABEL_STATUS_KOMPONEN, status)
  ) {
    return LABEL_STATUS_KOMPONEN[status];
  }
  return "tidak tersedia";
}

const LABEL_SUMBER_KONTEKS: Record<string, string> = {
  web: "Dari tes web",
  apk: "Dari aplikasi Dokter HP",
  manual: "Diisi manual",
};

/** Label tampilan sumber data komponen (docs/copy.md §0). */
export function labelSumberKonteks(sumber: unknown): string {
  if (
    typeof sumber === "string" &&
    Object.prototype.hasOwnProperty.call(LABEL_SUMBER_KONTEKS, sumber)
  ) {
    return LABEL_SUMBER_KONTEKS[sumber];
  }
  return "tidak tersedia";
}

const LABEL_KOMPONEN: Record<string, string> = {
  wifi: "WiFi",
  baterai: "Baterai",
  penyimpanan: "Penyimpanan",
  performa: "Performa",
  keamanan: "Keamanan",
};

/** Label tampilan kunci komponen; null bila kunci tidak dikenal. */
export function labelKomponen(kunci: string): string | null {
  if (Object.prototype.hasOwnProperty.call(LABEL_KOMPONEN, kunci)) {
    return LABEL_KOMPONEN[kunci];
  }
  return null;
}

/** Urutan tampil komponen ringkasan pemeriksaan. */
const URUTAN_KOMPONEN = [
  "wifi",
  "baterai",
  "penyimpanan",
  "performa",
  "keamanan",
];

export interface KomponenRingkasan {
  label: string;
  nilai: string;
}

export interface RingkasanPemeriksaan {
  skorTeks: string;
  kategori: string;
  tanggalTeks: string;
  komponen: KomponenRingkasan[];
}

export interface PemeriksaanTerakhirInput {
  skor?: unknown;
  dibuat_pada?: unknown;
  ringkasan?: unknown;
}

/**
 * Membaca objek ringkasan pemeriksaan. API mengembalikan ringkasan
 * sebagai objek, tetapi kolom D1 menyimpannya sebagai TEXT JSON —
 * string JSON tetap diterima secara defensif.
 */
function sebagaiObjekRingkasan(
  nilai: unknown,
): Record<string, unknown> | null {
  if (typeof nilai === "string") {
    try {
      const hasil: unknown = JSON.parse(nilai);
      return typeof hasil === "object" && hasil !== null
        ? (hasil as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof nilai === "object" && nilai !== null) {
    return nilai as Record<string, unknown>;
  }
  return null;
}

/**
 * Merangkum pemeriksaan kesehatan terakhir menjadi baris-baris
 * tampilan untuk kartu "konteks yang dipakai AI". Mengembalikan
 * null bila tidak ada pemeriksaan atau skornya tidak valid.
 * Komponen tanpa data dilewati; kunci komponen yang tidak dikenal
 * dilewati.
 */
export function ringkasPemeriksaanTerakhir(
  pemeriksaan: PemeriksaanTerakhirInput | null | undefined,
  timeZone?: string,
): RingkasanPemeriksaan | null {
  if (!pemeriksaan) {
    return null;
  }
  const skor = pemeriksaan.skor;
  if (typeof skor !== "number" || !Number.isFinite(skor)) {
    return null;
  }
  const ringkasan = sebagaiObjekRingkasan(pemeriksaan.ringkasan);
  const komponen: KomponenRingkasan[] = [];
  if (ringkasan) {
    for (const kunci of URUTAN_KOMPONEN) {
      const isi = ringkasan[kunci];
      if (typeof isi !== "object" || isi === null) {
        continue;
      }
      const bagian = isi as {
        status?: unknown;
        skor?: unknown;
        sumber?: unknown;
      };
      const potongan: string[] = [labelStatusKomponen(bagian.status)];
      if (
        typeof bagian.skor === "number" &&
        Number.isFinite(bagian.skor)
      ) {
        potongan.push(`Skor ${bagian.skor}`);
      }
      potongan.push(labelSumberKonteks(bagian.sumber));
      const label = labelKomponen(kunci);
      if (label) {
        komponen.push({ label, nilai: potongan.join(" · ") });
      }
    }
  }
  return {
    skorTeks: `${skor} dari 100`,
    kategori: kategoriSkor(skor),
    tanggalTeks:
      typeof pemeriksaan.dibuat_pada === "string"
        ? formatTanggalJam(pemeriksaan.dibuat_pada, timeZone)
        : "tidak tersedia",
    komponen,
  };
}
