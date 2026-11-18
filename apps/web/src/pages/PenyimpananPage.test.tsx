// apps/web/src/pages/PenyimpananPage.test.tsx
// Tes PenyimpananPage (redesign v2.0): integrasi StorageBar sebagai
// satu-satunya tampilan bilah (bagian utama + tiap entri riwayat),
// strip status berwarna lewat statusDariDoctor(klasifikasiPenyimpanan),
// kartu galat saat hampir penuh, dan semua keadaan (memuat/skeleton,
// kosong jujur, galat + retry, simpan, hapus). Ambang 70/90 tidak
// berubah: 90% tepat masih kuning, merah mulai di atas 90%.
// Pola pasang mengikuti MasukPage.test.tsx (createRoot + act, tanpa
// testing-library); fetch diganti (stub) seperti api.test.ts — tidak
// ada panggilan jaringan nyata.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PenyimpananPage from "./PenyimpananPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const HIJAU = "var(--color-success)";
const KUNING = "var(--color-warning)";
const MERAH = "var(--color-error)";

/** Baris API /health-checks untuk satu entri penyimpanan. */
function barisPenyimpanan(
  id: string,
  totalGb: number | undefined,
  terpakaiGb: number | undefined,
  status: "baik" | "cukup" | "perlu_perhatian" | null,
): Record<string, unknown> {
  const komponen: Record<string, unknown> = {
    status,
    skor: 85,
    sumber: "manual",
  };
  if (totalGb !== undefined) komponen.total_gb = totalGb;
  if (terpakaiGb !== undefined) komponen.terpakai_gb = terpakaiGb;
  return {
    id,
    skor: 85,
    dibuat_pada: "2026-11-18T10:00:00.000Z",
    ringkasan: { penyimpanan: komponen },
  };
}

/** Respons fetch palsu berisi envelope sukses kontrak 0.3. */
function responsOk(data: unknown): Response {
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

describe("PenyimpananPage (redesign v2.0)", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(<PenyimpananPage />);
    });
    // Biarkan janji fetch riwayat selesai dan setState ter-flush.
    await act(async () => {});
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Stub fetch: GET mengembalikan riwayat, POST/DELETE sukses. */
  function stubFetch(
    riwayat: unknown[],
    dibuat?: unknown,
  ): ReturnType<typeof vi.fn> {
    return vi.fn((url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        return Promise.resolve(responsOk(dibuat ?? riwayat[0] ?? {}));
      }
      if (method === "DELETE") {
        return Promise.resolve(responsOk({}));
      }
      expect(url).toContain("/api/health-checks");
      return Promise.resolve(responsOk(riwayat));
    });
  }

  /** Bilah isi (div dalam progressbar) ke-n di halaman. */
  function isiBilah(ke: number): Element | null {
    return wadah?.querySelectorAll('[role="progressbar"] > div')[ke] ?? null;
  }

  /** Kartu bagian utama (Card di dalam section pemakaian). */
  function kartuPemakaian(): Element | null {
    return (
      wadah?.querySelector(
        'section[aria-labelledby="pemakaian-judul"] > div',
      ) ?? null
    );
  }

  /** Angka display besar di bagian utama. */
  function angkaBesar(): Element | null {
    return wadah?.querySelector('[class*="text-display-lg"]') ?? null;
  }

  function isiInput(input: HTMLInputElement, nilai: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, nilai);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function tombolDenganTeks(teks: string): HTMLButtonElement | null {
    const tombol = [...(wadah?.querySelectorAll("button") ?? [])].find(
      (el) => el.textContent?.trim() === teks,
    );
    return (tombol as HTMLButtonElement | undefined) ?? null;
  }

  it("memuat: teks muat + kerangka, tanpa isi", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await pasang();
    expect(wadah?.textContent).toContain("Mengambil data…");
    expect(wadah?.querySelector(".dh-skeleton")).not.toBeNull();
    expect(wadah?.querySelector('[role="progressbar"]')).toBeNull();
  });

  it("kosong: empty state jujur, tanpa bilah dan tanpa angka besar", async () => {
    vi.stubGlobal("fetch", stubFetch([]));
    await pasang();
    expect(wadah?.textContent).toContain("Belum ada data penyimpanan");
    expect(wadah?.textContent).toContain(
      "Belum ada riwayat penyimpanan. Isi pemakaian penyimpanan secara manual",
    );
    expect(wadah?.querySelector('[role="progressbar"]')).toBeNull();
    expect(angkaBesar()).toBeNull();
    expect(wadah?.querySelector("#pemakaian-judul")).toBeNull();
  });

  it("45%: angka besar hijau + badge Baik + bilah hijau Longgar", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([barisPenyimpanan("1", 100, 45, "baik")]),
    );
    await pasang();
    expect(angkaBesar()?.textContent).toBe("45%");
    expect(angkaBesar()?.getAttribute("style")).toContain(HIJAU);
    expect(wadah?.textContent).toContain("Baik");
    expect(isiBilah(0)?.getAttribute("style")).toContain(HIJAU);
    expect(wadah?.textContent).toContain("Longgar");
    expect(wadah?.textContent).toContain("Masih kosong:");
    expect(wadah?.textContent).toContain("55 GB");
    expect(wadah?.textContent).not.toContain("Penyimpanan hampir penuh");
    // Kartu bagian utama bertinta sukses.
    expect(kartuPemakaian()?.getAttribute("style")).toContain(
      "var(--color-success-bg)",
    );
  });

  it("75%: bilah kuning + label Mulai penuh + badge Perlu diperhatikan", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([barisPenyimpanan("1", 128, 96, "cukup")]),
    );
    await pasang();
    expect(angkaBesar()?.textContent).toBe("75%");
    expect(angkaBesar()?.getAttribute("style")).toContain(KUNING);
    expect(isiBilah(0)?.getAttribute("style")).toContain(KUNING);
    expect(wadah?.textContent).toContain("Mulai penuh");
    expect(wadah?.textContent).toContain("Perlu diperhatikan");
    expect(wadah?.textContent).not.toContain("Penyimpanan hampir penuh");
    expect(kartuPemakaian()?.getAttribute("style")).toContain(
      "var(--color-warning-bg)",
    );
  });

  it("95%: kartu galat + bilah merah + peringatan hampir penuh", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([barisPenyimpanan("1", 100, 95, "perlu_perhatian")]),
    );
    await pasang();
    expect(angkaBesar()?.textContent).toBe("95%");
    expect(angkaBesar()?.getAttribute("style")).toContain(MERAH);
    expect(isiBilah(0)?.getAttribute("style")).toContain(MERAH);
    expect(wadah?.textContent).toContain("Hampir penuh");
    expect(wadah?.textContent).toContain("Bermasalah");
    expect(wadah?.textContent).toContain("Penyimpanan hampir penuh");
    // Peringatan berada di dalam kartu galat (bukan teks polos):
    // kartu bagian utama bertinta galat dan memuat kalimatnya.
    expect(kartuPemakaian()?.getAttribute("style")).toContain(
      "var(--color-error-bg)",
    );
    expect(kartuPemakaian()?.textContent).toContain(
      "Penyimpanan hampir penuh",
    );
  });

  it("tepat 90%: masih kuning, bukan merah (merah mulai di atas 90%)", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([barisPenyimpanan("1", 100, 90, "cukup")]),
    );
    await pasang();
    expect(isiBilah(0)?.getAttribute("style")).toContain(KUNING);
    expect(wadah?.textContent).toContain("Mulai penuh");
    expect(wadah?.textContent).not.toContain("Penyimpanan hampir penuh");
  });

  it("riwayat: tiap entri berangka membawa StorageBar sendiri", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        barisPenyimpanan("1", 100, 45, "baik"),
        barisPenyimpanan("2", 64, 48, "cukup"),
      ]),
    );
    await pasang();
    // Satu bilah bagian utama + satu bilah per entri riwayat.
    const bar = wadah?.querySelectorAll('[role="progressbar"]');
    expect(bar?.length).toBe(3);
    expect(bar?.[0]?.getAttribute("aria-valuenow")).toBe("45");
    expect(bar?.[1]?.getAttribute("aria-valuenow")).toBe("45");
    expect(bar?.[2]?.getAttribute("aria-valuenow")).toBe("75");
    // Bilah riwayat berlabel tanggal catatannya (bisa dibedakan).
    expect(bar?.[1]?.getAttribute("aria-label")).toContain("catatan");
  });

  it("entri tanpa angka: teks jujur, tanpa bilah di entri itu", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([barisPenyimpanan("1", undefined, undefined, null)]),
    );
    await pasang();
    expect(wadah?.textContent).toContain("tidak tersedia");
    expect(wadah?.querySelector('[role="progressbar"]')).toBeNull();
    expect(wadah?.querySelector("#pemakaian-judul")).toBeNull();
  });

  it("galat muat: kartu galat + retry yang berhasil menampilkan data", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("jaringan putus"))
      .mockImplementation(() =>
        Promise.resolve(
          responsOk([barisPenyimpanan("1", 100, 45, "baik")]),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await pasang();
    expect(wadah?.querySelector('[role="alert"]')).not.toBeNull();
    const tombol = tombolDenganTeks("Coba lagi");
    expect(tombol).not.toBeNull();
    await act(async () => {
      tombol?.click();
    });
    await act(async () => {});
    await act(async () => {});
    expect(wadah?.textContent).toContain("Longgar");
    expect(angkaBesar()?.textContent).toBe("45%");
  });

  it("tombol Tambah catatan membuka dan menutup formulir", async () => {
    vi.stubGlobal("fetch", stubFetch([]));
    await pasang();
    // Deskripsi empty state memakai frasa yang mirip ("Isi pemakaian
    // penyimpanan secara manual"), jadi yang diperiksa adalah kontainer
    // formulirnya, bukan teks judulnya.
    expect(wadah?.querySelector("#form-penyimpanan")).toBeNull();
    await act(async () => {
      tombolDenganTeks("Tambah catatan")?.click();
    });
    expect(wadah?.querySelector("#form-penyimpanan")).not.toBeNull();
    expect(wadah?.querySelector("#penyimpanan-judul")?.textContent).toBe(
      "Isi pemakaian penyimpanan",
    );
    await act(async () => {
      tombolDenganTeks("Tutup formulir")?.click();
    });
    expect(wadah?.querySelector("#form-penyimpanan")).toBeNull();
  });

  it("simpan: entri baru tampil di bagian utama + riwayat", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([], barisPenyimpanan("baru", 128, 96, "cukup")),
    );
    await pasang();
    await act(async () => {
      tombolDenganTeks("Tambah catatan")?.click();
    });
    const total = wadah?.querySelector(
      'input[placeholder="Contoh: 128"]',
    ) as HTMLInputElement | null;
    const terpakai = wadah?.querySelector(
      'input[placeholder="Contoh: 96"]',
    ) as HTMLInputElement | null;
    expect(total).not.toBeNull();
    expect(terpakai).not.toBeNull();
    await act(async () => {
      if (total) isiInput(total, "128");
      if (terpakai) isiInput(terpakai, "96");
    });
    await act(async () => {
      tombolDenganTeks("Simpan")?.click();
    });
    await act(async () => {});
    await act(async () => {});
    expect(wadah?.textContent).toContain("Data penyimpanan tersimpan.");
    expect(angkaBesar()?.textContent).toBe("75%");
    expect(wadah?.textContent).toContain("Mulai penuh");
  });

  it("hapus: konfirmasi dua langkah lalu entri hilang", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([barisPenyimpanan("1", 100, 45, "baik")]),
    );
    await pasang();
    expect(wadah?.textContent).toContain("Longgar");
    await act(async () => {
      tombolDenganTeks("Hapus")?.click();
    });
    expect(tombolDenganTeks("Ya, hapus")).not.toBeNull();
    await act(async () => {
      tombolDenganTeks("Ya, hapus")?.click();
    });
    await act(async () => {});
    await act(async () => {});
    expect(wadah?.textContent).toContain("Entri berhasil dihapus.");
    expect(wadah?.textContent).toContain("Belum ada data penyimpanan");
  });

  it("tidak ada em dash di teks halaman", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([barisPenyimpanan("1", 100, 95, "perlu_perhatian")]),
    );
    await pasang();
    expect(wadah?.textContent).not.toContain("—");
  });

  it("penjelasan batasan web tetap tampil", async () => {
    vi.stubGlobal("fetch", stubFetch([]));
    await pasang();
    expect(wadah?.textContent).toContain(
      "Versi web tidak bisa membaca penyimpanan HP secara langsung.",
    );
    expect(wadah?.textContent).toContain(
      "Hapus file yang tidak perlu langsung dari HP.",
    );
  });
});
