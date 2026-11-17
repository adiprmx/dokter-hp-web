import { describe, expect, it } from "vitest";
import {
  VERSI_APLIKASI_WEB,
  formatTanggalWaktu,
  konfirmasiHapusValid,
  labelPerangkat,
  validasiNama,
} from "./akun";

describe("konfirmasiHapusValid", () => {
  it("menerima kata yang persis sama", () => {
    expect(konfirmasiHapusValid("HAPUS", "HAPUS")).toBe(true);
  });

  it("menolak huruf yang berbeda", () => {
    expect(konfirmasiHapusValid("hapus", "HAPUS")).toBe(false);
    expect(konfirmasiHapusValid("Hapus", "HAPUS")).toBe(false);
  });

  it("menolak spasi tambahan di ujung", () => {
    expect(konfirmasiHapusValid(" HAPUS", "HAPUS")).toBe(false);
    expect(konfirmasiHapusValid("HAPUS ", "HAPUS")).toBe(false);
  });

  it("menolak masukan kosong dan kata lain", () => {
    expect(konfirmasiHapusValid("", "HAPUS")).toBe(false);
    expect(konfirmasiHapusValid("YA", "HAPUS")).toBe(false);
    expect(konfirmasiHapusValid("HAPUSKAN", "HAPUS")).toBe(false);
  });

  it("mengikuti kata yang diharapkan sebagai parameter (bahasa aktif)", () => {
    // Kunci i18n settings.deleteAccountConfirmWord: "DELETE" (Inggris).
    expect(konfirmasiHapusValid("DELETE", "DELETE")).toBe(true);
    expect(konfirmasiHapusValid("HAPUS", "DELETE")).toBe(false);
    expect(konfirmasiHapusValid("delete", "DELETE")).toBe(false);
  });
});

describe("validasiNama", () => {
  it("menerima nama biasa dan memangkas spasi ujung", () => {
    expect(validasiNama("Adip")).toEqual({ valid: true, nama: "Adip" });
    expect(validasiNama("  Adip RMX  ")).toEqual({
      valid: true,
      nama: "Adip RMX",
    });
  });

  it("menolak nama kosong atau hanya spasi", () => {
    expect(validasiNama("")).toEqual({
      valid: false,
      pesan: "Nama tidak boleh kosong.",
    });
    expect(validasiNama("   ")).toEqual({
      valid: false,
      pesan: "Nama tidak boleh kosong.",
    });
  });

  it("menerima nama tepat 100 karakter", () => {
    const nama = "A".repeat(100);
    expect(validasiNama(nama)).toEqual({ valid: true, nama });
  });

  it("menolak nama lebih dari 100 karakter", () => {
    expect(validasiNama("A".repeat(101))).toEqual({
      valid: false,
      pesan: "Nama terlalu panjang. Maksimal 100 karakter.",
    });
  });

  it("menghitung panjang setelah dipangkas", () => {
    // 100 huruf + spasi di ujung tetap valid karena spasi dipangkas dulu.
    expect(validasiNama(`  ${"A".repeat(100)}  `).valid).toBe(true);
  });
});

describe("labelPerangkat", () => {
  it("mengenali Chrome di Android", () => {
    expect(
      labelPerangkat(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome di Android");
  });

  it("mengenali Firefox di Windows dan Safari di iPhone", () => {
    expect(
      labelPerangkat(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
      ),
    ).toBe("Firefox di Windows");
    expect(
      labelPerangkat(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari di iPhone/iPad");
  });

  it("mengembalikan 'tidak tersedia' bila user agent kosong", () => {
    expect(labelPerangkat(null)).toBe("tidak tersedia");
    expect(labelPerangkat(undefined)).toBe("tidak tersedia");
    expect(labelPerangkat("")).toBe("tidak tersedia");
  });

  it("mengembalikan 'Perangkat tidak dikenal' bila tidak ada pola yang cocok", () => {
    expect(labelPerangkat("BotPalsu/1.0")).toBe("Perangkat tidak dikenal");
  });
});

describe("formatTanggalWaktu", () => {
  it("memformat waktu ISO ke format Indonesia", () => {
    // 2026-11-17T15:30:00Z = 22.30 WIB.
    expect(formatTanggalWaktu("2026-11-17T15:30:00.000Z", "Asia/Jakarta")).toBe(
      "17 November 2026, 22.30",
    );
  });

  it("mengembalikan 'tidak tersedia' untuk nilai yang tidak bisa dibaca", () => {
    expect(formatTanggalWaktu("bukan-tanggal")).toBe("tidak tersedia");
    expect(formatTanggalWaktu("")).toBe("tidak tersedia");
  });
});

describe("VERSI_APLIKASI_WEB", () => {
  it("berbentuk nomor versi tiga angka", () => {
    expect(VERSI_APLIKASI_WEB).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
