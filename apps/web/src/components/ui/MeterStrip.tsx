import {
  labelStatus,
  statusDariSkor,
  tokenStatus,
} from "../../lib/status-warna";

export interface MeterStripProps {
  value?: number | null;
  ticks?: number;
  className?: string;
  ariaLabel?: string;
}

const WIDTH = 200;
const HEIGHT = 16;

// Zona warna mengikuti ambang skor kanonis 80/50 (K-31): 0-49
// merah, 50-79 kuning, 80-100 hijau. Zona digambar sebagai SVG
// dari data (rect per zona, bukan repeating-linear-gradient;
// DESIGN_AUDIT §2), memakai tinta token 12% agar takik penggaris
// tetap terbaca di atasnya. Zona adalah ARTI skala, bukan hiasan:
// penanda nilai memakai warna status nilainya (via helper
// status-warna), dan label aria menyebut kategori statusnya.
const ZONA: Array<{ dari: number; sampai: number; isi: string }> = [
  { dari: 0, sampai: 50, isi: "var(--color-error-bg)" },
  { dari: 50, sampai: 80, isi: "var(--color-warning-bg)" },
  { dari: 80, sampai: 100, isi: "var(--color-success-bg)" },
];

// Motif strip meter: deretan takik penggaris sebagai identitas visual
// "Alat ukur". Takik digambar sebagai SVG dari data (bukan pola CSS),
// memakai Zinc 500 (4,35:1) agar lolos batas grafik 3:1.
// Tanpa nilai, strip ini dekoratif murni dan disembunyikan dari
// pembaca layar. Dengan nilai, strip ini grafik bermakna: memakai
// role img dan label ringkas, dan halaman tetap menampilkan nilai
// yang sama sebagai teks di dekatnya.
export function MeterStrip({
  value = null,
  ticks = 21,
  className = "",
  ariaLabel,
}: MeterStripProps) {
  const clamped =
    value === null ? null : Math.max(0, Math.min(100, value));
  const step = WIDTH / (ticks - 1);
  const decorative = clamped === null && !ariaLabel;
  const status = clamped === null ? null : statusDariSkor(clamped);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      preserveAspectRatio="none"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={
        decorative
          ? undefined
          : (ariaLabel ??
            (clamped === null || status === null
              ? "Strip meter"
              : `Nilai ${Math.round(clamped)} dari 100, ${labelStatus(status)}`))
      }
      className={className}
    >
      {ZONA.map((zona) => (
        <rect
          key={zona.dari}
          x={(zona.dari / 100) * WIDTH}
          y={0}
          width={((zona.sampai - zona.dari) / 100) * WIDTH}
          height={HEIGHT}
          fill={zona.isi}
        />
      ))}
      {Array.from({ length: ticks }, (_, i) => {
        const major = i % 5 === 0;
        const x = i * step;
        return (
          <line
            key={i}
            x1={x}
            y1={major ? 2 : 6}
            x2={x}
            y2={HEIGHT - 2}
            stroke="var(--color-border-strong)"
            strokeWidth="1"
          />
        );
      })}
      {clamped !== null && status !== null ? (
        <line
          x1={(clamped / 100) * WIDTH}
          y1={0}
          x2={(clamped / 100) * WIDTH}
          y2={HEIGHT}
          stroke={tokenStatus(status).teks}
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}
