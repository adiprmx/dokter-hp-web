import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ApiError, fetchJson } from "../../lib/api";

// Gerbang rute yang wajib masuk (Tim Shell/Routing).
//
// Memeriksa GET /api/auth/me (docs/api-contracts.md §1.4, awalan /api
// per K-07): sesi cookie HttpOnly diverifikasi server; respons 200
// membawa `data.sesi_terkunci` (true bila PIN sudah diatur dan sesi
// belum dibuka dengan PIN). Endpoint ini boleh dipanggil saat sesi
// terkunci (K-05), jadi satu panggilan ini cukup untuk tiga keadaan:
// tidak masuk (401), terkunci, dan terbuka.
//
// Dua mode:
// - "terbuka" (bawaan): rute aplikasi biasa — 401 ke /masuk, sesi
//   terkunci ke /kunci.
// - "kunci": layar kunci PIN itu sendiri — 401 ke /masuk, sesi yang
//   sudah terbuka ke /dashboard (tidak ada yang perlu dibuka),
//   sesi terkunci menampilkan layar PIN. Tanpa mode ini, /kunci yang
//   dibungkus gerbang biasa akan mengarahkan ke dirinya sendiri.

/** Rute yang bisa dibuka tanpa masuk. */
export const RUTE_PUBLIK: readonly string[] = [
  "/",
  "/wifi",
  "/masuk",
  "/tentang",
  "/privasi",
  "/syarat",
];

/** Rute yang wajib masuk (sesi valid). `/kunci` termasuk: layar kunci
 *  butuh sesi, hanya perilakunya berbeda (mode "kunci"). */
export const RUTE_WAJIB_MASUK: readonly string[] = [
  "/dashboard",
  "/baterai",
  "/penyimpanan",
  "/performa",
  "/keamanan",
  "/ai",
  "/riwayat",
  "/pengaturan",
  "/pengaturan/pin",
  "/kunci",
];

/** Awalan rute publik dinamis (tanpa daftar satu per satu). */
const AWALAN_PUBLIK: readonly string[] = ["/panduan/"];

/** Awalan rute wajib-masuk dinamis (sub-rute pengaturan di masa depan). */
const AWALAN_WAJIB_MASUK: readonly string[] = ["/pengaturan/"];

/** Buang query string, hash, dan garis miring akhir dari sebuah path. */
function jalurBersih(path: string): string {
  const tanpaQuery = path.split(/[?#]/, 1)[0] ?? "";
  if (tanpaQuery.length > 1 && tanpaQuery.endsWith("/")) {
    return tanpaQuery.slice(0, -1);
  }
  return tanpaQuery === "" ? "/" : tanpaQuery;
}

/** true bila rute butuh sesi masuk. */
export function ruteButuhMasuk(path: string): boolean {
  const jalur = jalurBersih(path);
  if (RUTE_WAJIB_MASUK.includes(jalur)) return true;
  if (AWALAN_WAJIB_MASUK.some((awalan) => jalur.startsWith(awalan))) {
    return true;
  }
  return false;
}

/** true bila rute bisa dibuka tanpa masuk. */
export function rutePublik(path: string): boolean {
  const jalur = jalurBersih(path);
  if (RUTE_PUBLIK.includes(jalur)) return true;
  if (AWALAN_PUBLIK.some((awalan) => jalur.startsWith(awalan))) return true;
  return false;
}

export type StatusSesi = "tidak-masuk" | "terkunci" | "terbuka";
export type ModeGerbang = "terbuka" | "kunci";
export type ArahAuth = "tampilkan" | "masuk" | "kunci" | "dashboard";

/**
 * Keputusan gerbang yang murni (tanpa efek samping): dari keadaan sesi
 * dan mode gerbang, ke mana pengguna diarahkan. Diuji di layout.test.ts.
 */
export function putuskanArahAuth(
  statusSesi: StatusSesi,
  mode: ModeGerbang,
): ArahAuth {
  if (statusSesi === "tidak-masuk") return "masuk";
  if (mode === "kunci") {
    return statusSesi === "terkunci" ? "tampilkan" : "dashboard";
  }
  return statusSesi === "terkunci" ? "kunci" : "tampilkan";
}

type StatusPemeriksaan = "memeriksa" | StatusSesi | "galat-jaringan";

/**
 * Satu panggilan GET /api/auth/me dengan timeout 10 detik, lewat
 * lib/api.ts (credentials: "include" + ApiError bertipe, K-16).
 * 401 berarti tidak masuk; 403 SESSION_LOCKED berarti terkunci;
 * galat lain (termasuk timeout) dianggap galat jaringan.
 */
async function periksaSesi(): Promise<StatusSesi | "galat-jaringan"> {
  const pengendali = new AbortController();
  const batasWaktu = window.setTimeout(() => pengendali.abort(), 10_000);
  try {
    const envelope = await fetchJson<{ sesi_terkunci?: boolean }>(
      "/api/auth/me",
      { signal: pengendali.signal },
    );
    return envelope.data.sesi_terkunci === true ? "terkunci" : "terbuka";
  } catch (galat) {
    if (galat instanceof ApiError) {
      if (galat.status === 401) return "tidak-masuk";
      if (galat.status === 403 && galat.code === "SESSION_LOCKED") {
        return "terkunci";
      }
    }
    return "galat-jaringan";
  } finally {
    window.clearTimeout(batasWaktu);
  }
}

interface RequireAuthProps {
  children: ReactNode;
  /** "terbuka": rute aplikasi biasa. "kunci": layar kunci PIN. */
  mode?: ModeGerbang;
}

export default function RequireAuth({
  children,
  mode = "terbuka",
}: RequireAuthProps) {
  const lokasi = useLocation();
  const [status, setStatus] = useState<StatusPemeriksaan>("memeriksa");
  const [percobaanUlang, setPercobaanUlang] = useState(0);

  useEffect(() => {
    let aktif = true;
    setStatus("memeriksa");
    periksaSesi()
      .then((hasil) => {
        if (aktif) setStatus(hasil);
      })
      .catch(() => {
        if (aktif) setStatus("galat-jaringan");
      });
    return () => {
      aktif = false;
    };
  }, [percobaanUlang]);

  if (status === "memeriksa") {
    return (
      <div role="status" aria-label="Memeriksa sesi masuk" className="py-10">
        <div className="h-8 w-1/2 animate-pulse rounded-lg bg-zinc-800" />
        <p className="mt-3 text-sm text-zinc-400">Memeriksa sesi masuk…</p>
        <div className="mt-6 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-800" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (status === "galat-jaringan") {
    return (
      <section aria-labelledby="judul-galat-sesi" className="py-10">
        <h1 id="judul-galat-sesi" className="text-xl font-bold text-white">
          Tidak tersambung ke server
        </h1>
        <p role="alert" className="mt-3 text-base text-zinc-400">
          Sesi masuk tidak bisa diperiksa karena server tidak bisa dihubungi.
          Periksa koneksi, lalu coba lagi.
        </p>
        <button
          type="button"
          onClick={() => setPercobaanUlang((n) => n + 1)}
          className="mt-6 min-h-[48px] rounded-lg bg-white px-5 text-sm font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
        >
          Coba lagi
        </button>
      </section>
    );
  }

  const arah = putuskanArahAuth(status, mode);
  if (arah === "masuk") {
    return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname }} />;
  }
  if (arah === "kunci") {
    return <Navigate to="/kunci" replace state={{ dari: lokasi.pathname }} />;
  }
  if (arah === "dashboard") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
