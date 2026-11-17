// apps/api/src/index.ts
// Entry Worker Dokter HP Web App: CORS (K-49), cek Origin pada
// endpoint mutasi (K-50), mount apiRouter (/api) + aiRoutes
// (path absolut /api/ai/*).
//
// Binding DB memakai antarmuka minimal DbD1 agar semua sub-router
// bisa dipasang (Hono mensyaratkan SubEnv extends Env saat
// route(); D1Database bisa dipakai sebagai DbD1, sebaliknya
// tidak). Nilai GOOGLE_* dan GEMINI_API_KEY berasal dari secret
// Worker (`wrangler secret put`) — tidak pernah di wrangler.toml
// atau repo. Semua binding selain DB opsional di tipe agar tes
// bisa menjalankan app dengan env minimal; handler yang butuh
// binding yang tidak diatur menjawab galat 500 yang aman.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiRouter } from './routes/api';
import { aiRoutes } from './ai/routes';
import { authMiddleware, type VariabelAuth } from './auth/middleware';
import type { DbD1 } from './auth/session';

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
};

const app = new Hono<{ Bindings: Bindings; Variables: VariabelAuth }>();

// CORS (K-49): origin spesifik dari ALLOWED_ORIGIN + credentials.
// Bila ALLOWED_ORIGIN tidak diatur (pengembangan lokal / tes),
// origin pemanggil di-echo — BUKAN "*" mentah, karena "*" tidak
// kompatibel dengan credentials di browser. Produksi WAJIB
// mengatur ALLOWED_ORIGIN ke domain Pages.
app.use('/api/*', async (c, next) => {
  const diizinkan = c.env?.ALLOWED_ORIGIN;
  const origin = diizinkan ? diizinkan : (asal: string) => asal;
  return cors({ origin, credentials: true })(c, next);
});

// Cek Origin pada endpoint mutasi (K-50): bila header Origin ada
// dan ALLOWED_ORIGIN diatur dan Origin berbeda -> 403 FORBIDDEN.
// Tanpa header Origin (curl, aplikasi non-browser) permintaan
// diteruskan — cookie SameSite=None + Secure tetap melindungi
// dari CSRF lintas situs.
const METODE_MUTASI = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
app.use('/api/*', async (c, next) => {
  if (METODE_MUTASI.has(c.req.method)) {
    const diizinkan = c.env?.ALLOWED_ORIGIN;
    const origin = c.req.header('Origin');
    if (diizinkan && origin && origin !== diizinkan) {
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
