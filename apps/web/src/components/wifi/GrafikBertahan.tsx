// Grafik garis sederhana untuk tes bertahan 30 detik (SVG murni,
// tanpa library grafik — sesuai anggaran bundle performance.md 3.2).
//
// Dibuat di folder ini karena components/charts/SustainedChart.tsx
// (milik Tim Dashboard) belum ada saat halaman ini dibangun; bila
// SustainedChart sudah tersedia, halaman boleh beralih ke sana.
//
// Aksesibilitas (docs/a11y.md 6.4): grafik punya role="img" dan
// aria-label ringkasan, ditambah ringkasan teks dan tabel angka
// tiap detik agar data bisa dibaca tanpa grafik.

import {
  formatKecepatan,
  nilaiTesBertahan,
  type SampelBertahan,
} from "../../lib/speedtest";

interface GrafikBertahanProps {
  /** Sampel per detik (detikKe 0-29). */
  sampel: SampelBertahan[];
}

const LEBAR = 320;
const TINGGI = 140;
const PADDING_KIRI = 8;
const PADDING_KANAN = 8;
const PADDING_ATAS = 12;
const PADDING_BAWAH = 22;

export default function GrafikBertahan({ sampel }: GrafikBertahanProps) {
  if (sampel.length === 0) return null;

  const nilai = nilaiTesBertahan(sampel.map((s) => s.kbps));
  const maks = Math.max(nilai.tertinggiKbps, 1);
  const lebarGrafik = LEBAR - PADDING_KIRI - PADDING_KANAN;
  const tinggiGrafik = TINGGI - PADDING_ATAS - PADDING_BAWAH;

  const titik = sampel.map((s) => {
    const penyebut = Math.max(sampel.length - 1, 1);
    const x = PADDING_KIRI + (s.detikKe / penyebut) * lebarGrafik;
    const y =
      PADDING_ATAS + tinggiGrafik - (s.kbps / maks) * tinggiGrafik;
    return { x, y, detikKe: s.detikKe, kbps: s.kbps };
  });
  const points = titik.map((t) => `${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(" ");

  const ringkasan =
    `Grafik kecepatan per detik selama ${sampel.length} detik. ` +
    `Rata-rata ${formatKecepatan(nilai.rataRataKbps)}, ` +
    `tertinggi ${formatKecepatan(nilai.tertinggiKbps)}, ` +
    `terendah ${formatKecepatan(nilai.terendahKbps)}.`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${LEBAR} ${TINGGI}`}
        className="h-auto w-full"
        role="img"
        aria-label={ringkasan}
      >
        {/* Garis dasar. */}
        <line
          x1={PADDING_KIRI}
          y1={PADDING_ATAS + tinggiGrafik}
          x2={LEBAR - PADDING_KANAN}
          y2={PADDING_ATAS + tinggiGrafik}
          stroke="#71717a"
          strokeWidth="1"
        />
        {/* Garis kecepatan (putih, 18,70:1 di atas kartu). */}
        <polyline
          points={points}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {titik.map((t) => (
          <circle key={t.detikKe} cx={t.x} cy={t.y} r="2" fill="#ffffff" />
        ))}
        {/* Label sumbu. */}
        <text
          x={PADDING_KIRI}
          y={TINGGI - 6}
          fill="#a1a1aa"
          fontSize="10"
        >
          0 detik
        </text>
        <text
          x={LEBAR - PADDING_KANAN}
          y={TINGGI - 6}
          fill="#a1a1aa"
          fontSize="10"
          textAnchor="end"
        >
          {sampel.length - 1} detik
        </text>
        <text x={PADDING_KIRI} y={10} fill="#a1a1aa" fontSize="10">
          {formatKecepatan(maks)}
        </text>
      </svg>

      {/* Ringkasan teks — isi yang sama dengan grafik. */}
      <p className="mt-2 text-sm text-zinc-300">{ringkasan}</p>

      {/* Tabel angka tiap detik (alternatif grafik, a11y 6.4). */}
      <details className="mt-3">
        <summary className="min-h-[48px] cursor-pointer py-3 text-sm font-medium text-white underline">
          Lihat angka tiap detik
        </summary>
        <table className="mt-1 w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400">
              <th scope="col" className="py-2 pr-4 font-medium">
                Detik ke-
              </th>
              <th scope="col" className="py-2 font-medium">
                Kecepatan
              </th>
            </tr>
          </thead>
          <tbody>
            {sampel.map((s) => (
              <tr key={s.detikKe} className="border-t border-zinc-800">
                <td className="py-2 pr-4 text-zinc-300">{s.detikKe + 1}</td>
                <td className="py-2 font-mono text-zinc-100">
                  {formatKecepatan(s.kbps)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
