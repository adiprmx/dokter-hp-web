// apps/api/src/auth/pin.ts
// PIN aplikasi Dokter HP Web App (4-8 digit, cermin APK).
//
// Penyimpanan:
// - PIN asli TIDAK PERNAH disimpan. Yang disimpan di tabel users
//   adalah hash SHA-256 dari "salt:pin" (hex) beserta salt acak
//   16 byte (hex) di kolom pin_hash / pin_salt.
// - Percobaan gagal dicatat di D1 pada tabel pin_attempts
//   (user_id, gagal_berturut, terkunci_sampai). Setelah 5 kali
//   salah berturut-turut, masukan PIN dikunci 30 detik.
// - Status "sesi sudah dibuka dengan PIN" dicatat di D1 pada tabel
//   pin_unlocks (session_id, dibuka_pada). Sesi dianggap terkunci
//   bila pengguna sudah mengatur PIN tetapi sesinya belum punya
//   penanda buka.
//
// Kedua tabel tambahan ini dibuat otomatis oleh fungsi
// pastikanTabelPin (CREATE TABLE IF NOT EXISTS) sebelum operasi
// PIN berjalan, sehingga fitur PIN bekerja tanpa migrasi manual.
// Tim skema tetap disarankan memformalkan keduanya ke migrasi
// 0002 (SQL yang sama persis ada di fungsi pastikanTabelPin) agar
// skema tercatat di folder migrations/.
//
// Catatan: migrasi 0001_init.sql tidak menyediakan kolom
// pin_gagal_berturut / pin_terkunci_sampai di tabel users maupun
// kolom terkunci di tabel sessions (kolom-kolom itu hanya ada di
// draf ARCHITECTURE.md). Karena itu modul ini memakai dua tabel
// kecil di atas, bukan kolom tambahan.

import { bytesKeHex, hashSha256Hex, type DbD1 } from './session';

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

// ---------------------------------------------------------------------------
// Validasi format, hash, dan verifikasi (fungsi murni — tanpa D1)
// ---------------------------------------------------------------------------

/**
 * Memeriksa format PIN: string berisi 4 sampai 8 digit angka saja.
 */
export function validasiFormatPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^[0-9]{4,8}$/.test(pin);
}

/** Membuat salt acak 16 byte (hex 32 karakter). */
export function buatSaltPin(): string {
  const bytes = new Uint8Array(PANJANG_SALT_BYTE);
  crypto.getRandomValues(bytes);
  return bytesKeHex(bytes);
}

/**
 * Menghitung hash PIN: SHA-256 hex dari "salt:pin".
 * Format ini harus sama di simpan dan verifikasi.
 */
export function hashPin(pin: string, salt: string): Promise<string> {
  return hashSha256Hex(`${salt}:${pin}`);
}

/**
 * Membandingkan dua string hash tanpa berhenti di perbedaan pertama
 * (mengurangi kebocoran waktu). Mengembalikan false bila panjang
 * berbeda.
 */
function bandingkanAman(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let beda = 0;
  for (let i = 0; i < a.length; i++) {
    beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return beda === 0;
}

/**
 * Memverifikasi PIN terhadap salt dan hash yang tersimpan.
 * Mengembalikan false bila salt/hash kosong atau PIN tidak cocok.
 */
export async function verifikasiPin(
  pin: string,
  salt: string | null,
  hashTersimpan: string | null,
): Promise<boolean> {
  if (!salt || !hashTersimpan) {
    return false;
  }
  const hashHitung = await hashPin(pin, salt);
  return bandingkanAman(hashHitung, hashTersimpan);
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
 * menghitung hash, lalu memperbarui tabel users dan mereset
 * penghitung gagal. Melempar Error bila format PIN tidak valid.
 */
export async function simpanPin(db: DbD1, idPengguna: string, pin: string): Promise<void> {
  if (!validasiFormatPin(pin)) {
    throw new Error('Format PIN tidak valid');
  }
  const salt = buatSaltPin();
  const hash = await hashPin(pin, salt);
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
 * Mencatat satu percobaan PIN yang salah ke D1 (upsert ke
 * pin_attempts) dan mengembalikan hasil penghitungannya, termasuk
 * apakah percobaan ini mengunci PIN.
 */
export async function catatPinGagal(
  db: DbD1,
  idPengguna: string,
  gagalSekarang: number,
  sekarang: Date = new Date(),
): Promise<HasilPercobaanGagal> {
  const hasil = tentukanHasilPercobaanGagal(gagalSekarang, sekarang);
  await db
    .prepare(
      'INSERT INTO pin_attempts (user_id, gagal_berturut, terkunci_sampai) ' +
        'VALUES (?, ?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET ' +
        'gagal_berturut = excluded.gagal_berturut, ' +
        'terkunci_sampai = excluded.terkunci_sampai',
    )
    .bind(idPengguna, hasil.gagalBaru, hasil.terkunciSampai)
    .run();
  return hasil;
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
 * Menandai satu sesi sebagai sudah dibuka dengan PIN (dipanggil
 * setelah PIN benar diverifikasi, dan setelah PIN baru diatur agar
 * sesi yang sedang berjalan tidak langsung terkunci).
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
