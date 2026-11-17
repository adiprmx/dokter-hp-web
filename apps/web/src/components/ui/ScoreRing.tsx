export type ScoreCategory = "baik" | "cukup" | "perlu-perhatian";

export function getScoreCategory(score: number): ScoreCategory {
  if (score >= 80) return "baik";
  if (score >= 60) return "cukup";
  return "perlu-perhatian";
}

const categoryLabel: Record<ScoreCategory, string> = {
  baik: "Baik",
  cukup: "Cukup",
  "perlu-perhatian": "Perlu perhatian",
};

const categoryColor: Record<ScoreCategory, string> = {
  baik: "var(--color-success)",
  cukup: "var(--color-warning)",
  "perlu-perhatian": "var(--color-error)",
};

export interface ScoreRingProps {
  score: number | null;
  size?: number;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Cincin skor 0-100. SVG cincin disembunyikan dari pembaca layar
// (a11y.md 6.4): angka dan kategori dibaca sebagai teks biasa, dan
// kategori selalu berupa label teks, bukan hanya warna cincin.
// Skor null berarti belum ada data: tampil "tidak tersedia", bukan 0.
export function ScoreRing({ score, size = 128 }: ScoreRingProps) {
  const clamped =
    score === null ? null : Math.max(0, Math.min(100, Math.round(score)));
  const category = clamped === null ? null : getScoreCategory(clamped);
  const color = category === null ? null : categoryColor[category];
  const label = category === null ? null : categoryLabel[category];
  const progress = clamped === null ? 0 : clamped / 100;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="10"
        />
        {clamped !== null && color !== null ? (
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            style={{ transition: "stroke-dashoffset 600ms ease-out" }}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {clamped === null ? (
          <span className="px-2 text-center text-sm text-[var(--color-text-muted)]">
            tidak tersedia
          </span>
        ) : (
          <>
            <span className="dh-numeric text-3xl font-semibold leading-none text-[var(--color-text-primary)]">
              {clamped}
            </span>
            <span
              className="mt-1 text-[13px] font-medium"
              style={{ color: color ?? undefined }}
            >
              {label}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
