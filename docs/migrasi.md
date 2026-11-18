# Rencana Migrasi D1 → Supabase: Dokter HP Web App

> **Dokumen rencana darurat masa depan — BUKAN rencana aktif.**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen,
> 17 November 2026.
>
> Backend Dokter HP Web App saat ini berjalan di Cloudflare D1
> (SQLite serverless), dan itu adalah keputusan yang berlaku
> (lihat `docs/keputusan-stack.md`). Migrasi ke Supabase (Postgres)
> **tidak direncanakan dan tidak dijadwalkan**.
>
> Dokumen ini hanya jalur keluar yang disiapkan sejak awal: bila
> suatu hari kondisi berubah dan migrasi menjadi perlu, pekerjaan
> itu tidak dimulai dari nol. **Jangan menjalankan langkah apa pun
> di dokumen ini tanpa keputusan eksplisit dari koordinator.**
>
> Penghalang saat ini: akun Supabase adiprmx sudah memakai 2 dari
> 2 proyek gratis (limit per akun, bukan per organisasi), sehingga
> proyek Supabase baru tidak dapat dibuat dari akun tersebut.
> Migrasi baru dapat dipertimbangkan bila penghalang itu sudah
> tidak ada (misalnya tersedia akun Supabase lain milik owner
> dengan jatah proyek kosong) DAN salah satu kriteria pemicu di
> bagian 8 terpenuhi.

---

## 1. Ringkasan

| Aspek | Keadaan saat ini | Target bila migrasi |
|---|---|---|
| Database | Cloudflare D1 (SQLite) | Supabase Postgres |
| Skema acuan | `ARCHITECTURE.md` bagian 5 (`0001_init.sql`) | Migrasi APK `supabase/migrations/` + tambahan web |
| Tabel | 7 tabel | 7 tabel yang sama |
| Auth | Google OAuth via Worker + PIN + sesi di D1 | Opsi A: tetap auth sendiri (disarankan); Opsi B: Supabase Auth (lihat bagian 3) |
| Penegakan kepemilikan data | Kode Worker (filter `user_id` dari sesi) | Opsi A: tetap kode Worker; Opsi B: RLS + `auth.uid()` |
| Driver di Worker | Binding D1 (`env.DB`, placeholder `?`) | Klien Postgres / Supabase JS via `postgres` (placeholder `$1`) atau REST Supabase |

### 1.1 Mengapa migrasi ini relatif murah

Skema D1 sengaja dirancang kompatibel dengan rancangan Supabase
APK: tabel `profiles`, `health_checks`, `wifi_reports`,
`ai_diagnoses` memakai nama tabel dan nama kolom yang sama.
Perbedaan hanya ada di tipe data (SQLite yang longgar vs Postgres
yang ketat) dan di tiga tabel tambahan web (`users`, `sessions`,
`wifi_sustained_samples`) yang tidak ada di migrasi APK. Tidak ada
perubahan nama kolom dan tidak ada restrukturisasi relasi.

### 1.2 Yang tidak ikut bermigrasi

- **Secret** (kunci Gemini, client secret Google OAuth): tetap
  sebagai secret Worker. Secret tidak pernah ditulis di skrip
  migrasi, tidak pernah masuk ke SQL, dan tidak pernah masuk repo.
- **KV**: hanya berisi data yang jarang berubah; bila masih dipakai
  saat migrasi, isinya dievaluasi terpisah, bukan bagian dari
  migrasi database ini.
- **File statis** (`speedtest-1mb.bin`, build frontend): tidak
  berubah; Pages dan Vercel tetap menyajikan frontend yang sama.
- **Sesi yang sedang aktif**: token sesi mentah hanya ada di cookie
  pengguna. Tabel `sessions` dapat dimigrasikan (hash token ikut
  pindah), tetapi bila diputuskan untuk tidak memigrasikan sesi,
  seluruh pengguna cukup masuk ulang — itu adalah jalan yang sah
  dan harus diputuskan sebelum migrasi (lihat bagian 5.6).

---

## 2. Pemetaan tipe data

### 2.1 Aturan umum

| D1 (SQLite) | Supabase (Postgres) | Catatan konversi |
|---|---|---|
| `TEXT` berisi UUID | `uuid` | Cast `::uuid`; baris dengan nilai bukan UUID **gagal total** — validasi dulu (bagian 6.1) |
| `TEXT` berisi waktu ISO 8601 | `timestamptz` | Cast `::timestamptz`; format D1 `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` sudah kompatibel |
| `TEXT` berisi JSON | `jsonb` | Cast `::jsonb`; JSON tidak valid **gagal total** — validasi dulu |
| `TEXT` biasa | `text` | Tanpa konversi; perhatikan escaping kutip satu di skrip ekspor |
| `INTEGER` | `integer` | Tanpa konversi; `bigint` hanya bila nilainya bisa melewati ±2,1 miliar (tidak ada di skema ini) |
| `INTEGER` sebagai bendera 0/1 | `boolean` | Konversi `0 → false`, `1 → true` (berlaku untuk `sessions.terkunci`) |
| `REAL` | `double precision` | Tanpa konversi nilai; pengecualian di bawah |
| `REAL` kecepatan koneksi | `numeric` | Migrasi APK memakai `numeric` untuk `wifi_reports.kecepatan_koneksi_mbps`; ikuti migrasi APK |
| `DEFAULT (strftime(...))` | `DEFAULT now()` | Default waktu pindah ke fungsi Postgres |
| `id` dibuat aplikasi (`crypto.randomUUID()`) | `uuid DEFAULT gen_random_uuid()` | Saat impor, id lama ditulis eksplisit; default hanya untuk baris baru |

### 2.2 CHECK constraints — dibawa apa adanya

Semua CHECK di D1 memiliki padanan persis di migrasi APK atau di
skema web, dan wajib ditulis ulang di Postgres:

| Tabel | Constraint | Sumber |
|---|---|---|
| `health_checks` | `skor >= 0 AND skor <= 100` | Migrasi APK `20261111000002` |
| `health_checks` | `sync_status IN ('pending', 'synced', 'failed')` | Migrasi APK `20261111000002` |
| `wifi_reports` | `sumber IN ('web', 'apk', 'manual')` | Tambahan web (hanya ada di D1) |
| `wifi_sustained_samples` | `detik_ke >= 0 AND detik_ke < 30` | Tambahan web (hanya ada di D1) |
| `wifi_sustained_samples` | `UNIQUE (wifi_report_id, detik_ke)` | Tambahan web (hanya ada di D1) |

Catatan: Postgres menolak baris yang melanggar CHECK saat impor,
sedangkan SQLite dengan pengetikan longgar dapat menyimpan nilai
di luar ekspektasi (misalnya teks di kolom `INTEGER`). Validasi
pra-migrasi (bagian 6.1) wajib memeriksa setiap kolom yang punya
CHECK sebelum impor dimulai.

### 2.3 Perbedaan skema D1 vs migrasi APK (harus disatukan)

Migrasi APK adalah acuan, tetapi skema D1 memiliki kolom tambahan
web yang tidak ada di migrasi APK. Target Postgres = migrasi APK +
kolom tambahan web berikut:

| Tabel | Kolom tambahan web (ada di D1, tidak ada di migrasi APK) |
|---|---|
| `wifi_reports` | `kecepatan_unduh_kbps` (`double precision`), `sumber` (`text`, CHECK, default `'web'`), `durasi_tes_detik` (`integer`), `updated_at` (`timestamptz`), `deleted_at` (`timestamptz`) |
| `health_checks` | Tidak ada tambahan (identik dengan migrasi APK) |
| `profiles` | Tidak ada tambahan (identik dengan migrasi APK) |
| `ai_diagnoses` | Tidak ada tambahan (identik dengan migrasi APK) |
| `users` | Seluruh tabel adalah tambahan web (tidak ada di migrasi APK) |
| `sessions` | Seluruh tabel adalah tambahan web (tidak ada di migrasi APK) |
| `wifi_sustained_samples` | Seluruh tabel adalah tambahan web (tidak ada di migrasi APK) |

Perbedaan lain yang perlu dicatat:

- **Referensi pengguna.** Migrasi APK mereferensikan
  `auth.users (id)` (Supabase Auth). Skema D1 mereferensikan
  `users (id)` (tabel identitas milik aplikasi). Keputusan
  bagaimana referensi ini dipetakan adalah keputusan terbesar
  dalam migrasi ini — lihat bagian 3.
- **`updated_at` di `wifi_reports`.** Migrasi APK tidak punya
  `updated_at` di `wifi_reports`; D1 memilikinya. Target Postgres
  mempertahankannya, beserta trigger `set_updated_at()`.
- **Trigger `set_updated_at()`.** Migrasi APK mendefinisikan
  fungsi `public.set_updated_at()` dan trigger untuk
  `health_checks` saja. D1 tidak memakai trigger (kode Worker yang
  memperbarui `updated_at`). Target Postgres: pasang trigger yang
  sama untuk `health_checks`, `wifi_reports`, dan `users` — dan
  putuskan satu sumber kebenaran (trigger ATAU kode; jangan
  keduanya menulis nilai berbeda).
- **`PRAGMA foreign_keys`.** D1 membutuhkan `PRAGMA foreign_keys =
  ON` per koneksi agar `ON DELETE CASCADE` berjalan; Postgres
  menegakkan foreign key selalu. Setelah migrasi, hapus logika
  penghapusan anak secara manual di kode bila ada, dan andalkan
  cascade Postgres (dengan uji eksplisit).

---

## 3. Keputusan identitas: dua opsi

Migrasi APK mengasumsikan Supabase Auth: `profiles.id` dan semua
`user_id` merujuk ke `auth.users`, dan RLS memakai `auth.uid()`.
Web app saat ini tidak memakai Supabase Auth — identitas adalah
tabel `users` milik aplikasi (Google `sub` + PIN + sesi token
hash). Kedua opsi di bawah sah; pilih satu sebelum menulis migrasi
target, karena pilihan ini mengubah seluruh foreign key dan RLS.

### 3.1 Opsi A (disarankan): tetap auth sendiri

- Tabel `public.users` tetap menjadi jangkar identitas.
  `profiles.id`, `health_checks.user_id`,
  `wifi_reports.user_id`, `ai_diagnoses.user_id`, dan
  `sessions.user_id` tetap merujuk ke `public.users (id)`.
- Worker tetap mengakses Postgres dengan peran berhak penuh
  (service role / koneksi langsung) dan tetap menegakkan
  kepemilikan di kode, persis seperti di D1. RLS diaktifkan tetapi
  policy diarahkan ke peran service (atau RLS tidak dipakai untuk
  tabel aplikasi dan akses anon diblokir total) — yang penting,
  **tidak ada akses langsung dari browser ke database**.
- Keuntungan: perubahan kode minimal (hanya lapisan `db.ts`:
  driver dan placeholder), tidak ada migrasi akun pengguna, PIN
  dan sesi tidak berubah, risiko paling kecil.
- Kekurangan: tidak mendapat Supabase Auth, dan RLS bukan lapisan
  pertahanan kedua karena Worker memakai peran berhak penuh.
  Pengujian kepemilikan di kode tetap wajib, sama seperti di D1.

### 3.2 Opsi B: pindah ke Supabase Auth

- Untuk setiap baris `users`, buat baris `auth.users` yang
  sepadan (melalui Supabase Auth Admin API, bukan INSERT langsung
  ke skema `auth` — skema `auth` dikelola Supabase).
- `id` pengguna harus dipertahankan agar seluruh foreign key dan
  data riwayat tetap tersambung. Bila Admin API tidak mengizinkan
  id yang ditentukan pemanggil, buat tabel pemetaan
  `id_lama → id_baru` dan tulis ulang seluruh `user_id` di semua
  tabel saat impor — langkah yang rawan salah dan wajib diuji di
  database staging terlebih dahulu.
- `google_sub` dipetakan ke identitas Google di Supabase Auth;
  kolom ini tidak ada di skema D1 saat ini — nilainya baru
  diperoleh saat pengguna masuk ulang dengan Google setelah
  migrasi. PIN (hash +
  salt) tetap disimpan di tabel aplikasi (`public.users` atau
  kolom tambahan di `profiles`) karena Supabase Auth tidak
  mengenal PIN aplikasi.
- Tabel `sessions` milik aplikasi dihapus (sesi digantikan oleh
  sesi Supabase Auth / JWT), atau dipertahankan hanya sebagai
  penanda "terkunci PIN" per sesi.
- RLS memakai `auth.uid()` persis seperti migrasi APK.
- Keuntungan: arsitektur sesuai rancangan APK, RLS menjadi
  pertahanan kedua yang nyata, sinkron APK–web menjadi satu
  backend yang sama.
- Kekurangan: pekerjaan terbesar dalam migrasi ini, risiko
  kehilangan kaitan akun bila pemetaan id salah, seluruh pengguna
  wajib masuk ulang, dan alur PIN perlu ditulis ulang di atas sesi
  Supabase Auth.
- **Opsi B hanya layak bila ada alasan produk yang nyata**
  (misalnya sinkron APK–web lewat Supabase menjadi kebutuhan),
  bukan sekadar demi migrasi itu sendiri.

### 3.3 Rekomendasi dokumen ini

**Opsi A sebagai jalur default.** Opsi B dicatat sebagai pekerjaan
terpisah yang diputuskan kemudian, bukan bagian dari migrasi
database. Sisa dokumen ini memakai Opsi A sebagai acuan, kecuali
dinyatakan lain.

---

## 4. Urutan migrasi

Urutan di bawah memakai Opsi A. Langkah 1–4 menyiapkan struktur,
langkah 5–6 memindahkan data, langkah 7–9 memverifikasi dan
mengalihkan lalu lintas. Detail validasi ada di bagian 6,
rollback di bagian 7.

### Langkah 0 — Persiapan (sebelum jendela migrasi)

1. Koordinator memutuskan migrasi berdasarkan bagian 8 dan
   menunjuk penanggung jawab.
2. Pastikan proyek Supabase tujuan tersedia dan dapat dibuat
   (jatah proyek kosong).
3. Bekukan perubahan skema D1: tidak ada migrasi D1 baru sejak
   titik ini sampai migrasi selesai.
4. Buat database staging Supabase (proyek terpisah atau skema
   terpisah) untuk gladi bersih.
5. Cadangkan D1: ekspor penuh (lihat bagian 5.1) dan simpan
   berkasnya di luar repo dengan tanggal yang jelas. Cadangan ini
   adalah titik kembali rollback.

### Langkah 1 — Ekstensi dan fungsi pembantu

```sql
-- Diperlukan untuk gen_random_uuid().
create extension if not exists "pgcrypto";

-- Fungsi pemicu updated_at (dari migrasi APK 20261111000002).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

### Langkah 2 — Tabel dalam urutan dependensi

Urutan wajib mengikuti foreign key (induk sebelum anak):

| Urutan | Tabel | Sumber definisi |
|---|---|---|
| 1 | `users` | Tambahan web (bagian 4.1) |
| 2 | `profiles` | Migrasi APK `20261111000001`, FK diubah ke `public.users (id)` pada Opsi A |
| 3 | `sessions` | Tambahan web (bagian 4.1) |
| 4 | `health_checks` | Migrasi APK `20261111000002`, FK diubah ke `public.users (id)` pada Opsi A |
| 5 | `wifi_reports` | Migrasi APK `20261111000003` + kolom tambahan web, FK diubah ke `public.users (id)` pada Opsi A |
| 6 | `wifi_sustained_samples` | Tambahan web (bagian 4.1) |
| 7 | `ai_diagnoses` | Migrasi APK `20261111000004`, FK diubah ke `public.users (id)` pada Opsi A |

Pada Opsi B, FK menunjuk ke `auth.users (id)` persis seperti
migrasi APK, dan tabel `users`/`sessions` tidak dibuat (atau
dibuat hanya untuk kolom PIN).

### Langkah 3 — Indeks

Indeks dibuat setelah tabel, sebelum impor data besar (atau
sesudah impor bila datanya besar — putuskan saat gladi bersih;
indeks memperlambat INSERT tetapi mempercepat validasi):

- `users_email_idx` pada `users (email)`.
- `sessions_user_id_idx`, `sessions_token_hash_idx`.
- `health_checks_user_id_idx`,
  `health_checks_dibuat_pada_idx` (`dibuat_pada DESC`).
- `wifi_reports_user_id_idx`,
  `wifi_reports_dibuat_pada_idx` (`dibuat_pada DESC`).
- `wifi_sustained_samples_report_idx`
  (`wifi_sustained_samples (wifi_report_id)`).
- `ai_diagnoses_user_id_idx`,
  `ai_diagnoses_health_check_id_idx`,
  `ai_diagnoses_dibuat_pada_idx` (`dibuat_pada DESC`).

Nama indeks dipertahankan sama dengan D1 agar kode dan diagnosis
yang menyebut nama indeks tidak berubah.

### Langkah 4 — Trigger dan RLS

1. Trigger `set_updated_at()` untuk `health_checks`,
   `wifi_reports`, dan `users` (lihat catatan di bagian 2.3).
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` untuk setiap tabel
   baru, pada migrasi yang sama dengan pembuatan tabelnya
   (aturan yang sama dengan migrasi APK).
3. Policy RLS:
   - Untuk `profiles`, `health_checks`, `wifi_reports`,
     `ai_diagnoses`: salin keempat policy per tabel dari migrasi
     APK (`select`/`insert`/`update`/`delete` milik sendiri).
     Pada Opsi A, ganti `auth.uid()` dengan mekanisme yang sesuai
     (misalnya policy untuk peran service saja; lihat bagian 3.1).
     Pada Opsi B, salin apa adanya.
   - Untuk `users`, `sessions`, `wifi_sustained_samples`
     (tidak ada di migrasi APK): tulis policy baru dengan pola
     yang sama — pengguna hanya menyentuh baris milik sendiri.
     Untuk `wifi_sustained_samples`, kepemilikan dicek lewat
     tabel induk: `EXISTS (SELECT 1 FROM wifi_reports WHERE
     wifi_reports.id = wifi_report_id AND wifi_reports.user_id
     = auth.uid())` (Opsi B) atau padanannya pada Opsi A.
   - **Verifikasi RLS hanya sah lewat kunci anon publik**,
     bukan kunci service role — kunci service melewati RLS dan
     tidak membuktikan apa-apa.

### Langkah 5 — Impor data (urutan sama dengan langkah 2)

Impor dalam urutan dependensi yang sama: `users` → `profiles` →
`sessions` → `health_checks` → `wifi_reports` →
`wifi_sustained_samples` → `ai_diagnoses`. Kerangka skrip ekspor
ada di bagian 5.

### Langkah 6 — Urutan dan nilai turunan

- Periksa tidak ada baris yatim (FK yang menunjuk id yang tidak
  ada) — seharusnya nol bila impor berurutan.
- Periksa `UNIQUE (wifi_report_id, detik_ke)` tidak dilanggar
  (seharusnya nol bila data D1 bersih).
- Bila ada sequence yang dipakai (tidak ada di skema ini — semua
  id adalah UUID), tidak ada yang perlu disetel ulang.

### Langkah 7 — Validasi pasca-migrasi (bagian 6)

Seluruh pemeriksaan bagian 6 harus lolos sebelum lanjut.

### Langkah 8 — Alih lalu lintas (cutover)

1. Umumkan jendela pemeliharaan bila perlu (durasi dari gladi
   bersih).
2. Hentikan tulis ke D1 (mode baca-saja di Worker: endpoint tulis
   mengembalikan pesan "Server sedang diperbarui, coba lagi
   sebentar").
3. Ekspor delta terakhir dari D1 (baris yang berubah sejak ekspor
   utama) dan impor ke Postgres.
4. Jalankan validasi hitung baris sekali lagi (cepat).
5. Alihkan Worker ke Postgres (perubahan binding/variabel +
   deploy), lalu uji smoke: masuk, buka dashboard, simpan satu
   laporan WiFi, buka riwayat, panggil diagnosis AI.
6. Buka kembali tulis. Pantau galat 5xx selama 24 jam pertama.

### Langkah 9 — Pascamigrasi

1. D1 dipertahankan sebagai cadangan baca-saja minimal 30 hari
   sebelum dihapus (lihat bagian 7).
2. Hapus kode khusus D1 dari Worker hanya setelah masa retensi
   lewat dan tidak ada rollback.
3. Perbarui `ARCHITECTURE.md` dan `docs/keputusan-stack.md`
   dengan status baru.

### 4.1 Definisi Postgres tabel tambahan web

Tabel di bawah ini tidak ada di migrasi APK; definisinya adalah
terjemahan langsung dari skema D1 (`ARCHITECTURE.md` bagian 5)
ke tipe Postgres, memakai Opsi A.

Catatan: definisi Postgres di bawah adalah skema Supabase TUJUAN
migrasi, bukan skema D1 web saat ini — kolom seperti `google_sub`,
`pin_gagal_berturut`, dan `pin_terkunci_sampai` HANYA ada di sisi
Supabase. D1 web memakai `terkunci_sampai` di tabel `pin_attempts`
(migrasi 0004) dan tanpa `google_sub` (lihat `ARCHITECTURE.md`
§5).

```sql
-- users (tambahan web).
create table if not exists public.users (
  id uuid primary key,
  email text not null,
  google_sub text not null unique,
  nama text not null,
  pin_hash text,
  pin_salt text,
  pin_gagal_berturut integer not null default 0,
  pin_terkunci_sampai timestamptz,
  dibuat_pada timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx
  on public.users (email);

-- sessions (tambahan web).
-- terkunci: boolean di Postgres (0/1 di D1).
create table if not exists public.sessions (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  terkunci boolean not null default false,
  dibuat_pada timestamptz not null default now(),
  kedaluwarsa_pada timestamptz not null,
  user_agent text,
  ip_terakhir text
);

create index if not exists sessions_user_id_idx
  on public.sessions (user_id);
create index if not exists sessions_token_hash_idx
  on public.sessions (token_hash);

-- wifi_sustained_samples (tambahan web).
create table if not exists public.wifi_sustained_samples (
  id uuid primary key default gen_random_uuid(),
  wifi_report_id uuid not null
    references public.wifi_reports (id) on delete cascade,
  detik_ke integer not null check (detik_ke >= 0 and detik_ke < 30),
  kecepatan_kbps double precision not null,
  dibuat_pada timestamptz not null default now(),
  unique (wifi_report_id, detik_ke)
);

create index if not exists wifi_sustained_samples_report_idx
  on public.wifi_sustained_samples (wifi_report_id);
```

Kolom tambahan `wifi_reports` di Postgres (ditambahkan ke
definisi migrasi APK `20261111000003`):

```sql
-- Ditambahkan ke public.wifi_reports:
--   kecepatan_unduh_kbps double precision,
--   sumber text not null default 'web'
--     check (sumber in ('web', 'apk', 'manual')),
--   durasi_tes_detik integer,
--   updated_at timestamptz not null default now(),
--   deleted_at timestamptz,
-- dan kecepatan_koneksi_mbps memakai numeric (mengikuti APK),
-- bukan double precision.
```

---

## 5. Skrip ekspor D1 → SQL Postgres

### 5.1 Cara mendapatkan data dari D1

Tiga jalur yang sah, dipilih saat gladi bersih:

1. **`wrangler d1 export`** — mengekspor database D1 ke berkas
   SQL SQLite. Jalur termudah untuk cadangan penuh, tetapi
   hasilnya adalah dialek SQLite dan tetap perlu diterjemahkan
   (bagian 5.2).
2. **Ekspor per tabel lewat `wrangler d1 execute` + JSON** —
   `SELECT` per tabel dengan keluaran JSON, lalu skrip konverter
   mengubah JSON menjadi `INSERT` Postgres. Jalur yang paling
   terkendali untuk data yang perlu dibersihkan.
3. **Skrip Worker/Node pembaca D1** — membaca lewat API D1 dan
   menulis berkas SQL. Dipakai bila dua jalur di atas tidak
   memadai (misalnya volume baris sangat besar dan perlu
   paginasi).

Jalur apa pun yang dipilih, **ekspor dilakukan dua kali**:
ekspor utama sebelum cutover, dan ekspor delta (baris dengan
`dibuat_pada`/`updated_at` setelah titik ekspor utama) pada
jendela cutover.

### 5.2 Kerangka konverter (konsep, bukan kode produksi)

Konverter membaca baris D1 dan menulis `INSERT` Postgres dengan
aturan berikut:

1. **Satu tabel per berkas**, dalam urutan dependensi
   (bagian 4, langkah 2/5). Setiap berkas diawali
   `BEGIN;` dan diakhiri `COMMIT;` agar impor per tabel bersifat
   atomik.
2. **Semua nilai string di-escape** untuk Postgres: kutip satu
   digandakan (`'` → `''`), backslash dan karakter kontrol
   ditangani sesuai standar string Postgres. Jangan merakit SQL
   dengan penggabungan string tanpa fungsi escape yang teruji.
3. **Nilai kosong D1 dibedakan dengan cermat**: `NULL` SQLite →
   `NULL` Postgres (tanpa kutip); string kosong `''` tetap
   string kosong; angka 0 tetap 0. Kesalahan paling umum adalah
   mengubah string kosong menjadi `NULL` atau sebaliknya.
4. **UUID ditulis dengan cast eksplisit**: `'...'::uuid`.
   Baris dengan UUID tidak valid tidak ditulis — catat ke berkas
   penolakan (bagian 6.1), jangan diperbaiki diam-diam.
5. **Waktu ditulis dengan cast eksplisit**:
   `'2026-11-17T10:00:00.000Z'::timestamptz`.
6. **JSON ditulis dengan cast eksplisit**:
   `'{"..." }'::jsonb`. Validasi JSON di konverter sebelum
   menulis; JSON tidak valid masuk berkas penolakan.
7. **Bendera 0/1 ditulis sebagai boolean**: `0 → false`,
   `1 → true`.
8. **Batch**: maksimal 500 baris per pernyataan `INSERT`
   multi-baris. Batch yang terlalu besar gagal total saat satu
   baris bermasalah dan sulit dilacak.
9. **Idempotensi**: setiap berkas impor dapat dijalankan ulang
   dengan aman — memakai `ON CONFLICT (id) DO NOTHING` untuk
   impor ulang, atau berkas dijalankan dalam transaksi yang
   di-`ROLLBACK` seluruhnya bila gagal. Pilih satu strategi dan
   catat di log migrasi.
10. **Log konversi**: jumlah baris dibaca, ditulis, dan ditolak
    per tabel, beserta alasan setiap penolakan. Log ini adalah
    bukti migrasi dan disimpan bersama cadangan.

### 5.3 Contoh per tabel

Contoh di bawah memakai data ilustratif (bukan data pengguna
nyata) dan menunjukkan bentuk hasil konversi. Nilai `id` dan
waktu hanya contoh format.

**`users` (skema Supabase, bukan D1 web — perhatikan: tanpa nilai
secret apa pun — `pin_hash` dan `pin_salt` adalah hash, bukan PIN
asli, dan ikut pindah apa adanya):**

```sql
BEGIN;
INSERT INTO public.users
  (id, email, google_sub, nama, pin_hash, pin_salt,
   pin_gagal_berturut, pin_terkunci_sampai, dibuat_pada, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid,
   'pengguna@contoh.id', 'google-sub-contoh', 'Nama Pengguna',
   NULL, NULL, 0, NULL,
   '2026-11-17T10:00:00.000Z'::timestamptz,
   '2026-11-17T10:00:00.000Z'::timestamptz);
COMMIT;
```

**`profiles`:**

```sql
BEGIN;
INSERT INTO public.profiles (id, nama, dibuat_pada)
VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Nama Pengguna',
   '2026-11-17T10:00:00.000Z'::timestamptz);
COMMIT;
```

**`sessions` (perhatikan `terkunci` 0 → `false`):**

```sql
BEGIN;
INSERT INTO public.sessions
  (id, user_id, token_hash, terkunci, dibuat_pada,
   kedaluwarsa_pada, user_agent, ip_terakhir)
VALUES
  ('22222222-2222-4222-8222-222222222222'::uuid,
   '11111111-1111-4111-8111-111111111111'::uuid,
   'hash-token-contoh-64-karakter-heksadesimal', false,
   '2026-11-17T10:00:00.000Z'::timestamptz,
   '2026-12-17T10:00:00.000Z'::timestamptz,
   'Mozilla/5.0 (Linux; Android 14)', '203.0.113.10');
COMMIT;
```

**`health_checks` (perhatikan `ringkasan` dengan cast `::jsonb`):**

```sql
BEGIN;
INSERT INTO public.health_checks
  (id, user_id, skor, ringkasan, dibuat_pada, updated_at,
   deleted_at, sync_status)
VALUES
  ('33333333-3333-4333-8333-333333333333'::uuid,
   '11111111-1111-4111-8111-111111111111'::uuid, 82,
   '{"baterai": "baik", "sumber": "web"}'::jsonb,
   '2026-11-17T10:05:00.000Z'::timestamptz,
   '2026-11-17T10:05:00.000Z'::timestamptz,
   NULL, 'synced');
COMMIT;
```

**`wifi_reports` (perhatikan `kecepatan_koneksi_mbps` numeric dan
kolom tambahan web):**

```sql
BEGIN;
INSERT INTO public.wifi_reports
  (id, user_id, ssid, kecepatan_koneksi_mbps, kekuatan_sinyal,
   channel, dns, ping_ms, rekomendasi, kecepatan_unduh_kbps,
   sumber, durasi_tes_detik, dibuat_pada, updated_at, deleted_at)
VALUES
  ('44444444-4444-4444-8444-444444444444'::uuid,
   '11111111-1111-4111-8111-111111111111'::uuid, 'ACHA',
   65, 'kuat', 6, '1.1.1.1', 42,
   'Kecepatan stabil; tidak ada tindakan yang diperlukan.',
   3200.5, 'web', NULL,
   '2026-11-17T10:06:00.000Z'::timestamptz,
   '2026-11-17T10:06:00.000Z'::timestamptz,
   NULL);
COMMIT;
```

**`wifi_sustained_samples`:**

```sql
BEGIN;
INSERT INTO public.wifi_sustained_samples
  (id, wifi_report_id, detik_ke, kecepatan_kbps, dibuat_pada)
VALUES
  ('55555555-5555-4555-8555-555555555555'::uuid,
   '44444444-4444-4444-8444-444444444444'::uuid, 0, 3150.0,
   '2026-11-17T10:06:01.000Z'::timestamptz),
  ('55555555-5555-4555-8555-555555555556'::uuid,
   '44444444-4444-4444-8444-444444444444'::uuid, 1, 3180.0,
   '2026-11-17T10:06:02.000Z'::timestamptz);
COMMIT;
```

**`ai_diagnoses` (perhatikan `health_check_id` boleh NULL):**

```sql
BEGIN;
INSERT INTO public.ai_diagnoses
  (id, user_id, health_check_id, pertanyaan, jawaban, dibuat_pada)
VALUES
  ('66666666-6666-4666-8666-666666666666'::uuid,
   '11111111-1111-4111-8111-111111111111'::uuid,
   '33333333-3333-4333-8333-333333333333'::uuid,
   'WiFi lemot padahal sinyal penuh.',
   'Jawaban diagnosis contoh.',
   '2026-11-17T10:10:00.000Z'::timestamptz);
COMMIT;
```

### 5.4 Perubahan kode Worker yang menyertai migrasi

Migrasi database tidak lengkap tanpa perubahan lapisan data
Worker (di luar cakupan skrip SQL, tetapi wajib dijadwalkan dalam
pekerjaan yang sama):

| Perubahan | D1 | Postgres |
|---|---|---|
| Binding/koneksi | Binding D1 (`env.DB`) | URL koneksi Postgres / klien Supabase (sebagai secret Worker; nilainya tidak ada di repo) |
| Placeholder | `?` | `$1, $2, ...` (atau sesuai klien yang dipakai) |
| Pembuat id | `crypto.randomUUID()` di kode | Tetap di kode (disarankan, agar id stabil di kedua backend), atau serahkan ke `gen_random_uuid()` |
| `updated_at` | Kode Worker | Trigger `set_updated_at()` ATAU kode — satu sumber kebenaran (bagian 2.3) |
| `PRAGMA foreign_keys` | Wajib per koneksi | Tidak ada; hapus dari kode |
| Penanganan galat | Galat D1 (kuota, SQLite) | Galat Postgres (pelanggaran constraint, koneksi) — pesan ke pengguna tetap bahasa sehari-hari |
| `ringkasan` JSON | `JSON.parse` / `JSON.stringify` manual | `jsonb` diterima sebagai objek oleh sebagian klien — sesuaikan serialisasi di `db.ts` |

---

## 6. Validasi

Validasi dilakukan dua kali: pada database staging saat gladi
bersih, dan pada database produksi setelah impor. Migrasi tidak
dinyatakan selesai bila ada satu pun pemeriksaan wajib yang gagal.

### 6.1 Validasi pra-migrasi (di D1, sebelum ekspor)

1. **Format UUID**: setiap kolom `id` dan `user_id` (dan
   `health_check_id`, `wifi_report_id`) cocok dengan pola UUID
   v4. Baris yang tidak cocok dicatat dan diputuskan
   penanganannya (perbaiki sumbernya atau keluarkan dari migrasi
   dengan persetujuan koordinator) — jangan pernah mengubah id
   diam-diam karena id adalah kunci relasi.
2. **Format waktu**: setiap kolom waktu dapat diparse sebagai
   ISO 8601. Nilai kosong di kolom `NOT NULL` dicatat.
3. **JSON valid**: setiap `ringkasan` di `health_checks` adalah
   JSON objek yang valid.
4. **Rentang CHECK**: `skor` 0–100, `sync_status` salah satu dari
   tiga nilai, `sumber` salah satu dari tiga nilai, `detik_ke`
   0–29, `terkunci` 0 atau 1.
5. **Keunikan**: tidak ada duplikat `id` per tabel, tidak ada
   duplikat `(wifi_report_id, detik_ke)`, dan tidak ada duplikat
   `token_hash`. Keunikan `google_sub` tidak diperiksa di sini
   karena kolom itu tidak ada di skema D1 — pemeriksaannya ada
   di validasi pasca-migrasi (bagian 6.2 baris 7, constraint
   `UNIQUE` aktif di Postgres).
6. **Orphan check**: tidak ada `user_id` yang tidak ada di
   `users`, tidak ada `health_check_id` yang tidak ada di
   `health_checks`, tidak ada `wifi_report_id` yang tidak ada di
   `wifi_reports`.
7. **Hitung baris awal**: catat `COUNT(*)` per tabel sebagai
   angka acuan.

### 6.2 Validasi pasca-migrasi (di Postgres, setelah impor)

| # | Pemeriksaan | Kriteria lolos |
|---|---|---|
| 1 | Hitung baris per tabel | Sama persis dengan angka acuan D1 (bagian 6.1 poin 7) + delta cutover |
| 2 | Hitung baris per pengguna | Untuk 10 pengguna dengan data terbanyak, jumlah `health_checks`, `wifi_reports`, dan `ai_diagnoses` sama dengan D1 |
| 3 | Checksum sampel | Untuk sampel acak 100 baris per tabel (atau seluruh baris bila tabel kecil), hash gabungan kolom-kolom kunci sama antara D1 dan Postgres |
| 4 | Pemeriksaan isi per baris | 10 baris per tabel dibandingkan kolom per kolom (termasuk nilai NULL, string kosong, dan teks dengan kutip/apostrof) |
| 5 | `ringkasan` JSON | `ringkasan` di Postgres sama isinya dengan di D1 (bandingkan setelah normalisasi urutan kunci JSON) |
| 6 | Integritas FK | Nol baris yatim di semua relasi (uji dengan `LEFT JOIN ... IS NULL`) |
| 7 | CHECK dan UNIQUE | Seluruh constraint aktif; uji negatif: INSERT yang melanggar CHECK ditolak |
| 8 | Trigger `updated_at` | UPDATE satu baris mengubah `updated_at` (bila trigger dipilih sebagai sumber kebenaran) |
| 9 | Cascade | Hapus satu pengguna uji di staging → seluruh baris terkait ikut terhapus |
| 10 | RLS | Dengan kunci anon: tidak dapat membaca baris pengguna lain; dengan kunci service: akses penuh (Opsi A) / dengan JWT pengguna: hanya baris sendiri (Opsi B) |

### 6.3 Uji baca/tulis aplikasi (smoke test, wajib setelah cutover)

1. Masuk dengan Google (pengguna uji) → sesi terbentuk.
2. Buka dashboard → skor dan riwayat tampil dari Postgres.
3. Jalankan tes WiFi → laporan tersimpan (tulis baru).
4. Jalankan diagnosis satu ketuk → `health_checks` baru tersimpan.
5. Kirim satu diagnosis AI → `ai_diagnoses` baru tersimpan.
6. Unduh laporan PDF → isi cocok dengan riwayat.
7. Uji kepemilikan: pengguna A tidak dapat membaca data pengguna
   B lewat API (uji eksplisit, sama seperti di D1).
8. Atur PIN, kunci, buka dengan PIN benar, tolak PIN salah.

Seluruh uji dicatat (lolos/gagal + waktu) di log migrasi.

---

## 7. Rollback plan

### 7.1 Prinsip

- **D1 tidak dihapus dan tidak diubah setelah cutover.**
  D1 dipertahankan sebagai cadangan baca-saja minimal 30 hari.
  Selama masa itu, rollback selalu memungkinkan.
- **Rollback adalah keputusan, bukan kegagalan.** Bila validasi
  pasca-migrasi gagal atau galat produksi melonjak setelah
  cutover, rollback lebih murah daripada memperbaiki sambil
  berjalan.

### 7.2 Pemicu rollback

Lakukan rollback bila salah satu terjadi dalam 24 jam pertama
setelah cutover (atau dalam masa retensi bila ditemukan kemudian):

1. Hitung baris atau checksum tidak cocok dan penyebabnya tidak
   ditemukan dalam 1 jam.
2. Galat tulis ke Postgres di atas 5% request tulis selama
   15 menit berturut-turut.
3. Pengguna tidak dapat masuk atau sesi tidak dapat dibuat.
4. Data pengguna A terlihat oleh pengguna B (kebocoran
   kepemilikan — rollback segera, tanpa menunggu ambang waktu).
5. Diagnosis AI atau tes WiFi gagal menyimpan secara konsisten.

### 7.3 Langkah rollback

1. Hentikan tulis ke Postgres (mode baca-saja di Worker).
2. Alihkan Worker kembali ke D1 (kembalikan binding/variabel +
   deploy versi Worker pra-migrasi).
3. Uji smoke singkat (masuk, buka dashboard, simpan satu laporan).
4. Umumkan selesai bila perlu; catat kejadian di log migrasi.
5. **Data yang ditulis ke Postgres selama jendela bermasalah**
   tidak ada di D1. Penanganannya diputuskan per kejadian:
   - Bila jendelanya pendek dan jumlah barisnya kecil: ekspor
     baris baru dari Postgres (berdasar `dibuat_pada` setelah
     cutover) dan impor kembali ke D1 dengan konverter arah
     sebaliknya (bagian 9).
   - Bila tidak dapat direkonsiliasi dengan aman: data tersebut
     dinyatakan hilang, dicatat di log migrasi, dan pengguna
     yang terdampak diberitahu dengan jujur. **Tidak ada data
     yang direkonstruksi dengan karangan.**

### 7.4 Titik tanpa kembali

Setelah masa retensi 30 hari lewat dan D1 dihapus, rollback
penuh tidak lagi dimungkinkan — yang tersisa hanyalah cadangan
berkas ekspor (bagian 5.1). Penghapusan D1 membutuhkan keputusan
eksplisit koordinator dan dicatat dengan tanggalnya.

---

## 8. Kriteria pemicu migrasi

### 8.1 Prasyarat mutlak (keduanya harus terpenuhi)

1. **Jatah proyek Supabase tersedia** — akun Supabase milik
   owner dengan slot proyek gratis kosong, atau kesediaan
   memakai proyek di luar akun adiprmx. Selama prasyarat ini
   tidak terpenuhi, seluruh kriteria di bawah tidak relevan.
2. **Keputusan eksplisit koordinator** — migrasi tidak dimulai
   dari dokumen ini saja.

### 8.2 Tetap di D1 bila (kondisi saat ini)

| Kondisi | Alasan tetap di D1 |
|---|---|
| Pemakaian jauh di bawah kuota (5 jt baca / 100 rb tulis per hari) | D1 memberi ruang yang sangat besar untuk skala produk ini |
| Ukuran database jauh di bawah 500 MB | Tidak ada tekanan penyimpanan |
| Seluruh fitur berjalan dengan SQLite | Tidak ada kebutuhan fitur Postgres |
| Sinkron APK–web belum menjadi kebutuhan | Tidak ada alasan produk untuk satu backend Supabase |
| Tim kecil dan waktu terbatas | Migrasi adalah pekerjaan besar dengan risiko sendiri; jangan dilakukan tanpa pemicu nyata |

### 8.3 Pertimbangkan migrasi bila salah satu terpenuhi

| Pemicu | Penjelasan |
|---|---|
| Kuota D1 habis berulang | Baca/tulis harian menyentuh batas (5 jt / 100 rb) beberapa hari dalam sebulan, dan optimasi query/indeks sudah tidak cukup |
| Ukuran database mendekati 500 MB | Proyeksi pertumbuhan menunjukkan batas tercapai dalam 3 bulan, dan pengarsipan/pembersihan tidak cukup |
| Butuh fitur Postgres yang nyata | Misalnya pencarian teks penuh, agregasi kompleks yang lambat di SQLite, atau kebutuhan ekstensi Postgres — dengan bukti bahwa SQLite tidak memadai, bukan asumsi |
| Sinkron APK–web lewat Supabase menjadi kebutuhan | APK dirancang untuk Supabase; bila sinkron dua arah APK–web diputuskan memakai Supabase sebagai backend bersama, migrasi web menjadi bagian dari pekerjaan itu |
| D1 berubah secara material | Perubahan harga, penghapusan free tier, atau penghentian layanan D1 oleh Cloudflare |
| Kebutuhan kepatuhan/audit | Kebutuhan yang hanya dapat dipenuhi Postgres (misalnya RLS sebagai pertahanan kedua yang diaudit) |

### 8.4 Bukan pemicu migrasi

- "Postgres lebih populer" atau "Supabase lebih modern" —
  preferensi tanpa kebutuhan terukur bukan alasan.
- Satu kali lonjakan kuota yang dapat dijelaskan dan tidak
  berulang — selesaikan dengan optimasi query dan rate limit.
- Keinginan memakai Supabase Auth semata — auth sendiri sudah
  berjalan; Opsi B adalah pekerjaan terpisah dengan risikonya
  sendiri (bagian 3.2).

### 8.5 Daftar periksa keputusan (diisi koordinator saat meninjau)

- [ ] Prasyarat 8.1 terpenuhi (jatah proyek + keputusan eksplisit).
- [ ] Pemicu 8.3 yang mana yang terpenuhi, dengan angka/bukti.
- [ ] Opsi identitas dipilih (A atau B, bagian 3).
- [ ] Keputusan sesi: migrasikan tabel `sessions` atau paksa
      seluruh pengguna masuk ulang.
- [ ] Gladi bersih di staging sudah lolos penuh (bagian 6).
- [ ] Jendela cutover dan durasi pemeliharaan diumumkan.
- [ ] Penanggung jawab rollback ditunjuk.

---

## 9. Arah sebaliknya: Supabase → D1 (jalan keluar singkat)

Bila suatu hari Postgres perlu ditinggalkan (misalnya jatah
Supabase habis, biaya muncul, atau D1 kembali menjadi pilihan
yang lebih baik), migrasi kembali ke D1 mengikuti pola yang sama
dengan arah yang dibalik. Dokumen ini hanya mencatat arahnya
secara singkat; detail penuh dibuat saat kebutuhan itu nyata.

| Aspek | Supabase (Postgres) → D1 (SQLite) |
|---|---|
| `uuid` | `TEXT` (nilai UUID ditulis apa adanya sebagai string) |
| `timestamptz` | `TEXT` ISO 8601 (format dengan zona `Z`; pastikan konsistensi) |
| `jsonb` | `TEXT` JSON (serialisasi dari `jsonb`) |
| `numeric` / `double precision` | `REAL` |
| `integer` | `INTEGER` |
| `boolean` | `INTEGER` 0/1 (`false → 0`, `true → 1`) |
| `gen_random_uuid()` | Kembali ke `crypto.randomUUID()` di kode Worker |
| Trigger `set_updated_at()` | Kembali ke pembaruan `updated_at` di kode Worker |
| RLS + policy | Dihapus; penegakan kepemilikan kembali ke kode Worker (filter `user_id` dari sesi) — uji kepemilikan wajib diulang |
| `auth.users` (Opsi B) | Perlu pemetaan kembali ke tabel `users` milik aplikasi; ini adalah bagian tersulit arah sebaliknya — alasan tambahan untuk memilih Opsi A pada migrasi awal |
| Ekspor dari Postgres | `COPY ... TO STDOUT WITH (FORMAT csv, HEADER)` per tabel, atau `pg_dump --data-only --column-inserts`; lalu konverter CSV/SQL → `INSERT` SQLite |
| Urutan | Sama: induk sebelum anak; matikan penegakan FK selama impor (`PRAGMA foreign_keys = OFF`), nyalakan kembali dan periksa orphan setelah impor |
| Validasi | Sama seperti bagian 6 dengan arah dibalik: hitung baris, checksum sampel, uji baca/tulis, uji kepemilikan |

Catatan: skema D1 target sudah ada (`ARCHITECTURE.md` bagian 5),
sehingga arah sebaliknya tidak membutuhkan perancangan skema
baru — hanya konverter dan validasi.

---

## 10. Referensi

| Dokumen | Isi |
|---|---|
| `PRODUCT.md` bagian 7 | Data model web (ringkasan kolom per tabel) |
| `ARCHITECTURE.md` bagian 5 | Skema D1 lengkap (`0001_init.sql`) |
| `ARCHITECTURE.md` bagian 6.3 | Kuota D1 terverifikasi |
| `docs/keputusan-stack.md` bagian 3.1 | Alasan Supabase ditolak (akun adiprmx 2/2 proyek) |
| `~/workspace/projects/dokter-hp/supabase/migrations/20261111000001_create_profiles.sql` | Skema + RLS `profiles` |
| `~/workspace/projects/dokter-hp/supabase/migrations/20261111000002_create_health_checks.sql` | Skema + indeks + trigger + RLS `health_checks` |
| `~/workspace/projects/dokter-hp/supabase/migrations/20261111000003_create_wifi_reports.sql` | Skema + indeks + RLS `wifi_reports` |
| `~/workspace/projects/dokter-hp/supabase/migrations/20261111000004_create_ai_diagnoses.sql` | Skema + indeks + RLS `ai_diagnoses` |

## 11. Changelog dokumen

### 17 November 2026 — versi awal

- Rencana migrasi D1 → Supabase sebagai jalur darurat masa
  depan: pemetaan tipe, urutan migrasi, kerangka skrip ekspor
  dengan contoh per tabel, validasi, rollback, kriteria pemicu,
  dan arah sebaliknya secara singkat. Migrasi bukan rencana
  aktif; Supabase akun adiprmx masih terblokir (2/2 proyek).
