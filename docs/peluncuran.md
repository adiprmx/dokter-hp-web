# Rencana Peluncuran — Dokter HP Web App

> **Rencana peluncuran nol rupiah Dokter HP Web App.**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen, 17 November 2026.
> Acuan: `PRODUCT.md`, `docs/copy.md`, `docs/seo.md`,
> `docs/keputusan-stack.md`.
>
> Prinsip yang mengikat seluruh dokumen ini: **budget nol rupiah** —
> tanpa iklan berbayar, tanpa layanan berbayar, tanpa klaim yang tidak
> bisa dibuktikan. Semua teks pengumuman ditulis jujur, natural, dan
> tidak terdengar seperti iklan.
>
> Situs utama: https://dokter-hp-web.pages.dev/
> (mirror Vercel: [isi tautan mirror setelah deploy terverifikasi]).
> Repo: https://github.com/adiprmx/dokter-hp-web
> Repo APK pendamping: https://github.com/adiprmx/dokter-hp

---

## 1. Checklist pra-peluncuran

Semua butir di bawah ini harus beres **sebelum** pengumuman pertama
dibagikan. Peluncuran yang diumumkan saat aplikasi belum siap hanya
menghasilkan kesan pertama yang buruk — dan kesan pertama itu yang
dibagikan orang.

### 1.1 Produk dan teknis

- [ ] Deploy live di Cloudflare Pages terverifikasi dari browser HP
      (bukan hanya dari build log): landing terbuka, teks terbaca,
      tombol utama bisa diketuk.
- [ ] Mirror Vercel live dan memanggil API Worker yang sama; uji smoke
      lolos di kedua mirror.
- [ ] Tes WiFi tanpa akun berjalan end-to-end di HP (lebar 360 px):
      kecepatan unduh dan latensi HTTP menampilkan hasil ukur nyata.
- [ ] Tes bertahan 30 detik menyimpan 30 sampel dan menampilkan grafik.
- [ ] Masuk dengan Google berhasil end-to-end; sesi bertahan setelah
      muat ulang halaman; keluar menghapus sesi.
- [ ] PIN: atur, kunci, buka dengan PIN benar, tolak PIN salah, kunci
      30 detik setelah 5 kali salah berturut-turut.
- [ ] Dashboard menampilkan skor dari data real; grafik riwayat tampil
      bila ada data, empty state jujur bila belum ada.
- [ ] Diagnosis AI menjawab lewat Worker; kunci Gemini tidak ada di
      bundle frontend (diperiksa dengan pencarian di hasil build).
- [ ] Laporan PDF terunduh dan isinya cocok dengan data riwayat.
- [ ] Semua layar tanpa data menampilkan empty state jujur; tidak ada
      angka contoh yang tampil seolah data nyata.
- [ ] Setiap tombol melakukan aksi nyata atau menampilkan pesan jujur
      bila aksinya tidak tersedia.
- [ ] Tidak ada secret atau kunci API di dalam kode dan di repo
      (periksa sebelum push terakhir).

### 1.2 Keamanan dan privasi

- [ ] Kebijakan privasi dan syarat layanan sudah terbit dan bisa dibuka
      dari aplikasi (`docs/kebijakan-privasi.md`,
      `docs/syarat-layanan.md`).
- [ ] Pengguna hanya bisa membaca dan mengubah data milik sendiri
      (penegakan `user_id` di Worker sudah diuji eksplisit).
- [ ] Tidak ada pelacakan, iklan, atau pengiriman data diam-diam.

### 1.3 Konten dan dokumen publik

- [ ] README repo menjelaskan apa itu Dokter HP Web App, apa yang bisa
      dan tidak bisa dilakukan versi web, serta tautan ke situs live
      dan ke repo APK.
- [ ] Halaman panduan di situs sudah terbit (lihat `docs/seo.md`:
      WiFi lemot, ganti channel router, ganti DNS, baterai boros,
      penyimpanan penuh, HP lemot, keamanan HP).
- [ ] Gambar pratinjau tautan (og-cover) terpasang agar tautan yang
      dibagikan menampilkan gambar yang rapi.
- [ ] Teks di seluruh layar sudah sesuai `docs/copy.md` — bahasa
      sehari-hari, tanpa istilah teknis yang tidak perlu, tanpa klaim
      berlebihan.

### 1.4 Komunitas (sebelum pengumuman)

- [ ] GitHub Discussions diaktifkan di repo `adiprmx/dokter-hp-web`
      dengan kategori dari bagian 4.1.
- [ ] Template issue laporan bug dan permintaan fitur terpasang
      (isi dari bagian 4.2 dan 4.3).
- [ ] Tautan ke Discussions dan Issues tercantum di README dan di
      halaman Tentang aplikasi, supaya pengguna yang menemukan masalah
      tahu ke mana harus melapor.

### 1.5 Operasional hari peluncuran

- [ ] Owner sudah mencoba sendiri alur lengkap dari HP: buka situs,
      tes WiFi tanpa akun, masuk dengan Google, diagnosis satu ketuk.
- [ ] Rencana respons disiapkan: siapa yang membalas pertanyaan di
      hari pertama, dan di mana (grup WhatsApp / Discussions).
- [ ] Draf pengumuman dari bagian 2 sudah dibaca owner dan disetujui
      — owner yang membagikan, bukan agen.

---

## 2. Pengumuman peluncuran

Draf di bawah ini siap dibagikan owner apa adanya. Semua draf jujur
soal apa yang bisa dan tidak bisa dilakukan aplikasi, tanpa kata
"revolusioner", tanpa kata "terbaik", dan tanpa janji yang tidak bisa
ditepati. Owner bebas mengubah kata-katanya agar terdengar seperti
dirinya sendiri.

### 2.1 Draf utama — untuk grup WhatsApp / grup komunitas

> Halo, saya mau berbagi sesuatu yang baru selesai dibuat: Dokter HP
> versi web.
>
> Ini alat gratis untuk memeriksa kondisi HP dari browser, tanpa
> memasang aplikasi. Yang bisa dilakukan:
> - Tes kecepatan WiFi dan latensi, lengkap dengan penjelasan bila
>   hasilnya lambat dan langkah yang bisa dicoba sendiri.
> - Melihat skor kesehatan HP dari data yang tersedia, dengan riwayat
>   yang tersimpan di akun.
> - Menyimpan hasil pemeriksaan dan mengunduhnya sebagai laporan PDF.
> - Bertanya soal masalah HP lewat Diagnosis AI (jawabannya saran,
>   bukan vonis pasti).
>
> Yang perlu diketahui sejak awal: versi web mengukur koneksi dari
> browser. Data baterai, penyimpanan, dan performa diisi manual atau
> dari riwayat aplikasi Dokter HP di Android, karena browser tidak
> bisa membaca sensor HP secara langsung. Aplikasi ini juga bukan
> penguat sinyal dan tidak menjanjikan HP jadi lebih cepat — fungsinya
> membantu menemukan masalah dan menunjukkan langkah perbaikannya.
>
> Silakan dicoba di sini: https://dokter-hp-web.pages.dev/
> Tes WiFi bisa dicoba tanpa masuk dulu.
>
> Kalau menemukan masalah atau ada masukan, silakan tulis di
> https://github.com/adiprmx/dokter-hp-web/issues
> atau balas di sini. Terima kasih sudah mencoba.

### 2.2 Draf singkat — untuk status WhatsApp

> Dokter HP sekarang bisa dipakai dari browser, gratis, tanpa
> memasang aplikasi. Tes WiFi, cek skor kesehatan HP, simpan
> riwayat pemeriksaan. Coba di sini:
> https://dokter-hp-web.pages.dev/
> Tes WiFi bisa dicoba tanpa masuk dulu.

### 2.3 Draf singkat — untuk repo (README / rilis GitHub)

> Dokter HP Web App — periksa kondisi HP dari browser.
>
> Gratis, tanpa memasang aplikasi. Tes kecepatan WiFi dan latensi,
> skor kesehatan HP, riwayat pemeriksaan, laporan PDF, dan Diagnosis
> AI. Batasan versi web dijelaskan jujur di dalam aplikasi: browser
> tidak bisa membaca sensor HP, jadi data baterai, penyimpanan, dan
> performa diisi manual atau dari riwayat aplikasi Dokter HP di
> Android.
>
> Coba: https://dokter-hp-web.pages.dev/
> Masukan dan laporan masalah: buka Issues di repo ini.

### 2.4 Catatan gaya untuk semua draf

- Bicara seperti orang yang berbagi hasil kerja, bukan seperti iklan.
- Sebutkan batasan di pengumuman yang sama, bukan disembunyikan —
  kejujuran di awal mencegah kekecewaan dan keluhan.
- Jangan menambahkan klaim yang tidak ada di dokumen ini
  (misalnya "paling akurat", "paling lengkap", "nomor satu").
- Bila ada yang bertanya soal fitur yang belum ada, jawab apa
  adanya: catat sebagai masukan, jangan janjikan tanggal.

---

## 3. Kanal peluncuran (nol rupiah)

| Kanal | Cara pakai | Draf yang dipakai |
|---|---|---|
| Status WhatsApp | Bagikan draf singkat (2.2) beserta tautan situs. Satu status di hari peluncuran; status susulan hanya bila ada kabar nyata (misalnya perbaikan penting). | 2.2 |
| Grup WhatsApp | Bagikan draf utama (2.1) di grup yang relevan dan sudah dikenal owner. Jangan menyebar ke grup yang tidak dikenal — itu spam, bukan peluncuran. | 2.1 |
| GitHub — repo `adiprmx/dokter-hp-web` | README diperbarui dengan draf 2.3; rilis pertama dibuat dengan catatan yang sama; Discussions dan Issues dibuka (bagian 4). | 2.3 |
| Repo APK `adiprmx/dokter-hp` | Tambahkan satu tautan di README APK ke versi web, dan sebaliknya — pengguna APK adalah calon pengguna web yang paling relevan. | Satu baris tautan |
| Halaman panduan di situs | Tujuh halaman panduan (lihat `docs/seo.md`) adalah kanal jangka panjang: orang yang mencari solusi WiFi lemot atau baterai boros menemukan situs lewat pencarian. Tidak perlu dibagikan satu per satu. | — |

Yang **tidak** dilakukan: iklan berbayar, broadcast massal ke nomor
yang tidak dikenal, posting berulang di grup yang sama, dan
membeli pengikut atau ulasan. Peluncuran ini mengandalkan orang yang
benar-benar mencoba dan membagikan karena merasa terbantu.

---

## 4. Rencana komunitas

Komunitas Dokter HP Web App tinggal di GitHub — tanpa biaya, tanpa
layanan tambahan, dan satu tempat dengan kode sumbernya.

### 4.1 GitHub Discussions — tempat umpan balik

Aktifkan Discussions di repo `adiprmx/dokter-hp-web` dengan kategori:

| Kategori | Isi |
|---|---|
| Pengumuman | Kabar dari owner: rilis baru, perbaikan penting. Hanya owner yang memulai topik. |
| Tanya jawab | Pengguna bertanya soal cara memakai aplikasi atau arti hasil tes. |
| Masukan | Saran umum soal aplikasi — tampilan, alur, fitur yang kurang jelas. |
| Tampilkan hasil | Pengguna berbagi pengalaman memakai aplikasi (misalnya hasil tes WiFi sebelum dan sesudah mengganti channel router). |

Aturan main yang dicantumkan di deskripsi Discussions:

- Tulis dengan bahasa yang sopan; tidak ada data pribadi
  (nomor HP, email, kata sandi) di topik publik.
- Pertanyaan soal akun atau data pribadi tidak dibahas di forum
  publik — arahkan ke Issues dengan label yang sesuai atau ke
  jalur pribadi.
- Owner membalas bila sempat; tidak ada janji waktu balas.

### 4.2 Template issue — laporan bug

Simpan sebagai `.github/ISSUE_TEMPLATE/laporan-bug.md` di repo.

```markdown
---
name: Laporan bug
about: Laporkan masalah yang ditemukan saat memakai Dokter HP Web App
title: "[Bug] "
labels: bug
---

## Masalahnya apa

Jelaskan dengan singkat apa yang terjadi. Contoh: "Tes WiFi berhenti
di tengah jalan dan tidak menampilkan hasil."

## Langkah yang dilakukan

1. Buka ...
2. Ketuk ...
3. Lalu terjadi ...

## Yang seharusnya terjadi

Jelaskan apa yang Anda harapkan terjadi.

## Perangkat dan browser

- HP / perangkat: (contoh: Redmi Note 12)
- Browser: (contoh: Chrome 131 di Android)
- Koneksi saat tes: (contoh: WiFi rumah / data seluler)

## Tangkapan layar (bila ada)

Lampirkan bila membantu menjelaskan. Pastikan tidak ada data pribadi
di gambar (email, nomor HP, alamat).
```

### 4.3 Template issue — permintaan fitur

Simpan sebagai `.github/ISSUE_TEMPLATE/permintaan-fitur.md` di repo.

```markdown
---
name: Permintaan fitur
about: Usulkan fitur baru atau perbaikan untuk Dokter HP Web App
title: "[Fitur] "
labels: enhancement
---

## Masalah yang ingin diselesaikan

Jelaskan masalah atau kebutuhan yang Anda alami. Contoh: "Saya ingin
melihat riwayat tes WiFi per minggu, bukan hanya daftar satu per satu."

## Usulan

Jelaskan fitur yang Anda usulkan, sesederhana mungkin.

## Alternatif yang sudah dicoba (bila ada)

Bila sudah ada cara lain untuk mengatasi masalah ini, tulis di sini.

## Catatan

- Tidak semua usulan bisa dibuat — usulan dibaca dan dipertimbangkan,
  tetapi tidak ada janji tanggal.
- Bila usulan menyangkut pembacaan sensor HP langsung (baterai,
  penyimpanan, RAM), perlu diketahui bahwa browser tidak bisa
  melakukannya — itu keterbatasan web, bukan kekurangan aplikasi.
```

### 4.4 Cara mengelola komunitas (ringkas)

- **Triage mingguan:** owner memeriksa Issues dan Discussions baru
  seminggu sekali; beri label (`bug`, `enhancement`, `pertanyaan`)
  dan balas singkat bahwa laporan sudah dibaca.
- **Bug dulu, fitur kemudian:** laporan bug yang bisa direproduksi
  diprioritaskan di atas permintaan fitur.
- **Tutup dengan penjelasan:** bila issue ditutup tanpa dikerjakan,
  tulis alasannya satu kalimat (misalnya keterbatasan browser atau
  di luar tujuan produk) — jangan ditutup diam-diam.
- **Jangan janji tanggal:** bila fitur direncanakan, tulis
  "direncanakan" tanpa tanggal pasti.
- **Satu sumber kebenaran:** keputusan soal fitur dicatat di issue
  terkait, bukan hanya di chat — supaya siapa pun bisa mengikuti
  alasannya.

---

## 5. Rencana konten edukasi

Lima ide postingan panduan singkat, masing-masing berdasarkan fitur
nyata aplikasi. Formatnya sama: masalah yang dikenal banyak orang,
langkah singkat, dan ajakan mencoba fitur terkait — tanpa nada iklan.
Setiap postingan bisa dipakai sebagai status WhatsApp, pesan grup,
atau topik Discussions. Tautan panduan lengkap ada di situs
(lihat `docs/seo.md`).

### 5.1 Postingan 1 — "WiFi lemot padahal sinyal penuh"

> Sinyal penuh tidak selalu berarti WiFi cepat. Sinyal menunjukkan
> seberapa kuat HP menangkap router; kecepatan menunjukkan seberapa
> cepat data benar-benar sampai.
>
> Cara memastikan: jalankan tes WiFi di Dokter HP dan lihat angka
> kecepatan unduhnya. Bila jauh di bawah 1 MB/detik, coba dua tes
> pembeda ini:
> 1. Coba HP lain di WiFi yang sama. Bila HP lain juga lemot,
>    masalahnya ada di router atau jaringan, bukan di HP.
> 2. Coba data seluler. Bila data seluler lancar, masalahnya ada
>    di WiFi, bukan di HP.
>
> Panduan lengkap: https://dokter-hp-web.pages.dev/panduan/wifi-lemot
> Tes WiFi (tanpa masuk dulu):
> https://dokter-hp-web.pages.dev/wifi

Fitur yang dipakai: Dokter WiFi — tes kecepatan unduh, klasifikasi,
dan panduan WiFi lemot (PRODUCT.md 4.4).

### 5.2 Postingan 2 — "Kecepatan WiFi jatuh di tengah jalan"

> Ada WiFi yang awalnya cepat, lalu tiba-tiba melambat saat dipakai.
> Tes sekali jalan tidak menangkap pola ini — yang dibutuhkan adalah
> tes yang mengukur terus selama beberapa saat.
>
> Di Dokter HP ada Tes bertahan 30 detik: kecepatan diukur setiap
> detik selama 30 detik dan ditampilkan sebagai grafik. Bila grafik
> mulai tinggi lalu jatuh, polanya biasanya berasal dari router atau
> jaringan, bukan dari HP.
>
> Coba: https://dokter-hp-web.pages.dev/wifi
> (ketuk "Tes bertahan 30 detik")

Fitur yang dipakai: Dokter WiFi — tes bertahan 30 detik dan grafik
sampel per detik (PRODUCT.md 4.4).

### 5.3 Postingan 3 — "Ganti channel router, WiFi bisa lebih lega"

> Di pita 2,4 GHz, hanya channel 1, 6, dan 11 yang tidak saling
> tumpang tindih. Bila router memakai channel lain, sinyalnya
> bertabrakan dengan WiFi tetangga dan kecepatan ikut turun.
>
> Langkahnya: buka halaman pengaturan router (biasanya dari browser,
> alamatnya tertulis di stiker router), cari pengaturan channel
> 2,4 GHz, lalu ubah ke 1, 6, atau 11. Setelah itu, jalankan tes
> WiFi lagi dan bandingkan hasilnya dengan sebelum diganti.
>
> Panduan lengkap:
> https://dokter-hp-web.pages.dev/panduan/ganti-channel-router

Fitur yang dipakai: Dokter WiFi — rekomendasi channel dan tes
kecepatan untuk membandingkan sebelum/sesudah (PRODUCT.md 4.4).

### 5.4 Postingan 4 — "Baterai boros: yang bisa dicek sendiri"

> Versi web Dokter HP tidak bisa membaca baterai secara langsung,
> jadi postingan ini jujur soal itu — dan tetap membantu:
>
> 1. Buka Pengaturan > Baterai di HP untuk melihat aplikasi yang
>    paling banyak memakai baterai.
> 2. Catat level baterai di Dokter Baterai secara manual, lalu
>    bandingkan dari hari ke hari di riwayat.
> 3. Hindari HP kepanasan terlalu lama, misalnya dipakai sambil
>    mengisi daya di bawah sinar matahari.
>
> Panduan lengkap:
> https://dokter-hp-web.pages.dev/panduan/baterai-boros

Fitur yang dipakai: Dokter Baterai — riwayat, input manual, dan
tips merawat baterai (PRODUCT.md 4.5).

### 5.5 Postingan 5 — "Penyimpanan penuh bikin HP terasa berat"

> Bila ruang kosong tinggal sedikit, HP bisa terasa berat. Versi
> web tidak bisa membersihkan file di HP, jadi langkahnya dilakukan
> langsung dari HP:
>
> 1. Buka Pengaturan > Penyimpanan untuk melihat apa yang paling
>    banyak memakan ruang.
> 2. Hapus file dan aplikasi yang tidak dipakai lagi — mulai dari
>    yang paling besar.
> 3. Catat pemakaian penyimpanan di Dokter Penyimpanan agar
>    perkembangannya terlihat di riwayat.
>
> Panduan lengkap:
> https://dokter-hp-web.pages.dev/panduan/penyimpanan-penuh

Fitur yang dipakai: Dokter Penyimpanan — riwayat, bilah pemakaian,
dan input manual (PRODUCT.md 4.5).

### 5.6 Jadwal dan catatan konten

- **Frekuensi:** satu postingan per minggu sudah cukup. Konten yang
  jarang tetapi berguna lebih baik daripada posting setiap hari
  yang isinya pengulangan.
- **Urutan:** mulai dari postingan 1 (WiFi lemot) karena itu masalah
  yang paling banyak dialami dan fitur utamanya.
- **Ukur dengan sederhana:** bila sebuah postingan membuat orang
  mencoba tes WiFi dan bertanya, itu berhasil. Tidak ada target
  angka — tidak ada data pembanding, dan target karangan dilarang.
- **Daur ulang:** setiap postingan bisa dipakai ulang sebagai topik
  Discussions setelah dibagikan di WhatsApp, supaya isinya tidak
  hilang begitu status kedaluwarsa.

---

## 6. Setelah peluncuran (minggu pertama)

- Hari ke-1 sampai ke-3: pantau Issues dan Discussions baru; balas
  laporan bug dengan pertanyaan klarifikasi bila langkah
  reproduksinya belum jelas.
- Bila ada bug yang membuat fitur utama tidak bisa dipakai (misalnya
  tes WiFi gagal total), perbaiki dulu sebelum membagikan konten
  edukasi berikutnya.
- Akhir minggu pertama: catat apa yang paling banyak ditanyakan —
  itu bahan postingan dan perbaikan berikutnya.
- Jangan mengumumkan "peluncuran sukses" berdasarkan kesan; yang
  dihitung adalah laporan nyata: berapa issue masuk, berapa yang
  sudah ditanggapi, dan apakah fitur utama berjalan.

---

## Changelog dokumen

### 17 November 2026 — versi awal

- Checklist pra-peluncuran (produk, keamanan, konten, komunitas,
  operasional hari peluncuran).
- Draf pengumuman: utama (grup), singkat (status WhatsApp), singkat
  (README/rilis GitHub).
- Kanal nol rupiah: status WhatsApp, grup WhatsApp, GitHub,
  repo APK, halaman panduan.
- Rencana komunitas: kategori GitHub Discussions, template issue
  laporan bug dan permintaan fitur, cara mengelola komunitas.
- Rencana konten edukasi: 5 ide postingan panduan singkat
  berdasarkan fitur aplikasi.
