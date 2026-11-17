# docs/analytics.md: Rancangan Analitik Privacy-First — Dokter HP Web App

> **Status:** Fase 1 — dokumen rancangan, 17 November 2026.
> **Ruang lingkup:** dokumen rancangan saja; bukan implementasi.
> **Acuan:** `PRODUCT.md` (aturan produk: tanpa pelacakan pihak
> ketiga, tanpa iklan, tanpa pengiriman data diam-diam) dan
> `ARCHITECTURE.md` (stack Worker + D1, kuota D1 terverifikasi
> 17 November 2026: 5 juta baris dibaca/hari, 100 ribu baris
> ditulis/hari, 500 MB per database; KV writes hanya 1.000/hari).
>
> Prinsip utama: analitik ini menjawab tiga pertanyaan saja —
> berapa orang yang datang, berapa tes WiFi yang dijalankan, dan
> berapa pertanyaan AI yang diajukan — tanpa pernah tahu siapa
> mereka.

---

## 1. Prinsip

1. **Agregat saja, tanpa identitas.** Yang disimpan hanya angka
   jumlah per hari. Tidak ada satu baris pun yang bisa ditelusuri
   ke satu orang, satu perangkat, atau satu kunjungan.
2. **Tanpa pelacak pihak ketiga.** Tidak ada skrip analitik
   eksternal (tanpa Google Analytics, tanpa Meta Pixel, tanpa
   layanan sejenis) di halaman mana pun. Semua penghitungan
   terjadi di Worker dan D1 milik proyek sendiri.
3. **Tanpa cookie pelacak.** Analitik tidak membuat cookie,
   tidak membaca cookie, dan tidak memakai penyimpanan lokal
   browser (localStorage / sessionStorage / IndexedDB) untuk
   mengenali pengunjung.
4. **Tanpa pengiriman diam-diam.** Setiap pengiriman peristiwa
   analitik adalah efek samping dari aksi yang memang dilakukan
   pengguna (membuka halaman, menjalankan tes, bertanya ke AI) —
   bukan pengiriman latar belakang yang tersembunyi. Tidak ada
   peristiwa yang dikirim saat pengguna diam.
5. **Hemat kuota.** Satu baris per metrik per hari. Volume
   kunjungan memengaruhi jumlah penulisan, bukan jumlah baris.
   KV tidak dipakai sama sekali oleh analitik (lihat bagian 6).

---

## 2. Metrik yang dikumpulkan

Hanya tiga metrik. Tidak ada metrik lain, sekarang maupun nanti,
tanpa revisi dokumen ini dan persetujuan koordinator.

| # | Metrik | Kode peristiwa | Arti | Sumber hitungan |
|---|---|---|---|---|
| 1 | Kunjungan harian | `kunjungan` | Jumlah pemuatan halaman (page view) per hari, di semua layar | Client mengirim satu peristiwa per pemuatan halaman |
| 2 | Tes WiFi per hari | `tes_wifi` | Jumlah tes WiFi yang selesai dijalankan per hari (tes sekali jalan maupun tes bertahan 30 detik, masing-masing dihitung satu) | Client mengirim satu peristiwa saat tes selesai |
| 3 | Pertanyaan AI per hari | `pertanyaan_ai` | Jumlah pertanyaan yang dikirim ke Diagnosis AI per hari | **Dihitung di server** di dalam handler `POST /ai/diagnose` (lihat bagian 2.1) |

### 2.1 Mengapa pertanyaan AI dihitung di server

Pertanyaan AI hanya bisa terjadi lewat endpoint `POST /ai/diagnose`
yang sudah terautentikasi (lihat `ARCHITECTURE.md` bagian 3.4).
Menghitungnya di server — satu penambahan penghitung di dalam
handler yang sama — membuat angka ini otoritatif: tidak bisa
dipalsukan dari browser, tidak bisa dikirim ganda oleh client yang
nakal, dan tidak butuh satu pun request tambahan dari browser.
Endpoint peristiwa (`/api/analytics/event`, bagian 4) **menolak**
peristiwa `pertanyaan_ai` dari client (HTTP 400); satu-satunya
jalan yang sah adalah penambahan penghitung di sisi server.

Catatan kejujuran: angka `pertanyaan_ai` adalah jumlah pertanyaan
yang **diterima** server, bukan jumlah jawaban yang berhasil.
Pertanyaan yang gagal karena Gemini tidak tersedia tetap
terhitung — yang diukur adalah pemakaian fitur, bukan keberhasilan
layanan AI. Bila di masa depan diperlukan angka keberhasilan,
tambahkan metrik baru lewat revisi dokumen ini, bukan dengan
mengubah arti metrik yang sudah ada.

### 2.2 Yang TIDAK dihitung dari metrik ini

- Tidak ada "pengunjung unik" — menghitung orang unik butuh
  mengenali orang, dan itu dilarang oleh prinsip 1.
- Tidak ada durasi kunjungan, tidak ada jalur halaman
  (halaman A lalu halaman B), tidak ada rasio pentalan.
- Tidak ada pembedaan perangkat, browser, negara, kota, atau
  bahasa — semua itu butuh data yang tercantum di daftar larangan
  (bagian 3).

---

## 3. Yang TIDAK dikumpulkan (daftar eksplisit)

Daftar ini mengikat. Bila satu butir di bawah ini ternyata
terkumpul — sengaja atau tidak — itu adalah cacat yang wajib
diperbaiki, bukan fitur.

| # | Data | Alasan larangan |
|---|---|---|
| 1 | Identitas pengguna (id pengguna, email, nama, `google_sub`) | Analitik tidak boleh bisa dikaitkan ke akun |
| 2 | Alamat IP (mentah maupun sebagian, mis. /24) | Pengenal jaringan pengguna |
| 3 | User-Agent (mentah maupun yang dipilah: browser, OS, model HP) | Dipakai untuk fingerprint |
| 4 | Fingerprint apa pun (canvas, WebGL, font, layar, zona waktu, bahasa) | Pelacakan tanpa cookie |
| 5 | Cookie pelacak dan pengenal lintas kunjungan apa pun | Melanggar prinsip 3 |
| 6 | Isi pertanyaan AI dan isi jawaban AI | Data pribadi pengguna; bukan urusan analitik |
| 7 | Hasil tes WiFi (kecepatan, latensi, SSID, channel, DNS, IP publik) | Data pemeriksaan milik pengguna; analitik hanya menghitung **jumlah** tes |
| 8 | Skor kesehatan dan isi riwayat pemeriksaan | Data kesehatan perangkat milik pengguna |
| 9 | Lokasi (GPS, kota, negara, perkiraan dari IP) | Tidak diperlukan untuk tiga metrik |
| 10 | Referrer (situs asal pengunjung) | Bisa mengungkap konteks pribadi pengguna |
| 11 | Jejak klik, gerakan tetikus, gulir halaman, dan rekaman sesi | Pengawasan perilaku |
| 12 | Data dari pihak ketiga (iklan, broker data, SDK analitik) | Melanggar prinsip 2 |
| 13 | Token sesi, PIN, atau hash-nya | Kredensial; tidak ada urusan dengan analitik |

Catatan khusus tentang **rate limit** (bagian 4.4): untuk membatasi
banjir request, Worker boleh menyimpan **hash** alamat IP yang
dicampur garam harian (`SHA-256(IP + garam tanggal)`). Hash ini
bukan alamat IP mentah, tidak bisa dibalik menjadi IP, berubah
setiap hari sehingga tidak bisa dipakai melacak lintas hari, dan
hidup paling lama 1 hari. Hash ini disimpan di tabel rate limit
yang terpisah (lihat `ARCHITECTURE.md` bagian 6.1) dan **tidak
pernah** digabungkan dengan tabel analitik. Bila rate limit
diimplementasikan dengan fitur platform Cloudflare (bukan tabel
D1), hash ini bahkan tidak pernah ditulis ke database.

---

## 4. Penyimpanan

### 4.1 Tabel agregat harian

Satu tabel, satu baris per metrik per hari:

```sql
-- Migrasi 0002_analytics.sql (rancangan; diterapkan tim implementasi)
CREATE TABLE IF NOT EXISTS analytics_daily (
  tanggal TEXT NOT NULL,          -- 'YYYY-MM-DD', zona waktu UTC
  metrik TEXT NOT NULL,           -- 'kunjungan' | 'tes_wifi' | 'pertanyaan_ai'
  jumlah INTEGER NOT NULL DEFAULT 0,
  diperbarui_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tanggal, metrik),
  CHECK (metrik IN ('kunjungan', 'tes_wifi', 'pertanyaan_ai')),
  CHECK (jumlah >= 0)
);
```

Sifat-sifat penting:

- **Tidak ada kolom pengguna.** Tidak ada `user_id`, tidak ada
  kolom pengenal apa pun. Baris ini hanya berkata "pada tanggal X,
  metrik Y terjadi N kali".
- **Tanggal dalam UTC.** Satu hari analitik adalah satu hari
  kalender UTC (00:00–23:59 UTC), sama dengan jendela reset kuota
  D1 (lihat `ARCHITECTURE.md` bagian 6.3). Ini membuat angka
  harian selaras dengan angka pemakaian kuota di dashboard
  Cloudflare.
- **Kunci utama gabungan** `(tanggal, metrik)` menjamin tidak
  pernah ada dua baris untuk metrik yang sama di hari yang sama.

### 4.2 Cara penulisan: UPSERT penambahan

Setiap peristiwa menaikkan penghitung satu baris yang sudah ada
(atau membuat baris baru bila hari ini belum ada barisnya):

```sql
INSERT INTO analytics_daily (tanggal, metrik, jumlah, diperbarui_pada)
VALUES (?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT (tanggal, metrik)
DO UPDATE SET
  jumlah = jumlah + 1,
  diperbarui_pada = excluded.diperbarui_pada;
```

Satu peristiwa = satu statement = satu baris ditulis (D1
menghitung baris yang ditulis per statement). Volume kunjungan
**tidak** menambah jumlah baris: 10 kunjungan atau 10.000
kunjungan dalam sehari tetap menghasilkan 1 baris untuk metrik
`kunjungan` hari itu. Yang bertambah hanyalah angka `jumlah` dan
jumlah penulisan harian (lihat estimasi di bagian 6).

### 4.3 Retensi

- Baris agregat harian disimpan **tanpa batas waktu** selama
  ukurannya masuk akal: 3 baris per hari adalah ±1.095 baris per
  tahun (lihat bagian 6.3) — dapat diabaikan terhadap batas
  500 MB per database.
- Tidak ada data mentah per peristiwa yang disimpan, sehingga
  tidak ada data mentah yang perlu dihapus.
- Bila suatu hari diputuskan menghapus riwayat analitik lama,
  penghapusan dilakukan per tanggal (`DELETE ... WHERE tanggal
  < ?`) — sederhana karena data sudah agregat per hari.

### 4.4 Catatan tentang rate limit dan KV

Analitik tidak memakai KV sama sekali. KV writes hanya 1.000/hari
(lihat `ARCHITECTURE.md` bagian 1.1) terlalu sedikit untuk sesi,
apalagi untuk peristiwa analitik — dan memang tidak diperlukan:
semua yang dibutuhkan analitik tinggal di D1. Rate limit peristiwa
mengikuti mekanisme yang sama dengan endpoint lain (tabel D1 kecil
atau fitur platform, diputuskan tim implementasi — lihat
`ARCHITECTURE.md` bagian 6.1), bukan KV.

---

## 5. Endpoint Worker

### 5.1 `POST /api/analytics/event`

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/analytics/event` |
| Autentikasi | Publik (tanpa sesi) — kunjungan tanpa akun tetap dihitung, sesuai `PRODUCT.md` bagian 4.1 |
| Content-Type | `application/json` |
| Batas ukuran body | Maksimum 1 KB; body yang lebih besar ditolak (HTTP 413) |
| Respons sukses | HTTP 204 tanpa body (tidak ada data yang perlu dikembalikan) |
| Respons galat | Envelope galat standar (lihat `ARCHITECTURE.md` bagian 3) |

Request body — hanya satu field:

```json
{ "event": "kunjungan" }
```

Nilai `event` yang sah: `kunjungan`, `tes_wifi`. Nilai lain —
termasuk `pertanyaan_ai` (dihitung di server, bagian 2.1) —
ditolak dengan HTTP 400 dan kode `EVENT_TIDAK_DIKENAL`.

### 5.2 Validasi ketat

Validasi dilakukan di Worker **sebelum** query D1 apa pun
(mengikuti pola `validation.ts` di `ARCHITECTURE.md` bagian 2.2):

1. Body harus JSON yang valid dan berupa objek.
2. Field `event` wajib ada, wajib string, wajib salah satu dari
   `kunjungan` / `tes_wifi`.
3. Field lain apa pun diabaikan — tidak disimpan, tidak dibaca.
   (Mengabaikan, bukan menolak, agar client versi lama yang
   mengirim field tambahan tidak rusak.)
4. Header `Origin` wajib salah satu dari dua origin frontend
   (Pages dan Vercel) — sama seperti endpoint tulis lain
   (lihat `ARCHITECTURE.md` bagian 6.2).
5. Tidak ada autentikasi yang dibaca: cookie sesi, bila ada,
   **tidak** dipakai untuk mengaitkan peristiwa ke pengguna.
   Worker tidak memanggil verifikasi sesi di endpoint ini.

### 5.3 Rate limit

| Batas | Nilai | Alasan |
|---|---|---|
| Per IP | 60 peristiwa/menit | Sama dengan batas endpoint tulis umum (`ARCHITECTURE.md` bagian 6.1); cukup untuk pemakaian normal (satu pemuatan halaman = 1 peristiwa) dan menghentikan banjir sederhana |
| Per IP, peristiwa `tes_wifi` | 10/menit | Tes WiFi memakan waktu (unduh 1 MB + latensi); lebih dari 10 tes selesai per menit dari satu IP bukan pemakaian manusia |

Respons saat kena batas: HTTP 429 dengan envelope galat standar
dan pesan bahasa sehari-hari ("Terlalu sering, coba lagi
sebentar"), sama seperti endpoint lain. Client **tidak** mencoba
ulang peristiwa yang ditolak — peristiwa analitik yang hilang
lebih baik daripada membanjiri server.

Penegakan memakai hash IP + garam harian (bagian 3, catatan
khusus). Hash disimpan di mekanisme rate limit yang sudah ada,
bukan di tabel analitik.

### 5.4 Pengiriman dari client

- **Kunjungan:** frontend mengirim satu peristiwa `kunjungan`
  sekali per pemuatan halaman (bukan per perubahan rute di dalam
  aplikasi satu halaman — navigasi antarlayar tanpa muat ulang
  tidak dihitung sebagai kunjungan baru). Pengiriman memakai
  `fetch` biasa dengan `keepalive: true` agar tidak tertunda
  saat pengguna menutup halaman; kegagalan pengiriman diabaikan
  diam-diam (analitik tidak boleh mengganggu pengguna atau
  menampilkan galat).
- **Tes WiFi:** frontend mengirim satu peristiwa `tes_wifi`
  setelah satu tes selesai (tes sekali jalan atau tes bertahan
  30 detik). Tes yang dibatalkan pengguna atau gagal karena
  timeout tidak dihitung.
- **Tidak ada pengiriman berkala.** Tidak ada timer, tidak ada
  "denyut" (heartbeat), tidak ada pengiriman saat pengguna diam.

### 5.5 Endpoint baca (dasbor admin)

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/analytics/summary?hari=30` | 🔒 Admin (lihat bagian 6) | Ringkasan tiga metrik per hari selama N hari terakhir (N = 1–90, default 30) |

Respons:

```json
{
  "success": true,
  "data": {
    "hari": [
      { "tanggal": "2026-11-17", "kunjungan": 132, "tes_wifi": 41, "pertanyaan_ai": 9 }
    ],
    "total": { "kunjungan": 132, "tes_wifi": 41, "pertanyaan_ai": 9 }
  },
  "meta": { "timestamp": "..." }
}
```

Query D1-nya satu statement berindeks (kunci utama `(tanggal,
metrik)`), memakai `WHERE tanggal >= ?`, tanpa pemindaian tabel
penuh:

```sql
SELECT tanggal, metrik, jumlah
FROM analytics_daily
WHERE tanggal >= date('now', '-' || ? || ' days')
ORDER BY tanggal DESC, metrik;
```

**Catatan:** contoh angka pada respons di atas adalah ilustrasi
format, bukan data nyata.

### 5.6 Akses admin

Dokter HP Web App belum memiliki peran admin di `PRODUCT.md` /
`ARCHITECTURE.md`. Sampai peran itu dirancang, endpoint baca
analitik dibatasi sebagai berikut:

- Hanya pengguna yang masuk (sesi valid) yang boleh memanggilnya.
- Daftar id pengguna admin disimpan sebagai secret Worker
  (`ADMIN_USER_IDS`, daftar id dipisah koma) — bukan di kode,
  bukan di repo.
- Pengguna yang masuk tetapi bukan admin mendapat HTTP 403.
- Pengguna tanpa sesi mendapat HTTP 401.
- Peran admin yang lebih rapi (kolom `role` di tabel `users`)
  adalah pekerjaan fase berikutnya; rancangan ini sengaja tidak
  mengubah skema pengguna.

---

## 6. Halaman dasbor admin (rencana saja)

**Ini rencana, bukan implementasi.** Tidak ada kode dasbor yang
ditulis sebagai bagian dari dokumen ini.

### 6.1 Rute dan akses

- Rute: `/admin/analytics` (di luar 11 layar publik di
  `PRODUCT.md` bagian 6).
- Hanya bisa dibuka pengguna yang masuk dan terdaftar sebagai
  admin (bagian 5.6). Pengguna bukan admin yang membuka rute ini
  diarahkan ke `/dashboard` dengan pesan jujur.
- Tautan ke dasbor tidak tampil di navigasi umum; hanya di menu
  admin (atau diketik langsung).

### 6.2 Isi halaman

1. **Tiga kartu angka** — total kunjungan, total tes WiFi, total
   pertanyaan AI dalam rentang yang dipilih (default 30 hari).
2. **Grafik garis harian** — tiga garis (satu per metrik) dari
   data real endpoint `/api/analytics/summary`; bila belum ada
   data, tampil empty state jujur "Belum ada data" (mengikuti
   prinsip kejujuran data `PRODUCT.md` bagian 8 — tanpa angka
   contoh).
3. **Pemilih rentang** — 7 / 30 / 90 hari.
4. **Tabel harian** — tanggal dan tiga angka per hari, terbaru
   dulu, dengan paginasi bila perlu.
5. **Keterangan kejujuran** — satu baris di bawah grafik:
   "Angka dihitung dari kunjungan dan pemakaian fitur, tanpa
   mengenali siapa pun." (Kalimat persisnya mengikuti teks
   transparansi di bagian 7.)

### 6.3 Yang TIDAK ada di dasbor

- Tidak ada daftar pengunjung, tidak ada detail per kunjungan,
  tidak ada rincian per pengguna — data itu tidak pernah
  dikumpulkan, jadi tidak mungkin ditampilkan.
- Tidak ada ekspor data mentah — yang ada hanya angka agregat
  yang memang tampil di layar.
- Tidak ada grafik waktu nyata (real-time): data diperbarui
  setiap kali halaman dimuat ulang; tidak ada polling otomatis.

---

## 7. Estimasi konsumsi kuota D1

Semua angka di bagian ini dihitung dari asumsi yang dinyatakan
di bawah, dengan rumus yang ditampilkan. Tidak ada angka yang
diambil dari perkiraan tanpa dasar.

### 7.1 Kuota acuan (terverifikasi, `ARCHITECTURE.md` bagian 6.3)

| Kuota D1 (free tier) | Nilai |
|---|---|
| Baris dibaca per hari | 5.000.000 |
| Baris ditulis per hari | 100.000 |
| Ukuran per database | 500 MB |

### 7.2 Asumsi pemakaian

| Asumsi | Nilai | Dasar asumsi |
|---|---|---|
| Kunjungan per hari | 100 | Skenario awal produk baru; dipakai sebagai contoh hitungan, bukan proyeksi trafik |
| Tes WiFi per hari | 30 | 30% dari kunjungan menjalankan tes (asumsi ilustratif) |
| Pertanyaan AI per hari | 10 | 10% dari kunjungan bertanya ke AI (asumsi ilustratif) |
| Muat dasbor admin per hari | 10 | Admin memeriksa dasbor beberapa kali sehari |
| Rentang dasbor default | 30 hari | Sesuai bagian 5.5 |

Rumus umum (berlaku untuk skenario apa pun):

- **Baris baru per hari** = 3 (satu per metrik), tidak bergantung
  pada volume kunjungan.
- **Baris ditulis per hari** = kunjungan + tes WiFi + pertanyaan
  AI (satu UPSERT = satu baris ditulis per peristiwa).
- **Baris dibaca per muat dasbor** = 3 × jumlah hari dalam
  rentang (satu baris per metrik per hari).
- **Ukuran satu baris** ≈ 100 byte (tanggal 10 karakter + metrik
  ±13 karakter + angka + stempel waktu + overhead SQLite; angka
  perkiraan konservatif, dibulatkan ke atas).

### 7.3 Hitungan skenario dasar (100 kunjungan/hari)

| Ukuran | Rumus | Hasil |
|---|---|---|
| Baris baru per hari | 3 metrik × 1 hari | **3 baris/hari** |
| Baris baru per bulan (30 hari) | 3 × 30 | **90 baris** |
| Baris baru per tahun | 3 × 365 | **1.095 baris** |
| Baris ditulis per hari | 100 + 30 + 10 | **140 baris/hari** |
| Pemakaian kuota tulis harian | 140 ÷ 100.000 × 100% | **0,14%** |
| Baris dibaca per muat dasbor | 3 × 30 hari | **90 baris** |
| Baris dibaca per hari (dasbor) | 90 × 10 muat | **900 baris/hari** |
| Pemakaian kuota baca harian | 900 ÷ 5.000.000 × 100% | **0,018%** |
| Ukuran data per tahun | 1.095 baris × 100 byte | **±110 KB/tahun** |
| Pemakaian batas 500 MB per tahun | 110 KB ÷ 500 MB × 100% | **±0,02%** |

### 7.4 Hitungan skenario besar (1.000 kunjungan/hari)

Asumsi skala: kunjungan 1.000/hari, tes WiFi 300/hari (30%),
pertanyaan AI 100/hari (10%), muat dasbor tetap 10/hari.

| Ukuran | Rumus | Hasil |
|---|---|---|
| Baris baru per hari | 3 metrik × 1 hari | **3 baris/hari** (tidak berubah) |
| Baris ditulis per hari | 1.000 + 300 + 100 | **1.400 baris/hari** |
| Pemakaian kuota tulis harian | 1.400 ÷ 100.000 × 100% | **1,4%** |
| Baris dibaca per hari (dasbor) | 90 × 10 muat | **900 baris/hari** (tidak berubah) |
| Pemakaian kuota baca harian | 900 ÷ 5.000.000 × 100% | **0,018%** |

### 7.5 Titik jenuh

Kuota tulis D1 (100.000 baris/hari) baru habis oleh analitik
sendirian bila total peristiwa mencapai 100.000/hari — dengan
rasio skenario di atas (1 kunjungan : 0,3 tes : 0,1 pertanyaan =
1,4 peristiwa per kunjungan), itu setara dengan:

- 100.000 ÷ 1,4 = **±71.400 kunjungan/hari**.

Pada titik itu, produk sudah jauh melampaui skala awal, dan
langkah mitigasinya adalah menggabungkan peristiwa di client
(mengirim satu peristiwa per sesi, bukan per pemuatan halaman)
atau memindahkan penghitungan kunjungan ke log Worker — bukan
menambah pelacak. Mitigasi ini dicatat di sini sebagai rencana,
bukan diimplementasikan sekarang.

### 7.6 KV

Analitik memakai **0 tulis KV per hari**. Batas KV 1.000
tulis/hari tidak tersentuh sama sekali oleh rancangan ini.

---

## 8. Transparansi untuk kebijakan privasi

Teks di bawah ini adalah draf yang bisa disalin ke halaman
kebijakan privasi produk. Bahasa disesuaikan dengan aturan
`PRODUCT.md` bagian 8 dan 10: bahasa sehari-hari, tanpa istilah
teknis yang tidak perlu, tanpa klaim yang menenangkan secara
berlebihan.

> **Statistik pemakaian (analitik)**
>
> Dokter HP menghitung tiga angka saja: berapa kali halaman
> dibuka setiap hari, berapa tes WiFi yang dijalankan setiap
> hari, dan berapa pertanyaan yang diajukan ke Diagnosis AI
> setiap hari. Angka-angka ini disimpan sebagai jumlah harian —
> misalnya "pada 17 November 2026 ada 132 kali halaman dibuka" —
> dan dipakai hanya untuk mengetahui apakah aplikasi ini dipakai
> dan fitur mana yang paling membantu.
>
> Yang tidak kami kumpulkan: kami tidak tahu siapa Anda dari
> statistik ini. Kami tidak menyimpan alamat IP Anda, tidak
> menyimpan informasi perangkat atau browser Anda, tidak memakai
> cookie pelacak, tidak memakai layanan analitik pihak ketiga,
> dan tidak merekam apa yang Anda ketik, apa hasil tes Anda,
> atau halaman apa saja yang Anda buka. Statistik ini tidak bisa
> dipakai untuk mengenali satu orang.
>
> Karena yang disimpan hanya jumlah harian tanpa identitas,
> tidak ada data statistik yang perlu dihapus saat Anda menghapus
> akun — tidak ada satu pun angka di statistik yang terhubung
> ke akun Anda.

Catatan untuk tim implementasi: bila kebijakan privasi akhirnya
ditulis dengan redaksi berbeda, redaksi itu wajib tetap benar
secara teknis terhadap rancangan ini — khususnya klaim "tidak
menyimpan alamat IP" (benar: IP mentah tidak pernah ditulis ke
tabel analitik; hash IP untuk rate limit hidup paling lama 1 hari
di tabel terpisah dan tidak digabungkan dengan analitik).

---

## 9. Daftar periksa implementasi (untuk tim berikutnya)

- [ ] Migrasi `0002_analytics.sql` — tabel `analytics_daily`
      (bagian 4.1).
- [ ] Rute `POST /api/analytics/event` di Worker — validasi
      ketat (bagian 5.2) + rate limit (bagian 5.3).
- [ ] Penambahan penghitung `pertanyaan_ai` di dalam handler
      `POST /ai/diagnose` (bagian 2.1).
- [ ] Rute `GET /api/analytics/summary` + pembatasan admin
      lewat secret `ADMIN_USER_IDS` (bagian 5.5–5.6).
- [ ] Pengiriman peristiwa dari frontend: `kunjungan` sekali
      per pemuatan halaman, `tes_wifi` saat tes selesai
      (bagian 5.4). Kegagalan pengiriman diabaikan diam-diam.
- [ ] Halaman `/admin/analytics` sesuai rencana bagian 6
      (kartu angka, grafik garis, pemilih rentang, tabel harian).
- [ ] Uji: kirim peristiwa, periksa angka bertambah tepat 1;
      kirim `event` tidak dikenal, pastikan HTTP 400; kirim
      `pertanyaan_ai` dari client, pastikan HTTP 400; banjir
      61 peristiwa/menit dari satu IP, pastikan HTTP 429;
      buka dasbor sebagai bukan admin, pastikan HTTP 403.
- [ ] Uji privasi: periksa isi tabel `analytics_daily` — pastikan
      hanya ada kolom tanggal, metrik, jumlah, dan stempel
      waktu; pastikan tidak ada kolom pengenal.
- [ ] Teks transparansi (bagian 8) masuk ke halaman kebijakan
      privasi.

---

## 10. Changelog dokumen

### 17 November 2026 — Fase 1 (dokumen awal)

- Rancangan analitik privacy-first pertama: tiga metrik agregat
  anonim, daftar eksplisit data yang tidak dikumpulkan, tabel
  agregat harian (1 baris per metrik per hari), endpoint
  `POST /api/analytics/event`, rencana dasbor admin, estimasi
  kuota D1 dengan asumsi dan rumus, draf teks transparansi
  untuk kebijakan privasi.
