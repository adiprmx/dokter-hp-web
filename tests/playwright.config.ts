// tests/playwright.config.ts — Konfigurasi Playwright untuk Dokter HP Web App.
//
// Menjalankan tes end-to-end (E2E) di Chromium, desktop dan mobile.
// Basis URL diambil dari variabel lingkungan agar tes yang sama bisa
// jalan di lokal, staging, maupun kedua mirror produksi.
//
// Variabel lingkungan:
//   E2E_BASE_URL        URL dasar aplikasi. Contoh:
//                       - http://localhost:5173 (dev server Vite lokal)
//                       - URL Cloudflare Pages (mirror utama)
//                       - URL Vercel (mirror kedua)
//                       Bila tidak diisi, memakai http://localhost:5173
//                       dan Playwright menjalankan dev server lokal.
//   CI                  Bila bernilai "true", retry aktif (1x),
//                       worker dibatasi 1, dan test.only ditolak.
//
// Perintah (dari folder tests, atau root repo bila workspace sudah ada):
//   npx playwright test                 — semua tes E2E
//   npx playwright test --project=desktop
//   npx playwright test --project=mobile
//   E2E_BASE_URL=https://<mirror> npx playwright test
//
// Dependensi: @playwright/test (devDependency root / workspace tests).
// Status: menunggu scaffold — dipasang tim scaffold saat package.json ada.
// Lihat docs/rencana-test.md bagian 7.

import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://localhost:5173';

const isCI = process.env.CI === 'true';

// Dev server lokal hanya dijalankan bila tidak ada URL eksternal
// yang diberikan lewat variabel lingkungan.
const memakaiServerLokal =
  !process.env.E2E_BASE_URL && !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: {
    // 15 detik (naik dari 5 detik, perbaikan QA Wave 4): di VM bersama,
    // pemeriksaan sesi + muat chunk malas bisa memakan 6–12 detik,
    // sehingga batas 5 detik menimbulkan kegagalan palsu berulang
    // pada tes yang halamannya sebenarnya termuat dengan benar.
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile',
      use: {
        // Perangkat acuan Pixel 7, viewport disamakan ke lebar minimum
        // yang didukung produk (360 px — PRODUCT.md 2.1, phone-first).
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 640 },
      },
    },
  ],
  ...(memakaiServerLokal
    ? {
        webServer: {
          command:
            'npm --prefix ../apps/web run dev -- --port 5173 --strictPort',
          url: 'http://localhost:5173',
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      }
    : {}),
});
