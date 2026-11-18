// apps/web/src/pages/MasukPage.test.tsx
// Tes MasukPage (K-89/K-92): tombol Google menampilkan satu dari
// empat keadaan jujur — "memuat" (nonaktif netral selagi status
// belum diketahui), "tersedia" (tombol normal bila google_tersedia
// true), "belumDisiapkan" (nonaktif bila false), "galat" (nonaktif
// + tombol "Coba lagi" bila pemanggilan status gagal; retry yang
// berhasil menampilkan tombol normal). ?error=
// oauth_belum_disiapkan menampilkan pesan ramah. Pola pasang
// mengikuti PanduanPage.test.tsx; fetch diganti (stub) seperti
// api.test.ts — tidak ada panggilan jaringan nyata.
// Redesign v2.0 (spec §7): setiap keadaan yang menampilkan tombol
// Google juga menegaskan logo "G" resmi tampil di dalam tombol itu.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import MasukPage from "./MasukPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/** Respons palsu GET /api/auth/status (pola responsJson api.test.ts). */
function responsStatus(googleTersedia: boolean): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: { google_tersedia: googleTersedia },
      meta: { timestamp: "2026-11-18T00:00:00.000Z" },
    }),
  } as unknown as Response;
}

describe("MasukPage (K-89/K-92)", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  async function pasang(entri = "/masuk"): Promise<void> {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[entri]}>
          <Routes>
            <Route path="/masuk" element={<MasukPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    // Biarkan janji fetch status selesai dan setState ter-flush.
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

  it("tombol nonaktif netral selagi status masih dimuat", async () => {
    // Janji yang tidak pernah selesai: keadaan tetap "memuat".
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await pasang();
    const tombol = wadah?.querySelector("button[disabled]");
    expect(tombol?.textContent).toBe("Memeriksa login Google…");
    expect(
      tombol?.querySelector('img[src="/brand/google-g.svg"]'),
    ).not.toBeNull();
    expect(wadah?.querySelector('a[href*="/api/auth/google"]')).toBeNull();
  });

  it("tombol nonaktif dengan teks jujur bila google_tersedia false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsStatus(false)));
    await pasang();
    const tombol = wadah?.querySelector("button[disabled]");
    expect(tombol?.textContent).toBe("Masuk dengan Google belum disiapkan");
    expect(
      tombol?.querySelector('img[src="/brand/google-g.svg"]'),
    ).not.toBeNull();
    expect(wadah?.textContent).toContain(
      "Login Google belum disiapkan untuk situs ini.",
    );
    expect(wadah?.querySelector('a[href*="/api/auth/google"]')).toBeNull();
  });

  it("tombol normal bila google_tersedia true", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsStatus(true)));
    await pasang();
    const tautan = wadah?.querySelector('a[href*="/api/auth/google"]');
    expect(tautan?.textContent).toBe("Masuk dengan Google");
    expect(
      tautan?.querySelector('img[src="/brand/google-g.svg"]'),
    ).not.toBeNull();
    expect(wadah?.querySelector("button[disabled]")).toBeNull();
  });

  it("keadaan galat bila pemanggilan status gagal: tombol nonaktif + Coba lagi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("jaringan putus");
      }),
    );
    await pasang();
    const tombol = wadah?.querySelector("button[disabled]");
    expect(tombol?.textContent).toBe("Tidak dapat memeriksa login Google");
    expect(
      tombol?.querySelector('img[src="/brand/google-g.svg"]'),
    ).not.toBeNull();
    expect(wadah?.textContent).toContain(
      "Status login Google tidak dapat diperiksa saat ini.",
    );
    const tombolCobaLagi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Coba lagi");
    expect(tombolCobaLagi).toBeDefined();
    expect(tombolCobaLagi?.disabled).toBe(false);
    expect(wadah?.querySelector('a[href*="/api/auth/google"]')).toBeNull();
  });

  it("Coba lagi memanggil ulang status; retry yang berhasil menampilkan tombol normal", async () => {
    let panggilan = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        panggilan += 1;
        if (panggilan === 1) throw new Error("jaringan putus");
        return responsStatus(true);
      }),
    );
    await pasang();
    expect(
      wadah?.querySelector("button[disabled]")?.textContent,
    ).toBe("Tidak dapat memeriksa login Google");
    const tombolCobaLagi = Array.from(
      wadah?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent === "Coba lagi");
    await act(async () => {
      tombolCobaLagi?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    // Biarkan janji fetch retry selesai dan setState ter-flush.
    await act(async () => {});
    const tautan = wadah?.querySelector('a[href*="/api/auth/google"]');
    expect(tautan?.textContent).toBe("Masuk dengan Google");
    expect(
      tautan?.querySelector('img[src="/brand/google-g.svg"]'),
    ).not.toBeNull();
    expect(wadah?.querySelector("button[disabled]")).toBeNull();
    expect(panggilan).toBe(2);
  });

  it("menampilkan pesan ramah untuk ?error=oauth_belum_disiapkan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsStatus(true)));
    await pasang("/masuk?error=oauth_belum_disiapkan");
    const peringatan = wadah?.querySelector('[role="alert"]');
    expect(peringatan?.textContent).toBe(
      "Masuk dengan Google belum disiapkan untuk situs ini.",
    );
    expect(
      wadah?.querySelector(
        'a[href*="/api/auth/google"] img[src="/brand/google-g.svg"]',
      ),
    ).not.toBeNull();
  });
});
