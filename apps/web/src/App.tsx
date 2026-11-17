import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AppLayout, { SkeletonHalaman } from "./components/layout/AppLayout";
import RequireAuth, {
  ruteButuhMasuk,
} from "./components/layout/RequireAuth";

// Shell + routing aplikasi (Tim Shell/Routing — satu-satunya tim yang
// menyentuh file ini).
//
// - Code-splitting per rute (docs/performance.md §3.1): setiap halaman
//   menjadi chunk terpisah; hanya shell yang ada di chunk awal.
// - Judul per rute + fokus ke <main> saat ganti rute (docs/a11y.md
//   §5.4, kriteria 2.4.1/2.4.2): pengguna pembaca layar tahu halaman
//   sudah berganti.
// - Meta robots dinamis (docs/seo.md §6.2): rute aplikasi yang butuh
//   login memakai noindex, nofollow sebagai lapisan kedua setelah
//   robots.txt.
// - Rute wajib-masuk dibungkus RequireAuth (GET /api/auth/me).

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PanduanPage = lazy(() => import("./pages/PanduanPage"));
const MasukPage = lazy(() => import("./pages/MasukPage"));
const KunciPinPage = lazy(() => import("./pages/KunciPinPage"));
const AturPinPage = lazy(() => import("./pages/AturPinPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const WifiPage = lazy(() => import("./pages/WifiPage"));
const BateraiPage = lazy(() => import("./pages/BateraiPage"));
const PenyimpananPage = lazy(() => import("./pages/PenyimpananPage"));
const PerformaPage = lazy(() => import("./pages/PerformaPage"));
const KeamananPage = lazy(() => import("./pages/KeamananPage"));
const AiPage = lazy(() => import("./pages/AiPage"));
const RiwayatPage = lazy(() => import("./pages/RiwayatPage"));
const PengaturanPage = lazy(() => import("./pages/PengaturanPage"));
const TentangPage = lazy(() => import("./pages/TentangPage"));
const PrivasiPage = lazy(() => import("./pages/PrivasiPage"));
const SyaratPage = lazy(() => import("./pages/SyaratPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Judul per rute. Judul landing, WiFi, dan panduan sama persis dengan
// docs/seo.md §3 (dan dengan judulSeo di src/data/panduan.ts), agar
// efek di bawah ini tidak bertabrakan dengan judul yang dipasang
// PanduanPage sendiri (Opsi B seo.md §1.1).
const JUDUL_RUTE: Readonly<Record<string, string>> = {
  "/": "Dokter HP — Cek WiFi Lemot, Baterai Boros & Kesehatan HP",
  "/wifi": "Cek Kecepatan WiFi — Tes Unduh & Latensi Gratis | Dokter HP",
  "/masuk": "Masuk | Dokter HP",
  "/kunci": "Masukkan PIN | Dokter HP",
  "/pengaturan/pin": "Atur PIN | Dokter HP",
  "/dashboard": "Dashboard | Dokter HP",
  "/baterai": "Dokter Baterai | Dokter HP",
  "/penyimpanan": "Dokter Penyimpanan | Dokter HP",
  "/performa": "Dokter Performa | Dokter HP",
  "/keamanan": "Dokter Keamanan | Dokter HP",
  "/ai": "Diagnosis AI | Dokter HP",
  "/riwayat": "Riwayat | Dokter HP",
  "/pengaturan": "Pengaturan | Dokter HP",
  "/tentang": "Tentang | Dokter HP",
  "/privasi": "Kebijakan Privasi | Dokter HP",
  "/syarat": "Syarat Layanan | Dokter HP",
};

const JUDUL_PANDUAN: Readonly<Record<string, string>> = {
  "wifi-lemot":
    "WiFi Lemot Padahal Sinyal Penuh? Penyebab & Cara Mengatasinya | Dokter HP",
  "ganti-channel-router":
    "Cara Ganti Channel Router ke 1, 6, atau 11 agar WiFi Stabil | Dokter HP",
  "ganti-dns": "Cara Ganti DNS HP ke 1.1.1.1 atau 8.8.8.8 | Dokter HP",
  "baterai-boros":
    "Baterai HP Boros? Penyebab & Cara Menghematnya | Dokter HP",
  "penyimpanan-penuh":
    "Penyimpanan HP Penuh? Cara Mengosongkannya dengan Aman | Dokter HP",
  "hp-lemot":
    "HP Lemot? Penyebab & Cara Mempercepat Performa HP | Dokter HP",
  "keamanan-hp":
    "Cek Keamanan HP: Izin Aplikasi Berbahaya yang Perlu Ditinjau | Dokter HP",
};

/** Judul dokumen untuk sebuah path (fungsi murni, diuji di layout.test.ts). */
export function judulHalaman(path: string): string {
  const jalur = path.split(/[?#]/, 1)[0] ?? "/";
  const judul = JUDUL_RUTE[jalur];
  if (judul) return judul;
  if (jalur.startsWith("/panduan/")) {
    const slug = jalur.slice("/panduan/".length);
    return JUDUL_PANDUAN[slug] ?? "Panduan | Dokter HP";
  }
  return "Dokter HP";
}

/** Buat atau perbarui meta robots di <head>. */
function aturMetaRobots(isi: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", isi);
}

/** Gulir ke atas + perbarui judul + robots + pindahkan fokus ke <main>
 *  setiap kali rute berubah (docs/a11y.md §5.4). */
function EfekGantiRute() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = judulHalaman(pathname);
    aturMetaRobots(
      ruteButuhMasuk(pathname) ? "noindex, nofollow" : "index, follow",
    );
    document.getElementById("konten-utama")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <EfekGantiRute />
      <Suspense
        fallback={
          <div className="min-h-screen bg-black px-4 py-6">
            <div className="mx-auto w-full max-w-5xl">
              <SkeletonHalaman />
            </div>
          </div>
        }
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/panduan/:slug" element={<PanduanPage />} />
            <Route path="/wifi" element={<WifiPage />} />
            <Route path="/masuk" element={<MasukPage />} />
            <Route
              path="/kunci"
              element={
                <RequireAuth mode="kunci">
                  <KunciPinPage />
                </RequireAuth>
              }
            />
            <Route path="/tentang" element={<TentangPage />} />
            <Route path="/privasi" element={<PrivasiPage />} />
            <Route path="/syarat" element={<SyaratPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/baterai"
              element={
                <RequireAuth>
                  <BateraiPage />
                </RequireAuth>
              }
            />
            <Route
              path="/penyimpanan"
              element={
                <RequireAuth>
                  <PenyimpananPage />
                </RequireAuth>
              }
            />
            <Route
              path="/performa"
              element={
                <RequireAuth>
                  <PerformaPage />
                </RequireAuth>
              }
            />
            <Route
              path="/keamanan"
              element={
                <RequireAuth>
                  <KeamananPage />
                </RequireAuth>
              }
            />
            <Route
              path="/ai"
              element={
                <RequireAuth>
                  <AiPage />
                </RequireAuth>
              }
            />
            <Route
              path="/riwayat"
              element={
                <RequireAuth>
                  <RiwayatPage />
                </RequireAuth>
              }
            />
            <Route
              path="/pengaturan"
              element={
                <RequireAuth>
                  <PengaturanPage />
                </RequireAuth>
              }
            />
            <Route
              path="/pengaturan/pin"
              element={
                <RequireAuth>
                  <AturPinPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
