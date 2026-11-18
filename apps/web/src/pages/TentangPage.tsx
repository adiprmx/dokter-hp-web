import { useEffect } from "react";
import { Link } from "react-router-dom";
import { VERSI_APLIKASI_WEB } from "../lib/akun";
import { MeterStrip } from "../components/ui/MeterStrip";

// Halaman Tentang (/tentang). Publik, bisa dibuka tanpa masuk.
// Isi mengikuti PRODUCT.md dan copy.md §12 (bagian Tentang).
// Redesign v2.0 (mode Read): kolom baca 65ch, teks tubuh 16px,
// daftar fitur sebagai baris berpemisah (bukan poin-poin rapat),
// strip meter sebagai motif identitas "Alat ukur" di bawah judul.

const REPO_WEB = "https://github.com/adiprmx/dokter-hp-web";
const REPO_APK = "https://github.com/adiprmx/dokter-hp";

const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

const FITUR = [
  "Mengukur kecepatan WiFi yang sebenarnya dan mencari penyebab bila lemot.",
  "Menampilkan skor kesehatan HP 0 sampai 100 dari data yang tersedia.",
  "Menyimpan riwayat pemeriksaan di akun, bisa dibuka dari perangkat mana pun setelah masuk.",
  "Menjawab pertanyaan soal masalah HP lewat Diagnosis AI, sebagai saran, bukan vonis pasti.",
] as const;

export default function TentangPage() {
  useEffect(() => {
    document.title = "Tentang — Dokter HP";
  }, []);

  return (
    <div className="bg-black text-[var(--color-text-primary)]">
      <div className="mx-auto w-full max-w-[65ch] pb-16 pt-4">
        <Link
          to="/"
          className={`inline-flex min-h-[48px] items-center text-base text-[var(--color-text-secondary)] underline underline-offset-4 ${FOKUS}`}
        >
          Kembali ke beranda
        </Link>

        <header className="mt-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Tentang Dokter HP
          </h1>
          <MeterStrip className="mt-5" />
          <p className="mt-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
            Dokter HP adalah aplikasi web yang membantu memeriksa kondisi HP
            (WiFi, baterai, penyimpanan, performa, dan keamanan) langsung dari
            browser, tanpa memasang aplikasi. Aplikasi ini mengukur,
            menjelaskan, dan menunjukkan langkah perbaikan yang bisa dilakukan
            sendiri.
          </p>
        </header>

        <section aria-labelledby="judul-fitur" className="mt-10">
          <h2
            id="judul-fitur"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Yang bisa dilakukan di sini
          </h2>
          <ul className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {FITUR.map((item) => (
              <li
                key={item}
                className="py-4 text-base leading-relaxed text-[var(--color-text-secondary)]"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="judul-batasan" className="mt-10">
          <h2
            id="judul-batasan"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Batasan versi web
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
            Versi web mengukur koneksi dari browser. Data baterai,
            penyimpanan, dan performa diisi manual atau dari riwayat aplikasi
            Dokter HP. Browser tidak bisa membaca sensor HP secara langsung.
            Nama WiFi, kekuatan sinyal, level baterai, dan daftar aplikasi
            tidak bisa dibaca dari browser.
          </p>
          <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
            Dokter HP tidak menjanjikan HP jadi lebih cepat. Aplikasi ini
            membantu menemukan masalah dan menunjukkan langkah perbaikannya.
          </p>
        </section>

        <section aria-labelledby="judul-versi" className="mt-10">
          <h2
            id="judul-versi"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Versi
          </h2>
          <p className="mt-3 text-base text-[var(--color-text-secondary)]">
            Versi aplikasi web:{" "}
            <span className="dh-numeric text-white">
              {VERSI_APLIKASI_WEB}
            </span>
          </p>
        </section>

        <section aria-labelledby="judul-tautan" className="mt-10">
          <h2
            id="judul-tautan"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Kode sumber dan aplikasi Android
          </h2>
          <ul className="mt-3 space-y-1">
            <li>
              <a
                href={REPO_WEB}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-[48px] items-center text-base text-white underline underline-offset-4 ${FOKUS}`}
              >
                Kode sumber Dokter HP Web App (GitHub)
              </a>
            </li>
            <li>
              <a
                href={REPO_APK}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-[48px] items-center text-base text-white underline underline-offset-4 ${FOKUS}`}
              >
                Lihat aplikasi Dokter HP untuk Android
              </a>
            </li>
          </ul>
          <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">
            Aplikasi Android bisa membaca baterai, penyimpanan, dan performa
            langsung dari HP.
          </p>
        </section>

        <section aria-labelledby="judul-privasi" className="mt-10">
          <h2
            id="judul-privasi"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Privasi, singkatnya
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
            Dokter HP hanya mengumpulkan data yang dibutuhkan agar
            fitur-fiturnya berjalan. Data hanya bisa dilihat oleh pemilik
            akun itu sendiri. Tidak ada iklan, tidak ada pelacakan pihak
            ketiga, dan data tidak dijual. Pengguna bisa melihat, mengekspor,
            dan menghapus seluruh datanya kapan saja.
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <Link
                to="/privasi"
                className={`inline-flex min-h-[48px] items-center text-base text-white underline underline-offset-4 ${FOKUS}`}
              >
                Baca Kebijakan Privasi
              </Link>
            </li>
            <li>
              <Link
                to="/syarat"
                className={`inline-flex min-h-[48px] items-center text-base text-white underline underline-offset-4 ${FOKUS}`}
              >
                Baca Syarat Layanan
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
