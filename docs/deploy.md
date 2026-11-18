# Runbook Deploy: Dokter HP Web App

> **Dokumen ini adalah runbook deploy Dokter HP Web App (full-stack).**
> Bahasa: Bahasa Indonesia. Status: Wave 5 — deploy v1.0 LIVE,
> 18 November 2026 (D1 + KV + Worker + Pages dibuat dan terverifikasi).
>
> Dokumen ini berisi rencana dan langkah deploy, diperbarui dengan
> fakta deploy Wave 5 (bagian 9 memuat perintah deploy ulang persis).
> Setiap langkah dijalankan oleh tim deploy pada waktunya, mengikuti
> urutan di bagian 3.
>
> Dokumen pendamping: `PRODUCT.md` (spesifikasi produk),
> `ARCHITECTURE.md` (arsitektur dan skema D1),
> `docs/keputusan-stack.md` (keputusan teknologi).
>
> **Tidak ada nilai secret/kunci di dokumen ini.** Semua secret
> dimasukkan saat deploy dari sumber aman masing-masing (lihat bagian 6).

---

## 0. Fakta terverifikasi (dasar runbook ini)

Fakta di bawah ini berasal dari Tim Verifikasi Kredensial, terverifikasi
live 17 November 2026. Runbook ini disusun mengacu pada fakta-fakta ini.

### 0.1 Cloudflare — jalur yang berfungsi

| Item | Fakta |
|---|---|
| Akun yang dipakai | hiroohengkerr |
| Account ID | `05928ed4e4ed9643a5665d1e59315abe` |
| Helper yang berfungsi | `cfw_t.py` di `~/workspace/custom-connectors/custom.cloudflare-workers/bin/` |
| Sumber token | File token `~/workspace/temp-mail/secrets/cf-api-token` (0600) |
| Token vault `custom.cloudflare-workers` | **TIDAK VALID** (error 1000). Helper `cfw_api.py` **jangan dipakai**. |
| Endpoint `/user/tokens/verify` | **Memberi negatif palsu** (error 1000) untuk token yang berfungsi ini. **Jangan menilai token dari endpoint verify.** Uji akses dengan panggilan baca fungsional (bagian 0.2). |
| Izin tulis token | **TERUJI LOLOS 18 Nov 2026 (Wave 5)** — D1 `dokter-hp-db`, namespace KV `KV`, Worker `dokter-hp-api`, dan proyek Pages `dokter-hp-web` berhasil dibuat via wrangler dengan token ini. |
| Akun bersama | Akun ini juga menampung produksi lain: Atlys Mail v2, Laras web, Adip Cinema, KasBersama. **Wajib memakai nama Worker/D1/Pages baru yang unik; jangan menyentuh resource yang sudah ada.** Verifikasi nama belum terpakai sebelum membuat (langkah 0.4). |

### 0.2 Cara menguji akses Cloudflare (ganti verify)

Jangan memakai `GET /user/tokens/verify` untuk token ini. Uji akses
dengan panggilan baca fungsional — salah satu di bawah ini cukup:

```bash
CFW=~/workspace/custom-connectors/custom.cloudflare-workers/bin/cfw_t.py
ACCT=05928ed4e4ed9643a5665d1e59315abe

# Daftar Worker yang sudah ada (baca saja, tanpa perubahan)
python3 $CFW GET "/accounts/$ACCT/workers/scripts"

# Atau daftar database D1 yang sudah ada
python3 $CFW GET "/accounts/$ACCT/d1/database"
```

Hasil yang diharapkan: HTTP 200 dengan `"success": true`. Bila hasilnya
error 1000 di endpoint verify tetapi panggilan di atas berhasil, token
dinyatakan berfungsi — anomali verify sudah diketahui dan dicatat.

### 0.3 Uji tulis pertama (wajib, sebelum langkah deploy lain)

Izin tulis token belum teruji. Sebelum membuat resource produksi,
lakukan uji tulis kecil yang aman dan mudah dibersihkan:

1. Buat database D1 uji bernama `dokter-hp-uji-tulis` (langkah 1.1).
2. Jalankan query baca `SELECT 1` pada database itu.
3. Jalankan satu tulis kecil: `CREATE TABLE _uji (id INTEGER);`
   lalu `DROP TABLE _uji;`.
4. Hapus database uji: `DELETE /accounts/$ACCT/d1/database/<database_id>`.

Bila salah satu langkah ditolak dengan 403 / error 9109: **hentikan
semua langkah tulis**, catat endpoint dan pesan galatnya, dan laporkan
ke koordinator. Jangan mencoba jalur lain tanpa persetujuan koordinator.

Bila uji tulis lolos, lanjut ke bagian 1 dengan nama produksi.

**Hasil Wave 5 (18 Nov 2026):** uji tulis dilakukan langsung dengan
membuat resource produksi (`wrangler d1 create dokter-hp-db` +
`wrangler kv namespace create KV`) — keduanya berhasil tanpa galat,
jadi tidak dibuat database uji terpisah. Langkah 0.3 dinyatakan lolos.

### 0.4 Nama resource (baru, unik di akun bersama)

| Resource | Nama yang dipakai | Keterangan |
|---|---|---|
| Database D1 | `dokter-hp-db` | Satu database untuk semua data inti |
| Worker API | `dokter-hp-api` | Nama script Worker |
| Proyek Pages | `dokter-hp-web` | Proyek frontend utama |
| Namespace KV (bila perlu) | `dokter-hp-cache` | Opsional, lihat bagian 1.2 |
| Proyek Vercel | `dokter-hp-web` | Mirror, lihat bagian 2 |

Sebelum membuat masing-masing resource, periksa daftar resource yang
sudah ada (perintah di bagian 0.2 dan 1.1–1.5) dan pastikan nama belum
terpakai. Bila sudah terpakai oleh produksi lain, **jangan memakai atau
mengubahnya** — pilih nama lain dan catat perubahan nama di dokumen ini.

### 0.5 Fakta kredensial lain

| Item | Fakta |
|---|---|
| Kunci Gemini | **VALID** (HTTP 200, 50 model terdaftar). Siap dipakai sebagai secret Worker `GEMINI_API_KEY`. |
| Vercel | **VALID** — akun adiprmx (`adiprmx@gmail.com`). Mirror siap dibuat. |
| GitHub | **VALID** — akun adiprmx. Repo `adiprmx/dokter-hp-web` sudah ada (dibuat tim scaffold); main di snapshot 3 (5690ea46), CI hijau. |

### 0.6 Catatan alat

- **Wrangler TERBUKTI berfungsi dari VM ini (Wave 5, 18 Nov 2026):**
  wrangler 4.164.0 di root repo (`node_modules/.bin/wrangler`) memakai
  proxy egress dan token dari file (`CLOUDFLARE_API_TOKEN` dibaca dari
  `~/workspace/temp-mail/secrets/cf-api-token`) — D1, KV, Worker, dan
  Pages semuanya dibuat/di-deploy lewat wrangler. Jalur utama deploy
  v1.0 adalah wrangler (bagian 9); REST API via `cfw_t.py` tetap
  dipakai untuk baca/verifikasi.
- Helper Vercel: `vercel_api.py` di
  `~/workspace/custom-connectors/custom.legacy-vercel/bin/`.
- Helper GitHub: `gh_api.py` di
  `~/workspace/custom-connectors/custom.legacy-github/bin/`
  (untuk verifikasi repo; pembuatan repo oleh tim scaffold).
- File token `~/workspace/temp-mail/secrets/cf-api-token` **tidak pernah
  ditampilkan, disalin ke log, atau ditulis ke dokumen mana pun.**
  Helper `cfw_t.py` membacanya langsung dari file.

---

## 1. Cloudflare

Semua perintah di bagian ini memakai variabel berikut (sesuaikan shell
sebelum menjalankan):

```bash
CFW=~/workspace/custom-connectors/custom.cloudflare-workers/bin/cfw_t.py
ACCT=05928ed4e4ed9643a5665d1e59315abe
```

### 1.1 D1: buat database + jalankan migrasi

**Langkah 1 — Periksa database yang sudah ada.**

```bash
python3 $CFW GET "/accounts/$ACCT/d1/database"
```

Pastikan tidak ada database bernama `dokter-hp-db`. Bila ada, hentikan
dan laporkan ke koordinator (kemungkinan dibuat oleh pekerjaan lain).

**Langkah 2 — Buat database.**

```bash
python3 $CFW POST "/accounts/$ACCT/d1/database" -d '{"name":"dokter-hp-db"}'
```

Catat `database_id` dari respons. ID ini bukan secret — ID ini dipakai
di `wrangler.toml` (bila ada) dan di binding Worker (bagian 1.3), serta
dicatat di log deploy.

**Langkah 3 — Jalankan migrasi.**

Migrasi adalah satu-satunya sumber kebenaran skema:
`apps/api/migrations/0001_init.sql` s.d.
`0004_pin_rate_sessions.sql` (11 tabel: `users`, `profiles`,
`sessions`, `health_checks`, `wifi_reports`,
`wifi_sustained_samples`, `ai_diagnoses`, `ai_cache`,
`pin_attempts`, `pin_unlocks`, `rate_limits`). JANGAN membuat tabel
manual lewat endpoint query — cuplikan CREATE TABLE manual mudah
menyimpang dari migrasi (pernah salah total: kolom `google_sub`,
`pin_gagal_berturut`, `pin_terkunci_sampai`, dan `updated_at` tidak
ada di 0001).

Jalankan semua migrasi sekaligus dari folder `apps/api`:

```bash
cd apps/api
npx wrangler d1 migrations apply dokter-hp-db --remote
```

Perintah ini menerapkan 0001–0004 secara berurutan dan mencatat
migrasi yang sudah diterapkan, sehingga aman dijalankan ulang
(migrasi yang sama tidak diterapkan dua kali). Baca outputnya:
keempat file harus berstatus diterapkan tanpa galat sebelum lanjut.
Perintah remote membutuhkan wrangler terautentikasi
(`CLOUDFLARE_API_TOKEN` dari token akun yang sama dengan `cfw_t.py`).

Bila wrangler remote tidak bisa dipakai, jalankan ISI FILE migrasi
apa adanya lewat endpoint query D1, berurutan 0001 → 0004, dan baca
hasil tiap file sebelum lanjut ke file berikutnya. Jangan pernah
menulis ulang SQL migrasi dengan tangan — file migrasi adalah
sumber kebenaran.

**Langkah 4 — Verifikasi skema.**

```bash
python3 $CFW POST "/accounts/$ACCT/d1/database/$DBID/query" \
  -d '{"sql":"SELECT name FROM sqlite_master WHERE type = '\''table'\'' ORDER BY name;"}'
```

Hasil yang diharapkan: sebelas tabel terdaftar — `ai_cache`,
`ai_diagnoses`, `health_checks`, `pin_attempts`, `pin_unlocks`,
`profiles`, `rate_limits`, `sessions`, `users`, `wifi_reports`,
`wifi_sustained_samples`.

**Langkah 5 — Catat hasil.**

Catat `database_id` dan tanggal migrasi di log deploy. Jangan menulis
isi data pengguna ke log mana pun.

**Fakta Wave 5 (18 Nov 2026):** `database_id`
`6b43e7b2-ab24-48a4-abf9-ff8cae97f397` (region ENAM); migrasi
0001–0004 diterapkan, 11 tabel aplikasi terverifikasi
(`ai_cache`, `ai_diagnoses`, `health_checks`, `pin_attempts`,
`pin_unlocks`, `profiles`, `rate_limits`, `sessions`, `users`,
`wifi_reports`, `wifi_sustained_samples`) + 1 tabel internal
Cloudflare `_cf_KV`.

Catatan: migrasi berikutnya (bila ada) memakai file bernomor lanjut
(`0002_...sql`) dan dijalankan dengan cara yang sama. Migrasi bersifat
aditif dan kompatibel mundur — tidak ada `DROP TABLE` pada migrasi
produksi (lihat bagian 5.3).

### 1.2 KV: buat namespace (hanya bila perlu)

KV **tidak wajib untuk rilis pertama**. `ARCHITECTURE.md` menetapkan KV
hanya untuk data yang jarang berubah, dan tidak ada pemakaian KV yang
diputuskan untuk rilis pertama (sesi disimpan di D1 karena KV writes
hanya 1.000/hari). Buat namespace hanya bila tim implementasi memutuskan
ada data yang disimpan di KV.

```bash
# Periksa namespace yang sudah ada
python3 $CFW GET "/accounts/$ACCT/storage/kv/namespaces"

# Buat namespace (hanya bila diputuskan perlu)
python3 $CFW POST "/accounts/$ACCT/storage/kv/namespaces" -d '{"title":"dokter-hp-cache"}'
```

Catat namespace ID dari respons untuk binding Worker (bagian 1.3).
Bila KV tidak dipakai, lewati bagian ini sepenuhnya — Worker tetap
berjalan tanpa binding KV.

**Fakta Wave 5 (18 Nov 2026):** namespace KV dibuat via
`wrangler kv namespace create KV` — title `KV` (bukan
`dokter-hp-cache` seperti rencana awal), id
`347a1871fb464e92ac7e1e079134a062`, binding `KV` di `wrangler.toml`.

### 1.3 Worker: deploy script + bindings via API

**Langkah 1 — Bangun bundle Worker.**

Dari folder `apps/api`, bangun satu file JavaScript dengan bundler
(contoh memakai esbuild; sesuaikan dengan tooling yang dipakai tim
implementasi):

```bash
cd apps/api
npx esbuild src/index.ts --bundle --format=esm \
  --outfile=dist/worker.js --target=es2022 --platform=browser
```

Hasil: `apps/api/dist/worker.js`. Simpan salinan bundle ini sebagai
artefak rilis (lihat bagian 5.2 — rollback Worker memakai bundle
sebelumnya).

**Langkah 2 — Siapkan metadata binding.**

Binding menghubungkan Worker ke D1 (dan KV bila dipakai). Contoh
metadata untuk upload:

```json
{
  "main_module": "worker.js",
  "compatibility_date": "2026-11-17",
  "bindings": [
    {
      "type": "d1",
      "name": "DB",
      "database_id": "<database_id dari bagian 1.1>",
      "database_name": "dokter-hp-db"
    },
    {
      "type": "kv_namespace",
      "name": "CACHE",
      "namespace_id": "<namespace_id dari bagian 1.2>"
    },
    {
      "type": "plain_text",
      "name": "GOOGLE_CLIENT_ID",
      "text": "<client ID Google OAuth — bukan secret>"
    }
  ]
}
```

Keterangan:

- Nama binding (`DB`, `CACHE`) harus cocok dengan nama yang dibaca kode
  Worker (`env.DB`, `env.CACHE`). Sesuaikan dengan implementasi.
- Binding KV dicantumkan hanya bila namespace KV dibuat (bagian 1.2).
- `GOOGLE_CLIENT_ID` adalah nilai publik (bukan secret), sehingga boleh
  sebagai `plain_text`. Secret (`GEMINI_API_KEY`,
  `GOOGLE_CLIENT_SECRET`, `PIN_PEPPER`) **tidak** dicantumkan di
  metadata — secret diatur terpisah di bagian 1.4.
- `compatibility_date` sesuaikan dengan tanggal rilis (contoh di atas
  memakai tanggal dokumen ini).

**Langkah 3 — Upload script.**

```bash
python3 $CFW PUT "/accounts/$ACCT/workers/scripts/dokter-hp-api" \
  -F 'metadata={"main_module":"worker.js","compatibility_date":"2026-11-17","bindings":[{"type":"d1","name":"DB","database_id":"<database_id>","database_name":"dokter-hp-db"},{"type":"plain_text","name":"GOOGLE_CLIENT_ID","text":"<client ID>"}]};type=application/json' \
  -F 'worker.js=@apps/api/dist/worker.js;type=application/javascript+module'
```

Hasil yang diharapkan: HTTP 200 dengan `"success": true`.

Catatan: setiap upload ulang menimpa script yang sedang berjalan.
Pastikan secret sudah diatur (bagian 1.4) sebelum pengujian — upload
script tidak menghapus secret yang sudah ada.

**Langkah 4 — Aktifkan subdomain workers.dev.**

```bash
# Lihat subdomain akun
python3 $CFW GET "/accounts/$ACCT/workers/subdomain"

# Aktifkan workers.dev untuk Worker ini
python3 $CFW PUT "/accounts/$ACCT/workers/scripts/dokter-hp-api/subdomain" \
  -d '{"enabled": true}'
```

URL API menjadi `https://dokter-hp-api.<subdomain>.workers.dev`.
Catat URL lengkap ini — URL ini adalah nilai `VITE_API_BASE_URL` untuk
frontend (bagian 1.5 dan 2) dan basis URL verifikasi (bagian 4).

Bila di kemudian hari tersedia custom domain untuk API, tambahkan route
custom domain dan perbarui `VITE_API_BASE_URL` di kedua mirror, lalu
deploy ulang frontend. Custom domain bukan bagian rilis pertama.

**Langkah 5 — Verifikasi Worker.**

```bash
curl -s https://dokter-hp-api.<subdomain>.workers.dev/api/health
curl -s https://dokter-hp-api.<subdomain>.workers.dev/api/ping
```

Hasil yang diharapkan: HTTP 200 (lihat detail di bagian 4.1).

**Fakta Wave 5 (18 Nov 2026):** Worker di-deploy via
`wrangler deploy` dari `apps/api` (bukan upload REST API manual —
wrangler membaca binding + vars dari `wrangler.toml`). URL API:
`https://dokter-hp-api.hiroohengkerr.workers.dev`
(subdomain akun: `hiroohengkerr`). Smoke test: `/api/health` 200
(`"status":"ok"`), `/api/ping` 200, `/api/auth/status` 200
(`google_tersedia:false` — jujur, OAuth belum ada, K-89).

### 1.4 Secret Worker

Tiga secret wajib diatur sebagai secret Worker. Nilai secret **tidak
pernah** ditulis di dokumen, di repo, di `wrangler.toml`, atau di log.
Nilai dimasukkan saat deploy dari sumber amannya masing-masing
(lihat bagian 6).

| Secret | Sumber nilai |
|---|---|
| `GEMINI_API_KEY` | Kunci Gemini yang sudah terverifikasi valid (Tim Verifikasi Kredensial, 17 Nov 2026) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console — client secret dari OAuth client yang dibuat untuk proyek ini |
| `PIN_PEPPER` | Dibangkitkan acak saat deploy (minimal 32 byte, dari generator acak kriptografis); dipakai sebagai pepper HMAC-SHA256 untuk hash PIN (K-71). Bila tidak diatur, endpoint PIN mengembalikan 500 (fail-closed) |

**Fakta Wave 5 (18 Nov 2026):** `GEMINI_API_KEY` + `PIN_PEPPER`
diatur via `wrangler secret put` dari `apps/api`
(`PIN_PEPPER` dibangkitkan baru dengan `openssl rand -hex 32`).
`GOOGLE_CLIENT_SECRET` **TIDAK** diatur — OAuth client belum ada
(K-89); aplikasi jalan dengan keadaan jujur
(`/api/auth/status` → `google_tersedia:false`).

**Cara mengatur (REST API):**

```bash
# Satu perintah per secret; <nilai> diisi saat deploy dari sumber aman
python3 $CFW PUT "/accounts/$ACCT/workers/scripts/dokter-hp-api/secrets" \
  -d '{"name":"GEMINI_API_KEY","text":"<nilai>","type":"secret_text"}'

python3 $CFW PUT "/accounts/$ACCT/workers/scripts/dokter-hp-api/secrets" \
  -d '{"name":"GOOGLE_CLIENT_SECRET","text":"<nilai>","type":"secret_text"}'

python3 $CFW PUT "/accounts/$ACCT/workers/scripts/dokter-hp-api/secrets" \
  -d '{"name":"PIN_PEPPER","text":"<nilai>","type":"secret_text"}'
```

Hasil yang diharapkan per perintah: HTTP 200 dengan `"success": true`.

**Cara memeriksa (tanpa membaca nilai):**

```bash
python3 $CFW GET "/accounts/$ACCT/workers/scripts/dokter-hp-api/secrets"
```

Respons hanya menampilkan nama secret dan tipe — nilai tidak pernah
dikembalikan API. Pastikan ketiga nama di atas terdaftar.

**Cara alternatif:** `wrangler secret put <NAMA>` dari folder `apps/api`
(bila wrangler terbukti berfungsi dari VM ini). Nilai dibaca dari stdin
interaktif, bukan dari argumen perintah.

**Catatan penting:**

- Mengatur secret tidak me-restart Worker secara eksplisit — Worker
  memakai secret terbaru pada request berikutnya. Uji endpoint
  `/api/ai/diagnose` setelah secret diatur (bagian 4.2).
- `PIN_PEPPER` yang hilang atau berubah berarti SEMUA PIN tersimpan
  tidak bisa diverifikasi lagi (hash memakai pepper sebagai kunci
  HMAC). Simpan salinannya di tempat aman yang sama dengan secret
  lain (di luar repo), dan JANGAN PERNAH merotasi `PIN_PEPPER`
  setelah ada pengguna yang mengatur PIN — rotasi hanya aman sebelum
  peluncuran, saat belum ada PIN tersimpan.
- Rotasi secret: atur ulang dengan perintah yang sama memakai nilai
  baru; tidak perlu deploy ulang script. Pengecualian: `PIN_PEPPER`
  tidak boleh dirotasi setelah ada PIN tersimpan (lihat di atas).

### 1.5 Pages: buat proyek + sambung GitHub + atur build + env

Prasyarat: repo GitHub `adiprmx/dokter-hp-web` sudah dibuat oleh tim
scaffold dan berisi kode frontend (monorepo: frontend di `apps/web`).
Bila scaffold memilih tata letak lain (frontend di root repo),
sesuaikan `root_dir` di bawah.

> **K-90 (Wave 5, 18 Nov 2026):** integrasi Git native dan GitHub
> Actions **DITUNDA pasca-v1.0** (butuh OAuth dashboard / repo secret;
> peluncuran live adalah prioritas; tidak ada double-deploy). Jalur
> deploy Pages v1.0 = **deploy langsung via wrangler** (bagian 9).
> Langkah 2–4 di bawah ini tetap berlaku bila integrasi Git native
> diaktifkan nanti; untuk v1.0, proyek Pages dibuat tanpa `source`
> GitHub (direct upload) dan di-deploy dengan
> `wrangler pages deploy apps/web/dist --project-name=dokter-hp-web`.
> **Fakta Wave 5:** proyek `dokter-hp-web` dibuat via
> `wrangler pages project create dokter-hp-web`; URL produksi
> `https://dokter-hp-web.pages.dev`.

**Langkah 1 — Periksa proyek Pages yang sudah ada.**

```bash
python3 $CFW GET "/accounts/$ACCT/pages/projects"
```

Pastikan tidak ada proyek bernama `dokter-hp-web`. Bila ada, hentikan
dan laporkan ke koordinator.

**Langkah 2 — Buat proyek Pages dan sambungkan ke repo GitHub.**

```bash
python3 $CFW POST "/accounts/$ACCT/pages/projects" -d '{
  "name": "dokter-hp-web",
  "production_branch": "main",
  "build_config": {
    "build_command": "npm run build",
    "destination_dir": "dist",
    "root_dir": "apps/web"
  },
  "source": {
    "type": "github",
    "config": {
      "owner": "adiprmx",
      "repo_name": "dokter-hp-web",
      "production_branch": "main",
      "deployments_enabled": true,
      "production_deployments_enabled": true,
      "preview_deployment_setting": "all",
      "pr_comments_enabled": true
    }
  }
}'
```

Catatan:

- Penyambungan GitHub via API membutuhkan **aplikasi GitHub Cloudflare
  terpasang di repo**. Bila API menolak konfigurasi `source`, lakukan
  penyambungan lewat dashboard Cloudflare (Pages → Create project →
  Connect to Git) sebagai langkah manual, dengan pengaturan build yang
  sama seperti di atas.
- Pengaturan build: perintah `npm run build`, direktori output `dist`,
  direktori root `apps/web` (monorepo).
- Pilih **salah satu** jalur deploy Pages: integrasi Git native (bagian
  ini) **atau** GitHub Actions (bagian 7). Jangan aktifkan keduanya
  bersamaan — keduanya akan men-deploy pada push yang sama. Bila
  GitHub Actions dipilih, buat proyek tanpa `source` (direct upload)
  dan biarkan Actions yang men-deploy.

**Langkah 3 — Atur variabel lingkungan Pages.**

Variabel frontend (lihat bagian 6): `VITE_API_BASE_URL` mengarah ke URL
Worker dari bagian 1.3 langkah 4.

```bash
python3 $CFW PATCH "/accounts/$ACCT/pages/projects/dokter-hp-web" -d '{
  "deployment_configs": {
    "production": {
      "env_vars": {
        "VITE_API_BASE_URL": {
          "value": "https://dokter-hp-api.<subdomain>.workers.dev",
          "type": "plain_text"
        }
      }
    },
    "preview": {
      "env_vars": {
        "VITE_API_BASE_URL": {
          "value": "https://dokter-hp-api.<subdomain>.workers.dev",
          "type": "plain_text"
        }
      }
    }
  }
}'
```

Catatan penamaan: `ARCHITECTURE.md` (bagian 2.3, 6.2, dan 7) menetapkan
nama variabel `VITE_API_BASE_URL`. Nama inilah yang dipakai di seluruh
runbook ini. Bila ada dokumen lain yang menyebut `VITE_API_URL`, nama
tersebut tidak dipakai — satu nama dipakai konsisten di Pages, Vercel,
dan kode frontend.

**Langkah 4 — Picu deploy pertama.**

- Bila integrasi Git native dipakai: push ke branch `main` memicu
  build dan deploy otomatis. Pantau di dashboard Pages atau lewat API:

```bash
python3 $CFW GET "/accounts/$ACCT/pages/projects/dokter-hp-web/deployments"
```

- Bila GitHub Actions dipakai: push ke `main` menjalankan workflow
  bagian 7; deploy terjadi dari Actions.

Hasil yang diharapkan: deployment berstatus sukses; URL produksi
`https://dokter-hp-web.pages.dev` dapat dibuka (lihat bagian 4.3).

---

## 2. Vercel mirror

Prasyarat: repo GitHub `adiprmx/dokter-hp-web` sudah ada; akun Vercel
adiprmx terverifikasi valid. Vercel hanya menyajikan frontend yang sama
— API tetap ke Worker yang sama, tidak ada API kedua.

Helper:

```bash
VAPI=~/workspace/custom-connectors/custom.legacy-vercel/bin/vercel_api.py
```

**Langkah 1 — Buat proyek dari repo yang sama.**

```bash
python3 $VAPI POST "/v9/projects" -d '{
  "name": "dokter-hp-web",
  "framework": "vite",
  "rootDirectory": "apps/web",
  "gitRepository": {
    "type": "github",
    "repo": "adiprmx/dokter-hp-web"
  }
}'
```

Catatan:

- Penyambungan repo via API membutuhkan integrasi GitHub Vercel
  terpasang di akun. Bila API menolak `gitRepository`, buat proyek
  lewat dashboard Vercel (Add New → Project → Import dari repo
  `adiprmx/dokter-hp-web`), dengan framework preset Vite dan root
  directory `apps/web`.
- Pengaturan build mengikuti preset Vite: build command
  `npm run build`, output directory `dist`.
- Nama proyek Vercel disarankan sama dengan Pages (`dokter-hp-web`)
  agar mudah dikenali; URL menjadi
  `https://dokter-hp-web.vercel.app` (atau sesuai ketersediaan nama).

**Langkah 2 — Atur variabel lingkungan (sama dengan Pages).**

```bash
# Ganti <project_id> dengan id proyek dari respons langkah 1
python3 $VAPI POST "/v10/projects/<project_id>/env" -d '{
  "key": "VITE_API_BASE_URL",
  "value": "https://dokter-hp-api.<subdomain>.workers.dev",
  "type": "plain",
  "target": ["production", "preview"]
}'
```

Nilai `VITE_API_BASE_URL` harus sama persis dengan nilai di Pages —
kedua mirror memanggil Worker API yang sama.

**Langkah 3 — Picu deploy pertama.**

Push ke branch `main` memicu deploy otomatis di Vercel (bila repo
tersambung). Pantau di dashboard Vercel atau lewat API:

```bash
python3 $VAPI GET "/v6/deployments?projectId=<project_id>&limit=5"
```

Hasil yang diharapkan: deployment berstatus `READY`; URL
`https://dokter-hp-web.vercel.app` dapat dibuka (lihat bagian 4.3).

---

## 3. Urutan deploy yang benar

Urutan ini wajib diikuti — setiap tahap bergantung pada tahap
sebelumnya. Jangan melompati tahap.

| # | Tahap | Bagian | Gerbang lanjut |
|---|---|---|---|
| 0 | Verifikasi akses Cloudflare (baca fungsional, **bukan** `/user/tokens/verify`) | 0.2 | Panggilan baca berhasil |
| 0 | Uji tulis pertama (buat D1 + KV produksi) | 0.3 | Uji tulis lolos; bila gagal, hentikan dan laporkan |
| 0 | Pastikan repo `adiprmx/dokter-hp-web` sudah dibuat tim scaffold | 0.5 | Repo ada dan berisi kode |
| 1 | Buat database D1 `dokter-hp-db` | 1.1 | `database_id` tercatat |
| 2 | Jalankan migrasi 0001–0004 | 1.1 | 11 tabel terverifikasi |
| 3 | Buat namespace KV (hanya bila diputuskan perlu) | 1.2 | Namespace ID tercatat / dilewati dengan sadar |
| 4 | Deploy Worker via `wrangler deploy` (binding + vars dari `wrangler.toml`) | 1.3, 9.1 | Deploy sukses; `/api/health` merespons |
| 5 | Atur secret Worker (`GEMINI_API_KEY`, `PIN_PEPPER`; `GOOGLE_CLIENT_SECRET` ditunda, K-89) | 1.4 | Kedua secret terdaftar |
| 6 | Aktifkan subdomain workers.dev; catat URL API | 1.3 | URL API tercatat |
| 7 | Buat proyek Pages + build + deploy langsung via wrangler (K-90; Git native ditunda) | 1.5, 9 | Deploy pertama sukses |
| 8 | Buat proyek Vercel + env yang sama | 2 | Deploy pertama sukses (`READY`) |
| 9 | Verifikasi pasca-deploy di kedua mirror | 4 | Semua cek lolos |
| 10 | Catat URL, ID resource, dan tanggal deploy di log deploy | — | Log lengkap |

Ketergantungan kunci:

- Worker tidak bisa diuji penuh sebelum D1 + migrasi ada.
- Frontend tidak bisa dibangun dengan benar sebelum URL API diketahui
  (`VITE_API_BASE_URL` dibaca saat build).
- Vercel dibuat setelah Pages agar nilai env yang sama bisa dipakai
  ulang tanpa menebak.

---

## 4. Verifikasi pasca-deploy

Ganti `<api>` dengan URL Worker (`https://dokter-hp-api.<subdomain>.workers.dev`),
`<pages>` dengan URL Pages (`https://dokter-hp-web.pages.dev`), dan
`<vercel>` dengan URL Vercel (`https://dokter-hp-web.vercel.app`).

### 4.1 Worker API (tanpa login)

| # | Cek | Perintah / cara | Hasil yang diharapkan |
|---|---|---|---|
| 1 | Liveness | `curl -s <api>/api/health` | HTTP 200, body memuat `"status": "ok"` |
| 2 | Latensi HTTP | `curl -s <api>/api/ping` | HTTP 200, body memuat `"ok": true` dan angka `t` (ms) |
| 3 | OAuth redirect | Buka `<api>/api/auth/google` di browser | Redirect 302 ke halaman login Google (`accounts.google.com`) |
| 4 | Endpoint lindung tanpa sesi | `curl -s -o /dev/null -w "%{http_code}" <api>/api/health-checks` | HTTP 401 |
| 5 | Endpoint lindung tanpa sesi | `curl -s -o /dev/null -w "%{http_code}" <api>/api/wifi-reports` | HTTP 401 |
| 6 | Endpoint lindung tanpa sesi | `curl -s -o /dev/null -w "%{http_code}" <api>/api/auth/me` | HTTP 401 |
| 7 | Rute tidak dikenal | `curl -s -o /dev/null -w "%{http_code}" <api>/tidak-ada` | HTTP 404 dengan envelope galat JSON standar |

### 4.2 Worker API (dengan login — uji smoke manual)

Lakukan sekali setelah deploy pertama, memakai akun Google penguji:

| # | Cek | Hasil yang diharapkan |
|---|---|---|
| 1 | Masuk dengan Google (dari landing Pages) | Redirect ke Google, kembali ke `/dashboard`, sesi bertahan setelah muat ulang halaman |
| 2 | `GET /api/auth/me` | HTTP 200, berisi id, nama, email, `pin_diatur` |
| 3 | Buat satu `health_checks` (Diagnosis satu ketuk) | HTTP 201, skor tersimpan; muncul di riwayat |
| 4 | Buat satu `wifi_reports` (tes WiFi) + 30 sampel tes bertahan | HTTP 201; sampel tersimpan; grafik tampil |
| 5 | `POST /api/ai/diagnose` dengan satu pertanyaan | HTTP 200, jawaban tampil dan tersimpan ke riwayat diagnosis (membuktikan `GEMINI_API_KEY` berfungsi) |
| 6 | Atur PIN, tutup sesi, buka PIN | PIN benar membuka; PIN salah ditolak; kunci 30 detik setelah 5 salah berturut-turut |
| 7 | Keluar | Sesi terhapus; `/api/auth/me` kembali 401 |
| 8 | Ubah PIN dari sesi terkunci (R-02) | Tanpa PIN lama ditolak (`PIN_LAMA_DIPERLUKAN`); dengan PIN lama berhasil dan sesi TETAP terkunci — buka lewat `/kunci` |

Bila langkah 5 gagal dengan pesan "Diagnosis AI sedang tidak tersedia",
periksa secret `GEMINI_API_KEY` (bagian 1.4) dan log Worker sebelum
menyimpulkan ada masalah lain.

### 4.3 Frontend — kedua mirror

Jalankan cek yang sama di `<pages>` dan `<vercel>`:

| # | Cek | Hasil yang diharapkan |
|---|---|---|
| 1 | Landing `/` | HTTP 200; judul dan penjelasan produk tampil; tombol masuk dan "Coba tes WiFi tanpa akun" tampil |
| 2 | File tes kecepatan `/speedtest-1mb.bin` | HTTP 200; ukuran berkas ±1 MB |
| 3 | Rute SPA `/dashboard` (muat langsung) | HTTP 200 (bukan 404); aplikasi dimuat, lalu mengarah ke login bila belum masuk |
| 4 | Rute SPA `/wifi`, `/riwayat`, `/pengaturan` | Masing-masing HTTP 200 |
| 5 | Tes WiFi tanpa akun (dari landing) | Kecepatan unduh dan latensi HTTP tampil sebagai angka ukur nyata |
| 6 | Banner "Tidak tersambung ke server" | **Tidak tampil** saat API sehat |
| 7 | Konsol browser | Tanpa galat JavaScript yang menghentikan aplikasi |
| 8 | Tampilan HP (lebar 360 px) | Tata letak rapi, tanpa geser horizontal, area sentuh cukup besar |

### 4.4 CORS + header keamanan (preflight)

| # | Cek | Perintah / cara | Hasil yang diharapkan |
|---|---|---|---|
| 1 | Preflight dari origin Pages | `curl -s -D - -o /dev/null -X OPTIONS <api>/api/auth/me -H "Origin: <pages>" -H "Access-Control-Request-Method: GET"` | Header `Access-Control-Allow-Origin: <pages>` hadir |
| 2 | Preflight dari origin asing | Perintah yang sama dengan `-H "Origin: https://jahat.example.com"` | TIDAK ADA header `Access-Control-Allow-Origin` (fail-closed, K-73) |
| 3 | Header keamanan Worker | `curl -s -D - -o /dev/null <api>/api/auth/me` | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` hadir |
| 4 | Header keamanan Pages | `curl -s -D - -o /dev/null <pages>/` | CSP yang sama hadir; `connect-src` memuat origin API |
| 5 | Mutasi dari origin asing | `curl -s -o /dev/null -w "%{http_code}" -X POST <api>/api/auth/pin/verify -H "Origin: https://jahat.example.com" -H "Content-Type: application/json" -d '{"pin":"1357"}'` | HTTP 403 (bukan 401) |

Setelah URL API final diketahui (bagian 1.3 langkah 4), persempit
`connect-src` di `apps/web/public/_headers`: ganti wildcard
`https://*.workers.dev` dengan origin API persis
(`https://dokter-hp-api.<subdomain>.workers.dev`), lalu deploy ulang
frontend. Wildcard hanya placeholder agar aplikasi berfungsi sebelum
subdomain diketahui — bukan konfigurasi akhir.

### 4.5 Kriteria lolos

Deploy dinyatakan lolos bila seluruh cek 4.1, 4.3, 4.4, dan 4.2 (sekali,
setelah deploy pertama) berhasil di kedua mirror. Bila ada cek yang
gagal, perbaiki penyebabnya dan ulangi cek yang gagal — jangan
menyatakan deploy selesai dengan cek yang masih gagal.

---

## 5. Rollback

### 5.1 Pages — kembali ke deploy sebelumnya

**Cara 1 — Dashboard (paling cepat):** buka proyek `dokter-hp-web` di
dashboard Cloudflare → Deployments → pilih deployment sebelumnya yang
diketahui baik → Rollback.

**Cara 2 — API (aktifkan ulang deployment lama):**

```bash
# Daftar deployment, catat id deployment sebelumnya yang baik
python3 $CFW GET "/accounts/$ACCT/pages/projects/dokter-hp-web/deployments"

# Kembalikan deployment tersebut menjadi produksi
python3 $CFW POST "/accounts/$ACCT/pages/projects/dokter-hp-web/deployments/<deployment_id>/restore"
```

**Cara 3 — Git (bila cara 1–2 tidak tersedia):** kembalikan kode ke
commit sebelumnya yang diketahui baik (`git revert` pada commit yang
bermasalah, lalu push ke `main`) — integrasi Git akan men-deploy ulang
versi sebelumnya. Cara ini juga berlaku bila deploy memakai GitHub
Actions (bagian 7).

Setelah rollback, ulangi cek bagian 4.3.

### 5.2 Worker — kembali ke bundle sebelumnya

Worker tidak punya tombol rollback satu klik lewat REST API yang
dipakai runbook ini. Cara rollback adalah **mengunggah ulang bundle
sebelumnya yang diketahui baik** — karena itu setiap bundle rilis wajib
disimpan sebagai artefak (di repo pada folder `releases/` atau sebagai
artefak GitHub Actions, dengan nama berisi tanggal dan commit).

```bash
# Unggah ulang bundle sebelumnya dengan metadata binding yang sama
python3 $CFW PUT "/accounts/$ACCT/workers/scripts/dokter-hp-api" \
  -F 'metadata={...sama seperti bagian 1.3...};type=application/json' \
  -F 'worker.js=@releases/worker-<tanggal>-<commit>.js;type=application/javascript+module'
```

Catatan:

- Secret tidak terpengaruh oleh upload ulang script — secret yang sudah
  diatur tetap berlaku.
- Bila masalah berasal dari secret yang baru diubah (misalnya kunci
  baru yang salah), perbaiki dengan mengatur ulang secret ke nilai yang
  benar (bagian 1.4), tanpa deploy ulang script.
- Setelah rollback, ulangi cek bagian 4.1.

### 5.3 D1 — tidak ada rollback otomatis

D1 tidak menyediakan rollback skema otomatis. Aturan yang berlaku:

- **Migrasi bersifat aditif dan kompatibel mundur.** Migrasi tidak
  menghapus tabel/kolom yang masih dipakai kode yang sedang berjalan.
  Perubahan yang menghapus sesuatu dilakukan dalam dua tahap
  (tahap 1: kode berhenti memakai kolom; tahap 2, pada rilis
  berikutnya: kolom dihapus).
- **Bila migrasi salah:** perbaiki dengan migrasi koreksi baru
  (forward fix, file `0002_...sql`), bukan dengan membatalkan migrasi
  lama. Tulis koreksinya, uji di database uji, lalu terapkan ke
  produksi.
- **Sebelum migrasi berisiko:** buat cadangan isi database terlebih
  dahulu (ekspor D1 bila tersedia, atau salin tabel penting ke tabel
  cadangan `backup_<nama>_<tanggal>` di database yang sama), dan catat
  langkah pemulihannya.
- Menghapus database D1 adalah tindakan destruktif dan tidak bisa
  dibatalkan — hanya dilakukan atas keputusan koordinator, setelah
  cadangan diverifikasi.

### 5.4 Vercel — kembali ke deployment sebelumnya

**Cara 1 — Dashboard:** buka proyek di dashboard Vercel →
Deployments → pilih deployment sebelumnya → Promote to Production.

**Cara 2 — Git:** kembalikan kode ke commit sebelumnya yang baik
(`git revert`, push ke `main`) — Vercel men-deploy ulang versi
sebelumnya.

Setelah rollback, ulangi cek bagian 4.3 di URL Vercel.

---

## 6. Daftar variabel lingkungan lengkap

Tidak ada nilai di tabel ini — hanya nama, sumber, dan status wajib /
opsional. Nilai diisi saat deploy dari sumber yang tercantum.

### 6.1 Frontend — Pages dan Vercel (build-time, terekspos ke browser)

| Nama | Sumber | Wajib / opsional | Keterangan |
|---|---|---|---|
| `VITE_API_BASE_URL` | URL Worker dari bagian 1.3 langkah 4 | **Wajib** | Basis URL API Worker. Nilai sama di Pages dan Vercel. Satu-satunya variabel `VITE_*` yang dipakai. |

Peringatan: variabel berawalan `VITE_*` ikut terbungkus ke dalam bundle
frontend dan bisa dibaca siapa saja yang membuka situs. **Jangan pernah**
menaruh kunci, secret, atau token pada variabel `VITE_*`.

### 6.2 Worker — variabel biasa (plain text, bukan secret)

| Nama | Sumber | Wajib / opsional | Keterangan |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console — OAuth client proyek ini | **Wajib** | Client ID publik Google OAuth. Boleh sebagai `plain_text` di metadata binding. |
| `GOOGLE_REDIRECT_URI` | URL Worker dari bagian 1.3 langkah 4 + `/api/auth/google/callback` | **Wajib** | Bukan rahasia (terlihat di URL OAuth). Harus cocok persis dengan redirect URI yang didaftarkan di Google Cloud Console. |
| `ALLOWED_ORIGIN` | Domain Pages produksi (dan mirror Vercel, bila ada) | **Wajib** | Daftar origin frontend yang boleh memanggil API, dipisah koma (K-73). Bila tidak diatur, Worker hanya mengizinkan origin loopback / sama-host (fail-closed) — frontend produksi tidak bisa memanggil API. |
| `FRONTEND_URL` | Domain Pages produksi | **Wajib** | Basis URL frontend; dipakai untuk redirect setelah masuk Google dan validasi tujuan redirect (R-06). |
| `GEMINI_MODEL` | Diputuskan tim implementasi | Opsional | Nama model Gemini yang dipakai. Bila tidak diatur, Worker memakai nilai default di kode. |

Nilai `ALLOWED_ORIGIN` dan `FRONTEND_URL` di `wrangler.toml` saat ini
masih placeholder (`https://dokter-hp-web.pages.dev`) — tim deploy
WAJIB menggantinya dengan domain sebenarnya sebelum deploy pertama,
dan menambahkan domain mirror Vercel ke `ALLOWED_ORIGIN` (dipisah
koma) bila mirror dipakai. Setelah deploy, verifikasi CORS dengan
preflight dari §4.4.

**Fakta Wave 5 (18 Nov 2026):** placeholder SUDAH diganti dengan
nilai asli — `ALLOWED_ORIGIN =
"https://dokter-hp-web.pages.dev,https://dokter-hp-web.vercel.app"`
(multi-origin K-73c), `FRONTEND_URL =
"https://dokter-hp-web.pages.dev"`, `GOOGLE_REDIRECT_URI =
"https://dokter-hp-api.hiroohengkerr.workers.dev/api/auth/google/callback"`,
`GEMINI_MODEL = "gemini-3.5-flash-lite"`.

### 6.3 Worker — secret (secret_text, tidak pernah ke browser/repo)

| Nama | Sumber | Wajib / opsional | Keterangan |
|---|---|---|---|
| `GEMINI_API_KEY` | Kunci Gemini (terverifikasi valid, 17 Nov 2026) | **Wajib** | Kunci API Gemini untuk Diagnosis AI. Hanya dipakai server-side di Worker. |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console — OAuth client proyek ini | **Wajib** | Client secret Google OAuth; dipakai saat penukaran kode di server. |
| `PIN_PEPPER` | Dibangkitkan acak saat deploy (minimal 32 byte) | **Wajib** | Pepper HMAC-SHA256 untuk hash PIN (K-71). Bila tidak diatur, endpoint PIN mengembalikan 500. JANGAN dirotasi setelah ada PIN tersimpan. Simpan salinannya di tempat aman di luar repo. |

### 6.4 GitHub Actions — secrets dan variables repo

Dipakai hanya bila deploy Pages memakai GitHub Actions (bagian 7).

| Nama | Jenis | Sumber | Wajib / opsional |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret repo | Token akun hiroohengkerr (token yang sama dengan yang dipakai `cfw_t.py`; nilainya diatur di pengaturan repo, tidak pernah ditulis di file) | **Wajib** (bila memakai Actions) |
| `CLOUDFLARE_ACCOUNT_ID` | Secret repo | Account ID `05928ed4e4ed9643a5665d1e59315abe` | **Wajib** (bila memakai Actions) |
| `VITE_API_BASE_URL` | Variable repo | URL Worker (nilai publik, bukan secret) | **Wajib** (bila memakai Actions) |

---

## 7. Template GitHub Actions — deploy Pages

Simpan sebagai `.github/workflows/deploy-pages.yml` di repo
`adiprmx/dokter-hp-web`. Template ini memakai secrets GitHub — **tidak
ada secret yang ditulis langsung di file ini.**

Pilih salah satu jalur deploy Pages: template ini **atau** integrasi Git
native (bagian 1.5). Jangan aktifkan keduanya bersamaan.

```yaml
name: Deploy Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - name: Ambil kode
        uses: actions/checkout@v4

      - name: Siapkan Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: apps/web/package-lock.json

      - name: Pasang dependensi
        run: npm ci

      - name: Build frontend
        run: npm run build
        env:
          VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}

      - name: Deploy ke Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: dokter-hp-web
          directory: apps/web/dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

Catatan template:

- `VITE_API_BASE_URL` diambil dari **variables** repo (`vars`), bukan
  secrets — URL API adalah nilai publik.
- `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` diambil dari
  **secrets** repo. Atur keduanya di repo: Settings → Secrets and
  variables → Actions. Token yang dipakai adalah token akun
  hiroohengkerr (token yang sama dengan yang dipakai `cfw_t.py`).
- `working-directory: apps/web` mengikuti tata letak monorepo
  (frontend di `apps/web`). Bila scaffold memilih tata letak lain,
  sesuaikan `working-directory`, `cache-dependency-path`, dan
  `directory`.
- Bila proyek Pages dibuat tanpa `source` GitHub (direct upload),
  workflow ini adalah satu-satunya jalur deploy Pages.
- Workflow ini hanya men-deploy Pages. Deploy Worker tetap dilakukan
  lewat REST API (bagian 1.3) karena membutuhkan bundle dan binding
  yang disiapkan terpisah.

---

## 8. Risiko dan catatan akhir

1. **Izin tulis token Cloudflare TERUJI LOLOS (Wave 5, 18 Nov 2026).**
   Uji tulis pertama (bagian 0.3) lolos — D1, KV, Worker, dan Pages
   berhasil dibuat. Bila suatu saat token ditolak tulis (403 /
   error 9109), hentikan deploy dan laporkan ke koordinator.
2. **Akun Cloudflare dipakai bersama produksi lain.** Nama resource
   baru wajib unik; dilarang mengubah atau menghapus resource yang
   sudah ada. Periksa daftar resource sebelum membuat yang baru.
3. **Endpoint `/user/tokens/verify` memberi negatif palsu** untuk
   token ini. Penilaian kesehatan token memakai panggilan baca
   fungsional (bagian 0.2), bukan endpoint verify.
4. **Repo GitHub sudah ada** (dibuat tim scaffold; main di snapshot 3,
   CI hijau). Langkah Pages dan Vercel tidak lagi menunggu scaffold.
5. **Google OAuth client belum dibuat.** `GOOGLE_CLIENT_ID` dan
   `GOOGLE_CLIENT_SECRET` membutuhkan OAuth client di Google Cloud
   Console (gratis, tanpa kartu) dengan redirect URI ke
   `<api>/api/auth/google/callback`. Pembuatan client adalah prasyarat
   bagian 1.3–1.4; bila belum ada, Worker tetap bisa di-deploy, tetapi
   login Google belum bisa diuji sampai client dibuat dan secret
   diatur.
6. **Wrangler teruji penuh dari VM ini** (Wave 5, 18 Nov 2026):
   D1, KV, Worker, dan Pages semuanya di-deploy via wrangler
   4.164.0. REST API via `cfw_t.py` tetap dipakai untuk
   baca/verifikasi; migrasi D1 remote memakai
   `wrangler d1 migrations apply --remote` (bagian 1.1 langkah 3).
7. **Kuota D1 free tier** (terverifikasi 17 Nov 2026): 5 juta baris
   dibaca/hari, 100 ribu baris ditulis/hari, 500 MB per database.
   Bila kuota habis, query galat sampai reset 00:00 UTC — tanpa
   tagihan karena tidak ada kartu yang terpasang.
8. **KV writes 1.000/hari** — alasan sesi disimpan di D1, bukan KV.
   Jangan memindahkan sesi ke KV di kemudian hari tanpa meninjau
   ulang batas ini.

## 9. Deploy ulang v1.0 (K-90)

Jalur deploy v1.0 = **deploy langsung via wrangler** dari VM ini.
Integrasi Git native Pages dan GitHub Actions **DITUNDA pasca-v1.0**
(K-90: butuh OAuth dashboard / repo secret; peluncuran live adalah
prioritas; tidak ada double-deploy). Perintah di bawah ini adalah
perintah persis yang dipakai Wave 5 (18 Nov 2026) dan dipakai ulang
untuk setiap deploy ulang.

Prasyarat (sekali per shell):

```bash
export CLOUDFLARE_API_TOKEN="$(cat ~/workspace/temp-mail/secrets/cf-api-token)"
export CLOUDFLARE_ACCOUNT_ID=05928ed4e4ed9643a5665d1e59315abe
# Wrangler 4.164.0 di root repo:
WR=~/workspace/projects/dokter-hp-web/node_modules/.bin/wrangler
```

### 9.1 Worker API (deploy ulang)

```bash
cd ~/workspace/projects/dokter-hp-web/apps/api
$WR deploy
# URL: https://dokter-hp-api.hiroohengkerr.workers.dev
```

### 9.2 Frontend Pages (deploy ulang)

```bash
cd ~/workspace/projects/dokter-hp-web
VITE_API_BASE_URL=https://dokter-hp-api.hiroohengkerr.workers.dev npm run build
$WR pages deploy apps/web/dist --project-name=dokter-hp-web
# URL: https://dokter-hp-web.pages.dev
```

Proyek Pages dibuat sekali saja (sudah dibuat Wave 5 — flag
`--production-branch` WAJIB, tanpanya wrangler gagal exit 1):

```bash
$WR pages project create dokter-hp-web --production-branch main
```

### 9.3 Migrasi D1 (bila ada file migrasi baru)

```bash
cd ~/workspace/projects/dokter-hp-web/apps/api
$WR d1 migrations apply dokter-hp-db --remote
```

### 9.4 Secret (bila perlu diatur ulang)

```bash
cd ~/workspace/projects/dokter-hp-web/apps/api
$WR secret put GEMINI_API_KEY < ~/workspace/secrets/gemini-api-key.txt
openssl rand -hex 32 | $WR secret put PIN_PEPPER   # HANYA sebelum ada PIN tersimpan (K-71)
```

`GOOGLE_CLIENT_SECRET` TIDAK diatur sampai OAuth client dibuat (K-89).
Nilai secret tidak pernah dicetak ke log.

### 9.5 Verifikasi pasca-deploy ulang

```bash
API=https://dokter-hp-api.hiroohengkerr.workers.dev
curl -s $API/api/health        # 200, "status":"ok"
curl -s $API/api/ping          # 200, "ok":true
curl -s $API/api/auth/status   # 200, google_tersedia:false (sampai OAuth ada)
curl -sI https://dokter-hp-web.pages.dev   # 200
```

---

## Changelog dokumen

### 18 November 2026 — deploy v1.0 Wave 5 (Tim Deploy Cloudflare)

- §0.1/§0.3: izin tulis token TERUJI LOLOS (D1 + KV + Worker +
  Pages dibuat via wrangler); uji tulis memakai resource produksi.
- §0.5/§0.6: repo sudah ada; wrangler 4.164.0 terbukti berfungsi
  dari VM — jalur utama deploy v1.0.
- §1.1/§1.2/§1.3/§1.4: fakta Wave 5 — `database_id`
  `6b43e7b2-…`, KV id `347a1871…`, Worker
  `https://dokter-hp-api.hiroohengkerr.workers.dev`, secret
  `GEMINI_API_KEY` + `PIN_PEPPER` diatur, `GOOGLE_CLIENT_SECRET`
  tidak diatur (K-89).
- §1.5 + §9 (baru): K-90 — deploy Pages v1.0 via wrangler langsung;
  integrasi Git native / GitHub Actions ditunda pasca-v1.0.
  Perintah deploy ulang persis di §9.
- §6.2: placeholder `wrangler.toml` sudah diganti nilai asli
  (multi-origin K-73c).
- §4.4: `connect-src` Pages dipersempit ke origin Worker persis
  (K-78) — wildcard `*.workers.dev` dihapus dari `_headers`.

### 18 November 2026 — perbaikan keamanan Wave 4 (Tim Blue)

- §1.1 langkah 3: HAPUS cuplikan CREATE TABLE `users` manual (salah
  total vs 0001) — migrasi dijalankan via
  `wrangler d1 migrations apply --remote` (0001–0004, 11 tabel);
  langkah 4 diperbarui ke 11 tabel.
- §1.4 + §6.3: `SESSION_SECRET` DIHAPUS (tidak dipakai kode —
  state OAuth adalah nilai acak di cookie HttpOnly, dibandingkan
  waktu-konstan); diganti secret `PIN_PEPPER` (K-71) + larangan
  rotasi setelah ada PIN tersimpan.
- §6.2: tambah `GOOGLE_REDIRECT_URI`, `ALLOWED_ORIGIN`,
  `FRONTEND_URL` (K-73) + catatan placeholder wajib diganti.
- §4.2: tambah cek smoke R-02 (ubah PIN dari sesi terkunci).
- §4.4 (baru): verifikasi CORS preflight + header keamanan +
  runbook mempersempit `connect-src` Pages ke origin API persis;
  "Kriteria lolos" menjadi §4.5.

### 17 November 2026 — versi awal

- Runbook deploy lengkap: Cloudflare (D1, KV, Worker, secret, Pages),
  mirror Vercel, urutan deploy, verifikasi pasca-deploy, rollback,
  daftar variabel lingkungan, dan template GitHub Actions.
- Disesuaikan dengan hasil Tim Verifikasi Kredensial (17 Nov 2026):
  token vault `custom.cloudflare-workers` tidak valid; jalur berfungsi
  adalah akun hiroohengkerr via `cfw_t.py` + file token; anomali
  negatif palsu `/user/tokens/verify`; izin tulis belum teruji
  (uji tulis pertama wajib); akun bersama dengan produksi lain
  (nama resource baru wajib unik); kunci Gemini valid; Vercel dan
  GitHub valid; repo belum dibuat.
