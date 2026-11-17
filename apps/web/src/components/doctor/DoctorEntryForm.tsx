import {
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

// Kelas tombol bersama untuk layar dokter — disalin dari pola
// components/ui/Button (tombol utama putih, sekunder berbingkai
// Zinc 500) karena layar dokter tidak mengimpor dari components/ui/.
// Target sentuh minimal 48 px, kontras lolos WCAG AA (a11y.md 4).
export const KELAS_TOMBOL_PRIMER =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg " +
  "bg-white px-5 text-base font-medium text-black " +
  "transition-[background-color,transform] duration-150 ease-out " +
  "hover:bg-zinc-200 active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:bg-[#27272a] " +
  "disabled:text-[#a1a1aa] disabled:active:scale-100";

export const KELAS_TOMBOL_SEKUNDER =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg " +
  "border border-[var(--color-border-strong)] bg-transparent px-5 " +
  "text-base font-medium text-[var(--color-text-primary)] " +
  "transition-[background-color,transform] duration-150 ease-out " +
  "hover:bg-white/5 active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:border-[#27272a] " +
  "disabled:text-[#a1a1aa] disabled:active:scale-100";

export const KELAS_TOMBOL_BAHAYA =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg " +
  "border border-[var(--color-error)] bg-transparent px-5 " +
  "text-base font-medium text-[var(--color-error)] " +
  "transition-[background-color,transform] duration-150 ease-out " +
  "hover:bg-[var(--color-error-bg)] active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:border-[#27272a] " +
  "disabled:text-[#a1a1aa] disabled:active:scale-100";

export type DoctorFieldType =
  | "number"
  | "text"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox";

export interface DoctorFieldOption {
  value: string;
  label: string;
}

export interface DoctorField {
  name: string;
  label: string;
  type: DoctorFieldType;
  required?: boolean;
  helperText?: string;
  placeholder?: string;
  options?: DoctorFieldOption[];
  /** Pengelompokan visual: field pertama suatu bagian menampilkan judul bagian. */
  bagian?: string;
  inputMode?: "numeric" | "decimal" | "text";
}

/** Nilai mentah formulir: teks untuk semua field kecuali checkbox (boolean). */
export type DoctorFormValues = Record<string, string | boolean>;

export interface DoctorEntryFormProps {
  /** Awalan id agar id input unik bila ada beberapa formulir di satu halaman. */
  idFormulir: string;
  judul: string;
  deskripsi?: string;
  fields: DoctorField[];
  /** Validasi nilai mentah; mengembalikan peta nama field -> pesan galat. */
  validate: (values: DoctorFormValues) => Record<string, string>;
  /**
   * Dipanggil dengan nilai yang sudah lolos validasi. Wajib melempar
   * galat bila penyimpanan gagal (halaman menampilkan pesannya dan
   * formulir mempertahankan isian); bila berhasil, formulir
   * mengosongkan isian sendiri.
   */
  onSubmit: (values: DoctorFormValues) => Promise<void>;
  labelSimpan?: string;
  /** Konten tambahan yang mengikuti nilai formulir (misalnya perkiraan waktu pakai). */
  infoDinamis?: (values: DoctorFormValues) => ReactNode;
  onBatal?: () => void;
}

function nilaiAwal(fields: DoctorField[]): DoctorFormValues {
  const awal: DoctorFormValues = {};
  for (const field of fields) {
    awal[field.name] = field.type === "checkbox" ? false : "";
  }
  return awal;
}

function nilaiTeks(values: DoctorFormValues, name: string): string {
  const nilai = values[name];
  return typeof nilai === "string" ? nilai : "";
}

function nilaiCentang(values: DoctorFormValues, name: string): boolean {
  return values[name] === true;
}

const KELAS_INPUT =
  "min-h-[48px] w-full rounded-lg border bg-[var(--color-surface-raised)] " +
  "px-4 text-base text-[var(--color-text-primary)] " +
  "placeholder:text-[var(--color-text-placeholder)] " +
  "transition-colors duration-150 ease-out";

// Formulir entri riwayat bersama untuk keempat layar dokter.
// Setiap input punya label terlihat, pesan galat berupa teks di bawah
// input yang salah (aria-invalid + aria-describedby), dan fokus
// dipindahkan ke galat pertama saat pengiriman gagal (a11y.md 3.4).
export function DoctorEntryForm({
  idFormulir,
  judul,
  deskripsi,
  fields,
  validate,
  onSubmit,
  labelSimpan = "Simpan",
  infoDinamis,
  onBatal,
}: DoctorEntryFormProps) {
  const unik = useId();
  const [values, setValues] = useState<DoctorFormValues>(() =>
    nilaiAwal(fields),
  );
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [statusSimpan, setStatusSimpan] = useState("");

  const idField = (name: string) => `${idFormulir}-${name}-${unik}`;

  function ubahNilai(name: string, nilai: string | boolean) {
    setValues((sebelum) => ({ ...sebelum, [name]: nilai }));
    // Galat field hilang begitu pengguna memperbaikinya.
    setGalat((sebelum) => {
      if (!(name in sebelum)) return sebelum;
      const salinan = { ...sebelum };
      delete salinan[name];
      return salinan;
    });
  }

  function fokusKeGalatPertama(petaGalat: Record<string, string>) {
    for (const field of fields) {
      if (!(field.name in petaGalat)) continue;
      let idTarget = idField(field.name);
      if (field.type === "radio" && field.options && field.options.length > 0) {
        idTarget = `${idTarget}-${field.options[0].value}`;
      }
      document.getElementById(idTarget)?.focus();
      return;
    }
  }

  async function kirim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (menyimpan) return;
    const petaGalat = validate(values);
    setGalat(petaGalat);
    if (Object.keys(petaGalat).length > 0) {
      fokusKeGalatPertama(petaGalat);
      return;
    }
    setMenyimpan(true);
    setStatusSimpan("Menyimpan…");
    try {
      await onSubmit(values);
      setValues(nilaiAwal(fields));
      setGalat({});
      setStatusSimpan("");
    } catch {
      // Halaman menampilkan pesan galatnya sendiri; isian dipertahankan
      // agar pengguna tidak perlu mengetik ulang.
      setStatusSimpan("");
    } finally {
      setMenyimpan(false);
    }
  }

  let bagianTerakhir: string | undefined;

  return (
    <form
      onSubmit={kirim}
      noValidate
      aria-labelledby={`${idFormulir}-judul`}
      className="flex flex-col gap-5"
    >
      <div>
        <p
          id={`${idFormulir}-judul`}
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          {judul}
        </p>
        {deskripsi ? (
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
            {deskripsi}
          </p>
        ) : null}
      </div>

      {fields.map((field) => {
        const id = idField(field.name);
        const pesanGalat = galat[field.name];
        const idGalat = pesanGalat ? `${id}-error` : undefined;
        const idBantuan =
          field.helperText && !pesanGalat ? `${id}-helper` : undefined;
        const describedBy =
          [idBantuan, idGalat].filter(Boolean).join(" ") || undefined;
        const kelasBingkai = pesanGalat
          ? "border-[var(--color-error)]"
          : "border-[var(--color-border-strong)] focus:border-white";

        const judulBagian =
          field.bagian && field.bagian !== bagianTerakhir ? (
            <p
              key={`${field.name}-bagian`}
              className="pt-2 text-sm font-semibold text-[var(--color-text-primary)]"
            >
              {field.bagian}
            </p>
          ) : null;
        bagianTerakhir = field.bagian;

        const isi = (() => {
          switch (field.type) {
            case "textarea":
              return (
                <div key={field.name} className="flex flex-col gap-2">
                  <label
                    htmlFor={id}
                    className="text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {field.label}
                    {field.required ? (
                      <span className="font-normal text-[var(--color-text-muted)]">
                        {" "}
                        (wajib diisi)
                      </span>
                    ) : null}
                  </label>
                  <textarea
                    id={id}
                    rows={3}
                    value={nilaiTeks(values, field.name)}
                    onChange={(event) =>
                      ubahNilai(field.name, event.target.value)
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                    aria-invalid={pesanGalat ? true : undefined}
                    aria-describedby={describedBy}
                    className={`${KELAS_INPUT} py-3 ${kelasBingkai}`}
                  />
                  {pesanGalat ? (
                    <p
                      id={idGalat}
                      role="alert"
                      className="text-sm text-[var(--color-error)]"
                    >
                      {pesanGalat}
                    </p>
                  ) : field.helperText ? (
                    <p
                      id={idBantuan}
                      className="text-sm text-[var(--color-text-muted)]"
                    >
                      {field.helperText}
                    </p>
                  ) : null}
                </div>
              );
            case "select":
              return (
                <div key={field.name} className="flex flex-col gap-2">
                  <label
                    htmlFor={id}
                    className="text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {field.label}
                    {field.required ? (
                      <span className="font-normal text-[var(--color-text-muted)]">
                        {" "}
                        (wajib diisi)
                      </span>
                    ) : null}
                  </label>
                  <select
                    id={id}
                    value={nilaiTeks(values, field.name)}
                    onChange={(event) =>
                      ubahNilai(field.name, event.target.value)
                    }
                    required={field.required}
                    aria-invalid={pesanGalat ? true : undefined}
                    aria-describedby={describedBy}
                    className={`${KELAS_INPUT} ${kelasBingkai}`}
                  >
                    <option value="">Pilih…</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {pesanGalat ? (
                    <p
                      id={idGalat}
                      role="alert"
                      className="text-sm text-[var(--color-error)]"
                    >
                      {pesanGalat}
                    </p>
                  ) : field.helperText ? (
                    <p
                      id={idBantuan}
                      className="text-sm text-[var(--color-text-muted)]"
                    >
                      {field.helperText}
                    </p>
                  ) : null}
                </div>
              );
            case "radio":
              return (
                <fieldset key={field.name} className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-[var(--color-text-primary)]">
                    {field.label}
                    {field.required ? (
                      <span className="font-normal text-[var(--color-text-muted)]">
                        {" "}
                        (wajib diisi)
                      </span>
                    ) : null}
                  </legend>
                  <div className="flex flex-col gap-2">
                    {(field.options ?? []).map((option) => {
                      const idOpsi = `${id}-${option.value}`;
                      const terpilih =
                        nilaiTeks(values, field.name) === option.value;
                      return (
                        <label
                          key={option.value}
                          htmlFor={idOpsi}
                          className={[
                            "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border px-4",
                            terpilih
                              ? "border-white bg-white/5"
                              : "border-[var(--color-border-strong)]",
                          ].join(" ")}
                        >
                          <input
                            id={idOpsi}
                            type="radio"
                            name={id}
                            value={option.value}
                            checked={terpilih}
                            onChange={() =>
                              ubahNilai(field.name, option.value)
                            }
                            aria-invalid={pesanGalat ? true : undefined}
                            aria-describedby={describedBy}
                            className="h-5 w-5 shrink-0 accent-white"
                          />
                          <span className="text-base text-[var(--color-text-primary)]">
                            {option.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {pesanGalat ? (
                    <p
                      id={idGalat}
                      role="alert"
                      className="text-sm text-[var(--color-error)]"
                    >
                      {pesanGalat}
                    </p>
                  ) : field.helperText ? (
                    <p
                      id={idBantuan}
                      className="text-sm text-[var(--color-text-muted)]"
                    >
                      {field.helperText}
                    </p>
                  ) : null}
                </fieldset>
              );
            case "checkbox":
              return (
                <div key={field.name} className="flex flex-col gap-2">
                  <label
                    htmlFor={id}
                    className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border-strong)] px-4"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={nilaiCentang(values, field.name)}
                      onChange={(event) =>
                        ubahNilai(field.name, event.target.checked)
                      }
                      aria-describedby={describedBy}
                      className="h-5 w-5 shrink-0 accent-white"
                    />
                    <span className="text-base text-[var(--color-text-primary)]">
                      {field.label}
                    </span>
                  </label>
                  {field.helperText ? (
                    <p
                      id={idBantuan}
                      className="text-sm text-[var(--color-text-muted)]"
                    >
                      {field.helperText}
                    </p>
                  ) : null}
                </div>
              );
            default:
              return (
                <div key={field.name} className="flex flex-col gap-2">
                  <label
                    htmlFor={id}
                    className="text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {field.label}
                    {field.required ? (
                      <span className="font-normal text-[var(--color-text-muted)]">
                        {" "}
                        (wajib diisi)
                      </span>
                    ) : null}
                  </label>
                  <input
                    id={id}
                    type="text"
                    inputMode={
                      field.inputMode ??
                      (field.type === "number" ? "decimal" : "text")
                    }
                    autoComplete="off"
                    value={nilaiTeks(values, field.name)}
                    onChange={(event) =>
                      ubahNilai(field.name, event.target.value)
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                    aria-invalid={pesanGalat ? true : undefined}
                    aria-describedby={describedBy}
                    className={`${KELAS_INPUT} ${kelasBingkai}`}
                  />
                  {pesanGalat ? (
                    <p
                      id={idGalat}
                      role="alert"
                      className="text-sm text-[var(--color-error)]"
                    >
                      {pesanGalat}
                    </p>
                  ) : field.helperText ? (
                    <p
                      id={idBantuan}
                      className="text-sm text-[var(--color-text-muted)]"
                    >
                      {field.helperText}
                    </p>
                  ) : null}
                </div>
              );
          }
        })();

        return (
          <div key={`bungkus-${field.name}`} className="flex flex-col gap-5">
            {judulBagian}
            {isi}
          </div>
        );
      })}

      {infoDinamis ? infoDinamis(values) : null}

      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        aria-atomic="true"
      >
        {statusSimpan}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={menyimpan}
          aria-busy={menyimpan || undefined}
          className={`${KELAS_TOMBOL_PRIMER} sm:flex-1`}
        >
          {menyimpan ? "Menyimpan…" : labelSimpan}
        </button>
        {onBatal ? (
          <button
            type="button"
            onClick={onBatal}
            disabled={menyimpan}
            className={`${KELAS_TOMBOL_SEKUNDER} sm:flex-1`}
          >
            Batal
          </button>
        ) : null}
      </div>
    </form>
  );
}
