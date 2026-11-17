# Sinkronisasi APK ↔ Web App — Rancangan Fase Berikutnya

> **Status: rancangan, belum diimplementasikan.**
> Bahasa: Bahasa Indonesia. Tanggal: 17 November 2026.
>
> Sinkron otomatis APK → web adalah **fase berikutnya** dan membutuhkan
> perubahan di APK. Rilis web pertama **tidak menjanjikan** sinkron
> otomatis — sampai rancangan ini diimplementasikan, data APK masuk ke
> web lewat input manual pengguna (lihat `PRODUCT.md` bagian 7.8 dan
> `ARCHITECTURE.md` bagian 9 butir 5).
>
> Dokumen ini adalah rancangan yang siap diimplementasikan nanti: pemetaan
> kolom, kontrak endpoint, aturan konflik, mesin status, soft-delete dua
> arah, autentikasi perangkat, batas batch, dan daftar perubahan APK.
> Dokumen ini tidak berisi kode APK.

---

## 1. Ringkasan arsitektur sinkron

| Aspek | Keputusan |
|---|---|
| Arah | Dua arah: **push** (APK → server) lalu **pull** (server → APK) |
| Sumber kebenaran | Server (D1) untuk baris yang sudah diterima; database lokal (Drift) tetap sumber kebenaran untuk tampilan saat offline |
| Identitas pemilik data | `user_id` selalu berasal dari token perangkat yang terverifikasi server — client tidak pernah mengirim `user_id` |
| Kunci baris | `id` lokal APK (`hc-…` / `wr-…`) dipakai langsung sebagai `id` di D1 (kolom D1 bertipe TEXT, bukan UUID Postgres) sehingga push bisa upsert berdasarkan `id` |
| Deteksi perubahan | `updated_at` (jam perangkat) untuk resolusi konflik; `diterima_pada` (jam server, baru — lihat bagian 7) untuk urutan pull |
| Penghapusan | Soft-delete dua arah lewat `deleted_at`; tidak ada hard-delete lewat sinkron |
| Idempotensi | `idempotency_key` per batch push; pengiriman ulang kunci yang sama mengembalikan respons tersimpan tanpa menulis ulang |
| Pemicu sinkron | Aplikasi dibuka, setelah pemeriksaan disimpan, setelah perangkat dipasangkan, tombol "Sinkronkan sekarang", dan saat kembali online |
| Prinsip kegagalan | Sinkron tidak pernah memblokir UI dan tidak pernah menggagalkan pemakaian aplikasi; kegagalan dicatat dan dicoba lagi nanti |

Urutan dalam satu putaran sinkron: **push dulu, pull kemudian**. Urutan
ini memastikan tombstone (penghapusan) lokal tidak tertimpa oleh pull
yang mengambil versi lama dari server.

---

## 2. Pemetaan kolom Drift (APK) ↔ D1 (web)

### 2.1 `health_checks`

| Drift (APK, `tables.dart`) | D1 (web, `ARCHITECTURE.md` §5) | Transformasi / aturan |
|---|---|---|
| `id` TEXT (`hc-<microseconds>`) | `id` TEXT PK | Dikirim apa adanya. Karena D1 memakai TEXT (bukan `uuid` Postgres), id lokal bisa menjadi kunci upsert — ini menyelesaikan masalah baris ganda yang dicatat di `supabase_sync_service.dart` (jalur Supabase lama tidak mengirim `id` sehingga retry bisa membuat duplikat). |
| — (tidak ada kolom pemilik di lokal) | `user_id` TEXT NOT NULL | Diisi server dari token perangkat. Client tidak mengirim field ini. |
| `score` INTEGER 0–100 | `skor` INTEGER | Langsung; server memvalidasi rentang 0–100. |
| `category` TEXT (`baik` / `cukup` / `buruk`) | `ringkasan` TEXT JSON, kunci `kategori` | Tidak ada kolom kategori di D1; kategori masuk ke objek JSON `ringkasan` (perilaku `_ringkasanJson` yang sudah ada dipertahankan). |
| `summary` TEXT? | `ringkasan` TEXT JSON, kunci `teks` (atau objek apa adanya) | Bila teks summary sudah berupa objek JSON, objek itu dipakai apa adanya; bila tidak, teks dibungkus sebagai `{"teks": "...", "kategori": "..."}`. Perilaku yang sudah ada di `_ringkasanJson` dipertahankan. |
| `createdAt` DATETIME | `dibuat_pada` TEXT ISO 8601 | `toIso8601String()` (UTC). Tidak berubah setelah baris dibuat (lihat bagian 4). |
| `updatedAt` DATETIME | `updated_at` TEXT ISO 8601 | `toIso8601String()` (UTC). Dipakai untuk resolusi konflik last-write-wins. |
| `deletedAt` DATETIME? | `deleted_at` TEXT | Tombstone soft-delete; `null` = aktif. Dikirim dalam push (lihat bagian 6). |
| `syncStatus` TEXT (`pending` / `synced` / `local_only`) | `sync_status` TEXT (`pending` / `synced` / `failed`) | Hanya bermakna di perangkat. Server mengabaikan nilai dari client dan menyimpan `synced` untuk baris hasil push. Nilai `local_only` tidak pernah dikirim ke server (lihat bagian 5). |

Tidak ada kolom D1 `health_checks` yang tidak terpetakan.

### 2.2 `wifi_reports`

| Drift (APK, `tables.dart`) | D1 (web, `ARCHITECTURE.md` §5) | Transformasi / aturan |
|---|---|---|
| `id` TEXT (`wr-<microseconds>`) | `id` TEXT PK | Dikirim apa adanya; kunci upsert (sama seperti `health_checks`). |
| — | `user_id` TEXT NOT NULL | Diisi server dari token perangkat. |
| `ssid` TEXT? | `ssid` TEXT | Langsung. |
| `downloadKbps` REAL? | `kecepatan_unduh_kbps` REAL | **Langsung, tanpa pembagian.** Nilai lokal memang sudah KB/detik (byte/detik dibagi 1024 — lihat `WifiService.measureDownloadSpeed`). |
| *(kolom baru, lihat bagian 11)* `linkSpeedMbps` | `kecepatan_koneksi_mbps` REAL | Kecepatan koneksi (link speed) dari `DeviceNative.wifiLinkSpeedMbps()`. Nilai ini sudah dibaca aplikasi tetapi saat ini tidak disimpan ke database — kolom lokal baru wajib ditambahkan. **Pemetaan lama (`downloadKbps / 128` → `kecepatan_koneksi_mbps`) dihentikan**: kecepatan unduh terukur dan kecepatan koneksi adalah dua besaran berbeda, dan pembagian itu mencampurnya. Sampai kolom baru ada, field ini dikirim `null`. |
| `rssiDbm` INTEGER? | `kekuatan_sinyal` TEXT | Label lewat `signalLabel()` yang sudah ada (`lemah` / `sedang` / `kuat`). |
| `rssiDbm` INTEGER? | `rssi_dbm` INTEGER *(kolom D1 baru, bagian 7)* | Nilai dBm mentah dipertahankan agar tidak ada informasi yang hilang dalam konversi ke label. |
| `channel` INTEGER? | `channel` INTEGER | Langsung. |
| *(kolom baru, lihat bagian 11)* `dns` | `dns` TEXT | Server DNS pertama dari `DeviceNative.dnsServers()`. Nilai ini sudah dibaca aplikasi tetapi saat ini tidak disimpan ke database. |
| `pingMs` INTEGER? | `ping_ms` INTEGER | Langsung (latensi HTTP, bukan ICMP). |
| `recommendation` TEXT? | `rekomendasi` TEXT | Langsung. |
| `createdAt` DATETIME | `dibuat_pada` TEXT ISO 8601 | UTC. Tidak berubah setelah dibuat. |
| `updatedAt` DATETIME | `updated_at` TEXT ISO 8601 | UTC. Dipakai untuk resolusi konflik. |
| `deletedAt` DATETIME? | `deleted_at` TEXT | Tombstone soft-delete; dikirim dalam push. |
| `syncStatus` TEXT | `sync_status` TEXT *(kolom D1 baru, bagian 7)* | D1 `wifi_reports` saat ini **belum punya** kolom `sync_status` (berbeda dengan `health_checks` yang sudah punya). Kolom ini ditambahkan di migrasi sinkron agar kedua tabel simetris. Server menyimpan `synced` untuk baris hasil push. |
| — | `sumber` TEXT (`web` / `apk` / `manual`) | Server mengisi `apk` untuk semua baris hasil push. Client tidak mengirim field ini. |
| — | `durasi_tes_detik` INTEGER | `null` untuk laporan APK (APK tidak menyimpan durasi tes ke database). Bila APK kelak menyimpan durasi tes bertahan, nilai itu dikirim. |

### 2.3 Tabel yang tidak disinkronkan di fase ini

| Tabel | Alasan |
|---|---|
| `profiles` | Profil dikelola lewat akun web / Google; APK tidak membutuhkan salinannya. |
| `ai_diagnoses` | Diagnosis AI dibuat dan disimpan di server; riwayat AI tidak turun ke APK di fase ini. |
| `users`, `sessions` | Hanya untuk web; APK memakai token perangkat (bagian 8), bukan sesi web. |
| `wifi_sustained_samples` | Sampel per detik tes bertahan 30 detik hanya ada di web; APK tidak menyimpan sampel ke database. Bila kelak APK menyimpan sampel, pemetaan ditambahkan sebagai perpanjangan rancangan ini. |

---

## 3. Endpoint sinkron (Worker API)

Basis URL sama dengan API web (`ARCHITECTURE.md` bagian 3). Semua
endpoint sinkron memakai envelope JSON standar yang sama (`success` /
`data` / `error`) dan autentikasi token perangkat (bagian 8) lewat
header:

```
Authorization: Bearer <token perangkat>
```

Token perangkat **hanya** berlaku untuk rute `/api/sync/*` — tidak
bisa dipakai untuk endpoint web lain (`/health-checks`,
`/wifi-reports`, `/ai/*`, `/account/*`).

### 3.1 `POST /api/sync/push` — kirim batch perubahan lokal

**Request** (JSON):

```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
  "health_checks": [
    {
      "id": "hc-1730000000000000",
      "skor": 82,
      "ringkasan": {"kategori": "baik", "teks": "..."},
      "dibuat_pada": "2026-11-17T10:00:00.000Z",
      "updated_at": "2026-11-17T10:00:00.000Z",
      "deleted_at": null
    }
  ],
  "wifi_reports": [
    {
      "id": "wr-1730000000000001",
      "ssid": "ACHA",
      "kecepatan_unduh_kbps": 512.5,
      "kecepatan_koneksi_mbps": 65,
      "kekuatan_sinyal": "kuat",
      "rssi_dbm": -45,
      "channel": 6,
      "dns": "192.168.1.1",
      "ping_ms": 24,
      "rekomendasi": "...",
      "dibuat_pada": "2026-11-17T10:05:00.000Z",
      "updated_at": "2026-11-17T10:05:00.000Z",
      "deleted_at": null
    }
  ]
}
```

Aturan request:

- `idempotency_key` wajib: UUID v4 yang dibuat client sekali per batch.
  Pengiriman ulang dengan kunci yang sama mengembalikan respons
  tersimpan tanpa menulis ulang (lihat bawah).
- Total baris (`health_checks` + `wifi_reports`, termasuk tombstone)
  maksimal **50 per request** (bagian 9). Lebih dari itu → HTTP 400
  dengan kode `BATCH_TOO_LARGE`; client membagi menjadi beberapa batch.
- Baris dengan `deleted_at` terisi adalah tombstone penghapusan dan
  wajib disertakan (bagian 6).
- Client tidak mengirim `user_id`, `sumber`, atau `sync_status` —
  ketiganya ditentukan server.
- Setiap baris divalidasi (tipe, rentang skor 0–100, format ISO 8601,
  panjang teks maksimum). Baris yang tidak valid ditolak per baris
  (bukan menggagalkan seluruh batch) dan dilaporkan di `errors`.

**Response** (HTTP 200):

```json
{
  "success": true,
  "data": {
    "server_timestamp": "2026-11-17T10:10:00.000Z",
    "diterima": ["hc-1730000000000000", "wr-1730000000000001"],
    "konflik": [
      {
        "id": "hc-1730000000000002",
        "tabel": "health_checks",
        "pemenang": "server",
        "baris_server": { "...": "versi server yang menang" }
      }
    ],
    "errors": [
      {"id": "wr-1730000000000003", "tabel": "wifi_reports", "kode": "VALIDASI_GAGAL", "pesan": "..."}
    ]
  }
}
```

- `diterima`: id baris yang berhasil ditulis (insert atau update).
  Client menandai baris-baris ini `synced` (bagian 5).
- `konflik`: baris yang ditolak karena versi server menang (bagian 4);
  client memperbarui salinan lokalnya dengan `baris_server` dan
  menandainya `synced` — tidak perlu pull tambahan untuk baris itu.
- `errors`: baris yang gagal validasi; client menandainya `failed`
  tetapi **tidak** mengulanginya tanpa perubahan (retry buta atas
  galat validasi dilarang — payload harus diperbaiki dulu).

**Idempotensi.** Server menyimpan `idempotency_key` beserta respons
lengkapnya di tabel `sync_batches` (bagian 7) selama 24 jam. Bila
request dengan kunci yang sama datang lagi (misalnya client tidak
menerima respons karena koneksi putus), server mengembalikan respons
tersimpan dengan status yang sama tanpa menulis ulang satu baris pun.
Upsert berdasarkan `id` adalah lapisan kedua: pengiriman ulang tanpa
kunci yang sama pun tidak membuat duplikat, hanya menimpa baris yang
sama.

**Kode status:** 200 (sukses, termasuk bila sebagian baris masuk
`errors`/`konflik`), 400 (`BATCH_TOO_LARGE`, `VALIDASI_GAGAL` untuk
body yang rusak total), 401 (token tidak valid/kedaluwarsa/dicabut),
429 (rate limit), 500 (galat server — client boleh retry dengan kunci
yang sama).

### 3.2 `GET /api/sync/pull` — ambil perubahan sejak timestamp

**Request:**

```
GET /api/sync/pull?since=2026-11-17T10:10:00.000Z&limit=50&cursor=<cursor>
```

- `since`: `server_timestamp` dari pull terakhir (atau dari respons
  push terakhir). Wajib dalam format ISO 8601. Bila dikosongkan, server
  mengembalikan semua baris aktif + tombstone dalam retensi (pull
  penuh — dipakai saat pertama kali sinkron dan setelah offline
  melebihi retensi tombstone, bagian 6).
- `limit`: maksimal 50 (bagian 9); nilai lebih besar dibatasi ke 50.
- `cursor`: kursor paginasi dari respons sebelumnya (opaque, dibuat
  server dari pasangan `diterima_pada` + `id` terakhir).

**Response** (HTTP 200):

```json
{
  "success": true,
  "data": {
    "server_timestamp": "2026-11-17T10:15:00.000Z",
    "health_checks": [ { "...": "baris lengkap termasuk deleted_at bila terhapus" } ],
    "wifi_reports": [ { "...": "baris lengkap" } ],
    "has_more": false,
    "next_cursor": null
  }
}
```

Aturan pull:

- Server mengembalikan baris milik pengguna dengan `diterima_pada`
  (jam server, bagian 7) lebih besar dari `since`, diurutkan
  `diterima_pada` naik lalu `id` naik. Urutan memakai jam server agar
  tidak terpengaruh selisih jam perangkat.
- Tombstone (baris dengan `deleted_at` terisi) ikut dikembalikan agar
  client bisa menerapkan penghapusan dari web (bagian 6).
- Client menyimpan `server_timestamp` dari respons sebagai `since`
  untuk pull berikutnya, dan menerapkannya **hanya setelah** seluruh
  halaman (`has_more: false`) berhasil diterapkan — bila putus di
  tengah paginasi, pull berikutnya mengulang dari `since` lama (aman
  karena penerapan pull bersifat upsert).
- Baris dari web (misalnya hasil tes WiFi web atau input manual)
  diterima client apa adanya, dengan `sumber` dipertahankan agar UI
  APK bisa menampilkan asal datanya bila perlu.

**Kode status:** 200, 400 (`since` tidak valid), 401, 429, 500.

### 3.3 Endpoint pendukung perangkat (ringkas)

| Method | Path | Auth | Kegunaan |
|---|---|---|---|
| POST | `/api/sync/devices/pair` | Publik (kode pairing) | Memulai pairing: mengembalikan kode 6 digit + masa berlaku (lihat bagian 8) |
| GET | `/api/sync/devices/pair/:code/status` | Publik (kode pairing) | APK polling: bila pengguna sudah mengonfirmasi di web, respons berisi token perangkat (sekali saja) |
| POST | `/api/sync/devices/confirm` | 🔒 sesi web | Web mengonfirmasi kode pairing setelah pengguna masuk; server menerbitkan token |
| GET | `/api/sync/devices` | 🔒 sesi web | Daftar perangkat terhubung milik pengguna (nama, terakhir dipakai) untuk halaman Pengaturan web |
| DELETE | `/api/sync/devices/:id` | 🔒 sesi web atau token perangkat itu sendiri | Cabut token perangkat |
| POST | `/api/sync/token/refresh` | Token perangkat | Rotasi token (bagian 8) |

Detail implementasi endpoint pendukung diputuskan tim implementasi
saat fase sinkron dimulai; kontrak push/pull di atas adalah bagian
yang dibekukan rancangan ini.

---

## 4. Aturan konflik

Konflik terjadi bila baris dengan `id` yang sama sudah ada di server
dengan isi berbeda dari yang dikirim client. Pemeriksaan tidak pernah
diedit pengguna setelah dibuat, jadi konflik nyata diperkirakan hampir
tidak ada — tetapi aturannya harus deterministik agar kedua sisi selalu
sepakat.

| Field / aspek | Pemenang | Alasan |
|---|---|---|
| `user_id` | **Server** (dari token) | Client tidak boleh menentukan pemilik data; menerima `user_id` dari client adalah celah keamanan. |
| `id` | Tidak dipertentangkan | Id lokal (`hc-`/`wr-` + microseconds) dan id server (UUID v4) berada di ruang nama yang tidak bertabrakan; id diterima apa adanya dari sisi yang membuat baris. |
| `dibuat_pada` | **Penulis pertama menang** (tidak berubah) | Waktu pemeriksaan adalah fakta sejarah; baris yang sudah ada mempertahankan `dibuat_pada` aslinya, nilai dari push diabaikan. |
| `skor`, `ringkasan`, dan semua field isi `wifi_reports` | **Last-write-wins** berdasarkan `updated_at`; bila `updated_at` sama persis, **server menang** | Pemeriksaan tidak diedit setelah dibuat sehingga konflik isi hampir tidak terjadi; LWW sederhana, deterministik, dan tidak butuh penggabungan per-field yang rumit. Seri diputus ke server agar hasilnya selalu sama di kedua sisi. |
| `deleted_at` (tombstone) | **Hapus menang atas ubah** (delete-wins) | Niat pengguna menghapus harus dihormati; bila satu sisi menghapus sementara sisi lain mengubah baris yang sama, penghapusan menang. Data yang terhapus bisa dibuat ulang dengan pemeriksaan baru, sedangkan data yang "bangkit" dari penghapusan adalah perilaku yang membingungkan dan merusak kepercayaan. Aturan ini tidak bergantung pada jam, jadi kebal terhadap selisih jam perangkat. |
| `sync_status` | **Server** (selalu `synced`) | Status sinkron adalah penanda proses, bukan data pengguna; salinan server selalu dianggap tersinkron karena ia ada di server. |
| `sumber` | **Server** (diisi `apk` untuk push) | Asal baris ditentukan oleh jalur masuknya, bukan klaim client. |

Perilaku saat konflik: server **tidak** mengembalikan galat HTTP.
Push tetap 200; baris yang kalah dicantumkan di `konflik` beserta
versi server yang menang, dan client memperbarui salinan lokalnya
dengan versi itu lalu menandainya `synced`.

Catatan tentang selisih jam: LWW memakai `updated_at` dari jam
perangkat, sehingga jam perangkat yang meleset jauh bisa menyebabkan
vonis yang salah. Risiko ini diterima karena (a) konflik isi hampir
tidak terjadi — baris tidak diedit setelah dibuat, dan (b) aturan
delete-wins yang paling penting tidak bergantung pada jam. Pull tidak
terpengaruh karena memakai `diterima_pada` (jam server).

---

## 5. Mesin status `sync_status`

Status berlaku per baris, di sisi client (APK). Nilai yang dikenal
di kedua sisi:

| Status | Arti | Di sisi mana |
|---|---|---|
| `local_only` | Baris dibuat saat perangkat belum terpasang ke akun (belum ada token perangkat). Tidak pernah dikirim. | APK saja |
| `pending` | Baris menunggu dikirim (baru dibuat, baru diubah, baru dihapus, atau gagal sebelumnya dan akan dicoba lagi). | APK saja (server tidak pernah menyimpan `pending` untuk baris yang diterimanya) |
| `synced` | Server sudah mengonfirmasi penerimaan baris ini. | APK dan D1 |
| `failed` | Push terakhir untuk baris ini gagal (galat jaringan, galat server, atau validasi). Status ini **bukan** status akhir — baris dicoba lagi pada sinkron berikutnya. | APK saja |

Transisi status di APK:

```
baru dibuat (tanpa token perangkat) ──> local_only ──> (perangkat dipasangkan) ──> pending
baru dibuat (dengan token perangkat) ──> pending
pending ──(push sukses, id ada di `diterima`)──> synced
pending ──(push gagal jaringan/server)──> failed ──(sinkron berikutnya)──> pending
pending ──(baris ditolak validasi, ada di `errors`)──> failed (jangan retry buta; payload harus diperbaiki)
synced ──(baris diubah atau dihapus lokal)──> pending
synced ──(baris kalah konflik, versi server diterapkan)──> synced (tetap)
```

Aturan penandaan:

1. Baris ditandai `synced` **hanya** setelah respons push
   mengonfirmasi id-nya di `diterima` (atau di `konflik` dengan versi
   server diterapkan). Mengirim request saja tidak cukup — respons
   bisa hilang di tengah jalan.
2. Bila respons push hilang (timeout/koneksi putus), baris tetap
   `pending`; percobaan berikut mengirim batch yang sama dengan
   `idempotency_key` yang sama sehingga server mengembalikan respons
   tersimpan tanpa duplikasi.
3. Baris `failed` karena galat jaringan/server otomatis dicoba lagi
   pada sinkron berikutnya. Baris `failed` karena validasi tidak
   dicoba lagi sampai payload diperbaiki (dicatat di log untuk
   diagnosis).
4. Setelah 5 kali gagal berturut-turut untuk satu baris, APK
   menampilkan statusnya di layar Riwayat (misalnya ikon peringatan
   kecil pada entri itu) — tanpa banner yang mengganggu dan tanpa spam
   notifikasi.
5. Di D1, `sync_status` selalu `synced` untuk baris yang ada di
   server: baris hasil push disimpan sebagai `synced`, dan baris yang
   dibuat lewat web langsung `synced` sejak dibuat.

---

## 6. Soft-delete dua arah

Penghapusan tidak pernah menghapus baris secara fisik lewat sinkron —
kedua sisi hanya mengisi `deleted_at` (tombstone).

### 6.1 Hapus di APK → server

1. Pengguna menghapus entri di APK → `deletedAt` diisi waktu
   sekarang, `syncStatus` kembali `pending`.
2. Push berikutnya menyertakan baris itu sebagai tombstone.
3. Server menerapkan `deleted_at` pada barisnya (aturan delete-wins,
   bagian 4).

**Celah yang harus diperbaiki di APK:** query sinkron saat ini
(`healthChecksAktif()` / `wifiReportsAktif()` di `app_database.dart`)
memfilter `deleted_at IS NULL`, sehingga baris yang dihapus **tidak
pernah** masuk ke push dan penghapusan tidak pernah sampai ke server.
Layanan sinkron baru wajib memakai query khusus yang menyertakan
tombstone (lihat bagian 11).

### 6.2 Hapus di web → APK

1. Pengguna menghapus entri di web → endpoint `DELETE` mengisi
   `deleted_at` di D1.
2. Pull berikutnya mengembalikan baris itu dengan `deleted_at` terisi.
3. APK menerapkan `deletedAt` pada baris lokalnya (upsert tombstone)
   dan menandainya `synced`.

### 6.3 Retensi tombstone dan sinkron penuh

- Server mempertahankan tombstone minimal **90 hari** sebelum boleh
  dihapus permanen oleh tugas bersih-bersih. Jendela 90 hari dipilih
  agar perangkat yang lama offline tetap menerima tombstone pada pull
  berikutnya.
- Perangkat yang offline lebih dari 90 hari wajib melakukan **pull
  penuh** (`since` dikosongkan) pada sinkron pertama setelah kembali
  online. Setelah pull penuh, APK menjalankan rekonsiliasi: baris
  lokal aktif yang id-nya tidak ada di daftar server **dan** terakhir
  diubah sebelum jendela retensi dianggap sudah dihapus di server,
  sehingga `deletedAt` lokal diisi. Baris lokal yang dibuat selama
  offline (tidak ada di server karena belum pernah di-push) tidak
  tersentuh rekonsiliasi — ia tetap `pending` dan akan di-push.
- Hapus akun adalah pengecualian: `DELETE /account` menghapus seluruh
  data pengguna di server lewat cascade (hard delete, di luar
  mekanisme sinkron). Token perangkat ikut tidak berlaku karena
  `user_id` pemiliknya sudah tidak ada; salinan lokal di APK tidak
  terhapus otomatis dan menjadi `local_only` setelah token ditolak.

---

## 7. Perubahan skema D1 (migrasi `0002_sync.sql`)

Migrasi ini ditambahkan saat fase sinkron dimulai; skema rilis pertama
(`0001_init.sql`) tidak berubah.

```sql
-- wifi_reports: samakan dengan health_checks + simpan dBm mentah.
ALTER TABLE wifi_reports ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE wifi_reports ADD COLUMN rssi_dbm INTEGER;

-- Jam server saat baris diterima/diperbarui: jangkar urutan pull
-- (kebal terhadap selisih jam perangkat).
ALTER TABLE health_checks ADD COLUMN diterima_pada TEXT NOT NULL
  DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
ALTER TABLE wifi_reports ADD COLUMN diterima_pada TEXT NOT NULL
  DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Indeks untuk pull: filter per pengguna + urutan diterima_pada.
CREATE INDEX health_checks_sync_idx ON health_checks (user_id, diterima_pada, id);
CREATE INDEX wifi_reports_sync_idx ON wifi_reports (user_id, diterima_pada, id);

-- Token perangkat: satu baris per perangkat terpasang.
-- token_hash = SHA-256 hex dari token mentah (token mentah tidak pernah disimpan).
CREATE TABLE device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  nama_perangkat TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  kedaluwarsa_pada TEXT NOT NULL,
  terakhir_dipakai_pada TEXT,
  dicabut_pada TEXT
);
CREATE INDEX device_tokens_user_id_idx ON device_tokens (user_id);
CREATE INDEX device_tokens_token_hash_idx ON device_tokens (token_hash);

-- Idempotensi push: kunci batch + respons tersimpan (retensi 24 jam).
CREATE TABLE sync_batches (
  idempotency_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_token_id TEXT REFERENCES device_tokens (id) ON DELETE SET NULL,
  respons TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX sync_batches_dibuat_pada_idx ON sync_batches (dibuat_pada);
```

Catatan: `health_checks` sudah punya `sync_status` sejak `0001`;
migrasi ini hanya menambahkannya ke `wifi_reports` agar simetris.

---

## 8. Autentikasi perangkat

Token perangkat **terpisah dari sesi web**. Sesi web memakai cookie
HttpOnly yang terikat browser dan masa berlaku 30 hari — tidak cocok
untuk client Flutter, dan mencampur keduanya akan membuat pencabutan
satu perangkat ikut mengakhiri sesi browser. Token perangkat hanya
berlaku untuk `/api/sync/*`.

### 8.1 Penerbitan (pairing)

1. Pengguna membuka "Hubungkan ke web" di APK → APK memanggil
   `POST /api/sync/devices/pair` → server mengembalikan kode pairing
   6 digit + masa berlaku singkat (10 menit) dan menampilkannya di APK.
2. Pengguna membuka halaman web (sudah masuk dengan Google) dan
   memasukkan kode itu (atau memindai tautan yang memuat kode) →
   `POST /api/sync/devices/confirm`.
3. Server membuat token acak 32 byte, menyimpan SHA-256-nya di
   `device_tokens` (bersama `nama_perangkat` dari APK), dan menandai
   kode pairing terkonfirmasi.
4. APK melakukan polling `GET /api/sync/devices/pair/:code/status`
   (setiap 2 detik, maksimal sampai kode kedaluwarsa). Setelah
   terkonfirmasi, respons berisi token mentah **sekali saja** lewat
   HTTPS. Token tidak pernah dikirim lewat deep link atau URL
   (URL bisa tercatat di log).
5. APK menyimpan token mentah di `flutter_secure_storage` (kunci baru,
   lihat bagian 11) dan tidak pernah menampilkannya, mencatatnya di
   log, atau menyimpannya di database biasa.

### 8.2 Pemakaian dan masa berlaku

- Setiap request sinkron menyertakan `Authorization: Bearer <token>`.
  Worker menghitung SHA-256 token, mencari di `device_tokens`,
  memeriksa `dicabut_pada IS NULL` dan `kedaluwarsa_pada` belum lewat,
  lalu memakai `user_id` dari baris itu untuk semua query.
- Masa berlaku token **90 hari** sejak diterbitkan. `POST
  /api/sync/token/refresh` dengan token yang masih valid menerbitkan
  token baru dan langsung mencabut token lama (rotasi). Bila token
  sudah kedaluwarsa, pengguna melakukan pairing ulang.
- Satu akun boleh punya banyak perangkat; tiap perangkat punya token
  sendiri. Mencabut satu perangkat tidak memengaruhi perangkat lain
  maupun sesi web.

### 8.3 Pencabutan

- Dari web: halaman Pengaturan menampilkan daftar perangkat
  (`GET /api/sync/devices`) dengan tombol cabut per perangkat
  (`DELETE /api/sync/devices/:id`).
- Dari APK: "Putuskan perangkat ini" menghapus token lokal dan
  memanggil `DELETE /api/sync/devices/:id`. Bila panggilan gagal
  (offline), token lokal tetap dihapus — token di server kedaluwarsa
  sendiri dalam 90 hari dan bisa dicabut dari web.
- Token yang dicabut atau kedaluwarsa ditolak dengan HTTP 401; APK
  menampilkan status "Perangkat terputus, hubungkan ulang" dan
  menghentikan percobaan sinkron sampai pairing ulang.

### 8.4 Keamanan

- Token mentah tidak pernah disimpan di server (hanya SHA-256),
  tidak pernah dicatat di log Worker, dan tidak pernah ada di repo.
- Rate limit sinkron mengikuti batas tulis umum (60/menit per
  pengguna — `ARCHITECTURE.md` bagian 6.1), dihitung per perangkat.
- Token perangkat tidak memberi akses ke endpoint web lain; bila
  token bocor, dampaknya terbatas pada data sinkron satu pengguna
  dan bisa dicabut per perangkat tanpa mengganti kata sandi atau
  sesi apa pun.

---

## 9. Batas batch dan anggaran query D1

| Batas | Nilai | Alasan |
|---|---|---|
| Baris per request push | Maks **50** (gabungan kedua tabel, termasuk tombstone) | Turunan langsung dari batas platform: maksimal 50 pernyataan D1 per pemanggilan Worker. |
| Baris per respons pull | Maks **50** | Simetris dengan push; paginasi lewat `next_cursor`. |
| Baris per pernyataan upsert | Maks **10** (chunk) | Batas parameter D1 ±100 parameter per pernyataan; satu baris `health_checks` memakai ~8 parameter, jadi 10 baris ≈ 80 parameter dan tetap aman. |
| Pernyataan D1 per push (kasus terburuk) | ±13 | 1 verifikasi token + 1 cek idempotency + sampai 10 pernyataan upsert chunk (50 baris terbagi dua tabel) + 1 simpan idempotency. Jauh di bawah batas 50. |

**Satu pernyataan per baris dilarang** untuk push: 50 baris + 3
pernyataan bookkeeping = 53 pernyataan akan melampaui batas platform.
Implementasi wajib memakai upsert multi-baris per chunk:

```sql
INSERT INTO health_checks (id, user_id, skor, ringkasan, dibuat_pada, updated_at, deleted_at, sync_status, diterima_pada)
VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?), (?, ?, ?, ?, ?, ?, ?, 'synced', ?) -- sampai 10 baris
ON CONFLICT(id) DO UPDATE SET
  skor = excluded.skor,
  ringkasan = excluded.ringkasan,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at,
  diterima_pada = excluded.diterima_pada
WHERE excluded.updated_at > health_checks.updated_at
   OR (excluded.deleted_at IS NOT NULL AND health_checks.deleted_at IS NULL);
```

Klausa `WHERE` pada `DO UPDATE` menegakkan LWW dan delete-wins di
level database (baris yang kalah tidak tertimpa; server mendeteksinya
dengan membandingkan jumlah baris yang berubah dan memasukkannya ke
`konflik` di respons). Pernyataan-pernyataan dijalankan lewat API
`batch()` D1 dalam satu pemanggilan Worker.

**Kuota harian D1** (100 ribu baris ditulis/hari, 5 juta dibaca/hari —
`ARCHITECTURE.md` bagian 6.3): volume sinkron riwayat personal jauh
di bawah angka ini; tidak ada mitigasi khusus selain batching dan pull
incremental. Bila kuota habis, Worker mengembalikan galat jujur dan
APK menganggap sinkron gagal lalu mencoba lagi keesokan hari.

**Retry.** Galat 5xx/429 di-retry dengan backoff eksponensial (2, 4, 8,
16, 32 detik, maksimal 5 percobaan) memakai `idempotency_key` yang
sama. Galat 4xx validasi tidak di-retry tanpa memperbaiki payload.
Galat 401 (token ditolak) tidak di-retry — pengguna harus pairing
ulang.

---

## 10. Alur sinkron ujung-ke-ujung

Satu putaran sinkron di APK (berjalan di background, tidak memblokir UI):

```
1. Pemicu: buka aplikasi / selesai menyimpan pemeriksaan /
   selesai pairing / tombol manual / kembali online.
2. Ambil baris lokal dengan sync_status IN ('pending', 'failed')
   dari kedua tabel — TERMASUK tombstone (deleted_at terisi).
3. Bagi menjadi batch maksimal 50 baris; tiap batch:
   a. Buat idempotency_key baru (UUID v4) dan simpan sampai respons diterima.
   b. POST /api/sync/push; terapkan hasil: `diterima` -> synced,
      `konflik` -> terapkan versi server lalu synced,
      `errors` -> failed (tanpa retry buta).
   c. Bila respons hilang: ulangi batch yang sama dengan kunci yang sama.
4. Pull: GET /api/sync/pull?since=<server_timestamp terakhir>,
   ikuti next_cursor sampai has_more false.
5. Terapkan tiap baris pull ke Drift (upsert; tombstone mengisi
   deletedAt lokal). Baris pull tidak mengubah sync_status lokal
   menjadi pending — ia sudah tersinkron menurut definisi.
6. Simpan server_timestamp terakhir sebagai penanda pull berikutnya.
7. Perbarui indikator status sinkron di UI (jumlah pending/failed).
```

Kegagalan pada langkah mana pun tidak menggagalkan pemakaian aplikasi:
data lokal tetap lengkap dan sinkron berikutnya mengulang dari penanda
terakhir yang tersimpan.

---

## 11. Perubahan yang dibutuhkan di APK

Semua path di bawah ini relatif terhadap repo APK
(`~/workspace/projects/dokter-hp/`). Daftar ini disusun setelah
membaca struktur `lib/` APK v1.1.0. **Tidak ada kode APK yang ditulis
dalam rancangan ini** — hanya daftar perubahan untuk fase implementasi.

### 11.1 File yang diubah

| # | File | Perubahan | Prioritas |
|---|---|---|---|
| 1 | `lib/data/local/tables.dart` | Tambah kolom di `WifiReports`: `dns` (TEXT, nullable) dan `linkSpeedMbps` (REAL, nullable). `HealthChecks` tidak butuh kolom baru. | Wajib |
| 2 | `lib/data/local/app_database.dart` | Naikkan `schemaVersion` 1 → 2 + `onUpgrade` (ALTER TABLE tambah dua kolom di atas). Tambah query sinkron yang **menyertakan tombstone**: `healthChecksUntukSinkron()` dan `wifiReportsUntukSinkron()` (filter `syncStatus IN ('pending','failed')`, **tanpa** filter `deleted_at IS NULL`). Tambah metode upsert dari pull: `terapkanHealthCheckDariServer()` dan `terapkanWifiReportDariServer()`. | Wajib |
| 3 | `lib/data/local/app_database.g.dart` | Dihasilkan ulang dengan `build_runner` setelah perubahan `tables.dart`. **Jangan diedit manual.** | Wajib (otomatis) |
| 4 | `lib/data/sync/supabase_sync_service.dart` | Ganti target dari Supabase ke Worker API, atau jadikan adapter tipis di atas layanan baru (butir file baru 1). Perbarui pemetaan: kirim `id` lokal; `downloadKbps` → `kecepatan_unduh_kbps` (tanpa pembagian); `linkSpeedMbps` → `kecepatan_koneksi_mbps`; `rssiDbm` → `kekuatan_sinyal` (label) + `rssi_dbm` (mentah); kirim `dns`; sertakan `deleted_at` (tombstone); sertakan baris terhapus dalam daftar kirim. Hapus catatan "id tidak dikirim" — tidak berlaku lagi untuk D1. | Wajib |
| 5 | `lib/core/app_config.dart` | Tambah `apiBaseUrl` (lewat `--dart-define=DOKTER_HP_API_URL`) dan nama kunci secure storage untuk token perangkat. Konstanta `SUPABASE_*` dipertahankan hanya bila jalur Supabase tetap didukung sebagai fallback; bila tidak, tandai deprecated dan hapus pada rilis berikutnya. | Wajib |
| 6 | `lib/main.dart` | Ganti `_syncRiwayat()` ke layanan sinkron web; picu sinkron saat aplikasi dibuka (background, tidak menahan tampilan) dan saat kembali online. Prinsip lama dipertahankan: gagal sinkron bukan galat fatal. | Wajib |
| 7 | `lib/features/wifi_doctor/wifi_service.dart` | Saat menyimpan laporan, simpan juga `dnsServers` (server pertama) dan `linkSpeedMbps` ke `WifiReportsCompanion`. Kedua nilai sudah dibaca dari native (`DeviceNative.dnsServers()`, `DeviceNative.wifiLinkSpeedMbps()`) tetapi saat ini hanya ditampilkan, tidak disimpan. | Wajib |
| 8 | `lib/features/wifi_doctor/wifi_cubit.dart` | Teruskan nilai DNS dan link speed ke penyimpanan laporan, bila penyimpanan dilakukan lewat cubit ini. | Wajib bila relevan |
| 9 | `lib/features/dashboard/dashboard_cubit.dart` | Picu sinkron setelah diagnosis satu ketuk menyimpan `health_check`; sediakan status sinkron (jumlah `pending`/`failed`) untuk banner dashboard. | Direkomendasikan |
| 10 | `lib/features/dashboard/dashboard_page.dart` | Banner status sinkron yang jujur ("3 pemeriksaan belum tersinkron") + tombol sinkron manual. Hanya tampil bila ada yang belum tersinkron atau bila perangkat belum terpasang. | Direkomendasikan |
| 11 | `lib/features/history/history_page.dart` | Tampilkan status sinkron per entri (indikator kecil `pending`/`synced`/`failed`) + tombol "Sinkronkan sekarang". | Direkomendasikan |
| 12 | `lib/features/auth/auth_page.dart` | Bagian "Perangkat terhubung": tombol "Hubungkan ke web" (memulai pairing, menampilkan kode 6 digit), status perangkat (terhubung/terputus), tombol "Putuskan perangkat ini". | Wajib |
| 13 | `pubspec.yaml` | Tambah paket `http` untuk client REST (saat ini belum ada dependensi HTTP di pubspec). Alternatif tanpa dependensi baru: `dart:io HttpClient` — keputusan tim implementasi; `http` direkomendasikan karena API-nya lebih ringkas dan teruji. | Wajib (pilih satu) |
| 14 | `test/supabase_sync_test.dart` | Perbarui agar menguji pemetaan baru (id dikirim, `kecepatan_unduh_kbps`, `rssi_dbm`, `dns`, tombstone ikut terkirim). | Wajib |

### 11.2 File baru di APK

| # | File | Isi |
|---|---|---|
| 1 | `lib/data/sync/web_sync_service.dart` | Client push/pull ke Worker API: batching (maks 50), `idempotency_key`, mesin status `sync_status`, penerapan hasil pull, retry dengan backoff, pemicu sinkron. Pengganti `SupabaseSyncService` untuk jalur sinkron utama. |
| 2 | `lib/data/sync/device_token_service.dart` | Pairing (minta kode, polling status), simpan/ambil/hapus token perangkat di `flutter_secure_storage`, refresh token (rotasi), putuskan perangkat. |
| 3 | `lib/data/sync/sync_models.dart` *(opsional)* | Model request/response push/pull (serialisasi JSON) agar terpisah dari logika layanan. |
| 4 | `lib/features/auth/pairing_page.dart` *(opsional)* | Layar kode pairing 6 digit + status menunggu konfirmasi. Bila alur pairing cukup ditangani dialog di `auth_page.dart`, file ini tidak perlu dibuat. |
| 5 | `test/web_sync_test.dart` | Tes pemetaan kolom, idempotensi batch, aturan konflik (LWW + delete-wins), tombstone dua arah, dan batas batch 50. |

### 11.3 File yang tidak perlu diubah

| File | Alasan |
|---|---|
| `lib/core/native/device_native.dart` dan `MainActivity.kt` | Native sudah menyediakan RSSI, link speed, frekuensi, DNS, dan data perangkat lain yang dibutuhkan — tidak ada metode native baru. |
| `lib/core/health_score.dart` | `signalLabel()` dipakai ulang untuk konversi RSSI → label. Logika skor tidak berubah. |
| `lib/features/auth/pin_service.dart`, `lib/features/auth/lock_gate.dart` | PIN dan gerbang kunci lokal tidak terkait sinkron; token perangkat disimpan terpisah (file baru butir 2). |
| `lib/features/history/pdf_report_service.dart` | Laporan PDF membaca database lokal; tidak terpengaruh sumber data. |
| `lib/features/battery/battery_page.dart`, `lib/features/storage/storage_page.dart`, `lib/features/performance/performance_page.dart`, `lib/features/security/security_page.dart` | Layar baca sensor; tidak menyimpan baris yang disinkronkan. |
| `lib/features/ai_diagnosis/ai_diagnosis.dart` | Diagnosis AI tidak disinkronkan di fase ini (bagian 2.3). |

---

## 12. Perubahan yang dibutuhkan di web (ringkas)

Dicatat agar tidak hilang; implementasinya adalah tugas tim web saat
fase sinkron dimulai, bukan bagian dari dokumen ini:

- Worker: rute baru `routes/sync.ts` (push/pull/perangkat),
  `lib/device_auth.ts` (verifikasi token perangkat), migrasi
  `0002_sync.sql` (bagian 7).
- Frontend: halaman Pengaturan menampilkan daftar perangkat terhubung
  + tombol cabut; halaman konfirmasi pairing untuk memasukkan kode
  6 digit.
- Uji kepemilikan: pengguna A tidak bisa push/pull data pengguna B
  (token perangkat A hanya memberi akses ke `user_id` A).

---

## 13. Kriteria selesai implementasi (diperiksa nanti)

- [ ] Push 50 baris berhasil dalam satu request; push 51 baris ditolak 400 `BATCH_TOO_LARGE`.
- [ ] Pengiriman ulang batch dengan `idempotency_key` yang sama tidak membuat duplikat dan mengembalikan respons yang sama.
- [ ] Pull mengembalikan baris web (tes WiFi web, input manual) ke APK dengan `sumber` yang benar.
- [ ] Hapus di APK → tombstone sampai ke server → baris hilang dari web. Hapus di web → tombstone turun lewat pull → baris hilang dari APK.
- [ ] Konflik isi diselesaikan LWW; konflik hapus-vs-ubah dimenangkan penghapusan; client menerima versi pemenang di respons push.
- [ ] Token perangkat yang dicabut/kedaluwarsa ditolak 401; APK menampilkan status terputus dan berhenti mencoba sampai pairing ulang.
- [ ] Token perangkat ditolak di endpoint web non-sinkron.
- [ ] Perangkat offline > 90 hari berhasil sinkron penuh + rekonsiliasi tanpa menghidupkan kembali baris terhapus dan tanpa menghapus baris lokal yang belum pernah di-push.
- [ ] Jumlah pernyataan D1 per push terukur ≤ 50 pada batch penuh (50 baris).
- [ ] `flutter analyze` bersih dan `flutter test` hijau, termasuk tes sinkron baru.
- [ ] Tidak ada token perangkat, PIN, atau secret di log, di database biasa, atau di repo.

---

## 14. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Respons push hilang, client mengirim ulang | Duplikasi baris di server | `idempotency_key` + upsert berdasarkan `id` (dua lapisan) |
| Data yang dihapus "bangkit" dari perangkat lain | Kepercayaan pengguna rusak | Aturan delete-wins + retensi tombstone 90 hari + rekonsiliasi pull penuh |
| Jam perangkat meleset jauh | Vonis konflik LWW salah | Diterima (konflik isi hampir tidak terjadi); delete-wins tidak bergantung jam; pull memakai jam server |
| Token perangkat bocor | Akses baca/tulis data sinkron satu pengguna | Token hanya berlaku untuk `/api/sync/*`, bisa dicabut per perangkat, masa berlaku 90 hari, rotasi lewat refresh |
| Kuota tulis D1 habis (100 ribu baris/hari) | Sinkron gagal sampai reset 00:00 UTC | Batching + pull incremental; volume riwayat personal jauh di bawah kuota; galat jujur + retry keesokan hari |
| Pengguna menghapus data aplikasi di APK | Token perangkat + antrean `pending` hilang | Riwayat yang sudah `synced` aman di server dan kembali lewat pull penuh setelah pairing ulang; riwayat `pending`/`local_only` hilang — risiko ini sudah dijelaskan di layar "Lupa PIN?" APK dan berlaku sama di sini |

---

## 15. Referensi

- `PRODUCT.md` (web) bagian 7.8 — sinkron APK adalah fase berikutnya; rilis pertama tidak menjanjikannya.
- `ARCHITECTURE.md` (web) bagian 3 (envelope + autentikasi sesi), 5 (skema D1), 6 (rate limit + kuota D1), 9 butir 5.
- `~/workspace/projects/dokter-hp/PRODUCT.md` bagian 7 — data model Drift APK.
- `~/workspace/projects/dokter-hp/supabase/STATUS_BACKEND.md` — backend Supabase APK terblokir limit proyek (konteks: sinkron ke Worker + D1 menjadi jalur utama, bukan Supabase).
- `~/workspace/projects/dokter-hp/lib/data/sync/supabase_sync_service.dart` — pemetaan dan keterbatasan jalur sinkron Supabase yang ada (id tidak dikirim, DNS tidak disimpan, `downloadKbps/128`, tombstone tidak terkirim).
- `~/workspace/projects/dokter-hp/lib/data/local/tables.dart`, `app_database.dart` — skema Drift dan query yang ada.
- `~/workspace/projects/dokter-hp/lib/features/wifi_doctor/wifi_service.dart` — DNS dan link speed sudah dibaca dari native tetapi belum disimpan ke database.
