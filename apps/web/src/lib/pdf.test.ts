import { describe, expect, it } from "vitest";
import {
  barisEntri,
  formatKecepatan,
  formatSumber,
  formatTanggal,
  formatTanggalWaktu,
  gabungRiwayat,
  hitungRingkasan,
  kategoriSkor,
  klasifikasiKecepatan,
  labelKomponen,
  labelSinyal,
  labelStatusKomponen,
  namaFilePdf,
  type AiDiagnosis,
  type EntriRiwayat,
  type HealthCheck,
  type WifiReport,
} from "./pdf";

// ISO dari komponen tanggal LOKAL, agar tes tidak bergantung pada zona
// waktu mesin yang menjalankan tes.
function isoLokal(
  tahun: number,
  bulan: number,
  tanggal: number,
  jam: number,
  menit: number,
): string {
  return new Date(tahun, bulan - 1, tanggal, jam, menit).toISOString();
}

const kesehatanContoh: HealthCheck = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  user_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  skor: 78,
  ringkasan: {
    wifi: { status: "baik", skor: 85, sumber: "web" },
    baterai: { status: "cukup", skor: 70, sumber: "manual" },
  },
  dibuat_pada: isoLokal(2026, 11, 17, 22, 15),
  updated_at: isoLokal(2026, 11, 17, 22, 15),
  deleted_at: null,
  sync_status: "synced",
};

const wifiContoh: WifiReport = {
  id: "9b2e3d4a-1c5f-4a6b-8d7e-0f1a2b3c4d5e",
  user_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  ssid: "ACHA",
  kecepatan_koneksi_mbps: 65,
  kekuatan_sinyal: "kuat",
  channel: 6,
  dns: "1.1.1.1",
  ping_ms: 42,
  rekomendasi: "Coba ganti channel router ke 1, 6, atau 11.",
  kecepatan_unduh_kbps: 3.2,
  sumber: "web",
  durasi_tes_detik: null,
  dibuat_pada: isoLokal(2026, 11, 17, 21, 30),
  updated_at: isoLokal(2026, 11, 17, 21, 30),
  deleted_at: null,
};

const aiContoh: AiDiagnosis = {
  id: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  user_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  health_check_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  pertanyaan: "WiFi lemot padahal sinyal penuh, kenapa?",
  jawaban: "Sinyal penuh belum tentu berarti cepat.",
  dibuat_pada: isoLokal(2026, 11, 17, 20, 0),
};

describe("formatTanggal dan formatTanggalWaktu", () => {
  it("memformat tanggal Indonesia", () => {
    expect(formatTanggal(isoLokal(2026, 11, 17, 22, 15))).toBe(
      "17 November 2026",
    );
    expect(formatTanggal(isoLokal(2026, 1, 5, 8, 3))).toBe("5 Januari 2026");
  });

  it("memformat tanggal dan jam dengan pemisah titik", () => {
    expect(formatTanggalWaktu(isoLokal(2026, 11, 17, 22, 15))).toBe(
      "17 November 2026, 22.15",
    );
    expect(formatTanggalWaktu(isoLokal(2026, 1, 5, 8, 3))).toBe(
      "5 Januari 2026, 08.03",
    );
  });

  it("menangani tanggal tidak valid", () => {
    expect(formatTanggal("bukan-tanggal")).toBe("tidak tersedia");
    expect(formatTanggalWaktu("")).toBe("tidak tersedia");
  });
});

describe("kategoriSkor", () => {
  it("mengategorikan skor sesuai ambang 80/50", () => {
    expect(kategoriSkor(100)).toBe("Baik");
    expect(kategoriSkor(80)).toBe("Baik");
    expect(kategoriSkor(79)).toBe("Perlu diperhatikan");
    expect(kategoriSkor(50)).toBe("Perlu diperhatikan");
    expect(kategoriSkor(49)).toBe("Bermasalah");
    expect(kategoriSkor(0)).toBe("Bermasalah");
  });
});

describe("klasifikasiKecepatan dan formatKecepatan", () => {
  it("mengklasifikasikan kecepatan sesuai ambang kontrak", () => {
    expect(klasifikasiKecepatan(0)).toBe("sangat lambat");
    expect(klasifikasiKecepatan(49.9)).toBe("sangat lambat");
    expect(klasifikasiKecepatan(50)).toBe("lambat");
    expect(klasifikasiKecepatan(199.9)).toBe("lambat");
    expect(klasifikasiKecepatan(200)).toBe("cukup");
    expect(klasifikasiKecepatan(999.9)).toBe("cukup");
    expect(klasifikasiKecepatan(1000)).toBe("cepat");
    expect(klasifikasiKecepatan(4999.9)).toBe("cepat");
    expect(klasifikasiKecepatan(5000)).toBe("sangat cepat");
  });

  it("memformat kecepatan dengan koma desimal Indonesia", () => {
    expect(formatKecepatan(3.2)).toBe("3,2 KB/detik");
    expect(formatKecepatan(999)).toBe("999 KB/detik");
    expect(formatKecepatan(1000)).toBe("1 MB/detik");
    expect(formatKecepatan(1500)).toBe("1,5 MB/detik");
    expect(formatKecepatan(2500)).toBe("2,5 MB/detik");
  });

  it("menangani kecepatan kosong atau tidak valid", () => {
    expect(formatKecepatan(null)).toBe("tidak tersedia");
    expect(formatKecepatan(undefined)).toBe("tidak tersedia");
    expect(formatKecepatan(Number.NaN)).toBe("tidak tersedia");
    expect(formatKecepatan(-5)).toBe("tidak tersedia");
  });
});

describe("label", () => {
  it("memformat sumber data", () => {
    expect(formatSumber("web")).toBe("Dari tes web");
    expect(formatSumber("manual")).toBe("Diisi manual");
    expect(formatSumber("apk")).toBe("Dari aplikasi Dokter HP");
    expect(formatSumber(null)).toBe("tidak tersedia");
    expect(formatSumber("lain")).toBe("tidak tersedia");
  });

  it("memberi label komponen, status, dan sinyal", () => {
    expect(labelKomponen("penyimpanan")).toBe("Penyimpanan");
    expect(labelStatusKomponen("perlu_perhatian")).toBe("Bermasalah");
    expect(labelSinyal("lemah")).toBe("Lemah");
    expect(labelSinyal("sedang")).toBe("Sedang");
    expect(labelSinyal("kuat")).toBe("Kuat");
    expect(labelSinyal(null)).toBe("tidak tersedia");
  });
});

describe("gabungRiwayat dan hitungRingkasan", () => {
  it("menggabungkan tiga daftar dan mengurutkan terbaru dulu", () => {
    const gabungan = gabungRiwayat(
      [kesehatanContoh],
      [wifiContoh],
      [aiContoh],
    );
    expect(gabungan.map((entri) => entri.jenis)).toEqual([
      "kesehatan",
      "wifi",
      "ai",
    ]);
    expect(gabungan[0].dibuatPada).toBe(kesehatanContoh.dibuat_pada);
  });

  it("menghitung jumlah per jenis", () => {
    const gabungan = gabungRiwayat(
      [kesehatanContoh, { ...kesehatanContoh, id: "lain" }],
      [wifiContoh],
      [],
    );
    expect(hitungRingkasan(gabungan)).toEqual({
      total: 3,
      kesehatan: 2,
      wifi: 1,
      ai: 0,
    });
    expect(hitungRingkasan([])).toEqual({
      total: 0,
      kesehatan: 0,
      wifi: 0,
      ai: 0,
    });
  });
});

describe("barisEntri", () => {
  it("memformat entri pemeriksaan kesehatan", () => {
    const entri: EntriRiwayat = {
      jenis: "kesehatan",
      id: kesehatanContoh.id,
      dibuatPada: kesehatanContoh.dibuat_pada,
      data: kesehatanContoh,
    };
    const baris = barisEntri(entri);
    expect(baris[0]).toBe(
      "Pemeriksaan kesehatan — 17 November 2026, 22.15",
    );
    expect(baris[1]).toBe("Skor 78 dari 100 — Perlu diperhatikan");
    expect(baris).toContain("WiFi: Baik (skor 85) — Dari tes web");
    expect(baris).toContain("Baterai: Perlu diperhatikan (skor 70) — Diisi manual");
  });

  it("memformat entri pemeriksaan tanpa ringkasan komponen", () => {
    const entri: EntriRiwayat = {
      jenis: "kesehatan",
      id: "tanpa-ringkasan",
      dibuatPada: isoLokal(2026, 11, 17, 10, 0),
      data: {
        ...kesehatanContoh,
        id: "tanpa-ringkasan",
        ringkasan: {},
        dibuat_pada: isoLokal(2026, 11, 17, 10, 0),
      },
    };
    expect(barisEntri(entri)).toEqual([
      "Pemeriksaan kesehatan — 17 November 2026, 10.00",
      "Skor 78 dari 100 — Perlu diperhatikan",
    ]);
  });

  it("memformat entri tes WiFi lengkap", () => {
    const entri: EntriRiwayat = {
      jenis: "wifi",
      id: wifiContoh.id,
      dibuatPada: wifiContoh.dibuat_pada,
      data: wifiContoh,
    };
    const baris = barisEntri(entri);
    expect(baris[0]).toBe("Tes WiFi — 17 November 2026, 21.30");
    expect(baris).toContain("Kecepatan unduh: 3,2 KB/detik (sangat lambat)");
    expect(baris).toContain("Latensi HTTP: 42 ms");
    expect(baris).toContain("Nama WiFi: ACHA");
    expect(baris).toContain("Kekuatan sinyal: Kuat");
    expect(baris).toContain("Channel: 6");
    expect(baris).toContain("DNS: 1.1.1.1");
    expect(baris).toContain("Sumber: Dari tes web");
    expect(baris).toContain(
      "Rekomendasi: Coba ganti channel router ke 1, 6, atau 11.",
    );
  });

  it("menandai tes bertahan 30 detik", () => {
    const entri: EntriRiwayat = {
      jenis: "wifi",
      id: wifiContoh.id,
      dibuatPada: wifiContoh.dibuat_pada,
      data: { ...wifiContoh, durasi_tes_detik: 30 },
    };
    expect(barisEntri(entri)[0]).toBe(
      "Tes WiFi (tes bertahan 30 detik) — 17 November 2026, 21.30",
    );
  });

  it("menangani tes WiFi tanpa kecepatan unduh", () => {
    const entri: EntriRiwayat = {
      jenis: "wifi",
      id: wifiContoh.id,
      dibuatPada: wifiContoh.dibuat_pada,
      data: { ...wifiContoh, kecepatan_unduh_kbps: null, ssid: null },
    };
    const baris = barisEntri(entri);
    expect(baris).toContain("Kecepatan unduh: tidak tersedia");
    expect(baris).toContain("Latensi HTTP: 42 ms");
    expect(baris.some((teks) => teks.startsWith("Nama WiFi:"))).toBe(false);
  });

  it("memformat entri diagnosis AI", () => {
    const entri: EntriRiwayat = {
      jenis: "ai",
      id: aiContoh.id,
      dibuatPada: aiContoh.dibuat_pada,
      data: aiContoh,
    };
    expect(barisEntri(entri)).toEqual([
      "Diagnosis AI — 17 November 2026, 20.00",
      "Pertanyaan: WiFi lemot padahal sinyal penuh, kenapa?",
      "Jawaban: Sinyal penuh belum tentu berarti cepat.",
    ]);
  });
});

describe("namaFilePdf", () => {
  it("membuat nama file dari tanggal lokal", () => {
    expect(namaFilePdf(new Date(2026, 10, 17))).toBe(
      "dokter-hp-riwayat-2026-11-17.pdf",
    );
    expect(namaFilePdf(new Date(2026, 0, 5))).toBe(
      "dokter-hp-riwayat-2026-01-05.pdf",
    );
  });
});
