# Strategi Backup & Disaster Recovery: Dokter HP Web App

> **Dokumen strategi backup dan pemulihan Dokter HP Web App.**
> Bahasa: Bahasa Indonesia. Status: Fase 1 — dokumen, 17 November 2026.
>
> Prinsip yang mengikat: **budget nol rupiah, tanpa kartu kredit,
> tanpa layanan backup berbayar.** Semua yang tertulis di sini
> berjalan di free tier yang sudah dipakai proyek ini.

---

## 1. Ringkasan strategi

| Aset | Apa yang dicadangkan | Metode utama | Lokasi salinan |
|---|---|---|---|
| Database D1 | Seluruh isi database (skema + data) sebagai SQL dump | `wrangler d1 export` | Repo GitHub privat terpisah (terenkripsi) + salinan lokal |
| Kode sumber | Repo `adiprmx/dokter-hp-web` | GitHub (salinan utama) + mirror otomatis | Repo mirror privat + clone lokal |
| Konfigurasi deploy | `wrangler.toml`, migrasi SQL, skrip deploy | Sudah di repo (tanpa nilai secret) | Ikut backup kode |
| Secret (nama saja) | Daftar nama secret Worker | Inventaris nama di bagian 8 dokumen ini | Di repo utama (nama saja, tanpa nilai) |
| Data KV | Konfigurasi yang jarang berubah | Ekspor manual lewat Wrangler | Ikut paket backup D1 |

**Satu kalimat:** setiap minggu database D1 diekspor menjadi file
SQL, dikompres, dienkripsi, lalu disimpan di repo GitHub privat
terpisah — dan sebelum setiap deploy besar, ekspor yang sama dibuat
lagi sebagai titik aman untuk kembali.

---

## 2. Apa yang harus dilindungi

Database D1 berisi data yang tidak bisa dibuat ulang bila hilang:

| Tabel | Isi | Bisa dibuat ulang bila hilang? |
|---|---|---|
| `users`, `profiles` | Akun pengguna (email, nama, hash PIN) | Tidak — akun harus daftar ulang |
| `sessions` | Sesi login aktif | Ya — pengguna cukup masuk ulang |
| `health_checks` | Riwayat skor kesehatan HP | Tidak — riwayat pemeriksaan hilang |
| `wifi_reports`, `wifi_sustained_samples` | Riwayat tes WiFi + 30 sampel per tes | Tidak — hasil ukur hilang |
| `ai_diagnoses` | Riwayat tanya jawab Diagnosis AI | Tidak — percakapan hilang |

Karena itu, yang paling berharga adalah **data pengguna** (akun,
riwayat, diagnosis). Sesi adalah satu-satunya tabel yang boleh
hilang tanpa dampak berarti — pengguna hanya perlu masuk ulang.

Yang **tidak** dicadangkan ke repo backup:

- **Secret dan kunci apa pun** (kunci Gemini, client secret Google
  OAuth, token API Cloudflare). Secret hanya ada di dashboard
  Cloudflare sebagai secret Worker. Bagian 8 menjelaskan cara
  memulihkan secret tanpa pernah menulis nilainya di mana pun.
- **Token sesi mentah** — token mentah tidak pernah disimpan di
  mana pun kecuali cookie pengguna; yang ada di D1 hanya hash-nya,
  dan hash itu tetap ikut dalam SQL dump (aman untuk disimpan
  terenkripsi).

---

## 3. Ekspor berkala D1

### 3.1 Metode utama: Wrangler CLI

Wrangler adalah alat resmi Cloudflare dan sudah dipakai untuk
deploy Worker. Perintah ekspor menghasilkan satu file SQL berisi
skema (`CREATE TABLE`, `CREATE INDEX`) dan seluruh data
(`INSERT`) database.

```bash
# 1. Masuk ke folder Worker (tempat wrangler.toml berada)
cd apps/api

# 2. Ekspor database D1 produksi menjadi SQL dump
npx wrangler d1 export <nama-database> \
  --remote \
  --output=./backup-dokter-hp-YYYY-MM-DD.sql
```

Keterangan:

- `<nama-database>` adalah nama database D1 di `wrangler.toml`
  (bukan ID-nya). Jangan menulis ID database di dokumen publik;
  ID cukup ada di `wrangler.toml` di repo.
- `--remote` berarti ekspor dari database produksi di Cloudflare,
  bukan database lokal.
- `--output` menentukan nama file hasil. Gunakan tanggal ISO
  (`YYYY-MM-DD`) agar file terurut secara kronologis.

### 3.2 Setelah ekspor: kompres dan enkripsi

File SQL mentah **tidak boleh** diunggah apa adanya ke repo mana
pun — isinya data pengguna (email, nama, hash PIN, hash token
sesi). Urutan yang wajib diikuti:

```bash
# 3. Kompres (file SQL biasanya menyusut 70-90 persen)
gzip -9 backup-dokter-hp-YYYY-MM-DD.sql

# 4. Enkripsi simetris dengan passphrase
#    (gpg sudah tersedia di kebanyakan sistem; passphrase disimpan
#    di pengelola kata sandi owner, TIDAK di repo dan TIDAK di file)
gpg --symmetric --cipher-algo AES256 \
  backup-dokter-hp-YYYY-MM-DD.sql.gz

# Hasil akhir yang diunggah:
#   backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg
```

Catatan:

- Passphrase enkripsi adalah satu-satunya kunci untuk membuka
  backup. Bila passphrase hilang, backup tidak bisa dibuka.
  Simpan passphrase di pengelola kata sandi owner dan di satu
  tempat aman kedua (misalnya catatan terenkripsi di perangkat
  owner). Jangan pernah menulis passphrase di repo, di chat,
  atau di file backup itu sendiri.
- Alternatif alat enkripsi: `age` (`age -p`) bila `gpg` tidak
  tersedia. Pilih satu alat dan pakai secara konsisten.

### 3.3 Alternatif: ekspor lewat API Cloudflare

Cloudflare juga menyediakan endpoint ekspor D1 lewat REST API.
Jalur ini berguna bila ekspor perlu dijalankan dari skrip
otomatisasi tanpa Wrangler. Rujuk dokumentasi Cloudflare D1
terbaru untuk bentuk respons endpoint ekspor, karena detailnya
dapat berubah; Wrangler tetap jalur utama yang didokumentasikan
di sini karena perintahnya stabil dan sudah dipakai proyek ini.

### 3.4 Verifikasi setiap ekspor

Ekspor yang tidak diverifikasi sama dengan tidak ada backup.
Setelah setiap ekspor, jalankan tiga pemeriksaan ini sebelum
mengunggah file:

```bash
# A. File tidak kosong dan ukurannya masuk akal
ls -lh backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg

# B. File terenkripsi bisa dibuka (uji dekripsi ke /tmp, bukan ke folder repo)
gpg --decrypt backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg \
  | gunzip \
  | head -50

# C. Dump berisi ketujuh tabel (hasilnya harus 7 baris)
gpg --decrypt backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg \
  | gunzip \
  | grep -c "CREATE TABLE"
```

Bila salah satu pemeriksaan gagal, ulangi ekspor. Jangan
mengunggah file yang belum lolos ketiga pemeriksaan.

### 3.5 Batas ukuran yang perlu diingat

- Database D1 maksimal 500 MB per database. Dump SQL dari
  database sebesar itu, setelah dikompres, biasanya jauh lebih
  kecil — tetapi tetap periksa ukurannya.
- GitHub menolak file di atas 100 MB dan memberi peringatan di
  atas 50 MB. Bila file terenkripsi mendekati 50 MB, pecah file
  sebelum mengunggah:

```bash
# Pecah menjadi potongan 40 MB, lalu unggah semua potongannya
split -b 40M backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg \
  backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg.part-

# Saat memulihkan, gabungkan kembali sebelum dekripsi:
cat backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg.part-* \
  > backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg
```

- Selama ukuran database masih di bawah puluhan MB (kondisi yang
  diharapkan untuk rilis awal), satu file per backup sudah cukup
  dan pemecahan tidak diperlukan.

### 3.6 Ekspor KV (data yang jarang berubah)

KV hanya dipakai untuk data yang jarang berubah (lihat
`docs/keputusan-stack.md`). Isinya kecil dan berubah jarang,
sehingga ekspor KV cukup dilakukan **sebulan sekali** dan setiap
kali isi KV diubah secara manual:

```bash
# Daftar semua kunci di namespace KV
npx wrangler kv key list --namespace-id <namespace-id>

# Ambil nilai satu kunci (ulangi untuk setiap kunci)
npx wrangler kv key get <nama-kunci> --namespace-id <namespace-id>
```

Simpan hasil ekspor KV sebagai file JSON di paket backup bulan
itu (`kv-export-YYYY-MM.json`, dienkripsi dengan cara yang sama
bila isinya sensitif).

---

## 4. Jadwal backup

| Jenis backup | Kapan | Pemicu |
|---|---|---|
| **Mingguan (rutin)** | Setiap Minggu, 07:00 WIB | Jadwal tetap |
| **Sebelum deploy besar** | Tepat sebelum deploy yang mengubah skema D1, mengubah logika tulis data, atau merilis fitur baru yang menulis ke database | Manual, bagian dari checklist deploy (bagian 9) |
| **Bulanan (KV)** | Minggu pertama tiap bulan, bersama backup mingguan | Jadwal tetap |
| **Setelah insiden data** | Segera setelah insiden selesai ditangani | Manual — untuk merekam kondisi pasca-pemulihan |

Keterangan jadwal:

- **Mingguan, bukan harian**, karena volume tulis Dokter HP
  rendah (pengguna perorangan, pemeriksaan sesekali) dan kuota
  tulis D1 hanya 100 ribu baris per hari. Backup harian akan
  menambah beban tanpa manfaat sepadan pada skala ini.
- **Jadwal akan ditinjau ulang** bila salah satu kondisi ini
  terpenuhi: jumlah pengguna aktif harian melewati 100 orang,
  atau jumlah baris yang ditulis per hari secara rutin melewati
  10 ribu baris. Bila itu terjadi, jadwal naik menjadi dua kali
  seminggu, lalu harian.
- Backup mingguan dijalankan dari VM atau perangkat yang sudah
  memiliki akses Wrangler (autentikasi Cloudflare). Bila suatu
  minggu terlewat, backup berikutnya tetap dibuat dan keterlambatan
  dicatat di log backup (bagian 6.3) — jangan menumpuk dua ekspor
  sekaligus untuk "mengejar" jadwal.

---

## 5. Penyimpanan backup

### 5.1 Opsi yang dibandingkan

| Opsi | Biaya | Kapasitas gratis | Kelebihan | Kekurangan |
|---|---|---|---|---|
| **A. Repo GitHub privat terpisah** | Rp0 | Repo privat tanpa batas jumlah; file maks 100 MB | Tanpa layanan baru; riwayat versi bawaan; kontrol akses GitHub; mudah diotomasi dengan Actions | File besar perlu dipecah; riwayat git menyimpan file lama (retensi butuh penghapusan eksplisit); bukan dirancang sebagai penyimpanan backup |
| **B. Cloudflare R2** | Rp0 (free tier) | 10 GB penyimpanan; tanpa biaya egress | Satu ekosistem dengan D1; dirancang untuk objek; tanpa batas ukuran file praktis | Perlu verifikasi apakah akun tanpa kartu bisa mengaktifkan R2; satu penyedia dengan database (bila akun Cloudflare bermasalah, backup ikut terdampak) |
| **C. Google Drive (akun owner)** | Rp0 | 15 GB (berbagi dengan Gmail dan layanan Google lain) | Sudah dimiliki owner; mudah diakses dari HP | Kuota berbagi dengan layanan lain; tanpa riwayat versi yang rapi untuk file biner; unggah otomatis butuh skrip tambahan (rclone) |
| **D. Salinan lokal di perangkat owner** | Rp0 | Sebesar ruang kosong perangkat | Sepenuhnya di luar cloud; tidak bergantung penyedia mana pun | Perangkat bisa hilang/rusak; tanpa otomasi; kapasitas terbatas |

### 5.2 Rekomendasi: Opsi A (repo GitHub privat terpisah) + Opsi D (salinan lokal)

**Salinan utama: repo GitHub privat baru** bernama
`adiprmx/dokter-hp-web-backups` (privat, bukan publik). Alasan
pemilihan:

1. **Tanpa layanan baru dan tanpa kartu.** Proyek sudah memakai
   GitHub untuk kode; tidak ada akun baru, tidak ada kartu, tidak
   ada risiko penagihan.
2. **Riwayat versi bawaan.** Setiap backup adalah satu commit
   dengan tanggal; riwayat commit adalah log backup itu sendiri.
3. **Kontrol akses yang sudah ada.** Repo privat hanya bisa
   dibaca akun owner dan kolaborator yang ditunjuk; tidak ada
   tautan publik.
4. **Otomasi gratis.** GitHub Actions (2.000 menit per bulan
   untuk repo privat) bisa menjalankan ekspor terjadwal di masa
   depan tanpa server tambahan.
5. **Terpisah dari repo kode.** Bila repo kode bermasalah
   (misalnya push yang salah atau penghapusan tidak sengaja),
   backup tidak ikut terdampak — dan sebaliknya.

**Salinan kedua: perangkat owner (Opsi D).** Setiap backup
mingguan juga disimpan satu salinannya di perangkat owner
(misalnya folder khusus di penyimpanan HP atau laptop). Alasan:
bila akun GitHub bermasalah, masih ada salinan di luar GitHub.
Salinan lokal cukup menyimpan **4 backup mingguan terakhir**
(menghemat ruang perangkat).

**Opsi B (R2) dan C (Google Drive) tidak dipilih sebagai
salinan utama**, tetapi tetap dicatat sebagai **cadangan
lapisan ketiga** bila di masa depan dibutuhkan salinan di luar
GitHub dan di luar perangkat: R2 bila verifikasi tanpa kartu
berhasil, Google Drive bila tidak. Keputusan itu diambil
koordinator bila kebutuhan muncul — bukan bagian dari rilis
awal.

### 5.3 Struktur repo backup

```
dokter-hp-web-backups/            # repo privat
  README.md                       # Cara memakai repo ini (ringkas, tanpa secret)
  d1/
    backup-dokter-hp-2026-11-16.sql.gz.gpg
    backup-dokter-hp-2026-11-23.sql.gz.gpg
    ...
  kv/
    kv-export-2026-11.json        # dienkripsi bila isinya sensitif
  log/
    backup-log.md                 # Catatan tiap backup + tiap uji restore
```

Aturan repo backup:

- **Repo wajib privat.** Jangan pernah mengubahnya menjadi publik.
- **Tidak ada file SQL mentah** (tidak terenkripsi) di repo ini.
  Hanya file `.gpg` (dan file KV yang sudah dinilai tidak sensitif).
- **Tidak ada passphrase** di repo ini, di README, atau di commit
  message mana pun.
- Setiap backup adalah satu commit dengan pesan yang jelas:
  `backup mingguan 2026-11-23` atau
  `backup pra-deploy v1.2.0 2026-11-25`.

---

## 6. Retensi

### 6.1 Berapa salinan yang disimpan

| Kategori | Jumlah yang disimpan | Alasan |
|---|---|---|
| Backup mingguan | 8 salinan terakhir (± 2 bulan) | Cukup untuk memulihkan dari kesalahan yang baru disadari berminggu-minggu kemudian |
| Backup bulanan | Salinan minggu pertama tiap bulan, 6 salinan terakhir (± 6 bulan) | Titik aman jangka menengah; tumpang tindih dengan mingguan, tetapi dipertahankan lebih lama |
| Backup pra-deploy besar | Salinan terakhir sebelum setiap deploy besar, dipertahankan sampai 2 deploy besar berikutnya selesai dan stabil | Titik kembali bila deploy besar bermasalah |
| Salinan lokal (perangkat owner) | 4 backup mingguan terakhir | Menghemat ruang perangkat |

Total file di repo backup pada kondisi stabil: sekitar **14–16
file** (8 mingguan + 6 bulanan + 1–2 pra-deploy). Bila ukuran
database masih kecil, totalnya hanya beberapa MB — jauh dari
batas GitHub.

### 6.2 Cara menghapus salinan lama

Penghapusan dilakukan **bersamaan dengan backup mingguan**,
sebulan sekali (pada backup minggu pertama):

```bash
# Di clone lokal repo backup:
# 1. Hapus file backup mingguan yang sudah melewati 8 salinan terakhir
#    (kecuali yang juga berstatus backup bulanan atau pra-deploy)
git rm d1/backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg

# 2. Commit penghapusan dengan pesan yang jelas
git commit -m "retensi: hapus backup mingguan 2026-09-28 (melewati 8 salinan)"
git push
```

Catatan penting: menghapus file dari commit terbaru **tidak**
menghapusnya dari riwayat git — file lama tetap bisa diambil dari
commit lama. Itu disengaja pada tahap ini (lapisan keamanan
tambahan). Bila suatu saat backup lama wajib hilang total
(misalnya berisi data yang harus dihapus atas permintaan
pengguna), penghapusan riwayat git membutuhkan penulisan ulang
riwayat (`git filter-repo`) dan koordinasi khusus — bukan
prosedur rutin.

### 6.3 Log backup

Setiap backup dan setiap uji restore dicatat di
`log/backup-log.md` di repo backup:

```markdown
| Tanggal | Jenis | File | Ukuran | Verifikasi | Keterangan |
|---|---|---|---|---|---|
| 2026-11-23 | Mingguan | backup-dokter-hp-2026-11-23.sql.gz.gpg | 1,2 MB | Lolos (7 tabel) | — |
| 2026-11-25 | Pra-deploy v1.2.0 | backup-dokter-hp-2026-11-25.sql.gz.gpg | 1,3 MB | Lolos (7 tabel) | Sebelum migrasi 0002 |
| 2026-11-30 | Uji restore | (dari backup 2026-11-23) | — | Lolos | Restore ke D1 uji, 1.240 baris cocok |
```

Log ini adalah bukti bahwa backup benar-benar dibuat dan diuji —
bukan sekadar niat.

---

## 7. Cara restore

### 7.1 Kapan restore dilakukan

Restore dilakukan bila salah satu kondisi ini terjadi:

1. **Data rusak atau terhapus massal** — misalnya migrasi yang
   salah menghapus baris, atau bug Worker menghapus data pengguna.
2. **Database D1 hilang** — misalnya database terhapus tidak
   sengaja dari dashboard Cloudflare.
3. **Deploy besar gagal total** dan perbaikan ke depan tidak
   memungkinkan — kembali ke kondisi sebelum deploy.

Restore **tidak** dilakukan untuk satu baris yang terhapus oleh
pengguna sendiri (misalnya pengguna menghapus satu riwayat):
penghapusan per baris memakai soft-delete (`deleted_at`) dan
bisa dibatalkan dengan mengosongkan `deleted_at` lewat query —
tanpa restore seluruh database.

### 7.2 Prinsip utama: jangan pernah restore langsung ke produksi

Restore selalu dilakukan ke **database D1 baru yang terpisah**,
lalu diverifikasi, baru setelah itu Worker dialihkan ke database
baru. Database produksi lama tidak disentuh selama proses
verifikasi — bila restore bermasalah, produksi lama masih utuh
dan bisa dipakai kembali.

### 7.3 Langkah restore lengkap

```bash
# LANGKAH 0 — Hentikan tulis baru (bila memungkinkan)
# Bila penyebabnya bug yang masih aktif, nonaktifkan dulu endpoint
# tulis yang bermasalah (deploy Worker darurat) atau beri tahu
# pengguna lewat banner bahwa penyimpanan sedang dijeda.
# Langkah ini mencegah data baru tertulis ke database yang rusak
# selama proses restore.

# LANGKAH 1 — Ambil file backup dari repo backup
git clone https://github.com/adiprmx/dokter-hp-web-backups.git
cd dokter-hp-web-backups/d1

# Bila file terpecah, gabungkan dulu (lihat bagian 3.5):
# cat backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg.part-* \
#   > backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg

# LANGKAH 2 — Dekripsi dan dekompres ke file SQL
gpg --decrypt backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg \
  | gunzip > /tmp/restore-YYYY-MM-DD.sql

# LANGKAH 3 — Periksa isi dump sebelum dipakai
grep -c "CREATE TABLE" /tmp/restore-YYYY-MM-DD.sql   # harus 7
wc -l /tmp/restore-YYYY-MM-DD.sql                    # jumlah baris masuk akal

# LANGKAH 4 — Buat database D1 BARU untuk hasil restore
# (nama berbeda dari database produksi; jangan menimpa produksi)
cd ~/workspace/projects/dokter-hp-web/apps/api
npx wrangler d1 create <nama-database>-restore-YYYY-MM-DD

# LANGKAH 5 — Impor dump ke database baru
# Untuk file kecil-menengah, satu perintah ini cukup:
npx wrangler d1 execute <nama-database>-restore-YYYY-MM-DD \
  --remote \
  --file=/tmp/restore-YYYY-MM-DD.sql

# Bila file sangat besar dan perintah di atas gagal karena batas
# ukuran batch, pecah file SQL per tabel dan impor satu per satu,
# dimulai dari tabel tanpa foreign key (users) lalu tabel anak.
# Urutan yang aman: users -> profiles -> sessions ->
# health_checks -> wifi_reports -> wifi_sustained_samples ->
# ai_diagnoses.

# LANGKAH 6 — Verifikasi database hasil restore
npx wrangler d1 execute <nama-database>-restore-YYYY-MM-DD \
  --remote \
  --command="SELECT COUNT(*) AS jumlah_pengguna FROM users;"
npx wrangler d1 execute <nama-database>-restore-YYYY-MM-DD \
  --remote \
  --command="SELECT COUNT(*) AS jumlah_health_checks FROM health_checks;"
npx wrangler d1 execute <nama-database>-restore-YYYY-MM-DD \
  --remote \
  --command="SELECT COUNT(*) AS jumlah_wifi_reports FROM wifi_reports;"
npx wrangler d1 execute <nama-database>-restore-YYYY-MM-DD \
  --remote \
  --command="PRAGMA integrity_check;"
# integrity_check harus mengembalikan "ok".
# Bandingkan jumlah baris dengan angka yang dicatat di log backup
# (bagian 6.3) — selisih besar berarti ada yang salah.

# LANGKAH 7 — Uji baca lewat Worker staging (bila tersedia)
# Arahkan binding D1 Worker staging ke database hasil restore,
# lalu jalankan uji smoke: buka riwayat, buka dashboard, jalankan
# satu tes WiFi tanpa akun. Bila tidak ada staging, lanjut ke
# langkah 8 dengan hati-hati dan uji langsung setelah pengalihan.

# LANGKAH 8 — Alihkan Worker produksi ke database hasil restore
# Ubah database_id di wrangler.toml ke ID database hasil restore,
# lalu deploy Worker:
npx wrangler deploy

# LANGKAH 9 — Uji smoke produksi
# Buka landing, masuk Google, buka dashboard dan riwayat,
# jalankan satu tes WiFi, periksa satu jawaban AI lama masih ada.
# Bila semua lolos, restore selesai.

# LANGKAH 10 — Bersihkan
# - Hapus file SQL sementara di /tmp (berisi data pengguna):
rm /tmp/restore-YYYY-MM-DD.sql
# - Database produksi lama JANGAN langsung dihapus — simpan
#   minimal 7 hari sebagai jaring pengaman kedua, lalu hapus
#   bila kondisi sudah stabil.
# - Catat restore di log/backup-log.md di repo backup.
```

### 7.4 Menguji restore tanpa merusak produksi

Uji restore dilakukan **sebulan sekali** (bersamaan dengan
backup minggu pertama) dan **wajib** dilakukan sebelum deploy
besar pertama yang mengubah skema. Prosedurnya identik dengan
langkah 1–6 di atas, dengan dua perbedaan:

1. Database tujuan adalah database D1 **uji** yang dibuat khusus
   (`<nama-database>-uji-restore`), bukan database restore
   darurat — dan Worker produksi **tidak pernah** dialihkan ke
   database uji.
2. Setelah verifikasi selesai, database uji dihapus untuk
   mengosongkan jatah 10 database per akun:

```bash
# Setelah uji selesai dan hasilnya dicatat di log:
npx wrangler d1 delete <nama-database>-uji-restore
```

Alternatif uji yang lebih ringan (tanpa memakai jatah database
D1): restore ke SQLite lokal dengan alat `sqlite3`:

```bash
# Dekripsi dan muat ke file SQLite lokal
gpg --decrypt backup-dokter-hp-YYYY-MM-DD.sql.gz.gpg \
  | gunzip > /tmp/uji-YYYY-MM-DD.sql
sqlite3 /tmp/uji-YYYY-MM-DD.db < /tmp/uji-YYYY-MM-DD.sql

# Verifikasi lokal
sqlite3 /tmp/uji-YYYY-MM-DD.db "PRAGMA integrity_check;"
sqlite3 /tmp/uji-YYYY-MM-DD.db "SELECT COUNT(*) FROM users;"
sqlite3 /tmp/uji-YYYY-MM-DD.db "SELECT COUNT(*) FROM health_checks;"

# Bersihkan setelah uji
rm /tmp/uji-YYYY-MM-DD.sql /tmp/uji-YYYY-MM-DD.db
```

Uji lokal membuktikan dump valid dan lengkap. Uji ke D1
membuktikan dump bisa diimpor ke lingkungan produksi yang
sebenarnya. **Keduanya** dilakukan bergantian: uji lokal setiap
bulan, uji ke D1 setiap tiga bulan (atau sebelum deploy besar).

### 7.5 Bila backup terbaru juga bermasalah

Bila dump terbaru gagal diimpor atau gagal verifikasi:

1. Coba backup satu minggu sebelumnya (lalu dua minggu
   sebelumnya, dan seterusnya).
2. Bila semua dump gagal, periksa salinan lokal di perangkat
   owner — salinan lokal adalah salinan yang sama, tetapi bisa
   saja file di repo rusak saat unggah sementara salinan lokal
   utuh.
3. Bila tidak ada dump yang bisa dipakai, data D1 tidak bisa
   dipulihkan dari backup. Pada titik itu, satu-satunya jalan
   adalah membangun ulang database kosong dari migrasi
   (`migrations/0001_init.sql` di repo kode) dan menerima
   kehilangan data pengguna — dengan pemberitahuan jujur kepada
   pengguna yang terdampak. Skenario ini adalah alasan mengapa
   uji restore bulanan tidak boleh dilewati.

---

## 8. Backup kode dan konfigurasi

### 8.1 GitHub adalah salinan utama kode

Repo `adiprmx/dokter-hp-web` (publik) adalah salinan utama kode
sumber, migrasi D1, konfigurasi `wrangler.toml`, dan seluruh
dokumen proyek. Selama repo ini ada dan riwayat commit-nya utuh,
kode bisa dipulihkan penuh dengan satu perintah:

```bash
git clone https://github.com/adiprmx/dokter-hp-web.git
```

### 8.2 Mirror kode (salinan kedua)

Satu salinan saja tidak cukup. Mirror dibuat ke **repo privat
kedua** dengan perintah `git push --mirror` (menyalin seluruh
branch, tag, dan riwayat):

```bash
# Satu kali saja: buat repo privat kosong di GitHub, misalnya
# adiprmx/dokter-hp-web-mirror, lalu tambahkan sebagai remote kedua
git remote add mirror https://github.com/adiprmx/dokter-hp-web-mirror.git

# Setiap selesai push ke origin, salin juga ke mirror
git push origin main
git push --mirror mirror
```

Untuk otomasi, tambahkan workflow GitHub Actions di repo utama
yang berjalan setiap push ke `main` dan setiap minggu (jadwal),
menjalankan `git push --mirror` ke repo mirror. Token yang
dipakai workflow adalah token GitHub Actions bawaan dengan izin
tulis ke repo mirror (diatur lewat secret repo — nilainya tidak
pernah ditulis di file workflow).

**Salinan ketiga: clone lokal.** Workdir di VM
(`~/workspace/projects/dokter-hp-web`) adalah clone lokal yang
selalu diperbarui. Bila GitHub tidak bisa diakses sementara,
clone lokal tetap bisa dipakai untuk deploy darurat lewat
Wrangler dari mesin lokal.

### 8.3 Inventaris secret (nama saja, tanpa nilai)

Secret **tidak pernah** dicadangkan nilainya. Yang dicadangkan
adalah daftar namanya, agar saat pemulihan darurat tidak ada
secret yang terlupa. Daftar ini disimpan di repo utama (aman,
karena hanya nama):

| Nama secret | Di mana dipakai | Cara mendapatkan ulang bila hilang |
|---|---|---|
| `GEMINI_API_KEY` | Worker — Diagnosis AI | Buat ulang di Google AI Studio |
| `GOOGLE_OAUTH_CLIENT_ID` | Worker — masuk Google | Lihat di Google Cloud Console (bukan rahasia, tetapi dicatat agar tidak tertukar) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Worker — masuk Google | Buat ulang di Google Cloud Console (client secret lama tidak bisa dilihat lagi) |
| Token API Cloudflare | Wrangler / otomasi | Buat ulang di dashboard Cloudflare |

Setelah restore database dan redeploy Worker, periksa bahwa
keempat secret di atas masih terpasang (`npx wrangler secret list`).
Secret tersimpan di akun Cloudflare, bukan di D1 — restore D1
tidak memengaruhi secret. Namun bila akun Cloudflare yang
bermasalah (bukan database), secret harus dibuat ulang satu per
satu dari sumbernya — daftar di atas adalah panduannya.

### 8.4 Yang tidak perlu dicadangkan terpisah

- **Build frontend** (`dist/`) — bisa dibuat ulang dari kode
  dengan `npm run build`.
- **File statis tes kecepatan** (`speedtest-1mb.bin`) — ada di
  repo, bisa dibuat ulang dengan perintah pembuat file.
- **Konfigurasi Pages dan Vercel** — tercatat di repo dan di
  dashboard masing-masing platform; membuat ulang proyek Pages
  atau Vercel dari repo hanya butuh beberapa menit.

---

## 9. RPO dan RTO yang realistis

| Istilah | Arti | Target Dokter HP | Alasan |
|---|---|---|---|
| **RPO** (Recovery Point Objective) — seberapa banyak data yang boleh hilang | Jarak waktu antara backup terakhir dan kejadian | **7 hari** untuk kejadian biasa; **± 0** untuk kejadian terkait deploy besar (karena ada backup pra-deploy) | Jadwal backup mingguan; data yang masuk setelah backup terakhir tidak bisa dipulihkan |
| **RTO** (Recovery Time Objective) — seberapa cepat layanan kembali | Waktu dari keputusan restore sampai layanan normal | **Maksimal 4 jam** | Restore adalah prosedur manual (ekspor, dekripsi, impor, verifikasi, alih binding, deploy ulang); 4 jam memberi ruang untuk satu kali percobaan ulang bila langkah pertama bermasalah |

Kedua angka ini realistis untuk proyek satu orang tanpa layanan
backup berbayar dan tanpa otomasi penuh. Keduanya akan membaik
bila di masa depan ekspor diotomasi (RPO mengecil) dan prosedur
restore dilatih berulang (RTO mengecil).

**Yang tidak dijanjikan:** pemulihan tanpa kehilangan data sama
sekali (RPO nol untuk semua kejadian) tidak mungkin dengan jadwal
mingguan — dan dokumen ini tidak mengklaim demikian. Pengguna
yang datanya masuk setelah backup terakhir akan kehilangan data
tersebut bila restore diperlukan. Kejujuran ini penting agar
keputusan jadwal backup diambil dengan mata terbuka.

---

## 10. Checklist sebelum deploy besar

Deploy besar adalah deploy yang mengubah skema D1, mengubah
logika tulis data, atau merilis fitur baru yang menulis ke
database. Checklist ini dijalankan **sebelum** deploy dimulai.
Bila satu item gagal, deploy ditunda sampai item itu beres.

- [ ] **1. Backup D1 dibuat** — ekspor terbaru (bagian 3.1)
      dibuat hari ini, bukan backup minggu lalu.
- [ ] **2. Backup terverifikasi** — tiga pemeriksaan bagian 3.4
      lolos (file tidak kosong, bisa dibuka, 7 tabel ada).
- [ ] **3. Backup sudah diunggah** ke repo backup privat dan
      commit-nya terlihat di GitHub.
- [ ] **4. Uji restore terakhir masih berlaku** — uji restore
      (lokal atau D1) pernah lolos dalam 30 hari terakhir. Bila
      belum, jalankan uji restore sekarang (bagian 7.4).
- [ ] **5. Migrasi SQL ditinjau** — file migrasi baru dibaca
      ulang; tidak ada `DROP TABLE` atau `DELETE` tanpa `WHERE`
      yang tidak disengaja; migrasi sudah dicoba di database D1
      uji atau SQLite lokal.
- [ ] **6. Rencana kembali disiapkan** — bila deploy gagal,
      langkah kembali sudah jelas: deploy ulang commit sebelumnya
      (`git revert` + deploy) dan, bila data ikut rusak, restore
      dari backup langkah 1 (bagian 7.3).
- [ ] **7. Tag rilis dibuat** — commit yang akan di-deploy diberi
      tag (`git tag vX.Y.Z`) agar titik kembali kode mudah
      ditemukan.
- [ ] **8. Secret terpasang** — `npx wrangler secret list`
      menunjukkan semua secret bagian 8.3 masih ada.
- [ ] **9. Pengguna diberi tahu bila perlu** — bila deploy
      membutuhkan jeda layanan, banner atau pengumuman disiapkan
      sebelum deploy dimulai.
- [ ] **10. Setelah deploy: uji smoke** — buka landing, masuk
      Google, buka dashboard dan riwayat, jalankan satu tes WiFi,
      periksa satu data lama masih terbaca — di kedua mirror
      (Pages dan Vercel).

---

## 11. Tanggung jawab dan jadwal tinjauan

| Tugas | Frekuensi | Pelaksana |
|---|---|---|
| Backup mingguan D1 + verifikasi + unggah | Setiap Minggu, 07:00 WIB | Owner / agen yang ditugaskan |
| Backup pra-deploy besar | Setiap deploy besar | Tim deploy |
| Uji restore lokal | Sebulan sekali | Owner / agen yang ditugaskan |
| Uji restore ke D1 | Setiap tiga bulan | Owner / agen yang ditugaskan |
| Pembersihan retensi | Sebulan sekali (minggu pertama) | Owner / agen yang ditugaskan |
| Tinjauan dokumen ini | Setiap tiga bulan, atau setelah insiden | Koordinator |

Setelah setiap insiden yang membutuhkan restore, dokumen ini
ditinjau dan diperbarui dengan pelajaran dari insiden tersebut
(apa yang berjalan baik, apa yang lambat, apa yang perlu diubah).

---

## 12. Changelog dokumen

### 17 November 2026 — versi awal

- Strategi backup nol rupiah: ekspor D1 mingguan + pra-deploy,
  penyimpanan di repo GitHub privat terpisah (terenkripsi) +
  salinan lokal, retensi 8 mingguan / 6 bulanan / pra-deploy,
  prosedur restore ke database baru dengan verifikasi, mirror
  kode, RPO 7 hari, RTO 4 jam, dan checklist deploy besar.
