// tests/e2e/qa-wave4.spec.ts — Tes E2E Wave 4 (QA Playwright) Dokter HP Web App.
//
// Dibuat Tim QA Wave 4, 18 Nov 2026. Berjalan terhadap build produksi
// (vite preview, port 4174) + API lokal (wrangler dev, port 8787, D1 lokal).
//
// Sesi uji dibuat dari luar (seed SQL ke D1 lokal, token di
// hidden_files/qa-wave4/scratch/tokens.json — berkas lokal QA, bukan bagian repo).
// Bila berkas token tidak ada, tes yang butuh sesi masuk dilewati
// (test.skip) dan alasannya tercatat — bukan dianggap lolos.
//
// Pengguna uji (semua data UJI LOKAL, domain .local):
//   A  — tanpa PIN, sudah punya data (5 pemeriksaan, 2 laporan WiFi)
//   B  — PIN 482917, sesi pertama (tokenB) sudah dibuka, tanpa data
//   B2 — sesi kedua pengguna B, dibuat setelah PIN diatur -> TERKUNCI
//
// Screenshot disimpan ke hidden_files/qa-wave4/screenshots/<proyek>/.
// Jalankan: E2E_BASE_URL=http://localhost:4174 npx playwright test qa-wave4

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const DIR_SCREENSHOT = path.join(
  DIR_REPO,
  'hidden_files/qa-wave4/screenshots',
);

interface TokenUji {
  tokenA: string;
  tokenB: string;
  tokenB2: string;
  tokenB2d: string;
  tokenB2m: string;
  tokenB3: string;
}

/** Token sesi terkunci per proyek (desktop/mobile jalan paralel dan
 *  tidak boleh berbagi satu sesi terkunci yang sama). */
function tokenTerkunci(proyek: string): string {
  return proyek === 'mobile' ? token!.tokenB2m : token!.tokenB2d;
}

let token: TokenUji | null = null;
const BERKAS_TOKEN = path.join(
  DIR_REPO,
  'hidden_files/qa-wave4/scratch/tokens.json',
);
if (existsSync(BERKAS_TOKEN)) {
  try {
    token = JSON.parse(readFileSync(BERKAS_TOKEN, 'utf8')) as TokenUji;
  } catch {
    token = null;
  }
}

/** Konteks browser dengan cookie sesi API (domain localhost, semua port). */
async function konteksMasuk(
  browser: import('@playwright/test').Browser,
  tokenSesi: string,
  proyek: string,
): Promise<BrowserContext> {
  const konteks = await browser.newContext({
    viewport:
      proyek === 'mobile' ? { width: 360, height: 640 } : { width: 1280, height: 720 },
  });
  await konteks.addCookies([
    {
      name: '__Host-dokter_hp_session',
      value: tokenSesi,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
  ]);
  return konteks;
}

/** Ukur overflow horizontal + tap target tombol terkecil di halaman. */
async function ukurTataLetak(page: Page): Promise<{
  overflowPx: number;
  tombolTerkecilPx: number | null;
}> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowPx = Math.max(0, doc.scrollWidth - window.innerWidth);
    let terkecil: number | null = null;
    for (const el of document.querySelectorAll('button, a[href]')) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const h = Math.round(r.height);
      if (terkecil === null || h < terkecil) terkecil = h;
    }
    return { overflowPx, tombolTerkecilPx: terkecil };
  });
}

async function screenshotLayar(
  page: Page,
  proyek: string,
  nama: string,
): Promise<{ overflowPx: number; tombolTerkecilPx: number | null }> {
  const dir = path.join(DIR_SCREENSHOT, proyek);
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(600);
  const ukur = await ukurTataLetak(page);
  await page.screenshot({ path: path.join(dir, `${nama}.png`) });
  return ukur;
}

test.describe('Tamu — landing, masuk, pengaman rute', () => {
  test('landing menampilkan nama produk dan tombol utama', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /dokter hp/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /coba tes wifi tanpa akun/i }),
    ).toBeVisible();
  });

  test('halaman masuk menampilkan tombol Masuk dengan Google', async ({
    page,
  }) => {
    await page.goto('/masuk');
    // Tombol masuk adalah tautan <a> ke endpoint API (bukan <button>).
    await expect(
      page.getByRole('link', { name: /masuk dengan google/i }),
    ).toBeVisible();
  });

  test('tombol Masuk dengan Google memanggil endpoint /api/auth/google', async ({
    page,
  }) => {
    await page.goto('/masuk');
    // URL memuat query ?redirect=... sehingga pola tidak memakai $.
    const janji = page.waitForRequest(/\/api\/auth\/google\?/);
    await page.getByRole('link', { name: /masuk dengan google/i }).click();
    const req = await janji;
    expect(req.url()).toContain('/api/auth/google?redirect=');
    // Navigasi ke Google terjadi setelah redirect 302; tidak diikuti
    // di sini (alur OAuth live adalah checklist manual M1).
  });

  test('dashboard tanpa login mengarah ke halaman masuk', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/masuk/);
  });

  test('riwayat tanpa login mengarah ke halaman masuk', async ({ page }) => {
    await page.goto('/riwayat');
    await expect(page).toHaveURL(/\/masuk/);
  });
});

test.describe('Tamu — Dokter WiFi (tanpa akun)', () => {
  test('tes WiFi tamu berjalan dan menampilkan hasil', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/wifi');
    await expect(
      page.getByRole('heading', { name: /dokter wifi/i }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: /periksa wifi sekarang/i })
      .click();
    // Hasil: kecepatan unduh tampil (tanpa asersi nilai mutlak).
    await expect(page.getByText(/kecepatan unduh/i).first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText(/latensi http/i).first()).toBeVisible();
  });
});

test.describe('Masuk — dashboard dan dokter (pengguna A, ada data)', () => {
  test.skip(!token, 'Berkas token sesi uji (hidden_files/qa-wave4/scratch/tokens.json) tidak ada.');

  test('cookie sesi lintas-situs terkirim: /api/auth/me 200 dari origin preview', async ({
    browser,
  }) => {
    // T-30: frontend (4174) memanggil API (8787) lintas origin.
    const konteks = await konteksMasuk(browser, token!.tokenA, 'desktop');
    const page = await konteks.newPage();
    const janji = page.waitForResponse(
      (r) => r.url().includes('/api/auth/me') && r.request().method() === 'GET',
    );
    await page.goto('/dashboard');
    const respons = await janji;
    expect(respons.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /^dashboard$/i }),
    ).toBeVisible({ timeout: 15_000 });
    await konteks.close();
  });

  test('dashboard menampilkan skor dari data uji', async ({ browser }) => {
    const konteks = await konteksMasuk(browser, token!.tokenA, 'desktop');
    const page = await konteks.newPage();
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: /^dashboard$/i }),
    ).toBeVisible({ timeout: 15_000 });
    // Skor terakhir data uji adalah 68 (kategori cukup, ambang 80/50).
    await expect(page.getByText(/68/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/cukup/i).first()).toBeVisible();
    await konteks.close();
  });

  test('diagnosis satu ketuk menjawab lewat fallback aturan (tanpa kunci Gemini)', async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const konteks = await konteksMasuk(browser, token!.tokenA, 'desktop');
    const page = await konteks.newPage();
    await page.goto('/dashboard');
    await page
      .getByRole('button', { name: /diagnosis satu ketuk/i })
      .click();
    await expect(page.getByText(/saran dari ai/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/bukan dari ai/i).first()).toBeVisible();
    await konteks.close();
  });

  test('halaman AI menjawab pertanyaan lewat fallback aturan', async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const konteks = await konteksMasuk(browser, token!.tokenA, 'desktop');
    const page = await konteks.newPage();
    await page.goto('/ai');
    await expect(
      page.getByRole('heading', { name: /diagnosis ai/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    const kolom = page.locator('#pertanyaan-ai');
    await kolom.fill('WiFi saya lemot, apa yang harus dicek?');
    await page.getByRole('button', { name: /^kirim$/i }).click();
    await expect(page.getByText(/bukan dari ai/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await konteks.close();
  });

  test('riwayat menampilkan entri data uji', async ({ browser }) => {
    const konteks = await konteksMasuk(browser, token!.tokenA, 'desktop');
    const page = await konteks.newPage();
    await page.goto('/riwayat');
    await expect(
      page.getByRole('heading', { name: /^riwayat$/i }),
    ).toBeVisible({ timeout: 15_000 });
    // Laporan WiFi uji (SSID WiFi-Uji-QA) tampil di daftar.
    await expect(page.getByText(/wifi-uji-qa/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await konteks.close();
  });

  test('pengaturan menampilkan profil dan daftar sesi', async ({ browser }) => {
    const konteks = await konteksMasuk(browser, token!.tokenA, 'desktop');
    const page = await konteks.newPage();
    await page.goto('/pengaturan');
    await expect(
      page.getByRole('heading', { name: /pengaturan akun/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/tes\+qa-a@dokter-hp\.local/i)).toBeVisible({
      timeout: 10_000,
    });
    await konteks.close();
  });
});

test.describe('Masuk — empty state (pengguna B, tanpa data)', () => {
  test.skip(!token, 'Berkas token sesi uji (hidden_files/qa-wave4/scratch/tokens.json) tidak ada.');

  test('dashboard akun baru menampilkan empty state jujur', async ({
    browser,
  }) => {
    const konteks = await konteksMasuk(browser, token!.tokenB, 'desktop');
    const page = await konteks.newPage();
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: /^dashboard$/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/belum ada pemeriksaan/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await konteks.close();
  });
});

test.describe.serial('PIN — sesi terkunci (pengguna B, sesi B2 per proyek)', () => {
  test.skip(!token, 'Berkas token sesi uji (hidden_files/qa-wave4/scratch/tokens.json) tidak ada.');

  test('sesi terkunci: dashboard mengarah ke /kunci', async ({ browser }, info) => {
    const konteks = await konteksMasuk(browser, tokenTerkunci(info.project.name), info.project.name);
    const page = await konteks.newPage();
    await page.goto('/dashboard');
    // Pemeriksaan /auth/me + redirect bisa lambat saat banyak worker
    // paralel berjalan di VM yang sama; beri waktu 15 detik.
    await expect(page).toHaveURL(/\/kunci/, { timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /angka 1/i }),
    ).toBeVisible({ timeout: 15_000 });
    await konteks.close();
  });

  test('PIN benar membuka kunci dan menampilkan dashboard', async ({
    browser,
  }, info) => {
    test.setTimeout(60_000);
    // Dijalankan SETELAH tes di atas (describe serial): setelah PIN
    // benar dimasukkan, sesi terkunci proyek ini tidak terkunci lagi.
    const konteks = await konteksMasuk(browser, tokenTerkunci(info.project.name), info.project.name);
    const page = await konteks.newPage();
    await page.goto('/kunci');
    for (const angka of ['4', '8', '2', '9', '1', '7']) {
      await page.getByRole('button', { name: `Angka ${angka}`, exact: true }).click();
    }
    // Keypad hanya mengisi digit; pengiriman memakai tombol "Buka".
    await page.getByRole('button', { name: /^buka$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    // Dashboard memuat ulang status sesi + data; beri waktu lebih lama.
    await expect(
      page.getByRole('heading', { name: /^dashboard$/i }),
    ).toBeVisible({ timeout: 15_000 });
    await konteks.close();
  });
});

test.describe('Speedtest — file tidak di-cache service worker (T-40)', () => {
  test('unduhan /speedtest-1mb.bin tidak masuk Cache Storage', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    // Cek kesiapan SW dengan percobaan ulang: muat ulang controllerchange
    // dari aplikasi bisa menghancurkan konteks evaluate di tengah jalan
    // (galat "Execution context was destroyed") — satu percobaan gagal
    // belum berarti SW tidak aktif.
    let swSiap = false;
    for (let percobaan = 0; percobaan < 4 && !swSiap; percobaan++) {
      swSiap = await page
        .evaluate(async () => {
          if (!('serviceWorker' in navigator)) return false;
          try {
            await Promise.race([
              navigator.serviceWorker.ready,
              new Promise((_, tolak) =>
                setTimeout(() => tolak(new Error('batas waktu')), 10_000),
              ),
            ]);
            return true;
          } catch {
            return false;
          }
        })
        .catch(() => false);
      if (!swSiap) {
        await page.waitForTimeout(2000).catch(() => undefined);
      }
    }
    test.skip(!swSiap, 'Service worker tidak aktif di browser ini.');
    // Halaman pertama belum dikendalikan SW (kontrol aktif setelah
    // muat ulang). Aplikasi sendiri memuat ulang saat controllerchange
    // (main.tsx), yang bisa beradu dengan navigasi tes — jadi: tunggu
    // muat ulang aplikasi reda, lalu periksa controller; bila belum
    // ada, coba satu navigasi ulang dengan toleransi interupsi.
    const tungguController = async (detik: number): Promise<boolean> =>
      page
        .evaluate(async (batasMs) => {
          const akhir = Date.now() + batasMs;
          while (Date.now() < akhir) {
            if (navigator.serviceWorker.controller) return true;
            await new Promise((r) => setTimeout(r, 250));
          }
          return Boolean(navigator.serviceWorker.controller);
        }, detik * 1000)
        .catch(() => false);
    await page.waitForTimeout(2000);
    await page.waitForLoadState('load').catch(() => undefined);
    let dikendalikan = await tungguController(5);
    if (!dikendalikan) {
      await page.goto('/', { waitUntil: 'load' }).catch(() => undefined);
      await page.waitForTimeout(1000);
      dikendalikan = await tungguController(10);
    }
    test.skip(
      !dikendalikan,
      'Halaman tidak dikendalikan service worker setelah navigasi ulang.',
    );
    const hasil = await page.evaluate(async () => {
      const unduh = async () => {
        const r = await fetch('/speedtest-1mb.bin', { cache: 'no-store' });
        const b = await r.arrayBuffer();
        return b.byteLength;
      };
      const ukuran1 = await unduh();
      const ukuran2 = await unduh();
      const kunci = await caches.keys();
      let tersimpan = false;
      for (const nama of kunci) {
        const cache = await caches.open(nama);
        const cocok = await cache.match('/speedtest-1mb.bin');
        if (cocok) tersimpan = true;
      }
      return { ukuran1, ukuran2, kunci, tersimpan };
    });
    expect(hasil.ukuran1).toBe(1_048_576);
    expect(hasil.ukuran2).toBe(1_048_576);
    expect(hasil.tersimpan).toBe(false);
  });
});

test.describe('Screenshot — semua layar utama', () => {
  test.skip(!token, 'Berkas token sesi uji (hidden_files/qa-wave4/scratch/tokens.json) tidak ada.');

  const LAYAR_TAMU: Array<{ nama: string; rute: string; tunggu: RegExp }> = [
    { nama: 'landing', rute: '/', tunggu: /dokter hp/i },
    { nama: 'masuk', rute: '/masuk', tunggu: /^masuk$/i },
    { nama: 'wifi', rute: '/wifi', tunggu: /dokter wifi/i },
  ];
  const LAYAR_A: Array<{ nama: string; rute: string; tunggu: RegExp }> = [
    { nama: 'dashboard', rute: '/dashboard', tunggu: /^dashboard$/i },
    { nama: 'baterai', rute: '/baterai', tunggu: /baterai/i },
    { nama: 'penyimpanan', rute: '/penyimpanan', tunggu: /penyimpanan/i },
    { nama: 'performa', rute: '/performa', tunggu: /performa/i },
    { nama: 'keamanan', rute: '/keamanan', tunggu: /keamanan/i },
    { nama: 'riwayat', rute: '/riwayat', tunggu: /^riwayat$/i },
    { nama: 'ai', rute: '/ai', tunggu: /diagnosis ai/i },
    { nama: 'pengaturan', rute: '/pengaturan', tunggu: /pengaturan akun/i },
  ];

  for (const layar of LAYAR_TAMU) {
    test(`screenshot tamu: ${layar.nama}`, async ({ page }, info) => {
      await page.goto(layar.rute);
      await expect(page.getByRole('heading', { name: layar.tunggu }).first()).toBeVisible({
        timeout: 15_000,
      });
      const ukur = await screenshotLayar(page, info.project.name, layar.nama);
      expect(ukur.overflowPx, `overflow horizontal ${layar.nama}`).toBe(0);
    });
  }

  for (const layar of LAYAR_A) {
    test(`screenshot masuk (A): ${layar.nama}`, async ({ browser }, info) => {
      const konteks = await konteksMasuk(browser, token!.tokenA, info.project.name);
      const page = await konteks.newPage();
      await page.goto(layar.rute);
      await expect(page.getByRole('heading', { name: layar.tunggu }).first()).toBeVisible({
        timeout: 15_000,
      });
      const ukur = await screenshotLayar(page, info.project.name, layar.nama);
      expect(ukur.overflowPx, `overflow horizontal ${layar.nama}`).toBe(0);
      await konteks.close();
    });
  }

  test('screenshot masuk (B): dashboard kosong', async ({ browser }, info) => {
    const konteks = await konteksMasuk(browser, token!.tokenB, info.project.name);
    const page = await konteks.newPage();
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /^dashboard$/i })).toBeVisible({
      timeout: 15_000,
    });
    const ukur = await screenshotLayar(page, info.project.name, 'dashboard-kosong');
    expect(ukur.overflowPx, 'overflow horizontal dashboard-kosong').toBe(0);
    await konteks.close();
  });

  test('screenshot terkunci (B3): kunci PIN', async ({ browser }, info) => {
    // Sesi B3 (terkunci) khusus screenshot — terpisah dari B2 yang
    // dipakai tes buka kunci, agar urutan paralel tidak memengaruhi.
    const konteks = await konteksMasuk(browser, token!.tokenB3, info.project.name);
    const page = await konteks.newPage();
    await page.goto('/kunci');
    await expect(page.getByRole('button', { name: /angka 1/i })).toBeVisible({
      timeout: 15_000,
    });
    const ukur = await screenshotLayar(page, info.project.name, 'kunci-pin');
    expect(ukur.overflowPx, 'overflow horizontal kunci-pin').toBe(0);
    await konteks.close();
  });
});
