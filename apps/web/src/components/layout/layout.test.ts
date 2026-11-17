import { describe, expect, it } from "vitest";
import { judulHalaman } from "../../App";
import {
  RUTE_PUBLIK,
  RUTE_WAJIB_MASUK,
  putuskanArahAuth,
  ruteButuhMasuk,
  rutePublik,
} from "./RequireAuth";

// Tes shell/routing (Tim Shell/Routing): daftar rute publik vs
// wajib-masuk, keputusan gerbang auth, dan judul per rute.
// Yang diuji adalah fungsi murni — tanpa DOM dan tanpa jaringan.

describe("daftar rute", () => {
  it("memuat semua rute wajib-masuk dari tugas", () => {
    expect([...RUTE_WAJIB_MASUK].sort()).toEqual(
      [
        "/ai",
        "/baterai",
        "/dashboard",
        "/keamanan",
        "/kunci",
        "/pengaturan",
        "/pengaturan/pin",
        "/penyimpanan",
        "/performa",
        "/riwayat",
      ].sort(),
    );
  });

  it("memuat rute publik utama", () => {
    for (const rute of [
      "/",
      "/wifi",
      "/masuk",
      "/tentang",
      "/privasi",
      "/syarat",
    ]) {
      expect(RUTE_PUBLIK).toContain(rute);
    }
  });

  it("tidak ada rute yang sekaligus publik dan wajib-masuk", () => {
    for (const rute of RUTE_WAJIB_MASUK) {
      expect(RUTE_PUBLIK).not.toContain(rute);
    }
  });

  it("ruteButuhMasuk membedakan rute terdaftar", () => {
    expect(ruteButuhMasuk("/dashboard")).toBe(true);
    expect(ruteButuhMasuk("/pengaturan/pin")).toBe(true);
    expect(ruteButuhMasuk("/kunci")).toBe(true);
    expect(ruteButuhMasuk("/")).toBe(false);
    expect(ruteButuhMasuk("/wifi")).toBe(false);
    expect(ruteButuhMasuk("/masuk")).toBe(false);
    expect(ruteButuhMasuk("/tentang")).toBe(false);
  });

  it("ruteButuhMasuk mengenali awalan dinamis dan mengabaikan query", () => {
    expect(ruteButuhMasuk("/pengaturan/notifikasi")).toBe(true);
    expect(ruteButuhMasuk("/dashboard?tab=skor")).toBe(true);
    expect(ruteButuhMasuk("/panduan/wifi-lemot")).toBe(false);
    expect(ruteButuhMasuk("/tidak-ada")).toBe(false);
  });

  it("rutePublik mengenali panduan dinamis", () => {
    expect(rutePublik("/panduan/wifi-lemot")).toBe(true);
    expect(rutePublik("/panduan/ganti-dns")).toBe(true);
    expect(rutePublik("/dashboard")).toBe(false);
    expect(rutePublik("/kunci")).toBe(false);
  });
});

describe("putuskanArahAuth", () => {
  it("tanpa sesi selalu ke /masuk", () => {
    expect(putuskanArahAuth("tidak-masuk", "terbuka")).toBe("masuk");
    expect(putuskanArahAuth("tidak-masuk", "kunci")).toBe("masuk");
  });

  it("rute aplikasi: terkunci ke /kunci, terbuka ditampilkan", () => {
    expect(putuskanArahAuth("terkunci", "terbuka")).toBe("kunci");
    expect(putuskanArahAuth("terbuka", "terbuka")).toBe("tampilkan");
  });

  it("layar kunci: terkunci ditampilkan, terbuka ke /dashboard", () => {
    expect(putuskanArahAuth("terkunci", "kunci")).toBe("tampilkan");
    expect(putuskanArahAuth("terbuka", "kunci")).toBe("dashboard");
  });
});

describe("judulHalaman", () => {
  it("judul landing dan WiFi sesuai docs/seo.md", () => {
    expect(judulHalaman("/")).toBe(
      "Dokter HP — Cek WiFi Lemot, Baterai Boros & Kesehatan HP",
    );
    expect(judulHalaman("/wifi")).toBe(
      "Cek Kecepatan WiFi — Tes Unduh & Latensi Gratis | Dokter HP",
    );
  });

  it("judul panduan sesuai slug", () => {
    expect(judulHalaman("/panduan/wifi-lemot")).toBe(
      "WiFi Lemot Padahal Sinyal Penuh? Penyebab & Cara Mengatasinya | Dokter HP",
    );
    expect(judulHalaman("/panduan/slug-baru")).toBe("Panduan | Dokter HP");
  });

  it("setiap rute wajib-masuk punya judul sendiri", () => {
    for (const rute of RUTE_WAJIB_MASUK) {
      expect(judulHalaman(rute)).not.toBe("Dokter HP");
      expect(judulHalaman(rute)).toContain("Dokter HP");
    }
  });

  it("rute tidak dikenal memakai judul default", () => {
    expect(judulHalaman("/tidak-ada")).toBe("Dokter HP");
  });
});
