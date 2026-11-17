# docs/notifikasi.md: Rancangan Notifikasi Web Push — Dokter HP Web App

> **Status: RANCANGAN SAJA.**
>
> Dokumen ini adalah rancangan notifikasi web untuk Dokter HP Web App.
> **Implementasi notifikasi adalah gelombang berikutnya** — belum ada
> kode, belum ada kunci, dan belum ada tabel yang dibuat berdasarkan
> dokumen ini. Tim implementasi gelombang berikutnya memakai dokumen
> ini sebagai acuan, lalu menulis kode dan migrasi di gelombang itu.
>
> Bahasa: Bahasa Indonesia. Tanggal: 17 November 2026.
>
> Dokumen ini tidak memuat secret atau kunci apa pun. Pasangan kunci
> VAPID proyek ini dibuat nanti, khusus untuk proyek ini, mengikuti
> langkah di bagian 7. Kunci proyek lain tidak pernah dipakai atau
> disalin ke proyek ini.

---

## 1. Tujuan

Notifikasi web memberi tahu pengguna bila skor kesehatan HP-nya
menurun, supaya pengguna membuka aplikasi dan melihat apa yang
berubah. Fitur ini adalah padanan web dari rencana notifikasi di
APK v2 (notifikasi bila skor kesehatan turun).

Satu-satunya pemicu notifikasi pada rancangan ini: **skor kesehatan
turun**. Tidak ada notifikasi promosi, pengingat umum, atau pesan
pemasaran.

Prinsip yang dipegang:

1. **Izin hanya atas permintaan pengguna.** Browser tidak pernah
   diminta izin notifikasi secara otomatis saat halaman dibuka.
   Permintaan izin muncul hanya setelah pengguna menekan tombol
   pengingat (lihat bagian 5).
2. **Satu notifikasi per hari per pengguna, paling banyak.** Skor
   yang turun berulang kali dalam satu hari tidak membanjiri
   pengguna dengan banyak notifikasi.
3. **Tanpa data sensitif di payload.** Isi notifikasi hanya pesan
   umum dan ajakan membuka aplikasi. Nilai skor, nama, alamat email,
   dan detail perangkat tidak pernah dikirim di payload (lihat
   bagian 6).
4. **Mudah dimatikan.** Pengguna bisa berhenti berlangganan dari
   Pengaturan kapan saja, dan langganan yang sudah kedaluwarsa
   dibersihkan otomatis oleh server.
5. **Jujur soal batasan.** Notifikasi web hanya bekerja di browser
   yang mendukung Web Push. Di perangkat yang tidak mendukung,
   tombol pengingat menampilkan penjelasan jujur, bukan janji
   yang tidak bisa ditepati.

---

## 2. Cara kerja Web Push dan VAPID (penjelasan singkat)

Web Push adalah cara server mengirim pesan singkat ke browser
pengguna meskipun aplikasi web sedang tidak dibuka. Alurnya:

1. Pengguna menekan tombol pengingat di aplikasi, lalu menyetujui
   permintaan izin notifikasi dari browser.
2. Browser membuat **langganan push** (push subscription): sebuah
   alamat endpoint unik di layanan push milik penyedia browser
   (misalnya layanan push Google untuk Chrome, layanan push
   Mozilla untuk Firefox) beserta dua kunci enkripsi milik
   langganan itu (`p256dh` dan `auth`).
3. Browser mengirim langganan itu ke Worker API, yang menyimpannya
   di tabel `push_subscriptions` di D1.
4. Saat skor pengguna turun, Worker mengirim pesan terenkripsi ke
   endpoint langganan tersebut. Layanan push meneruskan pesan ke
   browser, dan **service worker** aplikasi menampilkan notifikasi
   di perangkat pengguna.

**VAPID** (Voluntary Application Server Identification for Web Push)
adalah pasangan kunci (kunci publik dan kunci privat) yang
mengidentifikasi server aplikasi kepada layanan push:

- **Kunci publik VAPID** dipakai browser saat membuat langganan
  (sebagai `applicationServerKey`). Kunci publik boleh ada di
  kode frontend karena sifatnya publik — tetapi tetap dibuat
  khusus untuk proyek ini, bukan dipakai dari proyek lain.
- **Kunci privat VAPID** dipakai Worker untuk menandatangani
  setiap pengiriman push. Kunci privat hanya tersimpan sebagai
  secret Worker dan tidak pernah ada di browser, di repo, atau
  di dokumen mana pun.
- Setiap pengiriman push juga mencantumkan identitas pengirim
  (alamat kontak proyek, misalnya alamat email proyek) sebagai
  klaim `sub` VAPID, supaya layanan push tahu siapa yang
  mengirim bila ada masalah.

Payload push dienkripsi ujung-ke-ujung antara Worker dan browser
(standar `aes128gcm`, RFC 8291): layanan push hanya meneruskan
pesan terenkripsi dan tidak bisa membaca isinya.

**Batasan yang perlu diketahui:**

- Chrome di Android mendukung Web Push penuh — ini perangkat
  utama pengguna Dokter HP.
- Safari di iOS mendukung Web Push mulai iOS 16.4, dan hanya
  bila aplikasi web sudah ditambahkan ke layar utama (Add to
  Home Screen). Pengguna iOS yang hanya membuka lewat tab
  Safari tidak akan menerima notifikasi.
- Bila browser tidak mendukung Push API atau Notification API,
  tombol pengingat dinonaktifkan dengan penjelasan.

---

## 3. Tabel langganan di D1

### 3.1 `push_subscriptions`

Satu baris per langganan push (satu pengguna bisa punya beberapa
langganan bila memakai beberapa perangkat atau browser).

```sql
-- Migrasi gelombang implementasi (contoh nama file:
-- migrations/0002_push_subscriptions.sql).
-- Tabel ini BELUM dibuat; SQL di bawah adalah rancangan.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions (user_id);
```

| Kolom | Keterangan |
|---|---|
| `id` | UUID v4, dibuat Worker (`crypto.randomUUID()`), sama seperti tabel lain |
| `user_id` | Pemilik langganan; mengacu ke `users.id`; ikut terhapus saat akun dihapus (cascade) |
| `endpoint` | Alamat endpoint langganan dari layanan push browser; unik — satu endpoint hanya tersimpan sekali |
| `p256dh` | Kunci publik enkripsi langganan (dari objek subscription browser) |
| `auth` | Kunci rahasia autentikasi langganan (dari objek subscription browser) |
| `dibuat_pada` | Waktu langganan dibuat (TEXT ISO 8601, UTC) |

Catatan:

- Kolom `p256dh` dan `auth` adalah kunci milik langganan browser,
  bukan kunci proyek. Nilainya dikirim browser saat berlangganan
  dan dipakai Worker untuk mengenkripsi payload ke langganan itu.
- Bila pengguna yang sama berlangganan ulang dari perangkat yang
  sama, endpoint biasanya sama — Worker memperbarui baris yang
  ada (`INSERT ... ON CONFLICT(endpoint) DO UPDATE`) daripada
  membuat duplikat.
- `user_agent` tidak disimpan di tabel ini pada rancangan awal;
  tim implementasi boleh menambahkan kolom itu bila diperlukan
  untuk menampilkan daftar perangkat di Pengaturan.

### 3.2 Pencatatan pengiriman (anti-duplikat)

Supaya satu penurunan skor tidak mengirim notifikasi berkali-kali,
Worker mencatat setiap pengiriman yang berhasil. Rancangan
minimal: tabel kecil `notifikasi_terkirim`:

```sql
CREATE TABLE IF NOT EXISTS notifikasi_terkirim (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  health_check_id TEXT NOT NULL REFERENCES health_checks (id) ON DELETE CASCADE,
  dikirim_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, health_check_id)
);
```

Satu pemeriksaan (`health_check_id`) hanya boleh memicu satu
notifikasi per pengguna. Pemeriksaan harian (bagian 4.3) melewati
pemeriksaan yang sudah tercatat di tabel ini.

---

## 4. Endpoint Worker

Basis URL sama dengan API lain (lihat `ARCHITECTURE.md` bagian 3).
Semua respons memakai envelope JSON standar proyek. Endpoint
berlangganan memakai cookie sesi yang sama (`dokter_hp_session`).

### 4.1 Daftar endpoint

| Method | Path | Auth | Kegunaan |
|---|---|---|---|
| POST | `/api/notifikasi/langganan` | 🔒 (sesi) | Menyimpan langganan push baru |
| DELETE | `/api/notifikasi/langganan` | 🔒 (sesi) | Menghapus langganan push |
| — (Cron Trigger) | — | Internal Worker | Pemeriksaan harian skor turun dan pengiriman push |

Catatan penamaan: path memakai awalan `/api/notifikasi/...`
sesuai penugasan rancangan ini. Bila tim implementasi memutuskan
awalan path API yang berbeda saat gelombang implementasi, kedua
endpoint di atas mengikuti keputusan akhir itu dan dokumen ini
diperbarui.

### 4.2 POST `/api/notifikasi/langganan` — berlangganan

Menyimpan (atau memperbarui) langganan push milik pengguna yang
masuk.

**Request** (JSON):

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

Nilai di atas adalah bentuk objek `PushSubscription` dari browser
(`subscription.toJSON()`); contoh endpoint di atas hanya ilustrasi
bentuk, bukan nilai nyata.

**Perilaku Worker:**

1. Verifikasi sesi; tolak bila tidak ada sesi valid (401).
2. Validasi payload: `endpoint` wajib URL HTTPS yang valid,
   `keys.p256dh` dan `keys.auth` wajib string tidak kosong.
   Panjang maksimum dibatasi (endpoint 2.000 karakter, tiap kunci
   256 karakter).
3. Simpan ke `push_subscriptions` dengan `user_id` dari sesi.
   Bila endpoint sudah ada milik pengguna yang sama, perbarui
   kunci dan waktu. Bila endpoint sudah ada milik pengguna lain
   (jarang, tetapi mungkin bila perangkat berpindah akun), pindah
   kepemilikan ke pengguna yang masuk saat ini.
4. Rate limit: mengikuti batas endpoint tulis umum (60/menit per
   pengguna, lihat `ARCHITECTURE.md` bagian 6.1).

**Response sukses** (201 bila baru, 200 bila diperbarui):

```json
{ "success": true, "data": { "berlangganan": true }, "meta": { "timestamp": "..." } }
```

### 4.3 DELETE `/api/notifikasi/langganan` — berhenti berlangganan

Menghapus langganan push milik pengguna yang masuk.

**Request** (JSON, salah satu bentuk):

```json
// Menghapus satu langganan (endpoint dari browser saat ini)
{ "endpoint": "https://fcm.googleapis.com/fcm/send/..." }

// Atau menghapus semua langganan pengguna (tanpa body / semua=true)
{ "semua": true }
```

**Perilaku Worker:**

1. Verifikasi sesi; tolak bila tidak ada sesi valid (401).
2. Bila `endpoint` diberikan: hapus baris dengan endpoint itu
   **dan** `user_id` dari sesi (pengguna tidak bisa menghapus
   langganan pengguna lain).
3. Bila `semua` bernilai benar: hapus seluruh langganan milik
   pengguna yang masuk.
4. Frontend juga memanggil `subscription.unsubscribe()` di browser
   setelah respons sukses, supaya browser berhenti menerima push
   untuk langganan itu.

**Response sukses** (200):

```json
{ "success": true, "data": { "berlangganan": false }, "meta": { "timestamp": "..." } }
```

### 4.4 Pemicu kirim: Cron Trigger Worker harian

Pengiriman push **tidak** terjadi langsung saat skor disimpan.
Sebagai gantinya, Worker memakai **Cron Trigger** (jadwal
terjadwal di Cloudflare Workers) yang berjalan sekali sehari dan
memeriksa pemeriksaan kesehatan terbaru setiap pengguna.

**Konfigurasi (wrangler.toml, rancangan):**

```toml
[triggers]
crons = ["0 1 * * *"]  # Sekali sehari, 01:00 UTC (08:00 WIB).
```

Jadwal 08:00 WIB dipilih supaya notifikasi tiba di pagi hari,
bukan tengah malam. Jadwal persis diputuskan tim implementasi.

**Alur handler terjadwal (`scheduled`):**

1. Ambil daftar pengguna yang memiliki minimal satu langganan
   aktif di `push_subscriptions`.
2. Untuk tiap pengguna, ambil dua `health_checks` terbaru miliknya
   (yang belum soft-delete, `deleted_at IS NULL`), diurutkan dari
   terbaru.
3. Tentukan apakah skor turun, dengan aturan:
   - Pemeriksaan terbaru dibuat dalam 24 jam terakhir (data lama
     tidak memicu notifikasi — skor yang sudah berhari-hari tidak
     diperiksa bukan kabar baru).
   - Skor terbaru **turun sedikitnya 10 poin** dibanding
     pemeriksaan sebelumnya, ATAU kategori berubah memburuk
     (Baik → Cukup, Baik → Perlu perhatian, Cukup → Perlu
     perhatian).
   - Pemeriksaan terbaru belum pernah memicu notifikasi (belum
     tercatat di `notifikasi_terkirim`).
4. Bila aturan terpenuhi, kirim push ke semua langganan aktif
   pengguna itu (lihat bagian 6 untuk isi pesan).
5. Catat pengiriman di `notifikasi_terkirim` setelah minimal satu
   langganan berhasil dikirimi.
6. Bila layanan push menjawab 404 atau 410 untuk sebuah endpoint,
   langganan itu sudah kedaluwarsa atau dicabut — hapus barisnya
   dari `push_subscriptions`. Bila menjawab 429, hentikan
   pengiriman dan coba lagi pada jadwal berikutnya (jangan
   membanjiri layanan push).

**Batas pengiriman:** paling banyak satu notifikasi per hari per
pengguna (dijamin oleh aturan langkah 3: hanya pemeriksaan
terbaru dalam 24 jam terakhir yang dinilai, dan setiap
pemeriksaan hanya memicu sekali).

**Kebutuhan teknis di Worker:**

- Kunci privat VAPID dibaca dari secret Worker (bagian 7).
- Payload dienkripsi per langganan (`aes128gcm`). Tim
  implementasi memakai pustaka push yang sudah teruji dan
  kompatibel dengan Workers (misalnya `web-push`), atau
  implementasi enkripsi mandiri yang teruji — keputusan di
  gelombang implementasi.
- Pengiriman dilakukan berurutan dengan jeda singkat antar
  langganan bila jumlah pengguna besar, supaya tidak membanjiri
  layanan push dalam satu detik.

---

## 5. Alur izin di browser

Aturan produk yang tidak bisa ditawar: **izin notifikasi tidak
pernah diminta otomatis saat halaman dibuka.** Permintaan izin
hanya muncul setelah pengguna menekan tombol.

### 5.1 Di mana tombolnya

Tombol pengingat ada di halaman **Pengaturan** (`/pengaturan`),
di bagian notifikasi, dengan label yang jelas:

- Judul bagian: "Pengingat skor turun"
- Penjelasan: "Aktifkan supaya aplikasi memberi tahu Anda bila
  skor kesehatan HP turun."
- Tombol: "Aktifkan pengingat"

Tombol hanya tampil bila pengguna sudah masuk (langganan
disimpan per akun). Pengguna tanpa akun melihat penjelasan bahwa
pengingat butuh akun.

### 5.2 Langkah alur

1. Pengguna membuka Pengaturan dan menekan **"Aktifkan
   pengingat"**.
2. Frontend memeriksa dukungan browser:
   - Bila `Notification` atau `PushManager` tidak tersedia,
     tampilkan pesan jujur: "Browser ini belum mendukung
     notifikasi. Coba buka dengan Chrome di HP Android."
     dan berhenti — tidak ada permintaan izin.
   - Bila service worker belum terdaftar, daftarkan dulu
     (`navigator.serviceWorker.register('/sw.js')`).
3. Frontend memanggil `Notification.requestPermission()` —
   **hanya di titik ini**, sebagai respons langsung atas ketukan
   pengguna. Browser menampilkan dialog izin bawaan.
4. Bila pengguna menyetujui (`granted`):
   - Frontend membuat langganan lewat
     `pushManager.subscribe({ userVisibleOnly: true,
     applicationServerKey: <kunci publik VAPID> })`.
   - Frontend mengirim langganan ke
     `POST /api/notifikasi/langganan`.
   - Tombol berubah menjadi "Matikan pengingat" dengan status
     "Pengingat aktif".
5. Bila pengguna menolak (`denied`):
   - Tampilkan pesan: "Izin notifikasi ditolak. Bila berubah
     pikiran, aktifkan notifikasi untuk situs ini dari
     pengaturan browser." Tidak ada permintaan ulang otomatis.
   - Tombol kembali ke "Aktifkan pengingat"; menekan lagi akan
     menampilkan pesan yang sama (browser tidak menampilkan
     dialog kedua bila sudah ditolak — pengguna harus mengubah
     izin dari pengaturan browser).
6. Bila pengguna menutup dialog tanpa memilih (`default`):
   - Tampilkan pesan netral dan biarkan tombol tetap
     "Aktifkan pengingat" untuk dicoba lagi nanti.

### 5.3 Mematikan pengingat

1. Pengguna menekan **"Matikan pengingat"** di Pengaturan.
2. Frontend memanggil `DELETE /api/notifikasi/langganan`
   (dengan endpoint langganan saat ini), lalu memanggil
   `subscription.unsubscribe()` di browser.
3. Tombol kembali menjadi "Aktifkan pengingat" dengan status
   "Pengingat tidak aktif".

### 5.4 Status yang ditampilkan

Pengaturan menampilkan satu dari tiga status (berdasarkan
`Notification.permission` dan respons API):

| Status | Arti | Tampilan |
|---|---|---|
| Aktif | Langganan tersimpan dan izin diberikan | "Pengingat aktif" + tombol "Matikan pengingat" |
| Tidak aktif | Belum berlangganan | "Pengingat tidak aktif" + tombol "Aktifkan pengingat" |
| Diblokir | Izin ditolak di browser | "Izin notifikasi diblokir di browser" + arahan ke pengaturan browser |

### 5.5 Service worker

File `public/sw.js` (dibuat di gelombang implementasi) menangani:

- Peristiwa `push`: menampilkan notifikasi dari payload yang
  diterima (judul, isi, ikon).
- Peristiwa `notificationclick`: membuka atau memfokuskan tab
  aplikasi ke `/dashboard` saat notifikasi diketuk, lalu menutup
  notifikasi.

Service worker hanya didaftarkan setelah pengguna mengaktifkan
pengingat, atau saat aplikasi dibuka bila pengguna sudah
berlangganan (supaya push tetap bisa diterima). Service worker
tidak melakukan pekerjaan lain di rancangan ini.

---

## 6. Pesan notifikasi

### 6.1 Aturan isi

- Bahasa Indonesia, netral dan profesional.
- **Tanpa data sensitif di payload**: tidak ada nilai skor, nama,
  alamat email, detail perangkat, atau isi diagnosis. Payload
  hanya berisi pesan umum dan alamat tujuan saat diketuk.
- Satu pesan untuk semua pengguna yang skornya turun (tidak ada
  personalisasi di payload). Detail skor dilihat pengguna setelah
  membuka aplikasi dan masuk.
- Notifikasi tidak berisi tombol aksi selain membuka aplikasi
  (rancangan awal; tombol aksi tambahan dipertimbangkan di
  gelombang berikutnya bila dibutuhkan).

### 6.2 Teks notifikasi

| Bagian | Isi |
|---|---|
| Judul | `Dokter HP` |
| Isi | `Skor kesehatan HP Anda turun. Ketuk untuk melihat detailnya.` |
| Ikon | Ikon aplikasi Dokter HP |
| Tujuan ketuk | `/dashboard` |

### 6.3 Bentuk payload (yang dikirim Worker)

```json
{
  "title": "Dokter HP",
  "body": "Skor kesehatan HP Anda turun. Ketuk untuk melihat detailnya.",
  "url": "/dashboard"
}
```

Payload dienkripsi sebelum dikirim ke layanan push. Tidak ada
field lain di payload pada rancangan ini.

### 6.4 Pesan yang TIDAK dikirim

- Skor tidak dikirim ("Skor Anda turun dari 80 ke 65") — detail
  angka hanya tampil di dalam aplikasi setelah pengguna masuk.
- Tidak ada pesan bila skor naik atau tetap — hanya penurunan
  yang diberitahukan.
- Tidak ada pesan pengingat berkala ("sudah lama tidak periksa")
  pada rancangan ini.

---

## 7. Membuat pasangan kunci VAPID baru (nanti, di gelombang implementasi)

Pasangan kunci VAPID khusus proyek Dokter HP Web App dibuat
saat gelombang implementasi dimulai. **Dokumen ini tidak memuat
nilai kunci apa pun** — langkah di bawah hanya perintah dan
tempat penyimpanannya.

### 7.1 Perintah pembuatan

Jalankan sekali di mesin tim implementasi (bukan di repo, bukan
di server):

```bash
npx web-push generate-vapid-keys
```

Perintah ini mencetak sepasang kunci: kunci publik dan kunci
privat. Perintah alternatif yang setara (bila pustaka lain
dipakai) dicatat tim implementasi saat itu.

### 7.2 Tempat menyimpan

| Kunci | Sifat | Tempat menyimpan |
|---|---|---|
| Kunci privat VAPID | Secret — tidak pernah ke browser atau repo | Secret Worker: `wrangler secret put VAPID_PRIVATE_KEY` (nilai ditempel saat perintah dijalankan, tidak dicatat di file mana pun) |
| Kunci publik VAPID | Publik — boleh ada di frontend | Variabel lingkungan build frontend: `VITE_VAPID_PUBLIC_KEY` (diatur di dashboard Cloudflare Pages dan Vercel, bukan di repo) |
| Alamat kontak VAPID (`sub`) | Publik | Nilai tetap di kode Worker, misalnya alamat email proyek (diputuskan tim implementasi; bukan alamat pribadi) |

### 7.3 Aturan yang mengikat

- Pasangan kunci dibuat baru khusus untuk proyek ini. Kunci
  proyek lain (termasuk kunci VAPID proyek Karir) tidak pernah
  dipakai, disalin, atau dirujuk.
- Kunci privat tidak pernah ditulis di dokumen, di chat, di
  `wrangler.toml`, di variabel lingkungan frontend (`VITE_*`),
  atau di file mana pun di repo.
- Bila kunci privat diduga bocor: buat pasangan baru, perbarui
  secret Worker dan variabel build frontend, lalu deploy ulang.
  Langganan lama yang dibuat dengan kunci publik lama menjadi
  tidak valid dan pengguna perlu mengaktifkan ulang pengingat
  (aplikasi mendeteksi ini saat langganan gagal dan menampilkan
  tombol aktifkan ulang).
- Satu pasangan kunci untuk kedua mirror (Pages dan Vercel),
  karena keduanya memakai Worker API yang sama.

---

## 8. Kriteria selesai (untuk gelombang implementasi)

Kriteria ini adalah target gelombang berikutnya, bukan klaim
saat ini:

- [ ] Migrasi `push_subscriptions` dan `notifikasi_terkirim`
      diterapkan ke D1.
- [ ] `POST /api/notifikasi/langganan` menyimpan langganan dan
      menolak payload tidak valid serta request tanpa sesi.
- [ ] `DELETE /api/notifikasi/langganan` menghapus langganan
      milik pengguna dan tidak bisa menghapus milik pengguna lain.
- [ ] Cron Trigger harian berjalan; pengguna dengan skor turun
      ≥ 10 poin (atau turun kategori) dalam 24 jam terakhir
      menerima tepat satu notifikasi.
- [ ] Pengguna dengan skor naik, tetap, atau tanpa pemeriksaan
      baru tidak menerima notifikasi.
- [ ] Langganan kedaluwarsa (jawaban 404/410 dari layanan push)
      dibersihkan otomatis dari D1.
- [ ] Izin notifikasi hanya diminta setelah pengguna menekan
      tombol — tidak ada prompt otomatis saat halaman dibuka
      (diuji di browser HP).
- [ ] Payload notifikasi tidak memuat nilai skor, nama, email,
      atau detail perangkat (diperiksa dari isi pesan yang
      dikirim).
- [ ] Mengetuk notifikasi membuka `/dashboard`.
- [ ] Mematikan pengingat menghapus langganan dari server dan
      browser.
- [ ] Menghapus akun ikut menghapus seluruh langganan dan catatan
      pengiriman pengguna (cascade).
- [ ] Kunci privat VAPID hanya ada sebagai secret Worker; tidak
      ada di repo, bundle frontend, atau dokumen.
- [ ] Uji di browser HP Android (Chrome): langganan, kirim,
      ketuk, dan berhenti berlangganan semuanya bekerja.

---

## 9. Hal yang masih terbuka (diputuskan di gelombang implementasi)

1. **Pustaka pengiriman push di Worker**: `web-push` atau
   implementasi mandiri yang kompatibel dengan runtime Workers.
2. **Jadwal Cron persis**: rancangan memakai 01:00 UTC
   (08:00 WIB); jadwal akhir diputuskan tim implementasi.
3. **Ambang penurunan**: rancangan memakai 10 poin atau turun
   kategori; angka akhir boleh disesuaikan setelah uji awal.
4. **Alamat kontak VAPID (`sub`)**: alamat email proyek yang
   dipakai sebagai identitas pengirim.
5. **Kolom tambahan**: `user_agent` di `push_subscriptions`
   bila Pengaturan perlu menampilkan daftar perangkat.

---

## 10. Changelog dokumen

### 17 November 2026 — Rancangan awal (Tim Notifikasi Web Push)

- Rancangan notifikasi web pertama: cara kerja Web Push + VAPID,
  tabel `push_subscriptions` dan `notifikasi_terkirim`,
  endpoint langganan, pemicu Cron harian, alur izin atas
  permintaan pengguna, teks pesan, dan langkah pembuatan kunci
  VAPID baru. Implementasi adalah gelombang berikutnya.
