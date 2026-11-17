import { describe, expect, it } from "vitest";
import { cariPanduan, PANDUAN } from "./panduan";

// Slug wajib sama persis dengan sitemap.xml dan docs/seo.md §2.
const SLUG_DIHARAPKAN = [
  "wifi-lemot",
  "ganti-channel-router",
  "ganti-dns",
  "baterai-boros",
  "penyimpanan-penuh",
  "hp-lemot",
  "keamanan-hp",
];

describe("data panduan", () => {
  it("memuat 7 panduan", () => {
    expect(PANDUAN).toHaveLength(7);
  });

  it("setiap panduan punya slug unik", () => {
    const slug = PANDUAN.map((p) => p.slug);
    expect(new Set(slug).size).toBe(slug.length);
  });

  it("slug sesuai daftar di sitemap", () => {
    const slug = PANDUAN.map((p) => p.slug).sort();
    expect(slug).toEqual([...SLUG_DIHARAPKAN].sort());
  });

  it("setiap panduan punya judul dan deskripsi", () => {
    for (const p of PANDUAN) {
      expect(p.judul.trim().length).toBeGreaterThan(0);
      expect(p.judulSeo.trim().length).toBeGreaterThan(0);
      expect(p.deskripsi.trim().length).toBeGreaterThan(0);
    }
  });

  it("setiap panduan punya minimal 3 langkah", () => {
    for (const p of PANDUAN) {
      expect(p.langkah.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("setiap langkah berisi teks", () => {
    for (const p of PANDUAN) {
      for (const langkah of p.langkah) {
        expect(langkah.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("cariPanduan menemukan panduan dari slug", () => {
    expect(cariPanduan("wifi-lemot")?.judul).toBe(
      "WiFi lemot padahal sinyal penuh",
    );
    expect(cariPanduan("slug-tidak-ada")).toBeUndefined();
  });

  it("teks panduan tidak mengandung kata gaul", () => {
    const polaGaul = /\b(gua|gue|lu|loe|gw)\b/i;
    for (const p of PANDUAN) {
      const teks = [p.judul, p.deskripsi, ...p.langkah].join(" ");
      expect(teks).not.toMatch(polaGaul);
    }
  });
});
