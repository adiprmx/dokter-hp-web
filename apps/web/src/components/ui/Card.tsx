import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "md" | "lg" | "none";
  children: ReactNode;
}

const paddingClass = {
  md: "p-4",
  lg: "p-5",
  none: "p-0",
} as const;

// Kartu tanpa bingkai: pemisah dengan kanvas adalah langkah permukaan
// (#121215 di atas #000000). Bingkai Zinc 800 gagal batas komponen 3:1
// dan hanya boleh dipakai untuk garis dekoratif (a11y.md 4.4), jadi
// kartu tidak memakai bingkai sama sekali. Kartu yang bisa diketuk
// memakai bingkai Zinc 500 lewat className dari pemanggil.
export function Card({
  padding = "md",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-xl bg-[var(--color-surface)]",
        paddingClass[padding],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
