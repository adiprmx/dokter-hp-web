// lib/status-warna.test.ts — Tes unit pemetaan keadaan ke warna status.
// Satu-satunya sumber kebenaran warna status (redesign v2.0, K-94/K-96):
// setiap helper di sini dipetakan eksplisit, tanpa pemetaan tersebar.

import { describe, expect, it } from "vitest";
import {
  labelStatus,
  statusDariDoctor,
  statusDariKlasifikasiKecepatan,
  statusDariSkor,
  statusDariVerdict,
  tokenStatus,
} from "./status-warna";

describe("statusDariKlasifikasiKecepatan (K-96)", () => {
  it.each([
    ["sangat-cepat", "sukses"],
    ["cepat", "sukses"],
    ["cukup", "peringatan"],
    ["lambat", "galat"],
    ["sangat-lambat", "galat"],
  ] as const)("id %s → status %s", (id, status) => {
    expect(statusDariKlasifikasiKecepatan(id)).toBe(status);
  });
});

describe("labelStatus (K-94)", () => {
  it.each([
    ["sukses", "Baik"],
    ["peringatan", "Perlu diperhatikan"],
    ["galat", "Bermasalah"],
    ["info", "Info"],
    ["netral", "Netral"],
  ] as const)("status %s → label %s", (status, label) => {
    expect(labelStatus(status)).toBe(label);
  });
});

describe("helper status lain (regresi)", () => {
  it("statusDariSkor memakai ambang kanonis 80/50", () => {
    expect(statusDariSkor(85)).toBe("sukses");
    expect(statusDariSkor(80)).toBe("sukses");
    expect(statusDariSkor(65)).toBe("peringatan");
    expect(statusDariSkor(50)).toBe("peringatan");
    expect(statusDariSkor(30)).toBe("galat");
  });

  it("statusDariVerdict: bertahan hijau, jatuh merah, tidak-stabil kuning", () => {
    expect(statusDariVerdict("bertahan")).toBe("sukses");
    expect(statusDariVerdict("jatuh")).toBe("galat");
    expect(statusDariVerdict("tidak-stabil")).toBe("peringatan");
  });

  it("statusDariDoctor: baik hijau, cukup kuning, perlu_perhatian merah", () => {
    expect(statusDariDoctor("baik")).toBe("sukses");
    expect(statusDariDoctor("cukup")).toBe("peringatan");
    expect(statusDariDoctor("perlu_perhatian")).toBe("galat");
  });

  it("tokenStatus mengembalikan var() token, bukan hex", () => {
    expect(tokenStatus("sukses").teks).toBe("var(--color-success)");
    expect(tokenStatus("galat").teks).toBe("var(--color-error)");
    expect(tokenStatus("peringatan").teks).toBe("var(--color-warning)");
  });
});
