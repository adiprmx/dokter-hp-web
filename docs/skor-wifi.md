# skor-wifi.md: Rumus skor kesehatan WiFi (0–100)

> **Desain saja — bukan implementasi.** Dokumen ini merancang rumus skor
> WiFi yang dipakai saat pengguna menyimpan laporan tes WiFi, agar
> dasbor bisa menampilkan skor + badge warna. Tidak ada kode di sini;
> tim implementasi menerjemahkan rumus ini ke fungsi murni (seperti
> `lib/skor.ts`) beserta tesnya.
>
> Status: desain, 18 November 2026.
> Acuan: `apps/web/src/lib/skor.ts` (ambang kanonis K-31),
> `apps/web/src/lib/speedtest.ts` (klasifikasi kecepatan, verdict tes
> bertahan), `apps/web/src/pages/WifiPage.tsx` (bentuk data hasil tes),
> `docs/api-contracts.md` §4 (kontrak wifi-reports), `docs/copy.md`
> (aturan bahasa copy).

---

## 0. Kejujuran yang wajib terlihat

**Skor ini HANYA mencerminkan WiFi, bukan pemeriksaan penuh.**

- Skor dihitung hanya dari tiga hal yang benar-benar diukur di halaman
  Dokter WiFi: kecepatan unduh, latensi HTTP, dan kestabilan tes
  bertahan 30 detik (bila dijalankan).
- Skor ini TIDAK menilai baterai, penyimpanan, performa, atau keamanan.
  Skor ini juga bukan skor kesehatan HP secara keseluruhan.
- Karena itu, setiap tempat yang menampilkan skor WiFi WAJIB menampilkan
  juga kalimat jujur dari §6 ("Skor ini hanya dari tes WiFi…"). Skor
  tanpa kalimat itu menyesatkan: pengguna bisa mengira HP-nya sehat
  secara keseluruhan padahal yang diukur hanya WiFi.
- Bila datanya tidak lengkap (tidak ada tes bertahan, atau latensi tidak
  berhasil diukur), skor dibatasi — lihat §4. Skor dari data tidak
  lengkap tidak boleh terlihat sebagus skor dari data lengkap.

---

## 1. Masukan

Semua masukan berasal dari data yang sudah ada di `WifiPage.tsx`
(tidak ada pengukuran baru):

| Masukan | Sumber di kode | Satuan / nilai |
|---|---|---|
| Kecepatan unduh | `hasil.kecepatanKbps` | KB/detik, ≥ 0 |
| Latensi | `hasil.latensiMs` | milidetik, atau `null` bila tidak berhasil diukur |
| Verdict tes bertahan | `bertahan.hasil.verdict` | `"bertahan"` / `"jatuh"` / `"tidak-stabil"`, atau tidak ada bila tes bertahan tidak dijalankan |

Yang TIDAK dipakai sebagai masukan (dengan alasan):

- `hasil.downlinkMbps` (Network Information API) — hanya perkiraan
  browser, bukan hasil ukur; kecepatan unduh yang diukur langsung
  sudah mewakili kecepatan.
- Sinyal dBm / channel / SSID / DNS (input manual) — bukan hasil ukur
  tes, dan boleh kosong; memakainya akan membuat skor bergantung pada
  seberapa rajin pengguna mengisi formulir.
- Sampel per detik mentah — verdict (`nilaiTesBertahan`) sudah
  merangkumnya; memakai verdict menjaga rumus tetap selaras dengan
  yang tampil di layar.

Ambang yang dipakai ulang tanpa diubah (bukan ambang baru):

- Klasifikasi kecepatan (`klasifikasiKecepatan`, sama dengan APK dan
  `api-contracts.md` §4): sangat lambat < 50, lambat < 200,
  cukup < 1.000, cepat < 5.000, sangat cepat ≥ 5.000 KB/detik.
- Verdict tes bertahan (`nilaiTesBertahan`, sama dengan APK v1.0.1):
  `"bertahan"` bila rata-rata ≥ 1.000 KB/detik DAN tidak ada sampel
  di bawah 200 KB/detik setelah detik ke-3; `"jatuh"` bila rata-rata
  5 detik terakhir kurang dari separuh rata-rata 5 detik pertama
  (dan 5 detik pertama ≥ 200); selain itu `"tidak-stabil"`.
- Kategori skor (`lib/skor.ts`, K-31): Baik 80–100, Cukup 50–79,
  Perlu perhatian 0–49 (`SKOR_MIN_BAIK = 80`,
  `SKOR_MIN_CUKUP = 50`). Klasifikasi skor WiFi memakai
  `klasifikasiSkor` yang sama — tidak ada ambang kategori baru.

---

## 2. Rumus

### 2.1 Tiga subskor (masing-masing 0–100)

**Subskor kecepatan — `S_kecepatan`, dari `kecepatanKbps`.**
Interpolasi linear antar titik jangkar yang diambil dari batas
klasifikasi kecepatan (§1):

| Kecepatan (KB/detik) | Subskor |
|---|---|
| 0 | 0 |
| 50 | 20 |
| 200 | 40 |
| 1.000 | 70 |
| 5.000 | 100 |
| ≥ 5.000 | 100 (mentok) |

Di antara dua jangkar, subskor naik lurus (garis lurus). Contoh:
kecepatan 500 KB/detik berada di antara 200 (40) dan 1.000 (70),
jadi subskornya 40 + (500 − 200) × 30 / 800 = **51,25**.

Alasan jangkar: 1.000 KB/detik adalah patokan "wajar" di panduan
WiFi lemot (`copy.md` §5) — pantasnya bernilai 70 (Cukup yang
kuat), bukan 80, karena kecepatan wajar saja belum cukup untuk
kategori Baik tanpa latensi bagus dan kestabilan terbukti.
5.000 KB/detik ("sangat cepat") bernilai penuh 100. Di bawah 200
("lambat" ke bawah) subskor mentok di 40 — kecepatan lambat tidak
boleh menghasilkan subskor kategori Cukup.

**Subskor latensi — `S_latensi`, dari `latensiMs`.**
Interpolasi linear antar titik jangkar:

| Latensi (ms) | Subskor |
|---|---|
| ≤ 50 | 100 |
| 100 | 80 |
| 200 | 60 |
| 500 | 30 |
| ≥ 1.000 | 0 |

Di antara dua jangkar, subskor turun lurus. Contoh: latensi
300 ms berada di antara 200 (60) dan 500 (30), jadi subskornya
60 − (300 − 200) × 30 / 300 = **50**. Latensi `null` bukan 0 —
lihat §4.1 (komponen yang tidak ada datanya dikeluarkan, bukan
dinilai nol).

Alasan jangkar: latensi ≤ 50 ms terasa langsung untuk pemakaian
sehari-hari (nilai penuh); 100 ms masih nyaman (80); 200 ms mulai
terasa lambat saat membuka halaman (60); 500 ms jelas menghambat
(30); 1.000 ms atau lebih praktis tidak bisa dipakai dengan nyaman
(0).

**Subskor kestabilan — `S_stabil`, dari verdict tes bertahan.**

| Verdict | Subskor |
|---|---|
| `bertahan` | 100 |
| `tidak-stabil` | 40 |
| `jatuh` | 10 |

Alasan: `bertahan` berarti kecepatan terbukti bertahan 30 detik
penuh (nilai penuh). `tidak-stabil` bernilai 40, bukan 0 — verdict
ini juga muncul saat kecepatan konstan tapi lambat (rata-rata
< 1.000 KB/detik), yang grafiknya datar, bukan naik-turun
(`WifiPage.tsx`, komentar di `teksVerdict`); kecepatan lambatnya
sudah dihukum lewat subskor kecepatan, jadi kestabilannya tidak
dihukum dua kali sampai nol. `jatuh` bernilai 10 — koneksi yang
mulai cepat lalu runtuh di tengah jalan adalah pola terburuk:
pengguna merasakan awal yang menipu lalu gagal total.

### 2.2 Bobot dan rumus akhir (data lengkap)

| Komponen | Bobot | Alasan |
|---|---|---|
| Kecepatan unduh | 50% | Yang paling dirasakan pengguna sehari-hari (video tersendat, unduhan lambat) dan satu-satunya komponen yang selalu ada datanya. |
| Latensi | 25% | Penting untuk respons halaman dan panggilan, tapi pengguna lebih jarang merasakannya dibanding kecepatan. |
| Kestabilan 30 detik | 25% | Menangkap masalah yang tes singkat tidak bisa tangkap (kecepatan jatuh di tengah jalan). Setara latensi: penting, tapi bukan penentu utama. |

Rumus data lengkap:

```
skor_mentah = 0,50 × S_kecepatan + 0,25 × S_latensi + 0,25 × S_stabil
skor        = batasiSkor(min(skor_mentah, batas_verdict))
```

`batas_verdict` dari §3; `batasiSkor` adalah fungsi yang sudah ada
di `lib/skor.ts` (bulatkan ke bilangan bulat, klem 0–100).
Pembulatan dilakukan TERAKHIR, setelah semua batas diterapkan —
jadi batas 49 tidak pernah terbulatkan menjadi 50.

Rumus ini deterministik: masukan yang sama selalu menghasilkan skor
yang sama, tanpa acak dan tanpa tanggal.

---

## 3. Batas skor dari verdict tes bertahan

Subskor kestabilan saja tidak cukup: koneksi yang cepat tapi jatuh
masih bisa lolos ke kategori Cukup atau Baik hanya karena kecepatan
dan latensinya bagus. Karena itu verdict yang buruk memberi BATAS
ATAS yang keras (berlaku sesudah penjumlahan berbobot, sebelum
pembulatan):

| Verdict | Batas atas skor | Artinya |
|---|---|---|
| `bertahan` | 100 (tidak ada batas) | Kestabilan terbukti; skor penuh diizinkan. |
| `tidak-stabil` | **69** | Paling tinggi Cukup bawah. Koneksi yang tidak stabil tidak boleh mendekati Baik, betapa pun cepatnya. |
| `jatuh` | **49** | Paling tinggi Perlu perhatian. Koneksi yang runtuh di tengah jalan adalah masalah yang harus diperbaiki, bukan kondisi "cukup". |

Alasan angka 69 (bukan 79): 79 adalah batas atas untuk "data tidak
lengkap" (§4) — masalah bukti, bukan masalah kondisi. Koneksi yang
TERBUKTI tidak stabil lebih buruk daripada koneksi yang belum
terbukti stabil, jadi batasnya harus lebih rendah dan berjarak jelas
dari ambang Baik (80). 69 menempatkannya di tengah kategori Cukup,
cukup jauh dari 80 maupun dari 50.

Bila beberapa batas berlaku sekaligus (misalnya verdict `jatuh` dan
latensi `null`), yang dipakai adalah batas TERENDAH.

---

## 4. Edge cases (data tidak lengkap / ekstrem)

Prinsip umum: **komponen yang tidak ada datanya DIKELUARKAN dan
bobot sisanya diskalakan ulang secara proporsional — tidak pernah
dinilai 0 dan tidak pernah dinilai netral 50.** Menilai 0 menghukum
pengguna atas sesuatu yang bukan salahnya (misalnya tes latensi
gagal teknis); menilai 50 memberi nilai gratis untuk sesuatu yang
tidak diukur. Keduanya tidak jujur. Sebagai gantinya, skor dari data
tidak lengkap DIBATASI (§4.3).

### 4.1 Latensi `null`

Latensi tidak berhasil diukur (ketiga percobaan `GET /api/ping`
gagal, atau median tidak tersedia). Komponen latensi dikeluarkan;
bobot kecepatan dan kestabilan diskalakan ulang dari 50:25 menjadi
2:1:

```
skor_mentah = (2 × S_kecepatan + S_stabil) / 3
```

Lalu batas §4.3 dan §3 diterapkan (yang terendah yang menang).

### 4.2 Tanpa data tes bertahan

Pengguna menyimpan laporan tanpa menjalankan tes bertahan 30 detik
(`bertahan.hasil` null, atau sampel < 30). Komponen kestabilan
dikeluarkan; bobot kecepatan dan latensi diskalakan ulang dari
50:25 menjadi 2:1:

```
skor_mentah = (2 × S_kecepatan + S_latensi) / 3
```

Lalu batas §4.3 diterapkan.

### 4.3 Batas atas data tidak lengkap: 79

**Bila komponen apa pun tidak ada datanya (latensi `null`, tanpa
tes bertahan, atau keduanya), skor dibatasi maksimal 79.**

Alasan: 79 adalah nilai tertinggi kategori Cukup — satu poin di
bawah ambang Baik (80). Kategori Baik berarti "kondisi baik, tidak
ada masalah yang perlu segera diperbaiki" (`skor.ts`); klaim
sekuat itu tidak boleh dibuat dari bukti yang tidak lengkap.
Pengguna yang ingin skor Baik harus melengkapi datanya (jalankan
tes bertahan; ulangi tes bila latensi gagal diukur). Batas ini
sengaja SATU ANGKA untuk semua jenis ketidaklengkapan, agar
mudah dijelaskan dan mudah diuji — tidak ada tabel batas berlapis.

Bila HANYA kecepatan yang ada (latensi `null` DAN tanpa tes
bertahan), rumusnya menjadi `skor_mentah = S_kecepatan`, tetap
dengan batas 79.

### 4.4 Kecepatan 0

Kecepatan 0 KB/detik berarti tidak ada data yang berhasil diunduh
(`hitungKecepatanKbps` mengembalikan 0 bila byte atau durasi tidak
valid). Subskor kecepatan = 0 (jangkar pertama §2.1), dan skor
dihitung seperti biasa — tidak ada perlakuan khusus dan tidak ada
skor minimum. Contoh: kecepatan 0 + latensi `null` + verdict
`tidak-stabil` menghasilkan skor 13 (kasus 10, §5). Skor 0 sendiri
hanya terjadi bila semua komponen yang ada datanya bernilai 0.

### 4.5 Nilai tidak valid / negatif

Masukan yang tidak valid diperlakukan seperti komponennya tidak
ada: kecepatan negatif atau bukan angka → perlakukan sebagai 0
(mengikuti `klasifikasiKecepatan` yang mengklem nilai tidak valid
ke 0); latensi negatif atau bukan angka → perlakukan sebagai `null`
(mengikuti `formatLatensi` yang menampilkan "tidak tersedia").
Kecepatan di atas 5.000 mentok di subskor 100 (tidak ada bonus
untuk kecepatan ekstrem). Latensi di atas 1.000 ms mentok di
subskor 0.

### 4.6 Tes bertahan tidak selesai / dibatalkan

Tes bertahan yang dibatalkan pengguna atau gagal (`bertahan.hasil`
null) sama dengan "tanpa data tes bertahan" (§4.2) — bukan verdict
`tidak-stabil`. Sampel sebagian (kurang dari 30) tidak dipakai
untuk verdict maupun skor: `WifiPage.tsx` sudah mensyaratkan
sampel ≥ 30 detik sebelum laporan dianggap tes bertahan
(`simpanLaporan`), dan rumus ini mengikuti syarat yang sama.
Satu-satunya pengecualian: `nilaiTesBertahan([])` mengembalikan
verdict `tidak-stabil` dengan rata-rata 0 — hasil dari daftar
sampel KOSONG ini tidak boleh dipakai sebagai verdict; skor
memakai §4.2 bila `jumlahSampel` adalah 0.

### 4.7 Kecepatan tes singkat vs rata-rata tes bertahan berbeda

Subskor kecepatan memakai hasil tes unduh singkat
(`hasil.kecepatanKbps`), sedangkan verdict memakai rata-rata 30
sampel tes bertahan — dua pengukuran berbeda yang bisa berbeda
hasilnya (misalnya tes singkat 500 KB/detik tapi tes bertahan
rata-rata ≥ 1.000 KB/detik sehingga verdictnya `bertahan`).
Rumus memakai masing-masing angka apa adanya, tanpa koreksi silang:
mengoreksi satu pengukuran dengan pengukuran lain akan menyembunyikan
perbedaan nyata (misalnya jaringan yang membaik di antara dua tes).
Kasus 4 di §5 adalah contoh situasi ini.

---

## 5. Tabel contoh hitungan

Semua angka di bawah dihitung eksak dari rumus §2–§4 (bukan
kira-kira). `S_kec` = subskor kecepatan, `S_lat` = subskor latensi,
`S_stab` = subskor kestabilan. "Tertimbang" adalah hasil rumus
berbobot SEBELUM batas; "Akhir" adalah skor setelah batas dan
pembulatan. Kategori memakai `klasifikasiSkor` (K-31).

| # | Kasus | Kecepatan | Latensi | Verdict | S_kec | S_lat | S_stab | Tertimbang | Batas yang berlaku | Akhir | Kategori |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Cepat + stabil (ideal) | 6.000 KB/dtk | 40 ms | bertahan | 100 | 100 | 100 | 100 | — | **100** | Baik |
| 2 | Cepat + tidak stabil | 6.000 KB/dtk | 40 ms | tidak-stabil | 100 | 100 | 40 | 85 | tidak-stabil → 69 | **69** | Cukup |
| 3 | Cepat + jatuh | 6.000 KB/dtk | 40 ms | jatuh | 100 | 100 | 10 | 77,5 | jatuh → 49 | **49** | Perlu perhatian |
| 4 | Lambat + stabil | 500 KB/dtk | 60 ms | bertahan | 51,25 | 96 | 100 | 74,625 | — | **75** | Cukup |
| 5 | Sangat lambat + tidak stabil | 120 KB/dtk | 80 ms | tidak-stabil | 29,33 | 88 | 40 | 46,67 | tidak-stabil → 69 (tidak mengikat) | **47** | Perlu perhatian |
| 6 | Sangat lambat + latensi tinggi | 80 KB/dtk | 600 ms | tidak-stabil | 24 | 24 | 40 | 28 | tidak-stabil → 69 (tidak mengikat) | **28** | Perlu perhatian |
| 7 | Cepat + latensi tinggi, stabil | 3.000 KB/dtk | 300 ms | bertahan | 85 | 50 | 100 | 80 | — | **80** | Baik |
| 8 | Cepat, tanpa tes bertahan | 6.000 KB/dtk | 40 ms | — (tidak ada) | 100 | 100 | — | 100 | data tidak lengkap → 79 | **79** | Cukup |
| 9 | Sedang, tanpa tes bertahan | 1.200 KB/dtk | 80 ms | — (tidak ada) | 71,5 | 88 | — | 77 | data tidak lengkap → 79 (tidak mengikat) | **77** | Cukup |
| 10 | Kecepatan 0, latensi gagal | 0 KB/dtk | null | tidak-stabil | 0 | — | 40 | 13,33 | data tidak lengkap → 79 dan tidak-stabil → 69 (keduanya tidak mengikat) | **13** | Perlu perhatian |
| 11 | Cepat + stabil, latensi gagal | 2.500 KB/dtk | null | bertahan | 81,25 | — | 100 | 87,5 | data tidak lengkap → 79 | **79** | Cukup |
| 12 | Patokan wajar, stabil (batas Baik) | 1.000 KB/dtk | 100 ms | bertahan | 70 | 80 | 100 | 80 | — | **80** | Baik |

Perhitungan per kasus (jejak audit — tim implementasi dapat memakai
ini sebagai ekspektasi tes):

1. 0,50×100 + 0,25×100 + 0,25×100 = 100 → **100**.
2. 0,50×100 + 0,25×100 + 0,25×40 = 85 → dibatasi 69 → **69**.
3. 0,50×100 + 0,25×100 + 0,25×10 = 77,5 → dibatasi 49 → **49**.
4. S_kec = 40 + (500−200)×30/800 = 51,25; S_lat = 100 − (60−50)×20/50
   = 96. 0,50×51,25 + 0,25×96 + 0,25×100 = 74,625 → **75**.
5. S_kec = 20 + (120−50)×20/150 = 29,33; S_lat = 100 − (80−50)×20/50
   = 88. 0,50×29,33 + 0,25×88 + 0,25×40 = 46,67 → **47**.
6. S_kec = 20 + (80−50)×20/150 = 24; S_lat = 30 − (600−500)×30/500
   = 24. 0,50×24 + 0,25×24 + 0,25×40 = 28 → **28**.
7. S_kec = 70 + (3.000−1.000)×30/4.000 = 85; S_lat =
   60 − (300−200)×30/300 = 50. 0,50×85 + 0,25×50 + 0,25×100 = 80
   → **80**.
8. Tanpa kestabilan: (2×100 + 100)/3 = 100 → dibatasi 79 → **79**.
9. S_kec = 70 + (1.200−1.000)×30/4.000 = 71,5; S_lat = 88.
   (2×71,5 + 88)/3 = 77 → **77**.
10. Latensi null: (2×0 + 40)/3 = 13,33 → **13**.
11. S_kec = 70 + (2.500−1.000)×30/4.000 = 81,25. Latensi null:
    (2×81,25 + 100)/3 = 87,5 → dibatasi 79 → **79**.
12. S_kec = 70; S_lat = 80. 0,50×70 + 0,25×80 + 0,25×100 = 80
    → **80**.

Yang dibuktikan tabel ini:

- Kasus 2 dan 3: batas verdict bekerja — kecepatan sangat cepat
  tidak bisa menyelamatkan koneksi yang tidak stabil atau jatuh.
- Kasus 7 dan 12: ambang Baik (80) TEPAT tercapai oleh kombinasi
  yang masuk akal, bukan hanya oleh koneksi sempurna — rumus
  selaras dengan ambang 80/50, bukan menara gading.
- Kasus 8 dan 11: batas data tidak lengkap bekerja — angka
  tertimbang 100 dan 87,5 sama-sama turun ke 79.
- Kasus 4: kecepatan lambat tapi stabil tetap Cukup (75), bukan
  Perlu perhatian — stabil dan responsif menolong, tapi tidak
  sampai Baik.
- Kasus 10: kegagalan total pengukuran menghasilkan skor rendah
  (13), bukan skor tengah yang menipu dan bukan 0 yang mengklaim
  kepastian mutlak.

---

## 6. Teks ringkasan (disimpan bersama skor)

Aturan bahasa mengikuti `docs/copy.md`: bahasa sehari-hari yang
gampang dicerna semua orang, tanpa istilah teknis, tanpa angka yang
tidak perlu, jujur soal batasan. Satu pengecualian yang dipertahankan
dari `copy.md` §15: latensi tetap disebut "latensi HTTP", bukan
"ping". Di kalimat ringkasan, istilah itu dihindari sama sekali
dengan memakai "waktu tunggu".

### 6.1 Kalimat wajib (selalu disimpan dan selalu tampil bersama skor)

> "Skor ini hanya dari tes WiFi. Bukan skor kesehatan HP secara
> keseluruhan."

Kalimat ini TIDAK BOLEH dihilangkan di tempat mana pun skor WiFi
tampil (dasbor, riwayat, detail laporan). Bila ruang tampil sangat
sempit (badge kecil), kalimat boleh disingkat menjadi "Skor WiFi
saja" — dengan kalimat lengkap tetap tampil di dekatnya (misalnya
di bawah badge atau di detail laporan).

### 6.2 Kalimat penjelas per keadaan (ditambahkan setelah kalimat wajib)

| Keadaan | Kalimat tambahan |
|---|---|
| Data lengkap (kecepatan + latensi + tes bertahan) | "Dihitung dari kecepatan, waktu tunggu, dan kestabilan selama 30 detik." |
| Tanpa tes bertahan | "Dihitung dari kecepatan dan waktu tunggu saja, tanpa tes bertahan 30 detik. Nilainya dibatasi sampai 79 karena kestabilan belum diukur." |
| Latensi tidak berhasil diukur | "Dihitung tanpa waktu tunggu karena waktu tunggu tidak berhasil diukur. Nilainya dibatasi sampai 79." |
| Latensi tidak berhasil diukur DAN tanpa tes bertahan | "Dihitung dari kecepatan saja. Waktu tunggu tidak berhasil diukur dan tes bertahan 30 detik tidak dijalankan. Nilainya dibatasi sampai 79." |
| Verdict jatuh (tambahan, di belakang kalimat keadaan) | "Kecepatan jatuh di tengah jalan, jadi nilainya dibatasi sampai 49." |
| Verdict tidak stabil (tambahan, di belakang kalimat keadaan) | "Kecepatan tidak stabil selama 30 detik, jadi nilainya dibatasi sampai 69." |

Contoh teks ringkasan lengkap yang disimpan (kasus 3 — cepat tapi
jatuh): "Skor ini hanya dari tes WiFi. Bukan skor kesehatan HP
secara keseluruhan. Dihitung dari kecepatan, waktu tunggu, dan
kestabilan selama 30 detik. Kecepatan jatuh di tengah jalan, jadi
nilainya dibatasi sampai 49."

Contoh (kasus 8 — cepat, tanpa tes bertahan): "Skor ini hanya dari
tes WiFi. Bukan skor kesehatan HP secara keseluruhan. Dihitung dari
kecepatan dan waktu tunggu saja, tanpa tes bertahan 30 detik.
Nilainya dibatasi sampai 79 karena kestabilan belum diukur."

Catatan: angka 79, 69, dan 49 di kalimat di atas adalah batas yang
benar-benar diterapkan rumus — bukan angka contoh. Bila suatu saat
batas berubah, kalimat ini wajib diubah bersamaan.

### 6.3 Label komponen (bila dasbor menampilkan rincian per komponen)

| Komponen | Label tampil | Nilai tampil |
|---|---|---|
| Kecepatan unduh | "Kecepatan unduh" | Angka hasil ukur (misalnya "1,2 MB/detik") + subskornya bila ditampilkan |
| Latensi | "Latensi HTTP" | Angka hasil ukur (misalnya "40 ms"), atau "tidak tersedia" bila `null` |
| Kestabilan | "Kestabilan 30 detik" | Label verdict: "Bertahan" / "Jatuh" / "Tidak stabil" (`WifiPage.tsx`), atau "Belum diukur" bila tes bertahan tidak dijalankan |

Kata "Belum diukur" (bukan "tidak tersedia") untuk tes bertahan yang
tidak dijalankan: tesnya memang belum dilakukan pengguna, bukan
gagal dibaca browser.

### 6.4 Teks pembaca layar (aria)

Ringkasan skor untuk pembaca layar mengikuti pola `ringkasanSkor`
di `lib/skor.ts`, ditambah penanda WiFi:

> "Skor WiFi [skor] dari 100, kategori [label]. Skor ini hanya dari
> tes WiFi."

Contoh: "Skor WiFi 69 dari 100, kategori Cukup. Skor ini hanya dari
tes WiFi."

---

## 7. Catatan integrasi (untuk tim implementasi, bukan bagian rumus)

1. **Kontrak API belum punya tempat untuk skor WiFi.**
   `docs/api-contracts.md` §4 (objek laporan WiFi) saat ini tidak
   punya field skor. Sebelum implementasi, kontrak perlu diamandemen:
   tambahkan field skor + ringkasan ke laporan WiFi, ATAU simpan
   skor sebagai health check dengan `ringkasan` yang hanya berisi
   komponen `wifi` (§3 kontrak). Keputusan ini di luar dokumen
   desain ini — yang dirancang di sini hanya rumus dan teksnya.
   Apa pun pilihannya, skor dihitung FRONTEND (mengikuti pola §3
   kontrak: server menyimpan hasil hitungan, tidak menghitung
   ulang) agar angka yang tampil di layar sama persis dengan yang
   tersimpan.
2. **Kategori dan warna memakai yang sudah ada.** Klasifikasi memakai
   `klasifikasiSkor` dan warna memakai `warnaKategori` dari
   `lib/skor.ts` — tidak ada kategori, label, atau warna baru.
   Catatan: label kategori di `skor.ts` ("Cukup", "Perlu
   perhatian") berbeda kata dengan tabel dasbor di `copy.md` §4
   ("Perlu diperhatikan", "Bermasalah"). Dokumen ini memakai label
   `skor.ts` (kanonis K-31); perbedaan itu perlu dibereskan di
   tempatnya, bukan oleh rumus skor WiFi.
3. **Tes yang wajib ada.** Implementasi wajib menyertakan tes unit
   untuk ke-12 kasus di §5 (ekspektasi angka eksak tercantum di
   sana), ditambah tes batas: skor tidak pernah melebihi 79 bila
   data tidak lengkap, tidak pernah melebihi 69 bila verdict
   tidak-stabil, tidak pernah melebihi 49 bila verdict jatuh,
   dan deterministik (masukan sama → skor sama).
4. **Tidak ada perubahan pada tes atau verdict.** Rumus ini hanya
   MEMBACA hasil tes yang sudah ada. Ambang klasifikasi kecepatan,
   logika `nilaiTesBertahan`, dan alur simpan di `WifiPage.tsx`
   tidak berubah.
