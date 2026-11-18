// apps/web/src/components/charts/charts.test.tsx
// Tes komponen grafik (redesign v2.0 §9): warna status per keadaan,
// empty state jujur, dan perilaku lama yang dipertahankan (ringkasan
// bertahan, format kecepatan, progresbar). Pola pasang mengikuti
// MasukPage.test.tsx (createRoot + act, tanpa testing-library).

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreHistoryChart } from "./ScoreHistoryChart";
import { ScoreRing } from "./ScoreRing";
import { StorageBar } from "./StorageBar";
import {
  formatKecepatan,
  ringkasanBertahan,
  SustainedChart,
  type SampelKecepatan,
} from "./SustainedChart";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const HIJAU = "var(--color-success)";
const KUNING = "var(--color-warning)";
const MERAH = "var(--color-error)";

let wadah: HTMLDivElement | null = null;
let root: Root | null = null;

async function pasang(node: React.ReactNode): Promise<void> {
  wadah = document.createElement("div");
  document.body.appendChild(wadah);
  root = createRoot(wadah);
  await act(async () => {
    root?.render(node);
  });
  await act(async () => {});
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  wadah?.remove();
  wadah = null;
  root = null;
});

describe("ScoreRing (ambang 80/50, helper status-warna)", () => {
  it("skor 85: cincin hijau + label Baik + angka besar", async () => {
    await pasang(<ScoreRing skor={85} />);
    const busur = wadah?.querySelector('circle[stroke-dasharray]');
    expect(busur?.getAttribute("stroke")).toBe(HIJAU);
    expect(wadah?.textContent).toContain("85");
    expect(wadah?.textContent).toContain("Baik");
    // Sapuan mendarat di nilai akhir (offset = keliling x (1 - 0,85)).
    const offset = Number(busur?.getAttribute("stroke-dashoffset"));
    expect(offset).toBeCloseTo(2 * Math.PI * 52 * 0.15, 1);
  });

  it("skor 65: cincin kuning + label Perlu diperhatikan", async () => {
    await pasang(<ScoreRing skor={65} />);
    const busur = wadah?.querySelector('circle[stroke-dasharray]');
    expect(busur?.getAttribute("stroke")).toBe(KUNING);
    expect(wadah?.textContent).toContain("Perlu diperhatikan");
  });

  it("skor 30: cincin merah + label Bermasalah", async () => {
    await pasang(<ScoreRing skor={30} />);
    const busur = wadah?.querySelector('circle[stroke-dasharray]');
    expect(busur?.getAttribute("stroke")).toBe(MERAH);
    expect(wadah?.textContent).toContain("Bermasalah");
  });

  it("skor null: teks jujur, tanpa busur, ringkasan sr-only", async () => {
    await pasang(<ScoreRing skor={null} />);
    expect(wadah?.textContent).toContain("tidak tersedia");
    expect(wadah?.querySelector('circle[stroke-dasharray]')).toBeNull();
    expect(wadah?.textContent).toContain(
      "Skor kesehatan tidak tersedia. Belum ada pemeriksaan.",
    );
  });

  it("ringkasan sr-only menyebut skor dan kategori", async () => {
    await pasang(<ScoreRing skor={85} />);
    expect(wadah?.querySelector(".sr-only")?.textContent).toBe(
      "Skor kesehatan 85 dari 100, kategori Baik.",
    );
  });
});

describe("SustainedChart (warna per verdict kanonis)", () => {
  function sampelTetap(nilai: number, jumlah = 30): SampelKecepatan[] {
    return Array.from({ length: jumlah }, (_, i) => ({
      detikKe: i,
      kecepatanKbps: nilai,
    }));
  }

  it("bertahan: garis + titik hijau, zona hijau, label Bertahan", async () => {
    await pasang(<SustainedChart sampel={sampelTetap(1500)} />);
    expect(wadah?.querySelector("polyline")?.getAttribute("stroke")).toBe(
      HIJAU,
    );
    expect(wadah?.querySelector("polygon")?.getAttribute("fill")).toBe(
      "var(--color-success-bg)",
    );
    expect(wadah?.textContent).toContain("Bertahan");
    expect(wadah?.textContent).toContain("Kecepatan stabil selama 30 detik.");
    expect(wadah?.querySelector("circle")?.getAttribute("fill")).toBe(HIJAU);
  });

  it("jatuh: garis merah + label Jatuh + kalimat jatuh", async () => {
    const sampel: SampelKecepatan[] = Array.from({ length: 30 }, (_, i) => ({
      detikKe: i,
      kecepatanKbps: i < 5 ? 2000 : 400,
    }));
    await pasang(<SustainedChart sampel={sampel} />);
    expect(wadah?.querySelector("polyline")?.getAttribute("stroke")).toBe(
      MERAH,
    );
    expect(wadah?.textContent).toContain("Jatuh");
    expect(wadah?.textContent).toContain("lalu jatuh ke");
  });

  it("tidak-stabil: garis kuning + label Tidak stabil + kalimat sepakat", async () => {
    await pasang(<SustainedChart sampel={sampelTetap(500)} />);
    expect(wadah?.querySelector("polyline")?.getAttribute("stroke")).toBe(
      KUNING,
    );
    expect(wadah?.textContent).toContain("Tidak stabil");
    // Konstan 500 KB/detik: verdict tidak-stabil (rata-rata < 1000) walau
    // lolos aturan 70% — kalimat hasil wajib sepakat dengan verdict dan
    // tidak boleh mengklaim "stabil".
    expect(wadah?.textContent).toContain(
      "Kecepatan tidak stabil selama 30 detik.",
    );
    expect(wadah?.textContent).not.toContain(
      "Kecepatan stabil selama 30 detik.",
    );
  });

  it("awal 0: bukan stabil — verdict tidak-stabil + kalimat sepakat", async () => {
    await pasang(<SustainedChart sampel={sampelTetap(0)} />);
    expect(wadah?.textContent).toContain("Tidak stabil");
    expect(wadah?.textContent).toContain(
      "Kecepatan tidak stabil selama 30 detik.",
    );
    expect(wadah?.textContent).not.toContain(
      "Kecepatan stabil selama 30 detik.",
    );
    // Sumbu tegak untuk maks 0: tick 0 / 0,5 / 1 wajib tampil berbeda —
    // "1 KB" tidak boleh muncul dua kali (pembulatan Math.round(0,5) = 1).
    expect(wadah?.textContent).toContain("0,5 KB");
    expect(wadah?.textContent.match(/1 KB/g)?.length ?? 0).toBe(1);
  });

  it("garis ambang putus-putus 70% kecepatan awal tampil + berlabel", async () => {
    await pasang(<SustainedChart sampel={sampelTetap(1500)} />);
    const garisAmbang = wadah?.querySelector('line[stroke-dasharray="4 3"]');
    expect(garisAmbang).not.toBeNull();
    expect(wadah?.textContent).toContain("70% kecepatan awal");
  });

  it("tanpa sampel: empty state jujur", async () => {
    await pasang(<SustainedChart sampel={[]} />);
    expect(wadah?.textContent).toContain("Belum ada data tes bertahan");
    expect(wadah?.querySelector("svg")).toBeNull();
  });

  it("perilaku lama dipertahankan: ringkasanBertahan + formatKecepatan", () => {
    expect(ringkasanBertahan(sampelTetap(1500))?.stabil).toBe(true);
    // Akar ketegangan kata (Wave 3a): awal 0 bukan bukti stabil.
    expect(ringkasanBertahan(sampelTetap(0))?.stabil).toBe(false);
    expect(
      ringkasanBertahan(
        Array.from({ length: 30 }, (_, i) => ({
          detikKe: i,
          kecepatanKbps: i < 5 ? 2000 : 400,
        })),
      )?.stabil,
    ).toBe(false);
    expect(ringkasanBertahan([])).toBeNull();
    expect(formatKecepatan(1500)).toBe("1,5 MB/detik");
    expect(formatKecepatan(500)).toBe("500 KB/detik");
    expect(formatKecepatan(-1)).toBe("tidak tersedia");
  });
});

describe("StorageBar (ambang selaras klasifikasiPenyimpanan 70/90)", () => {
  const GB = 1024 ** 3;

  it("45%: bilah hijau + label Longgar, tanpa peringatan", async () => {
    await pasang(<StorageBar terpakai={45 * GB} total={100 * GB} />);
    const isi = wadah?.querySelector('[role="progressbar"] > div');
    expect(isi?.getAttribute("style")).toContain(HIJAU);
    expect(isi?.getAttribute("style")).toContain("width: 45%");
    expect(wadah?.textContent).toContain("Longgar");
    expect(wadah?.textContent).not.toContain("Penyimpanan hampir penuh");
  });

  it("75%: bilah kuning + label Mulai penuh", async () => {
    await pasang(<StorageBar terpakai={75 * GB} total={100 * GB} />);
    const isi = wadah?.querySelector('[role="progressbar"] > div');
    expect(isi?.getAttribute("style")).toContain(KUNING);
    expect(wadah?.textContent).toContain("Mulai penuh");
  });

  it("95%: bilah merah + label Hampir penuh + pesan peringatan", async () => {
    await pasang(<StorageBar terpakai={95 * GB} total={100 * GB} />);
    const isi = wadah?.querySelector('[role="progressbar"] > div');
    expect(isi?.getAttribute("style")).toContain(MERAH);
    expect(wadah?.textContent).toContain("Hampir penuh");
    expect(wadah?.textContent).toContain("Penyimpanan hampir penuh");
  });

  it("tepat 90%: masih kuning (merah mulai di atas 90%, seperti halaman)", async () => {
    await pasang(<StorageBar terpakai={90 * GB} total={100 * GB} />);
    const isi = wadah?.querySelector('[role="progressbar"] > div');
    expect(isi?.getAttribute("style")).toContain(KUNING);
    expect(wadah?.textContent).toContain("Mulai penuh");
  });

  it("progressbar membawa nilai aria yang benar", async () => {
    await pasang(<StorageBar terpakai={45 * GB} total={100 * GB} />);
    const bar = wadah?.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute("aria-valuenow")).toBe("45");
    expect(bar?.getAttribute("aria-valuemin")).toBe("0");
    expect(bar?.getAttribute("aria-valuemax")).toBe("100");
  });

  it("tidak valid: teks jujur, tanpa bilah", async () => {
    await pasang(<StorageBar terpakai={10 * GB} total={0} />);
    expect(wadah?.textContent).toContain(
      "Pemakaian penyimpanan tidak tersedia.",
    );
    expect(wadah?.querySelector('[role="progressbar"]')).toBeNull();
  });
});

describe("ScoreHistoryChart (titik + ruas berwarna per kategori)", () => {
  const data = [
    { tanggal: "2026-11-10T10:00:00.000Z", skor: 85 },
    { tanggal: "2026-11-12T10:00:00.000Z", skor: 65 },
    { tanggal: "2026-11-14T10:00:00.000Z", skor: 30 },
  ];

  it("tiap titik berwarna sesuai kategorinya", async () => {
    await pasang(<ScoreHistoryChart data={data} />);
    const titik = wadah?.querySelectorAll("circle");
    expect(titik?.length).toBe(3);
    expect(titik?.[0].getAttribute("fill")).toBe(HIJAU);
    expect(titik?.[1].getAttribute("fill")).toBe(KUNING);
    expect(titik?.[2].getAttribute("fill")).toBe(MERAH);
  });

  it("ruas garis berwarna sesuai titik tujuannya", async () => {
    await pasang(<ScoreHistoryChart data={data} />);
    // Ruas garis: stroke-width 2 (garis grid memakai 1).
    const ruas = [...(wadah?.querySelectorAll('line[stroke-width="2"]') ?? [])];
    expect(ruas.length).toBe(2);
    expect(ruas[0].getAttribute("stroke")).toBe(KUNING);
    expect(ruas[1].getAttribute("stroke")).toBe(MERAH);
  });

  it("tiga zona pita kategori tampil di latar", async () => {
    await pasang(<ScoreHistoryChart data={data} />);
    const zona = wadah?.querySelectorAll("rect");
    expect(zona?.length).toBe(3);
    expect(zona?.[0].getAttribute("fill")).toBe("var(--color-success-bg)");
    expect(zona?.[1].getAttribute("fill")).toBe("var(--color-warning-bg)");
    expect(zona?.[2].getAttribute("fill")).toBe("var(--color-error-bg)");
  });

  it("garis ambang 80 putus-putus + label sumbu 80 tampil", async () => {
    await pasang(<ScoreHistoryChart data={data} />);
    expect(
      wadah?.querySelector('line[stroke-dasharray="4 3"]'),
    ).not.toBeNull();
    expect(wadah?.textContent).toContain("80");
  });

  it("satu titik: tanpa ruas garis, ringkasan tetap ada", async () => {
    await pasang(
      <ScoreHistoryChart
        data={[{ tanggal: "2026-11-14T10:00:00.000Z", skor: 85 }]}
      />,
    );
    expect(wadah?.querySelectorAll("circle").length).toBe(1);
    expect(
      wadah?.querySelectorAll('line[stroke-width="2"]').length,
    ).toBe(0);
    expect(wadah?.textContent).toContain("Skor terakhir 85");
  });

  it("tanpa data: empty state jujur", async () => {
    await pasang(<ScoreHistoryChart data={[]} />);
    expect(wadah?.textContent).toContain("Belum ada data pemeriksaan");
    expect(wadah?.querySelector("svg")).toBeNull();
  });
});
