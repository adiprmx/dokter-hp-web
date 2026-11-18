// apps/web/src/pages/PerformaPage.test.tsx
// Tes PerformaPage (redesign v2.0, docs/redesign-v20-spec.md §8.4):
// strip status berwarna dari statusDariDoctor(klasifikasiPerforma),
// beban HP terbaru terbaca sekilas, riwayat dalam kartu status,
// dan semua keadaan (memuat/skeleton, kosong jujur, galat + retry,
// simpan, hapus). Pola pasang mengikuti MasukPage.test.tsx; fetch
// diganti (stub) seperti api.test.ts, tanpa jaringan nyata.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PerformaPage from "./PerformaPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type BarisApi = Record<string, unknown>;

/** Satu baris /api/health-checks untuk jenis performa. */
function barisPerforma(
  id: string,
  kondisi: string,
  status: string,
  skor: number,
  dibuatPada: string,
  detail: Record<string, unknown> = {},
): BarisApi {
  return {
    id,
    skor,
    dibuat_pada: dibuatPada,
    ringkasan: {
      performa: { status, skor, sumber: "manual", kondisi, ...detail },
    },
  };
}

const BARIS_LAMBAT = barisPerforma(
  "entri-1",
  "sering_lambat",
  "perlu_perhatian",
  40,
  "2026-11-17T15:15:00.000Z",
  {
    catatan: "HP terasa berat saat membuka kamera.",
    ram_total_gb: 8,
    ram_kosong_gb: 2,
    cpu_persen: 80,
    suhu_c: 41,
    perangkat: "POCO M7 Pro",
    android: "14",
    prosesor: "Dimensity 7025",
  },
);

const BARIS_LANCAR = barisPerforma(
  "entri-2",
  "lancar",
  "baik",
  85,
  "2026-11-16T10:00:00.000Z",
  { ram_total_gb: 8, ram_kosong_gb: 5, cpu_persen: 30 },
);

const BARIS_CUKUP = barisPerforma(
  "entri-3",
  "kadang_lambat",
  "cukup",
  65,
  "2026-11-15T09:00:00.000Z",
  { cpu_persen: 55 },
);

/** Respons envelope sukses (pola responsJson api.test.ts). */
function responsSukses(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data,
      meta: { timestamp: "2026-11-18T00:00:00.000Z" },
    }),
  } as unknown as Response;
}

/** Stub fetch: GET daftar mengembalikan `daftar`, POST mengembalikan
 *  `hasilSimpan` (bila ada), DELETE mengembalikan envelope kosong. */
function pasangFetch(daftar: BarisApi[], hasilSimpan?: BarisApi) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const metode = (init?.method ?? "GET").toUpperCase();
    if (metode === "POST") {
      if (!hasilSimpan) throw new Error("tidak ada hasil simpan");
      return responsSukses(hasilSimpan);
    }
    if (metode === "DELETE") return responsSukses(null);
    expect(url).toContain("/api/health-checks");
    return responsSukses(daftar);
  });
}

describe("PerformaPage (redesign v2.0)", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/performa"]}>
          <Routes>
            <Route path="/performa" element={<PerformaPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch selesai dan setState ter-flush.
    await act(async () => {});
  }

  function cariTombol(teks: string): HTMLButtonElement | undefined {
    return Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent === teks,
    ) as HTMLButtonElement | undefined;
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
    vi.unstubAllGlobals();
  });

  it("judul, subjudul, dan panel batasan tampil; tanpa em dash di prosa", async () => {
    vi.stubGlobal("fetch", pasangFetch([]));
    await pasang();
    expect(wadah?.querySelector("h1")?.textContent).toBe("Dokter Performa");
    expect(document.title).toBe("Dokter Performa | Dokter HP");
    expect(wadah?.textContent).toContain(
      "Riwayat kecepatan dan beban HP Anda.",
    );
    expect(wadah?.textContent).toContain(
      "Versi web tidak bisa membaca RAM, beban prosesor, atau suhu HP",
    );
    expect(wadah?.textContent).not.toContain("—");
  });

  it("keadaan memuat: teks terlihat + kerangka meniru tata letak akhir", async () => {
    // Janji yang tidak pernah selesai: keadaan tetap "memuat".
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await pasang();
    // Teks muat yang terlihat (di dalam bagian riwayat; kerangka
    // Skeleton juga memakai role status, jadi selektor dipersempit).
    const status = wadah?.querySelector(
      'section[aria-labelledby="riwayat-performa-judul"] [role="status"]',
    );
    expect(status?.textContent).toBe("Mengambil data…");
    expect(wadah?.querySelectorAll(".dh-skeleton").length).toBeGreaterThan(0);
    expect(
      wadah?.querySelector('section[aria-label="Kondisi performa terbaru"]'),
    ).toBeNull();
  });

  it("strip merah untuk catatan terbaru sering_lambat: kondisi, lencana, skor, beban", async () => {
    vi.stubGlobal("fetch", pasangFetch([BARIS_LAMBAT, BARIS_LANCAR]));
    await pasang();
    const strip = wadah?.querySelector(
      'section[aria-label="Kondisi performa terbaru"]',
    );
    expect(strip).not.toBeNull();
    expect(strip?.textContent).toContain("Kondisi terbaru");
    expect(strip?.textContent).toContain("Sering lambat");
    expect(strip?.textContent).toContain("Bermasalah");
    expect(strip?.textContent).toContain("17 November 2026");
    expect(strip?.textContent).toContain("Skor");
    expect(strip?.textContent).toContain("40");
    expect(strip?.textContent).toContain("dari 100");
    // Warna strip dari token galat (Card status="galat").
    const kartu = strip?.querySelector("div");
    expect(kartu?.getAttribute("style")).toContain(
      "var(--color-error-bg)",
    );
    // Meter skor memakai zona kanonis + label aria menyebut status.
    const meter = strip?.querySelector('svg[role="img"]');
    expect(meter?.getAttribute("aria-label")).toBe(
      "Nilai 40 dari 100, Bermasalah",
    );
    // Beban HP terbaru terbaca sekilas.
    expect(strip?.textContent).toContain("Beban prosesor");
    expect(strip?.textContent).toContain("80%");
    expect(strip?.textContent).toContain("Suhu");
    expect(strip?.textContent).toContain("41°C");
    expect(strip?.textContent).toContain("RAM yang masih kosong");
    expect(strip?.textContent).toContain("2 GB dari 8 GB");
    expect(strip?.textContent).toContain("Perangkat");
    expect(strip?.textContent).toContain("POCO M7 Pro");
    // Saran muncul karena kondisi terbaru sering_lambat.
    expect(wadah?.textContent).toContain("Saran");
    expect(wadah?.textContent).toContain("Coba mulai ulang HP.");
  });

  it("strip hijau untuk catatan terbaru lancar, tanpa saran", async () => {
    vi.stubGlobal("fetch", pasangFetch([BARIS_LANCAR]));
    await pasang();
    const strip = wadah?.querySelector(
      'section[aria-label="Kondisi performa terbaru"]',
    );
    expect(strip?.textContent).toContain("Lancar");
    expect(strip?.textContent).toContain("Baik");
    const kartu = strip?.querySelector("div");
    expect(kartu?.getAttribute("style")).toContain(
      "var(--color-success-bg)",
    );
    expect(wadah?.textContent).not.toContain("Coba mulai ulang HP.");
  });

  it("strip kuning untuk catatan terbaru kadang_lambat", async () => {
    vi.stubGlobal("fetch", pasangFetch([BARIS_CUKUP]));
    await pasang();
    const strip = wadah?.querySelector(
      'section[aria-label="Kondisi performa terbaru"]',
    );
    expect(strip?.textContent).toContain("Kadang lambat");
    expect(strip?.textContent).toContain("Perlu diperhatikan");
    const kartu = strip?.querySelector("div");
    expect(kartu?.getAttribute("style")).toContain(
      "var(--color-warning-bg)",
    );
  });

  it("riwayat menampilkan detail tiap entri dengan label copy.md 8", async () => {
    vi.stubGlobal("fetch", pasangFetch([BARIS_LAMBAT, BARIS_LANCAR]));
    await pasang();
    const daftar = wadah?.querySelector("ul");
    expect(daftar?.querySelectorAll(":scope > li").length).toBe(2);
    expect(wadah?.textContent).toContain("HP terasa berat saat membuka kamera.");
    for (const label of [
      "RAM",
      "RAM yang masih kosong",
      "Beban prosesor",
      "Suhu",
      "Perangkat",
      "Versi Android",
      "Prosesor",
    ]) {
      expect(wadah?.textContent).toContain(label);
    }
    expect(wadah?.textContent).toContain("Dimensity 7025");
    // Kondisi entri lambat berwarna galat (teks + warna, bukan warna saja).
    const nilaiKondisi = Array.from(
      wadah?.querySelectorAll("li span.font-semibold") ?? [],
    ).find((el) => el.textContent === "Sering lambat");
    expect(nilaiKondisi?.getAttribute("style")).toContain(
      "var(--color-error)",
    );
  });

  it("keadaan kosong jujur: tanpa strip, tanpa saran", async () => {
    vi.stubGlobal("fetch", pasangFetch([]));
    await pasang();
    expect(wadah?.textContent).toContain("Belum ada data performa");
    expect(wadah?.textContent).toContain(
      "Belum ada riwayat performa. Isi kondisi performa secara manual",
    );
    expect(
      wadah?.querySelector('section[aria-label="Kondisi performa terbaru"]'),
    ).toBeNull();
    expect(wadah?.textContent).not.toContain("Coba mulai ulang HP.");
  });

  it("keadaan galat: pesan + Coba lagi; retry yang berhasil menampilkan data", async () => {
    let panggilan = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        panggilan += 1;
        if (panggilan === 1) throw new Error("jaringan putus");
        return responsSukses([BARIS_LANCAR]);
      }),
    );
    await pasang();
    const peringatan = wadah?.querySelector('[role="alert"]');
    expect(peringatan?.textContent).toBe("Data tidak bisa dimuat. Coba lagi.");
    const tombolCobaLagi = cariTombol("Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    expect(tombolCobaLagi?.disabled).toBe(false);
    await act(async () => {
      tombolCobaLagi?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {});
    expect(wadah?.textContent).toContain("Lancar");
    expect(panggilan).toBe(2);
  });

  it("tombol Tambah catatan membuka dan menutup formulir", async () => {
    vi.stubGlobal("fetch", pasangFetch([]));
    await pasang();
    // Frasa judul formulir juga muncul di teks empty state, jadi yang
    // ditegaskan adalah keberadaan wadah formulirnya.
    expect(wadah?.querySelector("#form-performa")).toBeNull();
    const tombolBuka = cariTombol("Tambah catatan");
    expect(tombolBuka?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      tombolBuka?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(wadah?.querySelector("#form-performa")).not.toBeNull();
    expect(wadah?.textContent).toContain("Isi kondisi performa");
    const tombolTutup = cariTombol("Tutup formulir");
    expect(tombolTutup?.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      tombolTutup?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(wadah?.querySelector("#form-performa")).toBeNull();
  });

  it("menyimpan catatan baru: tampil di strip dan riwayat + pesan sukses", async () => {
    const hasilSimpan = barisPerforma(
      "entri-baru",
      "lancar",
      "baik",
      85,
      "2026-11-18T08:00:00.000Z",
      { cpu_persen: 25 },
    );
    vi.stubGlobal("fetch", pasangFetch([BARIS_CUKUP], hasilSimpan));
    await pasang();
    await act(async () => {
      cariTombol("Tambah catatan")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    const radioLancar = wadah?.querySelector(
      'input[type="radio"][value="lancar"]',
    ) as HTMLInputElement | null;
    expect(radioLancar).not.toBeNull();
    await act(async () => {
      radioLancar?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      cariTombol("Simpan")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {});
    expect(wadah?.textContent).toContain("Data performa tersimpan.");
    const strip = wadah?.querySelector(
      'section[aria-label="Kondisi performa terbaru"]',
    );
    expect(strip?.textContent).toContain("Lancar");
    expect(strip?.textContent).toContain("25%");
    expect(wadah?.querySelectorAll("ul > li").length).toBe(2);
  });

  it("menghapus entri: konfirmasi dua langkah, entri hilang + pesan sukses", async () => {
    vi.stubGlobal("fetch", pasangFetch([BARIS_LANCAR]));
    await pasang();
    expect(wadah?.querySelectorAll("ul > li").length).toBe(1);
    await act(async () => {
      cariTombol("Hapus")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(wadah?.textContent).toContain(
      "Entri ini akan dihapus dari riwayat Anda.",
    );
    await act(async () => {
      cariTombol("Ya, hapus")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {});
    expect(wadah?.textContent).toContain("Entri berhasil dihapus.");
    expect(wadah?.querySelectorAll("ul > li").length).toBe(0);
    expect(wadah?.textContent).toContain("Belum ada data performa");
  });
});
