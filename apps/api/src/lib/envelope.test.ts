// apps/api/src/lib/envelope.test.ts
// Unit test envelope respons + galat API (kode kontrak api-contracts.md 0.5).

import { describe, expect, it } from 'vitest';
import type { Context } from 'hono';
import {
  ApiError,
  balasGagal,
  balasSukses,
  gagal,
  konfirmasiSalah,
  sesiTerkunci,
  sesiTidakValid,
  sukses,
  tidakDitemukan,
  tidakValid,
} from './envelope';

/** Konteks Hono tiruan: hanya c.json yang dipakai envelope. */
function konteksTiruan(): Context {
  return {
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  } as unknown as Context;
}

describe('sukses / gagal (perakit badan)', () => {
  it('membungkus data dengan success true dan meta timestamp', () => {
    const body = sukses({ skor: 80 });
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ skor: 80 });
    expect(typeof body.meta.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.meta.timestamp))).toBe(false);
  });

  it('menggabungkan meta tambahan tanpa menghilangkan timestamp', () => {
    const body = sukses([], { pagination: { limit: 20, offset: 0, total: 0, has_more: false } });
    expect((body.meta.pagination as { limit: number }).limit).toBe(20);
    expect(typeof body.meta.timestamp).toBe('string');
  });

  it('membungkus galat dengan success false + kode + pesan + meta timestamp', () => {
    const body = gagal('NOT_FOUND', 'Pemeriksaan tidak ditemukan.');
    expect(body.success).toBe(false);
    expect(body.error).toEqual({ code: 'NOT_FOUND', message: 'Pemeriksaan tidak ditemukan.' });
    expect(typeof body.meta.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.meta.timestamp))).toBe(false);
  });

  it('menyertakan details di dalam error bila diberikan', () => {
    const body = gagal('VALIDATION_ERROR', 'Data tidak valid.', {
      skor: 'Skor harus berupa angka 0 sampai 100.',
    });
    expect(body.error.details).toEqual({ skor: 'Skor harus berupa angka 0 sampai 100.' });
  });
});

describe('ApiError dan pembangun galat umum (kode kontrak)', () => {
  it('membawa status, kode, pesan, dan rincian opsional', () => {
    const err = new ApiError(400, 'VALIDATION_ERROR', 'Skor tidak valid.', {
      skor: 'Skor harus berupa angka 0 sampai 100.',
    });
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Skor tidak valid.');
    expect(err.details).toEqual({ skor: 'Skor harus berupa angka 0 sampai 100.' });
    expect(err instanceof Error).toBe(true);
  });

  it('memakai kode kontrak yang benar', () => {
    expect(tidakValid('Isi tidak valid.').status).toBe(400);
    expect(tidakValid('Isi tidak valid.').code).toBe('VALIDATION_ERROR');
    expect(tidakDitemukan('Pemeriksaan').status).toBe(404);
    expect(tidakDitemukan('Pemeriksaan').code).toBe('NOT_FOUND');
    expect(tidakDitemukan('Pemeriksaan').message).toBe('Pemeriksaan tidak ditemukan.');
    expect(sesiTidakValid().status).toBe(401);
    expect(sesiTidakValid().code).toBe('UNAUTHORIZED');
    expect(sesiTerkunci().status).toBe(403);
    expect(sesiTerkunci().code).toBe('SESSION_LOCKED');
    expect(konfirmasiSalah().status).toBe(422);
    expect(konfirmasiSalah().code).toBe('KONFIRMASI_SALAH');
  });
});

describe('balasSukses / balasGagal (pengirim respons)', () => {
  it('mengirim JSON sukses dengan status yang diminta', async () => {
    const c = konteksTiruan();
    const res = balasSukses(c, { id: '1' }, 201);
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: '1' });
  });

  it('memetakan ApiError ke status dan kodenya', async () => {
    const c = konteksTiruan();
    const res = balasGagal(c, tidakDitemukan('Laporan WiFi'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
      meta: { timestamp: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Laporan WiFi tidak ditemukan.');
    expect(typeof body.meta.timestamp).toBe('string');
  });

  it('memetakan galat tak dikenal ke 500 INTERNAL_ERROR tanpa membocorkan rincian', async () => {
    const c = konteksTiruan();
    const res = balasGagal(c, new Error('D1: no such table: rahasia_internal'));
    expect(res.status).toBe(500);
    const teks = await res.text();
    expect(teks).toContain('INTERNAL_ERROR');
    expect(teks).not.toContain('rahasia_internal');
    expect(teks).not.toContain('no such table');
  });
});
