// pages/DashboardPage.tsx: Dashboard (/dashboard).
//
// Redesign v2.0 (docs/redesign-v20-spec.md §8.2): "Alat ukur, hidup".
// Design Read: dashboard Operate untuk pemilik HP yang punya masalah
// nyata, dial antislop ENERGY 3 / RHYTHM 4 / MOTION 2. Skor besar
// tetap pahlawan halaman (cincin 160 px, token --ring-score-size di
// tokens.css); warna HANYA mengkode status dan SELALU berpasangan
// dengan label teks. Semua warna status mengalir lewat
// lib/status-warna.ts. Tidak ada pemetaan keadaan ke warna di file
// ini, tidak ada hex status di file ini.
//
// Menampilkan skor kesehatan terbaru, grafik riwayat skor, tiga
// pemeriksaan terakhir, enam kartu dokter, dan tombol "Diagnosis
// satu ketuk". SEMUA angka berasal dari API. Tidak ada angka
// contoh/dummy di halaman ini.
//
// Data:
// - Skor terbaru + riwayat: GET /api/health-checks?limit=30 (terbaru dulu).
// - Diagnosis satu ketuk: POST /api/ai/diagnose dengan pertanyaan baku
//   (lihat PERTANYAAN_SATU_KETUK) dan health_check_id pemeriksaan terbaru
//   bila ada. Worker merakit konteks dari riwayat pengguna (kontrak API §5);
//   jawaban tampil di halaman ini dan tersimpan ke riwayat diagnosis.
//
// Keterjangkauan server: halaman ini menilai dari request data yang
// sebenarnya. Bila fetch gagal di tingkat jaringan (bukan respons
// HTTP), server dianggap tidak terjangkau dan banner ditampilkan +
// apiStatus di store diperbarui. (checkApiHealth() di lib/api.ts
// sudah diperbaiki ke envelope K-24 dan dipakai halaman /wifi.)
//
// Performa (docs/performance.md 3.2): grafik riwayat skor dimuat malas
// (React.lazy) dan hanya di-render setelah data selesai dimuat dan ada data.
//
// Keputusan desain (R-31, satu baris alasan per keputusan):
// - Status kartu dokter diambil dari komponen terbaru dokter itu di
//   SELURUH riwayat yang dimuat, karena satu baris health check bisa
//   hanya berisi satu komponen (misal entri baterai manual).
// - Kartu Diagnosis AI tanpa lencana status: AI bukan hasil ukur,
//   jadi tidak ada keadaan yang bisa diklaim.
// - Label lencana memakai labelStatus lib/status-warna (K-94), dan
//   label di dalam cincin skor memakai sumber yang sama (ScoreRing)
//   — satu kata untuk satu keadaan di semua tempat. Kalimat penjelasan
//   di bawah skor tetap dari penjelasanKategori (prosa, bukan label).
// - Saat kosong, permukaan kartu hero dilepas dan EmptyState berdiri
//   sendiri: EmptyState sudah berupa kartu, menaruhnya di dalam
//   kartu hero berarti kartu di dalam kartu.
// - Keadaan kosong grafik dan pemeriksaan terakhir memakai teks
//   kanonis docs/copy.md tanpa CTA kedua: satu halaman satu maksud
//   CTA (EmptyState hero mengarah ke Dokter WiFi).
// - StatusBadge + Card memakai kosakata keadaan kanonis yang sama
//   (StatusWarna, K-95): nilai helper diteruskan langsung ke prop
//   status, tanpa adaptor.
// - Desktop memakai grid 2 kolom (spec §5): cincin skor di kiri,
//   kartu dokter di kanan; grafik dan pemeriksaan terakhir di bawah.
//   HP satu kolom, tanpa overflow horizontal.

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { ApiError, panggilApi } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import { klasifikasiSkor, penjelasanKategori } from "../lib/skor";
import {
  labelStatus,
  statusDariDoctor,
  statusDariSkor,
  type StatusWarna,
} from "../lib/status-warna";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ScoreRing } from "../components/charts/ScoreRing";

// Grafik riwayat dimuat malas, bukan bagian chunk awal dashboard.
const ScoreHistoryChart = lazy(() =>
  import("../components/charts/ScoreHistoryChart").then((m) => ({
    default: m.ScoreHistoryChart,
  })),
);

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

// Kartu dokter (judul + subjudul dari docs/copy.md §4). `kunci`
// menunjuk komponen ringkasan yang memberi status REAL kartu itu;
// Diagnosis AI berkunci null karena tidak punya komponen ringkasan.
const DOKTER = [
  {
    rute: "/wifi",
    kunci: "wifi",
    judul: "Dokter WiFi",
    subjudul: "Tes kecepatan dan cari penyebab WiFi lemot",
  },
  {
    rute: "/baterai",
    kunci: "baterai",
    judul: "Dokter Baterai",
    subjudul: "Lihat riwayat dan kondisi baterai",
  },
  {
    rute: "/penyimpanan",
    kunci: "penyimpanan",
    judul: "Dokter Penyimpanan",
    subjudul: "Lihat pemakaian ruang penyimpanan",
  },
  {
    rute: "/performa",
    kunci: "performa",
    judul: "Dokter Performa",
    subjudul: "Lihat riwayat kecepatan dan beban HP",
  },
  {
    rute: "/keamanan",
    kunci: "keamanan",
    judul: "Dokter Keamanan",
    subjudul: "Tinjau aplikasi dan izin yang berisiko",
  },
  {
    rute: "/ai",
    kunci: null,
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
 * Ambil status HTTP dari galat API (lib/api.ts): ApiError membawa
 * status; galat jaringan (bukan ApiError) mengembalikan null.
 */
function statusHttpDariGalat(galat: unknown): number | null {
  if (galat instanceof ApiError) return galat.status;
  return null;
}

/** Ambil kode galat mesin dari ApiError (null bila bukan ApiError). */
function kodeDariGalat(galat: unknown): string | null {
  if (galat instanceof ApiError) return galat.code;
  return null;
}

/**
 * Status + label satu komponen ringkasan, atau null bila komponen
 * tidak ada atau tidak punya status maupun skor yang valid. Warna
 * lewat helper status-warna; label lewat label domain agar kata di
 * lencana sama dengan kata di cincin skor dan halaman dokter.
 */
function statusDariKomponen(
  komponen: KomponenRingkasan | undefined,
): { status: StatusWarna; label: string } | null {
  if (!komponen) return null;
  if (
    komponen.status === "baik" ||
    komponen.status === "cukup" ||
    komponen.status === "perlu_perhatian"
  ) {
    return {
      status: statusDariDoctor(komponen.status),
      label: labelStatus(statusDariDoctor(komponen.status)),
    };
  }
  // Cadangan bila status tidak dikenali: skor komponen tetap memberi
  // keadaan lewat ambang kanonis 80/50 di lib/skor.ts.
  if (typeof komponen.skor === "number" && Number.isFinite(komponen.skor)) {
    return {
      status: statusDariSkor(komponen.skor),
      label: labelStatus(statusDariSkor(komponen.skor)),
    };
  }
  return null;
}

/**
 * Status REAL satu dokter: komponen terbaru untuk dokter itu di
 * seluruh riwayat yang dimuat (baris terbaru dulu). Satu baris
 * health check bisa hanya berisi satu komponen, jadi pemindaian
 * tidak berhenti di baris terbaru. Null berarti tidak ada data
 * untuk dokter itu di 30 baris terakhir.
 */
function statusDokter(
  data: HealthCheck[] | null,
  kunci: string,
): { status: StatusWarna; label: string } | null {
  if (!data) return null;
  for (const item of data) {
    const hasil = statusDariKomponen(item.ringkasan?.[kunci]);
    if (hasil) return hasil;
  }
  return null;
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
      const data = await panggilApi<HealthCheck[]>(
        "/api/health-checks?limit=30",
      );
      // Respons HTTP apa pun yang berhasil berarti server terjangkau.
      setApiStatus("terhubung");
      setData(Array.isArray(data) ? data : []);
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
      const data = await panggilApi<AiDiagnosis>("/api/ai/diagnose", {
        method: "POST",
        body: JSON.stringify({
          pertanyaan: PERTANYAAN_SATU_KETUK,
          ...(terbaru ? { health_check_id: terbaru.id } : {}),
        }),
      });
      setDiagnosis(data);
      setPesanStatus(
        "Jawaban sudah tampil di bawah. Tanya jawab ini tersimpan ke riwayat.",
      );
    } catch (galat) {
      const status = statusHttpDariGalat(galat);
      const kode = kodeDariGalat(galat);
      if (kode === "AI_QUOTA_HABIS") {
        setDiagnosisGalat(
          "Batas 20 pertanyaan hari ini sudah habis. Batas kembali besok.",
        );
      } else if (kode === "RATE_LIMITED") {
        setDiagnosisGalat("Terlalu sering, coba lagi sebentar.");
      } else if (status === 429) {
        setDiagnosisGalat(
          "Batas 20 pertanyaan hari ini sudah habis. Batas kembali besok.",
        );
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
  const statusTerbaru =
    terbaru === null ? null : statusDariSkor(terbaru.skor);
  const entriRingkasan =
    terbaru === null ? [] : Object.entries(terbaru.ringkasan ?? {});
  // Hero kosong: permukaan kartu hero dilepas agar EmptyState (yang
  // sudah berupa kartu) berdiri sendiri, bukan kartu di dalam kartu.
  const heroKosong =
    !memuat &&
    galatMuat === null &&
    !belumMasuk &&
    !terkunci &&
    terbaru === null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
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
            Tidak tersambung ke server. Hasil tes tidak tersimpan.
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

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="judul-skor"
          className={
            heroKosong
              ? "lg:col-span-5"
              : "rounded-xl bg-[var(--color-surface)] p-4 sm:p-5 lg:col-span-5"
          }
        >
          <h2
            id="judul-skor"
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            Kesehatan HP
          </h2>

          {memuat ? (
            <div className="mt-4">
              <Skeleton
                width={160}
                height={160}
                rounded="full"
                label="Memuat skor"
              />
              <div className="mt-4">
                <SkeletonText lines={3} label="Memuat skor" />
              </div>
              <p
                role="status"
                className="mt-4 text-sm text-[var(--color-text-muted)]"
              >
                Mengambil data…
              </p>
            </div>
          ) : galatMuat !== null ? (
            <div className="mt-4">
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {galatMuat}
              </p>
              <Button
                variant="secondary"
                onClick={() => void muatData()}
                className="mt-3"
              >
                Coba lagi
              </Button>
            </div>
          ) : belumMasuk || terkunci ? (
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Masuk untuk melihat skor dan riwayat pemeriksaan.
            </p>
          ) : terbaru === null ? (
            <div className="mt-4">
              <EmptyState
                title="Belum ada pemeriksaan"
                description="Skor dihitung dari data yang tersedia saat ini. Bagian yang belum ada datanya tidak dihitung."
                action={
                  <Link
                    to="/wifi"
                    className="inline-flex min-h-[48px] items-center rounded-lg bg-white px-5 text-base font-medium text-black"
                  >
                    Mulai dari Dokter WiFi
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-4">
              <ScoreRing skor={terbaru.skor} ukuran={160} />
              <p className="mt-4 text-xl font-semibold text-[var(--color-text-primary)]">
                Skor <span className="dh-numeric">{terbaru.skor}</span> dari
                100
              </p>
              {kategoriTerbaru !== null && statusTerbaru !== null ? (
                <div className="mt-2">
                  <StatusBadge status={statusTerbaru}>
                    {labelStatus(statusTerbaru)}
                  </StatusBadge>
                </div>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {kategoriTerbaru !== null
                  ? penjelasanKategori(kategoriTerbaru)
                  : null}
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Diperiksa {formatWaktu(terbaru.dibuat_pada)}
              </p>
            </div>
          )}

          {terbaru !== null && entriRingkasan.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Dihitung dari:
              </p>
              <ul className="mt-2 divide-y divide-[var(--color-border)]">
                {entriRingkasan.map(([nama, komponen]) => {
                  const info = statusDariKomponen(komponen);
                  return (
                    <li
                      key={nama}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {LABEL_KOMPONEN[nama] ?? nama}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          skor{" "}
                          <span className="dh-numeric">{komponen.skor}</span>,{" "}
                          {LABEL_SUMBER[komponen.sumber] ?? komponen.sumber}
                        </p>
                      </div>
                      {info ? (
                        <StatusBadge status={info.status}>
                          {info.label}
                        </StatusBadge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-5">
            <Button
              loading={diagnosisMemuat}
              fullWidth
              onClick={() => void jalankanDiagnosis()}
              className="sm:w-auto"
            >
              {diagnosisMemuat ? "Memeriksa…" : "Diagnosis satu ketuk"}
            </Button>
            {diagnosisGalat !== null ? (
              <p
                role="alert"
                className="mt-3 text-sm text-[var(--color-error)]"
              >
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

        <section aria-labelledby="judul-dokter" className="lg:col-span-7">
          <h2
            id="judul-dokter"
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            Semua dokter
          </h2>
          {memuat ? (
            <ul
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
              aria-hidden="true"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <Skeleton height={118} rounded="lg" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DOKTER.map((dokter) => {
                const info =
                  dokter.kunci === null
                    ? null
                    : statusDokter(data, dokter.kunci);
                return (
                  <li key={dokter.rute}>
                    <Link
                      to={dokter.rute}
                      aria-label={`Buka ${dokter.judul}`}
                      className="block h-full rounded-xl transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98]"
                    >
                      <Card
                        status={info?.status ?? "netral"}
                        className="h-full"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {dokter.judul}
                          </span>
                          {dokter.kunci !== null && data !== null ? (
                            <StatusBadge
                              status={info ? info.status : "netral"}
                            >
                              {info ? info.label : "Belum ada data"}
                            </StatusBadge>
                          ) : null}
                        </div>
                        <span className="mt-1 block text-sm leading-relaxed text-[var(--color-text-muted)]">
                          {dokter.subjudul}
                        </span>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="judul-riwayat"
          className="rounded-xl bg-[var(--color-surface)] p-4 sm:p-5 lg:col-span-7"
        >
          <h2
            id="judul-riwayat"
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            Riwayat skor
          </h2>
          <div className="mt-4">
            {memuat ? (
              <Skeleton
                height={180}
                rounded="lg"
                label="Memuat grafik riwayat skor"
              />
            ) : data === null || data.length === 0 ? (
              <div>
                <p className="text-base font-semibold text-[var(--color-text-primary)]">
                  Belum ada data pemeriksaan
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  Jalankan diagnosis satu ketuk untuk melihat perkembangan
                  skor dari waktu ke waktu.
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

        <section aria-labelledby="judul-terakhir" className="lg:col-span-5">
          <h2
            id="judul-terakhir"
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            Pemeriksaan terakhir
          </h2>
          {memuat ? (
            <ul className="mt-4 space-y-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <Skeleton height={76} rounded="lg" />
                </li>
              ))}
            </ul>
          ) : tigaTerakhir.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Belum ada pemeriksaan. Ketuk Diagnosis satu ketuk untuk mulai.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {tigaTerakhir.map((item) => {
                  const status = statusDariSkor(item.skor);
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl bg-[var(--color-surface)] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[var(--color-text-primary)]">
                            Skor{" "}
                            <span className="dh-numeric text-lg font-semibold">
                              {item.skor}
                            </span>{" "}
                            <span className="text-sm text-[var(--color-text-muted)]">
                              dari 100
                            </span>
                          </p>
                          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                            {formatWaktu(item.dibuat_pada)}
                          </p>
                        </div>
                        <StatusBadge status={status}>
                          {labelStatus(status)}
                        </StatusBadge>
                      </div>
                    </li>
                  );
                })}
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
      </div>
    </div>
  );
}
