// components/charts/StorageBar.tsx — Bilah pemakaian penyimpanan.
//
// Dipakai di /penyimpanan (Tim Penyimpanan) untuk entri riwayat
// penyimpanan. Nilai masuk dalam byte; pemformatan memakai formatBytes
// dari lib/format.ts.
//
// Aksesibilitas (a11y.md 6.4): nilai persen dan angka tampil sebagai teks;
// bilah memakai role="progressbar" dengan aria-valuenow/min/max dan
// aria-label yang menjelaskan.
//
// Warna bilah (ambang didokumentasikan di sini; bukan dari kontrak API):
// di bawah 80% putih (netral), 80-89% kuning (waspada), 90% ke atas merah
// (hampir penuh) beserta pesan peringatan dari docs/copy.md §7.

import { formatBytes } from "../../lib/format";

export interface StorageBarProps {
  /** Byte yang terpakai. */
  terpakai: number;
  /** Total byte penyimpanan. */
  total: number;
  /** Label bilah untuk pembaca layar; default "Penyimpanan terpakai". */
  label?: string;
}

function warnaBilah(persen: number): string {
  if (persen >= 90) return "var(--color-error)";
  if (persen >= 80) return "var(--color-warning)";
  return "#ffffff";
}

export function StorageBar({
  terpakai,
  total,
  label = "Penyimpanan terpakai",
}: StorageBarProps) {
  const valid =
    Number.isFinite(terpakai) && Number.isFinite(total) && total > 0 && terpakai >= 0;

  if (!valid) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Pemakaian penyimpanan tidak tersedia.
      </p>
    );
  }

  const persen = Math.max(0, Math.min(100, Math.round((terpakai / total) * 100)));
  const warna = warnaBilah(persen);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-[var(--color-text-primary)]">
          {formatBytes(terpakai)} dari {formatBytes(total)} terpakai
        </p>
        <p className="dh-numeric shrink-0 text-sm font-medium text-[var(--color-text-primary)]">
          {persen}%
        </p>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--color-surface-raised)]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={persen}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${persen}%`, backgroundColor: warna }}
        />
      </div>
      {persen >= 90 ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          Penyimpanan hampir penuh. HP bisa terasa berat bila ruang kosong
          tinggal sedikit. Hapus file atau aplikasi yang tidak dipakai lagi.
        </p>
      ) : null}
    </div>
  );
}
