// apps/api/src/auth/google.ts
// Alur masuk Google (OAuth 2.0 authorization code + PKCE S256).
//
// - Penukaran kode terjadi di server (Worker); client secret tidak
//   pernah menyentuh browser.
// - Client ID dan client secret HANYA dibaca dari parameter
//   (berasal dari secret Worker GOOGLE_CLIENT_ID dan
//   GOOGLE_CLIENT_SECRET). File ini tidak menyimpan nilai apa pun.
// - Pengguna dikenali lewat email + provider 'google' (kolom
//   users.email UNIQUE dan users.provider pada migrasi
//   0001_init.sql). Migrasi tersebut tidak memiliki kolom
//   google_sub, jadi email Google yang terverifikasi dipakai
//   sebagai pengenal akun.
// - Timeout panggilan Google: 15 detik.

import { bytesKeBase64Url, hashSha256Base64Url, PROVIDER_GOOGLE, type BarisPengguna, type DbD1 } from './session';

/** Endpoint otorisasi Google. */
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Endpoint penukaran kode Google. */
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Endpoint profil pengguna Google (OpenID Connect userinfo). */
export const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/** Cakupan yang diminta: identitas dasar + email. */
export const GOOGLE_SCOPE = 'openid email profile';

/** Batas waktu panggilan ke Google dalam milidetik. */
export const GOOGLE_TIMEOUT_MS = 15_000;

/** Kode galat internal Google OAuth (tidak diekspos mentah ke client). */
export type KodeGalatGoogle =
  | 'GOOGLE_KONFIGURASI_BELUM_DIATUR'
  | 'GOOGLE_CALLBACK_TIDAK_VALID'
  | 'GOOGLE_DITOLAK'
  | 'GOOGLE_STATE_TIDAK_COCOK'
  | 'GOOGLE_TOKEN_GAGAL'
  | 'GOOGLE_PROFIL_GAGAL';

/**
 * Galat dari alur Google OAuth. Pesan `message` hanya berisi kode
 * (aman untuk log server); pesan untuk pengguna akhir diputuskan
 * di lapisan rute.
 */
export class GalatGoogle extends Error {
  readonly kode: KodeGalatGoogle;

  constructor(kode: KodeGalatGoogle) {
    super(kode);
    this.name = 'GalatGoogle';
    this.kode = kode;
  }
}

// ---------------------------------------------------------------------------
// State + PKCE
// ---------------------------------------------------------------------------

/** Membuat nilai state acak (32 byte, base64url) untuk callback OAuth. */
export function buatStateAcak(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesKeBase64Url(bytes);
}

/** Membuat code_verifier PKCE (32 byte, base64url, 43 karakter). */
export function buatCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesKeBase64Url(bytes);
}

/**
 * Menghitung code_challenge S256 dari code_verifier
 * (SHA-256 base64url). Vektor uji RFC 7636:
 * verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
 * menghasilkan "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM".
 */
export function buatCodeChallenge(codeVerifier: string): Promise<string> {
  return hashSha256Base64Url(codeVerifier);
}

// ---------------------------------------------------------------------------
// URL otorisasi dan penguraian callback
// ---------------------------------------------------------------------------

export interface OpsiUrlAuthGoogle {
  /** Client ID Google OAuth (dari secret Worker). */
  clientId: string;
  /** Redirect URI yang terdaftar di Google Cloud Console. */
  redirectUri: string;
  /** Nilai state acak (disimpan di cookie sementara). */
  state: string;
  /** Code challenge S256 dari code_verifier. */
  codeChallenge: string;
}

/**
 * Membangun URL otorisasi Google (authorization code + PKCE S256).
 */
export function buatUrlAuthGoogle(opsi: OpsiUrlAuthGoogle): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', opsi.clientId);
  url.searchParams.set('redirect_uri', opsi.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', opsi.state);
  url.searchParams.set('code_challenge', opsi.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export interface HasilCallbackGoogle {
  /** Kode otorisasi dari Google. */
  code: string;
  /** Nilai state dari Google (wajib dicocokkan dengan cookie). */
  state: string;
}

/**
 * Mengurai parameter query callback Google. Melempar GalatGoogle
 * berkode GOOGLE_DITOLAK bila pengguna menolak izin di Google
 * (error=access_denied), atau GOOGLE_CALLBACK_TIDAK_VALID bila
 * Google mengembalikan galat lain atau bila code/state tidak ada.
 * Detail galat Google tidak diteruskan.
 */
export function uraiCallbackGoogle(query: URLSearchParams): HasilCallbackGoogle {
  const galat = query.get('error');
  if (galat === 'access_denied') {
    throw new GalatGoogle('GOOGLE_DITOLAK');
  }
  if (galat) {
    throw new GalatGoogle('GOOGLE_CALLBACK_TIDAK_VALID');
  }
  const code = query.get('code');
  const state = query.get('state');
  if (!code || !state) {
    throw new GalatGoogle('GOOGLE_CALLBACK_TIDAK_VALID');
  }
  return { code, state };
}

// ---------------------------------------------------------------------------
// Penukaran kode dan profil (server-side)
// ---------------------------------------------------------------------------

export interface OpsiTukarKode {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  /**
   * Implementasi fetch yang dipakai. Bawaan fetch global.
   * Parameter ini ada untuk pengujian (mock fetch).
   */
  fetchFn?: typeof fetch;
}

/**
 * Menukar kode otorisasi dengan access token di server.
 * Melempar GalatGoogle bila konfigurasi kosong, jaringan gagal,
 * Google menolak kode, atau respons tidak berisi access token.
 */
export async function tukarKodeGoogle(opsi: OpsiTukarKode): Promise<{ accessToken: string }> {
  if (!opsi.clientId || !opsi.clientSecret) {
    throw new GalatGoogle('GOOGLE_KONFIGURASI_BELUM_DIATUR');
  }
  const badan = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opsi.code,
    client_id: opsi.clientId,
    client_secret: opsi.clientSecret,
    redirect_uri: opsi.redirectUri,
    code_verifier: opsi.codeVerifier,
  });
  const fetchFn = opsi.fetchFn ?? fetch;
  let respons: Response;
  try {
    respons = await fetchFn(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: badan.toString(),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch {
    throw new GalatGoogle('GOOGLE_TOKEN_GAGAL');
  }
  if (!respons.ok) {
    throw new GalatGoogle('GOOGLE_TOKEN_GAGAL');
  }
  let data: unknown;
  try {
    data = (await respons.json()) as unknown;
  } catch {
    throw new GalatGoogle('GOOGLE_TOKEN_GAGAL');
  }
  const token = (data as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new GalatGoogle('GOOGLE_TOKEN_GAGAL');
  }
  return { accessToken: token };
}

export interface ProfilGoogle {
  /** Pengenal unik pengguna di Google (sub claim). */
  sub: string;
  /** Email Google yang terverifikasi. */
  email: string;
  /** Nama tampilan (bila Google tidak memberi nama, diisi bagian depan email). */
  nama: string;
}

export interface OpsiAmbilProfil {
  accessToken: string;
  /**
   * Implementasi fetch yang dipakai. Bawaan fetch global.
   * Parameter ini ada untuk pengujian (mock fetch).
   */
  fetchFn?: typeof fetch;
}

/**
 * Mengambil profil pengguna dari endpoint userinfo Google.
 * Melempar GalatGoogle bila panggilan gagal atau profil tidak
 * berisi sub dan email yang valid.
 */
export async function ambilProfilGoogle(opsi: OpsiAmbilProfil): Promise<ProfilGoogle> {
  const fetchFn = opsi.fetchFn ?? fetch;
  let respons: Response;
  try {
    respons = await fetchFn(GOOGLE_USERINFO_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${opsi.accessToken}` },
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch {
    throw new GalatGoogle('GOOGLE_PROFIL_GAGAL');
  }
  if (!respons.ok) {
    throw new GalatGoogle('GOOGLE_PROFIL_GAGAL');
  }
  let data: unknown;
  try {
    data = (await respons.json()) as unknown;
  } catch {
    throw new GalatGoogle('GOOGLE_PROFIL_GAGAL');
  }
  const profil = data as { sub?: unknown; email?: unknown; name?: unknown } | null;
  const sub = profil?.sub;
  const email = profil?.email;
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new GalatGoogle('GOOGLE_PROFIL_GAGAL');
  }
  if (typeof email !== 'string' || email.length === 0 || !email.includes('@')) {
    throw new GalatGoogle('GOOGLE_PROFIL_GAGAL');
  }
  const namaMentah = profil?.name;
  const nama =
    typeof namaMentah === 'string' && namaMentah.trim().length > 0
      ? namaMentah.trim()
      : email.split('@')[0];
  return { sub, email, nama };
}

// ---------------------------------------------------------------------------
// Pengguna di D1
// ---------------------------------------------------------------------------

const KOLOM_PENGGUNA =
  'SELECT id, email, nama, provider, pin_hash, pin_salt, dibuat_pada FROM users';

/**
 * Mencari pengguna berdasarkan email + provider 'google'; bila
 * belum ada, membuat baris users dan profiles. Pengguna lama yang
 * masuk kembali dikembalikan apa adanya: nama TIDAK diperbarui dari
 * Google (kontrak api-contracts.md 6.2 — nama Google hanya dipakai
 * untuk pengguna baru; perubahan manual lewat PATCH /account/profile
 * tidak ditimpa) dan PIN yang sudah diatur tidak dihapus.
 *
 * Bila INSERT gagal karena balapan (dua callback bersamaan untuk
 * email yang sama), fungsi mencoba membaca ulang dan mengembalikan
 * baris yang sudah ada.
 */
export async function cariAtauBuatPengguna(
  db: DbD1,
  profil: ProfilGoogle,
  sekarang: Date = new Date(),
): Promise<BarisPengguna> {
  const ada = await db
    .prepare(`${KOLOM_PENGGUNA} WHERE email = ? AND provider = ?`)
    .bind(profil.email, PROVIDER_GOOGLE)
    .first<BarisPengguna>();
  if (ada) {
    return ada;
  }
  const id = crypto.randomUUID();
  const waktu = sekarang.toISOString();
  try {
    await db
      .prepare('INSERT INTO users (id, email, nama, provider, dibuat_pada) VALUES (?, ?, ?, ?, ?)')
      .bind(id, profil.email, profil.nama, PROVIDER_GOOGLE, waktu)
      .run();
    await db
      .prepare('INSERT INTO profiles (id, nama, dibuat_pada) VALUES (?, ?, ?)')
      .bind(id, profil.nama, waktu)
      .run();
  } catch {
    const sudahAda = await db
      .prepare(`${KOLOM_PENGGUNA} WHERE email = ? AND provider = ?`)
      .bind(profil.email, PROVIDER_GOOGLE)
      .first<BarisPengguna>();
    if (sudahAda) {
      return sudahAda;
    }
    throw new Error('Gagal membuat pengguna');
  }
  return {
    id,
    email: profil.email,
    nama: profil.nama,
    provider: PROVIDER_GOOGLE,
    pin_hash: null,
    pin_salt: null,
    dibuat_pada: waktu,
  };
}
