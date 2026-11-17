// apps/api/src/lib/asal.ts
// Helper origin untuk CORS dan cek Origin anti-CSRF (K-49, K-50,
// K-73 — respons temuan Red R-01/R-21).
//
// Aturan (K-73):
// - ALLOWED_ORIGIN boleh berisi daftar origin dipisah koma
//   (mis. Pages + mirror Vercel); pencocokan PERSIS per origin.
// - Bila ALLOWED_ORIGIN tidak diatur, Worker FAIL-CLOSED: hanya
//   origin loopback (localhost/127.0.0.1/[::1]) atau origin yang
//   sama-host dengan permintaan yang diizinkan. Situs jahat tidak
//   dapat memalsukan header Origin menjadi localhost, dan origin
//   sama-host berarti permintaan berasal dari situs sendiri.
// - Echo origin sembarang DILARANG dalam keadaan apa pun —
//   perilaku echo lama (R-01) adalah celah kritis.

/** Host yang dianggap loopback (pengembangan lokal). */
const HOST_LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Mengurai nilai ALLOWED_ORIGIN menjadi daftar origin: dipisah koma,
 * dipangkas spasi, entri kosong dibuang. Mengembalikan daftar kosong
 * bila nilai tidak diatur atau kosong (mode fail-closed).
 */
export function uraiDaftarOrigin(nilai: string | null | undefined): string[] {
  if (!nilai) {
    return [];
  }
  return nilai
    .split(',')
    .map((asal) => asal.trim())
    .filter((asal) => asal.length > 0);
}

/** Mengambil host dari string origin; null bila bukan URL valid. */
function hostDariOrigin(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Mengambil hostname dari string origin; null bila bukan URL valid. */
function namaHostDariOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True bila origin berasal dari loopback (localhost, 127.0.0.1,
 * atau [::1]) — aman diizinkan saat ALLOWED_ORIGIN tidak diatur.
 */
export function apakahOriginLoopback(origin: string): boolean {
  const namaHost = namaHostDariOrigin(origin);
  return namaHost !== null && HOST_LOOPBACK.has(namaHost);
}

/**
 * True bila host origin sama dengan host permintaan (termasuk port)
 * — permintaan berasal dari situs sendiri.
 */
export function apakahOriginSamaHost(origin: string, hostPermintaan: string): boolean {
  const host = hostDariOrigin(origin);
  return host !== null && host === hostPermintaan.toLowerCase();
}

/**
 * Menentukan apakah satu Origin diizinkan.
 * - Bila daftar origin terkonfigurasi: pencocokan persis terhadap
 *   daftar (tidak ada pengecualian loopback/sama-host — daftar
 *   adalah sumber kebenaran).
 * - Bila daftar kosong (ALLOWED_ORIGIN tidak diatur): hanya
 *   loopback atau sama-host yang diizinkan (fail-closed, K-73a).
 */
export function apakahOriginDiizinkan(
  origin: string,
  daftarDiizinkan: string[],
  hostPermintaan: string,
): boolean {
  if (daftarDiizinkan.length > 0) {
    return daftarDiizinkan.includes(origin);
  }
  return (
    apakahOriginLoopback(origin) || apakahOriginSamaHost(origin, hostPermintaan)
  );
}

/**
 * Host permintaan dari URL request (termasuk port, huruf kecil).
 * Mengembalikan string kosong bila URL tidak dapat diurai.
 */
export function hostPermintaanDariUrl(urlPermintaan: string): string {
  try {
    return new URL(urlPermintaan).host.toLowerCase();
  } catch {
    return '';
  }
}
