import type { ReactNode } from "react";
import { tokenStatus, type StatusWarna } from "../../lib/status-warna";

export interface StatusBadgeProps {
  /** Keadaan status kanonis (satu kosakata dengan Card + helper status-warna, K-95). */
  status: StatusWarna;
  dot?: boolean;
  children: ReactNode;
}

// Cip status. Makna selalu dibawa oleh teks label, bukan hanya warna
// atau titik: titik hanya penanda tambahan untuk keadaan yang memang
// hidup (misalnya tes sedang berjalan) dan tidak pernah berdiri
// sendiri tanpa label. Ukuran pil konsisten di semua varian
// (tinggi 28 px, teks 13 px, label satu baris) agar cip sejajar
// rapi saat berdampingan di daftar. Cip ini label statis, bukan
// wilayah live; halaman mengumumkan perubahan status lewat
// LiveRegion (a11y.md 5.3).
export function StatusBadge({
  status,
  dot = false,
  children,
}: StatusBadgeProps) {
  const token = tokenStatus(status);
  return (
    <span
      className={[
        "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border",
        "px-2.5 py-1 text-[13px] font-medium leading-none whitespace-nowrap",
      ].join(" ")}
      style={{
        backgroundColor: token.latar,
        borderColor: token.bingkai,
        color: token.teks,
      }}
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
