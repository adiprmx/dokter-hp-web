// apps/api/src/ai/__tests__/ai.test.ts
// Unit test Diagnosis AI (vitest): rate limit, validasi, parsing
// respons Gemini, model Flash-Lite + cadangan, cache jawaban,
// fallback aturan, dan rute Hono — dengan mock fetch Gemini +
// mock D1. Tidak ada panggilan jaringan nyata dan tidak ada
// kunci API nyata.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  GalatGemini,
  GEMINI_MODEL,
  GEMINI_MODEL_CADANGAN,
  parseJawabanGemini,
  tanyaGemini,
  GEMINI_TIMEOUT_MS,
} from '../gemini';
import {
  PESAN_FALLBACK,
  deteksiTopik,
  pengamatanDariData,
  susunJawabanAturan,
} from '../fallback';
import {
  BATAS_BERSIH_CACHE_AI,
  CACHE_AI_TTL_HARI,
  VERSI_KONTEKS_CACHE,
  bacaCache,
  bersihkanCacheKedaluwarsa,
  hitungKunciCache,
  normalisasiPertanyaanCache,
  sidikJariKonteks,
  tulisCache,
} from '../cache';
import { SYSTEM_PROMPT, buildUserMessage } from '../prompt';
import {
  BATAS_AI_HARIAN,
  cadangkanKuotaAi,
  cekBatasAi,
  hitungPertanyaanHariIni,
  jendelaKuotaAi,
  lepaskanKuotaAi,
} from '../ratelimit';
import type { DbD1, PernyataanD1 } from '../ratelimit';
import {
  aiRoutes,
  apakahUuidValid,
  detikSampaiResetUTC,
  parsePaginasi,
  validasiPertanyaan,
} from '../routes';
import type { AiBindings, AiVariables } from '../routes';
import { encodeCursor } from '../../lib/db';
import { FakeD1 } from '../../test/fake-d1';

// ---------------------------------------------------------------------
// Mock D1
// ---------------------------------------------------------------------

interface BarisDiagnosis {
  id: string;
  user_id: string;
  health_check_id: string | null;
  pertanyaan: string;
  jawaban: string;
  dibuat_pada: string;
}

interface BarisCacheAi {
  hash: string;
  jawaban: string;
  dibuat_pada: string;
}

interface BarisBatas {
  kunci: string;
  jumlah: number;
  jendela_mulai: string;
  kedaluwarsa_pada: string;
}

/**
 * Mock D1 minimal: mendukung SELECT COUNT ai_diagnoses (hitung
 * harian), SELECT daftar riwayat (cursor keyset), SELECT ai_cache
 * (baca cache), SELECT health_checks (kepemilikan + konteks),
 * SELECT wifi_reports (konteks), INSERT ai_diagnoses, INSERT
 * OR REPLACE ai_cache (tulis cache), dan tabel rate_limits
 * (INSERT OR IGNORE + UPDATE bersyarat + SELECT jumlah, dengan
 * meta.changes — dipakai cekDanCatat dan kuota AI).
 */
function buatMockDb(awal: {
  diagnosis?: BarisDiagnosis[];
  pemeriksaan?: { id: string; user_id: string; skor: number; ringkasan: string; dibuat_pada: string }[];
  wifi?: { kecepatan_unduh_kbps: number; ping_ms: number; kekuatan_sinyal: string }[];
  cache?: BarisCacheAi[];
  rateLimits?: { kunci: string; jumlah: number }[];
  gagal?: string[];
} = {}): DbD1 & {
  diagnosis: BarisDiagnosis[];
  cacheAi: Map<string, { jawaban: string; dibuat_pada: string }>;
  batasLaju: Map<string, BarisBatas>;
  sqlTerakhir: string[];
} {
  const diagnosis: BarisDiagnosis[] = [...(awal.diagnosis ?? [])];
  const pemeriksaan = [...(awal.pemeriksaan ?? [])];
  const wifi = [...(awal.wifi ?? [])];
  const cacheAi = new Map<string, { jawaban: string; dibuat_pada: string }>();
  for (const entri of awal.cache ?? []) {
    cacheAi.set(entri.hash, {
      jawaban: entri.jawaban,
      dibuat_pada: entri.dibuat_pada,
    });
  }
  const batasLaju = new Map<string, BarisBatas>();
  for (const entri of awal.rateLimits ?? []) {
    batasLaju.set(entri.kunci, {
      kunci: entri.kunci,
      jumlah: entri.jumlah,
      jendela_mulai: '',
      kedaluwarsa_pada: '2999-01-01T00:00:00.000Z',
    });
  }
  const gagal = new Set(awal.gagal ?? []);
  const sqlTerakhir: string[] = [];

  const db = {
    diagnosis,
    cacheAi,
    batasLaju,
    sqlTerakhir,
    prepare(sql: string): PernyataanD1 {
      sqlTerakhir.push(sql);
      let nilaiBind: unknown[] = [];
      const pernyataan: PernyataanD1 = {
        bind(...nilai: unknown[]) {
          nilaiBind = nilai;
          return pernyataan;
        },
        async first<T>(): Promise<T | null> {
          if (gagal.has('first')) throw new Error('D1 gagal (mock)');
          if (sql.includes('FROM ai_diagnoses') && sql.includes('COUNT(*)')) {
            if (sql.includes('date(dibuat_pada)')) {
              // Hitung harian: samakan tanggal ISO (10 karakter pertama).
              const idPengguna = nilaiBind[0] as string;
              const tanggal = (nilaiBind[1] as string).slice(0, 10);
              const jumlah = diagnosis.filter(
                (b) =>
                  b.user_id === idPengguna &&
                  b.dibuat_pada.slice(0, 10) === tanggal,
              ).length;
              return { jumlah } as T;
            }
            const idPengguna = nilaiBind[0] as string;
            const jumlah = diagnosis.filter(
              (b) => b.user_id === idPengguna,
            ).length;
            return { jumlah } as T;
          }
          if (sql.includes('FROM health_checks')) {
            if (sql.includes('id = ?')) {
              const baris = pemeriksaan.find(
                (p) => p.id === nilaiBind[0] && p.user_id === nilaiBind[1],
              );
              return (baris ?? null) as T | null;
            }
            const idPengguna = nilaiBind[0] as string;
            const milik = pemeriksaan
              .filter((p) => p.user_id === idPengguna)
              .sort((a, b) => (a.dibuat_pada < b.dibuat_pada ? 1 : -1));
            return ((milik[0] ?? null) as unknown) as T | null;
          }
          if (sql.includes('FROM wifi_reports')) {
            return ((wifi[0] ?? null) as unknown) as T | null;
          }
          if (sql.includes('FROM ai_cache')) {
            const entri = cacheAi.get(nilaiBind[0] as string);
            return ((entri ?? null) as unknown) as T | null;
          }
          if (sql.includes('FROM rate_limits') && sql.includes('WHERE kunci')) {
            const entri = batasLaju.get(nilaiBind[0] as string);
            return ((entri ?? null) as unknown) as T | null;
          }
          return null;
        },
        async all<T>(): Promise<{ results: T[]; success: boolean }> {
          if (gagal.has('all')) throw new Error('D1 gagal (mock)');
          if (sql.includes('FROM rate_limits')) {
            const batas = (nilaiBind[1] as number) ?? 100;
            const hasil = [...batasLaju.values()]
              .filter((b) => b.kedaluwarsa_pada < (nilaiBind[0] as string))
              .slice(0, batas)
              .map((b) => ({ kunci: b.kunci }));
            return { results: hasil as T[], success: true };
          }
          if (sql.includes('FROM ai_diagnoses')) {
            const idPengguna = nilaiBind[0] as string;
            // Bind: [userId, (dibuat, dibuat, id)?, limit+1].
            const punyaCursor = sql.includes('dibuat_pada < ?');
            const cursor = punyaCursor
              ? { dibuat_pada: nilaiBind[1] as string, id: nilaiBind[3] as string }
              : null;
            const limit = ((punyaCursor ? nilaiBind[4] : nilaiBind[1]) as number) ?? 50;
            const milik = diagnosis
              .filter((b) => b.user_id === idPengguna)
              .filter((b) => {
                if (!cursor) return true;
                if (b.dibuat_pada !== cursor.dibuat_pada) {
                  return b.dibuat_pada < cursor.dibuat_pada;
                }
                return b.id < cursor.id;
              })
              .sort((a, b) => {
                if (a.dibuat_pada !== b.dibuat_pada) {
                  return a.dibuat_pada < b.dibuat_pada ? 1 : -1;
                }
                if (a.id === b.id) return 0;
                return a.id < b.id ? 1 : -1;
              })
              .slice(0, limit);
            return { results: milik as T[], success: true };
          }
          return { results: [], success: true };
        },
        async run(): Promise<{ success: boolean; meta?: { changes: number } }> {
          if (gagal.has('run')) throw new Error('D1 gagal (mock)');
          if (sql.includes('INSERT OR IGNORE INTO rate_limits')) {
            const [kunci, jendela_mulai, kedaluwarsa_pada] = nilaiBind as [
              string,
              string,
              string,
            ];
            if (batasLaju.has(kunci)) {
              return { success: true, meta: { changes: 0 } };
            }
            batasLaju.set(kunci, { kunci, jumlah: 0, jendela_mulai, kedaluwarsa_pada });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE rate_limits SET jumlah = jumlah + 1')) {
            const [kunci, batas] = nilaiBind as [string, number];
            const baris = batasLaju.get(kunci);
            if (baris && baris.jumlah < batas) {
              baris.jumlah += 1;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (sql.includes('UPDATE rate_limits SET jumlah = jumlah - 1')) {
            const [kunci] = nilaiBind as [string];
            const baris = batasLaju.get(kunci);
            if (baris && baris.jumlah > 0) {
              baris.jumlah -= 1;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (sql.includes('DELETE FROM rate_limits WHERE kunci IN')) {
            let terhapus = 0;
            for (const kunci of nilaiBind as string[]) {
              if (batasLaju.delete(kunci)) terhapus += 1;
            }
            return { success: true, meta: { changes: terhapus } };
          }
          if (sql.includes('INSERT OR REPLACE INTO ai_cache')) {
            cacheAi.set(nilaiBind[1] as string, {
              jawaban: nilaiBind[2] as string,
              dibuat_pada: nilaiBind[3] as string,
            });
            return { success: true };
          }
          if (sql.includes('INSERT INTO ai_diagnoses')) {
            diagnosis.push({
              id: nilaiBind[0] as string,
              user_id: nilaiBind[1] as string,
              health_check_id: nilaiBind[2] as string | null,
              pertanyaan: nilaiBind[3] as string,
              jawaban: nilaiBind[4] as string,
              dibuat_pada: nilaiBind[5] as string,
            });
            return { success: true };
          }
          return { success: true };
        },
      };
      return pernyataan;
    },
  };
  return db;
}

function barisDiagnosis(
  idPengguna: string,
  dibuatPada: string,
  id = `diag-${dibuatPada}-${Math.random()}`,
  pertanyaan = 'Contoh pertanyaan',
  jawaban = 'Contoh jawaban',
): BarisDiagnosis {
  return {
    id,
    user_id: idPengguna,
    health_check_id: null,
    pertanyaan,
    jawaban,
    dibuat_pada: dibuatPada,
  };
}

// ---------------------------------------------------------------------
// Mock fetch Gemini
// ---------------------------------------------------------------------

function responsGemini(teks: string): Record<string, unknown> {
  return {
    candidates: [
      { content: { parts: [{ text: teks }] }, finishReason: 'STOP' },
    ],
  };
}

function buatFetchMock(
  badan: unknown,
  status = 200,
): ReturnType<typeof vi.fn> {
  return vi.fn(async () =>
    new Response(JSON.stringify(badan), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

/** Mengambil URL panggilan fetch ke-n dari mock. */
function urlPanggilan(fetchMock: ReturnType<typeof vi.fn>, ke = 0): string {
  const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } })
    .mock.calls;
  return String(calls[ke]?.[0] ?? '');
}

/** Mengambil badan JSON panggilan fetch ke-n dari mock. */
function badanPanggilan(
  fetchMock: ReturnType<typeof vi.fn>,
  ke = 0,
): Record<string, unknown> {
  const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } })
    .mock.calls;
  const init = calls[ke]?.[1] as { body?: string };
  return JSON.parse(init?.body ?? '{}') as Record<string, unknown>;
}

// ---------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------

describe('rate limit AI (20/hari per pengguna)', () => {
  it('batas harian adalah 20', () => {
    expect(BATAS_AI_HARIAN).toBe(20);
  });

  it('menghitung hanya pertanyaan hari ini (UTC), bukan hari lain', async () => {
    const sekarang = new Date('2026-11-17T10:00:00.000Z');
    const db = buatMockDb({
      diagnosis: [
        barisDiagnosis('user-1', '2026-11-17T08:00:00.000Z', 'a'),
        barisDiagnosis('user-1', '2026-11-17T09:00:00.000Z', 'b'),
        barisDiagnosis('user-1', '2026-11-16T23:00:00.000Z', 'c'),
        barisDiagnosis('user-2', '2026-11-17T08:00:00.000Z', 'd'),
      ],
    });
    expect(await hitungPertanyaanHariIni(db, 'user-1', sekarang)).toBe(2);
    expect(await hitungPertanyaanHariIni(db, 'user-2', sekarang)).toBe(1);
  });

  it('diizinkan bila terpakai di bawah 20, dengan sisa yang benar', async () => {
    const sekarang = new Date('2026-11-17T10:00:00.000Z');
    const db = buatMockDb({
      rateLimits: [{ kunci: 'ai:user-1:2026-11-17', jumlah: 19 }],
    });
    const status = await cekBatasAi(db, 'user-1', sekarang);
    expect(status).toEqual({
      diizinkan: true,
      terpakai: 19,
      batas: 20,
      sisa: 1,
    });
  });

  it('ditolak bila terpakai sudah 20', async () => {
    const sekarang = new Date('2026-11-17T10:00:00.000Z');
    const db = buatMockDb({
      rateLimits: [{ kunci: 'ai:user-1:2026-11-17', jumlah: 20 }],
    });
    const status = await cekBatasAi(db, 'user-1', sekarang);
    expect(status.diizinkan).toBe(false);
    expect(status.sisa).toBe(0);
  });

  it('sisa tidak pernah negatif bila terpakai melebihi batas', async () => {
    const sekarang = new Date('2026-11-17T10:00:00.000Z');
    const db = buatMockDb({
      rateLimits: [{ kunci: 'ai:user-1:2026-11-17', jumlah: 25 }],
    });
    const status = await cekBatasAi(db, 'user-1', sekarang);
    expect(status.diizinkan).toBe(false);
    expect(status.sisa).toBe(0);
  });

  it('cekBatasAi tidak mengubah penghitung (baca saja)', async () => {
    const sekarang = new Date('2026-11-17T10:00:00.000Z');
    const db = buatMockDb({
      rateLimits: [{ kunci: 'ai:user-1:2026-11-17', jumlah: 5 }],
    });
    await cekBatasAi(db, 'user-1', sekarang);
    await cekBatasAi(db, 'user-1', sekarang);
    expect(db.batasLaju.get('ai:user-1:2026-11-17')?.jumlah).toBe(5);
  });
});

describe('cadangan kuota AI (reserve-then-confirm, R-05)', () => {
  const SEKARANG = new Date('2026-11-17T10:00:00.000Z');

  it('cadangan menaikkan penghitung dan mengembalikan status sesudah cadangan', async () => {
    const db = buatMockDb({});
    const { status, jendela } = await cadangkanKuotaAi(db, 'user-1', SEKARANG);
    expect(status).toEqual({ diizinkan: true, terpakai: 1, batas: 20, sisa: 19 });
    expect(jendela.kunci).toBe('ai:user-1:2026-11-17');
    expect(db.batasLaju.get('ai:user-1:2026-11-17')?.jumlah).toBe(1);
  });

  it('cadangan ke-21 ditolak dan TIDAK menaikkan penghitung', async () => {
    const db = buatMockDb({
      rateLimits: [{ kunci: 'ai:user-1:2026-11-17', jumlah: 20 }],
    });
    const { status } = await cadangkanKuotaAi(db, 'user-1', SEKARANG);
    expect(status.diizinkan).toBe(false);
    expect(status.terpakai).toBe(20);
    expect(db.batasLaju.get('ai:user-1:2026-11-17')?.jumlah).toBe(20);
  });

  it('pelepasan cadangan mengembalikan satu kuota, tidak di bawah 0', async () => {
    const db = buatMockDb({
      rateLimits: [{ kunci: 'ai:user-1:2026-11-17', jumlah: 1 }],
    });
    const jendela = jendelaKuotaAi('user-1', SEKARANG);
    await lepaskanKuotaAi(db, jendela);
    expect(db.batasLaju.get('ai:user-1:2026-11-17')?.jumlah).toBe(0);
    await lepaskanKuotaAi(db, jendela);
    expect(db.batasLaju.get('ai:user-1:2026-11-17')?.jumlah).toBe(0);
  });

  it('burst 20 paralel dari 19 terpakai: tepat 1 diizinkan (regresi TOCTOU R-05)', async () => {
    const db = buatMockDb({
      rateLimits: [{ kunci: 'ai:user-1:2026-11-17', jumlah: 19 }],
    });
    const hasil = await Promise.all(
      Array.from({ length: 20 }, () => cadangkanKuotaAi(db, 'user-1', SEKARANG)),
    );
    const diizinkan = hasil.filter((h) => h.status.diizinkan);
    expect(diizinkan).toHaveLength(1);
    expect(db.batasLaju.get('ai:user-1:2026-11-17')?.jumlah).toBe(20);
  });

  it('burst 25 paralel dari 0: tepat 20 diizinkan', async () => {
    const db = buatMockDb({});
    const hasil = await Promise.all(
      Array.from({ length: 25 }, () => cadangkanKuotaAi(db, 'user-1', SEKARANG)),
    );
    const diizinkan = hasil.filter((h) => h.status.diizinkan);
    expect(diizinkan).toHaveLength(20);
    expect(db.batasLaju.get('ai:user-1:2026-11-17')?.jumlah).toBe(20);
  });
});

// ---------------------------------------------------------------------
// Validasi pertanyaan + paginasi + UUID + Retry-After
// ---------------------------------------------------------------------

describe('validasi pertanyaan', () => {
  it('menerima pertanyaan normal dan memangkas spasi', () => {
    expect(validasiPertanyaan('  WiFi lemot  ')).toEqual({
      ok: true,
      pertanyaan: 'WiFi lemot',
    });
  });

  it('menolak pertanyaan kosong dan hanya spasi', () => {
    expect(validasiPertanyaan('')).toMatchObject({
      ok: false,
      kode: 'VALIDATION_ERROR',
    });
    expect(validasiPertanyaan('   ')).toMatchObject({ ok: false });
  });

  it('menolak pertanyaan lebih dari 1000 karakter', () => {
    expect(validasiPertanyaan('x'.repeat(1001))).toMatchObject({
      ok: false,
      kode: 'VALIDATION_ERROR',
    });
  });

  it('menerima pertanyaan tepat 1000 karakter', () => {
    expect(validasiPertanyaan('x'.repeat(1000)).ok).toBe(true);
  });

  it('menolak nilai bukan string', () => {
    expect(validasiPertanyaan(123)).toMatchObject({ ok: false });
    expect(validasiPertanyaan(null)).toMatchObject({ ok: false });
    expect(validasiPertanyaan(undefined)).toMatchObject({ ok: false });
    expect(validasiPertanyaan({})).toMatchObject({ ok: false });
  });
});

describe('apakahUuidValid', () => {
  it('menerima UUID v4 yang sah', () => {
    expect(
      apakahUuidValid('7c9e6679-7425-40de-944b-e07fc1f90ae7'),
    ).toBe(true);
  });

  it('menolak teks yang bukan UUID', () => {
    expect(apakahUuidValid('hc-1')).toBe(false);
    expect(apakahUuidValid('')).toBe(false);
    expect(apakahUuidValid('7c9e6679-7425-40de-944b')).toBe(false);
  });
});

describe('parsePaginasi (kontrak 0.6, cursor K-32/K-38)', () => {
  it('bawaan limit 20, cursor null (halaman pertama)', () => {
    expect(parsePaginasi({})).toEqual({ ok: true, limit: 20, cursor: null });
  });

  it('menjepit limit ke 1-100 (bukan galat)', () => {
    expect(parsePaginasi({ limit: '500' })).toEqual({
      ok: true,
      limit: 100,
      cursor: null,
    });
    expect(parsePaginasi({ limit: '0' })).toEqual({
      ok: true,
      limit: 1,
      cursor: null,
    });
  });

  it('menolak limit bukan angka', () => {
    expect(parsePaginasi({ limit: 'abc' })).toMatchObject({
      ok: false,
      kode: 'VALIDATION_ERROR',
    });
    expect(parsePaginasi({ limit: '2.5' })).toMatchObject({ ok: false });
  });

  it('menolak cursor cacat', () => {
    expect(parsePaginasi({ cursor: 'bukan-base64!!!' })).toMatchObject({
      ok: false,
      kode: 'VALIDATION_ERROR',
    });
    expect(
      parsePaginasi({ cursor: encodeCursor({ dibuat_pada: '', id: 'x' }) }),
    ).toMatchObject({ ok: false });
  });

  it('memakai nilai yang sah apa adanya', () => {
    const cursor = { dibuat_pada: '2026-11-17T10:00:00.000Z', id: 'abc-123' };
    expect(parsePaginasi({ limit: '5', cursor: encodeCursor(cursor) })).toEqual({
      ok: true,
      limit: 5,
      cursor,
    });
  });
});

describe('detikSampaiResetUTC', () => {
  it('menghitung detik sampai 00:00 UTC berikutnya', () => {
    // 23:00 UTC -> 3600 detik sampai tengah malam.
    expect(
      detikSampaiResetUTC(new Date('2026-11-17T23:00:00.000Z')),
    ).toBe(3600);
    // 00:00:00 tepat -> reset berikutnya 24 jam lagi.
    expect(
      detikSampaiResetUTC(new Date('2026-11-17T00:00:00.000Z')),
    ).toBe(86_400);
  });

  it('hasil selalu 1-86400', () => {
    for (const jam of [0, 6, 12, 18, 23]) {
      const detik = detikSampaiResetUTC(
        new Date(`2026-11-17T${String(jam).padStart(2, '0')}:30:00.000Z`),
      );
      expect(detik).toBeGreaterThanOrEqual(1);
      expect(detik).toBeLessThanOrEqual(86_400);
    }
  });
});

// ---------------------------------------------------------------------
// Parsing respons Gemini
// ---------------------------------------------------------------------

describe('parseJawabanGemini', () => {
  it('mengambil teks dari kandidat pertama', () => {
    expect(parseJawabanGemini(responsGemini('Halo, ini jawaban.'))).toBe(
      'Halo, ini jawaban.',
    );
  });

  it('menggabungkan beberapa bagian teks', () => {
    const badan = {
      candidates: [
        { content: { parts: [{ text: 'Bagian satu. ' }, { text: 'Bagian dua.' }] } },
      ],
    };
    expect(parseJawabanGemini(badan)).toBe('Bagian satu. Bagian dua.');
  });

  it('mengembalikan null bila tidak ada kandidat', () => {
    expect(parseJawabanGemini({ candidates: [] })).toBeNull();
    expect(parseJawabanGemini({})).toBeNull();
  });

  it('mengembalikan null bila respons diblokir tanpa teks', () => {
    expect(
      parseJawabanGemini({
        candidates: [{ finishReason: 'SAFETY' }],
        promptFeedback: { blockReason: 'SAFETY' },
      }),
    ).toBeNull();
  });

  it('mengembalikan null untuk badan yang bukan objek', () => {
    expect(parseJawabanGemini(null)).toBeNull();
    expect(parseJawabanGemini('teks')).toBeNull();
    expect(parseJawabanGemini(42)).toBeNull();
  });

  it('mengembalikan null bila teks hanya spasi', () => {
    expect(parseJawabanGemini(responsGemini('   '))).toBeNull();
  });

  it('memotong jawaban yang sangat panjang ke batas 8000 karakter', () => {
    expect(parseJawabanGemini(responsGemini('y'.repeat(9000)))?.length).toBe(
      8000,
    );
  });
});

// ---------------------------------------------------------------------
// tanyaGemini (mock fetch) — Flash-Lite + cadangan
// ---------------------------------------------------------------------

describe('tanyaGemini (Flash-Lite)', () => {
  it('timeout bawaan adalah 30 detik', () => {
    expect(GEMINI_TIMEOUT_MS).toBe(30_000);
  });

  it('model utama adalah Flash-Lite, bukan Flash standar', () => {
    expect(GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(GEMINI_MODEL_CADANGAN).toBe('gemini-3.1-flash-lite');
  });

  it('mengembalikan teks jawaban pada respons 200 yang valid', async () => {
    const fetchMock = buatFetchMock(responsGemini('Coba mulai ulang HP.'));
    const jawaban = await tanyaGemini({
      kunciApi: 'kunci-uji',
      promptSistem: SYSTEM_PROMPT,
      pesanPengguna: 'HP lemot',
      fetchFn: fetchMock as unknown as typeof fetch,
    });
    expect(jawaban).toBe('Coba mulai ulang HP.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = urlPanggilan(fetchMock);
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('gemini-3.5-flash-lite');
    expect(url).toContain(':generateContent');
  });

  it('mengirim systemInstruction dan pesan pengguna, tanpa temperature (deprecated di 3.5+)', async () => {
    const fetchMock = buatFetchMock(responsGemini('Baik.'));
    await tanyaGemini({
      kunciApi: 'kunci-uji',
      promptSistem: SYSTEM_PROMPT,
      pesanPengguna: 'WiFi lemot',
      fetchFn: fetchMock as unknown as typeof fetch,
    });
    const badan = badanPanggilan(fetchMock);
    expect(badan).toHaveProperty('systemInstruction');
    expect(badan).toHaveProperty('contents');
    expect(JSON.stringify(badan)).toContain('WiFi lemot');
    const config = badan.generationConfig as Record<string, unknown>;
    expect(config).toHaveProperty('maxOutputTokens');
    expect(config).not.toHaveProperty('temperature');
    expect(config).not.toHaveProperty('top_p');
    expect(config).not.toHaveProperty('top_k');
  });

  it('mengirim kunci API lewat header x-goog-api-key, bukan query string (R-19)', async () => {
    const fetchMock = buatFetchMock(responsGemini('Baik.'));
    await tanyaGemini({
      kunciApi: 'kunci-rahasia-uji',
      promptSistem: SYSTEM_PROMPT,
      pesanPengguna: 'Tes',
      fetchFn: fetchMock as unknown as typeof fetch,
    });
    const url = urlPanggilan(fetchMock);
    expect(url).not.toContain('key=');
    expect(url).not.toContain('kunci-rahasia-uji');
    expect(url).not.toContain('?');
    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } })
      .mock.calls;
    const init = calls[0]?.[1] as { headers?: Record<string, string> };
    expect(init.headers?.['x-goog-api-key']).toBe('kunci-rahasia-uji');
    expect(init.headers?.['Content-Type']).toBe('application/json');
  });

  it('melempar GEMINI_TIDAK_TERSEDIA pada status HTTP 500 tanpa mencoba cadangan', async () => {
    const fetchMock = buatFetchMock({ error: 'rusak' }, 500);
    await expect(
      tanyaGemini({
        kunciApi: 'kunci-uji',
        promptSistem: SYSTEM_PROMPT,
        pesanPengguna: 'Tes',
        fetchFn: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kode: 'GEMINI_TIDAK_TERSEDIA' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mencoba model cadangan bila model utama 429, dan sukses bila cadangan 200', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('gemini-3.5-flash-lite')) {
        return new Response(JSON.stringify({ error: 'kuota habis' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(responsGemini('Jawaban cadangan.')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const jawaban = await tanyaGemini({
      kunciApi: 'kunci-uji',
      promptSistem: SYSTEM_PROMPT,
      pesanPengguna: 'Tes',
      fetchFn: fetchMock as unknown as typeof fetch,
    });
    expect(jawaban).toBe('Jawaban cadangan.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlPanggilan(fetchMock, 1)).toContain('gemini-3.1-flash-lite');
  });

  it('mencoba model cadangan bila model utama 404 (model tidak ditemukan)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('gemini-3.5-flash-lite')) {
        return new Response(JSON.stringify({ error: 'tidak ada' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(responsGemini('Jawaban cadangan.')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const jawaban = await tanyaGemini({
      kunciApi: 'kunci-uji',
      promptSistem: SYSTEM_PROMPT,
      pesanPengguna: 'Tes',
      fetchFn: fetchMock as unknown as typeof fetch,
    });
    expect(jawaban).toBe('Jawaban cadangan.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('melempar GEMINI_KUOTA_HABIS bila model utama dan cadangan sama-sama 429', async () => {
    const fetchMock = buatFetchMock({ error: 'kuota' }, 429);
    await expect(
      tanyaGemini({
        kunciApi: 'kunci-uji',
        promptSistem: SYSTEM_PROMPT,
        pesanPengguna: 'Tes',
        fetchFn: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      kode: 'GEMINI_KUOTA_HABIS',
      statusHttp: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tidak mencoba cadangan bila modelCadangan null (429 langsung jadi GEMINI_KUOTA_HABIS)', async () => {
    const fetchMock = buatFetchMock({ error: 'kuota' }, 429);
    await expect(
      tanyaGemini({
        kunciApi: 'kunci-uji',
        promptSistem: SYSTEM_PROMPT,
        pesanPengguna: 'Tes',
        modelCadangan: null,
        fetchFn: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      kode: 'GEMINI_KUOTA_HABIS',
      statusHttp: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('melempar GEMINI_RESPON_TIDAK_VALID bila kandidat kosong', async () => {
    const fetchMock = buatFetchMock({ candidates: [] });
    await expect(
      tanyaGemini({
        kunciApi: 'kunci-uji',
        promptSistem: SYSTEM_PROMPT,
        pesanPengguna: 'Tes',
        fetchFn: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kode: 'GEMINI_RESPON_TIDAK_VALID' });
  });

  it('melempar GEMINI_KUNCI_BELUM_DIATUR bila kunci kosong', async () => {
    const fetchMock = buatFetchMock(responsGemini('x'));
    await expect(
      tanyaGemini({
        kunciApi: '   ',
        promptSistem: SYSTEM_PROMPT,
        pesanPengguna: 'Tes',
        fetchFn: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kode: 'GEMINI_KUNCI_BELUM_DIATUR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('melempar GEMINI_TIMEOUT bila fetch tidak kunjung selesai', async () => {
    const fetchGantung = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_selesai, tolak) => {
          init?.signal?.addEventListener('abort', () => {
            tolak(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    await expect(
      tanyaGemini({
        kunciApi: 'kunci-uji',
        promptSistem: SYSTEM_PROMPT,
        pesanPengguna: 'Tes',
        batasWaktuMs: 50,
        fetchFn: fetchGantung as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kode: 'GEMINI_TIMEOUT' });
  });

  it('galat tidak memuat kunci API', async () => {
    const fetchMock = buatFetchMock({ error: 'rusak' }, 500);
    let galat: unknown;
    try {
      await tanyaGemini({
        kunciApi: 'kunci-rahasia-uji-123',
        promptSistem: SYSTEM_PROMPT,
        pesanPengguna: 'Tes',
        fetchFn: fetchMock as unknown as typeof fetch,
      });
    } catch (e) {
      galat = e;
    }
    expect(galat).toBeInstanceOf(GalatGemini);
    expect(String(galat)).not.toContain('kunci-rahasia-uji-123');
  });
});

// ---------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------

describe('prompt Diagnosis AI', () => {
  it('prompt sistem memuat aturan jujur: akui tidak tahu, jangan mengarang, saran bukan vonis', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('jangan mengarang');
    expect(SYSTEM_PROMPT).toContain('tidak tahu');
    expect(SYSTEM_PROMPT).toContain('saran, bukan vonis pasti');
    expect(SYSTEM_PROMPT).toContain('Bahasa Indonesia');
    expect(SYSTEM_PROMPT).toContain('data pribadi');
  });

  it('buildUserMessage menyatakan data tidak tersedia bila konteks kosong', () => {
    const pesan = buildUserMessage('WiFi lemot');
    expect(pesan).toContain('tidak tersedia');
    expect(pesan).toContain('WiFi lemot');
  });

  it('buildUserMessage menyertakan konteks bila ada', () => {
    const pesan = buildUserMessage('Baterai boros', {
      skorTerakhir: 62,
      kecepatanUnduhKbpsTerakhir: 120,
      latensiHttpMsTerakhir: 180,
    });
    expect(pesan).toContain('62');
    expect(pesan).toContain('120');
    expect(pesan).toContain('180');
  });
});

// ---------------------------------------------------------------------
// Fallback aturan (tanpa AI)
// ---------------------------------------------------------------------

describe('fallback aturan', () => {
  it('deteksiTopik mengenali wifi, baterai, penyimpanan, performa, keamanan', () => {
    expect(deteksiTopik('WiFi lemot padahal sinyal penuh')).toBe('wifi');
    expect(deteksiTopik('Baterai boros sekali')).toBe('baterai');
    expect(deteksiTopik('Penyimpanan penuh terus')).toBe('penyimpanan');
    expect(deteksiTopik('HP lemot dan sering lag')).toBe('performa');
    expect(deteksiTopik('Apakah aplikasi ini aman?')).toBe('keamanan');
    expect(deteksiTopik('Kenapa HP saya begini?')).toBe('umum');
  });

  it('pengamatanDariData memakai klasifikasi kecepatan yang sama dengan produk', () => {
    const pengamatan = pengamatanDariData({
      skorTerakhir: 45,
      kecepatanUnduhKbpsTerakhir: 30,
      latensiHttpMsTerakhir: 400,
      kekuatanSinyalTerakhir: 'lemah',
    });
    const teks = pengamatan.join(' ');
    expect(teks).toContain('45');
    expect(teks).toContain('Perlu perhatian');
    expect(teks).toContain('sangat lambat');
    expect(teks).toContain('tinggi');
    expect(teks).toContain('lemah');
  });

  it('pengamatanDariData kosong bila tidak ada konteks', () => {
    expect(pengamatanDariData(undefined)).toEqual([]);
    expect(pengamatanDariData({})).toEqual([]);
  });

  it('susunJawabanAturan selalu diawali pesan jujur dan ditutup label saran', () => {
    const jawaban = susunJawabanAturan('WiFi lemot', {
      kecepatanUnduhKbpsTerakhir: 120,
    });
    expect(jawaban.startsWith(PESAN_FALLBACK)).toBe(true);
    expect(jawaban).toContain('bukan dari AI');
    expect(jawaban).toContain('120');
    expect(jawaban).toContain('saran, bukan vonis pasti');
    expect(jawaban).toContain('1.');
  });

  it('susunJawabanAturan jujur bila data tidak tersedia', () => {
    const jawaban = susunJawabanAturan('HP panas');
    expect(jawaban).toContain('belum tersedia');
    expect(jawaban).toContain('Baterai');
  });

  it('susunJawabanAturan memberi langkah baterai untuk keluhan panas', () => {
    const jawaban = susunJawabanAturan('HP cepat panas saat dipakai');
    expect(jawaban).toContain('Pengaturan > Baterai');
  });

  it('susunJawabanAturan menyarankan cek mode/channel router bila WiFi di bawah 50 KB/detik', () => {
    const jawaban = susunJawabanAturan('WiFi lemot', {
      kecepatanUnduhKbpsTerakhir: 30,
    });
    expect(jawaban).toContain('di bawah 50 KB/detik');
    expect(jawaban).toContain('mode router');
    expect(jawaban).toContain('channel');
  });

  it('susunJawabanAturan tidak menyarankan cek router bila WiFi normal', () => {
    const jawaban = susunJawabanAturan('WiFi lemot', {
      kecepatanUnduhKbpsTerakhir: 120,
    });
    expect(jawaban).not.toContain('di bawah 50 KB/detik');
  });

  it('susunJawabanAturan mengarahkan ke langkah per kategori bila skor di bawah 50', () => {
    const jawaban = susunJawabanAturan('HP saya bermasalah', {
      skorTerakhir: 45,
    });
    expect(jawaban).toContain('Skor di bawah 50');
    expect(jawaban).toContain('kategori');
  });
});

// ---------------------------------------------------------------------
// Cache jawaban
// ---------------------------------------------------------------------

describe('cache jawaban AI (ai_cache, SHA-256, TTL 7 hari)', () => {
  it('versi konteks cache adalah v1 dan TTL 7 hari', () => {
    expect(VERSI_KONTEKS_CACHE).toBe('v1');
    expect(CACHE_AI_TTL_HARI).toBe(7);
  });

  it('normalisasiPertanyaanCache merapatkan spasi dan huruf kecil', () => {
    expect(normalisasiPertanyaanCache('  WiFi   LEMOT? ')).toBe('wifi lemot?');
  });

  it('sidikJariKonteks stabil dan kosong bila tanpa data', () => {
    expect(sidikJariKonteks(undefined)).toBe('tanpa-konteks');
    expect(sidikJariKonteks({})).toBe('tanpa-konteks');
    expect(
      sidikJariKonteks({
        skorTerakhir: 45,
        kecepatanUnduhKbpsTerakhir: 30,
      }),
    ).toBe(
      sidikJariKonteks({
        skorTerakhir: 45,
        kecepatanUnduhKbpsTerakhir: 30,
      }),
    );
    expect(
      sidikJariKonteks({ skorTerakhir: 45 }),
    ).not.toBe(sidikJariKonteks({ skorTerakhir: 80 }));
  });

  it('hitungKunciCache deterministik, 64 karakter heksadesimal', async () => {
    const a = await hitungKunciCache('user-1', 'WiFi lemot');
    const b = await hitungKunciCache('user-1', 'WiFi lemot');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('kunci sama untuk pertanyaan yang sama walau huruf/spasi berbeda', async () => {
    const a = await hitungKunciCache(
      'user-1',
      'WiFi lemot padahal sinyal penuh',
    );
    const b = await hitungKunciCache(
      'user-1',
      'wifi   LEMOT padahal sinyal penuh',
    );
    expect(a).toBe(b);
  });

  it('kunci berbeda untuk pertanyaan, pengguna, atau konteks yang berbeda', async () => {
    const dasar = await hitungKunciCache('user-1', 'WiFi lemot', {
      skorTerakhir: 45,
    });
    const bedaPertanyaan = await hitungKunciCache('user-1', 'Baterai boros', {
      skorTerakhir: 45,
    });
    const bedaPengguna = await hitungKunciCache('user-2', 'WiFi lemot', {
      skorTerakhir: 45,
    });
    const bedaKonteks = await hitungKunciCache('user-1', 'WiFi lemot', {
      skorTerakhir: 80,
    });
    expect(bedaPertanyaan).not.toBe(dasar);
    expect(bedaPengguna).not.toBe(dasar);
    expect(bedaKonteks).not.toBe(dasar);
  });

  it('tulis lalu baca: miss sebelum tulis, hit sesudah tulis', async () => {
    const db = buatMockDb();
    const kunci = await hitungKunciCache('user-1', 'WiFi lemot');
    expect(await bacaCache(db, kunci)).toBeNull();
    expect(await tulisCache(db, kunci, 'Jawaban tersimpan.')).toBe(true);
    expect(await bacaCache(db, kunci)).toBe('Jawaban tersimpan.');
  });

  it('tidak memakai jawaban pengguna lain (kunci berbeda per pengguna)', async () => {
    const db = buatMockDb();
    const kunciLain = await hitungKunciCache('user-2', 'WiFi lemot');
    await tulisCache(db, kunciLain, 'Jawaban orang lain.');
    const kunciSaya = await hitungKunciCache('user-1', 'WiFi lemot');
    expect(await bacaCache(db, kunciSaya)).toBeNull();
  });

  it('tidak memakai jawaban lebih tua dari 7 hari', async () => {
    const db = buatMockDb();
    const kunci = await hitungKunciCache('user-1', 'WiFi lemot');
    await tulisCache(
      db,
      kunci,
      'Jawaban lama.',
      new Date('2026-11-10T10:00:00.000Z'),
    );
    // 6 hari kemudian: masih dipakai.
    expect(
      await bacaCache(db, kunci, new Date('2026-11-16T10:00:00.000Z')),
    ).toBe('Jawaban lama.');
    // 7 hari + 1 detik kemudian: kedaluwarsa.
    expect(
      await bacaCache(db, kunci, new Date('2026-11-17T10:00:01.000Z')),
    ).toBeNull();
  });

  it('tulis ulang menimpa entri lama (termasuk yang kedaluwarsa)', async () => {
    const db = buatMockDb();
    const kunci = await hitungKunciCache('user-1', 'WiFi lemot');
    await tulisCache(
      db,
      kunci,
      'Jawaban lama.',
      new Date('2026-11-01T10:00:00.000Z'),
    );
    expect(
      await bacaCache(db, kunci, new Date('2026-11-17T10:00:00.000Z')),
    ).toBeNull();
    expect(
      await tulisCache(
        db,
        kunci,
        'Jawaban baru.',
        new Date('2026-11-17T10:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      await bacaCache(db, kunci, new Date('2026-11-17T10:00:00.000Z')),
    ).toBe('Jawaban baru.');
  });

  it('baca mengembalikan null dan tulis mengembalikan false bila D1 gagal (cache tidak menggagalkan alur)', async () => {
    const dbBacaGagal = buatMockDb({ gagal: ['first'] });
    const kunci = await hitungKunciCache('user-1', 'WiFi lemot');
    expect(await bacaCache(dbBacaGagal, kunci)).toBeNull();
    const dbTulisGagal = buatMockDb({ gagal: ['run'] });
    expect(await tulisCache(dbTulisGagal, kunci, 'x')).toBe(false);
  });

  it('tulis menolak jawaban kosong', async () => {
    const db = buatMockDb();
    const kunci = await hitungKunciCache('user-1', 'WiFi lemot');
    expect(await tulisCache(db, kunci, '')).toBe(false);
    expect(await bacaCache(db, kunci)).toBeNull();
  });
});

describe('bersihkanCacheKedaluwarsa (R-15)', () => {
  const SEKARANG = new Date('2026-11-17T10:00:00.000Z');

  it('menghapus entri lebih tua dari 7 hari dan mempertahankan entri segar', async () => {
    const db = new FakeD1({
      ai_cache: [
        {
          id: 'id-1',
          pertanyaan_hash: 'hash-8-hari',
          jawaban: 'Jawaban lama.',
          dibuat_pada: '2026-11-09T09:59:59.000Z',
        },
        {
          id: 'id-2',
          pertanyaan_hash: 'hash-tepat-7-hari',
          jawaban: 'Jawaban di batas.',
          dibuat_pada: '2026-11-10T10:00:00.000Z',
        },
        {
          id: 'id-3',
          pertanyaan_hash: 'hash-baru',
          jawaban: 'Jawaban baru.',
          dibuat_pada: '2026-11-16T10:00:00.000Z',
        },
      ],
    });
    expect(await bersihkanCacheKedaluwarsa(db, SEKARANG)).toBe(1);
    expect(db.baris('ai_cache').map((b) => b.pertanyaan_hash).sort()).toEqual([
      'hash-baru',
      'hash-tepat-7-hari',
    ]);
  });

  it('mengembalikan 0 dan tidak menghapus bila tidak ada entri kedaluwarsa', async () => {
    const db = new FakeD1({
      ai_cache: [
        {
          id: 'id-1',
          pertanyaan_hash: 'hash-baru',
          jawaban: 'Jawaban baru.',
          dibuat_pada: '2026-11-16T10:00:00.000Z',
        },
      ],
    });
    expect(await bersihkanCacheKedaluwarsa(db, SEKARANG)).toBe(0);
    expect(db.baris('ai_cache')).toHaveLength(1);
  });

  it('menyapu maksimal 100 baris per pemicu', async () => {
    expect(BATAS_BERSIH_CACHE_AI).toBe(100);
    const lama = Array.from({ length: 105 }, (_, i) => ({
      id: `id-${i}`,
      pertanyaan_hash: `hash-lama-${String(i).padStart(3, '0')}`,
      jawaban: 'Jawaban lama.',
      dibuat_pada: '2026-11-01T10:00:00.000Z',
    }));
    const db = new FakeD1({ ai_cache: lama });
    expect(await bersihkanCacheKedaluwarsa(db, SEKARANG)).toBe(100);
    expect(db.baris('ai_cache')).toHaveLength(5);
  });

  it('best-effort: mengembalikan 0 bila D1 gagal', async () => {
    const db: DbD1 = {
      prepare(): PernyataanD1 {
        throw new Error('D1 gagal (simulasi)');
      },
    };
    await expect(bersihkanCacheKedaluwarsa(db, SEKARANG)).resolves.toBe(0);
  });

  it('tulisCache memicu sapuan: entri kedaluwarsa lama ikut terhapus', async () => {
    const db = new FakeD1({
      ai_cache: [
        {
          id: 'id-lama',
          pertanyaan_hash: 'hash-lama',
          jawaban: 'Jawaban lama.',
          dibuat_pada: '2026-11-01T10:00:00.000Z',
        },
      ],
    });
    const kunciBaru = await hitungKunciCache('user-1', 'WiFi lemot');
    expect(await tulisCache(db, kunciBaru, 'Jawaban baru.', SEKARANG)).toBe(true);
    expect(db.baris('ai_cache').map((b) => b.pertanyaan_hash)).toEqual([kunciBaru]);
  });
});

// ---------------------------------------------------------------------
// Rute Hono (mock D1 + mock fetch global)
// ---------------------------------------------------------------------

const UUID_MILIK = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const UUID_ORANG_LAIN = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

describe('rute AI (Hono)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Tipe aplikasi Hono untuk rute AI (binding + variabel sama). */
  type AppAi = Hono<{ Bindings: AiBindings; Variables: AiVariables }>;

  function buatApp(
    db: DbD1,
    idPengguna: string | null,
    kunciApi = 'kunci-uji',
  ): AppAi {
    const app = new Hono<{ Bindings: AiBindings; Variables: AiVariables }>();
    app.use('*', async (c, next) => {
      if (idPengguna) c.set('userId', idPengguna);
      await next();
    });
    app.route('/', aiRoutes);
    (app as unknown as { __db: DbD1 }).__db = db;
    (app as unknown as { __kunci: string }).__kunci = kunciApi;
    return app;
  }

  function envUntuk(app: AppAi): AiBindings {
    const a = app as unknown as { __db: DbD1; __kunci: string };
    return { DB: a.__db, GEMINI_API_KEY: a.__kunci };
  }

  async function tanya(
    app: AppAi,
    pertanyaan: string,
    tambahan: Record<string, unknown> = {},
    path = '/api/ai/tanya',
  ): Promise<Response> {
    return app.request(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pertanyaan, ...tambahan }),
      },
      envUntuk(app),
    );
  }

  it('POST /api/ai/tanya: sukses menyimpan Q&A dan mengembalikan objek diagnosis lengkap', async () => {
    const db = buatMockDb();
    vi.stubGlobal(
      'fetch',
      buatFetchMock(responsGemini('Langkah 1: mulai ulang HP.')),
    );
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'HP lemot, apa yang harus dilakukan?');
    expect(respons.status).toBe(200);
    const badan = (await respons.json()) as Record<string, unknown>;
    const data = badan.data as Record<string, unknown>;
    expect(badan.success).toBe(true);
    expect(data.jawaban).toBe('Langkah 1: mulai ulang HP.');
    expect(data.sumber_jawaban).toBe('ai');
    expect(data.tersimpan).toBe(true);
    expect(data.sisa_hari_ini).toBe(19);
    expect(typeof data.id).toBe('string');
    expect(data.user_id).toBe('user-1');
    expect(data.health_check_id).toBeNull();
    expect(data.pertanyaan).toBe('HP lemot, apa yang harus dilakukan?');
    expect(data.label_saran).toContain('saran, bukan vonis pasti');
    expect(db.diagnosis.length).toBe(1);
    expect(db.diagnosis[0]?.user_id).toBe('user-1');
  });

  it('POST /api/ai/tanya: pertanyaan berulang memakai cache tanpa memanggil Gemini lagi', async () => {
    const db = buatMockDb();
    const fetchMock = buatFetchMock(responsGemini('Jawaban AI pertama.'));
    vi.stubGlobal('fetch', fetchMock);
    const app = buatApp(db, 'user-1');
    const pertama = await tanya(app, 'WiFi lemot kenapa?');
    expect(pertama.status).toBe(200);
    const kedua = await tanya(app, 'wifi  lemot kenapa?');
    expect(kedua.status).toBe(200);
    const badanKedua = (await kedua.json()) as Record<string, unknown>;
    const dataKedua = badanKedua.data as Record<string, unknown>;
    expect(dataKedua.jawaban).toBe('Jawaban AI pertama.');
    expect(dataKedua.sumber_jawaban).toBe('cache');
    expect(dataKedua.sisa_hari_ini).toBe(18);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.diagnosis.length).toBe(2);
  });

  it('POST /api/ai/tanya: 401 bila tanpa userId (belum masuk)', async () => {
    const db = buatMockDb();
    const app = buatApp(db, null);
    const respons = await tanya(app, 'Tes');
    expect(respons.status).toBe(401);
    const badan = (await respons.json()) as Record<string, unknown>;
    expect(badan.success).toBe(false);
    const galat = badan.error as Record<string, unknown>;
    expect(galat.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/ai/tanya: 400 untuk pertanyaan kosong dan terlalu panjang', async () => {
    const db = buatMockDb();
    const app = buatApp(db, 'user-1');
    for (const pertanyaan of ['', '   ', 'x'.repeat(1001)]) {
      const respons = await tanya(app, pertanyaan);
      expect(respons.status).toBe(400);
      const badan = (await respons.json()) as Record<string, unknown>;
      const galat = badan.error as Record<string, unknown>;
      expect(galat.code).toBe('VALIDATION_ERROR');
    }
  });

  it('POST /api/ai/tanya: 429 AI_QUOTA_HABIS + header Retry-After bila kuota harian habis, tanpa memanggil Gemini', async () => {
    const hariIni = new Date().toISOString().slice(0, 10);
    const db = buatMockDb({
      rateLimits: [{ kunci: `ai:user-1:${hariIni}`, jumlah: 20 }],
    });
    const fetchMock = buatFetchMock(responsGemini('x'));
    vi.stubGlobal('fetch', fetchMock);
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'Tes kuota');
    expect(respons.status).toBe(429);
    const badan = (await respons.json()) as Record<string, unknown>;
    const galat = badan.error as Record<string, unknown>;
    expect(galat.code).toBe('AI_QUOTA_HABIS');
    const retryAfter = Number(respons.headers.get('Retry-After'));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(86_400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /api/ai/tanya: burst 20 paralel dari 19 terpakai — tepat 1 sukses, 19 ditolak 429 (R-05)', async () => {
    const hariIni = new Date().toISOString().slice(0, 10);
    const db = buatMockDb({
      rateLimits: [{ kunci: `ai:user-1:${hariIni}`, jumlah: 19 }],
    });
    // Mock Gemini dengan jeda 50 ms agar 20 permintaan tumpang tindih.
    const fetchMock = vi.fn(async () => {
      await new Promise((selesai) => setTimeout(selesai, 50));
      return new Response(JSON.stringify(responsGemini('Jawaban AI.')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const app = buatApp(db, 'user-1');
    const hasil = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        tanya(app, `Pertanyaan berbeda nomor ${i}?`),
      ),
    );
    const sukses = hasil.filter((r) => r.status === 200);
    const ditolak = hasil.filter((r) => r.status === 429);
    expect(sukses).toHaveLength(1);
    expect(ditolak).toHaveLength(19);
    for (const r of ditolak) {
      const badan = (await r.json()) as Record<string, unknown>;
      expect((badan.error as Record<string, unknown>).code).toBe('AI_QUOTA_HABIS');
    }
    // Hanya satu diagnosis baru yang tersimpan (total kuota tetap 20).
    expect(db.diagnosis.length).toBe(1);
    expect(db.batasLaju.get(`ai:user-1:${hariIni}`)?.jumlah).toBe(20);
  });

  it('POST /api/ai/tanya: Gemini gagal melepaskan cadangan — kuota kembali penuh', async () => {
    const hariIni = new Date().toISOString().slice(0, 10);
    const db = buatMockDb({
      rateLimits: [{ kunci: `ai:user-1:${hariIni}`, jumlah: 19 }],
    });
    vi.stubGlobal('fetch', buatFetchMock({ error: 'rusak' }, 500));
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'WiFi lemot kenapa?');
    expect(respons.status).toBe(200);
    const badan = (await respons.json()) as Record<string, unknown>;
    const data = badan.data as Record<string, unknown>;
    expect(data.sumber_jawaban).toBe('aturan');
    expect(data.sisa_hari_ini).toBe(1);
    // Cadangan dilepas: penghitung kembali 19, bukan 20.
    expect(db.batasLaju.get(`ai:user-1:${hariIni}`)?.jumlah).toBe(19);
  });

  it('POST /api/ai/tanya: Gemini gagal -> jawaban fallback 200 (bukan 502), tidak disimpan, kuota tidak terpotong', async () => {
    const db = buatMockDb({
      wifi: [
        {
          kecepatan_unduh_kbps: 30,
          ping_ms: 400,
          kekuatan_sinyal: 'lemah',
        },
      ],
    });
    vi.stubGlobal('fetch', buatFetchMock({ error: 'rusak' }, 500));
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'WiFi lemot padahal sinyal penuh');
    expect(respons.status).toBe(200);
    const badan = (await respons.json()) as Record<string, unknown>;
    const data = badan.data as Record<string, unknown>;
    expect(badan.success).toBe(true);
    expect(data.sumber_jawaban).toBe('aturan');
    expect(data.tersimpan).toBe(false);
    expect(data.id).toBeNull();
    expect(data.sisa_hari_ini).toBe(20);
    expect(String(data.jawaban)).toContain('bukan dari AI');
    expect(String(data.jawaban)).toContain('sangat lambat');
    expect(db.diagnosis.length).toBe(0);
  });

  it('POST /api/ai/tanya: kuota Gemini habis (429 kedua model) -> jawaban fallback 200, sumber aturan', async () => {
    const db = buatMockDb();
    vi.stubGlobal('fetch', buatFetchMock({ error: 'kuota' }, 429));
    const app = buatApp(db, 'user-1');
    const peringatan = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const respons = await tanya(app, 'WiFi lemot');
    expect(respons.status).toBe(200);
    const badan = (await respons.json()) as Record<string, unknown>;
    const data = badan.data as Record<string, unknown>;
    expect(badan.success).toBe(true);
    expect(data.sumber_jawaban).toBe('aturan');
    expect(data.tersimpan).toBe(false);
    expect(data.id).toBeNull();
    expect(data.sisa_hari_ini).toBe(20);
    expect(String(data.jawaban)).toContain('bukan dari AI');
    expect(db.diagnosis.length).toBe(0);
    // Kuota habis dicatat ke log server (tanpa data pengguna).
    expect(peringatan).toHaveBeenCalledWith(
      expect.stringContaining('Kuota Gemini habis'),
    );
    const semuaPesan = peringatan.mock.calls.flat().join(' ');
    expect(semuaPesan).not.toContain('WiFi lemot');
    peringatan.mockRestore();
  });

  it('POST /api/ai/tanya: kunci belum diatur -> jawaban fallback 200, tanpa memanggil Gemini', async () => {
    const db = buatMockDb();
    const fetchMock = buatFetchMock(responsGemini('x'));
    vi.stubGlobal('fetch', fetchMock);
    const app = buatApp(db, 'user-1', '');
    const respons = await tanya(app, 'Tes kunci');
    expect(respons.status).toBe(200);
    const badan = (await respons.json()) as Record<string, unknown>;
    const data = badan.data as Record<string, unknown>;
    expect(data.sumber_jawaban).toBe('aturan');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /api/ai/tanya: 400 bila health_check_id bukan UUID', async () => {
    const db = buatMockDb();
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'Tes', { health_check_id: 'hc-1' });
    expect(respons.status).toBe(400);
    const badan = (await respons.json()) as Record<string, unknown>;
    const galat = badan.error as Record<string, unknown>;
    expect(galat.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/ai/tanya: 404 bila health_check_id bukan milik pengguna', async () => {
    const db = buatMockDb({
      pemeriksaan: [
        {
          id: UUID_ORANG_LAIN,
          user_id: 'user-2',
          skor: 80,
          ringkasan: '{}',
          dibuat_pada: '2026-11-17T08:00:00.000Z',
        },
      ],
    });
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'Tes', {
      health_check_id: UUID_ORANG_LAIN,
    });
    expect(respons.status).toBe(404);
    const badan = (await respons.json()) as Record<string, unknown>;
    const galat = badan.error as Record<string, unknown>;
    expect(galat.code).toBe('NOT_FOUND');
  });

  it('POST /api/ai/tanya: health_check_id milik pengguna diterima dan tersimpan', async () => {
    const db = buatMockDb({
      pemeriksaan: [
        {
          id: UUID_MILIK,
          user_id: 'user-1',
          skor: 62,
          ringkasan: '{"baterai":"cukup"}',
          dibuat_pada: '2026-11-17T08:00:00.000Z',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      buatFetchMock(responsGemini('Skor 62 cukup baik.')),
    );
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'Skor saya bagaimana?', {
      health_check_id: UUID_MILIK,
    });
    expect(respons.status).toBe(200);
    expect(db.diagnosis[0]?.health_check_id).toBe(UUID_MILIK);
  });

  it('POST /api/ai/diagnose (kanonis K-37) berperilaku sama dengan alias /tanya', async () => {
    const db = buatMockDb();
    vi.stubGlobal('fetch', buatFetchMock(responsGemini('Jawaban kanonis.')));
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'Tes kanonis', {}, '/api/ai/diagnose');
    expect(respons.status).toBe(200);
  });

  it('POST /ai/diagnose (alias lama tanpa /api) sudah tidak ada (K-37)', async () => {
    const db = buatMockDb();
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'Tes alias lama', {}, '/ai/diagnose');
    expect(respons.status).toBe(404);
  });

  it('GET /api/ai/riwayat: hanya data milik pengguna, terbaru dulu, data array + meta.pagination', async () => {
    const db = buatMockDb({
      diagnosis: [
        barisDiagnosis('user-1', '2026-11-17T08:00:00.000Z', 'lama'),
        barisDiagnosis('user-1', '2026-11-17T09:00:00.000Z', 'baru'),
        barisDiagnosis('user-2', '2026-11-17T10:00:00.000Z', 'orang-lain'),
      ],
    });
    const app = buatApp(db, 'user-1');
    const respons = await app.request('/api/ai/riwayat', {}, envUntuk(app));
    expect(respons.status).toBe(200);
    const badan = (await respons.json()) as Record<string, unknown>;
    expect(Array.isArray(badan.data)).toBe(true);
    const items = badan.data as { id: string; user_id: string }[];
    expect(items.map((i) => i.id)).toEqual(['baru', 'lama']);
    expect(items[0]?.user_id).toBe('user-1');
    const meta = badan.meta as {
      pagination: {
        limit: number;
        next_cursor: string | null;
        has_more: boolean;
      };
    };
    expect(meta.pagination).toEqual({
      limit: 20,
      next_cursor: null,
      has_more: false,
    });
  });

  it('GET /api/ai/diagnoses (kanonis K-37) berperilaku sama dengan alias /riwayat', async () => {
    const db = buatMockDb({
      diagnosis: [barisDiagnosis('user-1', '2026-11-17T08:00:00.000Z', 'satu')],
    });
    const app = buatApp(db, 'user-1');
    const respons = await app.request('/api/ai/diagnoses', {}, envUntuk(app));
    expect(respons.status).toBe(200);
    const badan = (await respons.json()) as Record<string, unknown>;
    const items = badan.data as { id: string }[];
    expect(items.map((i) => i.id)).toEqual(['satu']);
  });

  it('GET /ai/diagnoses (alias lama tanpa /api) sudah tidak ada (K-37)', async () => {
    const db = buatMockDb({
      diagnosis: [barisDiagnosis('user-1', '2026-11-17T08:00:00.000Z', 'satu')],
    });
    const app = buatApp(db, 'user-1');
    const respons = await app.request('/ai/diagnoses', {}, envUntuk(app));
    expect(respons.status).toBe(404);
  });

  it('GET /api/ai/riwayat: paginasi cursor bekerja, has_more benar', async () => {
    const db = buatMockDb({
      diagnosis: Array.from({ length: 5 }, (_, i) =>
        barisDiagnosis('user-1', `2026-11-17T0${i}:00:00.000Z`, `d${i}`),
      ),
    });
    const app = buatApp(db, 'user-1');
    const halaman1 = await app.request('/api/ai/riwayat?limit=2', {}, envUntuk(app));
    const badan1 = (await halaman1.json()) as Record<string, unknown>;
    const items1 = badan1.data as { id: string }[];
    const meta1 = badan1.meta as {
      pagination: { limit: number; next_cursor: string | null; has_more: boolean };
    };
    expect(items1.map((i) => i.id)).toEqual(['d4', 'd3']);
    expect(meta1.pagination).toEqual({
      limit: 2,
      next_cursor: expect.any(String),
      has_more: true,
    });
    const halaman2 = await app.request(
      `/api/ai/riwayat?limit=2&cursor=${encodeURIComponent(meta1.pagination.next_cursor as string)}`,
      {},
      envUntuk(app),
    );
    const badan2 = (await halaman2.json()) as Record<string, unknown>;
    const items2 = badan2.data as { id: string }[];
    const meta2 = badan2.meta as {
      pagination: { limit: number; next_cursor: string | null; has_more: boolean };
    };
    expect(items2.map((i) => i.id)).toEqual(['d2', 'd1']);
    expect(meta2.pagination.has_more).toBe(true);
    const halaman3 = await app.request(
      `/api/ai/riwayat?limit=2&cursor=${encodeURIComponent(meta2.pagination.next_cursor as string)}`,
      {},
      envUntuk(app),
    );
    const badan3 = (await halaman3.json()) as Record<string, unknown>;
    const items3 = badan3.data as { id: string }[];
    const meta3 = badan3.meta as {
      pagination: { limit: number; next_cursor: string | null; has_more: boolean };
    };
    expect(items3.map((i) => i.id)).toEqual(['d0']);
    expect(meta3.pagination).toEqual({
      limit: 2,
      next_cursor: null,
      has_more: false,
    });
  });

  it('GET /api/ai/riwayat: 400 untuk limit bukan angka dan cursor cacat', async () => {
    const db = buatMockDb();
    const app = buatApp(db, 'user-1');
    const respons1 = await app.request(
      '/api/ai/riwayat?limit=abc',
      {},
      envUntuk(app),
    );
    expect(respons1.status).toBe(400);
    const respons2 = await app.request(
      '/api/ai/riwayat?cursor=bukan-cursor!!!',
      {},
      envUntuk(app),
    );
    expect(respons2.status).toBe(400);
  });

  it('GET /api/ai/riwayat: 401 bila tanpa userId', async () => {
    const db = buatMockDb();
    const app = buatApp(db, null);
    const respons = await app.request('/api/ai/riwayat', {}, envUntuk(app));
    expect(respons.status).toBe(401);
  });

  it('POST /api/ai/tanya: 503 DATABASE_SIBUK bila D1 gagal menyimpan, jawaban tidak dikembalikan', async () => {
    const db = buatMockDb({ gagal: ['run'] });
    vi.stubGlobal('fetch', buatFetchMock(responsGemini('Jawaban hilang.')));
    const app = buatApp(db, 'user-1');
    const respons = await tanya(app, 'Tes simpan gagal');
    expect(respons.status).toBe(503);
    const badan = (await respons.json()) as Record<string, unknown>;
    expect(badan.success).toBe(false);
    const galat = badan.error as Record<string, unknown>;
    expect(galat.code).toBe('DATABASE_SIBUK');
  });
});
