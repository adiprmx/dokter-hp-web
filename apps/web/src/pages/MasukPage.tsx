import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ambilStatusAuth, buatUrlMasukGoogle, pesanGalatMasuk } from "../lib/pin";

// Layar masuk (/masuk): tombol Masuk dengan Google, catatan privasi,
// tautan tes WiFi tanpa akun, dan status galat bila callback gagal
// (dibaca dari query ?error= — lihat docs/api-contracts.md 1.2).
// Sesi memakai cookie HttpOnly dari server; tidak ada token di browser.
// Teks mengikuti docs/copy.md bagian 2 dan 13.
//
// K-89/K-92: saat dimuat, halaman memeriksa GET /api/auth/status dan
// tombol menampilkan satu dari empat keadaan jujur:
// - "memuat": tombol nonaktif netral "Memeriksa login Google…" —
//   tanpa klaim apa pun selagi status belum diketahui.
// - "tersedia": tombol aktif normal.
// - "belumDisiapkan": tombol nonaktif "Masuk dengan Google belum
//   disiapkan" + penjelasan.
// - "galat" (pemanggilan status gagal): tombol nonaktif "Tidak dapat
//   memeriksa login Google" + tombol "Coba lagi" yang memanggil
//   ulang /api/auth/status.
// Tidak ada keadaan yang menampilkan tombol aktif saat status login
// Google belum diketahui (fail-closed); jaring pengaman backend di
// /api/auth/google tetap menangani bila OAuth memang belum siap.

/** Keadaan tombol Masuk dengan Google (K-92: 4-keadaan, fail-closed). */
type KeadaanGoogle = "memuat" | "tersedia" | "belumDisiapkan" | "galat";

export default function MasukPage() {
  const [params] = useSearchParams();
  const [memproses, setMemproses] = useState(false);
  const [keadaan, setKeadaan] = useState<KeadaanGoogle>("memuat");
  // Naik tiap "Coba lagi" ditekan agar efek di bawah memanggil ulang status.
  const [percobaan, setPercobaan] = useState(0);
  const galat = pesanGalatMasuk(params.get("error"));

  useEffect(() => {
    document.title = "Masuk — Dokter HP";
    document.getElementById("judul-masuk")?.focus();
  }, []);

  useEffect(() => {
    let batal = false;
    setKeadaan("memuat");
    ambilStatusAuth()
      .then((status) => {
        if (!batal) {
          setKeadaan(status.google_tersedia ? "tersedia" : "belumDisiapkan");
        }
      })
      .catch(() => {
        // API tidak terjangkau: keadaan jujur "galat", bukan tombol aktif.
        if (!batal) setKeadaan("galat");
      });
    return () => {
      batal = true;
    };
  }, [percobaan]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
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

      {keadaan === "belumDisiapkan" ? (
        <>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-8 flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-zinc-800 px-4 py-3 text-base font-semibold text-zinc-400"
          >
            Masuk dengan Google belum disiapkan
          </button>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Login Google belum disiapkan untuk situs ini. Coba lagi nanti.
          </p>
        </>
      ) : keadaan === "galat" ? (
        <>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-8 flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-zinc-800 px-4 py-3 text-base font-semibold text-zinc-400"
          >
            Tidak dapat memeriksa login Google
          </button>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Status login Google tidak dapat diperiksa saat ini. Periksa
            koneksi Anda, lalu coba lagi.
          </p>
          <button
            type="button"
            onClick={() => setPercobaan((n) => n + 1)}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base font-semibold text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Coba lagi
          </button>
        </>
      ) : keadaan === "memuat" ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="mt-8 flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-zinc-800 px-4 py-3 text-base font-semibold text-zinc-400"
        >
          Memeriksa login Google…
        </button>
      ) : (
        <>
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
        </>
      )}

      <p className="mt-8 text-center">
        <Link
          to="/wifi"
          className="inline-flex min-h-[48px] items-center text-sm text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Atau coba tes WiFi tanpa masuk dulu
        </Link>
      </p>

      <div aria-live="polite" role="status" className="sr-only">
        {memproses
          ? "Memproses masuk…"
          : keadaan === "memuat"
            ? "Memeriksa login Google…"
            : ""}
      </div>
    </div>
  );
}
