# Copy — Dokter HP Web App

> **Semua teks antarmuka Dokter HP versi web, per layar.**
> Bahasa: Bahasa Indonesia netral profesional, bahasa sehari-hari yang
> gampang dicerna semua orang. Tanpa istilah teknis, tanpa angka yang
> tidak perlu, tanpa klaim berlebihan. Jujur soal batasan.
>
> Status: Fase 1 (dokumen), 17 November 2026; diselaraskan dengan teks
> live v2.0, 18 November 2026.
> Acuan: `PRODUCT.md` dan `ARCHITECTURE.md` (11 layar).
>
> Konvensi penulisan di dokumen ini:
> - Teks yang tampil di layar ditulis di antara tanda kutip.
> - `[…]` = nilai dinamis yang diisi aplikasi (nama, angka hasil ukur,
>   tanggal). Angka yang tampil selalu data real hasil ukur, data
>   server, atau input manual pengguna, bukan contoh.
> - "tidak tersedia" dipakai apa adanya bila browser tidak bisa
>   membaca data tersebut.

---

## 0. Teks bersama (dipakai di banyak layar)

| Elemen | Teks |
|---|---|
| Nama produk | "Dokter HP" |
| Data tidak tersedia | "tidak tersedia" |
| Status memuat (umum) | "Memuat…" |
| Status memuat (data) | "Mengambil data…" |
| Galat umum | "Terjadi kesalahan. Coba lagi." |
| Tombol coba lagi | "Coba lagi" |
| Tombol kembali | "Kembali" |
| Tombol batal | "Batal" |
| Tombol simpan | "Simpan" |
| Tombol hapus | "Hapus" |
| Tombol tutup | "Tutup" |
| Tombol lanjutkan | "Lanjutkan" |
| Tombol keluar | "Keluar" |
| Label sumber: tes web | "Dari tes web" |
| Label sumber: input manual | "Diisi manual" |
| Label sumber: APK | "Dari aplikasi Dokter HP" |
| Format waktu relatif | "[tanggal], [jam]" (misalnya "17 November 2026, 22.15") |
| Sesi habis | "Sesi sudah berakhir. Masuk lagi untuk lanjut." |

---

## 1. Landing — `/`

### Judul dan subjudul

- Judul: "Dokter HP"
- Tagline: "Cari tahu kenapa HP terasa bermasalah, lalu perbaiki."
- Subjudul: "Periksa kondisi HP dari browser: kecepatan WiFi, baterai,
  penyimpanan, performa, dan keamanan. Tanpa memasang aplikasi."

### Panel skor (hero)

- Belum masuk (legenda skala skor): lencana "Baik" ("80 sampai 100"),
  "Perlu diperhatikan" ("50 sampai 79"), "Bermasalah" ("di bawah 50"),
  lalu "Skor HP Anda tampil di sini setelah masuk dan memeriksa HP."
- Sudah masuk, ada skor: "Skor terakhir Anda", "Diperiksa [tanggal],
  [jam]", tautan "Lihat dasbor".
- Sudah masuk, belum ada pemeriksaan: "Belum ada pemeriksaan",
  "Jalankan pemeriksaan pertama untuk melihat skor HP di sini.",
  tombol "Mulai dari tes WiFi".
- Sesi habis: "Sesi sudah berakhir", "Sesi sudah berakhir. Masuk lagi
  untuk lanjut.", tombol "Masuk".
- Gagal memuat skor: "Skor tidak dapat dimuat", "Skor tidak dapat
  dimuat saat ini.", tombol "Coba lagi".

### 3 keunggulan

- Judul bagian: "Yang bisa dilakukan di sini"

1. Judul: "Tes WiFi sungguhan"
   Isi: "Kecepatan diukur langsung dari browser, bukan ditebak.
   Hasilnya angka nyata dari koneksi yang sedang dipakai."
2. Judul: "Penjelasan yang mudah dipahami"
   Isi: "Setiap hasil disertai arti dan langkah perbaikan yang bisa
   dilakukan sendiri, dengan bahasa yang mudah dicerna."
3. Judul: "Riwayat tersimpan di akun"
   Isi: "Hasil pemeriksaan tersimpan dan bisa dibuka lagi dari
   perangkat mana pun setelah masuk."

### Tombol utama (CTA)

- Tombol masuk/daftar: "Masuk / Daftar"
- Tombol tes tanpa akun: "Coba tes WiFi tanpa akun"
- Catatan di bawah tombol tes tanpa akun: "Hasil tes tampil di layar,
  tetapi tidak tersimpan. Masuk untuk menyimpan riwayat."

### Kejujuran satu baris (batasan web)

- Judul bagian: "Yang perlu diketahui"
- "Versi web mengukur koneksi Anda; data baterai, penyimpanan, dan
  performa diisi manual atau dari riwayat aplikasi Dokter HP."

### Panduan perbaikan

- Judul bagian: "Panduan perbaikan"
- "Langkah demi langkah memperbaiki masalah HP yang paling sering
  terjadi. Semua panduan bisa dibaca tanpa masuk."
- Tiap kartu panduan menampilkan judul dan deskripsinya (isi lengkap
  di `apps/web/src/data/panduan.ts`).

### Tautan APK

- Judul bagian: "Butuh pembacaan langsung dari HP?"
- Isi: "Aplikasi Dokter HP di Android bisa membaca baterai,
  penyimpanan, dan performa langsung dari HP."
- Teks tautan: "Lihat aplikasi Dokter HP untuk Android"

### Catatan kaki

- "Dokter HP tidak menjanjikan HP jadi lebih cepat. Aplikasi ini
  membantu menemukan masalah dan menunjukkan langkah perbaikannya."

---

## 2. Masuk — `/masuk`

### Judul

- Judul: "Masuk"
- Subjudul: "Masuk untuk menyimpan riwayat pemeriksaan dan memakai
  semua fitur."

### Tombol Google

- Tombol: "Masuk dengan Google"
- Catatan di bawah tombol: "Akun Google dipakai sebagai identitas
  masuk. Dokter HP tidak membaca isi email atau file Anda."

### Tautan tes tanpa akun

- "Atau coba tes WiFi tanpa masuk dulu"

### Status

- Sedang memproses masuk: "Memproses masuk…"
- Masuk berhasil: "Berhasil masuk. Selamat datang kembali, [nama]."
- Masuk gagal (lihat juga bagian 13, pesan galat).
- Sedang memeriksa login Google: "Memeriksa login Google…"
- Login Google belum disiapkan: tombol "Masuk dengan Google belum
  disiapkan" + "Login Google belum disiapkan untuk situs ini. Coba
  lagi nanti."
- Status login Google tidak dapat diperiksa: tombol "Tidak dapat
  memeriksa login Google" + "Status login Google tidak dapat
  diperiksa saat ini. Periksa koneksi Anda, lalu coba lagi." +
  tombol "Coba lagi"

---

## 3. Layar kunci PIN — `/kunci`

### Judul

- Judul: "Masukkan PIN"
- Subjudul: "PIN melindungi riwayat pemeriksaan di aplikasi ini."

### Penjelasan PIN

- "PIN adalah kode 4 sampai 8 angka yang hanya Anda ketahui. PIN
  dipakai untuk membuka aplikasi ini setiap kali sesi baru dimulai.
  PIN tidak tersimpan sebagai angka asli. Yang disimpan hanya
  bentuk acaknya di server, jadi tidak ada yang bisa melihat PIN
  Anda, termasuk kami."

### Bidang dan tombol

- Label bidang: "PIN"
- Tombol: "Buka"
- Tautan: "Lupa PIN?"

### Lupa PIN

- Judul: "Lupa PIN"
- Isi: "PIN tidak bisa dilihat kembali karena yang tersimpan hanya
  bentuk acaknya. Untuk membuka aplikasi, masuk ulang dengan Google,
  lalu atur PIN baru dari Pengaturan. Riwayat Anda tetap aman."
- Tombol: "Masuk ulang dengan Google"

### PIN salah dan kunci sementara

- PIN salah: "PIN salah. Coba lagi."
- PIN salah dengan sisa percobaan: "PIN salah. [n] percobaan lagi
  sebelum terkunci sementara."
- Terkunci sementara: "Terlalu banyak percobaan salah. Tunggu
  30 detik sebelum mencoba lagi."
- Hitung mundur kunci: "Coba lagi dalam [n] detik."

---

## 4. Dashboard — `/dashboard`

### Judul skor

- Judul bagian: "Kesehatan HP"
- Label skor: "Skor kesehatan"
- Skor tampil: "[skor] dari 100"
- Penjelasan skor: "Skor dihitung dari data yang tersedia saat ini.
  Bagian yang belum ada datanya tidak dihitung."

### Kategori skor

Label kategori tampil sebagai lencana status (dari `labelStatus`
status-warna, K-94):

| Kategori | Teks |
|---|---|
| Baik | "Baik" |
| Perlu diperhatikan | "Perlu diperhatikan" |
| Bermasalah | "Bermasalah" |

### Diagnosis satu ketuk

- Tombol: "Diagnosis satu ketuk"
- Sedang menghitung: "Memeriksa…"
- Selesai: "Pemeriksaan selesai. Skor Anda [skor] dari 100."
- Penjelasan sumber skor (di bawah skor): judul "Dihitung dari:",
  lalu daftar komponen; tiap entri "[nama komponen]", "skor [skor],
  [sumber]", dan lencana status "[label status]".

### Kartu dokter

| Kartu | Judul | Subjudul |
|---|---|---|
| WiFi | "Dokter WiFi" | "Tes kecepatan dan cari penyebab WiFi lemot" |
| Baterai | "Dokter Baterai" | "Lihat riwayat dan kondisi baterai" |
| Penyimpanan | "Dokter Penyimpanan" | "Lihat pemakaian ruang penyimpanan" |
| Performa | "Dokter Performa" | "Lihat riwayat kecepatan dan beban HP" |
| Keamanan | "Dokter Keamanan" | "Tinjau aplikasi dan izin yang berisiko" |
| AI | "Diagnosis AI" | "Tanya soal masalah HP dan dapatkan saran" |

### Grafik riwayat skor

- Judul: "Riwayat skor"
- Empty state grafik: "Belum ada data pemeriksaan"
- Penjelasan empty state: "Jalankan diagnosis satu ketuk untuk
  melihat perkembangan skor dari waktu ke waktu."

### Tiga pemeriksaan terakhir

- Judul: "Pemeriksaan terakhir"
- Entri: "Skor [skor] dari 100", "[tanggal], [jam]", dan lencana
  status "[label status]"
- Tautan di bawah daftar: "Lihat semua di Riwayat"
- Empty state: "Belum ada pemeriksaan. Ketuk Diagnosis satu ketuk
  untuk mulai."

### Banner mode

- Server tidak terjangkau: "Tidak tersambung ke server. Hasil tes
  tidak tersimpan."
- Penjelasan banner: "Tes WiFi tetap bisa dijalankan, tetapi
  hasilnya tidak tersimpan sampai sambungan ke server pulih."
- Mode tanpa akun (tamu): "Anda belum masuk. Hasil tes tidak
  tersimpan."
- Tombol di banner tamu: "Masuk untuk menyimpan"

---

## 5. Dokter WiFi — `/wifi`

### Judul tes

- Judul layar: "Dokter WiFi"
- Subjudul: "Ukur kecepatan WiFi dan cari tahu penyebabnya bila lemot."
- Tombol mulai: "Periksa WiFi sekarang"
- Tombol tes bertahan: "Tes bertahan 30 detik"

### Tahap tes (progres)

1. "Membaca info jaringan…"
2. "Mengukur kecepatan unduh…"
3. "Mengukur latensi…"
4. "Menyusun hasil…"

### Hasil tes

- Judul hasil: "Hasil tes WiFi"
- Label kecepatan unduh: "Kecepatan unduh"
- Label latensi: "Latensi HTTP"
- Penjelasan latensi: "Latensi HTTP adalah waktu yang dibutuhkan
  satu permintaan kecil bolak-balik ke server. Browser tidak bisa
  mengukur ping biasa, jadi yang ditampilkan adalah latensi HTTP."
- Label alamat IP: "Alamat IP publik"
- Label jenis koneksi: "Jenis koneksi"
- Label SSID: "Nama WiFi"
- Label kekuatan sinyal: "Kekuatan sinyal"
- Label channel: "Channel"
- Label DNS: "DNS"

### Klasifikasi kecepatan unduh

| Klasifikasi | Batas | Penjelasan |
|---|---|---|
| Sangat lambat | di bawah 50 KB/detik | "Sangat lambat. Membuka halaman saja akan terasa berat. Lihat panduan di bawah untuk mencari penyebabnya." |
| Lambat | di bawah 200 KB/detik | "Lambat. Pesan dan halaman ringan masih bisa, tetapi video dan unduhan akan tersendat." |
| Cukup | di bawah 1.000 KB/detik | "Cukup untuk pemakaian sehari-hari, tetapi belum ideal untuk video kualitas tinggi." |
| Cepat | di bawah 5.000 KB/detik | "Cepat. Cukup untuk video, panggilan, dan unduhan sehari-hari." |
| Sangat cepat | 5.000 KB/detik atau lebih | "Sangat cepat. Koneksi ini sudah lebih dari cukup untuk pemakaian sehari-hari." |

### Tes bertahan 30 detik

- Judul: "Tes bertahan 30 detik"
- Penjelasan: "Tes ini mengukur kecepatan selama 30 detik penuh
  untuk melihat apakah kecepatan bertahan dari awal sampai akhir,
  atau mulai cepat lalu jatuh di tengah jalan."
- Sedang berjalan: "Mengukur… detik ke-[n] dari 30"
- Hasil stabil: "Kecepatan stabil selama 30 detik."
- Hasil tidak stabil: "Kecepatan tidak stabil selama 30 detik. Coba
  tes lagi saat jaringan tidak dipakai perangkat lain."
- Hasil jatuh: "Kecepatan mulai [awal] lalu jatuh ke [akhir].
  Pola seperti ini biasanya berasal dari router atau jaringan,
  bukan dari HP."
- Judul grafik: "Kecepatan per detik"

### Pemantau live

- Label: "Kecepatan saat ini"
- Label: "Latensi saat ini"

### Panduan WiFi lemot

- Judul panduan: "WiFi lemot: cara mencari penyebabnya"
- Patokan normal: "Sebagai patokan, kecepatan unduh yang wajar
  biasanya sekitar 1 MB/detik atau lebih. Bila hasil tes jauh di
  bawah itu, ada yang perlu diperiksa."
- Penyebab yang sering terjadi: "Penyebab yang sering terjadi
  adalah pengaturan router yang masih memakai mode lama. Mode
  lama membatasi kecepatan seluruh jaringan WiFi, walau sinyal
  terlihat penuh."
- Tes pembeda 1: "Coba HP lain di WiFi yang sama. Bila HP lain
  juga lemot, masalahnya ada di router atau jaringan, bukan di HP."
- Tes pembeda 2: "Coba data seluler. Bila data seluler lancar,
  masalahnya ada di WiFi, bukan di HP."

### Rekomendasi

- Dekat router: "Coba mendekat ke router, lalu tes lagi."
- Unduhan lain: "Tutup unduhan atau video yang sedang berjalan
  di perangkat lain, lalu tes lagi."
- Channel router: "Bila masih lemot, ganti channel router 2,4 GHz
  ke 1, 6, atau 11. Ketiga channel itu tidak saling mengganggu."
- Mode router: "Periksa mode router di halaman pengaturan router.
  Bila masih memakai mode lama, ubah ke mode campuran (b/g/n)
  agar kecepatan tidak dibatasi."
- Ganti DNS: "Coba ganti DNS ke 1.1.1.1 atau 8.8.8.8 dari
  pengaturan jaringan di HP."
- Lupakan jaringan: "Coba lupakan jaringan WiFi ini, lalu sambung
  ulang dengan memasukkan kata sandi lagi."
- Penjelasan batasan perbaikan: "Versi web tidak bisa membuka
  pengaturan WiFi di HP secara langsung. Langkah di atas perlu
  dilakukan sendiri dari pengaturan HP atau halaman router."

### Input manual

- Judul bagian: "Lengkapi info jaringan"
- Penjelasan: "Browser tidak bisa membaca nama WiFi, kekuatan
  sinyal, dan channel secara langsung. Bila Anda mengetahuinya
  — misalnya dari halaman pengaturan router — isi di sini agar
  hasilnya lebih lengkap. Boleh dikosongkan."
- Tombol: "Simpan info jaringan"

### Bagikan hasil

- Tombol: "Bagikan hasil"
- Teks ringkasan yang dibagikan: "Tes WiFi Dokter HP: kecepatan
  unduh [hasil] ([klasifikasi]), latensi [hasil]. Diukur [tanggal],
  [jam]."
- Berhasil disalin: "Ringkasan hasil tersalin."

### Empty state

- Judul: "Belum ada tes WiFi"
- Isi: "Ketuk Periksa WiFi sekarang untuk mengukur kecepatan
  koneksi yang sedang dipakai."
- Empty state riwayat tes di layar ini: "Belum ada riwayat tes.
  Hasil tes yang sudah dijalankan akan tampil di sini."

### Catatan penyimpanan

- Bila masuk: "Ketuk Simpan laporan untuk menyimpan hasil ke riwayat."
- Bila tanpa akun: "Hasil tidak tersimpan karena Anda belum masuk.
  Masuk untuk menyimpan riwayat."

---

## 6. Dokter Baterai — `/baterai`

### Judul

- Judul layar: "Dokter Baterai"
- Subjudul: "Riwayat dan kondisi baterai HP Anda."

### Penjelasan batasan

- "Versi web tidak bisa membaca baterai HP secara langsung.
  Data di layar ini berasal dari riwayat aplikasi Dokter HP atau
  dari yang Anda isi sendiri. Untuk melihat aplikasi yang paling
  banyak memakai baterai, buka Pengaturan > Baterai di HP."

### Entri riwayat

- Label level: "Level baterai"
- Label status: "Status"
- Nilai status: "Mengisi daya" / "Dipakai" / "Penuh"
- Label mode hemat daya: "Mode hemat daya"
- Nilai mode hemat daya: "Aktif" / "Tidak aktif"
- Label estimasi: "Perkiraan waktu pakai"
- Penjelasan estimasi: "Perkiraan ini dihitung dari asumsi
  pemakaian rata-rata 10% per jam. Angka sebenarnya bisa berbeda
  tergantung pemakaian."
- Label sumber dan waktu: "[tanggal], [jam]" di baris pertama,
  "[sumber]" di baris kedua

### Input manual

- Judul bagian: "Isi kondisi baterai"
- Tombol buka/tutup formulir: "Tambah catatan" / "Tutup formulir"
- Petunjuk mencatat: "Cara mencatat: lihat level baterai di HP,
  ketuk Tambah catatan di bawah, lalu isi level dan statusnya."
- Label bidang level: "Level baterai (%)"
- Label bidang status: "Status"
- Tombol: "Simpan"

### Tips

- Judul bagian: "Tips merawat baterai"
- Tip 1: "Hindari HP kepanasan terlalu lama, misalnya dipakai
  sambil mengisi daya di bawah sinar matahari."
- Tip 2: "Aktifkan mode hemat daya bila baterai tinggal sedikit
  dan tidak ada pengisi daya."
- Tip 3: "Kurangi kecerahan layar bila baterai cepat habis."

### Empty state

- Judul: "Belum ada data baterai"
- Isi: "Belum ada riwayat baterai. Isi kondisi baterai secara
  manual, atau sinkronkan dari aplikasi Dokter HP di Android."

---

## 7. Dokter Penyimpanan — `/penyimpanan`

### Judul

- Judul layar: "Dokter Penyimpanan"
- Subjudul: "Pemakaian ruang penyimpanan HP Anda."

### Penjelasan batasan

- "Versi web tidak bisa membaca penyimpanan HP secara langsung.
  Data di layar ini berasal dari riwayat aplikasi Dokter HP atau
  dari yang Anda isi sendiri. Versi web juga tidak bisa
  membersihkan file di HP. Hapus file yang tidak perlu langsung
  dari HP."
- Petunjuk mencatat: "Cara mencatat: lihat angkanya di Pengaturan >
  Penyimpanan di HP, ketuk Tambah catatan di bawah, lalu salin
  total dan yang terpakai ke sini."

### Entri riwayat

- Label total: "Total penyimpanan"
- Label terpakai: "Terpakai"
- Label kosong: "Masih kosong"
- Label bilah: "Pemakaian penyimpanan"
- Penjelasan bila hampir penuh: "Penyimpanan hampir penuh. HP
  bisa terasa berat bila ruang kosong tinggal sedikit. Hapus file
  atau aplikasi yang tidak dipakai lagi."

### Input manual

- Judul bagian: "Isi pemakaian penyimpanan"
- Tombol buka/tutup formulir: "Tambah catatan" / "Tutup formulir"
- Label bidang total: "Total penyimpanan (GB)"
- Label bidang terpakai: "Yang terpakai (GB)"
- Tombol: "Simpan"

### Empty state

- Judul: "Belum ada data penyimpanan"
- Isi: "Belum ada riwayat penyimpanan. Isi pemakaian penyimpanan
  secara manual, atau sinkronkan dari aplikasi Dokter HP di Android."

---

## 8. Dokter Performa — `/performa`

### Judul

- Judul layar: "Dokter Performa"
- Subjudul: "Riwayat kecepatan dan beban HP Anda."

### Penjelasan batasan

- "Versi web tidak bisa membaca RAM, beban prosesor, atau suhu HP
  secara langsung. Data di layar ini berasal dari riwayat aplikasi
  Dokter HP atau dari yang Anda isi sendiri. Versi web juga tidak
  bisa menutup aplikasi lain. Tutup aplikasi dari layar aplikasi
  terakhir di HP, atau mulai ulang HP bila terasa berat."
- Petunjuk mencatat: "Cara mencatat: ketuk Tambah catatan di bawah,
  pilih kondisi HP saat ini, dan isi detail yang diketahui. Info
  perangkat bisa dilihat di Pengaturan > Tentang ponsel di HP."

### Entri riwayat

- Label RAM: "RAM"
- Label RAM kosong: "RAM yang masih kosong"
- Label beban prosesor: "Beban prosesor"
- Label suhu: "Suhu"
- Label perangkat: "Perangkat"
- Label versi Android: "Versi Android"
- Label prosesor: "Prosesor"
- Label sumber dan waktu: "[tanggal], [jam]" di baris pertama,
  "[sumber]" di baris kedua

### Input manual

- Judul bagian: "Isi kondisi performa"
- Tombol buka/tutup formulir: "Tambah catatan" / "Tutup formulir"
- Tombol: "Simpan"

### Empty state

- Judul: "Belum ada data performa"
- Isi: "Belum ada riwayat performa. Isi kondisi performa secara
  manual, atau sinkronkan dari aplikasi Dokter HP di Android."

---

## 9. Dokter Keamanan — `/keamanan`

### Judul

- Judul layar: "Dokter Keamanan"
- Subjudul: "Tinjau aplikasi dan izin yang berisiko di HP Anda."

### Penjelasan batasan

- "Versi web tidak bisa memindai aplikasi di HP. Data di layar ini
  hanya berasal dari riwayat aplikasi Dokter HP di Android. Untuk
  pemindaian baru, jalankan Dokter Keamanan dari aplikasi Android."

### Bagian "Perlu ditinjau"

- Judul bagian: "Perlu ditinjau"
- Penjelasan: "Aplikasi di bawah meminta 4 izin berbahaya
  atau lebih. Tinjau satu per satu."
- Entri aplikasi: "[nama aplikasi]", "[n] izin berbahaya", dan
  "[sumber] · [tanggal], [jam]"
- Empty state bagian ini: "Tidak ada aplikasi yang perlu ditinjau
  dari data terakhir."
- Petunjuk mencatat: "Cara mencatat: salin nama aplikasi dan jumlah
  izin berbahayanya dari hasil pemindaian di aplikasi Dokter HP,
  lalu ketuk Tambah catatan di bawah."

### Daftar aplikasi

- Judul bagian: "Semua aplikasi"
- Label jumlah izin: "[n] izin berbahaya"
- Label aplikasi sistem: "Aplikasi sistem"
- Catatan: "Aplikasi sistem adalah bagian dari HP dan biasanya
  tidak bisa dihapus."

### Empty state

- Judul: "Belum ada data keamanan"
- Isi: "Belum ada riwayat pemindaian keamanan. Jalankan Dokter
  Keamanan dari aplikasi Dokter HP di Android untuk mengisi data
  ini."

---

## 10. Diagnosis AI — `/ai`

### Judul

- Judul layar: "Diagnosis AI"
- Subjudul: "Ceritakan masalah HP, dapatkan saran langkah
  perbaikan."

### Bidang pertanyaan

- Placeholder: "Contoh: WiFi lemot padahal sinyal penuh. Apa yang
  harus diperiksa dulu?"
- Label bidang: "Keluhan atau pertanyaan"
- Tombol kirim: "Kirim"
- Sedang menjawab: "Sedang menyiapkan jawaban…"

### Disclaimer

- "Jawaban di bawah ini adalah saran berdasarkan data yang
  tersedia, bukan vonis pasti. Bila masalah menyangkut kerusakan
  fisik, misalnya HP jatuh atau terkena air, bawa ke teknisi."

### Batas pemakaian

- Sisa kuota: "Sisa pertanyaan hari ini: [n] dari 20"
- Batas habis: "Batas 20 pertanyaan hari ini sudah habis. Batas
  kembali besok."
- Penjelasan batas: "Batas ini diberlakukan agar kuota layanan
  cukup untuk semua pengguna."

### Riwayat tanya jawab

- Judul bagian: "Tanya jawab sebelumnya"
- Empty state: "Belum ada tanya jawab. Tulis keluhan di atas
  untuk mulai."

### AI tidak tersedia

- "Diagnosis AI sedang tidak tersedia, coba lagi nanti."

---

## 11. Riwayat — `/riwayat`

### Judul

- Judul layar: "Riwayat"
- Subjudul: "Semua hasil pemeriksaan dan tes WiFi Anda."

### Filter

- Label filter: "Tampilkan"
- Pilihan filter: "Semua" / "Pemeriksaan kesehatan" / "Tes WiFi" /
  "Diagnosis AI"
- Urutan: "Terbaru dulu"

### Entri

- Entri pemeriksaan: "Pemeriksaan kesehatan", "[tanggal], [jam]",
  skor "[skor] dari 100" dan lencana status "[label status]", lalu
  daftar komponen "[komponen]: [status] (skor [skor]), [sumber]".
- Entri WiFi: lencana "Tes WiFi" (ditambah "Tes bertahan 30 detik"
  bila tes bertahan), "[tanggal], [jam]", "[kecepatan]
  ([klasifikasi])", "Nama WiFi: [SSID]", "Latensi HTTP: [n] ms",
  "Kekuatan sinyal: [label]", "Sumber: [sumber]".
- Entri AI: lencana "Diagnosis AI", "[tanggal], [jam]",
  "Tanya jawab", cuplikan pertanyaan, dan "Lihat tanya jawab
  lengkap".

### Tombol PDF dan hapus

- Tombol PDF: "Unduh laporan PDF"
- Sedang membuat PDF: "Membuat laporan…"
- PDF berhasil: "Laporan PDF berhasil diunduh."
- Tombol hapus entri: "Hapus"
- Konfirmasi hapus entri — judul: "Hapus entri ini?"
- Konfirmasi hapus entri — isi: "Entri ini akan dihapus dari
  riwayat Anda."
- Tombol konfirmasi hapus: "Ya, hapus"
- Berhasil dihapus: "Entri berhasil dihapus."

### Empty state

- Judul: "Belum ada riwayat"
- Isi: "Hasil pemeriksaan dan tes WiFi yang tersimpan akan tampil
  di sini. Jalankan diagnosis atau tes WiFi untuk mulai."
- Empty state per filter: "Belum ada riwayat untuk jenis ini."

---

## 12. Pengaturan akun — `/pengaturan`

### Judul

- Judul layar: "Pengaturan akun"
- Subjudul: "Kelola profil, PIN, sesi, dan akun Anda."

### Profil

- Judul bagian: "Profil"
- Label nama tampilan: "Nama tampilan"
- Label email: "Email"
- Catatan email: "Email berasal dari akun Google dan tidak bisa
  diubah di sini."
- Tombol simpan nama: "Simpan nama"
- Nama berhasil disimpan: "Nama berhasil disimpan."

### PIN

- Judul bagian: "PIN aplikasi"
- Penjelasan: "PIN melindungi riwayat pemeriksaan di aplikasi
  ini. PIN diminta setiap kali sesi baru dimulai."
- Bila PIN belum diatur: lencana "Belum diatur" + "Aplikasi
  langsung terbuka tanpa PIN."
- Bila PIN sudah diatur: lencana "PIN aktif"
- Tombol: "Atur PIN" (bila belum diatur) / "Ubah PIN" (bila sudah
  diatur), membuka layar /pengaturan/pin.

### Atur PIN — `/pengaturan/pin`

- Judul layar: "PIN aplikasi"
- Penjelasan: "PIN melindungi riwayat pemeriksaan di aplikasi ini.
  PIN diminta setiap kali sesi baru dimulai."
- Bila PIN belum diatur: lencana "PIN belum diatur" + "Aplikasi
  langsung terbuka tanpa PIN."
- Bila PIN sudah diatur: lencana "PIN sudah diatur"
- Label PIN baru: "PIN baru (4–8 angka)"
- Label ulangi PIN: "Ulangi PIN baru"
- Label PIN lama: "PIN lama"
- PIN lama diperlukan: "Masukkan PIN lama untuk mengubah PIN."
- PIN lama salah: "PIN lama salah, coba lagi."
- PIN tidak cocok: "PIN yang diulang tidak sama. Periksa lagi."
- PIN tidak valid: "PIN harus 4 sampai 8 angka."
- PIN lemah: "PIN terlalu mudah ditebak. Pilih kombinasi yang tidak
  berurutan dan tidak semua sama. Sebaiknya pakai 6 sampai 8 digit
  yang acak."
- Tombol simpan: "Atur PIN" (bila belum diatur) / "Ubah PIN" (bila
  sudah diatur)
- PIN berhasil diatur: "PIN berhasil diatur."
- PIN berhasil diubah: "PIN berhasil diubah."
- Sesi masih terkunci setelah atur PIN: "Sesi masih terkunci." +
  tautan "Buka dengan PIN baru"
- Tombol hapus PIN: "Hapus PIN"
- Konfirmasi hapus PIN — isi: "PIN akan dihapus. Aplikasi tidak
  lagi meminta PIN saat dibuka."
- Tombol konfirmasi hapus: "Ya, hapus"
- PIN berhasil dihapus: "PIN berhasil dihapus."

### Sesi

- Judul bagian: "Sesi aktif"
- Penjelasan: "Perangkat yang sedang masuk dengan akun Anda. Bila
  ada sesi yang tidak dikenal, keluar dari sesi itu dan periksa
  keamanan akun Google Anda."
- Entri sesi: "[browser] di [perangkat]" (+ lencana "Sesi ini"
  untuk sesi yang sedang dipakai), "Masuk sejak [tanggal], [jam]",
  "Berlaku sampai [tanggal], [jam]", "IP terakhir: [IP]"
- Bila tidak ada sesi: "Tidak ada sesi aktif" + "Daftar sesi
  kosong. Muat ulang untuk memeriksa lagi." + tombol "Muat ulang"
- Label sesi ini: "Sesi ini"
- Tombol keluar dari sesi lain: "Keluar dari sesi ini"
- Berhasil keluar dari sesi lain: "Berhasil keluar dari sesi itu."
- Tombol keluar dari semua sesi lain: "Keluar dari semua perangkat
  lain"

### Hapus akun

- Judul bagian: "Hapus akun"
- Peringatan: "Menghapus akun akan menghapus profil dan seluruh
  data Anda secara permanen, termasuk riwayat pemeriksaan, tes WiFi,
  dan tanya jawab. Tindakan ini tidak bisa dibatalkan."
- Label konfirmasi: "Ketik HAPUS untuk mengonfirmasi"
- Tombol hapus akun: "Hapus akun saya"
- Tombol konfirmasi akhir: "Ya, hapus akun saya"
- Berhasil: "Akun berhasil dihapus."

### Tentang

- Judul bagian: "Tentang"
- Label versi: "Versi aplikasi web"
- Tautan repo: "Kode sumber Dokter HP"
- Penjelasan batasan web: "Versi web mengukur koneksi dari browser.
  Data baterai, penyimpanan, dan performa diisi manual atau dari
  riwayat aplikasi Dokter HP. Browser tidak bisa membaca sensor HP
  secara langsung."

---

## 13. Pesan galat (semua layar)

Semua pesan galat ditulis dengan bahasa sehari-hari, tanpa rincian
teknis dari sistem. Setiap galat yang bisa dicoba ulang disertai
tombol "Coba lagi".

| Situasi | Pesan |
|---|---|
| Koneksi internet putus | "Tidak ada koneksi internet. Periksa sambungan, lalu coba lagi." |
| Server tidak terjangkau | "Tidak tersambung ke server. Tes WiFi tetap bisa dijalankan, tetapi hasilnya tidak tersimpan." |
| Server sibuk / kuota habis | "Server sedang sibuk, coba lagi nanti." |
| Gagal memuat data | "Data tidak bisa dimuat. Coba lagi." |
| Gagal menyimpan data | "Data tidak bisa disimpan. Coba lagi." |
| Gagal masuk Google | "Masuk dengan Google gagal. Coba lagi." |
| Masuk Google dibatalkan | "Masuk dibatalkan. Ketuk Masuk dengan Google untuk mencoba lagi." |
| Sesi habis | "Sesi sudah berakhir. Masuk lagi untuk lanjut." |
| Akses ditolak | "Anda tidak punya akses ke halaman ini. Masuk dulu dengan akun Anda." |
| Halaman tidak ditemukan | "Halaman yang dicari tidak ada. Kembali ke beranda." |
| Tes WiFi gagal / waktu habis | "Tes WiFi tidak selesai. Periksa koneksi, lalu coba lagi." |
| Tes WiFi terputus di tengah jalan | "Tes terputus di tengah jalan. Coba lagi saat koneksi stabil." |
| Tes bertahan gagal | "Tes bertahan tidak selesai. Coba lagi." |
| Diagnosis AI tidak tersedia | "Diagnosis AI sedang tidak tersedia, coba lagi nanti." |
| Batas pertanyaan AI habis | "Batas 20 pertanyaan hari ini sudah habis. Batas kembali besok." |
| Pertanyaan kosong | "Tulis dulu keluhan atau pertanyaannya." |
| Pertanyaan terlalu panjang | "Pertanyaannya terlalu panjang. Singkat saja, yang penting jelas." |
| Terlalu sering mengirim | "Terlalu sering, coba lagi sebentar." |
| PIN salah | "PIN salah. Coba lagi." |
| PIN terkunci sementara | "Terlalu banyak percobaan salah. Tunggu 30 detik sebelum mencoba lagi." |
| PIN tidak valid | "PIN harus 4 sampai 8 angka." |
| PIN tidak cocok | "PIN yang diulang tidak sama. Periksa lagi." |
| Nama kosong | "Nama tidak boleh kosong." |
| Input angka tidak valid | "Periksa lagi angka yang dimasukkan." |
| Gagal membuat PDF | "Laporan PDF tidak bisa dibuat. Coba lagi." |
| Gagal menghapus entri | "Entri tidak bisa dihapus. Coba lagi." |
| Gagal menghapus akun | "Akun tidak bisa dihapus. Coba lagi." |
| Konfirmasi hapus akun salah | "Ketik HAPUS persis seperti contoh untuk melanjutkan." |
| Berbagi hasil gagal | "Hasil tidak bisa dibagikan. Coba salin manual." |
| Salin ke clipboard gagal | "Tidak bisa menyalin otomatis. Salin manual dari layar." |

---

## 14. Pesan sukses (semua layar)

| Situasi | Pesan |
|---|---|
| Masuk berhasil | "Berhasil masuk. Selamat datang kembali, [nama]." |
| Keluar berhasil | "Berhasil keluar. Sampai jumpa lagi." |
| Diagnosis selesai | "Pemeriksaan selesai. Skor Anda [skor] dari 100." |
| Tes WiFi selesai | "Tes WiFi selesai. Kecepatan unduh [hasil] ([klasifikasi])." |
| Tes WiFi tersimpan | "Hasil tes tersimpan ke riwayat." |
| Tes bertahan selesai | "Tes bertahan selesai. Lihat grafik kecepatan per detik di bawah." |
| Info jaringan tersimpan | "Info jaringan tersimpan." |
| Data baterai tersimpan | "Data baterai tersimpan." |
| Data penyimpanan tersimpan | "Data penyimpanan tersimpan." |
| Data performa tersimpan | "Data performa tersimpan." |
| Jawaban AI diterima | "Jawaban sudah tampil di bawah. Tanya jawab ini tersimpan ke riwayat." |
| Nama berhasil disimpan | "Nama berhasil disimpan." |
| PIN berhasil diatur | "PIN berhasil diatur." |
| PIN berhasil diubah | "PIN berhasil diubah." |
| PIN berhasil dihapus | "PIN berhasil dihapus." |
| Keluar dari sesi lain | "Berhasil keluar dari sesi itu." |
| Entri berhasil dihapus | "Entri berhasil dihapus." |
| PDF berhasil diunduh | "Laporan PDF berhasil diunduh." |
| Ringkasan tersalin | "Ringkasan hasil tersalin." |
| Akun berhasil dihapus | "Akun berhasil dihapus." |

---

## 15. Catatan untuk tim implementasi

1. Jangan menampilkan angka contoh di layar mana pun. Bila data
   belum ada, pakai empty state dari dokumen ini.
2. Latensi selalu disebut "latensi HTTP", bukan "ping".
3. Estimasi selalu dilabeli "perkiraan", bukan pengukuran pasti.
4. Setiap entri data menampilkan sumbernya (tes web / diisi manual /
   dari aplikasi Dokter HP) dan waktunya.
5. Pesan galat tidak boleh menampilkan rincian teknis (kode galat
   server, pesan sistem, atau alamat layanan). Kode galat hanya
   untuk log internal, bukan untuk layar.
6. Teks di dokumen ini adalah teks final. Bila layar butuh teks
   tambahan yang belum ada di sini, tulis dengan aturan yang sama
   dan tambahkan ke dokumen ini.
