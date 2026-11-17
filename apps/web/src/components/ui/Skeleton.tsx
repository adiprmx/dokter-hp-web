export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: "md" | "lg" | "full";
  className?: string;
  label?: string;
}

const roundedClass = {
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
} as const;

// Blok kerangka muat. Bentuknya meniru tata letak akhir (lebar dan
// tinggi diisi pemanggil), jadi halaman tidak melompat saat data tiba.
// Teks "Memuat" disembunyikan secara visual tetapi dibaca pembaca
// layar lewat role status. Halaman tetap wajib menampilkan teks muat
// yang terlihat (misalnya "Memuat riwayat...") di samping kerangka.
export function Skeleton({
  width = "100%",
  height = 16,
  rounded = "md",
  className = "",
  label = "Memuat",
}: SkeletonProps) {
  return (
    <div
      role="status"
      className={["dh-skeleton", roundedClass[rounded], className].join(" ")}
      style={{ width, height }}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
  label = "Memuat",
}: {
  lines?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      className={["flex flex-col gap-3", className].join(" ")}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="dh-skeleton h-4 rounded-md"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}
