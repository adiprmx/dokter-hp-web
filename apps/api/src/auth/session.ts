// apps/api/src/auth/session.ts
// Manajemen sesi login Dokter HP Web App (Cloudflare Worker + D1).
//
// Skema yang dipakai adalah migrasi nyata apps/api/migrations:
//   0001_init.sql:
//     users(id, email UNIQUE, nama, provider, pin_hash, pin_salt, dibuat_pada)
//     sessions(id, user_id, token_hash UNIQUE, expires_at, dibuat_pada)
//   0004_pin_rate_sessions.sql menambah kolom sessions.user_agent
//   dan sessions.ip_terakhir (K-44).
// Kolom dibuat_pada TIDAK punya nilai bawaan di migrasi, jadi semua
// INSERT di modul ini mengisi dibuat_pada secara eksplisit.
//
// Prinsip keamanan:
// - Token sesi mentah (32 byte acak) TIDAK PERNAH disimpan di D1.
//   Yang disimpan hanya SHA-256 hex dari token.
// - Token mentah hanya ada di cookie HttpOnly pengguna.
// - Cookie: __Host- prefix, HttpOnly, Secure, SameSite=None,
//   Path=/, Max-Age 30 hari (prefix __Host- mensyaratkan Path=/
//   + Secure + tanpa atribut Domain — ketiganya dipenuhi).
// - Sesi kedaluwarsa 30 hari sejak dibuat.
// - Maksimal 10 sesi aktif per pengguna (R-22); sesi terlama
//   dicabut otomatis saat login baru melewati batas.
//
// Catatan SameSite (keputusan koordinator K-50): frontend (Cloudflare
// Pages) dan API (Cloudflare Workers) berada di domain registrable
// yang berbeda, sehingga cookie sesi WAJIB SameSite=None agar
// terkirim pada fetch lintas situs; Secure wajib menyertainya.
// Cookie OAuth (state/verifier/redirect) TETAP SameSite=Lax karena
// hanya dipakai dalam alur redirect di domain API sendiri — rute
// auth mengesetnya secara eksplisit (lihat routes.ts).
//
// Modul ini juga memuat tipe EnvAuth (binding Worker yang dibutuhkan
// modul auth), tipe baris D1, dan helper kriptografi bersama (SHA-256)
// untuk modul auth lain.

/**
 * Antarmuka minimal binding D1 yang dibutuhkan modul ini. Bentuk ini
 * mengikuti D1Database / D1PreparedStatement Cloudflare, dipersempit
 * agar mudah diuji dengan mock dan tidak bergantung pada paket
 * tipe Workers di modul ini. Pola yang sama dipakai modul ai
 * (lihat src/ai/ratelimit.ts).
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

/**
 * Binding Worker yang dibutuhkan modul auth. Nilai-nilai ini berasal
 * dari secret Worker (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * PIN_PEPPER) dan variabel Worker (GOOGLE_REDIRECT_URI,
 * FRONTEND_URL) — tidak pernah dari kode dan tidak pernah dari
 * repo. Tim integrasi wajib menambahkan nama-nama ini ke
 * src/env.d.ts dan Bindings di src/index.ts saat menyambung
 * router auth.
 */
export interface EnvAuth {
  /** Binding D1 (database dokter-hp-db). */
  DB: DbD1;
  /** Client ID Google OAuth (secret Worker GOOGLE_CLIENT_ID). */
  GOOGLE_CLIENT_ID: string;
  /** Client secret Google OAuth (secret Worker GOOGLE_CLIENT_SECRET). */
  GOOGLE_CLIENT_SECRET: string;
  /** Redirect URI yang terdaftar di Google Cloud Console. */
  GOOGLE_REDIRECT_URI: string;
  /** Asal frontend (misalnya https://dokter-hp.pages.dev). */
  FRONTEND_URL: string;
  /**
   * Pepper server untuk hash PIN (secret Worker PIN_PEPPER,
   * K-71). WAJIB diatur di produksi; operasi PIN gagal tertutup
   * (500) bila tidak diatur. Pengembangan lokal memakai nilai
   * dummy lewat .dev.vars; tes menginjeksi pepper uji.
   */
  PIN_PEPPER?: string;
}

/** Baris tabel users (sesuai migrasi 0001_init.sql). */
export interface BarisPengguna {
  id: string;
  email: string;
  nama: string | null;
  provider: string;
  pin_hash: string | null;
  pin_salt: string | null;
  dibuat_pada: string;
}

/** Baris tabel sessions (0001 + kolom 0004 user_agent/ip_terakhir). */
export interface BarisSesi {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  dibuat_pada: string;
  user_agent: string | null;
  ip_terakhir: string | null;
}

/** Nama cookie sesi (prefix __Host-, R-18). */
export const NAMA_COOKIE_SESI = '__Host-dokter_hp_session';

/** Masa berlaku sesi dalam detik (30 hari). */
export const MASA_BERLAKU_SESI_DETIK = 30 * 24 * 60 * 60;

/**
 * Jumlah maksimal sesi aktif per pengguna (R-22). Saat login baru
 * melewati batas, sesi terlama dicabut otomatis di buatSesi.
 */
export const BATAS_SESI_PER_PENGGUNA = 10;

/** Panjang token sesi mentah dalam byte. */
export const PANJANG_TOKEN_BYTE = 32;

/** Nilai SameSite untuk cookie sesi: None (K-50, lintas domain). */
export const COOKIE_SAME_SITE = 'None';

/** Penyedia identitas untuk masuk Google (kolom users.provider). */
export const PROVIDER_GOOGLE = 'google';

// ---------------------------------------------------------------------------
// Helper kriptografi bersama (Web Crypto — tersedia di Workers dan Node)
// ---------------------------------------------------------------------------

/** Mengubah byte menjadi string hex huruf kecil. */
export function bytesKeHex(bytes: Uint8Array): string {
  let hasil = '';
  for (const b of bytes) {
    hasil += b.toString(16).padStart(2, '0');
  }
  return hasil;
}

/** Mengubah byte menjadi string base64url (tanpa padding). */
export function bytesKeBase64Url(bytes: Uint8Array): string {
  let biner = '';
  for (const b of bytes) {
    biner += String.fromCharCode(b);
  }
  return btoa(biner).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 dari teks UTF-8, dikembalikan sebagai hex huruf kecil. */
export async function hashSha256Hex(teks: string): Promise<string> {
  const data = new TextEncoder().encode(teks);
  const hasil = await crypto.subtle.digest('SHA-256', data);
  return bytesKeHex(new Uint8Array(hasil));
}

/** SHA-256 dari teks UTF-8, dikembalikan sebagai base64url. */
export async function hashSha256Base64Url(teks: string): Promise<string> {
  const data = new TextEncoder().encode(teks);
  const hasil = await crypto.subtle.digest('SHA-256', data);
  return bytesKeBase64Url(new Uint8Array(hasil));
}

/**
 * HMAC-SHA256 dari teks UTF-8 dengan kunci rahasia, dikembalikan
 * sebagai hex huruf kecil. Dipakai hash PIN ber-pepper (K-71):
 * kunci adalah PIN_PEPPER server, sehingga hash di D1 tidak dapat
 * di-brute-force hanya dari bocoran database.
 */
export async function hmacSha256Hex(kunci: string, teks: string): Promise<string> {
  const kunciCrypto = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(kunci),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const hasil = await crypto.subtle.sign(
    'HMAC',
    kunciCrypto,
    new TextEncoder().encode(teks),
  );
  return bytesKeHex(new Uint8Array(hasil));
}

/**
 * Membandingkan dua string tanpa berhenti di perbedaan pertama
 * (mengurangi kebocoran waktu). Mengembalikan false bila panjang
 * berbeda. Dipakai perbandingan hash PIN dan state OAuth (R-18).
 */
export function bandingkanStringAman(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let beda = 0;
  for (let i = 0; i < a.length; i++) {
    beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return beda === 0;
}

// ---------------------------------------------------------------------------
// Token sesi
// ---------------------------------------------------------------------------

/** Membuat token sesi mentah: 32 byte acak dalam base64url (43 karakter). */
export function buatTokenSesi(): string {
  const bytes = new Uint8Array(PANJANG_TOKEN_BYTE);
  crypto.getRandomValues(bytes);
  return bytesKeBase64Url(bytes);
}

/** Menghitung SHA-256 hex dari token sesi mentah (yang disimpan di D1). */
export function hashToken(token: string): Promise<string> {
  return hashSha256Hex(token);
}

// ---------------------------------------------------------------------------
// Cookie
// ---------------------------------------------------------------------------

export interface OpsiCookie {
  /** Max-Age dalam detik; bila tidak diisi, cookie menjadi cookie sesi browser. */
  maxAgeDetik?: number;
  /** Path cookie; bawaan "/". */
  path?: string;
  /** Nilai SameSite; bawaan COOKIE_SAME_SITE. */
  sameSite?: 'Lax' | 'Strict' | 'None';
  /** Atribut Secure; bawaan true. */
  secure?: boolean;
  /** Atribut HttpOnly; bawaan true. */
  httpOnly?: boolean;
}

/** Merakit satu nilai header Set-Cookie dari nama, nilai, dan opsi. */
export function buatCookie(nama: string, nilai: string, opsi: OpsiCookie = {}): string {
  const {
    maxAgeDetik,
    path = '/',
    sameSite = COOKIE_SAME_SITE,
    secure = true,
    httpOnly = true,
  } = opsi;
  const bagian = [`${nama}=${encodeURIComponent(nilai)}`, `Path=${path}`];
  if (typeof maxAgeDetik === 'number') {
    bagian.push(`Max-Age=${maxAgeDetik}`);
  }
  if (httpOnly) {
    bagian.push('HttpOnly');
  }
  if (secure) {
    bagian.push('Secure');
  }
  bagian.push(`SameSite=${sameSite}`);
  return bagian.join('; ');
}

/**
 * Membaca satu nilai cookie dari header Cookie mentah.
 * Mengembalikan null bila header kosong atau cookie tidak ada.
 */
export function bacaNilaiCookie(
  headerCookie: string | null | undefined,
  nama: string,
): string | null {
  if (!headerCookie) {
    return null;
  }
  for (const bagian of headerCookie.split(';')) {
    const potong = bagian.trim().split('=');
    const namaBagian = potong[0];
    if (namaBagian === nama) {
      const nilai = potong.slice(1).join('=').trim();
      if (!nilai) {
        return null;
      }
      try {
        return decodeURIComponent(nilai);
      } catch {
        return nilai;
      }
    }
  }
  return null;
}

/** Membaca token sesi mentah dari header Cookie. */
export function bacaTokenDariCookie(headerCookie: string | null | undefined): string | null {
  return bacaNilaiCookie(headerCookie, NAMA_COOKIE_SESI);
}

/** Merakit cookie sesi (HttpOnly, Secure, SameSite=None, 30 hari). */
export function buatCookieSesi(token: string): string {
  return buatCookie(NAMA_COOKIE_SESI, token, { maxAgeDetik: MASA_BERLAKU_SESI_DETIK });
}

/** Merakit cookie penghapus sesi (Max-Age 0). */
export function buatCookieHapusSesi(): string {
  return buatCookie(NAMA_COOKIE_SESI, '', { maxAgeDetik: 0 });
}

// ---------------------------------------------------------------------------
// Operasi sesi di D1
// ---------------------------------------------------------------------------

export interface OpsiBuatSesi {
  /** ID pengguna pemilik sesi. */
  idPengguna: string;
  /** Waktu pembuatan (untuk pengujian); bawaan waktu saat ini. */
  sekarang?: Date;
  /** Header User-Agent saat sesi dibuat (K-44; null bila tidak ada). */
  userAgent?: string | null;
  /** Alamat IP saat sesi dibuat, dari CF-Connecting-IP (K-44). */
  ipTerakhir?: string | null;
}

export interface HasilBuatSesi {
  /** Baris sesi yang tersimpan (berisi token_hash, bukan token mentah). */
  sesi: BarisSesi;
  /** Token sesi mentah — satu-satunya saat token ini tersedia. */
  token: string;
  /** Waktu kedaluwarsa (ISO 8601). */
  kedaluwarsaPada: string;
}

/**
 * Membuat sesi baru: token acak dibuat, hash-nya disimpan di D1,
 * token mentah dikembalikan kepada pemanggil untuk dipasang sebagai
 * cookie. Token mentah tidak pernah disimpan di mana pun selain
 * cookie pengguna. Setelah menyimpan, sesi terlama pengguna
 * dicabut bila jumlah sesi melewati BATAS_SESI_PER_PENGGUNA
 * (R-22); kegagalan pencabutan tidak menggagalkan pembuatan sesi
 * (best-effort, dicatat ke log).
 */
export async function buatSesi(db: DbD1, opsi: OpsiBuatSesi): Promise<HasilBuatSesi> {
  const sekarang = opsi.sekarang ?? new Date();
  const kedaluwarsa = new Date(sekarang.getTime() + MASA_BERLAKU_SESI_DETIK * 1000);
  const token = buatTokenSesi();
  const tokenHash = await hashToken(token);
  const id = crypto.randomUUID();
  const waktu = sekarang.toISOString();
  const kedaluwarsaIso = kedaluwarsa.toISOString();
  const userAgent = opsi.userAgent ?? null;
  const ipTerakhir = opsi.ipTerakhir ?? null;
  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, dibuat_pada, user_agent, ip_terakhir) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, opsi.idPengguna, tokenHash, kedaluwarsaIso, waktu, userAgent, ipTerakhir)
    .run();
  try {
    await db
      .prepare(
        'DELETE FROM sessions WHERE user_id = ? AND id NOT IN (' +
          'SELECT id FROM sessions WHERE user_id = ? ' +
          'ORDER BY dibuat_pada DESC, id DESC LIMIT ?)',
      )
      .bind(opsi.idPengguna, opsi.idPengguna, BATAS_SESI_PER_PENGGUNA)
      .run();
  } catch (err) {
    console.warn('[session] Pencabutan sesi terlama gagal:', err);
  }
  const sesi: BarisSesi = {
    id,
    user_id: opsi.idPengguna,
    token_hash: tokenHash,
    expires_at: kedaluwarsaIso,
    dibuat_pada: waktu,
    user_agent: userAgent,
    ip_terakhir: ipTerakhir,
  };
  return { sesi, token, kedaluwarsaPada: kedaluwarsaIso };
}

export interface SesiTervalidasi {
  sesi: BarisSesi;
  pengguna: BarisPengguna;
}

/**
 * Memvalidasi token sesi mentah: menghitung hash-nya, mencari sesi
 * di D1, memeriksa masa berlaku, lalu mengambil data pengguna.
 * Mengembalikan null bila token kosong, tidak dikenal, kedaluwarsa,
 * atau penggunanya sudah tidak ada. Sesi yang kedaluwarsa dihapus
 * dari D1 (kegagalan penghapusan diabaikan — sesi tetap ditolak).
 */
export async function validasiSesi(
  db: DbD1,
  token: string | null | undefined,
  sekarang: Date = new Date(),
): Promise<SesiTervalidasi | null> {
  if (!token) {
    return null;
  }
  const tokenHash = await hashToken(token);
  const sesi = await db
    .prepare(
      'SELECT id, user_id, token_hash, expires_at, dibuat_pada, user_agent, ip_terakhir ' +
        'FROM sessions WHERE token_hash = ?',
    )
    .bind(tokenHash)
    .first<BarisSesi>();
  if (!sesi) {
    return null;
  }
  if (new Date(sesi.expires_at).getTime() <= sekarang.getTime()) {
    try {
      await hapusSesi(db, token);
    } catch {
      // Abaikan: sesi kedaluwarsa tetap ditolak.
    }
    return null;
  }
  const pengguna = await db
    .prepare(
      'SELECT id, email, nama, provider, pin_hash, pin_salt, dibuat_pada ' +
        'FROM users WHERE id = ?',
    )
    .bind(sesi.user_id)
    .first<BarisPengguna>();
  if (!pengguna) {
    return null;
  }
  return { sesi, pengguna };
}

/**
 * Menghapus sesi berdasarkan token mentah (dipakai saat keluar).
 * Mengembalikan true bila perintah hapus berjalan.
 */
export async function hapusSesi(db: DbD1, token: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  const hasil = await db
    .prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
  return hasil.success;
}

/**
 * Menghapus satu sesi berdasarkan ID-nya, hanya bila sesi itu milik
 * pengguna yang dimaksud (dipakai fitur "keluar dari sesi lain").
 */
export async function hapusSesiBerdasarkanId(
  db: DbD1,
  idSesi: string,
  idPengguna: string,
): Promise<boolean> {
  const hasil = await db
    .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
    .bind(idSesi, idPengguna)
    .run();
  return hasil.success;
}

/** Sesi untuk ditampilkan di daftar sesi aktif (tanpa token_hash). */
export interface SesiTampil {
  id: string;
  dibuat_pada: string;
  expires_at: string;
}

/**
 * Daftar sesi milik pengguna yang belum kedaluwarsa, terbaru dulu.
 * Token hash tidak pernah dikembalikan: hasil diproyeksikan eksplisit
 * ke id, dibuat_pada, dan expires_at saja.
 */
export async function daftarSesiPengguna(
  db: DbD1,
  idPengguna: string,
  sekarang: Date = new Date(),
): Promise<SesiTampil[]> {
  const hasil = await db
    .prepare(
      'SELECT id, dibuat_pada, expires_at FROM sessions ' +
        'WHERE user_id = ? ORDER BY dibuat_pada DESC',
    )
    .bind(idPengguna)
    .all<SesiTampil>();
  return hasil.results
    .filter((sesi) => new Date(sesi.expires_at).getTime() > sekarang.getTime())
    .map((sesi) => ({
      id: sesi.id,
      dibuat_pada: sesi.dibuat_pada,
      expires_at: sesi.expires_at,
    }));
}
