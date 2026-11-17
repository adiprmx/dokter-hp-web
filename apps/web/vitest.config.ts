// apps/web/vitest.config.ts — Konfigurasi Vitest untuk frontend.
//
// Lingkungan jsdom karena tes komponen React butuh DOM. Tes unit
// logika murni (format, klasifikasi, perhitungan skor) juga jalan
// di konfigurasi ini.
//
// Perintah (dari apps/web):
//   npm run test        — sekali jalan (dipakai CI)
//   npm run test:watch  — mode pantau saat mengembangkan
//
// Dependensi: vitest, jsdom (devDependencies apps/web).
// Status: menunggu scaffold — dipasang tim scaffold saat package.json ada.
// Lihat docs/rencana-test.md bagian 7.
//
// Catatan: bila tes komponen React dimulai, tambahkan
// @testing-library/react dan @testing-library/jest-dom beserta
// setup file (setupFiles) — lihat docs/rencana-test.md bagian 4.1.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['node_modules', 'dist'],
    // globals: false — setiap file tes mengimpor sendiri dari 'vitest'
    // (describe, it, expect), supaya asal tiap fungsi jelas.
    globals: false,
  },
});
