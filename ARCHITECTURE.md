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
      validation.ts          # Validasi payload (zod)
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

Total **27 endpoint** (K-01, K-07): Auth 7, health checks 4,
WiFi 5, AI 2, akun 6, utilitas 3. Semua path memakai awalan
`/api` — Worker me-mount router di `/api`
(`apps/api/src/index.ts`).

Semua respons memakai envelope JSON standar:

```json
// Sukses
{ "success": true, "data": { "..." }, "meta": { "timestamp": "..." } }
// Galat
{ "success": false, "error": { "code": "KODE_GALAT", "message": "Pesan bahasa sehari-hari" } }
```

Autentikasi: cookie HttpOnly `dokter_hp_session` berisi token sesi
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
| POST | `/api/auth/pin/set` | 🔒 | `{ "pin": "1234" }` (4-8 digit) | `{ "pin_diatur": true }` |
| POST | `/api/auth/pin/verify` | 🔒 | `{ "pin": "1234" }` | `{ "valid": true }` atau 401; kunci 30 dtk setelah 5 salah berturut-turut |
| POST | `/api/auth/pin/delete` | 🔒 | — | `{ "pin_diatur": false }` |
| POST | `/api/auth/logout` | 🔒 | — | Hapus sesi di D1 + hapus cookie |
| GET | `/api/auth/me` | 🔒 | — | `{ "id", "nama", "email", "pin_diatur", "sesi_terkunci", "sesi_kedaluwarsa_pada" }` (boleh saat sesi terkunci PIN) |

### 3.2 Health checks (pemeriksaan kesehatan)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/health-checks` | 🔒 | `?limit=20&offset=0` | Daftar milik pengguna (filter `deleted_at IS NULL`), terbaru dulu |
| GET | `/api/health-checks/:id` | 🔒 | — | Satu pemeriksaan milik pengguna |
| POST | `/api/health-checks` | 🔒 | `{ "skor": 0-100, "ringkasan": {...} }` | Baris baru (`sync_status: "synced"`) |
| DELETE | `/api/health-checks/:id` | 🔒 | — | Soft-delete (`deleted_at` diisi) |

### 3.3 WiFi reports

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/wifi-reports` | 🔒 | `?limit=20&offset=0` | Daftar milik pengguna, terbaru dulu |
| GET | `/api/wifi-reports/:id` | 🔒 | — | Satu laporan + sampel tes bertahan bila ada |
| POST | `/api/wifi-reports` | 🔒 | `{ "ssid", "kecepatan_koneksi_mbps", "kekuatan_sinyal", "channel", "dns", "ping_ms", "rekomendasi", "kecepatan_unduh_kbps", "sumber", "durasi_tes_detik" }` | Baris baru |
| POST | `/api/wifi-reports/:id/samples` | 🔒 | `{ "samples": [{ "detik_ke": 0-29, "kecepatan_kbps": n }] }` | Sampel tersimpan (maks 30 per laporan) |
| DELETE | `/api/wifi-reports/:id` | 🔒 | — | Soft-delete (kolom `deleted_at` — lihat bagian 5) |

Catatan: tes tanpa akun (landing) tidak memanggil endpoint ini —
hasilnya hanya tampil di layar dan tidak tersimpan.

### 3.4 Diagnosis AI

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/ai/diagnose` | 🔒 | `{ "pertanyaan": "...", "health_check_id": "..." (opsional) }` | Objek diagnosis lengkap (`id`, `pertanyaan`, `jawaban`, `dibuat_pada`), tersimpan ke `ai_diagnoses` |
| GET | `/api/ai/diagnoses` | 🔒 | `?limit=20&offset=0` | Riwayat tanya jawab milik pengguna |

Worker merakit konteks dari riwayat pengguna (pemeriksaan terakhir +
laporan WiFi terakhir) dan mengirimnya bersama pertanyaan ke Gemini.
Kunci Gemini hanya di secret Worker.

### 3.5 Akun

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/account/profile` | 🔒 | — | `{ "id", "nama", "email", "dibuat_pada" }` |
| PATCH | `/api/account/profile` | 🔒 | `{ "nama": "..." }` | Profil diperbarui |
| GET | `/api/account/sessions` | 🔒 | — | Daftar sesi aktif milik pengguna |
| DELETE | `/api/account/sessions/:id` | 🔒 | — | Keluar dari sesi itu |
| DELETE | `/api/account` | 🔒 | `{ "konfirmasi": "HAPUS" }` | Hapus akun + seluruh data (cascade) |
| GET | `/api/account/export` | 🔒 | — | Unduhan file JSON seluruh data pengguna (profil, health checks, laporan WiFi + sampel, diagnosis AI); maks 5.000 baris per tabel (K-04), rate limit 5/hari |

### 3.6 Utilitas (publik)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/health` | Publik | — | `{ "status": "ok" }` (liveness, tanpa akses D1) |
| GET | `/api/ping` | Publik | — | `{ "ok": true, "t": <ms> }` — target latensi HTTP; respons kecil, tanpa akses D1 |
| GET | `/api/speedtest/info` | Publik | — | `{ "file": "/speedtest-1mb.bin", "ukuran_byte": 1048576, "ukuran_label": "1 MB", "timeout_detik": 15, "tes_bertahan_detik": 30 }` (tanpa akses D1) |

## 4. Alur

### 4.1 Auth Google + PIN + sesi

```
1. Pengguna ketuk "Masuk dengan Google"
   → Browser ke GET /api/auth/google
2. Worker buat state + code_verifier (PKCE), simpan sementara
   (cookie HttpOnly singkat / D1), redirect ke Google
3. Google redirect balik ke /api/auth/google/callback?code=...
4. Worker tukar kode → token di SERVER (client_secret tidak pernah
   keluar dari Worker), ambil profil Google (sub, email, nama)
5. Worker cari/buat baris users (berdasar google_sub) + profiles
6. Worker buat token sesi acak (32 byte), simpan SHA-256-nya di
   tabel sessions (kedaluwarsa 30 hari), set cookie HttpOnly
   Secure SameSite=Lax
7. Browser redirect ke /dashboard
8. Bila PIN diatur: /dashboard redirect ke /kunci; pengguna masukkan
   PIN → POST /api/auth/pin/verify → Worker bandingkan hash SHA-256
   (PIN + salt) → bila cocok, tandai sesi "tidak terkunci"
   (kolom sessions.terkunci = 0) → redirect ke /dashboard
9. Setiap request API: Worker verifikasi cookie → hash token →
   cari sesi → cek kedaluwarsa + cek terkunci (kecuali lima
   endpoint yang diizinkan saat terkunci — lihat bagian 3) →
   user_id dari sesi dipakai di semua query
10. Keluar: DELETE sesi di D1 + hapus cookie
```

Keamanan sesi:

- Token mentah tidak pernah disimpan di mana pun kecuali cookie
  pengguna. Yang disimpan hanya SHA-256-nya.
- Cookie: HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 hari.
- Sesi kedaluwarsa 30 hari sejak dibuat; perpanjangan (sliding)
  opsional di fase berikutnya.
- PIN salah 5x berturut-turut → `pin_terkunci_sampai` = sekarang +
  30 detik; percobaan selama terkunci ditolak tanpa memeriksa PIN.

### 4.2 Alur Diagnosis AI

```
1. Pengguna kirim pertanyaan dari /ai
2. Frontend POST /api/ai/diagnose { pertanyaan, health_check_id? }
3. Worker: verifikasi sesi → rate limit (lihat bagian 6)
4. Worker: ambil konteks dari D1 — pemeriksaan terakhir +
   laporan WiFi terakhir milik pengguna (tanpa data pengguna lain)
5. Worker: panggil Gemini model Flash-Lite (model utama, K-06;
   kunci dari secret Worker) dengan prompt:
   konteks data + pertanyaan; instruksi: jawab Bahasa Indonesia,
   saran praktis, akui bila data tidak cukup, jangan mengarang
6. Worker: simpan pertanyaan + jawaban ke ai_diagnoses
7. Worker: kembalikan jawaban ke frontend
8. Bila Gemini galat/timeout atau kuota habis: kembalikan
   diagnosis cadangan tanpa AI (aturan berbasis data pemeriksaan
   pengguna) dengan label jujur bahwa ini bukan jawaban AI —
   atau galat jujur bila data tidak cukup ("Diagnosis AI sedang
   tidak tersedia, coba lagi nanti"). Jangan pernah mengarang
   jawaban
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

D1 tidak punya Row Level Security — penegakan kepemilikan data
dilakukan di kode Worker: setiap query WAJIB memfilter `user_id`
dari sesi yang terverifikasi. Uji kepemilikan (pengguna A tidak bisa
membaca data pengguna B) adalah bagian wajib dari kriteria selesai.

```sql
-- 0001_init.sql — Skema D1 Dokter HP Web App
-- Kompatibel kolom dengan migrasi Supabase APK (nama tabel/kolom sama).

-- ------------------------------------------------------------------
-- users (tambahan web): identitas akun.
-- google_sub adalah pengenal unik dari Google (sub claim).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  google_sub TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  pin_hash TEXT,
  pin_salt TEXT,
  pin_gagal_berturut INTEGER NOT NULL DEFAULT 0,
  pin_terkunci_sampai TEXT,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ------------------------------------------------------------------
-- profiles: cermin migrasi 20261111000001_create_profiles.sql.
-- id sama dengan id pengguna (users.id).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ------------------------------------------------------------------
-- sessions (tambahan web): sesi login.
-- token_hash = SHA-256 hex dari token sesi mentah.
-- Token mentah TIDAK PERNAH disimpan.
-- terkunci = 1 bila sesi belum dibuka dengan PIN (bila PIN diatur).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  terkunci INTEGER NOT NULL DEFAULT 0,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  kedaluwarsa_pada TEXT NOT NULL,
  user_agent TEXT,
  ip_terakhir TEXT
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);

-- ------------------------------------------------------------------
-- health_checks: cermin migrasi 20261111000002_create_health_checks.sql.
-- ringkasan: TEXT JSON (status baterai, penyimpanan, performa,
-- keamanan, dan sumber tiap komponen).
-- sync_status: 'pending' | 'synced' | 'failed'.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  skor INTEGER NOT NULL CHECK (skor >= 0 AND skor <= 100),
  ringkasan TEXT NOT NULL DEFAULT '{}',
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE INDEX IF NOT EXISTS health_checks_user_id_idx ON health_checks (user_id);
CREATE INDEX IF NOT EXISTS health_checks_dibuat_pada_idx ON health_checks (dibuat_pada DESC);

-- ------------------------------------------------------------------
-- wifi_reports: cermin migrasi 20261111000003_create_wifi_reports.sql.
-- Kolom tambahan web: kecepatan_unduh_kbps (hasil tes unduh),
-- sumber ('web' | 'apk' | 'manual'), durasi_tes_detik,
-- deleted_at (soft-delete), updated_at.
-- ping_ms = latensi HTTP (bukan ICMP).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wifi_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ssid TEXT,
  kecepatan_koneksi_mbps REAL,
  kekuatan_sinyal TEXT,
  channel INTEGER,
  dns TEXT,
  ping_ms INTEGER,
  rekomendasi TEXT,
  kecepatan_unduh_kbps REAL,
  sumber TEXT NOT NULL DEFAULT 'web'
    CHECK (sumber IN ('web', 'apk', 'manual')),
  durasi_tes_detik INTEGER,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS wifi_reports_user_id_idx ON wifi_reports (user_id);
CREATE INDEX IF NOT EXISTS wifi_reports_dibuat_pada_idx ON wifi_reports (dibuat_pada DESC);

-- ------------------------------------------------------------------
-- wifi_sustained_samples (tambahan web): sampel per detik dari tes
-- bertahan 30 detik. detik_ke 0-29.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wifi_sustained_samples (
  id TEXT PRIMARY KEY,
  wifi_report_id TEXT NOT NULL REFERENCES wifi_reports (id) ON DELETE CASCADE,
  detik_ke INTEGER NOT NULL CHECK (detik_ke >= 0 AND detik_ke < 30),
  kecepatan_kbps REAL NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (wifi_report_id, detik_ke)
);

CREATE INDEX IF NOT EXISTS wifi_sustained_samples_report_idx
  ON wifi_sustained_samples (wifi_report_id);

-- ------------------------------------------------------------------
-- ai_diagnoses: cermin migrasi 20261111000004_create_ai_diagnoses.sql.
-- health_check_id boleh NULL (pertanyaan tanpa pemeriksaan tertentu).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_diagnoses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  health_check_id TEXT REFERENCES health_checks (id) ON DELETE CASCADE,
  pertanyaan TEXT NOT NULL,
  jawaban TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS ai_diagnoses_user_id_idx ON ai_diagnoses (user_id);
CREATE INDEX IF NOT EXISTS ai_diagnoses_health_check_id_idx ON ai_diagnoses (health_check_id);
CREATE INDEX IF NOT EXISTS ai_diagnoses_dibuat_pada_idx ON ai_diagnoses (dibuat_pada DESC);

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

CREATE INDEX IF NOT EXISTS rate_limits_kedaluwarsa_idx ON rate_limits (kedaluwarsa_pada);
```

### 5.1 Catatan skema

- `id` dibuat di Worker sebagai UUID v4 (`crypto.randomUUID()`),
  bukan oleh database — D1/SQLite tidak punya `gen_random_uuid()`.
- `updated_at` diperbarui oleh kode Worker pada setiap UPDATE
  (D1 tidak memakai trigger `set_updated_at` dari migrasi Supabase;
  tim implementasi boleh menambahkan trigger SQLite bila mau, tetapi
  pembaruan di kode adalah sumber kebenaran).
- `FOREIGN KEY ... ON DELETE CASCADE` membutuhkan
  `PRAGMA foreign_keys = ON` — Worker wajib mengaktifkannya per
  koneksi (D1: jalankan `PRAGMA foreign_keys = ON` sebelum query
  yang bergantung cascade, atau hapus baris anak secara eksplisit
  di kode saat hapus akun).
- `ringkasan` di `health_checks` adalah TEXT JSON; Worker memvalidasi
  JSON sebelum simpan.
- Kolom `sync_status` dipertahankan agar sinkron APK di masa depan
  memakai penanda yang sama (`pending` / `synced` / `failed`).
  Baris yang dibuat lewat web langsung `synced`.
- Tabel `rate_limits` menyimpan penghitung rate limit (K-02);
  baris yang kedaluwarsa dibersihkan berkala oleh Worker.

## 6. Rate limit dan keamanan

### 6.1 Rate limit

| Endpoint | Batas | Alasan |
|---|---|---|
| `POST /api/ai/diagnose` | 20/hari per pengguna | Lindungi kuota Gemini bersama |
| `POST /api/auth/pin/verify` | 5 percobaan, lalu kunci 30 dtk | Cegah tebakan PIN |
| `GET /api/auth/google` | 10/menit per IP | Cegah penyalahgunaan OAuth |
| Semua endpoint tulis | 60/menit per pengguna | Cegah banjir tulis ke D1 |
| Endpoint baca lain | 300/menit per pengguna | Cegah banjir baca ke D1 |
| `GET /api/account/export` | 5/hari per pengguna | Ekspor membaca seluruh data pengguna |
| `GET /api/ping`, `GET /api/health`, `GET /api/speedtest/info` | Tanpa batas ketat (tanpa D1) | Murah; tanpa akses database |

Implementasi (K-02): penghitung di D1 (tabel `rate_limits`, lihat
bagian 5) — Workers free tier tidak menyediakan rate limiting
per-pengguna bawaan. KV TIDAK dipakai untuk rate limit sesi/tulis
karena writes KV hanya 1.000/hari.

Respons saat kena batas: HTTP 429 dengan envelope galat standar
dan pesan bahasa sehari-hari ("Terlalu sering, coba lagi sebentar").

### 6.2 Keamanan

- **Validasi input**: semua payload divalidasi di Worker (zod):
  tipe, panjang maksimum, rentang (skor 0-100, PIN 4-8 digit angka).
- **Kepemilikan**: setiap query data memfilter `user_id` dari sesi.
  Tidak ada endpoint yang menerima `user_id` dari client.
- **SQL injection**: selalu prepared statement dengan parameter
  terikat (`?`); tidak ada string query yang dirakit dari input.
- **XSS**: React meng-escape output secara default; jawaban AI
  ditampilkan sebagai teks (tanpa `dangerouslySetInnerHTML`).
- **CSRF**: cookie SameSite=Lax + pemeriksaan header `Origin`
  pada endpoint tulis (hanya origin Pages dan Vercel yang diizinkan).
- **CORS**: hanya dua origin frontend (Pages + Vercel) yang
  diizinkan, dengan `credentials: true`. Tidak ada wildcard `*`.
- **Header keamanan** (di Worker dan di Pages/Vercel):
  `Content-Security-Policy` (tanpa `unsafe-eval` bila memungkinkan;
  jsPDF tidak butuh eval), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` minimal.
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

## 9. Hal yang masih terbuka

1. **Domain dan nama Worker**: nama subdomain Workers / custom domain
   untuk API dan kedua mirror belum diputuskan.
2. **Akun Cloudflare**: akun Cloudflare mana yang dipakai (akun owner
   yang sudah ada atau akun baru) — diputuskan koordinator.
3. **Client ID Google OAuth**: perlu dibuat di Google Cloud Console
   (gratis, tanpa kartu) dengan redirect URI ke Worker callback.
4. **Kunci Gemini**: secret `GEMINI_API_KEY` perlu disiapkan dan
   diatur sebagai secret Worker; validitas kunci lama (22 Oktober
   2026, di file lokal) belum terkonfirmasi.
5. **Sinkron APK**: endpoint sinkron APK → D1 adalah fase berikutnya
   dan butuh perubahan di APK.

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
   sampel ada di bawah `/wifi-reports/:id/samples`); respons
   `/api/auth/me` dan `/api/ai/diagnose` diselaraskan dengan
   kontrak API.

Inkonsistensi di luar cakupan dokumen ini (dicatat untuk tim
terkait, bukan diubah di sini):

- `docs/api-contracts.md` masih menulis semua path tanpa awalan
  `/api` — perlu penyesuaian ke K-07 oleh tim kontrak API.
- `docs/api-contracts.md` §5 masih mengembalikan 502
  `AI_TIDAK_TERSEDIA` saat Gemini gagal, sementara K-06
  mewajibkan fallback diagnosis tanpa AI — perlu diputuskan
  bagaimana fallback dan kode 502 hidup berdampingan.
- `apps/api/src/routes/api.ts` (scaffold) memakai stub
  `/ai-diagnoses/*`, sementara kontrak memakai `/ai/diagnose`
  dan `/ai/diagnoses`; stub `/health` mengembalikan `{ok: true}`
  tanpa envelope standar.
- `PRODUCT.md` §4.4 menyebut alamat IP publik "dari Worker",
  tetapi tidak ada endpoint di kontrak yang mengembalikan IP
  publik — perlu diputuskan sumbernya.
