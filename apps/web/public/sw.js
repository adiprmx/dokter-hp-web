/**
 * Dokter HP — Service Worker
 *
 * Peran service worker ini:
 * 1. Membuat aplikasi bisa dipasang ke layar utama HP (installable PWA).
 * 2. Menyimpan shell aplikasi (HTML, JS, CSS, logo) agar aplikasi
 *    terbuka cepat dan tetap bisa menampilkan halaman offline yang jujur
 *    saat tidak ada koneksi.
 * 3. TIDAK PERNAH menyimpan data API sebagai data palsu: semua respons
 *    API selalu diambil dari jaringan. Bila jaringan tidak tersedia,
 *    permintaan API gagal dengan jelas (HTTP 503 + pesan offline),
 *    sehingga aplikasi menampilkan kondisi galatnya sendiri, bukan
 *    data lama yang disajikan seolah-olah data baru.
 * 4. TIDAK PERNAH menyimpan file tes kecepatan (/speedtest-1mb.bin):
 *    file itu adalah alat ukur — bila tersimpan di cache, hasil tes
 *    kecepatan menjadi tidak valid.
 *
 * File ini disajikan dari root (public/sw.js -> /sw.js) agar cakupannya
 * (scope) meliputi seluruh aplikasi (/).
 *
 * Pendaftaran dilakukan dari main.tsx (milik tim frontend) — lihat
 * instruksi lengkap di docs/pwa.md bagian 7.
 */

// Naikkan versi ini setiap kali shell aplikasi berubah. Versi baru
// membuat cache lama dihapus pada event activate.
const SW_VERSION = 'v1.0.0';
const CACHE_SHELL = `dokter-hp-shell-${SW_VERSION}`;
const CACHE_STATIC = `dokter-hp-static-${SW_VERSION}`;

// Shell aplikasi: file dengan nama yang stabil (tidak berubah setiap
// build). Aset hasil build Vite yang namanya mengandung hash (misal
// /assets/index-abc123.js) tidak bisa dicantumkan di sini karena
// namanya berubah setiap rilis — aset-aset itu disimpan lewat strategi
// cache-first pada saat pertama kali diminta (lihat onFetch).
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.svg',
];

// File tes kecepatan: alat ukur, tidak boleh di-cache.
const SPEEDTEST_PATH = '/speedtest-1mb.bin';

// Awalan path API bila API diproksi lewat origin yang sama.
// API utama (Worker) berada di origin berbeda (VITE_API_BASE_URL);
// permintaan lintas origin juga tidak pernah di-cache (lihat onFetch).
const API_PATH_PREFIX = '/api/';

// ---------------------------------------------------------------------------
// Install: simpan shell aplikasi ke cache, lalu tunggu.
// Service worker baru TIDAK langsung mengambil alih: ia menunggu sampai
// pengguna menutup semua tab lama, atau sampai aplikasi mengirim pesan
// SKIP_WAITING setelah pengguna menyetujui pembaruan (lihat docs/pwa.md
// bagian 6, Alur pembaruan).
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        // Gagal precache bukan alasan menggagalkan seluruh install:
        // aset yang gagal akan diambil dari jaringan saat dibutuhkan.
        // Catatan ini hanya terlihat di konsol pengembang, bukan ke pengguna.
        console.warn('[Dokter HP SW] Gagal menyimpan shell:', error);
      }),
  );
});

// ---------------------------------------------------------------------------
// Activate: hapus cache dari versi lama, lalu ambil alih semua tab yang
// terbuka agar versi baru langsung berlaku setelah pembaruan disetujui.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('dokter-hp-') &&
                key !== CACHE_SHELL &&
                key !== CACHE_STATIC,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------------------------------------------------------------------------
// Pesan dari aplikasi: 'SKIP_WAITING' membuat service worker baru yang
// sedang menunggu langsung aktif (dipakai alur pembaruan di docs/pwa.md).
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Fetch: strategi per jenis permintaan.
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Hanya permintaan GET yang ditangani. POST/PUT/DELETE (masuk, simpan
  // PIN, kirim diagnosis AI, dan sebagainya) selalu langsung ke jaringan.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Abaikan permintaan ke skema non-http(s) (misal chrome-extension).
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 1) File tes kecepatan: selalu jaringan, tidak pernah cache.
  //    Meng-cache file ini akan membuat tes kecepatan mengukur cache
  //    lokal, bukan koneksi internet pengguna.
  if (url.pathname === SPEEDTEST_PATH) {
    return;
  }

  // 2) API: selalu jaringan, tidak pernah cache.
  //    Mencakup /api/* di origin yang sama DAN semua permintaan ke origin
  //    lain (Worker API berada di origin berbeda). Respons API yang
  //    di-cache berisiko tampil sebagai data palsu (skor lama, riwayat
  //    lama). Bila jaringan gagal, kembalikan galat 503 yang jujur
  //    dengan format envelope yang sama seperti API, agar aplikasi
  //    menampilkan kondisi galatnya sendiri.
  const isSameOriginApi =
    url.origin === self.location.origin &&
    url.pathname.startsWith(API_PATH_PREFIX);
  const isCrossOrigin = url.origin !== self.location.origin;
  if (isSameOriginApi || isCrossOrigin) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'OFFLINE',
                message:
                  'Tidak tersambung ke server. Periksa koneksi internet Anda, lalu coba lagi.',
              },
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
      ),
    );
    return;
  }

  // 3) Navigasi (pengguna membuka/memuati ulang halaman):
  //    network-first. Bila jaringan tersedia, selalu tampilkan versi
  //    terbaru. Bila jaringan gagal, tampilkan halaman offline khusus
  //    (bukan shell aplikasi kosong dan bukan data lama).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => offlinePageResponse()),
    );
    return;
  }

  // 4) Aset statis origin yang sama (JS/CSS/gambar/font hasil build):
  //    cache-first. Aset Vite memakai nama ber-hash sehingga isinya
  //    tidak berubah; aman disimpan dan dipakai ulang. Bila belum ada
  //    di cache, ambil dari jaringan lalu simpan salinannya.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request)
        .then((response) => {
          // Hanya simpan respons yang berhasil (200) dan bertipe basic
          // (respons origin yang sama, bukan opaque).
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches
              .open(CACHE_STATIC)
              .then((cache) => cache.put(request, copy))
              .catch(() => {
                // Gagal menyimpan cache bukan galat bagi pengguna.
              });
          }
          return response;
        })
        .catch(() => {
          // Aset gagal dimuat saat offline dan belum ada di cache:
          // kembalikan respons kosong 504 agar halaman tetap bisa
          // menampilkan pesan galatnya sendiri, bukan menggantung.
          return new Response('', { status: 504 });
        });
    }),
  );
});

// ---------------------------------------------------------------------------
// Halaman offline: HTML mandiri (tanpa aset eksternal kecuali logo yang
// sudah di-precache). Pesan jujur: tidak ada data yang ditampilkan,
// karena semua data berasal dari server dan server tidak terjangkau.
// ---------------------------------------------------------------------------
function offlinePageResponse() {
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#000000">
<title>Offline — Dokter HP</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #000000; color: #f4f4f5;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    min-height: 100vh; min-height: 100dvh;
    display: flex; align-items: center; justify-content: center;
    padding: 24px; text-align: center;
  }
  main { max-width: 360px; width: 100%; }
  img { width: 72px; height: 72px; margin-bottom: 24px; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
  p { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 8px; }
  p:last-of-type { margin-bottom: 24px; }
  button {
    min-height: 44px; width: 100%;
    background: #ffffff; color: #000000; border: none; border-radius: 8px;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  button:active { transform: scale(0.98); }
</style>
</head>
<body>
<main>
  <img src="/logo.svg" alt="Dokter HP">
  <h1>Anda sedang offline</h1>
  <p>Dokter HP tidak dapat tersambung ke internet saat ini.</p>
  <p>Tes WiFi, skor, dan riwayat membutuhkan koneksi internet karena datanya berasal dari server. Tidak ada data yang ditampilkan di sini agar tidak menyesatkan.</p>
  <button type="button" onclick="location.reload()">Coba lagi</button>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
