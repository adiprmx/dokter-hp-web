import react from "@vitejs/plugin-react";
import { type Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Konfigurasi Vite untuk frontend Dokter HP Web.
// Proxy /api mengarah ke Worker lokal (wrangler dev, port 8787)
// agar pengembangan frontend dan backend berjalan berdampingan.

/**
 * Aturan validasi VITE_API_BASE_URL — HARUS identik dengan
 * kesalahanApiBaseUrl() di scripts/api-base-url.mjs (ditulis inline
 * di sini karena berkas ini di-typecheck tsc dan tidak bisa mengimpor
 * .mjs tanpa deklarasi tipe; berkas ini juga tidak memakai API Node
 * agar tetap lolos typecheck tanpa @types/node). Bila aturan berubah,
 * ubah keduanya.
 */
function kesalahanApiBaseUrl(nilai: string | undefined): string | null {
  if (nilai === undefined || nilai.trim() === "") {
    return "kosong / belum diatur";
  }
  let url: URL;
  try {
    url = new URL(nilai);
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
 * Guard origin API — lapisan otoritatif (regresi K-111, 19 Nov 2026).
 * `vite build` TANPA VITE_API_BASE_URL yang valid GAGAL di sini, sebelum
 * bundle apa pun ditulis. Plugin ini menangkap SEMUA jalur build —
 * termasuk `npx vite build` langsung yang melewati hook npm prebuild —
 * karena ia membaca env persis seperti yang dipakai Vite sendiri
 * (config.env). Hanya aktif saat command === "build": `vite dev`
 * (serve, proxy /api lokal) dan vitest tidak pernah kena guard ini.
 * Lapisan pertama (gagal lebih cepat, sebelum tsc) ada di
 * scripts/check-env.mjs sebagai hook npm `prebuild`.
 */
function guardApiBaseUrl(): Plugin {
  return {
    name: "dokter-hp:guard-api-base-url",
    configResolved(config) {
      if (config.command !== "build") return;
      const nilai = config.env.VITE_API_BASE_URL as string | undefined;
      const galat = kesalahanApiBaseUrl(nilai);
      if (galat) {
        throw new Error(
          [
            `GALAT BUILD: VITE_API_BASE_URL ${galat}.`,
            "Build produksi WAJIB menyertakan origin API (URL https absolut).",
            "Tanpa itu bundle memakai jalur relatif /api yang 404 di Pages dan",
            "login Google mati (regresi K-111, 19 Nov 2026).",
            "Cara benar: jalankan `npm run build:prod` (menyuntik origin produksi",
            "otomatis), atau set VITE_API_BASE_URL=https://... sebelum `npm run build`.",
            "`vite dev` tidak butuh variabel ini (proxy /api lokal).",
          ].join("\n"),
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), guardApiBaseUrl()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
