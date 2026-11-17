// apps/api/src/lib/ratelimit.test.ts
// Unit test rate limit D1 (K-02, K-42, K-59) dengan FakeD1.

import { describe, expect, it } from 'vitest';
import {
  BATAS_BACA_PER_MENIT,
  BATAS_EKSPOR_PER_HARI,
  BATAS_OAUTH_PER_MENIT,
  BATAS_TULIS_PER_MENIT,
  bersihkanBatasKedaluwarsa,
  catatEkspor,
  cekDanCatat,
  detikSampaiKedaluwarsa,
  jendelaHarian,
  jendelaMenit,
} from './ratelimit';
import { FakeD1 } from '../test/fake-d1';

describe('jendelaHarian / jendelaMenit', () => {
  it('jendela harian: kunci per hari UTC, kedaluwarsa tengah malam berikutnya', () => {
    const j = jendelaHarian('ekspor', 'user-1', new Date('2026-11-18T10:30:00.000Z'));
    expect(j.kunci).toBe('ekspor:user-1:2026-11-18');
    expect(j.mulai).toBe('2026-11-18T00:00:00.000Z');
    expect(j.kedaluwarsa).toBe('2026-11-19T00:00:00.000Z');
  });

  it('jendela menit: kunci per menit UTC, kedaluwarsa +60 detik', () => {
    const j = jendelaMenit('tulis', 'user-1', new Date('2026-11-18T10:30:45.000Z'));
    expect(j.kunci).toBe('tulis:user-1:2026-11-18T10:30');
    expect(j.mulai).toBe('2026-11-18T10:30:00.000Z');
    expect(j.kedaluwarsa).toBe('2026-11-18T10:31:00.000Z');
  });

  it('detikSampaiKedaluwarsa menghitung sisa detik, minimal 1', () => {
    const j = jendelaHarian('ekspor', 'user-1', new Date('2026-11-18T23:59:30.000Z'));
    expect(detikSampaiKedaluwarsa(j, new Date('2026-11-18T23:59:30.000Z'))).toBe(30);
    expect(detikSampaiKedaluwarsa(j, new Date('2026-11-19T00:00:30.000Z'))).toBe(1);
  });
});

describe('cekDanCatat', () => {
  it('mengizinkan sampai batas, menolak setelahnya tanpa menambah hitungan', async () => {
    const db = new FakeD1({});
    const jendela = jendelaMenit('tulis', 'user-1', new Date('2026-11-18T10:30:00.000Z'));
    for (let i = 1; i <= 3; i++) {
      const s = await cekDanCatat(db, jendela, 3);
      expect(s.diizinkan).toBe(true);
      expect(s.terpakai).toBe(i);
      expect(s.sisa).toBe(3 - i);
    }
    const ditolak = await cekDanCatat(db, jendela, 3);
    expect(ditolak.diizinkan).toBe(false);
    expect(ditolak.terpakai).toBe(3);
    expect(ditolak.sisa).toBe(0);
    // Penolakan tidak menambah hitungan: cek berikutnya tetap 3.
    const ditolak2 = await cekDanCatat(db, jendela, 3);
    expect(ditolak2.terpakai).toBe(3);
  });

  it('burst 20 paralel meloloskan tepat batas, tanpa over-rejection (regresi R-03)', async () => {
    const db = new FakeD1({});
    const jendela = jendelaMenit('oauth', '203.0.113.9', new Date('2026-11-18T10:30:00.000Z'));
    const hasil = await Promise.all(
      Array.from({ length: 20 }, () => cekDanCatat(db, jendela, 10)),
    );
    const diizinkan = hasil.filter((s) => s.diizinkan);
    const ditolak = hasil.filter((s) => !s.diizinkan);
    expect(diizinkan).toHaveLength(10);
    expect(ditolak).toHaveLength(10);
    // Hitungan akhir tepat 10 (implementasi lama: 20 lolos, tercatat 2).
    const baris = db.baris('rate_limits');
    expect(baris).toHaveLength(1);
    expect(baris[0]?.jumlah).toBe(10);
  });

  it('pembersihan malas menghapus baris kedaluwarsa saat kunci baru dibuat (R-15)', async () => {
    const sekarang = new Date();
    const kemarin = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const besok = new Date(sekarang.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const db = new FakeD1({
      rate_limits: [
        {
          kunci: 'tulis:user-lama:2026-11-01T09:00',
          jumlah: 3,
          jendela_mulai: '2026-11-01T09:00:00.000Z',
          kedaluwarsa_pada: kemarin,
        },
        {
          kunci: 'tulis:user-aktif:2099-01-01T10:30',
          jumlah: 1,
          jendela_mulai: '2099-01-01T10:30:00.000Z',
          kedaluwarsa_pada: besok,
        },
      ],
    });
    const jendela = jendelaMenit('tulis', 'user-baru', sekarang);
    const status = await cekDanCatat(db, jendela, 60);
    expect(status.diizinkan).toBe(true);
    const kunci = db.baris('rate_limits').map((b) => b.kunci);
    expect(kunci).not.toContain('tulis:user-lama:2026-11-01T09:00');
    expect(kunci).toContain('tulis:user-aktif:2099-01-01T10:30');
    expect(kunci).toContain(jendela.kunci);
  });

  it('bersihkanBatasKedaluwarsa mengembalikan 0 dan tidak melempar bila D1 gagal', async () => {
    const db = new FakeD1({});
    // FakeD1 tanpa tabel rate_limits: SELECT mengembalikan baris kosong.
    await expect(
      bersihkanBatasKedaluwarsa(db, new Date('2026-11-18T10:30:00.000Z')),
    ).resolves.toBe(0);
  });

  it('jendela baru memberi hitungan segar', async () => {
    const db = new FakeD1({});
    const j1 = jendelaMenit('tulis', 'user-1', new Date('2026-11-18T10:30:00.000Z'));
    const j2 = jendelaMenit('tulis', 'user-1', new Date('2026-11-18T10:31:00.000Z'));
    expect((await cekDanCatat(db, j1, 1)).diizinkan).toBe(true);
    expect((await cekDanCatat(db, j1, 1)).diizinkan).toBe(false);
    expect((await cekDanCatat(db, j2, 1)).diizinkan).toBe(true);
  });

  it('hitungan terisolasi per pengguna dan per cakupan', async () => {
    const db = new FakeD1({});
    const sekarang = new Date('2026-11-18T10:30:00.000Z');
    const a = jendelaMenit('tulis', 'user-a', sekarang);
    const b = jendelaMenit('tulis', 'user-b', sekarang);
    const c = jendelaMenit('baca', 'user-a', sekarang);
    expect((await cekDanCatat(db, a, 1)).diizinkan).toBe(true);
    expect((await cekDanCatat(db, a, 1)).diizinkan).toBe(false);
    expect((await cekDanCatat(db, b, 1)).diizinkan).toBe(true);
    expect((await cekDanCatat(db, c, 1)).diizinkan).toBe(true);
  });

  it('konstanta batas sesuai kontrak bagian 0.7', () => {
    expect(BATAS_TULIS_PER_MENIT).toBe(60);
    expect(BATAS_BACA_PER_MENIT).toBe(300);
    expect(BATAS_EKSPOR_PER_HARI).toBe(5);
    expect(BATAS_OAUTH_PER_MENIT).toBe(10);
  });
});

describe('catatEkspor (5/hari, K-42/K-59)', () => {
  it('5 ekspor pertama diizinkan, ke-6 ditolak', async () => {
    const db = new FakeD1({});
    const sekarang = new Date('2026-11-18T10:00:00.000Z');
    for (let i = 1; i <= 5; i++) {
      const { status } = await catatEkspor(db, 'user-1', sekarang);
      expect(status.diizinkan).toBe(true);
      expect(status.terpakai).toBe(i);
    }
    const { status, jendela } = await catatEkspor(db, 'user-1', sekarang);
    expect(status.diizinkan).toBe(false);
    expect(status.sisa).toBe(0);
    expect(jendela.kedaluwarsa).toBe('2026-11-19T00:00:00.000Z');
  });

  it('kuota ekspor pulih keesokan harinya', async () => {
    const db = new FakeD1({});
    const hari1 = new Date('2026-11-18T23:00:00.000Z');
    const hari2 = new Date('2026-11-19T00:30:00.000Z');
    for (let i = 0; i < 5; i++) {
      expect((await catatEkspor(db, 'user-1', hari1)).status.diizinkan).toBe(true);
    }
    expect((await catatEkspor(db, 'user-1', hari1)).status.diizinkan).toBe(false);
    expect((await catatEkspor(db, 'user-1', hari2)).status.diizinkan).toBe(true);
  });
});
