# SEO & Keterlihatan — Dokter HP Web App

> **Dokumen strategi SEO Dokter HP Web App.**
> Bahasa: Bahasa Indonesia. Status: Fase 1, 17 November 2026.
> Domain belum diputuskan. Semua URL di dokumen ini memakai placeholder
> `https://dokter-hp-web.pages.dev/` — **ganti dengan domain final** saat
> domain diputuskan (sitemap.xml, robots.txt, canonical, Open Graph,
> dan JSON-LD ikut berubah).
>
> File statis yang diimplementasikan tim ini:
> `apps/web/public/robots.txt` dan `apps/web/public/sitemap.xml`.
> Judul dan deskripsi meta di dokumen ini adalah **snippet siap tempel**
> — tim frontend yang memasang ke `index.html` (dokumen ini tidak
> mengubah `index.html`, milik tim scaffold). `manifest.webmanifest`
> milik tim PWA, bukan bagian dokumen ini.

---

## 1. Ringkasan strategi

Dokter HP adalah aplikasi web satu halaman (SPA: Vite + React +
React Router) yang menjawab pertanyaan nyata pengguna Indonesia:
"kenapa WiFi lemot padahal sinyal penuh", "kenapa baterai boros",
"kenapa HP lemot". Strategi SEO-nya:

1. **Satu halaman publik yang kuat** (landing `/`) + **satu halaman
   tes publik** (`/wifi`, bisa dipakai tanpa akun) + **tujuh halaman
   panduan** (`/panduan/...`) yang menjawab pertanyaan spesifik
   dengan konten nyata, bukan halaman kosong.
2. **Halaman aplikasi yang butuh login tidak diindeks** (dashboard,
   riwayat, pengaturan, dan keempat dokter non-WiFi) — isinya data
   pribadi pengguna dan tidak ada nilai pencariannya.
3. **Konten panduan ditulis dari PRODUCT.md, bukan karangan**: patokan
   kecepatan normal, mode router 802.11b Only, channel 1/6/11,
   ganti DNS 1.1.1.1 / 8.8.8.8, dan batasan jujur web. Klaim yang
   tidak ada di PRODUCT.md tidak boleh muncul di panduan.
4. **Performa adalah bagian dari SEO** (Core Web Vitals, bagian 8):
   pengguna target sering memakai koneksi lemot, jadi halaman yang
   lambat bukan hanya kalah peringkat — penggunanya pergi sebelum
   tes sempat jalan.

### 1.1 Catatan penting: SPA dan meta per halaman

Aplikasi ini adalah SPA dengan satu `index.html`. Artinya, secara
bawaan **semua rute berbagi satu judul dan satu deskripsi meta**
yang tertulis di `index.html`. Judul/deskripsi per halaman di
bagian 3 baru berlaku penuh bila salah satu diterapkan:

- **Opsi A (disarankan untuk panduan):** halaman panduan dibuat
  sebagai halaman statis prerender (mis. `vite-plugin-prerender`
  atau halaman HTML statis di `public/panduan/`), sehingga setiap
  panduan punya HTML sendiri dengan meta sendiri.
- **Opsi B:** judul/deskripsi diubah lewat JavaScript saat rute
  berpindah (mis. `react-helmet-async`). Google bisa membaca meta
  yang dirender JavaScript, tetapi pembaca pratinjau tautan
  (WhatsApp, Telegram, Facebook) **tidak menjalankan JavaScript**
  — mereka hanya melihat meta statis di `index.html`. Untuk
  panduan yang dibagikan lewat chat, Opsi A jauh lebih baik.

Keputusan antara A dan B ada di tim frontend; dokumen ini
menyiapkan meta per halaman untuk kedua opsi. Bila Opsi B yang
dipilih, sitemap tetap berlaku, tetapi Open Graph per panduan
tidak akan tampil benar saat dibagikan — catat sebagai utang
yang diketahui.

### 1.2 Canonical dan mirror

Hosting utama adalah Cloudflare Pages, mirror kedua Vercel
(keputusan stack). Dua mirror berarti dua URL untuk konten yang
sama — risiko konten duplikat. Aturannya:

- **Tag canonical di semua halaman menunjuk ke domain utama**
  (domain final Pages), bukan ke domain mirror Vercel.
- **Sitemap hanya berisi URL domain utama.**
- Bila domain kustom dipakai, canonical dan sitemap memakai
  domain kustom itu; URL `*.pages.dev` dan `*.vercel.app` tetap
  menunjuk canonical ke domain kustom.
- Jangan pasang `noindex` di mirror — canonical sudah cukup,
  dan mirror tetap harus bisa dibuka pengguna bila mirror utama
  bermasalah.

---

## 2. Halaman publik dan kata kunci target

| # | Rute | Jenis | Kata kunci utama | Kata kunci pendukung |
|---|---|---|---|---|
| 1 | `/` | Landing | dokter hp, cek kesehatan hp | periksa hp online, tes hp gratis |
| 2 | `/wifi` | Tes WiFi (tanpa akun) | cek kecepatan wifi | tes kecepatan wifi, tes wifi lemot, speed test wifi |
| 3 | `/panduan/wifi-lemot` | Panduan | wifi lemot | wifi lemot padahal sinyal penuh, wifi lambat, kenapa wifi lemot |
| 4 | `/panduan/ganti-channel-router` | Panduan | ganti channel router | channel wifi 1 6 11, channel router terbaik, cara setting channel wifi |
| 5 | `/panduan/ganti-dns` | Panduan | ganti dns hp | dns 1.1.1.1, dns 8.8.8.8, cara ganti dns android |
| 6 | `/panduan/baterai-boros` | Panduan | baterai boros | baterai hp cepat habis, cara menghemat baterai hp |
| 7 | `/panduan/penyimpanan-penuh` | Panduan | penyimpanan hp penuh | cara mengosongkan penyimpanan hp, memori hp penuh |
| 8 | `/panduan/hp-lemot` | Panduan | hp lemot | cara mengatasi hp lemot, hp lambat, cara mempercepat hp |
| 9 | `/panduan/keamanan-hp` | Panduan | cek keamanan hp | izin aplikasi berbahaya, aplikasi berbahaya di hp |

Catatan:

- Rute `/panduan/...` adalah **rute yang diusulkan dokumen ini**
  (PRODUCT.md belum menetapkan rute panduan). Bila tim frontend
  memakai rute berbeda, perbarui sitemap.xml dan tabel ini agar
  sama persis dengan rute yang live.
- Kata kunci ditulis dalam bahasa pencarian pengguna sehari-hari
  (mis. "wifi lemot", bukan "optimalisasi throughput nirkabel").
  Judul dan isi panduan memakai kata-kata yang sama dengan yang
  diketik pengguna di kolom pencarian.
- Setiap panduan menargetkan **satu** kata kunci utama. Jangan
  menumpuk semua kata kunci di satu halaman — satu halaman, satu
  jawaban yang tuntas.
- Frasa "cek kecepatan wifi" dan "wifi lemot" adalah prioritas
  tertinggi: keduanya langsung mengarah ke fitur utama aplikasi
  (tes WiFi tanpa akun) dan ke kasus nyata yang melahirkan produk
  ini.

---

## 3. Judul dan deskripsi meta per halaman

Snippet siap tempel. Judul diusahakan ≤ 60 karakter, deskripsi
150–160 karakter, agar tidak terpotong di hasil pencarian.
Ganti `dokter-hp-web.pages.dev` dengan domain final saat domain
diputuskan.

### 3.1 Landing — `/`

```html
<title>Dokter HP — Cek WiFi Lemot, Baterai Boros &amp; Kesehatan HP</title>
<meta name="description" content="Periksa kondisi HP Anda langsung dari browser: tes kecepatan WiFi tanpa akun, skor kesehatan HP 0–100, dan panduan perbaikan yang jujur. Gratis, tanpa install aplikasi." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/" />
```

### 3.2 Tes WiFi — `/wifi`

```html
<title>Cek Kecepatan WiFi — Tes Unduh &amp; Latensi Gratis | Dokter HP</title>
<meta name="description" content="Ukur kecepatan unduh dan latensi WiFi Anda langsung dari browser, tanpa akun dan tanpa install. Hasil nyata dalam hitungan detik, lengkap dengan rekomendasi perbaikan." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/wifi" />
```

### 3.3 Panduan: WiFi lemot — `/panduan/wifi-lemot`

```html
<title>WiFi Lemot Padahal Sinyal Penuh? Penyebab &amp; Cara Mengatasinya | Dokter HP</title>
<meta name="description" content="WiFi lemot padahal sinyal penuh biasanya bukan salah HP Anda. Kenali penyebabnya — dari mode router 802.11b Only sampai channel yang bertabrakan — dan cara memperbaikinya." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/panduan/wifi-lemot" />
```

### 3.4 Panduan: ganti channel router — `/panduan/ganti-channel-router`

```html
<title>Cara Ganti Channel Router ke 1, 6, atau 11 agar WiFi Stabil | Dokter HP</title>
<meta name="description" content="Di pita 2,4 GHz hanya channel 1, 6, dan 11 yang tidak saling tumpang tindih. Pelajari cara mengganti channel router Anda langkah demi langkah, termasuk contoh router ZTE F660." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/panduan/ganti-channel-router" />
```

### 3.5 Panduan: ganti DNS — `/panduan/ganti-dns`

```html
<title>Cara Ganti DNS HP ke 1.1.1.1 atau 8.8.8.8 | Dokter HP</title>
<meta name="description" content="Mengganti DNS kadang membuat browsing terasa lebih cepat dan stabil. Panduan langkah demi langkah mengganti DNS di HP Android ke 1.1.1.1 atau 8.8.8.8." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/panduan/ganti-dns" />
```

### 3.6 Panduan: baterai boros — `/panduan/baterai-boros`

```html
<title>Baterai HP Boros? Penyebab &amp; Cara Menghematnya | Dokter HP</title>
<meta name="description" content="Baterai HP cepat habis? Kenali penyebab umum baterai boros dan cara menghematnya — dari mode hemat daya sampai memeriksa aplikasi yang paling banyak memakai baterai." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/panduan/baterai-boros" />
```

### 3.7 Panduan: penyimpanan penuh — `/panduan/penyimpanan-penuh`

```html
<title>Penyimpanan HP Penuh? Cara Mengosongkannya dengan Aman | Dokter HP</title>
<meta name="description" content="Penyimpanan HP penuh membuat HP lambat dan gagal menyimpan foto. Pelajari cara memeriksa pemakaian penyimpanan dan mengosongkannya dengan aman tanpa menghapus data penting." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/panduan/penyimpanan-penuh" />
```

### 3.8 Panduan: HP lemot — `/panduan/hp-lemot`

```html
<title>HP Lemot? Penyebab &amp; Cara Mempercepat Performa HP | Dokter HP</title>
<meta name="description" content="HP lemot tidak selalu berarti HP sudah rusak. Kenali penyebab umum HP lambat — penyimpanan penuh, aplikasi menumpuk, sampai HP perlu dimulai ulang — dan cara mempercepatnya." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/panduan/hp-lemot" />
```

### 3.9 Panduan: keamanan HP — `/panduan/keamanan-hp`

```html>
<title>Cek Keamanan HP: Izin Aplikasi Berbahaya yang Perlu Ditinjau | Dokter HP</title>
<meta name="description" content="Beberapa aplikasi meminta izin yang tidak perlu — lokasi, kontak, hingga SMS. Pelajari cara memeriksa izin aplikasi di HP Anda dan meninjau aplikasi yang meminta terlalu banyak izin." />
<link rel="canonical" href="https://dokter-hp-web.pages.dev/panduan/keamanan-hp" />
```

### 3.10 Meta dasar (semua halaman, di `index.html`)

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="language" content="id" />
<meta name="robots" content="index, follow" />
<meta name="author" content="Dokter HP" />
<meta name="theme-color" content="#000000" />
```

Halaman aplikasi yang butuh login (dashboard, riwayat, pengaturan,
dan seterusnya) memakai `robots` yang berlawanan — lihat bagian 6.2.

---

## 4. Open Graph dan Twitter Card

Pratinjau tautan saat dibagikan di WhatsApp, Telegram, Facebook,
dan X. Pasang di `index.html` untuk landing; untuk panduan,
berlaku catatan SPA di bagian 1.1 (hanya efektif penuh bila
panduan diprerender).

### 4.1 Landing — `/`

```html
<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Dokter HP" />
<meta property="og:locale" content="id_ID" />
<meta property="og:url" content="https://dokter-hp-web.pages.dev/" />
<meta property="og:title" content="Dokter HP — Cek WiFi Lemot, Baterai Boros &amp; Kesehatan HP" />
<meta property="og:description" content="Periksa kondisi HP Anda langsung dari browser: tes kecepatan WiFi tanpa akun, skor kesehatan HP 0–100, dan panduan perbaikan yang jujur. Gratis, tanpa install aplikasi." />
<meta property="og:image" content="https://dokter-hp-web.pages.dev/og-cover.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Dokter HP — periksa WiFi, baterai, dan kesehatan HP dari browser" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Dokter HP — Cek WiFi Lemot, Baterai Boros &amp; Kesehatan HP" />
<meta name="twitter:description" content="Periksa kondisi HP Anda langsung dari browser: tes kecepatan WiFi tanpa akun, skor kesehatan HP 0–100, dan panduan perbaikan yang jujur. Gratis, tanpa install aplikasi." />
<meta name="twitter:image" content="https://dokter-hp-web.pages.dev/og-cover.png" />
<meta name="twitter:image:alt" content="Dokter HP — periksa WiFi, baterai, dan kesehatan HP dari browser" />
```

### 4.2 Gambar pratinjau (`og-cover.png`) — utang desain

File `og-cover.png` (1200 × 630 px) **belum ada** dan bukan bagian
tugas tim ini. Spesifikasi untuk tim desain/frontend:

- Ukuran 1200 × 630 px, format PNG atau JPG, ukuran file
  diusahakan di bawah 300 KB.
- Teks besar yang terbaca di ukuran kecil: nama "Dokter HP" dan
  satu kalimat manfaat ("Cek WiFi lemot & kesehatan HP — gratis,
  tanpa install").
- Mengikuti konsep desain produk: tema gelap, basis hitam/abu/putih,
  aksen putih; tanpa warna dekoratif.
- Diletakkan di `apps/web/public/og-cover.png` agar URL-nya sama
  dengan yang tertulis di meta di atas.
- Sampai gambar ini ada, meta `og:image` / `twitter:image` tetap
  dipasang (URL-nya sudah benar); pratinjau hanya akan tampil
  tanpa gambar.

### 4.3 Panduan (bila diprerender)

Setiap panduan memakai pola yang sama dengan nilai sendiri:

- `og:type` = `article`
- `og:url` = URL kanonis panduan
- `og:title` / `og:description` = judul dan deskripsi meta panduan
  dari bagian 3 (tanpa sufiks `| Dokter HP` bila terlalu panjang —
  potong deskripsi, bukan judul)
- `og:image` = gambar pratinjau yang sama (`og-cover.png`), kecuali
  tim desain membuat gambar khusus per panduan

---

## 5. Data terstruktur (JSON-LD)

Dua skema: `WebApplication` untuk landing (menjelaskan aplikasi)
dan `FAQPage` untuk halaman panduan WiFi lemot (menjawab pertanyaan
umum agar bisa tampil sebagai hasil kaya di pencarian).

### 5.1 WebApplication — di landing `/`

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Dokter HP",
  "url": "https://dokter-hp-web.pages.dev/",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web browser",
  "inLanguage": "id",
  "description": "Periksa kondisi HP langsung dari browser: tes kecepatan WiFi tanpa akun, skor kesehatan HP 0–100, dan panduan perbaikan yang jujur. Gratis, tanpa install aplikasi.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "IDR"
  },
  "featureList": "Tes kecepatan WiFi, tes bertahan 30 detik, skor kesehatan HP, panduan perbaikan WiFi, diagnosis AI, riwayat pemeriksaan, laporan PDF"
}
</script>
```

Catatan: jangan tambahkan `aggregateRating` atau ulasan — tidak
ada data ulasan nyata, dan rating karangan melanggar prinsip
kejujuran data produk.

### 5.2 FAQPage — di `/panduan/wifi-lemot`

Jawaban di sini diringkas dari PRODUCT.md (panduan WiFi turun).
Bila isi panduan berubah, FAQ ini ikut diperbarui — jawaban
JSON-LD dan jawaban di halaman harus sama.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Kenapa WiFi lemot padahal sinyal penuh?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sinyal penuh hanya berarti HP dekat dengan router, bukan berarti kecepatan internetnya bagus. Penyebab umum: mode router 802.11b Only yang membatasi kecepatan sampai 11 Mbps, channel WiFi yang bertabrakan dengan tetangga, atau terlalu banyak perangkat memakai jaringan yang sama."
      }
    },
    {
      "@type": "Question",
      "name": "Berapa kecepatan unduh WiFi yang normal?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Patokan normal Dokter HP adalah 1 MB/detik, dan biasanya di atas 2 MB/detik. Di bawah 50 KB/detik tergolong sangat lambat dan perlu diperiksa lebih lanjut."
      }
    },
    {
      "@type": "Question",
      "name": "Channel router mana yang paling baik untuk WiFi 2,4 GHz?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Channel 1, 6, dan 11 — hanya ketiganya yang tidak saling tumpang tindih di pita 2,4 GHz. Mengganti channel router ke salah satu dari ketiganya sering memperbaiki WiFi yang lemot karena gangguan dari jaringan tetangga."
      }
    },
    {
      "@type": "Question",
      "name": "Apakah tes kecepatan WiFi di Dokter HP perlu akun?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Tidak. Tes kecepatan dan latensi WiFi bisa dijalankan tanpa akun dan tanpa memasang aplikasi. Hasilnya tampil langsung di layar; penyimpanan hasil ke riwayat baru membutuhkan akun."
      }
    },
    {
      "@type": "Question",
      "name": "Bagaimana cara tahu masalahnya ada di HP atau di router?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Coba dua tes pembeda: pertama, periksa apakah HP lain di jaringan yang sama juga lemot — bila hanya satu HP yang lemot, masalahnya ada di HP itu. Kedua, coba data seluler — bila data seluler lancar, masalahnya ada di WiFi atau router, bukan di HP."
      }
    }
  ]
}
</script>
```

FAQ serupa boleh ditambahkan ke panduan lain bila panduan itu
memuat bagian tanya-jawab nyata — jangan membuat FAQPage untuk
halaman yang tidak menampilkan pertanyaan dan jawaban yang sama
di layar (Google mengabaikan, bahkan bisa menghukum, FAQ yang
tidak terlihat di halaman).

---

## 6. Sitemap dan robots

### 6.1 Sitemap — `apps/web/public/sitemap.xml` (sudah ditulis)

- Berisi 9 URL: landing, `/wifi`, dan 7 panduan.
- `lastmod` memakai tanggal penulisan dokumen ini (2026-11-17);
  perbarui `lastmod` halaman yang isinya berubah saat ada
  pembaruan konten.
- `priority` tertinggi (1.0) untuk landing; `/wifi` dan panduan
  WiFi lemot 0.9; panduan lain 0.7–0.8.
- Halaman aplikasi yang butuh login sengaja tidak masuk sitemap.
- **Saat domain final diputuskan:** ganti seluruh
  `https://dokter-hp-web.pages.dev/` dengan domain final, lalu
  kirim ulang sitemap di Google Search Console.

### 6.2 Robots — `apps/web/public/robots.txt` (sudah ditulis)

- `Allow: /` untuk semua crawler.
- `Disallow` untuk semua rute aplikasi yang butuh login:
  `/dashboard`, `/masuk`, `/kunci`, `/baterai`, `/penyimpanan`,
  `/performa`, `/keamanan`, `/ai`, `/riwayat`, `/pengaturan`,
  plus `/api/` dan file tes kecepatan `/speedtest-1mb.bin`.
- Menunjuk ke sitemap lewat baris `Sitemap:`.
- **Catatan penting:** `Disallow` di robots.txt mencegah
  perayapan, tetapi tidak menjamin halaman tidak muncul sama
  sekali di hasil pencarian bila ada tautan luar yang menunjuk
  ke sana. Sebagai lapisan kedua, halaman aplikasi yang butuh
  login sebaiknya juga memakai meta berikut (tugas tim frontend,
  dipasang saat rute aplikasi dirender):

```html
<meta name="robots" content="noindex, nofollow" />
```

---

## 7. HTML semantik

Checklist untuk tim frontend — struktur HTML yang benar membantu
mesin pencari memahami halaman dan membantu pembaca layar:

- [ ] **Satu `<h1>` per halaman**, berisi kata kunci utama halaman
      itu (mis. landing: "Dokter HP — periksa WiFi, baterai, dan
      kesehatan HP Anda"; panduan WiFi: "WiFi lemot padahal sinyal
      penuh?").
- [ ] **Hierarki heading berurutan**: `<h2>` untuk bagian besar,
      `<h3>` untuk sub-bagian — jangan melompat dari `<h1>` ke
      `<h3>`, jangan memakai heading hanya untuk memperbesar teks.
- [ ] **Elemen landmark**: `<header>`, `<nav>`, `<main>`, `<footer>`;
      konten panduan di dalam `<article>`; kartu dokter memakai
      `<section>` dengan heading sendiri.
- [ ] **Bahasa halaman**: `<html lang="id">` di `index.html`.
- [ ] **Tautan bermakna**: teks tautan menjelaskan tujuannya
      ("Baca panduan WiFi lemot"), bukan "klik di sini".
- [ ] **Gambar dengan `alt` yang menjelaskan isi**, bukan nama file;
      gambar murni dekoratif memakai `alt=""`.
- [ ] **Tombol adalah `<button>`, tautan adalah `<a>`** — jangan
      menukar keduanya; crawler dan pembaca layar memperlakukannya
      berbeda.
- [ ] **Daftar langkah memakai `<ol>`** (langkah berurutan) dan
      daftar tips memakai `<ul>` — panduan perbaikan ditulis
      sebagai daftar bernomor yang sebenarnya, bukan paragraf
      yang diberi angka manual.
- [ ] **Konten panduan ada di HTML awal**, bukan dimuat lewat
      JavaScript setelah halaman tampil — berlaku terutama bila
      panduan diprerender (Opsi A, bagian 1.1).
- [ ] **Formulir berlabel**: setiap `<input>` punya `<label>`
      yang terhubung (`for`/`id`), termasuk kolom keluhan di
      Diagnosis AI dan kolom input manual di dokter WiFi.

---

## 8. Performa sebagai faktor SEO

Google memakai Core Web Vitals sebagai sinyal peringkat, dan
pengguna target Dokter HP sering membuka situs dari koneksi
lemot. Target yang disarankan (diukur di HP kelas menengah,
koneksi 4G lambat, via Lighthouse / PageSpeed Insights):

| Metrik | Target | Catatan |
|---|---|---|
| Largest Contentful Paint (LCP) | ≤ 2,5 detik | Konten utama landing tampil cepat |
| Interaction to Next Paint (INP) | ≤ 200 ms | Ketukan tombol terasa langsung merespons |
| Cumulative Layout Shift (CLS) | ≤ 0,1 | Tidak ada elemen yang melompat saat halaman dimuat |
| Total ukuran JavaScript awal | sekecil mungkin | Code-splitting per rute; halaman panduan tidak memuat kode dashboard |

Langkah konkret (tugas tim frontend / scaffold — dicatat di sini
karena berdampak langsung ke SEO):

1. **Code-splitting per rute** dengan React Router + `React.lazy`:
   pengunjung landing tidak perlu mengunduh kode dashboard, AI,
   atau jsPDF (pembuat laporan PDF) sebelum membutuhkannya.
2. **Gambar dioptimalkan**: format modern (WebP/AVIF bila
   didukung), ukuran sesuai tampilan, `loading="lazy"` untuk
   gambar di bawah lipatan.
3. **Tanpa font unduhan** — sudah diputuskan di PRODUCT.md (font
   sistem), jangan tambahkan font web yang memperlambat muat awal.
4. **File tes kecepatan (`speedtest-1mb.bin`) tidak dimuat di awal**
   — hanya diunduh saat pengguna menekan tombol tes.
5. **Cache agresif untuk aset statis berversi** (hash di nama file
   hasil build Vite) dan `Cache-Control` yang tepat di Pages.
6. **Ukur, jangan kira-kira**: jalankan Lighthouse pada landing
   dan satu panduan setelah deploy pertama, catat angkanya, dan
   ulangi setelah perubahan besar.

---

## 9. Checklist peluncuran dan pengukuran

### 9.1 Sebelum peluncuran

- [ ] Domain final diputuskan; seluruh placeholder
      `dokter-hp-web.pages.dev` diganti di sitemap.xml, robots.txt,
      canonical, Open Graph, dan JSON-LD.
- [ ] `og-cover.png` (1200 × 630 px) dibuat dan diletakkan di
      `apps/web/public/`.
- [ ] Meta judul/deskripsi landing terpasang di `index.html`
      (tim frontend).
- [ ] Keputusan prerender panduan (Opsi A/B, bagian 1.1) diambil
      dan meta per panduan diterapkan sesuai keputusan itu.
- [ ] JSON-LD WebApplication + FAQPage terpasang dan lolos
      validasi di validator schema.org / Rich Results Test.
- [ ] `robots.txt` dan `sitemap.xml` bisa dibuka di URL live
      (`/robots.txt`, `/sitemap.xml`) dan berisi domain final.
- [ ] Halaman login-gated mengembalikan meta `noindex` (bagian 6.2).
- [ ] Lighthouse landing ≥ target bagian 8.

### 9.2 Setelah peluncuran

- [ ] Daftarkan domain di Google Search Console, kirim sitemap,
      dan minta pengindeksan landing + `/wifi` + panduan utama.
- [ ] Daftarkan juga di Bing Webmaster Tools (impor dari Search
      Console, tanpa biaya).
- [ ] Periksa pratinjau tautan di WhatsApp/Telegram setelah
      `og-cover.png` live.
- [ ] Pantau kueri yang membawa pengunjung (Search Console →
      laporan performa) selama 4 minggu pertama; bila frasa
      pencarian nyata berbeda dari kata kunci di bagian 2,
      sesuaikan judul/deskripsi panduan.
- [ ] Perbarui `lastmod` sitemap setiap kali isi panduan berubah.

### 9.3 Yang tidak dilakukan

- Tidak membeli tautan atau memakai jasa SEO berbayar (budget nol).
- Tidak menjejalkan kata kunci sampai teks tidak enak dibaca —
  judul dan isi ditulis untuk manusia dulu, mesin pencari kedua.
- Tidak membuat halaman pintu (doorway pages) atau konten duplikat
  antar panduan.
- Tidak mengklaim peringkat atau jumlah pengunjung tanpa data
  Search Console — angka keterlihatan dilaporkan dari data nyata.

---

## 10. Changelog dokumen

### 17 November 2026 — Fase 1 (dokumen awal)

- Strategi SEO: 9 halaman publik (landing + tes WiFi + 7 panduan),
  kata kunci target Bahasa Indonesia, meta per halaman, Open Graph
  + Twitter Card, JSON-LD WebApplication + FAQPage, sitemap +
  robots, HTML semantik, performa sebagai faktor SEO.
- File statis ditulis: `apps/web/public/robots.txt`,
  `apps/web/public/sitemap.xml` (domain placeholder
  `https://dokter-hp-web.pages.dev/`, diganti saat domain final
  diputuskan).
- Utang yang diketahui: `og-cover.png` belum ada (butuh desain);
  keputusan prerender panduan (Opsi A/B) menunggu tim frontend;
  rute `/panduan/...` adalah usulan dokumen ini, belum diputuskan
  tim frontend.
