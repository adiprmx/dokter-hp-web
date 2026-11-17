import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PANDUAN } from "../data/panduan";

// Layar 1 — Landing (rute `/`). Semua teks mengikuti docs/copy.md §1.
// Tanpa data dummy: halaman ini tidak menampilkan angka statistik apa pun.
// Warna mengikuti design lock (hitam/abu/putih, aksen putih) dan
// docs/a11y.md §4: teks paling gelap Zinc 400, border tombol sekunder
// Zinc 500, target sentuh minimal 48 px.

// Indikator fokus keyboard (a11y.md §3.2) — dipasang eksplisit di
// setiap elemen interaktif karena tokens.css belum tentu terimpor.
const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

const KEUNGGULAN = [
  {
    judul: "Tes WiFi sungguhan",
    isi: "Kecepatan diukur langsung dari browser, bukan ditebak. Hasilnya angka nyata dari koneksi yang sedang dipakai.",
  },
  {
    judul: "Penjelasan yang mudah dipahami",
    isi: "Setiap hasil disertai arti dan langkah perbaikan yang bisa dilakukan sendiri, dengan bahasa yang mudah dicerna.",
  },
  {
    judul: "Riwayat tersimpan di akun",
    isi: "Hasil pemeriksaan tersimpan dan bisa dibuka lagi dari perangkat mana pun setelah masuk.",
  },
];

const JUDUL_HALAMAN =
  "Dokter HP — Cek WiFi Lemot, Baterai Boros & Kesehatan HP";

export default function LandingPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = JUDUL_HALAMAN;
    judulRef.current?.focus();
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-10 sm:pt-14">
        <header>
          <h1
            ref={judulRef}
            tabIndex={-1}
            className="text-4xl font-bold leading-tight tracking-tight text-white"
          >
            Dokter HP
          </h1>
          <p className="mt-3 text-lg font-medium text-zinc-100">
            Cari tahu kenapa HP terasa bermasalah, lalu perbaiki.
          </p>
          <p className="mt-3 text-base leading-relaxed text-zinc-400">
            Periksa kondisi HP dari browser: kecepatan WiFi, baterai,
            penyimpanan, performa, dan keamanan. Tanpa memasang aplikasi.
          </p>
        </header>

        <section aria-label="Mulai memakai Dokter HP" className="mt-8">
          <Link
            to="/wifi"
            className={`flex min-h-[48px] items-center justify-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-zinc-200 ${FOKUS}`}
          >
            Coba tes WiFi tanpa akun
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Hasil tes tampil di layar, tetapi tidak tersimpan. Masuk untuk
            menyimpan riwayat.
          </p>
          <Link
            to="/masuk"
            className={`mt-4 flex min-h-[48px] items-center justify-center rounded-xl border border-zinc-500 px-5 py-3 text-base font-semibold text-zinc-100 transition-colors hover:bg-zinc-900 ${FOKUS}`}
          >
            Masuk / Daftar
          </Link>
        </section>

        <section aria-labelledby="keunggulan" className="mt-12">
          <h2
            id="keunggulan"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Yang bisa dilakukan di sini
          </h2>
          <ul className="mt-5 space-y-4">
            {KEUNGGULAN.map((item) => (
              <li
                key={item.judul}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4"
              >
                <h3 className="text-base font-semibold text-white">
                  {item.judul}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                  {item.isi}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="batasan"
          className="mt-12 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4"
        >
          <h2
            id="batasan"
            className="text-base font-semibold text-white"
          >
            Yang perlu diketahui
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            Versi web mengukur koneksi Anda; data baterai, penyimpanan, dan
            performa diisi manual atau dari riwayat aplikasi Dokter HP.
          </p>
        </section>

        <section aria-labelledby="panduan" className="mt-12">
          <h2
            id="panduan"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Panduan perbaikan
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Langkah demi langkah memperbaiki masalah HP yang paling sering
            terjadi. Semua panduan bisa dibaca tanpa masuk.
          </p>
          <ul className="mt-5 space-y-3">
            {PANDUAN.map((panduan) => (
              <li key={panduan.slug}>
                <Link
                  to={`/panduan/${panduan.slug}`}
                  className={`block rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 transition-colors hover:bg-zinc-900 ${FOKUS}`}
                >
                  <span className="text-base font-semibold text-white underline decoration-zinc-500 underline-offset-4">
                    {panduan.judul}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                    {panduan.deskripsi}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="apk" className="mt-12">
          <h2
            id="apk"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Butuh pembacaan langsung dari HP?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Aplikasi Dokter HP di Android bisa membaca baterai, penyimpanan,
            dan performa langsung dari HP.
          </p>
          <a
            href="https://github.com/adiprmx/dokter-hp"
            target="_blank"
            rel="noreferrer"
            className={`mt-4 inline-flex min-h-[48px] items-center rounded-xl border border-zinc-500 px-5 py-3 text-base font-semibold text-zinc-100 transition-colors hover:bg-zinc-900 ${FOKUS}`}
          >
            Lihat aplikasi Dokter HP untuk Android (membuka tab baru)
          </a>
        </section>

        <footer className="mt-12 border-t border-zinc-800 pt-6">
          <p className="text-sm leading-relaxed text-zinc-400">
            Dokter HP tidak menjanjikan HP jadi lebih cepat. Aplikasi ini
            membantu menemukan masalah dan menunjukkan langkah perbaikannya.
          </p>
        </footer>
      </div>
    </main>
  );
}
