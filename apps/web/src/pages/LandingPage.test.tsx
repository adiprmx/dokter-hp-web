// apps/web/src/pages/LandingPage.test.tsx
// Tes LandingPage v2.0 (redesign-v20-spec.md §8.1): hero dengan panel
// meter hidup, legenda skala skor untuk pengunjung yang belum masuk,
// dan skor terakhir REAL dari API untuk pengguna yang sudah masuk.
// Pola pasang mengikuti MasukPage.test.tsx; fetch diganti (stub)
// seperti api.test.ts — tidak ada panggilan jaringan nyata. Status
// masuk diatur langsung lewat store (Header tidak dirender di sini).

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";
import { useAppStore, type StatusMasuk } from "../store/useAppStore";
import { PANDUAN } from "../data/panduan";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** Respons palsu GET /api/health-checks?limit=1 (envelope kontrak 0.3). */
function responsSkor(data: unknown): Response {
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

/** Respons palsu 401 (sesi habis di antara cek sesi dan panggilan skor). */
function respons401(): Response {
  return {
    ok: false,
    status: 401,
    json: async () => ({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi berakhir" },
    }),
  } as unknown as Response;
}

describe("LandingPage v2.0", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(statusMasuk: StatusMasuk): Promise<void> {
    useAppStore.setState({ statusMasuk, namaPengguna: null });
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch skor selesai dan setState ter-flush.
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
    useAppStore.setState({ statusMasuk: "memeriksa", namaPengguna: null });
  });

  it("menampilkan judul dokumen, tagline, dan kedua CTA", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await pasang("tidak-masuk");
    expect(document.title).toBe(
      "Dokter HP — Cek WiFi Lemot, Baterai Boros & Kesehatan HP",
    );
    expect(wadah?.textContent).toContain("Dokter HP");
    expect(wadah?.textContent).toContain(
      "Cari tahu kenapa HP terasa bermasalah, lalu perbaiki.",
    );
    expect(wadah?.textContent).toContain(
      "Periksa kondisi HP dari browser",
    );
    const tautanWifi = wadah?.querySelector('a[href="/wifi"]');
    expect(tautanWifi?.textContent).toBe("Coba tes WiFi tanpa akun");
    const tautanMasuk = wadah?.querySelector('a[href="/masuk"]');
    expect(tautanMasuk?.textContent).toBe("Masuk / Daftar");
    expect(wadah?.textContent).toContain(
      "Hasil tes tampil di layar, tetapi tidak tersimpan.",
    );
  });

  it("menampilkan legenda skala skor dan TIDAK memanggil API bila belum masuk", async () => {
    const ambil = vi.fn();
    vi.stubGlobal("fetch", ambil);
    await pasang("tidak-masuk");
    expect(ambil).not.toHaveBeenCalled();
    expect(wadah?.textContent).toContain("Skor kesehatan HP");
    expect(wadah?.textContent).toContain("Baik");
    expect(wadah?.textContent).toContain("Perlu diperhatikan");
    expect(wadah?.textContent).toContain("Bermasalah");
    expect(wadah?.textContent).toContain("80 sampai 100");
    expect(wadah?.textContent).toContain("50 sampai 79");
    expect(wadah?.textContent).toContain("di bawah 50");
    expect(
      wadah?.querySelector("svg[aria-label^='Skala skor']"),
    ).not.toBeNull();
  });

  it("menampilkan kerangka muat selagi status masuk masih diperiksa", async () => {
    const ambil = vi.fn();
    vi.stubGlobal("fetch", ambil);
    await pasang("memeriksa");
    expect(ambil).not.toHaveBeenCalled();
    expect(wadah?.textContent).toContain("Memuat");
    expect(wadah?.querySelector('[role="status"]')).not.toBeNull();
  });

  it("menampilkan skor terakhir REAL bila sudah masuk", async () => {
    const ambil = vi.fn(async () =>
      responsSkor([
        {
          id: "hc-1",
          skor: 86,
          dibuat_pada: "2026-11-18T12:00:00.000Z",
        },
      ]),
    );
    vi.stubGlobal("fetch", ambil);
    await pasang("masuk");
    expect(ambil).toHaveBeenCalledWith(
      "/api/health-checks?limit=1",
      expect.objectContaining({ credentials: "include" }),
    );
    // Cincin skor menampilkan angka real 86 + kategori "Baik".
    expect(wadah?.textContent).toContain("86");
    expect(wadah?.textContent).toContain("Baik");
    expect(wadah?.textContent).toContain("Skor terakhir Anda");
    // Tanggal tengah hari UTC agar stabil di zona waktu mana pun.
    expect(wadah?.textContent).toContain("18 November 2026");
    expect(wadah?.querySelector('a[href="/dashboard"]')).not.toBeNull();
    expect(
      wadah?.querySelector("svg[aria-label^='Skor Anda 86 dari 100']"),
    ).not.toBeNull();
  });

  it("keadaan kosong jujur bila sudah masuk tetapi belum ada pemeriksaan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsSkor([])));
    await pasang("masuk");
    expect(wadah?.textContent).toContain("Belum ada pemeriksaan");
    expect(wadah?.textContent).toContain(
      "Jalankan pemeriksaan pertama untuk melihat skor HP di sini.",
    );
    const tautan = wadah?.querySelector('a[href="/wifi"]');
    expect(tautan).not.toBeNull();
  });

  it("keadaan galat menampilkan pesan + Coba lagi; retry yang berhasil menampilkan skor", async () => {
    let panggilan = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        panggilan += 1;
        if (panggilan === 1) throw new Error("jaringan putus");
        return responsSkor([
          { id: "hc-2", skor: 42, dibuat_pada: "2026-11-18T12:00:00.000Z" },
        ]);
      }),
    );
    await pasang("masuk");
    expect(wadah?.textContent).toContain("Skor tidak dapat dimuat saat ini.");
    const tombolCobaLagi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    expect(tombolCobaLagi?.disabled).toBe(false);
    await act(async () => {
      tombolCobaLagi?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {});
    expect(wadah?.textContent).toContain("42");
    expect(wadah?.textContent).toContain("Bermasalah");
    expect(panggilan).toBe(2);
  });

  it("sesi habis (401) menampilkan pesan sesi + tautan Masuk, bukan Coba lagi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respons401()));
    await pasang("masuk");
    expect(wadah?.textContent).toContain("Sesi sudah berakhir");
    expect(wadah?.textContent).toContain(
      "Sesi sudah berakhir. Masuk lagi untuk lanjut.",
    );
    expect(
      wadah?.querySelector('a[href="/masuk"]'),
    ).not.toBeNull();
    const tombolCobaLagi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Coba lagi");
    expect(tombolCobaLagi).toBeUndefined();
  });

  it("menampilkan ketiga keunggulan, batasan, dan catatan kejujuran", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await pasang("tidak-masuk");
    expect(wadah?.textContent).toContain("Tes WiFi sungguhan");
    expect(wadah?.textContent).toContain("Penjelasan yang mudah dipahami");
    expect(wadah?.textContent).toContain("Riwayat tersimpan di akun");
    expect(wadah?.textContent).toContain("Yang perlu diketahui");
    expect(wadah?.textContent).toContain(
      "Versi web mengukur koneksi Anda",
    );
    expect(wadah?.textContent).toContain(
      "Dokter HP tidak menjanjikan HP jadi lebih cepat.",
    );
  });

  it("menampilkan semua panduan dengan tautan yang benar", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await pasang("tidak-masuk");
    expect(PANDUAN.length).toBeGreaterThan(0);
    for (const panduan of PANDUAN) {
      const tautan = wadah?.querySelector(
        `a[href="/panduan/${panduan.slug}"]`,
      );
      expect(tautan, `tautan panduan ${panduan.slug}`).not.toBeNull();
      expect(tautan?.textContent).toContain(panduan.judul);
    }
  });

  it("menampilkan tautan aplikasi Android tanpa logo tiruan", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await pasang("tidak-masuk");
    const tautan = wadah?.querySelector(
      'a[href="https://github.com/adiprmx/dokter-hp"]',
    );
    expect(tautan).not.toBeNull();
    expect(tautan?.textContent).toContain(
      "Lihat aplikasi Dokter HP untuk Android",
    );
    expect(tautan?.getAttribute("target")).toBe("_blank");
    expect(tautan?.getAttribute("rel")).toContain("noreferrer");
    // Tanpa logo Android (tidak ada SVG resmi di repo; logo tiruan dilarang).
    expect(tautan?.querySelector("svg, img")).toBeNull();
  });
});
