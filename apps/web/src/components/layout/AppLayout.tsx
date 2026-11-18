import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import Header from "./Header";

// Tata letak shell aplikasi (Tim Layout, redesign v2.0): tautan
// "Lewati ke konten utama" (a11y.md §5.2), header, <main
// id="konten-utama">, footer, navigasi bawah HP, dan banner
// pembaruan PWA (docs/pwa.md §9). Halaman dimuat malas di dalam
// <Suspense> di sini, jadi header dan navigasi tetap tampil saat
// chunk halaman sedang diunduh.
// Fokus keyboard memakai aturan global :focus-visible di
// styles/tokens.css (satu sumber kebenaran, seperti ui/Button),
// bukan kelas fokus lokal yang menduplikasi aturan itu.
//
// PERBAIKAN FOKUS JUDUL (temuan Wave 1): di screenshot, judul
// halaman (h1 "Masuk", "Dashboard", "Dokter HP") terbungkus kotak
// garis luar putih tebal selebar wadahnya. Itu BUKAN bug perilaku:
// manajemen fokus pindah-rute memang benar (a11y.md §5.4). App.tsx
// memindahkan fokus ke <main>, lalu tiap halaman memindahkan fokus
// ke h1-nya agar pembaca layar mengumumkan halaman baru. Yang salah
// hanya tampilannya: aturan global :focus-visible menggambar cincin
// 2 px di sekeliling target non-interaktif yang tidak pernah bisa
// menerima fokus keyboard. Perilaku fokusnya DIPERTAHANKAN. Hanya
// garis luarnya yang disembunyikan untuk target-target itu:
//  - <main> sendiri (focus:outline-none),
//  - h1/h2 di dalam <main> (varian turunan Tailwind di bawah).
// Aman untuk navigasi keyboard: h1/h2 itu memakai tabindex="-1"
// (di luar urutan Tab), jadi tidak ada pengguna keyboard yang
// kehilangan penanda fokus; elemen interaktif (tombol, tautan,
// input) tidak kena aturan ini dan cincin putihnya tetap tampil.
// Mekanisme ini kelas Tailwind (terkompilasi ke stylesheet, aman
// CSP style-src 'self' yang melarang <style> inline). Jangka
// panjang, aturan ini lebih pantas tinggal di tokens.css di samping
// aturan :focus-visible global; dicatat untuk koordinator.

/** Kerangka muat halaman: bentuk meniru tata letak akhir + teks penjelas,
 *  bukan teks "Loading..." saja (docs/performance.md §3.1). */
export function SkeletonHalaman() {
  return (
    <div role="status" aria-label="Memuat halaman" className="py-6">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-[var(--color-surface-hover)]" />
      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
        Memuat halaman…
      </p>
      <div className="mt-6 space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--color-surface-hover)]" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--color-surface-hover)]" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--color-surface-hover)]" />
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
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
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
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 focus:outline-none sm:py-8 [&_h1:focus]:outline-none [&_h2:focus]:outline-none"
      >
        <Suspense fallback={<SkeletonHalaman />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 text-sm text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="flex items-center gap-2 font-semibold text-white">
              <img
                src="/logo.svg"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
              />
              Dokter HP
            </p>
            <p className="mt-2 leading-relaxed">
              Periksa WiFi, baterai, dan kesehatan HP dari browser.
            </p>
          </div>
          <nav aria-label="Tautan informasi">
            <ul className="flex flex-wrap items-center gap-1">
              {TAUTAN_FOOTER.map((tautan) => (
                <li key={tautan.ke}>
                  <Link
                    to={tautan.ke}
                    className="flex min-h-[48px] items-center rounded-lg px-3 underline underline-offset-4"
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
                  className="flex min-h-[48px] items-center rounded-lg px-3 underline underline-offset-4"
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
          <div
            aria-hidden="true"
            className="h-[calc(68px_+_env(safe-area-inset-bottom))] shrink-0 sm:hidden"
          />
          <BottomNav />
        </>
      )}
      {pembaruanTersedia && !bannerDitutup && (
        // Jarak bawah HP = tinggi nav bawah (68 px) + celah 16 px +
        // safe-area, agar spanduk tidak pernah menutupi navigasi bawah
        // (di mode PWA, nav setinggi 68 px + safe-area).
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(84px_+_env(safe-area-inset-bottom))] z-20 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80"
        >
          <p className="text-sm font-semibold text-white">
            Versi baru tersedia
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Perbarui aplikasi untuk memakai versi terbaru.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={perbaruiAplikasi}
              className="min-h-[48px] rounded-lg bg-white px-4 text-sm font-semibold text-black transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-zinc-200 active:scale-[0.98]"
            >
              Perbarui
            </button>
            <button
              type="button"
              onClick={() => setBannerDitutup(true)}
              className="min-h-[48px] rounded-lg border border-[var(--color-border-strong)] px-4 text-sm text-[var(--color-text-primary)] transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-white/5 active:scale-[0.98]"
            >
              Nanti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
