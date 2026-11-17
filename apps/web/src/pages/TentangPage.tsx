import { useEffect } from "react";
import { Link } from "react-router-dom";
import { VERSI_APLIKASI_WEB } from "../lib/akun";

// Halaman Tentang (/tentang). Publik — bisa dibuka tanpa masuk.
// Isi mengikuti PRODUCT.md dan copy.md §12 (bagian Tentang).

const REPO_WEB = "https://github.com/adiprmx/dokter-hp-web";
const REPO_APK = "https://github.com/adiprmx/dokter-hp";

export default function TentangPage() {
  useEffect(() => {
    document.title = "Tentang — Dokter HP";
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="inline-flex min-h-[48px] items-center text-sm text-zinc-300 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Kembali ke beranda
        </Link>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Tentang Dokter HP
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          Dokter HP adalah aplikasi web yang membantu memeriksa kondisi HP —
          WiFi, baterai, penyimpanan, performa, dan keamanan — langsung dari
          browser, tanpa memasang aplikasi. Aplikasi ini mengukur,
          menjelaskan, dan menunjukkan langkah perbaikan yang bisa dilakukan
          sendiri.
        </p>

        <section aria-labelledby="judul-fitur" className="mt-8">
          <h2 id="judul-fitur" className="text-lg font-semibold">
            Yang bisa dilakukan di sini
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Mengukur kecepatan WiFi yang sebenarnya dan mencari penyebab
              bila lemot.
            </li>
            <li>
              Menampilkan skor kesehatan HP 0 sampai 100 dari data yang
              tersedia.
            </li>
            <li>
              Menyimpan riwayat pemeriksaan di akun, bisa dibuka dari
              perangkat mana pun setelah masuk.
            </li>
            <li>
              Menjawab pertanyaan soal masalah HP lewat Diagnosis AI — sebagai
              saran, bukan vonis pasti.
            </li>
          </ul>
        </section>

        <section aria-labelledby="judul-batasan" className="mt-8">
          <h2 id="judul-batasan" className="text-lg font-semibold">
            Batasan versi web
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Versi web mengukur koneksi dari browser. Data baterai,
            penyimpanan, dan performa diisi manual atau dari riwayat aplikasi
            Dokter HP. Browser tidak bisa membaca sensor HP secara langsung —
            nama WiFi, kekuatan sinyal, level baterai, dan daftar aplikasi
            tidak bisa dibaca dari browser.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Dokter HP tidak menjanjikan HP jadi lebih cepat. Aplikasi ini
            membantu menemukan masalah dan menunjukkan langkah perbaikannya.
          </p>
        </section>

        <section aria-labelledby="judul-versi" className="mt-8">
          <h2 id="judul-versi" className="text-lg font-semibold">
            Versi
          </h2>
          <p className="mt-3 text-sm text-zinc-300">
            Versi aplikasi web:{" "}
            <span className="text-zinc-100">{VERSI_APLIKASI_WEB}</span>
          </p>
        </section>

        <section aria-labelledby="judul-tautan" className="mt-8">
          <h2 id="judul-tautan" className="text-lg font-semibold">
            Kode sumber dan aplikasi Android
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              <a
                href={REPO_WEB}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] items-center text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Kode sumber Dokter HP Web App (GitHub)
              </a>
            </li>
            <li>
              <a
                href={REPO_APK}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[48px] items-center text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Lihat aplikasi Dokter HP untuk Android
              </a>
            </li>
          </ul>
          <p className="mt-2 text-sm text-zinc-400">
            Aplikasi Android bisa membaca baterai, penyimpanan, dan performa
            langsung dari HP.
          </p>
        </section>

        <section aria-labelledby="judul-privasi" className="mt-8">
          <h2 id="judul-privasi" className="text-lg font-semibold">
            Privasi, singkatnya
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Dokter HP hanya mengumpulkan data yang dibutuhkan agar
            fitur-fiturnya berjalan. Data hanya bisa dilihat oleh pemilik
            akun itu sendiri. Tidak ada iklan, tidak ada pelacakan pihak
            ketiga, dan data tidak dijual. Pengguna bisa melihat, mengekspor,
            dan menghapus seluruh datanya kapan saja.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              <Link
                to="/privasi"
                className="inline-flex min-h-[48px] items-center text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Baca Kebijakan Privasi
              </Link>
            </li>
            <li>
              <Link
                to="/syarat"
                className="inline-flex min-h-[48px] items-center text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Baca Syarat Layanan
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
