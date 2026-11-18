import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PengaturanPage from "./PengaturanPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** Info /api/auth/me palsu. */
function infoSaya(pinDiatur = true) {
  return {
    id: "u1",
    nama: "Adip",
    email: "adip@example.com",
    pin_diatur: pinDiatur,
    sesi_terkunci: false,
    sesi_kedaluwarsa_pada: "2026-11-19T00:00:00.000Z",
  };
}

/** Profil /api/account/profile palsu. */
function profil(nama = "Adip") {
  return {
    id: "u1",
    nama,
    email: "adip@example.com",
    dibuat_pada: "2026-11-01T00:00:00.000Z",
  };
}

/** Dua sesi palsu: satu sesi ini, satu sesi lain dengan IP terakhir. */
function duaSesi() {
  return [
    {
      id: "s1",
      saat_ini: true,
      user_agent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0",
      ip_terakhir: "203.0.113.10",
      dibuat_pada: "2026-11-18T10:00:00.000Z",
      kedaluwarsa_pada: "2026-11-25T10:00:00.000Z",
    },
    {
      id: "s2",
      saat_ini: false,
      user_agent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0",
      ip_terakhir: "198.51.100.20",
      dibuat_pada: "2026-11-17T09:00:00.000Z",
      kedaluwarsa_pada: "2026-11-24T09:00:00.000Z",
    },
  ];
}

/** Respons envelope sukses (pola api.test.ts). */
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

/** Respons galat envelope (status + kode kontrak). */
function responsGalat(status: number, code: string, message: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      success: false,
      error: { code, message },
    }),
  } as unknown as Response;
}

/** Respons ekspor JSON mentah (unduhData memakai fetch langsung). */
function responsEkspor(terpotong = false): Response {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ terpotong, profil: { nama: "Adip" } }),
    headers: {
      get: (nama: string) =>
        nama === "Content-Disposition"
          ? 'attachment; filename="dokter-hp-export-2026-11-18.json"'
          : null,
    },
  } as unknown as Response;
}

describe("PengaturanPage (redesign v2.0)", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;
  /** Catatan panggilan fetch: [url, init] per panggilan. */
  let panggilan: Array<[string, unknown]> = [];
  /** Sesi yang dikembalikan GET /api/account/sessions (bisa diubah tes). */
  let sesiAktif: ReturnType<typeof duaSesi> = duaSesi();
  /** pin_diatur yang dikembalikan /api/auth/me. */
  let pinDiatur = true;
  /** Bila true, GET /api/auth/me menjawab 401. */
  let me401 = false;
  /** Bila true, semua fetch melempar galat jaringan. */
  let jaringanPutus = false;

  /** fetch palsu yang merutekan berdasarkan URL. */
  function fetchPalsu(url: string, init?: RequestInit): Promise<Response> {
    panggilan.push([url, init]);
    if (jaringanPutus) {
      return Promise.reject(new Error("jaringan putus"));
    }
    const metode = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/auth/me")) {
      if (me401) {
        return Promise.resolve(
          responsGalat(401, "UNAUTHORIZED", "Sesi sudah berakhir."),
        );
      }
      return Promise.resolve(responsSukses(infoSaya(pinDiatur)));
    }
    if (url.endsWith("/api/account/profile") && metode === "GET") {
      return Promise.resolve(responsSukses(profil()));
    }
    if (url.endsWith("/api/account/profile") && metode === "PATCH") {
      const badan = JSON.parse(String(init?.body ?? "{}")) as { nama: string };
      return Promise.resolve(responsSukses(profil(badan.nama)));
    }
    if (url.includes("/api/account/sessions?") && metode === "GET") {
      return Promise.resolve(responsSukses(sesiAktif));
    }
    if (url.includes("/api/account/sessions/") && metode === "DELETE") {
      const id = url.split("/").pop() ?? "";
      sesiAktif = sesiAktif.filter((sesi) => sesi.id !== id);
      return Promise.resolve(responsSukses({}));
    }
    if (url.endsWith("/api/account/export")) {
      return Promise.resolve(responsEkspor(false));
    }
    if (url.endsWith("/api/account") && metode === "DELETE") {
      return Promise.resolve(responsSukses({}));
    }
    if (url.endsWith("/api/auth/logout")) {
      return Promise.resolve(responsSukses({}));
    }
    return Promise.reject(new Error(`URL tak terduga: ${url}`));
  }

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/pengaturan"]}>
          <Routes>
            <Route path="/" element={<p>Beranda</p>} />
            <Route path="/masuk" element={<p>Halaman masuk</p>} />
            <Route path="/kunci" element={<p>Halaman kunci</p>} />
            <Route path="/dashboard" element={<p>Dasbor</p>} />
            <Route path="/pengaturan/pin" element={<p>Atur PIN</p>} />
            <Route path="/pengaturan" element={<PengaturanPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await bersihJanji();
  }

  /** Biarkan rantai janji fetch + setState ter-flush sepenuhnya. */
  async function bersihJanji(): Promise<void> {
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await new Promise((selesai) => setTimeout(selesai, 0));
      });
    }
  }

  function cariTombol(label: string): HTMLButtonElement | undefined {
    return Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement | undefined;
  }

  async function klik(tombol: Element | undefined | null): Promise<void> {
    await act(async () => {
      tombol?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await bersihJanji();
  }

  /** Isi input terkontrol React lewat setter asli + event input. */
  function isiInput(el: HTMLInputElement, nilai: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(el, nilai);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
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
    panggilan = [];
    sesiAktif = duaSesi();
    pinDiatur = true;
    me401 = false;
    jaringanPutus = false;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("memuat: menampilkan teks muat + kerangka, tanpa isi profil", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await pasang();
    expect(wadah?.textContent).toContain("Mengambil data…");
    // Kerangka meniru tata letak akhir (bukan spinner generik).
    expect(wadah?.querySelectorAll(".dh-skeleton").length).toBeGreaterThan(0);
    expect(wadah?.querySelector("#nama-tampilan")).toBeNull();
  });

  it("siap: profil, sesi dengan IP terakhir, dan lencana sesi ini", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    const inputNama = wadah?.querySelector(
      "#nama-tampilan",
    ) as HTMLInputElement | null;
    expect(inputNama?.value).toBe("Adip");
    expect(wadah?.textContent).toContain("adip@example.com");
    // Label perangkat dari user agent + IP terakhir tiap sesi.
    expect(wadah?.textContent).toContain("Chrome di Android");
    expect(wadah?.textContent).toContain("Chrome di Windows");
    expect(wadah?.textContent).toContain("203.0.113.10");
    expect(wadah?.textContent).toContain("198.51.100.20");
    expect(wadah?.textContent).toContain("Sesi ini");
    // Tombol keluar hanya untuk sesi lain (satu tombol, bukan dua).
    const tombolKeluarSesi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).filter((b) => b.textContent?.trim() === "Keluar dari sesi ini");
    expect(tombolKeluarSesi).toHaveLength(1);
    expect(cariTombol("Keluar dari semua perangkat lain")).toBeDefined();
  });

  it("sesi kosong: empty state jujur + tombol muat ulang", async () => {
    sesiAktif = [];
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    expect(wadah?.textContent).toContain("Tidak ada sesi aktif");
    // Tidak ada daftar sesi di dalam bagian Sesi aktif.
    expect(
      wadah?.querySelector('section[aria-labelledby="judul-sesi"] ul'),
    ).toBeNull();
    const tombolMuatUlang = cariTombol("Muat ulang");
    expect(tombolMuatUlang).toBeDefined();
    // Muat ulang memanggil ulang /api/auth/me (muat() jalan lagi).
    const sebelum = panggilan.filter(([url]) => url.endsWith("/api/auth/me"));
    await klik(tombolMuatUlang);
    const sesudah = panggilan.filter(([url]) => url.endsWith("/api/auth/me"));
    expect(sesudah.length).toBe(sebelum.length + 1);
  });

  it("galat muat: alert + Coba lagi; retry yang berhasil menampilkan profil", async () => {
    jaringanPutus = true;
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    expect(wadah?.querySelector('[role="alert"]')?.textContent).toBe(
      "Data tidak bisa dimuat. Coba lagi.",
    );
    const tombolCobaLagi = cariTombol("Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    jaringanPutus = false;
    await klik(tombolCobaLagi);
    expect(
      (wadah?.querySelector("#nama-tampilan") as HTMLInputElement | null)
        ?.value,
    ).toBe("Adip");
  });

  it("401 saat memuat: diarahkan ke /masuk", async () => {
    me401 = true;
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    expect(wadah?.textContent).toContain("Halaman masuk");
    expect(wadah?.querySelector("#nama-tampilan")).toBeNull();
  });

  it("simpan nama: tombol nonaktif bila tidak berubah, PATCH + pesan sukses bila berubah", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    const tombolSimpan = cariTombol("Simpan nama");
    expect(tombolSimpan?.disabled).toBe(true);
    const inputNama = wadah?.querySelector(
      "#nama-tampilan",
    ) as HTMLInputElement;
    isiInput(inputNama, "  Budi  ");
    expect(tombolSimpan?.disabled).toBe(false);
    await klik(tombolSimpan);
    const patch = panggilan.find(
      ([url, init]) =>
        url.endsWith("/api/account/profile") &&
        (init as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patch).toBeDefined();
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
      nama: "Budi",
    });
    expect(wadah?.textContent).toContain("Nama berhasil disimpan.");
    expect(inputNama.value).toBe("Budi");
  });

  it("simpan nama kosong: pesan galat, tanpa panggilan PATCH", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    const inputNama = wadah?.querySelector(
      "#nama-tampilan",
    ) as HTMLInputElement;
    isiInput(inputNama, "   ");
    await klik(cariTombol("Simpan nama"));
    expect(wadah?.textContent).toContain("Nama tidak boleh kosong.");
    expect(
      panggilan.some(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toBe(false);
  });

  it("keluar dari satu sesi: DELETE dipanggil, sesi hilang dari daftar", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    const tombol = Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.trim() === "Keluar dari sesi ini",
    );
    await klik(tombol);
    expect(
      panggilan.some(
        ([url, init]) =>
          url.endsWith("/api/account/sessions/s2") &&
          (init as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toBe(true);
    expect(wadah?.textContent).toContain("Berhasil keluar dari sesi itu.");
    expect(wadah?.textContent).not.toContain("198.51.100.20");
    expect(wadah?.textContent).toContain("203.0.113.10");
  });

  it("keluar dari semua perangkat lain: hanya sesi lain yang dihapus", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    await klik(cariTombol("Keluar dari semua perangkat lain"));
    const hapus = panggilan.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "DELETE",
    );
    expect(hapus).toHaveLength(1);
    expect(hapus[0][0]).toContain("/api/account/sessions/s2");
    expect(wadah?.textContent).toContain(
      "Berhasil keluar dari semua perangkat lain.",
    );
    expect(wadah?.textContent).toContain("203.0.113.10");
    expect(wadah?.textContent).not.toContain("198.51.100.20");
  });

  it("ekspor: mengunduh JSON + pesan sukses", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    const buatUrl = vi.fn(() => "blob:tes");
    const cabutUrl = vi.fn();
    Object.assign(URL, {
      createObjectURL: buatUrl,
      revokeObjectURL: cabutUrl,
    });
    const klikTautan = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await pasang();
    await klik(cariTombol("Unduh data saya"));
    expect(
      panggilan.some(([url]) => url.endsWith("/api/account/export")),
    ).toBe(true);
    expect(buatUrl).toHaveBeenCalledTimes(1);
    expect(klikTautan).toHaveBeenCalledTimes(1);
    expect(wadah?.textContent).toContain("Data berhasil diunduh.");
  });

  it("hapus akun: konfirmasi HAPUS mengaktifkan tombol, DELETE lalu ke beranda", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    await klik(cariTombol("Hapus akun saya"));
    const input = wadah?.querySelector(
      "#konfirmasi-hapus",
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    const tombolYa = cariTombol("Ya, hapus akun saya");
    expect(tombolYa?.disabled).toBe(true);
    isiInput(input!, "hapus");
    expect(tombolYa?.disabled).toBe(true);
    isiInput(input!, "HAPUS");
    expect(tombolYa?.disabled).toBe(false);
    await klik(tombolYa);
    const hapus = panggilan.find(
      ([url, init]) =>
        url.endsWith("/api/account") &&
        (init as RequestInit | undefined)?.method === "DELETE",
    );
    expect(hapus).toBeDefined();
    expect(JSON.parse(String((hapus?.[1] as RequestInit).body))).toEqual({
      konfirmasi: "HAPUS",
    });
    expect(wadah?.textContent).toContain("Beranda");
  });

  it("hapus akun: Batal menutup konfirmasi tanpa memanggil DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    await klik(cariTombol("Hapus akun saya"));
    expect(wadah?.querySelector("#konfirmasi-hapus")).not.toBeNull();
    await klik(cariTombol("Batal"));
    expect(wadah?.querySelector("#konfirmasi-hapus")).toBeNull();
    expect(cariTombol("Hapus akun saya")).toBeDefined();
    expect(
      panggilan.some(([url]) => url.endsWith("/api/account")),
    ).toBe(false);
  });

  it("pengingat: tombol nonaktif bergaya eksplisit K-53, tanpa opacity-50", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    const tombol = cariTombol("Aktifkan pengingat");
    expect(tombol?.disabled).toBe(true);
    expect(tombol?.className).not.toContain("opacity-50");
    // Gaya nonaktif eksplisit varian secondary Button (bingkai + teks
    // nonaktif, tanpa kelas opasitas).
    expect(tombol?.className).toContain("disabled:border-[var(--color-surface-hover)]");
    expect(tombol?.className).toContain("disabled:text-[var(--color-text-disabled)]");
    expect(wadah?.textContent).toContain("Segera hadir");
  });

  it("tidak ada kelas opacity-50 di seluruh halaman", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    expect(wadah?.querySelectorAll('[class*="opacity-50"]')).toHaveLength(0);
  });

  it("PIN: lencana hijau bila diatur, kuning bila belum diatur", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    expect(wadah?.textContent).toContain("PIN aktif");
    expect(
      wadah?.querySelector('a[href="/pengaturan/pin"]')?.textContent,
    ).toBe("Ubah PIN");
  });

  it("PIN belum diatur: lencana peringatan + tautan Atur PIN", async () => {
    pinDiatur = false;
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    expect(wadah?.textContent).toContain("Belum diatur");
    expect(wadah?.textContent).toContain("Aplikasi langsung terbuka tanpa PIN.");
    expect(wadah?.textContent).not.toContain("PIN aktif");
  });

  it("keluar: POST logout lalu ke beranda", async () => {
    vi.stubGlobal("fetch", vi.fn(fetchPalsu));
    await pasang();
    await klik(cariTombol("Keluar"));
    expect(
      panggilan.some(
        ([url, init]) =>
          url.endsWith("/api/auth/logout") &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
    expect(wadah?.textContent).toContain("Beranda");
  });
});
