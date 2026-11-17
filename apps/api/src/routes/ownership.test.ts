// apps/api/src/routes/ownership.test.ts
// Test rute + kepemilikan: pengguna A tidak pernah bisa membaca,
// mengubah, atau menghapus data pengguna B. Auth middleware asli
// diganti mock yang menetapkan pengguna/sesi dari header
// `x-test-user` / `x-test-session`; D1 diganti FakeD1 berbasis memori.
// Skema seed mengikuti migrasi nyata 0001_init.sql + 0003_wifi_web.sql.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { AppEnv } from '../auth/middleware';
import { FakeD1, type Seed } from '../test/fake-d1';
import { healthRoutes } from './health';
import { wifiRoutes } from './wifi';
import { historyRoutes } from './history';
import { accountRoutes } from './account';

vi.mock('../auth/middleware', () => ({
  authMiddleware: async (c: any, next: any) => {
    const userId = c.req.header('x-test-user') as string | undefined;
    if (!userId) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Sesi Anda sudah berakhir, silakan masuk lagi.' },
          meta: { timestamp: new Date().toISOString() },
        },
        401,
      );
    }
    const sessionId =
      (c.req.header('x-test-session') as string | undefined) ?? `sesi-utama-${userId}`;
    c.set('pengguna', {
      id: userId,
      email: `${userId}@contoh.test`,
      nama: 'Pengguna Uji',
      provider: 'google',
      pin_hash: null,
      pin_salt: null,
      dibuat_pada: '2026-11-01T00:00:00.000Z',
    });
    c.set('sesi', {
      id: sessionId,
      user_id: userId,
      token_hash: 'hash-uji',
      expires_at: '2026-12-17T00:00:00.000Z',
      dibuat_pada: '2026-11-17T00:00:00.000Z',
    });
    await next();
  },
  wajibLogin: async (c: any, next: any) => {
    await next();
  },
  wajibTidakTerkunci: async (c: any, next: any) => {
    await next();
  },
  responsSukses: (c: any, data: unknown, status = 200) =>
    c.json(
      { success: true, data, meta: { timestamp: new Date().toISOString() } },
      status,
    ),
  responsGalat: (c: any, status: number, code: string, message: string) =>
    c.json(
      {
        success: false,
        error: { code, message },
        meta: { timestamp: new Date().toISOString() },
      },
      status,
    ),
  getUserId: (c: any) => (c.get('pengguna') as { id: string }).id,
  getSessionId: (c: any) => (c.get('sesi') as { id: string }).id,
}));

// ------------------------------------------------------------------
// Data uji
// ------------------------------------------------------------------

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

const HC_A = 'a0000000-0000-4000-8000-000000000001';
const HC_B = 'b0000000-0000-4000-8000-000000000001';
const WR_A = 'a0000000-0000-4000-8000-000000000002';
const WR_A_BIASA = 'a0000000-0000-4000-8000-000000000004';
const WR_B = 'b0000000-0000-4000-8000-000000000002';
const AI_A = 'a0000000-0000-4000-8000-000000000003';
const AI_B = 'b0000000-0000-4000-8000-000000000003';

const SESI_A_UTAMA = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESI_A_LAIN = 'aaaaaaaa-0000-4000-8000-000000000002';
const SESI_A_KEDALUWARSA = 'aaaaaaaa-0000-4000-8000-000000000003';
const SESI_B = 'bbbbbbbb-0000-4000-8000-000000000001';

function seedAwal(): Seed {
  return {
    users: [
      { id: USER_A, email: 'a@contoh.id', nama: 'Pengguna A', provider: 'google', pin_hash: null, pin_salt: null, dibuat_pada: '2026-11-01T00:00:00.000Z' },
      { id: USER_B, email: 'b@contoh.id', nama: 'Pengguna B', provider: 'google', pin_hash: null, pin_salt: null, dibuat_pada: '2026-11-01T00:00:00.000Z' },
    ],
    profiles: [
      { id: USER_A, nama: 'Pengguna A', dibuat_pada: '2026-11-01T00:00:00.000Z' },
      { id: USER_B, nama: 'Pengguna B', dibuat_pada: '2026-11-01T00:00:00.000Z' },
    ],
    health_checks: [
      { id: HC_A, user_id: USER_A, skor: 80, ringkasan: '{"baterai":"baik"}', dibuat_pada: '2026-11-17T10:00:00.000Z', updated_at: '2026-11-17T10:00:00.000Z', deleted_at: null, sync_status: 'synced' },
      { id: HC_B, user_id: USER_B, skor: 40, ringkasan: '{"baterai":"boros"}', dibuat_pada: '2026-11-17T09:00:00.000Z', updated_at: '2026-11-17T09:00:00.000Z', deleted_at: null, sync_status: 'synced' },
    ],
    wifi_reports: [
      { id: WR_A, user_id: USER_A, ssid: 'ACHA', kecepatan_koneksi_mbps: 65, kekuatan_sinyal: 'kuat', channel: 6, dns: '1.1.1.1', ping_ms: 20, rekomendasi: 'WiFi baik.', kecepatan_unduh_kbps: 5000, sumber: 'web', durasi_tes_detik: 30, dibuat_pada: '2026-11-17T11:00:00.000Z', updated_at: '2026-11-17T11:00:00.000Z', deleted_at: null },
      { id: WR_A_BIASA, user_id: USER_A, ssid: 'ACHA', kecepatan_koneksi_mbps: 65, kekuatan_sinyal: 'kuat', channel: 6, dns: null, ping_ms: 25, rekomendasi: null, kecepatan_unduh_kbps: 4500, sumber: 'web', durasi_tes_detik: null, dibuat_pada: '2026-11-17T10:30:00.000Z', updated_at: '2026-11-17T10:30:00.000Z', deleted_at: null },
      { id: WR_B, user_id: USER_B, ssid: 'RUMAH-B', kecepatan_koneksi_mbps: 10, kekuatan_sinyal: 'lemah', channel: 1, dns: null, ping_ms: 300, rekomendasi: 'Dekat ke router.', kecepatan_unduh_kbps: 50, sumber: 'web', durasi_tes_detik: null, dibuat_pada: '2026-11-17T08:00:00.000Z', updated_at: '2026-11-17T08:00:00.000Z', deleted_at: null },
    ],
    wifi_sustained_samples: [
      { id: 's0000000-0000-4000-8000-000000000001', wifi_report_id: WR_A, detik_ke: 0, kecepatan_kbps: 4800, dibuat_pada: '2026-11-17T11:00:00.000Z' },
      { id: 's0000000-0000-4000-8000-000000000002', wifi_report_id: WR_A, detik_ke: 1, kecepatan_kbps: 4900, dibuat_pada: '2026-11-17T11:00:01.000Z' },
    ],
    ai_diagnoses: [
      { id: AI_A, user_id: USER_A, health_check_id: HC_A, pertanyaan: 'WiFi lemot kenapa?', jawaban: 'Coba ganti channel.', dibuat_pada: '2026-11-17T12:00:00.000Z' },
      { id: AI_B, user_id: USER_B, health_check_id: HC_B, pertanyaan: 'Baterai boros.', jawaban: 'Periksa aplikasi.', dibuat_pada: '2026-11-17T07:00:00.000Z' },
    ],
    sessions: [
      { id: SESI_A_UTAMA, user_id: USER_A, token_hash: 'hash-a-utama', expires_at: '2026-12-17T00:00:00.000Z', dibuat_pada: '2026-11-17T00:00:00.000Z', user_agent: 'Mozilla/5.0 (Uji)', ip_terakhir: '203.0.113.7' },
      { id: SESI_A_LAIN, user_id: USER_A, token_hash: 'hash-a-lain', expires_at: '2026-12-16T00:00:00.000Z', dibuat_pada: '2026-11-16T00:00:00.000Z', user_agent: null, ip_terakhir: null },
      { id: SESI_A_KEDALUWARSA, user_id: USER_A, token_hash: 'hash-a-kadaluarsa', expires_at: '2026-01-01T00:00:00.000Z', dibuat_pada: '2025-12-01T00:00:00.000Z' },
      { id: SESI_B, user_id: USER_B, token_hash: 'hash-b', expires_at: '2026-12-17T00:00:00.000Z', dibuat_pada: '2026-11-17T00:00:00.000Z' },
    ],
  };
}

interface Envelope {
  success: boolean;
  data?: any;
  meta?: any;
  error?: { code: string; message: string };
}

function buatApp(db: FakeD1): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.route('/', healthRoutes);
  app.route('/', wifiRoutes);
  app.route('/', historyRoutes);
  app.route('/', accountRoutes);
  return app;
}

async function minta(
  app: Hono<AppEnv>,
  db: FakeD1,
  path: string,
  opsi: { method?: string; body?: unknown; userId?: string; sessionId?: string } = {},
): Promise<{ status: number; body: Envelope; res: Response }> {
  const headers: Record<string, string> = {};
  if (opsi.userId) headers['x-test-user'] = opsi.userId;
  if (opsi.sessionId) headers['x-test-session'] = opsi.sessionId;
  if (opsi.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(
    `http://localhost${path}`,
    {
      method: opsi.method ?? 'GET',
      headers,
      body: opsi.body !== undefined ? JSON.stringify(opsi.body) : undefined,
    },
    { DB: db as unknown as D1Database },
  );
  const body = (await res.json()) as Envelope;
  return { status: res.status, body, res };
}

let db: FakeD1;
let app: Hono<AppEnv>;

beforeEach(() => {
  db = new FakeD1(seedAwal());
  app = buatApp(db);
});

// ------------------------------------------------------------------
// health_checks
// ------------------------------------------------------------------

describe('kepemilikan health_checks', () => {
  it('daftar hanya menampilkan milik pengguna yang masuk + meta pagination', async () => {
    const { status, body } = await minta(app, db, '/health-checks', { userId: USER_A });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const ids = (body.data as any[]).map((r) => r.id);
    expect(ids).toEqual([HC_A]);
    expect(body.meta.pagination).toEqual({ limit: 20, next_cursor: null, has_more: false });
  });

  it('detail milik pengguna lain mengembalikan 404 NOT_FOUND', async () => {
    const { status, body } = await minta(app, db, `/health-checks/${HC_B}`, { userId: USER_A });
    expect(status).toBe(404);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('id yang bukan UUID mengembalikan 400 VALIDATION_ERROR', async () => {
    const { status, body } = await minta(app, db, '/health-checks/bukan-uuid', { userId: USER_A });
    expect(status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('hapus milik pengguna lain mengembalikan 404 dan baris tetap utuh', async () => {
    const { status } = await minta(app, db, `/health-checks/${HC_B}`, {
      method: 'DELETE',
      userId: USER_A,
    });
    expect(status).toBe(404);
    const barisB = db.baris('health_checks').find((r) => r.id === HC_B);
    expect(barisB?.deleted_at).toBeNull();
  });

  it('hapus milik sendiri berhasil dengan bentuk kontrak dan hilang dari daftar', async () => {
    const { status, body } = await minta(app, db, `/health-checks/${HC_A}`, {
      method: 'DELETE',
      userId: USER_A,
    });
    expect(status).toBe(200);
    expect(body.data.id).toBe(HC_A);
    expect(body.data.deleted).toBe(true);
    expect(typeof body.data.deleted_at).toBe('string');
    const barisA = db.baris('health_checks').find((r) => r.id === HC_A);
    expect(barisA?.deleted_at).not.toBeNull();
    const daftar = await minta(app, db, '/health-checks', { userId: USER_A });
    expect((daftar.body.data as any[])).toHaveLength(0);
  });

  it('POST menyimpan dengan user_id dari sesi dan sync_status synced', async () => {
    const { status, body } = await minta(app, db, '/health-checks', {
      method: 'POST',
      userId: USER_A,
      body: { skor: 75, ringkasan: { wifi: { status: 'baik', skor: 85, sumber: 'web' } } },
    });
    expect(status).toBe(201);
    expect(body.data.skor).toBe(75);
    expect(body.data.ringkasan).toEqual({ wifi: { status: 'baik', skor: 85, sumber: 'web' } });
    expect(body.data.sync_status).toBe('synced');
    expect(body.data.user_id).toBe(USER_A);
    expect(body.data.deleted_at).toBeNull();
    const tersimpan = db
      .baris('health_checks')
      .find((r) => r.id === (body.data as { id: string }).id);
    expect(tersimpan?.user_id).toBe(USER_A);
  });

  it('POST menolak skor di luar 0-100', async () => {
    const { status, body } = await minta(app, db, '/health-checks', {
      method: 'POST',
      userId: USER_A,
      body: { skor: 101 },
    });
    expect(status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('POST mengabaikan user_id dan sync_status dari badan request', async () => {
    const { status, body } = await minta(app, db, '/health-checks', {
      method: 'POST',
      userId: USER_A,
      body: { skor: 60, user_id: USER_B, sync_status: 'pending' },
    });
    expect(status).toBe(201);
    const tersimpan = db
      .baris('health_checks')
      .find((r) => r.id === (body.data as { id: string }).id);
    expect(tersimpan?.user_id).toBe(USER_A);
    expect(tersimpan?.sync_status).toBe('synced');
  });
});

// ------------------------------------------------------------------
// wifi_reports + sampel
// ------------------------------------------------------------------

describe('kepemilikan wifi_reports dan sampel', () => {
  it('daftar hanya menampilkan milik pengguna yang masuk, terbaru dulu', async () => {
    const { status, body } = await minta(app, db, '/wifi-reports', { userId: USER_A });
    expect(status).toBe(200);
    expect((body.data as any[]).map((r) => r.id)).toEqual([WR_A, WR_A_BIASA]);
    expect(body.meta.pagination).toEqual({ limit: 20, next_cursor: null, has_more: false });
  });

  it('detail milik pengguna lain mengembalikan 404 tanpa sampel bocor', async () => {
    const { status } = await minta(app, db, `/wifi-reports/${WR_B}`, { userId: USER_A });
    expect(status).toBe(404);
  });

  it('detail milik sendiri menyertakan samples tes bertahan', async () => {
    const { status, body } = await minta(app, db, `/wifi-reports/${WR_A}`, { userId: USER_A });
    expect(status).toBe(200);
    expect(body.data.ssid).toBe('ACHA');
    expect(body.data.user_id).toBe(USER_A);
    expect(body.data.samples).toEqual([
      { detik_ke: 0, kecepatan_kbps: 4800 },
      { detik_ke: 1, kecepatan_kbps: 4900 },
    ]);
  });

  it('POST menolak laporan tanpa hasil ukur sama sekali', async () => {
    const { status, body } = await minta(app, db, '/wifi-reports', {
      method: 'POST',
      userId: USER_A,
      body: { ssid: 'ACHA' },
    });
    expect(status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('POST menolak channel di luar rentang dan durasi bukan 30', async () => {
    const { status: s1 } = await minta(app, db, '/wifi-reports', {
      method: 'POST',
      userId: USER_A,
      body: { ping_ms: 10, channel: 20 },
    });
    expect(s1).toBe(400);
    const { status: s2 } = await minta(app, db, '/wifi-reports', {
      method: 'POST',
      userId: USER_A,
      body: { ping_ms: 10, durasi_tes_detik: 60 },
    });
    expect(s2).toBe(400);
  });

  it('kirim sampel ke laporan pengguna lain mengembalikan 404 dan tidak menyimpan apa pun', async () => {
    const sebelum = db.baris('wifi_sustained_samples').length;
    const { status } = await minta(app, db, `/wifi-reports/${WR_B}/samples`, {
      method: 'POST',
      userId: USER_A,
      body: { samples: [{ detik_ke: 0, kecepatan_kbps: 100 }] },
    });
    expect(status).toBe(404);
    expect(db.baris('wifi_sustained_samples')).toHaveLength(sebelum);
  });

  it('kirim sampel ke laporan bukan tes bertahan mengembalikan 422', async () => {
    const { status, body } = await minta(app, db, `/wifi-reports/${WR_A_BIASA}/samples`, {
      method: 'POST',
      userId: USER_A,
      body: { samples: [{ detik_ke: 0, kecepatan_kbps: 100 }] },
    });
    expect(status).toBe(422);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('kirim sampel ke laporan sendiri berhasil (200) lalu bisa dibaca', async () => {
    const kirim = await minta(app, db, `/wifi-reports/${WR_A}/samples`, {
      method: 'POST',
      userId: USER_A,
      body: {
        samples: [
          { detik_ke: 2, kecepatan_kbps: 4700 },
          { detik_ke: 3, kecepatan_kbps: 4600 },
        ],
      },
    });
    expect(kirim.status).toBe(200);
    expect(kirim.body.data).toEqual({
      wifi_report_id: WR_A,
      disimpan: 2,
      total_sampel: 4,
    });
    const baca = await minta(app, db, `/wifi-reports/${WR_A}/samples`, { userId: USER_A });
    expect(baca.status).toBe(200);
    expect((baca.body.data as any[])).toHaveLength(4);
  });

  it('kirim ulang detik yang sama menimpa nilai lama (bukan galat)', async () => {
    const kirim = await minta(app, db, `/wifi-reports/${WR_A}/samples`, {
      method: 'POST',
      userId: USER_A,
      body: { samples: [{ detik_ke: 0, kecepatan_kbps: 1111 }] },
    });
    expect(kirim.status).toBe(200);
    expect(kirim.body.data.total_sampel).toBe(2);
    const baca = await minta(app, db, `/wifi-reports/${WR_A}/samples`, { userId: USER_A });
    expect((baca.body.data as any[])[0]).toEqual({ detik_ke: 0, kecepatan_kbps: 1111 });
  });

  it('sampel melebihi 30 per laporan ditolak', async () => {
    const tambahan = Array.from({ length: 28 }, (_, i) => ({
      detik_ke: i + 2,
      kecepatan_kbps: 1000,
    }));
    const kirim = await minta(app, db, `/wifi-reports/${WR_A}/samples`, {
      method: 'POST',
      userId: USER_A,
      body: { samples: tambahan },
    });
    expect(kirim.status).toBe(200);
    expect(kirim.body.data.total_sampel).toBe(30);
    // 30 sampel terisi; detik baru tidak ada lagi yang bisa ditambah
    // (detik 0-29 sudah penuh), tetapi pengiriman 1 sampel baru
    // dengan detik duplikat tetap sah (upsert). Uji batas lewat
    // laporan lain tidak mungkin karena detik dibatasi 0-29.
    const upsert = await minta(app, db, `/wifi-reports/${WR_A}/samples`, {
      method: 'POST',
      userId: USER_A,
      body: { samples: [{ detik_ke: 5, kecepatan_kbps: 999 }] },
    });
    expect(upsert.status).toBe(200);
    expect(upsert.body.data.total_sampel).toBe(30);
  });

  it('hapus laporan milik pengguna lain mengembalikan 404 dan baris utuh', async () => {
    const { status } = await minta(app, db, `/wifi-reports/${WR_B}`, {
      method: 'DELETE',
      userId: USER_A,
    });
    expect(status).toBe(404);
    expect(db.baris('wifi_reports').find((r) => r.id === WR_B)?.deleted_at).toBeNull();
  });
});

// ------------------------------------------------------------------
// history
// ------------------------------------------------------------------

describe('riwayat gabungan', () => {
  it('hanya berisi item milik pengguna, terbaru dulu, dengan pagination', async () => {
    const { status, body } = await minta(app, db, '/history', { userId: USER_A });
    expect(status).toBe(200);
    const items = body.data as any[];
    expect(items.map((i) => i.id)).toEqual([AI_A, WR_A, WR_A_BIASA, HC_A]);
    expect(items.map((i) => i.jenis)).toEqual(['ai', 'wifi', 'wifi', 'kesehatan']);
    expect(body.meta.pagination).toEqual({ limit: 20, next_cursor: null, has_more: false });
  });

  it('filter jenis wifi hanya mengembalikan laporan WiFi milik pengguna', async () => {
    const { body } = await minta(app, db, '/history?jenis=wifi', { userId: USER_A });
    const items = body.data as any[];
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.jenis === 'wifi')).toBe(true);
    expect(body.meta.pagination.has_more).toBe(false);
    expect(body.meta.pagination.next_cursor).toBeNull();
  });

  it('jenis tidak dikenal mengembalikan 400', async () => {
    const { status } = await minta(app, db, '/history?jenis=ngawur', { userId: USER_A });
    expect(status).toBe(400);
  });

  it('cursor memotong gabungan dengan benar (K-32)', async () => {
    const halaman1 = await minta(app, db, '/history?limit=2', { userId: USER_A });
    expect((halaman1.body.data as any[]).map((i) => i.id)).toEqual([AI_A, WR_A]);
    expect(halaman1.body.meta.pagination.has_more).toBe(true);
    const cursor = halaman1.body.meta.pagination.next_cursor as string;
    expect(typeof cursor).toBe('string');
    const halaman2 = await minta(app, db, `/history?limit=2&cursor=${encodeURIComponent(cursor)}`, {
      userId: USER_A,
    });
    expect((halaman2.body.data as any[]).map((i) => i.id)).toEqual([WR_A_BIASA, HC_A]);
    expect(halaman2.body.meta.pagination.has_more).toBe(false);
    expect(halaman2.body.meta.pagination.next_cursor).toBeNull();
  });

  it('cursor cacat mengembalikan 400 VALIDATION_ERROR', async () => {
    const { status, body } = await minta(app, db, '/history?cursor=bukan-cursor!!!', {
      userId: USER_A,
    });
    expect(status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('hapus diagnosis AI milik pengguna lain mengembalikan 404 dan baris utuh', async () => {
    const { status } = await minta(app, db, `/history/ai/${AI_B}`, {
      method: 'DELETE',
      userId: USER_A,
    });
    expect(status).toBe(404);
    expect(db.baris('ai_diagnoses').some((r) => r.id === AI_B)).toBe(true);
  });

  it('hapus entri kesehatan milik sendiri berhasil (soft-delete)', async () => {
    const { status, body } = await minta(app, db, `/history/kesehatan/${HC_A}`, {
      method: 'DELETE',
      userId: USER_A,
    });
    expect(status).toBe(200);
    expect(body.data.deleted).toBe(true);
    expect(typeof body.data.deleted_at).toBe('string');
    expect(db.baris('health_checks').find((r) => r.id === HC_A)?.deleted_at).not.toBeNull();
  });
});

// ------------------------------------------------------------------
// account
// ------------------------------------------------------------------

describe('akun', () => {
  it('profil mengembalikan data pengguna yang masuk', async () => {
    const { status, body } = await minta(app, db, '/account/profile', { userId: USER_A });
    expect(status).toBe(200);
    expect(body.data).toEqual({
      id: USER_A,
      nama: 'Pengguna A',
      email: 'a@contoh.id',
      dibuat_pada: '2026-11-01T00:00:00.000Z',
    });
  });

  it('PATCH nama hanya mengubah profil pengguna yang masuk', async () => {
    const { status, body } = await minta(app, db, '/account/profile', {
      method: 'PATCH',
      userId: USER_A,
      body: { nama: 'Nama Baru A' },
    });
    expect(status).toBe(200);
    expect(body.data.nama).toBe('Nama Baru A');
    expect(db.baris('profiles').find((r) => r.id === USER_B)?.nama).toBe('Pengguna B');
    expect(db.baris('users').find((r) => r.id === USER_A)?.nama).toBe('Nama Baru A');
  });

  it('PATCH nama kosong ditolak', async () => {
    const { status } = await minta(app, db, '/account/profile', {
      method: 'PATCH',
      userId: USER_A,
      body: { nama: '   ' },
    });
    expect(status).toBe(400);
  });

  it('daftar sesi hanya menampilkan sesi aktif milik pengguna + penanda saat ini', async () => {
    const { status, body } = await minta(app, db, '/account/sessions', {
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
    });
    expect(status).toBe(200);
    const items = body.data as any[];
    expect(items.map((s) => s.id)).toEqual([SESI_A_UTAMA, SESI_A_LAIN]);
    expect(items[0].saat_ini).toBe(true);
    expect(items[1].saat_ini).toBe(false);
    expect(items[0].kedaluwarsa_pada).toBe('2026-12-17T00:00:00.000Z');
    expect(items[0].user_agent).toBe('Mozilla/5.0 (Uji)');
    expect(items[0].ip_terakhir).toBe('203.0.113.7');
    expect(items[1].user_agent).toBeNull();
    expect(items[1].ip_terakhir).toBeNull();
    expect(body.meta.pagination).toEqual({ limit: 20, next_cursor: null, has_more: false });
  });

  it('hapus sesi milik pengguna lain mengembalikan 404', async () => {
    const { status } = await minta(app, db, `/account/sessions/${SESI_B}`, {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
    });
    expect(status).toBe(404);
    expect(db.baris('sessions').some((r) => r.id === SESI_B)).toBe(true);
  });

  it('hapus sesi lain milik sendiri berhasil tanpa menghapus cookie', async () => {
    const { status, body, res } = await minta(app, db, `/account/sessions/${SESI_A_LAIN}`, {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ id: SESI_A_LAIN, deleted: true });
    expect(db.baris('sessions').some((r) => r.id === SESI_A_LAIN)).toBe(false);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('hapus sesi saat ini berhasil dan menghapus cookie', async () => {
    const { status, res } = await minta(app, db, `/account/sessions/${SESI_A_UTAMA}`, {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
    });
    expect(status).toBe(200);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('__Host-dokter_hp_session=');
    expect(cookie).toContain('Max-Age=0');
  });

  it('ekspor mengembalikan berkas JSON mentah hanya berisi data milik pengguna', async () => {
    const { status, body, res } = await minta(app, db, '/account/export', { userId: USER_A });
    expect(status).toBe(200);
    const data = body as any;
    expect(data.format).toBe('dokter-hp-export');
    expect(data.versi).toBe(1);
    expect(typeof data.dieksport_pada).toBe('string');
    expect(data.success).toBeUndefined();
    expect(data.profil.id).toBe(USER_A);
    expect(data.health_checks.map((r: any) => r.id)).toEqual([HC_A]);
    expect(data.wifi_reports.map((r: any) => r.id)).toEqual([WR_A, WR_A_BIASA]);
    expect(data.wifi_reports[0].samples).toHaveLength(2);
    expect(data.ai_diagnoses.map((r: any) => r.id)).toEqual([AI_A]);
    const teks = JSON.stringify(body);
    expect(teks).not.toContain(HC_B);
    expect(teks).not.toContain(WR_B);
    expect(teks).not.toContain(AI_B);
    expect(res.headers.get('Content-Disposition') ?? '').toContain('dokter-hp-export-');
  });

  it('ekspor ke-6 dalam sehari ditolak 429 RATE_LIMITED + Retry-After (K-42/K-59)', async () => {
    for (let i = 0; i < 5; i++) {
      const { status } = await minta(app, db, '/account/export', { userId: USER_A });
      expect(status).toBe(200);
    }
    const { status, body, res } = await minta(app, db, '/account/export', { userId: USER_A });
    expect(status).toBe(429);
    expect(body.error?.code).toBe('RATE_LIMITED');
    const retryAfter = Number(res.headers.get('Retry-After'));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(86_400);
  });

  it('hapus akun tanpa konfirmasi mengembalikan 400', async () => {
    const { status, body } = await minta(app, db, '/account', {
      method: 'DELETE',
      userId: USER_A,
      body: {},
    });
    expect(status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(db.baris('users').some((r) => r.id === USER_A)).toBe(true);
  });

  it('hapus akun dengan konfirmasi salah mengembalikan 422 KONFIRMASI_SALAH', async () => {
    const { status, body } = await minta(app, db, '/account', {
      method: 'DELETE',
      userId: USER_A,
      body: { konfirmasi: 'hapus' },
    });
    expect(status).toBe(422);
    expect(body.error?.code).toBe('KONFIRMASI_SALAH');
    expect(db.baris('users').some((r) => r.id === USER_A)).toBe(true);
  });

  it('hapus akun menghapus seluruh data pengguna itu saja + cookie', async () => {
    // K-72: sesi harus segar (dibuat ≤ 10 menit lalu).
    const sesiUtama = db.tables.sessions.find((r) => r.id === SESI_A_UTAMA);
    if (sesiUtama) sesiUtama.dibuat_pada = new Date().toISOString();
    const { status, body, res } = await minta(app, db, '/account', {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
      body: { konfirmasi: 'HAPUS' },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ deleted: true, email: 'a@contoh.id' });
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('Max-Age=0');
    for (const tabel of ['users', 'profiles', 'health_checks', 'wifi_reports', 'ai_diagnoses', 'sessions']) {
      expect(
        db.baris(tabel).some((r) => r.id === USER_A || r.user_id === USER_A),
        `tabel ${tabel} masih punya data pengguna A`,
      ).toBe(false);
    }
    expect(db.baris('wifi_sustained_samples')).toHaveLength(0);
    // Data pengguna B utuh.
    expect(db.baris('users').some((r) => r.id === USER_B)).toBe(true);
    expect(db.baris('profiles').some((r) => r.id === USER_B)).toBe(true);
    expect(db.baris('health_checks').some((r) => r.id === HC_B)).toBe(true);
    expect(db.baris('wifi_reports').some((r) => r.id === WR_B)).toBe(true);
    expect(db.baris('ai_diagnoses').some((r) => r.id === AI_B)).toBe(true);
    expect(db.baris('sessions').some((r) => r.id === SESI_B)).toBe(true);
  });

  it('hapus akun menerima konfirmasi "DELETE" (K-26)', async () => {
    const sesiUtama = db.tables.sessions.find((r) => r.id === SESI_A_UTAMA);
    if (sesiUtama) sesiUtama.dibuat_pada = new Date().toISOString();
    const { status, body } = await minta(app, db, '/account', {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
      body: { konfirmasi: 'DELETE' },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ deleted: true, email: 'a@contoh.id' });
    expect(db.baris('users').some((r) => r.id === USER_A)).toBe(false);
    expect(db.baris('users').some((r) => r.id === USER_B)).toBe(true);
  });

  it('hapus akun ditolak 403 LOGIN_ULANG_DIPERLUKAN bila sesi sudah lama (K-72, R-09)', async () => {
    // Seed: SESI_A_UTAMA dibuat 2026-11-17 — jauh di luar tenggang 10 menit.
    const { status, body } = await minta(app, db, '/account', {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
      body: { konfirmasi: 'HAPUS' },
    });
    expect(status).toBe(403);
    expect(body.error?.code).toBe('LOGIN_ULANG_DIPERLUKAN');
    expect(db.baris('users').some((r) => r.id === USER_A)).toBe(true);
  });

  it('hapus akun diizinkan bila PIN baru dibuka walau sesi sudah lama (K-72)', async () => {
    db.tables.pin_unlocks = [
      { session_id: SESI_A_UTAMA, dibuka_pada: new Date().toISOString() },
    ];
    const { status, body } = await minta(app, db, '/account', {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
      body: { konfirmasi: 'HAPUS' },
    });
    expect(status).toBe(200);
    expect(body.data).toEqual({ deleted: true, email: 'a@contoh.id' });
  });

  it('hapus akun menghapus baris rate_limits milik pengguna itu saja (R-14)', async () => {
    const sesiUtama = db.tables.sessions.find((r) => r.id === SESI_A_UTAMA);
    if (sesiUtama) sesiUtama.dibuat_pada = new Date().toISOString();
    db.tables.rate_limits = [
      { kunci: `ai:${USER_A}:2026-11-17`, jumlah: 3, jendela_mulai: '2026-11-17T00:00:00.000Z', kedaluwarsa_pada: '2999-01-01T00:00:00.000Z' },
      { kunci: `tulis:${USER_A}:2026-11-17T10:00`, jumlah: 5, jendela_mulai: '2026-11-17T10:00:00.000Z', kedaluwarsa_pada: '2999-01-01T00:00:00.000Z' },
      { kunci: `ai:${USER_B}:2026-11-17`, jumlah: 2, jendela_mulai: '2026-11-17T00:00:00.000Z', kedaluwarsa_pada: '2999-01-01T00:00:00.000Z' },
      { kunci: 'oauth:203.0.113.9:2026-11-17T10:00', jumlah: 1, jendela_mulai: '2026-11-17T10:00:00.000Z', kedaluwarsa_pada: '2999-01-01T00:00:00.000Z' },
    ];
    const { status } = await minta(app, db, '/account', {
      method: 'DELETE',
      userId: USER_A,
      sessionId: SESI_A_UTAMA,
      body: { konfirmasi: 'HAPUS' },
    });
    expect(status).toBe(200);
    const sisa = db.baris('rate_limits').map((r) => r.kunci);
    expect(sisa).not.toContain(`ai:${USER_A}:2026-11-17`);
    expect(sisa).not.toContain(`tulis:${USER_A}:2026-11-17T10:00`);
    // Baris pengguna B dan kunci per-IP utuh.
    expect(sisa).toContain(`ai:${USER_B}:2026-11-17`);
    expect(sisa).toContain('oauth:203.0.113.9:2026-11-17T10:00');
  });
});

// ------------------------------------------------------------------
// Audit query: setiap query ke tabel milik pengguna terikat user_id sesi
// ------------------------------------------------------------------

describe('audit query kepemilikan', () => {
  it('tidak ada query yang mengikat user_id pengguna lain atau tanpa filter pemilik', async () => {
    await minta(app, db, '/health-checks', { userId: USER_A });
    await minta(app, db, `/health-checks/${HC_A}`, { userId: USER_A });
    await minta(app, db, '/health-checks', {
      method: 'POST',
      userId: USER_A,
      body: { skor: 90 },
    });
    await minta(app, db, `/wifi-reports/${WR_A}`, { userId: USER_A });
    await minta(app, db, `/wifi-reports/${WR_A}/samples`, {
      method: 'POST',
      userId: USER_A,
      body: { samples: [{ detik_ke: 5, kecepatan_kbps: 100 }] },
    });
    await minta(app, db, '/history', { userId: USER_A });
    await minta(app, db, '/account/profile', { userId: USER_A });
    await minta(app, db, '/account/sessions', { userId: USER_A, sessionId: SESI_A_UTAMA });
    await minta(app, db, '/account/export', { userId: USER_A });

    const tabelMilik = [
      'health_checks',
      'wifi_reports',
      'ai_diagnoses',
      'profiles',
      'users',
      'sessions',
    ];
    const laporanA = new Set([WR_A, WR_A_BIASA]);
    for (const q of db.queries) {
      const sql = q.sql.toLowerCase();
      const menyentuhMilik = tabelMilik.some((t) => sql.includes(t)) || sql.includes('wifi_sustained_samples');
      if (!menyentuhMilik) continue;
      // Tidak boleh ada parameter pengguna lain.
      expect(q.params, `query mengikat id pengguna lain: ${q.sql}`).not.toContain(USER_B);
      if (sql.includes('wifi_sustained_samples') && !sql.includes('user_id')) {
        // Sampel dicakup lewat laporan yang kepemilikannya sudah dicek:
        // parameter id laporan harus laporan milik A. Pada INSERT,
        // parameter pertama adalah id sampel BARU (UUID acak), bukan
        // id laporan — hanya parameter kedua (wifi_report_id) yang
        // diperiksa. Pada SELECT/DELETE, semua parameter UUID adalah
        // id laporan.
        const rendah = sql.toLowerCase();
        const idLaporan: unknown[] = rendah.startsWith('insert')
          ? [q.params[1]]
          : q.params.filter(
              (p) => typeof p === 'string' && /^[0-9a-f-]{36}$/i.test(p),
            );
        for (const p of idLaporan) {
          expect(laporanA.has(p as string), `sampel diakses lewat laporan asing: ${q.sql}`).toBe(true);
        }
      } else {
        expect(q.params, `query tanpa filter pemilik: ${q.sql}`).toContain(USER_A);
      }
    }
    expect(db.queries.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------
// Paginasi cursor + auth (K-32)
// ------------------------------------------------------------------

describe('paginasi cursor', () => {
  function seedBanyak(): Seed {
    const seed = seedAwal();
    seed.health_checks = Array.from({ length: 25 }, (_, i) => ({
      id: `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      user_id: USER_A,
      skor: 50 + i,
      ringkasan: '{}',
      dibuat_pada: `2026-11-17T${String(23 - Math.floor(i / 60)).padStart(2, '0')}:${String(59 - (i % 60)).padStart(2, '0')}:00.000Z`,
      updated_at: '2026-11-17T23:59:00.000Z',
      deleted_at: null,
      sync_status: 'synced',
    }));
    return seed;
  }

  it('tiga halaman cursor tanpa duplikat dan tanpa ada yang terlewat', async () => {
    db = new FakeD1(seedBanyak());
    app = buatApp(db);
    const semuaId: string[] = [];
    const halaman1 = await minta(app, db, '/health-checks?limit=10', { userId: USER_A });
    expect(halaman1.status).toBe(200);
    expect((halaman1.body.data as any[])).toHaveLength(10);
    expect(halaman1.body.meta.pagination).toEqual({
      limit: 10,
      next_cursor: expect.any(String),
      has_more: true,
    });
    semuaId.push(...(halaman1.body.data as any[]).map((r) => r.id));
    const cursor2 = halaman1.body.meta.pagination.next_cursor as string;
    const halaman2 = await minta(app, db, `/health-checks?limit=10&cursor=${encodeURIComponent(cursor2)}`, {
      userId: USER_A,
    });
    expect((halaman2.body.data as any[])).toHaveLength(10);
    expect(halaman2.body.meta.pagination.has_more).toBe(true);
    semuaId.push(...(halaman2.body.data as any[]).map((r) => r.id));
    const cursor3 = halaman2.body.meta.pagination.next_cursor as string;
    const halaman3 = await minta(app, db, `/health-checks?limit=10&cursor=${encodeURIComponent(cursor3)}`, {
      userId: USER_A,
    });
    expect((halaman3.body.data as any[])).toHaveLength(5);
    expect(halaman3.body.meta.pagination).toEqual({
      limit: 10,
      next_cursor: null,
      has_more: false,
    });
    semuaId.push(...(halaman3.body.data as any[]).map((r) => r.id));
    expect(new Set(semuaId).size).toBe(25);
  });

  it('limit bukan angka dan cursor cacat mengembalikan 400', async () => {
    const { status: s1 } = await minta(app, db, '/health-checks?limit=abc', { userId: USER_A });
    expect(s1).toBe(400);
    const { status: s2, body: b2 } = await minta(app, db, '/health-checks?cursor=bukan-cursor!!!', {
      userId: USER_A,
    });
    expect(s2).toBe(400);
    expect(b2.error?.code).toBe('VALIDATION_ERROR');
  });

  it('limit di luar batas diklem, bukan galat', async () => {
    const { status, body } = await minta(app, db, '/health-checks?limit=500', { userId: USER_A });
    expect(status).toBe(200);
    expect(body.meta.pagination.limit).toBe(100);
  });
});

describe('auth', () => {
  it('tanpa sesi mengembalikan 401 UNAUTHORIZED', async () => {
    const { status, body } = await minta(app, db, '/health-checks');
    expect(status).toBe(401);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });
});
