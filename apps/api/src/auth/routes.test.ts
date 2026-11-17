// apps/api/src/auth/routes.test.ts
// Tes ujung-ke-ujung router auth: alur Google (mock fetch — tidak
// pernah memanggil Google asli), sesi, PIN, kunci, dan middleware
// gerbang PIN. D1 diganti implementasi palsu di memori yang
// mengeksekusi SQL yang sama dengan kode produksi.

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatRouterAuth } from './routes';
import { authMiddleware, getSessionId, getUserId, wajibLogin, wajibTidakTerkunci, type VariabelAuth } from './middleware';
import { hashToken, NAMA_COOKIE_SESI, type BarisPengguna, type BarisSesi, type DbD1, type EnvAuth, type PernyataanD1 } from './session';

// ---------------------------------------------------------------------------
// D1 palsu di memori (Map + pencocokan pola SQL yang dinormalisasi).
// ---------------------------------------------------------------------------

type Baris = Record<string, unknown>;

function normalisasiSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toUpperCase();
}

class D1Palsu implements DbD1 {
  pengguna = new Map<string, BarisPengguna>();
  profil = new Map<string, Baris>();
  sesi = new Map<string, BarisSesi>();
  percobaanPin = new Map<string, Baris>();
  bukaPin = new Map<string, Baris>();
  /** Bila true, semua INSERT melempar galat (simulasi database gagal). */
  gagalTulis = false;

  prepare(sql: string): PernyataanD1 {
    const db = this;
    const sqlNormal = normalisasiSql(sql);
    let nilai: unknown[] = [];
    const pernyataan: PernyataanD1 = {
      bind(...nilaiBind: unknown[]): PernyataanD1 {
        nilai = nilaiBind;
        return pernyataan;
      },
      async first<T>(): Promise<T | null> {
        if (sqlNormal.includes('FROM SESSIONS WHERE TOKEN_HASH')) {
          for (const sesi of db.sesi.values()) {
            if (sesi.token_hash === nilai[0]) {
              return sesi as T;
            }
          }
          return null;
        }
        if (sqlNormal.includes('FROM USERS WHERE EMAIL')) {
          for (const pengguna of db.pengguna.values()) {
            if (pengguna.email === nilai[0] && pengguna.provider === nilai[1]) {
              return pengguna as T;
            }
          }
          return null;
        }
        if (sqlNormal.includes('FROM USERS WHERE ID')) {
          return (db.pengguna.get(nilai[0] as string) ?? null) as T | null;
        }
        if (sqlNormal.includes('FROM PIN_ATTEMPTS WHERE USER_ID')) {
          return (db.percobaanPin.get(nilai[0] as string) ?? null) as T | null;
        }
        if (sqlNormal.includes('FROM PIN_UNLOCKS WHERE SESSION_ID')) {
          return (db.bukaPin.get(nilai[0] as string) ?? null) as T | null;
        }
        return null;
      },
      async all<T>(): Promise<{ results: T[]; success: boolean }> {
        if (sqlNormal.includes('FROM SESSIONS WHERE USER_ID')) {
          const hasil = [...db.sesi.values()].filter((s) => s.user_id === nilai[0]);
          return { results: hasil as T[], success: true };
        }
        return { results: [], success: true };
      },
      async run(): Promise<{ success: boolean }> {
        if (db.gagalTulis && sqlNormal.startsWith('INSERT')) {
          throw new Error('D1 gagal tulis (simulasi)');
        }
        if (sqlNormal.startsWith('CREATE TABLE IF NOT EXISTS')) {
          return { success: true };
        }
        if (sqlNormal.startsWith('INSERT INTO USERS')) {
          const [id, email, nama, provider, dibuat_pada] = nilai as [
            string,
            string,
            string | null,
            string,
            string,
          ];
          db.pengguna.set(id, {
            id,
            email,
            nama,
            provider,
            pin_hash: null,
            pin_salt: null,
            dibuat_pada,
          });
          return { success: true };
        }
        if (sqlNormal.startsWith('INSERT INTO PROFILES')) {
          const [id, nama, dibuat_pada] = nilai as [string, string | null, string];
          db.profil.set(id, { id, nama, dibuat_pada });
          return { success: true };
        }
        if (sqlNormal.startsWith('INSERT INTO SESSIONS')) {
          const [id, user_id, token_hash, expires_at, dibuat_pada] = nilai as [
            string,
            string,
            string,
            string,
            string,
          ];
          db.sesi.set(id, { id, user_id, token_hash, expires_at, dibuat_pada });
          return { success: true };
        }
        if (sqlNormal.startsWith('INSERT INTO PIN_ATTEMPTS')) {
          const [user_id, gagal_berturut, terkunci_sampai] = nilai as [
            string,
            number,
            string | null,
          ];
          db.percobaanPin.set(user_id, { user_id, gagal_berturut, terkunci_sampai });
          return { success: true };
        }
        if (sqlNormal.startsWith('INSERT OR REPLACE INTO PIN_UNLOCKS')) {
          const [session_id, dibuka_pada] = nilai as [string, string];
          db.bukaPin.set(session_id, { session_id, dibuka_pada });
          return { success: true };
        }
        if (sqlNormal.startsWith('UPDATE USERS SET PIN_HASH = ?')) {
          const [pin_hash, pin_salt, id] = nilai as [string, string, string];
          const pengguna = db.pengguna.get(id);
          if (pengguna) {
            pengguna.pin_hash = pin_hash;
            pengguna.pin_salt = pin_salt;
          }
          return { success: true };
        }
        if (sqlNormal.startsWith('UPDATE USERS SET PIN_HASH = NULL')) {
          const [id] = nilai as [string];
          const pengguna = db.pengguna.get(id);
          if (pengguna) {
            pengguna.pin_hash = null;
            pengguna.pin_salt = null;
          }
          return { success: true };
        }
        if (sqlNormal.startsWith('DELETE FROM SESSIONS WHERE TOKEN_HASH')) {
          for (const [id, sesi] of db.sesi) {
            if (sesi.token_hash === nilai[0]) {
              db.sesi.delete(id);
            }
          }
          return { success: true };
        }
        if (sqlNormal.startsWith('DELETE FROM SESSIONS WHERE ID')) {
          const sesi = db.sesi.get(nilai[0] as string);
          if (sesi && sesi.user_id === nilai[1]) {
            db.sesi.delete(nilai[0] as string);
          }
          return { success: true };
        }
        if (sqlNormal.startsWith('DELETE FROM PIN_ATTEMPTS')) {
          db.percobaanPin.delete(nilai[0] as string);
          return { success: true };
        }
        if (sqlNormal.startsWith('DELETE FROM PIN_UNLOCKS')) {
          db.bukaPin.delete(nilai[0] as string);
          return { success: true };
        }
        throw new Error(`SQL tidak dikenali D1 palsu: ${sql}`);
      },
    };
    return pernyataan;
  }
}

// ---------------------------------------------------------------------------
// Utilitas tes.
// ---------------------------------------------------------------------------

const FRONTEND_URL = 'https://aplikasi.contoh.test';
const REDIRECT_URI = 'https://api.contoh.test/api/auth/google/callback';

let emailProfil = 'pengguna@contoh.test';
let tokenGagal = false;

function buatEnv(db: DbD1, overrides: Partial<EnvAuth> = {}): EnvAuth {
  return {
    DB: db,
    GOOGLE_CLIENT_ID: 'client-id-uji',
    GOOGLE_CLIENT_SECRET: 'client-secret-uji',
    GOOGLE_REDIRECT_URI: REDIRECT_URI,
    FRONTEND_URL,
    ...overrides,
  };
}

function buatApp(): Hono<{ Bindings: EnvAuth }> {
  const app = new Hono<{ Bindings: EnvAuth }>();
  app.route('/api/auth', buatRouterAuth());
  return app;
}

/** Mengambil nilai satu cookie dari header Set-Cookie respons. */
function ambilCookieSet(res: Response, nama: string): string | null {
  for (const cookie of res.headers.getSetCookie()) {
    const [pasangan] = cookie.split(';');
    const [kunci, ...sisa] = pasangan.split('=');
    if (kunci === nama) {
      return sisa.join('=');
    }
  }
  return null;
}

/** Mengambil baris Set-Cookie lengkap untuk satu nama cookie. */
function ambilBarisSetCookie(res: Response, nama: string): string | null {
  for (const cookie of res.headers.getSetCookie()) {
    if (cookie.startsWith(`${nama}=`)) {
      return cookie;
    }
  }
  return null;
}

beforeEach(() => {
  emailProfil = 'pengguna@contoh.test';
  tokenGagal = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      const urlTeks = url.toString();
      if (urlTeks.includes('oauth2.googleapis.com/token')) {
        if (tokenGagal) {
          return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
        }
        return new Response(JSON.stringify({ access_token: 'token-akses-uji' }), {
          status: 200,
        });
      }
      if (urlTeks.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({ sub: 'sub-123', email: emailProfil, name: 'Pengguna Uji' }),
          { status: 200 },
        );
      }
      throw new Error(`fetch tidak terduga: ${urlTeks}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Menjalankan alur masuk lengkap (Google + callback) dan mengembalikan
 * token sesi mentah dari cookie. Email profil bisa diubah per tes.
 */
async function masukSebagai(
  app: Hono<{ Bindings: EnvAuth }>,
  env: EnvAuth,
  email = 'pengguna@contoh.test',
): Promise<string> {
  emailProfil = email;
  const mulai = await app.request('/api/auth/google', {}, env);
  expect(mulai.status).toBe(302);
  const state = ambilCookieSet(mulai, 'dokter_hp_oauth_state');
  const verifier = ambilCookieSet(mulai, 'dokter_hp_oauth_verifier');
  expect(state).not.toBeNull();
  expect(verifier).not.toBeNull();
  const callback = await app.request(
    `/api/auth/google/callback?code=kode-uji&state=${state}`,
    { headers: { Cookie: `dokter_hp_oauth_state=${state}; dokter_hp_oauth_verifier=${verifier}` } },
    env,
  );
  expect(callback.status).toBe(302);
  const token = ambilCookieSet(callback, NAMA_COOKIE_SESI);
  expect(token).not.toBeNull();
  return token as string;
}

function headerCookie(token: string): { Cookie: string } {
  return { Cookie: `${NAMA_COOKIE_SESI}=${token}` };
}

// ---------------------------------------------------------------------------
// GET /api/auth/google
// ---------------------------------------------------------------------------

describe('GET /api/auth/google', () => {
  it('redirect ke Google dengan state + PKCE dan memasang cookie sementara', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const res = await app.request('/api/auth/google', {}, env);
    expect(res.status).toBe(302);
    const lokasi = new URL(res.headers.get('Location') ?? '');
    expect(`${lokasi.origin}${lokasi.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(lokasi.searchParams.get('client_id')).toBe('client-id-uji');
    expect(lokasi.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(lokasi.searchParams.get('response_type')).toBe('code');
    expect(lokasi.searchParams.get('code_challenge_method')).toBe('S256');
    expect(lokasi.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(lokasi.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stateCookie = ambilBarisSetCookie(res, 'dokter_hp_oauth_state');
    const verifierCookie = ambilBarisSetCookie(res, 'dokter_hp_oauth_verifier');
    expect(stateCookie).toContain('Max-Age=600');
    expect(stateCookie).toContain('HttpOnly');
    expect(stateCookie).toContain('Secure');
    expect(stateCookie).toContain('SameSite=Lax');
    expect(stateCookie).toContain('Path=/api/auth');
    expect(verifierCookie).toContain('Max-Age=600');
    expect(verifierCookie).toContain('Path=/api/auth');
    // State di URL sama dengan state di cookie.
    expect(ambilCookieSet(res, 'dokter_hp_oauth_state')).toBe(
      lokasi.searchParams.get('state'),
    );
  });

  it('menyimpan tujuan redirect yang valid di cookie sementara', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const res = await app.request('/api/auth/google?redirect=/wifi', {}, env);
    expect(res.status).toBe(302);
    const redirectCookie = ambilBarisSetCookie(res, 'dokter_hp_oauth_redirect');
    expect(redirectCookie).toContain('dokter_hp_oauth_redirect=%2Fwifi');
    expect(redirectCookie).toContain('Max-Age=600');
    expect(redirectCookie).toContain('Path=/api/auth');
  });

  it('mengabaikan tujuan redirect yang tidak valid (URL luar / //)', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    for (const buruk of ['https://jahat.test/phishing', '//jahat.test', 'javascript:alert(1)']) {
      const res = await app.request(
        `/api/auth/google?redirect=${encodeURIComponent(buruk)}`,
        {},
        env,
      );
      expect(res.status).toBe(302);
      expect(ambilCookieSet(res, 'dokter_hp_oauth_redirect')).toBeNull();
    }
  });

  it('mengembalikan 500 INTERNAL_ERROR bila konfigurasi Google belum diatur', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db, { GOOGLE_CLIENT_ID: '' });
    const app = buatApp();
    const res = await app.request('/api/auth/google', {}, env);
    expect(res.status).toBe(500);
    const badan = (await res.json()) as {
      success: boolean;
      error: { code: string };
      meta: { timestamp: string };
    };
    expect(badan.success).toBe(false);
    expect(badan.error.code).toBe('INTERNAL_ERROR');
    expect(typeof badan.meta.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback
// ---------------------------------------------------------------------------

describe('GET /api/auth/google/callback', () => {
  it('alur lengkap: buat pengguna + sesi, set cookie, redirect ke dashboard', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const mulai = await app.request('/api/auth/google', {}, env);
    const state = ambilCookieSet(mulai, 'dokter_hp_oauth_state');
    const verifier = ambilCookieSet(mulai, 'dokter_hp_oauth_verifier');
    const res = await app.request(
      `/api/auth/google/callback?code=kode-uji&state=${state}`,
      { headers: { Cookie: `dokter_hp_oauth_state=${state}; dokter_hp_oauth_verifier=${verifier}` } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/dashboard`);
    const token = ambilCookieSet(res, NAMA_COOKIE_SESI);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const barisCookie = ambilBarisSetCookie(res, NAMA_COOKIE_SESI);
    expect(barisCookie).toContain('HttpOnly');
    expect(barisCookie).toContain('Secure');
    expect(barisCookie).toContain('SameSite=Lax');
    // Cookie OAuth sementara dihapus (dengan Path yang sama).
    expect(ambilBarisSetCookie(res, 'dokter_hp_oauth_state')).toContain('Max-Age=0');
    expect(ambilBarisSetCookie(res, 'dokter_hp_oauth_state')).toContain('Path=/api/auth');
    expect(ambilBarisSetCookie(res, 'dokter_hp_oauth_verifier')).toContain('Max-Age=0');
    // Pengguna tersimpan dengan provider google.
    expect(db.pengguna.size).toBe(1);
    const pengguna = [...db.pengguna.values()][0];
    expect(pengguna.email).toBe('pengguna@contoh.test');
    expect(pengguna.provider).toBe('google');
    expect(pengguna.nama).toBe('Pengguna Uji');
    expect(db.profil.size).toBe(1);
    // Sesi tersimpan sebagai HASH token, bukan token mentah.
    expect(db.sesi.size).toBe(1);
    const sesi = [...db.sesi.values()][0];
    expect(sesi.user_id).toBe(pengguna.id);
    expect(sesi.token_hash).toBe(await hashToken(token as string));
    expect(sesi.token_hash).not.toBe(token);
    const kedaluwarsa = new Date(sesi.expires_at).getTime() - Date.now();
    expect(kedaluwarsa).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(kedaluwarsa).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
  });

  it('masuk kedua dengan email yang sama memakai pengguna yang sudah ada', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    await masukSebagai(app, env);
    await masukSebagai(app, env);
    expect(db.pengguna.size).toBe(1);
    expect(db.sesi.size).toBe(2);
  });

  it('callback memakai tujuan redirect dari cookie bila valid', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const mulai = await app.request('/api/auth/google?redirect=/wifi', {}, env);
    const state = ambilCookieSet(mulai, 'dokter_hp_oauth_state');
    const verifier = ambilCookieSet(mulai, 'dokter_hp_oauth_verifier');
    const redirect = ambilCookieSet(mulai, 'dokter_hp_oauth_redirect');
    // Nilai cookie ter-encode (buatCookie memakai encodeURIComponent);
    // browser mengirim bentuk ter-encode ini dan server men-decode-nya.
    expect(redirect).toBe('%2Fwifi');
    expect(decodeURIComponent(redirect as string)).toBe('/wifi');
    const res = await app.request(
      `/api/auth/google/callback?code=kode-uji&state=${state}`,
      {
        headers: {
          Cookie: `dokter_hp_oauth_state=${state}; dokter_hp_oauth_verifier=${verifier}; dokter_hp_oauth_redirect=${redirect}`,
        },
      },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/wifi`);
    expect(ambilBarisSetCookie(res, 'dokter_hp_oauth_redirect')).toContain('Max-Age=0');
  });

  it('callback memakai /dashboard bila cookie redirect tidak valid', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const mulai = await app.request('/api/auth/google', {}, env);
    const state = ambilCookieSet(mulai, 'dokter_hp_oauth_state');
    const verifier = ambilCookieSet(mulai, 'dokter_hp_oauth_verifier');
    const res = await app.request(
      `/api/auth/google/callback?code=kode-uji&state=${state}`,
      {
        headers: {
          Cookie: `dokter_hp_oauth_state=${state}; dokter_hp_oauth_verifier=${verifier}; dokter_hp_oauth_redirect=https://jahat.test`,
        },
      },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/dashboard`);
  });

  it('menolak callback dengan state yang tidak cocok', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const mulai = await app.request('/api/auth/google', {}, env);
    const state = ambilCookieSet(mulai, 'dokter_hp_oauth_state');
    const verifier = ambilCookieSet(mulai, 'dokter_hp_oauth_verifier');
    const res = await app.request(
      '/api/auth/google/callback?code=kode-uji&state=state-palsu',
      { headers: { Cookie: `dokter_hp_oauth_state=${state}; dokter_hp_oauth_verifier=${verifier}` } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/masuk?error=oauth_gagal`);
    expect(db.pengguna.size).toBe(0);
    expect(db.sesi.size).toBe(0);
    // Cookie OAuth sementara tetap dihapus pada redirect galat.
    expect(ambilBarisSetCookie(res, 'dokter_hp_oauth_state')).toContain('Max-Age=0');
  });

  it('menolak callback tanpa cookie state/verifier', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const res = await app.request(
      '/api/auth/google/callback?code=kode-uji&state=state-apa-pun',
      {},
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/masuk?error=oauth_gagal`);
  });

  it('menolak callback saat pengguna menolak izin di Google', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const res = await app.request(
      '/api/auth/google/callback?error=access_denied&state=x',
      {},
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/masuk?error=ditolak`);
  });

  it('menolak callback saat penukaran kode gagal di Google', async () => {
    tokenGagal = true;
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const mulai = await app.request('/api/auth/google', {}, env);
    const state = ambilCookieSet(mulai, 'dokter_hp_oauth_state');
    const verifier = ambilCookieSet(mulai, 'dokter_hp_oauth_verifier');
    const res = await app.request(
      `/api/auth/google/callback?code=kode-buruk&state=${state}`,
      { headers: { Cookie: `dokter_hp_oauth_state=${state}; dokter_hp_oauth_verifier=${verifier}` } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/masuk?error=oauth_gagal`);
    expect(db.sesi.size).toBe(0);
  });

  it('mengalihkan ke server_sibuk bila database gagal membuat pengguna/sesi', async () => {
    const db = new D1Palsu();
    db.gagalTulis = true;
    const env = buatEnv(db);
    const app = buatApp();
    const mulai = await app.request('/api/auth/google', {}, env);
    const state = ambilCookieSet(mulai, 'dokter_hp_oauth_state');
    const verifier = ambilCookieSet(mulai, 'dokter_hp_oauth_verifier');
    const res = await app.request(
      `/api/auth/google/callback?code=kode-uji&state=${state}`,
      { headers: { Cookie: `dokter_hp_oauth_state=${state}; dokter_hp_oauth_verifier=${verifier}` } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND_URL}/masuk?error=server_sibuk`);
    expect(db.sesi.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me dan POST /api/auth/logout
// ---------------------------------------------------------------------------

describe('GET /api/auth/me dan POST /api/auth/logout', () => {
  it('/me mengembalikan 401 UNAUTHORIZED tanpa cookie sesi', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const res = await app.request('/api/auth/me', {}, env);
    expect(res.status).toBe(401);
    const badan = (await res.json()) as {
      success: boolean;
      error: { code: string };
      meta: { timestamp: string };
    };
    expect(badan.success).toBe(false);
    expect(badan.error.code).toBe('UNAUTHORIZED');
    expect(typeof badan.meta.timestamp).toBe('string');
  });

  it('/me mengembalikan 401 untuk token sesi yang tidak dikenal', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const res = await app.request(
      '/api/auth/me',
      { headers: headerCookie('token-asing-yang-tidak-ada') },
      env,
    );
    expect(res.status).toBe(401);
  });

  it('/me mengembalikan profil + status PIN dengan envelope sukses', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    const res = await app.request('/api/auth/me', { headers: headerCookie(token) }, env);
    expect(res.status).toBe(200);
    const badan = (await res.json()) as {
      success: boolean;
      data: {
        id: string;
        nama: string;
        email: string;
        pin_diatur: boolean;
        sesi_terkunci: boolean;
        sesi_kedaluwarsa_pada: string;
      };
      meta: { timestamp: string };
    };
    expect(badan.success).toBe(true);
    expect(badan.data.email).toBe('pengguna@contoh.test');
    expect(badan.data.nama).toBe('Pengguna Uji');
    expect(badan.data.pin_diatur).toBe(false);
    expect(badan.data.sesi_terkunci).toBe(false);
    expect(typeof badan.meta.timestamp).toBe('string');
    const kedaluwarsa = new Date(badan.data.sesi_kedaluwarsa_pada).getTime() - Date.now();
    expect(kedaluwarsa).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(kedaluwarsa).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
  });

  it('logout menghapus sesi + penanda buka dan membersihkan cookie', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    expect(db.sesi.size).toBe(1);
    const res = await app.request(
      '/api/auth/logout',
      { method: 'POST', headers: headerCookie(token) },
      env,
    );
    expect(res.status).toBe(200);
    const badan = (await res.json()) as { success: boolean; data: { keluar: boolean } };
    expect(badan.success).toBe(true);
    expect(badan.data.keluar).toBe(true);
    expect(ambilBarisSetCookie(res, NAMA_COOKIE_SESI)).toContain('Max-Age=0');
    expect(db.sesi.size).toBe(0);
    const sesudah = await app.request('/api/auth/me', { headers: headerCookie(token) }, env);
    expect(sesudah.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PIN: set, verify, hapus, kunci
// ---------------------------------------------------------------------------

describe('PIN', () => {
  async function aturPin(
    app: Hono<{ Bindings: EnvAuth }>,
    env: EnvAuth,
    token: string,
    pin: string,
  ): Promise<Response> {
    return app.request(
      '/api/auth/pin/set',
      {
        method: 'POST',
        headers: { ...headerCookie(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      },
      env,
    );
  }

  async function verifikasiPin(
    app: Hono<{ Bindings: EnvAuth }>,
    env: EnvAuth,
    token: string,
    pin: string,
  ): Promise<Response> {
    return app.request(
      '/api/auth/pin/verify',
      {
        method: 'POST',
        headers: { ...headerCookie(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      },
      env,
    );
  }

  it('set PIN menyimpan hash (bukan PIN mentah) dan sesi berjalan tetap terbuka', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    const res = await aturPin(app, env, token, '1234');
    expect(res.status).toBe(200);
    const badan = (await res.json()) as { success: boolean; data: { pin_diatur: boolean } };
    expect(badan.data.pin_diatur).toBe(true);
    const pengguna = [...db.pengguna.values()][0];
    expect(pengguna.pin_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pengguna.pin_salt).toMatch(/^[0-9a-f]{32}$/);
    expect(pengguna.pin_hash).not.toBe('1234');
    const me = await app.request('/api/auth/me', { headers: headerCookie(token) }, env);
    const meBadan = (await me.json()) as { data: { pin_diatur: boolean; sesi_terkunci: boolean } };
    expect(meBadan.data.pin_diatur).toBe(true);
    expect(meBadan.data.sesi_terkunci).toBe(false);
  });

  it('set PIN menolak format tidak valid', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    for (const pinBuruk of ['123', '123456789', '12ab', '']) {
      const res = await aturPin(app, env, token, pinBuruk);
      expect(res.status).toBe(400);
      const badan = (await res.json()) as { error: { code: string } };
      expect(badan.error.code).toBe('VALIDATION_ERROR');
    }
    const pengguna = [...db.pengguna.values()][0];
    expect(pengguna.pin_hash).toBeNull();
  });

  it('sesi baru terkunci bila PIN diatur; PIN benar membukanya', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const tokenPertama = await masukSebagai(app, env);
    await aturPin(app, env, tokenPertama, '5678');
    // Keluar lalu masuk lagi: sesi baru belum dibuka dengan PIN.
    await app.request('/api/auth/logout', { method: 'POST', headers: headerCookie(tokenPertama) }, env);
    const tokenBaru = await masukSebagai(app, env);
    const meTerkunci = await app.request(
      '/api/auth/me',
      { headers: headerCookie(tokenBaru) },
      env,
    );
    const badanTerkunci = (await meTerkunci.json()) as { data: { sesi_terkunci: boolean } };
    expect(badanTerkunci.data.sesi_terkunci).toBe(true);
    const verifikasi = await verifikasiPin(app, env, tokenBaru, '5678');
    expect(verifikasi.status).toBe(200);
    const badanVerifikasi = (await verifikasi.json()) as {
      data: { valid: boolean; sesi_terkunci: boolean };
    };
    expect(badanVerifikasi.data.valid).toBe(true);
    expect(badanVerifikasi.data.sesi_terkunci).toBe(false);
    const meTerbuka = await app.request(
      '/api/auth/me',
      { headers: headerCookie(tokenBaru) },
      env,
    );
    const badanTerbuka = (await meTerbuka.json()) as { data: { sesi_terkunci: boolean } };
    expect(badanTerbuka.data.sesi_terkunci).toBe(false);
  });

  it('PIN salah 5x berturut-turut mengunci 30 detik', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    await aturPin(app, env, token, '2468');
    // Sesi berjalan sudah terbuka; kunci diuji lewat endpoint verify.
    for (let i = 1; i <= 4; i++) {
      const res = await verifikasiPin(app, env, token, '0000');
      expect(res.status).toBe(401);
      const badan = (await res.json()) as {
        error: { code: string; details: { sisa_percobaan: number } };
      };
      expect(badan.error.code).toBe('PIN_SALAH');
      expect(badan.error.details.sisa_percobaan).toBe(5 - i);
    }
    const kelima = await verifikasiPin(app, env, token, '0000');
    expect(kelima.status).toBe(403);
    const badanKelima = (await kelima.json()) as {
      error: {
        code: string;
        details: { terkunci_sampai: string; sisa_detik: number };
      };
    };
    expect(badanKelima.error.code).toBe('PIN_TERKUNCI');
    expect(badanKelima.error.details.sisa_detik).toBe(30);
    expect(typeof badanKelima.error.details.terkunci_sampai).toBe('string');
    expect(
      new Date(badanKelima.error.details.terkunci_sampai).getTime(),
    ).toBeGreaterThan(Date.now());
    // PIN benar pun ditolak selama terkunci.
    const selamaKunci = await verifikasiPin(app, env, token, '2468');
    expect(selamaKunci.status).toBe(403);
    const badanKunci = (await selamaKunci.json()) as {
      error: { details: { terkunci_sampai: string; sisa_detik: number } };
    };
    expect(badanKunci.error.details.sisa_detik).toBeGreaterThan(0);
    expect(badanKunci.error.details.sisa_detik).toBeLessThanOrEqual(30);
    expect(typeof badanKunci.error.details.terkunci_sampai).toBe('string');
  });

  it('format PIN salah pada verify tidak dihitung sebagai percobaan salah', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    await aturPin(app, env, token, '1357');
    for (const pinBuruk of ['12ab', '123', '']) {
      const res = await verifikasiPin(app, env, token, pinBuruk);
      expect(res.status).toBe(400);
      const badan = (await res.json()) as { error: { code: string } };
      expect(badan.error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.percobaanPin.size).toBe(0);
    const salah = await verifikasiPin(app, env, token, '0000');
    const badan = (await salah.json()) as {
      error: { details: { sisa_percobaan: number } };
    };
    expect(badan.error.details.sisa_percobaan).toBe(4);
  });

  it('PIN benar mereset penghitung gagal', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    await aturPin(app, env, token, '1357');
    await verifikasiPin(app, env, token, '0000');
    await verifikasiPin(app, env, token, '0000');
    expect(db.percobaanPin.size).toBe(1);
    const benar = await verifikasiPin(app, env, token, '1357');
    expect(benar.status).toBe(200);
    expect(db.percobaanPin.size).toBe(0);
    // Percobaan salah berikutnya dihitung dari awal lagi.
    const salah = await verifikasiPin(app, env, token, '0000');
    const badan = (await salah.json()) as {
      error: { details: { sisa_percobaan: number } };
    };
    expect(badan.error.details.sisa_percobaan).toBe(4);
  });

  it('verify mengembalikan 409 CONFLICT bila PIN belum diatur', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    const res = await verifikasiPin(app, env, token, '1234');
    expect(res.status).toBe(409);
    const badan = (await res.json()) as { error: { code: string } };
    expect(badan.error.code).toBe('CONFLICT');
  });

  it('hapus PIN mengosongkan hash dan membuka gerbang kunci', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    await aturPin(app, env, token, '1122');
    const res = await app.request(
      '/api/auth/pin/hapus',
      { method: 'POST', headers: headerCookie(token) },
      env,
    );
    expect(res.status).toBe(200);
    const badan = (await res.json()) as { data: { pin_diatur: boolean } };
    expect(badan.data.pin_diatur).toBe(false);
    const pengguna = [...db.pengguna.values()][0];
    expect(pengguna.pin_hash).toBeNull();
    expect(pengguna.pin_salt).toBeNull();
    const me = await app.request('/api/auth/me', { headers: headerCookie(token) }, env);
    const meBadan = (await me.json()) as { data: { sesi_terkunci: boolean } };
    expect(meBadan.data.sesi_terkunci).toBe(false);
  });

  it('hapus PIN mengembalikan 409 CONFLICT bila PIN belum diatur', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    const res = await app.request(
      '/api/auth/pin/delete',
      { method: 'POST', headers: headerCookie(token) },
      env,
    );
    expect(res.status).toBe(409);
    const badan = (await res.json()) as { error: { code: string } };
    expect(badan.error.code).toBe('CONFLICT');
  });

  it('alias /pin/hapus berperilaku sama dengan /pin/delete', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const app = buatApp();
    const token = await masukSebagai(app, env);
    await aturPin(app, env, token, '3344');
    const res = await app.request(
      '/api/auth/pin/hapus',
      { method: 'POST', headers: headerCookie(token) },
      env,
    );
    expect(res.status).toBe(200);
    const badan = (await res.json()) as { data: { pin_diatur: boolean } };
    expect(badan.data.pin_diatur).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Middleware wajibTidakTerkunci
// ---------------------------------------------------------------------------

describe('middleware wajibLogin, wajibTidakTerkunci, dan authMiddleware', () => {
  function buatAppTerlindungi(): Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }> {
    const app = new Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }>();
    app.get('/api/data', wajibLogin, wajibTidakTerkunci, (c) =>
      c.json({ success: true, data: { rahasia: 'data' } }),
    );
    return app;
  }

  function buatAppGabungan(): Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }> {
    const app = new Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }>();
    app.get('/api/data-gabungan', authMiddleware, (c) =>
      c.json({
        success: true,
        data: { userId: getUserId(c), sessionId: getSessionId(c) },
      }),
    );
    return app;
  }

  it('menolak sesi terkunci dengan 403 SESSION_LOCKED dan mengizinkan sesi terbuka', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const appAuth = buatApp();
    const appData = buatAppTerlindungi();
    const tokenPertama = await masukSebagai(appAuth, env);
    await appAuth.request(
      '/api/auth/pin/set',
      {
        method: 'POST',
        headers: { ...headerCookie(tokenPertama), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      },
      env,
    );
    await appAuth.request(
      '/api/auth/logout',
      { method: 'POST', headers: headerCookie(tokenPertama) },
      env,
    );
    const tokenBaru = await masukSebagai(appAuth, env);
    const terkunci = await appData.request(
      '/api/data',
      { headers: headerCookie(tokenBaru) },
      env,
    );
    expect(terkunci.status).toBe(403);
    const badanTerkunci = (await terkunci.json()) as { error: { code: string } };
    expect(badanTerkunci.error.code).toBe('SESSION_LOCKED');
    // Buka dengan PIN lewat router auth, lalu endpoint data terbuka.
    await appAuth.request(
      '/api/auth/pin/verify',
      {
        method: 'POST',
        headers: { ...headerCookie(tokenBaru), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      },
      env,
    );
    const terbuka = await appData.request(
      '/api/data',
      { headers: headerCookie(tokenBaru) },
      env,
    );
    expect(terbuka.status).toBe(200);
  });

  it('mengizinkan sesi tanpa PIN tanpa verifikasi apa pun', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const appAuth = buatApp();
    const appData = buatAppTerlindungi();
    const token = await masukSebagai(appAuth, env);
    const res = await appData.request('/api/data', { headers: headerCookie(token) }, env);
    expect(res.status).toBe(200);
  });

  it('mengembalikan 401 UNAUTHORIZED bila dipakai tanpa sesi', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const appData = buatAppTerlindungi();
    const res = await appData.request('/api/data', {}, env);
    expect(res.status).toBe(401);
    const badan = (await res.json()) as { error: { code: string } };
    expect(badan.error.code).toBe('UNAUTHORIZED');
  });

  it('authMiddleware gabungan: 401 tanpa sesi, 403 saat terkunci, 200 saat terbuka', async () => {
    const db = new D1Palsu();
    const env = buatEnv(db);
    const appAuth = buatApp();
    const appData = buatAppGabungan();
    const tanpaSesi = await appData.request('/api/data-gabungan', {}, env);
    expect(tanpaSesi.status).toBe(401);
    const tokenPertama = await masukSebagai(appAuth, env);
    await appAuth.request(
      '/api/auth/pin/set',
      {
        method: 'POST',
        headers: { ...headerCookie(tokenPertama), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      },
      env,
    );
    await appAuth.request(
      '/api/auth/logout',
      { method: 'POST', headers: headerCookie(tokenPertama) },
      env,
    );
    const tokenBaru = await masukSebagai(appAuth, env);
    const terkunci = await appData.request(
      '/api/data-gabungan',
      { headers: headerCookie(tokenBaru) },
      env,
    );
    expect(terkunci.status).toBe(403);
    const badanTerkunci = (await terkunci.json()) as { error: { code: string } };
    expect(badanTerkunci.error.code).toBe('SESSION_LOCKED');
    await appAuth.request(
      '/api/auth/pin/verify',
      {
        method: 'POST',
        headers: { ...headerCookie(tokenBaru), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9999' }),
      },
      env,
    );
    const terbuka = await appData.request(
      '/api/data-gabungan',
      { headers: headerCookie(tokenBaru) },
      env,
    );
    expect(terbuka.status).toBe(200);
    const badanTerbuka = (await terbuka.json()) as {
      data: { userId: string; sessionId: string };
    };
    // getUserId/getSessionId mengembalikan id dari sesi terverifikasi.
    const pengguna = [...db.pengguna.values()][0];
    const sesi = [...db.sesi.values()].find((s) => s.user_id === pengguna.id);
    expect(badanTerbuka.data.userId).toBe(pengguna.id);
    expect(badanTerbuka.data.sessionId).toBe(sesi?.id);
  });
});
