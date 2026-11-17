# PWA — Dokter HP Web App

> **Rencana Progressive Web App (PWA) Dokter HP.**
> Status: Fase 1 — dokumen + kerangka service worker, 17 November 2026.
> Bahasa: Bahasa Indonesia.
>
> Owner hanya memakai HP. Aplikasi web ini harus bisa dipasang ke layar
> utama HP (installable PWA) dan, bila sedang offline, menampilkan pesan
> offline yang jelas — bukan data palsu.
>
> File yang dimiliki rencana ini:
>
> | File | Isi |
> |---|---|
> | `apps/web/public/manifest.webmanifest` | Manifest PWA (nama, tampilan, ikon) |
> | `apps/web/public/sw.js` | Service worker (cache shell, API network-only, halaman offline) |
> | `docs/pwa.md` | Dokumen ini |
>
> **Batasan kepemilikan:** `index.html` dan `main.tsx` milik tim lain dan
> tidak diubah di sini. Instruksi yang perlu ditambahkan tim frontend ke
> kedua file itu ada di bagian 7 dan 8 dokumen ini.

---

## 1. Tujuan

1. Aplikasi bisa dipasang ke layar utama HP Android lewat prompt
   "Pasang aplikasi" di Chrome (dan browser berbasis Chromium lainnya),
   lalu terbuka sebagai aplikasi mandiri (tanpa bilah alamat browser).
2. Aplikasi terbuka cepat pada kunjungan berikutnya karena shell
   aplikasi (HTML, JS, CSS, logo) tersimpan di cache.
3. Bila offline, pengguna melihat halaman offline khusus yang jujur:
   tidak ada skor, riwayat, atau hasil tes yang ditampilkan, karena
   semua data berasal dari server.
4. Tidak ada data API yang pernah disimpan di cache dan disajikan
   kembali sebagai data baru. Prinsip ini mengikuti PRODUCT.md
   bagian 8 (Prinsip kejujuran data).

## 2. Manifest

File: `apps/web/public/manifest.webmanifest`.

| Kunci | Nilai | Alasan |
|---|---|---|
| `name` | `Dokter HP` | Nama lengkap produk |
| `short_name` | `Dokter HP` | Nama di layar utama HP |
| `id` | `/` | Pengenal aplikasi yang stabil |
| `start_url` | `/` | Aplikasi selalu mulai dari landing |
| `scope` | `/` | Seluruh rute aplikasi tercakup |
| `display` | `standalone` | Terbuka tanpa bilah alamat browser |
| `orientation` | `portrait` | Phone-first; pengguna memakai HP tegak |
| `theme_color` | `#000000` | Hitam, sesuai tema produk |
| `background_color` | `#000000` | Hitam; warna latar saat aplikasi dibuka (splash) |
| `lang` | `id` | Bahasa Indonesia |
| `dir` | `ltr` | Arah baca kiri ke kanan |
| `categories` | `["utilities"]` | Kategori utilitas |
| `icons` | Logo SVG (`/logo.svg`) | Lihat bagian 3 — ikon PNG masih utang tim brand |

### 2.1 Cara kerja manifest

- Manifest disajikan sebagai file statis dari `public/` sehingga
  tersedia di `/manifest.webmanifest` pada kedua mirror (Cloudflare
  Pages dan Vercel) tanpa perubahan kode.
- Tim frontend menambahkan tautan ke manifest di `index.html`
  (lihat bagian 7).

## 3. Ikon — utang tim brand

Manifest saat ini hanya merujuk `/logo.svg` (logo yang sudah ada).
Logo SVG cukup untuk menampilkan ikon di beberapa tempat, tetapi
**belum cukup untuk kriteria installable Chrome** (lihat bagian 5):
Chrome membutuhkan ikon raster (PNG) dengan ukuran minimal 192×192
dan 512×512 piksel.

**Yang masih perlu dibuat tim brand** (disimpan di
`apps/web/public/icons/`):

| File | Ukuran | Kegunaan |
|---|---|---|
| `icons/icon-192.png` | 192×192 | Ikon layar utama (ukuran minimum Chrome) |
| `icons/icon-512.png` | 512×512 | Ikon layar utama (ukuran penuh) + splash screen |
| `icons/icon-maskable-512.png` | 512×512 | Ikon maskable — logo dengan latar penuh dan zona aman, agar tidak terpotong oleh bentuk ikon Android (lingkaran, squarcle) |
| `icons/apple-touch-icon-180.png` | 180×180 | Ikon layar utama iOS/Safari (bukan bagian manifest; dirujuk dari `index.html`) |
| `icons/favicon-48.png` | 48×48 | Favicon tab browser (bila diperlukan selain logo SVG) |

Setelah ketiga ikon PNG pertama tersedia, tambahkan entri berikut ke
array `icons` di manifest (di bawah entri SVG yang sudah ada):

```json
{
  "src": "/icons/icon-192.png",
  "sizes": "192x192",
  "type": "image/png",
  "purpose": "any"
},
{
  "src": "/icons/icon-512.png",
  "sizes": "512x512",
  "type": "image/png",
  "purpose": "any"
},
{
  "src": "/icons/icon-maskable-512.png",
  "sizes": "512x512",
  "type": "image/png",
  "purpose": "maskable"
}
```

Catatan: jangan memakai ikon hasil perbesaran (upscale) dari gambar
kecil — ikon 512×512 harus dibuat dari sumber resolusi penuh agar
tidak pecah di layar HP.

## 4. Service worker — strategi cache

File: `apps/web/public/sw.js`. Disajikan dari root (`/sw.js`) agar
cakupannya meliputi seluruh aplikasi.

### 4.1 Ringkasan strategi

| Jenis permintaan | Strategi | Alasan |
|---|---|---|
| Shell aplikasi saat install (`/`, `/index.html`, `/manifest.webmanifest`, `/logo.svg`) | Precached (disimpan saat install) | Nama file stabil; aplikasi bisa menampilkan halaman offline dan terbuka cepat |
| Navigasi (membuka/memuati ulang halaman) | Network-first, fallback halaman offline | Selalu tampilkan versi terbaru bila ada koneksi; bila tidak ada, tampilkan halaman offline khusus |
| Aset statis origin yang sama (JS/CSS/gambar/font hasil build Vite) | Cache-first | Nama file mengandung hash sehingga isinya tidak berubah; aman dipakai ulang |
| API (`/api/*` di origin yang sama, dan semua permintaan ke origin lain termasuk Worker API) | Network-only, tidak pernah di-cache | Respons API yang di-cache bisa tampil sebagai data palsu (skor lama, riwayat lama). Bila offline, service worker mengembalikan galat HTTP 503 dengan pesan offline yang jujur |
| File tes kecepatan (`/speedtest-1mb.bin`) | Network-only, tidak pernah di-cache | File ini alat ukur — bila tersimpan di cache, tes kecepatan mengukur cache lokal, bukan koneksi internet |
| Permintaan non-GET (POST/PUT/DELETE) | Tidak ditangani service worker | Selalu langsung ke jaringan; tidak ada penulisan data yang di-cache |

### 4.2 Yang disimpan dan yang tidak disimpan

**Disimpan di cache (aman, bukan data pengguna):**

- Shell aplikasi dan aset statis hasil build (JS, CSS, logo).
- Cache diberi nama berversi (`dokter-hp-shell-v1.0.0`,
  `dokter-hp-static-v1.0.0`); cache versi lama dihapus otomatis
  saat service worker baru aktif.

**Tidak pernah disimpan di cache:**

- Respons API apa pun (skor, riwayat, profil, diagnosis AI, sesi).
- File tes kecepatan.
- Token sesi, PIN, atau kredensial dalam bentuk apa pun.
- Data pengguna tidak pernah ditulis service worker ke cache
  maupun ke penyimpanan lain.

### 4.3 Penomoran versi

- Konstanta `SW_VERSION` di bagian atas `sw.js` adalah versi
  service worker. Naikkan versinya (misal `v1.0.0` → `v1.1.0`)
  setiap kali shell aplikasi berubah secara bermakna.
- Versi baru membuat nama cache berubah, sehingga cache lama
  dihapus pada event `activate` dan pengguna tidak terjebak di
  shell lama.

## 5. Halaman offline khusus

- Bila pengguna membuka aplikasi (navigasi) tanpa koneksi internet,
  service worker menampilkan halaman offline yang dibuat di dalam
  `sw.js` sendiri (HTML mandiri, tanpa aset eksternal kecuali logo
  yang sudah di-precache).
- Isi halaman: judul "Anda sedang offline", penjelasan bahwa tes
  WiFi, skor, dan riwayat membutuhkan koneksi internet karena
  datanya berasal dari server, dan tombol **Coba lagi** yang
  memuat ulang halaman.
- Halaman ini sengaja tidak menampilkan data apa pun — menampilkan
  skor atau riwayat lama saat offline akan menyesatkan pengguna.
- Tampilan mengikuti tema produk: latar hitam, teks putih/abu,
  tombol putih, area sentuh minimal 44 px.
- Bila di kemudian hari tim frontend membuat halaman offline
  tersendiri sebagai file (`/offline.html`), service worker dapat
  diubah agar menyajikan file itu sebagai pengganti HTML mandiri —
  tetapi file tersebut harus ditambahkan ke daftar precache agar
  tersedia saat offline.

## 6. Kriteria installable dan checklist

Kriteria installable Chrome (Android) — kondisi yang harus terpenuhi
agar prompt "Pasang aplikasi" muncul:

| # | Kriteria | Status |
|---|---|---|
| 1 | Disajikan lewat HTTPS | ✅ Terpenuhi — Cloudflare Pages dan Vercel memakai HTTPS |
| 2 | Memiliki manifest web yang valid dengan `name`/`short_name`, `start_url`, `display` (standalone/fullscreen/minimal-ui) | ✅ Terpenuhi — `manifest.webmanifest` sudah ditulis (bagian 2) |
| 3 | Manifest memiliki ikon 192×192 dan 512×512 (PNG) | ⏳ **Menunggu tim brand** — baru tersedia logo SVG (lihat bagian 3) |
| 4 | Memiliki service worker terdaftar dengan event handler `fetch` | ✅ Terpenuhi — `sw.js` sudah ditulis; pendaftaran oleh tim frontend (bagian 8) |
| 5 | Halaman memiliki `<meta name="theme-color">` dan tautan manifest di `index.html` | ⏳ **Menunggu tim frontend** — `index.html` milik tim lain (lihat bagian 7) |
| 6 | Pengguna sudah berinteraksi dengan situs (kriteria engagement Chrome) | ℹ️ Otomatis — terpenuhi setelah pengguna memakai situs |

**Status keseluruhan:** installable penuh menunggu dua hal di luar
tim ini — ikon PNG dari tim brand (bagian 3) dan penambahan tautan
manifest + pendaftaran service worker oleh tim frontend (bagian 7–8).
Semua bagian yang menjadi tanggung jawab tim PWA sudah selesai.

## 7. Yang perlu ditambahkan tim frontend ke `index.html`

Tambahkan di dalam `<head>` (file milik tim lain — jangan diubah
oleh tim PWA):

```html
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#000000">
<!-- Ikon layar utama iOS (setelah tim brand membuat file-nya): -->
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
<!-- Agar aplikasi terpasang di iOS terbuka tanpa bilah Safari: -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
```

## 8. Instruksi pendaftaran service worker (untuk `main.tsx`)

Tim frontend menambahkan pendaftaran berikut di `main.tsx`
(setelah render aplikasi; file milik tim lain — jangan diubah
oleh tim PWA):

```ts
// Daftarkan service worker hanya di build produksi, bukan saat
// pengembangan (vite dev), agar cache tidak mengganggu proses dev.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Pantau pembaruan: bila ada service worker baru yang menunggu,
        // beri tahu pengguna lewat banner "Versi baru tersedia".
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Ada versi baru yang menunggu. Tampilkan banner/tombol
              // "Perbarui" di aplikasi; saat pengguna mengetuknya,
              // jalankan blok di bawah ini:
              //
              //   newWorker.postMessage({ type: 'SKIP_WAITING' });
              //
              // Lalu muat ulang halaman setelah service worker baru
              // mengambil alih (lihat listener controllerchange di bawah).
              window.dispatchEvent(
                new CustomEvent('dokter-hp:update-tersedia'),
              );
            }
          });
        });
      })
      .catch((error) => {
        // Gagal mendaftar bukan galat bagi pengguna: aplikasi tetap
        // berfungsi penuh sebagai situs web biasa, hanya tanpa PWA.
        console.warn('Service worker gagal didaftarkan:', error);
      });

    // Muat ulang sekali setelah service worker baru mengambil alih,
    // agar pengguna langsung memakai versi terbaru.
    let sudahDimuatUlang = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!sudahDimuatUlang) {
        sudahDimuatUlang = true;
        window.location.reload();
      }
    });
  });
}
```

Catatan:

- Pendaftaran memakai path `/sw.js` (root) agar scope service
  worker meliputi seluruh aplikasi (`/`).
- Pendaftaran hanya di build produksi: di mode pengembangan Vite,
  service worker bisa menyajikan file lama dan membingungkan proses
  pengembangan.
- Bila pendaftaran gagal (misal browser lama), aplikasi tetap
  berfungsi sebagai situs web biasa — PWA adalah peningkatan,
  bukan syarat.

## 9. Alur pembaruan (update flow)

1. Tim merilis versi baru: naikkan `SW_VERSION` di `sw.js` bila
   shell berubah, lalu deploy seperti biasa (push ke main →
   Pages/Vercel membangun ulang).
2. Saat pengguna membuka aplikasi, browser mengunduh `sw.js` baru
   di latar belakang dan memasangnya. Service worker baru berstatus
   **menunggu** — versi lama tetap melayani tab yang sedang terbuka,
   agar sesi pengguna tidak terputus di tengah jalan.
3. Aplikasi mendeteksi service worker yang menunggu (bagian 8) dan
   menampilkan banner "Versi baru tersedia" dengan tombol
   **Perbarui**. Pengguna memutuskan sendiri kapan memperbarui.
4. Saat pengguna mengetuk **Perbarui**, aplikasi mengirim pesan
   `SKIP_WAITING` ke service worker baru; service worker baru
   aktif, menghapus cache versi lama, mengambil alih semua tab,
   dan halaman dimuat ulang sekali ke versi terbaru.
5. Bila pengguna tidak pernah mengetuk **Perbarui**, versi baru
   tetap aktif sendiri saat semua tab aplikasi ditutup lalu dibuka
   kembali (perilaku standar service worker).

## 10. Pengujian

Pengujian yang harus dilakukan sebelum menyatakan PWA selesai:

| # | Pengujian | Cara | Hasil yang diharapkan |
|---|---|---|---|
| 1 | Manifest valid | Chrome DevTools → Application → Manifest | Manifest terbaca, tanpa galat; nama, ikon, dan warna tampil |
| 2 | Service worker terdaftar | Chrome DevTools → Application → Service Workers | Status "activated and is running", scope `/` |
| 3 | Prompt pasang muncul | Buka situs di Chrome Android (setelah ikon PNG tersedia) | Prompt "Pasang aplikasi" muncul; aplikasi terpasang di layar utama |
| 4 | Terbuka standalone | Ketuk ikon di layar utama | Terbuka tanpa bilah alamat browser; splash hitam tampil |
| 5 | Offline — navigasi | DevTools → Network → Offline, lalu muat ulang | Halaman offline khusus tampil dengan tombol "Coba lagi" |
| 6 | Offline — API tidak di-cache | Offline, lalu buka dashboard/riwayat (bila shell termuat) | Aplikasi menampilkan pesan galat/kondisi tidak tersambung, bukan data lama |
| 7 | Tes kecepatan tidak di-cache | Jalankan tes kecepatan dua kali; periksa DevTools → Network | `/speedtest-1mb.bin` selalu berstatus 200 dari jaringan, bukan "(from ServiceWorker)" |
| 8 | Pembaruan | Ubah `SW_VERSION`, deploy, buka ulang aplikasi | Banner "Versi baru tersedia" muncul; setelah Perbarui, versi baru aktif dan cache lama hilang |
| 9 | Audit Lighthouse | Chrome DevTools → Lighthouse → kategori PWA | Semua pemeriksaan PWA lolos (setelah ikon PNG tersedia) |
| 10 | Kedua mirror | Ulangi pengujian 1–5 di mirror Vercel | Perilaku sama seperti di Pages |

## 11. Batasan yang jujur

- **iOS/Safari:** Safari tidak mendukung prompt pasang otomatis dan
  tidak memakai manifest Chrome. Pengguna iOS memasang aplikasi
  secara manual lewat menu Bagikan → "Tambahkan ke Layar Utama".
  Ikon dan tampilan standalone iOS didukung lewat
  `apple-touch-icon` dan meta tag di bagian 7. Service worker di
  iOS didukung sejak iOS 11.3, tetapi penyimpanan cache iOS lebih
  agresif dibersihkan sistem bila perangkat kehabisan ruang.
- **Offline bukan mode penuh:** aplikasi web ini tidak dirancang
  untuk dipakai penuh saat offline — data berasal dari server.
  Yang dijanjikan saat offline hanyalah halaman offline yang jujur,
  bukan fitur yang berjalan tanpa internet.
- **Prompt pasang tidak bisa dipaksa:** Chrome menampilkan prompt
  setelah kriteria installable terpenuhi dan pengguna sudah
  berinteraksi dengan situs. Aplikasi tidak menampilkan tombol
  pasang palsu bila prompt belum tersedia; bila tim frontend ingin
  tombol pasang sendiri, event `beforeinstallprompt` dapat dipakai
  dan hanya ditampilkan bila event tersebut benar-benar terjadi.
- **Service worker membutuhkan HTTPS** (atau localhost saat
  pengembangan). Kedua mirror sudah HTTPS.

## 12. Changelog dokumen

### 17 November 2026 — Fase 1

- Rencana PWA pertama: manifest, strategi cache service worker,
  halaman offline khusus, kriteria installable, alur pembaruan,
  dan instruksi pendaftaran untuk tim frontend.
- `manifest.webmanifest` dan `sw.js` ditulis sebagai kerangka siap
  pakai. Ikon PNG menunggu tim brand; tautan manifest dan
  pendaftaran service worker menunggu tim frontend.
