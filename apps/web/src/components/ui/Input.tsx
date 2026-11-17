import { useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export function Input({
  label,
  helperText,
  error,
  id,
  required,
  className = "",
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helperText && !error ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-[var(--color-text-primary)]"
      >
        {label}
        {required ? (
          <span className="font-normal text-[var(--color-text-muted)]">
            {" "}
            (wajib diisi)
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          "min-h-[48px] w-full rounded-lg border bg-[var(--color-surface-raised)]",
          "px-4 text-base text-[var(--color-text-primary)]",
          "placeholder:text-[var(--color-text-placeholder)]",
          "transition-colors duration-150 ease-out",
          error
            ? "border-[var(--color-error)]"
            : "border-[var(--color-border-strong)] focus:border-white",
          className,
        ].join(" ")}
        {...rest}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          id={helperId}
          className="text-sm text-[var(--color-text-muted)]"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
