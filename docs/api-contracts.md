# api-contracts.md: Kontrak API Dokter HP Web App

> **Spesifikasi lengkap setiap endpoint Worker API Dokter HP Web App.**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen, 17 November 2026.
>
> Dokumen ini adalah kontrak antara frontend (Cloudflare Pages dan
> mirror Vercel) dan backend (Cloudflare Worker + D1). Frontend dan
> Worker wajib mengikuti dokumen ini; perubahan kontrak dicatat di
> bagian Changelog di akhir dokumen.
>
> Acuan: `PRODUCT.md` (perilaku produk) dan `ARCHITECTURE.md`
> (arsitektur, skema D1, rate limit). Bila ada perbedaan, dokumen ini
> yang berlaku untuk bentuk request/response, dan `ARCHITECTURE.md`
> yang berlaku untuk skema database.

---

## 0. Konvensi umum

### 0.1 Basis URL

```
https://api.dokter-hp.<domain>
```

Domain persis diputuskan saat deploy (subdomain Workers
`<nama>.workers.dev` atau custom domain bila tersedia). Semua contoh
di dokumen ini memakai basis `https://api.dokter-hp.example.com`
sebagai placeholder — ganti dengan basis nyata saat implementasi.
Semua request memakai HTTPS. HTTP biasa ditolak (redirect ke HTTPS
oleh Cloudflare).

### 0.2 Format

- Semua request body memakai `Content-Type: application/json`
  (kecuali endpoint yang dinyatakan lain).
- Semua response memakai `Content-Type: application/json; charset=utf-8`
  (kecuali redirect 302 pada alur OAuth).
- Semua waktu memakai format ISO 8601 UTC, contoh:
  `2026-11-17T15:30:00.000Z`.
- Semua ID memakai UUID v4 (TEXT), dibuat server dengan
  `crypto.randomUUID()`.
- Angka desimal memakai titik (JSON standar), bukan koma.
- Semua teks respons memakai Bahasa Indonesia.

### 0.3 Envelope JSON standar

Setiap respons API (kecuali redirect 302 OAuth) memakai envelope
yang sama. Frontend boleh mengandalkan bentuk ini di semua endpoint.

**Sukses:**

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-11-17T15:30:00.000Z"
  }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `success` | boolean | Selalu `true` pada respons sukses. |
| `data` | object / array / null | Isi respons. Bentuknya tergantung endpoint (lihat tiap endpoint). |
| `meta.timestamp` | string (ISO 8601) | Waktu server saat respons dibuat. |
| `meta` | object | Opsional: endpoint daftar menambahkan `meta.pagination` (lihat 0.6). |

**Gagal:**

```json
{
  "success": false,
  "error": {
    "code": "KODE_GALAT",
    "message": "Pesan bahasa sehari-hari untuk pengguna"
  },
  "meta": {
    "timestamp": "2026-11-17T15:30:00.000Z"
  }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `success` | boolean | Selalu `false` pada respons gagal. |
| `error.code` | string | Kode galat mesin (daftar lengkap di 0.5). Stabil; frontend boleh bercabang dari kode ini. |
| `error.message` | string | Pesan untuk pengguna, bahasa sehari-hari, tanpa rincian teknis sistem. Aman ditampilkan langsung. |
| `error.details` | object (opsional) | Hanya pada `VALIDATION_ERROR`: peta nama field ke pesan validasi per field. Lihat contoh di 0.5. |
| `meta.timestamp` | string (ISO 8601) | Waktu server saat respons dibuat. |

Aturan pesan galat:

- Pesan tidak pernah menampilkan rincian teknis (pesan SQL, stack
  trace, nama tabel/kolom, atau pesan mentah dari layanan pihak
  ketiga).
- Pesan tidak pernah membocorkan keberadaan data milik pengguna lain
  (lihat 0.4 tentang respons 404).
- Pesan ditulis dengan bahasa sehari-hari yang mudah dipahami
  pengguna umum.

### 0.4 Autentikasi dan otorisasi

**Mekanisme sesi.** Setelah masuk Google berhasil, Worker membuat
token sesi acak (32 byte) dan menyimpannya sebagai hash SHA-256 di
tabel `sessions`. Token mentah hanya ada di cookie pengguna.

**Cookie sesi:**

| Atribut | Nilai |
|---|---|
| Nama | `dokter_hp_session` |
| Nilai | Token sesi mentah (hex/base64url, 32 byte) |
| HttpOnly | Ya (tidak bisa dibaca JavaScript) |
| Secure | Ya (hanya lewat HTTPS) |
| SameSite | `Lax` |
| Path | `/` |
| Max-Age | 30 hari (2.592.000 detik) |

Frontend memanggil API dengan `fetch(..., { credentials: "include" })`
agar cookie ikut terkirim. Frontend TIDAK menyimpan token di
`localStorage` atau `sessionStorage`, dan TIDAK mengirim token lewat
header `Authorization` (tidak ada skema Bearer di API ini).

**Status sesi yang mungkin:**

| Status | Artinya |
|---|---|
| Tidak ada cookie / cookie kosong | Pengguna belum masuk. |
| Token tidak ditemukan di D1 | Sesi sudah dihapus (keluar) atau tidak valid. |
| `kedaluwarsa_pada` sudah lewat | Sesi kedaluwarsa (30 hari). |
| `terkunci = 1` | Sesi belum dibuka dengan PIN (hanya bila PIN diatur). Endpoint selain PIN dan `/auth/me` menolak sesi terkunci dengan `SESSION_LOCKED` (403). |

**Penegakan kepemilikan.** Setiap query data memfilter `user_id`
dari sesi yang terverifikasi. Tidak ada endpoint yang menerima
`user_id` dari client. Bila pengguna meminta data milik pengguna
lain (misalnya `/health-checks/:id` milik orang lain), server
menjawab **404 `NOT_FOUND`** — sama seperti bila data tidak ada —
agar keberadaan data orang lain tidak bisa ditebak.

**Header yang diterima pada endpoint tulis (CSRF):**

| Header | Wajib | Keterangan |
|---|---|---|
| `Content-Type: application/json` | Ya (POST/PATCH/DELETE berbody) | Body bukan JSON ditolak dengan `VALIDATION_ERROR` (400). |
| `Origin` | Ya (browser mengirim otomatis) | Worker hanya mengizinkan origin Pages dan Vercel. Origin lain ditolak dengan `FORBIDDEN` (403). |

**CORS.** Hanya dua origin frontend (Pages utama dan mirror Vercel)
yang diizinkan, dengan `credentials: true`. Tidak ada wildcard `*`.
Preflight `OPTIONS` dijawab Worker dengan header CORS yang sesuai.

### 0.5 Kode galat

Semua kode dipakai konsisten di seluruh endpoint. Frontend boleh
bercabang dari `error.code`; `error.message` hanya untuk ditampilkan.

| HTTP | Kode | Artinya | Pesan contoh |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query tidak valid (tipe salah, di luar batas, field wajib hilang, JSON rusak). | "Data yang dikirim tidak lengkap atau tidak valid." |
| 400 | `INVALID_JSON` | Body bukan JSON yang bisa dibaca. | "Format data yang dikirim tidak dikenali." |
| 401 | `UNAUTHORIZED` | Sesi tidak ada, tidak valid, atau kedaluwarsa. | "Sesi Anda sudah berakhir, silakan masuk lagi." |
| 401 | `PIN_SALAH` | PIN yang dimasukkan salah (khusus `/auth/pin/verify`). | "PIN salah, coba lagi." |
| 403 | `FORBIDDEN` | Origin tidak diizinkan atau aksi dilarang. | "Aksi ini tidak diizinkan." |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN; buka dulu dengan PIN. | "Aplikasi terkunci, masukkan PIN untuk membuka." |
| 403 | `PIN_TERKUNCI` | PIN terkunci sementara setelah 5 kali salah berturut-turut. | "Terlalu banyak percobaan salah. Coba lagi dalam 30 detik." |
| 404 | `NOT_FOUND` | Data tidak ditemukan atau bukan milik pengguna. | "Data tidak ditemukan." |
| 405 | `METHOD_NOT_ALLOWED` | Method HTTP tidak didukung pada path ini. | "Metode ini tidak didukung." |
| 409 | `CONFLICT` | Konflik keadaan (misalnya sampel detik yang sama sudah ada). | "Data ini sudah ada." |
| 409 | `PIN_SUDAH_DIATUR` | PIN sudah diatur; pakai ubah PIN (set ulang) bila ingin mengganti. | "PIN sudah diatur. Hapus dulu bila ingin mengatur ulang." |
| 422 | `KONFIRMASI_SALAH` | Teks konfirmasi hapus akun tidak cocok. | "Teks konfirmasi tidak cocok. Ketik HAPUS untuk melanjutkan." |
| 429 | `RATE_LIMITED` | Melebihi batas rate limit. | "Terlalu sering, coba lagi sebentar." |
| 429 | `AI_QUOTA_HABIS` | Kuota harian Diagnosis AI (20/hari) habis. | "Kuota Diagnosis AI hari ini sudah habis, coba lagi besok." |
| 500 | `INTERNAL_ERROR` | Galat server tak terduga. | "Terjadi kesalahan di server, coba lagi nanti." |
| 502 | `AI_TIDAK_TERSEDIA` | Layanan AI (Gemini) gagal/timeout. Jawaban tidak dikarang. | "Diagnosis AI sedang tidak tersedia, coba lagi nanti." |
| 503 | `DATABASE_SIBUK` | D1 error/kuota habis. | "Server sedang sibuk, coba lagi nanti." |

**Contoh `VALIDATION_ERROR` dengan rincian per field:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data yang dikirim tidak lengkap atau tidak valid.",
    "details": {
      "skor": "Skor harus berupa angka 0 sampai 100.",
      "ringkasan": "Ringkasan harus berupa objek."
    }
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Contoh `PIN_TERKUNCI` dengan sisa waktu kunci:**

```json
{
  "success": false,
  "error": {
    "code": "PIN_TERKUNCI",
    "message": "Terlalu banyak percobaan salah. Coba lagi dalam 30 detik.",
    "details": {
      "terkunci_sampai": "2026-11-17T15:30:30.000Z",
      "sisa_detik": 30
    }
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Contoh `RATE_LIMITED` dengan header `Retry-After`:**

Respons 429 menyertakan header `Retry-After` (detik) bila waktu
tunggu diketahui. Frontend memakai nilai ini untuk menampilkan
hitungan mundur, bukan menebak.

### 0.6 Paginasi daftar

Semua endpoint daftar (`GET /health-checks`, `GET /wifi-reports`,
`GET /ai/diagnoses`, `GET /account/sessions`) memakai paginasi
offset yang sama:

| Query | Tipe | Default | Batas | Keterangan |
|---|---|---|---|---|
| `limit` | integer | 20 | 1–100 | Jumlah baris per halaman. Di luar batas → diklem ke batas terdekat (bukan galat), kecuali bukan angka → `VALIDATION_ERROR`. |
| `offset` | integer | 0 | ≥ 0 | Baris yang dilewati. Negatif → `VALIDATION_ERROR`. |

Respons daftar memakai bentuk ini:

```json
{
  "success": true,
  "data": [ "..." ],
  "meta": {
    "timestamp": "2026-11-17T15:30:00.000Z",
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 57,
      "has_more": true
    }
  }
}
```

| Field | Keterangan |
|---|---|
| `meta.pagination.total` | Jumlah total baris milik pengguna yang cocok (tanpa limit/offset). |
| `meta.pagination.has_more` | `true` bila masih ada baris setelah halaman ini (`offset + data.length < total`). |

Urutan daftar: terbaru dulu (`dibuat_pada` menurun), kecuali
dinyatakan lain. Baris soft-delete (`deleted_at` terisi) tidak
pernah muncul di daftar.

### 0.7 Rate limit umum

| Cakupan | Batas | Keterangan |
|---|---|---|
| Semua endpoint tulis (POST/PATCH/DELETE) | 60/menit per pengguna | Dihitung per `user_id` dari sesi. |
| `GET /auth/google` | 10/menit per IP | Cegah penyalahgunaan OAuth. |
| `POST /auth/pin/verify` | 5 percobaan salah, lalu kunci 30 detik | Bukan rate limit menit — kunci PIN (lihat 1.4). |
| `POST /ai/diagnose` | 20/hari per pengguna | Lindungi kuota Gemini bersama. |
| `GET /ping`, `GET /health` | Tanpa batas ketat | Tanpa akses D1; murah. |
| Endpoint baca lain | 300/menit per pengguna | Batas longgar untuk mencegah banjir baca. |

Batas per endpoint ditulis juga di tiap endpoint di bawah. Respons
saat kena batas: HTTP 429, kode `RATE_LIMITED` (atau
`AI_QUOTA_HABIS` untuk kuota AI), dengan header `Retry-After` bila
waktu tunggu diketahui.

### 0.8 Daftar endpoint (ringkasan)

Total **27 endpoint** (25 dari `ARCHITECTURE.md` §3 ditambah 2
endpoint dari penugasan tim ini: ekspor data dan info speedtest —
lihat Changelog).

| # | Method | Path | Auth | Grup |
|---|---|---|---|---|
| 1 | GET | `/auth/google` | Publik | Auth Google |
| 2 | GET | `/auth/google/callback` | Publik | Auth Google |
| 3 | POST | `/auth/logout` | Sesi | Auth Google |
| 4 | GET | `/auth/me` | Sesi | Auth Google |
| 5 | POST | `/auth/pin/set` | Sesi | PIN |
| 6 | POST | `/auth/pin/verify` | Sesi | PIN |
| 7 | POST | `/auth/pin/delete` | Sesi | PIN |
| 8 | POST | `/health-checks` | Sesi | Health checks |
| 9 | GET | `/health-checks` | Sesi | Health checks |
| 10 | GET | `/health-checks/:id` | Sesi | Health checks |
| 11 | DELETE | `/health-checks/:id` | Sesi | Health checks |
| 12 | POST | `/wifi-reports` | Sesi | WiFi |
| 13 | GET | `/wifi-reports` | Sesi | WiFi |
| 14 | GET | `/wifi-reports/:id` | Sesi | WiFi |
| 15 | DELETE | `/wifi-reports/:id` | Sesi | WiFi |
| 16 | POST | `/wifi-reports/:id/samples` | Sesi | WiFi (tes bertahan) |
| 17 | POST | `/ai/diagnose` | Sesi | AI |
| 18 | GET | `/ai/diagnoses` | Sesi | AI |
| 19 | GET | `/account/profile` | Sesi | Akun |
| 20 | PATCH | `/account/profile` | Sesi | Akun |
| 21 | GET | `/account/sessions` | Sesi | Akun |
| 22 | DELETE | `/account/sessions/:id` | Sesi | Akun |
| 23 | DELETE | `/account` | Sesi | Akun |
| 24 | GET | `/account/export` | Sesi | Akun |
| 25 | GET | `/health` | Publik | Utilitas |
| 26 | GET | `/ping` | Publik | Utilitas |
| 27 | GET | `/speedtest/info` | Publik | Utilitas |

Catatan tentang angka 24 di `ARCHITECTURE.md`: dokumen arsitektur
menyebut 24 endpoint, tetapi tabel §3-nya bila dihitung berisi 25
(7 auth + 4 health checks + 5 WiFi + 2 AI + 5 akun + 2 utilitas).
Dokumen ini mendokumentasikan seluruh 25 itu, ditambah 2 endpoint
baru (ekspor data dan info speedtest) sehingga total 27.

---
## 1. Auth Google

Alur OAuth memakai authorization code flow + PKCE. Penukaran kode
terjadi di server; `client_secret` Google tidak pernah keluar dari
Worker. Frontend hanya mengarahkan browser ke `/auth/google` dan
menerima redirect kembali ke aplikasi setelah callback selesai.

### 1.1 Mulai masuk Google — `GET /auth/google`

Memulai alur OAuth. Worker membuat `state` dan `code_verifier`
(PKCE), menyimpannya sementara di cookie HttpOnly berumur singkat
(10 menit), lalu redirect ke Google.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /auth/google` |
| Auth | Publik (tanpa sesi) |
| Header request | Tidak ada header khusus. |
| Query | Opsional: `redirect` — path dalam aplikasi tujuan setelah masuk berhasil (misalnya `/dashboard`, `/wifi`). Hanya path relatif yang diawali `/` dan tanpa `//` di awal; nilai lain diabaikan dan diganti `/dashboard`. |
| Request body | Tidak ada. |
| Rate limit | 10/menit per IP. |

**Respons sukses — 302 Found (redirect, bukan JSON):**

```
HTTP/1.1 302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid%20email%20profile&state=...&code_challenge=...&code_challenge_method=S256
Set-Cookie: dokter_hp_oauth_state=<nilai>; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=600
Set-Cookie: dokter_hp_oauth_verifier=<nilai>; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=600
```

| Field | Keterangan |
|---|---|
| `scope` | `openid email profile` — hanya data identitas dasar. |
| `state` | Nilai acak anti-CSRF; dicocokkan di callback. |
| `code_challenge` | PKCE S256 dari `code_verifier`. |

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 429 | `RATE_LIMITED` | Melebihi 10/menit per IP. |
| 500 | `INTERNAL_ERROR` | Konfigurasi OAuth server tidak lengkap. |

**Catatan:**

- Endpoint ini dipakai lewat navigasi browser penuh (bukan `fetch`),
  karena responsnya redirect ke Google.
- Cookie OAuth sementara dihapus di callback (sukses maupun gagal).

### 1.2 Callback Google — `GET /auth/google/callback`

Google mengarahkan browser kembali ke endpoint ini setelah pengguna
menyetujui. Worker memvalidasi `state`, menukar `code` dengan token
di server, mengambil profil Google (`sub`, `email`, `name`), mencari
atau membuat pengguna (berdasar `google_sub`), membuat sesi, dan
redirect ke aplikasi.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /auth/google/callback` |
| Auth | Publik (tanpa sesi) |
| Header request | Cookie OAuth sementara dari 1.1 (dikirim browser otomatis). |
| Request body | Tidak ada. |
| Rate limit | 10/menit per IP (sama seperti 1.1; dihitung gabungan per IP). |

**Query string:**

| Parameter | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `code` | string | Ya | Authorization code dari Google. |
| `state` | string | Ya | Nilai state; harus sama dengan cookie `dokter_hp_oauth_state`. |
| `error` | string | Tidak | Bila pengguna menolak di Google (misalnya `access_denied`). |

**Respons sukses — 302 Found (redirect ke aplikasi):**

```
HTTP/1.1 302 Found
Location: /dashboard
Set-Cookie: dokter_hp_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
Set-Cookie: dokter_hp_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=0
Set-Cookie: dokter_hp_oauth_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=0
```

Tujuan redirect: nilai `redirect` dari 1.1 bila valid, bila tidak
`/dashboard`. Bila pengguna sudah mengatur PIN, sesi baru dibuat
dengan `terkunci = 1` dan frontend mengarahkan ke `/kunci` setelah
memeriksa `/auth/me` (lihat 1.4 dan 2.2).

**Efek samping di server:**

- Pengguna baru: baris `users` + `profiles` dibuat (`id` UUID baru,
  `nama` dari profil Google, `email` dari Google).
- Pengguna lama: `users.nama` diperbarui dari profil Google bila
  berubah (nama tampilan dari Google adalah sumber awal; perubahan
  manual lewat `PATCH /account/profile` tidak ditimpa — lihat
  catatan di 6.2).
- Baris `sessions` baru dibuat (`kedaluwarsa_pada` = sekarang +
  30 hari, `terkunci` = 1 bila PIN diatur, 0 bila tidak).

**Respons galat — redirect ke aplikasi dengan pesan galat**
(tetap 302, bukan JSON, karena dipanggil lewat navigasi browser):

```
HTTP/1.1 302 Found
Location: /masuk?error=oauth_gagal
```

| Kondisi | Tujuan redirect | Keterangan |
|---|---|---|
| `error=access_denied` dari Google | `/masuk?error=ditolak` | Pengguna menolak izin di Google. |
| `state` tidak cocok / hilang | `/masuk?error=oauth_gagal` | Kemungkinan serangan CSRF atau cookie kedaluwarsa. |
| `code` hilang / tidak valid | `/masuk?error=oauth_gagal` | — |
| Penukaran kode gagal di Google | `/masuk?error=oauth_gagal` | — |
| Pengambilan profil Google gagal | `/masuk?error=oauth_gagal` | — |
| Galat database saat membuat pengguna/sesi | `/masuk?error=server_sibuk` | — |

Frontend di `/masuk` membaca query `error` dan menampilkan pesan
yang sesuai dalam bahasa sehari-hari. Nilai `error` yang tidak
dikenal diperlakukan sebagai `oauth_gagal`.

### 1.3 Keluar — `POST /auth/logout`

Menghapus sesi saat ini di D1 dan menghapus cookie sesi di browser.

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /auth/logout` |
| Auth | Sesi wajib (cookie `dokter_hp_session`). Sesi terkunci PIN tetap boleh keluar. |
| Header request | `Cookie: dokter_hp_session=TOKEN` (dikirim browser otomatis). |
| Request body | Tidak ada. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "keluar": true },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

Header respons menyertakan penghapusan cookie:

```
Set-Cookie: dokter_hp_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. Frontend tetap menghapus keadaan login lokal dan mengarahkan ke landing (keluar bersifat idempotent dari sisi pengguna). |

**Catatan:** hanya sesi saat ini yang dihapus. Sesi di perangkat
lain tetap aktif sampai kedaluwarsa atau dihapus lewat
`DELETE /account/sessions/:id` (lihat 6.3).

### 1.4 Info pengguna saat ini — `GET /auth/me`

Mengembalikan identitas pengguna dari sesi saat ini. Dipakai
frontend setelah muat ulang halaman untuk memulihkan keadaan login,
dan untuk memutuskan apakah layar kunci PIN perlu tampil.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /auth/me` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (frontend butuh jawaban ini untuk menampilkan layar kunci). |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas baca: 300/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nama": "Adip",
    "email": "pengguna@example.com",
    "pin_diatur": true,
    "sesi_terkunci": true,
    "sesi_kedaluwarsa_pada": "2026-12-17T15:30:00.000Z"
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | ID pengguna (`users.id`, sama dengan `profiles.id`). |
| `nama` | string | Nama tampilan. |
| `email` | string | Email dari Google. |
| `pin_diatur` | boolean | `true` bila `users.pin_hash` terisi. |
| `sesi_terkunci` | boolean | `true` bila sesi saat ini `terkunci = 1` (PIN belum dibuka). |
| `sesi_kedaluwarsa_pada` | string (ISO 8601) | Kapan sesi ini kedaluwarsa. |

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid atau sesi kedaluwarsa. |

---

## 2. PIN

PIN 4–8 digit sebagai kunci aplikasi web. PIN disimpan sebagai
hash SHA-256 (PIN + salt acak per pengguna); PIN asli tidak pernah
disimpan dan tidak pernah dicatat di log.

Aturan kunci:

- Setelah 5 kali PIN salah berturut-turut, percobaan dikunci
  30 detik (`users.pin_terkunci_sampai`). Selama terkunci, setiap
  percobaan ditolak dengan `PIN_TERKUNCI` tanpa memeriksa PIN.
- PIN benar mereset penghitung `pin_gagal_berturut` ke 0.
- Pemulihan bila PIN lupa: masuk ulang dengan Google (sesi baru
  tetap terkunci), lalu atur PIN baru dari Pengaturan lewat
  `POST /auth/pin/set` — endpoint ini memakai sesi Google yang
  sah sebagai otorisasi, sehingga PIN lama tidak diperlukan.
  Riwayat yang sudah tersimpan tetap aman.

### 2.1 Atur PIN — `POST /auth/pin/set`

Mengatur PIN baru (atau mengganti PIN lama — PIN lama tidak perlu
diberikan karena sesi Google yang sah sudah menjadi otorisasi).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /auth/pin/set` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (jalur pemulihan bila PIN lupa). |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Request body (JSON):**

```json
{
  "pin": "123456"
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `pin` | string | Ya | Hanya digit `0-9`, panjang 4–8 karakter. Harus string, bukan angka JSON (agar PIN berawalan `0` seperti `0123` tidak hilang). |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "pin_diatur": true },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Efek samping:** `pin_hash` dan `pin_salt` baru disimpan;
`pin_gagal_berturut` direset ke 0; `pin_terkunci_sampai` dikosongkan.
Sesi saat ini langsung ditandai tidak terkunci (`terkunci = 0`).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `pin` hilang, bukan string, mengandung bukan-digit, atau panjang di luar 4–8. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |

### 2.2 Verifikasi PIN — `POST /auth/pin/verify`

Memeriksa PIN dan membuka kunci sesi bila benar. Dipanggil dari
layar kunci (`/kunci`).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /auth/pin/verify` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (ini memang tujuannya). |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | 5 percobaan salah berturut-turut → kunci 30 detik (bukan rate limit per menit). Selama terkunci, respons `PIN_TERKUNCI` (403). |

**Request body (JSON):**

```json
{
  "pin": "123456"
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `pin` | string | Ya | Hanya digit `0-9`, panjang 4–8 karakter. Format salah → `VALIDATION_ERROR` (tidak dihitung sebagai percobaan salah). |

**Respons sukses — 200 OK (PIN benar):**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "sesi_terkunci": false
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Efek samping bila benar:** sesi saat ini ditandai tidak terkunci
(`terkunci = 0`); `pin_gagal_berturut` direset ke 0.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Format `pin` tidak valid (tidak dihitung sebagai percobaan salah). |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 401 | `PIN_SALAH` | PIN salah. Body menyertakan `error.details.sisa_percobaan` (jumlah percobaan tersisa sebelum kunci). |
| 403 | `PIN_TERKUNCI` | Kunci 30 detik aktif. Body menyertakan `error.details.terkunci_sampai` dan `error.details.sisa_detik`. |
| 409 | `CONFLICT` | PIN belum diatur (tidak ada yang perlu diverifikasi). Frontend seharusnya tidak menampilkan layar kunci dalam keadaan ini. |

**Contoh respons `PIN_SALAH`:**

```json
{
  "success": false,
  "error": {
    "code": "PIN_SALAH",
    "message": "PIN salah, coba lagi.",
    "details": { "sisa_percobaan": 3 }
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Catatan:** percobaan ke-5 yang salah mengaktifkan kunci dan
mengembalikan `PIN_TERKUNCI` (403) beserta `sisa_detik: 30`, bukan
`PIN_SALAH`.

### 2.3 Hapus PIN — `POST /auth/pin/delete`

Menghapus PIN sehingga aplikasi tidak lagi menampilkan layar kunci.
Tidak memerlukan PIN lama (sesi Google yang sah adalah otorisasi).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /auth/pin/delete` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (jalur pemulihan bila PIN lupa). |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "pin_diatur": false },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Efek samping:** `pin_hash`, `pin_salt`, dan `pin_terkunci_sampai`
dikosongkan; `pin_gagal_berturut` direset ke 0. Semua sesi pengguna
ditandai tidak terkunci.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 409 | `CONFLICT` | PIN belum diatur (tidak ada yang dihapus). |

---
## 3. Health checks (pemeriksaan kesehatan)

Pemeriksaan kesehatan adalah hasil "Diagnosis satu ketuk": skor
0–100 beserta ringkasan per komponen. Skor dihitung frontend dari
komponen yang datanya tersedia; server menyimpan hasil hitungan itu
dan tidak menghitung ulang. Baris yang dibuat lewat web langsung
`sync_status: "synced"`.

**Bentuk objek health check (dipakai di semua respons):**

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "skor": 78,
  "ringkasan": {
    "wifi": { "status": "baik", "skor": 85, "sumber": "web" },
    "baterai": { "status": "cukup", "skor": 70, "sumber": "manual" },
    "penyimpanan": { "status": "baik", "skor": 90, "sumber": "apk" },
    "performa": { "status": "perlu_perhatian", "skor": 55, "sumber": "manual" },
    "keamanan": { "status": "baik", "skor": 80, "sumber": "apk" }
  },
  "dibuat_pada": "2026-11-17T15:30:00.000Z",
  "updated_at": "2026-11-17T15:30:00.000Z",
  "deleted_at": null,
  "sync_status": "synced"
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | Dibuat server. |
| `user_id` | string (UUID) | Pemilik; dari sesi, tidak pernah dari client. |
| `skor` | integer 0–100 | Skor keseluruhan. |
| `ringkasan` | object | Status per komponen. Kunci komponen: `wifi`, `baterai`, `penyimpanan`, `performa`, `keamanan`. Tiap komponen: `status` (`baik` / `cukup` / `perlu_perhatian`), `skor` (0–100), `sumber` (`web` / `apk` / `manual`). Komponen tanpa data tidak ada di objek ini. |
| `dibuat_pada` / `updated_at` | string (ISO 8601) | Waktu dibuat / terakhir diubah (server). |
| `deleted_at` | string (ISO 8601) / null | Terisi bila soft-delete; respons biasa selalu `null`. |
| `sync_status` | string | `pending` / `synced` / `failed`. Baris web selalu `synced`. |

### 3.1 Buat health check — `POST /health-checks`

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /health-checks` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Request body (JSON):**

```json
{
  "skor": 78,
  "ringkasan": {
    "wifi": { "status": "baik", "skor": 85, "sumber": "web" },
    "baterai": { "status": "cukup", "skor": 70, "sumber": "manual" }
  }
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `skor` | integer | Ya | 0–100. Desimal atau di luar rentang → `VALIDATION_ERROR`. |
| `ringkasan` | object | Tidak (default `{}`) | Kunci hanya dari daftar komponen yang dikenal (`wifi`, `baterai`, `penyimpanan`, `performa`, `keamanan`); kunci lain ditolak. Tiap komponen wajib punya `status` (enum), `skor` (integer 0–100), dan `sumber` (enum `web` / `apk` / `manual`). Ukuran JSON ringkasan maksimum 10 KB. |

**Respons sukses — 201 Created:**

```json
{
  "success": true,
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "skor": 78,
    "ringkasan": {
      "wifi": { "status": "baik", "skor": 85, "sumber": "web" },
      "baterai": { "status": "cukup", "skor": 70, "sumber": "manual" }
    },
    "dibuat_pada": "2026-11-17T15:30:00.000Z",
    "updated_at": "2026-11-17T15:30:00.000Z",
    "deleted_at": null,
    "sync_status": "synced"
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `skor` hilang / di luar 0–100 / bukan integer; `ringkasan` bukan objek atau komponennya tidak valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 429 | `RATE_LIMITED` | Melebihi batas tulis. |

### 3.2 Daftar health checks — `GET /health-checks`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /health-checks` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `offset` (default 0, ≥ 0). Lihat 0.6. |
| Rate limit | Batas baca: 300/menit per pengguna. |

Hanya baris milik pengguna dengan `deleted_at IS NULL`, terbaru
dulu. Dipakai dashboard (grafik riwayat skor) dan halaman Riwayat.

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "skor": 78,
      "ringkasan": {
        "wifi": { "status": "baik", "skor": 85, "sumber": "web" }
      },
      "dibuat_pada": "2026-11-17T15:30:00.000Z",
      "updated_at": "2026-11-17T15:30:00.000Z",
      "deleted_at": null,
      "sync_status": "synced"
    }
  ],
  "meta": {
    "timestamp": "2026-11-17T15:30:00.000Z",
    "pagination": { "limit": 20, "offset": 0, "total": 1, "has_more": false }
  }
}
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit`/`offset` bukan angka atau `offset` negatif. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 3.3 Detail health check — `GET /health-checks/:id`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /health-checks/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas baca: 300/menit per pengguna. |

`:id` adalah UUID health check. Format UUID tidak valid →
`VALIDATION_ERROR` (400).

**Respons sukses — 200 OK:** satu objek health check seperti di
3.1 (dalam `data`).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `:id` bukan UUID yang valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Tidak ada, sudah dihapus, atau bukan milik pengguna. |

### 3.4 Hapus health check — `DELETE /health-checks/:id`

Soft-delete: `deleted_at` diisi waktu saat ini; baris tidak dihapus
permanen. Baris yang sudah soft-delete tidak muncul lagi di daftar
atau detail (detail menjawab 404).

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /health-checks/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "deleted": true,
    "deleted_at": "2026-11-17T15:35:00.000Z"
  },
  "meta": { "timestamp": "2026-11-17T15:35:00.000Z" }
}
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `:id` bukan UUID yang valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Tidak ada, sudah dihapus, atau bukan milik pengguna. |

---

## 4. WiFi

Laporan WiFi menyimpan hasil tes yang diukur browser (kecepatan
unduh, latensi HTTP) ditambah info jaringan yang diisi manual bila
pengguna mengetahuinya. Tes tanpa akun tidak memanggil endpoint
ini — hasilnya hanya tampil di layar dan tidak tersimpan.

**Klasifikasi kecepatan unduh** (sama dengan APK, KB/detik):

| Kecepatan | Klasifikasi |
|---|---|
| < 50 | sangat lambat |
| < 200 | lambat |
| < 1000 | cukup |
| < 5000 | cepat |
| ≥ 5000 | sangat cepat |

Klasifikasi dihitung frontend untuk tampilan; server menyimpan
angka mentah dan tidak menghitung klasifikasi.

**Bentuk objek laporan WiFi (dipakai di semua respons):**

```json
{
  "id": "9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "ssid": "ACHA",
  "kecepatan_koneksi_mbps": 65,
  "kekuatan_sinyal": "kuat",
  "channel": 6,
  "dns": "1.1.1.1",
  "ping_ms": 42,
  "rekomendasi": "Kecepatan unduh sangat lambat. Coba ganti channel router ke 1, 6, atau 11.",
  "kecepatan_unduh_kbps": 3.2,
  "sumber": "web",
  "durasi_tes_detik": null,
  "dibuat_pada": "2026-11-17T15:30:00.000Z",
  "updated_at": "2026-11-17T15:30:00.000Z",
  "deleted_at": null
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | Dibuat server. |
| `user_id` | string (UUID) | Pemilik; dari sesi. |
| `ssid` | string / null | Nama WiFi (input manual; browser tidak bisa membacanya). |
| `kecepatan_koneksi_mbps` | number / null | Kecepatan koneksi yang dilaporkan perangkat (input manual / Network Information API). |
| `kekuatan_sinyal` | string / null | Label: `lemah` / `sedang` / `kuat` (input manual). |
| `channel` | integer / null | Channel WiFi 2,4 GHz (1–14) atau 5 GHz (32–177); input manual. |
| `dns` | string / null | DNS yang dipakai (input manual). |
| `ping_ms` | integer / null | Latensi HTTP dalam milidetik (median 3x `GET /ping`). Dilabeli "latensi HTTP", bukan ping ICMP. |
| `rekomendasi` | string / null | Teks rekomendasi yang dihitung frontend. |
| `kecepatan_unduh_kbps` | number / null | Hasil tes unduh 1 MB (KB/detik). |
| `sumber` | string | `web` / `apk` / `manual`. |
| `durasi_tes_detik` | integer / null | Terisi `30` untuk laporan tes bertahan; `null` untuk tes biasa. |
| `dibuat_pada` / `updated_at` | string (ISO 8601) | Waktu dibuat / terakhir diubah (server). |
| `deleted_at` | string (ISO 8601) / null | Terisi bila soft-delete; respons biasa selalu `null`. |

### 4.1 Buat laporan WiFi — `POST /wifi-reports`

Menyimpan satu hasil tes. Untuk tes bertahan 30 detik, frontend
membuat laporan dulu dengan `durasi_tes_detik: 30`, lalu mengirim
sampel per detik lewat 4.5.

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /wifi-reports` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Request body (JSON):**

```json
{
  "ssid": "ACHA",
  "kecepatan_koneksi_mbps": 65,
  "kekuatan_sinyal": "kuat",
  "channel": 6,
  "dns": "1.1.1.1",
  "ping_ms": 42,
  "rekomendasi": "Kecepatan unduh sangat lambat. Coba ganti channel router ke 1, 6, atau 11.",
  "kecepatan_unduh_kbps": 3.2,
  "sumber": "web",
  "durasi_tes_detik": null
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `ssid` | string / null | Tidak | Maksimum 32 karakter. String kosong diperlakukan sebagai `null`. |
| `kecepatan_koneksi_mbps` | number / null | Tidak | > 0 dan ≤ 10000. |
| `kekuatan_sinyal` | string / null | Tidak | Enum: `lemah`, `sedang`, `kuat`. |
| `channel` | integer / null | Tidak | 1–14 (2,4 GHz) atau 32–177 (5 GHz). |
| `dns` | string / null | Tidak | Maksimum 64 karakter. Format alamat IP tidak divalidasi ketat (pengguna boleh menulis nama DNS). |
| `ping_ms` | integer / null | Tidak | ≥ 0 dan ≤ 60000. |
| `rekomendasi` | string / null | Tidak | Maksimum 2000 karakter. |
| `kecepatan_unduh_kbps` | number / null | Tidak | ≥ 0 dan ≤ 1000000. |
| `sumber` | string | Tidak (default `web`) | Enum: `web`, `apk`, `manual`. |
| `durasi_tes_detik` | integer / null | Tidak | Bila terisi, harus 30 (satu-satunya durasi tes bertahan yang didukung). |

Minimal satu dari `kecepatan_unduh_kbps` atau `ping_ms` harus
terisi (laporan tanpa hasil ukur apa pun ditolak dengan
`VALIDATION_ERROR`).

**Respons sukses — 201 Created:** satu objek laporan WiFi seperti
di atas (dalam `data`).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Field di luar aturan, atau tidak ada hasil ukur sama sekali. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 429 | `RATE_LIMITED` | Melebihi batas tulis. |

### 4.2 Daftar laporan WiFi — `GET /wifi-reports`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /wifi-reports` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `offset` (default 0, ≥ 0). Lihat 0.6. |
| Rate limit | Batas baca: 300/menit per pengguna. |

Hanya baris milik pengguna dengan `deleted_at IS NULL`, terbaru
dulu. Daftar tidak menyertakan sampel tes bertahan (sampel hanya
di detail, 4.3).

**Respons sukses — 200 OK:** envelope daftar dengan `data` berisi
array objek laporan WiFi dan `meta.pagination` seperti 0.6.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit`/`offset` bukan angka atau `offset` negatif. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 4.3 Detail laporan WiFi — `GET /wifi-reports/:id`

Mengembalikan satu laporan beserta sampel tes bertahan bila ada
(laporan dengan `durasi_tes_detik: 30`).

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /wifi-reports/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas baca: 300/menit per pengguna. |

`:id` adalah UUID laporan. Format UUID tidak valid →
`VALIDATION_ERROR` (400).

**Respons sukses — 200 OK (laporan tes bertahan):**

```json
{
  "success": true,
  "data": {
    "id": "9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e",
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "ssid": "ACHA",
    "kecepatan_koneksi_mbps": 65,
    "kekuatan_sinyal": "kuat",
    "channel": 6,
    "dns": "1.1.1.1",
    "ping_ms": 42,
    "rekomendasi": "Kecepatan jatuh di tengah jalan.",
    "kecepatan_unduh_kbps": 48.5,
    "sumber": "web",
    "durasi_tes_detik": 30,
    "dibuat_pada": "2026-11-17T15:30:00.000Z",
    "updated_at": "2026-11-17T15:30:00.000Z",
    "deleted_at": null,
    "samples": [
      { "detik_ke": 0, "kecepatan_kbps": 52.1 },
      { "detik_ke": 1, "kecepatan_kbps": 49.8 },
      { "detik_ke": 2, "kecepatan_kbps": 47.3 }
    ]
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

| Field tambahan | Keterangan |
|---|---|
| `samples` | Array sampel, diurutkan `detik_ke` menaik. Kosong (`[]`) bila laporan bukan tes bertahan atau sampel belum dikirim. Tiap sampel: `detik_ke` (0–29) dan `kecepatan_kbps` (number). |

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `:id` bukan UUID yang valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Tidak ada, sudah dihapus, atau bukan milik pengguna. |

### 4.4 Hapus laporan WiFi — `DELETE /wifi-reports/:id`

Soft-delete: `deleted_at` diisi waktu saat ini; baris dan sampelnya
tidak dihapus permanen. Laporan yang sudah soft-delete tidak muncul
lagi di daftar atau detail (detail menjawab 404).

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /wifi-reports/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e",
    "deleted": true,
    "deleted_at": "2026-11-17T15:35:00.000Z"
  },
  "meta": { "timestamp": "2026-11-17T15:35:00.000Z" }
}
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `:id` bukan UUID yang valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Tidak ada, sudah dihapus, atau bukan milik pengguna. |

### 4.5 Kirim sampel tes bertahan — `POST /wifi-reports/:id/samples`

Menyimpan sampel per detik dari tes bertahan 30 detik ke laporan
yang sudah dibuat lewat 4.1 (dengan `durasi_tes_detik: 30`).
Frontend mengirim seluruh 30 sampel dalam satu request setelah tes
selesai. Bila koneksi putus di tengah jalan, frontend boleh mengirim
lagi sampel yang tersisa (sampel per `detik_ke` bersifat unik —
mengirim ulang detik yang sama menimpa nilai lama).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /wifi-reports/:id/samples` |
| Auth | Sesi wajib, tidak terkunci PIN. Laporan harus milik pengguna. |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Request body (JSON):**

```json
{
  "samples": [
    { "detik_ke": 0, "kecepatan_kbps": 52.1 },
    { "detik_ke": 1, "kecepatan_kbps": 49.8 },
    { "detik_ke": 2, "kecepatan_kbps": 47.3 }
  ]
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `samples` | array | Ya | 1–30 item. Array kosong → `VALIDATION_ERROR`. |
| `samples[].detik_ke` | integer | Ya | 0–29. Duplikat dalam satu request → `VALIDATION_ERROR`. |
| `samples[].kecepatan_kbps` | number | Ya | ≥ 0 dan ≤ 1000000. |

Jumlah total sampel per laporan dibatasi 30 (satu per detik).
Mengirim detik yang sudah ada menimpa nilai lama (upsert pada
`UNIQUE (wifi_report_id, detik_ke)`), bukan galat.

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "wifi_report_id": "9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e",
    "disimpan": 30,
    "total_sampel": 30
  },
  "meta": { "timestamp": "2026-11-17T15:30:35.000Z" }
}
```

| Field | Keterangan |
|---|---|
| `disimpan` | Jumlah sampel yang diproses dalam request ini. |
| `total_sampel` | Jumlah total sampel yang kini dimiliki laporan (maksimum 30). |

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `samples` hilang/bukan array/kosong/> 30 item; `detik_ke` di luar 0–29 atau duplikat; `kecepatan_kbps` di luar batas. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Laporan tidak ada, sudah dihapus, atau bukan milik pengguna. |
| 422 | `VALIDATION_ERROR` | Laporan bukan tes bertahan (`durasi_tes_detik` bukan 30) — sampel hanya untuk laporan tes bertahan. |

---
## 5. Diagnosis AI

Worker merakit konteks dari riwayat pengguna (pemeriksaan terakhir
+ laporan WiFi terakhir) dan mengirimnya bersama pertanyaan ke
Gemini. Kunci Gemini hanya ada sebagai secret Worker; tidak pernah
ada di browser dan tidak pernah di repo.

Bila Gemini gagal atau timeout, Worker mengembalikan
`AI_TIDAK_TERSEDIA` (502) — jawaban tidak pernah dikarang.
Pertanyaan yang gagal dijawab TIDAK disimpan ke riwayat.

**Bentuk objek diagnosis AI (dipakai di semua respons):**

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "health_check_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "pertanyaan": "WiFi lemot padahal sinyal penuh, kenapa?",
  "jawaban": "Sinyal penuh belum tentu berarti cepat. ...",
  "dibuat_pada": "2026-11-17T15:30:00.000Z"
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | Dibuat server. |
| `user_id` | string (UUID) | Pemilik; dari sesi. |
| `health_check_id` | string (UUID) / null | Pemeriksaan yang dikaitkan (bila pengguna bertanya dari hasil pemeriksaan tertentu). |
| `pertanyaan` | string | Keluhan pengguna, apa adanya. |
| `jawaban` | string | Jawaban Gemini, Bahasa Indonesia. Ditampilkan frontend sebagai teks biasa (tanpa HTML). |
| `dibuat_pada` | string (ISO 8601) | Waktu dibuat (server). |

### 5.1 Tanya AI — `POST /ai/diagnose`

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /ai/diagnose` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | 20/hari per pengguna (kuota harian, reset 00:00 UTC). Selain itu batas tulis umum 60/menit. |
| Timeout | Worker menunggu Gemini maksimum 30 detik; lebih dari itu → `AI_TIDAK_TERSEDIA` (502). |

**Request body (JSON):**

```json
{
  "pertanyaan": "WiFi lemot padahal sinyal penuh, kenapa?",
  "health_check_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `pertanyaan` | string | Ya | 1–2000 karakter setelah dipangkas (trim). String kosong / hanya spasi → `VALIDATION_ERROR`. |
| `health_check_id` | string (UUID) / null | Tidak | Bila terisi, harus UUID yang valid dan merujuk ke health check milik pengguna. Bila merujuk ke data orang lain atau tidak ada → `NOT_FOUND` (404). |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "health_check_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "pertanyaan": "WiFi lemot padahal sinyal penuh, kenapa?",
    "jawaban": "Sinyal penuh belum tentu berarti cepat. ...",
    "dibuat_pada": "2026-11-17T15:30:00.000Z"
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `pertanyaan` hilang/kosong/> 2000 karakter; `health_check_id` bukan UUID. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | `health_check_id` tidak ada atau bukan milik pengguna. |
| 429 | `AI_QUOTA_HABIS` | Kuota 20/hari sudah habis. Header `Retry-After` berisi detik sampai reset 00:00 UTC. |
| 429 | `RATE_LIMITED` | Melebihi batas tulis 60/menit. |
| 502 | `AI_TIDAK_TERSEDIA` | Gemini galat/timeout. Pertanyaan tidak disimpan. |

### 5.2 Riwayat diagnosis AI — `GET /ai/diagnoses`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /ai/diagnoses` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `offset` (default 0, ≥ 0). Lihat 0.6. |
| Rate limit | Batas baca: 300/menit per pengguna. |

Hanya riwayat milik pengguna, terbaru dulu. Tidak ada endpoint
hapus per diagnosis (riwayat AI ikut terhapus saat hapus akun,
lihat 6.4).

**Respons sukses — 200 OK:** envelope daftar dengan `data` berisi
array objek diagnosis AI dan `meta.pagination` seperti 0.6.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit`/`offset` bukan angka atau `offset` negatif. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

---

## 6. Akun

### 6.1 Profil — `GET /account/profile`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /account/profile` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas baca: 300/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nama": "Adip",
    "email": "pengguna@example.com",
    "dibuat_pada": "2026-11-17T10:00:00.000Z"
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | ID pengguna. |
| `nama` | string | Nama tampilan (dari `profiles.nama`). |
| `email` | string | Email dari Google (tidak bisa diubah lewat API ini). |
| `dibuat_pada` | string (ISO 8601) | Waktu akun dibuat. |

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

**Catatan:** `/auth/me` (1.4) dan endpoint ini tumpang tindih
dengan sengaja — `/auth/me` untuk pemulihan keadaan login
(termasuk status kunci PIN), endpoint ini untuk halaman Pengaturan.

### 6.2 Ubah nama — `PATCH /account/profile`

| Aspek | Keterangan |
|---|---|
| Method + path | `PATCH /account/profile` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Request body (JSON):**

```json
{
  "nama": "Adip RMX"
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `nama` | string | Ya | 1–100 karakter setelah dipangkas (trim). String kosong / hanya spasi → `VALIDATION_ERROR`. |

Nama disimpan ke `profiles.nama` dan `users.nama` sekaligus agar
keduanya tetap sama. Nama yang diubah manual tidak ditimpa lagi
oleh nama dari profil Google pada login berikutnya (Worker hanya
memakai nama Google untuk pengguna baru).

**Respons sukses — 200 OK:** objek profil yang diperbarui, sama
bentuknya dengan 6.1.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `nama` hilang/kosong/> 100 karakter. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 6.3 Daftar sesi aktif — `GET /account/sessions`

Menampilkan semua sesi aktif milik pengguna (untuk halaman
Pengaturan: "keluar dari sesi lain"). Sesi saat ini ditandai
`saat_ini: true`.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /account/sessions` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `offset` (default 0, ≥ 0). Lihat 0.6. |
| Rate limit | Batas baca: 300/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": [
    {
      "id": "e5f6a7b8-1234-5678-90ab-cdef12345678",
      "saat_ini": true,
      "user_agent": "Mozilla/5.0 (Linux; Android 14; ...)",
      "ip_terakhir": "203.0.113.42",
      "dibuat_pada": "2026-11-17T10:00:00.000Z",
      "kedaluwarsa_pada": "2026-12-17T10:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-11-17T15:30:00.000Z",
    "pagination": { "limit": 20, "offset": 0, "total": 1, "has_more": false }
  }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | ID sesi (untuk `DELETE /account/sessions/:id`). |
| `saat_ini` | boolean | `true` untuk sesi yang dipakai pada request ini. |
| `user_agent` | string / null | User-Agent browser saat sesi dibuat. |
| `ip_terakhir` | string / null | IP terakhir yang memakai sesi ini. |
| `dibuat_pada` / `kedaluwarsa_pada` | string (ISO 8601) | Waktu dibuat / kedaluwarsa. |

Sesi yang sudah kedaluwarsa tidak ditampilkan. `token_hash` tidak
pernah dikembalikan.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit`/`offset` bukan angka atau `offset` negatif. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 6.4 Keluar dari satu sesi — `DELETE /account/sessions/:id`

Menghapus satu sesi milik pengguna (misalnya sesi di perangkat
lain). Menghapus sesi saat ini sama efeknya dengan keluar
(`POST /auth/logout`) — frontend harus mengarahkan ke landing
setelah itu.

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /account/sessions/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

`:id` adalah UUID sesi. Format UUID tidak valid →
`VALIDATION_ERROR` (400).

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "e5f6a7b8-1234-5678-90ab-cdef12345678",
    "deleted": true
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

Bila sesi yang dihapus adalah sesi saat ini, respons juga
menyertakan header penghapusan cookie (sama seperti 1.3).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `:id` bukan UUID yang valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Sesi tidak ada, sudah kedaluwarsa/dihapus, atau bukan milik pengguna. |

### 6.5 Hapus akun — `DELETE /account`

Menghapus akun beserta seluruh data pengguna secara permanen
(hard delete): profil, health checks, laporan WiFi + sampelnya,
diagnosis AI, semua sesi, dan PIN. Penghapusan tidak bisa dibatalkan.

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /account` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: dokter_hp_session=TOKEN`. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Request body (JSON):**

```json
{
  "konfirmasi": "HAPUS"
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `konfirmasi` | string | Ya | Harus persis `HAPUS` (huruf besar semua). Nilai lain → `KONFIRMASI_SALAH` (422). |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "email": "pengguna@example.com"
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

Header respons menyertakan penghapusan cookie (sama seperti 1.3).
Frontend mengarahkan ke landing setelah berhasil.

**Efek samping:** baris `users` dihapus; baris terkait ikut
terhapus lewat foreign key cascade (`profiles`, `sessions`,
`health_checks`, `wifi_reports` + `wifi_sustained_samples`,
`ai_diagnoses`). Worker memastikan `PRAGMA foreign_keys = ON`
aktif, atau menghapus baris anak secara eksplisit bila cascade
tidak bisa diandalkan di D1.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `konfirmasi` hilang atau bukan string. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 422 | `KONFIRMASI_SALAH` | `konfirmasi` bukan `HAPUS`. |

### 6.6 Ekspor data — `GET /account/export`

Mengunduh seluruh data milik pengguna sebagai satu file JSON
(profil, health checks, laporan WiFi beserta sampel tes bertahan,
dan diagnosis AI). Dipakai sebelum hapus akun, atau bila pengguna
ingin menyimpan salinan datanya.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /account/export` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | 5/hari per pengguna (ekspor membaca seluruh data; batas ketat untuk melindungi kuota D1). |

**Respons sukses — 200 OK:**

```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Disposition: attachment; filename="dokter-hp-export-2026-11-17.json"
```

Body adalah JSON (tanpa envelope — ini berkas unduhan, bukan
respons API biasa):

```json
{
  "format": "dokter-hp-export",
  "versi": 1,
  "dieksport_pada": "2026-11-17T15:30:00.000Z",
  "profil": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nama": "Adip",
    "email": "pengguna@example.com",
    "dibuat_pada": "2026-11-17T10:00:00.000Z"
  },
  "health_checks": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "skor": 78,
      "ringkasan": { "wifi": { "status": "baik", "skor": 85, "sumber": "web" } },
      "dibuat_pada": "2026-11-17T15:30:00.000Z",
      "sync_status": "synced"
    }
  ],
  "wifi_reports": [
    {
      "id": "9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e",
      "ssid": "ACHA",
      "kecepatan_koneksi_mbps": 65,
      "kekuatan_sinyal": "kuat",
      "channel": 6,
      "dns": "1.1.1.1",
      "ping_ms": 42,
      "rekomendasi": "Kecepatan unduh sangat lambat.",
      "kecepatan_unduh_kbps": 3.2,
      "sumber": "web",
      "durasi_tes_detik": 30,
      "dibuat_pada": "2026-11-17T15:30:00.000Z",
      "samples": [
        { "detik_ke": 0, "kecepatan_kbps": 52.1 },
        { "detik_ke": 1, "kecepatan_kbps": 49.8 }
      ]
    }
  ],
  "ai_diagnoses": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "health_check_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "pertanyaan": "WiFi lemot padahal sinyal penuh, kenapa?",
      "jawaban": "Sinyal penuh belum tentu berarti cepat. ...",
      "dibuat_pada": "2026-11-17T15:30:00.000Z"
    }
  ]
}
```

**Aturan ekspor:**

- Hanya data milik pengguna; baris soft-delete (`deleted_at`
  terisi) tidak ikut diekspor.
- PIN (hash/salt), token sesi, dan `google_sub` TIDAK ikut
  diekspor.
- Bila data sangat besar, Worker tetap mengembalikan satu file
  (tanpa paginasi) — batas praktis: ekspor dibatasi 5.000 baris
  per tabel; bila melebihi, respons menambahkan field
  `"terpotong": true` di tingkat atas dan frontend menampilkan
  peringatan bahwa ekspor tidak lengkap.
- Nama file: `dokter-hp-export-YYYY-MM-DD.json` (tanggal UTC).

**Respons galat (memakai envelope standar, bukan berkas):**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 429 | `RATE_LIMITED` | Melebihi 5/hari. |

**Catatan:** endpoint ini adalah tambahan dari penugasan tim
kontrak API; belum ada di `ARCHITECTURE.md` §3.5. Lihat Changelog.

---
## 7. Utilitas (publik)

Endpoint publik tanpa sesi. Tidak menyentuh D1 (kecuali dinyatakan
lain), sehingga tetap menjawab saat database sibuk dan murah untuk
dipanggil berulang.

### 7.1 Liveness — `GET /health`

Dipakai pemantau uptime dan banner "Tidak tersambung ke server" di
frontend. Tanpa akses D1 — hanya membuktikan Worker hidup.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /health` |
| Auth | Publik (tanpa sesi). |
| Header request | Tidak ada header khusus. |
| Request body | Tidak ada. |
| Rate limit | Tanpa batas ketat. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "status": "ok" },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Respons galat:** tidak ada respons galat khusus — bila Worker
tidak menjawab sama sekali, pemantau mencatat downtime.

### 7.2 Latensi HTTP — `GET /ping`

Target pengukuran latensi HTTP dari browser. Frontend memanggilnya
3x dan mengambil median sebagai `ping_ms` (lihat 4.1). Respons
dibuat sekecil mungkin dan tanpa akses D1.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /ping` |
| Auth | Publik (tanpa sesi). |
| Header request | Tidak ada header khusus. |
| Request body | Tidak ada. |
| Rate limit | Tanpa batas ketat. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "ok": true, "t": 1763489400000 },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `data.ok` | boolean | Selalu `true`. |
| `data.t` | integer | Waktu server dalam milidetik sejak epoch (dipakai frontend untuk mengoreksi jam lokal bila perlu). |

**Catatan:** latensi diukur frontend dari waktu round-trip request,
bukan dari field `t`. Field `t` hanya penanda waktu server.

### 7.3 Info speedtest — `GET /speedtest/info`

Memberi tahu frontend file tes kecepatan mana yang tersedia dan
ukurannya, agar frontend tidak mengarang ukuran file. File tes
sendiri disajikan sebagai aset statis dari Pages yang sama
(`/speedtest-1mb.bin`), bukan dari endpoint ini.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /speedtest/info` |
| Auth | Publik (tanpa sesi). |
| Header request | Tidak ada header khusus. |
| Request body | Tidak ada. |
| Rate limit | Tanpa batas ketat (tanpa akses D1). |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "file": "/speedtest-1mb.bin",
    "ukuran_byte": 1048576,
    "ukuran_label": "1 MB",
    "timeout_detik": 15,
    "tes_bertahan_detik": 30
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `file` | string | Path file tes di origin frontend (relatif; frontend mengambil dari origin yang sama dengan halaman). |
| `ukuran_byte` | integer | Ukuran file dalam byte (1 MB = 1.048.576 byte). Frontend memakai angka ini untuk menghitung KB/detik. |
| `ukuran_label` | string | Label untuk ditampilkan. |
| `timeout_detik` | integer | Timeout tes unduh (15 detik, sesuai PRODUCT.md §4.4). |
| `tes_bertahan_detik` | integer | Durasi tes bertahan (30 detik, sesuai PRODUCT.md §4.4). |

**Catatan:** endpoint ini adalah tambahan dari penugasan tim
kontrak API; belum ada di `ARCHITECTURE.md` §3.6. File
`speedtest-1mb.bin` sendiri disajikan Pages (aset statis), bukan
Worker. Lihat Changelog.

---

## 8. Contoh curl per grup

Basis URL contoh: `https://api.dokter-hp.example.com` (ganti
dengan basis nyata). Token sesi memakai placeholder `TOKEN` —
ganti dengan nilai cookie `dokter_hp_session` dari browser saat
menguji. **Jangan menulis token atau secret asli di dokumen atau
di chat.**

Autentikasi pada contoh memakai header cookie:

```
-H "Cookie: dokter_hp_session=TOKEN"
```

### 8.1 Auth Google dan sesi

```bash
# Mulai masuk Google (buka di browser, bukan curl — responsnya redirect):
# https://api.dokter-hp.example.com/auth/google

# Info pengguna saat ini:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/auth/me

# Keluar:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/auth/logout
```

### 8.2 PIN

```bash
# Atur PIN:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "123456"}' \
  https://api.dokter-hp.example.com/auth/pin/set

# Verifikasi PIN:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "123456"}' \
  https://api.dokter-hp.example.com/auth/pin/verify

# Hapus PIN:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/auth/pin/delete
```

### 8.3 Health checks

```bash
# Buat health check:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skor": 78, "ringkasan": {"wifi": {"status": "baik", "skor": 85, "sumber": "web"}}}' \
  https://api.dokter-hp.example.com/health-checks

# Daftar health checks:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/health-checks?limit=20&offset=0"

# Detail health check:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/health-checks/7c9e6679-7425-40de-944b-e07fc1f90ae7

# Hapus health check:
curl -s -X DELETE -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/health-checks/7c9e6679-7425-40de-944b-e07fc1f90ae7
```

### 8.4 WiFi

```bash
# Buat laporan WiFi:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssid": "ACHA", "kecepatan_koneksi_mbps": 65, "kekuatan_sinyal": "kuat", "channel": 6, "dns": "1.1.1.1", "ping_ms": 42, "kecepatan_unduh_kbps": 3.2, "sumber": "web"}' \
  https://api.dokter-hp.example.com/wifi-reports

# Daftar laporan WiFi:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/wifi-reports?limit=20&offset=0"

# Detail laporan WiFi (termasuk sampel tes bertahan):
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/wifi-reports/9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e

# Hapus laporan WiFi:
curl -s -X DELETE -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/wifi-reports/9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e

# Buat laporan tes bertahan 30 detik, lalu kirim sampelnya:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssid": "ACHA", "ping_ms": 42, "kecepatan_unduh_kbps": 48.5, "sumber": "web", "durasi_tes_detik": 30}' \
  https://api.dokter-hp.example.com/wifi-reports

curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"samples": [{"detik_ke": 0, "kecepatan_kbps": 52.1}, {"detik_ke": 1, "kecepatan_kbps": 49.8}]}' \
  https://api.dokter-hp.example.com/wifi-reports/9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e/samples
```

### 8.5 AI

```bash
# Tanya AI:
curl -s -X POST -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pertanyaan": "WiFi lemot padahal sinyal penuh, kenapa?"}' \
  https://api.dokter-hp.example.com/ai/diagnose

# Riwayat diagnosis AI:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/ai/diagnoses?limit=20&offset=0"
```

### 8.6 Akun

```bash
# Profil:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/account/profile

# Ubah nama:
curl -s -X PATCH -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nama": "Adip RMX"}' \
  https://api.dokter-hp.example.com/account/profile

# Daftar sesi aktif:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/account/sessions

# Keluar dari satu sesi:
curl -s -X DELETE -H "Cookie: dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/account/sessions/e5f6a7b8-1234-5678-90ab-cdef12345678

# Ekspor data:
curl -s -H "Cookie: dokter_hp_session=TOKEN" \
  -o dokter-hp-export.json \
  https://api.dokter-hp.example.com/account/export

# Hapus akun (tidak bisa dibatalkan):
curl -s -X DELETE -H "Cookie: dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"konfirmasi": "HAPUS"}' \
  https://api.dokter-hp.example.com/account
```

### 8.7 Utilitas

```bash
# Liveness:
curl -s https://api.dokter-hp.example.com/health

# Latensi HTTP:
curl -s https://api.dokter-hp.example.com/ping

# Info speedtest:
curl -s https://api.dokter-hp.example.com/speedtest/info
```

---

## 9. Hal yang masih terbuka

1. **Basis URL nyata** — domain/subdomain Worker belum diputuskan
   (lihat `ARCHITECTURE.md` §9 poin 1). Semua contoh memakai
   placeholder `api.dokter-hp.example.com`.
2. **Jumlah endpoint di ARCHITECTURE.md** — dokumen arsitektur
   menyebut 24 endpoint, tetapi tabel §3-nya berisi 25. Dokumen ini
   mendokumentasikan 25 itu ditambah 2 endpoint baru (ekspor data,
   info speedtest) sehingga total 27. Koordinator perlu mengonfirmasi
   apakah angka 24 adalah kesalahan hitung atau ada satu endpoint
   yang memang tidak jadi dibangun.
3. **Endpoint baru belum ada di ARCHITECTURE.md** — `GET
   /account/export` dan `GET /speedtest/info` ditambahkan atas
   penugasan tim ini. Perlu persetujuan koordinator dan pencatatan
   di `ARCHITECTURE.md` §3 (atau penghapusan bila tidak disetujui).
4. **Implementasi rate limit** — tabel D1 vs fitur platform belum
   diputuskan (lihat `ARCHITECTURE.md` §9 poin 6). Kontrak ini hanya
   menetapkan batas dan bentuk respons 429.
5. **Nama dari Google vs nama manual** — kontrak ini menetapkan
   nama manual tidak ditimpa nama Google pada login berikutnya
   (lihat 6.2). Perlu konfirmasi tim implementasi bahwa Worker
   membedakan pengguna baru dan pengguna lama dengan benar.
6. **Sesi terkunci dan endpoint PIN** — kontrak ini mengizinkan
   `/auth/me`, `/auth/pin/set`, `/auth/pin/verify`,
   `/auth/pin/delete`, dan `/auth/logout` dipanggil saat sesi
   terkunci; semua endpoint lain menolak dengan `SESSION_LOCKED`.
   Perlu uji eksplisit di implementasi.
7. **Ekspor data: batas 5.000 baris per tabel** — angka ini adalah
   keputusan kontrak (batas praktis), belum diuji terhadap kuota
   baca D1. Tim implementasi perlu memvalidasi saat membangun.
8. **Sinkron APK** — di luar kontrak ini (fase berikutnya, lihat
   `ARCHITECTURE.md` §9 poin 5). Bila endpoint sinkron ditambahkan
   nanti, dokumen ini perlu revisi.

## 10. Changelog dokumen

### 17 November 2026 — Versi awal (Fase 1)

- Kontrak lengkap 27 endpoint: Auth Google (4), PIN (3), health
  checks (4), WiFi (5), AI (2), akun (6), utilitas (3).
- Envelope JSON standar sukses/gagal dan 17 kode galat konsisten.
- Validasi tiap field, rate limit per endpoint, dan contoh curl
  per grup (token memakai placeholder `TOKEN`, tanpa secret asli).
- Endpoint baru yang belum ada di `ARCHITECTURE.md` §3:
  `GET /account/export` (ekspor data pengguna sebagai JSON) dan
  `GET /speedtest/info` (info file tes kecepatan).
- Keputusan kontrak yang perlu konfirmasi koordinator: total
  endpoint 27 (bukan 24), nama manual tidak ditimpa nama Google,
  batas ekspor 5.000 baris per tabel.
