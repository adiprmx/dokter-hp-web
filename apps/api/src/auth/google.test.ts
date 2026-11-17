// apps/api/src/auth/google.test.ts
// Tes unit modul Google OAuth: URL otorisasi, PKCE, penguraian
// callback, penukaran kode, dan profil — semuanya dengan mock fetch
// (tidak pernah memanggil Google asli) dan mock D1.

import { describe, expect, it, vi } from 'vitest';
import {
  ambilProfilGoogle,
  buatCodeChallenge,
  buatCodeVerifier,
  buatStateAcak,
  buatUrlAuthGoogle,
  cariAtauBuatPengguna,
  GalatGoogle,
  GOOGLE_AUTH_URL,
  GOOGLE_SCOPE,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  tukarKodeGoogle,
  uraiCallbackGoogle,
  type ProfilGoogle,
} from './google';
import type { BarisPengguna, DbD1, PernyataanD1 } from './session';

describe('buatStateAcak dan buatCodeVerifier', () => {
  it('menghasilkan string base64url 43 karakter yang unik', () => {
    const state = buatStateAcak();
    const verifier = buatCodeVerifier();
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(state).not.toBe(verifier);
    expect(buatStateAcak()).not.toBe(state);
  });
});

describe('buatCodeChallenge', () => {
  it('menghasilkan vektor RFC 7636 yang dikenal', async () => {
    await expect(
      buatCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('deterministis dan berbeda per verifier', async () => {
    const a = await buatCodeChallenge('verifier-satu');
    const b = await buatCodeChallenge('verifier-satu');
    const c = await buatCodeChallenge('verifier-dua');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('buatUrlAuthGoogle', () => {
  it('membangun URL otorisasi dengan semua parameter yang benar', () => {
    const url = new URL(
      buatUrlAuthGoogle({
        clientId: 'client-id-uji',
        redirectUri: 'https://api.contoh.test/api/auth/google/callback',
        state: 'state-uji',
        codeChallenge: 'challenge-uji',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(GOOGLE_AUTH_URL);
    expect(url.searchParams.get('client_id')).toBe('client-id-uji');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.contoh.test/api/auth/google/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(GOOGLE_SCOPE);
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('scope')).toContain('email');
    expect(url.searchParams.get('scope')).toContain('profile');
    expect(url.searchParams.get('state')).toBe('state-uji');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-uji');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('tidak pernah memuat client secret di URL', () => {
    const url = buatUrlAuthGoogle({
      clientId: 'client-id-uji',
      redirectUri: 'https://api.contoh.test/callback',
      state: 's',
      codeChallenge: 'c',
    });
    expect(url).not.toContain('secret');
  });
});

describe('uraiCallbackGoogle', () => {
  it('mengurai code dan state yang valid', () => {
    const hasil = uraiCallbackGoogle(new URLSearchParams('code=kode-uji&state=state-uji'));
    expect(hasil).toEqual({ code: 'kode-uji', state: 'state-uji' });
  });

  it('melempar GOOGLE_DITOLAK bila pengguna menolak izin di Google', () => {
    expect(() =>
      uraiCallbackGoogle(new URLSearchParams('error=access_denied&state=state-uji')),
    ).toThrowError(GalatGoogle);
    try {
      uraiCallbackGoogle(new URLSearchParams('error=access_denied'));
    } catch (galat) {
      expect((galat as GalatGoogle).kode).toBe('GOOGLE_DITOLAK');
    }
  });

  it('melempar GOOGLE_CALLBACK_TIDAK_VALID untuk galat Google lainnya', () => {
    try {
      uraiCallbackGoogle(new URLSearchParams('error=server_error&state=state-uji'));
    } catch (galat) {
      expect((galat as GalatGoogle).kode).toBe('GOOGLE_CALLBACK_TIDAK_VALID');
    }
  });

  it('melempar bila code atau state tidak ada', () => {
    expect(() => uraiCallbackGoogle(new URLSearchParams('state=saja'))).toThrowError(
      GalatGoogle,
    );
    expect(() => uraiCallbackGoogle(new URLSearchParams('code=saja'))).toThrowError(
      GalatGoogle,
    );
    expect(() => uraiCallbackGoogle(new URLSearchParams(''))).toThrowError(GalatGoogle);
  });
});

// ---------------------------------------------------------------------------
// Mock fetch untuk penukaran kode dan profil.
// ---------------------------------------------------------------------------

function buatFetchMock(
  penangan: (url: string, init?: RequestInit) => Response,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlTeks = typeof url === 'string' ? url : url.toString();
    return penangan(urlTeks, init);
  });
}

function responsJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('tukarKodeGoogle', () => {
  const opsiDasar = {
    clientId: 'client-id-uji',
    clientSecret: 'client-secret-uji',
    redirectUri: 'https://api.contoh.test/api/auth/google/callback',
    code: 'kode-uji',
    codeVerifier: 'verifier-uji',
  };

  it('mengirim POST form ke endpoint token dan mengembalikan access token', async () => {
    let urlDipanggil = '';
    let initDipanggil: RequestInit | undefined;
    const fetchMock = buatFetchMock((url, init) => {
      urlDipanggil = url;
      initDipanggil = init;
      return responsJson({ access_token: 'token-akses-uji', token_type: 'Bearer' });
    });
    const hasil = await tukarKodeGoogle({ ...opsiDasar, fetchFn: fetchMock as typeof fetch });
    expect(hasil).toEqual({ accessToken: 'token-akses-uji' });
    expect(urlDipanggil).toBe(GOOGLE_TOKEN_URL);
    expect(initDipanggil?.method).toBe('POST');
    const header = new Headers(initDipanggil?.headers);
    expect(header.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    const badan = new URLSearchParams(initDipanggil?.body as string);
    expect(badan.get('grant_type')).toBe('authorization_code');
    expect(badan.get('code')).toBe('kode-uji');
    expect(badan.get('client_id')).toBe('client-id-uji');
    expect(badan.get('client_secret')).toBe('client-secret-uji');
    expect(badan.get('redirect_uri')).toBe(opsiDasar.redirectUri);
    expect(badan.get('code_verifier')).toBe('verifier-uji');
  });

  it('melempar GOOGLE_TOKEN_GAGAL bila Google menolak kode', async () => {
    const fetchMock = buatFetchMock(() => responsJson({ error: 'invalid_grant' }, 400));
    await expect(
      tukarKodeGoogle({ ...opsiDasar, fetchFn: fetchMock as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_TOKEN_GAGAL' });
  });

  it('melempar GOOGLE_TOKEN_GAGAL bila respons tanpa access token', async () => {
    const fetchMock = buatFetchMock(() => responsJson({ token_type: 'Bearer' }));
    await expect(
      tukarKodeGoogle({ ...opsiDasar, fetchFn: fetchMock as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_TOKEN_GAGAL' });
  });

  it('melempar GOOGLE_TOKEN_GAGAL bila jaringan gagal', async () => {
    const fetchMock = buatFetchMock(() => {
      throw new Error('jaringan putus');
    });
    await expect(
      tukarKodeGoogle({ ...opsiDasar, fetchFn: fetchMock as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_TOKEN_GAGAL' });
  });

  it('melempar GOOGLE_KONFIGURASI_BELUM_DIATUR bila secret kosong', async () => {
    const fetchMock = buatFetchMock(() => responsJson({ access_token: 'x' }));
    await expect(
      tukarKodeGoogle({ ...opsiDasar, clientSecret: '', fetchFn: fetchMock as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_KONFIGURASI_BELUM_DIATUR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ambilProfilGoogle', () => {
  it('mengambil profil dengan header Bearer dan memvalidasi isinya', async () => {
    let urlDipanggil = '';
    let initDipanggil: RequestInit | undefined;
    const fetchMock = buatFetchMock((url, init) => {
      urlDipanggil = url;
      initDipanggil = init;
      return responsJson({ sub: 'sub-123', email: 'nama@contoh.test', name: 'Nama Uji' });
    });
    const profil = await ambilProfilGoogle({
      accessToken: 'token-akses-uji',
      fetchFn: fetchMock as typeof fetch,
    });
    expect(profil).toEqual({ sub: 'sub-123', email: 'nama@contoh.test', nama: 'Nama Uji' });
    expect(urlDipanggil).toBe(GOOGLE_USERINFO_URL);
    const header = new Headers(initDipanggil?.headers);
    expect(header.get('Authorization')).toBe('Bearer token-akses-uji');
  });

  it('mengisi nama dari bagian depan email bila Google tidak memberi nama', async () => {
    const fetchMock = buatFetchMock(() =>
      responsJson({ sub: 'sub-123', email: 'tanpanama@contoh.test' }),
    );
    const profil = await ambilProfilGoogle({
      accessToken: 'token-akses-uji',
      fetchFn: fetchMock as typeof fetch,
    });
    expect(profil.nama).toBe('tanpanama');
  });

  it('melempar GOOGLE_PROFIL_GAGAL bila sub/email tidak valid', async () => {
    const fetchTanpaEmail = buatFetchMock(() => responsJson({ sub: 'sub-123' }));
    await expect(
      ambilProfilGoogle({ accessToken: 't', fetchFn: fetchTanpaEmail as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_PROFIL_GAGAL' });

    const fetchTanpaSub = buatFetchMock(() => responsJson({ email: 'a@contoh.test' }));
    await expect(
      ambilProfilGoogle({ accessToken: 't', fetchFn: fetchTanpaSub as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_PROFIL_GAGAL' });

    const fetchEmailBuruk = buatFetchMock(() => responsJson({ sub: 's', email: 'bukan-email' }));
    await expect(
      ambilProfilGoogle({ accessToken: 't', fetchFn: fetchEmailBuruk as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_PROFIL_GAGAL' });
  });

  it('melempar GOOGLE_PROFIL_GAGAL bila Google menolak token', async () => {
    const fetchMock = buatFetchMock(() => responsJson({ error: 'invalid_token' }, 401));
    await expect(
      ambilProfilGoogle({ accessToken: 't', fetchFn: fetchMock as typeof fetch }),
    ).rejects.toMatchObject({ kode: 'GOOGLE_PROFIL_GAGAL' });
  });
});

// ---------------------------------------------------------------------------
// Mock D1 untuk cariAtauBuatPengguna.
// ---------------------------------------------------------------------------

function buatMockDbPengguna(penggunaAda: BarisPengguna | null): {
  db: DbD1;
  sqlTerpanggil: string[];
  nilaiTerikat: unknown[][];
} {
  const sqlTerpanggil: string[] = [];
  const nilaiTerikat: unknown[][] = [];
  const db: DbD1 = {
    prepare(sql: string): PernyataanD1 {
      const pernyataan: PernyataanD1 = {
        bind(...nilai: unknown[]): PernyataanD1 {
          sqlTerpanggil.push(sql);
          nilaiTerikat.push(nilai);
          return pernyataan;
        },
        async first<T>(): Promise<T | null> {
          return (penggunaAda ?? null) as T | null;
        },
        async all<T>(): Promise<{ results: T[]; success: boolean }> {
          return { results: [], success: true };
        },
        async run(): Promise<{ success: boolean }> {
          return { success: true };
        },
      };
      return pernyataan;
    },
  };
  return { db, sqlTerpanggil, nilaiTerikat };
}

const PROFIL_UJI: ProfilGoogle = {
  sub: 'sub-123',
  email: 'baru@contoh.test',
  nama: 'Pengguna Baru',
};

describe('cariAtauBuatPengguna', () => {
  it('mengembalikan pengguna lama tanpa INSERT', async () => {
    const penggunaLama: BarisPengguna = {
      id: 'user-lama',
      email: 'lama@contoh.test',
      nama: 'Pengguna Lama',
      provider: 'google',
      pin_hash: 'hash-lama',
      pin_salt: 'salt-lama',
      dibuat_pada: '2026-11-01T00:00:00.000Z',
    };
    const { db, sqlTerpanggil } = buatMockDbPengguna(penggunaLama);
    const hasil = await cariAtauBuatPengguna(db, { ...PROFIL_UJI, email: 'lama@contoh.test' });
    expect(hasil).toEqual(penggunaLama);
    expect(sqlTerpanggil.some((s) => s.startsWith('INSERT'))).toBe(false);
    expect(sqlTerpanggil[0]).toContain('WHERE email = ? AND provider = ?');
  });

  it('membuat users + profiles untuk pengguna baru', async () => {
    const { db, sqlTerpanggil, nilaiTerikat } = buatMockDbPengguna(null);
    const hasil = await cariAtauBuatPengguna(
      db,
      PROFIL_UJI,
      new Date('2026-11-17T12:00:00.000Z'),
    );
    expect(hasil.email).toBe('baru@contoh.test');
    expect(hasil.nama).toBe('Pengguna Baru');
    expect(hasil.provider).toBe('google');
    expect(hasil.pin_hash).toBeNull();
    expect(hasil.pin_salt).toBeNull();
    expect(hasil.dibuat_pada).toBe('2026-11-17T12:00:00.000Z');
    const insertUsers = sqlTerpanggil.findIndex((s) => s.startsWith('INSERT INTO users'));
    const insertProfiles = sqlTerpanggil.findIndex((s) => s.startsWith('INSERT INTO profiles'));
    expect(insertUsers).toBeGreaterThanOrEqual(0);
    expect(insertProfiles).toBeGreaterThanOrEqual(0);
    expect(nilaiTerikat[insertUsers]).toEqual([
      hasil.id,
      'baru@contoh.test',
      'Pengguna Baru',
      'google',
      '2026-11-17T12:00:00.000Z',
    ]);
    expect(nilaiTerikat[insertProfiles]).toEqual([
      hasil.id,
      'Pengguna Baru',
      '2026-11-17T12:00:00.000Z',
    ]);
  });
});
