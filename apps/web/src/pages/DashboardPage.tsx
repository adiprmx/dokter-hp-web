// pages/DashboardPage.tsx — Dashboard (/dashboard).
//
// Menampilkan skor kesehatan terbaru, grafik riwayat skor, tiga pemeriksaan
// terakhir, enam kartu dokter, dan tombol "Diagnosis satu ketuk".
// SEMUA angka berasal dari API — tidak ada angka contoh/dummy di halaman ini.
//
// Data:
// - Skor terbaru + riwayat: GET /api/health-checks?limit=30 (terbaru dulu).
// - Diagnosis satu ketuk: POST /api/ai/diagnose dengan pertanyaan baku
//   (lihat PERTANYAAN_SATU_KETUK) dan health_check_id pemeriksaan terbaru
//   bila ada. Worker merakit konteks dari riwayat pengguna (kontrak API §5);
//   jawaban tampil di halaman ini dan tersimpan ke riwayat diagnosis.
//
// Keterjangkauan server: halaman ini TIDAK memakai checkApiHealth()
// (lib/api.ts) — fungsi itu memeriksa field `ok` di tingkat envelope,
// padahal GET /api/health mengembalikan envelope { data: { status: "ok" } },
// sehingga selalu mengembalikan false. Sebagai gantinya, halaman ini
// menilai dari request data yang sebenarnya: bila fetch gagal di tingkat
// jaringan (bukan respons HTTP), server dianggap tidak terjangkau dan
// banner ditampilkan + apiStatus di store diperbarui.
//
// Performa (docs/performance.md 3.2): grafik riwayat skor dimuat malas
// (React.lazy) dan hanya di-render setelah data selesai dimuat dan ada data.

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { fetchJson } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import {
  klasifikasiSkor,
  labelKategori,
  penjelasanKategori,
} from "../lib/skor";
import { ScoreRing } from "../components/charts/ScoreRing";

// Grafik riwayat dimuat malas — bukan bagian chunk awal dashboard.
const ScoreHistoryChart = lazy(() =>
  import("../components/charts/ScoreHistoryChart").then((m) => ({
    default: m.ScoreHistoryChart,
  })),
);

// Envelope JSON standar (docs/api-contracts.md 0.3).
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { timestamp?: string };
}

// Bentuk health check (docs/api-contracts.md §3).
interface KomponenRingkasan {
  status: string;
  skor: number;
  sumber: string;
}

export interface HealthCheck {
  id: string;
  skor: number;
  ringkasan: Record<string, KomponenRingkasan>;
  dibuat_pada: string;
}

// Bentuk diagnosis AI (docs/api-contracts.md §5).
interface AiDiagnosis {
  id: string;
  pertanyaan: string;
  jawaban: string;
  dibuat_pada: string;
}

// Pertanyaan baku diagnosis satu ketuk. Worker menambahkan konteks dari
// riwayat pengguna (pemeriksaan + laporan WiFi terakhir); pertanyaan
// lanjutan yang ditulis pengguna sendiri dilayani di halaman /ai.
const PERTANYAAN_SATU_KETUK =
  "Bagaimana kondisi HP saya berdasarkan data pemeriksaan terakhir?";

const LABEL_KOMPONEN: Record<string, string> = {
  wifi: "WiFi",
  baterai: "Baterai",
  penyimpanan: "Penyimpanan",
  performa: "Performa",
  keamanan: "Keamanan",
};

const LABEL_SUMBER: Record<string, string> = {
  web: "tes web",
  manual: "diisi manual",
  apk: "dari aplikasi Dokter HP",
};

// Kartu dokter (judul + subjudul dari docs/copy.md §4).
const DOKTER = [
  {
    rute: "/wifi",
    judul: "Dokter WiFi",
    subjudul: "Tes kecepatan dan cari penyebab WiFi lemot",
  },
  {
    rute: "/baterai",
    judul: "Dokter Baterai",
    subjudul: "Lihat riwayat dan kondisi baterai",
  },
  {
    rute: "/penyimpanan",
    judul: "Dokter Penyimpanan",
    subjudul: "Lihat pemakaian ruang penyimpanan",
  },
  {
    rute: "/performa",
    judul: "Dokter Performa",
    subjudul: "Lihat riwayat kecepatan dan beban HP",
  },
  {
    rute: "/keamanan",
    judul: "Dokter Keamanan",
    subjudul: "Tinjau aplikasi dan izin yang berisiko",
  },
  {
    rute: "/ai",
    judul: "Diagnosis AI",
    subjudul: "Tanya soal masalah HP dan dapatkan saran",
  },
] as const;

const formatTanggal = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const formatJam = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/** "17 November 2026, 22.15" (format docs/copy.md §0). */
function formatWaktu(iso: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "tidak tersedia";
  return `${formatTanggal.format(tanggal)}, ${formatJam.format(tanggal)}`;
}

/**
 * Ambil status HTTP dari galat yang dilempar fetchJson (lib/api.ts):
 * galat HTTP berbentuk Error("Permintaan <path> gagal: <status>"),
 * sedangkan galat jaringan meneruskan galat fetch asli (tanpa pola itu)
 * dan mengembalikan null.
 */
function statusHttpDariGalat(galat: unknown): number | null {
  if (!(galat instanceof Error)) return null;
  const cocok = galat.message.match(/gagal:\s(\d{3})\s*$/);
  return cocok ? Number(cocok[1]) : null;
}

export default function DashboardPage() {
  const apiStatus = useAppStore((s) => s.apiStatus);
  const setApiStatus = useAppStore((s) => s.setApiStatus);

  const [data, setData] = useState<HealthCheck[] | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [belumMasuk, setBelumMasuk] = useState(false);
  const [terkunci, setTerkunci] = useState(false);

  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(null);
  const [diagnosisMemuat, setDiagnosisMemuat] = useState(false);
  const [diagnosisGalat, setDiagnosisGalat] = useState<string | null>(null);
  const [pesanStatus, setPesanStatus] = useState<string | null>(null);

  const judulRef = useRef<HTMLHeadingElement>(null);

  // Judul halaman unik per rute + fokus ke heading saat rute dibuka
  // (a11y.md 5.4: pengguna pembaca layar harus tahu halaman berganti).
  useEffect(() => {
    document.title = "Dashboard — Dokter HP";
    judulRef.current?.focus();
  }, []);

  const muatData = useCallback(async () => {
    setMemuat(true);
    setGalatMuat(null);
    setBelumMasuk(false);
    setTerkunci(false);
    try {
      const hasil = await fetchJson<ApiEnvelope<HealthCheck[]>>(
        "/api/health-checks?limit=30",
      );
      // Respons HTTP apa pun yang berhasil berarti server terjangkau.
      setApiStatus("terhubung");
      setData(Array.isArray(hasil.data) ? hasil.data : []);
    } catch (galat) {
      const status = statusHttpDariGalat(galat);
      if (status === null) {
        // Gagal di tingkat jaringan: server tidak terjangkau.
        setApiStatus("tidak-terjangkau");
        setGalatMuat(
          "Tidak tersambung ke server. Tes WiFi tetap bisa dijalankan, tetapi hasilnya tidak tersimpan.",
        );
      } else if (status === 401) {
        setApiStatus("terhubung");
        setBelumMasuk(true);
      } else if (status === 403) {
        setApiStatus("terhubung");
        setTerkunci(true);
      } else {
        setApiStatus("terhubung");
        setGalatMuat("Data tidak bisa dimuat. Coba lagi.");
      }
    } finally {
      setMemuat(false);
    }
  }, [setApiStatus]);

  useEffect(() => {
    let aktif = true;
    const jalankan = async () => {
      if (aktif) await muatData();
    };
    void jalankan();
    return () => {
      aktif = false;
    };
  }, [muatData]);

  const terbaru = data !== null && data.length > 0 ? data[0] : null;
  const tigaTerakhir = data !== null ? data.slice(0, 3) : [];

  const jalankanDiagnosis = async () => {
    setDiagnosisMemuat(true);
    setDiagnosisGalat(null);
    setPesanStatus(null);
    try {
      const hasil = await fetchJson<ApiEnvelope<AiDiagnosis>>(
        "/api/ai/diagnose",
        {
          method: "POST",
          body: JSON.stringify({
            pertanyaan: PERTANYAAN_SATU_KETUK,
            ...(terbaru ? { health_check_id: terbaru.id } : {}),
          }),
        },
      );
      setDiagnosis(hasil.data);
      setPesanStatus(
        "Jawaban sudah tampil di bawah. Tanya jawab ini tersimpan ke riwayat.",
      );
    } catch (galat) {
      const status = statusHttpDariGalat(galat);
      if (status === 429) {
        setDiagnosisGalat(
          "Batas 20 pertanyaan hari ini sudah habis. Batas kembali besok.",
        );
      } else if (status === 502) {
        setDiagnosisGalat("Diagnosis AI sedang tidak tersedia, coba lagi nanti.");
      } else if (status === 401) {
        setDiagnosisGalat("Sesi sudah berakhir. Masuk lagi untuk lanjut.");
      } else if (status === null) {
        setApiStatus("tidak-terjangkau");
        setDiagnosisGalat(
          "Tidak tersambung ke server. Tes WiFi tetap bisa dijalankan, tetapi hasilnya tidak tersimpan.",
        );
      } else {
        setDiagnosisGalat("Terjadi kesalahan. Coba lagi.");
      }
    } finally {
      setDiagnosisMemuat(false);
    }
  };

  const kategoriTerbaru =
    terbaru === null ? null : klasifikasiSkor(terbaru.skor);
  const entriRingkasan =
    terbaru === null ? [] : Object.entries(terbaru.ringkasan ?? {});

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1
        ref={judulRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]"
      >
        Dashboard
      </h1>

      {apiStatus === "tidak-terjangkau" ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4"
        >
          <p className="font-medium text-[var(--color-error)]">
            Tidak tersambung ke server — hasil tes tidak tersimpan
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Tes WiFi tetap bisa dijalankan, tetapi hasilnya tidak tersimpan
            sampai sambungan ke server pulih.
          </p>
        </div>
      ) : null}

      {belumMasuk ? (
        <div className="mt-4 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4">
          <p className="font-medium text-[var(--color-text-primary)]">
            Anda belum masuk. Hasil tes tidak tersimpan.
          </p>
          <Link
            to="/masuk"
            className="mt-3 inline-flex min-h-[48px] items-center rounded-lg bg-white px-5 text-base font-medium text-black"
          >
            Masuk untuk menyimpan
          </Link>
        </div>
      ) : null}

      {terkunci ? (
        <div className="mt-4 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4">
          <p className="font-medium text-[var(--color-text-primary)]">
            Aplikasi terkunci, masukkan PIN untuk membuka.
          </p>
          <Link
            to="/kunci"
            className="mt-3 inline-flex min-h-[48px] items-center rounded-lg bg-white px-5 text-base font-medium text-black"
          >
            Masukkan PIN
          </Link>
        </div>
      ) : null}

      <section
        aria-labelledby="judul-skor"
        className="mt-6 rounded-xl bg-[var(--color-surface)] p-4 sm:p-5"
      >
        <h2
          id="judul-skor"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Kesehatan HP
        </h2>

        {memuat ? (
          <p role="status" className="mt-4 text-sm text-[var(--color-text-muted)]">
            Mengambil data…
          </p>
        ) : galatMuat !== null ? (
          <div className="mt-4">
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {galatMuat}
            </p>
            <button
              type="button"
              onClick={() => void muatData()}
              className="mt-3 inline-flex min-h-[48px] items-center rounded-lg border border-[var(--color-border-strong)] bg-transparent px-5 text-base font-medium text-[var(--color-text-primary)]"
            >
              Coba lagi
            </button>
          </div>
        ) : belumMasuk || terkunci ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
            Masuk untuk melihat skor dan riwayat pemeriksaan.
          </p>
        ) : terbaru === null ? (
          <div className="mt-4">
            <p className="text-base font-semibold text-[var(--color-text-primary)]">
              Belum ada pemeriksaan — mulai dari Dokter WiFi
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Skor dihitung dari data yang tersedia saat ini. Bagian yang
              belum ada datanya tidak dihitung.
            </p>
            <Link
              to="/wifi"
              className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-white px-5 text-base font-medium text-black"
            >
              Mulai dari Dokter WiFi
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-4">
            <ScoreRing skor={terbaru.skor} />
            <div className="min-w-0">
              <p className="text-xl font-semibold text-[var(--color-text-primary)]">
                Skor <span className="dh-numeric">{terbaru.skor}</span> dari
                100
              </p>
              <p
                className="mt-1 text-base font-medium"
                style={{
                  color:
                    kategoriTerbaru === "baik"
                      ? "var(--color-success)"
                      : kategoriTerbaru === "cukup"
                        ? "var(--color-warning)"
                        : "var(--color-error)",
                }}
              >
                {kategoriTerbaru !== null
                  ? labelKategori(kategoriTerbaru)
                  : null}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {kategoriTerbaru !== null
                  ? penjelasanKategori(kategoriTerbaru)
                  : null}
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Diperiksa {formatWaktu(terbaru.dibuat_pada)}
              </p>
            </div>
          </div>
        )}

        {terbaru !== null && entriRingkasan.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Dihitung dari:
            </p>
            <ul className="mt-2 space-y-1">
              {entriRingkasan.map(([nama, komponen]) => (
                <li
                  key={nama}
                  className="text-sm text-[var(--color-text-muted)]"
                >
                  {LABEL_KOMPONEN[nama] ?? nama} — skor{" "}
                  <span className="dh-numeric">{komponen.skor}</span> (
                  {LABEL_SUMBER[komponen.sumber] ?? komponen.sumber})
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5">
          <button
            type="button"
            onClick={() => void jalankanDiagnosis()}
            disabled={diagnosisMemuat}
            aria-busy={diagnosisMemuat || undefined}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-white px-5 text-base font-medium text-black transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#27272a] disabled:text-[#a1a1aa] disabled:active:scale-100 sm:w-auto"
          >
            {diagnosisMemuat ? "Memeriksa…" : "Diagnosis satu ketuk"}
          </button>
          {diagnosisGalat !== null ? (
            <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
              {diagnosisGalat}
            </p>
          ) : null}
          {pesanStatus !== null ? (
            <p
              role="status"
              className="mt-3 text-sm text-[var(--color-text-muted)]"
            >
              {pesanStatus}
            </p>
          ) : null}
        </div>

        {diagnosis !== null ? (
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Saran dari AI
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Jawaban di bawah ini adalah saran berdasarkan data yang
              tersedia, bukan vonis pasti.
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
              {diagnosis.jawaban}
            </p>
            <Link
              to="/ai"
              className="mt-4 inline-flex min-h-[48px] items-center text-base font-medium text-[var(--color-text-primary)] underline underline-offset-4"
            >
              Tanya lanjutan di Diagnosis AI
            </Link>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="judul-dokter" className="mt-8">
        <h2
          id="judul-dokter"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Semua dokter
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DOKTER.map((dokter) => (
            <li key={dokter.rute}>
              <Link
                to={dokter.rute}
                aria-label={`Buka ${dokter.judul}`}
                className="flex min-h-[48px] h-full flex-col rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  {dokter.judul}
                </span>
                <span className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {dokter.subjudul}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="judul-riwayat"
        className="mt-8 rounded-xl bg-[var(--color-surface)] p-4 sm:p-5"
      >
        <h2
          id="judul-riwayat"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Riwayat skor
        </h2>
        <div className="mt-4">
          {memuat ? (
            <p
              role="status"
              className="text-sm text-[var(--color-text-muted)]"
            >
              Mengambil data…
            </p>
          ) : data === null || data.length === 0 ? (
            <div>
              <p className="text-base font-semibold text-[var(--color-text-primary)]">
                Belum ada data pemeriksaan
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                Jalankan diagnosis satu ketuk untuk melihat perkembangan skor
                dari waktu ke waktu.
              </p>
            </div>
          ) : (
            <Suspense
              fallback={
                <p
                  role="status"
                  className="text-sm text-[var(--color-text-muted)]"
                >
                  Memuat grafik…
                </p>
              }
            >
              <ScoreHistoryChart
                data={data.map((item) => ({
                  tanggal: item.dibuat_pada,
                  skor: item.skor,
                }))}
              />
            </Suspense>
          )}
        </div>
      </section>

      <section aria-labelledby="judul-terakhir" className="mt-8">
        <h2
          id="judul-terakhir"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Pemeriksaan terakhir
        </h2>
        {memuat ? (
          <p
            role="status"
            className="mt-4 text-sm text-[var(--color-text-muted)]"
          >
            Mengambil data…
          </p>
        ) : tigaTerakhir.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
            Belum ada pemeriksaan. Ketuk Diagnosis satu ketuk untuk mulai.
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {tigaTerakhir.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-primary)]"
                >
                  Skor <span className="dh-numeric">{item.skor}</span> —{" "}
                  {labelKategori(klasifikasiSkor(item.skor))} —{" "}
                  {formatWaktu(item.dibuat_pada)}
                </li>
              ))}
            </ul>
            <Link
              to="/riwayat"
              className="mt-4 inline-flex min-h-[48px] items-center text-base font-medium text-[var(--color-text-primary)] underline underline-offset-4"
            >
              Lihat semua di Riwayat
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
