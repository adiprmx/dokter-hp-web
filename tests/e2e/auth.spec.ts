// tests/e2e/auth.spec.ts — Kerangka tes autentikasi Dokter HP Web App.
//
// PENTING: alur masuk Google (OAuth) TIDAK BISA dites otomatis di
// Playwright tanpa browser sungguhan yang masuk ke akun Google.
// Google memblokir alur OAuth dari browser otomatis dan mewajibkan
// interaksi manusia (memilih akun, verifikasi dua langkah bila aktif).
// Karena itu, alur di bawah ini didokumentasikan sebagai CHECKLIST
// MANUAL dan tesnya ditandai test.skip. Checklist dijalankan oleh
// penguji dengan browser sungguhan (Chrome di HP atau desktop)
// sebelum setiap rilis, di kedua mirror (Pages dan Vercel).
//
// Acuan: PRODUCT.md 4.2 (auth), ARCHITECTURE.md 3.1 dan 4.1
// (endpoint auth dan alur Google + PIN + sesi).
//
// =====================================================================
// CHECKLIST MANUAL — MASUK GOOGLE (browser sungguhan, akun tes)
// =====================================================================
//
// Persiapan:
// [ ] Gunakan akun Google TES (bukan akun pribadi). Akun tes dicatat
//     di tempat aman tim — jangan pernah menulis kata sandi di repo.
// [ ] Buka mirror yang diuji (Pages, lalu Vercel) di Chrome HP
//     (lebar 360 px) dan di Chrome desktop.
//
// 1. Masuk Google — alur utama
// [ ] Buka /masuk, ketuk "Masuk dengan Google".
// [ ] Pilih akun tes di layar Google, setujui izin.
// [ ] Hasil yang diharapkan: kembali ke /dashboard, nama pengguna
//     tampil, tidak ada pesan galat.
// [ ] Periksa cookie: cookie sesi HttpOnly, Secure, SameSite=Lax,
//     Path=/, masa berlaku 30 hari (DevTools > Application > Cookies).
// [ ] Periksa: token sesi mentah TIDAK terlihat di localStorage
//     atau sessionStorage (hanya cookie HttpOnly yang boleh ada).
//
// 2. Sesi bertahan setelah muat ulang
// [ ] Setelah masuk, muat ulang halaman (/dashboard).
// [ ] Hasil yang diharapkan: tetap masuk, tidak diarahkan ke /masuk.
//
// 3. Keluar menghapus sesi
// [ ] Ketuk Keluar (di Pengaturan atau menu akun).
// [ ] Hasil yang diharapkan: kembali ke landing; buka /dashboard
//     langsung mengarah ke /masuk; cookie sesi sudah hilang.
//
// 4. PIN — atur, kunci, buka
// [ ] Di Pengaturan, atur PIN 4-8 digit.
// [ ] Tutup tab, buka kembali aplikasi: layar kunci PIN tampil
//     sebelum dashboard.
// [ ] Masukkan PIN yang benar: dashboard terbuka.
// [ ] Masukkan PIN yang salah: ditolak dengan pesan yang jelas,
//     dashboard tetap terkunci.
//
// 5. PIN — kunci 30 detik setelah 5 kali salah
// [ ] Masukkan PIN salah 5 kali berturut-turut.
// [ ] Hasil yang diharapkan: masukan PIN dikunci 30 detik dengan
//     pesan yang menjelaskan kapan bisa mencoba lagi.
// [ ] Selama terkunci, percobaan PIN (termasuk yang benar) ditolak.
// [ ] Setelah 30 detik, PIN yang benar membuka kembali.
//
// 6. PIN lupa — pemulihan lewat Google
// [ ] Dari layar kunci, pilih masuk ulang dengan Google.
// [ ] Setelah masuk, atur PIN baru dari Pengaturan.
// [ ] Hasil yang diharapkan: riwayat pemeriksaan tetap ada
//     (tidak hilang karena ganti PIN).
//
// 7. Sesi lain
// [ ] Masuk dari dua perangkat/browser berbeda.
// [ ] Di Pengaturan > Sesi, daftar sesi aktif menampilkan keduanya.
// [ ] Keluar dari sesi lain: sesi itu berakhir, sesi yang dipakai
//     sekarang tetap aktif.
//
// 8. Pemeriksaan keamanan bundle (otomatis, di CI — lihat
//    docs/rencana-test.md bagian 4.5)
// [ ] Hasil build (dist/) tidak mengandung kunci Gemini, client
//     secret Google, atau string "sk-" / "AIza" apa pun.
// [ ] Hanya VITE_API_BASE_URL yang terekspos ke browser.
//
// =====================================================================
// Tes di bawah ini adalah cermin checklist di atas. Semuanya
// test.skip sampai ada jalur otomatis yang sah (misalnya endpoint
// sesi tes khusus lingkungan staging, diputuskan koordinator).
// JANGAN mengubah tes ini menjadi tes yang memasukkan kata sandi
// Google secara otomatis — itu melanggar kebijakan Google dan rapuh.
// =====================================================================

import { test, expect } from '@playwright/test';

const ALASAN_OAUTH =
  'Butuh browser sungguhan + akun Google: alur OAuth tidak bisa ' +
  'diotomatisasi (Google memblokir browser otomatis). ' +
  'Jalankan sebagai checklist manual di bagian atas file ini.';

test.describe('Masuk Google (manual — lihat checklist di atas)', () => {
  test.skip('masuk Google mengarah ke dashboard dan sesi bertahan setelah muat ulang', async ({
    page,
  }) => {
    await page.goto('/masuk');
    await page.getByRole('link', { name: /masuk dengan google/i }).click();
    // Langkah selanjutnya terjadi di layar Google (di luar kendali tes).
    await expect(page).toHaveURL(/\/dashboard/);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.skip('keluar menghapus sesi dan dashboard mengarah ke masuk', async ({
    page,
  }) => {
    await page.goto('/pengaturan');
    await page.getByRole('button', { name: /keluar/i }).click();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/masuk/);
  });
});

test.describe('PIN (manual — lihat checklist di atas)', () => {
  test.skip('PIN benar membuka kunci, PIN salah ditolak', async ({ page }) => {
    await page.goto('/kunci');
    await expect(page.getByLabel(/pin/i)).toBeVisible();
  });

  test.skip('5 kali PIN salah berturut-turut mengunci masukan 30 detik', async ({
    page,
  }) => {
    await page.goto('/kunci');
    await expect(page.getByLabel(/pin/i)).toBeVisible();
  });

  test.skip('PIN lupa bisa dipulihkan lewat masuk ulang Google tanpa kehilangan riwayat', async ({
    page,
  }) => {
    await page.goto('/kunci');
    await expect(page.getByText(/lupa pin/i)).toBeVisible();
  });
});

test.describe('Sesi (manual — lihat checklist di atas)', () => {
  test.skip('daftar sesi aktif tampil dan keluar dari sesi lain bekerja', async ({
    page,
  }) => {
    await page.goto('/pengaturan');
    await expect(page.getByText(/sesi/i)).toBeVisible();
  });
});

// Menandai bahwa alasan skip di atas adalah alasan resmi file ini,
// supaya tidak ada yang menghapus test.skip tanpa membaca checklist.
void ALASAN_OAUTH;
