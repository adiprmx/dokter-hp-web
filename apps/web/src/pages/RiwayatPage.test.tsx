// apps/web/src/pages/RiwayatPage.test.tsx
// Tes RiwayatPage v2.0 (docs/redesign-v20-spec.md §8.5): daftar entri
// dengan cip skor berwarna lewat helper status-warna (ambang 80/50),
// filter per jenis + hitungan, paginasi cursor (catatan 100 entri
// terbaru dari meta.pagination.has_more), unduh PDF, hapus per entri,
// dan semua keadaan (memuat/skeleton, kosong jujur + CTA, galat +
// retry, sesi habis). Pola pasang mengikuti MasukPage.test.tsx
// (react-dom/client + act, tanpa testing-library); fetch diganti
// (stub) seperti api.test.ts — tidak ada panggilan jaringan nyata.
// generatePdf di-mock (lib/pdf asli dipakai untuk sisanya) agar tes
// tidak membuat berkas PDF sungguhan.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RiwayatPage from "./RiwayatPage";
import { generatePdf } from "../lib/pdf";

vi.mock("../lib/pdf", async (importOriginal) => {
  const asli = await importOriginal<typeof import("../lib/pdf")>();
  return { ...asli, generatePdf: vi.fn().mockResolvedValue(undefined) };
});

const pdfMock = vi.mocked(generatePdf);

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** Respons JSON palsu (pola responsJson api.test.ts). */
function responsJson(badan: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => badan,
  } as unknown as Response;
}

function envelopeRiwayat(
  daftar: unknown[],
  hasMore = false,
): Record<string, unknown> {
  return {
    success: true,
    data: daftar,
    meta: {
      timestamp: "2026-11-18T00:00:00.000Z",
      pagination: { has_more: hasMore },
    },
  };
}

function ringkasanBaik(): Record<string, unknown> {
  return {
    wifi: { status: "baik", skor: 90, sumber: "web" },
    baterai: { status: "cukup", skor: 70, sumber: "apk" },
    penyimpanan: { status: "perlu_perhatian", skor: 30, sumber: "manual" },
  };
}

function itemKesehatan(id: string, skor: number): Record<string, unknown> {
  return {
    jenis: "kesehatan",
    id,
    dibuat_pada: "2026-11-17T15:00:00.000Z",
    data: { skor, ringkasan: ringkasanBaik(), sync_status: "synced" },
  };
}

const ITEM_WIFI: Record<string, unknown> = {
  jenis: "wifi",
  id: "w1",
  dibuat_pada: "2026-11-16T10:00:00.000Z",
  data: {
    ssid: "WiFi Rumah",
    kecepatan_unduh_kbps: 1500,
    kekuatan_sinyal: "kuat",
    ping_ms: 24,
    sumber: "web",
    durasi_tes_detik: 30,
  },
};

const ITEM_AI: Record<string, unknown> = {
  jenis: "ai",
  id: "a1",
  dibuat_pada: "2026-11-15T09:00:00.000Z",
  data: {
    pertanyaan: "Kenapa HP saya cepat panas?",
    jawaban: "Periksa aplikasi yang berjalan di latar belakang.",
  },
};

const DAFTAR_CAMPURAN = [
  itemKesehatan("k85", 85),
  itemKesehatan("k30", 30),
  ITEM_WIFI,
  ITEM_AI,
];

describe("RiwayatPage v2.0", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;
  let panggilanFetch: Array<{ url: string; init?: unknown }> = [];

  function stubFetch(
    penangan: (url: string, init?: unknown) => Response | Promise<Response>,
  ): void {
    panggilanFetch = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: unknown) => {
        panggilanFetch.push({ url, init });
        return penangan(url, init);
      }),
    );
  }

  function stubRiwayat(daftar: unknown[], hasMore = false): void {
    stubFetch((url) => {
      if (url.includes("/api/history")) {
        return responsJson(envelopeRiwayat(daftar, hasMore));
      }
      if (url.includes("/api/auth/me")) {
        return responsJson({
          success: true,
          data: { nama: "Nama Tes", sesi_terkunci: false },
          meta: { timestamp: "2026-11-18T00:00:00.000Z" },
        });
      }
      return responsJson(
        { success: false, error: { code: "NOT_FOUND", message: "tidak ada" } },
        404,
      );
    });
  }

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/riwayat"]}>
          <Routes>
            <Route path="/riwayat" element={<RiwayatPage />} />
            <Route path="/dashboard" element={<p>Dasbor</p>} />
            <Route path="/masuk" element={<p>Masuk</p>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch selesai dan setState ter-flush.
    await act(async () => {});
  }

  function teks(): string {
    return wadah?.textContent ?? "";
  }

  function tombolDenganTeks(label: string): HTMLButtonElement | null {
    const semua = wadah?.querySelectorAll("button") ?? [];
    for (const tombol of semua) {
      if (tombol.textContent === label) return tombol as HTMLButtonElement;
    }
    return null;
  }

  beforeEach(() => {
    pdfMock.mockClear();
    pdfMock.mockResolvedValue(undefined);
  });

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

  it("memuat: teks + 3 kerangka meniru tata letak entri", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await pasang();
    expect(teks()).toContain("Mengambil data…");
    expect(wadah?.querySelectorAll(".dh-skeleton")).toHaveLength(3);
    expect(wadah?.querySelector('[role="status"]')).not.toBeNull();
  });

  it("skor 85: angka besar + cip Baik hijau token + strip meter", async () => {
    stubRiwayat([itemKesehatan("k85", 85)]);
    await pasang();
    // Cip skor: label kategori + latar token sukses dari helper.
    // Selektor rounded-full hanya mengenai StatusBadge, bukan teks
    // status komponen yang kebetulan berlabel sama.
    const cip = Array.from(
      wadah?.querySelectorAll("span.rounded-full") ?? [],
    ).find((el) => el.textContent === "Baik");
    expect(cip).not.toBeUndefined();
    expect(cip?.getAttribute("style") ?? "").toContain(
      "var(--color-success-bg)",
    );
    // Kartu bertinta status sukses (tinta + bingkai token).
    const kartu = cip?.closest("div.rounded-xl");
    const gayaKartu = kartu?.getAttribute("style") ?? "";
    expect(gayaKartu).toContain("var(--color-success-bg)");
    expect(gayaKartu).toContain("var(--color-success-border)");
    // Strip meter menyebut skor dan kategori di label aria.
    const meter = wadah?.querySelector('svg[role="img"]');
    expect(meter?.getAttribute("aria-label")).toBe("Skor 85 dari 100, Baik");
    // Status komponen diwarnai lewat helper (baterai cukup = kuning,
    // penyimpanan perlu perhatian = merah).
    const baris = Array.from(wadah?.querySelectorAll("li") ?? []).map(
      (el) => el.textContent ?? "",
    );
    expect(baris.some((b) => b.includes("Baterai: Perlu diperhatikan (skor 70)"))).toBe(
      true,
    );
    const spanMerah = Array.from(wadah?.querySelectorAll("span") ?? []).find(
      (el) =>
        el.textContent === "Bermasalah" &&
        !el.className.includes("rounded-full"),
    );
    expect(spanMerah?.getAttribute("style") ?? "").toContain(
      "var(--color-error)",
    );
  });

  it("ambang 80/50: skor 65 kuning Perlu diperhatikan, skor 30 merah Bermasalah", async () => {
    stubRiwayat([itemKesehatan("k65", 65), itemKesehatan("k30", 30)]);
    await pasang();
    const cip = Array.from(
      wadah?.querySelectorAll("span.rounded-full") ?? [],
    );
    const cipKuning = cip.find((el) => el.textContent === "Perlu diperhatikan");
    expect(cipKuning?.getAttribute("style") ?? "").toContain(
      "var(--color-warning-bg)",
    );
    const cipMerah = cip.find((el) => el.textContent === "Bermasalah");
    expect(cipMerah?.getAttribute("style") ?? "").toContain(
      "var(--color-error-bg)",
    );
  });

  it("menampilkan ketiga jenis entri + filter dan hitungan", async () => {
    stubRiwayat(DAFTAR_CAMPURAN);
    await pasang();
    expect(teks()).toContain("Pemeriksaan kesehatan");
    expect(teks()).toContain("Tes WiFi");
    expect(teks()).toContain("Diagnosis AI");
    expect(teks()).toContain("WiFi Rumah");
    expect(teks()).toContain("Kenapa HP saya cepat panas?");
    // Hitungan per filter: Semua 4, kesehatan 2, wifi 1, ai 1.
    expect(tombolDenganTeks("Semua (4)")).not.toBeNull();
    expect(tombolDenganTeks("Pemeriksaan kesehatan (2)")).not.toBeNull();
    expect(tombolDenganTeks("Tes WiFi (1)")).not.toBeNull();
    expect(tombolDenganTeks("Diagnosis AI (1)")).not.toBeNull();
    // Filter WiFi: hanya entri WiFi yang tampil.
    const tombolWifi = tombolDenganTeks("Tes WiFi (1)");
    await act(async () => {
      tombolWifi?.click();
    });
    expect(teks()).toContain("WiFi Rumah");
    expect(teks()).not.toContain("Kenapa HP saya cepat panas?");
    expect(tombolWifi?.getAttribute("aria-pressed")).toBe("true");
  });

  it("entri WiFi: kecepatan besar + klasifikasi + cip tes bertahan", async () => {
    stubRiwayat([ITEM_WIFI]);
    await pasang();
    expect(teks()).toContain("1,5 MB/detik");
    expect(teks()).toContain("(cepat)");
    expect(teks()).toContain("Tes bertahan 30 detik");
    expect(teks()).toContain("Latensi HTTP: 24 ms");
    expect(teks()).toContain("Kekuatan sinyal: Kuat");
  });

  it("kosong: EmptyState jujur + CTA ke pemeriksaan", async () => {
    stubRiwayat([]);
    await pasang();
    expect(teks()).toContain("Belum ada riwayat");
    expect(teks()).toContain(
      "Hasil pemeriksaan dan tes WiFi yang tersimpan akan tampil di sini.",
    );
    const cta = wadah?.querySelector('a[href="/dashboard"]');
    expect(cta?.textContent).toBe("Jalankan diagnosis");
  });

  it("filter kosong: pesan per filter tanpa CTA", async () => {
    stubRiwayat([itemKesehatan("k85", 85)]);
    await pasang();
    await act(async () => {
      tombolDenganTeks("Tes WiFi (0)")?.click();
    });
    expect(teks()).toContain("Belum ada riwayat untuk jenis ini");
    expect(wadah?.querySelector('a[href="/dashboard"]')).toBeNull();
  });

  it("galat: pesan + tombol Coba lagi memuat ulang", async () => {
    let gagal = true;
    stubFetch((url) => {
      if (url.includes("/api/history") && gagal) {
        return responsJson(
          { success: false, error: { code: "GALAT", message: "gagal" } },
          500,
        );
      }
      if (url.includes("/api/history")) {
        return responsJson(envelopeRiwayat([itemKesehatan("k85", 85)]));
      }
      return responsJson({
        success: true,
        data: { nama: "Nama Tes" },
        meta: { timestamp: "2026-11-18T00:00:00.000Z" },
      });
    });
    await pasang();
    expect(teks()).toContain("Data tidak bisa dimuat. Coba lagi.");
    gagal = false;
    await act(async () => {
      tombolDenganTeks("Coba lagi")?.click();
    });
    await act(async () => {});
    expect(teks()).toContain("Pemeriksaan kesehatan");
  });

  it("sesi habis (401): panel masuk lagi + tautan /masuk", async () => {
    stubFetch((url) => {
      if (url.includes("/api/history")) {
        return responsJson(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "sesi habis" },
          },
          401,
        );
      }
      return responsJson({
        success: true,
        data: { nama: "Nama Tes" },
        meta: { timestamp: "2026-11-18T00:00:00.000Z" },
      });
    });
    await pasang();
    expect(teks()).toContain("Sesi sudah berakhir. Masuk lagi untuk lanjut.");
    expect(wadah?.querySelector('a[href="/masuk"]')).not.toBeNull();
  });

  it("hapus: konfirmasi lalu entri hilang + pesan sukses", async () => {
    stubFetch((url, init) => {
      const metode = (init as { method?: string } | undefined)?.method;
      if (metode === "DELETE") {
        return responsJson({
          success: true,
          data: {},
          meta: { timestamp: "2026-11-18T00:00:00.000Z" },
        });
      }
      if (url.includes("/api/history")) {
        return responsJson(envelopeRiwayat(DAFTAR_CAMPURAN));
      }
      return responsJson({
        success: true,
        data: { nama: "Nama Tes" },
        meta: { timestamp: "2026-11-18T00:00:00.000Z" },
      });
    });
    await pasang();
    expect(teks()).toContain("WiFi Rumah");
    // Klik "Hapus" pertama (entri k85) lalu batal: tidak ada yang hilang.
    await act(async () => {
      tombolDenganTeks("Hapus")?.click();
    });
    expect(teks()).toContain("Hapus entri ini?");
    await act(async () => {
      tombolDenganTeks("Batal")?.click();
    });
    expect(teks()).not.toContain("Hapus entri ini?");
    // Hapus entri WiFi: tombol Hapus ke-3 (urutan k85, k30, wifi, ai).
    const tombolHapus = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).filter((b) => b.textContent === "Hapus");
    expect(tombolHapus).toHaveLength(4);
    await act(async () => {
      tombolHapus[2]?.click();
    });
    await act(async () => {
      tombolDenganTeks("Ya, hapus")?.click();
    });
    await act(async () => {});
    expect(teks()).not.toContain("WiFi Rumah");
    expect(teks()).toContain("Entri berhasil dihapus.");
    const hapus = panggilanFetch.find(
      (p) => p.url.includes("/api/history/wifi/w1"),
    );
    expect(hapus).not.toBeUndefined();
    expect(
      (hapus?.init as { method?: string } | undefined)?.method,
    ).toBe("DELETE");
  });

  it("PDF: tombol memanggil generatePdf dengan filter aktif + pesan sukses", async () => {
    stubRiwayat(DAFTAR_CAMPURAN);
    await pasang();
    await act(async () => {
      tombolDenganTeks("Unduh laporan PDF")?.click();
    });
    await act(async () => {});
    expect(pdfMock).toHaveBeenCalledTimes(1);
    const argumen = pdfMock.mock.calls[0]?.[0];
    expect(argumen?.judulFilter).toBe("Semua");
    expect(argumen?.entri).toHaveLength(4);
    expect(argumen?.namaPengguna).toBe("Nama Tes");
    expect(teks()).toContain("Laporan PDF berhasil diunduh.");
  });

  it("PDF: label tombol berubah selagi laporan dibuat", async () => {
    stubRiwayat([itemKesehatan("k85", 85)]);
    let selesaikan!: () => void;
    pdfMock.mockImplementationOnce(
      () =>
        new Promise<void>((selesai) => {
          selesaikan = selesai;
        }),
    );
    await pasang();
    await act(async () => {
      tombolDenganTeks("Unduh laporan PDF")?.click();
    });
    expect(tombolDenganTeks("Membuat laporan…")).not.toBeNull();
    await act(async () => {
      selesaikan();
    });
    await act(async () => {});
    expect(teks()).toContain("Laporan PDF berhasil diunduh.");
  });

  it("paginasi: has_more true menampilkan catatan 100 entri terbaru", async () => {
    stubRiwayat([itemKesehatan("k85", 85)], true);
    await pasang();
    expect(teks()).toContain("Menampilkan 100 entri terbaru.");
  });

  it("paginasi: has_more false tidak menampilkan catatan", async () => {
    stubRiwayat([itemKesehatan("k85", 85)], false);
    await pasang();
    expect(teks()).not.toContain("Menampilkan 100 entri terbaru.");
  });

  it("item rusak tidak menggagalkan daftar", async () => {
    stubRiwayat([
      { jenis: "kesehatan", id: "rusak" },
      itemKesehatan("k85", 85),
    ]);
    await pasang();
    expect(teks()).toContain("Pemeriksaan kesehatan");
    expect(tombolDenganTeks("Semua (1)")).not.toBeNull();
  });
});
