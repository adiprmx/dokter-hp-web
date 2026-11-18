import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BrandLogo from "../components/ui/BrandLogo";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { tokenStatus } from "../lib/status-warna";
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
// Logo "G" resmi tampil di keempat keadaan (spec §7, redesign v2.0);
// di keadaan nonaktif logo tetap tampil tapi tombol tidak bisa diklik.
//
// Redesign v2.0 (Tim Auth, Wave 2): tombol Google 4-keadaan di bawah
// ini TIDAK DIUBAH SAMA SEKALI (markup, teks, kelas, logika). Yang
// dirombak hanya sekelilingnya: label merek "Dokter HP" di atas judul
// dihapus (Header sudah menampilkan merek di setiap halaman, dan
// penanda di atas judul dilarang craft-floor); penjelasan tiap
// keadaan dipindah ke Card (info untuk catatan privasi, galat untuk
// kegagalan periksa status, netral untuk "belum disiapkan" karena
// itu keadaan konfigurasi, bukan galat pengguna); peringatan
// ?error= memakai Card status galat; "Coba lagi" memakai komponen
// Button sekunder (K-53); tautan tes tanpa masuk tampil sebagai aksi
// sekunder berbatas, bukan teks kecil. Warna status HANYA lewat
// helper status-warna + Card status (spec §4).

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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
      <h1
        id="judul-masuk"
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-white"
      >
        Masuk
      </h1>
      <p className="mt-2 text-base leading-relaxed text-zinc-400">
        Masuk untuk menyimpan riwayat pemeriksaan dan memakai semua fitur.
      </p>

      {galat && (
        <Card
          status="galat"
          role="alert"
          className="mt-6"
          style={{ color: tokenStatus("galat").teks }}
        >
          <p className="text-sm leading-relaxed">{galat}</p>
        </Card>
      )}

      {keadaan === "belumDisiapkan" ? (
        <>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-8 flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-base font-semibold text-zinc-400"
          >
            <BrandLogo merek="google" />
            Masuk dengan Google belum disiapkan
          </button>
          <Card className="mt-4">
            <p className="text-sm leading-relaxed text-zinc-400">
              Login Google belum disiapkan untuk situs ini. Coba lagi nanti.
            </p>
          </Card>
        </>
      ) : keadaan === "galat" ? (
        <>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-8 flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-base font-semibold text-zinc-400"
          >
            <BrandLogo merek="google" />
            Tidak dapat memeriksa login Google
          </button>
          <Card
            status="galat"
            className="mt-4"
            style={{ color: tokenStatus("galat").teks }}
          >
            <p className="text-sm leading-relaxed">
              Status login Google tidak dapat diperiksa saat ini. Periksa
              koneksi Anda, lalu coba lagi.
            </p>
          </Card>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPercobaan((n) => n + 1)}
            fullWidth
            className="mt-4"
          >
            Coba lagi
          </Button>
        </>
      ) : keadaan === "memuat" ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="mt-8 flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-base font-semibold text-zinc-400"
        >
          <BrandLogo merek="google" />
          Memeriksa login Google…
        </button>
      ) : (
        <>
          <a
            href={buatUrlMasukGoogle(params.get("redirect"))}
            onClick={() => setMemproses(true)}
            className="mt-8 flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-base font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <BrandLogo merek="google" />
            {memproses ? "Memproses masuk…" : "Masuk dengan Google"}
          </a>
          <Card
            status="info"
            className="mt-4"
            style={{ color: tokenStatus("info").teks }}
          >
            <p className="text-sm leading-relaxed">
              Akun Google dipakai sebagai identitas masuk. Dokter HP tidak
              membaca isi email atau file Anda.
            </p>
          </Card>
        </>
      )}

      <Link
        to="/wifi"
        className="mt-8 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-zinc-500 px-4 py-3 text-base font-semibold text-zinc-100 transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-white/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        Atau coba tes WiFi tanpa masuk dulu
      </Link>

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
