import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { buatUrlMasukGoogle, pesanGalatMasuk } from "../lib/pin";

// Layar masuk (/masuk): tombol Masuk dengan Google, catatan privasi,
// tautan tes WiFi tanpa akun, dan status galat bila callback gagal
// (dibaca dari query ?error= — lihat docs/api-contracts.md 1.2).
// Sesi memakai cookie HttpOnly dari server; tidak ada token di browser.
// Teks mengikuti docs/copy.md bagian 2 dan 13.
export default function MasukPage() {
  const [params] = useSearchParams();
  const [memproses, setMemproses] = useState(false);
  const galat = pesanGalatMasuk(params.get("error"));

  useEffect(() => {
    document.title = "Masuk — Dokter HP";
    document.getElementById("judul-masuk")?.focus();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
      <p className="text-sm font-semibold text-zinc-400">Dokter HP</p>
      <h1
        id="judul-masuk"
        tabIndex={-1}
        className="mt-4 text-2xl font-bold tracking-tight text-white"
      >
        Masuk
      </h1>
      <p className="mt-2 text-base leading-relaxed text-zinc-400">
        Masuk untuk menyimpan riwayat pemeriksaan dan memakai semua fitur.
      </p>

      {galat && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-400/45 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-400"
        >
          {galat}
        </div>
      )}

      <a
        href={buatUrlMasukGoogle(params.get("redirect"))}
        onClick={() => setMemproses(true)}
        className="mt-8 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-base font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        {memproses ? "Memproses masuk…" : "Masuk dengan Google"}
      </a>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        Akun Google dipakai sebagai identitas masuk. Dokter HP tidak membaca
        isi email atau file Anda.
      </p>

      <p className="mt-8 text-center">
        <Link
          to="/wifi"
          className="inline-flex min-h-[48px] items-center text-sm text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Atau coba tes WiFi tanpa masuk dulu
        </Link>
      </p>

      <div aria-live="polite" role="status" className="sr-only">
        {memproses ? "Memproses masuk…" : ""}
      </div>
    </main>
  );
}
