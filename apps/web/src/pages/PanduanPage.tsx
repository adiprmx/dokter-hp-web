import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { cariPanduan, PANDUAN } from "../data/panduan";

// Halaman panduan (rute `/panduan/:slug`). Isi dari src/data/panduan.ts.
// Langkah perbaikan memakai <ol> sungguhan (docs/seo.md §7).
// Judul halaman dan deskripsi meta diperbarui lewat JavaScript
// (Opsi B seo.md §1.1) sampai keputusan prerender diambil tim frontend.
// JSON-LD FAQPage (seo.md §5.2) TIDAK dipasang di sini: injeksi
// <script> dinamis mati di bawah CSP script-src (N-01, K-82) dan
// tidak dapat di-hash karena isinya bergantung data halaman.
// Structured data FAQ kembali bersama prerender pasca-v1.0 (K-22).

const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

export default function PanduanPage() {
  const { slug } = useParams<{ slug: string }>();
  const panduan = slug ? cariPanduan(slug) : undefined;
  const judulRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = panduan
      ? panduan.judulSeo
      : "Panduan tidak ditemukan | Dokter HP";
    judulRef.current?.focus();

    if (!panduan) return undefined;

    // Deskripsi meta per halaman (dipulihkan saat pindah rute).
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const deskripsiLama = meta?.content;
    if (meta) meta.content = panduan.deskripsi;

    // JSON-LD FAQPage tidak dipasang di sini (lihat komentar atas
    // berkas): injeksi skrip dinamis diblokir CSP dan structured
    // data FAQ kembali bersama prerender pasca-v1.0 (K-22).

    return () => {
      if (meta && deskripsiLama !== undefined) meta.content = deskripsiLama;
    };
  }, [panduan]);

  if (!panduan) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-10 sm:pt-14">
          <h1
            ref={judulRef}
            tabIndex={-1}
            className="text-2xl font-bold leading-tight tracking-tight text-white"
          >
            Panduan tidak ditemukan
          </h1>
          <p className="mt-3 text-base leading-relaxed text-zinc-400">
            Halaman yang dicari tidak ada. Kembali ke beranda.
          </p>
          <Link
            to="/"
            className={`mt-6 inline-flex min-h-[48px] items-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-zinc-200 ${FOKUS}`}
          >
            Kembali ke beranda
          </Link>
          <section aria-labelledby="panduan-tersedia" className="mt-12">
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
                    className={`block rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-base font-semibold text-white underline decoration-zinc-500 underline-offset-4 transition-colors hover:bg-zinc-900 ${FOKUS}`}
                  >
                    {item.judul}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  const panduanLain = PANDUAN.filter((p) => p.slug !== panduan.slug);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-10 sm:pt-14">
        <nav aria-label="Navigasi panduan">
          <Link
            to="/"
            className={`inline-flex min-h-[48px] items-center text-base font-medium text-zinc-100 underline decoration-zinc-500 underline-offset-4 ${FOKUS}`}
          >
            Kembali ke beranda
          </Link>
        </nav>
        <article className="mt-6">
          <h1
            ref={judulRef}
            tabIndex={-1}
            className="text-3xl font-bold leading-tight tracking-tight text-white"
          >
            {panduan.judul}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">
            {panduan.deskripsi}
          </p>
          <ol className="mt-8 list-decimal space-y-5 pl-6 marker:font-semibold marker:text-white">
            {panduan.langkah.map((langkah, index) => (
              <li
                key={index}
                className="text-base leading-relaxed text-zinc-100"
              >
                {langkah}
              </li>
            ))}
          </ol>
        </article>

        <section
          aria-labelledby="langkah-selanjutnya"
          className="mt-12 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4"
        >
          <h2
            id="langkah-selanjutnya"
            className="text-base font-semibold text-white"
          >
            Langkah selanjutnya
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            Setelah mengikuti panduan ini, ukur lagi kondisi HP untuk
            memastikan ada perubahan.
          </p>
          <Link
            to="/wifi"
            className={`mt-4 inline-flex min-h-[48px] items-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-zinc-200 ${FOKUS}`}
          >
            Tes kecepatan WiFi sekarang
          </Link>
        </section>

        <nav aria-labelledby="panduan-lain" className="mt-12">
          <h2
            id="panduan-lain"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Panduan lain
          </h2>
          <ul className="mt-5 space-y-3">
            {panduanLain.map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/panduan/${item.slug}`}
                  className={`block rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 transition-colors hover:bg-zinc-900 ${FOKUS}`}
                >
                  <span className="text-base font-semibold text-white underline decoration-zinc-500 underline-offset-4">
                    {item.judul}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                    {item.deskripsi}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
