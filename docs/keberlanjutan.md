# Keberlanjutan & Biaya: Dokter HP Web App

> **Rencana menjaga aplikasi tetap gratis selamanya.**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen, 17 November 2026.
>
> Prinsip yang mengikat dokumen ini: **budget nol rupiah permanen,
> tanpa kartu kredit, tanpa trial berbayar, tanpa upgrade berbayar
> tanpa persetujuan owner.** Semua angka pemakaian di dokumen ini
> dihitung dari asumsi yang dinyatakan jelas di bagian 2, dengan
> rumus yang ditampilkan. Angka yang belum terverifikasi dilabeli
> demikian dan tidak dipakai sebagai dasar keputusan.
>
> Dokumen terkait: `PRODUCT.md`, `ARCHITECTURE.md`,
> `docs/keputusan-stack.md`.

---

## 1. Limit free tier yang dipakai

| Layanan | Limit | Reset / akibat bila habis | Sumber |
|---|---|---|---|
| Workers (permintaan) | 100.000 permintaan/hari | Reset harian; permintaan ditolak sampai reset | Angka koordinator |
| D1 — baris dibaca | 5.000.000 baris/hari | Reset 00:00 UTC; query error sampai reset | Terverifikasi 17 Nov 2026 |
| D1 — baris ditulis | 100.000 baris/hari | Reset 00:00 UTC; query error sampai reset | Terverifikasi 17 Nov 2026 |
| D1 — penyimpanan | 500 MB per database; 5 GB total akun; 10 database | Tulis gagal bila penuh; tidak ada penambahan otomatis | Terverifikasi 17 Nov 2026 |
| KV — baca | 100.000 baca/hari | Reset harian | Angka koordinator |
| KV — tulis | 1.000 tulis/hari | Reset harian | Terverifikasi 17 Nov 2026 |
| Pages (statis) | Permintaan statis gratis tanpa batas | — | Terverifikasi 17 Nov 2026 |
| Vercel Hobby — bandwidth | 100 GB/bulan | Situs berhenti melayani sampai siklus berikutnya; tanpa tagihan | Dokumentasi pihak ketiga, Okt 2026 (lihat bagian 8) |
| Vercel Hobby — permintaan CDN | 1.000.000/bulan | Sama seperti di atas | Dokumentasi pihak ketiga, Okt 2026 (lihat bagian 8) |
| Gemini API — free tier | **Belum terverifikasi untuk proyek ini** (lihat bagian 1.1) | HTTP 429; pemakaian berlebih berulang berisiko pencabutan kunci (klaim pihak ketiga) | Wajib dibaca di AI Studio |

### 1.1 Catatan khusus Gemini

Limit free tier Gemini **tidak lagi dicantumkan Google di dokumentasi
publik** — angka aktif hanya tampil di halaman rate limit Google AI
Studio untuk proyek masing-masing, berlaku per proyek (bukan per
kunci), dan dinyatakan tidak dijamin. Pembacaan pihak ketiga pada
Oktober 2026 saling bertentangan (20, 250, dan 1.500 permintaan/hari
untuk model Flash, dari sumber berbeda). Karena itu dokumen ini
**tidak memakai satu angka Gemini pun sebagai fakta**. Bagian 3.4
menghitung pemakaian AI dalam permintaan/hari, lalu mengujinya
terhadap ketiga pembacaan tersebut sebagai analisis sensitivitas.
**Sebelum rilis, tim wajib membaca angka aktif proyek ini di AI
Studio dan mencatatnya di sini.**

### 1.2 Tanpa kartu kredit berarti tanpa tagihan kejutan

Tidak ada kartu kredit yang didaftarkan di layanan mana pun. Bila
kuota habis, yang terjadi adalah layanan berhenti atau mengembalikan
galat sampai reset — bukan tagihan. Ini adalah pengaman terakhir
yang disengaja dan tidak boleh diubah (lihat bagian 6).

---

## 2. Model pemakaian — asumsi yang dinyatakan

Semua perhitungan memakai asumsi berikut. Bila data pemakaian nyata
nanti berbeda, angka di bagian 3 wajib dihitung ulang dari asumsi
yang diperbarui — bukan dari angka lama.

| Kode | Asumsi | Nilai |
|---|---|---|
| A1 | Pengguna aktif harian (DAU) = pengguna yang masuk. Pengunjung anonim dihitung terpisah dengan rasio 1 anonim per 1 pengguna masuk | 1 : 1 |
| A2 | Permintaan Worker per pengguna masuk per hari: `/api/auth/me` 1×, `GET /api/health-checks` 2×, `GET /api/wifi-reports` 1×, `POST /api/health-checks` 1×, `POST /api/wifi-reports` 1×, `POST .../samples` 0,3×, `POST /api/ai/diagnose` 0,5×, `GET /api/ai/diagnoses` 0,5×, profil 0,2×, lain-lain 0,2×, `/api/ping` 3× | 11 permintaan |
| A3 | Permintaan Worker per pengunjung anonim per hari: 1 tes WiFi tanpa akun = `/api/ping` 3× | 3 permintaan |
| A4 | Baris D1 dibaca per pengguna masuk per hari: cek sesi 11 baris + daftar riwayat (≤20 baris per daftar) + konteks AI 2 baris + detail laporan ±9 baris | ±100 baris |
| A5 | Baris D1 ditulis per pengguna masuk per hari: 1 `health_checks` + 1 `wifi_reports` + 9 sampel (0,3 tes bertahan × 30 sampel) + 0,5 `ai_diagnoses` + 0,1 sesi + 0,5 penghitung rate limit | ±12 baris |
| A6 | Ukuran baris baru: `health_checks` ±1 KB (JSON ringkasan), `wifi_reports` ±0,5 KB, 1 sampel ±0,1 KB, `ai_diagnoses` ±2 KB, sesi ±0,3 KB | ±3,5 KB per DAU per hari |
| A7 | Bandwidth per DAU per hari: aset halaman 300 KB (kunjungan pertama; kunjungan ulang dari cache browser) + file tes 1 MB + tes bertahan 0,3 × 30 × 256 KB = 2,25 MB | ±3,55 MB |
| A8 | Pembagian lalu lintas statis: Pages 90%, Vercel (mirror cadangan) 10% | 90 / 10 |
| A9 | 1 bulan = 30 hari; 1 MB = 1.024 KB; 500 MB = 512.000 KB | — |
| A10 | Pertanyaan AI per DAU per hari | 0,5 |

Catatan atas asumsi:

- A2 memakai angka 0,5 pertanyaan AI per pengguna per hari — jauh
  di bawah batas server 20/hari per pengguna (`ARCHITECTURE.md`
  bagian 6.1). Batas 20/hari adalah batas anti-penyalahgunaan,
  bukan target pemakaian. Bila kuota Gemini proyek ternyata ketat,
  batas ini wajib diturunkan (lihat bagian 4.1).
- A7 memakai ukuran potongan tes bertahan 256 KB — angka ini adalah
  asumsi yang wajib dikonfirmasi tim implementasi, karena ukuran
  potongan tidak ditetapkan di `ARCHITECTURE.md`.
- A4 dan A6 adalah perkiraan ukuran; tim wajib mengukur nilai nyata
  dari log dan dashboard setelah rilis pertama, lalu memperbarui
  dokumen ini.

Rumus umum yang dipakai di seluruh bagian 3:

```
Konsumsi harian  = DAU × konsumsi per DAU per hari
Persentase kuota = konsumsi harian ÷ limit harian × 100%
DAU maksimum     = limit harian ÷ konsumsi per DAU per hari
Sisa hari simpan = 512.000 KB ÷ (DAU × 3,5 KB/hari)
```

---
## 3. Perhitungan per skenario

### 3.1 Workers — permintaan API

Konsumsi per DAU per hari = 11 (pengguna masuk, A2) + 3 (anonim, A3)
= **14 permintaan**.

| Skenario | Rumus | Hasil/hari | % dari 100.000 | DAU maksimum |
|---|---|---|---|---|
| 10 DAU | 10 × 14 | 140 | 0,14% | 100.000 ÷ 14 ≈ **7.140 DAU** |
| 100 DAU | 100 × 14 | 1.400 | 1,4% | |
| 1.000 DAU | 1.000 × 14 | 14.000 | 14% | |

Penilaian: Workers aman di ketiga skenario. Risiko utama bukan
pemakaian normal, melainkan penyalahgunaan endpoint `/api/ping` (tanpa
batas ketat, tanpa D1) oleh bot — satu alamat IP yang memanggil
`/api/ping` tanpa henti dapat menghabiskan kuota bersama. Mitigasi di
bagian 4.4.

### 3.2 D1 — baris dibaca

Konsumsi per DAU per hari = **100 baris** (A4).

| Skenario | Rumus | Hasil/hari | % dari 5.000.000 | DAU maksimum |
|---|---|---|---|---|
| 10 DAU | 10 × 100 | 1.000 | 0,02% | 5.000.000 ÷ 100 = **50.000 DAU** |
| 100 DAU | 100 × 100 | 10.000 | 0,2% | |
| 1.000 DAU | 1.000 × 100 | 100.000 | 2% | |

Penilaian: baris baca adalah limit paling longgar. Tetap dijaga
dengan query berindeks dan ber-`LIMIT` (sudah diwajibkan
`ARCHITECTURE.md` bagian 6.3) agar satu query nakal tidak membaca
ribuan baris.

### 3.3 D1 — baris ditulis

Konsumsi per DAU per hari = **12 baris** (A5). Penyumbang terbesar
adalah sampel tes bertahan: 9 dari 12 baris (75%).

| Skenario | Rumus | Hasil/hari | % dari 100.000 | DAU maksimum |
|---|---|---|---|---|
| 10 DAU | 10 × 12 | 120 | 0,12% | 100.000 ÷ 12 ≈ **8.330 DAU** |
| 100 DAU | 100 × 12 | 1.200 | 1,2% | |
| 1.000 DAU | 1.000 × 12 | 12.000 | 12% | |

Penilaian: aman di ketiga skenario, tetapi paling ketat kedua
setelah Gemini dan penyimpanan. Mitigasi terbesar: simpan 30 sampel
tes bertahan sebagai **satu JSON dalam satu baris** (bukan 30 baris
terpisah). Rumus setelah mitigasi: 12 − 9 + 0,3 = **3,3 baris per
DAU per hari**, sehingga DAU maksimum naik menjadi
100.000 ÷ 3,3 ≈ **30.300 DAU**.

### 3.4 Gemini — permintaan AI

Konsumsi per DAU per hari = **0,5 permintaan** (A10).

| Skenario | Rumus | Hasil/hari | vs 20/hari* | vs 250/hari* | vs 1.500/hari* |
|---|---|---|---|---|---|
| 10 DAU | 10 × 0,5 | 5 | 25% | 2% | 0,3% |
| 100 DAU | 100 × 0,5 | 50 | **250% — habis** | 20% | 3,3% |
| 1.000 DAU | 1.000 × 0,5 | 500 | **2.500% — habis** | **200% — habis** | 33% |

\* Ketiga kolom pembanding adalah pembacaan pihak ketiga yang
bertentangan (Oktober 2026), **bukan angka terverifikasi proyek
ini**. Angka aktif wajib dibaca di AI Studio sebelum rilis.

Penilaian: **Gemini adalah limit pertama yang habis** di skenario
100 dan 1.000 DAU pada dua dari tiga pembacaan. DAU maksimum
tergantung angka aktif proyek: 20 ÷ 0,5 = **40 DAU** bila kuota
20/hari; 250 ÷ 0,5 = **500 DAU** bila kuota 250/hari; 1.500 ÷ 0,5 =
**3.000 DAU** bila kuota 1.500/hari. Selain batas harian, ada batas
per menit (pembacaan pihak ketiga: 10–15 permintaan/menit) — 10
pengguna yang bertanya AI dalam satu menit yang sama sudah dapat
memicu 429. Mitigasi di bagian 4.1.

### 3.5 D1 — penyimpanan

Pertumbuhan per DAU per hari = **3,5 KB** (A6). Kapasitas database
500 MB = 512.000 KB.

| Skenario | Rumus | Pertumbuhan/hari | Sisa hari sampai penuh | |
|---|---|---|---|---|
| 10 DAU | 10 × 3,5 KB | 35 KB | 512.000 ÷ 35 ≈ 14.600 hari | ±40 tahun |
| 100 DAU | 100 × 3,5 KB | 350 KB | 512.000 ÷ 350 ≈ 1.460 hari | ±4,0 tahun |
| 1.000 DAU | 1.000 × 3,5 KB | 3.500 KB (3,5 MB) | 512.000 ÷ 3.500 ≈ 146 hari | **±4,8 bulan** |

Penilaian: **penyimpanan D1 adalah limit kedua yang habis** — pada
1.000 DAU, database penuh dalam waktu kurang dari 5 bulan bila data
tidak pernah dibersihkan. Berbeda dengan kuota harian yang reset,
penyimpanan hanya tumbuh; tanpa kebijakan retensi, proyek pasti
menabrak batas ini. Mitigasi di bagian 4.2.

### 3.6 KV — baca dan tulis

KV hanya dipakai untuk data yang jarang berubah (konfigurasi statis),
dibaca sekali lalu disimpan di memori Worker. Konsumsi per DAU:
**0 baca, 0 tulis**.

| Skenario | Baca/hari | % dari 100.000 | Tulis/hari | % dari 1.000 |
|---|---|---|---|---|
| 10 / 100 / 1.000 DAU | 0 | 0% | 0 | 0% |

Penilaian: KV aman karena nyaris tidak dipakai — dan harus tetap
demikian. KV tulis 1.000/hari adalah **batas jebakan**: bila sesi
atau rate limit disimpan di KV (11 tulis per DAU per hari), kuota
habis pada 1.000 ÷ 11 ≈ **90 DAU**. Larangan memakai KV untuk sesi
(`docs/keputusan-stack.md` bagian 3.4) wajib dipertahankan.

### 3.7 Pages dan Vercel — bandwidth dan permintaan statis

Konsumsi bandwidth per DAU per hari = **3,55 MB** (A7). Konsumsi
per DAU per bulan = 3,55 MB × 30 = **106,5 MB**. Pembagian lalu
lintas 90% Pages / 10% Vercel (A8). Pages: permintaan statis tanpa
batas, sehingga tidak dihitung persentasenya.

| Skenario | Total/bulan | Vercel (10%) | % dari 100 GB Vercel | Vercel bila 100% lalu lintas |
|---|---|---|---|---|
| 10 DAU | 10 × 106,5 MB ≈ 1,1 GB | ±0,11 GB | 0,1% | ±1,1 GB (1,1%) |
| 100 DAU | 100 × 106,5 MB ≈ 10,7 GB | ±1,1 GB | 1,1% | ±10,7 GB (10,7%) |
| 1.000 DAU | 1.000 × 106,5 MB ≈ 106,5 GB | ±10,7 GB | 10,7% | **±106,5 GB (106,5%) — habis** |

Penilaian: dengan pembagian 90/10, Vercel aman di ketiga skenario.
Tetapi **bila Pages down dan seluruh lalu lintas pindah ke Vercel**,
mirror saja tidak cukup pada 1.000 DAU: batas failover penuh adalah
100 GB ÷ 106,5 MB ≈ **939 DAU**. Di atas angka itu, failover penuh
ke Vercel menghabiskan bandwidth sebelum bulan berakhir. Mitigasi di
bagian 4.5.

Permintaan CDN Vercel (1.000.000/bulan): per DAU per hari ±15
permintaan (5 muat halaman + 1 unduh tes + 9 potongan tes bertahan),
atau ±450/bulan. Pada 1.000 DAU dengan pembagian 10%: 45.000/bulan
(4,5%). Bila 100% lalu lintas ke Vercel: 450.000/bulan (45%). Aman
di ketiga skenario.

### 3.8 Ringkasan tiga skenario

| Layanan (limit) | 10 DAU | 100 DAU | 1.000 DAU |
|---|---|---|---|
| Workers (100 rb/hari) | 0,14% | 1,4% | 14% |
| D1 baca (5 jt/hari) | 0,02% | 0,2% | 2% |
| D1 tulis (100 rb/hari) | 0,12% | 1,2% | 12% |
| D1 simpan (500 MB) | ±40 tahun | ±4,0 tahun | **±4,8 bulan** |
| KV tulis (1 rb/hari) | 0% | 0% | 0% |
| Gemini (belum terverifikasi) | 5/hari | 50/hari | 500/hari |
| Vercel bandwidth (100 GB/bln, 10% lalu lintas) | 0,1% | 1,1% | 10,7% |
| **Limit kritis** | — | **Gemini** (pada kuota 20/hari) | **Gemini, lalu D1 simpan** |

---
## 4. Limit yang habis duluan dan mitigasi

### 4.1 Gemini — limit pertama (skenario 100 dan 1.000 DAU)

Urutan mitigasi, dari yang paling mudah ke yang paling berat:

1. **Turunkan batas per pengguna.** Batas server 20 pertanyaan/hari
   per pengguna (`ARCHITECTURE.md` bagian 6.1) diturunkan menjadi
   3/hari bila kuota proyek ketat. Rumus: 3 pertanyaan × 100 DAU =
   300/hari maksimum absolut — masih di atas kuota 250/hari, jadi
   batas per pengguna saja tidak cukup; wajib digabung mitigasi 2–4.
2. **Antrean dan throttle server-side.** Worker membatasi panggilan
   Gemini menjadi maksimal 1 per 6 detik (10/menit) agar tidak
   memicu batas per menit; permintaan berlebih masuk antrean singkat
   atau ditolak dengan pesan jujur.
3. **Cache jawaban.** Pertanyaan yang sama dari pengguna yang sama
   (teks identik setelah normalisasi) dijawab dari `ai_diagnoses`
   tanpa panggilan baru. Penghematan bergantung pada pola pertanyaan
   nyata dan diukur setelah rilis.
4. **Rotasi model.** Kuota berlaku per model — bila satu model habis,
   Worker beralih ke model Flash lain yang masih punya kuota pada
   proyek yang sama (daftar model fallback diputuskan tim dan dicatat
   di sini setelah verifikasi).
5. **Nonaktifkan sementara dengan pesan jujur.** Bila kuota hari itu
   habis, fitur AI menampilkan "Diagnosis AI sudah mencapai batas
   hari ini, coba lagi besok" — tanpa jawaban karangan dan tanpa
   percobaan ulang yang membakar kuota.
6. **Proyek Google Cloud kedua.** Kuota berlaku per proyek; proyek
   kedua milik owner memberi jatah baru. Hanya bila mitigasi 1–5
   tidak cukup, dan kunci proyek kedua disimpan sebagai secret
   Worker yang sama amannya.

### 4.2 D1 penyimpanan — limit kedua (1.000 DAU: ±4,8 bulan)

Kebijakan retensi (wajib diterapkan sebelum rilis, bukan setelah
database penuh):

1. **Hapus permanen baris soft-deleted** yang `deleted_at`-nya lebih
   dari 30 hari. Pekerjaan terjadwal mingguan (Worker Cron Trigger —
   gratis, dihitung dalam kuota Workers yang sama).
2. **Hapus sampel tes bertahan** yang lebih dari 90 hari. Grafik
   detail per detik hanya berguna untuk pemeriksaan terbaru;
   laporan induk (`wifi_reports`) tetap tersimpan.
3. **Batasi riwayat per pengguna.** Bila satu pengguna melewati 200
   laporan WiFi atau 200 pemeriksaan, laporan tertua dihapus setelah
   pemberitahuan di aplikasi. Angka 200 adalah batas awal yang dapat
   ditinjau dari data nyata.
4. **Gabungkan sampel menjadi JSON** (lihat bagian 3.3): menghemat
   baris tulis sekaligus overhead penyimpanan per baris.
5. **Jangan simpan data yang tidak ditampilkan.** Setiap kolom baru
   wajib punya layar yang menampilkannya; tanpa itu, kolom tidak
   dibuat.

Efek gabungan mitigasi 1–3 tidak dapat dihitung pasti sebelum ada
data nyata (bergantung pada seberapa sering pengguna menghapus dan
seberapa tua data yang dihapus). Yang pasti: tanpa retensi, batas
500 MB tercapai pada ±146 hari di 1.000 DAU; dengan retensi,
pertumbuhan bersih menjadi jauh lebih lambat dan wajib diukur
bulanan (lihat bagian 5).

### 4.3 D1 tulis — jaga di bawah 12%

1. Gabungkan sampel tes bertahan menjadi satu JSON (bagian 3.3):
   12 → 3,3 baris per DAU per hari.
2. Rate limit berbasis D1 hanya untuk endpoint AI; endpoint lain
   memakai batas di memori Worker atau fitur platform bila tersedia
   gratis — bukan satu baris tulis per permintaan.
3. Jangan menulis sesi baru pada setiap permintaan; sesi dibuat
   sekali saat masuk (kedaluwarsa 30 hari) dan tidak diperpanjang
   per permintaan.

### 4.4 Workers — lindungi dari penyalahgunaan

1. Rate limit `/api/ping` per alamat IP: maksimal 1 tes (3 panggilan)
   per menit per IP. Tes kecepatan yang sah tidak pernah memanggil
   `/api/ping` lebih cepat dari itu.
2. Cache di client: `/api/auth/me` dan data dashboard disimpan di store
   Zustand dan tidak diambil ulang pada setiap pindah layar.
3. Satu endpoint gabungan untuk dashboard (profil + skor terakhir +
   3 pemeriksaan terakhir) menggantikan 3–4 panggilan terpisah,
   bila pengukuran menunjukkan dashboard mendominasi permintaan.
4. Respons galat 429 memakai pesan bahasa sehari-hari dan header
   `Retry-After` agar client tidak mencoba ulang tanpa henti.

### 4.5 Vercel — jaga mirror tetap cadangan

1. Pages tetap utama; Vercel hanya menerima lalu lintas bila Pages
   bermasalah (pembagian 90/10 pada A8 adalah batas atas, bukan
   target — target operasional adalah sedekat mungkin ke 100/0).
2. Kurangi ukuran potongan tes bertahan (256 KB → 128 KB) bila
   bandwidth menipis; rumus: total per DAU turun dari 3,55 MB
   menjadi 2,43 MB per hari, sehingga batas failover penuh naik
   dari ±939 DAU menjadi ±1.370 DAU.
3. `Cache-Control` panjang untuk aset statis (JS/CSS) agar kunjungan
   ulang tidak mengunduh ulang.
4. Bila Vercel mencapai 80% bandwidth bulanan, umumkan di landing
   bahwa mirror sedang dibatasi dan arahkan pengguna ke Pages.

### 4.6 KV — jangan pernah jadi jalur tulis

Tidak ada mitigasi yang diperlukan selama KV tidak dipakai untuk
sesi atau rate limit. Aturan: **setiap usulan memakai KV untuk data
yang ditulis per permintaan wajib ditolak** — tulis KV 1.000/hari
habis pada ±90 DAU (bagian 3.6).

---

## 5. Pemantauan biaya

### 5.1 Cara memeriksa pemakaian tiap layanan

| Layanan | Cara memeriksa | Yang dibaca |
|---|---|---|
| Workers | Dashboard Cloudflare → Workers & Pages → metrik permintaan; `wrangler tail` untuk galat | Permintaan/hari, galat 5xx, endpoint tersering |
| D1 | Dashboard Cloudflare → D1 → metrik; `wrangler d1 info` | Baris dibaca/ditulis per hari, ukuran database |
| KV | Dashboard Cloudflare → KV → metrik | Baca/tulis per hari (harus mendekati 0) |
| Pages | Dashboard Cloudflare → Pages → metrik | Permintaan statis, bandwidth |
| Vercel | Dashboard Vercel → Usage | Bandwidth/bulan, permintaan CDN/bulan |
| Gemini | Google AI Studio → halaman rate limit proyek; hitung `SELECT COUNT(*) FROM ai_diagnoses WHERE dibuat_pada >= hari ini` di D1; pantau 429 di log Worker | Permintaan/hari vs kuota proyek, galat 429 |

### 5.2 Ambang alert

| Ambang | Arti | Tindakan |
|---|---|---|
| 70% kuota harian/bulanan | Peringatan | Tinjau penyebab; siapkan mitigasi bagian 4 |
| 90% kuota harian/bulanan | Kritis | Aktifkan pembatasan fitur berat (AI, tes bertahan) sampai reset |
| 100% | Habis | Layanan menampilkan pesan jujur; tidak ada percobaan bayar; catat kejadian untuk laporan |
| D1 300 MB (60%) | Peringatan simpan | Jalankan retensi bagian 4.2 lebih awal |
| D1 400 MB (80%) | Kritis simpan | Retensi darurat: hapus sampel >30 hari, hapus soft-deleted >7 hari |
| D1 450 MB (90%) | Darurat simpan | Hentikan tulis non-esensial (sampel tes bertahan tidak disimpan) sampai ruang tersedia |

### 5.3 Jadwal pemeriksaan

- **Harian** (selama 30 hari pertama setelah rilis): cek Workers,
  D1, dan Gemini — tiga layanan yang paling mungkin habis.
- **Mingguan** (setelah stabil): cek semua layanan; bandingkan
  dengan asumsi bagian 2 dan perbarui dokumen ini bila menyimpang
  lebih dari 2×.
- **Bulanan**: cek bandwidth Vercel dan ukuran D1; jalankan retensi
  terjadwal; tulis ringkasan satu paragraf ke changelog dokumen ini.
- **Pemeriksaan tidak memakai layanan pemantauan berbayar.**
  Dashboard penyedia + query D1 + log Worker sudah cukup.

---

## 6. Larangan keras

1. **Tidak ada upgrade berbayar tanpa persetujuan eksplisit owner.**
   Persetujuan harus menyebut layanan dan biayanya; persetujuan
   umum ("lanjutkan saja") tidak cukup.
2. **Tidak ada kartu kredit yang didaftarkan** di akun Cloudflare,
   Vercel, Google Cloud, atau layanan lain yang dipakai proyek ini.
   Tanpa kartu, tidak ada tagihan kejutan (bagian 1.2).
3. **Tidak ada trial berbayar** yang berubah menjadi langganan
   otomatis.
4. **Tidak ada layanan baru berbayar** yang ditambahkan diam-diam —
   setiap layanan baru wajib dicatat di dokumen ini beserta
   limit gratisnya sebelum dipakai.
5. **Vercel Hobby hanya untuk pemakaian non-komersial** (syarat
   layanan Vercel). Proyek ini adalah proyek pribadi non-komersial;
   bila suatu hari proyek menjadi komersial, mirror Vercel wajib
   dipindahkan atau dihentikan — bukan dinaikkan ke Pro tanpa
   persetujuan owner.
6. **Tidak ada secret di dokumen ini atau di repo.** Kunci Gemini,
   client secret Google OAuth, dan token lain hanya sebagai secret
   Worker.

---

## 7. Rencana bila proyek tumbuh melewati free tier

Urutan wajib — jangan melompat ke langkah berikutnya sebelum langkah
sebelumnya dijalankan dan diukur:

### Langkah 1 — Optimasi dulu (tanpa biaya, tanpa akun baru)

Semua mitigasi bagian 4. Dampak terbesar yang terhitung: gabung
sampel JSON menaikkan kapasitas tulis D1 dari ±8.330 menjadi
±30.300 DAU; throttle + cache AI menekan pemakaian Gemini;
retensi menunda batas penyimpanan D1. Optimasi adalah jawaban
pertama untuk setiap limit.

### Langkah 2 — Retensi dan arsip

Perketat retensi (sampel 90 → 30 hari, riwayat 200 → 100 laporan
per pengguna) dan evaluasi penyimpanan arsip gratis untuk data lama
yang jarang dibaca. **Angka limit layanan arsip apa pun wajib
diverifikasi dari dokumentasi resmi sebelum dipakai** — dokumen ini
tidak mencantumkan angka arsip karena belum ada yang terverifikasi.

### Langkah 3 — Sharding akun (tanpa biaya)

Bila optimasi dan retensi sudah maksimal dan satu limit masih
habis:

- **D1 kedua** di akun Cloudflare kedua milik owner (limit berlaku
  per akun). Data dipisah berdasarkan aturan yang jelas (misalnya
  pengguna baru ke database kedua) dan dicatat di `ARCHITECTURE.md`.
- **Proyek Google Cloud kedua** untuk Gemini (kuota berlaku per
  proyek).
- **Syarat:** setiap akun baru milik owner, tanpa kartu kredit,
  dan **syarat layanan penyedia wajib dibaca sebelum sharding
  dijalankan** — sharding tidak boleh dipakai dengan cara yang
  melanggar ketentuan penyedia. Bila ketentuan melarang, langkah
  ini dibatalkan dan proyek kembali ke langkah 1–2 atau ke
  langkah 4.

### Langkah 4 — Laporkan ke owner, jangan bayar diam-diam

Bila semua opsi tanpa biaya sudah habis dan proyek masih tumbuh,
koordinator melaporkan kepada owner dengan angka nyata: DAU saat
ini, limit yang habis, berapa DAU yang didukung tiap opsi, dan
biaya opsi berbayar yang tersedia. **Keputusan upgrade adalah milik
owner.** Tanpa persetujuan eksplisit, proyek tetap gratis dengan
fitur berat dibatasi (AI dibatasi, tes bertahan dibatasi, riwayat
diperketat) — bukan dengan membayar.

### Yang bukan rencana

- Membayar lalu meminta persetujuan belakangan.
- Mendaftarkan kartu "untuk jaga-jaga".
- Memakai akun orang lain untuk menambah kuota.
- Mengurangi kejujuran data (angka contoh, jawaban AI karangan)
  demi menghemat kuota.

---

## 8. Sumber dan status verifikasi

| Angka | Status | Sumber |
|---|---|---|
| Workers 100.000 permintaan/hari | Diberikan koordinator | Penugasan tim |
| D1 5 jt baca / 100 rb tulis / 500 MB per DB / 5 GB total / 10 DB / reset 00:00 UTC | Terverifikasi 17 Nov 2026 | `docs/keputusan-stack.md` bagian 5 |
| KV 100 rb baca / 1 rb tulis per hari | Diberikan koordinator; tulis terverifikasi 17 Nov 2026 | Penugasan tim; `docs/keputusan-stack.md` |
| Pages statis gratis tanpa batas | Terverifikasi 17 Nov 2026 | `docs/keputusan-stack.md` bagian 5 |
| Vercel Hobby 100 GB bandwidth/bulan, 1 jt permintaan CDN/bulan, non-komersial, tanpa overage berbayar | **Dokumentasi pihak ketiga, Okt 2026 — belum diverifikasi di dashboard proyek** | Pencarian web 17 Nov 2026 (beberapa sumber independen sepakat pada 100 GB/bulan); wajib dikonfirmasi di dashboard Vercel proyek sebelum rilis |
| Gemini free tier (RPD/RPM) | **Belum terverifikasi; pembacaan pihak ketiga bertentangan (20 / 250 / 1.500 per hari)** | Pencarian web 17 Nov 2026; angka aktif hanya ada di AI Studio per proyek |
| Semua angka pemakaian per DAU | Asumsi bagian 2 (A1–A10), wajib diukur ulang setelah rilis | Dihitung dari alur `PRODUCT.md` dan `ARCHITECTURE.md` |

### Utang verifikasi sebelum rilis

1. Baca kuota Gemini aktif proyek di AI Studio; ganti analisis
   sensitivitas bagian 3.4 dengan angka aktif.
2. Konfirmasi limit Vercel Hobby di dashboard Vercel proyek.
3. Konfirmasi ukuran potongan tes bertahan (asumsi A7: 256 KB).
4. Ukur ukuran baris nyata (asumsi A6) dari 100 baris pertama tiap
   tabel dan perbarui bagian 3.5.

## 9. Changelog dokumen

### 17 November 2026 — versi awal

- Model pemakaian dengan asumsi A1–A10 dan rumus terbuka.
- Perhitungan tiga skenario (10 / 100 / 1.000 DAU) untuk Workers,
  D1 (baca, tulis, simpan), KV, Gemini, Pages, dan Vercel.
- Temuan utama: Gemini adalah limit pertama yang habis (skenario
  100 dan 1.000 DAU pada kuota konservatif); penyimpanan D1 penuh
  dalam ±4,8 bulan pada 1.000 DAU tanpa retensi; failover penuh ke
  Vercel hanya bertahan sampai ±939 DAU.
- Ambang alert, larangan keras, dan rencana pertumbuhan empat
  langkah tanpa janji upgrade berbayar.
