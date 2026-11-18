import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  // Tombol utama: latar putih, teks hitam (21:1). Hierarki tertinggi
  // di halaman; hanya satu aksi utama per layar memakai varian ini.
  // Nonaktif memakai gaya eksplisit (K-53): latar + teks lewat token
  // --color-surface-hover / --color-text-disabled (Zinc 800 / Zinc 400,
  // 5,81:1), bukan kelas opasitas dan bukan hex mentah.
  primary:
    "bg-white text-black hover:bg-zinc-200 " +
    "disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-disabled)]",
  // Tombol sekunder dibedakan oleh bingkai Zinc 500 (4,35:1), bukan
  // hanya oleh warna, agar keadaan terbaca tanpa warna.
  secondary:
    "border border-[var(--color-border-strong)] bg-transparent " +
    "text-[var(--color-text-primary)] hover:bg-white/5 " +
    "disabled:border-[var(--color-surface-hover)] disabled:text-[var(--color-text-disabled)]",
  // Tombol bahaya v2.0: merah SOLID + teks putih (4,83:1, lolos AA)
  // agar aksi merusak terbaca sekilas sebagai aksi berbahaya, bukan
  // sekadar teks merah. Hover menggelapkan (brightness-90) sehingga
  // kontras justru naik; varian disabled menimpa brightness kembali
  // ke 100 agar tombol nonaktif tidak ikut bereaksi saat disentuh.
  // Teks putih di merah 500 (3,76:1) tetap dilarang (K-11): yang
  // dipakai solid merah 600 dari token.
  danger:
    "bg-[var(--color-error-solid)] text-white hover:brightness-90 " +
    "disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-disabled)] disabled:brightness-100",
  // Tombol hantu: tanpa latar dan bingkai, untuk aksi tersier.
  // Tetap punya area sentuh 48 px dan fokus putih yang sama.
  ghost:
    "bg-transparent text-[var(--color-text-primary)] hover:bg-white/5 " +
    "disabled:text-[var(--color-text-disabled)]",
};

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const busy = loading || disabled;
  // Fokus keyboard: garis luar putih 2 px dari aturan global
  // :focus-visible di styles/tokens.css (a11y.md 3.2). Tidak
  // diduplikasi di sini agar satu sumber kebenaran.
  return (
    <button
      type={type}
      disabled={busy}
      aria-busy={loading || undefined}
      className={[
        "inline-flex min-h-[48px] items-center justify-center gap-2",
        "rounded-lg px-5 text-base font-medium whitespace-nowrap",
        "transition-[background-color,transform,filter] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "active:scale-[0.97] disabled:cursor-not-allowed",
        "disabled:active:scale-100",
        fullWidth ? "w-full" : "",
        variantClass[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <svg
          className="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="3"
          />
          <path
            d="M22 12a10 10 0 0 0-10-10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
