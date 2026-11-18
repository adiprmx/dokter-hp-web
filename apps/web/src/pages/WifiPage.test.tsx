// apps/web/src/pages/WifiPage.test.tsx
// Tes WifiPage (redesign v2.0): keadaan idle, tamu, galat server,
// alur tes utama (mock pengukuran), verdict tes bertahan berwarna
// lewat helper status-warna, dan rekomendasi yang sesuai hasil.
// Pola pasang mengikuti MasukPage.test.tsx; fetch diganti (stub)
// seperti api.test.ts; pengukuran jaringan di-mock lewat vi.mock
// modul speedtest (fungsi murni tetap asli) — tidak ada panggilan
// jaringan nyata dan tidak ada unduhan file tes.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WifiPage from "./WifiPage";

// Batas per tes 20 detik (preseden: AiPage.test.tsx). Bukan
// pelonggaran asersi: tiap tes di file ini menjalankan alur
// komponen penuh dengan jeda produksi nyata (350 ms + 200 ms
// per jalan tes, dua kali untuk tes retry) sehingga sendirian
// saja sudah 0,4–4,8 detik; di bawah beban suite penuh paralel
// nilai bawaan vitest (5 detik) habis sebelum alur selesai.
vi.setConfig({ testTimeout: 20_000 });

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// vi.hoisted: pabrik vi.mock di-hoist, jadi mock harus dibuat
// lewat hoisted agar bisa dirujuk dari dalam pabrik.
const { mockUnduh, mockLatensi, mockBertahan } = vi.hoisted(() => ({
  mockUnduh: vi.fn(),
  mockLatensi: vi.fn(),
  mockBertahan: vi.fn(),
}));

vi.mock("../lib/speedtest", async (imporAsli) => {
  const asli = await imporAsli<typeof import("../lib/speedtest")>();
  return {
    ...asli,
    bacaInfoJaringan: () => ({
      jenisKoneksi: "WiFi",
      downlinkMbps: 50,
      hematData: false,
    }),
    ukurKecepatanUnduh: (...args: unknown[]) => mockUnduh(...args),
    ukurLatensiHttp: (...args: unknown[]) => mockLatensi(...args),
    jalankanTesBertahan: (...args: unknown[]) => mockBertahan(...args),
  };
});

/** Respons JSON palsu (pola responsJson api.test.ts). */
function responsJson(badan: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => badan,
  } as unknown as Response;
}

function amplop(data: unknown): Record<string, unknown> {
  return {
    success: true,
    data,
    meta: { timestamp: "2026-11-18T00:00:00.000Z" },
  };
}

describe("WifiPage (redesign v2.0)", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;
  // Saklar stub fetch per tes.
  let masuk = false;
  let serverSehat = true;
  let riwayat: unknown[] = [];
  let riwayatGalat = false;

  function pasangFetch(): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/auth/me")) {
          return masuk
            ? responsJson(amplop({ nama: "ADIP RMX" }))
            : responsJson(
                {
                  success: false,
                  error: { code: "UNAUTHORIZED", message: "Belum masuk." },
                },
                false,
                401,
              );
        }
        if (url.includes("/api/health")) {
          return serverSehat
            ? responsJson(amplop({ status: "ok" }))
            : responsJson(
                {
                  success: false,
                  error: { code: "GALAT", message: "Server mati." },
                },
                false,
                500,
              );
        }
        if (url.includes("/api/wifi-reports")) {
          return riwayatGalat
            ? responsJson(
                {
                  success: false,
                  error: { code: "GALAT", message: "Gagal memuat." },
                },
                false,
                500,
              )
            : responsJson(amplop(riwayat));
        }
        throw new Error(`URL tak terduga: ${url}`);
      }),
    );
  }

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/wifi"]}>
          <Routes>
            <Route path="/wifi" element={<WifiPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch status selesai dan setState ter-flush.
    await act(async () => {});
  }

  /**
   * Tunggu sampai cek() benar (polling di dalam act). Batas 15 detik
   * adalah jaring pengaman keterjagaan (tetap berbatas, bukan hang):
   * sengaja di bawah testTimeout 20 detik agar pesannya yang muncul
   * bila kondisi benar-benar tidak tercapai.
   */
  async function tunggu(cek: () => boolean, batasMs = 15_000): Promise<void> {
    const mulai = Date.now();
    for (;;) {
      await act(async () => {
        await new Promise((selesai) => setTimeout(selesai, 50));
      });
      if (cek()) return;
      if (Date.now() - mulai > batasMs) {
        throw new Error("Batas waktu tunggu tercapai.");
      }
    }
  }

  function tombolDenganTeks(teks: string): HTMLButtonElement | null {
    const tombol = wadah?.querySelectorAll("button") ?? [];
    for (const el of tombol) {
      if (el.textContent === teks) return el as HTMLButtonElement;
    }
    return null;
  }

  beforeEach(() => {
    masuk = false;
    serverSehat = true;
    riwayat = [];
    riwayatGalat = false;
    mockUnduh.mockReset();
    mockLatensi.mockReset();
    mockBertahan.mockReset();
    mockUnduh.mockResolvedValue({ kbps: 1200, byte: 1024000, durasiMs: 853 });
    mockLatensi.mockResolvedValue({
      medianMs: 42,
      sampelMs: [42],
      ip: "203.0.113.7",
    });
    localStorage.clear();
    pasangFetch();
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

  it("idle tamu: judul, tombol tes, empty state, banner tamu, tanpa banner server", async () => {
    await pasang();
    await tunggu(() => (wadah?.textContent ?? "").includes("Anda belum masuk"));
    expect(wadah?.querySelector("h1")?.textContent).toBe("Dokter WiFi");
    expect(tombolDenganTeks("Periksa WiFi sekarang")).not.toBeNull();
    expect(wadah?.textContent).toContain("Belum ada tes WiFi");
    expect(wadah?.textContent).toContain(
      "Ketuk Periksa WiFi sekarang untuk mengukur kecepatan koneksi yang sedang dipakai.",
    );
    // Semua tahap belum dimulai.
    expect(wadah?.textContent).toContain("Belum dimulai");
    // Server sehat: tidak ada banner peringatan server.
    expect(wadah?.textContent).not.toContain("Tidak tersambung ke server");
    // Belum ada hasil: tidak ada kartu hasil maupun info jaringan.
    expect(wadah?.querySelector("#judul-hasil")).toBeNull();
    expect(wadah?.querySelector("#judul-jaringan")).toBeNull();
  });

  it("banner server tampil bila health check gagal", async () => {
    serverSehat = false;
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Tidak tersambung ke server"),
    );
    expect(wadah?.textContent).toContain("Hasil tes tidak tersimpan.");
    expect(wadah?.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("tes utama (mock): angka hero besar + klasifikasi + info jaringan + cip tahap selesai", async () => {
    await pasang();
    await tunggu(() => (wadah?.textContent ?? "").includes("Anda belum masuk"));
    const tombol = tombolDenganTeks("Periksa WiFi sekarang");
    expect(tombol).not.toBeNull();
    await act(async () => {
      tombol?.click();
    });
    await tunggu(() => wadah?.querySelector("#judul-hasil") !== null);
    // Angka hero dipisah angka/satuan: 1200 KB/detik = 1,2 MB/detik.
    expect(wadah?.textContent).toContain("1,2");
    expect(wadah?.textContent).toContain("MB/detik");
    // Klasifikasi kanonis 1200 KB/detik = "Cepat".
    expect(wadah?.textContent).toContain("Cepat");
    // Verdict utama berwarna token status (K-96): "Cepat" = hijau.
    const verdict = Array.from(wadah?.querySelectorAll("p") ?? []).find(
      (el) => el.textContent === "Cepat",
    );
    expect(verdict?.getAttribute("style") ?? "").toContain(
      "var(--color-success)",
    );
    // Keempat tahap selesai (cip "Selesai" muncul 4 kali).
    const selesai = [...(wadah?.querySelectorAll("span") ?? [])].filter(
      (el) => el.textContent === "Selesai",
    );
    expect(selesai.length).toBe(4);
    // Kartu info jaringan tampil dengan latensi + IP mock.
    expect(wadah?.querySelector("#judul-jaringan")).not.toBeNull();
    expect(wadah?.textContent).toContain("42 ms");
    expect(wadah?.textContent).toContain("203.0.113.7");
    expect(wadah?.textContent).toContain("WiFi");
    // Tamu: tidak ada tombol simpan, ada penjelasan.
    expect(tombolDenganTeks("Simpan laporan")).toBeNull();
    expect(wadah?.textContent).toContain(
      "Hasil tidak tersimpan karena Anda belum masuk.",
    );
  });

  it("tes gagal: panel galat + Coba lagi, lalu retry berhasil", async () => {
    mockUnduh.mockRejectedValueOnce(new Error("jaringan putus"));
    await pasang();
    await tunggu(() => (wadah?.textContent ?? "").includes("Anda belum masuk"));
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Tes WiFi tidak selesai."),
    );
    const cobaLagi = tombolDenganTeks("Coba lagi");
    expect(cobaLagi).not.toBeNull();
    expect(wadah?.querySelector("#judul-hasil")).toBeNull();
    await act(async () => {
      cobaLagi?.click();
    });
    await tunggu(() => wadah?.querySelector("#judul-hasil") !== null);
    expect(wadah?.textContent).toContain("Cepat");
  });

  it("verdict bertahan: label hijau + kalimat ringkasan + statistik nyata", async () => {
    mockBertahan.mockImplementation(async (onSampel: (s: unknown) => void) => {
      const daftar = Array.from({ length: 30 }, (_, i) => ({
        detikKe: i,
        kbps: 2000,
      }));
      daftar.forEach((s) => onSampel(s));
      return daftar;
    });
    await pasang();
    await tunggu(() => (wadah?.textContent ?? "").includes("Anda belum masuk"));
    await act(async () => {
      tombolDenganTeks("Tes bertahan 30 detik")?.click();
    });
    await tunggu(
      () => wadah?.querySelector('[data-testid="panel-verdict"]') !== null,
    );
    const panel = wadah?.querySelector('[data-testid="panel-verdict"]');
    expect(panel?.textContent).toContain("Bertahan");
    expect(panel?.textContent).toContain("Kecepatan stabil selama 30 detik.");
    // Statistik nyata dari sampel mock (konstan 2000 KB/detik).
    expect(panel?.textContent).toContain("Rata-rata");
    expect(panel?.textContent).toContain("2,0 MB/detik");
    // Tinta panel berasal dari token status sukses (helper status-warna).
    expect(panel?.getAttribute("style") ?? "").toContain(
      "var(--color-success-bg)",
    );
    // Grafik tampil (judul + svg).
    expect(wadah?.textContent).toContain("Kecepatan per detik");
    expect(wadah?.querySelector("svg")).not.toBeNull();
  });

  it("verdict jatuh: label merah + kalimat jatuh", async () => {
    mockBertahan.mockImplementation(async (onSampel: (s: unknown) => void) => {
      const daftar = Array.from({ length: 30 }, (_, i) => ({
        detikKe: i,
        kbps: i < 5 ? 2000 : 100,
      }));
      daftar.forEach((s) => onSampel(s));
      return daftar;
    });
    await pasang();
    await tunggu(() => (wadah?.textContent ?? "").includes("Anda belum masuk"));
    await act(async () => {
      tombolDenganTeks("Tes bertahan 30 detik")?.click();
    });
    await tunggu(
      () => wadah?.querySelector('[data-testid="panel-verdict"]') !== null,
    );
    const panel = wadah?.querySelector('[data-testid="panel-verdict"]');
    expect(panel?.textContent).toContain("Jatuh");
    expect(panel?.textContent).toContain("lalu jatuh ke");
    expect(panel?.getAttribute("style") ?? "").toContain(
      "var(--color-error-bg)",
    );
  });

  it("verdict tidak stabil untuk kecepatan konstan tapi lambat", async () => {
    mockBertahan.mockImplementation(async (onSampel: (s: unknown) => void) => {
      const daftar = Array.from({ length: 30 }, (_, i) => ({
        detikKe: i,
        kbps: 500,
      }));
      daftar.forEach((s) => onSampel(s));
      return daftar;
    });
    await pasang();
    await tunggu(() => (wadah?.textContent ?? "").includes("Anda belum masuk"));
    await act(async () => {
      tombolDenganTeks("Tes bertahan 30 detik")?.click();
    });
    await tunggu(
      () => wadah?.querySelector('[data-testid="panel-verdict"]') !== null,
    );
    const panel = wadah?.querySelector('[data-testid="panel-verdict"]');
    // Ambang kanonis: rata-rata < 1000 KB/detik bukan "bertahan".
    expect(panel?.textContent).toContain("Tidak stabil");
    // Kalimat panel sepakat dengan verdict (tanpa klaim "naik turun":
    // kecepatan di sini konstan, bukan naik turun).
    expect(panel?.textContent).toContain(
      "Kecepatan tidak stabil selama 30 detik.",
    );
    expect(panel?.textContent).not.toContain(
      "Kecepatan stabil selama 30 detik.",
    );
    expect(panel?.getAttribute("style") ?? "").toContain(
      "var(--color-warning-bg)",
    );
  });

  it("rekomendasi: 6 saran, yang sesuai hasil memakai kartu info + cip", async () => {
    // 40 KB/detik: sangat lambat -> saran mode router + channel sesuai.
    mockUnduh.mockResolvedValue({ kbps: 40, byte: 40960, durasiMs: 1024 });
    await pasang();
    await tunggu(() => (wadah?.textContent ?? "").includes("Anda belum masuk"));
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(() => wadah?.querySelector("#judul-hasil") !== null);
    const teks = wadah?.textContent ?? "";
    expect(teks).toContain("Coba mendekat ke router, lalu tes lagi.");
    expect(teks).toContain("Periksa mode router di halaman pengaturan router.");
    expect(teks).toContain("Coba lupakan jaringan WiFi ini");
    // Cip "paling sesuai" tampil untuk saran yang cocok dengan hasil.
    expect(teks).toContain("Paling sesuai dengan hasil tes Anda.");
    // Kartu saran yang sesuai memakai tinta info (token status):
    // telusuri ancestor cip sampai Card bertinta info ditemukan.
    const cip = [...(wadah?.querySelectorAll("span") ?? [])].find(
      (el) => el.textContent === "Paling sesuai dengan hasil tes Anda.",
    );
    expect(cip).not.toBeUndefined();
    let el: Element | null | undefined = cip;
    let diDalamKartuInfo = false;
    while (el) {
      if (
        (el.getAttribute("style") ?? "").includes("var(--color-info-bg)")
      ) {
        diDalamKartuInfo = true;
        break;
      }
      el = el.parentElement;
    }
    expect(diDalamKartuInfo).toBe(true);
    // Tautan panduan tetap ada.
    expect(
      wadah?.querySelector('a[href="#panduan-wifi-lemot"]'),
    ).not.toBeNull();
  });

  it("masuk: riwayat tampil + tombol simpan tersedia", async () => {
    masuk = true;
    riwayat = [
      {
        id: "lap-1",
        ssid: "WiFi Rumah",
        kecepatan_koneksi_mbps: null,
        kekuatan_sinyal: "sedang",
        channel: 6,
        dns: null,
        ping_ms: 42,
        rekomendasi: null,
        kecepatan_unduh_kbps: 1200,
        sumber: "web",
        durasi_tes_detik: null,
        dibuat_pada: "2026-11-18T07:00:00.000Z",
      },
    ];
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Tes WiFi, 1,2 MB/detik (Cepat)"),
    );
    expect(wadah?.textContent).toContain("Latensi HTTP 42 ms");
    expect(wadah?.textContent).toContain("Dari tes web");
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(
      () => tombolDenganTeks("Simpan laporan") !== null,
    );
  });

  it("masuk tanpa riwayat: empty state riwayat", async () => {
    masuk = true;
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Belum ada riwayat tes"),
    );
    expect(wadah?.textContent).toContain(
      "Hasil tes yang sudah dijalankan akan tampil di sini.",
    );
  });

  it("riwayat gagal dimuat: panel galat + Coba lagi", async () => {
    masuk = true;
    riwayatGalat = true;
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Data tidak bisa dimuat."),
    );
    expect(tombolDenganTeks("Coba lagi")).not.toBeNull();
  });
});
