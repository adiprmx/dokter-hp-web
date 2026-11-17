# performance.md: Anggaran Performa Dokter HP Web App

> **Dokumen ini adalah anggaran performa yang mengikat untuk Dokter HP
> Web App (full-stack).**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen, 17 November 2026.
>
> Prinsip: pengguna utama memakai HP dengan koneksi yang kadang lemot.
> Performa adalah fitur, bukan hiasan. Angka di dokumen ini adalah
> batas yang harus dipenuhi, bukan sekadar harapan. Setiap rilis yang
> melanggar anggaran wajib diperbaiki sebelum deploy, atau mendapat
> keputusan eksplisit koordinator untuk menaikkan anggaran dengan
> alasan tercatat.
>
> Preseden proyek sejenis di workspace ini: bundle awal 70 KB gzip.
> Target Dokter HP disusun dengan preseden itu sebagai bukti bahwa
> bundle awal di bawah 100 KB gzip dapat dicapai.

---

## 1. Anggaran bundle frontend (mengikat)

Angka diukur dari hasil build produksi (`npm run build`) dengan
kompresi gzip, pada file yang dimuat pada kunjungan pertama ke
halaman landing (`/`).

| Aset | Batas keras (maks) | Target | Keterangan |
|---|---|---|---|
| JavaScript awal (semua chunk yang dimuat di `/`) | 200 KB gzip | 100 KB gzip | Termasuk React, React Router, Zustand, dan kode aplikasi rute awal |
| CSS awal | 30 KB gzip | 20 KB gzip | Tailwind yang sudah dibersihkan (purged); tanpa CSS yang tidak dipakai |
| HTML awal (`index.html`) | 15 KB gzip | 10 KB gzip | Tanpa inline script berat |
| Total transfer awal (JS + CSS + HTML + favicon) | 250 KB gzip | 150 KB gzip | Di luar file tes kecepatan (lihat bagian 3.5) |

Aturan:

- **Batas keras = gagal build.** Bila ukuran melewati batas keras,
  CI menolak rilis (lihat bagian 7). Tidak ada pengecualian diam-diam.
- **Target = standar kerja.** Setiap penambahan dependensi atau fitur
  yang mendekati target wajib dicatat di changelog rilis beserta
  ukuran sebelum dan sesudah.
- **Chunk yang dimuat belakangan tidak masuk anggaran awal**, tetapi
  tetap dibatasi: satu chunk lazy-load maksimal 150 KB gzip, dan
  total seluruh chunk aplikasi maksimal 600 KB gzip.
- **Ukuran diukur pada build produksi**, bukan build pengembangan.
  Source map tidak dihitung, tetapi source map tidak di-deploy ke
  Pages/Vercel (tidak ada di `dist` yang diunggah).

### 1.1 Pembagian anggaran JS awal (pedoman, bukan batas per komponen)

| Komponen | Perkiraan | Catatan |
|---|---|---|
| React + React DOM | ±45 KB gzip | Tidak bisa dihindari; jangan tambah framework UI berat di atasnya |
| React Router | ±12 KB gzip | Hanya router; tanpa library navigasi tambahan |
| Zustand | ±3 KB gzip | State ringan; tanpa Redux |
| Tailwind runtime | 0 KB | Tailwind dikompilasi ke CSS, bukan runtime JS |
| Kode aplikasi rute awal | ±40 KB gzip | Landing + shell + store + client API |
| **Total perkiraan** | **±100 KB gzip** | Sesuai target |

Sisa sampai batas keras 200 KB adalah ruang cadangan untuk fitur
rute awal yang benar-benar perlu, bukan ruang untuk dependensi baru.

## 2. Anggaran waktu (mengikat)

Diukur di HP Android kelas menengah (contoh: perangkat 4 GB RAM,
CPU kelas menengah) pada koneksi 4G lambat (profil Lighthouse:
throttling 1,6 Mbps unduh / 750 Kbps unggah, latensi 150 ms),
dengan cache kosong (kunjungan pertama) dan cache terisi
(kunjungan ulang).

| Metrik | Batas keras | Target | Kondisi ukur |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 4,0 detik | < 2,5 detik | Kunjungan pertama, 4G lambat |
| TTI (Time to Interactive) | < 5,0 detik | < 3,5 detik | Kunjungan pertama, 4G lambat |
| FCP (First Contentful Paint) | < 2,5 detik | < 1,8 detik | Kunjungan pertama, 4G lambat |
| INP (Interaction to Next Paint) | < 300 ms | < 200 ms | Interaksi umum (ketuk kartu, buka halaman) |
| CLS (Cumulative Layout Shift) | < 0,1 | < 0,05 | Semua halaman; gambar dan grafik punya ukuran tetap |
| LCP kunjungan ulang (cache terisi) | < 2,0 detik | < 1,5 detik | Cache terisi, 4G lambat |
| TTFB API (Worker, p50) | < 500 ms | < 200 ms | Endpoint baca D1 berindeks (lihat bagian 5) |

Aturan:

- **LCP dan TTI target adalah janji produk.** Bila hasil ukur
  melewati batas keras, rilis ditunda sampai penyebab diperbaiki.
- **INP dan CLS berlaku untuk semua halaman**, bukan hanya landing.
  Halaman berat (WiFi, Riwayat, Dashboard) diukur terpisah.
- **Pengukuran memakai kondisi yang dinyatakan di atas.** Hasil ukur
  di WiFi kencang atau di desktop tidak membuktikan apa-apa dan
  tidak boleh dipakai sebagai bukti anggaran terpenuhi.

## 3. Strategi frontend

### 3.1 Code-splitting per rute (wajib)

- Setiap halaman di `src/pages/` dimuat dengan `React.lazy` +
  `Suspense`, sebagai chunk terpisah. Tidak ada halaman yang
  dibundel ke dalam chunk awal kecuali Landing (`/`) dan shell
  aplikasi (App, Router, store auth).
- Rute yang dibundel bersama chunk awal: hanya `/` dan komponen
  shell (header, navigasi bawah, ErrorState, LoadingState,
  EmptyState). Semua rute lain (`/dashboard`, `/wifi`, `/baterai`,
  `/penyimpanan`, `/performa`, `/keamanan`, `/ai`, `/riwayat`,
  `/pengaturan`, `/masuk`, `/kunci`) adalah chunk terpisah.
- Fallback `Suspense` adalah LoadingState dengan teks yang
  menjelaskan ("Memuat halaman..."), bukan layar kosong.
- Vite `manualChunks` tidak dipakai untuk menggabungkan kembali
  chunk rute; vendor dipisah secara alami oleh Vite (chunk vendor
  React terpisah dari kode aplikasi).

### 3.2 Lazy load komponen berat (wajib)

Komponen dan library berikut **dilarang** masuk chunk awal dan
**wajib** dimuat malas (dynamic `import()` saat pertama dipakai):

| Komponen / library | Dimuat saat | Alasan |
|---|---|---|
| jsPDF (laporan PDF) | Pengguna mengetuk "Unduh laporan PDF" di `/riwayat` | Library besar; hanya dipakai sekali-sekali |
| Grafik riwayat skor (`ScoreHistoryChart`) | Dashboard selesai memuat data dan ada data | Library grafik berat; tidak perlu sebelum data ada |
| Grafik tes bertahan (`SpeedChart`) | Pengguna membuka `/wifi` dan memulai tes | Hanya relevan selama tes berjalan |
| Halaman Diagnosis AI (`/ai`) | Pengguna membuka rute `/ai` | Bukan jalur utama; chunk rute terpisah |
| Halaman Pengaturan (`/pengaturan`) | Pengguna membuka rute `/pengaturan` | Jarang dibuka; chunk rute terpisah |

- Library grafik dipilih yang paling ringan yang memenuhi kebutuhan
  (grafik garis sederhana). Bila library grafik melebihi 30 KB gzip,
  pertimbangkan menggambar grafik dengan SVG murni tanpa library.
- jsPDF diimpor dengan dynamic `import()` di dalam handler tombol,
  bukan di bagian atas file. Verifikasi: string `jspdf` tidak boleh
  muncul di chunk awal hasil build (diperiksa di CI dengan pencarian
  teks, sama seperti pemeriksaan kunci API).

### 3.3 Gambar dan media

- **Ikon dan logo memakai SVG inline atau file SVG**, bukan PNG/JPG.
  SVG dikompresi (tanpa metadata editor) dan berukuran kecil.
- **Tidak ada gambar raster besar di rute awal.** Landing tidak
  memakai foto atau ilustrasi raster. Bila ilustrasi dibutuhkan di
  halaman lain, ukurannya maksimal 50 KB per file dan wajib memakai
  format modern (WebP/AVIF) dengan fallback bila perlu.
- **Setiap gambar wajib punya atribut lebar dan tinggi** (atau rasio
  aspek CSS) agar tidak menimbulkan layout shift (CLS).
- **Favicon adalah file SVG** (`favicon.svg`), bukan ICO/PNG besar.
- File `speedtest-1mb.bin` (1 MB) adalah alat ukur, bukan aset
  halaman: file itu **tidak pernah dimuat otomatis** dan tidak masuk
  anggaran transfer awal. File itu hanya diunduh saat pengguna
  menjalankan tes kecepatan, dan hanya dari Pages yang sama.

### 3.4 Font

- **Font sistem saja.** Tidak ada unduhan font web (tanpa Google
  Fonts, tanpa `@font-face` dengan file font).
- Stack font: font sans sistem perangkat
  (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) dan
  monospace sistem untuk angka/teks teknis bila perlu.
- Alasan: unduhan font gagal atau lambat saat koneksi lemot, dan
  menambah waktu render teks pertama. Font sistem selalu tersedia
  dan tidak menambah transfer apa pun.

### 3.5 Prefetch dan preload (seperlunya, bukan sembarangan)

- **Preload**: hanya file CSS awal dan chunk JS awal yang memang
  dibutuhkan halaman landing. Tidak ada preload untuk chunk rute
  lain.
- **Prefetch**: chunk rute yang kemungkinan besar dibuka berikutnya
  boleh di-prefetch **setelah** halaman awal selesai interaktif
  (setelah TTI) dan **hanya bila koneksi memadai**:
  - Prefetch `/dashboard` dari landing setelah pengguna masuk.
  - Prefetch `/wifi` dari dashboard (fitur utama).
  - Prefetch dilarang bila `navigator.connection.saveData` aktif
    (mode hemat data) atau bila jenis koneksi efektif adalah
    `slow-2g` / `2g`.
  - Prefetch tidak boleh bersaing dengan tes kecepatan: saat tes
    WiFi berjalan, semua prefetch dijeda.
- **Tanpa prefetch spekulatif massal.** Dilarang mem-prefetch semua
  rute sekaligus; maksimal dua chunk rute yang di-prefetch per
  halaman.
- **DNS prefetch / preconnect**: hanya ke origin API Worker
  (`<nama>.workers.dev` atau custom domain API) dari halaman yang
  memanggil API. Tanpa preconnect ke domain pihak ketiga yang tidak
  dipakai di jalur utama.

### 3.6 Cache header aset statis

| Aset | Header cache | Alasan |
|---|---|---|
| File JS/CSS hasil build (nama file berisi hash) | `Cache-Control: public, max-age=31536000, immutable` | Nama file berubah tiap build; aman di-cache selamanya |
| `favicon.svg`, SVG statis lain | `Cache-Control: public, max-age=86400` | Jarang berubah; sehari cukup |
| `speedtest-1mb.bin` | `Cache-Control: no-store` | Wajib diunduh ulang setiap tes agar hasil ukur nyata; cache akan memalsukan kecepatan |
| `index.html` | `Cache-Control: no-cache` (revalidasi tiap kunjungan) | HTML menunjuk ke hash build terbaru; cache lama akan menunjuk chunk yang sudah tidak ada |
| Respons API (`/api/health-checks`, `/api/wifi-reports`, dan lain-lain) | `Cache-Control: no-store` (data milik pengguna, bisa berubah) | Data pribadi tidak boleh di-cache di CDN bersama; cache di client diatur oleh aplikasi (Zustand) bila perlu |

- Header diatur di konfigurasi Pages (`_headers`) dan Vercel
  (`vercel.json`) dengan nilai yang sama di kedua mirror.
- **Service worker tidak dipakai di rilis pertama.** Alasan: risiko
  cache basi (aplikasi lama tersangkut di perangkat) lebih besar
  daripada manfaatnya, dan cache header di atas sudah cukup untuk
  kunjungan ulang yang cepat. Bila service worker ditambahkan di
  fase berikutnya, dokumen ini diperbarui dulu dengan strategi
  invalidasi yang jelas.

### 3.7 Rendering dan interaksi

- **Hindari pekerjaan berat di thread utama saat muat awal.**
  Perhitungan skor, pemformatan data, dan perakitan teks laporan
  dilakukan setelah halaman interaktif atau saat data tersedia,
  bukan saat render pertama.
- **Daftar riwayat memakai paginasi** (`limit=20`, lihat
  `ARCHITECTURE.md` bagian 3): frontend tidak pernah me-render
  ratusan baris sekaligus. Tombol "Muat lagi" atau scroll lanjutan
  memuat halaman berikutnya.
- **Grafik dibatasi jumlah titiknya.** Grafik tes bertahan maksimal
  30 titik (satu per detik). Grafik riwayat skor maksimal 100 titik;
  bila riwayat lebih banyak, data diringkas per hari di Worker atau
  di client sebelum digambar.
- **Animasi ringan.** Transisi CSS singkat (maksimal 200 ms);
  tanpa animasi JavaScript yang berjalan terus-menerus di latar.
  Animasi dihormati terhadap preferensi `prefers-reduced-motion`.

## 4. Anggaran API dan D1 (mengikat)

### 4.1 Batas platform yang memengaruhi desain

D1 free tier (angka terverifikasi 17 November 2026, lihat
`ARCHITECTURE.md` bagian 6.3):

- 5 juta baris dibaca per hari.
- 100 ribu baris ditulis per hari.
- Batas per pemanggilan Worker: **maksimal 50 query D1**.
  Pemanggilan yang melebihi batas gagal.

Aturan penting D1: **D1 menghitung baris yang DIPINDAI, bukan
baris yang dikembalikan.** Query tanpa indeks yang memindai seluruh
tabel menghabiskan kuota baca sebesar jumlah baris tabel, walau
hanya satu baris yang dikembalikan. Karena itu semua query wajib
memakai indeks (bagian 4.3).

### 4.2 Anggaran query per request

| Jenis request | Anggaran query D1 | Catatan |
|---|---|---|
| Endpoint baca daftar (`GET /api/health-checks`, `GET /api/wifi-reports`, `GET /api/ai/diagnoses`) | 1-2 query | 1 query verifikasi sesi + 1 query daftar berindeks ber-`LIMIT` |
| Endpoint baca satu item (`GET /api/health-checks/:id`, `GET /api/wifi-reports/:id`) | 1-3 query | 1 sesi + 1 item + 1 query sampel (hanya bila ada tes bertahan) |
| Endpoint tulis satu baris (`POST /api/health-checks`, `POST /api/wifi-reports`, `POST /api/auth/pin/*`) | 1-3 query | 1 sesi + 1 tulis (+ 1 baca bila perlu validasi) |
| `POST /api/wifi-reports/:id/samples` (30 sampel) | 1-2 query | 1 sesi + 1 batch insert (satu statement dengan banyak baris, atau satu transaksi) — dilarang 30 query terpisah |
| `POST /api/ai/diagnose` | 1-4 query | 1 sesi + 1 rate limit + 2 baca konteks (pemeriksaan terakhir + laporan WiFi terakhir) + 1 simpan jawaban |
| `GET /api/auth/me`, `GET /api/account/profile` | 1-2 query | 1 sesi + 1 profil (profil boleh digabung ke query sesi dengan JOIN bila memungkinkan) |
| `DELETE /api/account` (hapus akun) | 1-3 query | 1 sesi + 1 hapus pengguna (cascade menghapus baris anak) + 1 hapus sesi lain; bila cascade tidak aktif, hapus anak secara eksplisit dalam satu transaksi |
| `GET /api/health`, `GET /api/ping` | 0 query | Dilarang menyentuh D1 (lihat `ARCHITECTURE.md` bagian 3.6) |

Aturan:

- **Tidak ada endpoint yang memakai lebih dari 5 query D1.**
  Batas platform 50 query adalah batas darurat, bukan target.
  Endpoint yang butuh lebih dari 5 query harus dirancang ulang
  (JOIN, batch, atau denormalisasi).
- **Sesi diverifikasi sekali per request.** Hasil verifikasi sesi
  (user_id) dipakai ulang oleh semua query dalam request yang sama;
  dilarang memverifikasi sesi berulang kali.
- **Rate limit memakai penghitung yang murah.** Bila rate limit
  disimpan di D1, penghitung dibaca dan diperbarui dalam satu
  query gabungan bila memungkinkan, dan hanya untuk endpoint yang
  memang dibatasi (lihat `ARCHITECTURE.md` bagian 6.1).

### 4.3 Indeks (wajib)

Semua indeks di bawah ini sudah ada di skema `0001_init.sql`
(`ARCHITECTURE.md` bagian 5) dan wajib dipertahankan di setiap
migrasi berikutnya. Menghapus indeks tanpa pengganti adalah
pelanggaran anggaran ini.

| Tabel | Indeks | Query yang dilayani |
|---|---|---|
| `users` | `users_email_idx (email)` | Cari pengguna berdasarkan email |
| `users` | `UNIQUE (google_sub)` | Login Google: cari pengguna dari `google_sub` |
| `sessions` | `sessions_token_hash_idx (token_hash)` | Verifikasi sesi di setiap request |
| `sessions` | `sessions_user_id_idx (user_id)` | Daftar sesi aktif milik pengguna |
| `health_checks` | `health_checks_user_id_idx (user_id)` | Daftar pemeriksaan milik pengguna |
| `health_checks` | `health_checks_dibuat_pada_idx (dibuat_pada DESC)` | Urutan terbaru dulu |
| `wifi_reports` | `wifi_reports_user_id_idx (user_id)` | Daftar laporan milik pengguna |
| `wifi_reports` | `wifi_reports_dibuat_pada_idx (dibuat_pada DESC)` | Urutan terbaru dulu |
| `wifi_sustained_samples` | `wifi_sustained_samples_report_idx (wifi_report_id)` | Sampel per laporan |
| `ai_diagnoses` | `ai_diagnoses_user_id_idx (user_id)` | Riwayat diagnosis milik pengguna |
| `ai_diagnoses` | `ai_diagnoses_health_check_id_idx (health_check_id)` | Diagnosis terkait satu pemeriksaan |
| `ai_diagnoses` | `ai_diagnoses_dibuat_pada_idx (dibuat_pada DESC)` | Urutan terbaru dulu |

Aturan indeks:

- **Setiap query `WHERE` wajib memakai kolom yang terindeks.**
  Query yang memfilter `user_id` selalu memakai indeks `user_id`.
  Query yang mengurutkan `dibuat_pada DESC` memakai indeks
  `dibuat_pada`.
- **Indeks gabungan bila pola query-nya tetap.** Bila satu query
  selalu memfilter `user_id` dan mengurutkan `dibuat_pada DESC`,
  indeks gabungan `(user_id, dibuat_pada DESC)` lebih baik daripada
  dua indeks terpisah. Tim implementasi boleh menambahkan indeks
  gabungan ini di migrasi berikutnya dengan catatan di changelog.
- **Setiap query baru wajib diuji dengan `EXPLAIN QUERY PLAN`**
  sebelum digabung ke main. Bila rencana query menunjukkan
  `SCAN` (pemindaian penuh tabel) tanpa `USING INDEX`, query
  tersebut ditolak sampai indeks ditambahkan atau query diubah.
- **Kolom `deleted_at` (soft-delete):** filter
  `deleted_at IS NULL` digabung dengan filter `user_id` berindeks;
  pemindaian penuh hanya untuk mencari baris yang belum dihapus
  adalah pelanggaran.

### 4.4 Aturan query umum

- **Selalu pakai `LIMIT`.** Daftar memakai `LIMIT 20` (default)
  dan maksimal `LIMIT 100` bila client meminta lebih. Query tanpa
  `LIMIT` dilarang, kecuali query yang mengambil satu baris
  berdasarkan kunci utama (`WHERE id = ?`).
- **Pilih kolom yang dibutuhkan saja.** Dilarang `SELECT *` pada
  tabel dengan kolom besar (`ringkasan`, `jawaban`, `rekomendasi`)
  untuk daftar; kolom besar hanya diambil saat membuka satu item.
- **Tulis dalam batch, bukan satu per satu.** 30 sampel tes bertahan
  disimpan dalam satu statement batch atau satu transaksi, bukan
  30 query terpisah (lihat anggaran di bagian 4.2).
- **Tidak ada query di dalam loop.** Lihat pola terlarang N+1 di
  bagian 6.
- **Waktu respons Worker (p50) di bawah 200 ms** untuk endpoint
  baca berindeks. Bila satu endpoint konsisten di atas 500 ms,
  penyebabnya dicari (query tanpa indeks, payload terlalu besar,
  atau panggilan berantai) dan diperbaiki sebelum rilis berikutnya.

### 4.5 Payload API

- Respons daftar maksimal 100 KB (JSON). Bila satu halaman daftar
  melebihi itu, `LIMIT` diturunkan atau kolom besar dipisah ke
  endpoint detail.
- Respons `GET /api/ping` maksimal 1 KB (target latensi; tanpa D1).
- Frontend tidak meminta data yang tidak ditampilkan. Contoh:
  halaman daftar tidak meminta kolom `ringkasan` lengkap atau
  `jawaban` AI; halaman detail yang memintanya.

## 5. Anggaran pihak ketiga

- **Google OAuth**: hanya dipanggil saat pengguna mengetuk "Masuk
  dengan Google". Tidak ada script Google yang dimuat di halaman
  awal; alur OAuth memakai redirect, bukan widget JavaScript.
- **Gemini**: hanya dipanggil server-side dari Worker, tidak pernah
  dari browser. Panggilan Gemini tidak masuk anggaran bundle dan
  tidak memengaruhi LCP/TTI halaman.
- **Tanpa analytics, tanpa iklan, tanpa pelacak.** Tidak ada script
  pihak ketiga di halaman mana pun. Bila di masa depan ada kebutuhan
  pengukuran, pengukuran dilakukan server-side (log Worker) atau
  dengan alat yang di-host sendiri, dan dokumen ini diperbarui dulu.

## 6. Pola yang DILARANG

Pola-pola di bawah ini dilarang di seluruh kode Dokter HP Web App.
Kode yang mengandung pola ini ditolak di review dan tidak boleh
digabung ke main.

| # | Pola terlarang | Kenapa dilarang | Gantinya |
|---|---|---|---|
| 1 | Mengimpor seluruh library untuk satu fungsi (mis. `import _ from "lodash"` untuk satu `debounce`) | Menambah puluhan KB ke bundle untuk satu fungsi kecil | Impor fungsi spesifik (`import debounce from "lodash/debounce"`), atau tulis fungsi sendiri bila hanya 10-20 baris |
| 2 | Query D1 tanpa indeks (pemindaian penuh tabel) | D1 menghitung baris yang dipindai; satu query bisa menghabiskan ribuan baris kuota harian | Tambah indeks untuk kolom filter/urut, lalu uji dengan `EXPLAIN QUERY PLAN` |
| 3 | N+1 query (satu query daftar + satu query per item di dalam loop) | 20 item = 21 query; melanggar anggaran query dan menghabiskan kuota D1 | Satu query dengan JOIN atau `WHERE id IN (...)`, atau satu query agregat |
| 4 | Gambar tanpa lebar/tinggi (atau tanpa rasio aspek) | Menyebabkan layout shift (CLS) saat gambar selesai dimuat | Selalu tentukan dimensi atau rasio aspek di HTML/CSS |
| 5 | `SELECT *` pada daftar dengan kolom besar | Mengirim kolom `ringkasan`/`jawaban` yang tidak ditampilkan; membesarkan payload dan waktu respons | Pilih kolom yang ditampilkan saja; kolom besar hanya di endpoint detail |
| 6 | Query tanpa `LIMIT` pada daftar | Bisa mengembalikan ribuan baris sekaligus; menghabiskan kuota baca dan memori Worker | Selalu pakai `LIMIT` + paginasi cursor keyset (K-32) |
| 7 | Memuat jsPDF, library grafik, atau library berat lain di chunk awal | Melanggar anggaran bundle awal 200 KB | Dynamic `import()` saat pertama dipakai (lihat bagian 3.2) |
| 8 | Mengunduh font web (Google Fonts atau `@font-face` eksternal) | Menambah transfer dan menunda render teks; gagal saat koneksi lemot | Font sistem (lihat bagian 3.4) |
| 9 | Prefetch semua rute sekaligus | Memboroskan kuota pengguna dan bersaing dengan konten yang benar-benar dibuka | Prefetch maksimal dua rute yang paling mungkin dibuka, setelah TTI, dan tidak saat mode hemat data |
| 10 | Menyimpan 30 sampel tes bertahan dengan 30 query terpisah | 30 query untuk satu aksi pengguna; boros kuota tulis D1 (100 ribu baris/hari) | Satu batch insert dalam satu transaksi |
| 11 | Memanggil API di dalam loop render atau tanpa debounce pada input | Banjir request yang tidak perlu; membebani Worker dan D1 | Debounce input (mis. pencarian), dan panggil API sekali per aksi pengguna |
| 12 | Menaruh secret atau kunci API di bundle frontend | Bukan hanya pelanggaran performa — ini pelanggaran keamanan (lihat `ARCHITECTURE.md` bagian 6.2) | Secret hanya di secret Worker; frontend hanya menyimpan `VITE_API_BASE_URL` |
| 13 | Cache `speedtest-1mb.bin` (header cache yang mengizinkan cache) | Tes kecepatan akan mengukur cache lokal, bukan koneksi — hasilnya palsu | `Cache-Control: no-store` untuk file tes (lihat bagian 3.6) |
| 14 | Animasi JavaScript yang berjalan terus di latar | Menghabiskan baterai dan CPU HP; memperburuk INP | Animasi CSS singkat, atau tidak ada animasi sama sekali |

## 7. Cara mengukur

### 7.1 Lighthouse CI (pengukuran waktu)

- **Alat**: Lighthouse CI (`@lhci/cli`) di GitHub Actions, berjalan
  pada setiap pull request dan setiap push ke main.
- **Kondisi ukur**: preset `desktop` TIDAK dipakai; preset yang
  dipakai adalah **mobile** dengan throttling 4G lambat
  (1,6 Mbps / 750 Kbps, latensi 150 ms) — kondisi yang sama dengan
  anggaran di bagian 2.
- **Halaman yang diukur**: minimal `/` (landing), `/dashboard`,
  dan `/wifi`. Halaman yang butuh login diukur dengan sesi yang
  disiapkan di CI (atau diukur di staging dengan akun tes).
- **Ambang gagal (assertions)**: LCP < 4,0 dtk, TTI < 5,0 dtk,
  CLS < 0,1, dan skor kategori Performance minimal 80. Bila ambang
  gagal terlampaui, CI menolak pull request.
- **Target vs ambang gagal**: ambang gagal CI memakai batas keras
  (bagian 2), bukan target. Target (LCP < 2,5 dtk, TTI < 3,5 dtk)
  dilaporkan di ringkasan CI; bila target terlewat tetapi batas
  keras terpenuhi, CI memberi peringatan (bukan gagal) dan tim
  mencatat tindak lanjut di issue.
- **Riwayat hasil**: hasil Lighthouse CI disimpan sebagai artefak
  CI dan (bila tersedia) di server Lighthouse CI, agar tren
  performa antar rilis terlihat.

### 7.2 vite-bundle-visualizer (pengukuran bundle)

- **Alat**: `rollup-plugin-visualizer` atau `vite-bundle-visualizer`
  yang dijalankan pada build produksi.
- **Kapan**: setiap build di CI menghasilkan laporan visual bundle
  (treemap) sebagai artefak. Tim memeriksa laporan ini pada setiap
  pull request yang menambah atau memperbarui dependensi.
- **Yang dicari**: dependensi besar yang tidak disangka, duplikasi
  library (dua versi library yang sama di bundle), dan chunk rute
  yang terlalu besar.
- **Aturan**: pull request yang menambah dependensi baru wajib
  menyertakan perubahan ukuran bundle (sebelum/sesudah, gzip)
  di deskripsi pull request.

### 7.3 Log ukuran build di CI (gerbang anggaran)

- **Skrip CI** (contoh: `scripts/check-bundle-size.mjs`) berjalan
  setelah `npm run build` dan:
  1. Menghitung ukuran gzip setiap file JS/CSS di `dist/`.
  2. Menjumlahkan ukuran chunk awal (file yang dirujuk
     `index.html`).
  3. Membandingkan dengan anggaran bagian 1 (JS awal ≤ 200 KB,
     CSS ≤ 30 KB, total awal ≤ 250 KB).
  4. Gagal (exit non-nol) bila batas keras terlampaui, dengan
     pesan yang menyebut file dan ukuran yang melanggar.
  5. Mencatat ukuran ke log CI dan ke file `docs/ukuran-build.md`
     (diperbarui otomatis atau manual tiap rilis) agar tren ukuran
     antar rilis tercatat.
- **Pemeriksaan tambahan di skrip yang sama**:
  - String `jspdf` tidak ada di chunk awal.
  - Tidak ada string yang menyerupai kunci API di hasil build
    (pemeriksaan yang sama dengan kriteria selesai di `PRODUCT.md`
    bagian 9).
  - File `speedtest-1mb.bin` tidak dirujuk oleh `index.html`
    (tidak dimuat otomatis).

### 7.4 Pengukuran manual (sebelum rilis besar)

- **Perangkat nyata**: sebelum rilis besar, ukur di HP Android
  nyata (bukan emulator) dengan koneksi 4G yang dibatasi
  (atau throttling di Chrome DevTools dengan profil 4G lambat).
- **Yang diukur**: LCP dan TTI di `/`, `/dashboard`, `/wifi`;
  waktu unduh file tes 1 MB; dan waktu respons `GET /api/ping`.
- **Hasil dicatat** di catatan rilis (tanggal, perangkat, kondisi
  jaringan, angka yang didapat). Tanpa catatan ini, klaim "cepat"
  tidak dianggap terbukti.

### 7.5 Pemantauan D1 (anggaran query)

- **Dashboard Cloudflare**: pemakaian baris D1 (dibaca/ditulis
  per hari) dibaca dari dashboard Cloudflare secara berkala
  (minimal seminggu sekali selama fase aktif).
- **Log Worker**: log terstruktur (waktu, rute, status, durasi ms)
  dipakai untuk menemukan endpoint yang lambat (p50 > 500 ms).
- **Ambang peringatan**: bila pemakaian baca D1 mendekati 50%
  kuota harian (2,5 juta baris) pada tengah hari, tim menyelidiki
  penyebabnya di hari yang sama (kemungkinan: query tanpa indeks
  atau endpoint yang dipanggil berulang tanpa cache client).
- **Audit query berkala**: setiap rilis besar, seluruh query D1
  di Worker ditinjau ulang dengan `EXPLAIN QUERY PLAN` untuk
  memastikan tidak ada `SCAN` penuh tabel yang baru muncul.

## 8. Tanggung jawab dan proses perubahan

- **Pemilik dokumen**: Tim Performance Budget (penulis dokumen ini)
  bersama koordinator. Perubahan anggaran diputuskan koordinator
  dan dicatat di changelog bagian 9.
- **Menaikkan anggaran**: bila satu batas terbukti tidak dapat
  dipenuhi dengan alasan teknis yang sah (misalnya dependensi
  keamanan yang wajib dan besar), koordinator dapat menaikkan
  batas tersebut dengan catatan: angka lama, angka baru, alasan,
  dan tanggal. Kenaikan diam-diam (mengubah angka tanpa catatan)
  dilarang.
- **Menurunkan anggaran**: bila preseden baru membuktikan angka
  yang lebih ketat dapat dicapai (misalnya bundle awal turun ke
  60 KB gzip), target diperketat di rilis berikutnya.
- **Review**: dokumen ini ditinjau ulang setiap rilis besar dan
  setiap kali ada perubahan stack (dependensi baru, library grafik
  baru, atau perubahan skema D1).

## 9. Changelog dokumen

### 17 November 2026 — Fase 1 (dokumen awal)

- Anggaran performa pertama: bundle JS awal maks 200 KB gzip
  (target 100 KB), CSS maks 30 KB gzip, LCP target < 2,5 detik,
  TTI target < 3,5 detik di 4G lambat; strategi code-splitting,
  lazy load, font sistem, prefetch seperlunya, cache header, dan
  query D1 berindeks; anggaran API 1-3 query per request (batas
  platform 50 query); cara ukur Lighthouse CI,
  vite-bundle-visualizer, dan log ukuran build di CI; 14 pola
  terlarang.
