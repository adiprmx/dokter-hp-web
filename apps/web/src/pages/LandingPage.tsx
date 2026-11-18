// pages/LandingPage.tsx — Beranda (rute `/`), redesign v2.0.
//
// Mode impeccable: Persuade. Bahasa "Alat ukur, hidup"
// (docs/redesign-v20-spec.md §2): hero terbelah di desktop (salinan
// di kiri, panel meter di kanan) supaya angka ukur jadi titik fokus
// satu layar, bukan tumpukan kartu abu. HP 360 px: satu kolom, nol
// overflow horizontal.
//
// Panel meter memakai data REAL, bukan angka contoh (R-17):
// - Belum masuk: legenda skala skor (ambang kanonis 80/50 dari
//   lib/skor.ts) + MeterStrip tanpa nilai. Tidak ada skor yang
//   ditampilkan karena memang belum ada yang diukur.
// - Sudah masuk: skor terakhir dari GET /api/health-checks?limit=1,
//   tampil sebagai ScoreRing berwarna + MeterStrip bertanda nilai.
//   Kosong = keadaan kosong jujur; galat = pesan + tombol Coba lagi;
//   sesi habis (401) = pesan sesi + tautan Masuk.
//
// Warna status HANYA lewat helper lib/status-warna.ts dan komponen
// yang memakainya (Card/StatusBadge/ScoreRing/MeterStrip); tidak ada
// hex status di file ini. Semua teks mengikuti docs/copy.md §1;
// string baru memakai Bahasa Indonesia netral profesional, tanpa
// em dash, tanpa jargon, tanpa angka karangan.
//
// Alasan keputusan (R-31, satu baris per keputusan):
// - Hero split: angka ukur dibaca lebih dulu (spec §5).
// - Legenda skala di hero: warna hijau/kuning/merah adalah arti
//   status, bukan hiasan (spec §4).
// - Keunggulan jadi strip sel berpembatas, bukan 3 kartu identik:
//   kartu identik berulang dilarang (R-14, craft-floor).
// - Panduan 1 unggulan + grid 2 kolom: ritme bervariasi (RHYTHM 4)
//   dan memakai lebar desktop.
// - Batasan jadi Card status info: biru = info penting (spec §4).
// - Tanpa logo Android: tidak ada SVG resmi di repo; logo tiruan
//   dilarang.
// - Tanpa angka statistik: tidak ada data real untuk itu (R-17).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Link } from "react-router-dom";
import { ApiError, panggilApi } from "../lib/api";
import { ScoreRing } from "../components/charts/ScoreRing";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { MeterStrip } from "../components/ui/MeterStrip";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  labelStatus,
  type StatusWarna,
} from "../lib/status-warna";
import { SKOR_MIN_BAIK, SKOR_MIN_CUKUP } from "../lib/skor";
import { useAppStore } from "../store/useAppStore";
import { PANDUAN } from "../data/panduan";

// Gaya tautan aksi (meniru varian Button primary/secondary, karena
// Button hanya untuk <button>; fokus keyboard memakai aturan global
// :focus-visible di styles/tokens.css, sama seperti Button).
const TAUTAN_UTAMA =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-zinc-200 active:scale-[0.97]";
const TAUTAN_SEKUNDER =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[var(--color-border-strong)] px-5 py-3 text-base font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-white/5 active:scale-[0.97]";

// Ikon geometris strip keunggulan: SVG garis tajam satu bobot
// (stroke 2, konvensi proyek seperti ikon EmptyState), bukan emoji
// atau glif Unicode. Ketiganya motif alat ukur/langkah/riwayat.
function IkonPengukur() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 17a8 8 0 0 1 16 0" />
      <path d="M12 17l3.5-5" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IkonLangkah() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="5" y1="7" x2="19" y2="7" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function IkonRiwayat() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

// Tiga keunggulan (teks dari docs/copy.md §1, tanpa perubahan arti).
const KEUNGGULAN: Array<{
  judul: string;
  isi: string;
  ikon: ComponentType;
}> = [
  {
    judul: "Tes WiFi sungguhan",
    isi: "Kecepatan diukur langsung dari browser, bukan ditebak. Hasilnya angka nyata dari koneksi yang sedang dipakai.",
    ikon: IkonPengukur,
  },
  {
    judul: "Penjelasan yang mudah dipahami",
    isi: "Setiap hasil disertai arti dan langkah perbaikan yang bisa dilakukan sendiri, dengan bahasa yang mudah dicerna.",
    ikon: IkonLangkah,
  },
  {
    judul: "Riwayat tersimpan di akun",
    isi: "Hasil pemeriksaan tersimpan dan bisa dibuka lagi dari perangkat mana pun setelah masuk.",
    ikon: IkonRiwayat,
  },
];

// Legenda skala skor untuk pengunjung yang belum masuk. Label dari
// helper status-warna (satu sumber kebenaran); rentang dihitung dari
// ambang kanonis 80/50 (lib/skor.ts), bukan angka yang ditulis
// tangan di dua tempat.
const SKALA: Array<{
  status: StatusWarna;
  rentang: string;
}> = [
  {
    status: "sukses",
    rentang: `${SKOR_MIN_BAIK} sampai 100`,
  },
  {
    status: "peringatan",
    rentang: `${SKOR_MIN_CUKUP} sampai ${SKOR_MIN_BAIK - 1}`,
  },
  {
    status: "galat",
    rentang: `di bawah ${SKOR_MIN_CUKUP}`,
  },
];

// Bentuk ringkas health check: hanya kolom yang dipakai panel meter
// (kontrak lengkap di docs/api-contracts.md §3, dipakai DashboardPage).
interface SkorTerbaru {
  id: string;
  skor: number;
  dibuat_pada: string;
}

type KeadaanSkor = "memuat" | "ada" | "kosong" | "galat" | "sesi-habis";

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

const JUDUL_HALAMAN =
  "Dokter HP — Cek WiFi Lemot, Baterai Boros & Kesehatan HP";

export default function LandingPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);
  const statusMasuk = useAppStore((s) => s.statusMasuk);
  const [skor, setSkor] = useState<SkorTerbaru | null>(null);
  const [keadaanSkor, setKeadaanSkor] = useState<KeadaanSkor>("memuat");

  useEffect(() => {
    document.title = JUDUL_HALAMAN;
    judulRef.current?.focus();
  }, []);

  // Skor terakhir hanya diambil bila sudah masuk. Pengunjung yang
  // belum masuk tidak memicu panggilan API apa pun dari halaman ini.
  const muatSkor = useCallback(async () => {
    setKeadaanSkor("memuat");
    try {
      const data = await panggilApi<SkorTerbaru[]>(
        "/api/health-checks?limit=1",
      );
      const daftar = Array.isArray(data) ? data : [];
      if (daftar.length === 0) {
        setSkor(null);
        setKeadaanSkor("kosong");
      } else {
        setSkor(daftar[0]);
        setKeadaanSkor("ada");
      }
    } catch (galat) {
      // Sesi habis di antara pemeriksaan sesi dan panggilan ini:
      // arahkan ke Masuk, bukan tombol coba lagi yang akan gagal lagi.
      if (galat instanceof ApiError && galat.status === 401) {
        setKeadaanSkor("sesi-habis");
      } else {
        setKeadaanSkor("galat");
      }
    }
  }, []);

  useEffect(() => {
    if (statusMasuk !== "masuk") return;
    let aktif = true;
    void (async () => {
      if (aktif) await muatSkor();
    })();
    return () => {
      aktif = false;
    };
  }, [statusMasuk, muatSkor]);

  const panelMemuat =
    statusMasuk === "memeriksa" ||
    (statusMasuk === "masuk" && keadaanSkor === "memuat");

  return (
    <div className="pb-8">
      <section aria-label="Dokter HP" className="pt-4 sm:pt-6">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12">
          <header>
            <h1
              ref={judulRef}
              tabIndex={-1}
              className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl"
            >
              Dokter HP
            </h1>
            <p className="mt-4 text-xl font-medium leading-snug text-zinc-100">
              Cari tahu kenapa HP terasa bermasalah, lalu perbaiki.
            </p>
            <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-zinc-400">
              Periksa kondisi HP dari browser: kecepatan WiFi, baterai,
              penyimpanan, performa, dan keamanan. Tanpa memasang aplikasi.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/wifi" className={`${TAUTAN_UTAMA} w-full sm:w-auto`}>
                Coba tes WiFi tanpa akun
              </Link>
              <Link
                to="/masuk"
                className={`${TAUTAN_SEKUNDER} w-full sm:w-auto`}
              >
                Masuk / Daftar
              </Link>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Hasil tes tampil di layar, tetapi tidak tersimpan. Masuk untuk
              menyimpan riwayat.
            </p>
          </header>

          <Card
            padding="lg"
            aria-labelledby="skor-kesehatan"
            className="min-w-0"
          >
            <h2
              id="skor-kesehatan"
              className="text-lg font-semibold tracking-tight text-white"
            >
              Skor kesehatan HP
            </h2>

            {panelMemuat ? (
              <div className="mt-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <Skeleton width={160} height={160} rounded="full" />
                  <SkeletonText lines={3} className="flex-1" />
                </div>
                <p className="mt-4 text-sm text-zinc-400">Memuat…</p>
              </div>
            ) : statusMasuk === "tidak-masuk" ? (
              <div className="mt-4">
                <p className="text-sm leading-relaxed text-zinc-400">
                  Setiap pemeriksaan menghasilkan satu skor dari 0 sampai
                  100. Makin tinggi skornya, makin sehat kondisi HP.
                </p>
                <MeterStrip
                  className="mt-5"
                  ariaLabel="Skala skor 0 sampai 100: di bawah 50 bermasalah, 50 sampai 79 perlu diperhatikan, 80 sampai 100 baik"
                />
                <ul className="mt-4 space-y-2.5">
                  {SKALA.map((item) => (
                    <li
                      key={item.status}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <StatusBadge status={item.status} dot>
                        {labelStatus(item.status)}
                      </StatusBadge>
                      <span className="dh-numeric text-sm text-zinc-400">
                        {item.rentang}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm leading-relaxed text-zinc-400">
                  Skor HP Anda tampil di sini setelah masuk dan memeriksa HP.
                </p>
              </div>
            ) : keadaanSkor === "ada" && skor !== null ? (
              <div className="mt-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <ScoreRing skor={skor.skor} ukuran={160} />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-400">Skor terakhir Anda</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      Diperiksa {formatWaktu(skor.dibuat_pada)}
                    </p>
                    <Link
                      to="/dashboard"
                      className={`${TAUTAN_SEKUNDER} mt-4`}
                    >
                      Lihat dasbor
                    </Link>
                  </div>
                </div>
                <MeterStrip
                  className="mt-5"
                  value={skor.skor}
                  ariaLabel={`Skor Anda ${skor.skor} dari 100 pada skala 0 sampai 100`}
                />
              </div>
            ) : keadaanSkor === "kosong" ? (
              <div className="mt-4">
                <p className="text-base font-semibold text-white">
                  Belum ada pemeriksaan
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Jalankan pemeriksaan pertama untuk melihat skor HP di sini.
                </p>
                <Link to="/wifi" className={`${TAUTAN_UTAMA} mt-5`}>
                  Mulai dari tes WiFi
                </Link>
              </div>
            ) : keadaanSkor === "sesi-habis" ? (
              <div className="mt-4">
                <p className="text-base font-semibold text-white">
                  Sesi sudah berakhir
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Sesi sudah berakhir. Masuk lagi untuk lanjut.
                </p>
                <Link to="/masuk" className={`${TAUTAN_SEKUNDER} mt-5`}>
                  Masuk
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-base font-semibold text-white">
                  Skor tidak dapat dimuat
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Skor tidak dapat dimuat saat ini.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => void muatSkor()}
                  className="mt-5"
                >
                  Coba lagi
                </Button>
              </div>
            )}
          </Card>
        </div>
      </section>

      <section aria-labelledby="keunggulan" className="mt-14">
        <h2
          id="keunggulan"
          className="text-xl font-semibold tracking-tight text-white"
        >
          Yang bisa dilakukan di sini
        </h2>
        <ul className="mt-5 grid gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3">
          {KEUNGGULAN.map((item) => (
            <li
              key={item.judul}
              className="bg-[var(--color-surface)] px-5 py-5"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]"
                aria-hidden="true"
              >
                <item.ikon />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">
                {item.judul}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                {item.isi}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="batasan" className="mt-10">
        <Card padding="lg" status="info">
          <h2
            id="batasan"
            className="text-base font-semibold text-white"
          >
            Yang perlu diketahui
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            Versi web mengukur koneksi Anda; data baterai, penyimpanan, dan
            performa diisi manual atau dari riwayat aplikasi Dokter HP.
          </p>
        </Card>
      </section>

      <section aria-labelledby="panduan" className="mt-14">
        <h2
          id="panduan"
          className="text-xl font-semibold tracking-tight text-white"
        >
          Panduan perbaikan
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-zinc-400">
          Langkah demi langkah memperbaiki masalah HP yang paling sering
          terjadi. Semua panduan bisa dibaca tanpa masuk.
        </p>
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {PANDUAN.map((panduan, indeks) => (
            <li
              key={panduan.slug}
              className={indeks === 0 ? "lg:col-span-2" : ""}
            >
              <Link
                to={`/panduan/${panduan.slug}`}
                className="block h-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <span
                  className={`font-semibold text-white underline decoration-zinc-500 underline-offset-4 ${
                    indeks === 0 ? "text-lg" : "text-base"
                  }`}
                >
                  {panduan.judul}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                  {panduan.deskripsi}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="apk" className="mt-14">
        <Card padding="lg">
          <h2
            id="apk"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Butuh pembacaan langsung dari HP?
          </h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-zinc-400">
            Aplikasi Dokter HP di Android bisa membaca baterai, penyimpanan,
            dan performa langsung dari HP.
          </p>
          <a
            href="https://github.com/adiprmx/dokter-hp"
            target="_blank"
            rel="noreferrer"
            className={`${TAUTAN_SEKUNDER} mt-4`}
          >
            Lihat aplikasi Dokter HP untuk Android (membuka tab baru)
          </a>
        </Card>
      </section>

      <footer className="mt-14 border-t border-zinc-800 pt-6">
        <p className="max-w-[65ch] text-sm leading-relaxed text-zinc-400">
          Dokter HP tidak menjanjikan HP jadi lebih cepat. Aplikasi ini
          membantu menemukan masalah dan menunjukkan langkah perbaikannya.
        </p>
      </footer>
    </div>
  );
}
