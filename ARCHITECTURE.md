# ARCHITECTURE.md: Dokter HP Web App

> **Dokumen arsitektur Dokter HP Web App (full-stack).**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen, 17 November 2026.
>
> Stack sudah diputuskan koordinator dan terverifikasi live
> 17 November 2026. Dokumen ini menjelaskan arsitektur yang diputuskan
> itu, bukan mengusulkan alternatif. Alasan tiap keputusan ada di
> `docs/keputusan-stack.md`.

---

## 1. Gambaran sistem

```
┌────────────────────────────┐
│  Pengguna (browser HP)     │
│  lebar mulai 360 px        │
└────────────┬───────────────┘
             │ HTTPS
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌─────────────┐  ┌──────────────┐
│ Cloudflare  │  │ Vercel       │
│ Pages       │  │ (mirror 2)   │
│ (utama)     │  │ frontend     │
│ frontend    │  │ yang sama    │
│ statis      │  │              │
└──────┬──────┘  └──────┬───────┘
       │                │
       │  API calls     │  API calls
       │  (fetch)       │  (fetch)
       └───────┬────────┘
               ▼
┌──────────────────────────────┐
│ Cloudflare Worker (Hono)     │
│ API: auth, data, AI          │
│ - Google OAuth (server-side) │
│ - PIN SHA-256 + salt         │
│ - Sesi (token hash di D1)    │
│ - Gemini via secret server   │
│ - Rate limit + validasi      │
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
┌─────────────┐  ┌──────────────┐
│ D1 (SQLite  │  │ KV           │
│ serverless) │  │ (hanya data  │
│ semua data  │  │ yang jarang  │
│ inti        │  │ berubah)     │
└─────────────┘  └──────────────┘
       │
       │  (server-side, secret)
       ▼
┌──────────────────────────────┐
│ Google Gemini API            │
│ (Diagnosis AI — kunci hanya  │
│  di secret Worker)           │
└──────────────────────────────┘
```

### 1.1 Prinsip arsitektur

1. **Backend + database sendiri.** Data inti (pengguna, riwayat,
   diagnosis) tinggal di D1 yang dikelola proyek ini. Tidak ada
   ketergantungan pada API/situs pihak ketiga untuk data inti.
2. **Secret tidak pernah ke browser.** Kunci Gemini, client secret
   Google OAuth, dan secret lain hanya ada sebagai secret Worker.
3. **Frontend statis, logika di Worker.** Pages hanya menyajikan
   file statis; semua logika bisnis dan akses data lewat Worker API.
4. **Dua mirror, satu API.** Pages (utama) dan Vercel (mirror)
   menyajikan build frontend yang sama; keduanya memanggil Worker
   API yang sama.
5. **Sesi di D1, bukan di KV.** KV writes hanya 1.000/hari — terlalu
   sedikit untuk sesi. Sesi disimpan sebagai token hash di D1.
6. **Budget nol rupiah.** Semua komponen berjalan di free tier tanpa
   kartu kredit (lihat `docs/keputusan-stack.md`).

## 2. Struktur direktori

### 2.1 Frontend (`apps/web/` atau root repo frontend)

```
apps/web/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.js
  public/
    speedtest-1mb.bin        # File 1 MB untuk tes kecepatan unduh
    favicon.svg
  src/
    main.tsx                 # Entry: Router + store
    App.tsx                  # Shell + rute
    index.css                # Tailwind + token desain "Alat ukur"
    lib/
      api.ts                 # Client fetch ke Worker API
      speedtest.ts           # Tes unduh 1 MB + latensi HTTP
      pdf.ts                 # Laporan PDF client-side (jsPDF)
      format.ts              # Format angka/tanggal (Indonesia)
    store/
      auth.ts                # Zustand: status sesi + pengguna
      health.ts              # Zustand: skor + riwayat (cache UI)
    components/
      ScoreRing.tsx          # Cincin skor 0-100
      DoctorCard.tsx         # Kartu tiap dokter
      EmptyState.tsx         # Empty state jujur
      ErrorState.tsx         # Galat + tombol "Coba lagi"
      LoadingState.tsx       # Status memuat + teks penjelas
      SpeedChart.tsx         # Grafik tes bertahan 30 detik
      ScoreHistoryChart.tsx  # Grafik riwayat skor
      InfoRow.tsx            # Baris label-nilai
    pages/
      LandingPage.tsx        # /
      LoginPage.tsx          # /masuk
      LockPage.tsx           # /kunci (PIN)
      DashboardPage.tsx      # /dashboard
      WifiPage.tsx           # /wifi
      BatteryPage.tsx        # /baterai
      StoragePage.tsx        # /penyimpanan
      PerformancePage.tsx    # /performa
      SecurityPage.tsx       # /keamanan
      AiPage.tsx             # /ai
      HistoryPage.tsx        # /riwayat
      SettingsPage.tsx       # /pengaturan
```

### 2.2 Worker API (`apps/api/`)

```
apps/api/
  package.json
  wrangler.toml              # Binding D1 + KV + secret (tanpa nilai secret)
  src/
    index.ts                 # Entry Hono + rute
    lib/
      db.ts                  # Helper query D1
      auth.ts                # Verifikasi sesi, hash PIN, hash token
      google.ts              # OAuth Google (code exchange server-side)
      gemini.ts              # Panggilan Gemini (secret server-side)
      ratelimit.ts           # Rate limit per pengguna / per IP
      validate.ts            # Validasi payload (validator tulisan tangan)
      errors.ts              # Envelope galat JSON standar
    routes/
      auth.ts                # /api/auth/* (Google OAuth, PIN, sesi)
      health.ts              # /api/health-checks/*
      wifi.ts                # /api/wifi-reports/* (termasuk /:id/samples)
      ai.ts                  # /api/ai/*
      account.ts             # /api/account/* (profil, sesi, ekspor, hapus akun)
      misc.ts                # /api/health (liveness), /api/ping (latensi HTTP),
                             # /api/speedtest/info
  migrations/
    0001_init.sql            # Skema D1 (bagian 5 dokumen ini)
```

### 2.3 Repo dan deploy

- Satu repo untuk frontend + worker (monorepo dua folder), atau dua
  repo terpisah — diputuskan tim implementasi; dokumen ini memakai
  monorepo sebagai acuan.
- Cloudflare Pages: deploy dari folder frontend (build `npm run build`,
  output `dist`).
- Vercel: deploy dari folder frontend yang sama (framework preset
  Vite), variabel lingkungan `VITE_API_BASE_URL` mengarah ke Worker
  yang sama.
- Worker: deploy lewat Wrangler (`wrangler deploy`), D1 dibuat sekali
  (`wrangler d1 create`), migrasi diterapkan lewat
  `wrangler d1 migrations apply`.

## 3. Endpoint API

Basis URL: `https://api.dokter-hp.<domain>` (Worker; domain persis
diputuskan saat deploy — memakai subdomain Workers
`<nama>.workers.dev` atau custom domain bila tersedia).

Total **31 endpoint bernomor** (K-01, K-07, K-33, K-43, K-60, K-89):
Auth 8, health checks 4, WiFi 6, AI 2, akun 6, utilitas 3,
riwayat gabungan 2. Semua path memakai awalan `/api` — Worker
me-mount router di `/api` (`apps/api/src/index.ts`).

`DELETE /api/history/:jenis/:id` (§3.7) adalah endpoint #30
(K-60): satu rute parameter, bukan tiga rute terpisah.
`GET /api/auth/status` (§3.1) adalah endpoint #31 (K-89):
status ketersediaan login Google untuk halaman `/masuk`.

Semua respons memakai envelope JSON standar:

```json
// Sukses
{ "success": true, "data": { "..." }, "meta": { "timestamp": "..." } }
// Galat
{ "success": false, "error": { "code": "KODE_GALAT", "message": "Pesan bahasa sehari-hari" } }
```

Kolom Response di tabel §3.1–§3.7 menampilkan isi `data` saja;
badan lengkap selalu memakai envelope di atas (K-24).

Autentikasi: cookie HttpOnly `__Host-dokter_hp_session` berisi token sesi
mentah. Worker menghitung SHA-256 token, mencocokkan `token_hash`
di tabel `sessions`, dan memeriksa masa berlaku. Endpoint bertanda
🔒 butuh sesi valid. Endpoint publik tidak butuh sesi.

Saat sesi terkunci PIN (K-05), hanya lima endpoint yang boleh
dipanggil: `GET /api/auth/me`, `POST /api/auth/pin/set`,
`POST /api/auth/pin/verify`, `POST /api/auth/pin/delete`, dan
`POST /api/auth/logout`. Endpoint lain menolak dengan kode
`SESSION_LOCKED` (403).

### 3.1 Auth

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/auth/google` | Publik | — (redirect ke Google) | Redirect 302 ke Google OAuth (state + PKCE) |
| GET | `/api/auth/google/callback` | Publik | `?code=...&state=...` | Buat/ambil pengguna, buat sesi, set cookie, redirect ke `/dashboard` |
| GET | `/api/auth/status` | Publik | — | `{ "google_tersedia": true/false }` — true hanya bila Client ID + Client Secret + Redirect URI terisi; tidak pernah berisi nilai secret (endpoint #31, K-89) |
| POST | `/api/auth/pin/set` | 🔒 | `{ "pin": "2846", "pin_lama": "1357" }` (PIN 4-8 digit; `pin_lama` wajib bila PIN sudah diatur, kecuali tenggang login Google ≤10 menit — K-70, K-81) | `{ "pin_diatur": true, "sesi_terkunci": true }`; TIDAK PERNAH membuka sesi; PIN lemah ditolak (400 `PIN_LEMAH`) |
| POST | `/api/auth/pin/verify` | 🔒 | `{ "pin": "2846" }` | `{ "valid": true }` atau 401; kunci 30 dtk setelah 5 salah berturut-turut |
| POST | `/api/auth/pin/delete` | 🔒 | `{ "pin_lama": "1357" }` (wajib bila PIN sudah diatur, kecuali tenggang ≤10 menit — K-70, K-81) | `{ "pin_diatur": false }` |
| POST | `/api/auth/logout` | 🔒 | — | Hapus sesi di D1 + hapus cookie |
| GET | `/api/auth/me` | 🔒 | — | `{ "id", "nama", "email", "pin_diatur", "sesi_terkunci", "sesi_kedaluwarsa_pada" }` (boleh saat sesi terkunci PIN) |

### 3.2 Health checks (pemeriksaan kesehatan)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/health-checks` | 🔒 | `?limit=20&cursor=...` | Daftar milik pengguna (filter `deleted_at IS NULL`), terbaru dulu; paginasi cursor keyset (K-32) |
| GET | `/api/health-checks/:id` | 🔒 | — | Satu pemeriksaan milik pengguna |
| POST | `/api/health-checks` | 🔒 | `{ "skor": 0-100, "ringkasan": {...} }` | Baris baru (`sync_status: "synced"`) |
| DELETE | `/api/health-checks/:id` | 🔒 | — | Soft-delete (`deleted_at` diisi) |

### 3.3 WiFi reports

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/wifi-reports` | 🔒 | `?limit=20&cursor=...` | Daftar milik pengguna, terbaru dulu; paginasi cursor keyset (K-32) |
| GET | `/api/wifi-reports/:id` | 🔒 | — | Satu laporan + sampel tes bertahan bila ada |
| POST | `/api/wifi-reports` | 🔒 | `{ "ssid", "kecepatan_koneksi_mbps", "kekuatan_sinyal", "channel", "dns", "ping_ms", "rekomendasi", "kecepatan_unduh_kbps", "sumber", "durasi_tes_detik" }` | Baris baru |
| POST | `/api/wifi-reports/:id/samples` | 🔒 | `{ "samples": [{ "detik_ke": 0-29, "kecepatan_kbps": n }] }` | Sampel tersimpan (maks 30 per laporan) |
| GET | `/api/wifi-reports/:id/samples` | 🔒 | — | Daftar sampel tes bertahan satu laporan, urut `detik_ke` menaik; tanpa paginasi (maks 30) |
| DELETE | `/api/wifi-reports/:id` | 🔒 | — | Soft-delete (kolom `deleted_at` — lihat bagian 5) |

Catatan: tes tanpa akun (landing) tidak memanggil endpoint ini —
hasilnya hanya tampil di layar dan tidak tersimpan.

### 3.4 Diagnosis AI

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/ai/diagnose` | 🔒 | `{ "pertanyaan": "...", "health_check_id": "..." (opsional) }` | Objek diagnosis lengkap (`id`, `pertanyaan`, `jawaban`, `dibuat_pada`), tersimpan ke `ai_diagnoses` |
| GET | `/api/ai/diagnoses` | 🔒 | `?limit=20&cursor=...` | Riwayat tanya jawab milik pengguna; paginasi cursor keyset (K-38) |

Worker merakit konteks dari riwayat pengguna (pemeriksaan terakhir +
laporan WiFi terakhir) dan mengirimnya bersama pertanyaan ke Gemini.
Kunci Gemini hanya di secret Worker dan dikirim lewat header
`x-goog-api-key`, bukan query string (R-19). Kuota harian dicadangkan
secara atomik SEBELUM memanggil Gemini (reserve-then-confirm, R-05);
cadangan dilepas bila Gemini gagal, sehingga kegagalan tidak memotong
kuota. Alias lama
`POST /api/ai/tanya` + `GET /api/ai/riwayat` tetap hidup;
path tanpa awalan `/api` dihapus (K-37). Diagnosis selalu
mengembalikan 200 bila pertanyaan valid (K-23): saat Gemini
gagal, Worker memakai jawaban aturan berlabel saran (tidak
tersimpan, tidak memotong kuota).

### 3.5 Akun

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/account/profile` | 🔒 | — | `{ "id", "nama", "email", "dibuat_pada" }` |
| PATCH | `/api/account/profile` | 🔒 | `{ "nama": "..." }` | Profil diperbarui |
| GET | `/api/account/sessions` | 🔒 | — | Daftar sesi aktif milik pengguna |
| DELETE | `/api/account/sessions/:id` | 🔒 | — | Keluar dari sesi itu |
| DELETE | `/api/account` | 🔒 | `{ "konfirmasi": "HAPUS" }` atau `{ "konfirmasi": "DELETE" }` | Hapus akun + seluruh data, dihapus eksplisit per tabel (K-26); wajib autentikasi baru ≤10 menit, bila tidak 403 `LOGIN_ULANG_DIPERLUKAN` (K-72) |
| GET | `/api/account/export` | 🔒 | — | Unduhan file JSON seluruh data pengguna (profil, health checks, laporan WiFi + sampel, diagnosis AI); maks 5.000 baris per tabel + 30.000 sampel (K-04), rate limit 5/hari via tabel D1 `rate_limits` (429 `RATE_LIMITED`, K-42/K-59) |

### 3.6 Utilitas (publik)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/health` | Publik | — | `{ "status": "ok" }` (liveness, tanpa akses D1) |
| GET | `/api/ping` | Publik | — | `{ "ok": true, "t": <ms> }` — target latensi HTTP; respons kecil, tanpa akses D1 |
| GET | `/api/speedtest/info` | Publik | — | `{ "file": "/speedtest-1mb.bin", "ukuran_byte": 1048576, "ukuran_label": "1 MB", "timeout_detik": 15, "tes_bertahan_detik": 30, "ip_publik": "<CF-Connecting-IP atau null>" }` (tanpa akses D1) |

### 3.7 Riwayat gabungan

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/history` | 🔒 | `?jenis=kesehatan\|wifi\|ai\|semua&limit=20&cursor=...` | Tiga jenis data digabung, terbaru dulu; tiap item `{ "jenis", "id", "dibuat_pada", "data" }` dengan proyeksi ringkas per jenis |
| DELETE | `/api/history/:jenis/:id` | 🔒 | — | Hapus satu entri: soft-delete untuk `kesehatan`/`wifi`, hapus permanen untuk `ai` (endpoint #30, K-60) |

Halaman Riwayat memanggil `GET /api/history` satu kali
(100 entri terbaru) dan memetakan item ke daftar; paginasi
cursor berlaku pada urutan gabungan (tiap jenis diambil
`limit + 1` dengan klausa cursor yang sama, lalu digabung
dan dipotong ke `limit`).

## 4. Alur

### 4.1 Auth Google + PIN + sesi

```
1. Pengguna ketuk "Masuk dengan Google"
   → Browser ke GET /api/auth/google
2. Worker buat state + code_verifier (PKCE), simpan sementara
   di cookie HttpOnly singkat, redirect ke Google
3. Google redirect balik ke /api/auth/google/callback?code=...
4. Worker tukar kode → token di SERVER (client_secret tidak pernah
   keluar dari Worker), ambil profil Google (sub, email, nama)
5. Worker cari/buat baris users (kunci email + provider='google')
   + profiles
6. Worker buat token sesi acak (32 byte), simpan SHA-256-nya di
   tabel sessions (kedaluwarsa 30 hari), set cookie HttpOnly
   Secure SameSite=None bernama __Host-dokter_hp_session;
   maksimal 10 sesi per pengguna — sesi tertua dihapus saat
   login baru (R-22)
7. Browser redirect ke /dashboard
8. Bila PIN diatur: /dashboard redirect ke /kunci; pengguna masukkan
   PIN → POST /api/auth/pin/verify → Worker bandingkan HMAC-SHA256
   memakai pepper secret PIN_PEPPER + salt per pengguna (K-71) →
   bila cocok, Worker mencatat pembukaan sesi di
   tabel pin_unlocks (baris session_id; tidak ada kolom terkunci
   di tabel sessions) → redirect ke /dashboard
9. Setiap request API: Worker verifikasi cookie → hash token →
   cari sesi → cek kedaluwarsa + cek terkunci (kecuali lima
   endpoint yang diizinkan saat terkunci — lihat bagian 3) →
   user_id dari sesi dipakai di semua query
10. Keluar: DELETE sesi di D1 + hapus cookie
```

Halaman `/masuk` memeriksa `GET /api/auth/status` saat dimuat
(K-89): bila login Google belum disiapkan di server, tombol Google
tampil nonaktif dengan teks jujur "belum disiapkan" dan pengguna
tidak pernah diarahkan ke alur masuk yang pasti gagal. Bila
pemanggilan status gagal (API tidak terjangkau), tombol tampil
seperti biasa (fail-open); bila konfigurasi ternyata belum lengkap,
`GET /api/auth/google` mengarahkan browser kembali ke
`/masuk?error=oauth_belum_disiapkan` sebagai jaring pengaman.

Keamanan sesi:

- Token mentah tidak pernah disimpan di mana pun kecuali cookie
  pengguna. Yang disimpan hanya SHA-256-nya.
- Cookie: HttpOnly, Secure, SameSite=None, Path=/, Max-Age 30 hari
  (K-50), prefix `__Host-` (R-18).
- Sesi kedaluwarsa 30 hari sejak dibuat; perpanjangan (sliding)
  opsional di fase berikutnya.
- PIN salah 5x berturut-turut → `terkunci_sampai` = sekarang +
  30 detik; percobaan selama terkunci ditolak tanpa memeriksa PIN.
  Penghitung memakai increment atomik satu pernyataan SQL (R-04).
- Hash PIN = HMAC-SHA256(pepper `PIN_PEPPER`, `salt:pin`) (K-71);
  bila pepper tidak diatur, endpoint PIN mengembalikan 500
  (fail-closed). PIN lemah (digit sama / berurutan) ditolak saat
  diatur (K-70d).
- Ubah/hapus PIN wajib PIN lama bila PIN sudah diatur (terkunci
  maupun tidak), kecuali login Google segar ≤10 menit (K-70,
  K-81); `/pin/set` TIDAK PERNAH membuka sesi. Hapus akun wajib
  autentikasi baru ≤10 menit (K-72).

### 4.2 Alur Diagnosis AI

```
1. Pengguna kirim pertanyaan dari /ai
2. Frontend POST /api/ai/diagnose { pertanyaan, health_check_id? }
3. Worker: verifikasi sesi → rate limit (lihat bagian 6) →
   cadangkan satu kuota harian secara atomik (reserve-then-confirm,
   R-05); bila kuota habis → 429 AI_QUOTA_HABIS
4. Worker: ambil konteks dari D1 — pemeriksaan terakhir +
   laporan WiFi terakhir milik pengguna (tanpa data pengguna lain)
5. Worker: panggil Gemini model Flash-Lite (model utama, K-06;
   kunci dari secret Worker) dengan prompt:
   konteks data + pertanyaan; instruksi: jawab Bahasa Indonesia,
   saran praktis, akui bila data tidak cukup, jangan mengarang
6. Worker: simpan pertanyaan + jawaban ke ai_diagnoses
7. Worker: kembalikan jawaban ke frontend
8. Bila Gemini galat/timeout atau kuota habis: cadangan kuota
   DILEPAS, lalu kembalikan diagnosis cadangan tanpa AI (aturan
   berbasis data pemeriksaan pengguna) dengan label jujur bahwa
   ini bukan jawaban AI — atau galat jujur bila data tidak cukup
   ("Diagnosis AI sedang tidak tersedia, coba lagi nanti").
   Jangan pernah mengarang jawaban
```

Model AI: Gemini Flash-Lite adalah model utama (K-06) — kuota
free tier 500 request/hari per proyek, jauh di atas model Flash
(20 request/hari). Batas per pengguna tetap 20/hari. Jawaban AI
di-cache (D1/KV) agar pertanyaan berulang tidak menghabiskan
kuota. Angka RPD bersumber sekunder (dokumentasi resmi Google
tidak memublikasikan angka per model) — wajib dikonfirmasi di
halaman rate limit AI Studio sebelum peluncuran.

### 4.3 Alur tes kecepatan web

```
1. Pengguna ketuk "Periksa WiFi sekarang" di /wifi
2. Frontend: GET /api/ping (3x, ambil median) → latensi HTTP
3. Frontend: unduh /speedtest-1mb.bin dari Pages (file statis
   milik sendiri) dengan timeout 15 detik, ukur waktu dengan
   performance.now() → kecepatan unduh KB/detik
4. Frontend: baca navigator.connection bila tersedia (jenis
   koneksi, downlink) — tampilkan bila ada, "tidak tersedia" bila tidak
5. Frontend: hitung klasifikasi + rekomendasi (logika sama dengan APK)
6. Bila masuk: POST /api/wifi-reports menyimpan hasil
7. Tes bertahan: ulangi unduh potongan tiap detik selama 30 detik,
   kumpulkan 30 sampel → POST /api/wifi-reports/:id/samples
```

### 4.4 Alur laporan PDF

```
1. Pengguna ketuk "Unduh laporan PDF" di /riwayat
2. Frontend: GET /api/health-checks + /api/wifi-reports (data real via API)
3. Frontend: rakit PDF dengan jsPDF di browser (tanpa server)
4. Browser mengunduh file PDF
```

## 5. Skema D1

SQLite (D1). UUID sebagai TEXT, timestamptz sebagai TEXT ISO 8601,
jsonb sebagai TEXT JSON. Nama tabel dan kolom inti sama dengan
migrasi Supabase APK (`supabase/migrations/` di repo `adiprmx/dokter-hp`).

Blok SQL di bawah ini adalah salinan persis migrasi
`apps/api/migrations/0001_init.sql` s.d. `0004_pin_rate_sessions.sql`
(K-74) — migrasi adalah sumber kebenaran; bila blok ini dan migrasi
berbeda, migrasi yang menang. Perhatikan: hanya
`wifi_sustained_samples` yang memakai klausul `REFERENCES`
(FK nyata); tabel lain TIDAK memakai REFERENCES — penghapusan
berantai ditegakkan eksplisit di kode (K-26). Semua indeks
bernama `idx_*`; semua `dibuat_pada`/`updated_at` TANPA default
strftime (Worker mengikat nilainya eksplisit), kecuali
`wifi_reports.updated_at` yang memakai default backfill 0003.

D1 tidak punya Row Level Security — penegakan kepemilikan data
dilakukan di kode Worker: setiap query WAJIB memfilter `user_id`
dari sesi yang terverifikasi. Uji kepemilikan (pengguna A tidak bisa
membaca data pengguna B) adalah bagian wajib dari kriteria selesai.

```sql
-- 0001_init.sql — Skema D1 Dokter HP Web App
-- Kompatibel kolom dengan migrasi Supabase APK (nama tabel/kolom sama).

-- ------------------------------------------------------------------
-- users (tambahan web): identitas akun.
-- Pengguna Google dikunci email + provider='google'
-- (tidak ada kolom google_sub; nama Google hanya dipakai
-- untuk pengguna baru — K-03).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nama TEXT,
  provider TEXT NOT NULL,
  pin_hash TEXT,
  pin_salt TEXT,
  dibuat_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_dibuat_pada ON users (dibuat_pada);

-- ------------------------------------------------------------------
-- profiles: cermin migrasi 20261111000001_create_profiles.sql.
-- id sama dengan id pengguna (users.id).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  nama TEXT,
  dibuat_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_dibuat_pada ON profiles (dibuat_pada);

-- ------------------------------------------------------------------
-- sessions (tambahan web): sesi login.
-- token_hash = SHA-256 hex dari token sesi mentah.
-- Token mentah TIDAK PERNAH disimpan.
-- Status kunci PIN TIDAK ada di tabel ini: sesi yang sudah dibuka
-- dengan PIN ditandai baris di tabel pin_unlocks (migrasi 0004,
-- K-48). dibuat_pada tanpa DEFAULT — semua INSERT mengikat
-- nilainya secara eksplisit.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL,
  user_agent TEXT,
  ip_terakhir TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ------------------------------------------------------------------
-- health_checks: cermin migrasi 20261111000002_create_health_checks.sql.
-- ringkasan: TEXT JSON (status baterai, penyimpanan, performa,
-- keamanan, dan sumber tiap komponen).
-- sync_status: 'pending' | 'synced' | 'failed'.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skor INTEGER NOT NULL CHECK (skor BETWEEN 0 AND 100),
  ringkasan TEXT,
  dibuat_pada TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_health_checks_user_id ON health_checks (user_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_dibuat_pada ON health_checks (dibuat_pada);

-- ------------------------------------------------------------------
-- wifi_reports: cermin migrasi 20261111000003_create_wifi_reports.sql.
-- Kolom tambahan web (0003): kecepatan_unduh_kbps (hasil tes unduh),
-- sumber ('web' | 'apk' | 'manual'), durasi_tes_detik,
-- deleted_at (soft-delete), updated_at.
-- ping_ms = latensi HTTP (bukan ICMP).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wifi_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ssid TEXT,
  kecepatan_koneksi_mbps REAL,
  kekuatan_sinyal TEXT,
  channel INTEGER,
  dns TEXT,
  ping_ms INTEGER,
  rekomendasi TEXT,
  dibuat_pada TEXT NOT NULL,
  kecepatan_unduh_kbps REAL,
  sumber TEXT NOT NULL DEFAULT 'web',
  durasi_tes_detik INTEGER,
  updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wifi_reports_user_id ON wifi_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_wifi_reports_dibuat_pada ON wifi_reports (dibuat_pada);

-- ------------------------------------------------------------------
-- wifi_sustained_samples (tambahan web): sampel per detik dari tes
-- bertahan 30 detik. detik_ke 0-29.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wifi_sustained_samples (
  id TEXT PRIMARY KEY,
  wifi_report_id TEXT NOT NULL REFERENCES wifi_reports (id) ON DELETE CASCADE,
  detik_ke INTEGER NOT NULL CHECK (detik_ke >= 0 AND detik_ke < 30),
  kecepatan_kbps REAL NOT NULL,
  dibuat_pada TEXT NOT NULL,
  UNIQUE (wifi_report_id, detik_ke)
);

CREATE INDEX IF NOT EXISTS idx_wifi_sustained_samples_report
  ON wifi_sustained_samples (wifi_report_id);

-- ------------------------------------------------------------------
-- ai_diagnoses: cermin migrasi 20261111000004_create_ai_diagnoses.sql.
-- health_check_id boleh NULL (pertanyaan tanpa pemeriksaan tertentu).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_diagnoses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  health_check_id TEXT,
  pertanyaan TEXT NOT NULL,
  jawaban TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_user_id ON ai_diagnoses (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_dibuat_pada ON ai_diagnoses (dibuat_pada);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_health_check_id ON ai_diagnoses (health_check_id);

-- ------------------------------------------------------------------
-- ai_cache (0002): cache jawaban Gemini per pengguna.
-- pertanyaan_hash = SHA-256 dari konteks + id pengguna +
-- pertanyaan ternormalisasi + sidik jari data pemeriksaan.
-- TTL 7 hari ditegakkan di kode, bukan di skema.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  pertanyaan_hash TEXT NOT NULL UNIQUE,
  jawaban TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_pertanyaan_hash ON ai_cache (pertanyaan_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_dibuat_pada ON ai_cache (dibuat_pada);

-- ------------------------------------------------------------------
-- pin_attempts + pin_unlocks (0004, K-48): penghitung PIN salah
-- dan penanda sesi yang sudah dibuka dengan PIN.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pin_attempts (
  user_id TEXT PRIMARY KEY,
  gagal_berturut INTEGER NOT NULL DEFAULT 0,
  terkunci_sampai TEXT
);

CREATE TABLE IF NOT EXISTS pin_unlocks (
  session_id TEXT PRIMARY KEY,
  dibuka_pada TEXT NOT NULL
);

-- ------------------------------------------------------------------
-- rate_limits (tambahan web): penghitung rate limit (K-02).
-- Satu baris per kunci (pengguna/endpoint/jendela waktu).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  kunci TEXT PRIMARY KEY,
  jumlah INTEGER NOT NULL DEFAULT 0,
  jendela_mulai TEXT NOT NULL,
  kedaluwarsa_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_kedaluwarsa ON rate_limits (kedaluwarsa_pada);
```

### 5.1 Catatan skema

- `id` dibuat di Worker sebagai UUID v4 (`crypto.randomUUID()`),
  bukan oleh database — D1/SQLite tidak punya `gen_random_uuid()`.
- `updated_at` diperbarui oleh kode Worker pada setiap UPDATE
  (D1 tidak memakai trigger `set_updated_at` dari migrasi Supabase;
  tim implementasi boleh menambahkan trigger SQLite bila mau, tetapi
  pembaruan di kode adalah sumber kebenaran).
- `FOREIGN KEY ... ON DELETE CASCADE` hanya ada di
  `wifi_sustained_samples.wifi_report_id` — satu-satunya FK nyata
  di skema (0003). Tabel lain TIDAK memakai `REFERENCES`:
  penghapusan berantai ditegakkan eksplisit di kode saat hapus
  akun (DELETE per tabel, K-26), bukan oleh database. Worker
  tidak bergantung pada `PRAGMA foreign_keys`.
- `ringkasan` di `health_checks` adalah TEXT JSON; Worker memvalidasi
  JSON sebelum simpan.
- Kolom `sync_status` dipertahankan agar sinkron APK di masa depan
  memakai penanda yang sama (`pending` / `synced` / `failed`).
  Baris yang dibuat lewat web langsung `synced`.
- Tabel `rate_limits` menyimpan penghitung rate limit (K-02);
  baris yang kedaluwarsa dibersihkan malas oleh Worker saat
  kunci baru dibuat, maksimal 100 baris per pembersihan (R-15).
- `sumber` di `wifi_reports` dan `sync_status` di `health_checks`
  TIDAK memakai CHECK di skema — nilai yang diizinkan ditegakkan
  validator di kode Worker.

## 6. Rate limit dan keamanan

### 6.1 Rate limit

| Endpoint | Batas | Alasan |
|---|---|---|
| `POST /api/ai/diagnose` | 20/hari per pengguna | Lindungi kuota Gemini bersama; cadangan atomik sebelum panggil Gemini (R-05) |
| `POST /api/auth/pin/verify` | 5 percobaan, lalu kunci 30 dtk | Cegah tebakan PIN |
| `GET /api/auth/google` | 10/menit per IP | Cegah penyalahgunaan OAuth |
| Semua endpoint tulis | 60/menit per pengguna | Cegah banjir tulis ke D1 |
| Endpoint baca lain | 300/menit per pengguna | Cegah banjir baca ke D1 |
| `GET /api/account/export` | 5/hari per pengguna | Ekspor membaca seluruh data pengguna |
| `GET /api/ping`, `GET /api/health`, `GET /api/speedtest/info` | Tanpa batas ketat (tanpa D1) | Murah; tanpa akses database |

Implementasi (K-02): penghitung di D1 (tabel `rate_limits`, lihat
bagian 5) — Workers free tier tidak menyediakan rate limiting
per-pengguna bawaan. KV TIDAK dipakai untuk rate limit sesi/tulis
karena writes KV hanya 1.000/hari. Increment penghitung memakai
SATU pernyataan SQL atomik (`INSERT OR IGNORE` + `UPDATE ...
SET jumlah = jumlah + 1 WHERE jumlah < batas`, keputusan dari
`meta.changes`) — pola baca-lalu-tulis DILARANG karena race
condition (R-03/R-04). Penghitung PIN gagal memakai pola atomik
yang sama (upsert increment + baca kembali + kunci terjaga).

Respons saat kena batas: HTTP 429 kode `RATE_LIMITED` (K-59)
dengan envelope galat standar, header `Retry-After`, dan pesan
bahasa sehari-hari ("Terlalu sering, coba lagi sebentar").

### 6.2 Keamanan

- **Validasi input**: semua payload divalidasi di Worker
  (validator tulisan tangan di `lib/validate.ts`, bukan
  pustaka zod): tipe, panjang maksimum, rentang (skor 0-100,
  PIN 4-8 digit angka). Badan JSON dibatasi 100 KB — lebih dari
  itu ditolak 413 `PAYLOAD_TOO_LARGE` (R-20).
- **Kepemilikan**: setiap query data memfilter `user_id` dari sesi.
  Tidak ada endpoint yang menerima `user_id` dari client.
- **SQL injection**: selalu prepared statement dengan parameter
  terikat (`?`); tidak ada string query yang dirakit dari input.
- **XSS**: React meng-escape output secara default; jawaban AI
  ditampilkan sebagai teks (tanpa `dangerouslySetInnerHTML`).
- **CSRF**: cookie sesi `SameSite=None; Secure` (K-50) +
  pemeriksaan header `Origin` pada endpoint mutasi memakai
  logika allowlist yang sama dengan CORS (K-73): Origin ada
  dan tidak diizinkan → 403. Cookie OAuth (state,
  verifier, redirect) sengaja `SameSite=Lax` karena hanya
  dipakai redirect di domain API sendiri.
- **CORS** (K-73): origin yang diizinkan berasal dari daftar
  `ALLOWED_ORIGIN` (dipisah koma). Bila `ALLOWED_ORIGIN` tidak
  diatur, Worker fail-closed: hanya origin loopback dan
  sama-host yang diizinkan — frontend produksi tidak bisa
  memanggil API sampai variabel diatur. Tidak ada wildcard `*`.
  Nilai `state` OAuth dibandingkan waktu-konstan (R-18).
- **Header keamanan** (di Worker dan di Pages/Vercel):
  `Content-Security-Policy: default-src 'self'; script-src
  'self'; style-src 'self'; img-src 'self' data:;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  (tanpa `unsafe-eval`; jsPDF tidak butuh eval),
  `Strict-Transport-Security: max-age=31536000;
  includeSubDomains`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(),
  geolocation=()`. Header Pages (`apps/web/public/_headers`)
  memakai CSP yang sama ditambah `connect-src` ke origin API
  (saat ini wildcard `https://*.workers.dev` sebagai
  placeholder — WAJIB dipersempit ke origin API persis setelah
  deploy, lihat `docs/deploy.md` §4.4).
- **PIN**: hash HMAC-SHA256 dengan pepper secret `PIN_PEPPER`
  + salt per pengguna (K-71); PIN lemah ditolak (K-70d);
  ubah/hapus PIN wajib PIN lama bila PIN sudah diatur, kecuali
  login segar ≤10 menit (K-70, K-81).
- **Hapus akun**: wajib autentikasi baru ≤10 menit (K-72).
- **Secret**: hanya lewat `wrangler secret put` / dashboard
  Cloudflare; tidak pernah di repo, tidak pernah di `wrangler.toml`,
  tidak pernah di variabel lingkungan frontend (`VITE_*` terekspos
  ke browser — hanya `VITE_API_BASE_URL` yang boleh ada).
- **Log**: Worker tidak mencatat token, PIN, atau isi jawaban AI
  secara penuh; log hanya id, status, dan waktu.

### 6.3 Kuota D1 (angka terverifikasi 17 November 2026)

- 5 juta baris dibaca/hari, 100 ribu baris ditulis/hari,
  500 MB per database, 5 GB total akun, 10 database.
- Bila kuota habis, query error sampai reset 00:00 UTC — tanpa
  tagihan (tanpa kartu kredit, tidak ada overage berbayar).
- Mitigasi: query selalu berindeks dan ber-`LIMIT`; daftar memakai
  paginasi; endpoint `/api/ping` dan `/api/health` tidak menyentuh D1;
  Worker mengembalikan galat jujur bila D1 error
  ("Server sedang sibuk, coba lagi nanti").

## 7. Strategi deploy dua mirror

| Aspek | Mirror 1 (utama) | Mirror 2 |
|---|---|---|
| Platform | Cloudflare Pages | Vercel |
| Isi | Build frontend yang sama | Build frontend yang sama |
| API | Worker API | Worker API (sama) |
| Trigger deploy | Push ke main (GitHub Actions / integrasi Pages) | Push ke main (integrasi Vercel) |
| Variabel | `VITE_API_BASE_URL` → Worker | `VITE_API_BASE_URL` → Worker |

Aturan:

- Satu commit → satu build → dua deploy dari build yang sama
  (atau dua build dari commit yang sama; hash build dicatat).
- Uji smoke setelah deploy: buka landing, jalankan tes WiFi tanpa
  akun, masuk Google, simpan satu laporan, buka riwayat — di kedua
  mirror.
- Bila satu mirror down, pengguna dialihkan ke mirror lain lewat
  pengumuman di landing mirror yang hidup (tanpa DNS failover
  otomatis di fase ini).
- Worker API adalah satu-satunya backend; tidak ada API kedua.
  Bila Worker down, kedua mirror menampilkan banner jujur
  "Tidak tersambung ke server" dan tes WiFi tetap jalan lokal.

## 8. Observabilitas

- **Liveness**: `GET /api/health` (tanpa D1) untuk pemantau uptime.
- **Log Worker**: `wrangler tail` saat debugging; log terstruktur
  (waktu, rute, status, durasi ms).
- **Metrik minimal**: jumlah request per endpoint per hari, jumlah
  galat 5xx, pemakaian baris D1 (dibaca/ditulis) — dibaca dari
  dashboard Cloudflare.
- **Tidak ada pelacakan pengguna** (tanpa analytics pihak ketiga).

## 9. Hal yang masih terbuka dan risiko yang diterima

1. **Domain dan nama Worker**: nama subdomain Workers / custom domain
   untuk API dan kedua mirror belum diputuskan.
2. **Akun Cloudflare**: akun Cloudflare mana yang dipakai (akun owner
   yang sudah ada atau akun baru) — diputuskan koordinator.
3. **Client ID Google OAuth**: perlu dibuat di Google Cloud Console
   (gratis, tanpa kartu) dengan redirect URI ke Worker callback.
4. **Kunci Gemini**: secret `GEMINI_API_KEY` perlu diatur sebagai
   secret Worker; kunci sudah TERVERIFIKASI valid 17 November 2026
   22:13 WIB (HTTP 200, 50 model terdaftar — K-20). Yang masih
   terbuka hanya penempatan secret-nya di Worker, bukan validitas
   kunci.
5. **Sinkron APK**: endpoint sinkron APK → D1 adalah fase berikutnya
   dan butuh perubahan di APK.

### 9.1 Risiko yang diterima (Red Team ronde 1, Wave 4)

Keputusan di bawah ini dicatat eksplisit agar Red ronde 2 tidak
membuka ulang temuan yang sama tanpa bukti baru.

- **R-13 — perilaku saat D1 gagal (matriks per endpoint).**
  Kegagalan D1 tidak diperlakukan seragam; tiap endpoint memilih
  perilaku yang paling aman untuk fungsinya:
  - Fail-closed (tolak permintaan): rate limit (`batasLaju` →
    503), verifikasi PIN dan ubah PIN (galat D1 → 500), cek
    autentikasi baru hapus akun (galat D1 → 500).
  - Fail-open + log: mulai OAuth Google (`/api/auth/google`
    tetap redirect bila pencatatan rate limit gagal — alur
    masuk tidak boleh mati karena satu tulis D1 gagal);
    pembersihan malas `rate_limits` (best-effort, galat
    dicatat, permintaan tetap diproses).
  - Fail jujur: endpoint data mengembalikan 500/503 dengan
    pesan "Server sedang sibuk, coba lagi nanti" — tidak
    pernah mengarang data.
- **R-16 — identitas pengguna dikunci email + provider
  (tanpa `google_sub`).** Skema `users` memang tidak menyimpan
  `google_sub` (K-03). Risiko pengambilalihan via daur ulang
  alamat email oleh Google dinilai rendah untuk v1.0 dan
  DITERIMA sesuai desain — tanpa perubahan kode. Bila Google
  mengubah kebijakan daur ulang email, keputusan ini wajib
  ditinjau ulang dan `google_sub` ditambahkan lewat migrasi.
- **R-14 (sebagian) — kunci rate limit per IP dan entri
  `ai_cache` tidak dihapus saat hapus akun.** Kunci per IP
  tidak dapat dikaitkan ke pengguna tertentu (IP dipakai
  bersama), dan entri `ai_cache` dikunci hash satu arah yang
  tidak dapat diurai balik ke pengguna. Keduanya kedaluwarsa
  sendiri (`rate_limits` per jendela, `ai_cache` 7 hari).
  Baris `rate_limits` per pengguna (`%:userId:%`) DIHAPUS
  saat hapus akun.
- **R-08 (sisa) — wildcard `connect-src` di Pages.**
  `apps/web/public/_headers` memakai `connect-src 'self'
  https://*.workers.dev` sebagai placeholder sampai subdomain
  API diketahui. Sisa risiko: halaman bisa memanggil Worker
  lain di `*.workers.dev` — dampak terbatas (tanpa kredensial
  yang dibagikan ke origin lain), dan WAJIB dipersempit ke
  origin API persis setelah deploy (`docs/deploy.md` §4.4).

## 10. Catatan rekonsiliasi

Direkonsiliasi 17 November 2026 oleh Tim Rekonsiliasi Dokumen
(Gelombang 3) berdasarkan keputusan koordinator K-01 s.d. K-11
(`hidden_files/keputusan-koordinator.md`) dan
`docs/api-contracts.md`. Tidak ada keputusan produk yang diubah —
hanya penyelarasan dokumen.

Perubahan yang diterapkan di dokumen ini:

1. Total endpoint dikoreksi menjadi 27 (K-01): tabel §3 berisi
   25 endpoint, ditambah `GET /api/account/export` (§3.5) dan
   `GET /api/speedtest/info` (§3.6). Angka 24 yang disebut
   `docs/api-contracts.md` §0.8 sebagai isi dokumen ini tidak
   ditemukan di teks saat rekonsiliasi — yang ada hanya tabel
   25 endpoint tanpa angka total tertulis.
2. Semua path endpoint memakai awalan `/api` (K-07), sesuai
   mount router di `apps/api/src/index.ts`.
3. Rate limit diputuskan via tabel D1 `rate_limits` (K-02);
   tabel ditambahkan ke skema bagian 5 dan batas baca
   300/menit serta batas ekspor 5/hari ditambahkan ke
   bagian 6.1 agar sama dengan kontrak API.
4. Model AI utama adalah Gemini Flash-Lite (K-06); alur §4.2
   ditambah fallback diagnosis tanpa AI saat kuota habis atau
   layanan tidak tersedia.
5. Aturan sesi terkunci PIN dicatat di bagian 3 dan 4.1 (K-05):
   hanya `/api/auth/me`, PIN set/verify/delete, dan logout
   yang boleh dipanggil; endpoint lain menolak dengan kode
   `SESSION_LOCKED` (403).
6. Batas ekspor 5.000 baris per tabel dicatat di §3.5 (K-04).
7. Item terbuka §9 poin 6 (implementasi rate limit) dihapus
   karena sudah diputuskan (K-02). Domain/nama Worker, akun
   Cloudflare, Client ID Google OAuth, kunci Gemini, dan
   sinkron APK tetap terbuka.
8. Perbaikan lain: rujukan "bagian 5.3" (tidak ada) dikoreksi
   ke "bagian 5"; komentar rute `account.ts` diperbaiki (PIN
   ditangani `auth.ts`, bukan `account.ts`); komentar rute
   `wifi.ts` diperbaiki (tidak ada rute `/wifi-sustained/*` —
   sampel ada di bawah `/api/wifi-reports/:id/samples`); respons
   `/api/auth/me` dan `/api/ai/diagnose` diselaraskan dengan
   kontrak API.

Inkonsistensi di luar cakupan dokumen ini (dicatat untuk tim
terkait, bukan diubah di sini):

- `docs/api-contracts.md` masih menulis semua path tanpa awalan
  `/api` — perlu penyesuaian ke K-07 oleh tim kontrak API.
  **Selesai di Wave 3b (18 November 2026):** semua path di
  kontrak kini memakai awalan `/api`.
- `docs/api-contracts.md` §5 masih mengembalikan 502
  `AI_TIDAK_TERSEDIA` saat Gemini gagal, sementara K-06
  mewajibkan fallback diagnosis tanpa AI — perlu diputuskan
  bagaimana fallback dan kode 502 hidup berdampingan.
  **Selesai di Wave 3b:** 502 pensiun (K-23); diagnosis selalu
  200 dengan fallback aturan berlabel saran.
- `apps/api/src/routes/api.ts` (scaffold) memakai stub
  `/ai-diagnoses/*`, sementara kontrak memakai `/ai/diagnose`
  dan `/ai/diagnoses`; stub `/health` mengembalikan `{ok: true}`
  tanpa envelope standar.
  **Selesai di Wave 3b:** stub 501 dihapus; router auth/data/AI
  terpasang; `/api/health` dan `/api/ping` memakai envelope (K-24).
- `PRODUCT.md` §4.4 menyebut alamat IP publik "dari Worker",
  tetapi tidak ada endpoint di kontrak yang mengembalikan IP
  publik — perlu diputuskan sumbernya.
  **Selesai di Wave 3b:** `GET /api/speedtest/info`
  mengembalikan `ip_publik` dari header `CF-Connecting-IP`
  (K-25).

## 11. Changelog Wave 3b (Tim Integrasi, 18 November 2026)

- Total endpoint 27 → **29 bernomor** (K-33, K-43): tambah
  `GET /api/history` (§3.7) dan `GET
  /api/wifi-reports/:id/samples` (§3.3); `DELETE
  /api/history/:jenis/:id` adalah operasi pendamping tanpa nomor
  (total rute method+path yang benar-benar ada: 30 — menunggu
  keputusan koordinator, lihat `docs/api-contracts.md` §10
  poin 5).
  **Ditutup di Wave 4 (K-60):** `DELETE /api/history/:jenis/:id`
  kini endpoint #30; total kanonis 30 (lihat §12).
- Paginasi cursor keyset di semua endpoint daftar (K-32, K-38);
  query `offset` dihapus dari tabel §3.2–§3.4.
- AI: alias `/api/ai/tanya` + `/api/ai/riwayat`, path tanpa
  `/api` dihapus (K-37); diagnosis selalu 200 (K-23).
- Akun: hapus akun terima `HAPUS` atau `DELETE` (K-26);
  penghapusan eksplisit per tabel (bukan cascade); ekspor
  tambah batas 30.000 sampel + kode 429 `RATE_LIMITED`
  (K-42/K-59).
- Utilitas: `GET /api/speedtest/info` tambah field `ip_publik`
  (K-25).
- §9 poin 4 (kunci Gemini) diperbarui: kunci terverifikasi
  valid 17 November 2026 22:13 WIB (K-20); tinggal penempatan
  secret di Worker.
- Keempat inkonsistensi di §10 ditutup (lihat catatan di atas).

## 12. Changelog Wave 4 (Tim Penutup Dokumen, 18 November 2026)

- Total endpoint 29 → **30 bernomor** (K-60): `DELETE
  /api/history/:jenis/:id` (§3.7) kini endpoint #30 (satu rute
  parameter); riwayat gabungan kini 2 endpoint; catatan
  "pendamping tanpa nomor" di §3 dan §3.7 dihapus.
- §10: dua rujukan path tanpa awalan `/api` dikoreksi ke
  `/api/wifi-reports/:id/samples` dan `/api/health` +
  `/api/ping` (K-07).
- §11 butir endpoint diberi catatan penutup K-60 (entri Wave 3b
  sendiri dipertahankan sebagai catatan sejarah).

## 13. Changelog Wave 4 (Tim Blue — Perbaikan Keamanan, 18 November 2026)

Perbaikan 22 temuan Red Team ronde 1 (R-01–R-22):

- §3: catatan K-75 (tabel menampilkan isi `data` saja);
  nama cookie `__Host-dokter_hp_session` (R-18); tabel PIN
  diperbarui (K-70: `pin_lama`, `sesi_terkunci`, PIN lemah);
  contoh PIN diganti dari `1234` (lemah) ke `2846`;
  AI: cadangan kuota atomik + kunci via header (R-05/R-19);
  hapus akun: autentikasi baru (K-72).
- §4.1: hash PIN HMAC-SHA256 + pepper (K-71); state OAuth di
  cookie saja; maks 10 sesi (R-22); kebijakan PIN (K-70).
- §4.2: langkah cadangan kuota + lepas cadangan (R-05).
- §5 (K-74): SEMUA blok skema diaudit terhadap migrasi
  0001–0004 — REFERENCES palsu dihapus (kecuali
  `wifi_sustained_samples`), nama indeks dikoreksi ke `idx_*`,
  default strftime dihapus, CHECK yang tidak ada di migrasi
  dihapus, urutan kolom `wifi_reports` diselaraskan 0001+0003;
  tambah blok `ai_cache`, `pin_attempts`, `pin_unlocks`.
- §5.1: catatan FK dikoreksi (hanya satu FK nyata);
  pembersihan malas rate limit (R-15).
- §6.1: pola increment atomik (R-03/R-04); cadangan kuota AI.
- §6.2: "zod" diganti validator tulisan tangan
  (`lib/validate.ts`); CORS/CSRF fail-closed (K-73); header
  keamanan persis implementasi; PIN pepper; hapus akun;
  batas body 100 KB (R-20).
- §9: tambah §9.1 risiko diterima (R-13 matriks fail-open/
  fail-closed, R-16 tanpa `google_sub`, R-14 sebagian,
  wildcard `connect-src` Pages).
- Bukti: vitest API 392/392, web 248/248; probe live
  `wrangler dev` port 8789 (R-01/R-02/R-03/R-04/R-06/R-09/
  R-12/R-20 terverifikasi langsung).

## 14. Changelog Wave 5 (Tim Perbaikan OAuth Jujur, 18 November 2026)

- Total endpoint 30 → **31 bernomor** (K-89): `GET /api/auth/status`
  (§3.1) kini endpoint #31 — status ketersediaan login Google
  (`{ google_tersedia: boolean }`, true hanya bila ketiga nilai
  konfigurasi OAuth terisi); Auth kini 8 endpoint.
- §3.1: `GET /api/auth/google` bila konfigurasi OAuth belum lengkap
  kini redirect 302 ke `/masuk?error=oauth_belum_disiapkan`
  (K-89) — bukan lagi 500 JSON mentah di luar UI aplikasi.
- §4.1: halaman `/masuk` memeriksa `/api/auth/status` saat dimuat;
  bila Google belum tersedia, tombol tampil nonaktif dengan teks
  jujur "belum disiapkan" (fail-open bila pemanggilan status gagal).
