# Syarat Layanan — Dokter HP

**Terakhir diperbarui:** 18 November 2026

Dengan memakai Dokter HP, pengguna menyetujui syarat-syarat berikut.
Bila pengguna tidak menyetujui syarat ini, pengguna sebaiknya tidak
memakai layanan.

## 1. Layanan

Dokter HP adalah aplikasi web gratis yang membantu pengguna
memeriksa kondisi HP mereka (WiFi, baterai, penyimpanan, performa,
dan keamanan) serta memberikan rekomendasi perbaikan dan diagnosis
berbasis AI.

Layanan diberikan **gratis** dan **apa adanya** ("as is"), tanpa
jaminan apa pun, baik tersurat maupun tersirat. Dokter HP tidak
memungut biaya, tidak memakai payment gateway, dan tidak
menampilkan iklan.

Pengembang dapat mengubah, menunda, atau menghentikan sebagian atau
seluruh layanan kapan saja, dengan atau tanpa pemberitahuan
terlebih dahulu. Bila layanan dihentikan, pengguna tetap dapat
mengekspor dan menghapus datanya selama layanan masih tersedia.

## 2. Akun pengguna

- Untuk menyimpan riwayat pemeriksaan, pengguna masuk dengan akun
  Google. Tes WiFi sekali jalan dapat dipakai tanpa akun dan tanpa
  menyimpan data.
- Pengguna bertanggung jawab penuh atas keamanan akunnya, termasuk
  menjaga kerahasiaan akun Google yang dipakai untuk masuk dan
  menjaga kerahasiaan PIN aplikasi bila PIN diatur.
- Pengguna wajib segera keluar dari sesi di perangkat yang bukan
  miliknya dan dapat memakai fitur keluar dari sesi lain di
  Pengaturan bila merasa akunnya dipakai pihak lain.
- Pengembang tidak bertanggung jawab atas kerugian yang timbul
  karena pengguna membagikan akses akunnya kepada orang lain.

## 3. Penggunaan yang dilarang

Pengguna dilarang:

- Memakai layanan untuk tujuan yang melanggar hukum yang berlaku.
- Mencoba mengakses data pengguna lain, membobol sistem, atau
  mengganggu berjalannya layanan.
- Mengirim permintaan dalam jumlah berlebihan yang sengaja
  membebani server (termasuk melewati batas pemakaian wajar
  Diagnosis AI).
- Memakai layanan untuk menyebarkan konten yang berbahaya,
  menipu, atau melanggar hak pihak lain.
- Meniru, menyalin, atau mengatasnamakan Dokter HP untuk menipu
  pihak lain.

Pengembang berhak membatasi atau menghentikan akses pengguna yang
melanggar ketentuan ini.

## 4. Diagnosis AI adalah saran, bukan vonis

- Jawaban Diagnosis AI adalah saran berdasarkan data yang tersedia
  dan pertanyaan pengguna. Jawaban tersebut **bukan diagnosis
  pasti**, bukan pengganti teknisi, dan bukan jaminan bahwa suatu
  langkah perbaikan akan menyelesaikan masalah.
- Skor kesehatan, estimasi waktu pakai baterai, dan rekomendasi
  lain bersifat perkiraan berdasarkan data yang tersedia. Skor
  setiap pemeriksaan dihitung dari komponen yang diperiksa saja.
- Untuk kerusakan perangkat keras atau masalah yang tidak kunjung
  teratasi, pengguna disarankan berkonsultasi dengan teknisi.
- Pengguna memakai saran dan rekomendasi Dokter HP atas risiko dan
  pertimbangannya sendiri.

## 5. Batasan tanggung jawab

- Dokter HP diberikan apa adanya tanpa jaminan bahwa layanan akan
  selalu tersedia, bebas gangguan, atau bebas dari kesalahan.
- Pengembang tidak bertanggung jawab atas kerugian langsung maupun
  tidak langsung yang timbul dari pemakaian layanan, termasuk
  kehilangan data, kerusakan perangkat, atau biaya yang timbul
  akibat mengikuti saran dari aplikasi.
- Dokter HP bergantung pada layanan pihak ketiga (Google untuk
  masuk akun dan Gemini untuk Diagnosis AI). Gangguan pada layanan
  tersebut berada di luar kendali pengembang.
- Pengguna bertanggung jawab atas data yang diisinya secara manual
  dan atas pertanyaan yang dikirimkannya ke Diagnosis AI.
  Pengguna disarankan tidak menuliskan informasi yang sangat
  sensitif (misalnya kata sandi atau nomor identitas) di dalam
  pertanyaan AI.

## 6. Data dan privasi

Pengumpulan, penyimpanan, dan pemakaian data pengguna diatur dalam
[Kebijakan Privasi](kebijakan-privasi.md) Dokter HP. Dengan memakai
layanan, pengguna menyetujui pengumpulan dan pemakaian data
sebagaimana dijelaskan di sana.

## 7. Perubahan syarat

Pengembang dapat mengubah syarat ini dari waktu ke waktu. Versi
terbaru akan ditampilkan di aplikasi dan tanggal "Terakhir
diperbarui" di atas akan disesuaikan. Pemakaian layanan setelah
perubahan berlaku dianggap sebagai persetujuan atas syarat yang
baru. Pengguna yang tidak setuju dapat berhenti memakai layanan
dan menghapus akunnya beserta seluruh datanya.

## 8. Kontak

Pertanyaan tentang syarat layanan ini dapat disampaikan kepada
pengembang Dokter HP melalui repositori publik proyek Dokter HP
(repo `adiprmx/dokter-hp`) atau melalui halaman Tentang di dalam
aplikasi.

---

## Catatan peninjauan

Pada 18 November 2026, Tim Syarat (redesign v2.0, Wave 2) meninjau
dokumen ini terhadap kode produk v1.0 yang sudah live dan
menghapus status drafnya. Peninjauan menemukan satu klaim yang
tidak sesuai kenyataan dan memperbaikinya: tidak ada perhitungan
skor gabungan lintas komponen, setiap pemeriksaan membawa satu
komponen dan skornya dihitung dari komponen yang diperiksa saja
(dokumen lama menyebut komponen tanpa data "dilewati dalam
perhitungan"). Seluruh klaim lain terverifikasi benar terhadap
kode, termasuk batas Diagnosis AI 20 pertanyaan per hari, masuk
Google sebagai satu-satunya cara masuk, tes WiFi tanpa akun yang
tidak menyimpan data, PIN, ekspor JSON, penghapusan akun, dan
kontak lewat repositori publik adiprmx/dokter-hp.
