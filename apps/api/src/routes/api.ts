// apps/api/src/routes/api.ts
// Router /api: memasang semua router fitur di bawah awalan /api
// (keputusan koordinator K-07). Rute AI (aiRoutes) TIDAK dipasang
// di sini — aiRoutes memakai path absolut dan dipasang di root
// oleh index.ts.
//
//   /api/health, /api/ping, /api/speedtest/info  — utilitas (publik)
//   /api/auth/*                                  — autentikasi + PIN
//   /api/health-checks                           — pemeriksaan kesehatan
//   /api/wifi-reports                            — laporan WiFi + sampel
//   /api/history                                 — riwayat gabungan
//   /api/account/*                               — profil, sesi, ekspor, hapus akun

import { Hono } from 'hono';
import type { VariabelAuth } from '../auth/middleware';
import type { DbD1 } from '../auth/session';
import { buatRouterAuth } from '../auth/routes';
import { healthRoutes } from './health';
import { wifiRoutes } from './wifi';
import { historyRoutes } from './history';
import { accountRoutes } from './account';
import { utilitasRoutes } from './utilitas';

/**
 * Env router /api: D1 minimal (DbD1) + variabel auth. DbD1 dipakai
 * — bukan D1Database — agar router auth (EnvAuth, DB: DbD1) bisa
 * dipasang di sini: Hono mensyaratkan SubEnv extends Env saat
 * route(), dan DbD1 tidak bisa diturunkan ke D1Database. Router
 * data (AppEnv, DB: D1Database) tetap bisa dipasang karena
 * D1Database bisa dipakai sebagai DbD1.
 */
export type EnvApi = { Bindings: { DB: DbD1 }; Variables: VariabelAuth };

export const apiRouter = new Hono<EnvApi>();

apiRouter.route('/auth', buatRouterAuth());
apiRouter.route('/', healthRoutes);
apiRouter.route('/', wifiRoutes);
apiRouter.route('/', historyRoutes);
apiRouter.route('/', accountRoutes);
apiRouter.route('/', utilitasRoutes);
