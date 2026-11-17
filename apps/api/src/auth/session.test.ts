// apps/api/src/auth/session.test.ts
// Tes unit modul sesi: token, hash SHA-256, cookie, dan operasi
// sesi di D1 (dengan mock DbD1 — tanpa D1 nyata).

import { describe, expect, it } from 'vitest';
import {
  bacaNilaiCookie,
  bacaTokenDariCookie,
  buatCookie,
  buatCookieHapusSesi,
  buatCookieSesi,
  buatSesi,
  buatTokenSesi,
  bytesKeBase64Url,
  bytesKeHex,
  daftarSesiPengguna,
  hapusSesi,
  hapusSesiBerdasarkanId,
  hashSha256Base64Url,
  hashSha256Hex,
  hashToken,
  MASA_BERLAKU_SESI_DETIK,
  NAMA_COOKIE_SESI,
  validasiSesi,
  type BarisPengguna,
  type BarisSesi,
  type DbD1,
  type PernyataanD1,
} from './session';

describe('bytesKeHex dan bytesKeBase64Url', () => {
  it('bytesKeHex mengubah byte menjadi hex huruf kecil', () => {
    expect(bytesKeHex(new Uint8Array([0, 15, 255, 171]))).toBe('000fffab');
    expect(bytesKeHex(new Uint8Array([]))).toBe('');
  });

  it('bytesKeBase64Url memakai alfabet URL-aman tanpa padding', () => {
    expect(bytesKeBase64Url(new Uint8Array([0, 1, 2]))).toBe('AAEC');
    expect(bytesKeBase64Url(new Uint8Array([255, 255]))).toBe('__8');
    expect(bytesKeBase64Url(new Uint8Array([255, 255, 255]))).toBe('____');
  });
});

describe('hashSha256Hex dan hashSha256Base64Url', () => {
  it('menghasilkan vektor SHA-256 yang dikenal', async () => {
    await expect(hashSha256Hex('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    await expect(hashSha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('versi base64url konsisten dengan versi hex', async () => {
    const hex = await hashSha256Hex('dokter-hp');
    const b64 = await hashSha256Base64Url('dokter-hp');
    const dariHex = bytesKeBase64Url(
      new Uint8Array(hex.match(/../g)?.map((pasang) => parseInt(pasang, 16)) ?? []),
    );
    expect(b64).toBe(dariHex);
    expect(b64).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('buatTokenSesi dan hashToken', () => {
  it('token 43 karakter base64url dan unik tiap panggilan', () => {
    const a = buatTokenSesi();
    const b = buatTokenSesi();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('hashToken deterministis, 64 hex, berbeda per token', async () => {
    const a = await hashToken('token-uji');
    const b = await hashToken('token-uji');
    const c = await hashToken('token-lain');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(c);
  });
});

describe('cookie sesi', () => {
  it('buatCookieSesi memakai atribut keamanan lengkap', () => {
    const cookie = buatCookieSesi('token-uji');
    expect(cookie).toContain(`${NAMA_COOKIE_SESI}=token-uji`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${MASA_BERLAKU_SESI_DETIK}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('masa berlaku sesi 30 hari', () => {
    expect(MASA_BERLAKU_SESI_DETIK).toBe(30 * 24 * 60 * 60);
  });

  it('buatCookieHapusSesi memakai Max-Age 0', () => {
    const cookie = buatCookieHapusSesi();
    expect(cookie).toContain(`${NAMA_COOKIE_SESI}=`);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
  });

  it('buatCookie meng-encode nilai dan menghormati opsi', () => {
    expect(buatCookie('nama', 'a b=c', { maxAgeDetik: 60, path: '/api' })).toBe(
      'nama=a%20b%3Dc; Path=/api; Max-Age=60; HttpOnly; Secure; SameSite=Lax',
    );
  });

  it('bacaTokenDariCookie membaca token dari header Cookie', () => {
    expect(bacaTokenDariCookie(`${NAMA_COOKIE_SESI}=abc123`)).toBe('abc123');
    expect(
      bacaTokenDariCookie(`lain=1; ${NAMA_COOKIE_SESI}=token-tengah; x=y`),
    ).toBe('token-tengah');
    expect(bacaTokenDariCookie('lain=1; x=y')).toBeNull();
    expect(bacaTokenDariCookie('')).toBeNull();
    expect(bacaTokenDariCookie(null)).toBeNull();
    expect(bacaTokenDariCookie(undefined)).toBeNull();
    expect(bacaTokenDariCookie(`${NAMA_COOKIE_SESI}=`)).toBeNull();
  });

  it('bacaNilaiCookie membaca cookie lain dan men-decode nilai', () => {
    expect(bacaNilaiCookie('a=1; b=dua%20kata', 'b')).toBe('dua kata');
    expect(bacaNilaiCookie('a=1', 'b')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Mock DbD1 berbasis penangan per pola SQL.
// ---------------------------------------------------------------------------

function buatMockDbDenganData(opsi: {
  sesi?: BarisSesi | null;
  pengguna?: BarisPengguna | null;
  daftarSesi?: BarisSesi[];
}): { db: DbD1; sqlTerpanggil: string[]; nilaiTerikat: unknown[][] } {
  const sqlTerpanggil: string[] = [];
  const nilaiTerikat: unknown[][] = [];
  const db: DbD1 = {
    prepare(sql: string): PernyataanD1 {
      let nilai: unknown[] = [];
      const pernyataan: PernyataanD1 = {
        bind(...nilaiBind: unknown[]): PernyataanD1 {
          nilai = nilaiBind;
          sqlTerpanggil.push(sql);
          nilaiTerikat.push(nilaiBind);
          return pernyataan;
        },
        async first<T>(): Promise<T | null> {
          if (sql.includes('FROM sessions WHERE token_hash')) {
            return (opsi.sesi ?? null) as T | null;
          }
          if (sql.includes('FROM users WHERE id')) {
            return (opsi.pengguna ?? null) as T | null;
          }
          return null;
        },
        async all<T>(): Promise<{ results: T[]; success: boolean }> {
          return { results: (opsi.daftarSesi ?? []) as T[], success: true };
        },
        async run(): Promise<{ success: boolean }> {
          if (nilai.length === 0) {
            sqlTerpanggil.push(sql);
            nilaiTerikat.push([]);
          }
          return { success: true };
        },
      };
      return pernyataan;
    },
  };
  return { db, sqlTerpanggil, nilaiTerikat };
}

const PENGGUNA_UJI: BarisPengguna = {
  id: 'user-1',
  email: 'pengguna@contoh.test',
  nama: 'Pengguna Uji',
  provider: 'google',
  pin_hash: null,
  pin_salt: null,
  dibuat_pada: '2026-11-17T00:00:00.000Z',
};

function sesiUji(overrides: Partial<BarisSesi> = {}): BarisSesi {
  return {
    id: 'sesi-1',
    user_id: 'user-1',
    token_hash: 'hash-token-uji',
    expires_at: '2026-12-17T12:00:00.000Z',
    dibuat_pada: '2026-11-17T12:00:00.000Z',
    ...overrides,
  };
}

describe('buatSesi', () => {
  it('menyimpan hash token (bukan token mentah) dan kedaluwarsa 30 hari', async () => {
    const { db, sqlTerpanggil, nilaiTerikat } = buatMockDbDenganData({});
    const sekarang = new Date('2026-11-17T12:00:00.000Z');
    const hasil = await buatSesi(db, { idPengguna: 'user-1', sekarang });
    expect(hasil.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hasil.kedaluwarsaPada).toBe('2026-12-17T12:00:00.000Z');
    expect(hasil.sesi.user_id).toBe('user-1');
    expect(hasil.sesi.expires_at).toBe('2026-12-17T12:00:00.000Z');
    expect(sqlTerpanggil[0]).toContain('INSERT INTO sessions');
    const nilai = nilaiTerikat[0];
    // Token mentah tidak pernah dikirim ke D1.
    expect(nilai).not.toContain(hasil.token);
    expect(nilai[1]).toBe('user-1');
    expect(nilai[2]).toBe(await hashToken(hasil.token));
    expect(nilai[3]).toBe('2026-12-17T12:00:00.000Z');
    expect(nilai[4]).toBe('2026-11-17T12:00:00.000Z');
  });
});

describe('validasiSesi', () => {
  const sekarang = new Date('2026-11-17T12:00:00.000Z');

  it('mengembalikan sesi + pengguna untuk token valid', async () => {
    const { db } = buatMockDbDenganData({ sesi: sesiUji(), pengguna: PENGGUNA_UJI });
    const hasil = await validasiSesi(db, 'token-apa-pun', sekarang);
    expect(hasil?.sesi.id).toBe('sesi-1');
    expect(hasil?.pengguna.email).toBe('pengguna@contoh.test');
  });

  it('mengembalikan null untuk token kosong atau tidak dikenal', async () => {
    const { db } = buatMockDbDenganData({ sesi: null, pengguna: PENGGUNA_UJI });
    await expect(validasiSesi(db, null, sekarang)).resolves.toBeNull();
    await expect(validasiSesi(db, '', sekarang)).resolves.toBeNull();
    await expect(validasiSesi(db, 'token-asing', sekarang)).resolves.toBeNull();
  });

  it('menolak sesi kedaluwarsa dan menghapusnya dari D1', async () => {
    const { db, sqlTerpanggil } = buatMockDbDenganData({
      sesi: sesiUji({ expires_at: '2026-11-17T11:00:00.000Z' }),
      pengguna: PENGGUNA_UJI,
    });
    const hasil = await validasiSesi(db, 'token-apa-pun', sekarang);
    expect(hasil).toBeNull();
    expect(sqlTerpanggil.some((s) => s.startsWith('DELETE FROM sessions'))).toBe(true);
  });

  it('menolak sesi bila penggunanya sudah tidak ada', async () => {
    const { db } = buatMockDbDenganData({ sesi: sesiUji(), pengguna: null });
    await expect(validasiSesi(db, 'token-apa-pun', sekarang)).resolves.toBeNull();
  });

  it('mencari sesi berdasarkan hash token, bukan token mentah', async () => {
    const { db, nilaiTerikat } = buatMockDbDenganData({ sesi: sesiUji(), pengguna: PENGGUNA_UJI });
    await validasiSesi(db, 'token-mentah-rahasia', sekarang);
    const nilai = nilaiTerikat.flat();
    expect(nilai).not.toContain('token-mentah-rahasia');
    expect(nilai).toContain(await hashToken('token-mentah-rahasia'));
  });
});

describe('hapusSesi dan hapusSesiBerdasarkanId', () => {
  it('hapusSesi menghapus berdasarkan hash token', async () => {
    const { db, sqlTerpanggil, nilaiTerikat } = buatMockDbDenganData({});
    await expect(hapusSesi(db, 'token-hapus')).resolves.toBe(true);
    expect(sqlTerpanggil[0]).toBe('DELETE FROM sessions WHERE token_hash = ?');
    expect(nilaiTerikat[0][0]).toBe(await hashToken('token-hapus'));
  });

  it('hapusSesiBerdasarkanId menghapus berdasarkan id + user_id', async () => {
    const { db, sqlTerpanggil, nilaiTerikat } = buatMockDbDenganData({});
    await expect(hapusSesiBerdasarkanId(db, 'sesi-9', 'user-1')).resolves.toBe(true);
    expect(sqlTerpanggil[0]).toBe('DELETE FROM sessions WHERE id = ? AND user_id = ?');
    expect(nilaiTerikat[0]).toEqual(['sesi-9', 'user-1']);
  });
});

describe('daftarSesiPengguna', () => {
  it('mengembalikan sesi aktif terbaru dulu dan menyaring yang kedaluwarsa', async () => {
    const sekarang = new Date('2026-11-17T12:00:00.000Z');
    const { db } = buatMockDbDenganData({
      daftarSesi: [
        sesiUji({ id: 'sesi-aktif', expires_at: '2026-12-01T00:00:00.000Z' }),
        sesiUji({ id: 'sesi-kedaluwarsa', expires_at: '2026-11-01T00:00:00.000Z' }),
      ],
    });
    const daftar = await daftarSesiPengguna(db, 'user-1', sekarang);
    expect(daftar.map((s) => s.id)).toEqual(['sesi-aktif']);
    expect(daftar[0]).not.toHaveProperty('token_hash');
  });
});
