import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

// Keadaan kosong yang jujur: judul dan penjelasan menyebut penyebab
// dan langkah berikutnya, bukan sekadar "tidak ada data". Judul
// memakai <p> agar pemanggil yang menentukan hierarki heading halaman.
// Ikon bersifat dekoratif dan disembunyikan dari pembaca layar.
export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? (
        <div
          className="mb-4 text-[var(--color-text-muted)]"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
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
