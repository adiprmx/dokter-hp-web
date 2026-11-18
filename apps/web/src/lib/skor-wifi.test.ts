// apps/web/src/lib/skor-wifi.test.ts
// Tes rumus skor WiFi (docs/skor-wifi.md). Semua angka harapan di
// bawah diambil EKSAX dari tabel §5 dokumen — bukan kira-kira.

import { describe, expect, it } from "vitest";
import {
  BATAS_SKOR_DATA_TIDAK_LENGKAP,
  BATAS_SKOR_JATUH,
  BATAS_SKOR_TIDAK_STABIL,
  KALIMAT_WAJIB_SKOR_WIFI,
  hitungSkorWifi,
  ringkasanAriaWifi,
  subskorKecepatan,
  subskorKestabilan,
  subskorLatensi,
  type MasukanSkorWifi,
} from "./skor-wifi";
import type { VerdictBertahan } from "./speedtest";

describe("hitungSkorWifi — 12 kasus docs/skor-wifi.md §5", () => {
  const kasus: {
    nama: string;
    masukan: MasukanSkorWifi;
    subskor: [number, number | null, number | null];
    skor: number;
  }[] = [
    {
      nama: "1: cepat + stabil (ideal)",
      masukan: { kecepatanKbps: 6000, latensiMs: 40, verdictBertahan: "bertahan" },
      subskor: [100, 100, 100],
      skor: 100,
    },
    {
      nama: "2: cepat + tidak stabil",
      masukan: { kecepatanKbps: 6000, latensiMs: 40, verdictBertahan: "tidak-stabil" },
      subskor: [100, 100, 40],
      skor: 69,
    },
    {
      nama: "3: cepat + jatuh",
      masukan: { kecepatanKbps: 6000, latensiMs: 40, verdictBertahan: "jatuh" },
      subskor: [100, 100, 10],
      skor: 49,
    },
    {
      nama: "4: lambat + stabil",
      masukan: { kecepatanKbps: 500, latensiMs: 60, verdictBertahan: "bertahan" },
      subskor: [51.25, 96, 100],
      skor: 75,
    },
    {
      nama: "5: sangat lambat + tidak stabil",
      masukan: { kecepatanKbps: 120, latensiMs: 80, verdictBertahan: "tidak-stabil" },
      subskor: [29.33, 88, 40],
      skor: 47,
    },
    {
      nama: "6: sangat lambat + latensi tinggi",
      masukan: { kecepatanKbps: 80, latensiMs: 600, verdictBertahan: "tidak-stabil" },
      subskor: [24, 24, 40],
      skor: 28,
    },
    {
      nama: "7: cepat + latensi tinggi, stabil",
      masukan: { kecepatanKbps: 3000, latensiMs: 300, verdictBertahan: "bertahan" },
      subskor: [85, 50, 100],
      skor: 80,
    },
    {
      nama: "8: cepat, tanpa tes bertahan",
      masukan: { kecepatanKbps: 6000, latensiMs: 40, verdictBertahan: null },
      subskor: [100, 100, null],
      skor: 79,
    },
    {
      nama: "9: sedang, tanpa tes bertahan",
      masukan: { kecepatanKbps: 1200, latensiMs: 80, verdictBertahan: null },
      subskor: [71.5, 88, null],
      skor: 77,
    },
    {
      nama: "10: kecepatan 0, latensi gagal",
      masukan: { kecepatanKbps: 0, latensiMs: null, verdictBertahan: "tidak-stabil" },
      subskor: [0, null, 40],
      skor: 13,
    },
    {
      nama: "11: cepat + stabil, latensi gagal",
      masukan: { kecepatanKbps: 2500, latensiMs: null, verdictBertahan: "bertahan" },
      subskor: [81.25, null, 100],
      skor: 79,
    },
    {
      nama: "12: patokan wajar, stabil (batas Baik)",
      masukan: { kecepatanKbps: 1000, latensiMs: 100, verdictBertahan: "bertahan" },
      subskor: [70, 80, 100],
      skor: 80,
    },
  ];

  for (const item of kasus) {
    it(item.nama, () => {
      const hasil = hitungSkorWifi(item.masukan);
      expect(hasil.skor).toBe(item.skor);
      expect(hasil.komponen.kecepatan).toBeCloseTo(item.subskor[0], 2);
      if (item.subskor[1] === null) {
        expect(hasil.komponen.latensi).toBeNull();
      } else {
        expect(hasil.komponen.latensi).toBeCloseTo(item.subskor[1], 2);
      }
      if (item.subskor[2] === null) {
        expect(hasil.komponen.kestabilan).toBeNull();
      } else {
        expect(hasil.komponen.kestabilan).toBeCloseTo(item.subskor[2], 2);
      }
      // Kalimat wajib §6.1 selalu ada.
      expect(hasil.ringkasan).toContain(KALIMAT_WAJIB_SKOR_WIFI);
    });
  }
});

describe("hitungSkorWifi — batas dan edge cases", () => {
  it("skor tidak pernah melebihi 79 bila data tidak lengkap", () => {
    // Tertimbang 100 (kasus 8) dan 87,5 (kasus 11) sama-sama ke 79.
    expect(
      hitungSkorWifi({ kecepatanKbps: 6000, latensiMs: 40, verdictBertahan: null }).skor,
    ).toBe(BATAS_SKOR_DATA_TIDAK_LENGKAP);
    expect(
      hitungSkorWifi({ kecepatanKbps: 2500, latensiMs: null, verdictBertahan: "bertahan" }).skor,
    ).toBe(BATAS_SKOR_DATA_TIDAK_LENGKAP);
    // Hanya kecepatan (latensi null + tanpa verdict) = subskornya, tetap dibatasi 79.
    expect(
      hitungSkorWifi({ kecepatanKbps: 6000, latensiMs: null, verdictBertahan: null }).skor,
    ).toBe(BATAS_SKOR_DATA_TIDAK_LENGKAP);
    expect(
      hitungSkorWifi({ kecepatanKbps: 500, latensiMs: null, verdictBertahan: null }).skor,
    ).toBe(51);
  });

  it("skor tidak pernah melebihi 69 bila tidak-stabil dan 49 bila jatuh", () => {
    expect(
      hitungSkorWifi({ kecepatanKbps: 6000, latensiMs: 40, verdictBertahan: "tidak-stabil" }).skor,
    ).toBe(BATAS_SKOR_TIDAK_STABIL);
    expect(
      hitungSkorWifi({ kecepatanKbps: 6000, latensiMs: 40, verdictBertahan: "jatuh" }).skor,
    ).toBe(BATAS_SKOR_JATUH);
    // Bila beberapa batas berlaku, yang TERENDAH yang menang.
    expect(
      hitungSkorWifi({ kecepatanKbps: 6000, latensiMs: null, verdictBertahan: "jatuh" }).skor,
    ).toBe(BATAS_SKOR_JATUH);
  });

  it("kecepatan 0 tanpa data lain menghasilkan skor 0", () => {
    const hasil = hitungSkorWifi({
      kecepatanKbps: 0,
      latensiMs: null,
      verdictBertahan: null,
    });
    expect(hasil.skor).toBe(0);
    expect(hasil.komponen).toEqual({ kecepatan: 0, latensi: null, kestabilan: null });
  });

  it("masukan tidak valid diperlakukan seperti tidak ada datanya", () => {
    // Kecepatan negatif/bukan angka -> 0; latensi negatif/bukan angka -> null.
    expect(subskorKecepatan(-5)).toBe(0);
    expect(subskorKecepatan(NaN)).toBe(0);
    expect(subskorLatensi(-1)).toBeNull();
    expect(subskorLatensi(NaN)).toBeNull();
    // Verdict tidak dikenal -> null (data tidak lengkap, batas 79).
    const hasil = hitungSkorWifi({
      kecepatanKbps: 6000,
      latensiMs: 40,
      verdictBertahan: "aneh" as unknown as VerdictBertahan,
    });
    expect(hasil.komponen.kestabilan).toBeNull();
    expect(hasil.skor).toBe(79);
  });

  it("kecepatan ekstrem mentok, latensi ekstrem mentok di 0", () => {
    expect(subskorKecepatan(50000)).toBe(100);
    expect(subskorLatensi(5000)).toBe(0);
    expect(subskorLatensi(50)).toBe(100);
    expect(subskorLatensi(1000)).toBe(0);
  });

  it("deterministik: masukan sama selalu skor sama", () => {
    const masukan = {
      kecepatanKbps: 1234,
      latensiMs: 123,
      verdictBertahan: "bertahan" as const,
    };
    expect(hitungSkorWifi(masukan)).toEqual(hitungSkorWifi(masukan));
  });
});

describe("hitungSkorWifi — teks ringkasan §6", () => {
  it("kasus 3: teks lengkap persis seperti contoh dokumen", () => {
    const hasil = hitungSkorWifi({
      kecepatanKbps: 6000,
      latensiMs: 40,
      verdictBertahan: "jatuh",
    });
    expect(hasil.ringkasan).toBe(
      "Skor ini hanya dari tes WiFi. Bukan skor kesehatan HP secara keseluruhan. " +
        "Dihitung dari kecepatan, waktu tunggu, dan kestabilan selama 30 detik. " +
        "Kecepatan jatuh di tengah jalan, jadi nilainya dibatasi sampai 49.",
    );
  });

  it("kasus 8: teks lengkap persis seperti contoh dokumen", () => {
    const hasil = hitungSkorWifi({
      kecepatanKbps: 6000,
      latensiMs: 40,
      verdictBertahan: null,
    });
    expect(hasil.ringkasan).toBe(
      "Skor ini hanya dari tes WiFi. Bukan skor kesehatan HP secara keseluruhan. " +
        "Dihitung dari kecepatan dan waktu tunggu saja, tanpa tes bertahan 30 detik. " +
        "Nilainya dibatasi sampai 79 karena kestabilan belum diukur.",
    );
  });

  it("latensi gagal: kalimat tanpa waktu tunggu + batas 79", () => {
    const hasil = hitungSkorWifi({
      kecepatanKbps: 2500,
      latensiMs: null,
      verdictBertahan: "bertahan",
    });
    expect(hasil.ringkasan).toContain(
      "Dihitung tanpa waktu tunggu karena waktu tunggu tidak berhasil diukur. Nilainya dibatasi sampai 79.",
    );
  });

  it("latensi gagal + tanpa tes bertahan: kalimat dari kecepatan saja", () => {
    const hasil = hitungSkorWifi({
      kecepatanKbps: 500,
      latensiMs: null,
      verdictBertahan: null,
    });
    expect(hasil.ringkasan).toContain(
      "Dihitung dari kecepatan saja. Waktu tunggu tidak berhasil diukur dan tes bertahan 30 detik tidak dijalankan. Nilainya dibatasi sampai 79.",
    );
  });

  it("verdict tidak-stabil menambah kalimat batas 69", () => {
    const hasil = hitungSkorWifi({
      kecepatanKbps: 6000,
      latensiMs: 40,
      verdictBertahan: "tidak-stabil",
    });
    expect(hasil.ringkasan).toContain(
      "Kecepatan tidak stabil selama 30 detik, jadi nilainya dibatasi sampai 69.",
    );
  });
});

describe("subskor — jangkar §2.1", () => {
  it("subskor kecepatan tepat di tiap jangkar", () => {
    expect(subskorKecepatan(0)).toBe(0);
    expect(subskorKecepatan(50)).toBe(20);
    expect(subskorKecepatan(200)).toBe(40);
    expect(subskorKecepatan(1000)).toBe(70);
    expect(subskorKecepatan(5000)).toBe(100);
    // Contoh dokumen: 500 KB/detik -> 51,25.
    expect(subskorKecepatan(500)).toBeCloseTo(51.25, 2);
  });

  it("subskor latensi tepat di tiap jangkar", () => {
    expect(subskorLatensi(50)).toBe(100);
    expect(subskorLatensi(100)).toBe(80);
    expect(subskorLatensi(200)).toBe(60);
    expect(subskorLatensi(500)).toBe(30);
    expect(subskorLatensi(1000)).toBe(0);
    // Contoh dokumen: 300 ms -> 50.
    expect(subskorLatensi(300)).toBeCloseTo(50, 2);
  });

  it("subskor kestabilan dari verdict", () => {
    expect(subskorKestabilan("bertahan")).toBe(100);
    expect(subskorKestabilan("tidak-stabil")).toBe(40);
    expect(subskorKestabilan("jatuh")).toBe(10);
    expect(subskorKestabilan(null)).toBeNull();
  });
});

describe("ringkasanAriaWifi — §6.4", () => {
  it("memakai label kategori kanonis + penanda WiFi", () => {
    expect(ringkasanAriaWifi(69)).toBe(
      "Skor WiFi 69 dari 100, kategori Cukup. Skor ini hanya dari tes WiFi.",
    );
    expect(ringkasanAriaWifi(100)).toBe(
      "Skor WiFi 100 dari 100, kategori Baik. Skor ini hanya dari tes WiFi.",
    );
  });
});
