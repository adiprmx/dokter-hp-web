# Rencana Test: Dokter HP Web App

> **Dokumen rencana pengujian Dokter HP Web App (full-stack).**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — kerangka test,
> 17 November 2026.
>
> Acuan: `PRODUCT.md` (perilaku produk, kriteria selesai bagian 9),
> `ARCHITECTURE.md` (endpoint, skema D1, alur), dan
> `docs/keputusan-stack.md` (stack + limit free tier).
>
> **Proof standard proyek:** unit + integrasi + E2E Playwright
> hijau sebelum klaim selesai. Tidak ada klaim "sudah beres" dari
> membaca kode saja.

---

## 1. Tujuan dan prinsip

1. Setiap fitur yang dijanjikan `PRODUCT.md` punya tes yang
   membuktikan perilakunya, di lapisan yang tepat (bagian 3).
2. **Tanpa data dummy di produksi.** Tes tidak pernah menulis data
   contoh ke database produksi, dan UI tidak pernah menampilkan
   angka contoh seolah data nyata (PRODUCT.md bagian 8).
3. Tes yang bergantung pada jaringan nyata (tes kecepatan, latensi)
   tidak mengasersi nilai mutlak — hanya bentuk hasil dan rentang
   yang wajar (bagian 4.6).
4. Tes yang tidak bisa diotomatisasi (OAuth Google, perangkat fisik)
   didokumentasikan sebagai checklist manual dan dijalankan sebelum
   setiap rilis (bagian 5).
5. Secret tidak pernah muncul di tes, di fixture, atau di log tes.

## 2. Lapisan tes

| Lapisan | Alat | Lokasi | Yang diuji |
|---|---|---|---|
| Unit frontend | Vitest + jsdom | `apps/web/src/**/__tests__/` | Logika murni: format, klasifikasi kecepatan, perhitungan skor, komponen React (dengan Testing Library) |
| Unit API | Vitest (node) | `apps/api/src/**/__tests__/` | Validasi payload (zod), hash PIN/token, klasifikasi, envelope respons |
| Integrasi API | Vitest + Miniflare (D1 lokal) | `apps/api/src/**/__tests__/` (file `*.integration.test.ts`) | Endpoint end-to-end terhadap D1 lokal: CRUD, kepemilikan data, rate limit, soft-delete, cascade hapus akun |
| E2E | Playwright (Chromium) | `tests/e2e/` | Alur pengguna di browser: landing, pengaman rute, dashboard, WiFi, riwayat — desktop 1280x720 dan mobile 360x640 |
| Manual | Checklist + browser/HP fisik | `tests/e2e/auth.spec.ts` (checklist), bagian 5 dokumen ini | OAuth Google, PIN di perangkat nyata, unduh PDF di HP, tes bertahan 30 detik di jaringan nyata |
| Build / keamanan | Script CI (grep di `dist/`) | CI (bagian 7) | Bundle tidak mengandung secret; hanya `VITE_API_BASE_URL` yang terekspos |

## 3. Matriks fitur x jenis test

Keterangan: **U** = unit, **I** = integrasi API, **E** = E2E Playwright,
**M** = manual. Tanda "—" berarti lapisan itu tidak dipakai untuk
fitur tersebut (dengan alasan di kolom keterangan).

### 3.1 Landing dan auth

| Fitur (PRODUCT.md) | U | I | E | M | Keterangan |
|---|---|---|---|---|---|
| Landing terbuka, tombol utama tampil (4.1) | — | — | ✓ | — | `smoke.spec.ts` |
| Tes WiFi tanpa akun dari landing (4.1) | ✓ | — | ✓ | ✓ | Unit: logika tes; E2E: tombol jalan; manual: hasil nyata di HP |
| Halaman login terbuka (4.2) | — | — | ✓ | — | `smoke.spec.ts` |
| Masuk Google — alur penuh (4.2) | — | ✓ | — | ✓ | OAuth tidak bisa diotomatisasi; integrasi menguji callback dengan token tiruan (mock) di server |
| Sesi bertahan setelah muat ulang (4.2) | — | ✓ | — | ✓ | Integrasi: verifikasi cookie + token hash; manual: muat ulang di browser sungguhan |
| Keluar menghapus sesi (4.2) | — | ✓ | — | ✓ | Integrasi: sesi terhapus di D1; manual: alur klik |
| PIN: atur, buka, ubah, hapus (4.2) | ✓ | ✓ | — | ✓ | Unit: hash SHA-256 + salt; integrasi: endpoint `/auth/pin/*`; manual: layar kunci |
| PIN: kunci 30 dtk setelah 5x salah (4.2) | ✓ | ✓ | — | ✓ | Unit: penghitung percobaan; integrasi: `pin_terkunci_sampai`; manual: waktu tunggu nyata |
| PIN lupa — pemulihan lewat Google (4.2) | — | ✓ | — | ✓ | Integrasi: atur PIN baru setelah masuk ulang; manual: alur penuh |
| Gerbang kunci: dashboard redirect ke /kunci bila PIN diatur (4.2) | — | — | ✓ | — | E2E dengan sesi tes (setelah helper sesi tersedia) |
| Daftar sesi + keluar dari sesi lain (4.8) | — | ✓ | — | ✓ | Integrasi: endpoint `/account/sessions`; manual: dua perangkat |

### 3.2 Dashboard dan dokter

| Fitur (PRODUCT.md) | U | I | E | M | Keterangan |
|---|---|---|---|---|---|
| Skor 0-100 + kategori (4.3) | ✓ | ✓ | ✓ | — | Unit: perhitungan + normalisasi bobot komponen tanpa data; E2E: tampil dari data real |
| Diagnosis satu ketuk (4.3) | ✓ | ✓ | ✓ | — | Unit: perakitan ringkasan; integrasi: POST `/health-checks`; E2E: tombol menyimpan |
| Grafik riwayat skor (4.3) | ✓ | — | ✓ | — | Unit: pemetaan data ke titik grafik; E2E: grafik tampil bila ada data |
| Empty state dashboard (4.3) | — | — | ✓ | — | `smoke.spec.ts` (test.skip sampai auth + helper sesi ada) |
| Banner "Tidak tersambung ke server" (4.3) | ✓ | — | ✓ | ✓ | E2E: API dimatikan (mock gagal); manual: mode pesawat sebentar |
| Dokter WiFi: tes unduh 1 MB (4.4) | ✓ | — | ✓ | ✓ | Unit: klasifikasi ambang (lihat `smoke.test.ts`); E2E: tombol jalan, hasil tampil; manual: hasil nyata di HP |
| Dokter WiFi: latensi HTTP (4.4) | ✓ | ✓ | ✓ | — | Unit: median 3 sampel; integrasi: GET `/ping`; E2E: label "latensi HTTP" |
| Dokter WiFi: info jaringan + "tidak tersedia" (4.4) | ✓ | — | ✓ | ✓ | Unit: penanganan API tidak ada; manual: browser tanpa Network Information API |
| Dokter WiFi: rekomendasi channel 1/6/11 (4.4) | ✓ | — | ✓ | — | Unit: logika rekomendasi dari hasil tes |
| Dokter WiFi: tes bertahan 30 detik (4.4) | ✓ | ✓ | — | ✓ | Unit: pengumpul sampel; integrasi: POST 30 sampel + batas maks 30; manual: 30 detik penuh di jaringan nyata (terlalu lama untuk E2E rutin) |
| Dokter WiFi: pemantau live (4.4) | ✓ | — | ✓ | — | Unit: pembaruan angka; E2E: angka berubah selama tes |
| Dokter WiFi: panduan WiFi turun (4.4) | — | — | ✓ | — | E2E: kartu panduan tampil saat kecepatan sangat lambat |
| Dokter WiFi: bagikan hasil (4.4) | ✓ | — | — | ✓ | Unit: perakitan teks ringkasan; manual: clipboard / Web Share di HP |
| Dokter Baterai: riwayat + input manual (4.5) | ✓ | ✓ | ✓ | — | Unit: label perkiraan waktu pakai; integrasi: CRUD health_checks |
| Dokter Penyimpanan (4.5) | ✓ | ✓ | ✓ | — | Unit: bilah pemakaian dari total/terpakai |
| Dokter Performa (4.5) | ✓ | ✓ | ✓ | — | Unit: pemetaan info perangkat |
| Dokter Keamanan: "Perlu ditinjau" 4+ izin (4.5) | ✓ | ✓ | ✓ | — | Unit: ambang 4 izin berbahaya; integrasi: data dari APK |
| Setiap entri menampilkan tanggal + sumber (4.5) | — | — | ✓ | — | E2E: label "dari APK" / "diisi manual" tampil |

### 3.3 AI, riwayat, pengaturan, keamanan

| Fitur (PRODUCT.md) | U | I | E | M | Keterangan |
|---|---|---|---|---|---|
| Diagnosis AI menjawab (4.6) | ✓ | ✓ | — | ✓ | Unit: perakitan prompt konteks; integrasi: Gemini di-mock, jawaban tersimpan; manual: jawaban nyata sekali per rilis |
| Diagnosis AI tidak tersedia — pesan jujur (4.6) | ✓ | ✓ | ✓ | — | Integrasi: Gemini galat -> pesan jujur, bukan jawaban karangan |
| Rate limit AI 20/hari per pengguna (4.6) | — | ✓ | — | — | Integrasi: percobaan ke-21 ditolak 429 |
| Riwayat: daftar + filter + urutan (4.7) | ✓ | ✓ | ✓ | — | Integrasi: paginasi + filter jenis; E2E: daftar tampil |
| Riwayat: soft-delete (4.7) | — | ✓ | ✓ | — | Integrasi: `deleted_at` terisi, baris tidak hilang permanen |
| Laporan PDF client-side (4.7) | ✓ | — | — | ✓ | Unit: perakitan data PDF dari data real; manual: unduh + isi cocok dengan riwayat (di HP dan desktop) |
| Pengaturan: profil nama (4.8) | — | ✓ | ✓ | — | Integrasi: PATCH `/account/profile` |
| Pengaturan: hapus akun + cascade (4.8) | — | ✓ | — | ✓ | Integrasi: seluruh data pengguna terhapus; manual: konfirmasi "HAPUS" |
| Kepemilikan: pengguna A tidak bisa baca data B (10) | — | ✓ | — | — | Integrasi WAJIB: tiap endpoint data diuji dengan dua pengguna |
| Validasi input (skor 0-100, PIN 4-8 digit) (ARCH 6.2) | ✓ | ✓ | — | — | Unit: skema zod; integrasi: payload tidak valid ditolak 400 |
| SQL injection ditolak (ARCH 6.2) | — | ✓ | — | — | Integrasi: input berisi karakter SQL disimpan sebagai teks biasa |
| Rate limit tulis 60/menit (ARCH 6.1) | — | ✓ | — | — | Integrasi: banjir tulis ditolak 429 |
| CORS hanya Pages + Vercel (ARCH 6.2) | — | ✓ | — | — | Integrasi: origin lain ditolak |
| Kunci Gemini tidak ada di bundle (9) | — | — | — | — | Tes build CI: grep `dist/` (bagian 4.5) |
| Deploy dua mirror + smoke (9) | — | — | ✓ | ✓ | E2E dengan `E2E_BASE_URL` per mirror; manual: buka kedua mirror di HP |

## 4. Kriteria lolos

### 4.1 Unit (Vitest)

- Semua tes unit hijau (0 gagal) di `apps/web` dan `apps/api`.
- Setiap modul logika baru (format, klasifikasi, skor, validasi,
  hash) punya tes yang menutup kasus batasnya (ambang, kosong,
  tidak valid).
- Tidak ada tes yang bergantung pada jaringan, waktu nyata yang
  tidak dikendalikan, atau urutan jalan tes lain.

### 4.2 Integrasi API (Miniflare + D1 lokal)

- Semua endpoint di ARCHITECTURE.md bagian 3 teruji: sukses,
  tanpa sesi (401), data milik orang lain (403/404), payload
  tidak valid (400), dan rate limit (429).
- Tes kepemilikan (pengguna A vs B) hijau untuk SEMUA endpoint
  data — ini kriteria wajib, bukan opsional.
- Migrasi D1 (`0001_init.sql`) diterapkan bersih pada database
  kosong, dan skema cocok dengan kolom di PRODUCT.md bagian 7.

### 4.3 E2E (Playwright)

- Tes smoke (`tests/e2e/smoke.spec.ts`) hijau di proyek desktop
  dan mobile.
- Tidak ada tes E2E yang mengasersi angka kecepatan/latensi
  mutlak — hanya keberadaan hasil dan label yang benar.
- Screenshot otomatis tersimpan untuk setiap kegagalan
  (`screenshot: only-on-failure`).

### 4.4 Manual

- Checklist `tests/e2e/auth.spec.ts` terisi penuh (semua kotak
  tercentang) sebelum rilis, di kedua mirror, di HP dan desktop.
- Checklist bagian 5 dokumen ini terisi penuh sebelum rilis.

### 4.5 Build dan keamanan (CI)

- `npm run build` berhasil tanpa galat TypeScript.
- Pencarian di `dist/` tidak menemukan kunci API, client secret,
  atau pola secret (`AIza`, `sk-`, `ghp_`, `xoxb-`).
- `npm audit` tidak melaporkan kerentanan kritis pada dependensi
  produksi (kerentanan dev dicatat dan ditinjau, bukan diabaikan).

### 4.6 Kriteria rilis (ringkasan PRODUCT.md bagian 9)

- Semua kotak kriteria selesai PRODUCT.md bagian 9 tercentang
  dengan bukti tes (bukan klaim).
- Uji smoke lolos di kedua mirror (Pages dan Vercel) setelah deploy.
- Tidak ada angka dummy yang tampil seolah data nyata di layar
  mana pun — diverifikasi manual di semua 11 layar dengan akun
  baru tanpa data (semua menampilkan empty state jujur).

## 5. Checklist manual yang butuh browser/HP fisik

Daftar ini WAJIB dijalankan sebelum setiap rilis. Alasan tiap item
tidak bisa diotomatisasi dicantumkan.

| # | Item | Perangkat | Kenapa manual |
|---|---|---|---|
| M1 | Masuk Google end-to-end (lihat `tests/e2e/auth.spec.ts`) | HP + desktop | Google memblokir browser otomatis; butuh interaksi manusia |
| M2 | Sesi bertahan setelah muat ulang; keluar menghapus sesi | HP + desktop | Bagian dari alur OAuth yang sama |
| M3 | PIN: atur, kunci, buka, 5x salah -> kunci 30 detik | HP | Waktu nyata 30 detik + alur kunci perangkat |
| M4 | Tes kecepatan unduh + latensi di jaringan nyata | HP (WiFi dan data seluler) | Hasil bergantung jaringan nyata; Playwright tidak mengukur jaringan HP |
| M5 | Tes bertahan 30 detik penuh + grafik 30 sampel | HP | Durasi 30 detik nyata; grafik diverifikasi mata |
| M6 | Unduh laporan PDF, isi cocok dengan riwayat | HP + desktop | Unduhan file dan isi PDF diverifikasi mata |
| M7 | Bagikan hasil (clipboard / Web Share API) | HP | Web Share API hanya ada di perangkat nyata |
| M8 | Banner "Tidak tersambung ke server" saat API mati | HP (mode pesawat sebentar) | Kondisi jaringan perangkat nyata |
| M9 | Semua 11 layar dengan akun baru: empty state jujur, tanpa angka contoh | HP 360 px | Verifikasi visual per layar |
| M10 | Diagnosis AI: satu pertanyaan nyata, jawaban masuk akal + tersimpan | HP | Kualitas jawaban AI dinilai manusia |
| M11 | Area sentuh >= 44 px dan teks terbaca di lebar 360 px | HP | Verifikasi sentuhan dan keterbacaan nyata |
| M12 | Kedua mirror (Pages + Vercel) bisa dibuka dan memanggil API yang sama | HP | Verifikasi deploy nyata per mirror |

## 6. Strategi data test tanpa dummy di produksi

1. **Lingkungan terpisah.** Tes integrasi memakai D1 lokal
   (Miniflare `--local`) atau database D1 khusus tes — TIDAK PERNAH
   database produksi. Tes E2E memakai dev server lokal atau
   deployment staging; tes ke mirror produksi memakai akun tes
   dan data yang dibuat lalu dihapus dalam tes yang sama.
2. **Seed hanya di lingkungan tes.** Data awal (pengguna tes,
   pemeriksaan contoh) dibuat oleh skrip seed yang hanya jalan
   di D1 lokal/staging, dengan penanda jelas (misalnya email
   `tes+<acak>@dokter-hp.local` — domain `.local` tidak bisa
   dipakai akun sungguhan). Skrip seed TIDAK ADA di jalur
   deploy produksi.
3. **Akun tes khusus.** Satu akun Google tes dipakai untuk
   checklist manual; kredensialnya disimpan di tempat aman tim,
   tidak pernah di repo, tidak pernah di file tes.
4. **Pembersihan.** Setiap tes integrasi/E2E yang menulis data
   membersihkan datanya sendiri (hapus di akhir tes, atau
   database lokal dibuat ulang per jalan tes). Tidak ada data
   tes yang tertinggal di lingkungan bersama.
5. **Data sintetis hanya di file tes.** Nilai contoh untuk tes
   unit (misalnya kecepatan 3,2 KB/detik di `smoke.test.ts`)
   hidup di dalam file tes dan TIDAK PERNAH diimpor kode
   produksi. Kode produksi tidak punya modul "data contoh".
6. **UI tanpa data = empty state.** Bila database kosong, UI
   menampilkan "Belum ada data pemeriksaan" — bukan grafik
   dengan angka contoh. Ini ditegakkan tes E2E (bagian 3.2)
   dan checklist manual M9.
7. **Rate limit dihormati.** Tes integrasi yang menguji rate
   limit memakai database lokal (tanpa kuota D1 produksi).
   Tes terhadap API staging tidak membanjiri endpoint AI
   (kuota Gemini bersama) — jawaban AI di-mock di tes otomatis,
   hanya M10 yang memakai panggilan nyata.

## 7. Perintah, dependensi, dan CI

### 7.1 Dependensi test (status: MENUNGGU INSTALASI — scaffold sudah ada)

Scaffold (package.json root + `apps/web` + `apps/api`) sudah dibuat
tim scaffold pada 17 Nov 2026, dan `vitest` sudah dinyatakan di kedua
workspace (`apps/web` ^5.1.0, `apps/api` ^2.1.0). Yang masih kurang:
`jsdom` (apps/web) dan `@playwright/test` (root).

Instalasi TERTUNDA saat dokumen ini diperbarui: `npm install` di
lingkungan ini berjalan sangat lambat (5+ proses instalasi paralel
dari tim-tim lain, 14+ menit tanpa `package-lock.json` terbentuk;
instalasi verifikasi terisolasi di /tmp tidak menunjukkan kemajuan
dalam 6,5 menit dan dihentikan untuk mengurangi kemacetan).
Menambah instalasi paralel hanya memperburuk kemacetan, jadi
instalasi dependensi test dilakukan setelah instalasi scaffold
selesai — perintahnya di bawah ini.

| Paket | Lokasi | Kegunaan |
|---|---|---|
| `@playwright/test` | root / workspace `tests` | Runner E2E + konfigurasi Playwright |
| `vitest` | `apps/web`, `apps/api` | Runner unit + integrasi |
| `jsdom` | `apps/web` | DOM untuk tes frontend |
| `@testing-library/react`, `@testing-library/jest-dom` | `apps/web` | Tes komponen React (ditambahkan saat tes komponen dimulai) |
| `@cloudflare/vitest-pool-workers` | `apps/api` | Tes integrasi dengan binding Workers (ditambahkan saat tes integrasi dimulai) |

Versi acuan saat dokumen ditulis (17 Nov 2026, dari registry npm):
`@playwright/test` 1.65.1, `vitest` 5.1.0, `jsdom` 31.0.1.
Pasang versi stabil terbaru saat scaffold dibuat; catat versi
terpasang di `package-lock.json`.

Perintah pasang (setelah scaffold ada):

```bash
# Root / workspace tests
npm install -D @playwright/test
npx playwright install chromium --with-deps

# Frontend
npm --prefix apps/web install -D vitest jsdom

# API
npm --prefix apps/api install -D vitest
```

### 7.2 Skrip package.json yang disarankan

```json
// apps/web/package.json dan apps/api/package.json
{ "scripts": { "test": "vitest run", "test:watch": "vitest" } }

// root package.json (atau workspace tests)
{
  "scripts": {
    "test": "npm --prefix apps/web run test && npm --prefix apps/api run test",
    "test:e2e": "npx playwright test",
    "test:e2e:mobile": "npx playwright test --project=mobile"
  }
}
```

### 7.3 Alur CI yang disarankan (GitHub Actions)

1. Pasang dependensi (`npm ci` di setiap workspace).
2. Tes unit web + API (`vitest run`) — harus hijau.
3. Typecheck + build frontend — harus berhasil.
4. Tes build: grep secret di `dist/` — harus bersih.
5. Pasang browser Playwright (`npx playwright install chromium`).
6. Tes E2E smoke (desktop + mobile) terhadap dev server — harus hijau.
7. Tes integrasi API (Miniflare + D1 lokal) — harus hijau.
8. Deploy hanya bila semua langkah di atas hijau.

### 7.4 File test yang sudah ada (kerangka Fase 1)

| File | Isi |
|---|---|
| `tests/playwright.config.ts` | Konfigurasi Playwright: baseURL dari env, proyek desktop 1280x720 + mobile 360x640, retries 1 di CI, screenshot saat gagal |
| `tests/e2e/smoke.spec.ts` | Smoke E2E: landing, halaman login, redirect dashboard tanpa login, empty state dashboard (test.skip — menunggu auth) |
| `tests/e2e/auth.spec.ts` | Kerangka auth: checklist manual OAuth Google + PIN + sesi, dengan test.skip bercermin checklist |
| `apps/web/vitest.config.ts` | Konfigurasi Vitest frontend (jsdom) |
| `apps/web/src/lib/__tests__/smoke.test.ts` | Contoh unit test hijau: klasifikasi kecepatan (ambang PRODUCT.md 4.4) |
| `apps/api/vitest.config.ts` | Konfigurasi Vitest API (node) |
| `docs/rencana-test.md` | Dokumen ini |

## 8. Urutan pengerjaan test

1. **Sekarang (Fase 1):** kerangka di bagian 7.4 — selesai.
2. **Setelah scaffold:** pasang dependensi (7.1), jalankan contoh
   unit test sampai hijau, jalankan smoke E2E terhadap scaffold
   kosong (tes aktif harus hijau setelah halaman dasar ada).
   Catatan verifikasi 17 Nov 2026: logika contoh unit test sudah
   terbukti benar — 10/10 kasus klasifikasi lolos saat fungsi dan
   tabelnya diekstrak dari file dan dijalankan di Node. Yang belum
   terbukti adalah jalan `vitest run` itu sendiri (menunggu
   `node_modules`).
3. **Bersamaan dengan tiap fitur:** unit + integrasi ditulis
   bersama kodenya (bukan sesudahnya); E2E ditambahkan per layar.
4. **Sebelum rilis pertama:** hapus `test.skip` yang fiturnya
   sudah ada; jalankan checklist manual M1-M12; uji smoke di
   kedua mirror.
5. **Setiap rilis berikutnya:** seluruh suite otomatis + checklist
   manual M1-M12 diulang.

## 9. Risiko dan batasan

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Tes kecepatan flaky (jaringan tidak stabil) | E2E gagal padahal kode benar | Jangan asersi nilai mutlak; timeout 15 detik sesuai produk; retries 1 di CI |
| OAuth tidak bisa diotomatisasi | Alur masuk tidak teruji otomatis | Checklist manual M1-M3 wajib sebelum rilis; integrasi menguji callback dengan mock |
| Network Information API tidak ada di semua browser | Info koneksi berbeda per browser | Tes mengasersi label "tidak tersedia" bila API tidak ada |
| Kuota D1 staging terkuras tes | Tes gagal di tengah jalan | Tes integrasi memakai D1 lokal; tes staging dibatasi dan dibersihkan |
| Kuota Gemini bersama terkuras tes | AI tidak tersedia untuk pengguna | AI di-mock di tes otomatis; hanya M10 memakai panggilan nyata |
| Tes 30 detik memperlambat suite | CI lambat | Tes bertahan hanya manual (M5) + integrasi sampel; bukan E2E rutin |
| Browser Playwright tidak terpasang di CI | E2E gagal sebelum jalan | Langkah CI memasang Chromium secara eksplisit (7.3 langkah 5) |

## 10. Changelog dokumen

### 17 November 2026 — versi awal (Fase 1)

- Matriks fitur x jenis test untuk 11 layar + auth + keamanan.
- Kriteria lolos per lapisan dan kriteria rilis.
- Checklist manual M1-M12 (browser/HP fisik).
- Strategi data test tanpa dummy di produksi.
- Dependensi test dicatat, status menunggu scaffold.
- Pembaruan di hari yang sama: scaffold package.json sudah ada,
  vitest sudah dinyatakan di kedua workspace; instalasi jsdom +
  @playwright/test tertunda (npm install sangat lambat, instalasi
  paralel tim lain masih berjalan); logika smoke test terverifikasi
  10/10 kasus lewat Node.
