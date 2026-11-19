// Modul bersama untuk guard origin API pada build produksi
// (regresi K-111, 19 Nov 2026: bundle produksi dibangun tanpa
// VITE_API_BASE_URL sehingga SEMUA panggilan API in-page gagal dan
// login Google mati — bundle memakai jalur relatif /api yang di
// Pages bukan API).
//
// Dipakai oleh:
// - scripts/check-env.mjs    (prebuild: gagal cepat bila var tidak valid)
// - scripts/check-bundle.mjs (postbuild: gate isi bundle)
// - scripts/build-prod.mjs   (build produksi kanonis)
// Guard kedua di vite.config.ts (plugin) memakai aturan yang SAMA
// tetapi ditulis inline karena berkas itu di-typecheck tsc dan tidak
// bisa mengimpor .mjs tanpa deklarasi tipe — bila aturan di sini
// berubah, ubah juga plugin di vite.config.ts.

import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Direktori apps/web (root frontend), diturunkan dari lokasi berkas ini. */
export const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Origin API produksi — SATU-SATUNYA sumber kebenaran untuk nilai ini.
 * URL Worker adalah nilai PUBLIK (bukan secret): aman ditulis di repo,
 * script, dan CI. Dipakai build:prod; jangan menduplikasi literal ini
 * di tempat lain — CI dan docs memanggil build:prod, bukan menyalin URL.
 */
export const PROD_API_ORIGIN =
  "https://dokter-hp-api.hiroohengkerr.workers.dev";

/**
 * Memvalidasi nilai VITE_API_BASE_URL.
 * @returns pesan galat bila tidak valid, null bila valid.
 * Aturan: tidak kosong; URL absolut yang valid; skema https;
 * punya hostname. Garis miring akhir diizinkan (api.ts memotongnya).
 */
export function kesalahanApiBaseUrl(nilai) {
  if (nilai === undefined || nilai === null || String(nilai).trim() === "") {
    return "kosong / belum diatur";
  }
  let url;
  try {
    url = new URL(String(nilai));
  } catch {
    return `bukan URL absolut yang valid: ${JSON.stringify(nilai)}`;
  }
  if (url.protocol !== "https:") {
    return `skema harus https, bukan ${url.protocol} (${JSON.stringify(nilai)})`;
  }
  if (!url.hostname) {
    return `tidak punya hostname: ${JSON.stringify(nilai)}`;
  }
  return null;
}

/**
 * Nilai VITE_API_BASE_URL persis seperti yang akan dipakai `vite build`:
 * process.env didahulukan (Vite tidak pernah menimpa process.env dengan
 * isi berkas .env), lalu berkas .env mode production via loadEnv.
 */
export function muatApiBaseUrl() {
  const dariProses = process.env.VITE_API_BASE_URL;
  if (dariProses !== undefined) return dariProses;
  return loadEnv("production", webRoot).VITE_API_BASE_URL;
}

/** Pesan galat standar guard — dipakai check-env dan plugin Vite. */
export function pesanGuardApiBaseUrl(alasan) {
  return [
    `GALAT BUILD: VITE_API_BASE_URL ${alasan}.`,
    "Build produksi WAJIB menyertakan origin API (URL https absolut).",
    "Tanpa itu bundle memakai jalur relatif /api yang 404 di Pages dan",
    "login Google mati (regresi K-111, 19 Nov 2026).",
    "Cara benar: jalankan `npm run build:prod` (menyuntik origin produksi",
    "otomatis), atau set VITE_API_BASE_URL=https://... sebelum `npm run build`.",
    "`vite dev` tidak butuh variabel ini (proxy /api lokal).",
  ].join("\n");
}
