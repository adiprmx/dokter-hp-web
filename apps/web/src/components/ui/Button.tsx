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
  // Tombol utama: latar putih, teks hitam (21:1). Saat dinonaktifkan
  // teks tetap Zinc 400 di atas Zinc 800 (5,81:1), bukan opacity.
  primary:
    "bg-white text-black hover:bg-zinc-200 " +
    "disabled:bg-[#27272a] disabled:text-[#a1a1aa]",
  // Tombol sekunder dibedakan oleh bingkai Zinc 500 (4,35:1), bukan
  // hanya oleh warna, agar keadaan terbaca tanpa warna.
  secondary:
    "border border-[var(--color-border-strong)] bg-transparent " +
    "text-[var(--color-text-primary)] hover:bg-white/5 " +
    "disabled:border-[#27272a] disabled:text-[#a1a1aa]",
  // Tombol bahaya: bingkai dan teks merah, latar transparan. Bukan
  // teks putih di atas merah 500 (3,76:1, gagal).
  danger:
    "border border-[var(--color-error)] bg-transparent " +
    "text-[var(--color-error)] hover:bg-[var(--color-error-bg)] " +
    "disabled:border-[#27272a] disabled:text-[#a1a1aa]",
  ghost:
    "bg-transparent text-[var(--color-text-primary)] hover:bg-white/5 " +
    "disabled:text-[#a1a1aa]",
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
  return (
    <button
      type={type}
      disabled={busy}
      aria-busy={loading || undefined}
      className={[
        "inline-flex min-h-[48px] items-center justify-center gap-2",
        "rounded-lg px-5 text-base font-medium whitespace-nowrap",
        "transition-[background-color,transform] duration-150 ease-out",
        "active:scale-[0.98] disabled:cursor-not-allowed",
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
