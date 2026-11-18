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
- Badan JSON dibatasi 100 KB — lebih dari itu ditolak
  413 `PAYLOAD_TOO_LARGE` (R-20) sebelum dibaca penuh.
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
| `meta.pagination` | object | Hanya endpoint daftar: `{ limit, next_cursor, has_more }` (paginasi cursor, lihat 0.6). |

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
| `error.details` | object (opsional) | Rincian tambahan; bentuknya tergantung kode galat (peta field pada `VALIDATION_ERROR`; `sisa_detik`/`terkunci_sampai` pada `PIN_TERKUNCI`; `sisa_percobaan` pada `PIN_SALAH`; `alasan: "PIN_LEMAH"` pada PIN lemah). Lihat contoh di 0.5. |
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
| Nama | `__Host-dokter_hp_session` |
| Nilai | Token sesi mentah (hex/base64url, 32 byte) |
| HttpOnly | Ya (tidak bisa dibaca JavaScript) |
| Secure | Ya (hanya lewat HTTPS) |
| SameSite | `None` (K-50: frontend Pages dan API Worker beda origin, jadi cookie lintas situs wajib `SameSite=None; Secure`) |
| Path | `/` |
| Max-Age | 30 hari (2.592.000 detik) |

Prefix `__Host-` (R-18) mengikat cookie ke host yang mengaturnya:
browser menolak cookie ini bila tidak memakai `Secure` dan
`Path=/` dan tanpa atribut `Domain` — ketiganya dipenuhi di atas.
Maksimal 10 sesi per pengguna; login ke-11 menghapus sesi tertua
(R-22).

Frontend memanggil API dengan `fetch(..., { credentials: "include" })`
agar cookie ikut terkirim. Frontend TIDAK menyimpan token di
`localStorage` atau `sessionStorage`, dan TIDAK mengirim token lewat
header `Authorization` (tidak ada skema Bearer di API ini).

**Status sesi yang mungkin:**

| Status | Artinya |
|---|---|
| Tidak ada cookie / cookie kosong | Pengguna belum masuk. |
| Token tidak ditemukan di D1 | Sesi sudah dihapus (keluar) atau tidak valid. |
| `expires_at` sudah lewat | Sesi kedaluwarsa (30 hari). |
| Sesi terkunci PIN | Pengguna sudah mengatur PIN tetapi sesi ini belum dibuka dengan PIN: tidak ada baris `pin_unlocks` untuk sesi ini (tidak ada kolom `terkunci` di tabel `sessions` — status kunci berasal dari tabel `pin_unlocks`). Endpoint selain PIN dan `GET /api/auth/me` menolak sesi terkunci dengan `SESSION_LOCKED` (403). |

**Penegakan kepemilikan.** Setiap query data memfilter `user_id`
dari sesi yang terverifikasi. Tidak ada endpoint yang menerima
`user_id` dari client. Bila pengguna meminta data milik pengguna
lain (misalnya `/api/health-checks/:id` milik orang lain), server
menjawab **404 `NOT_FOUND`** — sama seperti bila data tidak ada —
agar keberadaan data orang lain tidak bisa ditebak.

**Header yang diterima pada endpoint tulis (CSRF):**

| Header | Wajib | Keterangan |
|---|---|---|
| `Content-Type: application/json` | Ya (POST/PATCH/DELETE berbody) | Body bukan JSON ditolak dengan `VALIDATION_ERROR` (400). |
| `Origin` | Ya (browser mengirim otomatis) | Pada endpoint mutasi (POST/PATCH/PUT/DELETE), bila header `Origin` ada dan tidak diizinkan menurut logika allowlist yang sama dengan CORS (K-73), Worker menolak dengan `FORBIDDEN` (403). Permintaan tanpa header `Origin` (curl, aplikasi non-browser) tetap diteruskan. |

**CORS (K-73).** Origin yang diizinkan berasal dari variabel
lingkungan `ALLOWED_ORIGIN` — daftar dipisah koma (satu origin
atau lebih), dengan `credentials: true`. Tidak ada wildcard `*`
di produksi. Bila `ALLOWED_ORIGIN` tidak diatur, Worker
fail-closed: hanya origin loopback (`http://localhost:*`,
`http://127.0.0.1:*`) dan origin sama-host dengan API yang
diizinkan; origin lain tidak mendapat header
`Access-Control-Allow-Origin` sama sekali. Worker TIDAK PERNAH
meng-echo origin pemanggil (perilaku echo adalah temuan R-01 dan
sudah dihapus). Preflight `OPTIONS` dijawab Worker dengan header
CORS yang sesuai.

### 0.5 Kode galat

Semua kode dipakai konsisten di seluruh endpoint. Frontend boleh
bercabang dari `error.code`; `error.message` hanya untuk ditampilkan.

| HTTP | Kode | Artinya | Pesan contoh |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query tidak valid (tipe salah, di luar batas, field wajib hilang, JSON rusak). | "Data yang dikirim tidak lengkap atau tidak valid." |
| 400 | `INVALID_JSON` | Body bukan JSON yang bisa dibaca. | "Format data yang dikirim tidak dikenali." |
| 401 | `UNAUTHORIZED` | Sesi tidak ada, tidak valid, atau kedaluwarsa. | "Sesi Anda sudah berakhir, silakan masuk lagi." |
| 401 | `PIN_SALAH` | PIN yang dimasukkan salah: pada `/api/auth/pin/verify` (PIN buka sesi) maupun pada `/api/auth/pin/set` dan `/api/auth/pin/delete` (PIN lama salah). Menghitung ke penghitung kunci PIN. | "PIN salah, coba lagi." / "PIN lama salah, coba lagi." |
| 403 | `FORBIDDEN` | Origin tidak diizinkan atau aksi dilarang. | "Aksi ini tidak diizinkan." |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN; buka dulu dengan PIN. | "Aplikasi terkunci, masukkan PIN untuk membuka." |
| 403 | `PIN_TERKUNCI` | PIN terkunci sementara setelah 5 kali salah berturut-turut. | "Terlalu banyak percobaan salah. Coba lagi dalam 30 detik." |
| 403 | `PIN_LAMA_DIPERLUKAN` | Ubah/hapus PIN di luar tenggang 10 menit tanpa `pin_lama`, bila PIN sudah diatur (K-70, K-81). | "Masukkan PIN lama untuk mengubah PIN." |
| 403 | `LOGIN_ULANG_DIPERLUKAN` | Hapus akun tanpa autentikasi baru ≤10 menit (K-72). | "Untuk keamanan, silakan masuk lagi sebelum menghapus akun." |
| 404 | `NOT_FOUND` | Data tidak ditemukan atau bukan milik pengguna. Rute yang tidak dikenal juga 404 `NOT_FOUND` (tidak ada respons 405 terpisah). | "Data tidak ditemukan." |
| 409 | `CONFLICT` | Konflik keadaan: PIN belum diatur (pada `/api/auth/pin/verify` dan `/api/auth/pin/delete`), atau sampel detik yang sama sudah ada. | "PIN belum diatur." / "Data ini sudah ada." |
| 413 | `PAYLOAD_TOO_LARGE` | Badan JSON melebihi 100 KB (R-20). | "Data yang dikirim terlalu besar." |
| 422 | `KONFIRMASI_SALAH` | Teks konfirmasi hapus akun tidak cocok. | "Teks konfirmasi tidak cocok. Ketik HAPUS atau DELETE untuk melanjutkan." |
| 429 | `RATE_LIMITED` | Melebihi batas rate limit. | "Terlalu sering, coba lagi sebentar." |
| 429 | `AI_QUOTA_HABIS` | Kuota harian Diagnosis AI (20/hari) habis. | "Kuota Diagnosis AI hari ini sudah habis, coba lagi besok." |
| 500 | `INTERNAL_ERROR` | Galat server tak terduga. | "Terjadi kesalahan di server, coba lagi nanti." |
| 503 | `DATABASE_SIBUK` | D1 error/kuota habis. | "Server sedang sibuk, coba lagi nanti." |

Kode yang sudah pensiun dan TIDAK BOLEH dipakai lagi: `AI_TIDAK_TERSEDIA`
(502 — K-23: Diagnosis AI selalu menjawab 200, gagal Gemini menjadi
jawaban fallback berlabel), `PIN_BELUM_DIATUR` dan `SESI_TIDAK_VALID`
(K-47: diganti `CONFLICT` 409 dan `UNAUTHORIZED` 401),
`RATE_LIMIT_EXCEEDED` (K-59: kanonisnya `RATE_LIMITED`),
`PIN_SUDAH_DIATUR` (PIN bisa diatur ulang lewat endpoint yang sama,
tidak ada konflik).

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

Semua endpoint daftar (`GET /api/health-checks`,
`GET /api/wifi-reports`, `GET /api/ai/diagnoses`,
`GET /api/account/sessions`, `GET /api/history`,
`GET /api/wifi-reports/:id/samples`) memakai paginasi cursor
keyset yang sama (K-32):

| Query | Tipe | Default | Keterangan |
|---|---|---|---|
| `limit` | integer | 20 | Jumlah baris per halaman. Nilai < 1 diklem ke 1, > 100 diklem ke 100; bukan angka (atau kosong) → `VALIDATION_ERROR` (400). |
| `cursor` | string (base64url) | — (halaman pertama) | Cursor buram dari `meta.pagination.next_cursor` halaman sebelumnya. Tidak ada atau kosong → halaman pertama. Cursor yang tidak bisa didekode → `VALIDATION_ERROR` (400). |

Cursor berisi kunci keyset (`dibuat_pada` + `id` baris terakhir
halaman sebelumnya) dalam JSON yang di-encode base64url. Client
TIDAK BOLEH mengurai atau merakit cursor sendiri — perlakukan
sebagai string buram yang hanya diteruskan apa adanya.

Respons daftar memakai bentuk ini:

```json
{
  "success": true,
  "data": [ "..." ],
  "meta": {
    "timestamp": "2026-11-17T15:30:00.000Z",
    "pagination": {
      "limit": 20,
      "next_cursor": "eyJkaWJ1YXRfcGFkYSI6IjIwMjYtMTEtMTdUMTU6MzA6MDAuMDAwWiIsImlkIjoiLi4uIn0",
      "has_more": true
    }
  }
}
```

| Field | Keterangan |
|---|---|
| `meta.pagination.limit` | Limit yang dipakai halaman ini (setelah klem). |
| `meta.pagination.next_cursor` | Cursor halaman berikutnya, atau `null` bila halaman ini yang terakhir. |
| `meta.pagination.has_more` | `true` bila masih ada baris setelah halaman ini; `false` bersama `next_cursor: null` saat habis. |

Paginasi offset (`limit` + `offset` + `total`) DIPENSIUNKAN dan
dihapus — parameter `offset` tidak lagi dibaca, dan respons tidak
lagi membawa `total`. Alasannya: cursor keyset stabil bila ada
baris baru yang masuk di tengah penelusuran (tidak ada baris yang
terlewat atau tampil ganda), dan tidak butuh query `COUNT` yang
mahal.

Urutan daftar: terbaru dulu (`dibuat_pada` menurun, `id` menurun
sebagai penentu seri), kecuali dinyatakan lain. Baris soft-delete
(`deleted_at` terisi) tidak pernah muncul di daftar.

### 0.7 Rate limit umum

Rate limit ditegakkan lewat tabel D1 `rate_limits` (K-02 — bukan
KV): satu baris per kunci `${cakupan}:${subjek}:${jendela}` dengan
penghitung `jumlah`. Increment penghitung memakai SATU pernyataan
SQL atomik (`INSERT OR IGNORE` + `UPDATE ... SET jumlah =
jumlah + 1 WHERE jumlah < batas`, keputusan dari `meta.changes`)
— pola baca-lalu-tulis DILARANG karena race condition (R-03).
Permintaan yang ditolak TIDAK menambah penghitung. Bila D1 gagal
saat pemeriksaan, permintaan ditolak 503 `DATABASE_SIBUK`
(fail-closed), kecuali alur OAuth di bawah yang fail-open agar
masuk tidak macet total.

| Cakupan | Batas | Keterangan |
|---|---|---|
| Semua endpoint tulis (POST/PATCH/DELETE) | 60/menit per pengguna | Dihitung per `user_id` dari sesi. |
| `GET /api/auth/google` | 10/menit per IP | Cegah penyalahgunaan OAuth. Fail-open: bila D1 gagal, permintaan tetap diteruskan (dan dicatat di log server). |
| `POST /api/auth/pin/verify` | 5 percobaan salah, lalu kunci 30 detik | Bukan rate limit menit — kunci PIN (lihat 2.2). Penghitung memakai increment atomik satu pernyataan SQL (R-04). |
| `POST /api/ai/diagnose` | 20/hari per pengguna | Lindungi kuota Gemini bersama. Kuota dicadangkan atomik SEBELUM memanggil Gemini (reserve-then-confirm, R-05); cadangan dilepas bila Gemini gagal. |
| `GET /api/account/export` | 5/hari per pengguna | Dihitung SEBELUM query berat dijalankan; panggilan ke-6 ditolak 429 `RATE_LIMITED` (K-42, K-59). |
| `GET /api/ping`, `GET /api/health` | Tanpa batas ketat | Tanpa akses D1; murah. |
| Endpoint baca lain | 300/menit per pengguna | Batas longgar untuk mencegah banjir baca. |

Batas per endpoint ditulis juga di tiap endpoint di bawah. Respons
saat kena batas: HTTP 429, kode `RATE_LIMITED` (atau
`AI_QUOTA_HABIS` untuk kuota AI), dengan header `Retry-After` bila
waktu tunggu diketahui.

### 0.8 Daftar endpoint (ringkasan)

Total **31 endpoint** bernomor (K-60, K-89): Auth 8, health checks 4,
WiFi 6, AI 2, akun 6, utilitas 3, riwayat gabungan 2.

Semua path memakai awalan `/api` (K-07).

| # | Method | Path | Auth | Grup |
|---|---|---|---|---|
| 1 | GET | `/api/auth/google` | Publik | Auth Google |
| 2 | GET | `/api/auth/google/callback` | Publik | Auth Google |
| 3 | POST | `/api/auth/logout` | Sesi | Auth Google |
| 4 | GET | `/api/auth/me` | Sesi | Auth Google |
| 5 | POST | `/api/auth/pin/set` | Sesi | PIN |
| 6 | POST | `/api/auth/pin/verify` | Sesi | PIN |
| 7 | POST | `/api/auth/pin/delete` | Sesi | PIN |
| 8 | POST | `/api/health-checks` | Sesi | Health checks |
| 9 | GET | `/api/health-checks` | Sesi | Health checks |
| 10 | GET | `/api/health-checks/:id` | Sesi | Health checks |
| 11 | DELETE | `/api/health-checks/:id` | Sesi | Health checks |
| 12 | POST | `/api/wifi-reports` | Sesi | WiFi |
| 13 | GET | `/api/wifi-reports` | Sesi | WiFi |
| 14 | GET | `/api/wifi-reports/:id` | Sesi | WiFi |
| 15 | DELETE | `/api/wifi-reports/:id` | Sesi | WiFi |
| 16 | POST | `/api/wifi-reports/:id/samples` | Sesi | WiFi (tes bertahan) |
| 17 | POST | `/api/ai/diagnose` | Sesi | AI |
| 18 | GET | `/api/ai/diagnoses` | Sesi | AI |
| 19 | GET | `/api/account/profile` | Sesi | Akun |
| 20 | PATCH | `/api/account/profile` | Sesi | Akun |
| 21 | GET | `/api/account/sessions` | Sesi | Akun |
| 22 | DELETE | `/api/account/sessions/:id` | Sesi | Akun |
| 23 | DELETE | `/api/account` | Sesi | Akun |
| 24 | GET | `/api/account/export` | Sesi | Akun |
| 25 | GET | `/api/health` | Publik | Utilitas |
| 26 | GET | `/api/ping` | Publik | Utilitas |
| 27 | GET | `/api/speedtest/info` | Publik | Utilitas |
| 28 | GET | `/api/history` | Sesi | Riwayat gabungan |
| 29 | GET | `/api/wifi-reports/:id/samples` | Sesi | WiFi (tes bertahan) |
| 30 | DELETE | `/api/history/:jenis/:id` | Sesi | Riwayat gabungan |
| 31 | GET | `/api/auth/status` | Publik | Auth Google |

Alias (bukan endpoint bernomor tersendiri): `POST /api/ai/tanya`
dan `GET /api/ai/riwayat` adalah alias dari #17 dan #18 dengan
perilaku yang sama persis. Path tanpa awalan `/api` (`/ai/*`,
`/auth/*`, dsb.) TIDAK ADA — permintaan ke sana dijawab 404.

---
## 1. Auth Google

Alur OAuth memakai authorization code flow + PKCE. Penukaran kode
terjadi di server; `client_secret` Google tidak pernah keluar dari
Worker. Frontend hanya mengarahkan browser ke `/api/auth/google` dan
menerima redirect kembali ke aplikasi setelah callback selesai.

### 1.1 Mulai masuk Google — `GET /api/auth/google`

Memulai alur OAuth. Worker membuat `state` dan `code_verifier`
(PKCE), menyimpannya sementara di cookie HttpOnly berumur singkat
(10 menit), lalu redirect ke Google.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/auth/google` |
| Auth | Publik (tanpa sesi) |
| Header request | Tidak ada header khusus. |
| Query | Opsional: `redirect` — path dalam aplikasi tujuan setelah masuk berhasil (misalnya `/dashboard`, `/wifi`). Hanya path relatif yang diawali `/` dan tanpa `//` di awal, tanpa backslash `\` dan tanpa karakter kontrol (R-06: browser menormalkan `/\jahat` menjadi `//jahat`), maksimal 500 karakter; URL absolut satu origin dengan `FRONTEND_URL` diterima dan dinormalkan ke path-nya; nilai lain diabaikan dan diganti `/dashboard`. |
| Request body | Tidak ada. |
| Rate limit | 10/menit per IP (tabel D1 `rate_limits`; fail-open bila D1 gagal — lihat 0.7). |

**Respons sukses — 302 Found (redirect, bukan JSON):**

```
HTTP/1.1 302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid%20email%20profile&state=...&code_challenge=...&code_challenge_method=S256
Set-Cookie: dokter_hp_oauth_state=<nilai>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600
Set-Cookie: dokter_hp_oauth_verifier=<nilai>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600
Set-Cookie: dokter_hp_oauth_redirect=<path>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600
```

| Field | Keterangan |
|---|---|
| `scope` | `openid email profile` — hanya data identitas dasar. |
| `state` | Nilai acak anti-CSRF; dicocokkan di callback dengan perbandingan waktu-konstan (R-18). |
| `code_challenge` | PKCE S256 dari `code_verifier`. |

Cookie `dokter_hp_oauth_redirect` hanya disetel bila parameter
`redirect` valid dan bukan `/dashboard`; bila tidak ada, callback
memakai `/dashboard`. Ketiga cookie OAuth memakai `SameSite=Lax`
(sengaja BUKAN `None`): alur ini hanya redirect di domain API
sendiri, bukan fetch lintas situs.

**Respons galat (JSON envelope, bukan redirect):**

| HTTP | Kode | Kondisi |
|---|---|---|
| 429 | `RATE_LIMITED` | Melebihi 10/menit per IP. Respons menyertakan header `Retry-After` (detik sampai jendela berakhir, R-12). |

**Bila konfigurasi OAuth belum lengkap (K-89):** endpoint ini TIDAK
menjawab 500 JSON mentah — browser di-redirect (302) kembali ke
`{FRONTEND_URL}/masuk?error=oauth_belum_disiapkan` (atau jalur
relatif `/masuk?error=oauth_belum_disiapkan` bila `FRONTEND_URL`
tidak diatur), agar pengguna tidak terdampar di halaman JSON mentah
di luar UI aplikasi. "Lengkap" berarti ketiga nilai
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan
`GOOGLE_REDIRECT_URI` terisi (definisi yang sama dengan 1.5).
Frontend menampilkan pesan ramah untuk kode galat itu (lihat 1.2).

**Catatan:**

- Endpoint ini dipakai lewat navigasi browser penuh (bukan `fetch`),
  karena responsnya redirect ke Google.
- Ketiga cookie OAuth sementara dihapus di callback — di SEMUA
  jalur keluar, sukses maupun galat (lihat 1.2).

### 1.2 Callback Google — `GET /api/auth/google/callback`

Google mengarahkan browser kembali ke endpoint ini setelah pengguna
menyetujui. Worker memvalidasi `state`, menukar `code` dengan token
di server, mengambil profil Google (`sub`, `email`, `name`), mencari
atau membuat pengguna (berdasar `email` + provider `google` — BUKAN
`google_sub`), membuat sesi, dan redirect ke aplikasi.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/auth/google/callback` |
| Auth | Publik (tanpa sesi) |
| Header request | Cookie OAuth sementara dari 1.1 (dikirim browser otomatis). |
| Request body | Tidak ada. |
| Rate limit | Tidak ada batas terpisah di callback (batas 10/menit per IP berlaku di 1.1). |

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
Set-Cookie: __Host-dokter_hp_session=<token>; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=2592000
Set-Cookie: dokter_hp_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0
Set-Cookie: dokter_hp_oauth_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0
Set-Cookie: dokter_hp_oauth_redirect=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0
```

Tujuan redirect: nilai cookie `dokter_hp_oauth_redirect` bila valid,
bila tidak `/dashboard`. Bila pengguna sudah mengatur PIN, sesi baru
dianggap terkunci sampai dibuka dengan PIN (tidak ada baris
`pin_unlocks` untuk sesi baru) dan frontend mengarahkan ke `/kunci`
setelah memeriksa `/api/auth/me` (lihat 1.4 dan 2.2).

**Penghapusan cookie OAuth.** Ketiga cookie OAuth sementara (state,
verifier, redirect) dihapus di SEMUA jalur keluar callback — sukses
maupun setiap jalur galat di bawah (state tidak cocok, kode tidak
valid, penukaran gagal, profil gagal, galat database). Tidak ada
jalur keluar yang membiarkan cookie OAuth tertinggal.

**Efek samping di server:**

- Pengguna baru: baris `users` + `profiles` dibuat (`id` UUID baru,
  `nama` dari profil Google, `email` dari Google).
- Pengguna lama: dikembalikan apa adanya — `users.nama` TIDAK
  diperbarui dari profil Google (nama Google hanya dipakai untuk
  pengguna baru; perubahan manual lewat `PATCH /api/account/profile`
  tidak ditimpa — lihat 6.2). PIN yang sudah diatur tidak dihapus.
- Baris `sessions` baru dibuat (`expires_at` = sekarang +
  30 hari; `user_agent` dan `ip_terakhir` direkam dari header
  request untuk daftar sesi di Pengaturan).

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
| Konfigurasi OAuth belum lengkap (dari 1.1, K-89) | `/masuk?error=oauth_belum_disiapkan` | Login Google belum disiapkan; tombol di `/masuk` tampil nonaktif (lihat 1.5). |

Frontend di `/masuk` membaca query `error` dan menampilkan pesan
yang sesuai dalam bahasa sehari-hari. Nilai `error` yang tidak
dikenal diperlakukan sebagai `oauth_gagal`.

### 1.3 Keluar — `POST /api/auth/logout`

Menghapus sesi saat ini di D1 dan menghapus cookie sesi di browser.

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/auth/logout` |
| Auth | Sesi wajib (cookie `__Host-dokter_hp_session`). Sesi terkunci PIN tetap boleh keluar. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN` (dikirim browser otomatis). |
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
Set-Cookie: __Host-dokter_hp_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. Frontend tetap menghapus keadaan login lokal dan mengarahkan ke landing (keluar bersifat idempotent dari sisi pengguna). |

**Catatan:** hanya sesi saat ini yang dihapus. Sesi di perangkat
lain tetap aktif sampai kedaluwarsa atau dihapus lewat
`DELETE /api/account/sessions/:id` (lihat 6.4).

### 1.4 Info pengguna saat ini — `GET /api/auth/me`

Mengembalikan identitas pengguna dari sesi saat ini. Dipakai
frontend setelah muat ulang halaman untuk memulihkan keadaan login,
dan untuk memutuskan apakah layar kunci PIN perlu tampil.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/auth/me` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (frontend butuh jawaban ini untuk menampilkan layar kunci). |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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
| `sesi_terkunci` | boolean | `true` bila pengguna sudah mengatur PIN tetapi sesi saat ini belum dibuka dengan PIN (tidak ada baris `pin_unlocks` untuk sesi ini). |
| `sesi_kedaluwarsa_pada` | string (ISO 8601) | Kapan sesi ini kedaluwarsa. |

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid atau sesi kedaluwarsa. |

### 1.5 Status ketersediaan login Google — `GET /api/auth/status`

Memberi tahu frontend apakah login Google sudah disiapkan di server
(K-89, endpoint #31). Dipanggil halaman `/masuk` saat dimuat: bila
`google_tersedia` false, tombol Google tampil nonaktif dengan teks
jujur "belum disiapkan" — pengguna tidak pernah diarahkan ke alur
masuk yang pasti gagal.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/auth/status` |
| Auth | Publik (tanpa sesi) |
| Header request | Tidak ada header khusus. |
| Request body | Tidak ada. |
| Rate limit | Tidak ada (tanpa akses D1, hanya membaca konfigurasi). |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "google_tersedia": false },
  "meta": { "timestamp": "2026-11-18T00:00:00.000Z" }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `google_tersedia` | boolean | `true` hanya bila `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `GOOGLE_REDIRECT_URI` ketiganya terisi di server. |

**Respons TIDAK PERNAH berisi nilai secret** — hanya boolean di
atas. Bila pemanggilan ini gagal (API tidak terjangkau), frontend
menampilkan tombol nonaktif "Tidak dapat memeriksa login Google"
+ tombol "Coba lagi" (K-92, fail-closed); selagi status masih
dimuat, tombol nonaktif netral "Memeriksa login Google…". Jaring
pengaman di 1.1 tetap menangani bila OAuth memang belum siap.

---

## 2. PIN

PIN 4–8 digit sebagai kunci aplikasi web. PIN disimpan sebagai
HMAC-SHA256 dengan pepper secret `PIN_PEPPER` dan salt acak per
pengguna (K-71); PIN asli tidak pernah disimpan dan tidak pernah
dicatat di log. Bila `PIN_PEPPER` tidak diatur, endpoint PIN
mengembalikan 500 (fail-closed).

PIN lemah DITOLAK saat diatur (K-70d): semua digit sama (`0000`,
`9999`) atau berurutan naik/turun ketat (`1234`, `4321`) →
400 `VALIDATION_ERROR` dengan `details.alasan: "PIN_LEMAH"`.
Verifikasi (`/pin/verify`) hanya memeriksa format, bukan
kekuatan — PIN lemah yang sudah terlanjur tersimpan tetap bisa
diverifikasi.

Aturan kunci (dicatat di tabel D1 `pin_attempts`, BUKAN di kolom
tabel `users`):

- Setelah 5 kali PIN salah berturut-turut, percobaan dikunci
  30 detik (`pin_attempts.terkunci_sampai`). Selama terkunci, setiap
  percobaan ditolak dengan `PIN_TERKUNCI` tanpa memeriksa PIN.
  PIN lama yang salah pada `/pin/set` dan `/pin/delete` ikut
  dihitung ke penghitung yang sama.
- PIN benar mereset penghitung (baris `pin_attempts` dihapus).
- Pemulihan bila PIN lupa: masuk ulang dengan Google — sesi baru
  mendapat tenggang 10 menit (K-70) untuk mengatur PIN baru dari
  Pengaturan lewat `POST /api/auth/pin/set` TANPA PIN lama.
  Di luar tenggang itu, ubah/hapus PIN WAJIB menyertakan PIN lama
  — baik dari sesi terkunci maupun sesi terbuka (K-81). Riwayat
  yang sudah tersimpan tetap aman.

**Aturan otorisasi ubah/hapus PIN (K-70, K-81, R-02):**

`pin_lama` SELALU wajib bila PIN sudah diatur — terkunci maupun
tidak — KECUALI dalam tenggang login Google segar ≤10 menit.

| Keadaan sesi | `/pin/set` dan `/pin/delete` |
|---|---|
| Sesi dibuat ≤10 menit lalu (tenggang login Google segar) | Diizinkan tanpa `pin_lama` — berlaku untuk sesi terkunci maupun terbuka. |
| Sesi dibuat >10 menit lalu (di luar tenggang) | Wajib `pin_lama` yang benar; bila tidak ada → 403 `PIN_LAMA_DIPERLUKAN`; bila salah → 401 `PIN_SALAH` (dihitung ke penghitung kunci). |
| PIN terkunci sementara (5 salah) | Ditolak 403 `PIN_TERKUNCI` — berlaku juga bila `pin_lama` benar. |

`/pin/set` TIDAK PERNAH membuka sesi: setelah PIN diatur/diubah
dari sesi terkunci, sesi tetap terkunci dan pengguna harus membuka
lewat `/pin/verify` (layar `/kunci`).

### 2.1 Atur PIN — `POST /api/auth/pin/set`

Mengatur PIN baru atau mengganti PIN lama. Otorisasi mengikuti
aturan K-70/K-81 di pengantar §2: bila PIN sudah diatur,
`pin_lama` wajib disertakan kecuali dalam tenggang login Google
10 menit.

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/auth/pin/set` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (jalur pemulihan bila PIN lupa). |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Request body (JSON):**

```json
{
  "pin": "2846",
  "pin_lama": "1357"
}
```

**Validasi field:**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `pin` | string | Ya | Hanya digit `0-9`, panjang 4–8 karakter. Harus string, bukan angka JSON (agar PIN berawalan `0` seperti `0123` tidak hilang). PIN lemah ditolak (`details.alasan: "PIN_LEMAH"`). |
| `pin_lama` | string | Ya bila PIN sudah diatur, kecuali dalam tenggang login Google 10 menit (K-70, K-81) | Hanya digit `0-9`, panjang 4–8 karakter. Diabaikan bila PIN belum diatur atau sesi masih dalam tenggang. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "pin_diatur": true, "sesi_terkunci": true },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Efek samping:** `pin_hash` dan `pin_salt` baru disimpan; baris
`pin_attempts` pengguna dihapus (penghitung gagal direset).
Endpoint ini TIDAK PERNAH membuka sesi (K-70, R-02): bila sesi
saat ini terkunci, ia tetap terkunci (`sesi_terkunci: true` di
respons) dan pengguna membuka lewat `/pin/verify`.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `pin` hilang, bukan string, mengandung bukan-digit, atau panjang di luar 4–8. PIN lemah: `details.alasan` = `"PIN_LEMAH"`. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 401 | `PIN_SALAH` | `pin_lama` salah (dihitung ke penghitung kunci PIN). Body menyertakan `error.details.sisa_percobaan`. |
| 403 | `PIN_LAMA_DIPERLUKAN` | Di luar tenggang tanpa `pin_lama` (PIN sudah diatur). |
| 403 | `PIN_TERKUNCI` | Kunci 30 detik aktif. |
| 500 | `INTERNAL_ERROR` | `PIN_PEPPER` tidak diatur (fail-closed, K-71). |

### 2.2 Verifikasi PIN — `POST /api/auth/pin/verify`

Memeriksa PIN dan membuka kunci sesi bila benar. Dipanggil dari
layar kunci (`/kunci`).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/auth/pin/verify` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (ini memang tujuannya). |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Rate limit | 5 percobaan salah berturut-turut → kunci 30 detik (bukan rate limit per menit). Selama terkunci, respons `PIN_TERKUNCI` (403). |

**Request body (JSON):**

```json
{
  "pin": "2846"
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

**Efek samping bila benar:** sesi saat ini ditandai sudah dibuka
(baris `pin_unlocks` dibuat); baris `pin_attempts` pengguna
dihapus (penghitung gagal direset).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Format `pin` tidak valid (tidak dihitung sebagai percobaan salah). |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 401 | `PIN_SALAH` | PIN salah. Body menyertakan `error.details.sisa_percobaan` (jumlah percobaan tersisa sebelum kunci). |
| 403 | `PIN_TERKUNCI` | Kunci 30 detik aktif. Body menyertakan `error.details.terkunci_sampai` dan `error.details.sisa_detik`. |
| 409 | `CONFLICT` | PIN belum diatur (tidak ada yang perlu diverifikasi). Frontend seharusnya tidak menampilkan layar kunci dalam keadaan ini. |
| 500 | `INTERNAL_ERROR` | `PIN_PEPPER` tidak diatur (fail-closed, K-71). |

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

### 2.3 Hapus PIN — `POST /api/auth/pin/delete`

Menghapus PIN sehingga aplikasi tidak lagi menampilkan layar kunci.
Otorisasi mengikuti aturan K-70/K-81 di pengantar §2: bila PIN
sudah diatur, `pin_lama` wajib disertakan kecuali dalam tenggang
login Google 10 menit.
Alias: `POST /api/auth/pin/hapus` (perilaku sama persis).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/auth/pin/delete` |
| Auth | Sesi wajib. **Boleh dipanggil saat sesi terkunci PIN** (jalur pemulihan bila PIN lupa). |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Opsional: `{ "pin_lama": "1357" }` (wajib bila PIN sudah diatur & di luar tenggang login Google 10 menit). |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": { "pin_diatur": false },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

**Efek samping:** `pin_hash` dan `pin_salt` dikosongkan; baris
`pin_attempts` pengguna dihapus. Karena tidak ada PIN lagi, semua
sesi pengguna otomatis dianggap tidak terkunci.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 401 | `PIN_SALAH` | `pin_lama` salah (dihitung ke penghitung kunci PIN). |
| 403 | `PIN_LAMA_DIPERLUKAN` | Di luar tenggang tanpa `pin_lama` (PIN sudah diatur). |
| 403 | `PIN_TERKUNCI` | Kunci 30 detik aktif. |
| 409 | `CONFLICT` | PIN belum diatur (tidak ada yang dihapus). |
| 500 | `INTERNAL_ERROR` | `PIN_PEPPER` tidak diatur (fail-closed, K-71). |

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

### 3.1 Buat health check — `POST /api/health-checks`

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/health-checks` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 3.2 Daftar health checks — `GET /api/health-checks`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/health-checks` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `cursor` (halaman berikutnya, lihat 0.6). |
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
    "pagination": { "limit": 20, "next_cursor": null, "has_more": false }
  }
}
```

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit` bukan angka atau `cursor` tidak valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 3.3 Detail health check — `GET /api/health-checks/:id`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/health-checks/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 3.4 Hapus health check — `DELETE /api/health-checks/:id`

Soft-delete: `deleted_at` diisi waktu saat ini; baris tidak dihapus
permanen. Baris yang sudah soft-delete tidak muncul lagi di daftar
atau detail (detail menjawab 404).

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /api/health-checks/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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
| `ping_ms` | integer / null | Latensi HTTP dalam milidetik (median 3x `GET /api/ping`). Dilabeli "latensi HTTP", bukan ping ICMP. |
| `rekomendasi` | string / null | Teks rekomendasi yang dihitung frontend. |
| `kecepatan_unduh_kbps` | number / null | Hasil tes unduh 1 MB (KB/detik). |
| `sumber` | string | `web` / `apk` / `manual`. |
| `durasi_tes_detik` | integer / null | Terisi `30` untuk laporan tes bertahan; `null` untuk tes biasa. |
| `dibuat_pada` / `updated_at` | string (ISO 8601) | Waktu dibuat / terakhir diubah (server). |
| `deleted_at` | string (ISO 8601) / null | Terisi bila soft-delete; respons biasa selalu `null`. |

### 4.1 Buat laporan WiFi — `POST /api/wifi-reports`

Menyimpan satu hasil tes. Untuk tes bertahan 30 detik, frontend
membuat laporan dulu dengan `durasi_tes_detik: 30`, lalu mengirim
sampel per detik lewat 4.5.

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/wifi-reports` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 4.2 Daftar laporan WiFi — `GET /api/wifi-reports`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/wifi-reports` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `cursor` (halaman berikutnya, lihat 0.6). |
| Rate limit | Batas baca: 300/menit per pengguna. |

Hanya baris milik pengguna dengan `deleted_at IS NULL`, terbaru
dulu. Daftar tidak menyertakan sampel tes bertahan (sampel ada
di detail, 4.3, atau lewat endpoint khusus, 4.6).

**Respons sukses — 200 OK:** envelope daftar dengan `data` berisi
array objek laporan WiFi dan `meta.pagination` seperti 0.6.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit` bukan angka atau `cursor` tidak valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 4.3 Detail laporan WiFi — `GET /api/wifi-reports/:id`

Mengembalikan satu laporan beserta sampel tes bertahan bila ada
(laporan dengan `durasi_tes_detik: 30`).

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/wifi-reports/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 4.4 Hapus laporan WiFi — `DELETE /api/wifi-reports/:id`

Soft-delete: `deleted_at` diisi waktu saat ini; baris dan sampelnya
tidak dihapus permanen. Laporan yang sudah soft-delete tidak muncul
lagi di daftar atau detail (detail menjawab 404).

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /api/wifi-reports/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 4.5 Kirim sampel tes bertahan — `POST /api/wifi-reports/:id/samples`

Menyimpan sampel per detik dari tes bertahan 30 detik ke laporan
yang sudah dibuat lewat 4.1 (dengan `durasi_tes_detik: 30`).
Frontend mengirim seluruh 30 sampel dalam satu request setelah tes
selesai. Bila koneksi putus di tengah jalan, frontend boleh mengirim
lagi sampel yang tersisa (sampel per `detik_ke` bersifat unik —
mengirim ulang detik yang sama menimpa nilai lama).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/wifi-reports/:id/samples` |
| Auth | Sesi wajib, tidak terkunci PIN. Laporan harus milik pengguna. |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 4.6 Daftar sampel tes bertahan — `GET /api/wifi-reports/:id/samples`

Mengembalikan seluruh sampel tes bertahan milik satu laporan
(endpoint #29, K-43). Tidak memakai paginasi: jumlah sampel per
laporan dibatasi 30, jadi seluruh daftar dikembalikan sekaligus.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/wifi-reports/:id/samples` |
| Auth | Sesi wajib, tidak terkunci PIN. Laporan harus milik pengguna. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas baca: 300/menit per pengguna. |

`:id` adalah UUID laporan. Format UUID tidak valid →
`VALIDATION_ERROR` (400).

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": [
    { "detik_ke": 0, "kecepatan_kbps": 52.1 },
    { "detik_ke": 1, "kecepatan_kbps": 49.8 },
    { "detik_ke": 2, "kecepatan_kbps": 47.3 }
  ],
  "meta": { "timestamp": "2026-11-17T15:30:35.000Z" }
}
```

Sampel diurutkan `detik_ke` menaik. Array kosong (`[]`) bila
laporan belum punya sampel (atau bukan tes bertahan — endpoint ini
tidak memeriksa `durasi_tes_detik`, hanya mengembalikan sampel
yang ada).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `:id` bukan UUID yang valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Laporan tidak ada, sudah dihapus, atau bukan milik pengguna. |

---
## 5. Diagnosis AI

Worker merakit konteks dari riwayat pengguna (pemeriksaan terakhir
+ laporan WiFi terakhir) dan mengirimnya bersama pertanyaan ke
Gemini. Kunci Gemini hanya ada sebagai secret Worker; tidak pernah
ada di browser dan tidak pernah di repo.

**Endpoint ini selalu menjawab 200 bila pertanyaan valid (K-23).**
Bila Gemini gagal — kuota proyek habis, timeout 30 detik, galat
jaringan, atau kunci belum diatur — Worker mengembalikan jawaban
fallback dari aturan berbasis data pemeriksaan pengguna
(`sumber_jawaban: "aturan"`), dengan label jujur bahwa jawaban itu
bukan dari AI. Kode 502 `AI_TIDAK_TERSEDIA` sudah pensiun.
Jawaban fallback TIDAK disimpan ke riwayat dan TIDAK memotong
kuota harian.

Tiga lapisan melindungi kuota Gemini bersama (model Flash-Lite,
500 request/hari per proyek):

1. Cache jawaban (tabel D1 `ai_cache`, 7 hari): pertanyaan yang
   sama dari pengguna yang sama dengan data pemeriksaan yang sama
   memakai jawaban tersimpan tanpa memanggil Gemini
   (`sumber_jawaban: "cache"`). Kunci cache adalah SHA-256 dari
   pertanyaan yang dinormalisasi + versi konteks + id pengguna +
   sidik jari data pemeriksaan — cache sengaja per pengguna.
2. Batas 20 pertanyaan/hari per pengguna (dihitung dari D1,
   reset 00:00 UTC). Kuota dicadangkan secara atomik SEBELUM
   memanggil Gemini (reserve-then-confirm, R-05): permintaan
   paralel yang bersamaan tidak bisa meloloskan lebih dari
   20 — cadangan ke-21 ditolak 429 `AI_QUOTA_HABIS`. Bila
   Gemini gagal atau penyimpanan gagal, cadangan dilepas
   sehingga kuota kembali. Kunci Gemini dikirim lewat header
   `x-goog-api-key`, bukan query string URL (R-19).
3. Fallback aturan (di atas) saat Gemini gagal.

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

### 5.1 Tanya AI — `POST /api/ai/diagnose`

Alias: `POST /api/ai/tanya` (perilaku sama persis).

| Aspek | Keterangan |
|---|---|
| Method + path | `POST /api/ai/diagnose` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Rate limit | 20/hari per pengguna (kuota harian, reset 00:00 UTC) + batas tulis umum 60/menit per pengguna (ditegakkan middleware `batasLaju` di rute ini, R-10). |
| Timeout | Worker menunggu Gemini maksimum 30 detik per percobaan; bila gagal → jawaban fallback 200 (bukan 502). |

**Alur kuota (R-05, reserve-then-confirm):** (1) Worker
mencadangkan satu kuota secara atomik (penghitung `rate_limits`
kunci `ai:<user>:<tanggal>`); bila sudah 20 → 429
`AI_QUOTA_HABIS`; (2) Worker memeriksa cache — bila kena,
cadangan DILEPAS dan jawaban cache dikembalikan tanpa memotong
kuota; (3) Worker memanggil Gemini; (4) jawaban disimpan dan
cadangan dikonfirmasi. Bila langkah (3) atau (4) gagal,
cadangan dilepas dan `sisa_hari_ini` kembali seperti semula.

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
| `pertanyaan` | string | Ya | 1–1000 karakter setelah dipangkas (trim). String kosong / hanya spasi → `VALIDATION_ERROR`. |
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
    "dibuat_pada": "2026-11-17T15:30:00.000Z",
    "sumber_jawaban": "ai",
    "sisa_hari_ini": 19,
    "label_saran": "Jawaban ini adalah saran, bukan vonis pasti. Bila masalah berlanjut, pertimbangkan bantuan teknisi.",
    "tersimpan": true
  },
  "meta": { "timestamp": "2026-11-17T15:30:00.000Z" }
}
```

| Field tambahan | Tipe | Keterangan |
|---|---|---|
| `sumber_jawaban` | string | Asal jawaban: `"ai"` (Gemini baru), `"cache"` (jawaban tersimpan 7 hari), atau `"aturan"` (fallback aturan saat Gemini gagal). |
| `sisa_hari_ini` | integer | Sisa kuota pertanyaan hari ini setelah pertanyaan ini. Pada fallback (`"aturan"`) kuota tidak terpotong, jadi nilainya sama seperti sebelum pertanyaan. |
| `label_saran` | string | Label kejujuran yang WAJIB ditampilkan frontend bersama jawaban: "Jawaban ini adalah saran, bukan vonis pasti. Bila masalah berlanjut, pertimbangkan bantuan teknisi." |
| `tersimpan` | boolean | `true` bila tanya jawab ini disimpan ke riwayat (`"ai"`/`"cache"`); `false` pada fallback (`"aturan"`). |

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `pertanyaan` hilang/kosong/> 1000 karakter; `health_check_id` bukan UUID. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | `health_check_id` tidak ada atau bukan milik pengguna. |
| 429 | `AI_QUOTA_HABIS` | Kuota 20/hari sudah habis. Header `Retry-After` berisi detik sampai reset 00:00 UTC. |
| 429 | `RATE_LIMITED` | Melebihi batas tulis 60/menit. |

### 5.2 Riwayat diagnosis AI — `GET /api/ai/diagnoses`

Alias: `GET /api/ai/riwayat` (perilaku sama persis).

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/ai/diagnoses` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `cursor` (halaman berikutnya, lihat 0.6). |
| Rate limit | Batas baca: 300/menit per pengguna. |

Hanya riwayat milik pengguna, terbaru dulu. Hapus per diagnosis
lewat `DELETE /api/history/ai/:id` (lihat §7); riwayat AI juga
ikut terhapus saat hapus akun (lihat 6.5).

**Respons sukses — 200 OK:** envelope daftar dengan `data` berisi
array objek diagnosis AI dan `meta.pagination` seperti 0.6.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit` bukan angka atau `cursor` tidak valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

---

## 6. Akun

### 6.1 Profil — `GET /api/account/profile`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/account/profile` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

**Catatan:** `/api/auth/me` (1.4) dan endpoint ini tumpang tindih
dengan sengaja — `/api/auth/me` untuk pemulihan keadaan login
(termasuk status kunci PIN), endpoint ini untuk halaman Pengaturan.

### 6.2 Ubah nama — `PATCH /api/account/profile`

| Aspek | Keterangan |
|---|---|
| Method + path | `PATCH /api/account/profile` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 6.3 Daftar sesi aktif — `GET /api/account/sessions`

Menampilkan semua sesi aktif milik pengguna (untuk halaman
Pengaturan: "keluar dari sesi lain"). Sesi saat ini ditandai
`saat_ini: true`.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/account/sessions` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `cursor` (halaman berikutnya, lihat 0.6). |
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
    "pagination": { "limit": 20, "next_cursor": null, "has_more": false }
  }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | ID sesi (untuk `DELETE /api/account/sessions/:id`). |
| `saat_ini` | boolean | `true` untuk sesi yang dipakai pada request ini. |
| `user_agent` | string / null | User-Agent browser saat sesi dibuat. |
| `ip_terakhir` | string / null | IP terakhir yang memakai sesi ini. |
| `dibuat_pada` / `kedaluwarsa_pada` | string (ISO 8601) | Waktu dibuat / kedaluwarsa. |

Sesi yang sudah kedaluwarsa tidak ditampilkan. `token_hash` tidak
pernah dikembalikan.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit` bukan angka atau `cursor` tidak valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 6.4 Keluar dari satu sesi — `DELETE /api/account/sessions/:id`

Menghapus satu sesi milik pengguna (misalnya sesi di perangkat
lain). Menghapus sesi saat ini sama efeknya dengan keluar
(`POST /api/auth/logout`) — frontend harus mengarahkan ke landing
setelah itu.

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /api/account/sessions/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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

### 6.5 Hapus akun — `DELETE /api/account`

Menghapus akun beserta seluruh data pengguna secara permanen
(hard delete): profil, health checks, laporan WiFi + sampelnya,
diagnosis AI, semua sesi, dan PIN. Penghapusan tidak bisa dibatalkan.

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /api/account` |
| Auth | Sesi wajib, tidak terkunci PIN. **Wajib autentikasi baru ≤10 menit** (K-72): sesi dibuat ≤10 menit lalu ATAU PIN diverifikasi ≤10 menit lalu — bila tidak, 403 `LOGIN_ULANG_DIPERLUKAN`. |
| Header request | `Content-Type: application/json`, `Cookie: __Host-dokter_hp_session=TOKEN`. |
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
| `konfirmasi` | string | Ya | Harus persis `HAPUS` atau `DELETE` (huruf besar semua; kata mengikuti bahasa aktif di frontend — K-26). Nilai lain → `KONFIRMASI_SALAH` (422). |

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

**Efek samping:** seluruh data dihapus eksplisit per tabel
(Worker TIDAK bergantung pada foreign key cascade, walau
`PRAGMA foreign_keys = ON` dicoba best-effort): sampel tes
bertahan, penanda buka PIN (`pin_unlocks`) + penghitung gagal
PIN (`pin_attempts`), diagnosis AI, laporan WiFi, pemeriksaan
kesehatan, semua sesi, baris `rate_limits` milik pengguna
(kunci `%:userId:%`, R-14), profil, lalu baris `users`.
Kunci `rate_limits` per IP dan entri `ai_cache` tidak dapat
dikaitkan ke pengguna dan tidak dihapus — keduanya kedaluwarsa
sendiri (lihat `ARCHITECTURE.md` §9.1).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `konfirmasi` hilang atau bukan string. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 403 | `LOGIN_ULANG_DIPERLUKAN` | Tidak ada autentikasi baru ≤10 menit (K-72). Frontend menampilkan pesan + tombol masuk lagi. |
| 422 | `KONFIRMASI_SALAH` | `konfirmasi` bukan `HAPUS` atau `DELETE`. |

### 6.6 Ekspor data — `GET /api/account/export`

Mengunduh seluruh data milik pengguna sebagai satu file JSON
(profil, health checks, laporan WiFi beserta sampel tes bertahan,
dan diagnosis AI). Dipakai sebelum hapus akun, atau bila pengguna
ingin menyimpan salinan datanya.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/account/export` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
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
  per tabel dan 30.000 sampel tes bertahan; bila melebihi,
  respons menambahkan field `"terpotong": true` di tingkat atas
  dan frontend menampilkan peringatan bahwa ekspor tidak lengkap.
- Nama file: `dokter-hp-export-YYYY-MM-DD.json` (tanggal UTC).

**Respons galat (memakai envelope standar, bukan berkas):**

| HTTP | Kode | Kondisi |
|---|---|---|
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 429 | `RATE_LIMITED` | Melebihi 5/hari. |

**Catatan:** batas 5/hari ditegakkan lewat tabel D1 `rate_limits`
(lihat 0.7) dan diperiksa SEBELUM query berat dijalankan —
panggilan ke-6 dalam sehari ditolak 429 `RATE_LIMITED` dengan
header `Retry-After` sampai reset 00:00 UTC, tanpa membebani D1.

---
## 7. Riwayat gabungan

Satu endpoint untuk halaman Riwayat (`/riwayat`): tiga jenis data
(pemeriksaan kesehatan, laporan WiFi, diagnosis AI) digabung dan
diurutkan terbaru dulu oleh server, sehingga frontend tidak perlu
memanggil tiga endpoint daftar dan menggabungkannya sendiri.

### 7.1 Riwayat gabungan — `GET /api/history`

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/history` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Query | `limit` (default 20, 1–100), `cursor` (halaman berikutnya, lihat 0.6), `jenis` (opsional: `kesehatan` / `wifi` / `ai` / `semua`; default `semua`). |
| Rate limit | Batas baca: 300/menit per pengguna. |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": [
    {
      "jenis": "wifi",
      "id": "9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e",
      "dibuat_pada": "2026-11-17T15:30:00.000Z",
      "data": {
        "ssid": "ACHA",
        "kecepatan_koneksi_mbps": 65,
        "kekuatan_sinyal": "kuat",
        "channel": 6,
        "dns": "1.1.1.1",
        "kecepatan_unduh_kbps": 3.2,
        "ping_ms": 42,
        "rekomendasi": "Kecepatan unduh sangat lambat.",
        "sumber": "web",
        "durasi_tes_detik": null
      }
    },
    {
      "jenis": "kesehatan",
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "dibuat_pada": "2026-11-17T15:25:00.000Z",
      "data": {
        "skor": 78,
        "ringkasan": {
          "wifi": { "status": "baik", "skor": 85, "sumber": "web" }
        },
        "sync_status": "synced"
      }
    },
    {
      "jenis": "ai",
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "dibuat_pada": "2026-11-17T15:20:00.000Z",
      "data": {
        "health_check_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "pertanyaan": "WiFi lemot padahal sinyal penuh, kenapa?",
        "jawaban": "Sinyal penuh belum tentu berarti cepat. ..."
      }
    }
  ],
  "meta": {
    "timestamp": "2026-11-17T15:30:00.000Z",
    "pagination": { "limit": 20, "next_cursor": null, "has_more": false },
    "jenis": "semua"
  }
}
```

| Field item | Tipe | Keterangan |
|---|---|---|
| `jenis` | string | `kesehatan` / `wifi` / `ai`. |
| `id` | string (UUID) | ID baris sumber (untuk `DELETE /api/history/:jenis/:id`). |
| `dibuat_pada` | string (ISO 8601) | Waktu baris sumber dibuat. |
| `data` | object | Proyeksi ringkas baris sumber — HANYA field di bawah; `id`, `user_id`, `dibuat_pada`, `updated_at`, dan `deleted_at` tidak diulang di dalam `data` (id dan waktu ada di tingkat item). |

Isi `data` per jenis:

| Jenis | Field di `data` |
|---|---|
| `kesehatan` | `skor`, `ringkasan`, `sync_status`. |
| `wifi` | `ssid`, `kecepatan_koneksi_mbps`, `kekuatan_sinyal`, `channel`, `dns`, `kecepatan_unduh_kbps`, `ping_ms`, `rekomendasi`, `sumber`, `durasi_tes_detik`. |
| `ai` | `health_check_id`, `pertanyaan`, `jawaban`. |

`meta.jenis` menggemakan parameter `jenis` yang diminta (atau
`"semua"` bila tidak ada parameter). Urutan: terbaru dulu
(`dibuat_pada` menurun, `id` menurun). Baris soft-delete tidak
pernah muncul. Paginasi cursor (0.6) berlaku pada urutan gabungan:
tiap jenis diambil `limit + 1` baris dengan klausa cursor yang
sama, lalu digabung dan dipotong ke `limit`.

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit` bukan angka, `cursor` tidak valid, atau `jenis` bukan nilai yang dikenal. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |

### 7.2 Hapus satu entri riwayat — `DELETE /api/history/:jenis/:id`

Endpoint #30 (K-60): menghapus satu entri riwayat apa pun
jenisnya — termasuk diagnosis AI, yang tidak punya endpoint
hapus sendiri di §5. Satu rute parameter (`:jenis/:id`), bukan
tiga rute terpisah.

| Aspek | Keterangan |
|---|---|
| Method + path | `DELETE /api/history/:jenis/:id` |
| Auth | Sesi wajib, tidak terkunci PIN. |
| Header request | `Cookie: __Host-dokter_hp_session=TOKEN`. |
| Request body | Tidak ada. |
| Rate limit | Batas tulis umum: 60/menit per pengguna. |

`:jenis` adalah `kesehatan`, `wifi`, atau `ai`; `:id` adalah UUID
baris sumber.

**Perilaku per jenis:**

| Jenis | Perilaku hapus |
|---|---|
| `kesehatan` / `wifi` | Soft-delete: `deleted_at` diisi waktu saat ini. |
| `ai` | Hapus permanen (tabel `ai_diagnoses` tidak punya kolom `deleted_at`). |

**Respons sukses — 200 OK:**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "jenis": "ai",
    "deleted": true,
    "deleted_at": null
  },
  "meta": { "timestamp": "2026-11-17T15:35:00.000Z" }
}
```

`deleted_at` berisi waktu soft-delete untuk `kesehatan`/`wifi`,
dan `null` untuk `ai` (hapus permanen).

**Respons galat:**

| HTTP | Kode | Kondisi |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `:jenis` bukan nilai yang dikenal atau `:id` bukan UUID yang valid. |
| 401 | `UNAUTHORIZED` | Tidak ada sesi valid. |
| 403 | `SESSION_LOCKED` | Sesi terkunci PIN. |
| 404 | `NOT_FOUND` | Entri tidak ada, sudah dihapus, atau bukan milik pengguna. |

---
## 8. Utilitas (publik)

Endpoint publik tanpa sesi. Tidak menyentuh D1 (kecuali dinyatakan
lain), sehingga tetap menjawab saat database sibuk dan murah untuk
dipanggil berulang.

### 8.1 Liveness — `GET /api/health`

Dipakai pemantau uptime dan banner "Tidak tersambung ke server" di
frontend. Tanpa akses D1 — hanya membuktikan Worker hidup.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/health` |
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

### 8.2 Latensi HTTP — `GET /api/ping`

Target pengukuran latensi HTTP dari browser. Frontend memanggilnya
3x dan mengambil median sebagai `ping_ms` (lihat 4.1). Respons
dibuat sekecil mungkin dan tanpa akses D1.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/ping` |
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

### 8.3 Info speedtest — `GET /api/speedtest/info`

Memberi tahu frontend file tes kecepatan mana yang tersedia dan
ukurannya, agar frontend tidak mengarang ukuran file. File tes
sendiri disajikan sebagai aset statis dari Pages yang sama
(`/speedtest-1mb.bin`), bukan dari endpoint ini.

| Aspek | Keterangan |
|---|---|
| Method + path | `GET /api/speedtest/info` |
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
    "tes_bertahan_detik": 30,
    "ip_publik": "203.0.113.42"
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
| `ip_publik` | string / null | IP publik pemanggil, dibaca dari header `CF-Connecting-IP` (K-25). `null` bila header tidak ada (misalnya saat dijalankan lokal tanpa Cloudflare). |

**Catatan:** file `speedtest-1mb.bin` sendiri disajikan Pages
(aset statis), bukan Worker. Service worker frontend tidak pernah
men-cache file ini agar tes mengukur koneksi, bukan cache lokal.

---

## 9. Contoh curl per grup

Basis URL contoh: `https://api.dokter-hp.example.com` (ganti
dengan basis nyata). Token sesi memakai placeholder `TOKEN` —
ganti dengan nilai cookie `__Host-dokter_hp_session` dari browser saat
menguji. **Jangan menulis token atau secret asli di dokumen atau
di chat.**

Autentikasi pada contoh memakai header cookie:

```
-H "Cookie: __Host-dokter_hp_session=TOKEN"
```

### 9.1 Auth Google dan sesi

```bash
# Mulai masuk Google (buka di browser, bukan curl — responsnya redirect):
# https://api.dokter-hp.example.com/api/auth/google

# Info pengguna saat ini:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/auth/me

# Keluar:
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/auth/logout
```

### 9.2 PIN

```bash
# Atur PIN pertama kali (PIN belum diatur — tanpa pin_lama):
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "2846"}' \
  https://api.dokter-hp.example.com/api/auth/pin/set

# Ubah PIN di luar tenggang — wajib pin_lama (K-70, K-81):
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "7391", "pin_lama": "2846"}' \
  https://api.dokter-hp.example.com/api/auth/pin/set

# Verifikasi PIN:
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "2846"}' \
  https://api.dokter-hp.example.com/api/auth/pin/verify

# Hapus PIN (tambah -d '{"pin_lama": "2846"}' bila di luar tenggang 10 menit):
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/auth/pin/delete
```

### 9.3 Health checks

```bash
# Buat health check:
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skor": 78, "ringkasan": {"wifi": {"status": "baik", "skor": 85, "sumber": "web"}}}' \
  https://api.dokter-hp.example.com/api/health-checks

# Daftar health checks:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/api/health-checks?limit=20"

# Detail health check:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/health-checks/7c9e6679-7425-40de-944b-e07fc1f90ae7

# Hapus health check:
curl -s -X DELETE -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/health-checks/7c9e6679-7425-40de-944b-e07fc1f90ae7
```

### 9.4 WiFi

```bash
# Buat laporan WiFi:
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssid": "ACHA", "kecepatan_koneksi_mbps": 65, "kekuatan_sinyal": "kuat", "channel": 6, "dns": "1.1.1.1", "ping_ms": 42, "kecepatan_unduh_kbps": 3.2, "sumber": "web"}' \
  https://api.dokter-hp.example.com/api/wifi-reports

# Daftar laporan WiFi:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/api/wifi-reports?limit=20"

# Detail laporan WiFi (termasuk sampel tes bertahan):
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/wifi-reports/9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e

# Daftar sampel tes bertahan saja:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/wifi-reports/9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e/samples

# Hapus laporan WiFi:
curl -s -X DELETE -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/wifi-reports/9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e

# Buat laporan tes bertahan 30 detik, lalu kirim sampelnya:
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssid": "ACHA", "ping_ms": 42, "kecepatan_unduh_kbps": 48.5, "sumber": "web", "durasi_tes_detik": 30}' \
  https://api.dokter-hp.example.com/api/wifi-reports

curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"samples": [{"detik_ke": 0, "kecepatan_kbps": 52.1}, {"detik_ke": 1, "kecepatan_kbps": 49.8}]}' \
  https://api.dokter-hp.example.com/api/wifi-reports/9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e/samples
```

### 9.5 AI

```bash
# Tanya AI:
curl -s -X POST -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pertanyaan": "WiFi lemot padahal sinyal penuh, kenapa?"}' \
  https://api.dokter-hp.example.com/api/ai/diagnose

# Riwayat diagnosis AI:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/api/ai/diagnoses?limit=20"
```

### 9.6 Akun

```bash
# Profil:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/account/profile

# Ubah nama:
curl -s -X PATCH -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nama": "Adip RMX"}' \
  https://api.dokter-hp.example.com/api/account/profile

# Daftar sesi aktif:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/account/sessions

# Keluar dari satu sesi:
curl -s -X DELETE -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/account/sessions/e5f6a7b8-1234-5678-90ab-cdef12345678

# Ekspor data:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -o dokter-hp-export.json \
  https://api.dokter-hp.example.com/api/account/export

# Hapus akun (tidak bisa dibatalkan):
curl -s -X DELETE -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"konfirmasi": "HAPUS"}' \
  https://api.dokter-hp.example.com/api/account
```

### 9.7 Utilitas

```bash
# Liveness:
curl -s https://api.dokter-hp.example.com/api/health

# Latensi HTTP:
curl -s https://api.dokter-hp.example.com/api/ping

# Info speedtest:
curl -s https://api.dokter-hp.example.com/api/speedtest/info
```

### 9.8 Riwayat gabungan

```bash
# 100 entri terbaru, semua jenis:
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/api/history?limit=100"

# Hanya tes WiFi, halaman berikutnya (cursor dari meta.pagination.next_cursor):
curl -s -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  "https://api.dokter-hp.example.com/api/history?jenis=wifi&limit=20&cursor=CURSOR"

# Hapus satu entri diagnosis AI:
curl -s -X DELETE -H "Cookie: __Host-dokter_hp_session=TOKEN" \
  https://api.dokter-hp.example.com/api/history/ai/a1b2c3d4-5678-90ab-cdef-1234567890ab
```

---

## 10. Hal yang masih terbuka

1. **Basis URL nyata** — domain/subdomain Worker belum diputuskan
   (lihat `ARCHITECTURE.md` §9 poin 1). Semua contoh memakai
   placeholder `api.dokter-hp.example.com`.
2. **Sesi terkunci dan endpoint PIN** — kontrak ini mengizinkan
   `/api/auth/me`, `/api/auth/pin/set`, `/api/auth/pin/verify`,
   `/api/auth/pin/delete`, dan `/api/auth/logout` dipanggil saat sesi
   terkunci; semua endpoint lain menolak dengan `SESSION_LOCKED`.
   Perlu uji eksplisit di implementasi.
3. **Ekspor data: batas 5.000 baris per tabel** — angka ini adalah
   keputusan kontrak (batas praktis), belum diuji terhadap kuota
   baca D1. Tim implementasi perlu memvalidasi saat membangun.
4. **Sinkron APK** — di luar kontrak ini (fase berikutnya, lihat
   `ARCHITECTURE.md` §9 poin 5). Bila endpoint sinkron ditambahkan
   nanti, dokumen ini perlu revisi.

**Sudah terselesaikan (dipindah dari daftar terbuka):**

- Total endpoint: 30 bernomor (K-60) — selisih hitungan 24/25/27
  di versi awal sudah diluruskan; ekspor data dan info speedtest
  kini tercatat di `ARCHITECTURE.md` §3; `DELETE
  /api/history/:jenis/:id` kini bernomor #30 (sebelumnya operasi
  pendamping tanpa nomor — poin 5 lama di daftar terbuka ini).
- Total endpoint: 31 bernomor (K-89) — `GET /api/auth/status`
  (§1.5) kini endpoint #31; Auth kini 8 endpoint.
- Implementasi rate limit: tabel D1 `rate_limits` (K-02, K-42,
  K-59) — bukan KV; kode kanonis 429 `RATE_LIMITED`.
- Nama dari Google vs nama manual: terkonfirmasi di implementasi —
  nama Google hanya dipakai untuk pengguna baru (K-03).

## 11. Changelog dokumen

### 18 November 2026 — Wave 5 (Tim Perbaikan OAuth Jujur)

- Endpoint baru #31 `GET /api/auth/status` (§1.5, K-89): envelope
  `{ google_tersedia: boolean }`, true hanya bila
  `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` +
  `GOOGLE_REDIRECT_URI` ketiganya terisi; tidak pernah
  mengembalikan nilai secret.
- §1.1: konfigurasi OAuth belum lengkap kini redirect 302 ke
  `/masuk?error=oauth_belum_disiapkan` (K-89) — bukan lagi 500
  JSON mentah; baris 500 `INTERNAL_ERROR` dihapus dari tabel
  galat 1.1.
- §1.2: kode galat `oauth_belum_disiapkan` ditambahkan ke tabel
  redirect galat.
- §0.8: total 30 → **31 endpoint** bernomor; Auth 7 → 8.
- §10: butir total endpoint diperbarui ke 31 (K-89).

### 18 November 2026 — Wave 4 (Tim Blue — Perbaikan Keamanan)

Perbaikan 22 temuan Red Team ronde 1 (R-01–R-22):

- §0.2: batas badan JSON 100 KB → 413 `PAYLOAD_TOO_LARGE`
  (R-20). §0.3: `error.details` didokumentasikan per kode.
- §0.4: nama cookie `__Host-dokter_hp_session` (R-18) + maks
  10 sesi (R-22); CORS ditulis ulang ke K-73 (fail-closed,
  multi-origin koma — perilaku echo R-01 DIHAPUS); cek Origin
  mutasi memakai logika allowlist yang sama.
- §0.5: kode baru `PIN_LAMA_DIPERLUKAN` (403),
  `LOGIN_ULANG_DIPERLUKAN` (403), `PAYLOAD_TOO_LARGE` (413);
  `PIN_SALAH` kini mencakup PIN lama salah.
- §0.7: semantik atomik increment rate limit (R-03) +
  penghitung PIN (R-04); cadangan kuota AI (R-05).
- §1.1: validasi redirect R-06 (tolak backslash/kontrol,
  URL absolut satu origin); `Retry-After` di 429 (R-12);
  perbandingan state waktu-konstan (R-18).
- §2: kebijakan PIN K-70 lengkap (tenggang 10 menit,
  `pin_lama`, `/pin/set` TIDAK PERNAH membuka sesi — klaim
  lama yang menyatakan sebaliknya DIHAPUS); hash HMAC-SHA256
  + pepper (K-71); PIN lemah ditolak (`PIN_LEMAH`).
- §5/§5.1: alur kuota reserve-then-confirm (R-05); batas
  tulis 60/menit ditegakkan middleware di rute AI (R-10);
  kunci Gemini via header `x-goog-api-key` (R-19).
- §6.5: hapus akun wajib autentikasi baru ≤10 menit (K-72);
  baris `rate_limits` per pengguna ikut dihapus (R-14).
- §9.2: contoh curl PIN diperbarui (K-70).
- Seluruh dokumen: nama cookie diganti ke
  `__Host-dokter_hp_session`.

### 18 November 2026 — Wave 4 (Tim Penutup Dokumen)

- Total 30 endpoint bernomor (K-60): `DELETE
  /api/history/:jenis/:id` (§7.2) kini endpoint #30 — satu rute
  parameter, bukan tiga rute terpisah; catatan "pendamping tanpa
  nomor" di §0.8 dan §10 poin 5 dihapus; baris #30 ditambahkan
  ke tabel §0.8.
- Rujukan `GET /ping` di §4 (field `ping_ms`) dikoreksi ke
  `GET /api/ping` (K-07).

### 18 November 2026 — Wave 3b (Tim Integrasi)

- Awalan `/api` di semua path (K-07); alias AI kanonis
  `POST /api/ai/diagnose` + `GET /api/ai/diagnoses` dengan alias
  `/api/ai/tanya` + `/api/ai/riwayat`; path tanpa `/api` dihapus
  (K-37).
- Total 29 endpoint bernomor: tambah `GET /api/history` (#28,
  seksi baru §7) dan `GET /api/wifi-reports/:id/samples` (#29,
  §4.6); `DELETE /api/history/:jenis/:id` didokumentasikan di
  §7.2 sebagai operasi pendamping (lihat §10 poin 5).
- Paginasi cursor keyset di semua endpoint daftar (K-32, K-38):
  §0.6 ditulis ulang (param `limit` + `cursor`, meta
  `{limit, next_cursor, has_more}` di `meta.pagination`); offset
  + `total` dipensiunkan.
- Diagnosis AI selalu 200 (K-23): 502 `AI_TIDAK_TERSEDIA`
  pensiun; §5 ditulis ulang (fallback aturan, cache 7 hari,
  field `sumber_jawaban`/`sisa_hari_ini`/`label_saran`/
  `tersimpan`, pertanyaan 1–1000 karakter per K-36).
- Kode galat kanon final (K-39/K-47/K-59): `CONFLICT` 409 untuk
  PIN belum diatur; `PIN_BELUM_DIATUR`, `SESI_TIDAK_VALID`,
  `RATE_LIMIT_EXCEEDED`, `PIN_SUDAH_DIATUR`, dan 405
  `METHOD_NOT_ALLOWED` dipensiunkan; rate limit kanonis 429
  `RATE_LIMITED` via tabel D1 `rate_limits` (K-02, K-42).
- Auth: cookie sesi `SameSite=None` + cek Origin di endpoint
  mutasi (K-50); CORS dari `ALLOWED_ORIGIN` (K-49); mekanisme
  kunci PIN diluruskan ke tabel `pin_unlocks`/`pin_attempts`
  (bukan kolom `terkunci`/`users.pin_*`); pengguna dikunci
  `email` + provider (bukan `google_sub`); nama Google hanya
  untuk pengguna baru; ketiga cookie OAuth dihapus di semua jalur
  keluar callback; cookie OAuth ber-Path `/api/auth`.
- Akun: hapus akun terima `HAPUS` atau `DELETE` (K-26); ekspor
  5/hari dengan cek batas sebelum query berat + batas 30.000
  sampel; daftar sesi memakai kolom `user_agent`/`ip_terakhir`
  asli (K-44).
- Utilitas menjadi §8 (renumber karena §7 baru); `GET
  /api/speedtest/info` tambah field `ip_publik` (K-25).
- Contoh curl (§9) memakai awalan `/api` dan cursor; tambah
  §9.8 riwayat gabungan.

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
