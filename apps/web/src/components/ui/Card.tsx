import type { HTMLAttributes, ReactNode } from "react";
import { tokenStatus, type StatusWarna } from "../../lib/status-warna";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "md" | "lg" | "none";
  /**
   * Keadaan kartu. Bila diisi (selain "netral"), kartu memakai tinta
   * latar + bingkai warna status dari helper status-warna. Aksen
   * ini BERMAKNA karena menandai keadaan isi kartu (misalnya hasil
   * pemeriksaan yang bermasalah), bukan hiasan. Bukan garis warna
   * di tepi kiri (larangan craft-floor/antislop): seluruh permukaan
   * kartu yang bertinta, dan halaman tetap WAJIB menampilkan label
   * teks status di dalam kartu (warna tidak pernah berdiri sendiri).
   */
  status?: StatusWarna;
  children: ReactNode;
}

const paddingClass = {
  md: "p-4",
  lg: "p-5",
  none: "p-0",
} as const;

// Kartu netral tanpa bingkai: pemisah dengan kanvas adalah langkah
// permukaan (#121215 di atas #000000). Bingkai Zinc 800 gagal batas
// komponen 3:1 dan hanya boleh dipakai untuk garis dekoratif
// (a11y.md 4.4), jadi kartu netral tidak memakai bingkai sama sekali.
// Kartu yang bisa diketuk memakai bingkai Zinc 500 lewat className
// dari pemanggil. Kartu status memakai bingkai token status (45%)
// yang menandai keadaan, bukan batas komponen interaktif.
export function Card({
  padding = "md",
  status,
  className = "",
  children,
  style,
  ...rest
}: CardProps) {
  const bermakna = status !== undefined && status !== "netral";
  const token = bermakna ? tokenStatus(status) : null;
  return (
    <div
      className={[
        "rounded-xl bg-[var(--color-surface)]",
        bermakna ? "border" : "",
        paddingClass[padding],
        className,
      ].join(" ")}
      style={
        token
          ? {
              backgroundColor: token.latar,
              borderColor: token.bingkai,
              ...style,
            }
          : style
      }
      {...rest}
    >
      {children}
    </div>
  );
}
