# Riset Pengguna — Dokter HP Web App

> **Status:** Fase 1 — dokumen, 17 November 2026.
> **Bahasa:** Bahasa Indonesia netral profesional.
> **Sumber:** PRD web app (`../PRODUCT.md`) dan PRD APK
> (`../../dokter-hp/PRODUCT.md`, §1.1).

---

## 0. Catatan kejujuran metode

Dokumen ini **bukan hasil survei formal**. Tidak ada kuesioner yang
disebar, tidak ada wawancara yang sudah dilakukan, dan tidak ada angka
statistik pengguna yang dikutip di sini.

Persona dan peta perjalanan di bawah ini disusun dari dua sumber:

1. **Kasus nyata owner** yang melahirkan Dokter HP (PRD APK §1.1):
   WiFi ACHA, router ZTE F660, kecepatan unduh jatuh dari 50 KB/detik
   ke 3,2 KB/detik padahal sinyal sangat bagus, HP lain di jaringan
   yang sama normal, data seluler lancar tetapi tidak ada kuota.
2. **Pola umum yang sudah diketahui** dari keluhan pemilik HP Android
   sehari-hari (WiFi lemot, baterai boros, penyimpanan penuh) dan dari
   perilaku fitur yang sudah ditentukan di PRD.

Persona di sini adalah **hipotesis kerja** untuk memandu desain dan
penulisan salinan aplikasi. Persona ini wajib divalidasi dengan
wawancara nyata (daftar pertanyaan di Bagian 4) dan umpan balik dari
aplikasi (rancangan formulir di Bagian 5) sebelum dianggap sebagai
gambaran pengguna yang terbukti. Bila hasil wawancara bertentangan
dengan persona di sini, hasil wawancara yang menang.

---

## 1. Profil pengguna umum

| Aspek | Keterangan |
|---|---|
| Pengguna utama | Pemilik HP Android umum, bukan teknisi |
| Perangkat utama | HP Android, layar mulai 360 px (phone-first) |
| Perangkat lain | Tablet dan desktop |
| Bahasa | Bahasa Indonesia |
| Kondisi | Bekerja dari HP, tanpa PC; koneksi internet kadang lemot |
| Pengetahuan teknis | Rendah sampai menengah; istilah seperti "channel router", "DNS", atau "latensi" belum tentu dipahami tanpa penjelasan |

Implikasi desain yang berlaku untuk semua persona:

- Satu ketuk untuk memulai pemeriksaan; tanpa langkah persiapan.
- Hasil memakai bahasa sehari-hari; istilah teknis selalu disertai
  penjelasan singkat.
- Angka yang tampil adalah hasil ukur nyata atau input pengguna;
  bila data tidak tersedia, tampil "tidak tersedia", bukan angka
  contoh.
- Semua layar bisa dipakai dengan satu tangan di layar 360 px;
  area sentuh minimal 44 px.

---

## 2. Persona

### 2.1 Persona 1 — Rina, pengguna WiFi lemot

**Dasar persona:** kasus nyata owner (PRD APK §1.1) — WiFi ACHA,
router ZTE F660, kecepatan jatuh ke 3,2 KB/detik padahal sinyal
penuh dan HP lain normal.

| Aspek | Keterangan |
|---|---|
| Gambaran | Perempuan 28 tahun, bekerja dari HP (jualan online dan membalas chat pelanggan). WiFi rumah dipakai bersama keluarga. Tidak punya PC. |
| Perangkat | HP Android kelas menengah, satu-satunya perangkat kerja. |
| Konteks pemakaian | WiFi tiba-tiba lemot saat sedang bekerja; video tidak bisa diputar, pesan tertunda, unduhan tidak jalan. |

**Tujuan:**

1. Mengetahui dengan pasti apakah masalah ada di HP-nya, di router,
   atau di jaringan — bukan sekadar "sinyal penuh".
2. Mendapat langkah perbaikan yang bisa dilakukan sendiri tanpa
   memanggil teknisi.
3. Membuktikan kecepatan nyata dengan angka, supaya bisa menjelaskan
   masalahnya ke anggota keluarga atau penyedia layanan.

**Frustrasi:**

- Sinyal WiFi tampil penuh, tetapi internet tidak bisa dipakai —
  indikator sinyal terasa menipu.
- HP lain di WiFi yang sama normal, sehingga tidak jelas apakah
  HP-nya yang rusak.
- Saran umum di internet ("matikan lalu nyalakan lagi") sudah dicoba
  dan tidak membantu.
- Mengubah pengaturan router terasa menakutkan: takut salah tekan dan
  membuat WiFi mati total untuk semua orang di rumah.
- Data seluler lancar tetapi kuota terbatas, sehingga bukan jalan
  keluar.

**Tugas utama di aplikasi:**

1. Menjalankan tes WiFi (kecepatan unduh + latensi) untuk mendapat
   angka nyata.
2. Menjalankan tes bertahan 30 detik untuk memastikan kecepatan jatuh
   di tengah jalan atau stabil.
3. Membaca rekomendasi dan panduan (termasuk panduan mode router
   802.11b Only dan channel 1/6/11) lalu mengikuti langkah manual.
4. Menyimpan hasil ke riwayat dan membagikannya bila perlu.

**Yang membuat persona ini berhasil:** hasil tes yang jelas
("kecepatan Anda 3,2 KB/detik — sangat lambat") disertai satu
langkah berikutnya yang konkret, bukan daftar panjang yang
membingungkan.

### 2.2 Persona 2 — Budi, pengguna baterai boros

**Dasar persona:** pola umum keluhan baterai boros pada HP Android
yang dipakai seharian untuk bekerja; bukan dari survei formal.

| Aspek | Keterangan |
|---|---|
| Gambaran | Laki-laki 35 tahun, bekerja lapangan dan mengandalkan HP seharian untuk peta, chat, dan foto. Jarang berada dekat colokan listrik. |
| Perangkat | HP Android berumur dua tahun lebih; baterai sudah tidak sekuat dulu. |
| Konteks pemakaian | Baterai habis sebelum sore; tidak tahu aplikasi atau kebiasaan apa yang paling boros. |

**Tujuan:**

1. Mengetahui kondisi baterai HP-nya secara keseluruhan (bukan
   sekadar persen yang tersisa saat ini).
2. Mengetahui kebiasaan atau pengaturan apa yang membuat baterai
   cepat habis.
3. Mendapat tips perawatan baterai yang praktis dan bisa dilakukan
   langsung.

**Frustrasi:**

- Baterai turun cepat tanpa sebab yang jelas; tidak ada yang
  menjelaskan penyebabnya.
- Aplikasi "penghemat baterai" yang pernah dicoba hanya menutup
  aplikasi dan tidak memberi penjelasan.
- Estimasi waktu pakai dari berbagai sumber berbeda-beda dan tidak
  bisa dipercaya.
- Tidak tahu apakah baterainya sudah perlu diganti atau masih bisa
  dirawat.
- Di web app, data baterai tidak bisa dibaca otomatis oleh browser —
  pengisian manual terasa merepotkan bila tidak dijelaskan gunanya.

**Tugas utama di aplikasi:**

1. Melihat skor kesehatan HP untuk mendapat gambaran menyeluruh.
2. Membuka Dokter Baterai: melihat riwayat level baterai dan status
   pengisian (dari APK atau input manual).
3. Membaca estimasi waktu pakai yang dilabeli jelas sebagai
   perkiraan, beserta tips merawat baterai.
4. Meminta Diagnosis AI bila ingin penjelasan atas keluhan spesifik
   ("baterai habis dalam 4 jam padahal baru diisi penuh").

**Yang membuat persona ini berhasil:** penjelasan jujur tentang
apa yang bisa dan tidak bisa diukur di web, estimasi yang dilabeli
perkiraan (bukan angka pasti yang menyesatkan), dan tips yang
spesifik, bukan nasihat umum.

### 2.3 Persona 3 — Sari, pengguna penyimpanan penuh

**Dasar persona:** pola umum keluhan penyimpanan penuh pada HP
Android dengan banyak foto, video, dan chat; bukan dari survei
formal.

| Aspek | Keterangan |
|---|---|
| Gambaran | Perempuan 24 tahun, aktif di media sosial; HP penuh foto, video, dan chat. Sering memotret dan merekam untuk keperluan pribadi dan kerja. |
| Perangkat | HP Android dengan penyimpanan internal terbatas; tanpa kartu memori tambahan. |
| Konteks pemakaian | Notifikasi "penyimpanan penuh" muncul saat hendak memotret atau memperbarui aplikasi; HP terasa lambat. |

**Tujuan:**

1. Mengetahui berapa ruang yang tersisa dan apa yang memakan ruang
   terbanyak.
2. Mengosongkan ruang dengan aman, tanpa menghapus foto atau chat
   penting.
3. Mencegah penyimpanan penuh terulang.

**Frustrasi:**

- Notifikasi penyimpanan penuh muncul di saat yang tidak tepat
  (misalnya saat hendak memotret momen penting).
- Tidak jelas file apa yang aman dihapus dan apa yang berisiko.
- Takut menghapus sesuatu yang ternyata masih dibutuhkan.
- "Pembersih" yang pernah dicoba menghapus hal yang tidak diminta
  atau menampilkan angka yang tidak bisa dipercaya.
- Di web app tidak ada tombol bersihkan cache (browser tidak punya
  akses itu) — perlu penjelasan yang jujur tentang apa yang bisa
  dilakukan dari web dan apa yang harus dilakukan lewat Pengaturan HP.

**Tugas utama di aplikasi:**

1. Melihat skor kesehatan HP untuk gambaran menyeluruh.
2. Membuka Dokter Penyimpanan: melihat total, terpakai, dan kosong
   beserta bilah pemakaian (dari APK atau input manual).
3. Membaca panduan mengosongkan ruang secara manual lewat
   Pengaturan HP.
4. Memeriksa riwayat untuk melihat tren pemakaian penyimpanan dari
   waktu ke waktu.

**Yang membuat persona ini berhasil:** tampilan pemakaian yang
jujur dan mudah dibaca, panduan penghapusan manual yang aman dan
bertahap, dan tidak ada janji "satu ketuk membersihkan segalanya"
yang tidak bisa ditepati di web.

---

## 3. Peta perjalanan pengguna (journey map)

Setiap peta memakai lima tahap. Kolom "Pikiran" dan "Emosi"
menggambarkan keadaan batin pengguna pada tahap tersebut; kolom
"Titik sakit" menandai gesekan yang perlu diatasi desain.

### 3.1 Tugas A — Cek WiFi lemot (Persona: Rina)

| Tahap | Aksi | Pikiran | Emosi | Titik sakit |
|---|---|---|---|---|
| 1. Sadar masalah | Video tidak bisa diputar; pesan tertunda; membuka browser dan mencari alat tes kecepatan | "WiFi kenapa lemot padahal sinyal penuh? HP saya yang rusak?" | Bingung, kesal | Tidak tahu harus mulai dari mana; hasil pencarian penuh iklan dan alat yang meragukan |
| 2. Buka aplikasi | Membuka Dokter HP Web App; melihat tombol "Coba tes WiFi tanpa akun" | "Bagus, tidak perlu daftar dulu. Semoga cepat." | Lega, masih ragu | Bila landing memaksa login dulu, pengguna pergi sebelum mencoba |
| 3. Jalankan tes | Mengetuk kartu Dokter WiFi, lalu "Periksa WiFi sekarang"; menunggu progres tahap demi tahap | "Berapa sebenarnya kecepatan saya? Semoga angkanya jelas." | Cemas, penasaran | Tes yang lama tanpa progres terasa macet; koneksi lemot membuat halaman terasa berat |
| 4. Baca hasil | Melihat kecepatan unduh, klasifikasi ("sangat lambat"), latensi HTTP, dan rekomendasi | "Ternyata memang sangat lambat. Jadi bukan perasaan saya saja." | Lega karena terbukti, lalu khawatir soal perbaikan | Istilah teknis tanpa penjelasan (mis. "latensi HTTP", "channel") membingungkan; kolom SSID/sinyal yang tampil "tidak tersedia" terasa seperti aplikasi rusak bila tidak dijelaskan |
| 5. Perbaiki dan simpan | Mengikuti panduan (tes bertahan 30 detik, panduan mode router); menyimpan hasil ke riwayat atau membagikannya | "Apakah saya berani mengubah pengaturan router? Langkahnya jelas tidak?" | Hati-hati, berharap | Panduan router yang tidak bertahap membuat pengguna takut salah tekan; tanpa akun, hasil tidak tersimpan dan pengguna harus mengulang tes |

**Peluang desain:**

- Tes tanpa akun sebagai pintu masuk utama; tawarkan masuk
  *setelah* hasil tampil ("Simpan hasil ini ke riwayat Anda").
- Progres tes yang terlihat tahap demi tahap dengan teks yang
  menjelaskan apa yang sedang diukur.
- Setiap istilah teknis disertai satu kalimat penjelasan.
- Penjelasan singkat di samping kolom "tidak tersedia" tentang
  mengapa browser tidak bisa membacanya dan cara mengisinya manual.
- Panduan router bertahap dengan peringatan jelas sebelum langkah
  yang berisiko (misalnya: jangan tekan Submit sebelum memastikan
  nama WiFi tampil benar).

### 3.2 Tugas B — Cek skor kesehatan (Persona: Budi, juga Sari)

| Tahap | Aksi | Pikiran | Emosi | Titik sakit |
|---|---|---|---|---|
| 1. Sadar masalah | HP terasa lambat atau baterai cepat habis; ingin tahu kondisi HP secara menyeluruh | "HP saya masih sehat atau sudah perlu diperbaiki?" | Cemas, penasaran | Tidak tahu apa yang dimaksud "sehat" untuk sebuah HP; takut hasilnya menakut-nakuti |
| 2. Buka aplikasi | Masuk (Google) atau membuka dashboard; melihat tombol "Diagnosis satu ketuk" | "Satu ketuk saja? Semoga tidak ribet." | Berharap | Bila masuk terasa wajib dan panjang, pengguna menunda pemeriksaan |
| 3. Jalankan diagnosis | Mengetuk "Diagnosis satu ketuk"; menunggu skor dihitung dari data yang tersedia | "Data apa yang dipakai? Apakah data saya aman?" | Ragu soal privasi | Tidak jelas sumber data tiap komponen skor; skor dari data yang tidak lengkap terasa tidak bisa dipercaya bila tidak dijelaskan |
| 4. Baca skor | Melihat skor 0-100, kategori (Baik / Cukup / Perlu perhatian), dan penjelasan per komponen | "Skor saya 62 — itu artinya apa? Apa yang paling perlu diperbaiki?" | Lega bila baik; khawatir bila rendah | Skor tanpa penjelasan per komponen tidak memberi jalan keluar; kategori "Perlu perhatian" tanpa langkah berikutnya membuat cemas tanpa arah |
| 5. Tindak lanjut | Membuka kartu dokter yang bermasalah, membaca tips, melihat grafik riwayat skor | "Saya perbaiki yang ini dulu. Apakah skor saya membaik nanti?" | Termotivasi bila ada langkah jelas | Tanpa grafik riwayat, pengguna tidak bisa melihat perbaikan dari waktu ke waktu; tanpa langkah yang bisa dilakukan, skor hanya menjadi angka |

**Peluang desain:**

- Jelaskan sumber tiap komponen skor ("dari tes WiFi web" /
  "diisi manual" / "dari riwayat APK") dan bahwa komponen tanpa
  data dilewati, bukan ditebak.
- Setiap kategori skor disertai satu langkah berikutnya yang
  paling berdampak.
- Grafik riwayat skor dengan empty state jujur bila belum ada data.
- Bahasa yang menenangkan: skor adalah gambaran, bukan vonis;
  "Perlu perhatian" berarti ada yang bisa diperbaiki, bukan HP
  rusak.

### 3.3 Tugas C — Minta diagnosis AI (Persona: Rina, Budi, atau Sari)

| Tahap | Aksi | Pikiran | Emosi | Titik sakit |
|---|---|---|---|---|
| 1. Sadar masalah | Keluhan spesifik yang tidak terjawab tes standar ("WiFi lemot padahal sinyal penuh", "baterai habis dalam 4 jam") | "Saya sudah tes, tetapi tetap tidak tahu penyebabnya. Siapa yang bisa menjelaskan?" | Frustrasi, berharap ada yang menjelaskan | Tes standar memberi angka tetapi tidak memberi penyebab; pengguna tidak tahu harus bertanya ke siapa |
| 2. Buka Diagnosis AI | Membuka kartu Diagnosis AI; membaca penjelasan bahwa jawaban adalah saran, bukan vonis pasti | "AI ini tahu data HP saya? Apakah jawaban bisa dipercaya?" | Ragu, penasaran | Bila tidak dijelaskan data apa yang dikirim, pengguna ragu soal privasi; bila jawaban AI tampil tanpa label, pengguna menganggapnya vonis pasti |
| 3. Tulis keluhan | Menulis keluhan dengan kata-kata sendiri, lalu mengirim | "Apakah saya harus menulis dengan bahasa teknis?" | Ragu soal cara menulis | Kolom kosong tanpa contoh membuat pengguna bingung harus menulis apa; keluhan yang terlalu singkat menghasilkan jawaban yang generik |
| 4. Terima jawaban | Membaca jawaban AI beserta langkah yang disarankan | "Apakah langkah ini aman dilakukan? Mana yang harus dicoba dulu?" | Berharap, masih hati-hati | Jawaban yang panjang dan generik tidak membantu; jawaban tanpa urutan prioritas membingungkan; jawaban yang mengarang (bila layanan bermasalah) merusak kepercayaan |
| 5. Tindak lanjut | Mengikuti langkah yang disarankan; jawaban tersimpan ke riwayat diagnosis | "Apakah ini berhasil? Bila tidak, apa langkah berikutnya?" | Termotivasi bila berhasil; kecewa bila tidak | Tanpa jalan lanjutan bila saran gagal, pengguna kembali ke titik awal; tanpa riwayat diagnosis, pengguna harus mengulang keluhan dari awal |

**Peluang desain:**

- Contoh keluhan yang bisa diketuk ("WiFi lemot padahal sinyal
  penuh") untuk membantu pengguna memulai.
- Penjelasan singkat tentang data yang dikirim bersama keluhan
  (ringkasan data perangkat dari riwayat dan tes terakhir).
- Label jelas bahwa jawaban AI adalah saran, bukan vonis pasti.
- Jawaban yang terstruktur: kemungkinan penyebab, lalu langkah
  yang diurutkan dari yang paling mudah dan aman.
- Bila layanan AI tidak tersedia, tampilkan pesan jujur dan
  tawarkan jalan lain (tes WiFi, panduan tertulis), bukan jawaban
  karangan.
- Riwayat diagnosis yang bisa dibuka kembali.

---

## 4. Daftar pertanyaan wawancara

Sepuluh pertanyaan terbuka untuk menggali kebutuhan nyata. Ditujukan
untuk wawancara dengan pemilik HP Android umum (bukan teknisi),
berdurasi sekitar 30 menit, dilakukan lewat chat atau panggilan.
Pertanyaan disusun dari umum ke spesifik, dan pewawancara diharapkan
mengajukan pertanyaan lanjutan ("boleh ceritakan lebih lanjut?")
berdasarkan jawaban.

1. Ceritakan terakhir kali HP Anda bermasalah — apa yang terjadi,
   dan apa yang Anda lakukan pertama kali?
2. Saat WiFi terasa lemot, bagaimana Anda biasanya memastikan
   apakah masalahnya ada di HP, di router, atau di jaringan?
3. Informasi apa yang paling Anda butuhkan saat WiFi lemot, sebelum
   Anda memutuskan langkah perbaikan?
4. Pernahkah Anda mengubah pengaturan router sendiri? Bagaimana
   pengalaman itu — apa yang mudah, apa yang menakutkan atau
   membingungkan?
5. Bagaimana Anda tahu baterai HP Anda masih sehat atau sudah
   bermasalah? Tanda-tanda apa yang Anda perhatikan?
6. Saat muncul pemberitahuan penyimpanan penuh, apa yang Anda
   lakukan? Apa yang paling sulit dari mengosongkan ruang?
7. Bila ada aplikasi yang memberi skor kesehatan HP Anda (misalnya
   62 dari 100), apa yang Anda harapkan dari skor itu? Apa yang
   membuat skor itu berguna atau tidak berguna bagi Anda?
8. Informasi atau angka apa yang membuat Anda percaya pada sebuah
   aplikasi pemeriksa HP — dan apa yang membuat Anda tidak percaya?
9. Apakah Anda bersedia mengisi data HP secara manual (misalnya
   level baterai atau sisa penyimpanan) bila aplikasi web tidak
   bisa membacanya otomatis? Dalam kondisi apa Anda bersedia, dan
   kapan Anda merasa itu merepotkan?
10. Bila Anda bisa bertanya apa saja kepada sebuah aplikasi tentang
    masalah HP Anda, pertanyaan apa yang paling ingin Anda tanyakan?

**Catatan perekrutan:** prioritaskan narasumber yang mengalami
minimal satu dari tiga masalah utama (WiFi lemot, baterai boros,
penyimpanan penuh) dalam tiga bulan terakhir. Catat jawaban
verbatim bila memungkinkan; jangan meringkas jawaban menjadi
kesimpulan sebelum analisis.

---

## 5. Rancangan formulir umpan balik di aplikasi

Formulir ini ditampilkan setelah pengguna menyelesaikan satu
pemeriksaan (misalnya setelah hasil tes WiFi tampil), dan bisa
dibuka kembali dari Pengaturan. Singkat: target waktu isi di bawah
satu menit. Semua pertanyaan bersifat opsional kecuali skala
kepuasan. Tidak ada data pribadi yang diminta di formulir ini.

### 5.1 Lima pertanyaan singkat

1. **Apakah hasil pemeriksaan ini mudah dipahami?**
   Pilihan: Ya, mudah / Cukup mudah / Sulit dipahami.
   (Mengukur kejelasan bahasa dan tampilan hasil.)
2. **Apakah rekomendasi yang diberikan membantu Anda?**
   Pilihan: Ya, membantu / Sebagian membantu / Tidak membantu.
   (Mengukur kegunaan rekomendasi.)
3. **Apa masalah HP yang paling sering Anda alami?**
   Pilihan: WiFi lemot / Baterai cepat habis / Penyimpanan penuh /
   HP lambat / Lainnya (dengan kolom isi singkat).
   (Mengukur prioritas masalah untuk pengembangan berikutnya.)
4. **Fitur apa yang paling Anda butuhkan tetapi belum ada di
   aplikasi ini?**
   Kolom isi singkat (opsional, maksimal 200 karakter).
   (Menangkap kebutuhan yang belum terpenuhi.)
5. **Apakah ada bagian aplikasi yang membingungkan atau terasa
   rusak?**
   Kolom isi singkat (opsional, maksimal 200 karakter).
   (Menangkap titik sakit yang belum terlihat dari data.)

### 5.2 Skala kepuasan

**Seberapa puas Anda dengan pemeriksaan ini?**

Skala 1–5 dengan label kata, bukan hanya angka:

| Nilai | Label |
|---|---|
| 1 | Sangat tidak puas |
| 2 | Tidak puas |
| 3 | Biasa saja |
| 4 | Puas |
| 5 | Sangat puas |

Ditampilkan sebagai lima pilihan yang bisa diketuk, dengan label
kata di bawah setiap angka, agar maknanya jelas tanpa perlu
menebak.

### 5.3 Catatan implementasi

- Formulir dikirim ke server hanya bila pengguna masuk; bila
  pengguna memakai tes tanpa akun, formulir tetap bisa diisi tetapi
  hasilnya tidak tersimpan ke riwayat (jelaskan ini dengan satu
  kalimat di atas tombol kirim).
- Setelah mengirim, tampilkan ucapan terima kasih singkat tanpa
  memaksa pengguna melakukan hal lain.
- Jangan tampilkan formulir setiap kali pemeriksaan selesai bila
  pengguna sudah mengisinya dalam 7 hari terakhir; cukup tampilkan
  tautan kecil "Beri masukan" di bawah hasil.
- Jawaban formulir dipakai untuk memperbaiki produk, bukan untuk
  pelacakan pengguna; hal ini dinyatakan dalam kebijakan privasi.

---

## 6. Rencana validasi berikutnya

1. Lakukan wawancara dengan 5–8 pemilik HP Android umum memakai
   daftar pertanyaan di Bagian 4; perbarui persona bila temuan
   bertentangan dengan hipotesis di dokumen ini.
2. Uji tugas utama (tes WiFi, cek skor, diagnosis AI) dengan 3–5
   pengguna di HP Android layar 360 px; catat di tahap mana mereka
   berhenti atau kebingungan.
3. Kumpulkan umpan balik dari formulir di Bagian 5 selama dua minggu
   pertama setelah rilis; tinjau jawaban pertanyaan 3–5 untuk
   prioritas pengembangan berikutnya.
4. Tinjau ulang dokumen ini setelah data wawancara dan umpan balik
   tersedia; persona versi ini dinyatakan kedaluwarsa bila tidak
   divalidasi dalam 3 bulan.

---

## 7. Changelog dokumen

### 17 November 2026 — Dokumen awal

- Tiga persona (WiFi lemot, baterai boros, penyimpanan penuh)
  berdasarkan kasus nyata owner + pola umum, dinyatakan sebagai
  hipotesis kerja, bukan hasil survei.
- Tiga peta perjalanan pengguna (cek WiFi lemot, cek skor kesehatan,
  minta diagnosis AI) beserta peluang desain per peta.
- Sepuluh pertanyaan wawancara terbuka.
- Rancangan formulir umpan balik: lima pertanyaan singkat + skala
  kepuasan 1–5.
