# Dokter HP Web

Web app full-stack pendamping APK Flutter **Dokter HP** (repo `adiprmx/dokter-hp`).
Aplikasi ini membantu pengguna memeriksa kesehatan HP, mengukur dan melaporkan
kualitas WiFi, serta mendapatkan diagnosis berbantuan AI — langsung dari browser,
tanpa menginstal aplikasi.

## Stack

| Lapisan | Teknologi |
| --- | --- |
| Frontend | Vite + React 19 + TypeScript + Tailwind CSS 3 + Zustand + React Router 7 |
| Backend | Cloudflare Workers + Hono + TypeScript |
| Database | Cloudflare D1 (SQLite) + KV minimal |
| Hosting utama | Cloudflare Pages (frontend) + Workers (API) |
| Mirror | Vercel |

Keputusan stack selengkapnya: [docs/keputusan-stack.md](docs/keputusan-stack.md).

Catatan: Tailwind CSS dipakai versi 3 (dengan `tailwind.config.js`) karena
konfigurasi berbasis berkas lebih mudah dibaca dan dirawat tim; migrasi ke
Tailwind v4 (konfigurasi berbasis CSS) dapat diputuskan kemudian bila diperlukan.

## Struktur direktori

```
dokter-hp-web/
├── apps/
│   ├── web/                  # Frontend (Vite + React + TypeScript)
│   │   ├── public/           # Aset statis (termasuk speedtest-1mb.bin)
│   │   └── src/
│   │       ├── pages/        # Halaman per rute
│   │       ├── components/   # Komponen UI bersama
│   │       ├── lib/          # Klien API dan utilitas
│   │       └── store/        # State global (Zustand)
│   └── api/                  # Backend (Cloudflare Workers + Hono)
│       ├── migrations/       # Migrasi skema D1
│       └── src/
│           ├── routes/       # Router /api/*
│           └── ai/           # Modul diagnosis AI
├── docs/                     # Dokumen proyek (keputusan, kontrak API, dll.)
└── .github/workflows/        # CI
```

## Menjalankan di lokal

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install          # instal dependensi semua workspace
npm run dev          # frontend di http://localhost:5173
npm run dev:api      # API Worker di http://localhost:8787 (terminal terpisah)
```

Frontend melakukan proxy `/api` ke Worker lokal, jadi kedua layanan cukup
dijalankan berdampingan. Variabel lingkungan frontend (opsional) didokumentasikan
di `apps/web/.env.example`.

Perintah lain:

```bash
npm run build:prod   # build produksi frontend (suntik origin API + typecheck + gate bundle)
npm run build        # build frontend — butuh VITE_API_BASE_URL, gagal bila kosong (guard K-112)
npm run typecheck    # typecheck frontend + API
npm run test         # tes unit frontend + API
npm run preview      # pratinjau hasil build frontend
```

### Database lokal (D1)

```bash
npm run db:migrate:local --workspace=apps/api   # terapkan migrasi ke D1 lokal
```

Skema awal ada di `apps/api/migrations/0001_init.sql`: `profiles`,
`health_checks`, `wifi_reports`, `ai_diagnoses`, `users`, dan `sessions`.
Nama tabel dan kolom diselaraskan dengan rancangan backend APK agar sinkronisasi
data tetap konsisten.

## Deploy

### Cloudflare (utama)

1. Buat database D1 dan namespace KV, lalu isi ID aslinya di
   `apps/api/wrangler.toml` (saat ini masih placeholder):
   ```bash
   wrangler d1 create dokter-hp-db
   wrangler kv namespace create KV
   wrangler d1 migrations apply dokter-hp-db --remote
   ```
2. Deploy API: `npm run deploy --workspace=apps/api`
3. Deploy frontend ke Cloudflare Pages dari direktori `apps/web`
   (build command `npm run build:prod`, output `dist`).

### Vercel (mirror)

Deploy frontend dari direktori `apps/web` (framework preset: Vite).
Variabel `VITE_API_BASE_URL` diisi alamat API Worker produksi bila API tidak
satu domain dengan frontend.

## Anggaran

Proyek ini berjalan dengan **anggaran nol rupiah**: semua layanan yang dipakai
berada di paket gratis (Cloudflare Pages, Workers, D1, KV, dan Vercel).
Jangan menambahkan layanan berbayar tanpa persetujuan pemilik proyek.

## Keamanan

- Jangan pernah commit berkas `.env`, kunci (`.pem`, `.key`), atau kredensial
  apa pun. Gunakan `.env.example` sebagai templat placeholder.
- Hanya hash token/PIN yang disimpan di database — tidak pernah nilai mentahnya.
- Sebelum rilis publik, kunci `ALLOWED_ORIGIN` di Worker ke domain produksi
  (nilai bawaan `*` hanya untuk tahap pengembangan).

## Lisensi

MIT.
