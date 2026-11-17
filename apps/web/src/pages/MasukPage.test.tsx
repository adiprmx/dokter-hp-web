// apps/web/src/pages/MasukPage.test.tsx
// Tes MasukPage (K-89): tombol Google menampilkan keadaan jujur
// "belum disiapkan" bila GET /api/auth/status menjawab
// google_tersedia false; tombol normal bila true; tombol normal
// (fail-open) bila pemanggilan status gagal; dan ?error=
// oauth_belum_disiapkan menampilkan pesan ramah. Pola pasang
// mengikuti PanduanPage.test.tsx; fetch diganti (stub) seperti
// api.test.ts — tidak ada panggilan jaringan nyata.

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

describe("MasukPage (K-89)", () => {
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

  it("tombol nonaktif dengan teks jujur bila google_tersedia false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsStatus(false)));
    await pasang();
    const tombol = wadah?.querySelector("button[disabled]");
    expect(tombol?.textContent).toBe("Masuk dengan Google belum disiapkan");
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
    expect(wadah?.querySelector("button[disabled]")).toBeNull();
  });

  it("tombol normal bila pemanggilan status gagal (fail-open)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("jaringan putus");
      }),
    );
    await pasang();
    const tautan = wadah?.querySelector('a[href*="/api/auth/google"]');
    expect(tautan?.textContent).toBe("Masuk dengan Google");
    expect(wadah?.querySelector("button[disabled]")).toBeNull();
  });

  it("menampilkan pesan ramah untuk ?error=oauth_belum_disiapkan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsStatus(true)));
    await pasang("/masuk?error=oauth_belum_disiapkan");
    const peringatan = wadah?.querySelector('[role="alert"]');
    expect(peringatan?.textContent).toBe(
      "Masuk dengan Google belum disiapkan untuk situs ini.",
    );
  });
});
