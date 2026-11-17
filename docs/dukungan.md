# Dukungan Pengguna — Dokter HP Web App

> **Status:** Fase 1 — dokumen, 17 November 2026.
> Dokumen ini mengatur sistem dukungan pengguna Dokter HP Web App.
> Sumber kebenaran fitur: `PRODUCT.md`. Semua jawaban di dokumen ini
> hanya merujuk pada fitur yang dirancang di `PRODUCT.md`.

---

## 1. Prinsip dukungan

1. **Satu pengembang.** Owner adalah satu-satunya pengembang dan
   satu-satunya yang menangani dukungan. Sistem dukungan dirancang
   ringan: jawaban terbanyak tersedia mandiri lewat FAQ, dan laporan
   yang masuk dikerjakan berdasarkan prioritas (bagian 5).
2. **Tanpa janji waktu respons pasti.** Dukungan tidak menjanjikan
   balasan dalam jumlah jam atau hari tertentu. Setiap laporan yang
   masuk dibaca dan ditangani sesuai prioritasnya.
3. **Bahasa sehari-hari.** Balasan memakai Bahasa Indonesia yang
   mudah dipahami pemilik HP umum, bukan teknisi. Istilah teknis
   dijelaskan saat pertama kali muncul.
4. **Jujur soal batasan.** Bila sesuatu tidak bisa dilakukan versi
   web (misalnya membaca SSID atau memindai baterai secara langsung),
   jawaban menjelaskannya terus terang beserta cara manualnya,
   sesuai bagian 11 `PRODUCT.md`.
5. **Tidak pernah meminta PIN atau kata sandi.** Dukungan tidak
   pernah meminta PIN aplikasi, kata sandi Google, atau kode
   verifikasi apa pun. Bila ada pihak yang meminta hal itu dengan
   mengatasnamakan Dokter HP, abaikan.
6. **Data nyata saja.** Dukungan tidak mengarang angka atau hasil
   tes. Bila data tidak tersedia, jawabannya adalah "tidak tersedia"
   beserta langkah berikutnya.

---

## 2. Kanal dukungan

| Kanal | Dipakai untuk | Keterangan |
|---|---|---|
| Formulir laporan masalah di aplikasi | Melaporkan masalah saat memakai aplikasi, mengirim saran fitur | Tersedia di dalam aplikasi; laporan masuk beserta konteks akun pengguna yang masuk |
| Email dukungan | Laporan yang tidak bisa dikirim lewat aplikasi (misalnya tidak bisa masuk sama sekali), pertanyaan privasi dan data | Alamat email dukungan tercantum di halaman Tentang di dalam aplikasi |

Keterangan kanal:

- **Formulir di aplikasi adalah kanal utama.** Formulir memakai
  template pada bagian 3 agar laporan langsung memuat informasi
  yang dibutuhkan, tanpa bolak-balik tanya jawab.
- **Email adalah kanal cadangan** untuk situasi ketika aplikasi
  tidak bisa dibuka atau pengguna tidak bisa masuk. Alamat email
  dukungan diputuskan owner sebelum rilis dan dicantumkan di halaman
  Tentang (layar Pengaturan akun, bagian Tentang, sesuai
  `PRODUCT.md` bagian 4.8).
- **Tidak ada kanal lain yang dijanjikan.** Dokter HP Web App tidak
  menyediakan obrolan langsung (live chat), nomor telepon, atau
  dukungan lewat media sosial. Laporan yang masuk lewat kanal lain
  akan diarahkan kembali ke formulir atau email.
- **Bahasa dukungan:** Bahasa Indonesia.

### 2.1 Alur penanganan laporan (ringan, untuk owner)

1. Baca laporan, cocokkan dengan FAQ (bagian 4). Bila jawabannya
   sudah ada di FAQ, balas dengan templat yang sesuai (bagian 6).
2. Bila laporan belum lengkap, minta informasi yang kurang sesuai
   template bagian 3 — cukup satu balasan yang menanyakan semuanya
   sekaligus.
3. Tentukan prioritas sesuai bagian 5.
4. Bila masalah adalah bug, catat sebagai tugas perbaikan dengan
   prioritasnya. Bila masalah adalah batasan web yang memang
   dirancang demikian, jelaskan batasannya beserta cara manualnya.
5. Bila laporan menyangkut data pribadi (misalnya permintaan hapus
   akun yang tidak bisa dilakukan sendiri), tangani sesuai
   `docs/kebijakan-privasi.md`.

---

## 3. Template laporan masalah

Formulir laporan masalah di aplikasi memakai kolom berikut.
Kolom bertanda wajib harus diisi sebelum laporan dikirim.

### 3.1 Kolom formulir

| Kolom | Wajib | Keterangan |
|---|---|---|
| Apa yang terjadi | Ya | Jelaskan masalahnya dalam satu atau dua kalimat. Contoh: "Tes WiFi berhenti di tengah jalan dan muncul pesan galat." |
| Langkah mengulang | Ya | Langkah yang dilakukan sebelum masalah muncul, berurutan. Contoh: 1) Buka Dokter WiFi. 2) Ketuk "Periksa WiFi sekarang". 3) Tunggu sampai tahap kecepatan unduh. |
| Kapan terjadi | Tidak | Tanggal dan kira-kira jam terjadinya, bila masih ingat. |
| Perangkat | Ya | Merek dan model HP, versi Android, nama dan versi browser yang dipakai. Contoh: "Samsung Galaxy A15, Android 14, Chrome 130." |
| Koneksi saat terjadi | Tidak | WiFi atau data seluler, dan nama jaringan bila memakai WiFi. |
| Screenshot | Tidak | Tangkapan layar pesan galat atau tampilan yang bermasalah, bila ada. |
| Sedang masuk akun? | Ya | Apakah pengguna sedang masuk dengan akun Google atau memakai tes tanpa akun saat masalah terjadi. |

### 3.2 Contoh laporan yang baik

> **Apa yang terjadi:** Tes bertahan 30 detik berhenti di detik ke-12
> dan grafik tidak tampil.
>
> **Langkah mengulang:**
> 1. Masuk dengan Google.
> 2. Buka Dokter WiFi.
> 3. Ketuk "Tes bertahan 30 detik".
> 4. Tunggu sampai detik ke-12 — tes berhenti sendiri.
>
> **Kapan terjadi:** 17 November 2026, sekitar pukul 20.00 WIB.
>
> **Perangkat:** Xiaomi Redmi Note 13, Android 14, Chrome 131.
>
> **Koneksi saat terjadi:** WiFi rumah.
>
> **Screenshot:** terlampir.
>
> **Sedang masuk akun?** Ya.

### 3.3 Hal yang tidak perlu dikirim

- PIN aplikasi, kata sandi Google, atau kode verifikasi apa pun.
- Foto KTP atau dokumen identitas.
- Kata sandi WiFi atau kata sandi halaman admin router. Bila laporan
  menyangkut router, cukup sebut merek/model routernya (misalnya
  ZTE F660).

---

## 4. FAQ dukungan

Jawaban di bawah ini singkat dan langkah demi langkah. Semua jawaban
sesuai dengan fitur yang dirancang di `PRODUCT.md`.

### 4.1 Akun, PIN, dan masuk

**1. Saya lupa PIN. Bagaimana cara membukanya?**

PIN tidak bisa dilihat kembali karena hanya tersimpan sebagai kode
acak (hash) di server. Cara memulihkannya:

1. Keluar dari layar kunci, lalu masuk ulang dengan akun Google.
2. Buka **Pengaturan**.
3. Atur PIN baru (4–8 digit).
4. Riwayat pemeriksaan yang sudah tersimpan tetap aman dan tidak
   hilang.

**2. Saya tidak bisa masuk dengan Google. Apa yang harus dilakukan?**

1. Pastikan koneksi internet aktif — coba buka situs lain di browser
   yang sama.
2. Coba lagi tombol **Masuk dengan Google**.
3. Bila muncul pesan galat dari Google, pastikan akun Google yang
   dipilih adalah akun yang benar dan kata sandinya benar di sisi
   Google (Dokter HP tidak menyimpan kata sandi Google).
4. Bila masih gagal, coba browser lain di HP yang sama, atau hapus
   data situs Dokter HP di pengaturan browser lalu coba lagi.
5. Bila tetap gagal, kirim laporan lewat email dukungan dengan
   menyertakan pesan galat yang muncul dan perangkat yang dipakai.

**3. PIN saya terkunci setelah salah beberapa kali. Berapa lama?**

Setelah 5 kali PIN salah berturut-turut, masukan PIN dikunci selama
30 detik. Tunggu 30 detik, lalu coba lagi dengan PIN yang benar.
Bila PIN memang terlupa, ikuti langkah pada pertanyaan 1 (masuk
ulang dengan Google, lalu atur PIN baru dari Pengaturan).

**4. Apakah saya bisa masuk dengan sidik jari atau wajah?**

Tidak di versi web ini. Sidik jari dan wajah hanya tersedia di APK
Dokter HP (Android). Versi web memakai PIN ditambah sesi masuk
Google.

**5. Bagaimana cara mengganti atau menghapus PIN?**

1. Masuk ke aplikasi.
2. Buka **Pengaturan**.
3. Pilih bagian PIN, lalu pilih ubah PIN atau hapus PIN.
4. Bila PIN dihapus, aplikasi langsung terbuka tanpa layar kunci
   sampai PIN diatur lagi.

**6. Saya melihat sesi yang tidak saya kenali di daftar sesi aktif.
Apa yang harus dilakukan?**

1. Buka **Pengaturan**, lalu buka daftar sesi aktif.
2. Ketuk **Keluar dari sesi lain** untuk mengakhiri semua sesi
   selain sesi yang sedang dipakai.
3. Bila masih khawatir, ganti juga kata sandi akun Google dan
   periksa aktivitas akun Google, karena masuk ke Dokter HP memakai
   akun Google.

### 4.2 Data dan riwayat

**7. Riwayat pemeriksaan saya hilang. Apakah bisa kembali?**

1. Pastikan sudah masuk dengan akun Google yang sama seperti saat
   pemeriksaan dilakukan. Riwayat tersimpan per akun.
2. Buka **Riwayat** dan periksa filter jenis pemeriksaan — mungkin
   filter sedang menyembunyikan jenis tertentu.
3. Perlu diketahui: tes WiFi yang dijalankan tanpa masuk akun
   memang tidak tersimpan ke riwayat (hasilnya hanya tampil di
   layar). Itu perilaku yang dirancang, bukan kehilangan data.
4. Bila riwayat yang dihapus adalah riwayat yang sengaja dihapus
   lewat tombol hapus, data tersebut sudah ditandai terhapus dan
   tidak tampil lagi di daftar.
5. Bila akun sudah benar, filter sudah benar, dan riwayat tetap
   tidak ada, kirim laporan dengan menyebutkan tanggal pemeriksaan
   yang hilang dan perangkat yang dipakai.

**8. Bagaimana cara menghapus satu riwayat pemeriksaan?**

1. Buka **Riwayat**.
2. Cari pemeriksaan yang dimaksud.
3. Ketuk tombol hapus pada entri tersebut.
4. Entri tersebut tidak tampil lagi di daftar. (Secara teknis data
   ditandai terhapus, bukan dihapus permanen dari server.)

**9. Grafik riwayat skor saya kosong. Apakah ada yang rusak?**

Tidak. Grafik menampilkan garis skor dari riwayat pemeriksaan yang
sudah tersimpan. Bila belum pernah menjalankan **Diagnosis satu
ketuk** atau pemeriksaan tersimpan lainnya, grafik menampilkan
pesan "Belum ada data pemeriksaan". Jalankan **Diagnosis satu
ketuk** dari dashboard, lalu grafik akan terisi.

**10. Data baterai, penyimpanan, dan performa saya tidak berubah
atau tidak ada data baru. Kenapa?**

Versi web tidak bisa membaca sensor HP secara langsung (batasan
browser). Keempat dokter tersebut — Baterai, Penyimpanan,
Performa, Keamanan — menampilkan riwayat dan data yang diisi
manual, bukan pemindaian langsung. Cara mengisinya:

1. Buka dokter yang dimaksud (misalnya Dokter Baterai).
2. Isi data secara manual, atau salin angka dari HP (misalnya dari
   Pengaturan > Baterai) dan dari APK Dokter HP bila memakai APK.
3. Setiap entri menampilkan tanggal dan sumbernya ("diisi manual"
   atau "dari APK").

Sinkron otomatis dari APK ke web belum tersedia di rilis pertama;
sampai saat itu, data APK masuk ke web lewat input manual.

### 4.3 Tes WiFi dan skor

**11. Tes WiFi gagal atau berhenti di tengah jalan. Apa yang harus
dilakukan?**

1. Pastikan koneksi internet aktif.
2. Tutup unduhan atau video yang sedang berjalan di HP, lalu coba
   lagi.
3. Bila muncul banner "Tidak tersambung ke server — hasil tes
   tidak tersimpan", server sedang tidak terjangkau. Tes WiFi tetap
   bisa jalan di browser, tetapi hasilnya tidak tersimpan ke
   riwayat. Coba lagi nanti setelah server terjangkau.
4. Bila tes selalu gagal di tahap yang sama, catat tahapnya, lalu
   kirim laporan dengan template pada bagian 3.

**12. Hasil tes WiFi saya sangat lambat, tetapi HP lain di rumah
normal. Apakah HP saya rusak?**

Belum tentu. Ikuti dua tes pembeda pada kartu panduan WiFi turun
di Dokter WiFi:

1. Coba HP yang sama di jaringan WiFi lain (misalnya hotspot teman).
   Bila di sana normal, masalah ada di router atau jaringan rumah,
   bukan di HP.
2. Coba HP lain di WiFi yang sama. Bila HP lain juga lambat,
   masalah ada di router atau jaringan.
3. Penyebab yang sering terjadi: mode router masih 802.11b Only
   (teknologi lama, maksimal 11 Mbps). Solusinya mengubah mode
   router ke 802.11b/g/n Mixed di halaman admin router — panduan
   lengkap ada di Dokter WiFi, termasuk contoh router ZTE F660.
4. Coba juga ganti channel router 2,4 GHz ke 1, 6, atau 11, karena
   hanya ketiganya yang tidak saling tumpang tindih.

**13. Kenapa kolom SSID, sinyal, dan channel tampil "tidak
tersedia"?**

Browser tidak bisa membaca SSID, kekuatan sinyal, channel,
gateway, atau DNS perangkat. Itu batasan browser, bukan kerusakan.
Kolom tersebut bisa diisi manual bila informasinya diketahui
(misalnya dari halaman admin router atau dari APK Dokter HP), atau
dibiarkan kosong.

**14. Skor kesehatan HP saya turun. Apa artinya?**

Skor 0–100 dihitung hanya dari komponen yang datanya tersedia.
Skor bisa turun karena:

1. Ada hasil tes WiFi baru yang lebih lambat dari sebelumnya.
2. Ada data manual baru (misalnya penyimpanan semakin penuh) yang
   mengubah komponen skor.
3. Komponen yang sebelumnya tidak ada datanya kini terisi dan ikut
   dihitung, sehingga bobot komponen lain menyesuaikan.

Cara memeriksa: buka dashboard, lihat penjelasan per komponen dan
sumber data tiap komponen, lalu bandingkan dengan tiga pemeriksaan
terakhir. Skor adalah ringkasan kondisi, bukan vonis kerusakan —
ikuti rekomendasi pada komponen yang nilainya paling rendah.

**15. Apa bedanya "latensi HTTP" dengan ping?**

Keduanya mengukur jeda koneksi, tetapi browser tidak bisa mengirim
ping ICMP mentah. Dokter HP Web App mengukur jeda lewat permintaan
HTTP kecil ke server, sehingga hasilnya dilabeli "latensi HTTP"
agar jujur. Angka ini tetap berguna untuk membandingkan cepat atau
lambatnya respons koneksi dari waktu ke waktu.

### 4.4 Diagnosis AI, laporan, dan akun

**16. Diagnosis AI tidak menjawab atau muncul pesan "tidak
tersedia". Apa yang harus dilakukan?**

1. Tunggu beberapa saat, lalu coba kirim lagi keluhan yang sama.
2. Bila pesan "Diagnosis AI sedang tidak tersedia, coba lagi
   nanti" terus muncul, layanan AI sedang bermasalah di sisi server
   atau kuota bersama sedang habis. Coba lagi nanti.
3. Bila keluhan sering dikirim dalam waktu singkat, batas pemakaian
   wajar (rate limit) di server mungkin sedang berlaku — beri jeda,
   lalu coba lagi.
4. Jawaban AI adalah saran, bukan vonis pasti. Untuk masalah WiFi,
   panduan di Dokter WiFi tetap bisa diikuti tanpa AI.

**17. Laporan PDF tidak terunduh. Bagaimana cara mengatasinya?**

1. Pastikan sudah masuk akun dan ada data riwayat — PDF dibuat dari
   data riwayat yang nyata.
2. Buka **Riwayat**, lalu ketuk **Unduh laporan PDF** dan tunggu
   sampai file selesai dibuat di browser.
3. Periksa pengaturan browser: izinkan unduhan dari situs Dokter HP
   dan periksa folder unduhan.
4. Bila tetap gagal, coba browser lain di HP yang sama.

**18. Bagaimana cara menghapus akun saya beserta seluruh data?**

1. Masuk ke aplikasi.
2. Buka **Pengaturan**.
3. Pilih **Hapus akun**.
4. Konfirmasi penghapusan. Profil dan seluruh data (riwayat
   pemeriksaan, laporan WiFi, diagnosis AI) ikut terhapus dan tidak
   bisa dikembalikan.
5. Bila tidak bisa masuk sehingga tidak bisa menghapus akun sendiri,
   kirim permintaan lewat email dukungan dari alamat email akun
   Google yang dipakai mendaftar.

**19. Apakah saya bisa memakai Dokter HP tanpa akun?**

Bisa, untuk tes WiFi saja. Dari halaman depan, ketuk **Coba tes
WiFi tanpa akun**. Hasil tes tampil di layar, tetapi tidak
tersimpan ke riwayat. Untuk menyimpan riwayat, memakai Diagnosis
satu ketuk, dan memakai Diagnosis AI, masuk dengan akun Google
diperlukan.

**20. Aplikasi menampilkan banner "Tidak tersambung ke server".
Apa artinya?**

Artinya browser tidak bisa menjangkau server Dokter HP saat itu.
Tes WiFi tetap bisa dijalankan di browser, tetapi hasilnya tidak
tersimpan ke riwayat. Langkah yang bisa dilakukan:

1. Periksa koneksi internet.
2. Muat ulang halaman.
3. Bila banner tetap muncul, coba lagi beberapa saat kemudian.
4. Bila banner muncul terus selama berjam-jam, kirim laporan lewat
   email dukungan.

---

## 5. Klasifikasi prioritas

Setiap laporan diberi satu tingkat prioritas. Tingkat menentukan
urutan penanganan, bukan janji waktu penyelesaian.

### 5.1 Kritis — tangani pertama

Masalah yang membahayakan data pengguna, keamanan akun, atau
membuat layanan tidak bisa dipakai sama sekali oleh semua pengguna.

Contoh:

- Pengguna melihat data milik pengguna lain (riwayat, diagnosis,
  atau profil orang lain).
- Seseorang bisa masuk ke akun orang lain tanpa izin.
- Semua pengguna tidak bisa masuk sama sekali.
- Permintaan hapus akun tidak memproses penghapusan data.
- Kunci API atau secret terlihat di aplikasi atau di repo.

Tindakan: hentikan dulu dampaknya bila memungkinkan (misalnya
nonaktifkan fitur yang bermasalah), lalu perbaiki, lalu beri tahu
pengguna yang terdampak.

### 5.2 Tinggi — tangani setelah kritis

Fitur utama rusak atau data pengguna hilang untuk banyak pengguna,
tetapi layanan secara umum masih berjalan.

Contoh:

- Tes WiFi gagal untuk banyak pengguna dalam waktu yang sama.
- Masuk dengan Google gagal untuk banyak pengguna.
- Layar kunci PIN tidak bisa dibuka dengan PIN yang benar.
- Riwayat pemeriksaan hilang untuk banyak pengguna.
- Diagnosis satu ketuk selalu gagal menyimpan skor.

### 5.3 Sedang — tangani setelah tinggi

Satu fitur tidak berjalan sebagaimana mestinya untuk sebagian
pengguna, atau ada cara lain (workaround) yang bisa dipakai
sementara.

Contoh:

- Laporan PDF tidak terunduh di satu jenis browser tertentu.
- Tes bertahan 30 detik berhenti di tengah jalan untuk sebagian
  pengguna.
- Grafik riwayat skor tidak tampil padahal data riwayat ada.
- Diagnosis AI tidak tersedia lebih dari sehari.
- Tampilan rusak di satu ukuran layar tertentu.

### 5.4 Rendah — tangani bila ada waktu

Pertanyaan cara memakai, saran perbaikan, dan masalah tampilan
kecil yang tidak menghalangi pemakaian.

Contoh:

- Pertanyaan tentang arti skor atau klasifikasi kecepatan.
- Saran menambah jenis tes atau informasi baru.
- Kesalahan ketik pada teks aplikasi.
- Saran perbaikan kata-kata pada panduan.
- Pertanyaan tentang perbedaan versi web dan APK.

### 5.5 Yang bukan laporan masalah

Hal berikut dijawab dengan penjelasan, bukan dicatat sebagai bug:

- Kolom SSID, sinyal, channel, gateway, atau DNS tampil "tidak
  tersedia" (batasan browser yang dirancang; lihat FAQ 13).
- Dokter Baterai, Penyimpanan, Performa, atau Keamanan tidak
  menampilkan data baru secara otomatis (web tidak memindai sensor;
  lihat FAQ 10).
- Tes WiFi tanpa akun tidak tersimpan ke riwayat (perilaku yang
  dirancang; lihat FAQ 19).
- Tidak ada tombol bersihkan cache di web (browser tidak punya
  akses itu; lihat `PRODUCT.md` bagian 4.5).
- Tidak ada sidik jari/wajah di web (hanya tersedia di APK; lihat
  FAQ 4).

---

## 6. Templat balasan — 5 masalah paling umum

Templat di bawah ini dipakai sebagai titik awal balasan. Sesuaikan
nama pengguna, detail laporan, dan langkah yang sudah dicoba
sebelum mengirim. Jangan menyalin mentah bila konteks laporannya
berbeda.

### 6.1 Lupa PIN

> Halo, terima kasih sudah menghubungi dukungan Dokter HP.
>
> PIN tidak bisa dilihat kembali karena hanya tersimpan sebagai
> kode acak di server kami. Cara memulihkannya:
>
> 1. Masuk ulang dengan akun Google Anda.
> 2. Buka **Pengaturan**.
> 3. Atur PIN baru (4–8 digit).
>
> Riwayat pemeriksaan Anda tetap aman dan tidak hilang.
>
> Bila Anda juga tidak bisa masuk dengan Google, beri tahu kami
> pesan galat yang muncul, dan kami bantu dari sana.

### 6.2 Tidak bisa masuk dengan Google

> Halo, terima kasih sudah melaporkan masalah ini.
>
> Silakan coba langkah berikut secara berurutan:
>
> 1. Pastikan koneksi internet aktif — coba buka situs lain di
>    browser yang sama.
> 2. Coba lagi tombol **Masuk dengan Google**.
> 3. Bila muncul pesan galat dari Google, pastikan akun Google yang
>    dipilih sudah benar.
> 4. Bila masih gagal, coba browser lain di HP yang sama.
>
> Bila keempat langkah di atas belum berhasil, mohon kirimkan:
> pesan galat yang muncul (atau screenshot-nya), merek dan model
> HP, versi Android, dan nama browser yang dipakai. Informasi itu
> membantu kami menemukan penyebabnya.

### 6.3 Tes WiFi gagal

> Halo, terima kasih sudah melaporkan masalah ini.
>
> Silakan coba langkah berikut:
>
> 1. Pastikan koneksi internet aktif.
> 2. Tutup unduhan atau video yang sedang berjalan, lalu coba tes
>    lagi.
> 3. Bila muncul banner "Tidak tersambung ke server", server kami
>    sedang tidak terjangkau — tes tetap bisa jalan, tetapi
>    hasilnya tidak tersimpan. Silakan coba lagi nanti.
>
> Bila tes tetap gagal, mohon kirimkan: tahap tes saat tes berhenti
> (info jaringan, kecepatan unduh, atau latensi), merek dan model
> HP, versi Android, nama browser, dan screenshot pesan galat bila
> ada.

### 6.4 Skor turun

> Halo, terima kasih sudah menghubungi kami.
>
> Skor 0–100 dihitung hanya dari komponen yang datanya tersedia,
> jadi skor bisa berubah ketika ada data baru — misalnya hasil tes
> WiFi terbaru lebih lambat, atau komponen yang sebelumnya kosong
> kini terisi dan ikut dihitung.
>
> Untuk memeriksa penyebabnya:
>
> 1. Buka dashboard dan lihat penjelasan per komponen beserta
>    sumber datanya.
> 2. Bandingkan dengan tiga pemeriksaan terakhir di dashboard.
>
> Skor adalah ringkasan kondisi, bukan vonis kerusakan. Ikuti
> rekomendasi pada komponen yang nilainya paling rendah. Bila ada
> komponen yang angkanya tampak tidak masuk akal, beri tahu kami
> komponen tersebut beserta angka yang tampil, dan kami periksa
> lebih lanjut.

### 6.5 Riwayat tidak muncul / data hilang

> Halo, terima kasih sudah melaporkan masalah ini.
>
> Silakan periksa dua hal berikut:
>
> 1. Pastikan Anda masuk dengan akun Google yang sama seperti saat
>    pemeriksaan dilakukan — riwayat tersimpan per akun.
> 2. Buka **Riwayat** dan periksa filter jenis pemeriksaan — mungkin
>    filter sedang menyembunyikan jenis tertentu.
>
> Perlu kami sampaikan juga: tes WiFi yang dijalankan tanpa masuk
> akun memang tidak tersimpan ke riwayat; hasilnya hanya tampil di
> layar.
>
> Bila akun sudah benar, filter sudah benar, dan riwayat tetap
> tidak ada, mohon kirimkan tanggal pemeriksaan yang hilang dan
> perangkat yang dipakai, dan kami periksa lebih lanjut.

---

## 7. Catatan untuk tim implementasi

1. **Formulir laporan masalah** (bagian 2 dan 3) adalah bagian dari
   sistem dukungan yang dirancang di dokumen ini. Penempatan dan
   teknis pengirimannya diputuskan tim implementasi; kolom pada
   bagian 3.1 adalah isi minimum formulir.
2. **Alamat email dukungan** diputuskan owner sebelum rilis dan
   dicantumkan di halaman Tentang. Dokumen ini sengaja tidak
   menuliskan alamat email apa pun agar tidak ada alamat yang salah
   atau kedaluwarsa.
3. **Tidak ada janji waktu respons** di dokumen mana pun yang
   menghadap pengguna. Bila di kemudian hari owner memutuskan
   target waktu respons, dokumen ini dan teks di aplikasi diperbarui
   bersamaan.
4. **FAQ di dokumen ini** adalah sumber jawaban dukungan. Bila ada
   pertanyaan baru yang sering masuk, tambahkan sebagai FAQ baru di
   sini sebelum menambahkan jawaban di tempat lain, agar jawaban
   tetap konsisten.
5. **Privasi laporan:** laporan masalah dapat memuat screenshot dan
   detail perangkat. Perlakukan sebagai data pengguna sesuai
   `docs/kebijakan-privasi.md`. Jangan membagikan isi laporan ke
   pihak mana pun tanpa izin pengguna.

---

*Dokumen ini adalah draf dan perlu peninjauan akhir sebelum tayang.*
