// apps/api/src/auth/pin.ts
// PIN aplikasi Dokter HP Web App (4-8 digit, cermin APK).
//
// Penyimpanan:
// - PIN asli TIDAK PERNAH disimpan. Yang disimpan di tabel users
//   adalah HMAC-SHA256(pepper, "salt:pin") (hex) beserta salt acak
//   16 byte (hex) di kolom pin_hash / pin_salt. Pepper berasal dari
//   secret Worker PIN_PEPPER (K-71) dan TIDAK ADA di D1, sehingga
//   hash tidak dapat di-brute-force hanya dari bocoran database.
//   Bila PIN_PEPPER tidak diatur, operasi PIN gagal tertutup (500).
// - Percobaan gagal dicatat di D1 pada tabel pin_attempts
//   (user_id, gagal_berturut, terkunci_sampai). Setelah 5 kali
//   salah berturut-turut, masukan PIN dikunci 30 detik. Penghitung
//   dinaikkan dengan increment atomik satu pernyataan SQL (R-04).
// - Status "sesi sudah dibuka dengan PIN" dicatat di D1 pada tabel
//   pin_unlocks (session_id, dibuka_pada). Sesi dianggap terkunci
//   bila pengguna sudah mengatur PIN tetapi sesinya belum punya
//   penanda buka. Penanda yang sesinya sudah tidak ada atau sudah
//   kedaluwarsa disapu secara malas (best-effort, maks 100 per
//   pemicu) setiap kali penanda baru dibuat — R-15.
//
// Kedua tabel tambahan ini dibuat otomatis oleh fungsi
// pastikanTabelPin (CREATE TABLE IF NOT EXISTS) sebelum operasi
// PIN berjalan, sehingga fitur PIN bekerja tanpa migrasi manual.
// Keduanya juga diformalkan di migrasi 0004 (K-48).
//
// Catatan: migrasi 0001_init.sql tidak menyediakan kolom
// pin_gagal_berturut / pin_terkunci_sampai di tabel users maupun
// kolom terkunci di tabel sessions (kolom-kolom itu hanya ada di
// draf ARCHITECTURE.md). Karena itu modul ini memakai dua tabel
// kecil di atas, bukan kolom tambahan.

import {
  bandingkanStringAman,
  bytesKeHex,
  hmacSha256Hex,
  type DbD1,
} from './session';

/** Panjang PIN minimum (digit). */
export const PIN_PANJANG_MIN = 4;

/** Panjang PIN maksimum (digit). */
export const PIN_PANJANG_MAKS = 8;

/** Jumlah percobaan salah berturut-turut sebelum PIN dikunci. */
export const PIN_MAKS_GAGAL = 5;

/** Lama penguncian PIN dalam detik setelah batas salah tercapai. */
export const PIN_KUNCI_DETIK = 30;

/** Panjang salt PIN dalam byte (disimpan sebagai hex 32 karakter). */
const PANJANG_SALT_BYTE = 16;

/**
 * Masa tenggang autentikasi baru dalam milidetik (10 menit).
 * Dipakai K-70 (reset PIN dari sesi terkunci setelah login Google
 * segar) dan K-72 (hapus akun setelah login Google / buka PIN
 * segar).
 */
export const TENGGANG_AUTENTIKASI_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Validasi format, hash, dan verifikasi (fungsi murni — tanpa D1)
// ---------------------------------------------------------------------------

/**
 * Memeriksa format PIN: string berisi 4 sampai 8 digit angka saja.
 * Hanya format — PIN lemah (digit sama/berurutan) ditolak terpisah
 * oleh apakahPinLemah pada alur atur PIN, agar PIN lama yang sudah
 * tersimpan tetap bisa diverifikasi.
 */
export function validasiFormatPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^[0-9]{4,8}$/.test(pin);
}

/**
 * Memeriksa apakah PIN lemah dan mudah ditebak (R-11, K-70d):
 * semua digit sama (0000, 9999) atau berurutan naik/turun ketat
 * (1234, 4321, 012345). PIN yang bukan format valid dianggap
 * lemah (penolakan ganda tidak berbahaya).
 */
export function apakahPinLemah(pin: unknown): boolean {
  if (!validasiFormatPin(pin)) {
    return true;
  }
  const digit = pin.split('').map((d) => Number.parseInt(d, 10));
  const semuaSama = digit.every((d) => d === digit[0]);
  if (semuaSama) {
    return true;
  }
  let naik = true;
  let turun = true;
  for (let i = 1; i < digit.length; i++) {
    if (digit[i] !== digit[i - 1] + 1) naik = false;
    if (digit[i] !== digit[i - 1] - 1) turun = false;
  }
  return naik || turun;
}

/** Membuat salt acak 16 byte (hex 32 karakter). */
export function buatSaltPin(): string {
  const bytes = new Uint8Array(PANJANG_SALT_BYTE);
  crypto.getRandomValues(bytes);
  return bytesKeHex(bytes);
}

/**
 * Menghitung hash PIN: HMAC-SHA256(pepper, "salt:pin") (hex).
 * Pepper WAJIB diisi — string kosong/undefined melempar galat
 * (fail-closed, K-71). Format ini harus sama di simpan dan
 * verifikasi.
 */
export async function hashPin(
  pin: string,
  salt: string,
  pepper: string | null | undefined,
): Promise<string> {
  if (!pepper) {
    throw new Error('PIN_PEPPER tidak diatur');
  }
  return hmacSha256Hex(pepper, `${salt}:${pin}`);
}

/**
 * Memverifikasi PIN terhadap salt dan hash yang tersimpan.
 * Mengembalikan false bila salt/hash kosong atau PIN tidak cocok.
 * Melempar bila pepper tidak diatur (fail-closed, K-71).
 */
export async function verifikasiPin(
  pin: string,
  salt: string | null,
  hashTersimpan: string | null,
  pepper: string | null | undefined,
): Promise<boolean> {
  if (!salt || !hashTersimpan) {
    return false;
  }
  const hashHitung = await hashPin(pin, salt, pepper);
  return bandingkanStringAman(hashHitung, hashTersimpan);
}

// ---------------------------------------------------------------------------
// Logika penguncian (fungsi murni — tanpa D1)
// ---------------------------------------------------------------------------

/**
 * Memeriksa apakah PIN sedang terkunci berdasarkan waktu
 * terkunci_sampai yang tersimpan (ISO 8601). Null berarti tidak
 * terkunci.
 */
export function apakahPinTerkunci(
  pinTerkunciSampai: string | null | undefined,
  sekarang: Date = new Date(),
): boolean {
  if (!pinTerkunciSampai) {
    return false;
  }
  return new Date(pinTerkunciSampai).getTime() > sekarang.getTime();
}

/**
 * Sisa waktu kunci dalam detik (dibulatkan ke atas). Nol bila
 * tidak terkunci.
 */
export function sisaDetikKunci(
  pinTerkunciSampai: string | null | undefined,
  sekarang: Date = new Date(),
): number {
  if (!pinTerkunciSampai) {
    return 0;
  }
  const sisaMs = new Date(pinTerkunciSampai).getTime() - sekarang.getTime();
  return sisaMs > 0 ? Math.ceil(sisaMs / 1000) : 0;
}

export interface HasilPercobaanGagal {
  /** Jumlah gagal berturut-turut setelah percobaan ini. */
  gagalBaru: number;
  /** True bila percobaan ini mencapai batas dan mengunci PIN. */
  terkunci: boolean;
  /** Waktu kunci berakhir (ISO 8601) bila terkunci; null bila tidak. */
  terkunciSampai: string | null;
}

/**
 * Memeriksa apakah satu waktu (ISO 8601) masih dalam masa tenggang
 * autentikasi baru (bawaan 10 menit, K-70/K-72). Null / tidak valid
 * berarti di luar tenggang.
 */
export function apakahWaktuDalamTenggang(
  waktuIso: string | null | undefined,
  sekarang: Date = new Date(),
  tenggangMs: number = TENGGANG_AUTENTIKASI_MS,
): boolean {
  if (!waktuIso) {
    return false;
  }
  const waktu = Date.parse(waktuIso);
  if (!Number.isFinite(waktu)) {
    return false;
  }
  const selisih = sekarang.getTime() - waktu;
  return selisih >= 0 && selisih <= tenggangMs;
}

/**
 * Menghitung hasil satu percobaan PIN yang salah: menaikkan
 * penghitung dan, bila mencapai PIN_MAKS_GAGAL, mengunci selama
 * PIN_KUNCI_DETIK.
 */
export function tentukanHasilPercobaanGagal(
  gagalSekarang: number,
  sekarang: Date = new Date(),
): HasilPercobaanGagal {
  const gagalBaru = gagalSekarang + 1;
  if (gagalBaru >= PIN_MAKS_GAGAL) {
    return {
      gagalBaru,
      terkunci: true,
      terkunciSampai: new Date(sekarang.getTime() + PIN_KUNCI_DETIK * 1000).toISOString(),
    };
  }
  return { gagalBaru, terkunci: false, terkunciSampai: null };
}

// ---------------------------------------------------------------------------
// Tabel pendukung PIN di D1
// ---------------------------------------------------------------------------

/**
 * Membuat tabel pin_attempts dan pin_unlocks bila belum ada.
 * Idempotent dan aman dipanggil berulang (CREATE TABLE IF NOT EXISTS).
 * Dipanggil oleh rute PIN sebelum operasi PIN berjalan.
 */
export async function pastikanTabelPin(db: DbD1): Promise<void> {
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS pin_attempts (' +
        'user_id TEXT PRIMARY KEY, ' +
        'gagal_berturut INTEGER NOT NULL DEFAULT 0, ' +
        'terkunci_sampai TEXT)',
    )
    .run();
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS pin_unlocks (' +
        'session_id TEXT PRIMARY KEY, ' +
        'dibuka_pada TEXT NOT NULL)',
    )
    .run();
}

// ---------------------------------------------------------------------------
// Operasi PIN di D1
// ---------------------------------------------------------------------------

export interface StatusPin {
  /** True bila pengguna sudah mengatur PIN. */
  pinDiatur: boolean;
  /** Hash PIN yang tersimpan (null bila belum diatur). */
  pinHash: string | null;
  /** Salt PIN yang tersimpan (null bila belum diatur). */
  pinSalt: string | null;
  /** Jumlah percobaan salah berturut-turut saat ini. */
  gagalBerturut: number;
  /** Waktu kunci berakhir (ISO 8601) atau null bila tidak terkunci. */
  terkunciSampai: string | null;
}

/**
 * Mengambil status PIN pengguna: hash/salt dari tabel users dan
 * penghitung gagal dari tabel pin_attempts. Mengembalikan null
 * bila pengguna tidak ditemukan.
 */
export async function ambilStatusPin(
  db: DbD1,
  idPengguna: string,
): Promise<StatusPin | null> {
  const pengguna = await db
    .prepare('SELECT pin_hash, pin_salt FROM users WHERE id = ?')
    .bind(idPengguna)
    .first<{ pin_hash: string | null; pin_salt: string | null }>();
  if (!pengguna) {
    return null;
  }
  const percobaan = await db
    .prepare('SELECT gagal_berturut, terkunci_sampai FROM pin_attempts WHERE user_id = ?')
    .bind(idPengguna)
    .first<{ gagal_berturut: number | null; terkunci_sampai: string | null }>();
  return {
    pinDiatur: pengguna.pin_hash !== null,
    pinHash: pengguna.pin_hash,
    pinSalt: pengguna.pin_salt,
    gagalBerturut: percobaan?.gagal_berturut ?? 0,
    terkunciSampai: percobaan?.terkunci_sampai ?? null,
  };
}

/**
 * Menyimpan PIN baru (atau mengubah PIN lama): membuat salt acak,
 * menghitung hash ber-pepper, lalu memperbarui tabel users dan
 * mereset penghitung gagal. Melempar Error bila format PIN tidak
 * valid, bila PIN lemah (K-70d), atau bila pepper tidak diatur.
 */
export async function simpanPin(
  db: DbD1,
  idPengguna: string,
  pin: string,
  pepper: string | null | undefined,
): Promise<void> {
  if (!validasiFormatPin(pin)) {
    throw new Error('Format PIN tidak valid');
  }
  if (apakahPinLemah(pin)) {
    throw new Error('PIN terlalu mudah ditebak');
  }
  const salt = buatSaltPin();
  const hash = await hashPin(pin, salt, pepper);
  await db
    .prepare('UPDATE users SET pin_hash = ?, pin_salt = ? WHERE id = ?')
    .bind(hash, salt, idPengguna)
    .run();
  await resetPinGagal(db, idPengguna);
}

/**
 * Menghapus PIN pengguna: mengosongkan hash/salt di tabel users
 * dan mereset penghitung gagal.
 */
export async function hapusPin(db: DbD1, idPengguna: string): Promise<void> {
  await db
    .prepare('UPDATE users SET pin_hash = NULL, pin_salt = NULL WHERE id = ?')
    .bind(idPengguna)
    .run();
  await resetPinGagal(db, idPengguna);
}

/**
 * Mencatat satu percobaan PIN yang salah ke D1 dan mengembalikan
 * hasil penghitungannya, termasuk apakah percobaan ini mengunci
 * PIN. Increment dilakukan ATOMIK di database (R-04): satu
 * pernyataan INSERT ... ON CONFLICT DO UPDATE menaikkan
 * gagal_berturut, lalu nilai sesudah increment dibaca kembali.
 * Bila penghitung mencapai batas (atau sudah melewatinya tetapi
 * kunci sebelumnya sudah kedaluwarsa), waktu kunci baru ditulis.
 * Tidak ada pembacaan penghitung sebelum increment — pemanggil
 * tidak lagi mengoper nilai lama yang bisa basi.
 */
export async function catatPinGagal(
  db: DbD1,
  idPengguna: string,
  sekarang: Date = new Date(),
): Promise<HasilPercobaanGagal> {
  await db
    .prepare(
      'INSERT INTO pin_attempts (user_id, gagal_berturut, terkunci_sampai) ' +
        'VALUES (?, 1, NULL) ' +
        'ON CONFLICT(user_id) DO UPDATE SET ' +
        'gagal_berturut = pin_attempts.gagal_berturut + 1',
    )
    .bind(idPengguna)
    .run();
  const baris = await db
    .prepare('SELECT gagal_berturut, terkunci_sampai FROM pin_attempts WHERE user_id = ?')
    .bind(idPengguna)
    .first<{ gagal_berturut: number | null; terkunci_sampai: string | null }>();
  const gagalBaru = baris?.gagal_berturut ?? 1;
  // Kunci bila batas tercapai. Penulisan waktu kunci dijaga kondisi
  // atomik (hanya bila belum ada kunci aktif) dan meta.changes yang
  // memutuskan pemanggil mana yang mengunci — pada burst paralel,
  // tepat satu pemanggil yang mengembalikan terkunci: true.
  if (gagalBaru >= PIN_MAKS_GAGAL) {
    const hasil = tentukanHasilPercobaanGagal(gagalBaru - 1, sekarang);
    const pembaruan = await db
      .prepare(
        'UPDATE pin_attempts SET terkunci_sampai = ? WHERE user_id = ? ' +
          'AND (terkunci_sampai IS NULL OR terkunci_sampai <= ?)',
      )
      .bind(hasil.terkunciSampai, idPengguna, sekarang.toISOString())
      .run();
    const meta = pembaruan.meta as { changes?: number } | undefined;
    if ((meta?.changes ?? 0) === 1) {
      return hasil;
    }
    // Kunci sudah diatur pemanggil lain (atau masih aktif).
    return { gagalBaru, terkunci: false, terkunciSampai: null };
  }
  return { gagalBaru, terkunci: false, terkunciSampai: null };
}

/**
 * Mereset penghitung gagal pengguna (dipakai setelah PIN benar
 * dimasukkan, atau setelah PIN diatur/diubah/dihapus).
 */
export async function resetPinGagal(db: DbD1, idPengguna: string): Promise<void> {
  await db.prepare('DELETE FROM pin_attempts WHERE user_id = ?').bind(idPengguna).run();
}

// ---------------------------------------------------------------------------
// Penanda "sesi sudah dibuka dengan PIN" (tabel pin_unlocks)
// ---------------------------------------------------------------------------

/**
 * Menandai satu sesi sebagai sudah dibuka dengan PIN. HANYA
 * dipanggil setelah PIN benar diverifikasi (/pin/verify) —
 * /pin/set TIDAK PERNAH membuka sesi (K-70b). Penanda baru yang
 * dibuat sekaligus menjadi pemicu pembersihan malas penanda yatim
 * (R-15, lihat bersihkanPinUnlocksYatim).
 */
export async function tandaiSesiTerbuka(
  db: DbD1,
  idSesi: string,
  sekarang: Date = new Date(),
): Promise<void> {
  await db
    .prepare('INSERT OR REPLACE INTO pin_unlocks (session_id, dibuka_pada) VALUES (?, ?)')
    .bind(idSesi, sekarang.toISOString())
    .run();
  // Pembersihan malas (R-15): best-effort, tidak pernah melempar.
  await bersihkanPinUnlocksYatim(db, sekarang);
}

/** Jumlah maksimal baris pin_unlocks yang disapu per pemicu pembersihan malas. */
export const BATAS_BERSIH_PIN_UNLOCKS = 100;

/**
 * Menghapus penanda buka PIN yang yatim (R-15): baris pin_unlocks
 * yang sesinya sudah tidak ada di tabel sessions atau sudah
 * kedaluwarsa (expires_at <= sekarang). Pembersihan malas
 * best-effort mengikuti pola bersihkanBatasKedaluwarsa di
 * lib/ratelimit: maksimal BATAS_BERSIH_PIN_UNLOCKS baris per
 * pemicu (yang tertua dulu), kegagalan apa pun ditelan dan
 * mengembalikan 0 — pembersihan tidak pernah menggagalkan
 * permintaan. Mengembalikan jumlah baris yang dihapus.
 */
export async function bersihkanPinUnlocksYatim(
  db: DbD1,
  sekarang: Date = new Date(),
): Promise<number> {
  try {
    const kandidat = await db
      .prepare(
        'SELECT session_id FROM pin_unlocks ORDER BY dibuka_pada ASC LIMIT ?',
      )
      .bind(BATAS_BERSIH_PIN_UNLOCKS)
      .all<{ session_id: string }>();
    const daftar = (kandidat.results ?? [])
      .map((baris) => baris.session_id)
      .filter((id): id is string => typeof id === 'string');
    if (daftar.length === 0) {
      return 0;
    }
    const placeholder = daftar.map(() => '?').join(', ');
    const sesi = await db
      .prepare(`SELECT id, expires_at FROM sessions WHERE id IN (${placeholder})`)
      .bind(...daftar)
      .all<{ id: string; expires_at: string | null }>();
    const masihHidup = new Set<string>();
    for (const baris of sesi.results ?? []) {
      if (typeof baris.id !== 'string') {
        continue;
      }
      const kedaluwarsa = baris.expires_at ? Date.parse(baris.expires_at) : NaN;
      // expires_at tidak valid: pertahankan penanda (arah aman —
      // data rusak tidak boleh menghapus penanda sesi yang hidup).
      if (!Number.isFinite(kedaluwarsa) || kedaluwarsa > sekarang.getTime()) {
        masihHidup.add(baris.id);
      }
    }
    const yatim = daftar.filter((id) => !masihHidup.has(id));
    if (yatim.length === 0) {
      return 0;
    }
    const placeholderYatim = yatim.map(() => '?').join(', ');
    const hasil = await db
      .prepare(`DELETE FROM pin_unlocks WHERE session_id IN (${placeholderYatim})`)
      .bind(...yatim)
      .run();
    const meta = hasil.meta as { changes?: number } | undefined;
    return meta?.changes ?? yatim.length;
  } catch {
    return 0;
  }
}

/**
 * Mengambil waktu buka PIN satu sesi (ISO 8601) dari pin_unlocks,
 * atau null bila sesi belum pernah dibuka dengan PIN / tabel belum
 * ada. Dipakai K-72 (hapus akun wajib autentikasi baru ≤ 10 menit).
 */
export async function ambilWaktuBukaSesi(
  db: DbD1,
  idSesi: string,
): Promise<string | null> {
  try {
    const baris = await db
      .prepare('SELECT dibuka_pada FROM pin_unlocks WHERE session_id = ?')
      .bind(idSesi)
      .first<{ dibuka_pada: string | null }>();
    return baris?.dibuka_pada ?? null;
  } catch {
    return null;
  }
}

/**
 * Memeriksa apakah satu sesi sudah dibuka dengan PIN. Bila tabel
 * belum ada atau query gagal, mengembalikan false (gagal tertutup:
 * sesi dianggap terkunci — arah yang aman untuk gerbang kunci).
 */
export async function apakahSesiTerbuka(db: DbD1, idSesi: string): Promise<boolean> {
  try {
    const baris = await db
      .prepare('SELECT session_id FROM pin_unlocks WHERE session_id = ?')
      .bind(idSesi)
      .first<{ session_id: string }>();
    return baris !== null;
  } catch {
    return false;
  }
}

/**
 * Menghapus penanda buka satu sesi (dipakai saat keluar).
 */
export async function hapusTandaSesiTerbuka(db: DbD1, idSesi: string): Promise<void> {
  await db.prepare('DELETE FROM pin_unlocks WHERE session_id = ?').bind(idSesi).run();
}

/**
 * Memeriksa apakah satu sesi terkunci oleh gerbang PIN: terkunci
 * bila pengguna sudah mengatur PIN tetapi sesi ini belum dibuka
 * dengan PIN. Bila pengguna belum mengatur PIN, sesi tidak pernah
 * terkunci.
 */
export async function apakahSesiTerkunci(
  db: DbD1,
  idSesi: string,
  pinDiatur: boolean,
): Promise<boolean> {
  if (!pinDiatur) {
    return false;
  }
  return !(await apakahSesiTerbuka(db, idSesi));
}
