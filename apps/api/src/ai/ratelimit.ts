// apps/api/src/ai/ratelimit.ts
// Batas pemakaian Diagnosis AI: 20 pertanyaan per hari per pengguna,
// dihitung dari baris tabel ai_diagnoses yang dibuat pada hari ini
// (UTC). Penghitungan memakai D1 agar batas berlaku konsisten di
// semua instance Worker. KV tidak dipakai (batas tulis 1.000/hari).

/** Batas pertanyaan AI per pengguna per hari (UTC). */
export const BATAS_AI_HARIAN = 20;

/**
 * Antarmuka minimal binding D1 yang dibutuhkan modul ini. Bentuk ini
 * mengikuti D1Database / D1PreparedStatement Cloudflare, dipersempit
 * agar mudah diuji dengan mock dan tidak bergantung pada paket
 * tipe Workers di modul ini.
 */
export interface PernyataanD1 {
  bind(...nilai: unknown[]): PernyataanD1;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
  }>;
  run(): Promise<{ success: boolean; meta?: unknown }>;
}

export interface DbD1 {
  prepare(pernyataanSql: string): PernyataanD1;
}

export interface StatusBatasAi {
  /** True bila pengguna masih boleh bertanya hari ini. */
  diizinkan: boolean;
  /** Jumlah pertanyaan yang sudah dipakai hari ini. */
  terpakai: number;
  /** Batas harian (BATAS_AI_HARIAN). */
  batas: number;
  /** Sisa pertanyaan hari ini (tidak pernah negatif). */
  sisa: number;
}

/**
 * Menghitung pertanyaan AI pengguna pada hari ini (UTC).
 * `sekarang` dapat diisi eksplisit untuk pengujian; bawaan waktu
 * saat ini. Perbandingan memakai fungsi date() SQLite terhadap
 * kolom dibuat_pada (TEXT ISO 8601 UTC).
 */
export async function hitungPertanyaanHariIni(
  db: DbD1,
  idPengguna: string,
  sekarang: Date = new Date(),
): Promise<number> {
  const pernyataan = db
    .prepare(
      'SELECT COUNT(*) AS jumlah FROM ai_diagnoses ' +
        'WHERE user_id = ? AND date(dibuat_pada) = date(?)',
    )
    .bind(idPengguna, sekarang.toISOString());
  const baris = await pernyataan.first<{ jumlah?: unknown }>();
  const jumlah = baris?.jumlah;
  if (typeof jumlah === 'number' && Number.isFinite(jumlah) && jumlah >= 0) {
    return Math.floor(jumlah);
  }
  if (typeof jumlah === 'string') {
    const angka = Number.parseInt(jumlah, 10);
    if (Number.isFinite(angka) && angka >= 0) {
      return angka;
    }
  }
  return 0;
}

/**
 * Memeriksa apakah pengguna masih boleh bertanya hari ini.
 * Mengembalikan status lengkap agar rute dapat memberi tahu sisa
 * kuota kepada pengguna.
 */
export async function cekBatasAi(
  db: DbD1,
  idPengguna: string,
  sekarang: Date = new Date(),
): Promise<StatusBatasAi> {
  const terpakai = await hitungPertanyaanHariIni(db, idPengguna, sekarang);
  const batas = BATAS_AI_HARIAN;
  const sisa = Math.max(0, batas - terpakai);
  return { diizinkan: terpakai < batas, terpakai, batas, sisa };
}
