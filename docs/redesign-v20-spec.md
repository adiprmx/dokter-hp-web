# Spesifikasi Redesign Total v2.0 — Dokter HP Web App

> Perintah owner 18 Nov 2026 14:09–14:10 WIB: "web nya bener bener membosankan!"
> + "gada warna aksen (ijo, merah, kuning) ataupun logo logo brand seperti google!"
> Dokumen ini adalah ARAH yang mengikat semua tim redesign. Bukan poles — rombak total.

## 1. Diagnosis (dari screenshot live v1.0)

- Beranda = tumpukan kartu abu monoton di latar hitam, tanpa warna sama sekali.
  Judul, tombol, kartu, semua abu/putih datar. Hierarki hampir tidak ada.
- Token warna status SUDAH ADA di `styles/tokens.css` (hijau/merah/kuning/biru +
  varian bg/border/solid, lolos WCAG AA) — tapi hampir tidak dipakai di halaman.
  Masalahnya bukan tokennya tidak ada, melainkan tidak diterapkan.
- Tombol "Masuk dengan Google" tanpa logo Google — hanya teks.
- Dasbor tanpa sesi = error-state kosong yang luas, tanpa nyawa.
- Dial v1.0 sengaja rendah (antislop ENERGY 1 / RHYTHM 2 / MOTION 1) — owner
  menolak hasilnya. Dial v2.0 dinaikkan (lihat §3).

## 2. Konsep: "Alat ukur, hidup"

Jiwa "Alat ukur" DIPERTAHANKAN: angka di depan, jujur, tanpa gimik, tanpa angka
karangan. Yang berubah: alat ukurnya kini HIDUP — meter berwarna sesuai hasil,
verdict terbaca sekilas, gerak bermakna saat angka berubah, layout memanfaatkan
lebar layar.

- Basis tetap hitam `#000000` / abu Zinc, aksen primer interaksi tetap PUTIH
  (design lock owner — tidak berubah).
- Warna HANYA untuk status (lihat §4). Tidak ada warna dekoratif acak, tidak ada
  gradasi ungu generik, tidak ada kartu kaca templat.
- Mode impeccable per permukaan: Beranda = Persuade; halaman aplikasi
  (Dashboard, Dokter, Riwayat, AI, Pengaturan, PIN) = Operate; panduan + info
  (Tentang, Privasi, Syarat) = Read.

## 3. Dial v2.0 (menggantikan dial v1.0 di DESIGN_AUDIT §1)

- Antislop: `ENERGY 3 / RHYTHM 4 / MOTION 2` (dari 1/2/1).
- Taste-skill: `DESIGN_VARIANCE 5 / MOTION_INTENSITY 3 / VISUAL_DENSITY 5`
  (dari 3/2/5 — densitas tetap, variasi dan gerak naik).
- Alasan: pengguna datang dengan masalah dan butuh jawaban yang bisa dipercaya
  — tetapi jawaban yang datar dan monoton tidak dipercaya maupun dipakai.
  Warna status dan gerak adalah INFORMASI, bukan hiasan.

## 4. Warna status — satu-satunya sumber kebenaran

Pakai token yang SUDAH ADA di `tokens.css` (`--color-success/error/warning/info`
+ varian `-bg`, `-border`, `-solid`). JANGAN buat nilai hex baru untuk status
di luar token. Pemetaan arti (konsisten di SEMUA halaman):

| Keadaan | Warna | Token teks | Dipakai di |
|---|---|---|---|
| Sehat / baik / sukses / live | Hijau | `--color-success` (#34d399) | Skor ≥ 80, verdict "bertahan", badge live, sukses simpan |
| Peringatan / cukup / pending / tidak stabil | Kuning | `--color-warning` (#facc15) | Skor 50–79, verdict "tidak stabil", pending, peringatan |
| Masalah / buruk / gagal / error | Merah | `--color-error` (#f87171) | Skor < 50, verdict "jatuh", galat, gagal |
| Info penting | Biru | `--color-info` (#60a5fa) | Info, tautan bantuan, penjelasan |

Aturan keras (K-11 mengikat):
- Ambang skor kanonis 80/50 (K-31): ≥80 hijau, 50–79 kuning, <50 merah.
  Ambang hidup di `lib/skor.ts`, BUKAN di komponen (K-51).
- Warna SELALU dipasangkan dengan label teks — jangan pernah hanya warna
  (aksesibilitas: buta warna).
- Varian solid (`-solid`) HANYA dengan teks putih di atasnya. Teks putih di
  merah 500 / hijau 600 DILARANG.
- Teks Zinc 500/600 DILARANG. Tap target minimal 48×48 px.
- Helper pemetaan warna → SATU file baru `lib/status-warna.ts`
  (fungsi murni: skor → status, verdict → status, status → token).
  Semua komponen/halaman memakai helper ini — tidak ada pemetaan tersebar.

## 5. Hierarki & layout

- Angka ukur lebih besar dan lebih dulu dibaca: skor, kecepatan, persentase
  memakai skala display yang jelas beda dari teks tubuh.
- Desktop (1280px): manfaatkan lebar — dasbor grid 2 kolom (ring skor +
  ringkasan dokter berdampingan), halaman dokter dengan strip ringkasan di
  atas + detail di bawah, beranda dengan hero + grid panduan 2 kolom.
  HP 360px: satu kolom, nol overflow horizontal (BUG-01 tidak boleh kembali).
- Ritme antar-bagian bervariasi (RHYTHM 4): jangan tumpuk 7 kartu identik
  berurutan — selingi strip ringkasan, meter, daftar ringkas, dan kartu.
- Satu `<main>` milik AppLayout (K-35). Fokus rute + judul per halaman tetap.

## 6. Gerak bermakna (MOTION 2)

- Yang bergerak: cincin skor menyapu saat nilai tampil, meter mengisi saat
  hasil tes masuk, progres tes hidup, transisi keadaan (memuat → hasil).
- Yang TIDAK bergerak: dekorasi, latar, teks berjalan, animasi mainan.
- Durasi dari token (`--duration-fast/medium`, `--ease-out`).
  `prefers-reduced-motion` sudah ditangani tokens.css — jangan dilanggar.

## 7. Logo brand resmi

- Tombol "Masuk dengan Google" WAJIB menampilkan logo Google "G" multicolor
  RESMI (asset SVG resmi Google, sesuai panduan brand Google Sign-In).
  Simpan sebagai asset LOKAL di repo (`public/brand/google-g.svg`).
  JANGAN hotlink. JANGAN gambar tiruan/garisan tangan.
- Tautan aplikasi Android BOLEH memakai logo Android resmi bila cocok
  (asset lokal juga, dari brand resources resmi Android).
- Logo brand lain HANYA bila ada fitur terkait — jangan tempel logo
  asal-asalan. Tidak ada logo baru = tidak ada masalah; yang wajib hanya G.
- Perilaku tombol Google TIDAK BERUBAH: 4-keadaan K-92 (memuat / tersedia /
  belumDisiapkan / galat + retry) + tes 6/6 tetap lolos. Logo tampil di semua
  keadaan yang menampilkan tombol (di keadaan nonaktif, logo tetap tampil
  tapi tombol tidak bisa diklik).

## 8. Arah per halaman (19 halaman — rute & fungsi TETAP)

1. **Beranda (/)** — Persuade. Hero dengan meter hidup (contoh visual skor
   dari data REAL pengguna bila sudah masuk; bila belum masuk, hero tetap
   menunjukkan apa yang diukur tanpa angka karangan). CTA tes WiFi menonjol.
   Grid panduan 2 kolom di desktop. Strip "Yang bisa dilakukan" diringkas
   menjadi 3 poin dengan ikon status, bukan 3 kartu paragraf.
2. **Dashboard (/dashboard)** — Operate. Ring skor BERWARNA sesuai ambang
   80/50 (besar, di kiri desktop). Kartu dokter dengan indikator status
   berwarna (titik + label) per dokter. Riwayat skor mini. Empty state jujur
   tetap ada, tapi dirancang (bukan halaman kosong).
3. **WiFi (/wifi)** — Operate. Verdict tes dengan warna besar (bertahan hijau /
   tidak stabil kuning / jatuh merah). Grafik bertahan berwarna per zona.
   Strip info jaringan ringkas. 6 saran tetap.
4. **Baterai / Penyimpanan / Performa / Keamanan** — Operate. Pola sama:
   strip status berwarna di atas (nilai + label status), meter/bar berwarna,
   form + riwayat di bawah. StorageBar berwarna (penuh → merah).
5. **Riwayat (/riwayat)** — Operate. Daftar dengan cip skor berwarna per
   entri. Filter tetap. Empty state jujur dirancang.
6. **AI (/ai)** — Operate. Label sumber jawaban jelas (AI vs aturan).
   Riwayat diagnosis dengan cip status.
7. **Masuk (/masuk)** — Operate. Tombol Google dengan logo G resmi + 4
   keadaan K-92 dipertahankan. Tombol email tetap.
8. **Kunci PIN (/kunci) + Atur PIN (/pengaturan/pin)** — Operate. Input PIN
   dengan umpan balik status berwarna (salah = merah, benar = hijau).
   Perilaku K-70/K-81 TIDAK BERUBAH. `min-w-0` fieldset (BUG-01) WAJIB ada.
9. **Pengaturan (/pengaturan)** — Operate. Bagian dikelompokkan jelas,
   tombol nonaktif gaya eksplisit (K-53, bukan opacity-50).
10. **Tentang / Privasi / Syarat / Panduan / NotFound** — Read. Tipografi
    bacaan lebih hidup (hierarki judul, daftar rapi), tanpa mengubah isi
    fakta. Spanduk "draf" di /privasi ditinjau di Wave 1 (hapus bila isi
    sudah benar — dicatat sebagai keputusan).
11. **Layout (Header, BottomNav, AppLayout)** — navigasi dengan keadaan
    aktif yang jelas; logo Dokter HP dipertahankan (bukan logo baru).

## 9. Komponen bersama (arah)

- `ScoreRing`: cincin BERWARNA sesuai ambang (via helper status-warna),
  animasi sapuan saat tampil, angka besar di tengah. Tetap presentasional
  (K-51) — ambang dari `lib/skor.ts`.
- `StatusBadge`: varian hijau/kuning/merah/biru dengan bg + border token,
  selalu berlabel teks.
- `MeterStrip`: strip meter dengan zona warna (bukan abu saja).
- `Button`: hierarki jelas (primer putih, sekunder garis, bahaya merah
  solid + teks putih); nonaktif gaya eksplisit (K-53).
- `Card`: permukaan + batas sesuai token; kartu status memakai aksen
  warna tipis yang bermakna (bukan garis warna di semua kartu).
- `Skeleton`: meniru tata letak akhir (sudah benar — pertahankan polanya).
- `EmptyState`: jujur + dirancang (ikon status netral, teks jelas, CTA).
- Charts (`SustainedChart`, `StorageBar`, `ScoreHistoryChart`): warna
  status pada garis/bar/zona sesuai arti datanya.

## 10. Copy (Bahasa Indonesia netral profesional)

- Copy boleh diringkas/diperjelas mengikuti 4 skill writing (humanizer,
  stop-slop, no-ai-slop, avoid-ai-writing) — TAPI fakta, angka, dan arti
  TIDAK BOLEH berubah. Tidak ada klaim baru, tidak ada angka karangan.
- Larangan: copy robotik, jargon teknis, eyebrow uppercase berlebihan,
  emoji sebagai ikon UI, kata-kata AI-slop (lihat checklist skill).

## 11. YANG TIDAK BERUBAH (larangan keras)

- Rute, endpoint API, perilaku, dan backend (Workers/D1/KV) — JANGAN disentuh.
- 4-keadaan tombol Google (K-92) + endpoint status (K-89).
- Blok JSON-LD di `index.html` — JANGAN UBAH ISINYA (hash CSP K-82
  mengikat; mengubah isi = merusak CSP). Bila terpaksa menyentuh index.html,
  hitung ulang hash SHA-256 dan perbarui Worker + `_headers`.
- CSP `_headers` + `connect-src` sempit (K-78). TIDAK ADA host eksternal
  baru (font, gambar, skrip) — semua asset lokal.
- `wrangler.toml`, secret Worker, konfigurasi OAuth Google.
- i18n: string UI tetap Bahasa Indonesia (K-62 — migrasi penuh ditunda v1.1).
- `package.json` — edit bedah saja, baris wrangler dilindungi (K-57).

## 12. Bukti wajib per tim (proof standard)

- `vitest` web hijau penuh (perbarui tes yang menegaskan UI lama — JANGAN
  hapus/longgarkan asersi perilaku; tes baru untuk warna status + logo).
- `typecheck` + `build` exit 0.
- Screenshot desktop 1280 + HP 360 untuk setiap halaman/komponen yang diubah
  (sebelum/sesudah bila memungkinkan).
- Nol overflow horizontal di 360px dan 1280px.
- Kontras warna baru lolos WCAG AA (cek dengan alat ukur, bukan kira-kira).
- Pindai secret 0 temuan sebelum push (skill check_secrets_before_push).

## 13. Urutan gelombang

- Wave 1 (fondasi): token v2 + helper status-warna + asset brand + MasukPage
  (logo) + komponen inti (Button/Card/StatusBadge/EmptyState/Skeleton/
  MeterStrip) + charts berwarna + tinjau /privasi. Fondasi HARUS selesai
  dulu — Wave 2 memakai hasilnya.
- Wave 2 (halaman): Landing + Dashboard + WiFi + 4 dokter + Riwayat + AI +
  PIN + Pengaturan + info (Tentang/Privasi/Syarat/Panduan/NotFound) + layout.
- Wave 3 (poles bukti): audit copy 4 skill + audit a11y/kontras + tes
  (vitest + E2E Playwright re-run) + screenshot sebelum/sesudah + DESIGN_AUDIT
  diperbarui (checklist 7 skill).
- Wave 4 (keamanan + rilis): Red→Blue→Red ringan (asset/link baru) + secret
  scan + push ke main + CI hijau + deploy Pages + Vercel + verifikasi live
  pintu depan (bundle baru kedua mirror + tombol Google berlogo + warna
  status terlihat).
