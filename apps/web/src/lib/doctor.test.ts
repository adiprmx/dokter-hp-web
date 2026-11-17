import { describe, expect, it } from "vitest";
import {
  aplikasiPerluDitinjau,
  buatBodiBaterai,
  buatBodiKeamanan,
  buatBodiPenyimpanan,
  buatBodiPerforma,
  formatPerkiraanJam,
  formatTanggalWaktu,
  gabungAplikasiKeamanan,
  hitungPersenPenyimpanan,
  hitungRuangKosongGb,
  klasifikasiBaterai,
  klasifikasiKeamanan,
  klasifikasiPenyimpanan,
  klasifikasiPerforma,
  labelKondisiPerforma,
  labelStatus,
  labelStatusBaterai,
  labelSumber,
  parseAngka,
  penyimpananHampirPenuh,
  perkiraanJamPakai,
  pesanGalatHapus,
  pesanGalatMuat,
  pesanGalatSimpan,
  skorKomponen,
  uraiEntriDokter,
  validasiBaterai,
  validasiKeamanan,
  validasiPenyimpanan,
  validasiPerforma,
  type EntriKeamanan,
} from "./doctor";

describe("parseAngka", () => {
  it("mengurai angka biasa dan koma desimal", () => {
    expect(parseAngka("45")).toBe(45);
    expect(parseAngka("12,5")).toBe(12.5);
    expect(parseAngka("  7.25  ")).toBe(7.25);
  });

  it("mengembalikan null untuk teks kosong atau bukan angka", () => {
    expect(parseAngka("")).toBeNull();
    expect(parseAngka("   ")).toBeNull();
    expect(parseAngka("abc")).toBeNull();
    expect(parseAngka("12a")).toBeNull();
  });
});

describe("hitungPersenPenyimpanan", () => {
  it("menghitung persen terpakai", () => {
    expect(hitungPersenPenyimpanan(256, 128)).toBe(50);
    expect(hitungPersenPenyimpanan(64, 64)).toBe(100);
    expect(hitungPersenPenyimpanan(128, 0)).toBe(0);
    expect(hitungPersenPenyimpanan(3, 1)).toBe(33.3);
  });

  it("mengembalikan null untuk angka tidak valid", () => {
    expect(hitungPersenPenyimpanan(0, 0)).toBeNull();
    expect(hitungPersenPenyimpanan(-128, 10)).toBeNull();
    expect(hitungPersenPenyimpanan(128, -1)).toBeNull();
    expect(hitungPersenPenyimpanan(128, 129)).toBeNull();
    expect(hitungPersenPenyimpanan(Number.NaN, 10)).toBeNull();
  });
});

describe("hitungRuangKosongGb", () => {
  it("menghitung sisa ruang", () => {
    expect(hitungRuangKosongGb(256, 128)).toBe(128);
    expect(hitungRuangKosongGb(64, 63.5)).toBe(0.5);
    expect(hitungRuangKosongGb(32, 32)).toBe(0);
  });

  it("mengembalikan null untuk angka tidak valid", () => {
    expect(hitungRuangKosongGb(0, 0)).toBeNull();
    expect(hitungRuangKosongGb(64, 65)).toBeNull();
    expect(hitungRuangKosongGb(64, -1)).toBeNull();
  });
});

describe("klasifikasiPenyimpanan dan penyimpananHampirPenuh", () => {
  it("mengklasifikasi dari persen terpakai", () => {
    expect(klasifikasiPenyimpanan(0)).toBe("baik");
    expect(klasifikasiPenyimpanan(69.9)).toBe("baik");
    expect(klasifikasiPenyimpanan(70)).toBe("cukup");
    expect(klasifikasiPenyimpanan(90)).toBe("cukup");
    expect(klasifikasiPenyimpanan(90.1)).toBe("perlu_perhatian");
    expect(klasifikasiPenyimpanan(100)).toBe("perlu_perhatian");
  });

  it("peringatan hanya di atas 90%", () => {
    expect(penyimpananHampirPenuh(90)).toBe(false);
    expect(penyimpananHampirPenuh(90.1)).toBe(true);
    expect(penyimpananHampirPenuh(100)).toBe(true);
  });
});

describe("klasifikasiBaterai", () => {
  it("mengklasifikasi dari level baterai", () => {
    expect(klasifikasiBaterai(100)).toBe("baik");
    expect(klasifikasiBaterai(50)).toBe("baik");
    expect(klasifikasiBaterai(49)).toBe("cukup");
    expect(klasifikasiBaterai(20)).toBe("cukup");
    expect(klasifikasiBaterai(19)).toBe("perlu_perhatian");
    expect(klasifikasiBaterai(0)).toBe("perlu_perhatian");
  });
});

describe("perkiraanJamPakai dan formatPerkiraanJam", () => {
  it("menghitung perkiraan dari asumsi 10% per jam", () => {
    expect(perkiraanJamPakai(100)).toBe(10);
    expect(perkiraanJamPakai(45)).toBe(4.5);
    expect(perkiraanJamPakai(0)).toBe(0);
  });

  it("mengembalikan null di luar 0-100", () => {
    expect(perkiraanJamPakai(-1)).toBeNull();
    expect(perkiraanJamPakai(101)).toBeNull();
    expect(perkiraanJamPakai(Number.NaN)).toBeNull();
  });

  it("memformat jam dan menit dengan tanda perkiraan", () => {
    expect(formatPerkiraanJam(4.5)).toBe("±4,5 jam");
    expect(formatPerkiraanJam(10)).toBe("±10 jam");
    expect(formatPerkiraanJam(0.5)).toBe("±30 menit");
    expect(formatPerkiraanJam(0)).toBe("±1 menit");
  });
});

describe("klasifikasiPerforma", () => {
  it("memetakan kondisi ke status", () => {
    expect(klasifikasiPerforma("lancar")).toBe("baik");
    expect(klasifikasiPerforma("kadang_lambat")).toBe("cukup");
    expect(klasifikasiPerforma("sering_lambat")).toBe("perlu_perhatian");
  });

  it("memberi label kondisi", () => {
    expect(labelKondisiPerforma("lancar")).toBe("Lancar");
    expect(labelKondisiPerforma("kadang_lambat")).toBe("Kadang lambat");
    expect(labelKondisiPerforma("sering_lambat")).toBe("Sering lambat");
  });
});

describe("aplikasiPerluDitinjau dan klasifikasiKeamanan", () => {
  it("memilih aplikasi non-sistem dengan 4 izin berbahaya atau lebih", () => {
    const hasil = aplikasiPerluDitinjau([
      { nama: "A", izinBerbahaya: 4, sistem: false },
      { nama: "B", izinBerbahaya: 3, sistem: false },
      { nama: "C", izinBerbahaya: 9, sistem: true },
      { nama: "D", izinBerbahaya: 5, sistem: false },
    ]);
    expect(hasil.map((item) => item.nama)).toEqual(["A", "D"]);
  });

  it("mengklasifikasi dari jumlah yang perlu ditinjau", () => {
    expect(klasifikasiKeamanan(0)).toBe("baik");
    expect(klasifikasiKeamanan(1)).toBe("cukup");
    expect(klasifikasiKeamanan(2)).toBe("cukup");
    expect(klasifikasiKeamanan(3)).toBe("perlu_perhatian");
  });
});

describe("gabungAplikasiKeamanan", () => {
  it("menggabungkan aplikasi dan memakai entri terbaru untuk nama yang sama", () => {
    const entri: EntriKeamanan[] = [
      {
        id: "baru",
        jenis: "keamanan",
        skor: 65,
        status: "cukup",
        sumber: "manual",
        dibuatPada: "2026-11-17T10:00:00.000Z",
        detail: {
          aplikasi: [{ nama: "Chat Cepat", izinBerbahaya: 5, sistem: false }],
        },
      },
      {
        id: "lama",
        jenis: "keamanan",
        skor: 85,
        status: "baik",
        sumber: "apk",
        dibuatPada: "2026-11-16T10:00:00.000Z",
        detail: {
          aplikasi: [
            { nama: "chat cepat", izinBerbahaya: 2, sistem: false },
            { nama: "Galeri", izinBerbahaya: 1, sistem: true },
          ],
        },
      },
    ];
    const gabungan = gabungAplikasiKeamanan(entri);
    expect(gabungan).toHaveLength(2);
    expect(gabungan[0]).toMatchObject({
      nama: "Chat Cepat",
      izinBerbahaya: 5,
      sumber: "manual",
    });
    expect(gabungan[1].nama).toBe("Galeri");
  });
});

describe("skorKomponen dan label", () => {
  it("memetakan status ke skor", () => {
    expect(skorKomponen("baik")).toBe(85);
    expect(skorKomponen("cukup")).toBe(65);
    expect(skorKomponen("perlu_perhatian")).toBe(40);
  });

  it("memberi label status, sumber, dan status baterai", () => {
    expect(labelStatus("baik")).toBe("Baik");
    expect(labelStatus("cukup")).toBe("Cukup");
    expect(labelStatus("perlu_perhatian")).toBe("Perlu perhatian");
    expect(labelSumber("manual")).toBe("Diisi manual");
    expect(labelSumber("apk")).toBe("Dari aplikasi Dokter HP");
    expect(labelSumber("web")).toBe("Dari tes web");
    expect(labelSumber(null)).toBe("tidak tersedia");
    expect(labelStatusBaterai("mengisi")).toBe("Mengisi daya");
    expect(labelStatusBaterai("dipakai")).toBe("Dipakai");
    expect(labelStatusBaterai("penuh")).toBe("Penuh");
  });
});

describe("formatTanggalWaktu", () => {
  it("memformat tanggal dan jam Indonesia", () => {
    const tanggal = new Date(2026, 10, 17, 22, 15, 0);
    expect(formatTanggalWaktu(tanggal.toISOString())).toBe(
      "17 November 2026, 22.15",
    );
  });

  it("mengembalikan 'tidak tersedia' untuk tanggal rusak", () => {
    expect(formatTanggalWaktu("bukan-tanggal")).toBe("tidak tersedia");
    expect(formatTanggalWaktu("")).toBe("tidak tersedia");
  });
});

describe("validasiBaterai", () => {
  it("menerima nilai yang valid", () => {
    expect(
      validasiBaterai({ persen: "45", statusBaterai: "dipakai" }),
    ).toEqual({});
    expect(
      validasiBaterai({ persen: "0", statusBaterai: "mengisi" }),
    ).toEqual({});
    expect(
      validasiBaterai({ persen: "100", statusBaterai: "penuh" }),
    ).toEqual({});
  });

  it("menolak persen di luar 0-100 atau bukan bilangan bulat", () => {
    expect(
      validasiBaterai({ persen: "", statusBaterai: "dipakai" }),
    ).toHaveProperty("persen");
    expect(
      validasiBaterai({ persen: "101", statusBaterai: "dipakai" }),
    ).toHaveProperty("persen");
    expect(
      validasiBaterai({ persen: "-1", statusBaterai: "dipakai" }),
    ).toHaveProperty("persen");
    expect(
      validasiBaterai({ persen: "45,5", statusBaterai: "dipakai" }),
    ).toHaveProperty("persen");
    expect(
      validasiBaterai({ persen: "abc", statusBaterai: "dipakai" }),
    ).toHaveProperty("persen");
  });

  it("menolak status yang tidak dipilih", () => {
    expect(
      validasiBaterai({ persen: "45", statusBaterai: "" }),
    ).toHaveProperty("status_baterai");
  });
});

describe("validasiPenyimpanan", () => {
  it("menerima nilai yang valid", () => {
    expect(
      validasiPenyimpanan({ totalGb: "256", terpakaiGb: "128" }),
    ).toEqual({});
    expect(
      validasiPenyimpanan({ totalGb: "64", terpakaiGb: "0" }),
    ).toEqual({});
    expect(
      validasiPenyimpanan({ totalGb: "128,5", terpakaiGb: "12,5" }),
    ).toEqual({});
  });

  it("menolak total nol atau kosong", () => {
    expect(
      validasiPenyimpanan({ totalGb: "0", terpakaiGb: "0" }),
    ).toHaveProperty("total_gb");
    expect(
      validasiPenyimpanan({ totalGb: "", terpakaiGb: "10" }),
    ).toHaveProperty("total_gb");
  });

  it("menolak terpakai yang lebih besar dari total", () => {
    expect(
      validasiPenyimpanan({ totalGb: "64", terpakaiGb: "65" }),
    ).toHaveProperty("terpakai_gb");
  });
});

describe("validasiPerforma", () => {
  const dasar = {
    kondisi: "lancar",
    catatan: "",
    ramTotalGb: "",
    ramKosongGb: "",
    cpuPersen: "",
    suhuC: "",
    perangkat: "",
    android: "",
    prosesor: "",
  };

  it("menerima kondisi saja", () => {
    expect(validasiPerforma(dasar)).toEqual({});
  });

  it("menerima detail tambahan yang valid", () => {
    expect(
      validasiPerforma({
        ...dasar,
        kondisi: "sering_lambat",
        catatan: "Berat saat membuka kamera.",
        ramTotalGb: "8",
        ramKosongGb: "1,5",
        cpuPersen: "90",
        suhuC: "41",
        perangkat: "POCO M7 Pro",
        android: "14",
        prosesor: "Dimensity 7025",
      }),
    ).toEqual({});
  });

  it("menolak kondisi yang tidak dipilih", () => {
    expect(validasiPerforma({ ...dasar, kondisi: "" })).toHaveProperty(
      "kondisi",
    );
  });

  it("menolak RAM kosong yang lebih besar dari total", () => {
    expect(
      validasiPerforma({ ...dasar, ramTotalGb: "8", ramKosongGb: "9" }),
    ).toHaveProperty("ram_kosong_gb");
  });

  it("menolak CPU di luar 0-100 dan catatan terlalu panjang", () => {
    expect(validasiPerforma({ ...dasar, cpuPersen: "101" })).toHaveProperty(
      "cpu_persen",
    );
    expect(
      validasiPerforma({ ...dasar, catatan: "x".repeat(501) }),
    ).toHaveProperty("catatan");
  });
});

describe("validasiKeamanan", () => {
  it("menerima nilai yang valid", () => {
    expect(
      validasiKeamanan({ namaAplikasi: "Chat Cepat", izinBerbahaya: "5" }),
    ).toEqual({});
    expect(
      validasiKeamanan({ namaAplikasi: "Galeri", izinBerbahaya: "0" }),
    ).toEqual({});
  });

  it("menolak nama kosong dan izin di luar 0-100", () => {
    expect(
      validasiKeamanan({ namaAplikasi: "", izinBerbahaya: "5" }),
    ).toHaveProperty("nama_aplikasi");
    expect(
      validasiKeamanan({ namaAplikasi: "  ", izinBerbahaya: "5" }),
    ).toHaveProperty("nama_aplikasi");
    expect(
      validasiKeamanan({ namaAplikasi: "Chat", izinBerbahaya: "-1" }),
    ).toHaveProperty("izin_berbahaya");
    expect(
      validasiKeamanan({ namaAplikasi: "Chat", izinBerbahaya: "4,5" }),
    ).toHaveProperty("izin_berbahaya");
  });
});

describe("buatBodi*", () => {
  it("membuat body baterai dengan status dari level", () => {
    const bodi = buatBodiBaterai(15, "dipakai", false);
    expect(bodi.skor).toBe(40);
    expect(bodi.ringkasan.baterai).toMatchObject({
      status: "perlu_perhatian",
      skor: 40,
      sumber: "manual",
      persen: 15,
      status_baterai: "dipakai",
      hemat_daya: false,
    });
  });

  it("membuat body penyimpanan dengan status dari persen", () => {
    const bodi = buatBodiPenyimpanan(100, 95);
    expect(bodi.skor).toBe(40);
    expect(bodi.ringkasan.penyimpanan).toMatchObject({
      status: "perlu_perhatian",
      total_gb: 100,
      terpakai_gb: 95,
    });
  });

  it("membuat body performa dan hanya menyimpan detail yang diisi", () => {
    const bodi = buatBodiPerforma({
      kondisi: "sering_lambat",
      catatan: "Berat.",
      cpuPersen: 90,
    });
    expect(bodi.skor).toBe(40);
    expect(bodi.ringkasan.performa).toMatchObject({
      status: "perlu_perhatian",
      kondisi: "sering_lambat",
      catatan: "Berat.",
      cpu_persen: 90,
    });
    expect(bodi.ringkasan.performa).not.toHaveProperty("ram_total_gb");
  });

  it("membuat body keamanan dari daftar aplikasi", () => {
    const bodi = buatBodiKeamanan([
      { nama: "Chat Cepat", izinBerbahaya: 5, sistem: false },
    ]);
    expect(bodi.skor).toBe(65);
    expect(bodi.ringkasan.keamanan).toMatchObject({
      status: "cukup",
      sumber: "manual",
    });
    expect(
      (bodi.ringkasan.keamanan.aplikasi as unknown[]).length,
    ).toBe(1);
  });
});

describe("uraiEntriDokter", () => {
  it("mengurai baris baterai dari API", () => {
    const entri = uraiEntriDokter("baterai", {
      id: "id-1",
      skor: 65,
      ringkasan: {
        baterai: {
          status: "cukup",
          skor: 65,
          sumber: "manual",
          persen: 45,
          status_baterai: "dipakai",
          hemat_daya: true,
        },
      },
      dibuat_pada: "2026-11-17T10:00:00.000Z",
    });
    expect(entri).toMatchObject({
      id: "id-1",
      jenis: "baterai",
      skor: 65,
      status: "cukup",
      sumber: "manual",
      dibuatPada: "2026-11-17T10:00:00.000Z",
    });
    if (entri && entri.jenis === "baterai") {
      expect(entri.detail).toEqual({
        persen: 45,
        statusBaterai: "dipakai",
        hematDaya: true,
      });
    }
  });

  it("mengurai ringkasan berbentuk string JSON", () => {
    const entri = uraiEntriDokter("penyimpanan", {
      id: "id-2",
      skor: 85,
      ringkasan: JSON.stringify({
        penyimpanan: {
          status: "baik",
          skor: 85,
          sumber: "apk",
          total_gb: 256,
          terpakai_gb: 100,
        },
      }),
      dibuat_pada: "2026-11-17T10:00:00.000Z",
    });
    expect(entri).toMatchObject({ jenis: "penyimpanan", sumber: "apk" });
    if (entri && entri.jenis === "penyimpanan") {
      expect(entri.detail).toEqual({ totalGb: 256, terpakaiGb: 100 });
    }
  });

  it("mengurai daftar aplikasi keamanan dan bentuk satu aplikasi", () => {
    const daftar = uraiEntriDokter("keamanan", {
      id: "id-3",
      skor: 65,
      ringkasan: {
        keamanan: {
          status: "cukup",
          skor: 65,
          sumber: "apk",
          aplikasi: [
            { nama: "Chat Cepat", izin_berbahaya: 5, sistem: false },
            { nama: "Rusak", izin_berbahaya: "banyak" },
            { nama: "", izin_berbahaya: 3 },
          ],
        },
      },
      dibuat_pada: "2026-11-17T10:00:00.000Z",
    });
    if (daftar && daftar.jenis === "keamanan") {
      expect(daftar.detail.aplikasi).toEqual([
        { nama: "Chat Cepat", izinBerbahaya: 5, sistem: false },
      ]);
    } else {
      throw new Error("Entri keamanan tidak terurai");
    }

    const tunggal = uraiEntriDokter("keamanan", {
      id: "id-4",
      skor: 85,
      ringkasan: {
        keamanan: {
          status: "baik",
          skor: 85,
          sumber: "manual",
          nama_aplikasi: "Galeri",
          izin_berbahaya: 1,
          sistem: true,
        },
      },
      dibuat_pada: "2026-11-17T10:00:00.000Z",
    });
    if (tunggal && tunggal.jenis === "keamanan") {
      expect(tunggal.detail.aplikasi).toEqual([
        { nama: "Galeri", izinBerbahaya: 1, sistem: true },
      ]);
    } else {
      throw new Error("Entri keamanan tunggal tidak terurai");
    }
  });

  it("mengembalikan null untuk baris tanpa komponen jenis yang diminta", () => {
    expect(
      uraiEntriDokter("baterai", {
        id: "id-5",
        skor: 80,
        ringkasan: { wifi: { status: "baik", skor: 80, sumber: "web" } },
        dibuat_pada: "2026-11-17T10:00:00.000Z",
      }),
    ).toBeNull();
    expect(uraiEntriDokter("baterai", null)).toBeNull();
    expect(uraiEntriDokter("baterai", "bukan-objek")).toBeNull();
    expect(
      uraiEntriDokter("baterai", {
        id: "id-6",
        skor: 80,
        ringkasan: { baterai: { status: "baik" } },
        dibuat_pada: "tanggal-rusak",
      }),
    ).toBeNull();
  });

  it("mentoleransi status dan sumber yang tidak dikenali", () => {
    const entri = uraiEntriDokter("performa", {
      id: "id-7",
      skor: 70,
      ringkasan: {
        performa: {
          status: "tidak-dikenal",
          sumber: "lain",
          kondisi: "lancar",
        },
      },
      dibuat_pada: "2026-11-17T10:00:00.000Z",
    });
    expect(entri).toMatchObject({ status: null, sumber: null });
    if (entri && entri.jenis === "performa") {
      expect(entri.detail.kondisi).toBe("lancar");
    }
  });
});

describe("pesanGalat*", () => {
  it("memetakan 401 ke pesan sesi berakhir", () => {
    const galat = new Error("Permintaan /api/health-checks gagal: 401");
    expect(pesanGalatMuat(galat)).toBe(
      "Sesi sudah berakhir. Masuk lagi untuk lanjut.",
    );
    expect(pesanGalatSimpan(galat)).toBe(
      "Sesi sudah berakhir. Masuk lagi untuk lanjut.",
    );
    expect(pesanGalatHapus(galat)).toBe(
      "Sesi sudah berakhir. Masuk lagi untuk lanjut.",
    );
  });

  it("memetakan 403 ke pesan kunci PIN dan 429 ke pesan terlalu sering", () => {
    expect(pesanGalatMuat(new Error("gagal: 403"))).toBe(
      "Aplikasi terkunci, masukkan PIN untuk membuka.",
    );
    expect(pesanGalatSimpan(new Error("gagal: 429"))).toBe(
      "Terlalu sering, coba lagi sebentar.",
    );
  });

  it("memetakan TypeError ke pesan koneksi dan sisanya ke pesan umum", () => {
    expect(pesanGalatMuat(new TypeError("Failed to fetch"))).toBe(
      "Tidak ada koneksi internet. Periksa sambungan, lalu coba lagi.",
    );
    expect(pesanGalatMuat(new Error("gagal: 500"))).toBe(
      "Data tidak bisa dimuat. Coba lagi.",
    );
    expect(pesanGalatSimpan(new Error("gagal: 500"))).toBe(
      "Data tidak bisa disimpan. Coba lagi.",
    );
    expect(pesanGalatHapus(new Error("gagal: 500"))).toBe(
      "Entri tidak bisa dihapus. Coba lagi.",
    );
  });
});
