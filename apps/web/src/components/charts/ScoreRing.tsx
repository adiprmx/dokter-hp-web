// components/charts/ScoreRing.tsx — Cincin skor kesehatan 0-100 (SVG murni).
//
// Dipakai di dashboard untuk skor terbaru. Geometri cincin:
// viewBox 120, radius 52; klasifikasi dan warna diambil dari
// lib/skor.ts (satu sumber).
//
// Aksesibilitas (a11y.md 6.4): SVG cincin disembunyikan dari pembaca layar
// (aria-hidden); angka dan kategori dibaca sebagai teks biasa, dan kategori
// selalu berupa label teks, bukan hanya warna cincin. Ringkasan satu kalimat
// untuk pembaca layar tersedia sebagai teks sr-only.

import {
  batasiSkor,
  klasifikasiSkor,
  labelKategori,
  ringkasanSkor,
  warnaKategori,
} from "../../lib/skor";

export interface ScoreRingProps {
  /** Skor 0-100. null berarti belum ada data: tampil "tidak tersedia", bukan 0. */
  skor: number | null;
  /** Diameter cincin dalam px; default 128. */
  ukuran?: number;
}

const RADIUS = 52;
const KELILING = 2 * Math.PI * RADIUS;

export function ScoreRing({ skor, ukuran = 128 }: ScoreRingProps) {
  const nilai = skor === null ? null : batasiSkor(skor);
  const kategori = nilai === null ? null : klasifikasiSkor(nilai);
  const warna = kategori === null ? null : warnaKategori(kategori);
  const label = kategori === null ? null : labelKategori(kategori);
  const progres = nilai === null ? 0 : nilai / 100;

  return (
    <div className="relative shrink-0" style={{ width: ukuran, height: ukuran }}>
      <svg
        viewBox="0 0 120 120"
        width={ukuran}
        height={ukuran}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="10"
        />
        {nilai !== null && warna !== null ? (
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={warna}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={KELILING}
            strokeDashoffset={KELILING * (1 - progres)}
            style={{ transition: "stroke-dashoffset 600ms ease-out" }}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {nilai === null ? (
          <span className="px-2 text-center text-sm text-[var(--color-text-muted)]">
            tidak tersedia
          </span>
        ) : (
          <>
            <span className="dh-numeric text-3xl font-semibold leading-none text-[var(--color-text-primary)]">
              {nilai}
            </span>
            <span
              className="mt-1 text-[13px] font-medium"
              style={{ color: warna ?? undefined }}
            >
              {label}
            </span>
          </>
        )}
      </div>
      <p className="sr-only">
        {nilai === null
          ? "Skor kesehatan tidak tersedia. Belum ada pemeriksaan."
          : ringkasanSkor(nilai)}
      </p>
    </div>
  );
}
