import { describe, expect, it } from "vitest";
import {
  PESAN_PIN_LEMAH,
  PESAN_PIN_TIDAK_VALID,
  PIN_KUNCI_DETIK,
  apakahPinLemah,
  buatUrlMasukGoogle,
  kodeGalatApi,
  parseResponsKunciPin,
  parseSisaPercobaan,
  pesanGalatApi,
  pesanGalatMasuk,
  pesanValidasiPin,
  pesanValidasiPinBaru,
  validasiFormatPin,
  validasiRedirect,
} from "./pin";

// Tes unit logika PIN dan galat autentikasi (docs/api-contracts.md
// grup Auth Google + PIN). Semua fungsi yang diuji adalah fungsi
// murni. Klien HTTP (panggilApi/ApiError) diuji di api.test.ts.

describe("validasiFormatPin", () => {
  it("menerima PIN 4 sampai 8 digit", () => {
    expect(validasiFormatPin("1234")).toBe(true);
    expect(validasiFormatPin("123456")).toBe(true);
    expect(validasiFormatPin("12345678")).toBe(true);
  });

  it("menerima PIN berawalan nol (string, bukan angka)", () => {
    expect(validasiFormatPin("0123")).toBe(true);
    expect(validasiFormatPin("0000")).toBe(true);
  });

  it("menolak PIN terlalu pendek atau terlalu panjang", () => {
    expect(validasiFormatPin("")).toBe(false);
    expect(validasiFormatPin("123")).toBe(false);
    expect(validasiFormatPin("123456789")).toBe(false);
  });

  it("menolak PIN yang mengandung bukan-digit", () => {
    expect(validasiFormatPin("12a4")).toBe(false);
    expect(validasiFormatPin("12 34")).toBe(false);
    expect(validasiFormatPin("1234 ")).toBe(false);
    expect(validasiFormatPin(" 1234")).toBe(false);
    expect(validasiFormatPin("1234\n")).toBe(false);
    // Digit lebar penuh (fullwidth) bukan digit ASCII 0-9.
    expect(validasiFormatPin("１２３４")).toBe(false);
  });

  it("menolak bukan-string", () => {
    expect(validasiFormatPin(1234)).toBe(false);
    expect(validasiFormatPin(null)).toBe(false);
    expect(validasiFormatPin(undefined)).toBe(false);
    expect(validasiFormatPin({})).toBe(false);
  });
});

describe("pesanValidasiPin", () => {
  it("mengembalikan null untuk PIN yang valid", () => {
    expect(pesanValidasiPin("1234")).toBeNull();
    expect(pesanValidasiPin("01234567")).toBeNull();
  });

  it("mengembalikan pesan copy.md untuk PIN yang tidak valid", () => {
    expect(pesanValidasiPin("123")).toBe(PESAN_PIN_TIDAK_VALID);
    expect(pesanValidasiPin("abcd")).toBe(PESAN_PIN_TIDAK_VALID);
    expect(pesanValidasiPin("")).toBe(PESAN_PIN_TIDAK_VALID);
  });
});

describe("apakahPinLemah dan pesanValidasiPinBaru (R-11)", () => {
  it("menolak digit sama dan urutan ketat", () => {
    for (const lemah of ["0000", "9999", "1234", "4321", "012345"]) {
      expect(apakahPinLemah(lemah)).toBe(true);
      expect(pesanValidasiPinBaru(lemah)).toBe(PESAN_PIN_LEMAH);
    }
  });

  it("menerima PIN acak yang tidak berpola", () => {
    for (const kuat of ["1357", "2846", "7391", "1029"]) {
      expect(apakahPinLemah(kuat)).toBe(false);
      expect(pesanValidasiPinBaru(kuat)).toBeNull();
    }
  });

  it("format tidak valid didahulukan atas pesan lemah", () => {
    expect(pesanValidasiPinBaru("12")).toBe(PESAN_PIN_TIDAK_VALID);
    expect(pesanValidasiPinBaru("abcd")).toBe(PESAN_PIN_TIDAK_VALID);
  });
});

describe("kodeGalatApi / pesanGalatApi", () => {
  it("mengambil kode dan pesan dari envelope galat", () => {
    const body = {
      success: false,
      error: { code: "PIN_SALAH", message: "PIN salah. Coba lagi." },
    };
    expect(kodeGalatApi(body)).toBe("PIN_SALAH");
    expect(pesanGalatApi(body)).toBe("PIN salah. Coba lagi.");
  });

  it("mengembalikan null untuk badan yang cacat", () => {
    expect(kodeGalatApi(null)).toBeNull();
    expect(kodeGalatApi(undefined)).toBeNull();
    expect(kodeGalatApi({})).toBeNull();
    expect(kodeGalatApi({ error: null })).toBeNull();
    expect(kodeGalatApi({ error: { code: 401 } })).toBeNull();
    expect(pesanGalatApi({})).toBeNull();
    expect(pesanGalatApi({ error: { message: "" } })).toBeNull();
  });
});

describe("parseResponsKunciPin", () => {
  const kunci = (details: unknown) => ({
    success: false,
    error: {
      code: "PIN_TERKUNCI",
      message: "Terlalu banyak percobaan salah.",
      details,
    },
  });

  it("membaca sisa_detik dari rincian (bentuk implementasi Worker)", () => {
    expect(
      parseResponsKunciPin(kunci({ terkunci: true, sisa_detik: 30 })),
    ).toEqual({ terkunci: true, sisaDetik: 30 });
    expect(
      parseResponsKunciPin(kunci({ terkunci: true, sisa_detik: 12 })),
    ).toEqual({ terkunci: true, sisaDetik: 12 });
  });

  it("menghitung sisa detik dari terkunci_sampai (bentuk kontrak API)", () => {
    const sekarang = Date.parse("2026-11-17T15:30:00.000Z");
    expect(
      parseResponsKunciPin(
        kunci({ terkunci_sampai: "2026-11-17T15:30:25.000Z" }),
        sekarang,
      ),
    ).toEqual({ terkunci: true, sisaDetik: 25 });
  });

  it("membulatkan sisa detik pecahan ke atas", () => {
    expect(
      parseResponsKunciPin(kunci({ sisa_detik: 12.3 })),
    ).toEqual({ terkunci: true, sisaDetik: 13 });
  });

  it("memakai durasi baku 30 detik bila rincian tidak ada atau tidak valid", () => {
    expect(parseResponsKunciPin(kunci(undefined))).toEqual({
      terkunci: true,
      sisaDetik: PIN_KUNCI_DETIK,
    });
    expect(parseResponsKunciPin(kunci({}))).toEqual({
      terkunci: true,
      sisaDetik: PIN_KUNCI_DETIK,
    });
    expect(parseResponsKunciPin(kunci({ sisa_detik: -5 }))).toEqual({
      terkunci: true,
      sisaDetik: PIN_KUNCI_DETIK,
    });
    expect(parseResponsKunciPin(kunci({ sisa_detik: 0 }))).toEqual({
      terkunci: true,
      sisaDetik: PIN_KUNCI_DETIK,
    });
    expect(parseResponsKunciPin(kunci({ sisa_detik: "30" }))).toEqual({
      terkunci: true,
      sisaDetik: PIN_KUNCI_DETIK,
    });
    // terkunci_sampai di masa lalu tidak dipakai.
    const sekarang = Date.parse("2026-11-17T15:31:00.000Z");
    expect(
      parseResponsKunciPin(
        kunci({ terkunci_sampai: "2026-11-17T15:30:30.000Z" }),
        sekarang,
      ),
    ).toEqual({ terkunci: true, sisaDetik: PIN_KUNCI_DETIK });
  });

  it("mengembalikan null bila bukan respons PIN_TERKUNCI", () => {
    expect(parseResponsKunciPin(null)).toBeNull();
    expect(parseResponsKunciPin({})).toBeNull();
    expect(
      parseResponsKunciPin({
        success: false,
        error: { code: "PIN_SALAH", details: { sisa_detik: 30 } },
      }),
    ).toBeNull();
    expect(
      parseResponsKunciPin({ success: true, data: { valid: true } }),
    ).toBeNull();
  });
});

describe("parseSisaPercobaan", () => {
  const salah = (details: unknown) => ({
    success: false,
    error: {
      code: "PIN_SALAH",
      message: "PIN salah. Coba lagi.",
      details,
    },
  });

  it("membaca sisa_percobaan dari rincian", () => {
    expect(parseSisaPercobaan(salah({ sisa_percobaan: 3 }))).toBe(3);
    expect(parseSisaPercobaan(salah({ sisa_percobaan: 0 }))).toBe(0);
    expect(parseSisaPercobaan(salah({ sisa_percobaan: 5 }))).toBe(5);
  });

  it("mengembalikan null bila nilai tidak ada atau di luar batas", () => {
    expect(parseSisaPercobaan(salah(undefined))).toBeNull();
    expect(parseSisaPercobaan(salah({}))).toBeNull();
    expect(parseSisaPercobaan(salah({ sisa_percobaan: 9 }))).toBeNull();
    expect(parseSisaPercobaan(salah({ sisa_percobaan: -1 }))).toBeNull();
    expect(parseSisaPercobaan(salah({ sisa_percobaan: 2.5 }))).toBeNull();
    expect(parseSisaPercobaan(salah({ sisa_percobaan: "3" }))).toBeNull();
  });

  it("mengembalikan null bila bukan respons PIN_SALAH", () => {
    expect(parseSisaPercobaan(null)).toBeNull();
    expect(
      parseSisaPercobaan({
        success: false,
        error: { code: "PIN_TERKUNCI", details: { sisa_percobaan: 3 } },
      }),
    ).toBeNull();
  });
});

describe("pesanGalatMasuk", () => {
  it("memetakan tiap nilai ?error= ke pesan copy.md", () => {
    expect(pesanGalatMasuk("ditolak")).toBe(
      "Masuk dibatalkan. Ketuk Masuk dengan Google untuk mencoba lagi.",
    );
    expect(pesanGalatMasuk("oauth_gagal")).toBe(
      "Masuk dengan Google gagal. Coba lagi.",
    );
    expect(pesanGalatMasuk("server_sibuk")).toBe(
      "Server sedang sibuk, coba lagi nanti.",
    );
    expect(pesanGalatMasuk("oauth_belum_disiapkan")).toBe(
      "Masuk dengan Google belum disiapkan untuk situs ini.",
    );
  });

  it("nilai yang tidak dikenal diperlakukan sebagai oauth_gagal", () => {
    expect(pesanGalatMasuk("sesuatu-yang-asing")).toBe(
      "Masuk dengan Google gagal. Coba lagi.",
    );
  });

  it("mengembalikan null bila tidak ada nilai galat", () => {
    expect(pesanGalatMasuk(null)).toBeNull();
    expect(pesanGalatMasuk("")).toBeNull();
  });
});

describe("validasiRedirect", () => {
  it("menerima path relatif dalam aplikasi", () => {
    expect(validasiRedirect("/dashboard")).toBe("/dashboard");
    expect(validasiRedirect("/pengaturan/pin")).toBe("/pengaturan/pin");
    expect(validasiRedirect("/wifi")).toBe("/wifi");
  });

  it("menolak URL absolut dan path yang diawali //", () => {
    expect(validasiRedirect("https://jahat.example.com")).toBe("/dashboard");
    expect(validasiRedirect("//jahat.example.com")).toBe("/dashboard");
    expect(validasiRedirect("dashboard")).toBe("/dashboard");
  });

  it("menolak backslash dan karakter kontrol (R-06)", () => {
    expect(validasiRedirect("/\\jahat.example.com")).toBe("/dashboard");
    expect(validasiRedirect("/wifi\\@jahat.example.com")).toBe("/dashboard");
    expect(validasiRedirect("/dashboard\nhttps://jahat.example.com")).toBe("/dashboard");
  });

  it("menolak nilai yang terlalu panjang", () => {
    expect(validasiRedirect(`/${"a".repeat(600)}`)).toBe("/dashboard");
  });

  it("memakai /dashboard bila tidak ada tujuan", () => {
    expect(validasiRedirect(null)).toBe("/dashboard");
    expect(validasiRedirect(undefined)).toBe("/dashboard");
    expect(validasiRedirect("")).toBe("/dashboard");
  });
});

describe("buatUrlMasukGoogle", () => {
  it("mengarah ke endpoint mulai masuk Google dengan redirect /dashboard", () => {
    expect(buatUrlMasukGoogle()).toMatch(
      /\/api\/auth\/google\?redirect=%2Fdashboard$/,
    );
  });

  it("membawa tujuan redirect yang valid", () => {
    expect(buatUrlMasukGoogle("/pengaturan/pin")).toMatch(
      /\/api\/auth\/google\?redirect=%2Fpengaturan%2Fpin$/,
    );
  });

  it("mengganti tujuan yang tidak valid dengan /dashboard", () => {
    expect(buatUrlMasukGoogle("https://jahat.example.com")).toMatch(
      /\/api\/auth\/google\?redirect=%2Fdashboard$/,
    );
  });
});
