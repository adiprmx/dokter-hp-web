# DESIGN_AUDIT.md: Dokter HP Web App

> **Dokumen audit desain + sistem desain komponen dasar.**
> Bahasa: Bahasa Indonesia. Status: 17 November 2026, Fase 1 (fondasi).
> Pemilik: Tim Design System + 7 Anti-Slop.
> Pembaruan: 18 November 2026, redesign v2.0 ("Alat ukur, hidup") —
> bagian 1, 2, 4.2, 4.3, 4.7, 4.9, 5.1–5.7, dan 9.6 diperbarui dengan
> bukti dari kode v2.0 (bukan salinan klaim tim).
> Mode antislop: `during` (session override, tugas ini memerintahkan
> penerapan ketujuh skill saat membangun, bukan audit sesudah jadi).

---

## 1. Design Read dan dial

**Design Read:** aplikasi alat ukur (Operate) untuk pemilik HP Android
awam di layar 360 px, dengan bahasa visual "Alat ukur": tema gelap,
angka di depan, motif strip meter, satu aksen putih.

Mode impeccable: **Operate** (pengguna menyelesaikan tugas, bukan
dibujuk). Permukaan Operate bersifat code-led: tidak ada ronde kompas
visual; ambisi hidup di kontrak arah ini dan di perilaku komponen.

Dial taste-skill (baris trust-first / accessibility-critical):
`DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 5`.
Dial antislop: `ENERGY 1 / RHYTHM 2 / MOTION 1`.

Alasan dial: pengguna datang dengan masalah (WiFi lemot, HP berat)
dan butuh jawaban yang bisa dipercaya, bukan tontonan. Energi rendah,
ritme cukup bervariasi antar layar, gerak hanya untuk umpan balik
dan perubahan status.

**v2.0 (18 Nov 2026, redesign total atas vonis owner: "web nya
bener bener membosankan!"):** Design Read yang sama, jiwa "Alat
ukur" dipertahankan, tetapi warna status kini WAJIB hidup di
seluruh UI dan logo brand resmi tampil di tombol masuk.
Dial taste-skill naik ke `DESIGN_VARIANCE 5 / MOTION_INTENSITY 3
/ VISUAL_DENSITY 5` (hero split asimetris, panel skor 160 px,
grid 2 kolom desktop; gerak tetap hanya umpan balik + sapuan
cincin). Dial antislop naik ke `ENERGY 3 / RHYTHM 4 / MOTION 2`.
Catatan: RHYTHM 4 berada di luar skala inti antislop (1–3) —
keputusan spesifikasi redesign-v20-spec.md, dicatat apa adanya.
Alasan naik: v1.0 terbukti monoton (kartu abu tanpa warna sama
sekali di screenshot verifikasi live); energi ditambah lewat
warna status yang bermakna dan hierarki angka, bukan lewat
hiasan atau animasi mainan.

---

## 2. Keputusan yang dikunci dan konflik aturan

Design lock pemilik (PRODUCT.md bagian 3, menang atas default skill
mana pun): basis hitam/abu/putih, aksen putih, warna hanya untuk
fungsi/status (hijau sukses, merah galat, kuning pending, biru info),
tanpa font serif Didone/Playfair, font sistem tanpa unduhan font.

Konflik aturan yang diselesaikan (dicatat, bukan diam-diam):

| Konflik | Keputusan | Alasan satu baris |
|---|---|---|
| Taste-skill melarang hitam murni `#000000` | Tetap `#000000` sebagai kanvas | Design lock pemilik memakai hitam murni; aturan pemilik menang |
| Taste-skill mewajibkan dua mode (terang + gelap) | Gelap saja | Design lock mengunci tema gelap; mode terang bukan permintaan |
| Taste-skill melarang Inter sebagai default | Font sistem (system-ui) | PRODUCT.md melarang unduhan font; stack sistem adalah pilihannya, bukan Inter |
| Impeccable new-work mewajibkan concept-seed untuk dunia visual baru | Tidak dijalankan | Arah sudah dipatok brief (PRODUCT.md + tugas); new-work sendiri menyatakan arah yang dipatok brief mengalahkan undian |
| Craft-floor melarang garis `repeating-linear-gradient` | MeterStrip digambar sebagai SVG dari data | Motif strip adalah dunia subjeknya sendiri (alat ukur), dan SVG memberi takik yang presisi |
| Antislop R-06 melarang mono sebagai kostum "teknis" | Mono hanya untuk angka ukur | Angka adalah data pengukuran, bukan hiasan; mono + tabular-nums membuat kolom angka sejajar |

Keputusan K-11 (koordinator, 17 Nov 2026) mengikat: token warna
a11y dari docs/a11y.md bagian 4 dipakai apa adanya di semua token
dan komponen (detail di bagian 3.1).

Konflik tambahan yang diselesaikan di v2.0 (18 Nov 2026):

| Konflik | Keputusan | Alasan satu baris |
|---|---|---|
| Taste-skill: satu aksen, warna status seperlunya — vs perintah owner warna status WAJIB hidup | Warna status dipakai nyata di semua layar (skor, verdict, badge, kartu) | Perintah owner eksplisit; setiap warna tetap bermakna status dan selalu ditemani label teks (K-94) |
| Taste-skill §3.C melarang ikon SVG buatan tangan | Set ikon geometris buatan tangan dipertahankan (BottomNav 5, LandingPage 3, EmptyState 1, spinner Button 1) | Satu sistem goresan yang konsisten dan terverifikasi visual; memasang pustaka ikon menambah dependensi + churn tanpa keuntungan yang terlihat pengguna |
| Taste-skill §9.G: nol em dash di mana pun | Prosa live 0 em dash; pengecualian tercatat: judul dokumen/SEO (15 situs, konvensi), placeholder angka kosong "—" di pemantau live WiFi (2 situs, konvensi data — "0" akan jadi angka karangan), pemisah dokumen PDF (1 situs, konvensi dokumen) | Larangan skill menyasar prosa/hiasan; ketiga pengecualian bukan prosa dan masing-masing punya alasan yang tercatat |
| Taste-skill melarang bilah skor ber-track | MeterStrip (track + isi) dipertahankan | Larangan itu untuk visual perbandingan di landing; MeterStrip adalah meter produk "Alat ukur", bukan perbandingan landing |
| Antislop R-06 mono sebagai kostum teknis | Mono tetap hanya angka ukur (`.dh-numeric`) | Tidak berubah dari v1.0 |
| K-94 vs kosakata domain (klasifikasi kecepatan 5 tingkat, verdict, label baterai) | Label STATUS hanya dari `labelStatus()`; label klasifikasi domain mempertahankan kosakatanya tetapi dirender dengan token status bila menjadi verdict utama halaman (K-96) | Memaksa 5 tingkat ke dalam 3 label akan menghilangkan informasi |

---

## 3. Token desain

Sumber token: `apps/web/src/styles/tokens.css`. Komponen memakai
token lewat `var()`, contoh `bg-[var(--color-surface)]`. Tidak ada
nilai warna, jarak, atau radius hardcode di luar file token, kecuali
nilai yang memang milik satu komponen dan sudah dicatat di sini.

### 3.1 Warna

Basis: hitam/abu/putih skala Zinc. Warna fungsi hanya untuk status.

| Token | Nilai | Fungsi |
|---|---|---|
| `--color-bg` | `#000000` | Latar utama halaman |
| `--color-bg-alt` | `#09090b` | Latar utama alternatif (Zinc 950) |
| `--color-surface` | `#121215` | Latar kartu dan panel |
| `--color-surface-raised` | `#18181b` | Latar input, dialog, dropdown |
| `--color-surface-hover` | `#27272a` | Latar hover (Zinc 800) |
| `--color-border` | `#27272a` | Garis dekoratif murni saja |
| `--color-border-strong` | `#71717a` | Batas komponen interaktif |
| `--color-text-bright` | `#ffffff` | Judul, aksen putih |
| `--color-text-primary` | `#f4f4f5` | Teks utama (Zinc 100) |
| `--color-text-secondary` | `#d4d4d8` | Teks sekunder (Zinc 300) |
| `--color-text-muted` | `#a1a1aa` | Teks bantuan, keterangan, caption (Zinc 400) |
| `--color-text-placeholder` | `#a1a1aa` | Placeholder input (Zinc 400) |
| `--color-text-disabled` | `#a1a1aa` | Teks tombol nonaktif (Zinc 400) |
| `--color-accent` | `#ffffff` | Satu-satunya aksen |
| `--color-accent-text` | `#000000` | Teks di atas aksen |
| `--color-success` | `#34d399` | Teks sukses (Emerald 400) |
| `--color-success-bg` | `rgb(52 211 153 / 0.12)` | Tinta latar cip/panel sukses |
| `--color-success-border` | `rgb(52 211 153 / 0.45)` | Bingkai cip/panel sukses |
| `--color-success-solid` | `#047857` | Latar solid hijau, hanya dengan teks putih |
| `--color-error` | `#f87171` | Teks galat (Red 400) |
| `--color-error-bg` | `rgb(248 113 113 / 0.12)` | Tinta latar cip/panel galat |
| `--color-error-border` | `rgb(248 113 113 / 0.45)` | Bingkai cip/panel galat |
| `--color-error-solid` | `#dc2626` | Latar solid merah, hanya dengan teks putih |
| `--color-warning` | `#facc15` | Teks pending (Yellow 400) |
| `--color-warning-bg` | `rgb(250 204 21 / 0.12)` | Tinta latar cip/panel peringatan |
| `--color-warning-border` | `rgb(250 204 21 / 0.45)` | Bingkai cip/panel peringatan |
| `--color-warning-solid` | `#b45309` | Latar solid kuning gelap, hanya dengan teks putih |
| `--color-info` | `#60a5fa` | Teks info (Blue 400) |
| `--color-info-bg` | `rgb(96 165 250 / 0.12)` | Tinta latar cip/panel info |
| `--color-info-border` | `rgb(96 165 250 / 0.45)` | Bingkai cip/panel info |
| `--color-info-solid` | `#2563eb` | Latar solid biru, hanya dengan teks putih |

Verifikasi v2.0 (18 Nov 2026): ke-16 token status (4 warna kali
teks/bg/border/solid) ada di `tokens.css` dan nilainya TIDAK berubah
dari v1.0. Pemetaan keadaan ke warna hidup di
`lib/status-warna.ts` (satu-satunya pemetaan, spec v2.0 §4);
ambang skor 80/50 hidup di `lib/skor.ts` (K-31), bukan di token.

**Yang dilarang:** Zinc 500 `#71717a` dan Zinc 600 `#52525b`
sebagai teks (gagal 4,5:1); teks putih di atas merah 500
`#ef4444` (3,76:1) dan hijau 600 `#059669` (3,77:1); bingkai
Zinc 800 `#27272a` (1,41:1) dan Zinc 700 `#3f3f46` (2,01:1)
sebagai batas komponen interaktif. Semua larangan ini berasal
dari docs/a11y.md bagian 4.4 dan K-11.

**Rasio kontras terverifikasi** (dihitung dengan rumus WCAG,
skrip `contrast-check.py` skill antislop-human, 17 Nov 2026;
angka yang sama dengan tabel a11y.md bagian 4.3). Baris v2.0
(teks status di atas kartu/elevated dan di atas tinta di kartu,
18 Nov 2026) dihitung dengan alat yang sama (selftest 8/8 lolos);
pasangan putih/merah solid dan putih/hijau solid dihitung ulang
dan angkanya sama (4,83:1 dan 5,48:1). Rasio terendah keseluruhan
tetap putih di merah solid 4,83:1 (lolos AA). Rasio terendah
pasangan BARU v2.0 adalah merah di tinta merah di kartu 5,78:1
(lolos AA).

| Pasangan | Rasio | Vonis |
|---|---|---|
| Teks primer `#f4f4f5` / hitam `#000000` | 19,11:1 | Lolos AAA |
| Teks sekunder `#d4d4d8` / hitam `#000000` | 14,21:1 | Lolos AAA |
| Teks redup `#a1a1aa` / hitam `#000000` | 8,19:1 | Lolos AAA |
| Teks redup `#a1a1aa` / elevated `#18181b` | 6,91:1 | Lolos AA |
| Teks primer `#f4f4f5` / elevated `#18181b` | 16,12:1 | Lolos AAA |
| Teks primer `#f4f4f5` / kartu `#121215` | 17,01:1 | Lolos AAA |
| Teks redup `#a1a1aa` / kartu `#121215` | 7,30:1 | Lolos AAA |
| Hitam `#000000` / tombol putih `#ffffff` | 21,00:1 | Lolos AAA |
| Teks nonaktif `#a1a1aa` / Zinc 800 `#27272a` | 5,81:1 | Lolos AA |
| Hijau `#34d399` / hitam `#000000` | 10,92:1 | Lolos AAA |
| Merah `#f87171` / hitam `#000000` | 7,59:1 | Lolos AAA |
| Kuning `#facc15` / hitam `#000000` | 13,71:1 | Lolos AAA |
| Biru `#60a5fa` / hitam `#000000` | 8,26:1 | Lolos AAA |
| Hijau `#34d399` / tinta hijau di hitam `#061912` | 9,45:1 | Lolos AAA |
| Merah `#f87171` / tinta merah di hitam `#1e0e0e` | 6,80:1 | Lolos AA |
| Kuning `#facc15` / tinta kuning di hitam `#1e1803` | 11,56:1 | Lolos AAA |
| Biru `#60a5fa` / tinta biru di hitam `#0c141e` | 7,28:1 | Lolos AAA |
| Hijau `#34d399` / kartu `#121215` | 9,73:1 | Lolos AAA |
| Merah `#f87171` / kartu `#121215` | 6,76:1 | Lolos AAA |
| Kuning `#facc15` / kartu `#121215` | 12,21:1 | Lolos AAA |
| Biru `#60a5fa` / kartu `#121215` | 7,35:1 | Lolos AAA |
| Hijau `#34d399` / elevated `#18181b` | 9,22:1 | Lolos AAA |
| Merah `#f87171` / elevated `#18181b` | 6,40:1 | Lolos AAA |
| Kuning `#facc15` / elevated `#18181b` | 11,57:1 | Lolos AAA |
| Biru `#60a5fa` / elevated `#18181b` | 6,97:1 | Lolos AAA |
| Hijau `#34d399` / tinta hijau di kartu `#162925` | 7,93:1 | Lolos AAA |
| Merah `#f87171` / tinta merah di kartu `#2e1d20` | 5,78:1 | Lolos AA |
| Kuning `#facc15` / tinta kuning di kartu `#2e2815` | 9,59:1 | Lolos AAA |
| Biru `#60a5fa` / tinta biru di kartu `#1b2430` | 6,16:1 | Lolos AAA |
| Putih `#ffffff` / merah solid `#dc2626` | 4,83:1 | Lolos AA |
| Putih `#ffffff` / hijau solid `#047857` | 5,48:1 | Lolos AA |
| Bingkai Zinc 500 `#71717a` / hitam `#000000` | 4,35:1 | Lolos batas komponen 3:1 |

Catatan: tinta latar cip status dihitung sebagai warna efektif
hasil pencampuran (12% warna status di atas hitam), lalu
rasionya dihitung dari warna efektif itu. Nilai hex efektif
tercantum di tabel agar bisa diperiksa ulang. Baris v2.0
"tinta di kartu" memakai campuran yang sama di atas kartu
`#121215` (cip status di v2.0 duduk di atas kartu, bukan di atas
hitam): hijau `#162925`, merah `#2e1d20`, kuning `#2e2815`,
biru `#1b2430`. Angka display v2.0 (2,5-3rem) adalah teks besar
(ambang 3:1); rasio terendahnya sama dengan teks status merah
di hitam, 7,59:1, jadi lolos dengan margin besar.

### 3.2 Tipografi

| Token | Nilai | Alasan |
|---|---|---|
| `--font-sans` | system-ui, -apple-system, Segoe UI, Roboto, sans-serif | Font sistem: tanpa unduhan yang bisa gagal saat koneksi lemot |
| `--font-mono` | ui-monospace, SFMono-Regular, Menlo, Consolas, monospace | Hanya untuk angka ukur (skor, kecepatan, latensi) |
| `--text-display` | 2rem | Angka besar satu layar (skor, hasil tes) |
| `--text-display-lg` | 2,5rem | Angka skor di cincin besar, hasil tes utama (v2.0, spec §5) |
| `--text-display-xl` | 3rem | Angka hero dasbor/beranda di desktop (v2.0, spec §5) |
| `--leading-display` | 1,1 | Tinggi baris angka display (v2.0) |
| `--text-h1` | 1,5rem | Judul halaman |
| `--text-h2` | 1,25rem | Judul bagian |
| `--text-h3` | 1,125rem | Judul kartu |
| `--text-body` | 1rem | Isi (16 px, tidak lebih kecil) |
| `--text-small` | 0,875rem | Teks bantuan, label input |
| `--text-caption` | 0,75rem | Keterangan kecil; tetap memakai Zinc 400 paling gelap |
| `--leading-tight` / `--leading-normal` / `--leading-relaxed` | 1,2 / 1,5 / 1,65 | Judul / isi / paragraf penjelasan |

Skala tetap (rem), bukan fluid: layar Operate dibaca pada DPI
yang konsisten, dan judul yang mengecil di panel sempit terbaca
lebih buruk, bukan lebih baik. Prosa dibatasi `max-w-[65ch]`.
Angka ukur memakai kelas `.dh-numeric` (mono + tabular-nums)
agar kolom angka sejajar vertikal. Skala display v2.0
(2rem / 2,5rem / 3rem) memberi tiga langkah yang jelas beda
dari teks tubuh 1rem dan judul halaman 1,5rem, sesuai spec §5:
angka ukur dibaca pertama, bukan tenggelam di antara teks.

### 3.3 Jarak, radius, bayangan, gerak, lapisan

| Kelompok | Token | Aturan |
|---|---|---|
| Jarak | `--space-1` sampai `--space-12` (4 px sampai 48 px) | Kelipatan 4 px; jarak antar target sentuh minimal 8 px |
| Radius | `--radius-sm` 8 px (tombol, input), `--radius-md` 12 px (kartu), `--radius-pill` 999 px (hanya cip status kecil), `--radius-focus` 4 px | Satu sistem radius; pil tidak dipakai untuk tombol atau kartu |
| Bayangan | `--shadow-elevated` (0 8px 24px hitam 50%) | Hanya penanda elevasi: dialog dan dropdown. Kartu datar, tanpa bayangan |
| Gerak | `--duration-fast` 150 ms, `--duration-medium` 250 ms, `--duration-slow` 600 ms (v2.0, sapuan cincin skor + isi meter), `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) | Transisi hanya untuk umpan balik (hover, aktif) dan perubahan status (cincin skor). Tanpa animasi masuk per bagian, tanpa loop tanpa akhir |
| Cincin skor | `--ring-score-size` 160 px, `--ring-score-size-sm` 96 px (v2.0) | Diameter luar kanonis ScoreRing; default komponen 128 px tetap ada di antara keduanya. Geometri SVG (viewBox 120, radius 52, stroke 10) tetap milik komponen |
| Breakpoint | Dokumentasi di tokens.css, bukan variabel (v2.0) | `var()` CSS tidak bisa dipakai di `@media`; komponen memakai kelas Tailwind md:/lg:/xl: (768/1024/1280). HP 360 px satu kolom, nol overflow; grid 2 kolom mulai lg 1024 px |
| Lapisan | `--z-sticky` 10, `--z-dropdown` 20, `--z-modal` 30, `--z-toast` 40 | Tidak ada z-index sembarang di komponen |
| Target sentuh | `--tap-min` 48 px | Semua kontrol interaktif minimal 48 x 48 px |

Gerak menghormati `prefers-reduced-motion: reduce` (blok global
di tokens.css, sama dengan a11y.md 3.9): animasi dan transisi
dipersingkat sampai praktis hilang, nilai akhir tetap tampil.

Permukaan browser ikut memakai palet: seleksi teks (putih di
atas hitam), kursor teks putih, dan scrollbar bertema gelap.

### 3.4 Dial v2.0 dan catatan keputusan token (18 Nov 2026)

Dial v2.0 (redesign-v20-spec.md §3): antislop ENERGY 3 / RHYTHM 4 /
MOTION 2; taste DESIGN_VARIANCE 5 / MOTION_INTENSITY 3 /
VISUAL_DENSITY 5. Dial dicatat di sini sebagai konteks keputusan
token; pembaruan dial di §1 menjadi tugas tim lain.

Design Read v2.0: redesign-overhaul aplikasi alat ukur kesehatan
HP (permukaan Operate + satu landing Persuade) untuk pemilik HP
yang punya masalah nyata, dengan bahasa "Alat ukur, hidup":
kanvas hitam, aksen primer putih, warna hanya sebagai informasi
status. Mode impeccable per permukaan mengikuti spec §2
(Beranda Persuade, halaman aplikasi Operate, panduan/info Read).

Keputusan token v2.0, satu baris alasan per token (R-31):

| Token baru | Alasan satu baris |
|---|---|
| `--text-display-lg` 2,5rem | Angka skor di cincin besar harus jelas beda dari judul 1,5rem (spec §5) |
| `--text-display-xl` 3rem | Angka hero dasbor/beranda desktop adalah titik fokus satu layar (spec §5) |
| `--leading-display` 1,1 | Angka display besar butuh tinggi baris rapat yang dinamai, bukan `leading-none` tersebar |
| `--ring-score-size` 160 px | Cincin dasbor desktop "besar, di kiri" (spec §8.2) butuh diameter kanonis |
| `--ring-score-size-sm` 96 px | Riwayat skor mini dan kartu ringkas butuh cincin kecil yang konsisten |
| `--duration-slow` 600 ms | Sapuan cincin skor dan isi meter harus terbaca; nilai ini sudah dipakai ScoreRing sebagai string hardcoded 600 ms, token memberi nama kanonisnya |

Yang sengaja TIDAK ditambah (dan alasannya):

- Warna dekoratif baru: tidak ada. Status tetap 4 warna v1.0
  (K-11); warna adalah informasi, bukan hiasan (colorize:
  di Operate, warna mengkode status, bukan suasana).
- Token terang: tidak ada (K-52). Tema gelap terkunci, satu tema.
- Font eksternal: tidak ada. Font sistem, tanpa unduhan (K-78,
  koneksi lemot).
- Variabel breakpoint: tidak ada. `var()` CSS tidak bisa dipakai
  di `@media`, jadi token breakpoint hanya akan jadi token mati
  yang menyesatkan; breakpoint didokumentasikan sebagai komentar
  di `tokens.css` dan dipakai lewat kelas Tailwind.
- Token lebar layout (`--layout-max`): tidak ada. Belum ada
  konsumen yang membutuhkannya di Wave 1; token tanpa konsumen
  melanggar R-31.
- Nilai token v1.0 yang diubah: tidak ada. Semua perubahan
  v2.0 bersifat penambahan.

`tailwind.config.js` TIDAK diubah: token baru dipakai lewat
`var()` di kelas arbitrary (pola yang sudah ada,
`bg-[var(--color-surface)]`), sama seperti semua token v1.0.
Tidak ada token baru yang butuh eksposur ke Tailwind.

Tindak lanjut untuk Wave 2 (di luar lingkup tim token):
ganti string hardcoded `600ms` di `ScoreRing.tsx` (transisi
`stroke-dashoffset`) ke `var(--duration-slow)`; pakai
`--text-display-lg` untuk angka di dalam cincin besar dan
`--ring-score-size(-sm)` untuk diameter cincin.

---

## 4. Aturan komponen

Lokasi: `apps/web/src/components/ui/`. Semua komponen memakai
kelas Tailwind + token `var()`; tidak ada nilai hardcode untuk
warna, jarak, atau radius di luar file token.

### 4.1 Aturan umum (berlaku untuk semua komponen)

1. Target sentuh minimal 48 x 48 px untuk semua kontrol
   interaktif (tombol, input). Cip status bukan kontrol, jadi
   tingginya 28 px dan tidak bisa diketuk.
2. Indikator fokus putih 2 px, jarak 2 px, hanya untuk keyboard
   (`:focus-visible`, dari tokens.css). Tidak ada komponen yang
   menghilangkan fokus.
3. Setiap tampilan data punya tiga kondisi: memuat (kerangka +
   teks), galat (pesan + tombol "Coba lagi"), kosong yang jujur
   (bukan angka contoh).
4. Informasi tidak pernah hanya lewat warna: status selalu
   disertai teks label.
5. Tanpa data dummy. Angka yang tampil hanya berasal dari props
   (data nyata dari pemanggil). Nilai kosong tampil
   "tidak tersedia", bukan 0.
6. Tanpa emoji, tanpa ikon SVG buatan tangan sebagai hiasan.
   Ikon hanya dari pustaka ikon yang diputuskan proyek, satu
   keluarga untuk seluruh aplikasi.
7. Salinan memakai Bahasa Indonesia netral profesional, kalimat
   pendek, tanpa kata slang, tanpa em dash, tanpa klaim tanpa
   bukti.

### 4.2 Button (`Button.tsx`)

Varian: `primary` (latar putih, teks hitam), `secondary`
(bingkai Zinc 500, latar transparan), `danger` (v2.0: latar
merah solid `--color-error-solid`, teks putih 4,83:1 — dulu
bingkai dan teks merah latar transparan; aksi berbahaya kini
terbaca sekilas sebagai tombol bahaya), `ghost` (teks saja).
Varian dibedakan oleh bentuk dan bingkai, bukan hanya warna.
Tombol nonaktif di semua varian memakai token
`--color-surface-hover` / `--color-text-disabled` (5,81:1),
bukan heks mentah dan bukan opacity.

Keadaan: default, hover, aktif (`scale 0.98`, umpan balik
taktil), nonaktif, memuat (spinner + `aria-busy`, label tetap
terbaca). Tombol nonaktif memakai teks Zinc 400 di atas Zinc
800 (5,81:1), bukan opacity, agar tetap terbaca; pemanggil
wajib menjelaskan alasan nonaktif lewat teks status.

Label tombol memakai kata kerja spesifik ("Periksa WiFi
sekarang", "Coba lagi", "Unduh laporan PDF"), bukan "Mulai"
atau "Klik di sini". Label satu baris; tanpa panah dekoratif.

### 4.3 Card (`Card.tsx`)

Wadah netral: latar `--color-surface`, radius 12 px, padding 16
atau 20 px. Tanpa bingkai: bingkai Zinc 800 gagal batas
komponen 3:1 dan hanya boleh dipakai untuk garis dekoratif
(a11y.md 4.4), jadi pemisah kartu dengan kanvas adalah langkah
permukaan. Kartu yang bisa diketuk (kartu dokter) memakai
bingkai Zinc 500 lewat `className` dari pemanggil.

Kartu bukan struktur halaman: hierarki datang dari isi, bukan
dari kotak yang sama besar dan sama bentuk di semua tempat.

v2.0: prop opsional `status` (tidak mengubah pemakaian lama)
memberi kartu warna latar tinta + bingkai warna status sesuai
keadaan (sukses/peringatan/galat/info). Bingkai status TIDAK
wajib 3:1 — keadaan sudah dibawa latar tinta sepermukaan DAN
label teks wajib (K-94); bingkai adalah isyarat ketiga yang
berlebihan (keputusan Tim A11y, hidden_files/a11y-v20/temuan.md;
bila kartu status menjadi bisa diketuk, keputusan ini wajib
ditinjau ulang). Kartu yang bisa diketuk tetap memakai bingkai
Zinc 500 lewat `className` dari pemanggil.

### 4.4 Input (`Input.tsx`)

Label terlihat di atas input (terhubung `htmlFor` + `id`),
teks bantuan di bawah, pesan galat di bawah dengan `role="alert"`.
Placeholder hanya contoh isi, memakai Zinc 400 (6,91:1 di atas
latar input), bukan pengganti label. Bingkai Zinc 500 (4,35:1).
Tinggi minimal 48 px. Input wajib ditandai teks "(wajib diisi)"
di samping label, bukan hanya tanda bintang.

Galat: `aria-invalid="true"` + `aria-describedby` ke pesan
galat. Pesan galat menjelaskan cara memperbaiki ("PIN harus 4
sampai 8 angka"), bukan hanya "Tidak valid". Fokus dipindahkan
ke galat pertama saat pengiriman gagal (tugas halaman, bukan
tugas komponen ini).

### 4.5 EmptyState (`EmptyState.tsx`)

Judul + penjelasan + aksi opsional. Penjelasan menyebut
penyebab dan langkah berikutnya ("Belum ada data pemeriksaan.
Jalankan diagnosis satu ketuk untuk melihat skor pertama
Anda."), bukan sekadar "Tidak ada data". Judul memakai `<p>`
agar pemanggil yang menentukan hierarki heading halaman. Ikon
bersifat dekoratif (`aria-hidden`). Tanpa ilustrasi generik.

### 4.6 Skeleton (`Skeleton.tsx`)

`Skeleton` (blok) dan `SkeletonText` (baris teks). Bentuknya
meniru tata letak akhir (lebar dan tinggi diisi pemanggil),
jadi halaman tidak melompat saat data tiba. Kilau hanya hiasan
gerak dan mati saat kurangi gerakan aktif. `role="status"` +
teks "Memuat" yang disembunyikan secara visual tetapi dibaca
pembaca layar. Halaman tetap wajib menampilkan teks muat yang
terlihat ("Memuat riwayat...") di samping kerangka.

### 4.7 ScoreRing (`ScoreRing.tsx`)

Cincin skor 0-100 dengan angka dan kategori sebagai teks di
tengah. SVG cincin disembunyikan dari pembaca layar
(`aria-hidden`, a11y.md 6.4); angka dan kategori dibaca sebagai
teks biasa. Label v2.0 (K-94, satu kata untuk satu keadaan di
semua tempat): Baik (80 ke atas, hijau), Perlu diperhatikan
(50–79, kuning), Bermasalah (di bawah 50, merah) — ambang
kanonis 80/50 (K-31). Label lama "Cukup" / "Perlu perhatian"
hanya tersisa di fungsi domain internal (`labelKategori` di
lib/skor.ts, `labelStatus` di lib/doctor.ts) dan tidak pernah
tampil di UI. Label cincin diambil dari
`labelStatus(statusDariSkor(nilai))`, bukan dari pemetaan
lokal. Kategori selalu berupa label teks, bukan hanya warna
cincin.

Skor `null` berarti belum ada data: tampil "tidak tersedia",
bukan 0 dan bukan cincin kosong yang menyesatkan. Satu-satunya
animasi di komponen ini adalah transisi busur 600 ms saat nilai
berubah (perubahan status, bukan hiasan); saat kurangi gerakan
aktif, nilai akhir tampil langsung. Fungsi
`getScoreCategory(score)` diekspor agar halaman lain memakai
ambang yang sama.

### 4.8 MeterStrip (`MeterStrip.tsx`)

Motif identitas "Alat ukur": deretan takik penggaris sebagai
SVG yang digambar dari data (takik mayor tiap 5 takik). Takik
memakai Zinc 500 (4,35:1, lolos batas grafik 3:1); penanda nilai
berupa garis putih 2 px.

Tanpa nilai, strip ini dekoratif murni (`aria-hidden`). Dengan
nilai, strip ini grafik bermakna (`role="img"` + label ringkas),
dan halaman tetap menampilkan nilai yang sama sebagai teks di
dekatnya. Strip tidak pernah dipakai sebagai latar belakang
penuh halaman.

### 4.9 StatusBadge (`StatusBadge.tsx`)

Cip status pil kecil. v2.0 (K-95): prop-nya adalah
`status: StatusWarna` (sukses, peringatan, galat, info,
netral) — tipe `StatusKind` berbahasa Inggris dihapus, beserta
semua adaptor lokal di halaman (KIND_BADGE, kindDariStatus,
dan sejenisnya). Latar tinta 12% + bingkai 45% + teks warna
status (rasio di bagian 3.1, semua lolos AA). Makna selalu
dibawa teks label; titik hanya penanda tambahan untuk keadaan
yang memang hidup (misalnya tes sedang berjalan) dan tidak
pernah berdiri sendiri tanpa label. Cip ini label statis,
bukan wilayah live; halaman mengumumkan perubahan status lewat
LiveRegion (a11y.md 5.3).

---

## 5. Checklist per skill

Setiap skill di bawah dibaca penuh sebelum komponen ditulis
(termasuk rulebook anti-slop inti + 5 sub-skill, referensi
impeccable, stop-slop, dan patterns avoid-ai-writing).
Contoh "sebelum" adalah pola yang ditolak; contoh "sesudah"
adalah yang dipakai di komponen atau dokumen ini.

### 5.1 design-taste-frontend

| Aturan | Diterapkan di | Bukti |
|---|---|---|
| Design Read satu baris sebelum membangun | Bagian 1 dokumen ini | Kalimat Design Read + dial tercatat |
| Dial eksplisit dari brief, bukan baseline diam-diam | Bagian 1 | VARIANCE 3 / MOTION 2 / DENSITY 5 (baris trust-first) |
| Satu aksen, dikunci di seluruh halaman | Token + semua komponen | Aksen putih; warna hanya status |
| Shape Consistency Lock | Token radius + komponen | Tombol/input 8 px, kartu 12 px, pil hanya cip status |
| Button Contrast Check | Button | Primer 21:1, sekunder 19,11:1, bahaya 7,59:1 |
| Form Contrast Check | Input | Label 19,11:1, placeholder 6,91:1, galat 7,59:1 |
| Tanpa em dash di mana pun | Semua file | Grep: 0 temuan karakter em dash dan en dash |
| Tanpa Inter sebagai default | tokens.css | Stack font sistem; alasan: tanpa unduhan font |
| Tanpa ungu AI / gradasi neon | Token | Tidak ada gradasi warna di token |
| Tanpa 3 kartu fitur identik | Card | Kartu wadah netral; hierarki dari isi |
| Eyebrow restraint | Semua komponen | Nol eyebrow; judul berdiri sendiri |
| Tanpa titik dekoratif | StatusBadge | Titik hanya untuk keadaan hidup + selalu dengan label teks |
| Skeleton meniru tata letak akhir | Skeleton | Lebar/tinggi dari pemanggil |
| Keadaan loading / empty / error | Skeleton, EmptyState, Input | Ketiganya ada dan teruji |
| Reduced motion dihormati | tokens.css | Blok global + kilau skeleton mati |

Contoh sebelum/sesudah:

- CTA generik: "Mulai Sekarang" menjadi "Periksa WiFi sekarang"
  (kata kerja spesifik + objeknya).
- Eyebrow di atas judul: label kecil "DIAGNOSIS KESEHATAN HP"
  di atas judul dihapus; judul saja yang bicara.
- Spinner generik di tengah halaman menjadi Skeleton yang
  meniru bentuk kartu hasil akhir.

Aturan yang sengaja tidak dipakai:

- Aturan hero, bento, logo wall, marquee, dan pola landing
  lain: skill ini menyatakan di bagian 13 bahwa ia bukan untuk
  dashboard / product UI. Komponen ini adalah product UI
  (Operate), jadi hanya bagian yang relevan (kontras, state,
  tipografi, anti-default) yang dipakai.
- Dua mode terang/gelap: tidak dipakai; design lock mengunci
  tema gelap (lihat bagian 2).
- Larangan hitam murni: tidak dipakai; design lock memakai
  `#000000` (lihat bagian 2).
- Pustaka Motion / GSAP: tidak dipakai; MOTION 2 hanya butuh
  transisi CSS 150 ms untuk umpan balik.
- Gambar nyata per bagian: tidak berlaku; komponen dasar tidak
  punya slot gambar, dan EmptyState sengaja tanpa ilustrasi
  generik.

**v2.0 (18 Nov 2026, diverifikasi koordinator dari kode):**

| Aturan | Vonis | Bukti |
|---|---|---|
| Design Read + dial dari brief | Lolos | Bagian 1 (dial v2.0 + alasan naik) |
| Hero split asimetris (VARIANCE 5) | Lolos | LandingPage.tsx:258 `lg:grid-cols-[1.15fr_1fr]` |
| Hero butuh visual nyata | Lolos | Panel hero memakai pratinjau komponen nyata (ScoreRing + MeterStrip dengan skor live), bukan div tiruan — jalur yang diizinkan §4.8 |
| Logo brand resmi (bukan tiruan) | Lolos | `public/brand/google-g.svg` (2.326 byte, SVG FirebaseUI © 2016 Google Inc., 4 warna resmi terverifikasi); logo Android sengaja TIDAK dipakai (tidak ada SVG resmi — hanya PNG/AI atau vektorisasi komunitas) |
| Satu aksen + warna status bermakna | Lolos | Aksen interaksi tetap putih; hijau/kuning/merah/biru hanya status + selalu berlabel teks (K-94, `lib/status-warna.ts`) |
| Tanpa gradasi ungu / neon | Lolos | Satu-satunya `linear-gradient` adalah kilau skeleton putih 6% (tokens.css:215); tanpa gradasi warna |
| Tanpa emoji sebagai ikon UI | Lolos | Grep Python rentang emoji di semua `.tsx` non-tes: 0 temuan |
| Eyebrow restraint | Lolos | Grep `uppercase tracking`: 0 temuan |
| Tanpa `h-screen` / lompat viewport HP | Lolos | `min-h-screen` (100vh) diganti `min-h-dvh` di 13 situs, 7 file; CSS build memuat `min-height: 100dvh` |
| Tanpa scroll listener | Lolos | Grep `addEventListener("scroll"`: 0 temuan |
| Reduced motion | Lolos | Blok global tokens.css:232 (semua animasi/transisi 0,01 ms) |
| Tanpa kata filler / "Quietly" / label versi di hero | Lolos | Grep elevate/seamless/unleash/revolutionize/quietly: 0; "v2.0" hanya di komentar kode |
| Middle-dot dijatah | Lolos | 0 baris dengan 2+ tanda `·` |
| Tanpa Inter | Lolos | Stack sistem (tokens.css:61), tanpa unduhan font |
| Panduan grid bervariasi | Lolos | Sel panduan pertama `lg:col-span-2`, sisanya 1 kolom |

Temuan yang diputuskan (bukan disembunyikan):

- Strip keunggulan landing (3 sel sejajar, LandingPage.tsx:415)
  berbentuk strip ber-hairline gabung (`gap-px`), bukan 3 kartu
  melayang — tetapi pola isinya (ikon + judul + teks × 3) tetap
  bentuk klise. Diputuskan: dipertahankan karena isinya
  fungsional (navigasi ke dokter), bukan fitur pemasaran.
- Ikon SVG buatan tangan: lihat bagian 2 (diputuskan, beralasan).
- Em dash: prosa live 0; pengecualian tercatat di bagian 2.

### 5.2 impeccable

Mode Operate, code-led (permukaan Operate dibangun dengan kode,
bukan lewat ronde kompas, sesuai kontrak mode). `impeccable
context` dijalankan di awal sesi (exit 0, PRODUCT.md dimuat).

| Aturan | Diterapkan di | Bukti |
|---|---|---|
| Brief wins: dunia yang dipatok dipertahankan | Semua komponen | "Alat ukur" dari PRODUCT.md, bukan selera agen |
| Craft floor: kontras | Token | Bagian 3.1, semua pasangan lolos AA |
| Craft floor: depth | Token bayangan | Bayangan hanya elevasi, offset + blur |
| Craft floor: spacing | Token jarak + komponen | Kelompok rapat, pemisah longgar |
| Craft floor: type | Token tipografi | Skala rem tetap, prosa maks 65ch |
| Craft floor: motion | ScoreRing | Satu momen gerak (transisi busur); tanpa entrance per bagian |
| Craft floor: states | Button, Input | Hover, nonaktif, memuat, galat, kosong |
| Craft floor: browser surfaces | tokens.css | Seleksi, kursor teks, scrollbar bertema |
| Craft floor: copy | Semua salinan | Kontrol menamai aksinya; galat menamai masalah + perbaikan |
| Tanpa eyebrow (ban) | Semua komponen | Nol eyebrow |
| Tanpa gradient text | Semua komponen | Penekanan lewat bobot dan ukuran |
| Tanpa glassmorphism default | Token + komponen | Tidak ada backdrop-filter di komponen |
| Tanpa garis tepi warna di kartu | Card | Tanpa bingkai sama sekali |
| Tanpa ikon glyph/emoji | Semua komponen | Tanpa emoji; ikon hanya lewat slot pemanggil |
| Mono hanya untuk data ukur | ScoreRing, `.dh-numeric` | Mono untuk angka, bukan kostum teknis |

Contoh sebelum/sesudah:

- Skor hanya cincin berwarna menjadi angka + label kategori
  sebagai teks ("78 / Baik").
- "Tidak ada data" menjadi judul + penyebab + aksi di
  EmptyState.
- Spinner di tengah konten menjadi Skeleton meniru tata letak
  akhir.

Aturan yang sengaja tidak dipakai:

- Prosedur concept-seed dan undian arah: tidak dijalankan;
  arah sudah dipatok brief dan new-work menyatakan arah yang
  dipatok mengalahkan undian (lihat bagian 2).
- Ronde kompas visual: tidak berlaku; permukaan Operate
  bersifat code-led menurut kontrak mode.

**v2.0 (18 Nov 2026, diverifikasi koordinator dari kode):**

| Aturan | Vonis | Bukti |
|---|---|---|
| Brief wins | Lolos | "Alat ukur, hidup" (redesign-v20-spec.md); angka tetap di depan, warna menambah makna status |
| Craft floor: kontras | Lolos | 117 pasangan dihitung ulang (hidden_files/a11y-v20/temuan.md): 100 lolos, 17 di bawah ambang semuanya didisposisikan tertulis; teks status terendah 6,76:1, badge 5,78:1, putih di merah solid 4,83:1 |
| Craft floor: states | Lolos | Semua 19 halaman punya loading/skeleton, empty jujur, error + retry (diuji vitest per halaman) |
| Craft floor: motion | Lolos | Sapuan cincin 600 ms (token `--duration-slow`) + transisi status 150–250 ms; tanpa loop kecuali kilau skeleton (mati saat kurangi gerakan) |
| Tanpa glassmorphism / glow / gradient text | Lolos | 0 `backdrop-filter`, 0 glow, 0 gradient text di `src/` |
| Tanpa garis tepi warna di kartu netral | Lolos | Kartu netral tetap tanpa bingkai; bingkai warna hanya di kartu `status` (keputusan bagian 4.3) |
| Mono hanya angka ukur | Lolos | `.dh-numeric` + `tabular-nums` untuk angka; tanpa mono kostum |
| Tanpa ikon glyph/emoji | Lolos | 0 emoji (grep); ikon geometris garis konsisten (lihat bagian 2) |
| Fokus keyboard terlihat | Lolos | 7 kombinasi halaman/lebar × 14 langkah Tab: 0 elemen terfokus tanpa indikator (temuan.md); outline putih 2 px 21:1 |
| Target sentuh | Lolos | Minimum 48 px (token `--tap-min`); hanya sub-48 px: tautan sebaris (pengecualian WCAG 2.5.8) + skip link sr-only |

### 5.3 humanizer

Diterapkan pada semua salinan yang dibaca pengguna di komponen
dan dokumen ini.

| Pola yang dihapus | Contoh sebelum | Contoh sesudah |
|---|---|---|
| Not-X-but-Y (§1) | "Bukan sekadar tes kecepatan, tapi diagnosis lengkap HP Anda" | "Tes ini mengukur kecepatan unduh dan latensi HTTP." |
| One-line closer (§2) | "Itulah yang membuat skor ini penting." | (dihapus; angka + kategori sudah bicara) |
| Staged run-up (§4) | "Yuk, mulai diagnosis sekarang!" | "Periksa WiFi sekarang" |
| Inflasi makna (§3, §13) | "Skor kesehatan Anda sangat penting untuk performa optimal perangkat" | "Skor 78 dari 100, kategori Baik." |
| Em dash (§8) | "Kecepatan turun, dari 50 KB/detik, menjadi 3,2 KB/detik" | "Kecepatan turun dari 50 KB/detik menjadi 3,2 KB/detik." (tanpa dash) |
| Bold sebagai hiasan (§19) | Label tebal di setiap baris daftar | Teks biasa; hierarki lewat ukuran dan warna |
| Chatbot residue (§22) | "Semoga membantu! Beri tahu kami bila ada pertanyaan." | (tidak ada penutup chatbot di UI) |

Tidak ada aturan humanizer yang sengaja tidak dipakai. Pola
§26 (menjelaskan ulang konteks yang sudah diketahui pembaca)
tidak muncul karena salinan UI bersifat fungsional dan pendek.

**v2.0 (18 Nov 2026, Tim Copy + verifikasi koordinator):**

| Pola yang dihapus | Contoh sebelum | Contoh sesudah |
|---|---|---|
| Kalimat bertentangan dengan verdict (§1, kontradiksi) | Grafik konstan 500 KB/detik berlabel "Tidak stabil" tetapi kalimatnya "Kecepatan stabil selama 30 detik." | Kalimat dipilih dari verdict kanonis: "Kecepatan tidak stabil selama 30 detik. Coba tes lagi saat jaringan tidak dipakai perangkat lain." (akar: `ringkasanBertahan` awal 0 kini `stabil: false`) |
| Klaim salah (§15, rider dangkal) | teksVerdict: kecepatan "naik turun tanpa pola yang jelas" | Dihapus — grafik konstan 500 datar, bukan naik-turun |
| Em dash (§8) | panduan.ts 26, id.json 21, en.json 22, kebijakan-privasi.md 8, copy.md 42 | panduan.ts 0; id.json 15 / en.json 16 (sisa kunci belum live K-62); kebijakan-privasi.md 1 (hanya judul H1); copy.md 19 (judul + kutipan setia + label dokumen); prosa live di `.tsx` 0 |
| Inkonsistensi label status | "Cukup" (skor 68) di kartu AI vs "Perlu diperhatikan" di dasbor | Satu kosakata K-94 di semua tempat termasuk PDF + kartu konteks AI (K-99) |

Tidak ada aturan humanizer yang sengaja tidak dipakai di v2.0.

### 5.4 stop-slop

| Aturan | Diterapkan di |
|---|---|
| Tanpa filler dan pembuka basa-basi | Label tombol dan judul langsung ke isi |
| Tanpa kontras biner | Tidak ada pola "bukan X, tapi Y" di salinan |
| Suara aktif, pelaku disebut | "Jalankan diagnosis" (pelaku: pengguna), bukan "Diagnosis dijalankan" |
| Spesifik, tanpa deklarasi kabur | "Kecepatan unduh 2,4 MB/detik, kategori Cepat", bukan "Kecepatan Anda baik" |
| Tanpa adverb | Tidak ada "sangat", "benar-benar", "sebenarnya" di salinan UI |
| Tanpa em dash | Grep: 0 temuan |
| Dua butir mengalahkan tiga | EmptyState: judul + penjelasan (aksi opsional), tanpa baris hiasan ketiga |

Contoh sebelum/sesudah:

- "Sangat penting untuk memeriksa WiFi Anda secara berkala"
  menjadi "Periksa WiFi sekarang".
- "Hasil tes ini sebenarnya menunjukkan bahwa koneksi Anda
  lambat" menjadi "Kecepatan unduh 120 KB/detik, kategori
  Lambat."

Nilai mandiri (rubrik skill): Directness 9, Rhythm 8, Trust 9,
Authenticity 8, Density 9, total 43/50 (ambang revisi: di
bawah 35). Salinan UI di sini pendek dan fungsional, jadi
penilaian ritme berlaku terbatas.

**v2.0 (18 Nov 2026, diverifikasi koordinator dari kode):**
klaim v1.0 "tanpa adverb" dikoreksi — grep menemukan
"sebenarnya" (TentangPage:19 "kecepatan WiFi yang sebenarnya",
BateraiPage:384 "Angka sebenarnya bisa berbeda") dan "sangat"
(PrivasiPage:366, SyaratPage:257 "informasi yang sangat
sensitif"). Ketiganya DIPERTAHANKAN dengan alasan: "yang
sebenarnya" membedakan hasil ukur dari klaim (makna, bukan
filler); "Angka sebenarnya bisa berbeda" membedakan estimasi
dari kenyataan; "sangat sensitif" adalah frasa baku dokumen
hukum. Tanpa "benar-benar" di salinan UI. Aturan lain
(filler, kontras biner, suara aktif, spesifik) tetap lolos;
`docs/copy.md` disinkronkan ke salinan live (§1–§12) oleh
Tim Copy.

### 5.5 no-ai-slop

| Pola yang dihapus | Contoh sebelum | Contoh sesudah |
|---|---|---|
| Klaim tanpa bukti (portability test) | "Yang membuat kami berbeda: teknologi AI terdepan" | (dihapus; tidak ada klaim tanpa bukti) |
| Daftar kata sifat tanpa kata kerja | "Diagnosis AI: cerdas, cepat, akurat" | "Tulis keluhan Anda. AI memberi saran berdasarkan data pemeriksaan terakhir Anda." |
| Kicker sok mendalam | "Skor Anda: 78. Luar biasa!" | "Skor 78 dari 100, kategori Baik." |
| Colon reveal | "Rahasianya: satu ketukan." | "Ketuk Diagnosis satu ketuk untuk menghitung skor." |
| Synonym cycling | "skor / nilai / angka kesehatan" bergantian | Satu istilah: "skor" di semua tempat |
| Importance puffery | "Fitur ini memainkan peran penting" | (dihapus; fungsi fitur dijelaskan langsung) |

Tidak ada aturan no-ai-slop yang sengaja tidak dipakai.

**v2.0 (18 Nov 2026):** dua godaan data karangan ditolak
dengan benar oleh tim halaman — cip status per entri riwayat
AI TIDAK dibuat (API tidak punya kolom sumber/status per
entri; membuatnya berarti memalsukan data) dan ekspor PDF di
Pengaturan TIDAK ditambahkan (tidak ada endpoint; itu
permintaan fitur, bukan redesign). Cip kuota AI memakai
`MeterStrip` + `StatusBadge` dari angka kuota nyata (20/hari).
Tidak ada klaim tanpa bukti yang ditambahkan di v2.0.

### 5.6 avoid-ai-writing

Audit mode detect diterapkan pada semua salinan komponen;
tidak ada temuan yang dibenarkan untuk diubah setelah draf
awal ditulis bersih (0 editing pass tambahan). Pemeriksaan
bersifat model-only: detektor skill ini dikalibrasi untuk
bahasa Inggris, jadi pola katalog diterapkan dengan membaca
salinan Indonesia, bukan dengan menjalankan detektor.

| Pola yang dihindari | Keterangan |
|---|---|
| Kata Tier 1 (delve, leverage, robust, seamless, cutting-edge, pivotal, comprehensive) | Tidak ada padanan kata-kata itu di salinan; kata yang dipakai: ukur, periksa, simpan, coba lagi |
| Konstruksi "Let's" | Tidak ada ajakan "Mari..." di salinan UI |
| Hollow intensifier | Tidak ada "benar-benar", "sungguh", "nyata" sebagai penekan kosong |
| Vague endorsement | Tidak ada "layak dicoba" atau "wajib dibaca" |
| Significance inflation | Tidak ada "momen penting" atau "era baru" |
| Chatbot artifacts | Tidak ada "Semoga membantu!" atau "Pertanyaan bagus!" |
| Speculative gap-filling | Data kosong tampil "tidak tersedia", tidak pernah ditebak |
| Fake-casual register | Tidak ada "pro tip", "fun fact", atau penutup satu kata |

Residual: kata "Perlu" di "Perlu perhatian" adalah nama
kategori produk dari PRODUCT.md (konten yang dilindungi),
bukan intensifier; dipertahankan apa adanya.

**v2.0 (18 Nov 2026) — koreksi residual:** label "Perlu
perhatian" sudah TIDAK tampil di UI (K-94 menggantinya dengan
"Perlu diperhatikan" di semua tempat). Kata "Perlu" di "Perlu
diperhatikan" adalah nama kategori produk yang sama
(konten yang dilindungi), bukan intensifier. Audit mode
detect diterapkan ulang pada salinan v2.0: 0 temuan yang
dibenarkan untuk diubah setelah sapuan Tim Copy (prosa live
0 em dash; 0 "Mari..."; 0 kata Tier 1). Pemeriksaan bersifat
model-only (detektor skill dikalibrasi untuk bahasa Inggris).

### 5.7 anti-slop (core + UI + copywriting + human + layoutmobile + code)

Mode `during`. Dial ENERGY 1 / RHYTHM 2 / MOTION 1.
Design Read di bagian 1. Liveliness: satu titik fokus per
layar (angka ukur), satu aksen yang disengaja (putih), satu
motif identitas (strip meter), whitespace sebagai struktur.

Hard Gate (semua jawaban harus "tidak"):

| Aturan | Vonis | Bukti |
|---|---|---|
| R-02 tanpa em dash | Lolos | Grep 0 temuan di 10 file |
| R-03 mobile sempurna | Lolos | Phone-first 360 px; tanpa `overflow-x`; target 48 px; tanpa tinggi viewport tetap |
| R-17 tanpa statistik tanpa sumber | Lolos | Semua angka dari props; tanpa angka contoh |
| R-18 tanpa testimoni fiktif | Lolos | Tidak ada bagian testimoni |
| R-23 tanpa aset tanpa instruksi | Lolos | Tidak ada logo/avatar/ilustrasi yang dibuat; EmptyState tanpa ilustrasi |
| R-24 tanpa tautan mati | Lolos | Komponen dasar tidak berisi navigasi |
| R-25 kontras AA | Lolos | Bagian 3.1; semua pasangan dihitung |
| R-26 tanpa kontrol mati | Lolos | Button selalu punya aksi dari pemanggil; tidak ada tombol pajangan |
| R-27 tiga keadaan | Lolos | Skeleton (memuat), Input galat + tombol "Coba lagi" (galat), EmptyState (kosong) |
| R-28 tanpa FAQ templat | Lolos | Tidak ada FAQ |
| R-32 keyboard | Lolos | Elemen asli `<button>`/`<input>`; fokus putih 2 px; tanpa `outline: none` |
| R-33 tanpa patch skrip | Lolos | Semua gaya ditulis langsung di sumber |
| R-34 tema yang dikirim berfungsi | Lolos | Satu tema gelap; tidak ada toggle setengah jadi |
| R-35 verifikasi sebelum kirim | Lolos | Bagian 9: typecheck + build Tailwind + build Vite |
| R-36 tanpa klaim karangan | Lolos | Tidak ada klaim keamanan/kinerja |
| R-37 arah desain ada | Lolos | Design lock PRODUCT.md + Design Read bagian 1 |
| R-38 konten nyata atau placeholder jujur | Lolos | "tidak tersedia" / "Belum ada data", bukan angka contoh |

Purpose-Gate (teknik + alasan tertulis):

| Teknik | Alasan tertulis |
|---|---|
| Warna status (R-01) | Hanya empat warna fungsi; masing-masing menandai satu keadaan yang juga ditulis sebagai teks |
| Ikon (R-04) | Tidak ada ikon bawaan di komponen; slot ikon EmptyState diisi pemanggil dengan ikon yang relevan |
| Tipografi (R-06) | Font sistem (tanpa unduhan); mono hanya angka ukur; tanpa label uppercase berjarak lebar |
| Latar (R-07) | Tanpa pola latar; strip meter adalah motif identitas subjek, digambar sebagai SVG |
| Panah tombol (R-08) | Tidak dipakai; label tombol sudah menjelaskan aksi |
| Badge (R-09) | StatusBadge hanya untuk status nyata dengan label teks; tanpa pil "AI Powered"/"Beta" |
| Glassmorphism (R-10) | Tidak dipakai di komponen mana pun |
| Bayangan (R-12) | Hanya `--shadow-elevated` untuk dialog/dropdown; kartu datar |
| Glow (R-13) | Tidak dipakai di komponen mana pun |
| Kartu fitur (R-14) | Card adalah wadah netral; variasi datang dari isi, bukan dari kotak |
| Animasi (R-19) | Transisi status 150 ms + busur skor 600 ms; tanpa loop tanpa akhir |
| Ilustrasi (R-22) | Tidak ada ilustrasi generik; EmptyState tanpa gambar |

Quality Locks: satu palet (bagian 3.1), satu sistem radius
(bagian 3.3), satu hierarki CTA (primer putih, sekunder
bingkai, bahaya merah, ghost teks), semua keputusan beralasan
satu baris (bagian 2 dan 4).

Sub-skill code (komentar kode): komentar di komponen hanya
menjelaskan alasan dan batasan yang tidak terlihat dari kode
(misalnya kenapa kartu tanpa bingkai, kenapa teks nonaktif
bukan opacity); tanpa banner dekoratif, tanpa narasi langkah,
tanpa emoji, maksimal dua baris per blok.

**v2.0 (18 Nov 2026, dial ENERGY 3 / RHYTHM 4 / MOTION 2):**

Hard Gate yang berubah nilainya di v2.0:

| Aturan | Vonis v2.0 | Bukti |
|---|---|---|
| R-02 tanpa em dash | Lolos dengan pengecualian tercatat | Prosa live 0; pengecualian di bagian 2 |
| R-03 mobile sempurna | Lolos | 0 overflow di semua halaman (1280 + 360, diukur per halaman); `min-h-dvh`; target 48 px |
| R-17 tanpa statistik tanpa sumber | Lolos | Semua angka dari props/API; 2 godaan karangan ditolak (§5.5) |
| R-23 tanpa aset tanpa instruksi | Lolos | Satu-satunya aset baru adalah logo Google resmi (sumber resmi, lokal); tanpa ilustrasi generik |
| R-25 kontras AA | Lolos | 117 pasangan (§5.2); bingkai galat input diperbaiki ke 6,40:1 (konstanta `BINGKAI_GALAT_KOLOM`) |
| R-27 tiga keadaan | Lolos | 19 halaman: skeleton + empty jujur + error/retry |
| R-32 keyboard | Lolos | 0 elemen terfokus tanpa indikator (§5.2); skip link berfungsi |
| R-35 verifikasi sebelum kirim | Lolos | Bagian 9.6: vitest 456/456 + API 411/411 + typecheck + build; E2E browser tertunda jendela sandbox TERBUKA (dicatat, bukan diklaim) |

Purpose-Gate v2.0: warna status (R-01) kini alasan utamanya —
setiap warna menandai satu keadaan yang juga ditulis sebagai
teks (K-94); badge (R-09) kini memakai `StatusWarna` langsung
(K-95); animasi (R-19) tetap 150–600 ms tanpa loop.

---

## 6. Wiring tema (selesai 17 Nov 2026)

Temuan Tim Landing: `apps/web/src/index.css` masih memakai tema
terang placeholder (`bg-mist` / `text-ink`) dan `tokens.css`
belum diimpor. Wiring dikerjakan sebagai bagian tugas ini:

1. `index.css` kini mengimpor `./styles/tokens.css` di baris
   paling atas (aturan CSS mewajibkan `@import` sebelum aturan
   lain; Vite menempelkan isinya saat build), lalu direktif
   Tailwind seperti biasa.
2. Blok `body { @apply bg-mist text-ink antialiased; }` dihapus
   total. Latar dasar aplikasi kini hitam `#000000` dari
   tokens.css, sesuai design lock.
3. Gaya dasar konsisten dengan docs/a11y.md dan K-11: latar
   hitam, teks Zinc (tidak ada teks lebih gelap dari Zinc 400),
   indikator fokus putih 2 px dengan jarak 2 px
   (`:focus-visible`), target sentuh minimal 48 px, gerak
   menghormati `prefers-reduced-motion`.
4. `main.tsx` tidak disentuh (milik Tim Shell). Tidak ada
   halaman tim lain yang diubah.

Utang tindak lanjut (bukan file tugas ini, perlu koordinator):

- `tailwind.config.js` masih mendefinisikan token terang
  placeholder (`ink`, `paper`, `mist`) dengan komentar bahwa
  tim desain mengisi sistem final. Rekomendasi: ganti dengan
  token Zinc proyek atau hapus; tidak ada file di `src/` yang
  memakai `mist`/`ink` lagi (diperiksa dengan grep, 17 Nov
  2026), jadi penghapusan aman.
- Halaman tim lain (HomePage, NotFoundPage) belum diaudit
  terhadap token ini; tim fitur memakai komponen di bagian 4
  sebagai pengganti gaya ad hoc.

---

## 7. Salinan kanonik

Salinan di bawah adalah teks standar yang dipakai komponen
dan halaman. Satu istilah untuk satu konsep: "skor" (bukan
"nilai kesehatan"), "tes" (bukan "pemeriksaan" untuk WiFi
saja), "pemeriksaan" untuk entri riwayat.

| Keadaan | Teks |
|---|---|
| Judul kosong (riwayat) | Belum ada data pemeriksaan |
| Penjelasan kosong (riwayat) | Jalankan diagnosis satu ketuk untuk melihat skor pertama Anda. |
| Nilai tidak tersedia | tidak tersedia |
| Tombol galat | Coba lagi |
| Tombol tes WiFi | Periksa WiFi sekarang |
| Tombol diagnosis | Diagnosis satu ketuk |
| Tombol unduh PDF | Unduh laporan PDF |
| Teks memuat | Memuat... (dengan objeknya, misalnya "Memuat riwayat...") |
| Banner server putus | Tidak tersambung ke server. Hasil tes tidak tersimpan, tetapi tes WiFi tetap bisa jalan. |
| Label AI | Saran dari AI |
| Kategori skor | Baik / Cukup / Perlu perhatian |
| Klasifikasi WiFi | Sangat lambat / Lambat / Cukup / Cepat / Sangat cepat |
| Latensi | Latensi HTTP (bukan "ping") |
| Estimasi | Perkiraan (selalu dilabeli sebagai perkiraan) |

---

## 8. Cara memakai (untuk tim fitur)

1. Impor komponen dari `components/ui/`:
   `import { Button } from "./components/ui/Button";`
   (tidak ada file barrel `index.ts`; impor langsung per file).
2. Warna dan jarak selalu lewat token `var()`; jangan menulis
   hex baru di halaman. Pasangan warna baru wajib dihitung
   rasionya dulu dan dicatat di docs/a11y.md bagian 4.
3. Halaman yang memuat data memakai `Skeleton` + teks muat yang
   terlihat, `EmptyState` saat kosong, dan pesan galat + tombol
   "Coba lagi" saat gagal.
4. Perubahan status diumumkan lewat wilayah live proyek
   (`LiveRegion`, a11y.md 5.3): `role="status"` untuk hasil
   selesai, `role="alert"` untuk galat penting. Angka live yang
   berubah tiap detik tidak masuk wilayah live.
5. Grafik (riwayat skor, tes bertahan) memakai `role="img"` +
   `aria-label` ringkas dan menyediakan ringkasan teks atau
   tabel data alternatif (a11y.md 6.4). `ScoreRing` dan
   `MeterStrip` sudah mengikuti pola ini.

---

## 9. Hasil verifikasi

Semua verifikasi dijalankan 17 November 2026, sebelum dokumen
ini dikirim.

### 9.1 Typecheck ketat (lolos)

Delapan file komponen disalin ke proyek scratch `/tmp/dh-check`
(TypeScript 5.9, React 19, `@types/react` 19) dengan flag yang
sama seperti `tsconfig.json` proyek: strict, noUnusedLocals,
noUnusedParameters, isolatedModules, jsx react-jsx,
moduleResolution bundler. Perintah `tsc --noEmit`: exit 0,
tanpa error.

### 9.2 Kompilasi Tailwind v3.4 (lolos)

Di `/tmp/dh-check` yang sama, Tailwind 3.4 + PostCSS + Autoprefixer
mengompilasi direktif Tailwind + isi `tokens.css` menjadi
`output.css` 23.509 byte. Semua kelas arbitrary-value berbasis
token yang dipakai komponen terbukti ter-generate, termasuk
`min-h-[48px]` (1 aturan, dipakai Button dan Input),
`text-[var(--color-text-primary)]`,
`border-[var(--color-border-strong)]`,
`bg-[var(--color-success-bg)]`,
`placeholder:text-[var(--color-text-placeholder)]`, dan
`animate-spin` + `sr-only` (total 27 aturan berbasis
`var(--color-...)` di luar definisi `:root`).

Catatan: pemeriksaan grep awal sempat salah baca karena pola
grep tidak memperhitungkan escape backslash Tailwind
(`var\(` di selektor CSS). Pemeriksaan ulang dengan
`grep -F` pada bentuk selektor yang benar membuktikan semua
kelas ada.

### 9.3 Rasio kontras (lolos)

Semua pasangan di bagian 3.1 dihitung dengan skrip
`contrast-check.py` skill antislop-human dan cocok dengan
tabel docs/a11y.md bagian 4.3. Tidak ada teks di bawah 4,5:1;
tidak ada bingkai komponen interaktif di bawah 3:1.

### 9.4 Kebersihan teks (lolos)

Grep di 10 file tugas (8 komponen + tokens.css + index.css):
0 temuan em dash, 0 temuan en dash sebagai pemisah, 0 kata
slang sesuai daftar larangan di tugas. Semua file non-0 byte, ditulis via
file `.tmp` + `mv` atomik (aturan EPERM).

### 9.5 Build Vite 8.3.8 (CSS terverifikasi; satu kegagalan di luar lingkup)

Build Vite nyata dijalankan di salinan proyek (`/tmp/dh-check/app`)
dengan dependensi dari cache npm lokal (registry npm tidak bisa
dijangkau dari VM saat verifikasi berjalan; instalasi memakai
`--prefer-offline`).

Hasil:

- 65 modul ter-transformasi; bundle CSS 22.939 byte terbit dan
  isinya terverifikasi: `:root` berisi token
  (`--color-bg:#000`, `--color-text-primary:#f4f4f5`),
  `body{background-color:var(--color-bg);color:var(--color-text-primary)...}`,
  aturan global `:focus-visible{outline:2px solid #fff}`
  (dipastikan berupa selektor telanjang, bukan class),
  `min-height:48px`, kelas `.dh-skeleton`, dan 0 jejak
  `bg-mist`/`text-ink`. Wiring tema terbukti ujung ke ujung
  di build nyata.
- Aturan `:focus-visible` kedua di bundle
  (`outline:2px solid #0000`) adalah utilitas Tailwind
  `focus-visible:outline-none` yang terikat class dari
  PengaturanPage (dipasangkan dengan ring putih); aturan ini
  tidak menimpa aturan fokus global di elemen lain.
- Build berakhir exit 1 hanya karena satu impor: `jspdf` dari
  `src/lib/pdf.ts` (milik tim laporan). Dependensi
  `jspdf ^4.2.1` baru dideklarasikan di `apps/web/package.json`
  oleh tim lain saat verifikasi berjalan; tarball 4.x tidak
  ada di cache npm lokal dan registry tidak bisa dijangkau,
  jadi paket tidak bisa dipasang di salinan ini. Kegagalan
  ini bukan dari file tugas ini dan tidak menyangkut tema:
  bundle CSS sudah terbit lengkap sebelum kegagalan terjadi.
  Tim scaffold/integrasi sedang menangani pemasangan jspdf
  di salinan mereka sendiri saat dokumen ini ditulis.

Catatan untuk koordinator (di luar file tugas ini):

- Instalasi `node_modules` di root workdir saat ini tidak
  lengkap (`vite/dist/node/cli.js` hilang; hanya file `.d.ts`
  yang ada) dan `jspdf` belum terpasang di sana. Tim yang
  menjalankan `npm install` di root perlu mengulang setelah
  egress pulih.
- `PengaturanPage.tsx` memakai `disabled:opacity-50` dan kelas
  tombol mentah, bukan komponen Button. Hal ini inkonsisten
  dengan panduan bagian 4.2 (tombol nonaktif memakai gaya
  eksplisit, bukan opacity) dan perlu diselaraskan tim fitur.
- `tailwind.config.js` masih berisi token terang placeholder
  (`ink`, `paper`, `mist`); lihat bagian 6.

### 9.6 Verifikasi redesign v2.0 (18 November 2026, koordinator)

Semua angka di bawah dijalankan langsung oleh koordinator
(Spawn subagent Wave 3b gagal — `subagent bootstrap is no
longer authorized` — sehingga Wave 3b dikerjakan koordinator
sendiri; keputusan K-101).

- Web vitest: **456/456, 28 file, exit 0** (88 detik).
- API vitest: **411/411, 14 file, exit 0** (backend tidak
  diubah redesign).
- Typecheck `tsc --noEmit`: exit 0 (apps/web).
- Build: CLI `vite build` + `npm run build` gagal EPERM saat
  sandbox TERBATAS (npm mati menulis log; Vite mati memuat
  config). Pengganti yang terbukti: build in-memory
  `vite.build({ write: false })` — 40 berkas, 1.460.695 byte,
  CSS 26.795 byte, `min-height: 100dvh` + `font-size:
  var(--text-display-lg)` hadir; dan kompilasi Tailwind
  langsung (PostCSS + tailwindcss + autoprefixer) — 35.119
  byte, aturan `.min-h-dvh` ada, 0 aturan `100vh`, 0
  `color:var(--text-display` (K-98 bertahan). Satu build
  kanonis CLI tetap wajib diulang saat sandbox TERBUKA, dan
  CI di push Wave 4 membuktikannya di lingkungan bersih.
- Kontras: 117 pasangan dihitung ulang (Tim A11y) — 100
  lolos, 17 didisposisikan tertulis (bukti:
  hidden_files/a11y-v20/temuan.md).
- Kebersihan teks: prosa live 0 em dash; panduan.ts 0;
  id.json 15 / en.json 16 (kunci belum live K-62);
  kebijakan-privasi.md 1 (judul H1); copy.md 19 (judul +
  kutipan setia + label dokumen); 0 emoji di `.tsx` non-tes;
  0 `uppercase tracking`.
- E2E browser: **TERTUNDA — sandbox TERBATAS.** Runner
  `playwright test` gagal EPERM saat memuat config TS;
  Chromium (SIGTRAP) dan Firefox (SIGSEGV) mati saat
  diluncurkan. Harness pengganti sudah siap dan menunggu
  jendela TERBUKA: mem-server in-memory
  (hidden_files/tes-v20/serve-mem-w3b.mjs, port 4413,
  terverifikasi menyajikan `/` 200 + `/api/auth/status` +
  `brand/google-g.svg` 200) + skrip E2E playwright-core
  (hidden_files/tes-v20/e2e-w3b.mjs: smoke tamu, tes WiFi
  tamu, dasbor dalam sesi via mock rute, keypad PIN + buka
  kunci via mock rute, cek overflow + fokus keyboard).
  Status ini dicatat sebagai utang Wave 3b, BUKAN diklaim
  lolos.
