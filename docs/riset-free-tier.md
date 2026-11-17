# Riset Free-Tier — Dokter HP Web App

**Tanggal pengecekan:** 17 November 2026
**Disusun oleh:** Tim Riset Free-Tier Lanjutan
**Konteks stack:** Cloudflare Pages + Workers + D1 + KV (utama), mirror Vercel, AI Gemini server-side, autentikasi Google OAuth.

> Aturan penulisan dokumen ini: setiap angka berasal dari sumber yang dibaca pada tanggal cek dan disertai URL sumber. Angka yang tidak ditemukan di sumber mana pun ditulis sebagai **tidak ditemukan**. Angka dari sumber sekunder (bukan dokumentasi resmi penyedia) ditandai secara eksplisit.

## Ringkasan limit yang sudah terverifikasi koordinator (17 November 2026)

Limit berikut diverifikasi oleh koordinator sebelum riset ini dan dicantumkan sebagai konteks, bukan hasil pengecekan dokumen ini:

| Layanan | Limit free tier |
|---|---|
| Cloudflare Workers | 100.000 request/hari |
| Cloudflare D1 | 5.000.000 baris dibaca/hari; 100.000 tulis/hari; 500 MB per database |
| Cloudflare KV | 100.000 baca/hari; 1.000 tulis/hari |

---

## 1. Cloudflare Pages (Free)

Sumber utama (resmi, dibaca langsung 17 November 2026): <https://developers.cloudflare.com/pages/platform/limits/> — halaman diperbarui 5 September 2026.

| Batas | Free | Keterangan |
|---|---|---|
| Build per bulan | 500 | Dihitung per akun, bukan per proyek |
| Build bersamaan (concurrent) | 1 | Build berikutnya antre |
| Timeout per build | 20 menit | Berlaku untuk semua paket |
| Bandwidth | Tidak terbatas | Halaman limit resmi tidak mencantumkan batas bandwidth; halaman produk Pages menyatakan semua paket termasuk bandwidth tanpa batas |
| Request aset statis | Tidak terbatas | Permintaan ke aset statis gratis dan tidak terbatas |
| Proyek per akun | 100 | Batas ini tidak rutin dinaikkan oleh Cloudflare |
| Domain kustom per proyek | 100 | Dihitung per proyek |
| File per situs | 20.000 | Paket berbayar: 100.000 (dengan variabel `PAGES_WRANGLER_MAJOR_VERSION=4`) |
| Ukuran maksimum per file | 25 MiB | Berlaku untuk semua paket |
| Preview deployment aktif | Tidak terbatas | — |
| Redirect di file `_redirects` | 2.100 total (2.000 statis + 100 dinamis) | — |
| Menit build per bulan | Tidak ditemukan | Pages memakai satuan jumlah build, bukan menit build. Satuan menit build hanya berlaku untuk produk terpisah, Workers Builds (sumber sekunder menyebut 3.000 menit/bulan untuk Workers Free) |
| Pembatasan akun baru | Tidak ditemukan angkanya | Cloudflare membatasi jumlah proyek baru yang dapat dibuat dalam 48 jam pertama, tanpa memublikasikan angkanya; pembatasan lepas otomatis setelah 48 jam |

### Pages Functions

Halaman limit resmi menyatakan: permintaan ke Pages Functions dihitung terhadap kuota paket Workers, termasuk permintaan dari Function ke binding KV atau Durable Objects. Artinya, begitu situs memakai kode server (API route, SSR, middleware, autentikasi), batas yang berlaku adalah batas Workers Free:

| Batas | Free |
|---|---|
| Request Functions per hari | 100.000 (berbagi kuota dengan Workers; reset tengah malam UTC) |
| Waktu CPU per request | 10 ms |
| Subrequest per pemanggilan | 50 |

Sumber angka Functions (sekunder, merujuk dokumentasi Workers dan diverifikasi silang oleh beberapa sumber): <https://temps.sh/blog/cloudflare-pages-free-tier-limits-2026> (dicek 7 Oktober 2026 terhadap dokumentasi resmi); <https://www.cloudhim.com/cloudflare/cloudflare-pages-free-tier-small-saas> (dicek 4 November 2026).

Catatan: dokumentasi Cloudflare saat ini merekomendasikan proyek baru dimulai dengan Workers, bukan Pages. Pages tetap didukung, dan rekomendasi tersebut tidak mengubah limit di atas.

---

## 2. Vercel Hobby (Free) 2026

Sumber utama (resmi, dibaca langsung 17 November 2026): <https://vercel.com/docs/plans/hobby> — halaman diperbarui 12 November 2026.

| Batas | Hobby (Free) |
|---|---|
| Harga | US$0, tanpa siklus penagihan |
| Fast Data Transfer (bandwidth ke pengunjung) | 100 GB pertama per bulan |
| Fast Origin Transfer | 10 GB pertama per bulan |
| CDN Requests | 1.000.000 pertama per bulan |
| Function Invocations | 1.000.000 pertama per bulan |
| Active CPU | 4 CPU-jam per bulan |
| Provisioned Memory | 360 GB-jam per bulan |
| Durasi maksimum function | 300 detik (5 menit) |
| Jumlah proyek | 200 |
| Deployment per hari | 100 |
| Domain per proyek | 50 |
| Build bersamaan | 1 (sumber sekunder; tidak tercantum di halaman Hobby resmi yang dibaca) |
| Mesin build | 2 vCPU, RAM 8 GB, disk 64 GB |
| Waktu build maksimum per deployment | 45 menit (sumber sekunder; tidak tercantum di halaman Hobby resmi yang dibaca) |
| Menit build per bulan | Tidak ditemukan di halaman resmi Hobby yang dibaca. Sumber sekunder (Maret–Mei 2026) menyebut 6.000 menit/bulan, tetapi angka ini tidak terkonfirmasi di dokumentasi resmi terbaru |
| Web Analytics | 50.000 event/bulan, data 1 bulan |
| Image Transformations | 5.000 pertama per bulan |
| Runtime Logs | 1 jam |

Sumber sekunder untuk build: <https://deploywise.dev/blog/vercel-free-tier-limits-2026> (Maret 2026); <https://www.promptstoproduct.com/vercel-free-tier-limits> (Mei 2026).

### Yang terjadi saat limit terlampaui

Dokumentasi resmi menyatakan: karena Hobby adalah free tier, tidak ada siklus penagihan. Pada umumnya, jika limit terlampaui, pengguna harus menunggu hingga 30 hari berlalu sebelum dapat memakai fitur tersebut lagi. Tidak ada tagihan kejutan. Situs yang dijeda menampilkan error `503 DEPLOYMENT_PAUSED` kepada pengunjung (sumber sekunder: <https://convika.com/compare/vercel-hobby-limits/>, dibaca 14 November 2026).

### Batasan penggunaan komersial

Hobby hanya untuk penggunaan pribadi non-komersial. Pedoman Fair Use Vercel menyatakan tim Hobby dibatasi untuk penggunaan pribadi non-komersial, dan semua penggunaan komersial memerlukan paket Pro atau Enterprise. Penggunaan komersial didefinisikan sebagai deployment yang dipakai untuk keuntungan finansial siapa pun yang terlibat dalam bagian mana pun dari produksi proyek, termasuk karyawan atau konsultan berbayar yang menulis kode. Sumber (sekunder, mengutip dokumentasi resmi): <https://www.sofast.host/blog/is-vercel-free/> (dicek 22 September 2026); <https://roamerhost.com/en/support/apphost-vercel-free-limits> (dicek November 2026).

### Catatan perbedaan angka antar sumber

Beberapa artikel lama menyebut 100.000 invokasi function per bulan dan timeout function 10 detik. Angka-angka tersebut sudah kedaluwarsa: dokumentasi resmi Vercel yang dibaca 17 November 2026 mencantumkan 1.000.000 invokasi per bulan dan durasi maksimum 300 detik. Dokumen ini memakai angka dokumentasi resmi terbaru.

---

## 3. Gemini API Free Tier 2026

### Peringatan penting tentang angka

Dokumentasi resmi Google (ai.google.dev) **tidak memublikasikan angka per model** untuk free tier di halaman publiknya. Halaman rate limit resmi menyatakan bahwa angka RPM/TPM/RPD per model hanya dapat dilihat di halaman rate limit dalam Google AI Studio (memerlukan login), dan bahwa limit yang tercantum tidak dijamin dan kapasitas aktual dapat bervariasi. Sumber: <https://www.developersdigest.tech/models/free-api/google> (dicek 18 Oktober 2026); <https://zukko.pro/en/blog/gemini-api-besplatno-free-tier> (membaca ai.google.dev 18 Oktober 2026); <https://federicocalo.dev/en/blog/gemini-api-tiers-limits-privacy> (diperbarui 13 November 2026); <https://www.datastudios.org/post/google-ai-studio-free-plans-and-trials-access-tiers-usage-limits-and-upgrade-paths-in-late-2025> (diperbarui 4 November 2026).

Konsekuensi: angka pada tabel di bawah ini berasal dari sumber sekunder terbaru dan **wajib dikonfirmasi di halaman rate limit AI Studio proyek yang dipakai** sebelum dijadikan dasar perencanaan kapasitas.

### Model yang tersedia di free tier

Berdasarkan halaman harga resmi Gemini Developer API (per November 2026), model berikut tercantum sebagai gratis (free of charge) pada free tier: Gemini 3.8 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash-Lite, Gemini 3.1 Flash-Lite, Gemini 4 Hydrogen, serta model Live dan transkripsi. Sumber: <https://www.datastudios.org/post/google-ai-studio-free-plans-and-trials-access-tiers-usage-limits-and-upgrade-paths-in-late-2025>; <https://www.scriptbyai.com/gemini-api-free-tier-limits/> (diperbarui 13 November 2026).

**Tidak tersedia di free tier:** Gemini 4 Argon, Gemini 4 Carbon, Gemini 3.1 Pro (termasuk Preview), Gemini Omni Flash, dan semua model gambar Nano Banana. Batch API dan Flex juga tidak tersedia di free tier. Sumber: <https://www.developersdigest.tech/models/free-api/google>; <https://www.scriptbyai.com/gemini-api-rate-limits/> (diperbarui 12 November 2026).

### Tabel limit (sumber sekunder, diperbarui 12–13 November 2026)

RPM = request per menit; TPM = token input per menit; RPD = request per hari.

| Model | RPM | TPM | RPD |
|---|---|---|---|
| Gemini 4 Hydrogen | 5 | 250.000 | 20 |
| Gemini 3.8 Flash | 5 | 250.000 | 20 |
| Gemini 3.6 Flash | 5 | 250.000 | 20 |
| Gemini 3.5 Flash-Lite | 10 | 250.000 | 500 |
| Gemini 3.1 Flash-Lite | 10 | 250.000 | 500 |

Sumber: <https://www.scriptbyai.com/gemini-api-rate-limits/> (diperbarui 12 November 2026); <https://www.scriptbyai.com/gemini-api-free-tier-limits/> (diperbarui 13 November 2026).

### Aturan penghitungan kuota

- Limit berlaku **per proyek Google Cloud, bukan per API key**. Membuat API key kedua dalam proyek yang sama tidak menambah kuota.
- Melampaui salah satu dari RPM, TPM, atau RPD akan menghasilkan error `429 RESOURCE_EXHAUSTED`, meskipun dua limit lainnya masih tersedia.
- RPD direset pada tengah malam waktu Pasifik.
- Limit RPM dan TPM memakai jendela bergulir (rolling window), bukan menit kalender.
- Model eksperimental dan preview memiliki limit yang lebih ketat.
- Limit yang dipublikasikan tidak dijamin; kapasitas aktual dapat bervariasi.
- Batas token harian (TPD): tidak ditemukan di sumber yang dibaca.

Sumber: <https://www.scriptbyai.com/gemini-api-rate-limits/>; <https://www.datastudios.org/post/google-ai-studio-free-plans-and-trials-access-tiers-usage-limits-and-upgrade-paths-in-late-2025>; <https://federicocalo.dev/en/blog/gemini-api-tiers-limits-privacy>.

### Perbedaan angka dengan sumber lama

Sumber yang lebih lama menyebut angka yang jauh lebih besar, misalnya Gemini 1.5 Flash 15 RPM / 1.000.000 TPM / 1.500 RPD (sumber: <https://infkey.com/how-to-use-gemini-free-7-steps-limits-2026>, Oktober 2026) dan Gemini 2.5 Flash 10 RPM / 250 RPD (sumber: <https://mono-ai.uk/blog/gemini-free-tier-rate-limits>, Juni 2026). Perbedaan ini mencerminkan perubahan model dan kebijakan Google sepanjang 2026, termasuk penghapusan model Pro dari free tier pada April 2026 dan penurunan kuota harian model Flash menjadi 20 RPD pada akhir 2026. Dokumen ini memakai angka terbaru (November 2026) sebagai acuan utama, dengan catatan wajib konfirmasi di AI Studio.

### Catatan privasi free tier

Konten yang dikirim melalui free tier dapat dipakai Google untuk meningkatkan produknya, termasuk peninjauan oleh manusia. Jangan mengirim data pribadi (PII) atau data rahasia melalui free tier. Pada tier berbayar, konten secara eksplisit tidak dipakai untuk pelatihan. Sumber: <https://www.developersdigest.tech/models/free-api/google>; <https://publicapis.io/blog/is-gemini-api-free-lwle> (6 November 2026).

### Syarat tier

Free tier berlaku untuk proyek aktif atau masa uji coba gratis, tanpa kartu kredit. Naik ke Tier 1 berbayar memerlukan akun Cloud Billing dan prabayar minimum US$5. Mengaktifkan Cloud Billing pada sebuah proyek akan memindahkan proyek tersebut dari free tier ke harga bayar-per-pakai. Sumber: <https://www.developersdigest.tech/models/free-api/google>; <https://www.freetoolapps.com/blog/how-to-use-gemini-for-free>.

---

## 4. Google OAuth (Google Cloud Console)

### Syarat membuat OAuth client

- Yang dibutuhkan hanyalah **akun Google** dan **proyek Google Cloud**. Membuat proyek GCP dan OAuth client **gratis dan tidak memerlukan akun penagihan atau kartu kredit**. Penagihan hanya diperlukan saat memakai API Google Cloud berbayar.
- Sumber: <https://github.com/bakissation/mcp-google-multi/blob/HEAD/docs/google-cloud-setup.md> ("Creating it is free and needs no billing account"); <https://docs.onetapwoo.com/getting-started/google-cloud-setup> ("You don't need to add billing information or pay anything"); <https://www.socialmati.com/docs/integrations/google> ("No fee for the OAuth client"); <https://www.bmator.com/content/platform-mail-gmail-own-client/> ("Google Cloud does not require a billing account or payment for these configurations").

### Langkah singkat membuat Client ID

Berdasarkan dokumentasi resmi Google (Manage OAuth Clients): <https://support.google.com/cloud/answer/15549257> (dibaca melalui hasil pencarian 17 November 2026).

1. Buka Google Cloud Console dan buat proyek baru (atau pilih proyek yang sudah ada).
2. Daftarkan aplikasi di Google Auth Platform: isi nama aplikasi, email dukungan, dan informasi kontak. Pilih tipe pengguna **External** agar siapa pun dengan akun Google dapat masuk (tipe Internal hanya untuk organisasi Google Workspace).
3. Di halaman **Google Auth Platform → Clients**, klik **Create client**.
4. Pilih tipe aplikasi **Web application**.
5. Isi **Authorized JavaScript origins** (domain aplikasi, misalnya domain produksi dan localhost untuk pengembangan) dan **Authorized redirect URIs** (URL callback login).
6. Klik **Create**. Google menampilkan **Client ID** dan **Client Secret**.
7. Simpan Client Secret segera di tempat aman (misalnya secret manager). Google hanya menampilkan secret secara lengkap satu kali saat pembuatan; secret tidak dapat dilihat lagi setelahnya.

Catatan tambahan dari dokumentasi resmi: OAuth client yang tidak aktif selama enam bulan akan dihapus secara otomatis. Sejak April 2025, client secret hanya terlihat dan dapat diunduh pada saat pembuatan.

### Mode Testing vs Production

| Aspek | Testing | Production (In production) |
|---|---|---|
| Siapa yang dapat masuk | Maksimal 100 test user yang didaftarkan secara eksplisit berdasarkan alamat email | Semua pengguna dengan akun Google |
| Masa berlaku refresh token | Kedaluwarsa 7 hari setelah persetujuan (pengguna harus login ulang setiap minggu) | Tidak ada kedaluwarsa 7 hari |
| Layar peringatan | Pengguna melihat layar "aplikasi ini belum diverifikasi" | Layar peringatan hilang setelah verifikasi selesai; sebelum verifikasi, pengguna tetap melihat layar peringatan tetapi dapat melanjutkan |
| Verifikasi Google | Tidak diperlukan | Diperlukan bila aplikasi meminta scope sensitif atau terbatas; tidak wajib bila hanya meminta scope non-sensitif |

Sumber: <https://docs.nango.dev/docs/api-integrations/google-shared/google-security-review>; <https://pewterkit.com/guides/app-has-not-completed-google-verification> (Oktober 2026); <https://oauthseus.vercel.app/guides/google>; <https://docs.lansweeper.com/docs/google-docs-connector>.

### Pengecualian penting untuk login dasar

Jika aplikasi hanya meminta scope `openid`, `email`, dan `profile` (nama, alamat email, foto profil — persis kebutuhan login Dokter HP), pengguna tidak perlu masuk daftar test user dan otorisasi mereka tidak kedaluwarsa setelah 7 hari, meskipun aplikasi masih berstatus Testing. Daftar test user dan kedaluwarsa 7 hari berlaku bila aplikasi meminta scope lain (Gmail, Drive, Calendar, dan sebagainya). Sumber: <https://pewterkit.com/guides/app-has-not-completed-google-verification>.

### Verifikasi aplikasi

- Scope non-sensitif saja (`openid`, `email`, `profile`): verifikasi scope tidak wajib. Verifikasi merek (brand verification, ringan) diperlukan agar nama dan logo aplikasi tampil di layar persetujuan.
- Scope sensitif: verifikasi merek ditambah verifikasi scope, termasuk video demo alur OAuth. Estimasi Google sekitar 10 hari kerja.
- Scope terbatas (restricted, misalnya membaca Gmail atau akses penuh Drive): verifikasi ditambah penilaian keamanan CASA tahunan oleh vendor yang disetujui Google, berbayar. Estimasi sekitar 6 minggu (laporan komunitas 3–12 minggu).
- Aplikasi yang belum terverifikasi dan meminta scope sensitif/terbatas dibatasi sekitar 100 pengguna total hingga verifikasi selesai.
- Untuk Dokter HP yang hanya memakai login dasar, verifikasi scope sensitif/terbatas tidak relevan.

Sumber: <https://docs.nango.dev/docs/api-integrations/google-shared/google-security-review>; <https://pewterkit.com/guides/app-has-not-completed-google-verification>; <https://oauthseus.vercel.app/guides/google>.

### Catatan

- Batas 100 test user bersifat permanen per proyek: penghitung tidak dapat direset dan test user tidak dapat dihapus. Google merekomendasikan proyek terpisah untuk pengembangan dan produksi agar masing-masing mendapat kuota 100 test user sendiri.
- Setelah aplikasi dipublikasikan ke Production, status dapat dikembalikan ke Testing bila diperlukan.

---

## 5. Ringkasan risiko: limit yang paling mungkin habis duluan

Urutan risiko dari yang paling mungkin habis duluan, berdasarkan arsitektur Dokter HP (AI Gemini server-side untuk setiap diagnosis, data di D1/KV, hosting utama Pages, mirror Vercel, login Google OAuth):

### Risiko 1 — Kuota harian Gemini API (KRITIS)

**Limit:** 20 request/hari untuk model Flash (3.8/3.6 Flash, 4 Hydrogen) atau 500 request/hari untuk Flash-Lite, per proyek. Ini adalah limit paling ketat di seluruh stack, dengan selisih yang sangat besar dari limit lainnya.

**Dampak:** dengan 20 request/hari, aplikasi hanya dapat melayani 20 diagnosis AI per hari untuk seluruh pengguna. Satu pengguna yang aktif dapat menghabiskan kuota harian sendirian. Setelah habis, semua diagnosis AI gagal dengan error 429 hingga reset tengah malam waktu Pasifik.

**Mitigasi:**
- Pakai model Flash-Lite (500 RPD) sebagai model utama, bukan Flash standar (20 RPD).
- Simpan jawaban AI di KV/D1 dan pakai kembali untuk pertanyaan yang sama atau mirip (cache diagnosis), sehingga satu request Gemini dapat melayani banyak pengguna.
- Batasi jumlah diagnosis AI per pengguna per hari di sisi server (misalnya antrean dan jatah harian).
- Sediakan jalur diagnosis tanpa AI (aturan berbasis gejala dan basis pengetahuan lokal) sebagai fallback saat kuota habis, agar aplikasi tetap berguna.
- Tampilkan status kuota secara jujur kepada pengguna saat layanan AI tidak tersedia.
- Konfirmasi angka kuota aktual di halaman rate limit AI Studio sebelum peluncuran, karena angka resmi tidak dipublikasikan dan dapat berubah.

### Risiko 2 — Tulis KV 1.000/hari (TINGGI)

**Limit:** 1.000 tulis KV per hari (terverifikasi koordinator). Setiap cache diagnosis, sesi, atau pencatatan yang menulis ke KV mengonsumsi kuota ini.

**Mitigasi:** gabungkan penulisan (batch), simpan data yang sering berubah di D1 (100.000 tulis/hari), pakai KV hanya untuk cache yang jarang berubah, dan tetapkan TTL agar entri lama kedaluwarsa tanpa tulis hapus manual.

### Risiko 3 — Batas 100 test user OAuth bila aplikasi belum dipublikasikan (TINGGI pada tahap peluncuran)

**Limit:** 100 test user dan refresh token kedaluwarsa 7 hari pada mode Testing. Namun pengecualian berlaku: bila aplikasi hanya meminta scope `openid`, `email`, `profile`, batas tersebut tidak berlaku (lihat Bagian 4).

**Mitigasi:** minta scope login dasar saja; publikasikan aplikasi ke Production sebelum peluncuran publik; daftarkan domain dan siapkan kebijakan privasi sejak awal.

### Risiko 4 — Request Workers/Functions 100.000/hari (SEDANG)

**Limit:** 100.000 request/hari untuk Workers dan Pages Functions gabungan. Setiap panggilan API, termasuk yang gagal karena kuota Gemini habis, tetap mengonsumsi kuota ini.

**Mitigasi:** cache respons di edge selama mungkin, gabungkan panggilan API, dan pastikan endpoint yang gagal karena kuota Gemini tidak dipanggil berulang kali oleh client (backoff dan pesan error yang jelas).

### Risiko 5 — Bandwidth Vercel 100 GB/bulan pada mirror (RENDAH–SEDANG)

**Limit:** 100 GB Fast Data Transfer per bulan pada paket Hobby; setelah terlampaui, fitur dijeda hingga 30 hari. Risiko ini hanya menyangkut mirror, bukan hosting utama.

**Mitigasi:** jadikan Pages (bandwidth tidak terbatas) sebagai hosting utama dan Vercel hanya sebagai mirror cadangan; optimalkan ukuran aset (kompresi gambar, minifikasi); pantau pemakaian di dashboard Vercel.

### Risiko 6 — Build Pages 500/bulan dan build Vercel (RENDAH)

**Limit:** 500 build/bulan di Pages (sekitar 16 build/hari) dan 100 deployment/hari di Vercel. Angka ini jauh di atas ritme rilis normal sebuah aplikasi.

**Mitigasi:** hindari deployment otomatis untuk setiap commit kecil selama pengembangan intensif; gabungkan perubahan sebelum deploy.

### Risiko 7 — CPU Workers 10 ms per request (RENDAH–SEDANG, teknis)

**Limit:** 10 ms waktu CPU per request pada Workers Free. Pemanggilan API eksternal (misalnya Gemini) tidak mengonsumsi waktu CPU selama menunggu respons, tetapi pemrosesan berat di dalam Worker (parsing besar, transformasi data) dapat melampaui batas.

**Mitigasi:** jaga logika Worker tetap ringan; pindahkan pemrosesan berat ke client atau lakukan secara asinkron; uji beban dengan request nyata sebelum peluncuran.

---

## Daftar sumber

| No | Sumber | Dibaca | Keterangan |
|---|---|---|---|
| 1 | <https://developers.cloudflare.com/pages/platform/limits/> | 17 Nov 2026 | Resmi Cloudflare; diperbarui 5 Sep 2026 |
| 2 | <https://vercel.com/docs/plans/hobby> | 17 Nov 2026 | Resmi Vercel; diperbarui 12 Nov 2026 |
| 3 | <https://support.google.com/cloud/answer/15549257> | 17 Nov 2026 | Resmi Google; langkah membuat OAuth client |
| 4 | <https://www.scriptbyai.com/gemini-api-rate-limits/> | 17 Nov 2026 | Sekunder; tabel limit Gemini, diperbarui 12 Nov 2026 |
| 5 | <https://www.scriptbyai.com/gemini-api-free-tier-limits/> | 17 Nov 2026 | Sekunder; free tier Gemini, diperbarui 13 Nov 2026 |
| 6 | <https://www.developersdigest.tech/models/free-api/google> | 17 Nov 2026 | Sekunder; dokumentasi resmi tidak memublikasikan angka per model |
| 7 | <https://federicocalo.dev/en/blog/gemini-api-tiers-limits-privacy> | 17 Nov 2026 | Sekunder; tier dan privasi Gemini, diperbarui 13 Nov 2026 |
| 8 | <https://www.datastudios.org/post/google-ai-studio-free-plans-and-trials-access-tiers-usage-limits-and-upgrade-paths-in-late-2025> | 17 Nov 2026 | Sekunder; limit AI Studio, diperbarui 4 Nov 2026 |
| 9 | <https://zukko.pro/en/blog/gemini-api-besplatno-free-tier> | 17 Nov 2026 | Sekunder; membaca ai.google.dev 18 Okt 2026 |
| 10 | <https://docs.nango.dev/docs/api-integrations/google-shared/google-security-review> | 17 Nov 2026 | Sekunder; verifikasi aplikasi Google dan mode Testing |
| 11 | <https://pewterkit.com/guides/app-has-not-completed-google-verification> | 17 Nov 2026 | Sekunder; mode Testing, 100 test user, pengecualian scope dasar |
| 12 | <https://oauthseus.vercel.app/guides/google> | 17 Nov 2026 | Sekunder; proses OAuth dan verifikasi |
| 13 | <https://temps.sh/blog/cloudflare-pages-free-tier-limits-2026> | 17 Nov 2026 | Sekunder; limit Functions/Workers, dicek 7 Okt 2026 |
| 14 | <https://www.cloudhim.com/cloudflare/cloudflare-pages-free-tier-small-saas> | 17 Nov 2026 | Sekunder; limit Pages dan Functions, dicek 4 Nov 2026 |
| 15 | <https://www.sofast.host/blog/is-vercel-free/> | 17 Nov 2026 | Sekunder; aturan non-komersial Hobby, dicek 22 Sep 2026 |
| 16 | <https://roamerhost.com/en/support/apphost-vercel-free-limits> | 17 Nov 2026 | Sekunder; limit Hobby, dicek Nov 2026 |
| 17 | <https://convika.com/compare/vercel-hobby-limits/> | 17 Nov 2026 | Sekunder; konsekuensi pelampauan limit, dibaca 14 Nov 2026 |
| 18 | <https://docs.onetapwoo.com/getting-started/google-cloud-setup> | 17 Nov 2026 | Sekunder; OAuth gratis tanpa penagihan |
| 19 | <https://www.socialmati.com/docs/integrations/google> | 17 Nov 2026 | Sekunder; OAuth client tanpa biaya |
| 20 | <https://infkey.com/how-to-use-gemini-free-7-steps-limits-2026> | 17 Nov 2026 | Sekunder; angka lama Gemini (Okt 2026) untuk perbandingan |
| 21 | <https://mono-ai.uk/blog/gemini-free-tier-rate-limits> | 17 Nov 2026 | Sekunder; angka lama Gemini (Jun 2026) untuk perbandingan |

## Catatan akhir

- Semua angka dalam dokumen ini adalah hasil pengecekan 17 November 2026. Penyedia layanan dapat mengubah limit sewaktu-waktu; angka kritis (terutama kuota Gemini) wajib dikonfirmasi ulang di konsol masing-masing penyedia sebelum peluncuran.
- Dua angka dinyatakan "tidak ditemukan" secara jujur: menit build per bulan untuk Cloudflare Pages (Pages memakai satuan jumlah build) dan untuk Vercel Hobby (tidak tercantum di halaman resmi yang dibaca); serta batas token harian (TPD) Gemini.
- Tidak ada secret atau kredensial yang ditulis dalam dokumen ini.
