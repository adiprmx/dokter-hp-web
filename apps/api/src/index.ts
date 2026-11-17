// apps/api/src/index.ts
// Entry Worker Dokter HP Web App: header keamanan (R-08), batas
// ukuran badan (R-20), CORS (K-49, K-73), cek Origin pada endpoint
// mutasi (K-50, K-73), mount apiRouter (/api) + aiRoutes (path
// absolut /api/ai/*).
//
// Binding DB memakai antarmuka minimal DbD1 agar semua sub-router
// bisa dipasang (Hono mensyaratkan SubEnv extends Env saat
// route(); D1Database bisa dipakai sebagai DbD1, sebaliknya
// tidak). Nilai GOOGLE_*, GEMINI_API_KEY, dan PIN_PEPPER berasal
// dari secret Worker (`wrangler secret put`) — tidak pernah di
// wrangler.toml atau repo. Semua binding selain DB opsional di
// tipe agar tes bisa menjalankan app dengan env minimal; handler
// yang butuh binding yang tidak diatur menjawab galat 500 yang aman.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiRouter } from './routes/api';
import { aiRoutes } from './ai/routes';
import { authMiddleware, type VariabelAuth } from './auth/middleware';
import type { DbD1 } from './auth/session';
import {
  apakahOriginDiizinkan,
  hostPermintaanDariUrl,
  uraiDaftarOrigin,
} from './lib/asal';
import { headerKeamanan } from './lib/header-keamanan';
import { batasUkuranBadan } from './lib/batas-badan';

type Bindings = {
  DB: DbD1;
  KV?: KVNamespace;
  ALLOWED_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  PIN_PEPPER?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: VariabelAuth }>();

// Header keamanan (R-08): dipasang PERTAMA agar mencakup preflight
// CORS, galat, dan 404.
app.use('/api/*', headerKeamanan);

// Batas ukuran badan JSON 100 KB (R-20): tolak 413 sebelum handler
// membaca badan.
app.use('/api/*', batasUkuranBadan);

// CORS (K-49, K-73): daftar origin diizinkan dari ALLOWED_ORIGIN
// (dipisah koma, mis. "https://a.pages.dev, https://b.pages.dev").
// Bila ALLOWED_ORIGIN tidak diatur: FAIL-CLOSED — hanya origin
// loopback (pengembangan lokal) dan origin yang sama-host dengan
// permintaan yang mendapat header Access-Control-Allow-Origin;
// origin lain tidak mendapat header sama sekali (bukan echo).
// Produksi WAJIB mengatur ALLOWED_ORIGIN ke domain Pages.
app.use('/api/*', async (c, next) => {
  const daftar = uraiDaftarOrigin(c.env?.ALLOWED_ORIGIN);
  const hostPermintaan = hostPermintaanDariUrl(c.req.url);
  return cors({
    origin: (origin) =>
      apakahOriginDiizinkan(origin, daftar, hostPermintaan) ? origin : null,
    credentials: true,
  })(c, next);
});

// Cek Origin pada endpoint mutasi (K-50, K-73): bila header Origin
// ada dan tidak diizinkan -> 403 FORBIDDEN. Cek Origin inilah
// pelindung CSRF-nya: cookie SameSite=None + Secure TIDAK
// melindungi dari CSRF lintas situs (None justru mengizinkan
// cookie terkirim lintas situs — dipakai karena frontend dan API
// beda origin). Tanpa header Origin (curl, aplikasi non-browser)
// permintaan diteruskan — browser selalu mengirim Origin pada
// permintaan mutasi lintas situs, sehingga permintaan CSRF dari
// browser selalu membawa Origin dan tertolak di sini.
const METODE_MUTASI = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
app.use('/api/*', async (c, next) => {
  if (METODE_MUTASI.has(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin) {
      const daftar = uraiDaftarOrigin(c.env?.ALLOWED_ORIGIN);
      const hostPermintaan = hostPermintaanDariUrl(c.req.url);
      if (!apakahOriginDiizinkan(origin, daftar, hostPermintaan)) {
        return c.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'Asal permintaan tidak diizinkan.' },
            meta: { timestamp: new Date().toISOString() },
          },
          403,
        );
      }
    }
  }
  await next();
});

// Rute AI: authMiddleware mengisi userId (wajibMasuk di aiRoutes
// menjadi pertahanan kedua + menjaga kompatibilitas tes AI).
app.use('/api/ai/*', authMiddleware);
app.route('/', aiRoutes);

app.route('/api', apiRouter);

// Rute API yang belum dikenal: 404 JSON yang konsisten.
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Rute tidak ditemukan.' },
      meta: { timestamp: new Date().toISOString() },
    },
    404,
  ),
);

app.onError((err, c) => {
  console.error(err);
  return c.json(
    {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan di server.' },
      meta: { timestamp: new Date().toISOString() },
    },
    500,
  );
});

export default app;
