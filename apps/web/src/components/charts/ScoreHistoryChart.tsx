// components/charts/ScoreHistoryChart.tsx — Grafik garis riwayat skor (SVG murni).
//
// Dipakai di dashboard untuk 30 pemeriksaan terakhir. Tanpa library grafik
// (docs/performance.md 3.2: bila library grafik melebihi 30 KB gzip, pakai
// SVG murni). Sumbu tegak selalu 0-100 karena skor memang 0-100; sumbu
// mendatar adalah urutan waktu dari yang terlama ke yang terbaru.
//
// Aksesibilitas (a11y.md 6.4): grafik bukan satu-satunya cara membaca data —
// tersedia ringkasan teks yang terlihat DAN tabel data sr-only berisi
// tanggal + skor yang sama isinya. SVG memakai role="img" dengan aria-label
// yang meringkas data. Label sumbu memakai Zinc 400 (lolos 4,5:1); garis
// putih di atas kartu lolos 3:1 untuk komponen non-teks.
//
// Warna (redesign v2.0 §4/§9): zona latar menandai pita kategori skor
// (80-100 hijau, 50-79 kuning, 0-49 merah — ambang kanonis 80/50 dari
// lib/skor.ts via helper status-warna); tiap titik berwarna sesuai
// kategorinya, dan tiap ruas garis berwarna sesuai titik tujuannya.
// Warna selalu berpasangan dengan angka skor berteks di ringkasan dan
// tabel, bukan hanya warna.

import { statusDariSkor, tokenStatus } from "../../lib/status-warna";

export interface TitikSkor {
  /** Tanggal pemeriksaan, ISO 8601 (kolom dibuat_pada dari API). */
  tanggal: string;
  /** Skor 0-100. */
  skor: number;
}

export interface ScoreHistoryChartProps {
  /** Titik riwayat, urutan apa pun — komponen mengurutkan dari yang terlama. */
  data: TitikSkor[];
}

const LEBAR = 320;
const TINGGI = 180;
const PAD_KIRI = 30;
const PAD_KANAN = 8;
const PAD_ATAS = 10;
const PAD_BAWAH = 24;

const formatTanggalSingkat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});
const formatTanggalPanjang = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatTanggal(iso: string, pemformat: Intl.DateTimeFormat): string {
  const tanggal = new Date(iso);
  return Number.isNaN(tanggal.getTime())
    ? "tidak tersedia"
    : pemformat.format(tanggal);
}

export function ScoreHistoryChart({ data }: ScoreHistoryChartProps) {
  const titik = [...data]
    .filter((d) => Number.isFinite(d.skor))
    .sort(
      (a, b) =>
        new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime(),
    );

  if (titik.length === 0) {
    return (
      <div>
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          Belum ada data pemeriksaan
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          Jalankan diagnosis satu ketuk untuk melihat perkembangan skor dari
          waktu ke waktu.
        </p>
      </div>
    );
  }

  const nilaiSkor = titik.map((t) => t.skor);
  const skorMin = Math.min(...nilaiSkor);
  const skorMaks = Math.max(...nilaiSkor);
  const terakhir = titik[titik.length - 1];

  const lebarGrafik = LEBAR - PAD_KIRI - PAD_KANAN;
  const tinggiGrafik = TINGGI - PAD_ATAS - PAD_BAWAH;
  const posisiX = (indeks: number) =>
    PAD_KIRI +
    (titik.length === 1
      ? lebarGrafik / 2
      : (indeks / (titik.length - 1)) * lebarGrafik);
  const posisiY = (skor: number) =>
    PAD_ATAS +
    tinggiGrafik -
    (Math.max(0, Math.min(100, skor)) / 100) * tinggiGrafik;

  // Warna tiap titik dari kategorinya (helper status-warna, ambang 80/50).
  const warnaTitik = titik.map(
    (t) => tokenStatus(statusDariSkor(t.skor)).teks,
  );

  const ringkasan = `Grafik skor ${titik.length} pemeriksaan terakhir, dari ${skorMin} sampai ${skorMaks}. Skor terakhir ${terakhir.skor} pada ${formatTanggal(terakhir.tanggal, formatTanggalPanjang)}.`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${LEBAR} ${TINGGI}`}
        className="h-auto w-full"
        role="img"
        aria-label={ringkasan}
      >
        {/* Zona pita kategori skor: 80-100 baik, 50-79 cukup, 0-49 buruk. */}
        <rect
          x={PAD_KIRI}
          y={posisiY(100)}
          width={lebarGrafik}
          height={posisiY(80) - posisiY(100)}
          fill="var(--color-success-bg)"
        />
        <rect
          x={PAD_KIRI}
          y={posisiY(80)}
          width={lebarGrafik}
          height={posisiY(50) - posisiY(80)}
          fill="var(--color-warning-bg)"
        />
        <rect
          x={PAD_KIRI}
          y={posisiY(50)}
          width={lebarGrafik}
          height={posisiY(0) - posisiY(50)}
          fill="var(--color-error-bg)"
        />
        {[0, 50, 80, 100].map((nilai) => (
          <g key={nilai}>
            <line
              x1={PAD_KIRI}
              x2={LEBAR - PAD_KANAN}
              y1={posisiY(nilai)}
              y2={posisiY(nilai)}
              stroke={
                nilai === 80
                  ? "var(--color-border-strong)"
                  : "var(--color-border)"
              }
              strokeWidth="1"
              strokeDasharray={nilai === 80 ? "4 3" : undefined}
            />
            <text
              x={PAD_KIRI - 6}
              y={posisiY(nilai) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--color-text-muted)"
            >
              {nilai}
            </text>
          </g>
        ))}
        {/* Ruas garis per segmen, berwarna sesuai titik tujuannya. */}
        {titik.map((t, i) =>
          i === 0 ? null : (
            <line
              key={`ruas-${i}`}
              x1={posisiX(i - 1)}
              y1={posisiY(titik[i - 1].skor)}
              x2={posisiX(i)}
              y2={posisiY(t.skor)}
              stroke={warnaTitik[i]}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ),
        )}
        {titik.map((t, i) => (
          <circle
            key={`${t.tanggal}-${i}`}
            cx={posisiX(i)}
            cy={posisiY(t.skor)}
            r="3"
            fill={warnaTitik[i]}
            stroke="var(--color-bg)"
            strokeWidth="1"
          />
        ))}
        <text
          x={posisiX(0)}
          y={TINGGI - 6}
          textAnchor={titik.length === 1 ? "middle" : "start"}
          fontSize={11}
          fill="var(--color-text-muted)"
        >
          {formatTanggal(titik[0].tanggal, formatTanggalSingkat)}
        </text>
        {titik.length > 1 ? (
          <text
            x={posisiX(titik.length - 1)}
            y={TINGGI - 6}
            textAnchor="end"
            fontSize={11}
            fill="var(--color-text-muted)"
          >
            {formatTanggal(terakhir.tanggal, formatTanggalSingkat)}
          </text>
        ) : null}
      </svg>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {ringkasan}
      </p>
      <table className="sr-only">
        <caption>Riwayat skor</caption>
        <thead>
          <tr>
            <th scope="col">Tanggal</th>
            <th scope="col">Skor</th>
          </tr>
        </thead>
        <tbody>
          {titik.map((t, i) => (
            <tr key={`${t.tanggal}-${i}`}>
              <td>{formatTanggal(t.tanggal, formatTanggalPanjang)}</td>
              <td>{t.skor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
