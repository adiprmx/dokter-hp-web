import { describe, expect, it } from "vitest";
import {
  BATAS_PERTANYAAN_HARIAN,
  formatTanggalJam,
  hitungSisaKuotaDariRiwayat,
  kategoriSkor,
  labelKomponen,
  labelStatusKomponen,
  labelSumberKonteks,
  parseSisaKuota,
  PERTANYAAN_MAKS_KARAKTER,
  ringkasPemeriksaanTerakhir,
  validasiPertanyaan,
} from "./ai";

describe("validasiPertanyaan", () => {
  it("menolak pertanyaan kosong", () => {
    expect(validasiPertanyaan("")).toEqual({
      ok: false,
      pesan: "Tulis dulu keluhan atau pertanyaannya.",
    });
  });

  it("menolak pertanyaan yang hanya berisi spasi", () => {
    expect(validasiPertanyaan("   ")).toEqual({
      ok: false,
      pesan: "Tulis dulu keluhan atau pertanyaannya.",
    });
  });

  it("memangkas spasi ujung dan menerima pertanyaan yang sah", () => {
    expect(validasiPertanyaan("  WiFi lemot padahal sinyal penuh.  ")).toEqual({
      ok: true,
      pertanyaan: "WiFi lemot padahal sinyal penuh.",
    });
  });

  it("menerima pertanyaan tepat sepanjang batas maksimum", () => {
    const hasil = validasiPertanyaan("a".repeat(PERTANYAAN_MAKS_KARAKTER));
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.pertanyaan.length).toBe(PERTANYAAN_MAKS_KARAKTER);
    }
  });

  it("menolak pertanyaan yang melebihi batas maksimum", () => {
    expect(validasiPertanyaan("a".repeat(PERTANYAAN_MAKS_KARAKTER + 1))).toEqual({
      ok: false,
      pesan:
        "Pertanyaannya terlalu panjang. Singkat saja, yang penting jelas.",
    });
  });
});

describe("parseSisaKuota", () => {
  it("membaca sisa_hari_ini dari respons diagnosis", () => {
    expect(parseSisaKuota({ sisa_hari_ini: 7 })).toBe(7);
  });

  it("menerima batas 0 dan 20", () => {
    expect(parseSisaKuota({ sisa_hari_ini: 0 })).toBe(0);
    expect(
      parseSisaKuota({ sisa_hari_ini: BATAS_PERTANYAAN_HARIAN }),
    ).toBe(BATAS_PERTANYAAN_HARIAN);
  });

  it("mengembalikan null bila field tidak ada", () => {
    expect(parseSisaKuota({})).toBeNull();
    expect(parseSisaKuota({ jawaban: "teks" })).toBeNull();
  });

  it("mengembalikan null bila nilainya bukan angka bulat yang sah", () => {
    expect(parseSisaKuota({ sisa_hari_ini: "5" })).toBeNull();
    expect(parseSisaKuota({ sisa_hari_ini: 7.5 })).toBeNull();
    expect(parseSisaKuota({ sisa_hari_ini: -1 })).toBeNull();
    expect(
      parseSisaKuota({ sisa_hari_ini: BATAS_PERTANYAAN_HARIAN + 1 }),
    ).toBeNull();
  });

  it("mengembalikan null bila data bukan objek", () => {
    expect(parseSisaKuota(null)).toBeNull();
    expect(parseSisaKuota(undefined)).toBeNull();
    expect(parseSisaKuota("teks")).toBeNull();
    expect(parseSisaKuota([1, 2])).toBeNull();
  });
});

describe("hitungSisaKuotaDariRiwayat", () => {
  // "Sekarang" dipatok supaya batas hari UTC bisa diuji deterministik.
  const sekarang = new Date("2026-11-18T00:30:00.000Z");

  it("riwayat kosong berarti kuota penuh", () => {
    expect(hitungSisaKuotaDariRiwayat([], sekarang)).toBe(
      BATAS_PERTANYAAN_HARIAN,
    );
  });

  it("mengurangi kuota sejumlah entri hari ini", () => {
    const riwayat = [
      { dibuat_pada: "2026-11-18T00:10:00.000Z" },
      { dibuat_pada: "2026-11-18T00:20:00.000Z" },
      { dibuat_pada: "2026-11-18T00:25:00.000Z" },
    ];
    expect(hitungSisaKuotaDariRiwayat(riwayat, sekarang)).toBe(
      BATAS_PERTANYAAN_HARIAN - 3,
    );
  });

  it("entri kemarin (UTC) tidak mengurangi kuota hari ini", () => {
    const riwayat = [
      { dibuat_pada: "2026-11-17T10:00:00.000Z" },
      { dibuat_pada: "2026-11-17T23:30:00.000Z" },
    ];
    expect(hitungSisaKuotaDariRiwayat(riwayat, sekarang)).toBe(
      BATAS_PERTANYAAN_HARIAN,
    );
  });

  it("tidak pernah negatif bila entri hari ini melebihi batas", () => {
    const riwayat = Array.from({ length: 25 }, () => ({
      dibuat_pada: "2026-11-18T00:10:00.000Z",
    }));
    expect(hitungSisaKuotaDariRiwayat(riwayat, sekarang)).toBe(0);
  });

  it("mengabaikan entri dengan tanggal tidak valid", () => {
    const riwayat = [
      { dibuat_pada: "bukan-tanggal" },
      { dibuat_pada: 123 },
      { dibuat_pada: "2026-11-18T00:10:00.000Z" },
    ];
    expect(hitungSisaKuotaDariRiwayat(riwayat, sekarang)).toBe(
      BATAS_PERTANYAAN_HARIAN - 1,
    );
  });

  it("memakai batas kustom bila diberikan", () => {
    const riwayat = [
      { dibuat_pada: "2026-11-18T00:10:00.000Z" },
      { dibuat_pada: "2026-11-18T00:20:00.000Z" },
    ];
    expect(hitungSisaKuotaDariRiwayat(riwayat, sekarang, 5)).toBe(3);
  });
});

describe("formatTanggalJam", () => {
  it("memformat tanggal ISO menjadi tanggal dan jam Indonesia", () => {
    expect(
      formatTanggalJam("2026-11-17T15:30:00.000Z", "UTC"),
    ).toBe("17 November 2026, 15.30");
  });

  it("mengembalikan 'tidak tersedia' untuk tanggal tidak valid", () => {
    expect(formatTanggalJam("bukan-tanggal")).toBe("tidak tersedia");
    expect(formatTanggalJam("")).toBe("tidak tersedia");
  });
});

describe("kategoriSkor", () => {
  it("mengategorikan skor pada ambang yang benar", () => {
    expect(kategoriSkor(100)).toBe("Baik");
    expect(kategoriSkor(80)).toBe("Baik");
    expect(kategoriSkor(79)).toBe("Cukup");
    expect(kategoriSkor(50)).toBe("Cukup");
    expect(kategoriSkor(49)).toBe("Perlu perhatian");
    expect(kategoriSkor(0)).toBe("Perlu perhatian");
  });

  it("mengembalikan 'tidak tersedia' untuk skor tidak valid", () => {
    expect(kategoriSkor(Number.NaN)).toBe("tidak tersedia");
    expect(kategoriSkor(Number.POSITIVE_INFINITY)).toBe("tidak tersedia");
  });
});

describe("labelStatusKomponen", () => {
  it("memetakan status yang dikenal", () => {
    expect(labelStatusKomponen("baik")).toBe("Baik");
    expect(labelStatusKomponen("cukup")).toBe("Cukup");
    expect(labelStatusKomponen("perlu_perhatian")).toBe("Perlu perhatian");
  });

  it("mengembalikan 'tidak tersedia' untuk status tidak dikenal", () => {
    expect(labelStatusKomponen("aneh")).toBe("tidak tersedia");
    expect(labelStatusKomponen(null)).toBe("tidak tersedia");
    expect(labelStatusKomponen(42)).toBe("tidak tersedia");
  });
});

describe("labelSumberKonteks", () => {
  it("memetakan sumber yang dikenal", () => {
    expect(labelSumberKonteks("web")).toBe("Dari tes web");
    expect(labelSumberKonteks("apk")).toBe("Dari aplikasi Dokter HP");
    expect(labelSumberKonteks("manual")).toBe("Diisi manual");
  });

  it("mengembalikan 'tidak tersedia' untuk sumber tidak dikenal", () => {
    expect(labelSumberKonteks("lain")).toBe("tidak tersedia");
    expect(labelSumberKonteks(undefined)).toBe("tidak tersedia");
  });
});

describe("labelKomponen", () => {
  it("memetakan kunci komponen yang dikenal", () => {
    expect(labelKomponen("wifi")).toBe("WiFi");
    expect(labelKomponen("baterai")).toBe("Baterai");
    expect(labelKomponen("penyimpanan")).toBe("Penyimpanan");
    expect(labelKomponen("performa")).toBe("Performa");
    expect(labelKomponen("keamanan")).toBe("Keamanan");
  });

  it("mengembalikan null untuk kunci tidak dikenal", () => {
    expect(labelKomponen("aneh")).toBeNull();
  });
});

describe("ringkasPemeriksaanTerakhir", () => {
  it("mengembalikan null bila tidak ada pemeriksaan", () => {
    expect(ringkasPemeriksaanTerakhir(null)).toBeNull();
    expect(ringkasPemeriksaanTerakhir(undefined)).toBeNull();
  });

  it("mengembalikan null bila skor tidak valid", () => {
    expect(ringkasPemeriksaanTerakhir({ skor: "78" })).toBeNull();
    expect(ringkasPemeriksaanTerakhir({ skor: Number.NaN })).toBeNull();
    expect(ringkasPemeriksaanTerakhir({})).toBeNull();
  });

  it("merangkum pemeriksaan lengkap beserta komponennya", () => {
    const hasil = ringkasPemeriksaanTerakhir(
      {
        skor: 78,
        dibuat_pada: "2026-11-17T15:30:00.000Z",
        ringkasan: {
          wifi: { status: "baik", skor: 85, sumber: "web" },
          baterai: { status: "cukup", skor: 70, sumber: "manual" },
        },
      },
      "UTC",
    );
    expect(hasil).toEqual({
      skorTeks: "78 dari 100",
      kategori: "Cukup",
      tanggalTeks: "17 November 2026, 15.30",
      komponen: [
        { label: "WiFi", nilai: "Baik · Skor 85 · Dari tes web" },
        { label: "Baterai", nilai: "Cukup · Skor 70 · Diisi manual" },
      ],
    });
  });

  it("melewati kunci komponen yang tidak dikenal", () => {
    const hasil = ringkasPemeriksaanTerakhir({
      skor: 60,
      ringkasan: {
        aneh: { status: "baik", skor: 90, sumber: "web" },
        performa: { status: "perlu_perhatian", sumber: "apk" },
      },
    });
    expect(hasil?.komponen).toEqual([
      { label: "Performa", nilai: "Perlu perhatian · Dari aplikasi Dokter HP" },
    ]);
  });

  it("menerima ringkasan berbentuk string JSON", () => {
    const hasil = ringkasPemeriksaanTerakhir(
      {
        skor: 60,
        ringkasan: JSON.stringify({
          performa: { status: "perlu_perhatian", sumber: "apk" },
        }),
      },
      "UTC",
    );
    expect(hasil?.komponen).toEqual([
      { label: "Performa", nilai: "Perlu perhatian · Dari aplikasi Dokter HP" },
    ]);
  });

  it("string JSON yang rusak menghasilkan daftar komponen kosong", () => {
    const hasil = ringkasPemeriksaanTerakhir({
      skor: 60,
      ringkasan: "{rusak",
    });
    expect(hasil?.komponen).toEqual([]);
    expect(hasil?.skorTeks).toBe("60 dari 100");
  });

  it("tanggal hilang menghasilkan 'tidak tersedia'", () => {
    const hasil = ringkasPemeriksaanTerakhir({ skor: 90 });
    expect(hasil?.tanggalTeks).toBe("tidak tersedia");
    expect(hasil?.kategori).toBe("Baik");
  });
});
