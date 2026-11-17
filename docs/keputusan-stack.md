# Keputusan Stack: Dokter HP Web App

> **Dokumen keputusan teknologi Dokter HP Web App.**
> Bahasa: Bahasa Indonesia. Status: diputuskan koordinator,
> terverifikasi live 17 November 2026.
>
> Dokumen ini mencatat apa yang dipakai, apa yang tidak dipakai, dan
> kenapa — beserta angka limit free-tier yang terverifikasi. Angka di
> sini hanya angka yang diberikan koordinator / terverifikasi pada
> tanggal tersebut; tidak ada angka karangan.
>
> Prinsip yang mengikat semua keputusan: **budget nol rupiah, tanpa
> kartu kredit, tanpa VPS, tanpa trial berbayar. Backend + database
> sendiri, tidak bergantung API/situs pihak ketiga untuk data inti.**

---

## 1. Ringkasan keputusan

| Lapisan | Dipakai | Tidak dipakai |
|---|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + Zustand + React Router | — |
| Hosting frontend | Cloudflare Pages (utama) + Vercel (mirror 2) | — |
| Backend API | Cloudflare Workers (Hono) | Supabase Edge Functions, Firebase Cloud Functions |
| Database | Cloudflare D1 (SQLite serverless) | Supabase Postgres, Firestore, Turso |
| Cache / data jarang berubah | Cloudflare KV (terbatas) | KV untuk sesi (dilarang — lihat bagian 3.4) |
| Auth | Google OAuth via Worker + PIN SHA-256 + salt + sesi di D1 | Supabase Auth, Firebase Auth |
| Rate limit | Penghitung di tabel D1 `rate_limits` | Fitur rate limiting platform (tidak tersedia di free tier) |
| AI | Gemini Flash-Lite via Worker (server-side secret) | Kunci API di client (dilarang) |
| PDF | jsPDF client-side dari data real via API | Layanan PDF pihak ketiga |

## 2. Yang dipakai

### 2.1 Frontend: Vite + React + TypeScript + Tailwind + Zustand + React Router

- **Dipakai** karena: stack modern yang umum, build cepat, tipikal
  untuk aplikasi web satu halaman dengan banyak layar (11 layar),
  dan cocok dengan hosting statis gratis.
- Vite menghasilkan build statis yang bisa di-deploy ke Pages dan
  Vercel tanpa perubahan.
- Zustand untuk state ringan (status sesi, cache UI); React Router
  untuk rute per layar.

### 2.2 Hosting frontend: Cloudflare Pages (utama)

- **Dipakai** karena: static requests gratis tanpa batas.
- Menyajikan build frontend + file statis tes kecepatan
  (`speedtest-1mb.bin`) dari infrastruktur yang sama dengan API
  (satu akun Cloudflare, latensi rendah antar layanan).

### 2.3 Mirror 2: Vercel

- **Dipakai** karena: mirror kedua untuk ketahanan — bila satu
  mirror down, pengguna masih bisa membuka mirror lain.
- Frontend yang sama, tanpa perubahan kode; API tetap ke Worker
  yang sama. Vercel hanya menyajikan file statis, bukan API kedua.

### 2.4 Backend: Cloudflare Workers (Hono)

- **Dipakai** karena: compute serverless tanpa server, tanpa kartu
  kredit, satu ekosistem dengan Pages dan D1; Hono adalah framework
  ringan yang dirancang untuk Workers.
- Worker menangani: Google OAuth (penukaran kode di server),
  verifikasi sesi, validasi + rate limit, akses D1, dan panggilan
  Gemini dengan secret server-side.

### 2.5 Database: Cloudflare D1 (SQLite serverless)

- **Dipakai** karena: free tier paling longgar di antara opsi gratis
  yang dievaluasi, tanpa kartu kredit, dan satu ekosistem dengan
  Worker.
- **Angka limit free tier (terverifikasi 17 November 2026):**
  - 5 juta baris dibaca per hari
  - 100 ribu baris ditulis per hari
  - 500 MB per database
  - 5 GB total per akun
  - 10 database per akun
  - Tanpa kartu kredit
  - Bila kuota habis, query error sampai reset 00:00 UTC — tanpa
    tagihan (tidak ada overage berbayar karena tidak ada kartu
    yang terpasang).
- Skema D1 kompatibel dengan rancangan Supabase APK: tabel
  `profiles`, `health_checks`, `wifi_reports`, `ai_diagnoses`
  dengan nama kolom yang sama; UUID sebagai TEXT, timestamptz
  sebagai TEXT ISO 8601, jsonb sebagai TEXT JSON. Tambahan tabel
  web: `users`, `sessions`, `wifi_sustained_samples`.
- Sumber angka: verifikasi live koordinator 17 November 2026
  (dokumentasi dan dashboard Cloudflare D1).

### 2.6 KV: hanya data yang jarang berubah

- **Dipakai terbatas** karena: KV cocok untuk data yang jarang
  berubah (misalnya konfigurasi statis atau cache baca-berat).
- **KV tidak dipakai untuk sesi** — sesi disimpan di D1, karena
  KV writes hanya 1.000 per hari, terlalu sedikit untuk sesi login
  dan data yang sering ditulis.

### 2.7 Auth: Google OAuth via Worker + PIN SHA-256 + salt

- **Dipakai** karena: Google OAuth memberi identitas terverifikasi
  tanpa membangun sistem kata sandi sendiri; authorization code
  flow dengan penukaran kode di server membuat client secret tidak
  pernah menyentuh browser.
- PIN SHA-256 + salt adalah cermin APK (4-8 digit, hash + salt,
  kunci 30 detik setelah 5 kali salah berturut-turut).
- Sesi sebagai token hash di D1 (token mentah hanya di cookie
  HttpOnly pengguna).

### 2.8 AI: Gemini via Worker (server-side secret saja)

- **Dipakai** karena: Diagnosis AI butuh kunci API, dan kunci tidak
  boleh ada di browser. Worker memanggil Gemini dengan kunci dari
  secret Worker; frontend hanya mengirim pertanyaan dan menerima
  jawaban.
- Kunci tidak pernah ada di client, tidak pernah di repo.
- **Model utama: Gemini Flash-Lite (K-06).** Kuota harian free
  tier model Flash hanya 20 request/hari (RPD) per proyek —
  limit paling ketat di seluruh stack — sementara Flash-Lite
  500 RPD. Batas per pengguna tetap 20/hari. Jawaban AI wajib
  di-cache (D1/KV), dan bila kuota habis atau layanan tidak
  tersedia, Worker memakai diagnosis cadangan tanpa AI (aturan
  berbasis data pemeriksaan) dengan pesan jujur ke pengguna.
  Angka RPD bersumber sekunder (dokumentasi resmi Google tidak
  memublikasikan angka per model) — wajib dikonfirmasi di
  halaman rate limit AI Studio sebelum peluncuran.

### 2.9 PDF: jsPDF client-side

- **Dipakai** karena: laporan PDF bisa dibuat sepenuhnya di browser
  dari data real yang diambil via API — tanpa server PDF, tanpa
  layanan pihak ketiga, tanpa biaya.

### 2.10 Tes kecepatan web: file 1 MB milik sendiri + latensi HTTP

- **Dipakai** karena: mengunduh file 1 MB dari aset statis milik
  sendiri (Pages) mengukur kecepatan nyata tanpa bergantung pada
  server tes pihak ketiga; latensi diukur sebagai latensi HTTP
  karena browser tidak bisa mengirim ping ICMP mentah.

### 2.11 Rate limit: penghitung di tabel D1 (K-02)

- **Dipakai** karena: Workers free tier tidak menyediakan rate
  limiting per-pengguna bawaan; penghitung eksplisit di tabel
  D1 `rate_limits` teruji dan konsisten dengan arsitektur yang
  ada (lihat `ARCHITECTURE.md` bagian 5 dan 6.1).
- Batas tetap sesuai kontrak API: tulis 60/menit per pengguna,
  baca 300/menit per pengguna, AI 20/hari per pengguna, ekspor
  5/hari per pengguna.
- KV tidak dipakai untuk rate limit (writes KV hanya 1.000/hari).

## 3. Yang tidak dipakai

### 3.1 Supabase — DITOLAK (terblokir total)

- **Alasan:** akun adiprmx sudah memakai 2 dari 2 proyek gratis
  (limit per akun). Organisasi baru tidak menambah jatah — limit
  dihitung per anggota di semua organisasi tempat ia Owner/Admin.
- **Bukti:** terverifikasi 12 November 2026 (Management API: organisasi
  yang ada hanya `adipmusic`; proyek aktif 2, keduanya
  `ACTIVE_HEALTHY` — `adipmusic` dan `adipqris-sg`; pembuatan proyek
  di organisasi baru `dokter-hp` ditolak; uji pembeda di organisasi
  lama memberi pesan eksplisit bahwa anggota adiprmx sudah mencapai
  limit 2 proyek gratis) dan ditegaskan lagi 17 November 2026
  (organisasi kedua "adip-cinema" dibuat tetapi proyek tetap tidak
  bisa dibuat — batas per akun, bukan per organisasi).
- **Dampak:** migrasi Supabase APK (4 file: `profiles`,
  `health_checks`, `wifi_reports`, `ai_diagnoses`) tetap dipakai
  sebagai acuan skema, tetapi targetnya adalah D1, bukan Postgres
  Supabase. Supabase Auth dan Edge Functions tidak dipakai.
- **Catatan:** keputusan ini berlaku untuk akun adiprmx. Bila di
  masa depan ada akun Supabase lain milik owner dengan jatah proyek
  kosong, keputusan ini bisa ditinjau ulang oleh koordinator —
  tetapi bukan bagian dari rilis web pertama.

### 3.2 Firebase Spark — DITOLAK (limit terlalu ketat + compute berbayar)

- **Alasan 1 — Firestore terlalu ketat:** Spark memberi Firestore
  hanya 50 ribu baca dan 20 ribu tulis per hari — jauh lebih ketat
  dari D1 (5 juta baca / 100 ribu tulis per hari).
- **Alasan 2 — compute butuh kartu:** Cloud Functions membutuhkan
  paket Blaze (kartu kredit) sehingga AI server-side tetap butuh
  compute lain. Itu melanggar prinsip budget nol tanpa kartu.
- **Angka limit (terverifikasi 17 November 2026):** Firestore
  Spark 50.000 baca/hari, 20.000 tulis/hari.

### 3.3 Turso — DITOLAK (ketidakpastian masa depan + tanpa compute)

- **Alasan 1:** database diarsipkan setelah 10 hari tidak aktif.
- **Alasan 2:** Turso sedang diakuisisi Supabase — masa depan
  layanannya tidak pasti.
- **Alasan 3:** Turso tidak menyediakan compute, sehingga API tetap
  butuh Workers. Memakai Turso berarti menambah satu penyedia tanpa
  menghilangkan kebutuhan Workers.
- **Angka (terverifikasi 17 November 2026):** pengarsipan setelah
  10 hari tidak aktif.

### 3.4 KV untuk sesi — DILARANG

- **Alasan:** KV writes hanya 1.000 per hari — terlalu sedikit
  untuk sesi login. Sesi disimpan di D1.
- **Angka (terverifikasi 17 November 2026):** KV writes 1.000/hari.

### 3.5 Kunci API di client — DILARANG

- **Alasan:** kunci apa pun yang ada di bundle frontend bisa dibaca
  siapa saja yang membuka situs. Kunci Gemini dan client secret
  Google OAuth hanya ada sebagai secret Worker.

## 4. Perbandingan limit free tier (angka terverifikasi 17 November 2026)

| Layanan | Baca/hari | Tulis/hari | Penyimpanan | Kartu kredit |
|---|---|---|---|---|
| D1 (dipakai) | 5.000.000 baris | 100.000 baris | 500 MB/database, 5 GB total akun, 10 database | Tidak |
| Firestore Spark (ditolak) | 50.000 | 20.000 | — (tidak dicatat) | Tidak untuk Spark; Blaze butuh kartu untuk Functions |
| KV writes (batas sesi) | — | 1.000 | — | Tidak |

Catatan: sel yang bertanda "— (tidak dicatat)" berarti angka itu
tidak diberikan koordinator dan tidak diverifikasi untuk dokumen
ini — bukan nol, melainkan tidak tercatat. Jangan mengisi angka itu
tanpa verifikasi.

## 5. Sumber verifikasi

| Klaim | Sumber | Tanggal |
|---|---|---|
| Limit D1 (5 jt baca, 100 rb tulis, 500 MB/db, 5 GB total, 10 db, tanpa kartu, reset 00:00 UTC) | Verifikasi live koordinator (dokumentasi + dashboard Cloudflare) | 17 Nov 2026 |
| Pages static requests gratis tanpa batas | Verifikasi live koordinator | 17 Nov 2026 |
| KV writes 1.000/hari | Verifikasi live koordinator | 17 Nov 2026 |
| Kuota Gemini free tier: Flash 20 RPD, Flash-Lite 500 RPD (model utama Flash-Lite) | Sumber sekunder — wajib dikonfirmasi di halaman rate limit AI Studio sebelum peluncuran | 17 Nov 2026 |
| Supabase: akun adiprmx 2/2 proyek, limit per akun, organisasi baru tidak menambah jatah | Supabase Management API (akun adiprmx) + uji organisasi kedua | 12 Nov 2026 & 17 Nov 2026 |
| Firestore Spark: 50 rb baca / 20 rb tulis per hari; Cloud Functions butuh Blaze/kartu | Verifikasi live koordinator | 17 Nov 2026 |
| Turso: arsip setelah 10 hari tidak aktif; diakuisisi Supabase; tanpa compute | Verifikasi live koordinator | 17 Nov 2026 |

## 6. Changelog dokumen

### 17 November 2026 — Rekonsiliasi dokumen (Gelombang 3)

- Model AI utama dicatat: Gemini Flash-Lite, 500 RPD (K-06);
  model Flash (20 RPD) tidak dipakai sebagai model utama.
- Rate limit diputuskan via tabel D1 `rate_limits` (K-02),
  bukan fitur platform.

### 17 November 2026 — versi awal

- Keputusan stack lengkap: dipakai / tidak dipakai / kenapa,
  dengan angka limit free-tier terverifikasi dan sumbernya.
