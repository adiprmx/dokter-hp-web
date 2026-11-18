import { Link } from "react-router-dom";
import { PANDUAN } from "../data/panduan";
import { tokenStatus } from "../lib/status-warna";

// Halaman 404 (rute tidak dikenal). Bukan halaman mati: angka galat
// memakai warna status galat lewat helper status-warna (bukan hex
// lokal), lalu pengguna diberi dua jalan keluar yang jelas (beranda
// dan tes WiFi) plus daftar panduan yang tersedia, semuanya dari data
// nyata. Judul dokumen tidak diatur di sini: efek judul App.tsx
// (EfekGantiRute) berjalan sesudah efek halaman dan selalu menang
// untuk rute tak dikenal.

const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

export default function NotFoundPage() {
  return (
    <div className="bg-black text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[65ch] flex-col items-center justify-center pb-16 pt-8 text-center">
        <p
          className="dh-numeric text-[length:var(--text-display-xl)] font-bold leading-[var(--leading-display)]"
          style={{ color: tokenStatus("galat").teks }}
        >
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
          Alamat yang dibuka tidak tersedia. Mungkin alamatnya berubah atau
          salah ketik.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/"
            className={`inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-zinc-200 ${FOKUS}`}
          >
            Kembali ke beranda
          </Link>
          <Link
            to="/wifi"
            className={`inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--color-border-strong)] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-white/5 ${FOKUS}`}
          >
            Tes kecepatan WiFi
          </Link>
        </div>

        <section
          aria-labelledby="panduan-tersedia"
          className="mt-12 w-full text-left"
        >
          <h2
            id="panduan-tersedia"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Panduan yang tersedia
          </h2>
          <ul className="mt-5 space-y-3">
            {PANDUAN.map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/panduan/${item.slug}`}
                  className={`block rounded-xl bg-[var(--color-surface)] px-5 py-4 transition-colors hover:bg-[var(--color-surface-hover)] ${FOKUS}`}
                >
                  <span className="text-base font-semibold text-white underline decoration-[var(--color-border-strong)] underline-offset-4">
                    {item.judul}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {item.deskripsi}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
