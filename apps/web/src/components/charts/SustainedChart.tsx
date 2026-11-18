// components/charts/SustainedChart.tsx — Grafik garis tes bertahan 30 detik.
// SVG murni, tanpa library grafik (docs/performance.md 3.2).
//
// ============================================================================
// API PROPS — untuk Tim WiFi (pemakai komponen ini di /wifi)
// ============================================================================
//   <SustainedChart sampel={sampel} durasiDetik={30} />
//
//   sampel: SampelKecepatan[]
//     Satu item per detik tes: { detikKe, kecepatanKbps }.
//     - detikKe: 0 sampai durasiDetik - 1 (kontrak API: detik_ke 0-29).
//     - kecepatanKbps: kecepatan unduh saat itu, dalam KB/detik (>= 0).
//     Dipetakan dari respons GET /wifi-reports/:id (field `samples`):
//       samples.map((s) => ({ detikKe: s.detik_ke, kecepatanKbps: s.kecepatan_kbps }))
//     Selama tes berjalan, teruskan sampel yang sudah terkumpul — grafik
//     menggambar apa pun yang ada, belum tentu 30 titik.
//
//   durasiDetik?: number (default 30)
//     Durasi tes dalam detik. Kontrak API hanya mendukung 30
//     (durasi_tes_detik = 30), jadi biarkan default kecuali kontrak berubah.
//
//   Komponen ini TIDAK mengambil data sendiri dan TIDAK memanggil API.
//   Komponen ini TIDAK menyimpan apa pun — penyimpanan sampel ke server
//   (POST /wifi-reports/:id/samples) adalah tanggung jawab halaman /wifi.
//
//   Helper yang diekspor dan boleh dipakai ulang di /wifi:
//   - formatKecepatan(kbps): "52 KB/detik" / "1,2 MB/detik".
//   - ringkasanBertahan(sampel): { stabil, awalKbps, akhirKbps, jumlahSampel }
//     untuk angka awal/akhir di luar grafik. Kalimat hasil grafik memakai
//     verdict kanonis lib/speedtest.ts (lihat komponen di bawah).
//
// Aturan stabil/jatuh (didokumentasikan di sini; bukan dari kontrak API):
// bandingkan rata-rata 5 sampel pertama dengan rata-rata 5 sampel terakhir;
// "jatuh" bila kecepatan akhir di bawah 70% kecepatan awal.
// "stabil" mensyaratkan kecepatan awal terukur (> 0): awal 0 bukan bukti
// stabil, karena tidak ada kecepatan yang bertahan (K-94 Wave 3a).
//
// Warna (redesign v2.0 §4/§9): garis, titik, dan zona di bawah garis
// memakai warna status dari verdict kanonis lib/speedtest.ts
// (nilaiTesBertahan — fungsi yang sama dipakai halaman /wifi, sehingga
// warna grafik tidak pernah bertentangan dengan teks verdict halaman):
// bertahan hijau, tidak-stabil kuning, jatuh merah. Garis putus-putus
// menandai ambang jatuh (70% kecepatan awal) agar aturan "jatuh" yang
// dipakai ringkasan terlihat di grafik, bukan tersembunyi di kode.
// Warna selalu berpasangan dengan label verdict berteks di atas grafik.
// ============================================================================
//
// Aksesibilitas (a11y.md 6.4): grafik disertai ringkasan teks yang terlihat
// (stabil/jatuh + kecepatan awal/akhir) DAN tabel data sr-only berisi semua
// sampel. SVG memakai role="img" dengan aria-label yang meringkas data.

import { nilaiTesBertahan, type VerdictBertahan } from "../../lib/speedtest";
import { statusDariVerdict, tokenStatus } from "../../lib/status-warna";

export interface SampelKecepatan {
  /** Detik ke-berapa sampel ini diambil (0 sampai durasi tes - 1). */
  detikKe: number;
  /** Kecepatan unduh saat itu, dalam KB/detik. */
  kecepatanKbps: number;
}

export interface SustainedChartProps {
  /** Sampel kecepatan per detik, urutan apa pun. */
  sampel: SampelKecepatan[];
  /** Durasi tes dalam detik; default 30. */
  durasiDetik?: number;
}

export interface RingkasanBertahan {
  /** true bila kecepatan bertahan (awal terukur > 0 dan akhir >= 70% awal). */
  stabil: boolean;
  /** Rata-rata kecepatan 5 sampel pertama (KB/detik). */
  awalKbps: number;
  /** Rata-rata kecepatan 5 sampel terakhir (KB/detik). */
  akhirKbps: number;
  /** Jumlah sampel valid yang dipakai. */
  jumlahSampel: number;
}

const LEBAR = 320;
const TINGGI = 180;
const PAD_KIRI = 48;
const PAD_KANAN = 8;
const PAD_ATAS = 10;
const PAD_BAWAH = 24;

/** Kecepatan akhir di bawah 70% kecepatan awal dianggap "jatuh". */
const AMBANG_JATUH = 0.7;

const formatAngka = new Intl.NumberFormat("id-ID");
const formatAngkaSatuDesimal = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

/** Label verdict untuk ditampilkan bersama warna statusnya (spec §4). */
const LABEL_VERDICT: Record<VerdictBertahan, string> = {
  bertahan: "Bertahan",
  "tidak-stabil": "Tidak stabil",
  jatuh: "Jatuh",
};

/**
 * Format kecepatan untuk tampilan: di bawah 1.000 KB/detik tampil sebagai
 * "KB/detik", sisanya sebagai "MB/detik" (1 MB = 1.000 KB, sesuai pemakaian
 * "1 MB/detik" di PRODUCT.md §4.4).
 */
export function formatKecepatan(kecepatanKbps: number): string {
  if (!Number.isFinite(kecepatanKbps) || kecepatanKbps < 0) {
    return "tidak tersedia";
  }
  if (kecepatanKbps < 1000) {
    const nilai =
      kecepatanKbps >= 100
        ? Math.round(kecepatanKbps)
        : Math.round(kecepatanKbps * 10) / 10;
    return `${formatAngka.format(nilai)} KB/detik`;
  }
  return `${formatAngkaSatuDesimal.format(kecepatanKbps / 1000)} MB/detik`;
}

/**
 * Label pendek kecepatan untuk sumbu tegak ("500 KB" / "1,2 MB").
 * Di bawah 100 memakai satu desimal (sama seperti formatKecepatan) agar
 * label sumbu tidak kembar: untuk maks 0, tick 0 / 0,5 / 1 wajib tampil
 * "0 KB" / "0,5 KB" / "1 KB", bukan "1 KB" dua kali.
 */
function formatSumbuKecepatan(kecepatanKbps: number): string {
  if (kecepatanKbps < 1000) {
    const nilai =
      kecepatanKbps >= 100
        ? Math.round(kecepatanKbps)
        : Math.round(kecepatanKbps * 10) / 10;
    return `${formatAngka.format(nilai)} KB`;
  }
  return `${formatAngkaSatuDesimal.format(kecepatanKbps / 1000)} MB`;
}

function rataRata(nilai: number[]): number {
  if (nilai.length === 0) return 0;
  return nilai.reduce((a, b) => a + b, 0) / nilai.length;
}

/**
 * Analisis stabil/jatuh dari sampel. Mengembalikan null bila tidak ada
 * sampel valid. Perbandingan memakai rata-rata 5 sampel pertama vs 5
 * sampel terakhir agar satu sampel sesaat tidak mengubah hasil.
 * Awal 0 (tidak ada kecepatan terukur di 5 detik pertama) bukan bukti
 * stabil, karena tidak ada kecepatan yang bertahan. Jadi stabil
 * bernilai false bila awal <= 0.
 */
export function ringkasanBertahan(
  sampel: SampelKecepatan[],
): RingkasanBertahan | null {
  const valid = [...sampel]
    .filter(
      (s) =>
        Number.isFinite(s.detikKe) &&
        Number.isFinite(s.kecepatanKbps) &&
        s.kecepatanKbps >= 0,
    )
    .sort((a, b) => a.detikKe - b.detikKe);
  if (valid.length === 0) return null;
  const awalKbps = rataRata(valid.slice(0, 5).map((s) => s.kecepatanKbps));
  const akhirKbps = rataRata(valid.slice(-5).map((s) => s.kecepatanKbps));
  return {
    stabil: awalKbps <= 0 ? false : akhirKbps >= awalKbps * AMBANG_JATUH,
    awalKbps,
    akhirKbps,
    jumlahSampel: valid.length,
  };
}

/** Batas atas sumbu tegak yang enak dibaca (1 / 2 / 5 / 10 x pangkat 10). */
function batasAtasSumbu(nilaiMaks: number): number {
  if (!(nilaiMaks > 0)) return 1;
  const pangkat = 10 ** Math.floor(Math.log10(nilaiMaks));
  const ternormalisasi = nilaiMaks / pangkat;
  const langkah =
    ternormalisasi <= 1 ? 1 : ternormalisasi <= 2 ? 2 : ternormalisasi <= 5 ? 5 : 10;
  return langkah * pangkat;
}

export function SustainedChart({ sampel, durasiDetik = 30 }: SustainedChartProps) {
  const titik = [...sampel]
    .filter(
      (s) =>
        Number.isFinite(s.detikKe) &&
        Number.isFinite(s.kecepatanKbps) &&
        s.detikKe >= 0 &&
        s.detikKe < durasiDetik &&
        s.kecepatanKbps >= 0,
    )
    .sort((a, b) => a.detikKe - b.detikKe);

  const ringkasan = ringkasanBertahan(titik);

  if (titik.length === 0 || ringkasan === null) {
    return (
      <div>
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          Belum ada data tes bertahan
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          Jalankan tes bertahan 30 detik dari Dokter WiFi untuk melihat grafik
          kecepatan per detik di sini.
        </p>
      </div>
    );
  }

  const maksKbps = batasAtasSumbu(
    Math.max(...titik.map((t) => t.kecepatanKbps)),
  );

  // Verdict kanonis (fungsi yang sama dipakai halaman /wifi) menggerakkan
  // warna DAN kalimat hasil, agar keduanya tidak pernah bertentangan:
  // kecepatan konstan 500 KB/detik adalah "tidak-stabil" menurut verdict
  // (rata-rata < 1000) walau lolos aturan 70% ringkasanBertahan.
  // ringkasanBertahan tetap memasok angka awal/akhir di bawah.
  const verdict = nilaiTesBertahan(titik.map((t) => t.kecepatanKbps)).verdict;
  const token = tokenStatus(statusDariVerdict(verdict));
  // Ambang jatuh: 70% kecepatan awal (aturan yang sama dipakai ringkasan).
  const ambangKbps = ringkasan.awalKbps * AMBANG_JATUH;

  const lebarGrafik = LEBAR - PAD_KIRI - PAD_KANAN;
  const tinggiGrafik = TINGGI - PAD_ATAS - PAD_BAWAH;
  const posisiX = (detikKe: number) =>
    PAD_KIRI + (detikKe / Math.max(1, durasiDetik - 1)) * lebarGrafik;
  const posisiY = (kecepatanKbps: number) =>
    PAD_ATAS + tinggiGrafik - (kecepatanKbps / maksKbps) * tinggiGrafik;
  const points = titik
    .map(
      (t) => `${posisiX(t.detikKe).toFixed(1)},${posisiY(t.kecepatanKbps).toFixed(1)}`,
    )
    .join(" ");
  // Zona di bawah garis: poligon dari titik-titik garis turun ke sumbu 0.
  const areaPoints =
    titik.length > 1
      ? `${points} ${posisiX(titik[titik.length - 1].detikKe).toFixed(1)},${posisiY(0).toFixed(1)} ${posisiX(titik[0].detikKe).toFixed(1)},${posisiY(0).toFixed(1)}`
      : "";

  // Kalimat hasil memakai teks final docs/copy.md §5 (tes bertahan),
  // dipilih dari verdict kanonis, bukan dari ringkasan.stabil, agar
  // kalimat dan label verdict selalu sepakat. Kalimat tidak-stabil sama
  // dengan teksVerdict halaman /wifi.
  const kalimatHasil =
    verdict === "bertahan"
      ? `Kecepatan stabil selama ${durasiDetik} detik.`
      : verdict === "jatuh"
        ? `Kecepatan mulai ${formatKecepatan(ringkasan.awalKbps)} lalu jatuh ke ${formatKecepatan(ringkasan.akhirKbps)}. Pola seperti ini biasanya berasal dari router atau jaringan, bukan dari HP.`
        : `Kecepatan tidak stabil selama ${durasiDetik} detik. Coba tes lagi saat jaringan tidak dipakai perangkat lain.`;
  const kalimatAwalAkhir = `Kecepatan awal ${formatKecepatan(ringkasan.awalKbps)}, kecepatan akhir ${formatKecepatan(ringkasan.akhirKbps)}.`;
  const kalimatAmbang =
    ambangKbps > 0
      ? ` Garis putus-putus menandai 70% kecepatan awal (${formatKecepatan(ambangKbps)}).`
      : "";
  const labelGrafik = `Grafik kecepatan per detik selama ${durasiDetik} detik, ${ringkasan.jumlahSampel} sampel. ${kalimatHasil} ${kalimatAwalAkhir}${kalimatAmbang}`;

  const tengahDetik = Math.round(durasiDetik / 2);

  return (
    <div>
      <p
        className="mb-2 flex items-center gap-2 text-sm font-medium"
        style={{ color: token.teks }}
      >
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: token.teks }}
        />
        {LABEL_VERDICT[verdict]}
      </p>
      <svg
        viewBox={`0 0 ${LEBAR} ${TINGGI}`}
        className="h-auto w-full"
        role="img"
        aria-label={labelGrafik}
      >
        {[0, maksKbps / 2, maksKbps].map((nilai) => (
          <g key={nilai}>
            <line
              x1={PAD_KIRI}
              x2={LEBAR - PAD_KANAN}
              y1={posisiY(nilai)}
              y2={posisiY(nilai)}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <text
              x={PAD_KIRI - 6}
              y={posisiY(nilai) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--color-text-muted)"
            >
              {formatSumbuKecepatan(nilai)}
            </text>
          </g>
        ))}
        {ambangKbps > 0 ? (
          <g>
            <line
              x1={PAD_KIRI}
              x2={LEBAR - PAD_KANAN}
              y1={posisiY(ambangKbps)}
              y2={posisiY(ambangKbps)}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            {/* Latar di belakang label agar tetap terbaca bila garis
                data lewat di dekat garis ambang (jatuh, layar sempit). */}
            <rect
              x={PAD_KIRI + 2}
              y={posisiY(ambangKbps) - 16}
              width={104}
              height={14}
              rx={2}
              fill="var(--color-surface)"
            />
            <text
              x={PAD_KIRI + 4}
              y={posisiY(ambangKbps) - 5}
              textAnchor="start"
              fontSize={10}
              fill="var(--color-text-muted)"
            >
              70% kecepatan awal
            </text>
          </g>
        ) : null}
        {titik.length > 1 ? (
          <polygon points={areaPoints} fill={token.latar} />
        ) : null}
        {titik.length > 1 ? (
          <polyline
            points={points}
            fill="none"
            stroke={token.teks}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {titik.map((t) => (
          <circle
            key={t.detikKe}
            cx={posisiX(t.detikKe)}
            cy={posisiY(t.kecepatanKbps)}
            r="2.5"
            fill={token.teks}
          />
        ))}
        <text
          x={posisiX(0)}
          y={TINGGI - 6}
          textAnchor="start"
          fontSize={11}
          fill="var(--color-text-muted)"
        >
          0 dtk
        </text>
        <text
          x={posisiX(tengahDetik)}
          y={TINGGI - 6}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-text-muted)"
        >
          {tengahDetik} dtk
        </text>
        <text
          x={posisiX(durasiDetik - 1)}
          y={TINGGI - 6}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-text-muted)"
        >
          {durasiDetik} dtk
        </text>
      </svg>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
        {kalimatHasil}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {kalimatAwalAkhir}
      </p>
      <table className="sr-only">
        <caption>Kecepatan per detik</caption>
        <thead>
          <tr>
            <th scope="col">Detik ke</th>
            <th scope="col">Kecepatan</th>
          </tr>
        </thead>
        <tbody>
          {titik.map((t) => (
            <tr key={t.detikKe}>
              <td>{t.detikKe}</td>
              <td>{formatKecepatan(t.kecepatanKbps)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
