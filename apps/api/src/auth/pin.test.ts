// apps/api/src/auth/pin.test.ts
// Tes unit modul PIN: format, hash, verifikasi, logika kunci,
// dan operasi D1 (dengan mock DbD1 pencatat — tanpa D1 nyata).

import { describe, expect, it } from 'vitest';
import {
  ambilStatusPin,
  ambilWaktuBukaSesi,
  apakahPinLemah,
  apakahPinTerkunci,
  apakahSesiTerbuka,
  apakahSesiTerkunci,
  apakahWaktuDalamTenggang,
  buatSaltPin,
  BATAS_BERSIH_PIN_UNLOCKS,
  bersihkanPinUnlocksYatim,
  catatPinGagal,
  hapusPin,
  hashPin,
  pastikanTabelPin,
  PIN_KUNCI_DETIK,
  PIN_MAKS_GAGAL,
  resetPinGagal,
  simpanPin,
  sisaDetikKunci,
  tandaiSesiTerbuka,
  tentukanHasilPercobaanGagal,
  TENGGANG_AUTENTIKASI_MS,
  validasiFormatPin,
  verifikasiPin,
} from './pin';
import type { DbD1, PernyataanD1 } from './session';
import { FakeD1 } from '../test/fake-d1';

/** Pepper uji untuk semua tes hash PIN (bukan nilai produksi). */
const PEPPER_UJI = 'pepper-uji-bukan-rahasia';

// ---------------------------------------------------------------------------
// Mock DbD1 pencatat: mencatat SQL + bind, hasil first() diatur per tes.
// ---------------------------------------------------------------------------

interface PanggilanTerekam {
  sql: string;
  nilai: unknown[];
}

function buatMockDb(hasilFirst: unknown = null): {
  db: DbD1;
  panggilan: PanggilanTerekam[];
} {
  const panggilan: PanggilanTerekam[] = [];
  const db: DbD1 = {
    prepare(sql: string): PernyataanD1 {
      const pernyataan: PernyataanD1 = {
        bind(...nilai: unknown[]): PernyataanD1 {
          panggilan.push({ sql, nilai });
          return pernyataan;
        },
        async first<T>(): Promise<T | null> {
          return hasilFirst as T | null;
        },
        async all<T>(): Promise<{ results: T[]; success: boolean }> {
          return { results: [], success: true };
        },
        async run(): Promise<{ success: boolean }> {
          // CREATE TABLE tanpa bind tetap tercatat di sini.
          if (!panggilan.some((p) => p.sql === sql)) {
            panggilan.push({ sql, nilai: [] });
          }
          return { success: true };
        },
      };
      return pernyataan;
    },
  };
  return { db, panggilan };
}

describe('validasiFormatPin', () => {
  it('menerima PIN 4 sampai 8 digit', () => {
    expect(validasiFormatPin('1234')).toBe(true);
    expect(validasiFormatPin('12345')).toBe(true);
    expect(validasiFormatPin('12345678')).toBe(true);
    expect(validasiFormatPin('0000')).toBe(true);
  });

  it('menolak PIN terlalu pendek atau terlalu panjang', () => {
    expect(validasiFormatPin('123')).toBe(false);
    expect(validasiFormatPin('123456789')).toBe(false);
    expect(validasiFormatPin('')).toBe(false);
  });

  it('menolak PIN bukan angka dan bukan string', () => {
    expect(validasiFormatPin('12a4')).toBe(false);
    expect(validasiFormatPin('12 4')).toBe(false);
    expect(validasiFormatPin(1234)).toBe(false);
    expect(validasiFormatPin(null)).toBe(false);
    expect(validasiFormatPin(undefined)).toBe(false);
    expect(validasiFormatPin({})).toBe(false);
  });
});

describe('apakahPinLemah (R-11, K-70d)', () => {
  it('menolak semua digit sama', () => {
    expect(apakahPinLemah('0000')).toBe(true);
    expect(apakahPinLemah('9999')).toBe(true);
    expect(apakahPinLemah('111111')).toBe(true);
  });

  it('menolak urutan naik/turun ketat', () => {
    expect(apakahPinLemah('1234')).toBe(true);
    expect(apakahPinLemah('4321')).toBe(true);
    expect(apakahPinLemah('012345')).toBe(true);
    expect(apakahPinLemah('87654321')).toBe(true);
  });

  it('menerima PIN acak yang tidak berpola', () => {
    expect(apakahPinLemah('1357')).toBe(false);
    expect(apakahPinLemah('2846')).toBe(false);
    expect(apakahPinLemah('7391')).toBe(false);
    expect(apakahPinLemah('1029')).toBe(false);
  });

  it('menganggap bukan-format sebagai lemah', () => {
    expect(apakahPinLemah('123')).toBe(true);
    expect(apakahPinLemah('12ab')).toBe(true);
    expect(apakahPinLemah('')).toBe(true);
  });
});

describe('buatSaltPin', () => {
  it('menghasilkan salt hex 32 karakter yang unik', () => {
    const a = buatSaltPin();
    const b = buatSaltPin();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe('hashPin dan verifikasiPin (pepper HMAC, K-71)', () => {
  it('hash deterministis untuk pin + salt + pepper yang sama', async () => {
    const a = await hashPin('1357', 'salt-uji', PEPPER_UJI);
    const b = await hashPin('1357', 'salt-uji', PEPPER_UJI);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('salt berbeda menghasilkan hash berbeda', async () => {
    const a = await hashPin('1357', 'salt-satu', PEPPER_UJI);
    const b = await hashPin('1357', 'salt-dua', PEPPER_UJI);
    expect(a).not.toBe(b);
  });

  it('PIN berbeda menghasilkan hash berbeda', async () => {
    const a = await hashPin('1357', 'salt-sama', PEPPER_UJI);
    const b = await hashPin('4321', 'salt-sama', PEPPER_UJI);
    expect(a).not.toBe(b);
  });

  it('pepper berbeda menghasilkan hash berbeda (R-07)', async () => {
    const a = await hashPin('1357', 'salt-sama', 'pepper-satu');
    const b = await hashPin('1357', 'salt-sama', 'pepper-dua');
    expect(a).not.toBe(b);
  });

  it('gagal tertutup bila pepper tidak diatur', async () => {
    await expect(hashPin('1357', 'salt-uji', '')).rejects.toThrow(
      'PIN_PEPPER tidak diatur',
    );
    await expect(hashPin('1357', 'salt-uji', null)).rejects.toThrow(
      'PIN_PEPPER tidak diatur',
    );
    await expect(hashPin('1357', 'salt-uji', undefined)).rejects.toThrow(
      'PIN_PEPPER tidak diatur',
    );
  });

  it('verifikasiPin menerima PIN benar dan menolak PIN salah', async () => {
    const salt = buatSaltPin();
    const hash = await hashPin('9876', salt, PEPPER_UJI);
    await expect(verifikasiPin('9876', salt, hash, PEPPER_UJI)).resolves.toBe(true);
    await expect(verifikasiPin('9875', salt, hash, PEPPER_UJI)).resolves.toBe(false);
  });

  it('verifikasiPin menolak bila salt atau hash kosong', async () => {
    await expect(verifikasiPin('1357', null, 'abc', PEPPER_UJI)).resolves.toBe(false);
    await expect(verifikasiPin('1357', 'salt', null, PEPPER_UJI)).resolves.toBe(false);
    await expect(verifikasiPin('1357', null, null, PEPPER_UJI)).resolves.toBe(false);
  });

  it('verifikasiPin menolak hash yang dihitung dengan pepper lain', async () => {
    const salt = buatSaltPin();
    const hash = await hashPin('9876', salt, 'pepper-lain');
    await expect(verifikasiPin('9876', salt, hash, PEPPER_UJI)).resolves.toBe(false);
  });

  it('verifikasiPin gagal tertutup bila pepper tidak diatur', async () => {
    await expect(
      verifikasiPin('1357', 'salt', 'hash', undefined),
    ).rejects.toThrow('PIN_PEPPER tidak diatur');
  });
});

describe('apakahWaktuDalamTenggang (K-70/K-72)', () => {
  const sekarang = new Date('2026-11-17T12:00:00.000Z');

  it('tenggang autentikasi adalah 10 menit', () => {
    expect(TENGGANG_AUTENTIKASI_MS).toBe(10 * 60 * 1000);
  });

  it('true bila waktu dalam 10 menit terakhir', () => {
    expect(
      apakahWaktuDalamTenggang('2026-11-17T11:55:00.000Z', sekarang),
    ).toBe(true);
    expect(
      apakahWaktuDalamTenggang('2026-11-17T11:50:00.000Z', sekarang),
    ).toBe(true);
  });

  it('false bila waktu lebih dari 10 menit lalu, null, atau tidak valid', () => {
    expect(
      apakahWaktuDalamTenggang('2026-11-17T11:49:59.000Z', sekarang),
    ).toBe(false);
    expect(apakahWaktuDalamTenggang(null, sekarang)).toBe(false);
    expect(apakahWaktuDalamTenggang(undefined, sekarang)).toBe(false);
    expect(apakahWaktuDalamTenggang('bukan-waktu', sekarang)).toBe(false);
  });

  it('false bila waktu di masa depan', () => {
    expect(
      apakahWaktuDalamTenggang('2026-11-17T12:00:01.000Z', sekarang),
    ).toBe(false);
  });
});

describe('apakahPinTerkunci dan sisaDetikKunci', () => {
  const sekarang = new Date('2026-11-17T12:00:00.000Z');

  it('tidak terkunci bila terkunci_sampai null', () => {
    expect(apakahPinTerkunci(null, sekarang)).toBe(false);
    expect(apakahPinTerkunci(undefined, sekarang)).toBe(false);
    expect(sisaDetikKunci(null, sekarang)).toBe(0);
  });

  it('tidak terkunci bila waktu kunci sudah lewat', () => {
    expect(apakahPinTerkunci('2026-11-17T11:59:59.000Z', sekarang)).toBe(false);
    expect(sisaDetikKunci('2026-11-17T11:59:59.000Z', sekarang)).toBe(0);
  });

  it('terkunci bila waktu kunci masih di depan', () => {
    expect(apakahPinTerkunci('2026-11-17T12:00:30.000Z', sekarang)).toBe(true);
    expect(sisaDetikKunci('2026-11-17T12:00:30.000Z', sekarang)).toBe(30);
    expect(sisaDetikKunci('2026-11-17T12:00:01.500Z', sekarang)).toBe(2);
  });
});

describe('tentukanHasilPercobaanGagal', () => {
  const sekarang = new Date('2026-11-17T12:00:00.000Z');

  it('menaikkan penghitung tanpa kunci sebelum batas', () => {
    expect(tentukanHasilPercobaanGagal(0, sekarang)).toEqual({
      gagalBaru: 1,
      terkunci: false,
      terkunciSampai: null,
    });
    expect(tentukanHasilPercobaanGagal(3, sekarang)).toEqual({
      gagalBaru: 4,
      terkunci: false,
      terkunciSampai: null,
    });
  });

  it('mengunci 30 detik pada percobaan salah ke-5', () => {
    const hasil = tentukanHasilPercobaanGagal(4, sekarang);
    expect(hasil.gagalBaru).toBe(5);
    expect(hasil.terkunci).toBe(true);
    expect(hasil.terkunciSampai).toBe('2026-11-17T12:00:30.000Z');
  });

  it('konstanta batas sesuai spesifikasi', () => {
    expect(PIN_MAKS_GAGAL).toBe(5);
    expect(PIN_KUNCI_DETIK).toBe(30);
  });
});

describe('pastikanTabelPin', () => {
  it('menjalankan CREATE TABLE IF NOT EXISTS untuk kedua tabel', async () => {
    const { db, panggilan } = buatMockDb();
    await pastikanTabelPin(db);
    const sql = panggilan.map((p) => p.sql);
    expect(sql.some((s) => s.includes('CREATE TABLE IF NOT EXISTS pin_attempts'))).toBe(true);
    expect(sql.some((s) => s.includes('CREATE TABLE IF NOT EXISTS pin_unlocks'))).toBe(true);
  });
});

describe('operasi PIN di D1 (mock)', () => {
  it('simpanPin menulis hash + salt dan mereset penghitung gagal', async () => {
    const { db, panggilan } = buatMockDb();
    await simpanPin(db, 'user-1', '1357', PEPPER_UJI);
    const update = panggilan.find((p) => p.sql.startsWith('UPDATE users SET pin_hash'));
    expect(update).toBeDefined();
    expect(update?.nilai[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(update?.nilai[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(update?.nilai[2]).toBe('user-1');
    // PIN mentah tidak pernah muncul di nilai bind mana pun.
    expect(panggilan.flatMap((p) => p.nilai)).not.toContain('1357');
    expect(panggilan.some((p) => p.sql.startsWith('DELETE FROM pin_attempts'))).toBe(true);
  });

  it('simpanPin menolak format PIN tidak valid', async () => {
    const { db } = buatMockDb();
    await expect(simpanPin(db, 'user-1', '12', PEPPER_UJI)).rejects.toThrow(
      'Format PIN tidak valid',
    );
    await expect(simpanPin(db, 'user-1', 'abcd', PEPPER_UJI)).rejects.toThrow(
      'Format PIN tidak valid',
    );
  });

  it('simpanPin menolak PIN lemah (R-11)', async () => {
    const { db } = buatMockDb();
    for (const pinLemah of ['1234', '0000', '9999', '4321']) {
      await expect(simpanPin(db, 'user-1', pinLemah, PEPPER_UJI)).rejects.toThrow(
        'PIN terlalu mudah ditebak',
      );
    }
  });

  it('simpanPin gagal tertutup bila pepper tidak diatur', async () => {
    const { db } = buatMockDb();
    await expect(simpanPin(db, 'user-1', '1357', '')).rejects.toThrow(
      'PIN_PEPPER tidak diatur',
    );
  });

  it('hapusPin mengosongkan hash/salt dan mereset penghitung gagal', async () => {
    const { db, panggilan } = buatMockDb();
    await hapusPin(db, 'user-1');
    const update = panggilan.find((p) => p.sql.includes('pin_hash = NULL'));
    expect(update).toBeDefined();
    expect(update?.nilai).toEqual(['user-1']);
    expect(panggilan.some((p) => p.sql.startsWith('DELETE FROM pin_attempts'))).toBe(true);
  });
});

describe('catatPinGagal atomik (R-04, FakeD1)', () => {
  const SEKARANG = new Date('2026-11-17T12:00:00.000Z');

  it('menaikkan penghitung dari nilai tersimpan tanpa masukan pemanggil', async () => {
    const db = new FakeD1({
      pin_attempts: [
        { user_id: 'user-1', gagal_berturut: 2, terkunci_sampai: null },
      ],
    });
    const hasil = await catatPinGagal(db, 'user-1', SEKARANG);
    expect(hasil).toEqual({ gagalBaru: 3, terkunci: false, terkunciSampai: null });
    expect(db.baris('pin_attempts')[0]?.gagal_berturut).toBe(3);
  });

  it('mengunci 30 detik pada percobaan salah ke-5', async () => {
    const db = new FakeD1({
      pin_attempts: [
        { user_id: 'user-1', gagal_berturut: 4, terkunci_sampai: null },
      ],
    });
    const hasil = await catatPinGagal(db, 'user-1', SEKARANG);
    expect(hasil.gagalBaru).toBe(5);
    expect(hasil.terkunci).toBe(true);
    expect(hasil.terkunciSampai).toBe('2026-11-17T12:00:30.000Z');
    expect(db.baris('pin_attempts')[0]?.terkunci_sampai).toBe(
      '2026-11-17T12:00:30.000Z',
    );
  });

  it('mengunci lagi setelah kunci sebelumnya kedaluwarsa (penghitung tidak di-reset waktu)', async () => {
    const db = new FakeD1({
      pin_attempts: [
        {
          user_id: 'user-1',
          gagal_berturut: 5,
          terkunci_sampai: '2026-11-17T11:59:00.000Z',
        },
      ],
    });
    const hasil = await catatPinGagal(db, 'user-1', SEKARANG);
    expect(hasil.gagalBaru).toBe(6);
    expect(hasil.terkunci).toBe(true);
    expect(hasil.terkunciSampai).toBe('2026-11-17T12:00:30.000Z');
  });

  it('tidak memperpanjang kunci yang masih aktif', async () => {
    const db = new FakeD1({
      pin_attempts: [
        {
          user_id: 'user-1',
          gagal_berturut: 5,
          terkunci_sampai: '2026-11-17T12:00:25.000Z',
        },
      ],
    });
    const hasil = await catatPinGagal(db, 'user-1', SEKARANG);
    expect(hasil.gagalBaru).toBe(6);
    expect(hasil.terkunci).toBe(false);
    expect(db.baris('pin_attempts')[0]?.terkunci_sampai).toBe(
      '2026-11-17T12:00:25.000Z',
    );
  });

  it('burst 10 paralel mencatat seluruh percobaan dan mengunci tepat di ke-5 (regresi R-04)', async () => {
    const db = new FakeD1({});
    const hasil = await Promise.all(
      Array.from({ length: 10 }, () => catatPinGagal(db, 'user-1', SEKARANG)),
    );
    const terkunci = hasil.filter((h) => h.terkunci);
    expect(terkunci).toHaveLength(1);
    // gagalBaru adalah bacaan sesudah increment (bisa 10 untuk semua
    // pemanggil) — yang dijamin atomik adalah penghitung akhir dan
    // bahwa tepat satu pemanggil yang menulis kunci.
    expect(terkunci[0]?.terkunciSampai).toBe('2026-11-17T12:00:30.000Z');
    // Seluruh 10 percobaan tercatat (implementasi lama hanya ~3).
    expect(db.baris('pin_attempts')[0]?.gagal_berturut).toBe(10);
    expect(db.baris('pin_attempts')[0]?.terkunci_sampai).toBe(
      '2026-11-17T12:00:30.000Z',
    );
  });
});

describe('resetPinGagal dan ambilStatusPin', () => {
  it('resetPinGagal menghapus baris percobaan pengguna', async () => {
    const { db, panggilan } = buatMockDb();
    await resetPinGagal(db, 'user-1');
    expect(panggilan).toEqual([
      { sql: 'DELETE FROM pin_attempts WHERE user_id = ?', nilai: ['user-1'] },
    ]);
  });

  it('ambilStatusPin menggabungkan users dan pin_attempts', async () => {
    let panggilanKe = 0;
    const db: DbD1 = {
      prepare(sql: string): PernyataanD1 {
        const pernyataan: PernyataanD1 = {
          bind(): PernyataanD1 {
            return pernyataan;
          },
          async first<T>(): Promise<T | null> {
            panggilanKe += 1;
            if (sql.includes('FROM users')) {
              return { pin_hash: 'hash-uji', pin_salt: 'salt-uji' } as T;
            }
            return { gagal_berturut: 2, terkunci_sampai: null } as T;
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
    const status = await ambilStatusPin(db, 'user-1');
    expect(status).toEqual({
      pinDiatur: true,
      pinHash: 'hash-uji',
      pinSalt: 'salt-uji',
      gagalBerturut: 2,
      terkunciSampai: null,
    });
    expect(panggilanKe).toBe(2);
  });

  it('ambilStatusPin mengembalikan null bila pengguna tidak ada', async () => {
    const { db } = buatMockDb(null);
    await expect(ambilStatusPin(db, 'tidak-ada')).resolves.toBeNull();
  });
});

describe('penanda sesi terbuka', () => {
  it('tandaiSesiTerbuka menulis INSERT OR REPLACE lalu memicu sapuan yatim (R-15)', async () => {
    const { db, panggilan } = buatMockDb();
    await tandaiSesiTerbuka(db, 'sesi-1', new Date('2026-11-17T12:00:00.000Z'));
    expect(panggilan).toEqual([
      {
        sql: 'INSERT OR REPLACE INTO pin_unlocks (session_id, dibuka_pada) VALUES (?, ?)',
        nilai: ['sesi-1', '2026-11-17T12:00:00.000Z'],
      },
      {
        sql: 'SELECT session_id FROM pin_unlocks ORDER BY dibuka_pada ASC LIMIT ?',
        nilai: [100],
      },
    ]);
  });

  it('apakahSesiTerbuka true bila ada penanda, false bila tidak', async () => {
    const { db: dbAda } = buatMockDb({ session_id: 'sesi-1' });
    await expect(apakahSesiTerbuka(dbAda, 'sesi-1')).resolves.toBe(true);
    const { db: dbTidak } = buatMockDb(null);
    await expect(apakahSesiTerbuka(dbTidak, 'sesi-1')).resolves.toBe(false);
  });

  it('apakahSesiTerbuka gagal tertutup (false) bila query melempar galat', async () => {
    const db: DbD1 = {
      prepare(): PernyataanD1 {
        const pernyataan: PernyataanD1 = {
          bind(): PernyataanD1 {
            return pernyataan;
          },
          async first(): Promise<never> {
            throw new Error('no such table: pin_unlocks');
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
    await expect(apakahSesiTerbuka(db, 'sesi-1')).resolves.toBe(false);
  });

  it('apakahSesiTerkunci false bila PIN belum diatur (tanpa query)', async () => {
    const db: DbD1 = {
      prepare(): PernyataanD1 {
        throw new Error('seharusnya tidak ada query');
      },
    };
    await expect(apakahSesiTerkunci(db, 'sesi-1', false)).resolves.toBe(false);
  });

  it('apakahSesiTerkunci true bila PIN diatur dan sesi belum dibuka', async () => {
    const { db } = buatMockDb(null);
    await expect(apakahSesiTerkunci(db, 'sesi-1', true)).resolves.toBe(true);
    const { db: dbBuka } = buatMockDb({ session_id: 'sesi-1' });
    await expect(apakahSesiTerkunci(dbBuka, 'sesi-1', true)).resolves.toBe(false);
  });

  it('ambilWaktuBukaSesi mengembalikan waktu buka atau null (K-72)', async () => {
    const db = new FakeD1({
      pin_unlocks: [
        { session_id: 'sesi-1', dibuka_pada: '2026-11-17T12:00:00.000Z' },
      ],
    });
    await expect(ambilWaktuBukaSesi(db, 'sesi-1')).resolves.toBe(
      '2026-11-17T12:00:00.000Z',
    );
    await expect(ambilWaktuBukaSesi(db, 'sesi-tidak-ada')).resolves.toBeNull();
    const dbKosong = new FakeD1({});
    await expect(ambilWaktuBukaSesi(dbKosong, 'sesi-1')).resolves.toBeNull();
  });
});

describe('bersihkanPinUnlocksYatim (R-15)', () => {
  const SEKARANG = new Date('2026-11-17T12:00:00.000Z');

  it('menghapus penanda yatim (sesi hilang atau kedaluwarsa) dan mempertahankan penanda sesi hidup', async () => {
    const db = new FakeD1({
      sessions: [
        { id: 'sesi-hidup', expires_at: '2026-11-17T13:00:00.000Z' },
        { id: 'sesi-kedaluwarsa', expires_at: '2026-11-17T11:00:00.000Z' },
      ],
      pin_unlocks: [
        { session_id: 'sesi-hidup', dibuka_pada: '2026-11-17T10:00:00.000Z' },
        { session_id: 'sesi-kedaluwarsa', dibuka_pada: '2026-11-17T10:00:00.000Z' },
        { session_id: 'sesi-hilang', dibuka_pada: '2026-11-17T10:00:00.000Z' },
      ],
    });
    expect(await bersihkanPinUnlocksYatim(db, SEKARANG)).toBe(2);
    expect(db.baris('pin_unlocks').map((b) => b.session_id)).toEqual(['sesi-hidup']);
  });

  it('mengembalikan 0 dan tidak menghapus bila tidak ada penanda yatim', async () => {
    const db = new FakeD1({
      sessions: [{ id: 'sesi-hidup', expires_at: '2026-11-17T13:00:00.000Z' }],
      pin_unlocks: [
        { session_id: 'sesi-hidup', dibuka_pada: '2026-11-17T10:00:00.000Z' },
      ],
    });
    expect(await bersihkanPinUnlocksYatim(db, SEKARANG)).toBe(0);
    expect(db.baris('pin_unlocks')).toHaveLength(1);
  });

  it('menyapu maksimal 100 baris per pemicu (yang tertua dulu)', async () => {
    expect(BATAS_BERSIH_PIN_UNLOCKS).toBe(100);
    const yatim = Array.from({ length: 105 }, (_, i) => ({
      session_id: `sesi-yatim-${String(i).padStart(3, '0')}`,
      dibuka_pada: new Date(Date.UTC(2026, 10, 1, 0, 0, i)).toISOString(),
    }));
    const db = new FakeD1({ pin_unlocks: yatim });
    expect(await bersihkanPinUnlocksYatim(db, SEKARANG)).toBe(100);
    expect(db.baris('pin_unlocks')).toHaveLength(5);
    // Yang tersisa adalah 5 penanda terbaru (sapuan mengambil yang tertua).
    expect(db.baris('pin_unlocks').map((b) => b.session_id).sort()).toEqual([
      'sesi-yatim-100',
      'sesi-yatim-101',
      'sesi-yatim-102',
      'sesi-yatim-103',
      'sesi-yatim-104',
    ]);
  });

  it('best-effort: mengembalikan 0 bila D1 gagal', async () => {
    const db: DbD1 = {
      prepare(): PernyataanD1 {
        throw new Error('D1 gagal (simulasi)');
      },
    };
    await expect(bersihkanPinUnlocksYatim(db, SEKARANG)).resolves.toBe(0);
  });

  it('tandaiSesiTerbuka memicu sapuan: penanda yatim lama ikut terhapus', async () => {
    const db = new FakeD1({
      sessions: [{ id: 'sesi-baru', expires_at: '2026-11-17T13:00:00.000Z' }],
      pin_unlocks: [
        { session_id: 'sesi-yatim', dibuka_pada: '2026-11-17T10:00:00.000Z' },
      ],
    });
    await tandaiSesiTerbuka(db, 'sesi-baru', SEKARANG);
    expect(db.baris('pin_unlocks').map((b) => b.session_id)).toEqual(['sesi-baru']);
  });
});
