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
import { formatKecepatan } from "../lib/speedtest";
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
  // Saklar + pencatat simpan skor (Bug 2): POST /api/health-checks
  // yang dikirim simpanLaporan sesudah laporan WiFi tersimpan.
  let kesehatanGalat = false;
  let panggilanKesehatan: Record<string, unknown>[] = [];
  let urutanPost: string[] = [];
  // Pencatat payload simpan WiFi (K-111): badan POST
  // /api/wifi-reports dan sampel POST .../samples, untuk
  // membuktikan nilai mentah yang dikirim (tanpa pra-pembulatan).
  let panggilanWifi: Record<string, unknown>[] = [];
  let panggilanSampel: Record<string, unknown>[][] = [];

  function pasangFetch(): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { method?: string; body?: unknown }) => {
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
        // Cabang health-checks HARUS sebelum "/api/health": includes
        // "/api/health" ikut cocok dengan "/api/health-checks".
        if (url.includes("/api/health-checks")) {
          urutanPost.push("/api/health-checks");
          if (kesehatanGalat) {
            return responsJson(
              {
                success: false,
                error: { code: "GALAT", message: "Gagal menyimpan skor." },
              },
              false,
              500,
            );
          }
          const badan = JSON.parse(
            String(init?.body ?? "{}"),
          ) as Record<string, unknown>;
          panggilanKesehatan.push(badan);
          // Gema badan seperti respons 201 server (agar
          // simpanEntriDokter bisa mengurai round-trip-nya).
          return responsJson(
            amplop({
              id: "hc-1",
              skor: badan.skor,
              ringkasan: badan.ringkasan,
              dibuat_pada: "2026-11-18T08:00:00.000Z",
            }),
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
          if (init?.method === "POST") {
            if (url.includes("/samples")) {
              urutanPost.push("/api/wifi-reports/samples");
              const badanSampel = JSON.parse(
                String(init?.body ?? "{}"),
              ) as { samples: Record<string, unknown>[] };
              panggilanSampel.push(badanSampel.samples);
              return responsJson(amplop({ tersimpan: 30 }));
            }
            urutanPost.push("/api/wifi-reports");
            const badanWifi = JSON.parse(
              String(init?.body ?? "{}"),
            ) as Record<string, unknown>;
            panggilanWifi.push(badanWifi);
            // Gema ke riwayat seperti server: simpanLaporan
            // memuat ulang riwayat sesudah simpan, jadi entri
            // tersimpan tampil (K-111: string tampilnya wajib
            // sama dengan halaman hasil).
            riwayat = [
              ...riwayat,
              {
                id: "lap-baru",
                ...badanWifi,
                dibuat_pada: "2026-11-18T08:00:00.000Z",
              },
            ];
            return responsJson(
              amplop({
                id: "lap-baru",
                ssid: null,
                kecepatan_koneksi_mbps: null,
                kekuatan_sinyal: null,
                channel: null,
                dns: null,
                ping_ms: null,
                rekomendasi: null,
                kecepatan_unduh_kbps: 1200,
                sumber: "web",
                durasi_tes_detik: null,
                dibuat_pada: "2026-11-18T08:00:00.000Z",
              }),
            );
          }
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
    kesehatanGalat = false;
    panggilanKesehatan = [];
    urutanPost = [];
    panggilanWifi = [];
    panggilanSampel = [];
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

  it("masuk: catatan simpan jujur — simpan manual via tombol, tanpa klaim otomatis", async () => {
    // Bug 1: catatan lama "Hasil tersimpan otomatis ke riwayat."
    // bohong — simpanLaporan() hanya jalan dari onClick tombol
    // "Simpan laporan", tidak ada auto-save. Catatan wajib jujur.
    masuk = true;
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Belum ada riwayat tes"),
    );
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(() => tombolDenganTeks("Simpan laporan") !== null);
    const teks = wadah?.textContent ?? "";
    expect(teks).toContain(
      "Ketuk Simpan laporan untuk menyimpan hasil ke riwayat.",
    );
    expect(teks).not.toContain("tersimpan otomatis");
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

  it("simpan: sesudah laporan tersimpan, skor WiFi dikirim ke health-checks", async () => {
    masuk = true;
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Belum ada riwayat tes"),
    );
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(() => tombolDenganTeks("Simpan laporan") !== null);
    await act(async () => {
      tombolDenganTeks("Simpan laporan")?.click();
    });
    await tunggu(() => tombolDenganTeks("Sudah tersimpan") !== null);
    expect(wadah?.textContent).toContain("Hasil tes tersimpan ke riwayat.");
    // Urutan: laporan WiFi dulu, skor sesudahnya.
    expect(urutanPost).toEqual(["/api/wifi-reports", "/api/health-checks"]);
    expect(panggilanKesehatan.length).toBe(1);
    // Mock: 1200 KB/detik + 42 ms, tanpa tes bertahan ->
    // subskor 71,5/100, tertimbang (2x71,5+100)/3 = 81 -> dibatasi 79.
    const badan = panggilanKesehatan[0];
    expect(badan.skor).toBe(79);
    const wifi = (
      badan.ringkasan as Record<string, Record<string, unknown>>
    ).wifi;
    expect(wifi).toMatchObject({
      status: "cukup",
      skor: 79,
      sumber: "web",
    });
    expect(wifi.ringkasan_teks).toContain("Skor ini hanya dari tes WiFi");
  });

  it("simpan: health-checks gagal -> pesan jujur, laporan tetap ditandai tersimpan", async () => {
    masuk = true;
    kesehatanGalat = true;
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Belum ada riwayat tes"),
    );
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(() => tombolDenganTeks("Simpan laporan") !== null);
    await act(async () => {
      tombolDenganTeks("Simpan laporan")?.click();
    });
    await tunggu(() =>
      (wadah?.textContent ?? "").includes(
        "tetapi skor belum masuk ke dasbor",
      ),
    );
    // Laporan memang tersimpan: tombol tetap "Sudah tersimpan"
    // (K-110: simpan ulang akan menduplikasi laporan WiFi),
    // bukan galat total.
    expect(tombolDenganTeks("Sudah tersimpan")).not.toBeNull();
    expect(wadah?.textContent).not.toContain("Data tidak bisa disimpan.");
    expect(urutanPost).toEqual(["/api/wifi-reports", "/api/health-checks"]);
  });

  it("regresi K-111: 586,45 mentah tampil 586 di hasil dan riwayat, payload mentah", async () => {
    // Pemicu bug: 586,45 dibulatkan dulu ke 586,5 saat simpan,
    // lalu formatKecepatan(586,5) = "587 KB/detik" di riwayat
    // sementara halaman hasil menampilkan "586 KB/detik".
    // Payload wajib membawa nilai mentah; satu-satunya titik
    // pembulatan kecepatan adalah formatKecepatan saat tampil.
    // Tes ini GAGAL pada kode lama (payload 586,5 + riwayat 587).
    masuk = true;
    mockUnduh.mockResolvedValue({
      kbps: 586.45,
      byte: 600000,
      durasiMs: 1023,
    });
    mockBertahan.mockImplementation(async (onSampel: (s: unknown) => void) => {
      const daftar = Array.from({ length: 30 }, (_, i) => ({
        detikKe: i,
        kbps: 586.45,
      }));
      daftar.forEach((s) => onSampel(s));
      return daftar;
    });
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Belum ada riwayat tes"),
    );
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(() => wadah?.querySelector("#judul-hasil") !== null);
    // Halaman hasil: hero "586" + "KB/detik", klasifikasi Cukup.
    const seksiHasil = wadah?.querySelector(
      'section[aria-labelledby="judul-hasil"]',
    );
    expect(seksiHasil?.textContent).toContain("586");
    expect(seksiHasil?.textContent).toContain("KB/detik");
    expect(seksiHasil?.textContent).toContain("Cukup");
    expect(formatKecepatan(586.45)).toBe("586 KB/detik");
    // Tes bertahan penuh (30 sampel) agar sampel ikut tersimpan.
    await act(async () => {
      tombolDenganTeks("Tes bertahan 30 detik")?.click();
    });
    await tunggu(
      () => wadah?.querySelector('[data-testid="panel-verdict"]') !== null,
    );
    await act(async () => {
      tombolDenganTeks("Simpan laporan")?.click();
    });
    await tunggu(() => tombolDenganTeks("Sudah tersimpan") !== null);
    // Payload membawa nilai MENTAH, bukan 586,5 hasil bulat.
    expect(panggilanWifi.length).toBe(1);
    expect(panggilanWifi[0].kecepatan_unduh_kbps).toBe(586.45);
    // Sampel bertahan ikut mentah (30 sampel @ 586,45).
    expect(panggilanSampel.length).toBe(1);
    expect(panggilanSampel[0].length).toBe(30);
    for (const sampel of panggilanSampel[0]) {
      expect(sampel.kecepatan_kbps).toBe(586.45);
    }
    // Entri riwayat dari nilai tersimpan tampil IDENTIK dengan
    // halaman hasil — bukan "587 KB/detik" seperti kode lama.
    expect(formatKecepatan(
      panggilanWifi[0].kecepatan_unduh_kbps as number,
    )).toBe("586 KB/detik");
    await tunggu(() =>
      (wadah?.textContent ?? "").includes(
        "Tes WiFi, 586 KB/detik (Cukup)",
      ),
    );
    const seksiRiwayat = wadah?.querySelector(
      'section[aria-labelledby="judul-riwayat"]',
    );
    expect(seksiRiwayat?.textContent).toContain(
      "Tes WiFi, 586 KB/detik (Cukup)",
    );
    expect(seksiRiwayat?.textContent).not.toContain("587 KB/detik");
  });

  it("regresi K-111 (tepi): 100,45 mentah tampil 100 di hasil dan riwayat", async () => {
    // Nilai tepi: 100,45 ada di batas cabang >= 100 KB/detik
    // (toFixed(0)). Kode lama: payload 100,5 -> riwayat
    // "101 KB/detik", hasil "100 KB/detik". Kode baru: keduanya
    // "100 KB/detik" dari nilai mentah 100,45.
    masuk = true;
    mockUnduh.mockResolvedValue({
      kbps: 100.45,
      byte: 102880,
      durasiMs: 1024,
    });
    await pasang();
    await tunggu(() =>
      (wadah?.textContent ?? "").includes("Belum ada riwayat tes"),
    );
    await act(async () => {
      tombolDenganTeks("Periksa WiFi sekarang")?.click();
    });
    await tunggu(() => wadah?.querySelector("#judul-hasil") !== null);
    const seksiHasil = wadah?.querySelector(
      'section[aria-labelledby="judul-hasil"]',
    );
    expect(seksiHasil?.textContent).toContain("100");
    expect(seksiHasil?.textContent).toContain("KB/detik");
    expect(formatKecepatan(100.45)).toBe("100 KB/detik");
    await act(async () => {
      tombolDenganTeks("Simpan laporan")?.click();
    });
    await tunggu(() => tombolDenganTeks("Sudah tersimpan") !== null);
    expect(panggilanWifi.length).toBe(1);
    expect(panggilanWifi[0].kecepatan_unduh_kbps).toBe(100.45);
    expect(formatKecepatan(
      panggilanWifi[0].kecepatan_unduh_kbps as number,
    )).toBe("100 KB/detik");
    await tunggu(() =>
      (wadah?.textContent ?? "").includes(
        "Tes WiFi, 100 KB/detik (Lambat)",
      ),
    );
    const seksiRiwayat = wadah?.querySelector(
      'section[aria-labelledby="judul-riwayat"]',
    );
    expect(seksiRiwayat?.textContent).toContain(
      "Tes WiFi, 100 KB/detik (Lambat)",
    );
    expect(seksiRiwayat?.textContent).not.toContain("101 KB/detik");
  });
});
