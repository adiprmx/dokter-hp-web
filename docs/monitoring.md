# monitoring.md: Rancangan Monitoring Dokter HP Web App

> **Rancangan monitoring nol rupiah untuk Dokter HP Web App.**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen,
> 17 November 2026.
>
> Dokumen ini adalah rancangan saja. Belum ada pemantau yang berjalan
> dan belum ada token atau kredensial apa pun yang dicantumkan di sini.
> Angka limit free tier yang dipakai berasal dari
> `docs/keputusan-stack.md` dan `ARCHITECTURE.md` bagian 6.3
> (terverifikasi 17 November 2026). Angka ambang 80% adalah hasil
> hitung langsung dari limit tersebut, bukan angka baru.
>
> Prinsip: owner hanya memakai HP. Bila layanan mati, owner harus
> tahu cepat lewat pesan singkat di HP, tanpa perlu membuka dashboard
> dan tanpa layanan monitoring berbayar.

---

## 1. Yang dipantau

| Lapisan | Komponen | Cara pantau utama |
|---|---|---|
| Frontend utama | Cloudflare Pages | Cek HTTP berkala ke landing |
| Frontend mirror | Vercel | Cek HTTP berkala ke landing |
| Backend API | Cloudflare Worker (Hono) | Endpoint health + log Worker |
| Database | Cloudflare D1 | Pemakaian kuota harian + galat query di log |
| Cache | Cloudflare KV | Pemakaian kuota tulis harian |
| AI | Gemini via Worker | Galat/timeout panggilan di log Worker |

Tidak ada pemantau pihak ketiga berbayar. Semua pemantauan memakai
alat yang sudah ada: endpoint health milik sendiri, dashboard
Cloudflare, `wrangler tail`, dan cron pemeriksa yang mengirim alert
ke Telegram/WhatsApp owner.

---

## 2. Health check endpoint

### 2.1 Endpoint yang tersedia

Worker sudah menyediakan dua endpoint publik tanpa akses D1
(lihat `ARCHITECTURE.md` bagian 3.6). Keduanya murah dan aman
dipanggil berkala karena tidak memakan kuota D1:

| Endpoint | Jalur di Worker | Bila dipasang di bawah prefix `/api` | Fungsi |
|---|---|---|---|
| Liveness | `GET /health` | `GET /api/health` | Menjawab bila Worker hidup |
| Latensi | `GET /ping` | `GET /api/ping` | Target ukur latensi HTTP, respons kecil |

Respons yang diharapkan:

```json
// GET /health (atau /api/health)
{ "status": "ok" }

// GET /ping (atau /api/ping)
{ "ok": true, "t": 1730000000000 }
```

Keterangan:

- `/health` adalah liveness murni: ia tidak menyentuh D1.
  Bila `/health` menjawab tetapi data gagal dimuat, masalahnya ada
  di D1 atau di rute data, bukan di Worker.
- `/ping` dipakai dua hal: pemantau uptime mengukur latensi HTTP
  dari responsnya, dan fitur tes WiFi di frontend memakai endpoint
  yang sama untuk mengukur latensi pengguna.
- Kedua endpoint bersifat publik (tanpa sesi) agar pemantau
  eksternal bisa memanggilnya tanpa cookie.

### 2.2 Pemeriksaan berkala (probe)

| Target | Interval | Timeout per probe | Dinyatakan mati bila |
|---|---|---|---|
| Pages — landing `/` | 5 menit | 10 detik | 2 probe gagal berturut-turut |
| Vercel — landing `/` | 5 menit | 10 detik | 2 probe gagal berturut-turut |
| Worker — `/health` | 5 menit | 10 detik | 2 probe gagal berturut-turut |
| Worker — `/ping` (latensi) | 5 menit | 10 detik | 3 probe berturut-turut di atas 5 detik, atau gagal |

Alasan interval 5 menit: cukup cepat agar owner tahu dalam hitungan
menit, dan cukup hemat — 4 target × 12 probe per jam × 24 jam =
1.152 request per hari, sekitar 1,2% dari kuota Workers 100.000
request per hari. Probe sendiri tidak boleh menjadi penyebab kuota
habis.

Alasan "2 gagal berturut-turut": satu kegagalan tunggal sering
hanya gangguan jaringan sesaat di sisi pemantau, bukan layanan
yang mati. Dua kegagalan berturut-turut (selang 5 menit) adalah
sinyal yang cukup kuat untuk mengirim alert tanpa membanjiri owner
dengan alarm palsu.

### 2.3 Yang dicatat setiap probe

Setiap probe mencatat, minimal:

- Waktu (WIB dan UTC).
- Target dan URL yang dipanggil.
- Kode status HTTP (atau "timeout" / "gagal sambung").
- Latensi dalam milidetik.
- Hasil: OK atau GAGAL, beserta alasan singkat bila gagal.

Catatan probe disimpan sebagai log sederhana (file teks / baris
log cron), bukan di D1 — agar pemantauan tidak memakan kuota
database yang dipantaunya.

---

## 3. Pemantauan kuota harian Cloudflare

### 3.1 Limit dan ambang peringatan

Semua limit di bawah ini adalah limit free tier yang terverifikasi
17 November 2026 (`docs/keputusan-stack.md`). Ambang peringatan
ditetapkan di 80% dari limit, dihitung langsung dari angka tersebut.
Reset kuota harian terjadi pukul 00:00 UTC (07:00 WIB).

| Layanan | Limit harian | Ambang peringatan 80% | Tindakan saat ambang tercapai |
|---|---|---|---|
| Workers — request | 100.000/hari | 80.000/hari | Alert ke owner; periksa sumber lonjakan (log rute) |
| D1 — baris dibaca | 5.000.000/hari | 4.000.000/hari | Alert ke owner; periksa query tanpa indeks/limit |
| D1 — baris ditulis | 100.000/hari | 80.000/hari | Alert ke owner; periksa banjir tulis (rate limit) |
| KV — tulis | 1.000/hari | 800/hari | Alert ke owner; KV hanya untuk data jarang berubah, jadi angka ini seharusnya jauh di bawah ambang |
| D1 — penyimpanan | 500 MB per database | 400 MB | Alert ke owner; rencanakan bersih-bersih data lama |

Catatan:

- Pages: static request gratis tanpa batas (terverifikasi
  17 November 2026), sehingga tidak ada ambang kuota untuk Pages.
  Yang dipantau dari Pages adalah ketersediaan (bagian 2), bukan
  kuota.
- Kuota Gemini tidak dicantumkan di sini karena angka limitnya
  belum terverifikasi untuk dokumen ini. Bila tim AI memverifikasi
  angka limit Gemini, tambahkan barisnya ke tabel ini dengan sumber
  dan tanggal verifikasi.
- Tanpa kartu kredit yang terpasang, tidak ada overage berbayar:
  bila kuota habis, layanan mengembalikan galat sampai reset
  00:00 UTC, tanpa tagihan.

### 3.2 Cara membaca pemakaian kuota

Sumber kebenaran pemakaian kuota adalah **dashboard Cloudflare**
(Analytics per layanan: Workers, D1, KV). Jalur programatis yang
dirancang (belum dibangun):

1. **Jalur utama — dashboard Cloudflare.** Pemeriksaan manual
   berkala (lihat jadwal di bagian 8): buka Analytics Workers
   (jumlah request hari ini), Analytics D1 (baris dibaca/ditulis
   hari ini), dan Analytics KV (tulis hari ini). Bandingkan dengan
   kolom ambang di tabel 3.1.
2. **Jalur otomatis (rancangan).** Cron pemeriksa memanggil
   Cloudflare GraphQL Analytics API dengan token API baca-saja
   (token disimpan di Secure Vault, tidak pernah di repo dan tidak
   pernah di dokumen ini). Cron membandingkan angka hari berjalan
   dengan ambang 80% dan mengirim alert bila terlampaui. Token
   API ini adalah pekerjaan implementasi fase berikutnya dan
   memerlukan persetujuan owner sebelum dibuat.
3. **Jalur darurat — log Worker.** Bila kuota habis, gejalanya
   terlihat di log sebagai galat massal (lihat bagian 4.3).
   Ini bukan pemantau kuota, melainkan deteksi setelah kejadian;
   jalur 1 dan 2 adalah pencegahannya.

### 3.3 Proyeksi habisnya kuota

Bila pemakaian sudah melewati 80% sebelum pukul 12:00 UTC
(19:00 WIB), cron alert menyertakan perkiraan sederhana:
laju pemakaian per jam sejauh ini × sisa jam sampai reset.
Perkiraan ini hanya hitungan kasar dari angka yang terukur,
bukan prediksi pasti, dan disampaikan sebagai perkiraan.
Bila proyeksi menunjukkan kuota akan habis sebelum reset,
owner memutuskan apakah perlu membatasi fitur berat sementara
(misalnya Diagnosis AI) sampai reset.

---

## 4. Pemantauan galat (error monitoring)

### 4.1 Log Worker

Worker mencatat log terstruktur untuk setiap request
(lihat `ARCHITECTURE.md` bagian 8):

- Waktu (ISO 8601, UTC).
- Rute yang dipanggil (misalnya `/wifi-reports`).
- Kode status HTTP respons.
- Durasi pemrosesan dalam milidetik.
- Kode galat bila ada (misalnya `RATE_LIMIT`, `D1_ERROR`).

Yang TIDAK PERNAH dicatat di log: token sesi, PIN atau hash PIN,
isi pertanyaan/jawaban AI secara penuh, dan kunci apa pun.
Log hanya berisi id, status, dan waktu.

### 4.2 Cara membaca log

| Kebutuhan | Cara |
|---|---|
| Melihat log live saat debugging | `wrangler tail` dari mesin yang memiliki akses deploy Worker |
| Melihat riwayat galat | Dashboard Cloudflare → Workers → Logs (retensi sesuai paket gratis) |
| Mencari satu insiden | Filter berdasarkan rentang waktu insiden, lalu berdasarkan kode status 5xx |

Pola yang perlu diperhatikan saat membaca log:

1. **Lonjakan 5xx mendadak** pada satu rute: kemungkinan besar
   deploy terakhir merusak rute itu, atau D1 bermasalah.
2. **5xx merata di semua rute**: kemungkinan besar Worker atau D1
   bermasalah secara menyeluruh, atau kuota habis.
3. **Lonjakan 429**: rate limit bekerja — periksa apakah itu
   penyalahgunaan (satu IP/pengguna) atau batas yang terlalu ketat
   untuk pemakaian normal.
4. **Galat hanya di `/ai/diagnose`**: kemungkinan besar Gemini
   bermasalah atau kunci bermasalah; fitur lain seharusnya tetap
   jalan.
5. **Durasi tiba-tiba naik** di semua rute: kemungkinan D1 lambat
   atau query tanpa indeks mulai terbebani data yang membesar.

### 4.3 Kode galat yang dikenali

| Gejala di log / respons | Arti yang paling mungkin | Rujukan runbook |
|---|---|---|
| HTTP 500 dari banyak rute + pesan galat D1 | D1 bermasalah atau kuota D1 habis | Bagian 7.3 |
| HTTP 429 massal | Rate limit / banjir request | Bagian 7.2 (langkah 3) |
| Galat Cloudflare 1027 pada Worker | Worker melewati batas harian (request limit) | Bagian 7.2 |
| HTTP 502/503 dari Pages atau Vercel | Mirror frontend bermasalah | Bagian 7.1 / 7.4 |
| Timeout panggilan Gemini | Layanan AI tidak merespons | Bagian 7.5 |
| HTTP 401 massal | Masalah sesi / cookie (periksa perubahan deploy terakhir) | Bagian 7.6 |

---

## 5. Rencana alert

### 5.1 Prinsip alert

- **Owner hanya memakai HP.** Alert dikirim sebagai pesan singkat
  ke Telegram dan/atau WhatsApp owner — kanal yang sama dengan
  laporan cron lain milik owner. Tidak ada alert yang hanya
  tampil di dashboard.
- **Satu insiden, satu pesan.** Bila layanan mati, kirim satu
  pesan saat terdeteksi dan satu pesan saat pulih. Jangan kirim
  pesan berulang setiap probe gagal selama insiden yang sama.
- **Pesan bisa dibaca dalam 5 detik.** Baris pertama menyatakan
  apa yang mati dan sejak kapan. Detail teknis (kode status,
  latensi) ada di baris berikutnya, singkat.
- **Rancangan saja.** Belum ada token bot Telegram/WhatsApp yang
  dibuat untuk alert ini, dan tidak ada token yang dicantumkan di
  dokumen ini. Pembuatan dan penyimpanan token adalah pekerjaan
  implementasi dengan persetujuan owner.

### 5.2 Pemicu alert

| Pemicu | Tingkat | Pesan dikirim |
|---|---|---|
| Pages mati (2 probe gagal) | Tinggi | Segera |
| Vercel mati (2 probe gagal) | Sedang | Segera |
| Worker `/health` mati (2 probe gagal) | Tinggi | Segera |
| Latensi `/ping` > 5 detik, 3x berturut-turut | Sedang | Segera |
| Kuota Workers/D1/KV mencapai 80% | Sedang | Segera, sekali per hari per layanan |
| Kuota habis (terdeteksi dari galat massal) | Tinggi | Segera |
| Error rate 5xx di atas ambang (bagian 6) | Tinggi | Segera |
| Layanan pulih setelah insiden | Info | Sekali saat pulih |

### 5.3 Format pesan alert (contoh)

Contoh pesan saat Worker mati:

```
🔴 Dokter HP: API mati
Sejak: 17 Nov 2026, 21:05 WIB
Gejala: /health gagal 2x berturut-turut (timeout 10 dtk)
Dampak: login, riwayat, dan simpan data tidak bisa dipakai.
Tes WiFi tanpa akun masih jalan di browser.
Tindak lanjut: runbook 7.2 (Worker).
```

Contoh pesan saat kuota mencapai 80%:

```
⚠️ Dokter HP: kuota D1 tulis 80%
Pemakaian: 80.000 dari 100.000 baris/hari.
Reset: 07:00 WIB besok.
Tindak lanjut: periksa banjir tulis (runbook 7.3).
```

Contoh pesan saat pulih:

```
✅ Dokter HP: API pulih
Mati: 21:05–21:22 WIB (17 menit).
Penyebab sementara: (diisi setelah runbook dijalankan).
```

### 5.4 Pengirim alert (rancangan)

- **Cron pemeriksa** berjalan berkala (interval sesuai bagian 2.2
  untuk probe, dan sekali per jam untuk cek kuota). Cron ini
  adalah pekerjaan implementasi fase berikutnya; rancangannya:
  satu skrip kecil yang memanggil keempat target probe, membaca
  angka kuota (jalur otomatis bagian 3.2 bila token tersedia),
  membandingkan dengan ambang, dan mengirim pesan bila ada pemicu.
- **Kanal pengiriman:** bot Telegram owner yang sudah ada untuk
  laporan cron, atau WhatsApp owner. Keputusan kanal akhir dan
  penyiapan token ada di tangan koordinator bersama owner.
- **Bila cron pemeriksa sendiri mati:** tidak ada alert yang
  terkirim, dan tidak ada yang tahu. Mitigasi: cron pemeriksa
  mengirim pesan "denyut" (heartbeat) singkat sekali sehari
  (misalnya pukul 08:00 WIB) yang menyatakan semua target OK dan
  pemakaian kuota hari ini. Bila denyut tidak datang dua hari
  berturut-turut, owner tahu pemantau itu sendiri yang bermasalah.

---

## 6. Metrik kunci

| Metrik | Definisi | Cara ukur | Target (SLO, bagian 8) |
|---|---|---|---|
| Uptime Pages | Persentase probe landing Pages yang berhasil dalam sebulan | Log probe cron | ≥ 99% per bulan |
| Uptime Vercel | Persentase probe landing Vercel yang berhasil dalam sebulan | Log probe cron | ≥ 99% per bulan |
| Uptime Worker API | Persentase probe `/health` yang berhasil dalam sebulan | Log probe cron | ≥ 99% per bulan |
| Latensi p95 API | Latensi di bawahnya terdapat 95% dari semua respons `/ping` dalam sehari | Log probe cron (kumpulkan semua sampel latensi harian, ambil persentil ke-95) | ≤ 1 detik |
| Error rate API | Persentase respons 5xx dari total request Worker dalam sehari | Dashboard Cloudflare / log Worker | < 1% per hari |
| Pemakaian kuota Workers | Request hari ini ÷ 100.000 | Dashboard / GraphQL Analytics | < 80% pada pukul 19:00 WIB |
| Pemakaian kuota D1 baca | Baris dibaca hari ini ÷ 5.000.000 | Dashboard / GraphQL Analytics | < 80% pada pukul 19:00 WIB |
| Pemakaian kuota D1 tulis | Baris ditulis hari ini ÷ 100.000 | Dashboard / GraphQL Analytics | < 80% pada pukul 19:00 WIB |
| Pemakaian kuota KV tulis | Tulis hari ini ÷ 1.000 | Dashboard / GraphQL Analytics | < 80% pada pukul 19:00 WIB |
| Waktu deteksi insiden | Selang antara layanan mati dan alert terkirim | Selisih waktu log probe dan waktu kirim alert | ≤ 10 menit |

Catatan:

- **p95** berarti: urutkan semua sampel latensi dari tercepat ke
  terlambat, lalu ambil nilai pada posisi 95%. Angka ini
  mengabaikan 5% sampel terlambat (gangguan sesaat) sehingga lebih
  jujur daripada rata-rata.
- **Error rate** dihitung dari log Worker, bukan dari probe:
  probe hanya memanggil `/health` dan `/ping`, sementara galat
  nyata terjadi di rute data (`/wifi-reports`, `/ai/diagnose`,
  dan lain-lain).
- Semua metrik dihitung dari data yang benar-benar terukur (log
  probe, log Worker, dashboard). Tidak ada metrik yang diisi
  dengan angka contoh.

---

## 7. Runbook insiden

Setiap runbook memakai pola yang sama: **(1) konfirmasi,
(2) mitigasi cepat, (3) perbaikan dan verifikasi.**
Jalankan langkah demi langkah; jangan melompat ke langkah 3
sebelum langkah 1 memastikan diagnosisnya benar.

### 7.1 Pages mati (mirror utama tidak bisa dibuka)

**Gejala:** probe landing Pages gagal 2x; alert "Pages mati"
terkirim. Pengguna membuka URL Pages dan mendapat galat atau
timeout.

1. **Konfirmasi.**
   - Buka URL Pages dari HP owner (jaringan berbeda dari pemantau
     bila memungkinkan) untuk memastikan ini bukan gangguan di
     sisi pemantau saja.
   - Buka URL Vercel: bila Vercel hidup, frontend masih tersedia
     lewat mirror.
   - Buka `/health` Worker: bila Worker hidup, backend dan data
     aman — yang mati hanya hosting frontend utama.
   - Periksa status Cloudflare (halaman status resmi Cloudflare):
     bila ada insiden platform, ini di luar kendali proyek.
2. **Mitigasi cepat.**
   - Umumkan tautan mirror Vercel ke pengguna (lewat kanal yang
     tersedia: bila ada pengumuman di mirror yang hidup, pasang
     di sana; bila tidak, sampaikan langsung ke pengguna yang
     bertanya).
   - Jangan mengubah kode atau deploy ulang dalam keadaan panik —
     deploy ulang tidak memperbaiki platform yang sedang down.
3. **Perbaikan dan verifikasi.**
   - Bila penyebabnya deploy terakhir yang rusak (Pages hidup
     tetapi menampilkan galat deploy): rollback ke deploy
     sebelumnya lewat dashboard Pages, lalu jalankan uji smoke
     (buka landing, jalankan tes WiFi tanpa akun).
   - Bila penyebabnya insiden platform Cloudflare: tunggu
     pemulihan platform; verifikasi dengan probe (landing kembali
     OK 2x berturut-turut) lalu kirim pesan "pulih".
   - Catat insiden: waktu mulai/selesai, penyebab, dan apa yang
     dilakukan — di log insiden (bagian 9).

### 7.2 Worker galat 1027 (Worker melewati batas harian)

**Gejala:** respons API mengembalikan galat Cloudflare 1027;
`/health` gagal; log menunjukkan request ditolak karena batas
harian terlampaui. (Kode 1027 adalah kode galat Cloudflare untuk
Worker yang melewati batas request harian paketnya.)

1. **Konfirmasi.**
   - Buka dashboard Cloudflare → Analytics Workers: periksa jumlah
     request hari ini. Bila mendekati atau mencapai 100.000,
     diagnosis terkonfirmasi.
   - Periksa log rute: rute mana yang menyumbang lonjakan
     (apakah `/ping` dipanggil berlebihan, ada banjir dari satu
     IP, atau ada loop pemanggilan di frontend).
   - Pastikan ini bukan galat 1027 karena sebab lain: bila jumlah
     request jauh di bawah 100.000, penyebabnya bukan kuota —
     periksa status platform Cloudflare dan deploy terakhir.
2. **Mitigasi cepat.**
   - Sampaikan ke pengguna bahwa layanan server tidak tersedia
     sampai reset kuota pukul 07:00 WIB (00:00 UTC); tes WiFi
     tanpa akun tetap jalan di browser karena tidak butuh API.
   - Bila lonjakan berasal dari satu IP atau pola penyalahgunaan:
     aktifkan pembatasan di Worker (rate limit per IP sudah ada
     di rancangan — `ARCHITECTURE.md` bagian 6.1) atau blokir
     sementara bila platform menyediakan.
   - Bila lonjakan berasal dari bug frontend (misalnya loop
     pemanggilan `/ping`): perbaiki dan deploy frontend — tetapi
     ingat, deploy frontend tidak mengembalikan kuota Worker yang
     sudah habis; ini hanya mencegah kejadian berulang besok.
3. **Perbaikan dan verifikasi.**
   - Kuota reset otomatis pukul 00:00 UTC (07:00 WIB). Setelah
     reset, verifikasi `/health` menjawab OK, lalu jalankan uji
     smoke (masuk, simpan satu laporan, buka riwayat).
   - Bila kejadian berulang: turunkan beban request — kurangi
     frekuensi pemanggilan API dari frontend, perketat rate limit,
     dan tinjau apakah probe monitoring sendiri ikut menyumbang
     (probe hanya ~1.152 request/hari, jadi bukan penyebab utama
     kecuali ada bug di cron).
   - Catat insiden di log insiden (bagian 9).

### 7.3 Kuota D1 habis (baca atau tulis mencapai limit harian)

**Gejala:** `/health` tetap OK (tidak menyentuh D1), tetapi semua
rute data gagal: login gagal, riwayat tidak termuat, simpan data
gagal. Log Worker menunjukkan galat D1 massal.

1. **Konfirmasi.**
   - Buka dashboard Cloudflare → Analytics D1: periksa baris
     dibaca dan baris ditulis hari ini. Bila salah satunya
     mencapai limit (5.000.000 baca / 100.000 tulis),
     diagnosis terkonfirmasi.
   - Bedakan dari kerusakan D1 lain: bila pemakaian jauh di bawah
     limit tetapi query tetap gagal, penyebabnya bukan kuota —
     periksa deploy terakhir (migrasi yang salah) dan status
     platform.
   - Periksa rute penyebab: query mana yang paling banyak membaca
     (kemungkinan query tanpa `LIMIT`, atau daftar tanpa
     paginasi).
2. **Mitigasi cepat.**
   - Sampaikan ke pengguna bahwa data tidak bisa dimuat/disimpan
     sampai reset kuota pukul 07:00 WIB; tes WiFi tanpa akun
     tetap jalan di browser.
   - Jangan mencoba "memperbaiki" dengan deploy ulang — deploy
     tidak mengembalikan kuota.
   - Bila penyebabnya banjir tulis dari penyalahgunaan: rate limit
     tulis (60/menit per pengguna, `ARCHITECTURE.md` bagian 6.1)
     seharusnya sudah menahan; periksa apakah rate limit berjalan
     atau ada celah.
3. **Perbaikan dan verifikasi.**
   - Kuota reset otomatis pukul 00:00 UTC (07:00 WIB). Setelah
     reset, verifikasi dengan masuk dan membuka riwayat.
   - Perbaiki akar masalah sebelum besok: tambahkan `LIMIT` dan
     paginasi pada query yang boros, pastikan semua query memakai
     indeks (`ARCHITECTURE.md` bagian 6.3), dan tinjau rate limit
     tulis.
   - Catat insiden di log insiden (bagian 9).

### 7.4 Vercel mati (mirror kedua tidak bisa dibuka)

**Gejala:** probe landing Vercel gagal 2x; alert "Vercel mati"
terkirim. Pages (utama) biasanya tetap hidup.

1. **Konfirmasi.**
   - Buka URL Vercel dari HP owner untuk memastikan.
   - Buka URL Pages: bila Pages hidup, pengguna tidak terdampak —
     ini insiden tingkat sedang, bukan darurat.
   - Periksa status Vercel (halaman status resmi Vercel) dan
     riwayat deploy terakhir di dashboard Vercel.
2. **Mitigasi cepat.**
   - Tidak ada mitigasi pengguna yang mendesak bila Pages hidup.
     Pastikan tidak ada tautan yang mengarah ke Vercel sebagai
     satu-satunya jalan masuk.
3. **Perbaikan dan verifikasi.**
   - Bila penyebabnya deploy terakhir yang rusak: rollback ke
     deploy sebelumnya lewat dashboard Vercel, lalu uji smoke.
   - Bila penyebabnya insiden platform Vercel: tunggu pemulihan;
     verifikasi dengan probe lalu kirim pesan "pulih".
   - Catat insiden di log insiden (bagian 9).

### 7.5 Diagnosis AI tidak tersedia (Gemini bermasalah)

**Gejala:** rute `/ai/diagnose` mengembalikan galat atau timeout,
sementara rute lain normal. Pengguna melihat pesan jujur
"Diagnosis AI sedang tidak tersedia, coba lagi nanti"
(sesuai `PRODUCT.md` bagian 4.6).

1. **Konfirmasi.**
   - Periksa log Worker: galat hanya di `/ai/diagnose` atau
     merata? Bila hanya di `/ai/diagnose`, masalahnya di jalur
     Gemini (kunci, kuota Gemini, atau layanan Gemini).
   - Periksa status layanan Gemini (halaman status resmi Google
     Cloud / AI Studio).
2. **Mitigasi cepat.**
   - Tidak ada mitigasi darurat: fitur lain tetap jalan, dan
     frontend sudah menampilkan pesan jujur. Jangan mengarang
     jawaban AI sebagai pengganti.
3. **Perbaikan dan verifikasi.**
   - Bila kunci bermasalah: periksa secret Worker (tanpa pernah
     menampilkan nilai kunci) dan putar kunci bila perlu,
     dengan persetujuan owner.
   - Bila kuota Gemini habis: tunggu reset kuota Gemini, lalu
     uji satu pertanyaan diagnosis.
   - Catat insiden di log insiden (bagian 9).

### 7.6 Login massal gagal (HTTP 401 merata)

**Gejala:** banyak pengguna (atau owner sendiri) tidak bisa masuk;
log menunjukkan lonjakan 401 di rute yang butuh sesi.

1. **Konfirmasi.**
   - Coba masuk dengan akun owner: bila gagal, periksa apakah
     `/health` OK dan D1 OK (bila D1 bermasalah, ini insiden 7.3,
     bukan 7.6).
   - Periksa deploy terakhir: apakah ada perubahan pada kode sesi,
     cookie, atau verifikasi token?
2. **Mitigasi cepat.**
   - Bila penyebabnya deploy terakhir: rollback Worker ke deploy
     sebelumnya lewat dashboard Cloudflare / Wrangler.
3. **Perbaikan dan verifikasi.**
   - Uji masuk–keluar–masuk penuh, termasuk kunci PIN bila diatur.
   - Catat insiden di log insiden (bagian 9).

---

## 8. Target SLO (Service Level Objective)

Target di bawah ini realistis untuk proyek gratis di free tier,
tanpa tim siaga 24 jam dan tanpa failover otomatis. Target
ditetapkan sebagai sasaran desain, bukan janji yang sudah terukur —
pengukuran dimulai setelah pemantau berjalan.

| Layanan / metrik | Target | Artinya dalam praktik |
|---|---|---|
| Uptime Pages | ≥ 99% per bulan | Boleh mati total sampai sekitar 7 jam 18 menit per bulan |
| Uptime Vercel | ≥ 99% per bulan | Sama seperti Pages |
| Uptime Worker API | ≥ 99% per bulan | Sama seperti Pages |
| Latensi p95 API (`/ping`) | ≤ 1 detik | 95% respons lebih cepat dari 1 detik |
| Error rate API (5xx) | < 1% per hari | Kurang dari 1 dari 100 request mengembalikan galat server |
| Waktu deteksi insiden | ≤ 10 menit | Alert terkirim paling lambat 10 menit setelah layanan mati (2 probe × 5 menit) |
| Waktu pemulihan (target, bukan janji) | Sebaiknya < 1 jam untuk insiden yang bisa diperbaiki sendiri (rollback deploy); insiden platform mengikuti pemulihan penyedia | Owner tidak menunggu tanpa kabar: bila pemulihan butuh waktu lama, kirim kabar perkembangan |

Catatan:

- Target 99% (bukan 99,9%) dipilih dengan sadar: proyek ini
  berjalan di free tier tanpa failover otomatis untuk API
  (Worker adalah satu-satunya backend — `ARCHITECTURE.md`
  bagian 7). Satu backend berarti satu titik kegagalan; target
  yang lebih tinggi tidak jujur tanpa redundansi API.
- Waktu mati yang diizinkan 99% per bulan dihitung dari
  30 hari × 24 jam × 1% = 7,2 jam (7 jam 12 menit) — angka
  di tabel memakai 30,44 hari (rata-rata bulan) sehingga
  menjadi sekitar 7 jam 18 menit. Kedua hitungan dicantumkan
  agar dasarnya jelas.
- Bila kuota harian habis, layanan tidak bisa pulih sebelum
  reset 00:00 UTC — ini dihitung sebagai waktu mati dalam SLO,
  dan menjadi alasan kuat untuk menjaga pemakaian di bawah
  ambang 80%.

---

## 9. Jadwal pemeriksaan dan log insiden

### 9.1 Jadwal rutin

| Kapan | Apa yang diperiksa | Oleh |
|---|---|---|
| Setiap 5 menit (otomatis) | Probe 4 target (bagian 2.2) | Cron pemeriksa |
| Setiap jam (otomatis) | Pemakaian kuota vs ambang 80% | Cron pemeriksa |
| Setiap hari pukul 08:00 WIB (otomatis) | Denyut harian: status semua target + pemakaian kuota kemarin | Cron pemeriksa |
| Setiap minggu | Tinjau log insiden + metrik mingguan (uptime, p95, error rate); periksa tren pemakaian kuota naik atau stabil | Koordinator / tim monitoring |
| Setiap bulan | Hitung SLO bulanan; tinjau apakah ambang atau target perlu diubah | Koordinator / tim monitoring |
| Setelah setiap deploy | Uji smoke di kedua mirror (landing, tes WiFi tanpa akun, masuk, simpan laporan, riwayat) | Tim implementasi |

### 9.2 Log insiden

Setiap insiden dicatat dalam satu baris entri dengan format:

```
Tanggal | Layanan | Mulai (WIB) | Selesai (WIB) | Durasi |
Penyebab | Tindakan | Status akhir
```

Log insiden disimpan di `docs/log-insiden.md` (dibuat saat insiden
pertama terjadi; belum ada insiden yang dicatat pada saat dokumen
ini ditulis). Log ini adalah bahan tinjauan mingguan dan bulanan.

---

## 10. Batasan rancangan ini

1. **Satu backend, satu titik kegagalan.** Worker adalah satu-satunya
   API. Bila Worker mati, kedua mirror kehilangan data — hanya tes
   WiFi lokal di browser yang tetap jalan. Failover API otomatis
   tidak ada di fase ini.
2. **Pemantau bisa mati diam-diam.** Cron pemeriksa sendiri adalah
   satu titik kegagalan; denyut harian (bagian 5.4) adalah satu-satunya
   pendeteksi bila pemantau mati.
3. **Kuota dibaca dari dashboard.** Sampai jalur otomatis GraphQL
   dibangun (bagian 3.2), pemantauan kuota bergantung pada
   pemeriksaan manual dan alert kuota tidak otomatis.
4. **Tidak ada pemantauan dari banyak lokasi.** Probe berjalan dari
   satu lokasi; gangguan jaringan di lokasi pemantau bisa memicu
   alarm palsu. Aturan "2 gagal berturut-turut" mengurangi risiko
   ini tetapi tidak menghilangkannya.
5. **Retensi log terbatas.** Log Workers di paket gratis memiliki
   retensi terbatas; insiden yang baru disadari setelah berhari-hari
   mungkin sudah kehilangan log detailnya. Itulah sebabnya alert
   cepat (≤ 10 menit) penting.

---

## 11. Sumber angka

| Klaim | Sumber | Tanggal |
|---|---|---|
| Workers 100.000 request/hari | Spesifikasi tugas koordinator (limit free tier Workers) | 17 Nov 2026 |
| D1: 5 jt baca, 100 rb tulis per hari; 500 MB/database; reset 00:00 UTC; tanpa overage berbayar | `docs/keputusan-stack.md` bagian 2.5 dan 5; `ARCHITECTURE.md` bagian 6.3 | 17 Nov 2026 |
| KV writes 1.000/hari | `docs/keputusan-stack.md` bagian 2.6 dan 3.4 | 17 Nov 2026 |
| Pages static requests gratis tanpa batas | `docs/keputusan-stack.md` bagian 2.2 dan 5 | 17 Nov 2026 |
| Ambang 80% (80.000 / 4.000.000 / 80.000 / 800 / 400 MB) | Hitung langsung: 80% × limit di atas | 17 Nov 2026 |
| Beban probe ~1.152 request/hari | Hitung langsung: 4 target × 12 probe/jam × 24 jam | 17 Nov 2026 |
| Uptime 99% ≈ 7 jam 18 menit mati/bulan | Hitung langsung: 30,44 hari × 24 jam × 1% | 17 Nov 2026 |
| Endpoint `/health` dan `/ping` tanpa akses D1 | `ARCHITECTURE.md` bagian 3.6 | 17 Nov 2026 |
| Rate limit (AI 20/hari, tulis 60/menit, PIN 5x lalu kunci 30 dtk) | `ARCHITECTURE.md` bagian 6.1 | 17 Nov 2026 |

## 12. Changelog dokumen

### 17 November 2026 — versi awal

- Rancangan monitoring nol rupiah: health check, pemantauan kuota
  dengan ambang 80%, pemantauan galat, rencana alert, metrik kunci,
  runbook insiden (Pages, Worker 1027, D1 habis, Vercel, AI, login),
  dan target SLO 99%.
