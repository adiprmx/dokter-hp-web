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
// Warna bilah (redesign v2.0 §4/§9): ambang diambil dari klasifikasi
// yang SAMA dipakai halaman Penyimpanan (lib/doctor.ts
// klasifikasiPenyimpanan — satu sumber, agar bilah dan halaman tidak
// pernah berbeda arti): di bawah 70% hijau (longgar), 70-90% kuning
// (mulai penuh), di atas 90% merah (hampir penuh) beserta pesan
// peringatan dari docs/copy.md §7. Warna selalu berpasangan dengan
// label status berteks di samping persen.
//
// Gerak (spec §6, MOTION 2): bilah mengisi dari kosong saat tampil —
// momen "hasil pengukuran tiba". Durasi + easing dari token;
// prefers-reduced-motion dipersingkat sampai instan oleh tokens.css.

import { useEffect, useState } from "react";
import { klasifikasiPenyimpanan, type DoctorStatus } from "../../lib/doctor";
import { formatBytes } from "../../lib/format";
import { tokenStatus, statusDariDoctor } from "../../lib/status-warna";

export interface StorageBarProps {
  /** Byte yang terpakai. */
  terpakai: number;
  /** Total byte penyimpanan. */
  total: number;
  /** Label bilah untuk pembaca layar; default "Penyimpanan terpakai". */
  label?: string;
}

// Label status keterisian untuk ditampilkan bersama warna (spec §4).
const LABEL_KLASIFIKASI: Record<DoctorStatus, string> = {
  baik: "Longgar",
  cukup: "Mulai penuh",
  perlu_perhatian: "Hampir penuh",
};

export function StorageBar({
  terpakai,
  total,
  label = "Penyimpanan terpakai",
}: StorageBarProps) {
  const valid =
    Number.isFinite(terpakai) && Number.isFinite(total) && total > 0 && terpakai >= 0;

  // Bilah mengisi saat tampil (lihat komentar berkas di atas).
  const [tampil, setTampil] = useState(false);
  useEffect(() => {
    setTampil(true);
  }, []);

  if (!valid) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Pemakaian penyimpanan tidak tersedia.
      </p>
    );
  }

  const persen = Math.max(0, Math.min(100, Math.round((terpakai / total) * 100)));
  // Klasifikasi dari persen SATU DESIMAL — rumus yang sama persis dengan
  // hitungPersenPenyimpanan (lib/doctor.ts) yang dipakai halaman. Bila
  // bilah memakai persen mentah, jendela sempit 90,00-90,05% membuat
  // halaman (kuning) dan bilah (merah) berbeda satu tingkat.
  const persenSatuDesimal =
    Math.round(Math.max(0, Math.min(100, (terpakai / total) * 100)) * 10) / 10;
  const klasifikasi = klasifikasiPenyimpanan(persenSatuDesimal);
  const token = tokenStatus(statusDariDoctor(klasifikasi));
  const lebarTampil = tampil ? persen : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-[var(--color-text-primary)]">
          {formatBytes(terpakai)} dari {formatBytes(total)} terpakai
        </p>
        <p className="flex shrink-0 items-baseline gap-2">
          <span
            className="text-sm font-medium"
            style={{ color: token.teks }}
          >
            {LABEL_KLASIFIKASI[klasifikasi]}
          </span>
          <span className="dh-numeric text-sm font-medium text-[var(--color-text-primary)]">
            {persen}%
          </span>
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
          style={{
            width: `${lebarTampil}%`,
            backgroundColor: token.teks,
            transition: "width var(--duration-medium) var(--ease-out)",
          }}
        />
      </div>
      {klasifikasi === "perlu_perhatian" ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          Penyimpanan hampir penuh. HP bisa terasa berat bila ruang kosong
          tinggal sedikit. Hapus file atau aplikasi yang tidak dipakai lagi.
        </p>
      ) : null}
    </div>
  );
}
