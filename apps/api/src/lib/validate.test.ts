// apps/api/src/lib/validate.test.ts
// Unit test validasi input.

import { describe, expect, it } from 'vitest';
import {
  isUuid,
  validateChannel,
  validateDurasiTes,
  validateInteger,
  validateKekuatanSinyal,
  validateNumber,
  validateRingkasan,
  validateSamples,
  validateSkor,
  validateString,
  validateSumber,
  validateSyncStatus,
  validateUuid,
} from './validate';

const UUID_VALID = '123e4567-e89b-42d3-a456-426614174000';

describe('isUuid / validateUuid', () => {
  it('menerima UUID format benar (huruf besar/kecil)', () => {
    expect(isUuid(UUID_VALID)).toBe(true);
    expect(isUuid('123E4567-E89B-42D3-A456-426614174000')).toBe(true);
    expect(validateUuid(UUID_VALID)).toEqual({ ok: true, value: UUID_VALID });
  });

  it('menolak UUID yang salah format', () => {
    for (const buruk of [
      'bukan-uuid',
      '123e4567-e89b-42d3-a456',
      '123e4567-e89b-42d3-a456-42661417400z',
      '123e4567e89b42d3a456426614174000',
      '',
      123,
      null,
      undefined,
    ]) {
      expect(isUuid(buruk)).toBe(false);
      expect(validateUuid(buruk).ok).toBe(false);
    }
  });
});

describe('validateSkor', () => {
  it('menerima batas 0 dan 100 serta nilai di antaranya', () => {
    expect(validateSkor(0)).toEqual({ ok: true, value: 0 });
    expect(validateSkor(100)).toEqual({ ok: true, value: 100 });
    expect(validateSkor(57)).toEqual({ ok: true, value: 57 });
  });

  it('menolak di luar 0-100, desimal, dan bukan angka', () => {
    for (const buruk of [-1, 101, 50.5, '80', NaN, Infinity, null, undefined, {}, []]) {
      const hasil = validateSkor(buruk);
      expect(hasil.ok).toBe(false);
      if (!hasil.ok) expect(hasil.message).toMatch(/Skor/);
    }
  });
});

describe('validateString', () => {
  it('mengembalikan null untuk nilai opsional yang kosong', () => {
    expect(validateString(undefined, 'ssid', { max: 32 })).toEqual({ ok: true, value: null });
    expect(validateString('', 'ssid', { max: 32 })).toEqual({ ok: true, value: null });
    expect(validateString('   ', 'ssid', { max: 32 })).toEqual({ ok: true, value: null });
  });

  it('merapikan spasi ujung', () => {
    expect(validateString('  ACHA  ', 'ssid', { max: 32 })).toEqual({
      ok: true,
      value: 'ACHA',
    });
  });

  it('menolak nilai wajib yang kosong dan nilai melebihi maksimum', () => {
    expect(validateString('', 'nama', { required: true, max: 100 }).ok).toBe(false);
    expect(validateString(undefined, 'nama', { required: true }).ok).toBe(false);
    expect(validateString('x'.repeat(33), 'ssid', { max: 32 }).ok).toBe(false);
    expect(validateString(42, 'ssid', { max: 32 }).ok).toBe(false);
  });

  it('menegakkan panjang minimum', () => {
    expect(validateString('ab', 'nama', { min: 3 }).ok).toBe(false);
    expect(validateString('abc', 'nama', { min: 3 }).ok).toBe(true);
  });
});

describe('validateInteger / validateNumber', () => {
  it('menerima bilangan bulat dalam rentang', () => {
    expect(validateInteger(6, 'channel', { min: 1, max: 165 })).toEqual({
      ok: true,
      value: 6,
    });
    expect(validateInteger(1, 'channel', { min: 1, max: 165 }).ok).toBe(true);
    expect(validateInteger(165, 'channel', { min: 1, max: 165 }).ok).toBe(true);
  });

  it('menolak desimal untuk bilangan bulat dan nilai di luar rentang', () => {
    expect(validateInteger(6.5, 'channel', { min: 1, max: 165 }).ok).toBe(false);
    expect(validateInteger(0, 'channel', { min: 1, max: 165 }).ok).toBe(false);
    expect(validateInteger(166, 'channel', { min: 1, max: 165 }).ok).toBe(false);
    expect(validateInteger('6', 'channel').ok).toBe(false);
  });

  it('menerima desimal untuk validateNumber dan menegakkan batas eksklusif', () => {
    expect(validateNumber(65.5, 'kecepatan_koneksi_mbps', { min: 0 })).toEqual({
      ok: true,
      value: 65.5,
    });
    expect(validateNumber(-1, 'kecepatan_koneksi_mbps', { min: 0 }).ok).toBe(false);
    expect(
      validateNumber(0, 'kecepatan_koneksi_mbps', { minExclusive: 0 }).ok,
    ).toBe(false);
    expect(
      validateNumber(0.1, 'kecepatan_koneksi_mbps', { minExclusive: 0 }).ok,
    ).toBe(true);
  });
});

describe('validateChannel', () => {
  it('menerima 1-14 (2,4 GHz) dan 32-177 (5 GHz)', () => {
    for (const baik of [1, 6, 11, 14, 32, 36, 149, 177]) {
      expect(validateChannel(baik)).toEqual({ ok: true, value: baik });
    }
    expect(validateChannel(undefined)).toEqual({ ok: true, value: null });
    expect(validateChannel(null)).toEqual({ ok: true, value: null });
  });

  it('menolak celah di antara kedua pita dan nilai di luar rentang', () => {
    for (const buruk of [0, 15, 20, 31, 178, 200, 6.5, '6']) {
      expect(validateChannel(buruk).ok).toBe(false);
    }
  });
});

describe('validateDurasiTes', () => {
  it('menerima null dan 30 saja', () => {
    expect(validateDurasiTes(undefined)).toEqual({ ok: true, value: null });
    expect(validateDurasiTes(null)).toEqual({ ok: true, value: null });
    expect(validateDurasiTes(30)).toEqual({ ok: true, value: 30 });
    for (const buruk of [0, 10, 29, 31, 60, '30']) {
      expect(validateDurasiTes(buruk).ok).toBe(false);
    }
  });
});

describe('enum sync_status / kekuatan_sinyal / sumber', () => {
  it('menerima nilai enum yang sah', () => {
    expect(validateSyncStatus('pending')).toEqual({ ok: true, value: 'pending' });
    expect(validateSyncStatus('synced')).toEqual({ ok: true, value: 'synced' });
    expect(validateSyncStatus('failed')).toEqual({ ok: true, value: 'failed' });
    expect(validateKekuatanSinyal('kuat')).toEqual({ ok: true, value: 'kuat' });
    expect(validateSumber('manual')).toEqual({ ok: true, value: 'manual' });
  });

  it('menolak nilai di luar enum', () => {
    expect(validateSyncStatus('selesai').ok).toBe(false);
    expect(validateSyncStatus('SYNCED').ok).toBe(false);
    expect(validateKekuatanSinyal('sangat kuat').ok).toBe(false);
    expect(validateSumber('website').ok).toBe(false);
  });

  it('mengembalikan null untuk nilai opsional yang kosong', () => {
    expect(validateSyncStatus(undefined)).toEqual({ ok: true, value: null });
    expect(validateSyncStatus(null)).toEqual({ ok: true, value: null });
  });
});

describe('validateRingkasan', () => {
  it('menerima objek dan nilai kosong menjadi objek kosong', () => {
    expect(validateRingkasan({ baterai: 'baik' })).toEqual({
      ok: true,
      value: { baterai: 'baik' },
    });
    expect(validateRingkasan(undefined)).toEqual({ ok: true, value: {} });
    expect(validateRingkasan(null)).toEqual({ ok: true, value: {} });
  });

  it('menerima objek komponen apa pun (detail mentah frontend)', () => {
    const hasil = validateRingkasan({
      baterai: { status: 'baik', skor: 80, sumber: 'manual', persen: 75 },
      keamanan: { status: 'cukup', skor: 60, sumber: 'manual', aplikasi: [{ nama: 'A' }] },
    });
    expect(hasil.ok).toBe(true);
  });

  it('menolak array, string, dan objek di atas 10 KB', () => {
    expect(validateRingkasan([1, 2]).ok).toBe(false);
    expect(validateRingkasan('teks').ok).toBe(false);
    expect(validateRingkasan({ data: 'x'.repeat(11_000) }).ok).toBe(false);
    expect(validateRingkasan({ data: 'x'.repeat(9_000) }).ok).toBe(true);
  });
});

describe('validateSamples', () => {
  it('menerima daftar sampel valid dan mengurutkannya', () => {
    const hasil = validateSamples([
      { detik_ke: 2, kecepatan_kbps: 100 },
      { detik_ke: 0, kecepatan_kbps: 500 },
      { detik_ke: 1, kecepatan_kbps: 300 },
    ]);
    expect(hasil).toEqual({
      ok: true,
      value: [
        { detik_ke: 0, kecepatan_kbps: 500 },
        { detik_ke: 1, kecepatan_kbps: 300 },
        { detik_ke: 2, kecepatan_kbps: 100 },
      ],
    });
  });

  it('menolak daftar kosong, lebih dari 30, dan detik di luar 0-29', () => {
    expect(validateSamples([]).ok).toBe(false);
    expect(validateSamples('bukan array').ok).toBe(false);
    expect(
      validateSamples(
        Array.from({ length: 31 }, (_, i) => ({ detik_ke: i % 30, kecepatan_kbps: 1 })),
      ).ok,
    ).toBe(false);
    expect(validateSamples([{ detik_ke: 30, kecepatan_kbps: 1 }]).ok).toBe(false);
    expect(validateSamples([{ detik_ke: -1, kecepatan_kbps: 1 }]).ok).toBe(false);
    expect(validateSamples([{ detik_ke: 1.5, kecepatan_kbps: 1 }]).ok).toBe(false);
  });

  it('menolak detik duplikat, kecepatan negatif, dan kecepatan di atas 1.000.000', () => {
    expect(
      validateSamples([
        { detik_ke: 1, kecepatan_kbps: 100 },
        { detik_ke: 1, kecepatan_kbps: 200 },
      ]).ok,
    ).toBe(false);
    expect(validateSamples([{ detik_ke: 0, kecepatan_kbps: -5 }]).ok).toBe(false);
    expect(validateSamples([{ detik_ke: 0, kecepatan_kbps: 1_000_001 }]).ok).toBe(false);
    expect(validateSamples([{ detik_ke: 0, kecepatan_kbps: 1_000_000 }]).ok).toBe(true);
    expect(validateSamples([{ detik_ke: 0 }]).ok).toBe(false);
  });
});
