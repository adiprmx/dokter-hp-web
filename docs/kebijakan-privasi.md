# Kebijakan Privasi — Dokter HP

**Terakhir diperbarui:** 18 November 2026

Dokter HP adalah aplikasi web yang membantu pengguna memeriksa kondisi
HP mereka lewat browser, mulai dari WiFi, baterai, penyimpanan,
performa, hingga keamanan. Dokumen ini menjelaskan data apa saja yang
dikumpulkan Dokter HP, untuk apa data itu dipakai, di mana data itu
disimpan, dan hak apa saja yang dimiliki pengguna atas datanya.
Bahasa yang dipakai di sini sengaja dibuat sederhana agar mudah
dipahami siapa pun.

## Ringkasan singkat

- Dokter HP hanya mengumpulkan data yang dibutuhkan agar fitur-fiturnya
  berjalan: akun, riwayat pemeriksaan, laporan WiFi, dan riwayat
  tanya-jawab AI.
- Data hanya bisa dilihat oleh pemilik akun itu sendiri.
- Dokter HP tidak menampilkan iklan, tidak memakai pelacakan pihak
  ketiga, tidak menjual data, dan tidak memakai payment gateway.
- Pengguna bisa melihat, mengekspor, dan menghapus seluruh datanya
  kapan saja.

## 1. Data yang dikumpulkan dan tujuannya

### 1.1 Data akun

Saat pengguna masuk dengan Google, Dokter HP menerima dan menyimpan:

| Data | Tujuan |
|---|---|
| Nama | Menampilkan nama di profil dan dashboard |
| Alamat email | Mengidentifikasi akun pengguna |

Data ini berasal dari akun Google pengguna dan hanya diambil setelah
pengguna menekan tombol masuk dan menyetujui di halaman Google.
Pengenal akun Google (sub) hanya dipakai sesaat untuk memvalidasi
profil saat masuk dan tidak disimpan; akun yang sama dikenali dari
alamat email Google yang terverifikasi.
Dokter HP tidak menerima atau menyimpan kata sandi Google pengguna.

### 1.2 PIN aplikasi

Pengguna boleh mengatur PIN 4–8 digit sebagai kunci tambahan untuk
membuka aplikasi. PIN asli **tidak pernah disimpan**. Yang disimpan
hanya hasil hash HMAC-SHA256 dari PIN yang dicampur salt (nilai
acak) dan kunci rahasia server (pepper) yang tidak tersimpan di
database. Karena itu, tidak ada pihak mana pun, termasuk pengembang,
yang bisa melihat PIN pengguna.

Bila pengguna lupa PIN, pemulihannya adalah masuk ulang dengan
Google, lalu mengatur PIN baru dari Pengaturan. Riwayat yang sudah
tersimpan tetap aman.

Dokter HP juga mencatat jumlah percobaan PIN salah berturut-turut
dan waktu kunci sementara, untuk mencegah tebakan PIN: setelah
5 kali salah berturut-turut, masukan PIN dikunci selama 30 detik.

### 1.3 Riwayat pemeriksaan kesehatan

Setiap kali pengguna menjalankan diagnosis, Dokter HP menyimpan:

- Skor kesehatan HP (0–100).
- Ringkasan hasil pemeriksaan dalam bentuk data terstruktur
  (status baterai, penyimpanan, performa, keamanan, dan sumber
  tiap komponen (misalnya dari tes web, dari input manual, atau
  dari riwayat APK).

Tujuannya: menampilkan skor, grafik riwayat, dan tiga pemeriksaan
terakhir di dashboard, serta memungkinkan pengguna melihat
perkembangan kondisi HP dari waktu ke waktu.

### 1.4 Laporan WiFi

Setiap kali pengguna menjalankan tes WiFi sambil masuk, Dokter HP
menyimpan:

- Hasil tes kecepatan unduh dan latensi HTTP yang diukur di browser.
- Informasi jaringan yang diisi manual oleh pengguna bila ia
  mengetahuinya, misalnya SSID (nama jaringan WiFi), kekuatan
  sinyal, channel, dan DNS.
- Sampel kecepatan per detik dari tes bertahan 30 detik (maksimal
  30 sampel per laporan).
- Rekomendasi yang ditampilkan bersama hasil tes.

Perlu diketahui: browser tidak bisa membaca SSID, sinyal, channel,
atau DNS perangkat secara otomatis. Kolom-kolom itu hanya terisi
bila pengguna mengisinya sendiri. Tes WiFi yang dijalankan tanpa
masuk (tombol "Coba tes WiFi tanpa akun") tidak menyimpan apa pun.
Hasilnya hanya tampil di layar.

### 1.5 Riwayat tanya-jawab AI

Saat pengguna memakai Diagnosis AI, Dokter HP menyimpan pertanyaan
yang dikirim dan jawaban yang diterima, agar pengguna bisa melihat
kembali riwayat tanya-jawabnya. Penjelasan lebih lanjut tentang
pemrosesan data AI ada di bagian 6.

### 1.6 Data sesi dan teknis

Agar pengguna tetap masuk dan agar layanan berjalan aman, Dokter HP
menyimpan:

- Hash token sesi (SHA-256). Token mentahnya hanya ada di cookie
  browser pengguna dan tidak pernah disimpan di server.
- Informasi perangkat lunak browser (user agent) dan alamat IP
  terakhir, untuk menampilkan daftar sesi aktif di Pengaturan
  sehingga pengguna bisa keluar dari sesi lain.

Alamat IP publik memang tampil saat tes WiFi dijalankan (sebagai
bagian dari hasil tes jaringan), tetapi tidak disimpan bersama
laporan WiFi.

Dokter HP tidak mencatat isi PIN, token sesi mentah, atau isi
lengkap jawaban AI di dalam log server. Log hanya berisi id,
status, dan waktu.

### 1.7 Data yang TIDAK dikumpulkan

- Dokter HP tidak membaca daftar aplikasi, level baterai,
  penyimpanan, RAM, CPU, atau suhu HP secara langsung dari browser.
  Browser tidak mengizinkannya. Data semacam itu hanya ada bila
  pengguna mengisinya manual atau berasal dari riwayat APK.
- Dokter HP tidak mengumpulkan lokasi, kontak, foto, atau file
  dari perangkat pengguna.
- Dokter HP tidak memakai iklan dan tidak memakai alat pelacak
  pihak ketiga (analytics/tracker).

## 2. Di mana data disimpan

Seluruh data pengguna disimpan di database Cloudflare D1, yaitu
database yang dikelola untuk proyek Dokter HP. Data inti (akun,
riwayat, diagnosis) tinggal di database ini dan tidak diserahkan
ke layanan pihak ketiga lain, kecuali dua pengecualian yang
dijelaskan di bagian 6 dan 7.

Seluruh komunikasi antara browser dan server memakai HTTPS
(koneksi terenkripsi).

## 3. Siapa yang bisa melihat data

- **Hanya pengguna sendiri.** Setiap permintaan data difilter
  berdasarkan akun yang sedang masuk. Pengguna A tidak bisa
  membaca, mengubah, atau menghapus data pengguna B.
- **Pengembang** tidak mengakses data pengguna untuk keperluan
  sehari-hari. Akses ke database hanya dilakukan bila diperlukan
  untuk pemeliharaan teknis atau perbaikan gangguan, dan tidak
  dipakai untuk membaca isi data pribadi pengguna.
- **Tidak ada pihak lain.** Dokter HP tidak membagikan, menyewakan,
  atau menjual data pengguna kepada siapa pun, dan tidak
  menampilkan iklan yang membutuhkan data pengguna.

## 4. Berapa lama data disimpan

- **Data akun dan riwayat** disimpan selama akun masih ada.
  Pengguna bisa menghapus entri riwayat satu per satu dari halaman
  Riwayat. Entri yang dihapus disembunyikan dari tampilan
  (ditandai terhapus) dan dihapus permanen saat akun dihapus.
- **Sesi login** berlaku 30 hari sejak dibuat, lalu kedaluwarsa
  secara otomatis. Pengguna bisa keluar kapan saja, dan keluar
  akan menghapus sesi tersebut dari server.
- **PIN** tersimpan sebagai hash selama pengguna tidak menghapusnya.
  Pengguna bisa mengubah atau menghapus PIN dari Pengaturan.
- **Menghapus akun** akan menghapus profil dan seluruh data pengguna
  secara permanen, termasuk riwayat pemeriksaan, laporan WiFi,
  dan riwayat tanya-jawab AI. Penghapusan akun tidak bisa
  dibatalkan.

## 5. Cookie dan sesi

Dokter HP memakai cookie hanya untuk keperluan login, bukan untuk
pelacakan:

| Cookie | Fungsi | Masa berlaku |
|---|---|---|
| `__Host-dokter_hp_session` | Menyimpan token sesi agar pengguna tetap masuk | 30 hari |
| Cookie sementara saat masuk Google | Menyimpan penanda keamanan (state dan PKCE) selama proses masuk | Berakhir setelah proses masuk selesai |

Cookie sesi bersifat HttpOnly (tidak bisa dibaca oleh skrip di
halaman web), Secure (hanya dikirim lewat HTTPS), dan SameSite=None
(diperlukan karena halaman web dan server API berada di alamat
yang berbeda). Dokter HP tidak memakai cookie
iklan, cookie pelacak, atau cookie pihak ketiga.

Bila pengguna memblokir cookie di browser, fitur masuk dan
penyimpanan riwayat tidak akan berfungsi, tetapi tes WiFi tanpa
akun tetap bisa dijalankan.

## 6. Data AI (Diagnosis AI)

Saat pengguna mengirim pertanyaan ke Diagnosis AI:

1. Pertanyaan dikirim dari browser ke server Dokter HP.
2. Server menambahkan ringkasan data perangkat pengguna
   (pemeriksaan terakhir dan laporan WiFi terakhir) sebagai
   konteks, lalu mengirim pertanyaan beserta konteks tersebut ke
   layanan Google Gemini. Pengiriman ini terjadi dari server,
   bukan dari browser, dan kunci API tidak pernah ada di browser.
3. Jawaban dari Gemini disimpan ke riwayat tanya-jawab pengguna
   dan ditampilkan di layar.

Artinya, pertanyaan pengguna dan ringkasan data perangkatnya
diproses oleh Google Gemini untuk menghasilkan jawaban. Pengguna
disarankan tidak menuliskan informasi yang sangat sensitif
(misalnya kata sandi, nomor rekening, atau nomor identitas) di
dalam pertanyaan AI.

Jawaban AI adalah saran, bukan vonis pasti. Bila layanan AI sedang
tidak tersedia, Dokter HP menampilkan pesan yang jujur dan tidak
mengarang jawaban.

## 7. Layanan pihak ketiga yang dipakai

Dokter HP memakai dua layanan pihak ketiga, hanya untuk fungsi
yang disebutkan:

| Layanan | Fungsi | Data yang diterima |
|---|---|---|
| Google (Masuk dengan Google) | Identitas akun | Pengguna masuk lewat Google; Google mengembalikan nama, email, dan pengenal akun ke server Dokter HP |
| Google Gemini | Mesin Diagnosis AI | Pertanyaan pengguna dan ringkasan data perangkat, dikirim dari server |

Selain kedua layanan di atas, Dokter HP tidak mengirim data
pengguna ke pihak ketiga mana pun. Laporan PDF dibuat di browser
pengguna sendiri (bukan dikirim ke layanan PDF pihak ketiga).
Infrastruktur hosting (Cloudflare Pages, Vercel sebagai mirror,
dan Cloudflare Worker) hanya menjalankan aplikasi dan database
Dokter HP.

## 8. Keamanan data

Dokter HP melindungi data pengguna dengan langkah-langkah berikut:

- Seluruh komunikasi memakai HTTPS.
- PIN disimpan sebagai hash HMAC-SHA256 + salt + kunci rahasia
  server (pepper), bukan teks asli.
- Token sesi disimpan sebagai hash; token mentah hanya ada di
  cookie pengguna.
- Kunci API dan secret lain hanya tersimpan di sisi server dan
  tidak pernah ada di kode aplikasi atau di browser.
- Setiap permintaan data memeriksa kepemilikan akun sebelum
  mengembalikan apa pun.
- Input pengguna divalidasi di server, dan query database memakai
  parameter terikat untuk mencegah penyalahgunaan.
- Percobaan PIN dibatasi: 5 kali salah berturut-turut mengunci
  masukan selama 30 detik.
- Permintaan ke layanan AI dibatasi per pengguna per hari agar
  kuota bersama tidak dihabiskan satu pengguna.

Tidak ada sistem yang bisa menjamin keamanan mutlak. Bila terjadi
gangguan keamanan yang memengaruhi data pengguna, pengembang akan
menginformasikannya melalui aplikasi dan memperbaikinya secepat
mungkin.

## 9. Hak pengguna

Pengguna Dokter HP berhak:

- **Melihat** seluruh datanya: profil di Pengaturan, riwayat di
  halaman Riwayat, dan riwayat tanya-jawab di halaman Diagnosis AI.
- **Mengekspor** datanya: mengunduh laporan PDF berisi riwayat
  pemeriksaan dan WiFi dari halaman Riwayat, atau mengunduh
  seluruh data sebagai berkas JSON dari Pengaturan. PDF dibuat di
  browser dari data pengguna sendiri.
- **Menghapus** datanya: menghapus entri riwayat satu per satu,
  atau menghapus akun beserta seluruh datanya dari Pengaturan
  (penghapusan akun bersifat permanen dan tidak bisa dibatalkan).
- **Mengubah** datanya: mengubah nama tampilan dan PIN dari
  Pengaturan.
- **Keluar** dari satu atau semua sesi dari Pengaturan.
- **Memakai layanan tanpa akun** untuk tes WiFi sekali jalan,
  tanpa data apa pun yang tersimpan.

## 10. Perubahan kebijakan

Bila kebijakan ini berubah, versi terbaru akan ditampilkan di
aplikasi dan tanggal "Terakhir diperbarui" di atas akan disesuaikan.
Perubahan yang bersifat besar (misalnya jenis data baru yang
dikumpulkan) akan diumumkan di dalam aplikasi sebelum berlaku.
Pengguna yang tidak setuju dengan perubahan tersebut dapat
menghapus akunnya beserta seluruh datanya.

## 11. Kontak

Pertanyaan, keberatan, atau permintaan terkait data pribadi dapat
disampaikan kepada pengembang Dokter HP melalui repositori publik
proyek Dokter HP (repo `adiprmx/dokter-hp`) atau melalui halaman
Tentang di dalam aplikasi.

---

## Catatan peninjauan

Pada 18 November 2026, Tim Privasi (redesign v2.0, Wave 1) meninjau
dokumen ini terhadap kode produk v1.0 yang sudah live dan
menghapus status drafnya. Peninjauan menemukan empat klaim yang
tidak sesuai kenyataan dan memperbaikinya: (1) pengenal akun Google
(sub) ternyata tidak disimpan, akun dikenali dari email Google yang
terverifikasi; (2) PIN disimpan sebagai hash HMAC-SHA256 dengan salt
dan kunci rahasia server (pepper), bukan hash SHA-256 biasa;
(3) alamat IP publik saat tes WiFi hanya ditampilkan, tidak disimpan
bersama laporan; (4) cookie sesi memakai SameSite=None, bukan
SameSite=Lax (kesalahan hanya di halaman web, dokumen sudah benar).
Hak ekspor juga dilengkapi dengan unduhan JSON dari Pengaturan.
Seluruh klaim lain terverifikasi benar terhadap kode.
