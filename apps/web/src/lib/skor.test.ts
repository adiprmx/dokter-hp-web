// lib/skor.test.ts — Tes unit klasifikasi skor (Vitest).
//
// Ambang 80/60 sama dengan yang dipakai components/ui/ScoreRing.tsx.
// Label dan penjelasan dikunci ke teks final docs/copy.md §4.

import { describe, expect, it } from "vitest";
import {
  SKOR_MIN_BAIK,
  SKOR_MIN_CUKUP,
  batasiSkor,
  klasifikasiSkor,
  labelKategori,
  penjelasanKategori,
  ringkasanSkor,
  warnaKategori,
} from "./skor";
import type { KategoriSkor } from "./skor";

describe("klasifikasiSkor", () => {
  const kasus: Array<[number, KategoriSkor]> = [
    [100, "baik"],
    [80, "baik"],
    [79, "cukup"],
    [60, "cukup"],
    [59, "perlu-perhatian"],
    [0, "perlu-perhatian"],
  ];

  it.each(kasus)("skor %i -> %s", (skor, kategori) => {
    expect(klasifikasiSkor(skor)).toBe(kategori);
  });

  it("ambang batas sesuai komponen cincin skor yang sudah ada (80/60)", () => {
    expect(SKOR_MIN_BAIK).toBe(80);
    expect(SKOR_MIN_CUKUP).toBe(60);
  });

  it("membatasi skor di luar 0-100 sebelum klasifikasi", () => {
    expect(klasifikasiSkor(150)).toBe("baik");
    expect(klasifikasiSkor(-5)).toBe("perlu-perhatian");
  });
});

describe("batasiSkor", () => {
  it("membulatkan dan membatasi ke 0-100", () => {
    expect(batasiSkor(78.6)).toBe(79);
    expect(batasiSkor(78.4)).toBe(78);
    expect(batasiSkor(101)).toBe(100);
    expect(batasiSkor(-1)).toBe(0);
  });

  it("nilai tidak valid menjadi 0", () => {
    expect(batasiSkor(Number.NaN)).toBe(0);
    expect(batasiSkor(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("labelKategori", () => {
  const kasus: Array<[KategoriSkor, string]> = [
    ["baik", "Baik"],
    ["cukup", "Cukup"],
    ["perlu-perhatian", "Perlu perhatian"],
  ];

  it.each(kasus)("kategori %s berlabel %s", (kategori, label) => {
    expect(labelKategori(kategori)).toBe(label);
  });
});

describe("penjelasanKategori", () => {
  it("memakai teks final dari docs/copy.md §4", () => {
    expect(penjelasanKategori("baik")).toBe(
      "Kondisi HP secara umum baik. Tidak ada masalah yang perlu segera diperbaiki.",
    );
    expect(penjelasanKategori("cukup")).toBe(
      "Ada beberapa hal yang bisa diperbaiki. Lihat saran di bawah.",
    );
    expect(penjelasanKategori("perlu-perhatian")).toBe(
      "Ada masalah yang sebaiknya segera diperbaiki. Mulai dari yang paling atas.",
    );
  });
});

describe("warnaKategori", () => {
  it("memakai token warna fungsi, bukan hex mentah", () => {
    expect(warnaKategori("baik")).toBe("var(--color-success)");
    expect(warnaKategori("cukup")).toBe("var(--color-warning)");
    expect(warnaKategori("perlu-perhatian")).toBe("var(--color-error)");
  });
});

describe("ringkasanSkor", () => {
  it("meringkas skor dan kategori dalam satu kalimat", () => {
    expect(ringkasanSkor(78)).toBe("Skor kesehatan 78 dari 100, kategori Cukup.");
    expect(ringkasanSkor(90)).toBe("Skor kesehatan 90 dari 100, kategori Baik.");
    expect(ringkasanSkor(45)).toBe(
      "Skor kesehatan 45 dari 100, kategori Perlu perhatian.",
    );
  });
});
