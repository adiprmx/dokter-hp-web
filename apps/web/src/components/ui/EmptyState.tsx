import type { ReactNode } from "react";

// Ikon bawaan keadaan kosong: lingkaran + garis datar ("tidak ada
// isi di sini"). Geometri SVG tajam, bukan ilustrasi sketsa; proyek
// tidak memakai pustaka ikon (tanpa dependensi baru) dan ikon ini
// mengikuti konvensi SVG inline komponen lain (spinner Button,
// takik MeterStrip). Netral (Zinc 400), bukan warna status: keadaan
// kosong bukan galat maupun sukses.
function IkonKosong() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="2" />
      <line
        x1="8"
        y1="14"
        x2="20"
        y2="14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

// Keadaan kosong yang jujur dan DIRANCANG: wadah permukaan kartu
// dengan ikon di sumur lingkaran, judul, penjelasan, dan aksi.
// Bukan halaman kosong. Judul dan penjelasan menyebut penyebab dan
// langkah berikutnya, bukan sekadar "tidak ada data". Judul memakai
// <p> agar pemanggil yang menentukan hierarki heading halaman.
// Ikon bersifat dekoratif dan disembunyikan dari pembaca layar;
// bila pemanggil tidak memberi ikon, ikon netral bawaan dipakai.
export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
        aria-hidden="true"
      >
        {icon ?? <IkonKosong />}
      </div>
      <p className="text-base font-semibold text-[var(--color-text-primary)]">
        {title}
      </p>
      <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-[var(--color-text-muted)]">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
