// apps/web/src/pages/PanduanPage.test.tsx
// Tes PanduanPage (N-01, K-82): halaman TIDAK LAGI menyisipkan
// elemen <script> JSON-LD FAQ secara dinamis — injeksi itu mati di
// bawah CSP script-src dan tidak dapat di-hash. Structured data
// FAQ kembali bersama prerender pasca-v1.0 (K-22).

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import PanduanPage from "./PanduanPage";

// React 19: tandai lingkungan tes agar act() berjalan tanpa peringatan.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("PanduanPage (N-01, K-82)", () => {
  let wadah: HTMLDivElement | null = null;
  let root: Root | null = null;

  function pasang(slug: string): void {
    wadah = document.createElement("div");
    document.body.appendChild(wadah);
    root = createRoot(wadah);
    act(() => {
      root?.render(
        <MemoryRouter initialEntries={[`/panduan/${slug}`]}>
          <Routes>
            <Route path="/panduan/:slug" element={<PanduanPage />} />
          </Routes>
        </MemoryRouter>,
      );
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
  });

  it("tidak menyisipkan elemen script JSON-LD untuk panduan yang punya FAQ", () => {
    // wifi-lemot punya 5 FAQ — sebelum perbaikan, efek halaman
    // menyisipkan <script id="faq-jsonld"> ke <head>.
    pasang("wifi-lemot");
    expect(document.querySelector("#faq-jsonld")).toBeNull();
    expect(
      document.querySelector('script[type="application/ld+json"]'),
    ).toBeNull();
  });

  it("tetap menampilkan isi panduan tanpa JSON-LD", () => {
    pasang("wifi-lemot");
    expect(wadah?.textContent).toContain("WiFi lemot padahal sinyal penuh");
    expect(wadah?.querySelector("ol")).not.toBeNull();
  });
});
