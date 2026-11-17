// apps/api/src/lib/ratelimit.ts
// Rate limit via tabel D1 `rate_limits` (keputusan koordinator
// K-02, K-42, K-59; kontrak api-contracts.md bagian 0.7).
//
// Skema (ARCHITECTURE.md bagian 5 + migrasi 0004):
//   rate_limits(kunci TEXT PRIMARY KEY, jumlah INTEGER NOT NULL,
//     jendela_mulai TEXT NOT NULL, kedaluwarsa_pada TEXT NOT NULL)
// Satu baris per kunci = "cakupan:subjek:jendela". KV TIDAK dipakai
// untuk rate limit: D1 memberi hitungan atomik per kunci lewat
// dua pernyataan yang masing-masing atomik — INSERT OR IGNORE
// (membuat baris jendela bila belum ada) lalu UPDATE ...
// SET jumlah = jumlah + 1 WHERE jumlah < batas. Keputusan
// "diizinkan/ditolak" diambil database lewat meta.changes (1 =
// diizinkan, 0 = batas tercapai), sehingga burst paralel tidak
// dapat mengalahkan batas (R-03: implementasi baca-lalu-tulis
// sebelumnya menghitung hanya 2 dari 20 permintaan paralel yang
// diizinkan). Pola "upsert lalu baca kembali" TIDAK dipakai:
// bacaan sesudah increment dapat melihat hitungan akhir dari
// seluruh burst dan menolak semua permintaan (over-rejection,
// terbukti oleh tes burst di bawah).
//
// Batas kontrak bagian 0.7:
//   - tulis (POST/PATCH/PUT/DELETE): 60/menit per pengguna
//   - baca (GET): 300/menit per pengguna
//   - ekspor akun: 5/hari per pengguna
//   - mulai OAuth: 10/menit per IP
// AI 20/hari dan kunci PIN 5x diatur modulnya sendiri
// (ai/ratelimit.ts, auth/pin.ts) — keduanya memakai pola increment
// atomik yang sama, dan kuota AI memakai tabel ini lewat
// cekDanCatat (cadangan kuota).
//
// Semantik: hanya permintaan yang diizinkan yang menambah hitungan
// (UPDATE bersyarat tidak menyentuh baris bila batas tercapai).
// Kode galat kanonis: 429 RATE_LIMITED (K-59) + header Retry-After.
//
// Pembersihan malas (R-15): setiap kunci baru yang dibuat memicu
// satu penghapusan best-effort atas baris kedaluwarsa (maksimal 100
// baris per pemicu). Kegagalan pembersihan tidak pernah
// menggagalkan permintaan.
//
// Modul ini memakai antarmuka D1 minimal DbD1 (auth/session) agar
// bisa dipakai router data (D1Database) maupun router auth (DbD1)
// tanpa perantara helper lib/db.

import { createMiddleware } from 'hono/factory';
import { ApiError, balasGagal, terlaluSering } from './envelope';
import { getUserId, type VariabelAuth } from '../auth/middleware';
import type { DbD1 } from '../auth/session';

/** Batas tulis: 60 permintaan/menit per pengguna. */
export const BATAS_TULIS_PER_MENIT = 60;
/** Batas baca: 300 permintaan/menit per pengguna. */
export const BATAS_BACA_PER_MENIT = 300;
/** Batas ekspor akun: 5/hari per pengguna. */
export const BATAS_EKSPOR_PER_HARI = 5;
/** Batas mulai OAuth: 10/menit per alamat IP. */
export const BATAS_OAUTH_PER_MENIT = 10;

/** Satu jendela hitung: kunci baris + batas waktu jendela (ISO UTC). */
export interface Jendela {
  kunci: string;
  mulai: string;
  kedaluwarsa: string;
}

/** Hasil cek batas: diizinkan + hitungan saat ini. */
export interface StatusBatas {
  diizinkan: boolean;
  terpakai: number;
  batas: number;
  sisa: number;
}

/**
 * Jendela harian UTC untuk cakupan+subjek: kunci
 * "cakupan:subjek:2026-11-18", kedaluwarsa 00:00 UTC berikutnya.
 */
export function jendelaHarian(
  cakupan: string,
  subjek: string,
  sekarang = new Date(),
): Jendela {
  const hari = sekarang.toISOString().slice(0, 10);
  const besok = new Date(Date.UTC(
    sekarang.getUTCFullYear(),
    sekarang.getUTCMonth(),
    sekarang.getUTCDate() + 1,
  ));
  return {
    kunci: `${cakupan}:${subjek}:${hari}`,
    mulai: `${hari}T00:00:00.000Z`,
    kedaluwarsa: besok.toISOString(),
  };
}

/**
 * Jendela satu menit UTC untuk cakupan+subjek: kunci
 * "cakupan:subjek:2026-11-18T00:00", kedaluwarsa +60 detik.
 */
export function jendelaMenit(
  cakupan: string,
  subjek: string,
  sekarang = new Date(),
): Jendela {
  const menit = sekarang.toISOString().slice(0, 16);
  const awal = new Date(Date.UTC(
    sekarang.getUTCFullYear(),
    sekarang.getUTCMonth(),
    sekarang.getUTCDate(),
    sekarang.getUTCHours(),
    sekarang.getUTCMinutes(),
  ));
  return {
    kunci: `${cakupan}:${subjek}:${menit}`,
    mulai: awal.toISOString(),
    kedaluwarsa: new Date(awal.getTime() + 60_000).toISOString(),
  };
}

/** Detik dari sekarang sampai kedaluwarsa jendela (minimal 1). */
export function detikSampaiKedaluwarsa(jendela: Jendela, sekarang = new Date()): number {
  const sisaMs = Date.parse(jendela.kedaluwarsa) - sekarang.getTime();
  return Math.max(1, Math.ceil(sisaMs / 1000));
}

/** SQL pembuatan tabel rate_limits (identik dengan migrasi 0004). */
const SQL_BUAT_TABEL = `CREATE TABLE IF NOT EXISTS rate_limits (
  kunci TEXT PRIMARY KEY,
  jumlah INTEGER NOT NULL DEFAULT 0,
  jendela_mulai TEXT NOT NULL,
  kedaluwarsa_pada TEXT NOT NULL
)`;

/** Membuat tabel rate_limits bila belum ada (pembuatan malas). */
async function pastikanTabelRateLimit(db: DbD1): Promise<void> {
  await db.prepare(SQL_BUAT_TABEL).run();
  await db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_rate_limits_kedaluwarsa ON rate_limits (kedaluwarsa_pada)',
    )
    .run();
}

function pesanGalat(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Membaca hitungan kunci; bila tabel belum ada, buat lalu baca ulang sekali. */
async function bacaJumlah(db: DbD1, kunci: string): Promise<number> {
  try {
    const baris = await db
      .prepare('SELECT jumlah FROM rate_limits WHERE kunci = ?')
      .bind(kunci)
      .first<{ jumlah: number }>();
    return baris?.jumlah ?? 0;
  } catch (err) {
    if (!pesanGalat(err).includes('no such table')) throw err;
    await pastikanTabelRateLimit(db);
    const baris = await db
      .prepare('SELECT jumlah FROM rate_limits WHERE kunci = ?')
      .bind(kunci)
      .first<{ jumlah: number }>();
    return baris?.jumlah ?? 0;
  }
}

/**
 * Memeriksa batas dan mencatat satu pemakaian secara ATOMIK
 * (R-03): (1) INSERT OR IGNORE membuat baris jendela bila belum
 * ada (jumlah awal 0); (2) UPDATE bersyarat menaikkan hitungan
 * hanya bila masih di bawah batas — database yang memutuskan
 * lewat meta.changes, sehingga tepat `batas` permintaan paralel
 * yang diizinkan dan tidak ada over-rejection; (3) SELECT membaca
 * hitungan akhir untuk status. Permintaan yang ditolak TIDAK
 * menambah hitungan. Melempar bila D1 gagal (pemanggil
 * memutuskan: 503 untuk endpoint data, fail-open dengan log untuk
 * OAuth — lihat routes auth).
 */
export async function cekDanCatat(
  db: DbD1,
  jendela: Jendela,
  batas: number,
): Promise<StatusBatas> {
  const siapkanBaris = async (): Promise<number> => {
    const hasil = await db
      .prepare(
        `INSERT OR IGNORE INTO rate_limits (kunci, jumlah, jendela_mulai, kedaluwarsa_pada)
         VALUES (?, 0, ?, ?)`,
      )
      .bind(jendela.kunci, jendela.mulai, jendela.kedaluwarsa)
      .run();
    const meta = hasil.meta as { changes?: number } | undefined;
    return meta?.changes ?? 0;
  };
  let barisBaru: number;
  try {
    barisBaru = await siapkanBaris();
  } catch (err) {
    // Tabel belum ada (database lama tanpa migrasi 0004): buat lalu
    // coba sekali lagi. Galat lain diteruskan ke pemanggil.
    if (!pesanGalat(err).includes('no such table')) throw err;
    await pastikanTabelRateLimit(db);
    barisBaru = await siapkanBaris();
  }
  const hasilNaik = await db
    .prepare(
      'UPDATE rate_limits SET jumlah = jumlah + 1 WHERE kunci = ? AND jumlah < ?',
    )
    .bind(jendela.kunci, batas)
    .run();
  const metaNaik = hasilNaik.meta as { changes?: number } | undefined;
  const diizinkan = (metaNaik?.changes ?? 0) === 1;
  const terpakai = await bacaJumlah(db, jendela.kunci);
  if (barisBaru === 1) {
    // Kunci baru dibuat: pemicu pembersihan malas baris kedaluwarsa.
    await bersihkanBatasKedaluwarsa(db, new Date());
  }
  if (!diizinkan) {
    return { diizinkan: false, terpakai, batas, sisa: 0 };
  }
  return { diizinkan: true, terpakai, batas, sisa: batas - terpakai };
}

/** Jumlah maksimal baris kedaluwarsa yang dibersihkan per pemicu. */
export const BATAS_BERSIH_KEDALUWARSA = 100;

/**
 * Menghapus baris rate_limits yang sudah kedaluwarsa (maksimal
 * BATAS_BERSIH_KEDALUWARSA baris). Best-effort: kegagalan apa pun
 * ditelan — pembersihan tidak boleh menggagalkan permintaan.
 * Dipanggil dari cekDanCatat saat kunci baru dibuat (R-15).
 */
export async function bersihkanBatasKedaluwarsa(
  db: DbD1,
  sekarang: Date = new Date(),
): Promise<number> {
  try {
    const kedaluwarsa = await db
      .prepare(
        'SELECT kunci FROM rate_limits WHERE kedaluwarsa_pada < ? LIMIT ?',
      )
      .bind(sekarang.toISOString(), BATAS_BERSIH_KEDALUWARSA)
      .all<{ kunci: string }>();
    const daftar = (kedaluwarsa.results ?? [])
      .map((baris) => baris.kunci)
      .filter((kunci): kunci is string => typeof kunci === 'string');
    if (daftar.length === 0) {
      return 0;
    }
    const placeholder = daftar.map(() => '?').join(', ');
    const hasil = await db
      .prepare(`DELETE FROM rate_limits WHERE kunci IN (${placeholder})`)
      .bind(...daftar)
      .run();
    const meta = hasil.meta as { changes?: number } | undefined;
    return meta?.changes ?? daftar.length;
  } catch {
    return 0;
  }
}

/** Lingkungan minimal middleware batas laju: D1 + variabel auth. */
type EnvBatas = {
  Bindings: { DB: DbD1 };
  Variables: VariabelAuth;
};

/**
 * Middleware batas laju kontrak bagian 0.7 untuk router yang sudah
 * diautentikasi (authMiddleware berjalan lebih dulu): mutasi
 * (POST/PATCH/PUT/DELETE) dibatasi 60/menit, GET 300/menit, per
 * pengguna. Tanpa pengguna terautentikasi (tidak seharusnya
 * terjadi di router data), permintaan diteruskan — lapisan auth
 * yang menolaknya. D1 gagal -> 503 DATABASE_SIBUK; batas tercapai
 * -> 429 RATE_LIMITED + header Retry-After.
 */
export const batasLaju = createMiddleware<EnvBatas>(async (c, next) => {
  const userId = getUserId(c);
  if (!userId) {
    await next();
    return;
  }
  const metode = c.req.method;
  const apakahMutasi =
    metode === 'POST' || metode === 'PATCH' || metode === 'PUT' || metode === 'DELETE';
  const sekarang = new Date();
  const jendela = jendelaMenit(apakahMutasi ? 'tulis' : 'baca', userId, sekarang);
  const batas = apakahMutasi ? BATAS_TULIS_PER_MENIT : BATAS_BACA_PER_MENIT;
  let status: StatusBatas;
  try {
    status = await cekDanCatat(c.env.DB, jendela, batas);
  } catch {
    return balasGagal(
      c,
      new ApiError(503, 'DATABASE_SIBUK', 'Server sedang sibuk, coba lagi nanti.'),
    );
  }
  if (!status.diizinkan) {
    return balasGagal(c, terlaluSering(detikSampaiKedaluwarsa(jendela, sekarang)));
  }
  await next();
});

/** Mencatat pemakaian ekspor akun; dipakai handler ekspor (5/hari). */
export async function catatEkspor(
  db: DbD1,
  userId: string,
  sekarang = new Date(),
): Promise<{ status: StatusBatas; jendela: Jendela }> {
  const jendela = jendelaHarian('ekspor', userId, sekarang);
  const status = await cekDanCatat(db, jendela, BATAS_EKSPOR_PER_HARI);
  return { status, jendela };
}
