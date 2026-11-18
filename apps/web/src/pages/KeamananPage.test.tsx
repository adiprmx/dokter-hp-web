// apps/web/src/pages/KeamananPage.test.tsx
// Tes KeamananPage: keadaan muat/kosong/galat, ringkasan keamanan,
// kartu status tiap aplikasi (Berisiko/Periksa/Aman), daftar Perlu
// ditinjau, buka/tutup formulir, dan hapus entri. Pola pasang
// mengikuti MasukPage.test.tsx; fetch diganti (stub), tidak ada
// panggilan jaringan nyata. Data mock memakai bentuk baris API
// (uraiEntriDokter): id, dibuat_pada, skor, ringkasan.keamanan.
// Redesign v2.0: tes menegaskan warna status lewat token var() pada
// gaya inline kartu (bukan hex), label cip berteks, dan tidak ada
// em dash di prosa halaman.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import KeamananPage from "./KeamananPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type BarisApi = Record<string, unknown>;

/** Satu baris entri keamanan dari API. */
function barisKeamanan(
  id: string,
  aplikasi: Array<{ nama: string; izin: number; sistem: boolean }>,
  status = "perlu_perhatian",
): BarisApi {
  return {
    id,
    skor: 40,
    dibuat_pada: "2026-11-18T08:00:00.000Z",
    ringkasan: {
      keamanan: {
        status,
        skor: 40,
        sumber: "apk",
        aplikasi: aplikasi.map((a) => ({
          nama: a.nama,
          izin_berbahaya: a.izin,
          sistem: a.sistem,
        })),
      },
    },
  };
}

/** Respons palsu GET /api/health-checks (envelope sukses). */
function responsRiwayat(baris: BarisApi[]): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: baris,
      meta: { timestamp: "2026-11-18T00:00:00.000Z" },
    }),
  } as unknown as Response;
}

/** Respons palsu DELETE /api/health-checks/:id (envelope sukses). */
function responsHapus(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: null,
      meta: { timestamp: "2026-11-18T00:00:00.000Z" },
    }),
  } as unknown as Response;
}

// Satu entri berisi tiga tingkat aplikasi: berisiko (5 izin, bukan
// sistem), periksa (6 izin, sistem), aman (1 izin, bukan sistem).
const BARIS_CAMPURAN = [
  barisKeamanan("entri-1", [
    { nama: "Chat Cepat", izin: 5, sistem: false },
    { nama: "Layanan Sistem", izin: 6, sistem: true },
    { nama: "Kalkulator", izin: 1, sistem: false },
  ]),
];

// Semua aplikasi aman: tidak ada yang perlu ditinjau.
const BARIS_AMAN = [
  barisKeamanan(
    "entri-2",
    [
      { nama: "Kalkulator", izin: 1, sistem: false },
      { nama: "Jam", izin: 0, sistem: true },
    ],
    "baik",
  ),
];

describe("KeamananPage", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/keamanan"]}>
          <Routes>
            <Route path="/keamanan" element={<KeamananPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch selesai dan setState ter-flush.
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
  });

  function cariTombol(teks: string): HTMLButtonElement | undefined {
    return Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent === teks,
    ) as HTMLButtonElement | undefined;
  }

  it("menampilkan kerangka muat + teks Mengambil data selagi fetch berjalan", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await pasang();
    expect(wadah?.textContent).toContain("Mengambil data…");
    // Kerangka meniru tata letak akhir: strip ringkasan + kartu daftar.
    const kerangka = wadah?.querySelectorAll(".dh-skeleton");
    expect(kerangka?.length).toBe(4);
    expect(wadah?.textContent).not.toContain("Ringkasan keamanan");
  });

  it("keadaan kosong: EmptyState jujur tanpa daftar temuan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat([])));
    await pasang();
    expect(wadah?.textContent).toContain("Belum ada data keamanan");
    expect(wadah?.textContent).toContain(
      "Belum ada riwayat pemindaian keamanan.",
    );
    expect(wadah?.textContent).not.toContain("Ringkasan keamanan");
    expect(wadah?.textContent).not.toContain("Perlu ditinjau");
  });

  it("keadaan galat: pesan galat + Coba lagi; retry yang berhasil menampilkan data", async () => {
    let panggilan = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        panggilan += 1;
        if (panggilan === 1) throw new Error("jaringan putus");
        return responsRiwayat(BARIS_CAMPURAN);
      }),
    );
    await pasang();
    expect(wadah?.querySelector('[role="alert"]')).not.toBeNull();
    const tombolCobaLagi = cariTombol("Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    expect(tombolCobaLagi?.disabled).toBe(false);
    await act(async () => {
      tombolCobaLagi?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {});
    expect(panggilan).toBe(2);
    expect(wadah?.textContent).toContain("Ringkasan keamanan");
    expect(wadah?.textContent).toContain("Chat Cepat");
  });

  it("ringkasan menampilkan jumlah perlu ditinjau + label status Perlu diperhatikan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_CAMPURAN)));
    await pasang();
    const ringkasan = wadah?.querySelector(
      '[aria-labelledby="ringkasan-keamanan-judul"]',
    );
    expect(ringkasan?.textContent).toContain("1");
    expect(ringkasan?.textContent).toContain("aplikasi perlu ditinjau");
    // 1 aplikasi perlu ditinjau = klasifikasi "cukup" (1-2) → label
    // status kanonis "Perlu diperhatikan" (K-94).
    expect(ringkasan?.textContent).toContain("Perlu diperhatikan");
    expect(ringkasan?.textContent).toContain("3 aplikasi diperiksa");
    expect(ringkasan?.textContent).toContain("1 di antaranya aplikasi sistem");
    // Kartu ringkasan memakai tinta kuning (peringatan) dari token.
    const kartu = ringkasan?.querySelector("div");
    expect(kartu?.getAttribute("style")).toContain(
      "var(--color-warning-bg)",
    );
  });

  it("ringkasan hijau + label Baik bila tidak ada aplikasi perlu ditinjau", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_AMAN)));
    await pasang();
    const ringkasan = wadah?.querySelector(
      '[aria-labelledby="ringkasan-keamanan-judul"]',
    );
    expect(ringkasan?.textContent).toContain("0");
    expect(ringkasan?.textContent).toContain("Baik");
    expect(ringkasan?.textContent).toContain(
      "Tidak ada aplikasi yang perlu ditinjau dari data terakhir.",
    );
    const kartu = ringkasan?.querySelector("div");
    expect(kartu?.getAttribute("style")).toContain(
      "var(--color-success-bg)",
    );
  });

  it("daftar Perlu ditinjau hanya berisi aplikasi berisiko", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_CAMPURAN)));
    await pasang();
    const bagian = wadah?.querySelector(
      '[aria-labelledby="perlu-ditinjau-judul"]',
    );
    expect(bagian?.textContent).toContain("Chat Cepat");
    expect(bagian?.textContent).not.toContain("Layanan Sistem");
    expect(bagian?.textContent).not.toContain("Kalkulator");
    expect(bagian?.textContent).toContain(
      "meminta 4 izin berbahaya atau lebih",
    );
  });

  it("tiap aplikasi punya kartu status + cip berlabel teks sesuai tingkatnya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_CAMPURAN)));
    await pasang();
    const bagian = wadah?.querySelector(
      '[aria-labelledby="semua-aplikasi-judul"]',
    );
    const baris = Array.from(bagian?.querySelectorAll("li") ?? []);
    expect(baris.length).toBe(3);

    // Cari kartu tiap aplikasi dari nama di dalamnya, lalu periksa
    // tinta latar kartu (token var) dan label cipnya.
    function periksa(
      nama: string,
      tokenLatar: string,
      label: string,
    ): void {
      const item = baris.find((li) => li.textContent?.includes(nama));
      expect(item).toBeDefined();
      const kartu = item?.querySelector("div");
      expect(kartu?.getAttribute("style")).toContain(tokenLatar);
      expect(item?.textContent).toContain(label);
    }

    periksa("Chat Cepat", "var(--color-error-bg)", "Berisiko");
    periksa("Layanan Sistem", "var(--color-warning-bg)", "Periksa");
    periksa("Kalkulator", "var(--color-success-bg)", "Aman");
  });

  it("cip Aplikasi sistem tampil hanya untuk aplikasi sistem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_CAMPURAN)));
    await pasang();
    const bagian = wadah?.querySelector(
      '[aria-labelledby="semua-aplikasi-judul"]',
    );
    const baris = Array.from(bagian?.querySelectorAll("li") ?? []);
    const sistem = baris.find((li) =>
      li.textContent?.includes("Layanan Sistem"),
    );
    const biasa = baris.find((li) => li.textContent?.includes("Chat Cepat"));
    expect(sistem?.textContent).toContain("Aplikasi sistem");
    expect(biasa?.textContent).not.toContain("Aplikasi sistem");
  });

  it("tombol Tambah catatan membuka dan menutup formulir", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_CAMPURAN)));
    await pasang();
    expect(wadah?.textContent).not.toContain("Isi temuan keamanan");
    const tombolBuka = cariTombol("Tambah catatan");
    expect(tombolBuka?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      tombolBuka?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(wadah?.textContent).toContain("Isi temuan keamanan");
    expect(wadah?.textContent).toContain("Nama aplikasi");
    expect(wadah?.textContent).toContain("Jumlah izin berbahaya");
    expect(wadah?.textContent).toContain("Aplikasi sistem");
    const tombolTutup = cariTombol("Tutup formulir");
    expect(tombolTutup?.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      tombolTutup?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(wadah?.textContent).not.toContain("Isi temuan keamanan");
  });

  it("hapus entri: konfirmasi lalu entri hilang + pesan sukses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (typeof url === "string" && url.includes("/api/health-checks/")) {
          return responsHapus();
        }
        return responsRiwayat(BARIS_CAMPURAN);
      }),
    );
    await pasang();
    const tombolHapus = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Hapus");
    expect(tombolHapus).toBeDefined();
    await act(async () => {
      tombolHapus?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const tombolYa = cariTombol("Ya, hapus");
    expect(tombolYa).toBeDefined();
    await act(async () => {
      tombolYa?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(wadah?.textContent).toContain("Entri berhasil dihapus.");
    // Entri terhapus: halaman kembali ke keadaan kosong.
    expect(wadah?.textContent).toContain("Belum ada data keamanan");
  });

  it("tidak ada em dash di prosa halaman", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_CAMPURAN)));
    await pasang();
    expect(wadah?.textContent).not.toContain("—");
  });

  it("judul halaman dan spanduk batasan web tetap tampil", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsRiwayat(BARIS_CAMPURAN)));
    await pasang();
    expect(wadah?.querySelector("h1")?.textContent).toBe("Dokter Keamanan");
    expect(document.title).toBe("Dokter Keamanan — Dokter HP");
    expect(wadah?.textContent).toContain(
      "Versi web tidak bisa memindai aplikasi di HP.",
    );
  });
});
