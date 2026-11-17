export interface MeterStripProps {
  value?: number | null;
  ticks?: number;
  className?: string;
  ariaLabel?: string;
}

const WIDTH = 200;
const HEIGHT = 16;

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
            (clamped === null
              ? "Strip meter"
              : `Nilai ${Math.round(clamped)} dari 100`))
      }
      className={className}
    >
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
      {clamped !== null ? (
        <line
          x1={(clamped / 100) * WIDTH}
          y1={0}
          x2={(clamped / 100) * WIDTH}
          y2={HEIGHT}
          stroke="#ffffff"
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}
