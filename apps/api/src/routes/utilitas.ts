// apps/api/src/routes/utilitas.ts
// Rute utilitas publik (tanpa auth): /health, /ping, /speedtest/info.
// Mengikuti docs/api-contracts.md bagian 8. Semua respons memakai
// envelope standar (K-24); tidak ada akses D1 di rute-rute ini,
// sehingga tidak ada rate limit ketat.

import { Hono } from 'hono';
import { balasSukses, bungkus } from '../lib/envelope';
import type { AppEnv } from '../auth/middleware';

export const utilitasRoutes = new Hono<AppEnv>();

// GET /health — status layanan (envelope { status: "ok" }).
utilitasRoutes.get(
  '/health',
  bungkus<AppEnv>(async (c) => {
    return balasSukses(c, { status: 'ok' });
  }),
);

// GET /ping — latensi HTTP (envelope { ok: true, t: ms epoch }).
utilitasRoutes.get(
  '/ping',
  bungkus<AppEnv>(async (c) => {
    return balasSukses(c, { ok: true, t: Date.now() });
  }),
);

// GET /speedtest/info — info file tes kecepatan + IP publik pemanggil
// (K-25: IP dibaca dari header CF-Connecting-IP; null bila header
// tidak ada, misalnya saat dijalankan lokal tanpa Cloudflare).
utilitasRoutes.get(
  '/speedtest/info',
  bungkus<AppEnv>(async (c) => {
    const ip = c.req.header('CF-Connecting-IP')?.trim() || null;
    return balasSukses(c, {
      file: '/speedtest-1mb.bin',
      ukuran_byte: 1048576,
      ukuran_label: '1 MB',
      timeout_detik: 15,
      tes_bertahan_detik: 30,
      ip_publik: ip,
    });
  }),
);
