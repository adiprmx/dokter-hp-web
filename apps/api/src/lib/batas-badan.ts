// apps/api/src/lib/batas-badan.ts
// Middleware batas ukuran badan permintaan (R-20).
//
// Semua endpoint mutasi /api/* memakai badan JSON. Badan yang
// lebih dari 100 KB ditolak 413 dengan kode PAYLOAD_TOO_LARGE
// sebelum handler membacanya — mencegah penyalahgunaan memori
// Worker dan D1 lewat payload raksasa.
//
// Dua jalur pemeriksaan:
// - Jalur cepat: header Content-Length bila ada dan valid.
// - Jalur lambat: bila Content-Length tidak ada (chunked/stream),
//   badan dibaca dari clone permintaan dan dihitung per chunk;
//   pembacaan dihentikan begitu batas terlampaui. Clone dipakai
//   agar badan asli tetap utuh untuk handler.

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

/** Batas ukuran badan permintaan dalam byte (100 KB). */
export const BATAS_BADAN_BYTE = 100 * 1024;

/** Metode yang membawa badan dan diperiksa batasnya. */
const METODE_BERBADAN = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Respons 413 envelope standar (kontrak 0.3). */
function responsTerlaluBesar(c: Context): Response {
  return c.json(
    {
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Data yang dikirim terlalu besar.' },
      meta: { timestamp: new Date().toISOString() },
    },
    413,
  );
}

/**
 * Middleware batas badan: memeriksa Content-Length bila ada;
 * bila tidak ada, menghitung ukuran badan dari clone stream.
 * Permintaan tanpa badan atau di bawah batas diteruskan.
 */
export const batasUkuranBadan = createMiddleware(async (c, next) => {
  if (!METODE_BERBADAN.has(c.req.method)) {
    await next();
    return;
  }
  const panjangHeader = c.req.header('Content-Length');
  if (panjangHeader !== undefined) {
    const panjang = Number.parseInt(panjangHeader, 10);
    if (Number.isFinite(panjang) && panjang > BATAS_BADAN_BYTE) {
      return responsTerlaluBesar(c);
    }
    if (Number.isFinite(panjang)) {
      await next();
      return;
    }
    // Content-Length tidak valid: lanjut ke jalur lambat.
  }
  const badan = c.req.raw.body;
  if (!badan) {
    await next();
    return;
  }
  try {
    const clone = c.req.raw.clone();
    const pembaca = clone.body?.getReader();
    if (!pembaca) {
      await next();
      return;
    }
    let total = 0;
    for (;;) {
      const { done, value } = await pembaca.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > BATAS_BADAN_BYTE) {
        // Jangan await cancel(): pada beberapa implementasi stream
        // (mis. badan string undici di Node) cancel() tidak pernah
        // resolve. Clone dibuang begitu saja.
        pembaca.cancel().catch(() => undefined);
        return responsTerlaluBesar(c);
      }
    }
  } catch {
    // Gagal membaca clone (badan sudah dipakai dsb.): teruskan
    // ke handler — handler akan gagal dengan galatnya sendiri.
  }
  await next();
});
