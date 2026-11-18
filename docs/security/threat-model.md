# Model Ancaman — Dokter HP Web App

> **Status:** Fase 1 — dokumen, 17 November 2026.
> **Ruang lingkup:** seluruh sistem Dokter HP Web App — frontend
> (Cloudflare Pages + mirror Vercel), Worker API (Hono), D1, KV,
> Google OAuth, PIN, sesi, dan integrasi Gemini.
> **Dokumen acuan:** `PRODUCT.md`, `ARCHITECTURE.md`.
> **Bahasa:** Bahasa Indonesia. Dokumen ini tidak berisi secret
> apa pun.

---

## 1. Cara membaca dokumen ini

Model ancaman ini memakai kerangka **STRIDE** (Spoofing, Tampering,
Repudiation, Information Disclosure, Denial of Service, Elevation of
Privilege) per komponen sistem. Setiap ancaman dinilai dampaknya
dengan skala berikut:

| Dampak | Arti |
|---|---|
| Kritis | Data banyak pengguna bocor, akun diambil alih massal, atau sistem lumpuh total |
| Tinggi | Satu akun diambil alih, data satu pengguna bocor, atau secret server terekspos |
| Sedang | Data terbatas bocor, fitur rusak untuk sebagian pengguna, atau biaya kuota terkuras |
| Rendah | Gangguan kecil, informasi non-sensitif bocor, atau dampak kosmetik |

Kemungkinan dinilai dari seberapa mudah serangan dilakukan oleh
penyerang yang dijelaskan di bagian 3: **Rendah** (butuh akses khusus
atau keterampilan tinggi), **Sedang** (butuh alat umum dan sedikit
waktu), **Tinggi** (bisa dilakukan siapa saja dengan browser dan
curl).

Prioritas perbaikan mengikuti kombinasi dampak × kemungkinan.
Ancaman dengan dampak Kritis atau Tinggi wajib ditangani sebelum
rilis pertama; ancaman Sedang ditangani di ronde berikutnya;
ancaman Rendah dicatat dan dipantau.

---

## 2. Aset yang dilindungi

| # | Aset | Lokasi | Sensitivitas |
|---|---|---|---|
| A1 | Data riwayat pengguna: pemeriksaan kesehatan, laporan WiFi, diagnosis AI | D1 (`health_checks`, `wifi_reports`, `ai_diagnoses`, `wifi_sustained_samples`) | Tinggi — data pribadi perangkat dan jaringan pengguna |
| A2 | Identitas akun: email, nama, provider | D1 (`users`, `profiles`) | Tinggi — pengenal akun |
| A3 | Hash PIN + salt | D1 (`users.pin_hash`, `users.pin_salt`) | Tinggi — kunci aplikasi; PIN hanya 4–8 digit sehingga hash rentan ditebak bila bocor |
| A4 | Token sesi (mentah di cookie; hash di D1) | Cookie browser + D1 (`sessions.token_hash`) | Tinggi — token mentah sama dengan akses akun |
| A5 | Secret server: kunci Gemini, client secret Google OAuth | Secret Worker (Cloudflare) | Kritis — kunci Gemini yang bocor bisa disalahgunakan sampai kuota habis; client secret yang bocor melemahkan OAuth |
| A6 | Data jaringan pengguna: SSID, DNS, IP publik, channel router | D1 (`wifi_reports`) + respons API | Sedang — SSID dan IP bisa dipakai memetakan lokasi/jaringan |
| A7 | Keluhan dan jawaban diagnosis AI | D1 (`ai_diagnoses`) | Sedang — bisa berisi informasi pribadi yang pengguna tulis sendiri |
| A8 | Kuota bersama: D1 (5 jt baca / 100 rb tulis per hari), Gemini, KV writes (1.000/hari) | Platform Cloudflare + Google | Sedang — bila habis, layanan berhenti untuk semua pengguna |
| A9 | Integritas kode dan deploy: repo, build frontend, Worker | GitHub, Cloudflare Pages, Vercel | Tinggi — kode yang diubah bisa mencuri sesi atau data |
| A10 | Ketersediaan layanan (uptime API dan kedua mirror) | Cloudflare + Vercel | Sedang — gangguan menghentikan layanan, tetapi tes WiFi lokal tetap jalan |

---

## 3. Model penyerang

| Penyerang | Kemampuan | Motivasi | Contoh |
|---|---|---|---|
| P1 — Pengguna biasa yang penasaran | Browser, curl, membaca respons API; tanpa akses server | Melihat data pengguna lain, melewati batas pemakaian | Mengubah `:id` di URL untuk membaca laporan orang lain |
| P2 — Penyerang eksternal tanpa akun | Internet, alat otomatis (skrip, bot), tanpa kredensial valid | Mengambil alih akun, menguras kuota, menjatuhkan layanan | Brute force PIN, banjir request ke `/api/ai/diagnose` |
| P3 — Penyerang dengan satu akun valid | Akun sendiri yang sah + alat teknis | Mencuri data pengguna lain, menyalahgunakan AI | IDOR, enumerasi ID, penyalahgunaan rate limit |
| P4 — Penyusup lewat browser korban | Bisa membuat korban mengunjungi situs jahat | Mencuri sesi, memalsukan aksi atas nama korban | XSS tersimpan, CSRF, phishing halaman login palsu |
| P5 — Pihak dalam / kebocoran operasional | Akses tidak sengaja ke repo, log, atau dashboard | Membocorkan secret atau data | Secret ter-commit ke repo, token tercetak di log |
| P6 — Penyerang jaringan (MitM) | Posisi di jaringan yang sama dengan korban (WiFi publik) | Menyadap lalu lintas | Serangan downgrade HTTP, penyadapan cookie tanpa Secure |

**Di luar model ancaman ini:** penyerang yang sudah menguasai
infrastruktur Cloudflare/Google/Vercel, serangan terhadap perangkat
fisik pengguna (malware di HP), dan serangan terhadap akun Google
pengguna itu sendiri. Ketiganya berada di luar kendali proyek ini;
mitigasinya adalah praktik standar (HTTPS wajib, secret terpisah,
tidak menyimpan data yang tidak perlu).

---

## 4. Permukaan serangan (ringkasan)

| Permukaan | Keterangan |
|---|---|
| Endpoint API publik | `/api/auth/google`, `/api/auth/google/callback`, `/api/health`, `/api/ping` |
| Endpoint API terautentikasi | Semua `/api/health-checks/*`, `/api/wifi-reports/*`, `/api/ai/*`, `/api/account/*`, `/api/auth/pin/*`, `/api/auth/me`, `/api/auth/logout` |
| Cookie sesi | `__Host-dokter_hp_session` (HttpOnly, Secure, SameSite=None, Path=/, 30 hari) |
| Frontend statis | Build Vite di Pages + Vercel; file `speedtest-1mb.bin` |
| Alur OAuth | Redirect ke Google dan callback; parameter `state` + PKCE |
| Input pengguna | PIN, nama tampilan, SSID, DNS, rekomendasi, pertanyaan AI, ringkasan JSON |
| Integrasi Gemini | Prompt yang dirakit Worker dari data pengguna + pertanyaan |
| Rantai pasok | Dependensi npm (React, Hono, jsPDF), GitHub Actions / integrasi deploy |

---

## 5. STRIDE per komponen

### 5.1 Frontend (Pages + mirror Vercel)

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| F1 | Spoofing | Situs phishing meniru landing Dokter HP dan mengarahkan korban ke OAuth palsu atau meminta PIN | Tinggi | Sedang | Domain resmi diumumkan jelas; OAuth hanya lewat domain API resmi; pengguna diajak memeriksa URL; tidak ada halaman yang meminta PIN di luar aplikasi |
| F2 | Tampering | Dependensi npm jahat / build yang disusupi menyisipkan kode pencuri data | Kritis | Rendah | Kunci versi dependensi (`package-lock.json`); audit dependensi berkala (`npm audit`); build hanya dari CI tepercaya; periksa bundle hasil build sebelum deploy |
| F3 | Tampering | File `speedtest-1mb.bin` diganti sehingga tes kecepatan memberi hasil palsu | Rendah | Rendah | File berasal dari repo yang sama; hash file dicatat dan diperiksa pada uji smoke |
| F4 | Information Disclosure | Kunci atau secret terselip di bundle frontend (`VITE_*` atau kode) | Kritis | Sedang | Hanya `VITE_API_BASE_URL` yang boleh ada di variabel frontend; pencarian otomatis di hasil build untuk pola kunci; tinjauan kode sebelum merge |
| F5 | Information Disclosure | Pesan galat frontend menampilkan rincian teknis sistem | Rendah | Sedang | Pesan galat memakai bahasa sehari-hari; rincian teknis hanya di log server |
| F6 | Denial of Service | Mirror Vercel menampilkan build lama yang tidak cocok dengan API | Sedang | Sedang | Satu commit → satu build → dua deploy; hash build dicatat; uji smoke di kedua mirror setelah deploy |
| F7 | Elevation of Privilege | Logika otorisasi hanya di frontend (misalnya tombol disembunyikan tetapi API tidak memeriksa) | Tinggi | Sedang | Semua otorisasi ditegakkan di Worker; frontend hanya menyembunyikan UI untuk kenyamanan, bukan keamanan |

### 5.2 Worker API (Hono)

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| W1 | Spoofing | Token sesi palsu atau token pengguna lain dipakai untuk mengakses API | Tinggi | Sedang | Token acak 32 byte dari `crypto.getRandomValues`; verifikasi dengan hash SHA-256 + cek kedaluwarsa di setiap request; perbandingan hash waktu-konstan |
| W2 | Spoofing | Header `user_id` atau field `user_id` di body dipakai untuk menyamar sebagai pengguna lain | Tinggi | Tinggi | `user_id` SELALU diambil dari sesi terverifikasi; tidak ada endpoint yang menerima `user_id` dari client; validator tulisan tangan menolak field yang tidak dikenal |
| W3 | Tampering | SQL injection lewat input (SSID, nama, pertanyaan, ID) | Kritis | Sedang | Prepared statement dengan parameter terikat di semua query; tidak ada perakitan string SQL dari input; validasi tulisan tangan sebelum query |
| W4 | Tampering | IDOR: pengguna A membaca/mengubah/menghapus data pengguna B dengan menebak `:id` | Tinggi | Tinggi | Setiap query data memfilter `user_id` dari sesi; pengecekan kepemilikan sebelum baca/tulis/hapus; ID acak UUID v4 (tidak berurutan, tidak bisa ditebak) |
| W5 | Tampering | Mass assignment: client mengirim field yang tidak seharusnya bisa diubah (misalnya `user_id`, `dibuat_pada`, `deleted_at`) | Tinggi | Sedang | Validator tulisan tangan memakai daftar field yang diizinkan (allowlist); field di luar skema ditolak atau dibuang; kolom sensitif tidak pernah diambil dari body |
| W6 | Tampering | Manipulasi skor/ringkasan: client mengirim skor palsu 100 agar riwayat terlihat bagus | Rendah | Tinggi | Skor dari client diterima sebagai data yang dilaporkan pengguna, bukan hasil ukur server; sumber data dicatat (`sumber`); skor tidak dipakai untuk keputusan yang merugikan pihak lain |
| W7 | Repudiation | Aksi berbahaya (hapus akun, hapus data) tidak bisa dilacak pelakunya | Sedang | Sedang | Log terstruktur (waktu, rute, status, `user_id` yang di-hash, durasi); hapus akun butuh konfirmasi eksplisit; log tidak berisi PII penuh |
| W8 | Information Disclosure | Respons galat membocorkan struktur database, stack trace, atau keberadaan data orang lain | Sedang | Sedang | Envelope galat standar dengan pesan bahasa sehari-hari; 404 yang sama untuk "tidak ada" dan "bukan milik Anda" (tidak membocorkan keberadaan); stack trace tidak pernah ke client |
| W9 | Information Disclosure | Enumerasi pengguna lewat respons berbeda (misalnya `/api/auth/me` atau pesan galat login yang berbeda) | Sedang | Sedang | Pesan galat seragam; tidak ada endpoint yang membedakan "email terdaftar" vs "tidak terdaftar"; OAuth Google tidak membocorkan status akun |
| W10 | Denial of Service | Banjir request ke endpoint tulis menghabiskan kuota D1 (100 ribu tulis/hari) | Tinggi | Sedang | Rate limit 60/menit per pengguna untuk endpoint tulis; paginasi + `LIMIT` di semua daftar; endpoint `/api/ping` dan `/api/health` tidak menyentuh D1 |
| W11 | Denial of Service | Payload besar (ringkasan JSON raksasa, ribuan sampel) membebani D1 dan Worker | Sedang | Sedang | Batas ukuran body; validasi panjang maksimum per field; sampel tes bertahan dibatasi 30 per laporan; `limit` maksimum di query daftar |
| W12 | Elevation of Privilege | Sesi yang masih "terkunci" (PIN belum diverifikasi) dipakai mengakses data | Tinggi | Sedang | Worker memeriksa flag `terkunci` di sesi pada semua endpoint kecuali endpoint PIN; frontend mengalihkan ke `/kunci`, tetapi penegakan ada di Worker |

### 5.3 D1 (database)

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| D1 | Information Disclosure | Kebocoran database (backup, ekspor, akses dashboard yang tidak sah) membuka hash PIN, hash sesi, dan seluruh riwayat | Kritis | Rendah | Akses dashboard Cloudflare dibatasi; tidak ada ekspor database ke tempat yang tidak aman; hash PIN memakai salt unik per pengguna; token sesi hanya hash-nya |
| D2 | Information Disclosure | Hash PIN bocor lalu ditebak offline (PIN hanya 4–8 digit → ruang tebak kecil) | Tinggi | Sedang | Salt unik per pengguna; PIN hanya lapisan kedua setelah sesi Google (penyerang butuh sesi valid dulu untuk memakai PIN); pertimbangkan penguat hash (iterasi) di ronde berikutnya — lihat catatan di bagian 7 |
| D3 | Tampering | Foreign key cascade tidak aktif (`PRAGMA foreign_keys` mati) sehingga hapus akun meninggalkan data yatim | Sedang | Sedang | Aktifkan `PRAGMA foreign_keys = ON` per koneksi ATAU hapus baris anak secara eksplisit di kode; uji hapus akun memverifikasi tidak ada baris yatim |
| D4 | Tampering | Soft-delete dilewati: data yang sudah dihapus masih bisa dibaca lewat ID langsung | Sedang | Sedang | Semua query baca memfilter `deleted_at IS NULL`; uji eksplisit untuk data yang sudah di-soft-delete |
| D5 | Denial of Service | Query tanpa indeks / tanpa `LIMIT` menghabiskan kuota baca D1 (5 juta baris/hari) | Sedang | Sedang | Indeks pada `user_id` dan `dibuat_pada`; `LIMIT` wajib di semua daftar; paginasi dengan `limit` maksimum |
| D6 | Repudiation | Tidak ada jejak audit perubahan data di D1 | Rendah | Tinggi | `updated_at` diperbarui di setiap UPDATE; log Worker mencatat aksi tulis penting; tidak ada penghapusan permanen kecuali hapus akun |

### 5.4 KV

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| K1 | Denial of Service | KV writes (1.000/hari) habis karena dipakai untuk data yang sering berubah | Sedang | Sedang | KV HANYA untuk data yang jarang berubah; sesi dan rate limit TIDAK memakai KV (sesi di D1) |
| K2 | Information Disclosure | Data sensitif tersimpan di KV tanpa sadar (misalnya token OAuth sementara) | Tinggi | Rendah | Jangan simpan token, PIN, atau PII di KV; state OAuth sementara memakai cookie HttpOnly singkat atau D1 dengan kedaluwarsa |
| K3 | Tampering | Nilai KV yang dipakai konfigurasi (misalnya daftar origin yang diizinkan) diubah | Sedang | Rendah | Konfigurasi keamanan di-hardcode di Worker atau di secret, bukan di KV yang bisa ditulis lewat API |

### 5.5 Google OAuth

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| O1 | Spoofing | Serangan CSRF pada alur login: penyerang memulai OAuth dengan akunnya sendiri lalu korban menyelesaikan alur sehingga sesi korban terikat ke akun penyerang | Tinggi | Sedang | Parameter `state` acak yang diikat ke sesi browser (cookie) dan diverifikasi di callback; tolak callback bila `state` tidak cocok |
| O2 | Spoofing | Pencurian authorization code (code interception) lalu ditukar dengan token | Tinggi | Rendah | PKCE (`code_challenge`/`code_verifier`); penukaran kode hanya di server; redirect URI persis terdaftar di Google Cloud Console |
| O3 | Spoofing | Redirect URI terbuka (open redirect) dipakai mengarahkan korban ke situs jahat setelah login | Sedang | Sedang | Redirect setelah login hanya ke path internal yang diizinkan (`/dashboard`); tidak ada parameter `next` bebas dari client |
| O4 | Information Disclosure | Client secret Google bocor lewat repo, log, atau bundle | Tinggi | Rendah | Client secret hanya sebagai secret Worker; tidak pernah di repo, log, atau frontend |
| O5 | Tampering | Akun diambil alih dengan mendaftarkan email Google orang lain | Tinggi | Rendah | Akun dikenali dari email Google terverifikasi + provider; email hanya diambil dari profil userinfo Google yang dipanggil server setelah penukaran kode, tidak pernah dari input client; `sub` hanya dibaca sesaat untuk validasi profil dan tidak disimpan; kolom `email` UNIQUE |
| O6 | Denial of Service | Banjir request ke `/api/auth/google` menghabiskan kuota atau memicu pembatasan Google | Sedang | Sedang | Rate limit 10/menit per IP pada `/api/auth/google` |

### 5.6 PIN

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| P1 | Spoofing | Brute force PIN 4 digit (hanya 10.000 kombinasi) lewat `/api/auth/pin/verify` | Tinggi | Tinggi | Kunci 30 detik setelah 5 kali salah berturut-turut; penghitung di server (`pin_gagal_berturut`); penundaan tetap pada respons gagal agar tidak bisa dibedakan |
| P2 | Spoofing | PIN ditebak dari pola umum (1234, tanggal lahir, 0000) | Sedang | Tinggi | Tolak PIN yang terlalu mudah ditebak (semua digit sama, urutan naik/turun); anjurkan 6–8 digit di UI |
| P3 | Tampering | Penghitung percobaan salah di-reset dengan membuat sesi baru atau memakai endpoint lain | Tinggi | Sedang | Penghitung disimpan per pengguna di D1 (`users.pin_gagal_berturut`), bukan per sesi; kunci berlaku untuk semua sesi pengguna itu |
| P4 | Information Disclosure | Respons verifikasi PIN membocorkan apakah PIN diatur atau tidak, atau berapa sisa percobaan | Rendah | Sedang | Respons gagal seragam; sisa percobaan tidak diumumkan secara detail ke client yang tidak terautentikasi |
| P5 | Information Disclosure | PIN terlihat di log, URL, atau riwayat browser | Tinggi | Rendah | PIN hanya dikirim lewat body POST HTTPS; tidak pernah di query string; tidak pernah dicatat di log |
| P6 | Denial of Service | Penyerang sengaja mengunci PIN korban dengan 5 percobaan salah berulang (account lockout abuse) | Sedang | Sedang | Kunci hanya 30 detik (singkat); kunci PIN tidak mengunci akun Google — korban tetap bisa masuk ulang dengan Google dan mengatur PIN baru |
| P7 | Elevation of Privilege | Menghapus atau mengubah PIN tanpa verifikasi PIN lama | Tinggi | Sedang | Ubah/hapus PIN butuh sesi valid; ubah PIN butuh verifikasi PIN lama bila PIN sudah diatur; hapus PIN butuh konfirmasi eksplisit |

### 5.7 Sesi

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| S1 | Spoofing | Pencurian cookie sesi lewat XSS | Tinggi | Sedang | Cookie HttpOnly (JavaScript tidak bisa membaca); CSP ketat; React meng-escape output; jawaban AI sebagai teks murni |
| S2 | Spoofing | Pencurian cookie lewat jaringan (MitM) | Tinggi | Rendah | Cookie Secure (hanya HTTPS); HSTS; seluruh lalu lintas HTTPS |
| S3 | Spoofing | Session fixation: penyerang menetapkan token sesi korban sebelum login | Sedang | Rendah | Token sesi baru dibuat di server setelah login berhasil; token lama tidak pernah dipakai ulang |
| S4 | Tampering | Token sesi tidak kedaluwarsa setelah keluar (logout tidak menghapus sesi di server) | Sedang | Sedang | Logout menghapus baris sesi di D1 dan cookie; "keluar dari sesi lain" menghapus semua sesi kecuali yang sedang dipakai |
| S5 | Tampering | Sesi curian tetap berlaku selamanya karena masa berlaku 30 hari tanpa rotasi | Sedang | Sedang | Masa berlaku 30 hari; daftar sesi aktif bisa dilihat dan dicabut pengguna; pertimbangkan rotasi token di ronde berikutnya |
| S6 | Information Disclosure | Token sesi bocor lewat log, URL, atau header Referer | Tinggi | Rendah | Token tidak pernah dicatat di log; tidak pernah di URL; `Referrer-Policy: strict-origin-when-cross-origin`; token hanya di cookie |
| S7 | Denial of Service | Banjir pembuatan sesi memenuhi tabel `sessions` | Rendah | Sedang | Rate limit pada `/api/auth/google`; pembersihan sesi kedaluwarsa berkala |

### 5.8 Diagnosis AI (Gemini)

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| A1 | Information Disclosure | Kunci Gemini bocor ke browser atau repo | Kritis | Rendah | Kunci hanya secret Worker; pemanggilan Gemini hanya dari Worker; pencarian pola kunci di hasil build |
| A2 | Information Disclosure | Prompt injection: pertanyaan pengguna menyuruh AI mengabaikan instruksi, membocorkan prompt sistem, atau mengarang jawaban | Sedang | Tinggi | Prompt sistem memisahkan instruksi dari input pengguna; jawaban dilabeli saran, bukan vonis; validasi panjang pertanyaan; jangan sertakan data pengguna lain dalam konteks |
| A3 | Information Disclosure | Konteks AI berisi data pengguna lain karena query konteks tidak memfilter `user_id` | Tinggi | Sedang | Query konteks memakai `user_id` dari sesi; uji eksplisit bahwa konteks AI hanya berisi data pemilik sesi |
| A4 | Tampering | Pengguna mengirim `health_check_id` milik orang lain agar konteks AI memakai data korban | Tinggi | Sedang | `health_check_id` diverifikasi kepemilikannya sebelum dipakai sebagai konteks; bila bukan milik pengguna, tolak atau abaikan |
| A5 | Denial of Service | Penyalahgunaan kuota Gemini: satu pengguna menghabiskan kuota bersama | Tinggi | Tinggi | Rate limit 20/hari per pengguna pada `/api/ai/diagnose`; batas panjang pertanyaan; timeout panggilan Gemini |
| A6 | Denial of Service | Gemini lambat/timeout membuat Worker menggantung dan request menumpuk | Sedang | Sedang | Timeout tegas pada panggilan Gemini; respons galat jujur bila AI tidak tersedia; jangan pernah mengarang jawaban saat AI mati |
| A7 | Repudiation | Jawaban AI yang salah atau berbahaya tidak bisa dilacak | Rendah | Sedang | Pertanyaan + jawaban tersimpan di `ai_diagnoses` dengan `user_id` dan waktu; jawaban dilabeli saran |

### 5.9 CSRF dan CORS (lintas komponen)

| # | STRIDE | Ancaman | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|---|
| C1 | Spoofing (CSRF) | Situs jahat memicu request tulis (hapus akun, hapus data, ubah PIN) atas nama korban yang sedang login | Tinggi | Sedang | Cookie sesi `SameSite=None` (K-50: frontend dan API beda origin) sehingga pertahanan utama adalah pemeriksaan header `Origin` pada semua endpoint tulis (hanya origin Pages dan Vercel yang diizinkan); endpoint yang mengubah data memakai POST/PATCH/DELETE, bukan GET |
| C2 | Information Disclosure (CORS) | Origin lain membaca respons API memakai kredensial korban | Tinggi | Sedang | CORS hanya mengizinkan dua origin frontend; `credentials: true` hanya untuk origin tersebut; tidak ada wildcard `*` |
| C3 | Tampering | Origin palsu yang mirip (misalnya subdomain tiruan) lolos pemeriksaan Origin dengan pencocokan substring | Sedang | Sedang | Pencocokan origin harus persis (equality), bukan `includes`/`endsWith` |

---

## 6. Lima ancaman terbesar (prioritas)

| Peringkat | Ancaman | Alasan |
|---|---|---|
| 1 | **IDOR antar-pengguna (W4)** — D1 tanpa RLS, kepemilikan hanya di kode | Satu query yang lupa memfilter `user_id` membuka seluruh data pengguna lain. Kemungkinan tinggi karena mudah diuji (ubah `:id` di URL). Wajib diuji eksplisit di setiap endpoint. |
| 2 | **Kebocoran secret server (F4, A1, O4)** — kunci Gemini / client secret di bundle atau repo | Dampak kritis dan mudah terjadi tanpa sadar (variabel `VITE_*`, commit tidak sengaja). Pencegahan otomatis di build adalah pertahanan utama. |
| 3 | **Brute force PIN (P1)** — PIN 4 digit hanya 10.000 kombinasi | Tanpa kunci percobaan, PIN bisa ditebak dalam hitungan menit. Kunci 30 detik + penghitung per pengguna adalah kontrol wajib. |
| 4 | **CSRF pada aksi destruktif (C1)** — hapus akun, hapus data, ubah PIN | Cookie otomatis terkirim lintas situs; tanpa pemeriksaan Origin, satu kunjungan ke situs jahat bisa menghapus akun korban. |
| 5 | **Pengurasan kuota bersama (W10, A5)** — D1 dan Gemini | Kuota gratis terbatas; satu penyerang bisa menghentikan layanan untuk semua pengguna. Rate limit per pengguna adalah kontrol wajib sejak rilis pertama. |

---

## 7. Catatan dan keputusan yang masih terbuka

1. **Penguat hash PIN.** SHA-256 + salt adalah yang diputuskan di
   `ARCHITECTURE.md` dan cukup untuk rilis pertama karena PIN hanya
   lapisan kedua setelah sesi Google. Namun SHA-256 cepat dihitung,
   sehingga bila hash bocor, PIN 4 digit bisa ditebak offline dalam
   hitungan detik. Rekomendasi ronde berikutnya: ganti atau lapisi
   dengan fungsi hash yang lambat (PBKDF2 dengan iterasi tinggi,
   atau Argon2 bila tersedia di Workers) dan migrasi hash lama saat
   pengguna berikutnya memverifikasi PIN. Keputusan ini menunggu
   koordinator — dokumen ini tidak mengubah keputusan arsitektur
   yang sudah ada.
2. **Rotasi token sesi.** Masa berlaku 30 hari tanpa rotasi berarti
   token curian berlaku lama. Rekomendasi: rotasi token pada setiap
   verifikasi PIN berhasil dan perpanjangan geser (sliding) dengan
   batas maksimum absolut.
3. **Jejak audit.** Log Worker saat ini minimal. Bila jumlah pengguna
   tumbuh, pertimbangkan tabel audit terpisah untuk aksi sensitif
   (hapus akun, ubah PIN, keluar dari semua sesi).
4. **Pembersihan sesi kedaluwarsa.** Perlu tugas berkala (Cron
   Trigger Worker atau pembersihan oportunistik) agar tabel
   `sessions` tidak membengkak.
5. **Sinkron APK (fase berikutnya).** Endpoint sinkron APK akan
   menambah permukaan serangan baru (token sinkron, konflik data)
   dan membutuhkan pembaruan model ancaman ini sebelum dibangun.

---

## 8. Changelog dokumen

| Tanggal | Perubahan |
|---|---|
| 17 Nov 2026 | Dokumen awal: aset, penyerang, STRIDE per komponen (frontend, Worker, D1, KV, OAuth, PIN, sesi, AI, CSRF/CORS), 5 ancaman terbesar |
