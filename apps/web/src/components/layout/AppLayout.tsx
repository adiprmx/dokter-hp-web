import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import Header from "./Header";

// Tata letak shell aplikasi (Tim Shell/Routing): tautan "Lewati ke
// konten utama" (a11y.md §5.2), header, <main id="konten-utama">,
// footer, navigasi bawah HP, dan banner pembaruan PWA (docs/pwa.md
// §9). Halaman dimuat malas di dalam <Suspense> di sini, jadi header
// dan navigasi tetap tampil saat chunk halaman sedang diunduh.

const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

/** Kerangka muat halaman: bentuk meniru tata letak akhir + teks penjelas,
 *  bukan teks "Loading..." saja (docs/performance.md §3.1). */
export function SkeletonHalaman() {
  return (
    <div role="status" aria-label="Memuat halaman" className="py-6">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-zinc-800" />
      <p className="mt-3 text-sm text-zinc-400">Memuat halaman…</p>
      <div className="mt-6 space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-zinc-800" />
        <div className="h-24 animate-pulse rounded-xl bg-zinc-800" />
        <div className="h-24 animate-pulse rounded-xl bg-zinc-800" />
      </div>
    </div>
  );
}

const TAUTAN_FOOTER = [
  { ke: "/tentang", label: "Tentang" },
  { ke: "/privasi", label: "Privasi" },
  { ke: "/syarat", label: "Syarat" },
] as const;

export default function AppLayout() {
  const lokasi = useLocation();
  // Layar masuk dan kunci PIN tampil tanpa navigasi bawah agar fokus
  // pengguna tidak terpecah.
  const tampilkanNavBawah =
    lokasi.pathname !== "/masuk" && lokasi.pathname !== "/kunci";
  const [pembaruanTersedia, setPembaruanTersedia] = useState(false);
  const [bannerDitutup, setBannerDitutup] = useState(false);

  useEffect(() => {
    const tampilkanBanner = () => {
      setPembaruanTersedia(true);
      setBannerDitutup(false);
    };
    window.addEventListener("dokter-hp:update-tersedia", tampilkanBanner);
    return () => {
      window.removeEventListener("dokter-hp:update-tersedia", tampilkanBanner);
    };
  }, []);

  const perbaruiAplikasi = () => {
    // Minta service worker baru mengambil alih; main.tsx memuat ulang
    // halaman sekali setelah controllerchange. Bila pendaftarannya
    // tidak ditemukan, muat ulang saja.
    void navigator.serviceWorker
      .getRegistration()
      .then((pendaftaran) => {
        const menunggu = pendaftaran?.waiting;
        if (menunggu) {
          menunggu.postMessage({ type: "SKIP_WAITING" });
        } else {
          window.location.reload();
        }
      })
      .catch(() => {
        window.location.reload();
      });
  };

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-black"
      >
        Lewati ke konten utama
      </a>
      <Header />
      <main
        id="konten-utama"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8"
      >
        <Suspense fallback={<SkeletonHalaman />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Dokter HP — periksa WiFi, baterai, dan kesehatan HP dari browser.
          </p>
          <nav aria-label="Tautan informasi">
            <ul className="flex flex-wrap items-center gap-1">
              {TAUTAN_FOOTER.map((tautan) => (
                <li key={tautan.ke}>
                  <Link
                    to={tautan.ke}
                    className={`flex min-h-[48px] items-center rounded-lg px-3 underline underline-offset-4 ${FOKUS}`}
                  >
                    {tautan.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/adiprmx/dokter-hp"
                  target="_blank"
                  rel="noreferrer"
                  className={`flex min-h-[48px] items-center rounded-lg px-3 underline underline-offset-4 ${FOKUS}`}
                >
                  Aplikasi Android (membuka tab baru)
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
      {tampilkanNavBawah && (
        <>
          <div aria-hidden="true" className="h-16 shrink-0 sm:hidden" />
          <BottomNav />
        </>
      )}
      {pembaruanTersedia && !bannerDitutup && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-20 rounded-xl border border-zinc-500 bg-zinc-900 p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80"
        >
          <p className="text-sm font-semibold text-white">
            Versi baru tersedia
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Perbarui aplikasi untuk memakai versi terbaru.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={perbaruiAplikasi}
              className={`min-h-[48px] rounded-lg bg-white px-4 text-sm font-semibold text-black ${FOKUS}`}
            >
              Perbarui
            </button>
            <button
              type="button"
              onClick={() => setBannerDitutup(true)}
              className={`min-h-[48px] rounded-lg border border-zinc-500 px-4 text-sm text-zinc-100 ${FOKUS}`}
            >
              Nanti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
