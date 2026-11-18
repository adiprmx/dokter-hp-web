// apps/web/src/pages/BateraiPage.test.tsx
// Tes BateraiPage: strip status berwarna dari klasifikasi kanonis
// (klasifikasiBaterai, ambang 50/20) lewat statusDariDoctor, tiga
// keadaan muat (memuat/siap/galat + retry), keadaan kosong yang
// jujur, formulir tambah catatan (perkiraan + validasi), simpan,
// dan hapus dua langkah. Pola pasang mengikuti MasukPage.test.tsx;
// fetch diganti (stub) seperti api.test.ts — tidak ada panggilan
// jaringan nyata. Warna ditegaskan lewat token CSS di atribut style
// (Card/StatusBadge memakai tokenStatus dari lib/status-warna).

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import BateraiPage from "./BateraiPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type StatusDokter = "baik" | "cukup" | "perlu_perhatian";

/** Satu baris API /health-checks dengan komponen baterai. */
function barisBaterai(
  id: string,
  persen: number,
  status: StatusDokter,
  statusBaterai = "dipakai",
  hematDaya = false,
  dibuatPada = "2026-11-18T08:00:00.000Z",
): unknown {
  return {
    id,
    skor: status === "baik" ? 85 : status === "cukup" ? 65 : 40,
    dibuat_pada: dibuatPada,
    ringkasan: {
      baterai: {
        status,
        skor: status === "baik" ? 85 : status === "cukup" ? 65 : 40,
        sumber: "manual",
        persen,
        status_baterai: statusBaterai,
        hemat_daya: hematDaya,
      },
    },
  };
}

/** Respons palsu envelope sukses (pola responsJson api.test.ts). */
function respons(data: unknown): Response {
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

/** Isi input terkontrol React (setter native + event input). */
function isiInput(input: HTMLInputElement, nilai: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, nilai);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("BateraiPage", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/baterai"]}>
          <Routes>
            <Route path="/baterai" element={<BateraiPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch selesai dan setState ter-flush.
    await act(async () => {});
  }

  async function klik(el: Element | null | undefined): Promise<void> {
    await act(async () => {
      el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
  }

  function tombolDenganTeks(teks: string): HTMLButtonElement | undefined {
    return Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent === teks,
    ) as HTMLButtonElement | undefined;
  }

  /** Jumlah entri di daftar riwayat (di luar 3 item tips). */
  function jumlahEntriRiwayat(): number {
    return (
      wadah?.querySelectorAll(
        'section[aria-labelledby="riwayat-baterai-judul"] li',
      ).length ?? 0
    );
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

  it("menampilkan teks muat + kerangka selagi data diambil", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await pasang();
    expect(wadah?.textContent).toContain("Mengambil data…");
    expect(
      wadah?.querySelectorAll('[role="status"]').length,
    ).toBeGreaterThan(0);
    expect(
      wadah?.querySelector('section[aria-label="Level baterai terbaru"]'),
    ).toBeNull();
  });

  it("strip hijau untuk level 75%: angka besar + badge Baik", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respons([barisBaterai("1", 75, "baik", "mengisi")])),
    );
    await pasang();
    const strip = wadah?.querySelector(
      'section[aria-label="Level baterai terbaru"]',
    );
    expect(strip).not.toBeNull();
    expect(strip?.textContent).toContain("75%");
    expect(strip?.textContent).toContain("Baik");
    expect(strip?.textContent).toContain("Mengisi daya");
    // Kartu strip memakai tinta hijau (token, bukan hex).
    expect(strip?.firstElementChild?.getAttribute("style")).toContain(
      "var(--color-success-bg)",
    );
    // Angka besar memakai teks hijau.
    const angka = Array.from(strip?.querySelectorAll("p") ?? []).find(
      (p) => p.textContent === "75%",
    );
    expect(angka?.getAttribute("style")).toContain("var(--color-success)");
    // Riwayat menampilkan entri yang sama dengan badge Baik.
    expect(wadah?.textContent).toContain("Level baterai:");
    expect(wadah?.textContent).toContain("75%");
  });

  it("strip kuning untuk level 35%: badge Perlu diperhatikan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respons([barisBaterai("1", 35, "cukup")])),
    );
    await pasang();
    const strip = wadah?.querySelector(
      'section[aria-label="Level baterai terbaru"]',
    );
    expect(strip?.textContent).toContain("35%");
    expect(strip?.textContent).toContain("Perlu diperhatikan");
    expect(strip?.firstElementChild?.getAttribute("style")).toContain(
      "var(--color-warning-bg)",
    );
  });

  it("strip merah untuk level 15%: badge Bermasalah", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respons([barisBaterai("1", 15, "perlu_perhatian")])),
    );
    await pasang();
    const strip = wadah?.querySelector(
      'section[aria-label="Level baterai terbaru"]',
    );
    expect(strip?.textContent).toContain("15%");
    expect(strip?.textContent).toContain("Bermasalah");
    expect(strip?.firstElementChild?.getAttribute("style")).toContain(
      "var(--color-error-bg)",
    );
  });

  it("strip memakai entri terbaru bila ada beberapa entri", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respons([
          barisBaterai("2", 80, "baik", "penuh", false, "2026-11-18T09:00:00.000Z"),
          barisBaterai("1", 15, "perlu_perhatian", "dipakai", false, "2026-11-17T08:00:00.000Z"),
        ]),
      ),
    );
    await pasang();
    const strip = wadah?.querySelector(
      'section[aria-label="Level baterai terbaru"]',
    );
    expect(strip?.textContent).toContain("80%");
    expect(strip?.textContent).toContain("Penuh");
    // Entri lama tetap tampil di riwayat.
    expect(jumlahEntriRiwayat()).toBe(2);
  });

  it("keadaan kosong yang jujur bila belum ada entri", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respons([])));
    await pasang();
    expect(wadah?.textContent).toContain("Belum ada data baterai");
    expect(wadah?.textContent).toContain(
      "Belum ada riwayat baterai. Isi kondisi baterai secara manual",
    );
    expect(
      wadah?.querySelector('section[aria-label="Level baterai terbaru"]'),
    ).toBeNull();
  });

  it("keadaan galat + Coba lagi; retry yang berhasil menampilkan data", async () => {
    let panggilan = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        panggilan += 1;
        if (panggilan === 1) throw new Error("jaringan putus");
        return respons([barisBaterai("1", 60, "baik")]);
      }),
    );
    await pasang();
    expect(wadah?.querySelector('[role="alert"]')?.textContent).toBe(
      "Data tidak bisa dimuat. Coba lagi.",
    );
    const tombolCobaLagi = tombolDenganTeks("Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    await klik(tombolCobaLagi);
    expect(panggilan).toBe(2);
    expect(
      wadah?.querySelector('section[aria-label="Level baterai terbaru"]'),
    ).not.toBeNull();
    expect(wadah?.textContent).toContain("60%");
  });

  it("formulir menampilkan perkiraan + badge saat level diisi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respons([])));
    await pasang();
    await klik(tombolDenganTeks("Tambah catatan"));
    const input = wadah?.querySelector(
      'input[placeholder="Contoh: 45"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await act(async () => {
      if (input) isiInput(input, "45");
    });
    await act(async () => {});
    expect(wadah?.textContent).toContain("Perkiraan waktu pakai:");
    expect(wadah?.textContent).toContain("±4,5 jam");
    expect(wadah?.textContent).toContain("Perlu diperhatikan");
    // Perkiraan tidak tampil sebelum level valid diisi.
    await act(async () => {
      if (input) isiInput(input, "");
    });
    await act(async () => {});
    expect(wadah?.textContent).not.toContain("Perkiraan waktu pakai:");
  });

  it("validasi: simpan tanpa isi menampilkan pesan galat di bawah input", async () => {
    const fetchMock = vi.fn(async () => respons([]));
    vi.stubGlobal("fetch", fetchMock);
    await pasang();
    await klik(tombolDenganTeks("Tambah catatan"));
    await klik(tombolDenganTeks("Simpan"));
    expect(wadah?.textContent).toContain(
      "Isi level baterai dengan angka 0 sampai 100.",
    );
    expect(wadah?.textContent).toContain("Pilih status baterai.");
    // Hanya GET awal yang terpanggil; POST tidak terjadi.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("menyimpan entri baru menampilkan pesan sukses + strip diperbarui", async () => {
    const baru = barisBaterai("baru", 60, "baik", "dipakai");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { method?: string }) => {
        if (init?.method === "POST") return respons(baru);
        return respons([]);
      }),
    );
    await pasang();
    await klik(tombolDenganTeks("Tambah catatan"));
    const input = wadah?.querySelector(
      'input[placeholder="Contoh: 45"]',
    ) as HTMLInputElement | null;
    const radio = wadah?.querySelector(
      'input[type="radio"][value="dipakai"]',
    ) as HTMLInputElement | null;
    await act(async () => {
      if (input) isiInput(input, "60");
      radio?.click();
    });
    await act(async () => {});
    await klik(tombolDenganTeks("Simpan"));
    expect(wadah?.textContent).toContain("Data baterai tersimpan.");
    const strip = wadah?.querySelector(
      'section[aria-label="Level baterai terbaru"]',
    );
    expect(strip?.textContent).toContain("60%");
    expect(strip?.textContent).toContain("Baik");
    // Formulir tertutup sesudah simpan berhasil.
    expect(tombolDenganTeks("Simpan")).toBeUndefined();
  });

  it("hapus memakai konfirmasi dua langkah lalu menampilkan pesan sukses", async () => {
    const hapusUrl: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: { method?: string }) => {
        if (init?.method === "DELETE") {
          hapusUrl.push(String(url));
          return respons({});
        }
        return respons([barisBaterai("1", 75, "baik")]);
      }),
    );
    await pasang();
    expect(jumlahEntriRiwayat()).toBe(1);
    await klik(tombolDenganTeks("Hapus"));
    expect(wadah?.textContent).toContain(
      "Entri ini akan dihapus dari riwayat Anda.",
    );
    expect(tombolDenganTeks("Ya, hapus")).toBeDefined();
    await klik(tombolDenganTeks("Ya, hapus"));
    expect(hapusUrl).toEqual(["/api/health-checks/1"]);
    expect(wadah?.textContent).toContain("Entri berhasil dihapus.");
    expect(wadah?.textContent).toContain("Belum ada data baterai");
  });

  it("batal hapus menutup konfirmasi tanpa memanggil API", async () => {
    const fetchMock = vi.fn(async () => respons([barisBaterai("1", 75, "baik")]));
    vi.stubGlobal("fetch", fetchMock);
    await pasang();
    await klik(tombolDenganTeks("Hapus"));
    expect(tombolDenganTeks("Ya, hapus")).toBeDefined();
    await klik(tombolDenganTeks("Batal"));
    expect(tombolDenganTeks("Ya, hapus")).toBeUndefined();
    expect(tombolDenganTeks("Hapus")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
