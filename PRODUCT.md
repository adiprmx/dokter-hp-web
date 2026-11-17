# PRODUCT.md: Dokter HP Web App

> **Dokumen ini adalah spesifikasi produk (PRD) Dokter HP versi web
> (full-stack).**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen (PRD + Arsitektur),
> 17 November 2026.
>
> Dokumen ini adalah pendamping web dari APK Dokter HP v1.1.0
> (repo `adiprmx/dokter-hp`). PRD APK tetap menjadi sumber kebenaran
> untuk perilaku aplikasi Android; dokumen ini mengatur apa yang sama,
> apa yang berbeda, dan apa yang tidak bisa dilakukan di web.

---

## 1. Nama dan tujuan

**Dokter HP Web App** adalah versi web dari Dokter HP: aplikasi web
full-stack yang mendeteksi, menjelaskan, dan membantu memperbaiki
masalah HP sehari-hari — WiFi lemot, baterai boros, penyimpanan penuh,
performa berat, dan keamanan — lewat browser, tanpa memasang aplikasi.

### 1.1 Latar belakang

Kasus yang melahirkan Dokter HP: WiFi ACHA, router ZTE F660, WiFi 4
(802.11n), kecepatan koneksi 65 Mbps dengan sinyal sangat bagus, tetapi
kecepatan unduh jatuh dari 50 KB/detik ke 3,2 KB/detik, sementara HP
lain di jaringan yang sama normal dan data seluler lancar tetapi tidak
ada kuota. Penyebab paling mungkin adalah mode router 802.11b Only
(teknologi 1999, maksimal 11 Mbps) — solusinya mengubah mode ke
802.11b/g/n Mixed di halaman admin router.

Versi web menjawab kasus yang sama dari browser: pengguna membuka
halaman, mengukur kecepatan nyata koneksinya, melihat apakah masalah
ada di WiFi atau di HP, dan mendapat rekomendasi yang bisa dilakukan —
termasuk ganti channel router 2,4 GHz ke 1, 6, atau 11 — dengan
penjelasan jujur tentang langkah yang tidak bisa dilakukan aplikasi
web karena batasan browser.

### 1.2 Tujuan produk

1. Pengguna tahu kondisi nyata HP-nya dalam satu ketuk (skor 0-100),
   dari browser mana pun.
2. Pengguna tahu kecepatan WiFi sebenarnya lewat tes unduh dan latensi
   HTTP yang diukur langsung di browser.
3. Pengguna mendapat langkah perbaikan yang nyata, bukan janji palsu.
4. Riwayat pemeriksaan tersimpan di akun pengguna dan bisa dibuka dari
   perangkat mana pun.
5. Diagnosis AI tersedia lewat server, dengan kunci API yang tidak
   pernah menyentuh browser.

### 1.3 Bukan tujuan

- Bukan aplikasi penguat sinyal, bukan VPN, bukan "pembersih RAM".
- Bukan pengganti teknisi untuk kerusakan perangkat keras.
- Bukan alat pembayaran. Tanpa payment gateway.
- Bukan pengganti APK: web tidak bisa membaca sensor HP langsung
  (lihat bagian 11, Batasan jujur web).

## 2. Pengguna

| Aspek | Keterangan |
|---|---|
| Pengguna utama | Pemilik HP Android umum, bukan teknisi |
| Perangkat utama | HP Android, layar mulai 360 px (phone-first) |
| Perangkat lain | Tablet dan desktop (tata letak melebar, bukan sekadar diperbesar) |
| Bahasa | Bahasa Indonesia |
| Kondisi | Bekerja dari HP, tanpa PC; koneksi internet kadang lemot |

### 2.1 Phone-first

Owner hanya memakai HP. Semua layar dirancang dulu untuk lebar 360 px,
lalu melebar ke tablet dan desktop. Area sentuh minimal 48 px.
Teks sekunder kontras minimal 4,5:1 terhadap latar (WCAG AA).
Tidak ada aksi yang hanya bisa dilakukan dengan tetikus (hover saja
tidak cukup — selalu ada cara ketuk).

## 3. Konsep desain

Konsep desain mengikuti APK v1.1.0: **"Alat ukur"** — tema gelap,
basis hitam/abu/putih, aksen putih. Tanpa warna dekoratif (tanpa
kuning/amber). Warna hanya untuk fungsi/status: kuning = pending,
merah = galat/gagal, hijau = valid/sukses, biru = info penting.
Tanpa font serif Didone/Playfair. Font sistem atau font sans yang
sudah tersedia, tanpa unduhan font yang bisa gagal saat koneksi lemot.

## 4. Fitur

### 4.1 Landing

- Halaman depan publik (tanpa login): nama produk, penjelasan singkat
  apa yang dilakukan Dokter HP, dan tombol masuk/daftar.
- Tombol **Coba tes WiFi tanpa akun**: tes kecepatan dan latensi bisa
  dijalankan tanpa masuk; hasilnya tampil di layar tetapi tidak
  tersimpan ke riwayat (penyimpanan riwayat butuh akun).
- Penjelasan jujur satu baris tentang batasan web: "Versi web mengukur
  koneksi Anda; data baterai, penyimpanan, dan performa diisi manual
  atau dari riwayat APK."
- Tautan ke APK (repo publik `adiprmx/dokter-hp`) bagi pengguna yang
  butuh pembacaan sensor langsung.

### 4.2 Auth (masuk dan akun)

- **Masuk dengan Google** (OAuth, authorization code flow; penukaran
  kode terjadi di server, secret tidak pernah ada di browser).
- **PIN 4-8 digit** sebagai kunci aplikasi web, cermin APK: disimpan
  sebagai hash SHA-256 + salt di server; PIN asli tidak pernah
  disimpan. Setelah 5 kali PIN salah berturut-turut, masukan dikunci
  30 detik.
- **Gerbang kunci**: bila PIN sudah diatur, aplikasi web menampilkan
  layar kunci PIN sebelum dashboard setiap kali sesi baru dimulai.
  Bila PIN belum diatur, aplikasi langsung terbuka tanpa memaksa;
  penawaran mengatur PIN ada di Pengaturan.
- **Biometrik**: tidak tersedia di web app versi ini. Autentikasi
  biometrik adalah fitur APK (sidik jari/wajah lewat sistem Android).
  Web memakai PIN + sesi Google.
- **Pemulihan bila PIN lupa**: PIN hanya tersimpan sebagai hash,
  jadi tidak ada reset lewat server. Jalan pemulihan: masuk ulang
  dengan Google, lalu atur PIN baru dari Pengaturan. Riwayat yang
  sudah tersimpan di server tetap aman. (Berbeda dari APK yang
  mengharuskan hapus data aplikasi; di web, identitas Google adalah
  jangkar pemulihan.)
- **Keluar**: menghapus sesi di server dan di browser.

### 4.3 Dashboard

- Skor kesehatan HP 0-100 beserta kategori (Baik / Cukup / Perlu
  perhatian), dihitung dari komponen yang datanya tersedia.
- Tombol **Diagnosis satu ketuk**: menghitung skor dari data yang ada
  (hasil tes WiFi web + data perangkat yang diisi manual + riwayat
  tersinkron dari APK bila ada), lalu menyimpan hasilnya ke riwayat.
- Kartu tiap dokter: WiFi, Baterai, Penyimpanan, Performa, Keamanan, AI.
- **Grafik riwayat skor**: garis skor dari waktu ke waktu (data real
  dari riwayat pengguna; bila belum ada data, grafik diganti empty
  state "Belum ada data pemeriksaan").
- Tiga pemeriksaan terakhir.
- Banner status jujur bila backend tidak terjangkau: "Tidak tersambung
  ke server — hasil tes tidak tersimpan" (tes WiFi tetap bisa jalan
  lokal di browser).

### 4.4 Dokter WiFi (fitur utama, versi web)

- **Tes kecepatan unduh**: mengunduh file 1 MB dari aset statis milik
  sendiri (di-host di Pages yang sama), timeout 15 detik; hasil dalam
  KB/detik atau MB/detik. Klasifikasi sama dengan APK: sangat lambat
  (< 50), lambat (< 200), cukup (< 1000), cepat (< 5000), sangat cepat
  (>= 5000). Pengukuran dilakukan di browser; server hanya menyajikan
  file statis.
- **Latensi HTTP**: round-trip request kecil ke endpoint API;
  dilabeli "latensi HTTP" karena browser tidak bisa mengirim ping
  ICMP mentah.
- **Info jaringan (yang bisa dibaca browser)**: alamat IP publik
  (dari Worker), jenis koneksi bila tersedia lewat Network Information
  API (`navigator.connection`), dan estimasi kecepatan unduh dari API
  yang sama bila tersedia. SSID, gateway, DNS, RSSI, dan channel
  **tidak bisa dibaca browser** — kolom-kolom itu diisi manual oleh
  pengguna bila ia mengetahuinya (misalnya dari halaman admin router
  atau dari APK), atau dibiarkan kosong dan tampil "tidak tersedia".
- **Rekomendasi**: pindah dekat router bila sinyal lemah (berdasarkan
  input manual atau hasil tes); tutup unduhan lain bila latensi
  tinggi; ganti channel router ke 1, 6, atau 11 di pita 2,4 GHz
  (hanya ketiganya yang tidak saling tumpang tindih).
- **Tes bertahan 30 detik**: tes yang berjalan terus selama 30 detik
  untuk mengukur apakah kecepatan bertahan dari awal sampai akhir,
  atau mulai cepat kemudian jatuh di tengah jalan. Sampel per detik
  disimpan (tabel `wifi_sustained_samples`) dan ditampilkan sebagai
  grafik garis.
- **Pemantau live**: tampilan angka kecepatan dan latensi yang
  diperbarui selama tes berjalan.
- **Panduan WiFi turun**: kartu panduan dari APK v1.0.1 (patokan
  normal 1 MB/detik, biasanya di atas 2 MB/detik; mode router
  802.11b Only sebagai penyebab paling mungkin; dua tes pembeda
  untuk menentukan apakah masalah ada di HP, router, atau jaringan).
- **Perbaikan**: penjelasan langkah manual — ganti DNS (1.1.1.1 /
  8.8.8.8), lupakan jaringan, ganti channel router (contoh ZTE F660).
  Web tidak bisa membuka pengaturan WiFi sistem; langkahnya dijelaskan
  sebagai teks panduan.
- **Bagikan hasil**: salin teks ringkasan ke clipboard (Web Share API
  bila tersedia di perangkat).
- Hasil pemeriksaan tersimpan otomatis ke riwayat bila pengguna masuk.

### 4.5 Riwayat Baterai, Penyimpanan, Performa, Keamanan

Keempat dokter ini di web bersifat **riwayat + input manual**, karena
browser tidak bisa membaca sensor perangkat:

- **Dokter Baterai**: menampilkan entri riwayat (level %, status
  mengisi/dipakai/penuh, mode hemat daya) yang berasal dari APK yang
  tersinkron atau dari input manual pengguna. Estimasi waktu pakai
  dilabeli jelas sebagai perkiraan (asumsi pemakaian rata-rata 10%
  per jam), bukan pengukuran pasti. Penjelasan jujur: daftar aplikasi
  boros baterai tidak bisa ditampilkan; pengguna diarahkan ke
  Pengaturan > Baterai di HP-nya. Tips merawat baterai.
- **Dokter Penyimpanan**: entri riwayat (total, terpakai, kosong)
  beserta bilah pemakaian, dari APK atau input manual. Tidak ada tombol
  bersihkan cache di web (cache yang dibersihkan APK adalah cache
  aplikasi APK itu sendiri; browser tidak punya akses itu).
- **Dokter Performa**: entri riwayat (RAM total/kosong, pemakaian CPU,
  suhu bila tersedia, info perangkat: merek/model, versi Android,
  prosesor) dari APK atau input manual. Penjelasan jujur: web tidak
  bisa menutup aplikasi lain; pengguna diarahkan ke layar aplikasi
  terakhir atau mulai ulang HP.
- **Dokter Keamanan**: entri riwayat daftar aplikasi terpasang dan
  jumlah izin berbahaya per aplikasi dari APK. Bagian "Perlu ditinjau":
  aplikasi non-sistem dengan 4+ izin berbahaya. Saran: tinjau dan hapus
  lewat Pengaturan > Aplikasi bila tidak dikenal. Di web tidak ada
  pemindaian baru — data hanya berasal dari APK.
- Setiap dokter menampilkan tanggal dan sumber setiap entri
  ("dari APK" / "diisi manual") agar pengguna tahu asal datanya.

### 4.6 Diagnosis AI

- Pengguna menulis keluhan; web mengirim keluhan + ringkasan data
  perangkat (dari riwayat dan hasil tes terakhir) ke Worker API.
- Worker memanggil Gemini dengan kunci yang hanya tersimpan sebagai
  secret di sisi server. Kunci tidak pernah ada di browser dan tidak
  ada di repo.
- Jawaban tampil dan tersimpan ke riwayat diagnosis.
- Jawaban AI dilabeli sebagai saran, bukan vonis pasti.
- Model AI utama adalah Gemini Flash-Lite. Bila kuota habis atau
  layanan tidak tersedia, fitur menampilkan diagnosis cadangan
  tanpa AI (aturan berbasis data pemeriksaan pengguna) dengan
  label jujur, atau pesan jujur ("Diagnosis AI sedang tidak
  tersedia, coba lagi nanti") bila data tidak cukup — bukan
  jawaban karangan.
- Batas pemakaian wajar diberlakukan di server (rate limit) agar satu
  pengguna tidak menghabiskan kuota bersama.

### 4.7 Riwayat + laporan PDF

- Daftar pemeriksaan kesehatan dan WiFi dari server (milik pengguna
  yang masuk), dengan filter per jenis dan urutan terbaru dulu.
- Hapus dengan geser/ketuk tombol hapus (soft-delete: `deleted_at`
  diisi, baris tidak dihapus permanen).
- **Laporan PDF dibuat client-side (jsPDF)** dari data real yang
  diambil via API: berisi riwayat pemeriksaan kesehatan dan WiFi,
  dibuat di browser, lalu diunduh sebagai file. Tidak ada data yang
  dikirim ke layanan PDF pihak ketiga.

### 4.8 Pengaturan akun

- Profil: nama tampilan.
- PIN: atur, ubah, atau hapus PIN.
- Sesi: daftar sesi aktif, dengan tombol keluar dari sesi lain.
- Ekspor data: unduh seluruh data milik pengguna sebagai satu
  file JSON (profil, riwayat pemeriksaan, laporan WiFi beserta
  sampel, diagnosis AI); maksimal 5.000 baris per tabel.
- Hapus akun: menghapus profil dan seluruh data pengguna (hard delete
  lewat API; baris terkait ikut terhapus lewat foreign key cascade).
- Tentang: versi aplikasi web, tautan repo, penjelasan batasan web.

### 4.9 PWA (pasang ke layar utama)

- Aplikasi web adalah PWA resmi v1.0 (K-10): pengguna bisa
  memasangnya ke layar utama HP lewat prompt "Pasang aplikasi"
  di Chrome Android (atau menu Bagikan → "Tambahkan ke Layar
  Utama" di iOS), lalu membukanya sebagai aplikasi mandiri
  tanpa bilah alamat browser.
- **Manifest** (`manifest.webmanifest`): nama "Dokter HP",
  tampilan standalone, orientasi portrait, tema hitam, bahasa
  Indonesia; ikon layar utama (PNG 192×192 dan 512×512)
  disiapkan tim brand.
- **Service worker** (`sw.js`): menyimpan shell aplikasi dan
  aset statis di cache agar aplikasi terbuka cepat pada
  kunjungan berikutnya; pembaruan versi baru ditawarkan lewat
  banner "Versi baru tersedia" dengan tombol Perbarui.
- **Offline yang jujur**: bila tidak ada koneksi, aplikasi
  menampilkan halaman offline khusus ("Anda sedang offline")
  dengan tombol "Coba lagi" — tanpa skor, riwayat, atau hasil
  tes lama. Respons API tidak pernah di-cache dan tidak pernah
  disajikan kembali sebagai data baru; file tes kecepatan
  (`speedtest-1mb.bin`) juga tidak pernah di-cache agar tes
  mengukur koneksi internet, bukan cache lokal.
- Pendaftaran service worker hanya di build produksi; bila
  pendaftaran gagal, aplikasi tetap berfungsi penuh sebagai
  situs web biasa. Detail lengkap ada di `docs/pwa.md`.

## 5. Alur pengguna

### 5.1 Alur utama — 8 langkah (kasus WiFi lemot)

1. Buka halaman web → landing menampilkan penjelasan singkat dan
   tombol masuk/daftar; tes WiFi bisa dicoba tanpa akun.
2. Masuk dengan Google (atau lanjut tanpa akun untuk tes sekali jalan).
3. Ketuk kartu **Dokter WiFi** di dashboard.
4. Ketuk **Periksa WiFi sekarang** → progres tahap demi tahap
   (info jaringan → kecepatan unduh → latensi).
5. Hasil tampil: kecepatan unduh, klasifikasi, IP, latensi HTTP, dan
   rekomendasi; kolom SSID/sinyal/channel tampil "tidak tersedia"
   kecuali pengguna mengisinya manual.
6. Bila kecepatan sangat lambat: rekomendasi mengarah ke channel
   router atau mode router (panduan 802.11b Only), bukan ke HP;
   pengguna mengikuti langkah manual di halaman admin router.
7. Ketuk **Tes bertahan 30 detik** bila perlu memastikan kecepatan
   bertahan atau jatuh di tengah jalan; grafik sampel per detik tampil.
8. Hasil tersimpan otomatis ke riwayat (bila masuk); lihat lagi di
   **Riwayat** atau unduh sebagai **laporan PDF**.

### 5.2 Alur diagnosis satu ketuk

1. Buka dashboard → ketuk **Diagnosis satu ketuk**.
2. Skor 0-100 tampil beserta penjelasan per komponen dan sumber data
   tiap komponen (tes web / input manual / riwayat APK).
3. Skor tersimpan ke riwayat; grafik riwayat skor diperbarui.

### 5.3 Alur kunci aplikasi (PIN)

1. Buka **Pengaturan** → atur PIN 4-8 digit → disimpan sebagai hash
   di server.
2. Tutup lalu buka kembali aplikasi web → layar kunci PIN tampil
   sebelum dashboard; masukkan PIN untuk membuka.
3. Bila PIN lupa: masuk ulang dengan Google, lalu atur PIN baru dari
   Pengaturan; riwayat tetap aman.

### 5.4 Alur laporan PDF

1. Buka **Riwayat**.
2. Ketuk tombol **Unduh laporan PDF** → PDF dibuat di browser dari
   data real → file terunduh.

### 5.5 Alur Diagnosis AI

1. Buka kartu **Diagnosis AI**.
2. Tulis keluhan (misalnya "WiFi lemot padahal sinyal penuh").
3. Kirim → jawaban AI tampil dengan label saran, tersimpan ke riwayat.

## 6. Layar

| # | Layar | Rute |
|---|---|---|
| 1 | Landing | `/` |
| 2 | Masuk / layar kunci PIN | `/masuk`, `/kunci` |
| 3 | Dashboard | `/dashboard` |
| 4 | Dokter WiFi | `/wifi` |
| 5 | Dokter Baterai | `/baterai` |
| 6 | Dokter Penyimpanan | `/penyimpanan` |
| 7 | Dokter Performa | `/performa` |
| 8 | Dokter Keamanan | `/keamanan` |
| 9 | Diagnosis AI | `/ai` |
| 10 | Riwayat | `/riwayat` |
| 11 | Pengaturan akun | `/pengaturan` |

## 7. Data model

Skema D1 wajib kompatibel dengan rancangan Supabase APK: tabel
`profiles`, `health_checks`, `wifi_reports`, `ai_diagnoses` dengan
nama kolom yang sama. UUID sebagai TEXT, timestamptz sebagai TEXT
ISO 8601, jsonb sebagai TEXT JSON. Tambahan tabel web: `users`, `sessions`,
`wifi_sustained_samples`, dan `rate_limits` (tabel internal penghitung rate limit).

Definisi lengkap (SQL CREATE TABLE) ada di `ARCHITECTURE.md`
bagian 5. Ringkasan kolom inti:

### 7.1 profiles

`id` (TEXT, PK, sama dengan id pengguna), `nama` (TEXT),
`dibuat_pada` (TEXT ISO 8601).

### 7.2 health_checks

`id`, `user_id`, `skor` (0-100), `ringkasan` (TEXT JSON: status
baterai, penyimpanan, performa, keamanan, dan sumber tiap komponen),
`dibuat_pada`, `updated_at`, `deleted_at` (soft-delete),
`sync_status` (`pending` / `synced` / `failed`).

### 7.3 wifi_reports

`id`, `user_id`, `ssid`, `kecepatan_koneksi_mbps`,
`kekuatan_sinyal` (label: lemah / sedang / kuat),
`channel`, `dns`, `ping_ms` (latensi HTTP), `rekomendasi`,
`dibuat_pada`, `updated_at`, `deleted_at` (soft-delete). Kolom
tambahan web: `kecepatan_unduh_kbps` (hasil tes unduh), `sumber`
(`web` / `apk` / `manual`), `durasi_tes_detik` (untuk tes
bertahan).

### 7.4 ai_diagnoses

`id`, `user_id`, `health_check_id` (boleh kosong),
`pertanyaan`, `jawaban`, `dibuat_pada`.

### 7.5 users (tambahan web)

`id`, `email`, `google_sub` (pengenal Google, unik),
`nama`, `pin_hash`, `pin_salt`, `pin_gagal_berturut` (penghitung
percobaan PIN salah), `pin_terkunci_sampai` (TEXT ISO 8601),
`dibuat_pada`, `updated_at`.

### 7.6 sessions (tambahan web)

`id`, `user_id`, `token_hash` (SHA-256 dari token sesi; token mentah
tidak pernah disimpan), `terkunci` (1 bila sesi belum dibuka dengan
PIN), `dibuat_pada`, `kedaluwarsa_pada`, `user_agent`,
`ip_terakhir`.

### 7.7 wifi_sustained_samples (tambahan web)

`id`, `wifi_report_id`, `detik_ke` (0-29), `kecepatan_kbps`,
`dibuat_pada`.

### 7.8 Sinkronisasi APK (rencana)

APK v1.1.0 menyimpan riwayat lokal dan dirancang untuk sinkron ke
Supabase (`sync_status`: pending/synced/failed). Sinkron APK ke
backend web (Worker + D1) adalah pekerjaan fase berikutnya dan
membutuhkan perubahan di APK (endpoint sinkron baru + token sesi
yang sama). Sampai sinkron itu ada, data APK masuk ke web lewat
input manual pengguna. Dokumen ini tidak menjanjikan sinkron
otomatis di rilis web pertama.

## 8. Prinsip kejujuran data (aturan produk)

1. Semua angka yang tampil adalah data nyata: hasil ukur browser,
   data dari server, atau input manual pengguna.
2. Bila data tidak tersedia, tampilkan "tidak tersedia" atau empty
   state "Belum ada data pemeriksaan", bukan angka contoh.
3. Estimasi diberi label perkiraan, bukan pengukuran pasti.
4. Latensi disebut "latensi HTTP", bukan "ping", karena bukan ICMP.
5. Batasan browser dijelaskan di layar terkait, beserta cara manual.
6. Skor dihitung hanya dari komponen yang datanya tersedia; komponen
   tanpa data dilewati dan bobot dinormalisasi ulang.
7. Setiap layar yang memuat data punya tiga kondisi: memuat (dengan
   teks yang menjelaskan), galat (dengan tombol "Coba lagi"), dan
   kosong yang jujur (bukan angka contoh).
8. Pesan galat ditulis dengan bahasa sehari-hari dan tidak menampilkan
   rincian teknis dari sistem.
9. Setiap entri data menampilkan sumbernya (tes web / input manual /
   riwayat APK) dan waktunya.
10. Data dummy dilarang tampil seolah data nyata, di layar mana pun,
    termasuk grafik dan contoh laporan.

## 9. Kriteria selesai (terukur)

- [ ] Build frontend berhasil tanpa error TypeScript.
- [ ] Tes kecepatan unduh 1 MB + latensi HTTP menampilkan hasil ukur
      nyata di browser HP (lebar 360 px).
- [ ] Tes bertahan 30 detik menyimpan 30 sampel dan menampilkan grafik.
- [ ] Masuk Google berhasil end-to-end; sesi bertahan setelah muat ulang
      halaman; keluar menghapus sesi.
- [ ] PIN: atur, kunci, buka dengan PIN benar, tolak PIN salah, kunci
      30 detik setelah 5 kali salah berturut-turut.
- [ ] Dashboard menampilkan skor dari data real; grafik riwayat tampil
      bila ada data, empty state jujur bila belum ada.
- [ ] Diagnosis AI menjawab lewat Worker; kunci Gemini tidak ada di
      bundle frontend (diperiksa dengan pencarian di hasil build).
- [ ] Laporan PDF terunduh dan isinya cocok dengan data riwayat.
- [ ] Ekspor data mengunduh file JSON berisi seluruh data milik
      pengguna (maksimal 5.000 baris per tabel).
- [ ] PWA: manifest valid, service worker terdaftar, prompt
      "Pasang aplikasi" muncul di Chrome Android, dan halaman
      offline tampil saat tidak ada koneksi.
- [ ] Semua layar tanpa data menampilkan empty state jujur.
- [ ] Tidak ada angka dummy yang tampil seolah data nyata.
- [ ] Tidak ada secret/kunci API di dalam kode dan di repo.
- [ ] Setiap tombol melakukan aksi nyata atau menampilkan pesan jujur.
- [ ] Deploy live di Cloudflare Pages dan mirror Vercel; kedua mirror
      memanggil API Worker yang sama dan lolos uji smoke.

## 10. Keamanan dan privasi

- PIN tidak pernah disimpan plaintext (hash SHA-256 + salt).
- Token sesi disimpan sebagai hash di D1; token mentah hanya ada di
  cookie HttpOnly pengguna.
- Kunci Gemini dan secret OAuth hanya di secret Worker; tidak pernah
  di browser, tidak pernah di repo.
- Pengguna hanya bisa membaca/mengubah data milik sendiri (setiap query
  difilter `user_id` dari sesi; tidak ada RLS di D1 — penegakan
  kepemilikan dilakukan di kode Worker, diuji eksplisit).
- Data diagnosis tersimpan di server hanya bila pengguna masuk.
- Tidak ada pelacakan, iklan, atau pengiriman data diam-diam.
- Tanpa payment gateway.

## 11. Batasan jujur web

| Batasan | Dampak di web app |
|---|---|
| Browser tidak bisa membaca SSID, RSSI, channel, gateway, DNS perangkat | Kolom tampil "tidak tersedia" atau diisi manual pengguna |
| Browser tidak bisa mengirim ping ICMP | Latensi diukur sebagai latensi HTTP dan dilabeli demikian |
| Browser tidak bisa membaca level baterai, penyimpanan, RAM, CPU, suhu, atau daftar aplikasi | Keempat dokter non-WiFi menampilkan riwayat + input manual, bukan pemindaian live |
| Browser tidak bisa membuka pengaturan WiFi sistem | Perbaikan dijelaskan sebagai langkah manual tertulis |
| Browser tidak bisa menghapus cache aplikasi lain | Tidak ada tombol bersihkan cache di web |
| Biometrik sistem tidak tersedia lewat web app ini | Kunci aplikasi memakai PIN saja |
| Network Information API tidak tersedia di semua browser | Info koneksi tampil "tidak tersedia" bila API tidak ada |

## 12. Hal yang tidak dilakukan

- Tanpa payment gateway.
- Tanpa data dummy yang tampil seolah nyata.
- Tanpa menyimpan PIN plaintext.
- Tanpa mengumpulkan data pengguna tanpa izin.
- Tanpa kunci API di dalam kode atau di bundle frontend.
- Tanpa bergantung pada API/situs pihak ketiga untuk data inti
  (backend + database sendiri; pengecualian yang sah: Google OAuth
  sebagai penyedia identitas, dan Gemini sebagai mesin AI lewat
  Worker server-side).

## 13. Changelog dokumen

### 17 November 2026 — Rekonsiliasi dokumen (Gelombang 3)

- Bagian PWA ditambahkan (§4.9): manifest, service worker,
  pasang ke layar utama, dan halaman offline yang jujur (K-10).
- Ekspor data ditambahkan ke Pengaturan akun (§4.8) dengan
  batas 5.000 baris per tabel (K-01, K-04).
- Model AI utama dicatat sebagai Gemini Flash-Lite, dengan
  diagnosis cadangan tanpa AI bila kuota habis (K-06).
- Area sentuh minimal diselaraskan ke 48 px (K-11).
- Data model diselaraskan dengan skema `ARCHITECTURE.md` §5:
  kolom `terkunci` di `sessions`, `updated_at` dan `deleted_at`
  di `wifi_reports`, serta tabel `rate_limits`.

### 17 November 2026 — Fase 1 (dokumen awal)

- PRD web app pertama: 11 layar, alur pengguna 8 langkah,
  data model kompatibel Supabase APK, prinsip kejujuran data,
  kriteria selesai terukur, batasan jujur web.
- Stack diputuskan koordinator dan terverifikasi live 17 November
  2026 (lihat `docs/keputusan-stack.md`): Vite + React + TypeScript
  + Tailwind + Zustand + React Router di Cloudflare Pages; Worker
  (Hono) + D1; mirror Vercel.
