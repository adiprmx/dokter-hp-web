# Pedoman Brand — Dokter HP Web App

> Status: Fase 1, 17 November 2026.
> Identitas web mengikuti APK Dokter HP v1.1.0 dan konsep desain
> "Alat ukur" (PRODUCT.md bagian 3). Bahasa: Bahasa Indonesia.

## 1. Logo

File utama: `apps/web/public/logo.svg` (SVG murni, latar transparan).

**Konsep — "Dial dokter":** logo menggabungkan identitas APK dengan
motif alat ukur.

- **Cincin** — lingkaran putih, diambil dari ikon launcher APK
  (`android/app/src/main/res/drawable/ic_launcher_foreground.xml`).
- **Tanda plus** — di tengah cincin, identitas "dokter" dari APK
  yang sama. Garis tebal dengan ujung membulat agar tetap terbaca
  di ukuran kecil.
- **Strip meter** — 12 tick di sekeliling cincin, seperti skala
  pada alat ukur (dial/pengukur). Empat tick utama di arah atas,
  kanan, bawah, dan kiri lebih panjang dan lebih tebal; delapan
  tick kecil di antaranya. Motif ini adalah pembeda web: Dokter HP
  mengukur, bukan menebak.

Logo hanya memakai hitam dan putih. Tidak ada warna dekoratif,
tidak ada gradasi, tidak ada bayangan.

## 2. Favicon

File: `apps/web/public/favicon.svg` (SVG murni).

Versi ringkas untuk ukuran kecil: cincin + tanda plus di atas
kotak hitam bersudut membulat (`rx="14"`), tanpa strip meter.
Latar hitam sengaja dibuat agar logo tetap terbaca di tab browser
yang terang. Strip meter dihilangkan di favicon karena pada
16 px tick akan menyatu dan mengotori bentuk utama.

Pemakaian di HTML:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

## 3. Varian terang dan gelap

| Varian | Latar | Logo | File |
|---|---|---|---|
| Gelap (utama) | Hitam `#000000` atau permukaan `#111111` | Putih, apa adanya | `logo.svg` |
| Terang | Putih `#FFFFFF` atau abu terang | Hitam — balik warna garis dari `#FFFFFF` menjadi `#000000` | Turunan dari `logo.svg`, bukan file terpisah |

Catatan:

- Varian gelap adalah varian utama karena produk memakai tema
  gelap satu-satunya (mengikuti APK v1.1.0, tanpa toggle tema).
- Varian terang hanya untuk konteks yang memaksa latar terang
  (misalnya dokumen cetak atau laporan PDF dengan latar putih).
  Cara membuat: salin `logo.svg`, ganti seluruh `#FFFFFF` menjadi
  `#000000`. Jangan membuat file varian baru di repo tanpa
  keperluan nyata — satu sumber kebenaran adalah `logo.svg`.
- `favicon.svg` tidak punya varian terang: latar hitamnya adalah
  bagian dari desain dan dipakai apa adanya di semua tema browser.

## 4. Jarak aman

Jarak aman minimum di semua sisi logo adalah **tinggi satu tick
utama** (10 unit dalam viewBox 120, sekitar 8% dari lebar logo).
Tidak ada teks, ikon, garis, atau tepi layar di dalam jarak aman.

Untuk favicon, jarak aman sudah termasuk di dalam kotak hitam —
jangan memotong atau menumpuk elemen di atas kotak.

## 5. Ukuran minimum

| Aset | Ukuran minimum | Keterangan |
|---|---|---|
| `logo.svg` (lengkap, dengan strip meter) | 24 px | Di bawah 24 px, pakai `favicon.svg` |
| `favicon.svg` (ringkas) | 16 px | Teruji terbaca di 16 px |
| `logo.svg` di header/landing | 32 px | Ukuran yang dianjurkan untuk tampilan |
| `logo.svg` di layar pembuka | 96–192 px | Teruji tajam sampai 192 px |

Logo adalah SVG vektor: tidak ada ukuran maksimum. Selalu
tampilkan dengan lebar dan tinggi yang sama (rasio 1:1).

## 6. Yang dilarang

- Mengubah warna garis menjadi warna apa pun selain putih (di latar
  gelap) atau hitam (di latar terang). Tanpa kuning/amber, tanpa
  warna status sebagai dekorasi.
- Menambah gradasi, bayangan, garis tepi, atau efek lain.
- Memutar, memiringkan, memantulkan, atau mengubah rasio logo.
- Menghapus atau menambah tick pada strip meter.
- Menempatkan logo putih di atas latar terang (atau logo hitam di
  atas latar gelap) sehingga kontras hilang.
- Menumpuk teks atau elemen lain di atas logo.
- Memakai `logo.svg` lengkap di bawah 24 px — pakai `favicon.svg`.
- Menggabungkan logo dengan logo brand pihak ketiga dalam satu
  kesatuan visual.

## 7. Palet warna

Palet web sama dengan palet APK (`lib/core/theme.dart`) agar kedua
produk terlihat satu keluarga.

### Permukaan dan teks

| Nama | Hex | Pakai untuk |
|---|---|---|
| Latar | `#000000` | Latar utama aplikasi |
| Permukaan | `#111111` | Kartu, latar ikon launcher APK |
| Permukaan terangkat | `#1C1C1C` | Modal, dropdown |
| Garis | `#262626` | Pemisah halus antar elemen |
| Garis tegas | `#3D3D3D` | Pemisah yang perlu terlihat |
| Trek | `#2A2A2A` | Trek bilah/meter yang belum terisi |
| Teks utama | `#FFFFFF` | Judul dan isi utama |
| Teks sekunder | `#A3A3A3` | Penjelasan dan teks pendukung |
| Teks redup | `#757575` | Abu paling gelap yang boleh dipakai untuk teks (kontras 4,56:1 di atas hitam, lolos WCAG AA) |
| Aksen | `#FFFFFF` | Tombol utama, penanda meter, elemen fokus |

### Warna status (fungsi saja, bukan dekorasi)

| Nama | Hex | Pakai untuk |
|---|---|---|
| Sukses | `#4ADE80` | Valid, sukses, selesai |
| Galat | `#F87171` | Galat, gagal |
| Peringatan | `#FACC15` | Pending, perlu perhatian |
| Info | `#60A5FA` | Informasi penting |

Warna status hanya dipakai untuk menyampaikan status. Logo,
tombol utama, dan elemen dekoratif tidak memakai warna status.

## 8. Tipografi

- **Font: font sistem.** Mengikuti APK: tanpa unduhan font agar
  aplikasi tetap jalan saat koneksi lemot. Tumpukan font yang
  dianjurkan di web:
  `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
  Arial, sans-serif`.
- **Tanpa font serif Didone/Playfair** — dilarang permanen.
- **Angka tabular** (`font-variant-numeric: tabular-nums`) untuk
  semua angka yang berubah saat live (skor, kecepatan, latensi,
  persen) agar lebarnya tidak bergeser.
- **Skala teks** mengikuti APK: angka besar 56 px tebal,
  judul layar 28 px tebal, judul biasa 20 px tebal, judul bagian
  17 px semitebal. Judul memakai huruf tebal (700), bukan huruf
  besar semua.
- **Bahasa tampilan:** Bahasa Indonesia sehari-hari yang mudah
  dicerna, tanpa istilah teknis yang tidak perlu.

## 9. Nama produk

- Nama produk: **Dokter HP**. Ditulis dengan huruf D dan H besar,
  tanpa singkatan, tanpa tambahan kata.
- Di judul tab browser dan header: "Dokter HP".
- Jangan menulis "DokterHP" (tanpa spasi) atau "dokter hp"
  (huruf kecil semua) di tampilan pengguna.

## 10. Verifikasi

Logo dan favicon diverifikasi pada 17 November 2026:

- Kedua file lolos parser XML (tag tertutup, struktur valid).
- Kedua file dirender ke PNG dengan cairosvg pada ukuran 16, 32,
  48, dan 192 px, lalu diperiksa secara visual:
  - `logo.svg`: cincin, tanda plus, dan 12 tick tajam di 192 px;
    tetap jelas di 48 dan 32 px; di 16 px bentuk utama (cincin +
    plus) masih terbaca meski tick mulai menyatu — karena itu
    ukuran minimum `logo.svg` ditetapkan 24 px.
  - `favicon.svg`: cincin + tanda plus jelas terbaca di 16 px,
    32 px, dan 48 px.
- Uji render dilakukan di luar browser (render SVG ke PNG),
  bukan tangkapan layar browser — tampilan di tab browser
  sesungguhnya perlu dicek sekali lagi saat aplikasi sudah live.
