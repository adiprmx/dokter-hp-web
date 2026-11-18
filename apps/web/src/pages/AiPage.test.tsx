// apps/web/src/pages/AiPage.test.tsx
// Tes AiPage (redesign v2.0, spec §8.6): form tanya, label sumber
// jawaban yang jujur (badge "AI" vs "Aturan"), strip kuota harian
// sebagai meter bermakna, kerangka muat saat jawaban disiapkan,
// riwayat dalam kartu rapi, dan semua keadaan (idle/empty, memuat,
// jawaban, galat + retry, kuota habis, sesi berakhir/terkunci).
// Pola pasang mengikuti MasukPage.test.tsx; fetch diganti (stub)
// seperti api.test.ts, tidak ada panggilan jaringan nyata.
// Logika yang ditegaskan di sini adalah perilaku (bukan kelas CSS):
// label sumber, hitung kuota, simpan riwayat, fokus, dan retry.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiPage from "./AiPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// VM bersama yang padat membuat render + flush act() per tes bisa
// memakan beberapa detik; batas 5 detik bawaan terlalu ketat dan
// menimbulkan kegagalan palsu (bukan asersi yang dilonggarkan).
vi.setConfig({ testTimeout: 20_000 });

/** Respons sukses envelope { success: true, data }. */
function responsJson(data: unknown): Response {
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

/** Respons galat envelope { success: false, error: { code, message } }. */
function responsGalat(status: number, code: string, message: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      success: false,
      error: { code, message },
      meta: { timestamp: "2026-11-18T00:00:00.000Z" },
    }),
  } as unknown as Response;
}

/** Satu entri riwayat diagnosis (tanggal ISO bebas dipilih pemanggil). */
function entriRiwayat(id: string, dibuatPada: string) {
  return {
    id,
    pertanyaan: `Pertanyaan ${id}?`,
    jawaban: `Jawaban untuk ${id}.`,
    dibuat_pada: dibuatPada,
  };
}

/** Data pemeriksaan terakhir untuk GET /api/health-checks. */
function pemeriksaanTerakhir(skor: number) {
  return [
    {
      skor,
      dibuat_pada: "2026-11-18T10:00:00.000Z",
      ringkasan: {
        wifi: { status: "cukup", skor: 70, sumber: "web" },
        baterai: { status: "baik", skor: 90, sumber: "web" },
      },
    },
  ];
}

describe("AiPage (redesign v2.0)", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/ai"]}>
          <Routes>
            <Route path="/ai" element={<AiPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await siram();
  }

  /** Biarkan janji fetch + setState ter-flush (beberapa putaran). */
  async function siram(kali = 4): Promise<void> {
    for (let i = 0; i < kali; i++) {
      await act(async () => {});
    }
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

  /** Stub fetch untuk dua GET awal; POST diagnosis dilempar bila tak ditangani. */
  function stubGet(
    riwayat: unknown[] = [],
    pemeriksaan: unknown[] = [],
    tanganiPost?: (init?: RequestInit) => Promise<Response>,
  ): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/api/ai/diagnoses")) return responsJson(riwayat);
        if (u.includes("/api/health-checks")) return responsJson(pemeriksaan);
        if (u.includes("/api/ai/diagnose") && tanganiPost) {
          return tanganiPost(init);
        }
        throw new Error(`URL tak terduga: ${u}`);
      }),
    );
  }

  function kolomPertanyaan(): HTMLTextAreaElement | null {
    return wadah?.querySelector<HTMLTextAreaElement>("#pertanyaan-ai") ?? null;
  }

  function tombolKirim(): HTMLButtonElement | null {
    return (
      Array.from(wadah?.querySelectorAll("button") ?? []).find(
        (b) => b.textContent === "Kirim",
      ) ?? null
    );
  }

  /** Isi textarea lewat setter asli (pola React controlled input di jsdom). */
  async function isiPertanyaan(teks: string): Promise<void> {
    const kolom = kolomPertanyaan();
    expect(kolom).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    expect(setter).toBeDefined();
    await act(async () => {
      setter!.call(kolom, teks);
      kolom!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  /** Kirim form lewat event submit (perilaku tombol Kirim). */
  async function kirimForm(): Promise<void> {
    const form = wadah?.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await siram();
  }

  /** Cari <span> yang teksnya persis sama (dipakai untuk badge). */
  function cariSpan(teks: string): HTMLSpanElement | undefined {
    return Array.from(wadah?.querySelectorAll("span") ?? []).find(
      (s) => s.textContent === teks,
    );
  }

  it("judul, formulir, dan kalimat disclaimer tampil", async () => {
    stubGet();
    await pasang();
    expect(
      wadah?.querySelector("h1")?.textContent,
    ).toBe("Diagnosis AI");
    expect(kolomPertanyaan()).not.toBeNull();
    expect(tombolKirim()).not.toBeNull();
    expect(wadah?.textContent).toContain(
      "Jawaban AI adalah saran, bukan vonis pasti.",
    );
  });

  it("strip kuota: 2 tanya hari ini berarti sisa 18, badge Kuota cukup + meter", async () => {
    const hariIni = new Date().toISOString();
    stubGet(
      [entriRiwayat("a", hariIni), entriRiwayat("b", hariIni)],
      [],
    );
    await pasang();
    expect(wadah?.textContent).toContain("Sisa pertanyaan hari ini");
    expect(cariSpan("18")).toBeDefined();
    expect(wadah?.textContent).toContain("dari 20 pertanyaan");
    expect(cariSpan("Kuota cukup")).toBeDefined();
    expect(
      wadah?.querySelector(
        'svg[aria-label="Sisa kuota 18 dari 20 pertanyaan"]',
      ),
    ).not.toBeNull();
    expect(wadah?.textContent).toContain(
      "Batas ini diberlakukan agar kuota layanan cukup untuk semua pengguna.",
    );
  });

  it("strip kuota: sisa 12 berlabel Kuota menipis", async () => {
    const hariIni = new Date().toISOString();
    const riwayat = Array.from({ length: 8 }, (_, i) =>
      entriRiwayat(`t${i}`, hariIni),
    );
    stubGet(riwayat, []);
    await pasang();
    expect(cariSpan("12")).toBeDefined();
    expect(cariSpan("Kuota menipis")).toBeDefined();
  });

  it("strip kuota: sisa 0 dari riwayat berlabel Kuota habis", async () => {
    const hariIni = new Date().toISOString();
    const riwayat = Array.from({ length: 20 }, (_, i) =>
      entriRiwayat(`t${i}`, hariIni),
    );
    stubGet(riwayat, []);
    await pasang();
    expect(cariSpan("0")).toBeDefined();
    expect(cariSpan("Kuota habis")).toBeDefined();
  });

  it("kirim kosong menampilkan galat validasi form", async () => {
    stubGet();
    await pasang();
    await kirimForm();
    const galat = wadah?.querySelector("#galat-pertanyaan");
    expect(galat?.textContent).toBe("Tulis dulu keluhan atau pertanyaannya.");
    expect(document.activeElement).toBe(kolomPertanyaan());
  });

  it("jawaban AI tampil dengan badge AI, kolom dikosongkan, riwayat bertambah", async () => {
    const hariIni = new Date().toISOString();
    stubGet([], [], async () =>
      responsJson({
        id: "baru-1",
        jawaban: "Periksa mode router dan ganti channel ke 1, 6, atau 11.",
        sumber_jawaban: "ai",
        tersimpan: true,
        dibuat_pada: hariIni,
        sisa_hari_ini: 17,
      }),
    );
    await pasang();
    await isiPertanyaan("WiFi saya lemot, apa yang harus dicek?");
    await kirimForm();
    expect(
      wadah?.querySelector("#jawaban-ai")?.textContent,
    ).toBe("Saran dari AI");
    expect(cariSpan("AI")).toBeDefined();
    expect(wadah?.textContent).toContain(
      "Periksa mode router dan ganti channel ke 1, 6, atau 11.",
    );
    expect(wadah?.textContent).toContain(
      "Jawaban di bawah ini adalah saran berdasarkan data yang tersedia, bukan vonis pasti.",
    );
    expect(kolomPertanyaan()?.value).toBe("");
    // Pertanyaan kini ada dua kali: di kartu jawaban dan di riwayat.
    const kemunculan = Array.from(
      wadah?.querySelectorAll("p, span") ?? [],
    ).filter(
      (el) =>
        el.textContent === "WiFi saya lemot, apa yang harus dicek?",
    ).length;
    expect(kemunculan).toBe(2);
    expect(cariSpan("17")).toBeDefined();
  });

  it("jawaban aturan tampil dengan badge Aturan + panel jujur, tanpa masuk riwayat", async () => {
    const hariIni = new Date().toISOString();
    stubGet([], [], async () =>
      responsJson({
        jawaban: "Langkah standar: mulai ulang HP lalu uji lagi.",
        sumber_jawaban: "aturan",
        tersimpan: false,
        dibuat_pada: hariIni,
      }),
    );
    await pasang();
    await isiPertanyaan("HP saya panas, apa yang harus dicek?");
    await kirimForm();
    expect(
      wadah?.querySelector("#jawaban-ai")?.textContent,
    ).toBe("Saran dari panduan");
    expect(cariSpan("Aturan")).toBeDefined();
    expect(cariSpan("AI")).toBeUndefined();
    expect(wadah?.textContent).toContain(
      "Layanan AI sedang tidak tersedia saat ini.",
    );
    expect(wadah?.textContent).toContain("bukan dari AI");
    expect(wadah?.textContent).toContain("tidak tersimpan ke riwayat");
    // Pertanyaan hanya ada sekali (kartu jawaban); riwayat tetap kosong.
    const kemunculan = Array.from(
      wadah?.querySelectorAll("p, span") ?? [],
    ).filter(
      (el) => el.textContent === "HP saya panas, apa yang harus dicek?",
    ).length;
    expect(kemunculan).toBe(1);
    expect(wadah?.textContent).toContain("Belum ada tanya jawab");
  });

  it("jawaban cache tampil dengan badge AI + catatan jawaban sebelumnya", async () => {
    const hariIni = new Date().toISOString();
    stubGet([], [], async () =>
      responsJson({
        jawaban: "Jawaban yang sama seperti sebelumnya.",
        sumber_jawaban: "cache",
        tersimpan: false,
        dibuat_pada: hariIni,
      }),
    );
    await pasang();
    await isiPertanyaan("WiFi saya lemot, apa yang harus dicek?");
    await kirimForm();
    expect(
      wadah?.querySelector("#jawaban-ai")?.textContent,
    ).toBe("Saran dari AI");
    expect(cariSpan("AI")).toBeDefined();
    expect(wadah?.textContent).toContain(
      "Jawaban ini sama dengan jawaban sebelumnya untuk pertanyaan yang sama.",
    );
  });

  it("selagi mengirim tampil kerangka jawaban (bukan teks Loading polos)", async () => {
    let selesaikanPost!: (nilai: Response) => void;
    const janjiPost = new Promise<Response>((selesai) => {
      selesaikanPost = selesai;
    });
    stubGet([], [], async () => janjiPost);
    await pasang();
    await isiPertanyaan("WiFi saya lemot, apa yang harus dicek?");
    const form = wadah?.querySelector("form");
    await act(async () => {
      form!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await siram(2);
    // Teks muat terlihat + kerangka meniru tata letak jawaban.
    expect(wadah?.textContent).toContain("Sedang menyiapkan jawaban…");
    const kerangka = Array.from(
      wadah?.querySelectorAll('[role="status"]') ?? [],
    ).find((el) => el.textContent === "Memuat jawaban");
    expect(kerangka).toBeDefined();
    expect(tombolKirim()).toBeNull();
    expect(
      Array.from(wadah?.querySelectorAll("button") ?? []).find(
        (b) => b.textContent === "Sedang menyiapkan jawaban…",
      ),
    ).toBeDefined();
    // Selesaikan POST: jawaban tampil, kerangka hilang.
    await act(async () => {
      selesaikanPost(
        responsJson({
          jawaban: "Jawaban sudah tiba.",
          sumber_jawaban: "ai",
          tersimpan: false,
          dibuat_pada: new Date().toISOString(),
        }),
      );
    });
    await siram();
    expect(wadah?.textContent).toContain("Jawaban sudah tiba.");
    expect(
      Array.from(wadah?.querySelectorAll('[role="status"]') ?? []).find(
        (el) => el.textContent === "Memuat jawaban",
      ),
    ).toBeUndefined();
  });

  it("AI_QUOTA_HABIS menampilkan panel kuota habis dan menonaktifkan form", async () => {
    stubGet([], [], async () =>
      responsGalat(429, "AI_QUOTA_HABIS", "Batas harian habis."),
    );
    await pasang();
    await isiPertanyaan("WiFi saya lemot, apa yang harus dicek?");
    await kirimForm();
    expect(
      wadah?.querySelector("#kuota-habis")?.textContent,
    ).toBe("Batas pertanyaan hari ini sudah habis");
    expect(wadah?.textContent).toContain(
      "Batas 20 pertanyaan hari ini sudah habis. Batas kembali besok.",
    );
    expect(kolomPertanyaan()?.disabled).toBe(true);
    expect(
      wadah?.querySelector("button[type='submit']")?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("galat jaringan menampilkan panel galat; Coba lagi menghapusnya + fokus ke kolom", async () => {
    stubGet([], [], async () => {
      throw new Error("jaringan putus");
    });
    await pasang();
    await isiPertanyaan("WiFi saya lemot, apa yang harus dicek?");
    await kirimForm();
    expect(
      wadah?.querySelector("#galat-kirim")?.textContent,
    ).toBe("Pertanyaan belum terkirim");
    expect(wadah?.textContent).toContain(
      "Tidak ada koneksi internet. Periksa sambungan, lalu coba lagi.",
    );
    const tombolCobaLagi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    await act(async () => {
      tombolCobaLagi?.click();
    });
    expect(wadah?.querySelector("#galat-kirim")).toBeNull();
    expect(document.activeElement).toBe(kolomPertanyaan());
  });

  it("riwayat kosong menampilkan empty state jujur", async () => {
    stubGet();
    await pasang();
    expect(wadah?.textContent).toContain("Belum ada tanya jawab");
    expect(wadah?.textContent).toContain("Tulis keluhan di atas untuk mulai.");
  });

  it("riwayat menampilkan entri; ketuk membuka jawaban", async () => {
    stubGet([entriRiwayat("r1", "2026-11-10T10:00:00.000Z")], []);
    await pasang();
    expect(wadah?.textContent).toContain("Pertanyaan r1?");
    expect(wadah?.textContent).not.toContain("Jawaban untuk r1.");
    const baris = Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.includes("Pertanyaan r1?"),
    );
    expect(baris?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      baris?.click();
    });
    expect(baris?.getAttribute("aria-expanded")).toBe("true");
    expect(wadah?.textContent).toContain("Jawaban untuk r1.");
  });

  it("konteks skor 68 tampil dengan angka berwarna kuning (peringatan)", async () => {
    stubGet([], pemeriksaanTerakhir(68));
    await pasang();
    expect(wadah?.textContent).toContain("68");
    expect(wadah?.textContent).toContain("dari 100");
    expect(wadah?.textContent).toContain("Perlu diperhatikan");
    expect(wadah?.textContent).toContain("WiFi");
    expect(wadah?.textContent).toContain("Perlu diperhatikan · Skor 70 · Dari tes web");
    const angka = Array.from(wadah?.querySelectorAll("span") ?? []).find(
      (s) => s.textContent === "68",
    );
    expect(angka?.getAttribute("style")).toContain("var(--color-warning)");
  });

  it("konteks skor 85 tampil dengan angka berwarna hijau (sukses)", async () => {
    stubGet([], pemeriksaanTerakhir(85));
    await pasang();
    expect(wadah?.textContent).toContain("Baik");
    const angka = Array.from(wadah?.querySelectorAll("span") ?? []).find(
      (s) => s.textContent === "85",
    );
    expect(angka?.getAttribute("style")).toContain("var(--color-success)");
  });

  it("konteks kosong menampilkan empty state + tautan dashboard", async () => {
    stubGet();
    await pasang();
    expect(wadah?.textContent).toContain("Belum ada pemeriksaan");
    expect(wadah?.textContent).toContain(
      "AI menjawab dari pertanyaan saja.",
    );
    const tautan = Array.from(
      wadah?.querySelectorAll('a[href="/dashboard"]') ?? [],
    ).find((a) => a.textContent === "Buka dashboard");
    expect(tautan).toBeDefined();
  });

  it("konteks galat menampilkan Coba lagi; retry yang berhasil menampilkan skor", async () => {
    let panggilanKonteks = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes("/api/ai/diagnoses")) return responsJson([]);
        if (u.includes("/api/health-checks")) {
          panggilanKonteks += 1;
          if (panggilanKonteks === 1) throw new Error("jaringan putus");
          return responsJson(pemeriksaanTerakhir(72));
        }
        throw new Error(`URL tak terduga: ${u}`);
      }),
    );
    await pasang();
    expect(wadah?.textContent).toContain(
      "Ringkasan pemeriksaan terakhir belum bisa ditampilkan.",
    );
    const tombolCobaLagi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Coba lagi");
    await act(async () => {
      tombolCobaLagi?.click();
    });
    await siram();
    expect(wadah?.textContent).toContain("72");
    expect(panggilanKonteks).toBe(2);
  });

  it("riwayat galat menampilkan Coba lagi; retry yang berhasil menampilkan entri", async () => {
    let panggilanRiwayat = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes("/api/ai/diagnoses")) {
          panggilanRiwayat += 1;
          if (panggilanRiwayat === 1) throw new Error("jaringan putus");
          return responsJson([entriRiwayat("r9", "2026-11-10T10:00:00.000Z")]);
        }
        if (u.includes("/api/health-checks")) return responsJson([]);
        throw new Error(`URL tak terduga: ${u}`);
      }),
    );
    await pasang();
    expect(wadah?.textContent).toContain("Data tidak bisa dimuat. Coba lagi.");
    const tombolCobaLagi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Coba lagi");
    await act(async () => {
      tombolCobaLagi?.click();
    });
    await siram();
    expect(wadah?.textContent).toContain("Pertanyaan r9?");
    expect(panggilanRiwayat).toBe(2);
  });

  it("sesi berakhir (401) menampilkan panel masuk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes("/api/ai/diagnoses")) {
          return responsGalat(401, "UNAUTHORIZED", "Sesi berakhir.");
        }
        if (u.includes("/api/health-checks")) return responsJson([]);
        throw new Error(`URL tak terduga: ${u}`);
      }),
    );
    await pasang();
    expect(
      wadah?.querySelector("#sesi-berakhir")?.textContent,
    ).toBe("Sesi sudah berakhir");
    expect(
      wadah?.querySelector('a[href="/masuk"]')?.textContent,
    ).toBe("Masuk");
    expect(kolomPertanyaan()).toBeNull();
  });

  it("sesi terkunci (403 SESSION_LOCKED) menampilkan panel PIN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes("/api/ai/diagnoses")) {
          return responsGalat(403, "SESSION_LOCKED", "Terkunci.");
        }
        if (u.includes("/api/health-checks")) return responsJson([]);
        throw new Error(`URL tak terduga: ${u}`);
      }),
    );
    await pasang();
    expect(
      wadah?.querySelector("#sesi-terkunci")?.textContent,
    ).toBe("Aplikasi terkunci");
    expect(
      wadah?.querySelector('a[href="/kunci"]')?.textContent,
    ).toBe("Buka dengan PIN");
  });

  it("ketuk contoh pertanyaan mengisi kolom", async () => {
    stubGet();
    await pasang();
    const contoh = Array.from(wadah?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.startsWith("WiFi lemot padahal sinyal penuh."),
    );
    expect(contoh).toBeDefined();
    await act(async () => {
      contoh?.click();
    });
    expect(kolomPertanyaan()?.value).toBe(
      "WiFi lemot padahal sinyal penuh. Kecepatan unduh 30 KB/detik. Sudah coba lupakan jaringan dan sambung ulang, tapi tetap lambat.",
    );
    expect(document.activeElement).toBe(kolomPertanyaan());
  });
});
