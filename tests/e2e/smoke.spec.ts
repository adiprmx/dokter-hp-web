// tests/e2e/smoke.spec.ts — Tes smoke E2E Dokter HP Web App.
//
// Tes ini memastikan halaman-halaman utama bisa dibuka dan pengaman
// rute berjalan. Acuan perilaku: PRODUCT.md bagian 4 dan 6 (rute),
// ARCHITECTURE.md bagian 4.1 (alur auth).
//
// Tes yang menunggu fitur yang belum dibangun ditandai test.skip
// dengan alasan yang jelas. Begitu fitur tersedia, hapus test.skip
// dan jalankan tesnya — jangan hapus tesnya.
//
// Menjalankan:
//   npx playwright test tests/e2e/smoke.spec.ts
//   npx playwright test tests/e2e/smoke.spec.ts --project=mobile

import { test, expect } from '@playwright/test';

test.describe('Landing', () => {
  test('landing terbuka dan menampilkan nama produk serta tombol utama', async ({
    page,
  }) => {
    await page.goto('/');

    // Nama produk terlihat (PRODUCT.md 4.1).
    await expect(
      page.getByRole('heading', { name: /dokter hp/i }).first(),
    ).toBeVisible();

    // Tes WiFi tanpa akun ditawarkan di landing (PRODUCT.md 4.1).
    await expect(
      page.getByRole('button', { name: /coba tes wifi tanpa akun/i }),
    ).toBeVisible();

    // Tombol masuk/daftar tersedia.
    await expect(page.getByRole('link', { name: /masuk/i }).first()).toBeVisible();
  });
});

test.describe('Halaman masuk', () => {
  test('halaman login terbuka dan menampilkan tombol Masuk dengan Google', async ({
    page,
  }) => {
    await page.goto('/masuk');

    await expect(
      page.getByRole('button', { name: /masuk dengan google/i }),
    ).toBeVisible();
  });
});

test.describe('Pengaman rute', () => {
  test('dashboard tanpa login mengarah ke halaman masuk', async ({ page }) => {
    await page.goto('/dashboard');

    // Tanpa sesi, pengguna diarahkan ke /masuk
    // (PRODUCT.md 5, ARCHITECTURE.md 4.1 langkah 7-8).
    await expect(page).toHaveURL(/\/masuk/);
    await expect(
      page.getByRole('button', { name: /masuk dengan google/i }),
    ).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  // Menunggu fitur: alur masuk Google + halaman dashboard + helper sesi
  // tes (storage state Playwright). Tes ini baru bisa jalan setelah
  // autentikasi berfungsi dan ada cara masuk sebagai pengguna tes
  // (lihat docs/rencana-test.md bagian 5 dan 6).
  test.skip('empty state dashboard tampil bila belum ada data pemeriksaan', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    // PRODUCT.md 4.3: bila belum ada data, grafik riwayat skor diganti
    // empty state jujur — bukan grafik dengan angka contoh.
    await expect(page.getByText(/belum ada data pemeriksaan/i)).toBeVisible();
  });
});
