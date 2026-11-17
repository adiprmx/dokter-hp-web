# Register Risiko: Dokter HP Web App

> **Dokumen manajemen risiko Dokter HP Web App (full-stack).**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen, 17 November 2026.
>
> Dokumen ini mencatat risiko yang diketahui untuk proyek Dokter HP
> Web App, beserta penilaian kemungkinan dan dampak, mitigasi yang
> sudah dirancang, dan rencana darurat bila risiko itu terjadi.
> Dokumen ini ditinjau ulang tiap minggu untuk 5 risiko teratas
> (bagian 4) dan tiap rilis untuk seluruh register.
>
> Angka limit free tier yang tercantum di sini hanya angka yang
> terverifikasi dan tercatat di `docs/keputusan-stack.md`
> (17 November 2026). Angka yang belum terverifikasi ditandai
> "belum dicatat" dan tidak diisi dengan perkiraan.

---

## 1. Cara membaca dokumen ini

### 1.1 Skala kemungkinan

| Tingkat | Arti |
|---|---|
| Rendah | Kecil kemungkinan terjadi dalam 6 bulan ke depan, atau butuh rangkaian kejadian yang tidak biasa |
| Sedang | Bisa terjadi dalam 6 bulan ke depan; ada preseden atau pemicu yang nyata |
| Tinggi | Kemungkinan besar terjadi bila tidak dimitigasi, atau sudah pernah terjadi pada proyek ini |

### 1.2 Skala dampak

| Tingkat | Arti |
|---|---|
| Rendah | Gangguan kecil; pengguna hampir tidak merasakan; perbaikan dalam hitungan menit |
| Sedang | Satu fitur tidak bisa dipakai, atau gangguan terasa tetapi aplikasi tetap berjalan |
| Tinggi | Aplikasi tidak bisa dipakai sebagian besar pengguna, atau data pengguna terganggu |
| Kritis | Kehilangan data pengguna, kebocoran data antar-pengguna, atau aplikasi mati total tanpa jalan kembali yang cepat |

### 1.3 Skor risiko

Skor = kemungkinan × dampak. Urutan prioritas mengikuti skor ini,
dengan dampak kritis selalu didahulukan bila skornya sama.
Matriks lengkap ada di bagian 3.

---

## 2. Register risiko

### R01 — Kuota D1 habis (batas baca/tulis harian)

- **Deskripsi:** Pemakaian D1 melewati batas free tier — 5 juta
  baris dibaca per hari atau 100 ribu baris ditulis per hari
  (terverifikasi 17 November 2026) — sehingga query mulai gagal
  sampai reset pukul 00:00 UTC. Pemicu: lonjakan pengguna, query
  tanpa `LIMIT`, atau banjir tulis dari satu pengguna.
- **Kemungkinan: Sedang.** Batas tulis 100 ribu baris per hari
  cukup besar untuk pengguna awal, tetapi satu bug (misalnya
  perulangan tulis tanpa batas) atau lonjakan pemakaian bisa
  menghabiskannya dalam sehari.
- **Dampak: Tinggi.** Semua fitur yang butuh data (riwayat,
  dashboard, simpan hasil tes, sesi) berhenti sampai reset.
  Tanpa kartu kredit, tidak ada tagihan — tetapi juga tidak ada
  cara membeli kuota tambahan di hari yang sama.
- **Mitigasi yang sudah dirancang:**
  - Semua query berindeks dan ber-`LIMIT`; daftar memakai paginasi.
  - Endpoint `/api/ping` dan `/api/health` tidak menyentuh D1.
  - Rate limit tulis 60/menit per pengguna.
  - Sesi disimpan di D1, bukan di KV, agar tulis sesi tidak
    menghabiskan kuota KV yang jauh lebih kecil.
  - Worker mengembalikan pesan jujur bila D1 galat
    ("Server sedang sibuk, coba lagi nanti").
- **Rencana darurat bila terjadi:**
  1. Konfirmasi penyebab di dashboard Cloudflare (metrik baris
     dibaca/ditulis D1).
  2. Bila penyebabnya banjir tulis dari satu sumber, blokir sumber
     itu di Worker (rate limit darurat per IP).
  3. Tampilkan banner di landing: tes WiFi tetap jalan lokal di
     browser, tetapi hasil tidak tersimpan sampai kuota pulih.
  4. Tunggu reset 00:00 UTC; tidak ada jalan pintas berbayar
     karena prinsip budget nol tanpa kartu.
  5. Setelah pulih, audit query yang paling banyak makan baris
     dan perketat batasnya.

### R02 — Kuota Workers habis (batas request/CPU free tier)

- **Deskripsi:** Jumlah request ke Worker atau pemakaian CPU
  melewati batas free tier Workers, sehingga API berhenti
  merespons sampai reset harian.
- **Kemungkinan: Sedang.** API dipakai setiap interaksi yang
  butuh data; tes WiFi tanpa akun tidak memanggil API, tetapi
  pengguna yang masuk memanggil API di hampir setiap layar.
  Angka limit Workers free tier belum dicatat untuk dokumen ini —
  perlu verifikasi sebelum penilaian ini bisa dipertajam.
- **Dampak: Tinggi.** Seluruh backend mati: login, riwayat,
  simpan hasil, dan Diagnosis AI tidak bisa dipakai. Kedua mirror
  frontend tetap tampil, tetapi hanya tes WiFi lokal yang jalan.
- **Mitigasi yang sudah dirancang:**
  - Endpoint `/api/health` dan `/api/ping` ringan dan tanpa akses D1.
  - Tes WiFi tanpa akun tidak memanggil API sama sekali.
  - Rate limit per pengguna dan per IP di Worker.
  - Frontend tidak memanggil API berulang tanpa perlu (cache UI
    di Zustand untuk data yang sudah dimuat).
- **Rencana darurat bila terjadi:**
  1. Konfirmasi di dashboard Cloudflare (metrik request Workers).
  2. Bila penyebabnya banjir dari satu IP, blokir IP itu di Worker.
  3. Aktifkan banner "Tidak tersambung ke server" di kedua mirror;
     tes WiFi lokal tetap tersedia.
  4. Tunggu reset harian; catat pola pemakaian untuk pengetatan
     rate limit berikutnya.

### R03 — Kuota KV writes habis (1.000 tulis per hari)

- **Deskripsi:** Pemakaian KV melewati batas 1.000 tulis per hari
  (terverifikasi 17 November 2026), sehingga penulisan ke KV gagal.
- **Kemungkinan: Rendah.** KV hanya dipakai untuk data yang jarang
  berubah; sesi dan rate limit sengaja tidak memakai KV.
  Risiko naik bila ada fitur baru yang menulis ke KV tanpa sadar
  akan batas ini.
- **Dampak: Sedang.** Tergantung apa yang disimpan di KV — bila
  hanya konfigurasi statis, dampaknya kecil; bila ada fitur yang
  mengandalkan tulis KV rutin, fitur itu berhenti sampai reset.
- **Mitigasi yang sudah dirancang:**
  - Sesi disimpan di D1, bukan KV.
  - Rate limit memakai tabel D1 atau fitur platform, bukan KV.
  - KV hanya untuk data yang jarang berubah.
- **Rencana darurat bila terjadi:**
  1. Hentikan tulis KV yang tidak penting; fitur yang memakai KV
     beralih ke nilai bawaan (default) di kode.
  2. Tunggu reset harian.
  3. Bila kebutuhan tulis KV ternyata rutin, pindahkan data itu
     ke D1 secara permanen.

### R04 — Akun Cloudflare bermasalah (terkunci, ditangguhkan, atau dibatasi)

- **Deskripsi:** Akun Cloudflare yang menampung Pages, Worker, D1,
  dan KV mengalami masalah: terkunci karena verifikasi keamanan,
  ditangguhkan karena dugaan pelanggaran, atau dibatasi karena
  aktivitas tidak biasa. Seluruh layanan proyek berada di satu
  akun, sehingga satu masalah akun mematikan semuanya sekaligus.
- **Kemungkinan: Rendah.** Akun dipakai untuk proyek sah dengan
  pemakaian wajar; tidak ada riwayat masalah akun. Namun
  penangguhan otomatis oleh sistem vendor bisa terjadi tanpa
  peringatan dan proses bandingnya lambat.
- **Dampak: Kritis.** Frontend utama, API, dan database mati
  bersamaan. Hanya mirror Vercel yang tersisa — dan itu pun
  tanpa API, karena API juga ada di Cloudflare.
- **Mitigasi yang sudah dirancang:**
  - Mirror Vercel menjaga frontend tetap bisa dibuka.
  - Semua kode ada di repo GitHub, sehingga rebuild di akun lain
    dimungkinkan (bukan dari nol).
  - Skema D1 tercatat lengkap di `ARCHITECTURE.md` bagian 5.
- **Rencana darurat bila terjadi:**
  1. Ajukan banding/pemulihan akun lewat jalur resmi Cloudflare
     sesegera mungkin.
  2. Sementara itu, siapkan akun Cloudflare cadangan (akun lain
     milik owner) dan deploy ulang Worker + D1 dari repo.
  3. Pulihkan data dari cadangan terbaru (lihat R08).
  4. Alihkan `VITE_API_BASE_URL` di mirror Vercel ke Worker baru.
  5. Setelah akun utama pulih, putuskan apakah kembali ke akun
     utama atau tetap di akun cadangan.

### R05 — Ketergantungan pada satu akun Cloudflare (hiroohengkerr)

- **Deskripsi:** Seluruh infrastruktur Cloudflare proyek ini
  berada di satu akun (hiroohengkerr): Pages, Worker, D1, dan KV.
  Bila akun itu tidak bisa diakses — apa pun penyebabnya —
  tidak ada orang kedua dan tidak ada akun kedua yang bisa
  mengambil alih operasional.
- **Kemungkinan: Sedang.** Bukan soal niat buruk, melainkan soal
  kerapuhan struktural: satu akun berarti satu titik kegagalan
  untuk akses, pemulihan, dan penagihan (bila kelak ada).
  Risiko ini tumpang tindih dengan R04 dan R14, tetapi dicatat
  terpisah karena penyebab dan penanganannya berbeda.
- **Dampak: Tinggi.** Kehilangan akses akun berarti kehilangan
  kemampuan deploy, mengubah secret, dan mengelola database —
  bahkan bila layanannya sendiri masih hidup.
- **Mitigasi yang sudah dirancang:**
  - Kode dan skema database ada di repo GitHub, bukan hanya di
    dashboard Cloudflare.
  - Mirror Vercel berada di platform dan akun yang berbeda.
  - Dokumentasi arsitektur dan keputusan stack lengkap, sehingga
    orang lain bisa membangun ulang dari repo.
- **Rencana darurat bila terjadi:**
  1. Gunakan jalur pemulihan akun Cloudflare (email pemulihan,
     autentikasi dua faktor bila aktif).
  2. Bila pemulihan gagal, bangun ulang di akun Cloudflare lain
     milik owner dari repo + cadangan data terbaru.
  3. Catat semua secret yang perlu dibuat ulang (kunci Gemini,
     client secret Google OAuth) dan siapkan dari awal.

### R06 — Kunci Gemini tidak valid atau kedaluwarsa

- **Deskripsi:** Kunci API Gemini yang disimpan sebagai secret
  Worker ternyata tidak valid, dicabut, atau kedaluwarsa.
  Kunci sudah TERVERIFIKASI valid 17 November 2026 22:13 WIB
  (K-20): panggilan uji mengembalikan HTTP 200 dengan 50 model
  terdaftar — sehingga sisa risikonya adalah pencabutan atau
  kedaluwarsa di masa depan, bukan validitas yang belum
  terkonfirmasi. Bila kunci tidak valid, fitur Diagnosis AI
  memakai jawaban aturan berlabel saran (K-23), bukan mati total.
- **Kemungkinan: Rendah.** Kunci terverifikasi valid 17 November
  2026; pencabutan atau kedaluwarsa mendadak jarang terjadi dan
  terpantau lewat panggilan tes mingguan.
- **Dampak: Sedang.** Hanya jawaban AI yang diganti jawaban
  aturan berlabel saran (K-23); fitur lain (tes WiFi, riwayat,
  dashboard) tetap berjalan. Pengguna tidak pernah melihat
  jawaban karangan.
- **Mitigasi yang sudah dirancang:**
  - Kunci hanya di secret Worker, tidak di repo dan tidak di
    browser — kecil kemungkinan bocor dan dicabut karena
    penyalahgunaan pihak lain.
  - Rate limit 20 diagnosis per hari per pengguna melindungi
    kuota bersama.
  - Bila Gemini galat, Worker memakai jawaban aturan berlabel
    saran (K-23) dan mencatat kejadian ke log server
    (`GEMINI_KUOTA_HABIS` bila kedua model 429), bukan jawaban
    karangan dan bukan pesan "tidak tersedia".
- **Rencana darurat bila terjadi:**
  1. Uji kunci dari Worker (panggilan tes kecil); bila gagal,
     buat kunci baru di Google AI Studio (gratis) dan atur
     ulang lewat `wrangler secret put`.
  2. Bila kunci baru juga gagal, periksa status layanan Gemini
     dan batas kuota akun Google yang bersangkutan.
  3. Sementara AI mati, tampilkan pesan jujur di layar AI dan
     arahkan pengguna ke panduan manual Dokter WiFi.

### R07 — Google OAuth ditolak atau dibatasi

- **Deskripsi:** Aplikasi Google OAuth untuk login mengalami
  masalah: consent screen belum diverifikasi sehingga muncul
  peringatan "aplikasi belum terverifikasi", kuota pengguna
  pengujian (test user) terbatas, atau Google membatasi/menolak
  aplikasi karena kebijakan. Akibatnya pengguna baru tidak bisa
  masuk, atau masuk dengan peringatan yang menakutkan.
- **Kemungkinan: Sedang.** Aplikasi OAuth baru yang belum
  diverifikasi Google dibatasi untuk pengguna pengujian saja
  sampai proses verifikasi selesai; proses verifikasi butuh
  waktu dan bisa meminta perubahan.
- **Dampak: Tinggi.** Login adalah pintu masuk seluruh fitur
  yang butuh akun (riwayat, simpan hasil, AI). Tanpa login,
  pengguna hanya bisa tes WiFi tanpa akun.
- **Mitigasi yang sudah dirancang:**
  - Tes WiFi tanpa akun tetap tersedia sebagai fitur publik.
  - Alur OAuth memakai authorization code flow + PKCE di server,
    sesuai praktik yang dianjurkan Google.
  - Redirect URI didaftarkan dengan benar di Google Cloud Console
    sebelum rilis.
- **Rencana darurat bila terjadi:**
  1. Periksa status verifikasi di Google Cloud Console; ajukan
     verifikasi bila belum diajukan, lengkapi dokumen yang
     diminta.
  2. Sementara verifikasi berjalan, daftarkan pengguna awal
     sebagai test user agar mereka tetap bisa masuk.
  3. Bila OAuth ditolak total, siapkan jalur masuk alternatif
     yang masih gratis dan tanpa kata sandi sendiri (misalnya
     tautan masuk lewat email) — keputusan koordinator,
     bukan bagian rilis pertama.
  4. Komunikasikan status lewat banner di landing.

### R08 — D1 kehilangan data

- **Deskripsi:** Data di D1 hilang atau rusak: database terhapus
  tidak sengaja dari dashboard, migrasi yang salah merusak skema,
  atau kegagalan di sisi vendor. D1 adalah satu-satunya salinan
  data pengguna (riwayat, profil, sesi, diagnosis AI).
- **Kemungkinan: Rendah.** D1 adalah layanan terkelola dengan
  replikasi di sisi vendor; kehilangan data karena vendor sangat
  jarang. Risiko terbesar adalah kesalahan manusia (hapus database,
  migrasi yang salah) — dan itu nyata.
- **Dampak: Kritis.** Seluruh riwayat pengguna hilang dan tidak
  bisa dibangun ulang dari sumber lain. Kepercayaan pengguna
  hancur; tidak ada jalan pemulihan tanpa cadangan.
- **Mitigasi yang sudah dirancang:**
  - Skema lengkap tercatat di `ARCHITECTURE.md` dan di file
    migrasi repo, sehingga struktur bisa dibangun ulang.
  - Soft-delete (`deleted_at`) untuk riwayat — hapus dari UI
    tidak menghapus baris permanen.
  - Hapus akun permanen (hard delete) hanya lewat endpoint
    khusus dengan konfirmasi eksplisit.
- **Rencana darurat bila terjadi:**
  1. Hentikan semua tulis ke D1 agar kerusakan tidak meluas.
  2. Pulihkan dari cadangan terbaru (lihat catatan di bawah).
  3. Bila tidak ada cadangan, bangun ulang skema dari migrasi
     repo; data pengguna tidak bisa dipulihkan — sampaikan
     dengan jujur kepada pengguna yang terdampak.
  4. Setelah kejadian, tetapkan jadwal cadangan berkala sebagai
     kewajiban (bukan pilihan).
- **Catatan penting:** Sampai dokumen ini ditulis, belum ada
  jadwal cadangan D1 yang ditetapkan. Ini adalah celah mitigasi
  yang harus ditutup sebelum rilis: ekspor berkala isi D1
  (misalnya mingguan) ke file di luar Cloudflare.

### R09 — Deploy gagal (build error, Pages/Vercel/Worker gagal terbit)

- **Deskripsi:** Deploy gagal di salah satu atau semua target:
  build frontend gagal (error TypeScript, dependensi rusak),
  deploy Pages gagal, deploy Vercel gagal, atau deploy Worker
  gagal (misalnya `wrangler deploy` error atau migrasi D1 gagal
  diterapkan).
- **Kemungkinan: Sedang.** Deploy melibatkan tiga target
  (Pages, Vercel, Worker) plus migrasi D1; setiap rilis adalah
  kesempatan gagal. Build frontend dengan banyak dependensi
  rentan terhadap perubahan versi paket.
- **Dampak: Sedang.** Bila deploy gagal, versi lama tetap tayang
  (deploy gagal tidak merusak versi yang sudah live) — tetapi
  perbaikan dan fitur baru tertunda, dan bila kegagalan terjadi
  saat perbaikan darurat, pengguna tetap mengalami bug lama.
- **Mitigasi yang sudah dirancang:**
  - Build diuji lokal/CI sebelum deploy.
  - Uji smoke setelah deploy di kedua mirror.
  - Dua mirror: bila satu gagal deploy, mirror lain tetap bisa
    diperbarui.
  - Versi lama tetap live bila deploy baru gagal.
- **Rencana darurat bila terjadi:**
  1. Baca log build/deploy untuk menemukan penyebab pasti.
  2. Bila penyebabnya satu dependensi, kunci versinya
     (pin version) dan deploy ulang.
  3. Bila Pages gagal tetapi Vercel berhasil (atau sebaliknya),
     arahkan pengguna ke mirror yang berhasil lewat pengumuman.
  4. Bila Worker gagal deploy, versi Worker lama tetap melayani;
     perbaiki dan deploy ulang tanpa mengubah D1.
  5. Bila migrasi D1 gagal di tengah jalan, jangan deploy ulang
     membabi buta — periksa status migrasi dulu, lalu perbaiki
     file migrasi dan terapkan ulang.

### R10 — Bug kebocoran data antar-pengguna

- **Deskripsi:** D1 tidak punya Row Level Security. Penegakan
  kepemilikan data sepenuhnya bergantung pada kode Worker yang
  memfilter setiap query dengan `user_id` dari sesi. Satu query
  yang lupa filter — atau satu endpoint yang menerima `user_id`
  dari client — bisa membuat pengguna A membaca atau mengubah
  data pengguna B (riwayat kesehatan, laporan WiFi, diagnosis AI,
  profil).
- **Kemungkinan: Sedang.** Penegakannya manual di setiap query,
  sehingga satu kelalaian di satu endpoint sudah cukup. Ini
  adalah kelas bug yang paling mudah lolos dari peninjauan kode
  karena query-nya terlihat benar.
- **Dampak: Kritis.** Kebocoran data antar-pengguna adalah
  pelanggaran privasi yang merusak kepercayaan secara mendasar.
  Data yang bocor bisa berisi keluhan kesehatan perangkat dan
  riwayat pemakaian yang bersifat pribadi.
- **Mitigasi yang sudah dirancang:**
  - Aturan arsitektur: setiap query WAJIB memfilter `user_id`
    dari sesi; tidak ada endpoint yang menerima `user_id` dari
    client.
  - Uji kepemilikan eksplisit adalah bagian kriteria selesai:
    pengguna A tidak bisa membaca data pengguna B.
  - Prepared statement dengan parameter terikat (mencegah
    SQL injection yang bisa dipakai membobol filter).
  - Validasi payload dengan validator tulisan tangan di Worker.
- **Rencana darurat bila terjadi:**
  1. Segera nonaktifkan endpoint yang bermasalah (kembalikan
     galat 503) sampai diperbaiki — jangan menunggu rilis
     terjadwal.
  2. Perbaiki filter kepemilikan, tambah uji regresi khusus
     untuk kasus itu.
  3. Audit seluruh endpoint lain dengan pola yang sama.
  4. Nilai seberapa luas kebocoran (log akses bila tersedia);
     sampaikan kepada pengguna yang terdampak bila datanya
     terbukti diakses pihak lain.
  5. Deploy perbaikan dan uji ulang kepemilikan di kedua mirror.

### R11 — Serangan brute force PIN

- **Deskripsi:** Penyerang mencoba menebak PIN 4-8 digit pengguna
  dengan mengirim banyak percobaan ke `POST /api/auth/pin/verify`.
  PIN 4 digit hanya punya 10.000 kemungkinan; tanpa pembatasan,
  tebakan bisa berhasil dalam waktu singkat.
- **Kemungkinan: Sedang.** Endpoint PIN bersifat publik bagi siapa
  pun yang punya sesi (dan sesi bisa dibuat sendiri lewat Google
  OAuth dengan akun apa pun), sehingga percobaan tidak butuh akses
  khusus. Serangan massal ke banyak akun sekaligus juga mungkin.
- **Dampak: Tinggi.** PIN yang berhasil ditebak membuka akses ke
  seluruh data akun itu (riwayat, diagnosis, profil) dan ke
  pengaturan akun, termasuk penghapusan akun.
- **Mitigasi yang sudah dirancang:**
  - Setelah 5 kali PIN salah berturut-turut, masukan dikunci
    30 detik (kolom `terkunci_sampai` di tabel `pin_attempts`);
    percobaan selama terkunci ditolak tanpa memeriksa PIN.
  - PIN disimpan sebagai HMAC-SHA256 dengan pepper secret
    `PIN_PEPPER` + salt (K-71), bukan plaintext.
  - Penghitung kegagalan (`gagal_berturut` di tabel
    `pin_attempts`) disimpan di server, bukan di client.
- **Rencana darurat bila terjadi:**
  1. Periksa log percobaan PIN gagal; identifikasi pola (satu akun
     diserang berulang, atau banyak akun sekaligus).
  2. Perpanjang durasi kunci sementara (misalnya kunci progresif
     yang bertambah tiap rangkaian gagal) lewat perubahan Worker.
  3. Bila serangan dari satu IP, blokir IP itu di Worker.
  4. Beri tahu pengguna yang akunnya diserang; sarankan ubah PIN
     menjadi 6-8 digit.
  5. Tinjau ulang kebijakan: pertimbangkan kunci yang lebih lama
     setelah rangkaian gagal berulang.

### R12 — Perubahan harga atau limit vendor

- **Deskripsi:** Cloudflare, Google (Gemini/OAuth), atau Vercel
  mengubah harga atau batas free tier: batas diturunkan, fitur
  yang tadinya gratis menjadi berbayar, atau free tier dihapus.
  Proyek ini bergantung penuh pada free tier tanpa kartu kredit,
  sehingga perubahan apa pun langsung memengaruhi kelangsungan
  layanan.
- **Kemungkinan: Sedang.** Vendor mengubah ketentuan free tier
  dari waktu ke waktu; preseden di proyek owner: Turso sedang
  diakuisisi Supabase sehingga masa depannya tidak pasti
  (tercatat di keputusan stack). Perubahan bisa diumumkan
  berbulan-bulan sebelumnya — atau mendadak.
- **Dampak: Tinggi.** Bila batas D1 atau Workers diturunkan
  drastis, aplikasi bisa berhenti berfungsi untuk sebagian
  pengguna. Bila free tier dihapus, proyek harus pindah vendor
  atau berhenti — tidak ada anggaran berbayar.
- **Mitigasi yang sudah dirancang:**
  - Arsitektur memakai standar terbuka (SQLite/D1, HTTP API,
    frontend statis) sehingga pindah vendor dimungkinkan tanpa
    menulis ulang seluruh aplikasi.
  - Skema D1 kompatibel dengan rancangan Supabase APK, sehingga
    migrasi ke Postgres tetap dimungkinkan di masa depan.
  - Pemakaian dijaga hemat (query berindeks, rate limit, tanpa
    panggilan API boros) agar tetap jauh di bawah batas.
  - Dua mirror frontend mengurangi ketergantungan pada satu
    vendor hosting.
- **Rencana darurat bila terjadi:**
  1. Baca pengumuman perubahan dengan teliti: apa yang berubah,
     kapan berlaku, dan apakah ada masa transisi.
  2. Hitung dampak terhadap pemakaian saat ini dari metrik
     dashboard.
  3. Bila masih bisa bertahan dengan penghematan, terapkan
     penghematan (rate limit lebih ketat, cache lebih agresif).
  4. Bila tidak bisa bertahan, rencanakan migrasi ke vendor
     gratis lain (koordinator memutuskan; kandidat dievaluasi
     ulang saat itu, bukan sekarang).
  5. Sampaikan perubahan layanan kepada pengguna bila ada fitur
     yang harus dibatasi.

### R13 — EPERM sandbox menghambat build

- **Deskripsi:** Lingkungan kerja (VM/sandbox) mengalami gelombang
  pembatasan tulis (error EPERM): operasi tulis file kadang gagal,
  `cp`/`copyFileSync` diblokir, dan build Vite gagal di tengah
  jalan. Preseden tercatat: 17 November 2026, build Vite gagal
  berulang dan penulisan file menjadi tidak bisa diandalkan
  selama gelombang tersebut.
- **Kemungkinan: Tinggi.** Gelombang EPERM sudah terbukti terjadi
  pada hari dokumen ini ditulis; polanya berupa jendela waktu
  (kadang terbuka, kadang tertutup) sehingga tidak bisa
  diprediksi kapan terjadi lagi.
- **Dampak: Sedang.** Build dan deploy tertunda; pekerjaan
  tertunda berjam-jam bila jendela tulis tertutup. Namun versi
  yang sudah live tidak terganggu — dampaknya pada kecepatan
  pengembangan, bukan pada pengguna yang sedang memakai aplikasi.
- **Mitigasi yang sudah dirancang:**
  - Tulis file kritis selalu lewat file TEMP + `mv` atomik
    (rename tidak diblokir), lalu verifikasi non-0 byte.
  - Jangan pakai `cp` untuk menyalin file; pakai `cat src > dst`.
  - Build Vite lewat API (bukan CLI) dengan loop retry bila
    gelombang EPERM aktif.
  - Simpan salinan file kritis sebelum menjalankan generator
    tulis massal.
  - CI GitHub Actions dan Vercel tidak terpengaruh gelombang
    ini — deploy dari CI tetap jalan.
- **Rencana darurat bila terjadi:**
  1. Jangan panik dan jangan ubah pipeline karena gelombang ini —
     ini masalah sandbox VM, bukan kerusakan repo.
  2. Gunakan proses berumur panjang yang mencoba tulis berulang
     sampai jendela terbuka.
  3. Alihkan build/deploy ke CI (GitHub Actions) yang tidak
     terpengaruh.
  4. Tunda pekerjaan tulis-berat sampai jendela terbuka; kerjakan
     pekerjaan baca/analisis sementara itu.
  5. Verifikasi setiap file hasil tulis (non-0 byte, checksum
     bila perlu) sebelum menganggapnya selesai.

### R14 — Owner kehilangan akses akun

- **Deskripsi:** Owner kehilangan akses ke salah satu akun kunci:
  Google (dipakai untuk OAuth, Gemini, dan email pemulihan),
  Cloudflare (infrastruktur), GitHub (kode), atau Vercel (mirror).
  Penyebab: lupa kata sandi, kehilangan perangkat autentikasi
  dua faktor, akun dikunci vendor, atau email pemulihan tidak
  bisa diakses. Owner hanya memakai HP, sehingga pemulihan yang
  butuh perangkat lain lebih sulit.
- **Kemungkinan: Sedang.** Owner mengelola banyak akun
  (beberapa akun Google, GitHub, Cloudflare, Vercel) hanya dari
  HP; satu akun yang hilang aksesnya adalah kejadian yang wajar
  dalam jangka panjang. Autentikasi dua faktor yang aktif tanpa
  kode cadangan memperbesar risiko ini.
- **Dampak: Tinggi.** Tergantung akunnya: kehilangan akses Google
  mematikan login pengguna dan AI; kehilangan akses Cloudflare
  mematikan seluruh infrastruktur (lihat R04/R05); kehilangan
  akses GitHub menghentikan deploy.
- **Mitigasi yang sudah dirancang:**
  - Kode ada di repo publik GitHub dan bisa di-clone ulang.
  - Dokumentasi lengkap (PRODUCT, ARCHITECTURE, keputusan stack)
    memungkinkan pembangunan ulang dari nol.
  - Mirror Vercel berada di akun/platform berbeda dari Cloudflare.
- **Rencana darurat bila terjadi:**
  1. Gunakan jalur pemulihan resmi tiap vendor (email pemulihan,
     kode cadangan 2FA, verifikasi identitas).
  2. Bila satu akun Google hilang tetapi akun Google lain milik
     owner masih bisa diakses, buat kredensial OAuth/Gemini baru
     dari akun tersebut dan perbarui secret Worker.
  3. Bila akses Cloudflare hilang, bangun ulang di akun lain
     (lihat R04).
  4. Setelah pulih, perbaiki praktik keamanan akun: aktifkan 2FA
     dengan kode cadangan yang disimpan aman di luar HP,
     pastikan email pemulihan aktif, dan catat daftar akun
     kunci beserta jalur pemulihannya (tanpa mencatat kata sandi
     di dokumen ini).
- **Tindakan pencegahan yang harus dilakukan sebelum rilis:**
  pastikan setiap akun kunci punya email pemulihan yang aktif
  dan kode cadangan 2FA yang tersimpan aman.

### R15 — Kebocoran secret (kunci API atau client secret terekspos)

- **Deskripsi:** Secret — kunci Gemini, client secret Google
  OAuth, atau token deploy — bocor ke tempat yang bisa dibaca
  publik: ter-commit ke repo, terbawa ke bundle frontend,
  tertulis di log, atau tersimpan di file yang terunggah.
  Secret yang bocor bisa dipakai pihak lain sampai dicabut.
- **Kemungkinan: Sedang.** Repo dan bundle frontend adalah
  tempat bocor yang paling umum; satu baris yang salah
  (`VITE_*` berisi secret, secret di `wrangler.toml`) sudah
  cukup. Preseden umum di industri sangat banyak.
- **Dampak: Tinggi.** Kunci Gemini yang bocor bisa dipakai orang
  lain sampai kuota habis (dan kuota itu milik owner); client
  secret OAuth yang bocor bisa dipakai memalsukan alur login.
  Perbaikan butuh rotasi secret di semua tempat.
- **Mitigasi yang sudah dirancang:**
  - Secret hanya lewat `wrangler secret put` / dashboard
    Cloudflare; tidak pernah di repo, tidak pernah di
    `wrangler.toml`, tidak pernah di variabel `VITE_*`.
  - Hanya `VITE_API_BASE_URL` yang boleh ada di variabel
    lingkungan frontend.
  - Kriteria selesai mencakup pemeriksaan: kunci Gemini tidak
    ada di bundle frontend (pencarian di hasil build).
  - Log Worker tidak mencatat token, PIN, atau isi jawaban AI.
  - Pindai file sebelum push untuk memastikan tidak ada secret.
- **Rencana darurat bila terjadi:**
  1. Segera cabut/rotasi secret yang bocor di konsol vendor
     (buat kunci Gemini baru, buat client secret OAuth baru).
  2. Perbarui secret Worker dengan nilai baru.
  3. Hapus secret dari riwayat repo bila ter-commit (perlu
     penulisan ulang riwayat git — koordinasikan agar tidak
     merusak pekerjaan tim lain).
  4. Periksa pemakaian tidak wajar selama masa bocor (kuota
     Gemini, log login).
  5. Tambah pemeriksaan otomatis di CI: gagalkan build bila
     pola secret terdeteksi di bundle atau di repo.

### R16 — Penyalahgunaan API dan banjir request

- **Deskripsi:** Pihak luar membanjiri API Worker dengan request
  — sengaja (serangan) atau tidak sengaja (client yang rusak,
  bot yang merayapi endpoint) — sehingga kuota Workers/D1
  habis, layanan melambat, atau kuota Gemini terkuras lewat
  endpoint AI.
- **Kemungkinan: Sedang.** Endpoint publik (`/api/health`, `/api/ping`,
  `/api/auth/google`) bisa dipanggil siapa saja; endpoint AI
  membutuhkan sesi, tetapi sesi bisa dibuat siapa pun dengan
  akun Google apa pun.
- **Dampak: Tinggi.** Banjir bisa menghabiskan kuota harian
  (lihat R01/R02) sehingga pengguna sah tidak bisa memakai
  aplikasi sampai reset. Banjir ke endpoint AI menguras kuota
  Gemini bersama.
- **Mitigasi yang sudah dirancang:**
  - Rate limit: AI 20/hari per pengguna; tulis 60/menit per
    pengguna; OAuth 10/menit per IP.
  - Respons 429 dengan pesan bahasa sehari-hari saat kena batas.
  - Endpoint `/api/ping` dan `/api/health` ringan dan tanpa D1.
- **Rencana darurat bila terjadi:**
  1. Identifikasi sumber banjir dari log Worker (IP, pola
     endpoint, pola waktu).
  2. Blokir IP atau pola request di Worker; ketatkan rate limit
     sementara.
  3. Bila banjir berasal dari banyak IP (terdistribusi), aktifkan
     perlindungan tingkat Cloudflare yang tersedia di paket
     gratis (misalnya aturan firewall dasar) — bila tersedia.
  4. Bila kuota sudah habis, ikuti rencana darurat R01/R02.
  5. Setelah reda, tinjau ulang rate limit dan tambah perlindungan
     yang terbukti perlu.

### R17 — Worker API mati total (satu-satunya backend)

- **Deskripsi:** Worker API adalah satu-satunya backend; tidak
  ada API kedua. Bila Worker down — karena gangguan Cloudflare,
  bug fatal di kode yang baru di-deploy, atau binding D1/KV
  yang rusak — kedua mirror kehilangan seluruh fungsi yang
  butuh server sekaligus.
- **Kemungkinan: Rendah.** Cloudflare Workers adalah layanan
  terkelola dengan ketersediaan tinggi; gangguan total jarang.
  Risiko yang lebih nyata adalah bug fatal dari deploy baru
  (lihat R09) — tetapi itu bisa di-rollback.
- **Dampak: Tinggi.** Login, riwayat, simpan hasil, dan AI mati
  di kedua mirror. Hanya tes WiFi lokal yang tetap jalan.
- **Mitigasi yang sudah dirancang:**
  - Frontend menampilkan banner jujur "Tidak tersambung ke
    server" bila backend tidak terjangkau; tes WiFi tetap
    jalan lokal.
  - Uji smoke setelah setiap deploy Worker.
  - Deploy Worker yang gagal tidak menggantikan versi lama.
  - Endpoint liveness `/api/health` untuk pemantau uptime.
- **Rencana darurat bila terjadi:**
  1. Periksa status Cloudflare (halaman status resmi) — bila
     gangguan vendor, tidak ada yang bisa dilakukan selain
     menunggu dan mengomunikasikan status.
  2. Bila penyebabnya deploy baru, rollback ke versi Worker
     sebelumnya (deploy ulang dari commit terakhir yang baik).
  3. Bila penyebabnya binding yang rusak, perbaiki konfigurasi
     `wrangler.toml` dan deploy ulang.
  4. Komunikasikan lewat banner di kedua mirror; tes WiFi lokal
     tetap tersedia selama pemulihan.

### R18 — Sesi dicuri atau disalahgunakan (pencurian cookie sesi)

- **Deskripsi:** Token sesi pengguna dicuri — misalnya lewat
  serangan XSS (skrip jahat membaca cookie), lewat jaringan
  yang tidak aman, atau lewat perangkat bersama — lalu dipakai
  penyerang untuk bertindak sebagai pengguna itu (membaca
  riwayat, mengubah PIN, menghapus akun).
- **Kemungkinan: Rendah.** Cookie memakai HttpOnly (tidak bisa
  dibaca JavaScript), Secure (hanya lewat HTTPS), dan
  SameSite=Lax; React meng-escape output sehingga XSS sulit.
  Namun tidak ada pertahanan yang sempurna, dan perangkat
  bersama tetap menjadi celah.
- **Dampak: Tinggi.** Penyerang mendapat akses penuh ke akun
  korban sampai sesi kedaluwarsa (30 hari) atau korban keluar
  dari semua sesi.
- **Mitigasi yang sudah dirancang:**
  - Cookie HttpOnly, Secure, SameSite=Lax, Max-Age 30 hari.
  - Token mentah tidak pernah disimpan di server (hanya hash
    SHA-256).
  - Jawaban AI ditampilkan sebagai teks (tanpa
    `dangerouslySetInnerHTML`).
  - Header keamanan: CSP, `X-Content-Type-Options: nosniff`,
    `Referrer-Policy`, `Permissions-Policy`.
  - Pemeriksaan header `Origin` pada endpoint tulis + CORS
    hanya dua origin frontend.
  - Pengguna bisa melihat sesi aktif dan keluar dari sesi lain
    di Pengaturan.
- **Rencana darurat bila terjadi:**
  1. Pengguna yang terdampak memakai "keluar dari sesi lain"
     di Pengaturan untuk mematikan semua sesi kecuali sesi
     saat ini.
  2. Bila dicurigai pencurian massal, hapus seluruh baris sesi
     di D1 (semua pengguna harus masuk ulang) — keputusan
     koordinator, sampaikan lewat banner.
  3. Bila penyebabnya celah XSS, perbaiki celah itu dulu
     sebelum memulihkan sesi.
  4. Tinjau ulang masa berlaku sesi (30 hari) — pertimbangkan
     mempersingkat bila insiden berulang.

### R19 — Migrasi D1 gagal atau merusak skema

- **Deskripsi:** File migrasi SQL yang salah (sintaks salah,
  kolom yang bentrok, penghapusan kolom yang masih dipakai)
  diterapkan ke D1 produksi dan merusak skema atau membuat
  migrasi berikutnya macet. D1/SQLite juga punya keterbatasan
  (misalnya tidak ada `gen_random_uuid()`, foreign key butuh
  `PRAGMA foreign_keys = ON`) yang bisa membuat migrasi yang
  terlihat benar ternyata gagal atau berperilaku beda dari
  Postgres.
- **Kemungkinan: Sedang.** Skema D1 diadaptasi dari migrasi
  Supabase (Postgres) sehingga perbedaan perilaku SQLite bisa
  lolos dari peninjauan. Setiap rilis yang mengubah skema
  adalah kesempatan gagal.
- **Dampak: Tinggi.** Skema yang rusak bisa membuat endpoint
  gagal total (tabel hilang, kolom tidak ada) atau membuat data
  tidak konsisten (cascade yang tidak jalan karena foreign key
  tidak aktif).
- **Mitigasi yang sudah dirancang:**
  - Migrasi diuji dulu di database D1 lokal/pengembangan
    sebelum diterapkan ke produksi.
  - `PRAGMA foreign_keys = ON` dijalankan sebelum query yang
    bergantung cascade, atau penghapusan baris anak dilakukan
    eksplisit di kode.
  - ID dibuat di Worker (`crypto.randomUUID()`), bukan oleh
    database.
  - File migrasi berversi (`0001_init.sql`, dst.) dan tercatat
    di repo.
- **Rencana darurat bila terjadi:**
  1. Jangan menerapkan migrasi susulan membabi buta — periksa
     dulu status migrasi yang sudah diterapkan.
  2. Bila migrasi gagal di tengah jalan, periksa tabel mana
     yang sudah berubah dan mana yang belum.
  3. Tulis migrasi perbaikan yang mengembalikan skema ke kondisi
     baik (bukan mengedit migrasi lama yang sudah diterapkan).
  4. Bila data rusak, pulihkan dari cadangan (lihat R08).
  5. Setelah pulih, tambah pengujian migrasi di CI: terapkan
     semua migrasi dari nol ke database kosong dan verifikasi
     skemanya.

### R20 — Mirror Vercel berbeda dari Pages (divergensi deploy)

- **Deskripsi:** Dua mirror menyajikan build yang berbeda:
  satu berhasil deploy dan satunya gagal, satu memakai
  variabel lingkungan yang salah (`VITE_API_BASE_URL` mengarah
  ke API yang salah atau tidak ada), atau satu mirror tertinggal
  beberapa rilis. Pengguna mendapat pengalaman berbeda
  tergantung mirror yang dibuka, dan bug hanya muncul di satu
  mirror sehingga sulit dilacak.
- **Kemungkinan: Sedang.** Dua target deploy berarti dua
  kesempatan gagal atau salah konfigurasi; variabel lingkungan
  diatur terpisah di dua dashboard.
- **Dampak: Sedang.** Satu mirror bisa menampilkan versi lama
  atau API yang salah; pengguna di mirror itu mengalami bug
  yang tidak dialami pengguna mirror lain. Tidak ada kehilangan
  data, tetapi membingungkan dan merusak kepercayaan.
- **Mitigasi yang sudah dirancang:**
  - Satu commit menghasilkan build yang sama untuk kedua mirror;
    hash build dicatat.
  - Uji smoke setelah deploy di kedua mirror (landing, tes WiFi
    tanpa akun, masuk Google, simpan laporan, buka riwayat).
  - `VITE_API_BASE_URL` di kedua mirror mengarah ke Worker
    yang sama.
- **Rencana darurat bila terjadi:**
  1. Bandingkan versi yang tayang di kedua mirror (hash build
     atau nomor versi di layar Tentang).
  2. Deploy ulang mirror yang tertinggal/salah dari commit
     yang sama.
  3. Periksa variabel lingkungan di dashboard mirror yang
     bermasalah.
  4. Jalankan uji smoke penuh di mirror yang baru diperbaiki.
  5. Bila satu mirror tidak bisa diperbaiki cepat, arahkan
     pengguna ke mirror yang sehat lewat pengumuman.

---

## 3. Matriks risiko (kemungkinan × dampak)

Setiap sel berisi nomor risiko. Risiko dengan dampak kritis
ditandai tebal.

| Kemungkinan \ Dampak | Rendah | Sedang | Tinggi | Kritis |
|---|---|---|---|---|
| **Tinggi** | — | **R13** (EPERM sandbox) | — | — |
| **Sedang** | — | R09 (deploy gagal), R20 (mirror divergen) | R01 (kuota D1), R02 (kuota Workers), R05 (satu akun Cloudflare), R07 (Google OAuth), R12 (harga/limit vendor), R14 (owner kehilangan akses), R15 (kebocoran secret), R16 (banjir request), R19 (migrasi D1) | **R10** (kebocoran data antar-user), **R11** (brute force PIN — dampak tinggi, lihat catatan) |
| **Rendah** | — | R03 (kuota KV), R06 (kunci Gemini) | R17 (Worker mati total), R18 (sesi dicuri) | **R04** (akun Cloudflare bermasalah), **R08** (D1 kehilangan data) |

Catatan: R11 (brute force PIN) dinilai dampak Tinggi, bukan
Kritis, karena serangannya menargetkan satu akun per satu akun
dan bisa dihentikan dengan kunci progresif — berbeda dengan R10
yang bisa membocorkan banyak akun sekaligus lewat satu bug.

### 3.1 Peta prioritas

| Prioritas | Risiko | Alasan |
|---|---|---|
| 1 (tertinggi) | R10 — kebocoran data antar-user | Sedang × Kritis; satu kelalaian membocorkan banyak akun |
| 2 | R08 — D1 kehilangan data | Rendah × Kritis; tanpa cadangan, kehilangan bersifat permanen |
| 3 | R04 — akun Cloudflare bermasalah | Rendah × Kritis; satu akun mematikan seluruh layanan |
| 4 | R01 — kuota D1 habis | Sedang × Tinggi; pemicu nyata dan dampak luas |
| 5 | R05 — ketergantungan satu akun Cloudflare | Sedang × Tinggi; kerapuhan struktural yang mendasari R04 |
| 6 | R07, R12, R14, R15, R16, R19 | Sedang × Tinggi; kelompok kedua yang perlu dipantau |
| 7 | R02 | Sedang × Tinggi; penilaian belum tajam karena angka limit Workers belum dicatat |
| 8 | R11 | Sedang × Tinggi; mitigasi kunci 30 detik sudah dirancang |
| 9 | R17, R18 | Rendah × Tinggi |
| 10 | R09, R13, R20 | Sedang × Sedang; mengganggu tetapi tidak melumpuhkan |
| 11 | R03, R06 | Rendah × Sedang |

---

## 4. Lima risiko teratas yang dipantau tiap minggu

Lima risiko ini ditinjau setiap minggu (bukan hanya tiap rilis),
karena kombinasi kemungkinan dan dampaknya paling besar, atau
karena kondisinya bisa berubah cepat tanpa peringatan.

### 4.1 R10 — Bug kebocoran data antar-pengguna

- **Yang dipantau tiap minggu:** hasil uji kepemilikan
  (pengguna A tidak bisa membaca data pengguna B) pada setiap
  endpoint yang disentuh minggu itu; daftar endpoint baru dan
  apakah masing-masing sudah memfilter `user_id` dari sesi.
- **Tanda bahaya:** ada endpoint baru tanpa uji kepemilikan;
  ada query yang menerima `user_id` dari client; uji
  kepemilikan gagal atau dilewati.
- **Tindakan bila tanda bahaya muncul:** nonaktifkan endpoint
  yang bersangkutan sampai uji kepemilikan lolos (lihat R10).

### 4.2 R08 — D1 kehilangan data

- **Yang dipantau tiap minggu:** status cadangan D1 — kapan
  cadangan terakhir dibuat, di mana disimpan, dan apakah
  cadangan itu sudah diuji pulih. Sampai jadwal cadangan
  ditetapkan, item ini berstatus MERAH.
- **Tanda bahaya:** tidak ada cadangan dalam 7 hari terakhir;
  cadangan belum pernah diuji pulih; ada rencana migrasi
  skema minggu itu tanpa cadangan sebelum migrasi.
- **Tindakan bila tanda bahaya muncul:** buat cadangan segera
  sebelum pekerjaan lain; uji pemulihan cadangan ke database
  kosong; tetapkan jadwal cadangan berkala.

### 4.3 R01 — Kuota D1 habis

- **Yang dipantau tiap minggu:** metrik D1 di dashboard
  Cloudflare — baris dibaca dan ditulis per hari, tren
  7 hari terakhir, dan jarak ke batas (5 juta baca / 100 ribu
  tulis per hari).
- **Tanda bahaya:** pemakaian harian melewati 50% batas secara
  konsisten; lonjakan mendadak tanpa penjelasan; satu endpoint
  mendominasi pemakaian baris.
- **Tindakan bila tanda bahaya muncul:** audit query endpoint
  yang boros; perketat `LIMIT` dan paginasi; tambah rate limit
  bila penyebabnya satu sumber.

### 4.4 R05 — Ketergantungan pada satu akun Cloudflare (hiroohengkerr)

- **Yang dipantau tiap minggu:** akses ke akun Cloudflare masih
  berfungsi (login berhasil, dashboard bisa dibuka); daftar
  secret yang perlu dibuat ulang bila pindah akun masih lengkap
  dan mutakhir; kesiapan akun cadangan (apakah sudah ada akun
  Cloudflare kedua milik owner yang siap dipakai).
- **Tanda bahaya:** login ke dashboard gagal; ada peringatan
  keamanan dari Cloudflare; belum ada akun cadangan yang siap;
  daftar secret untuk pembangunan ulang tidak mutakhir.
- **Tindakan bila tanda bahaya muncul:** pulihkan akses segera;
  siapkan akun cadangan dan uji deploy Worker + D1 dari repo
  ke akun itu (tanpa memindahkan layanan produksi).

### 4.5 R06 — Kunci Gemini tidak valid atau kedaluwarsa

- **Yang dipantau tiap minggu:** hasil panggilan tes Gemini
  dari Worker (satu panggilan kecil tiap minggu); kunci
  terverifikasi valid 17 November 2026 22:13 WIB (K-20) — yang
  dipantau sekarang adalah pencabutan/kedaluwarsa mendadak.
- **Tanda bahaya:** panggilan tes gagal; ada pesan dari Google
  tentang kunci atau kuota; log server mencatat
  `GEMINI_KUOTA_HABIS` berulang.
- **Tindakan bila tanda bahaya muncul:** buat kunci baru di
  Google AI Studio dan perbarui secret Worker; uji Diagnosis AI
  end-to-end setelah penggantian.

---

## 5. Celah mitigasi yang masih terbuka

Daftar ini adalah pekerjaan rumah yang ditemukan saat menyusun
register ini. Setiap item harus ditutup sebelum rilis, atau
diputuskan secara eksplisit oleh koordinator untuk ditunda
dengan alasan tercatat.

| # | Celah | Terkait | Status |
|---|---|---|---|
| 1 | Belum ada jadwal cadangan D1 berkala | R08 | Terbuka — tetapkan sebelum rilis |
| 2 | Angka limit Workers free tier belum dicatat | R02 | Terbuka — verifikasi dari dokumentasi/dashboard Cloudflare |
| 3 | Validitas kunci Gemini lama (22 Okt 2026) belum terkonfirmasi | R06 | **Tertutup 18 November 2026 (Wave 3b)** — kunci terverifikasi valid 17 Nov 22:13 WIB (HTTP 200, 50 model, K-20) |
| 4 | Belum ada akun Cloudflare cadangan yang siap | R04, R05 | Terbuka — siapkan dan uji deploy ke akun kedua |
| 5 | Daftar akun kunci + jalur pemulihan belum dicatat | R14 | Terbuka — catat tanpa kata sandi |
| 6 | Client ID Google OAuth belum dibuat; status verifikasi consent screen belum diketahui | R07 | Terbuka — buat dan ajukan verifikasi lebih awal |
| 7 | Pemeriksaan secret otomatis di CI belum ada | R15 | Terbuka — tambah ke pipeline sebelum rilis |

---

## 6. Changelog dokumen

### 18 November 2026 — Wave 3b (Tim Integrasi)

- R06 (kunci Gemini): kemungkinan Sedang → **Rendah** setelah
  kunci terverifikasi valid 17 November 2026 22:13 WIB
  (HTTP 200, 50 model — K-20). R06 pindah di matriks
  (Sedang×Sedang → Rendah×Sedang) dan peta prioritas
  (prioritas 10 → 11, bersama R03); celah mitigasi #3 ditutup.
  Dampak tetap Sedang; fallback AI kini jawaban aturan
  berlabel saran (K-23), bukan pesan "tidak tersedia".

### 17 November 2026 — versi awal

- Register risiko pertama: 20 risiko (R01–R20), matriks
  kemungkinan × dampak, 5 risiko teratas untuk pemantauan
  mingguan, dan 7 celah mitigasi yang masih terbuka.
