import { useState, type ReactNode } from "react";
import {
  formatTanggalWaktu,
  labelStatus,
  labelSumber,
  type DoctorEntry,
} from "../../lib/doctor";
import {
  KELAS_TOMBOL_BAHAYA,
  KELAS_TOMBOL_SEKUNDER,
} from "./DoctorEntryForm";

export interface DoctorHistoryListProps<E extends DoctorEntry> {
  entri: E[];
  /** Isi detail tiap entri (nilai-nilai yang dicatat). */
  renderDetail: (entri: E) => ReactNode;
  /** Dipanggil saat pengguna mengonfirmasi hapus; melempar galat bila gagal. */
  onHapus: (id: string) => Promise<void>;
  /** Id entri yang sedang dihapus (tombolnya dinonaktifkan). */
  menghapusId: string | null;
}

const KELAS_CIP_STATUS: Record<string, string> = {
  baik: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]",
  cukup:
    "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  perlu_perhatian:
    "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]",
};

// Keadaan kosong yang jujur untuk layar dokter (pola yang sama dengan
// components/ui/EmptyState): judul + penjelasan + langkah berikutnya.
// Judul memakai <p> agar halaman yang menentukan hierarki heading.
export function DoctorEmptyState({
  judul,
  isi,
}: {
  judul: string;
  isi: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <p className="text-base font-semibold text-[var(--color-text-primary)]">
        {judul}
      </p>
      <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-[var(--color-text-muted)]">
        {isi}
      </p>
    </div>
  );
}

// Daftar riwayat bersama untuk keempat layar dokter: tanggal, sumber,
// status, detail, dan tombol hapus per entri. Hapus memakai konfirmasi
// dua langkah di tempat (Hapus -> Ya, hapus / Batal) agar tidak ada
// penghapusan yang tidak disengaja dan tidak perlu dialog modal.
// Nama tombol hapus menyebut tanggal entri (a11y.md 6.8).
export function DoctorHistoryList<E extends DoctorEntry>({
  entri,
  renderDetail,
  onHapus,
  menghapusId,
}: DoctorHistoryListProps<E>) {
  const [konfirmasiId, setKonfirmasiId] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-3">
      {entri.map((item) => {
        const tanggal = formatTanggalWaktu(item.dibuatPada);
        const sedangMenghapus = menghapusId === item.id;
        const menungguKonfirmasi = konfirmasiId === item.id;
        const kelasCip = item.status
          ? (KELAS_CIP_STATUS[item.status] ?? "")
          : "";
        return (
          <li
            key={item.id}
            className="rounded-xl bg-[var(--color-surface)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {tanggal}
                </p>
                <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                  {labelSumber(item.sumber)}
                </p>
              </div>
              {item.status ? (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${kelasCip}`}
                >
                  {labelStatus(item.status)}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-1 text-sm leading-relaxed text-[var(--color-text-primary)]">
              {renderDetail(item)}
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {menungguKonfirmasi ? (
                <>
                  <p className="w-full text-right text-sm text-[var(--color-text-muted)]">
                    Entri ini akan dihapus dari riwayat Anda.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onHapus(item.id);
                      } finally {
                        setKonfirmasiId(null);
                      }
                    }}
                    disabled={sedangMenghapus}
                    aria-busy={sedangMenghapus || undefined}
                    className={KELAS_TOMBOL_BAHAYA}
                  >
                    {sedangMenghapus ? "Menghapus…" : "Ya, hapus"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKonfirmasiId(null)}
                    disabled={sedangMenghapus}
                    className={KELAS_TOMBOL_SEKUNDER}
                  >
                    Batal
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setKonfirmasiId(item.id)}
                  disabled={sedangMenghapus}
                  aria-label={`Hapus catatan ${tanggal}`}
                  className={KELAS_TOMBOL_SEKUNDER}
                >
                  Hapus
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
