// components/charts/ScoreRing.tsx — Cincin skor kesehatan 0-100 (SVG murni).
//
// Dipakai di dashboard untuk skor terbaru. Geometri cincin:
// viewBox 120, radius 52; klasifikasi dan ambang hidup di lib/skor.ts
// (K-31/K-51), warna status dari lib/status-warna.ts (satu sumber).
//
// Gerak (spec §6, MOTION 2): cincin menyapu dari kosong ke nilai saat
// tampil — sapuan adalah momen "hasil pengukuran tiba", bukan hiasan.
// Durasi + easing dari token; prefers-reduced-motion dipersingkat
// sampai instan oleh tokens.css.
//
// Aksesibilitas (a11y.md 6.4): SVG cincin disembunyikan dari pembaca layar
// (aria-hidden); angka dan kategori dibaca sebagai teks biasa, dan kategori
// selalu berupa label teks, bukan hanya warna cincin. Ringkasan satu kalimat
// untuk pembaca layar tersedia sebagai teks sr-only.

import { useEffect, useState } from "react";
import { batasiSkor, ringkasanSkor } from "../../lib/skor";
import { labelStatus, statusDariSkor, tokenStatus } from "../../lib/status-warna";

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
  // Warna dari helper status-warna (ambang 80/50 hidup di lib/skor.ts,
  // komponen ini tetap presentasional — K-51).
  const warna =
    nilai === null ? null : tokenStatus(statusDariSkor(nilai)).teks;
  // Label dari helper status-warna (K-94): kata di dalam cincin harus
  // sama dengan kata di lencana StatusBadge untuk keadaan yang sama.
  const label = nilai === null ? null : labelStatus(statusDariSkor(nilai));
  const progres = nilai === null ? 0 : nilai / 100;

  // Sapuan saat tampil: mulai dari cincin kosong, lalu isi ke nilai.
  // Bila skor berubah sesudahnya, cincin bergerak ke nilai baru dengan
  // transisi yang sama (bukan sapuan ulang dari nol).
  const [tampil, setTampil] = useState(false);
  useEffect(() => {
    setTampil(true);
  }, []);
  const progresTampil = tampil ? progres : 0;

  // Angka besar di tengah, proporsional dengan ukuran cincin.
  const ukuranAngka = Math.round(ukuran * 0.28);
  const ukuranLabel = Math.max(11, Math.round(ukuran * 0.1));

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
            strokeDashoffset={KELILING * (1 - progresTampil)}
            style={{
              transition:
                "stroke-dashoffset var(--duration-medium) var(--ease-out)",
            }}
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
            <span
              className="dh-numeric font-semibold leading-none text-[var(--color-text-primary)]"
              style={{ fontSize: ukuranAngka }}
            >
              {nilai}
            </span>
            <span
              className="mt-1 font-medium"
              style={{ color: warna ?? undefined, fontSize: ukuranLabel }}
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
