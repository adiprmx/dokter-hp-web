// apps/web/src/pages/DashboardPage.test.tsx
// Tes DashboardPage v2.0 (redesign "Alat ukur, hidup"):
// - Skor pahlawan + lencana kategori dari status REAL.
// - Kartu dokter memakai Card status + StatusBadge dengan status
//   REAL tiap dokter (dipindai dari seluruh riwayat yang dimuat,
//   bukan hanya baris terbaru); dokter tanpa data jujur
//   "Belum ada data"; Diagnosis AI tanpa lencana (bukan hasil ukur).
// - Daftar "Pemeriksaan terakhir" memakai layout proper + StatusBadge,
//   bukan format teks "Skor 85 — Baik — tanggal" (tanpa em dash).
// - Empty state jujur (EmptyState + CTA) saat belum ada pemeriksaan.
// - Keadaan memuat (kerangka + teks), galat + retry, 401, dan
//   diagnosis satu ketuk tetap berperilaku seperti v1.0.
// Pola pasang mengikuti MasukPage.test.tsx; fetch diganti (stub)
// seperti api.test.ts. Tidak ada panggilan jaringan nyata.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage, { type HealthCheck } from "./DashboardPage";
import { useAppStore } from "../store/useAppStore";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** Respons palsu sukses (envelope kontrak, pola api.test.ts). */
function responsData<T>(data: T): Response {
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

/** Respons palsu galat HTTP (envelope galat kontrak). */
function responsGalat(status: number, code: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      success: false,
      error: { code, message: "galat uji" },
    }),
  } as unknown as Response;
}

// Baris terbaru hanya berisi wifi + baterai; keamanan hanya ada di
// baris kedua (menguji pemindaian seluruh riwayat, bukan hanya baris
// terbaru); penyimpanan + performa tidak ada di baris mana pun.
const DATA_UJI: HealthCheck[] = [
  {
    id: "hc1",
    skor: 85,
    ringkasan: {
      wifi: { status: "baik", skor: 85, sumber: "web" },
      baterai: { status: "cukup", skor: 65, sumber: "manual" },
    },
    dibuat_pada: "2026-11-17T12:00:00.000Z",
  },
  {
    id: "hc2",
    skor: 68,
    ringkasan: {
      keamanan: { status: "perlu_perhatian", skor: 40, sumber: "apk" },
    },
    dibuat_pada: "2026-11-16T12:00:00.000Z",
  },
  {
    id: "hc3",
    skor: 45,
    ringkasan: {},
    dibuat_pada: "2026-11-15T12:00:00.000Z",
  },
];

const DIAGNOSIS_UJI = {
  id: "d1",
  pertanyaan: "Bagaimana kondisi HP saya?",
  jawaban: "Jawaban uji dari AI.",
  dibuat_pada: "2026-11-18T00:00:00.000Z",
};

/** Pasang stub fetch yang merutekan berdasarkan URL. */
function pasangFetch(
  pengendali: (url: string) => Response | Promise<Response>,
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => pengendali(String(url))),
  );
}

/** Stub baku: health-checks berisi DATA_UJI, diagnosis berisi DIAGNOSIS_UJI. */
function pasangFetchBaku(): void {
  pasangFetch((url) => {
    if (url.includes("/api/ai/diagnose")) return responsData(DIAGNOSIS_UJI);
    if (url.includes("/api/health-checks")) return responsData(DATA_UJI);
    throw new Error(`URL tidak terduga di tes: ${url}`);
  });
}

// Batas 15 dtk per tes: impor malas grafik + render penuh di VM
// bersama (CPU terbagi tim lain) bisa melewati bawaan 5 dtk.
// Vitest 5: opsi sebagai argumen ke-2 (bentuk 3-arg dihapus).
describe("DashboardPage v2.0", { timeout: 15000 }, () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch + import malas grafik selesai dan
    // setState ter-flush.
    await act(async () => {});
    await act(async () => {});
  }

  function cariTombol(teks: string): HTMLButtonElement | undefined {
    return Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent === teks,
    );
  }

  function kartuDokter(rute: string): Element | null {
    return wadah?.querySelector(`a[href="${rute}"]`) ?? null;
  }

  beforeEach(() => {
    // Store zustand bersifat global antar-tes: kembalikan ke awal
    // agar banner "tidak-terjangkau" dari satu tes tidak bocor.
    useAppStore.setState({
      apiStatus: "memeriksa",
      statusMasuk: "memeriksa",
      namaPengguna: null,
    });
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
    useAppStore.setState({
      apiStatus: "memeriksa",
      statusMasuk: "memeriksa",
      namaPengguna: null,
    });
  });

  it("memuat: kerangka meniru tata letak + teks Mengambil data", async () => {
    // Janji yang tidak pernah selesai: keadaan tetap "memuat".
    pasangFetch(() => new Promise<Response>(() => {}));
    await pasang();
    expect(wadah?.textContent).toContain("Mengambil data…");
    // Kerangka cincin skor (160 px) + kerangka kartu dokter dan baris.
    expect(wadah?.querySelectorAll(".dh-skeleton").length).toBeGreaterThan(0);
    const kerangkaCincin = wadah?.querySelector(
      ".dh-skeleton.rounded-full",
    ) as HTMLElement | null;
    expect(kerangkaCincin?.style.width).toBe("160px");
    expect(kerangkaCincin?.style.height).toBe("160px");
    // Belum ada klaim status apa pun selagi data belum tiba.
    expect(wadah?.textContent).not.toContain("Belum ada data");
  });

  it("skor pahlawan tampil dengan lencana kategori dari status REAL", async () => {
    pasangFetchBaku();
    await pasang();
    const hero = wadah?.querySelector(
      'section[aria-labelledby="judul-skor"]',
    );
    expect(hero?.textContent).toContain("Skor");
    expect(hero?.textContent).toContain("85");
    expect(hero?.textContent).toContain("dari 100");
    expect(hero?.textContent).toContain("Baik");
    expect(hero?.textContent).toContain("Diperiksa 17 November 2026");
    // "Dihitung dari" memakai lencana per komponen, bukan baris teks
    // ber-em dash.
    expect(hero?.textContent).toContain("Dihitung dari:");
    expect(hero?.textContent).toContain("WiFi");
    expect(hero?.textContent).toContain("Baterai");
    expect(hero?.textContent).not.toContain("—");
  });

  it("kartu dokter memakai status REAL tiap dokter", async () => {
    pasangFetchBaku();
    await pasang();
    // WiFi baik (baris terbaru), baterai cukup (baris terbaru).
    expect(kartuDokter("/wifi")?.textContent).toContain("Baik");
    expect(kartuDokter("/baterai")?.textContent).toContain(
      "Perlu diperhatikan",
    );
    // Keamanan perlu perhatian: hanya ada di baris KEDUA, jadi kartu
    // membuktikan pemindaian seluruh riwayat.
    expect(kartuDokter("/keamanan")?.textContent).toContain("Bermasalah");
    // Penyimpanan + performa tidak ada di baris mana pun: jujur.
    expect(kartuDokter("/penyimpanan")?.textContent).toContain(
      "Belum ada data",
    );
    expect(kartuDokter("/performa")?.textContent).toContain(
      "Belum ada data",
    );
    // Diagnosis AI bukan hasil ukur: tanpa lencana status apa pun.
    const kartuAi = kartuDokter("/ai")?.textContent ?? "";
    expect(kartuAi).toContain("Diagnosis AI");
    expect(kartuAi).not.toContain("Belum ada data");
    expect(kartuAi).not.toContain("Baik");
    expect(kartuAi).not.toContain("Perlu diperhatikan");
    expect(kartuAi).not.toContain("Bermasalah");
  });

  it("kartu dokter bertinta sesuai status REAL (Card status)", async () => {
    pasangFetchBaku();
    await pasang();
    // Card memakai token latar status lewat style (helper status-warna).
    const kartuWifi = kartuDokter("/wifi")?.querySelector(
      "div",
    ) as HTMLElement | null;
    expect(kartuWifi?.style.backgroundColor).toBe(
      "var(--color-success-bg)",
    );
    const kartuKeamanan = kartuDokter("/keamanan")?.querySelector(
      "div",
    ) as HTMLElement | null;
    expect(kartuKeamanan?.style.backgroundColor).toBe(
      "var(--color-error-bg)",
    );
    // Kartu tanpa data tetap netral (tanpa tinta status).
    const kartuPenyimpanan = kartuDokter("/penyimpanan")?.querySelector(
      "div",
    ) as HTMLElement | null;
    expect(kartuPenyimpanan?.style.backgroundColor).toBe("");
  });

  it("pemeriksaan terakhir: layout proper + lencana, tanpa format em dash", async () => {
    pasangFetchBaku();
    await pasang();
    const bagian = wadah?.querySelector(
      'section[aria-labelledby="judul-terakhir"]',
    );
    expect(bagian?.textContent).not.toContain("—");
    const baris = Array.from(bagian?.querySelectorAll("li") ?? []);
    expect(baris).toHaveLength(3);
    expect(baris[0]?.textContent).toContain("85");
    expect(baris[0]?.textContent).toContain("Baik");
    expect(baris[0]?.textContent).toContain("17 November 2026");
    expect(baris[1]?.textContent).toContain("68");
    expect(baris[1]?.textContent).toContain("Perlu diperhatikan");
    expect(baris[2]?.textContent).toContain("45");
    expect(baris[2]?.textContent).toContain("Bermasalah");
    // Tautan ke riwayat penuh tetap ada.
    expect(
      wadah?.querySelector('a[href="/riwayat"]')?.textContent,
    ).toContain("Lihat semua di Riwayat");
  });

  it("semua rute kartu dokter tetap ada", async () => {
    pasangFetchBaku();
    await pasang();
    for (const rute of [
      "/wifi",
      "/baterai",
      "/penyimpanan",
      "/performa",
      "/keamanan",
      "/ai",
    ]) {
      expect(kartuDokter(rute)).not.toBeNull();
    }
  });

  it("empty state jujur + CTA saat belum ada pemeriksaan", async () => {
    pasangFetch((url) => {
      if (url.includes("/api/health-checks")) return responsData([]);
      throw new Error(`URL tidak terduga di tes: ${url}`);
    });
    await pasang();
    // EmptyState hero + CTA ke Dokter WiFi (satu-satunya CTA kosong).
    expect(wadah?.textContent).toContain("Belum ada pemeriksaan");
    const cta = wadah?.querySelector('a[href="/wifi"]');
    expect(cta?.textContent).toContain("Mulai dari Dokter WiFi");
    // Grafik + pemeriksaan terakhir memakai teks kanonis tanpa CTA kedua.
    expect(wadah?.textContent).toContain("Belum ada data pemeriksaan");
    expect(wadah?.textContent).toContain(
      "Belum ada pemeriksaan. Ketuk Diagnosis satu ketuk untuk mulai.",
    );
    // Kelima kartu dokter jujur "Belum ada data" (AI tanpa lencana).
    const bagianDokter = wadah?.querySelector(
      'section[aria-labelledby="judul-dokter"]',
    );
    const jumlahBelumAda = (
      bagianDokter?.textContent?.match(/Belum ada data/g) ?? []
    ).length;
    expect(jumlahBelumAda).toBe(5);
  });

  it("galat jaringan: pesan + Coba lagi; retry yang berhasil menampilkan data", async () => {
    let panggilan = 0;
    pasangFetch((url) => {
      if (!url.includes("/api/health-checks")) {
        throw new Error(`URL tidak terduga di tes: ${url}`);
      }
      panggilan += 1;
      if (panggilan === 1) throw new Error("jaringan putus");
      return responsData(DATA_UJI);
    });
    await pasang();
    expect(wadah?.textContent).toContain("Tidak tersambung ke server");
    const tombolCobaLagi = cariTombol("Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    expect(tombolCobaLagi?.disabled).toBe(false);
    await act(async () => {
      tombolCobaLagi?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {});
    await act(async () => {});
    expect(panggilan).toBe(2);
    const hero = wadah?.querySelector(
      'section[aria-labelledby="judul-skor"]',
    );
    expect(hero?.textContent).toContain("85");
    // Banner tidak-terjangkau ikut hilang setelah retry berhasil.
    expect(wadah?.querySelector('[role="alert"]')).toBeNull();
  });

  it("401: panel belum masuk dengan tautan ke /masuk", async () => {
    pasangFetch((url) => {
      if (url.includes("/api/health-checks")) {
        return responsGalat(401, "UNAUTHORIZED");
      }
      throw new Error(`URL tidak terduga di tes: ${url}`);
    });
    await pasang();
    expect(wadah?.textContent).toContain("Anda belum masuk");
    expect(wadah?.querySelector('a[href="/masuk"]')?.textContent).toContain(
      "Masuk untuk menyimpan",
    );
    expect(wadah?.textContent).toContain(
      "Masuk untuk melihat skor dan riwayat pemeriksaan.",
    );
  });

  it("diagnosis satu ketuk: jawaban tampil + pesan status", async () => {
    pasangFetchBaku();
    await pasang();
    const tombol = cariTombol("Diagnosis satu ketuk");
    expect(tombol).toBeDefined();
    await act(async () => {
      tombol?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    await act(async () => {});
    expect(wadah?.textContent).toContain("Saran dari AI");
    expect(wadah?.textContent).toContain("Jawaban uji dari AI.");
    expect(wadah?.textContent).toContain(
      "Jawaban sudah tampil di bawah. Tanya jawab ini tersimpan ke riwayat.",
    );
    expect(
      wadah?.querySelector('a[href="/ai"]')?.textContent,
    ).toContain("Tanya lanjutan di Diagnosis AI");
  });

  it("tidak ada em dash di prosa halaman saat ada data", async () => {
    pasangFetchBaku();
    await pasang();
    expect(wadah?.textContent).not.toContain("—");
  });
});
