// apps/api/src/lib/header-keamanan.ts
// Middleware header keamanan respons Worker (R-08).
//
// Dipasang PERTAMA di index.ts agar mencakup semua respons /api/*,
// termasuk preflight CORS, galat, dan 404: header dipasang lewat
// c.header() SEBELUM next(), dan Hono meneruskannya ke respons
// akhir (termasuk respons mentah yang dikembalikan middleware
// CORS — diverifikasi dari perilaku hono 4.13: c.header() menulis
// ke #preparedHeaders yang dipakai #newResponse dan c.res).
//
// Content-Security-Policy diturunkan dari kode:
// - default/script/style 'self' (tanpa CDN/font eksternal di
//   frontend; tanpa inline style di index.html/src).
// - script-src juga memuat hash SHA-256 blok JSON-LD statis di
//   index.html (N-01, K-82) — satu-satunya skrip inline yang
//   diizinkan. Injeksi JSON-LD dinamis TIDAK diizinkan (tidak
//   dapat di-hash) dan sudah dihapus dari PanduanPage.
// - img-src 'self' data: TANPA lh3.googleusercontent.com —
//   frontend TIDAK menampilkan avatar Google (grep membuktikan
//   tidak ada referensi foto_profil/picture/avatar di src).
// - frame-ancestors 'none' (anti-clickjacking), base-uri 'self',
//   form-action 'self'.
// Aset statis Pages memakai CSP yang sama + connect-src untuk
// origin API (lihat apps/web/public/_headers).

import { createMiddleware } from 'hono/factory';

/**
 * Hash SHA-256 blok JSON-LD statis (WebApplication) di
 * apps/web/index.html (N-01, K-82): dihitung dari teks persis di
 * dalam tag <script type="application/ld+json"> (tanpa tagnya,
 * termasuk spasi baris baru di awal/akhir). WAJIB dihitung ulang
 * bila isi blok berubah — hash lama membuat browser menolak blok
 * itu dan structured data hilang diam-diam.
 */
export const HASH_JSONLD_STATIS =
  'sha256-4o/r21fqBN20SRxsbfoWC0l3DMnxsVrv+mxXnh+rxPM=';

/** Content-Security-Policy untuk respons API. */
export const KEBIJAKAN_KEAMANAN_KONTEN =
  `default-src 'self'; script-src 'self' '${HASH_JSONLD_STATIS}'; style-src 'self'; ` +
  "img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; " +
  "form-action 'self'";

/** Daftar header keamanan yang dipasang pada setiap respons. */
export const HEADER_KEAMANAN: Record<string, string> = {
  'Content-Security-Policy': KEBIJAKAN_KEAMANAN_KONTEN,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** Middleware: memasang seluruh header keamanan lalu melanjutkan. */
export const headerKeamanan = createMiddleware(async (c, next) => {
  for (const [nama, nilai] of Object.entries(HEADER_KEAMANAN)) {
    c.header(nama, nilai);
  }
  await next();
});
