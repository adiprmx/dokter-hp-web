// apps/api/src/index.test.ts
// Tes integrasi entry Worker: envelope utilitas (K-24), mount
// router (K-07), CORS (K-49), cek Origin mutasi (K-50).

import { describe, expect, it } from 'vitest';
import app from './index';
import { FakeD1 } from './test/fake-d1';

const ASAL = 'https://aplikasi.contoh.test';
const ASAL_JAHAT = 'https://jahat.contoh.test';

function env(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { DB: new FakeD1({}), ...overrides };
}

describe('GET /api/health (K-24)', () => {
  it('mengembalikan envelope sukses { status: "ok" }', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { status: string };
      meta: { timestamp: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(typeof body.meta.timestamp).toBe('string');
  });
});

describe('GET /api/ping (K-24)', () => {
  it('mengembalikan envelope { ok: true, t: ms }', async () => {
    const sebelum = Date.now();
    const res = await app.request('/api/ping');
    const sesudah = Date.now();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { ok: boolean; t: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.ok).toBe(true);
    expect(body.data.t).toBeGreaterThanOrEqual(sebelum);
    expect(body.data.t).toBeLessThanOrEqual(sesudah);
  });
});

describe('GET /api/speedtest/info (K-25)', () => {
  it('mengembalikan info file tes + ip_publik null tanpa header CF', async () => {
    const res = await app.request('/api/speedtest/info');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.data.file).toBe('/speedtest-1mb.bin');
    expect(body.data.ukuran_byte).toBe(1048576);
    expect(body.data.ukuran_label).toBe('1 MB');
    expect(body.data.timeout_detik).toBe(15);
    expect(body.data.tes_bertahan_detik).toBe(30);
    expect(body.data.ip_publik).toBeNull();
  });

  it('mengisi ip_publik dari header CF-Connecting-IP', async () => {
    const res = await app.request('/api/speedtest/info', {
      headers: { 'CF-Connecting-IP': '203.0.113.7' },
    });
    const body = (await res.json()) as { data: { ip_publik: string | null } };
    expect(body.data.ip_publik).toBe('203.0.113.7');
  });
});

describe('mount router (K-07)', () => {
  it('rute data tanpa sesi menjawab 401 UNAUTHORIZED, bukan 501', async () => {
    const res = await app.request('/api/health-checks', {}, env() as never);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rute AI tanpa sesi menjawab 401 UNAUTHORIZED, bukan 501', async () => {
    const res = await app.request('/api/ai/diagnoses', {}, env() as never);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rute yang tidak dikenal menjawab 404 NOT_FOUND', async () => {
    const res = await app.request('/api/tidak-ada');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('alias AI tanpa /api sudah tidak ada (404)', async () => {
    const res = await app.request('/ai/diagnose', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('CORS (K-49)', () => {
  it('preflight mengembalikan origin yang dikonfigurasi + credentials', async () => {
    const res = await app.request(
      '/api/health',
      {
        method: 'OPTIONS',
        headers: {
          Origin: ASAL,
          'Access-Control-Request-Method': 'GET',
        },
      },
      env({ ALLOWED_ORIGIN: ASAL }) as never,
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ASAL);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('tanpa ALLOWED_ORIGIN, origin pemanggil di-echo (bukan "*")', async () => {
    const res = await app.request(
      '/api/health',
      {
        method: 'OPTIONS',
        headers: {
          Origin: ASAL,
          'Access-Control-Request-Method': 'GET',
        },
      },
      env() as never,
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ASAL);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });
});

describe('cek Origin mutasi (K-50)', () => {
  it('mutasi dengan Origin asing ditolak 403 FORBIDDEN', async () => {
    const res = await app.request(
      '/api/health-checks',
      { method: 'POST', headers: { Origin: ASAL_JAHAT } },
      env({ ALLOWED_ORIGIN: ASAL }) as never,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('mutasi dengan Origin yang diizinkan diteruskan ke auth (401 tanpa sesi)', async () => {
    const res = await app.request(
      '/api/health-checks',
      { method: 'POST', headers: { Origin: ASAL } },
      env({ ALLOWED_ORIGIN: ASAL }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('mutasi tanpa header Origin diteruskan (bukan browser)', async () => {
    const res = await app.request(
      '/api/health-checks',
      { method: 'POST' },
      env({ ALLOWED_ORIGIN: ASAL }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('GET dengan Origin asing TIDAK diblokir (cek hanya untuk mutasi)', async () => {
    const res = await app.request(
      '/api/health',
      { headers: { Origin: ASAL_JAHAT } },
      env({ ALLOWED_ORIGIN: ASAL }) as never,
    );
    expect(res.status).toBe(200);
  });

  it('tanpa ALLOWED_ORIGIN, mutasi dengan Origin apa pun diteruskan', async () => {
    const res = await app.request(
      '/api/health-checks',
      { method: 'POST', headers: { Origin: ASAL_JAHAT } },
      env() as never,
    );
    expect(res.status).toBe(401);
  });
});
