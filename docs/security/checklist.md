# Checklist Keamanan Implementasi — Dokter HP Web App

> **Status:** Fase 1 — dokumen, 17 November 2026.
> **Cara memakai:** setiap item dicentang hanya setelah dibuktikan
> dengan tes atau pemeriksaan nyata (bukan dari membaca kode saja).
> Kolom "Bukti" diisi dengan cara pembuktiannya: tes otomatis,
> pemeriksaan manual, atau hasil pemindaian.
> **Dokumen acuan:** `PRODUCT.md`, `ARCHITECTURE.md`,
> `threat-model.md`, `red-team-plan.md`.
> **Bahasa:** Bahasa Indonesia. Dokumen ini tidak berisi secret
> apa pun.

Legenda status: ☐ belum dikerjakan · ◐ sedang dikerjakan ·
☑ selesai dan terbukti · N/A tidak berlaku (beri alasan).

---

## 1. Autentikasi (Google OAuth)

| # | Item | Status | Bukti |
|---|---|---|---|
| 1.1 | Authorization code flow dipakai; penukaran kode terjadi di Worker, bukan di browser | ☐ | |
| 1.2 | PKCE dipakai (`code_challenge` / `code_verifier`) pada alur OAuth | ☐ | |
| 1.3 | Parameter `state` acak dibuat per alur login, disimpan di cookie HttpOnly singkat, dan diverifikasi persis di callback; callback dengan `state` tidak cocok ditolak | ☐ | |
| 1.4 | Redirect URI terdaftar persis di Google Cloud Console; tidak ada redirect URI wildcard | ☐ | |
| 1.5 | `google_sub` hanya diambil dari token ID yang sudah diverifikasi Google di server; tidak pernah dari input client | ☐ | |
| 1.6 | Kolom `google_sub` UNIQUE di D1; percobaan membuat pengguna duplikat ditolak dengan aman | ☐ | |
| 1.7 | Redirect setelah login hanya ke path internal yang diizinkan (`/dashboard`); tidak ada parameter `next` bebas | ☐ | |
| 1.8 | Rate limit 10/menit per IP pada `GET /auth/google` | ☐ | |
| 1.9 | Client secret Google hanya sebagai secret Worker; tidak ada di repo, log, atau bundle frontend | ☐ | |
| 1.10 | Pengguna baru dan pengguna lama ditangani dengan benar (cari berdasar `google_sub`, buat bila belum ada; profil dibuat bersamaan) | ☐ | |

## 2. PIN

| # | Item | Status | Bukti |
|---|---|---|---|
| 2.1 | PIN disimpan hanya sebagai hash SHA-256 + salt unik per pengguna; PIN asli tidak pernah disimpan | ☐ | |
| 2.2 | Salt dibuat acak per pengguna (minimal 16 byte dari `crypto.getRandomValues`) | ☐ | |
| 2.3 | PIN divalidasi: 4–8 digit angka saja; pola lemah ditolak (semua digit sama, urutan naik/turun) | ☐ | |
| 2.4 | Setelah 5 kali PIN salah berturut-turut, masukan dikunci 30 detik (`pin_terkunci_sampai`) | ☐ | |
| 2.5 | Penghitung percobaan salah disimpan per pengguna di D1, bukan per sesi; sesi baru tidak me-reset penghitung | ☐ | |
| 2.6 | Percobaan selama terkunci ditolak tanpa memeriksa PIN (tidak membocorkan apakah PIN benar) | ☐ | |
| 2.7 | Penghitung di-reset ke 0 setelah verifikasi PIN berhasil | ☐ | |
| 2.8 | Respons verifikasi gagal seragam (tidak membocorkan sisa percobaan secara detail) | ☐ | |
| 2.9 | PIN hanya dikirim lewat body POST HTTPS; tidak pernah di query string, URL, atau log | ☐ | |
| 2.10 | Ubah PIN butuh verifikasi PIN lama bila PIN sudah diatur; hapus PIN butuh konfirmasi eksplisit | ☐ | |
| 2.11 | Pemulihan PIN lupa hanya lewat masuk ulang Google + atur PIN baru; tidak ada reset PIN lewat email atau server | ☐ | |
| 2.12 | Perbandingan hash memakai perbandingan waktu-konstan (tidak bocor lewat timing) | ☐ | |

## 3. Sesi

| # | Item | Status | Bukti |
|---|---|---|---|
| 3.1 | Token sesi acak minimal 32 byte dari `crypto.getRandomValues` | ☐ | |
| 3.2 | Yang disimpan di D1 hanya SHA-256 token; token mentah tidak pernah disimpan di server | ☐ | |
| 3.3 | Cookie sesi: HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 hari | ☐ | |
| 3.4 | Token sesi baru dibuat setelah login berhasil (tidak memakai token yang sudah ada sebelum login) | ☐ | |
| 3.5 | Setiap request terautentikasi memverifikasi token, kedaluwarsa, dan flag `terkunci` | ☐ | |
| 3.6 | Sesi yang masih `terkunci` ditolak di semua endpoint kecuali endpoint PIN (penegakan di Worker, bukan hanya redirect frontend) | ☐ | |
| 3.7 | Verifikasi PIN yang berhasil menandai sesi `terkunci = 0` | ☐ | |
| 3.8 | Logout menghapus baris sesi di D1 dan menghapus cookie di browser | ☐ | |
| 3.9 | "Keluar dari sesi lain" menghapus semua sesi pengguna kecuali sesi yang sedang dipakai | ☐ | |
| 3.10 | Daftar sesi aktif hanya menampilkan sesi milik pengguna yang masuk | ☐ | |
| 3.11 | Token sesi tidak pernah dicatat di log, tidak pernah di URL, dan tidak pernah di header Referer | ☐ | |
| 3.12 | Sesi kedaluwarsa dibersihkan berkala (tugas terjadwal atau pembersihan oportunistik) | ☐ | |

## 4. Otorisasi per pengguna (kepemilikan data)

> D1 TIDAK punya Row Level Security. Semua penegakan ada di kode
> Worker. Bagian ini adalah yang paling penting di seluruh checklist.

| # | Item | Status | Bukti |
|---|---|---|---|
| 4.1 | `user_id` selalu diambil dari sesi terverifikasi; tidak ada endpoint yang menerima `user_id` dari client | ☐ | |
| 4.2 | Setiap query baca data memfilter `user_id` dari sesi (health_checks, wifi_reports, ai_diagnoses, sessions) | ☐ | |
| 4.3 | Setiap query tulis/ubah/hapus memverifikasi kepemilikan sebelum bertindak (baca dulu dengan filter `user_id`, atau UPDATE/DELETE dengan `WHERE id = ? AND user_id = ?` lalu periksa jumlah baris yang berubah) | ☐ | |
| 4.4 | `GET /health-checks/:id`, `/wifi-reports/:id` mengembalikan 404 yang sama untuk "tidak ada" dan "bukan milik Anda" | ☐ | |
| 4.5 | `POST /wifi-reports/:id/samples` memverifikasi laporan milik pengguna sebelum menyimpan sampel | ☐ | |
| 4.6 | `POST /ai/diagnose` memverifikasi `health_check_id` (bila diisi) milik pengguna sebelum dipakai sebagai konteks | ☐ | |
| 4.7 | Konteks AI hanya dirakit dari data milik pengguna yang masuk | ☐ | |
| 4.8 | `DELETE /account/sessions/:id` hanya menghapus sesi milik pengguna yang masuk | ☐ | |
| 4.9 | ID dibuat dengan `crypto.randomUUID()` (UUID v4 acak, tidak berurutan) | ☐ | |
| 4.10 | Uji IDOR eksplisit lolos untuk setiap endpoint berparameter `:id` (lihat `red-team-plan.md` skenario R1) | ☐ | |
| 4.11 | Semua query baca memfilter `deleted_at IS NULL` (data soft-delete tidak bisa dibaca lewat ID langsung) | ☐ | |
| 4.12 | Mass assignment dicegah: skema validasi memakai allowlist field; `user_id`, `dibuat_pada`, `deleted_at`, `sync_status` tidak bisa diatur dari client | ☐ | |

## 5. Validasi input

| # | Item | Status | Bukti |
|---|---|---|---|
| 5.1 | Semua payload divalidasi di Worker dengan zod (tipe, panjang maksimum, rentang) | ☐ | |
| 5.2 | Skor divalidasi 0–100 (juga ditegakkan CHECK di D1) | ☐ | |
| 5.3 | `sumber` hanya `web` / `apk` / `manual` (juga CHECK di D1) | ☐ | |
| 5.4 | `detik_ke` sampel 0–29; maksimal 30 sampel per laporan | ☐ | |
| 5.5 | `limit` dan `offset` paginasi dibatasi (`limit` maksimum 100; nilai negatif atau bukan angka ditolak) | ☐ | |
| 5.6 | Panjang maksimum diberlakukan untuk semua field teks (nama, SSID, DNS, rekomendasi, pertanyaan AI, ringkasan JSON) | ☐ | |
| 5.7 | Batas ukuran body request diberlakukan di Worker | ☐ | |
| 5.8 | `ringkasan` JSON divalidasi sebagai JSON yang sah sebelum disimpan | ☐ | |
| 5.9 | Field yang tidak dikenal di body ditolak atau dibuang (tidak diteruskan ke query) | ☐ | |
| 5.10 | Validasi juga ada di frontend untuk kenyamanan, tetapi validasi Worker adalah sumber kebenaran | ☐ | |

## 6. Perlindungan SQL injection

| # | Item | Status | Bukti |
|---|---|---|---|
| 6.1 | Semua query memakai prepared statement dengan parameter terikat (`?`); tidak ada string SQL yang dirakit dari input | ☐ | |
| 6.2 | Tidak ada interpolasi string ke dalam query SQL di mana pun (termasuk ORDER BY, LIMIT, nama kolom — nilai-nilai ini memakai allowlist atau angka yang sudah divalidasi) | ☐ | |
| 6.3 | Pencarian kode (`grep`) memastikan tidak ada pola perakitan query dari input sebelum rilis | ☐ | |
| 6.4 | Tes injeksi SQL lolos (lihat `red-team-plan.md` skenario R4) | ☐ | |

## 7. Rate limit

| # | Item | Status | Bukti |
|---|---|---|---|
| 7.1 | `POST /ai/diagnose`: 20/hari per pengguna | ☐ | |
| 7.2 | `POST /auth/pin/verify`: 5 percobaan lalu kunci 30 detik (lihat bagian 2) | ☐ | |
| 7.3 | `GET /auth/google`: 10/menit per IP | ☐ | |
| 7.4 | Semua endpoint tulis: 60/menit per pengguna | ☐ | |
| 7.5 | Respons saat kena batas: HTTP 429 dengan envelope galat standar dan pesan bahasa sehari-hari | ☐ | |
| 7.6 | Rate limit ditegakkan di server (D1 atau fitur platform), bukan di frontend | ☐ | |
| 7.7 | Rate limit tidak memakai KV (kuota writes KV hanya 1.000/hari) | ☐ | |
| 7.8 | Uji bypass rate limit lolos (lihat `red-team-plan.md` skenario R8) | ☐ | |

## 8. Header keamanan dan CSP

| # | Item | Status | Bukti |
|---|---|---|---|
| 8.1 | `Content-Security-Policy` dipasang di Pages dan Vercel: `default-src 'self'`; tanpa `unsafe-eval`; `script-src 'self'`; `connect-src 'self' <domain Worker>`; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'` | ☐ | |
| 8.2 | `X-Content-Type-Options: nosniff` di Worker dan kedua mirror | ☐ | |
| 8.3 | `Referrer-Policy: strict-origin-when-cross-origin` di Worker dan kedua mirror | ☐ | |
| 8.4 | `Permissions-Policy` minimal (nonaktifkan kamera, mikrofon, geolokasi, dan sensor yang tidak dipakai) | ☐ | |
| 8.5 | `Strict-Transport-Security` aktif di domain API dan kedua mirror | ☐ | |
| 8.6 | `X-Frame-Options: DENY` (atau `frame-ancestors 'none'` di CSP) agar aplikasi tidak bisa di-frame | ☐ | |
| 8.7 | Header keamanan diperiksa dengan pemindaian header (misalnya securityheaders.com atau curl manual) sebelum rilis | ☐ | |
| 8.8 | CSP tidak merusak fungsi: jsPDF, tes kecepatan, dan fetch API tetap jalan setelah CSP dipasang | ☐ | |

## 9. Perlindungan XSS

| # | Item | Status | Bukti |
|---|---|---|---|
| 9.1 | Tidak ada `dangerouslySetInnerHTML` di seluruh kode frontend | ☐ | |
| 9.2 | Jawaban AI ditampilkan sebagai teks murni (bukan HTML) | ☐ | |
| 9.3 | Semua data dari server (nama, SSID, rekomendasi, pertanyaan) dirender lewat React (escape otomatis), bukan lewat `innerHTML` | ☐ | |
| 9.4 | Data yang masuk ke laporan PDF tidak dieksekusi sebagai kode | ☐ | |
| 9.5 | Tes XSS tersimpan lolos (lihat `red-team-plan.md` skenario R5) | ☐ | |

## 10. Cookie

| # | Item | Status | Bukti |
|---|---|---|---|
| 10.1 | Cookie sesi: HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 hari (lihat bagian 3) | ☐ | |
| 10.2 | Cookie OAuth sementara (state/PKCE): HttpOnly, Secure, SameSite=Lax, masa berlaku singkat (maksimal 10 menit) | ☐ | |
| 10.3 | Tidak ada cookie lain yang menyimpan data sensitif | ☐ | |
| 10.4 | Cookie dihapus dengan benar saat logout (Max-Age=0, path dan atribut sama seperti saat dibuat) | ☐ | |

## 11. Secrets

| # | Item | Status | Bukti |
|---|---|---|---|
| 11.1 | Kunci Gemini hanya sebagai secret Worker (`wrangler secret put` / dashboard); tidak ada di repo, `wrangler.toml`, log, atau frontend | ☐ | |
| 11.2 | Client secret Google OAuth hanya sebagai secret Worker | ☐ | |
| 11.3 | `wrangler.toml` tidak berisi nilai secret apa pun (hanya nama binding) | ☐ | |
| 11.4 | Variabel lingkungan frontend hanya `VITE_API_BASE_URL`; tidak ada secret di `VITE_*` | ☐ | |
| 11.5 | Pemindaian otomatis di hasil build memastikan tidak ada pola kunci API di bundle (tes di CI) | ☐ | |
| 11.6 | `.gitignore` memblokir `.env`, `.dev.vars`, dan file kredensial | ☐ | |
| 11.7 | Tidak ada secret yang pernah ter-commit (periksa riwayat git sebelum rilis pertama) | ☐ | |
| 11.8 | Prosedur rotasi secret tercatat: bila kunci bocor, kunci dicabut dan diganti, lalu deploy ulang | ☐ | |

## 12. CORS dan CSRF

| # | Item | Status | Bukti |
|---|---|---|---|
| 12.1 | CORS hanya mengizinkan dua origin frontend (Pages + Vercel); tidak ada wildcard `*` | ☐ | |
| 12.2 | `credentials: true` hanya untuk origin yang diizinkan | ☐ | |
| 12.3 | Pemeriksaan header `Origin` pada semua endpoint tulis; origin yang tidak diizinkan ditolak dengan 403 | ☐ | |
| 12.4 | Pencocokan origin memakai perbandingan persis (equality), bukan substring | ☐ | |
| 12.5 | Request tanpa header `Origin` dari browser (misalnya curl) ditangani sesuai kebijakan: endpoint tulis butuh Origin yang valid; endpoint baca publik tetap bisa diakses | ☐ | |
| 12.6 | Semua aksi yang mengubah data memakai POST/PATCH/DELETE, bukan GET | ☐ | |
| 12.7 | Tes CSRF lolos (lihat `red-team-plan.md` skenario R6) | ☐ | |

## 13. Logging tanpa PII

| # | Item | Status | Bukti |
|---|---|---|---|
| 13.1 | Log Worker hanya berisi waktu, rute, status, durasi, dan pengenal yang di-hash bila perlu; tidak berisi token, PIN, atau email | ☐ | |
| 13.2 | Isi pertanyaan dan jawaban AI tidak dicatat penuh di log | ☐ | |
| 13.3 | Pesan galat ke client memakai bahasa sehari-hari; stack trace dan rincian teknis tidak pernah dikirim ke client | ☐ | |
| 13.4 | Log tidak berisi data jaringan sensitif pengguna (SSID lengkap, IP publik) kecuali benar-benar perlu untuk debugging dan sudah disamarkan | ☐ | |
| 13.5 | Tidak ada analytics atau pelacak pihak ketiga di frontend | ☐ | |

## 14. Penghapusan akun dan hak pengguna atas datanya (GDPR-like)

| # | Item | Status | Bukti |
|---|---|---|---|
| 14.1 | `DELETE /account` menghapus pengguna beserta seluruh data terkait (profil, sesi, health_checks, wifi_reports + sampel, ai_diagnoses) | ☐ | |
| 14.2 | Penghapusan memakai foreign key cascade dengan `PRAGMA foreign_keys = ON`, ATAU penghapusan baris anak secara eksplisit di kode — dan dibuktikan dengan tes | ☐ | |
| 14.3 | Setelah hapus akun, tidak ada baris yatim yang tersisa (diperiksa dengan query di semua tabel) | ☐ | |
| 14.4 | Hapus akun butuh konfirmasi eksplisit (`konfirmasi: "HAPUS"`) dan sesi valid | ☐ | |
| 14.5 | Setelah hapus akun, sesi pengguna tersebut tidak lagi berlaku | ☐ | |
| 14.6 | Pengguna bisa menghapus entri riwayat per item (soft-delete) | ☐ | |
| 14.7 | Pengguna bisa melihat data miliknya (daftar riwayat lewat API) dan mengunduhnya sebagai laporan PDF | ☐ | |
| 14.8 | Pengguna bisa keluar dari semua sesi (daftar sesi + tombol keluar dari sesi lain) | ☐ | |
| 14.9 | Data pengguna yang tidak masuk (tes WiFi tanpa akun) tidak tersimpan ke server | ☐ | |
| 14.10 | Tidak ada pengumpulan data tanpa izin; tidak ada pengiriman data diam-diam ke pihak ketiga | ☐ | |

## 15. Backup dan pemulihan

| # | Item | Status | Bukti |
|---|---|---|---|
| 15.1 | Jadwal backup D1 tercatat (ekspor berkala lewat `wrangler d1 export` atau mekanisme setara) | ☐ | |
| 15.2 | Backup disimpan di tempat yang aksesnya terbatas (bukan repo publik, bukan folder yang dibagikan) | ☐ | |
| 15.3 | Prosedur pemulihan dari backup terdokumentasi dan pernah diuji di database percobaan | ☐ | |
| 15.4 | Backup berisi hash PIN dan hash sesi — perlakukan file backup sebagai data sensitif (enkripsi saat disimpan bila memungkinkan) | ☐ | |
| 15.5 | Rencana bila kuota D1 habis: Worker mengembalikan galat jujur ("Server sedang sibuk, coba lagi nanti") dan layanan pulih otomatis saat reset 00:00 UTC | ☐ | |
| 15.6 | Rencana bila Worker down: kedua mirror menampilkan banner jujur dan tes WiFi tetap jalan lokal | ☐ | |

## 16. Deploy dan rantai pasok

| # | Item | Status | Bukti |
|---|---|---|---|
| 16.1 | Satu commit → satu build → dua deploy; hash build dicatat untuk Pages dan Vercel | ☐ | |
| 16.2 | Uji smoke setelah deploy di kedua mirror: landing, tes WiFi tanpa akun, masuk Google, simpan laporan, buka riwayat | ☐ | |
| 16.3 | `npm audit` dijalankan dan tidak ada kerentanan kritis/tinggi yang belum ditangani | ☐ | |
| 16.4 | Versi dependensi dikunci (`package-lock.json` ter-commit) | ☐ | |
| 16.5 | Tidak ada data dummy yang tampil seolah data nyata di layar mana pun | ☐ | |
| 16.6 | Semua layar punya tiga kondisi: memuat, galat (dengan tombol "Coba lagi"), dan kosong yang jujur | ☐ | |

---

## Ringkasan gerbang rilis

Rilis pertama TIDAK BOLEH dilakukan bila ada item berikut yang
belum selesai dan terbukti:

1. Seluruh bagian 4 (otorisasi per pengguna).
2. Bagian 6 (SQL injection).
3. Bagian 11 (secrets).
4. Item 2.4–2.7 (kunci PIN), 3.3–3.6 (cookie dan sesi terkunci),
   12.1–12.3 (CORS dan pemeriksaan Origin), 14.1–14.5 (hapus akun).
5. Semua skenario Red Team ronde 1 lolos (lihat `red-team-plan.md`).

---

## Changelog dokumen

| Tanggal | Perubahan |
|---|---|
| 17 Nov 2026 | Dokumen awal: 16 bagian checklist + gerbang rilis |
