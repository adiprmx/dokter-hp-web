import type { ReactNode } from "react";

export type StatusKind = "success" | "error" | "warning" | "info" | "neutral";

export interface StatusBadgeProps {
  status: StatusKind;
  dot?: boolean;
  children: ReactNode;
}

const kindClass: Record<StatusKind, string> = {
  success:
    "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]",
  error:
    "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]",
  warning:
    "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  info:
    "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info)]",
  neutral:
    "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]",
};

// Cip status. Makna selalu dibawa oleh teks label, bukan hanya warna
// atau titik: titik hanya penanda tambahan untuk keadaan yang memang
// hidup (misalnya tes sedang berjalan) dan tidak pernah berdiri
// sendiri tanpa label. Cip ini label statis, bukan wilayah live;
// halaman mengumumkan perubahan status lewat LiveRegion (a11y.md 5.3).
export function StatusBadge({
  status,
  dot = false,
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border",
        "px-2.5 py-1 text-[13px] font-medium leading-none",
        kindClass[status],
      ].join(" ")}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: "currentColor" }}
        />
      ) : null}
      {children}
    </span>
  );
}
