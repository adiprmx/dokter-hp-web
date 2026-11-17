// apps/api/src/auth/pin.test.ts
// Tes unit modul PIN: format, hash, verifikasi, logika kunci,
// dan operasi D1 (dengan mock DbD1 pencatat — tanpa D1 nyata).

import { describe, expect, it } from 'vitest';
import {
  ambilStatusPin,
  apakahPinTerkunci,
  apakahSesiTerbuka,
  apakahSesiTerkunci,
  buatSaltPin,
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
  validasiFormatPin,
  verifikasiPin,
} from './pin';
import type { DbD1, PernyataanD1 } from './session';

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

describe('buatSaltPin', () => {
  it('menghasilkan salt hex 32 karakter yang unik', () => {
    const a = buatSaltPin();
    const b = buatSaltPin();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe('hashPin dan verifikasiPin', () => {
  it('hash deterministis untuk pin + salt yang sama', async () => {
    const a = await hashPin('1234', 'salt-uji');
    const b = await hashPin('1234', 'salt-uji');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('salt berbeda menghasilkan hash berbeda', async () => {
    const a = await hashPin('1234', 'salt-satu');
    const b = await hashPin('1234', 'salt-dua');
    expect(a).not.toBe(b);
  });

  it('PIN berbeda menghasilkan hash berbeda', async () => {
    const a = await hashPin('1234', 'salt-sama');
    const b = await hashPin('4321', 'salt-sama');
    expect(a).not.toBe(b);
  });

  it('verifikasiPin menerima PIN benar dan menolak PIN salah', async () => {
    const salt = buatSaltPin();
    const hash = await hashPin('9876', salt);
    await expect(verifikasiPin('9876', salt, hash)).resolves.toBe(true);
    await expect(verifikasiPin('9875', salt, hash)).resolves.toBe(false);
  });

  it('verifikasiPin menolak bila salt atau hash kosong', async () => {
    await expect(verifikasiPin('1234', null, 'abc')).resolves.toBe(false);
    await expect(verifikasiPin('1234', 'salt', null)).resolves.toBe(false);
    await expect(verifikasiPin('1234', null, null)).resolves.toBe(false);
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
    await simpanPin(db, 'user-1', '1234');
    const update = panggilan.find((p) => p.sql.startsWith('UPDATE users SET pin_hash'));
    expect(update).toBeDefined();
    expect(update?.nilai[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(update?.nilai[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(update?.nilai[2]).toBe('user-1');
    // PIN mentah tidak pernah muncul di nilai bind mana pun.
    expect(panggilan.flatMap((p) => p.nilai)).not.toContain('1234');
    expect(panggilan.some((p) => p.sql.startsWith('DELETE FROM pin_attempts'))).toBe(true);
  });

  it('simpanPin menolak format PIN tidak valid', async () => {
    const { db } = buatMockDb();
    await expect(simpanPin(db, 'user-1', '12')).rejects.toThrow('Format PIN tidak valid');
    await expect(simpanPin(db, 'user-1', 'abcd')).rejects.toThrow('Format PIN tidak valid');
  });

  it('hapusPin mengosongkan hash/salt dan mereset penghitung gagal', async () => {
    const { db, panggilan } = buatMockDb();
    await hapusPin(db, 'user-1');
    const update = panggilan.find((p) => p.sql.includes('pin_hash = NULL'));
    expect(update).toBeDefined();
    expect(update?.nilai).toEqual(['user-1']);
    expect(panggilan.some((p) => p.sql.startsWith('DELETE FROM pin_attempts'))).toBe(true);
  });

  it('catatPinGagal menulis upsert dengan penghitung baru', async () => {
    const { db, panggilan } = buatMockDb();
    const hasil = await catatPinGagal(db, 'user-1', 2, new Date('2026-11-17T12:00:00.000Z'));
    expect(hasil).toEqual({ gagalBaru: 3, terkunci: false, terkunciSampai: null });
    const upsert = panggilan.find((p) => p.sql.startsWith('INSERT INTO pin_attempts'));
    expect(upsert?.nilai).toEqual(['user-1', 3, null]);
  });

  it('catatPinGagal ke-5 menulis waktu kunci', async () => {
    const { db, panggilan } = buatMockDb();
    const hasil = await catatPinGagal(db, 'user-1', 4, new Date('2026-11-17T12:00:00.000Z'));
    expect(hasil.terkunci).toBe(true);
    expect(hasil.terkunciSampai).toBe('2026-11-17T12:00:30.000Z');
    const upsert = panggilan.find((p) => p.sql.startsWith('INSERT INTO pin_attempts'));
    expect(upsert?.nilai).toEqual(['user-1', 5, '2026-11-17T12:00:30.000Z']);
  });

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
  it('tandaiSesiTerbuka menulis INSERT OR REPLACE', async () => {
    const { db, panggilan } = buatMockDb();
    await tandaiSesiTerbuka(db, 'sesi-1', new Date('2026-11-17T12:00:00.000Z'));
    expect(panggilan).toEqual([
      {
        sql: 'INSERT OR REPLACE INTO pin_unlocks (session_id, dibuka_pada) VALUES (?, ?)',
        nilai: ['sesi-1', '2026-11-17T12:00:00.000Z'],
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
});
