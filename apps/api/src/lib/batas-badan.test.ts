// apps/api/src/lib/batas-badan.test.ts
// Tes middleware batas ukuran badan (R-20).

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { BATAS_BADAN_BYTE, batasUkuranBadan } from './batas-badan';

function buatApp(): Hono {
  const app = new Hono();
  app.use('/api/*', batasUkuranBadan);
  app.post('/api/echo', async (c) => {
    const badan = await c.req.json();
    return c.json({ success: true, data: { panjang: JSON.stringify(badan).length } });
  });
  app.delete('/api/echo', async (c) => {
    const badan = await c.req.json();
    return c.json({ success: true, data: { panjang: JSON.stringify(badan).length } });
  });
  app.get('/api/echo', (c) => c.json({ success: true, data: {} }));
  return app;
}

describe('batasUkuranBadan (R-20)', () => {
  it('batas adalah 100 KB', () => {
    expect(BATAS_BADAN_BYTE).toBe(100 * 1024);
  });

  it('meneruskan badan di bawah batas (jalur Content-Length)', async () => {
    const app = buatApp();
    const res = await app.request('/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teks: 'a'.repeat(1000) }),
    });
    expect(res.status).toBe(200);
  });

  it('menolak badan di atas batas dengan 413 PAYLOAD_TOO_LARGE', async () => {
    const app = buatApp();
    const res = await app.request('/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teks: 'a'.repeat(BATAS_BADAN_BYTE) }),
    });
    expect(res.status).toBe(413);
    const badan = (await res.json()) as { error: { code: string } };
    expect(badan.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('meneruskan badan tepat di batas', async () => {
    const app = buatApp();
    // JSON.stringify({teks: "..."}) menambah 11 byte overhead.
    const isi = 'a'.repeat(BATAS_BADAN_BYTE - 11);
    const res = await app.request('/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teks: isi }),
    });
    expect(res.status).toBe(200);
  });

  it('menolak stream tanpa Content-Length yang melebihi batas (jalur lambat)', async () => {
    const app = buatApp();
    const besar = new TextEncoder().encode(JSON.stringify({ teks: 'a'.repeat(BATAS_BADAN_BYTE) }));
    const stream = new ReadableStream<Uint8Array>({
      start(kontrol) {
        kontrol.enqueue(besar);
        kontrol.close();
      },
    });
    const req = new Request('http://localhost/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stream,
      // @ts-expect-error duplex diperlukan untuk badan stream di undici.
      duplex: 'half',
    });
    expect(req.headers.get('Content-Length')).toBeNull();
    const res = await app.request(req);
    expect(res.status).toBe(413);
    const badan = (await res.json()) as { error: { code: string } };
    expect(badan.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('menolak DELETE dengan badan di atas batas (R-20: DELETE tercakup)', async () => {
    const app = buatApp();
    const res = await app.request('/api/echo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teks: 'a'.repeat(BATAS_BADAN_BYTE) }),
    });
    expect(res.status).toBe(413);
    const badan = (await res.json()) as { error: { code: string } };
    expect(badan.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('meneruskan DELETE dengan badan normal', async () => {
    const app = buatApp();
    const res = await app.request('/api/echo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ konfirmasi: 'HAPUS' }),
    });
    expect(res.status).toBe(200);
  });

  it('tidak memeriksa permintaan GET', async () => {
    const app = buatApp();
    const res = await app.request('/api/echo', { method: 'GET' });
    expect(res.status).toBe(200);
  });

  it('meneruskan POST tanpa badan', async () => {
    const app = buatApp();
    const res = await app.request('/api/echo', { method: 'POST' });
    // Handler gagal membaca JSON (badan kosong) — bukan 413.
    expect(res.status).not.toBe(413);
  });
});
