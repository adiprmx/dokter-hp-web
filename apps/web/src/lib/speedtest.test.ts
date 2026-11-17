// Vitest untuk fungsi murni di speedtest.ts (klasifikasi,
// median, hitung kecepatan, format, vonis tes bertahan, label
// sinyal) + jalur timeout ukurKecepatanUnduh (T-41, fetch tiruan
// yang menggantung sampai sinyal abort — tanpa jaringan nyata).
//
// Ambang klasifikasi dari PRODUCT.md 4.4 / api-contracts.md 4:
//   sangat lambat < 50, lambat < 200, cukup < 1000,
//   cepat < 5000, sangat cepat >= 5000 (KB/detik).
// Vonis tes bertahan dari logika APK v1.0.1:
//   bertahan bila rata-rata >= 1000 KB/detik dan tidak ada sampel
//   < 200 setelah detik ke-3.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatKecepatan,
  formatLatensi,
  GalatTes,
  hitungKecepatanKbps,
  klasifikasiKecepatan,
  labelSinyalDariDbm,
  median,
  nilaiTesBertahan,
  TIMEOUT_TES_MS,
  ukurKecepatanUnduh,
} from "./speedtest";

describe("klasifikasiKecepatan (PRODUCT.md 4.4)", () => {
  it.each([
    [0, "sangat-lambat"],
    [3.2, "sangat-lambat"],
    [49.9, "sangat-lambat"],
    [50, "lambat"],
    [199.9, "lambat"],
    [200, "cukup"],
    [999.9, "cukup"],
    [1000, "cepat"],
    [4999.9, "cepat"],
    [5000, "sangat-cepat"],
    [12000, "sangat-cepat"],
  ])("%s KB/detik -> %s", (kbps, id) => {
    expect(klasifikasiKecepatan(kbps).id).toBe(id);
  });

  it("kasus awal produk: 3,2 KB/detik tergolong sangat lambat", () => {
    // Kasus WiFi ACHA di PRODUCT.md 1.1: unduhan jatuh ke 3,2 KB/detik.
    const hasil = klasifikasiKecepatan(3.2);
    expect(hasil.id).toBe("sangat-lambat");
    expect(hasil.label).toBe("Sangat lambat");
    expect(hasil.penjelasan).toContain("Sangat lambat");
  });

  it("label dan penjelasan terisi untuk semua tingkat", () => {
    for (const kbps of [10, 100, 500, 2000, 8000]) {
      const hasil = klasifikasiKecepatan(kbps);
      expect(hasil.label.length).toBeGreaterThan(0);
      expect(hasil.penjelasan.length).toBeGreaterThan(0);
    }
  });

  it("nilai tidak valid diperlakukan sebagai 0 (sangat lambat)", () => {
    expect(klasifikasiKecepatan(NaN).id).toBe("sangat-lambat");
    expect(klasifikasiKecepatan(-5).id).toBe("sangat-lambat");
    expect(klasifikasiKecepatan(Infinity).id).toBe("sangat-lambat");
  });
});

describe("median", () => {
  it("median jumlah ganjil", () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it("median jumlah genap", () => {
    expect(median([10, 30, 20, 40])).toBe(25);
  });

  it("satu nilai", () => {
    expect(median([42])).toBe(42);
  });

  it("kosong -> null", () => {
    expect(median([])).toBeNull();
  });

  it("tidak mengubah array asal", () => {
    const asal = [30, 10, 20];
    median(asal);
    expect(asal).toEqual([30, 10, 20]);
  });
});

describe("hitungKecepatanKbps", () => {
  it("1 MB dalam 1 detik = 1024 KB/detik", () => {
    expect(hitungKecepatanKbps(1048576, 1000)).toBe(1024);
  });

  it("1 MB dalam 2 detik = 512 KB/detik", () => {
    expect(hitungKecepatanKbps(1048576, 2000)).toBe(512);
  });

  it("nol byte atau nol durasi -> 0", () => {
    expect(hitungKecepatanKbps(0, 1000)).toBe(0);
    expect(hitungKecepatanKbps(1024, 0)).toBe(0);
    expect(hitungKecepatanKbps(1024, -100)).toBe(0);
  });
});

describe("formatKecepatan", () => {
  it("di bawah 1000 memakai KB/detik", () => {
    expect(formatKecepatan(3.2)).toBe("3,2 KB/detik");
    expect(formatKecepatan(250)).toBe("250 KB/detik");
    expect(formatKecepatan(999.9)).toBe("1000 KB/detik");
  });

  it("1000 ke atas memakai MB/detik", () => {
    expect(formatKecepatan(1000)).toBe("1,0 MB/detik");
    expect(formatKecepatan(2400)).toBe("2,4 MB/detik");
    expect(formatKecepatan(12500)).toBe("12,5 MB/detik");
  });

  it("nilai tidak valid -> 0 KB/detik", () => {
    expect(formatKecepatan(NaN)).toBe("0,0 KB/detik");
    expect(formatKecepatan(-10)).toBe("0,0 KB/detik");
  });
});

describe("formatLatensi", () => {
  it("dibulatkan ke ms utuh", () => {
    expect(formatLatensi(42.4)).toBe("42 ms");
    expect(formatLatensi(42.6)).toBe("43 ms");
  });

  it("nilai tidak valid -> tidak tersedia", () => {
    expect(formatLatensi(NaN)).toBe("tidak tersedia");
    expect(formatLatensi(-1)).toBe("tidak tersedia");
  });
});

describe("nilaiTesBertahan (logika APK v1.0.1)", () => {
  it("bertahan: rata-rata >= 1000 dan tidak ada sampel < 200 setelah detik ke-3", () => {
    const sampel = Array.from({ length: 30 }, () => 1500);
    const hasil = nilaiTesBertahan(sampel);
    expect(hasil.verdict).toBe("bertahan");
    expect(hasil.rataRataKbps).toBe(1500);
    expect(hasil.jumlahSampel).toBe(30);
  });

  it("bertahan walau detik awal (0-3) sempat di bawah 200", () => {
    // Aturan hanya memeriksa sampel setelah detik ke-3.
    const sampel = [50, 80, 120, 150, ...Array.from({ length: 26 }, () => 1500)];
    const hasil = nilaiTesBertahan(sampel);
    expect(hasil.verdict).toBe("bertahan");
  });

  it("tidak stabil: satu sampel < 200 setelah detik ke-3", () => {
    const sampel = Array.from({ length: 30 }, () => 1500);
    sampel[10] = 150;
    const hasil = nilaiTesBertahan(sampel);
    expect(hasil.verdict).toBe("tidak-stabil");
  });

  it("tidak stabil: rata-rata di bawah 1000 walau tidak ada sampel rendah", () => {
    const sampel = Array.from({ length: 30 }, () => 800);
    const hasil = nilaiTesBertahan(sampel);
    expect(hasil.verdict).toBe("tidak-stabil");
    expect(hasil.rataRataKbps).toBe(800);
  });

  it("jatuh: 5 detik terakhir kurang dari separuh 5 detik pertama", () => {
    // Rata-rata 800 (< 1000) sehingga tidak lolos "bertahan".
    const sampel = [
      ...Array.from({ length: 15 }, () => 1500),
      ...Array.from({ length: 15 }, () => 100),
    ];
    const hasil = nilaiTesBertahan(sampel);
    expect(hasil.verdict).toBe("jatuh");
    expect(hasil.awalKbps).toBe(1500);
    expect(hasil.akhirKbps).toBe(100);
  });

  it("jatuh mengalahkan tidak stabil, tetapi bukan bertahan", () => {
    // Pola jatuh yang rata-ratanya masih >= 1000 dan tidak ada
    // sampel < 200 setelah detik ke-3 tetap "bertahan".
    const sampel = [
      ...Array.from({ length: 15 }, () => 5000),
      ...Array.from({ length: 15 }, () => 2000),
    ];
    const hasil = nilaiTesBertahan(sampel);
    expect(hasil.verdict).toBe("bertahan");
  });

  it("kasus WiFi ACHA: kecepatan jatuh ke KB/detik lalu diam di sana", () => {
    const sampel = [
      1200, 1100, 900, 500, 200, 50, 20, 10, 5, 3.2,
      3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2,
      3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2,
    ];
    const hasil = nilaiTesBertahan(sampel);
    expect(hasil.verdict).toBe("jatuh");
    expect(hasil.terendahKbps).toBe(3.2);
  });

  it("sampel kosong -> tidak-stabil dengan angka nol", () => {
    const hasil = nilaiTesBertahan([]);
    expect(hasil.verdict).toBe("tidak-stabil");
    expect(hasil.rataRataKbps).toBe(0);
    expect(hasil.jumlahSampel).toBe(0);
  });

  it("menghitung terendah dan tertinggi dengan benar", () => {
    const hasil = nilaiTesBertahan([500, 1500, 250, 3000, 1000]);
    expect(hasil.terendahKbps).toBe(250);
    expect(hasil.tertinggiKbps).toBe(3000);
  });
});

describe("labelSinyalDariDbm", () => {
  it.each([
    [-30, "kuat"],
    [-55, "kuat"],
    [-56, "sedang"],
    [-70, "sedang"],
    [-71, "lemah"],
    [-90, "lemah"],
  ])("%s dBm -> %s", (dbm, label) => {
    expect(labelSinyalDariDbm(dbm)).toBe(label);
  });
});

describe("ukurKecepatanUnduh — jalur timeout (T-41)", () => {
  // Fetch tiruan yang berperilaku seperti fetch asli terhadap sinyal
  // abort: menggantung selamanya, lalu menolak dengan AbortError saat
  // sinyal dibatalkan (inilah yang dilakukan browser saat
  // AbortController.abort() dipanggil oleh timer timeout).
  function pasangFetchMenggantung(): void {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise<never>((_resolve, reject) => {
          const sinyal = init?.signal;
          if (sinyal?.aborted) {
            reject(new DOMException("Dibatalkan.", "AbortError"));
            return;
          }
          sinyal?.addEventListener(
            "abort",
            () => reject(new DOMException("Dibatalkan.", "AbortError")),
            { once: true },
          );
        });
      }),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("timeout kustom singkat: fetch menggantung -> GalatTes kode timeout", async () => {
    pasangFetchMenggantung();
    const janji = ukurKecepatanUnduh({ timeoutMs: 50 });
    await expect(janji).rejects.toBeInstanceOf(GalatTes);
    await expect(janji).rejects.toMatchObject({ kode: "timeout" });
  });

  it("batas baku adalah TIMEOUT_TES_MS = 15000 (PRODUCT.md 4.4)", async () => {
    expect(TIMEOUT_TES_MS).toBe(15000);
    pasangFetchMenggantung();
    vi.useFakeTimers();
    let selesai = false;
    const janji = ukurKecepatanUnduh();
    void janji.then(
      () => {
        selesai = true;
      },
      () => {
        selesai = true;
      },
    );
    // 1 ms sebelum batas: janji masih menggantung, belum dibatalkan.
    await vi.advanceTimersByTimeAsync(TIMEOUT_TES_MS - 1);
    expect(selesai).toBe(false);
    // Tepat di batas 15 detik: timer membatalkan, janji menolak timeout.
    await vi.advanceTimersByTimeAsync(1);
    await expect(janji).rejects.toMatchObject({ kode: "timeout" });
    expect(selesai).toBe(true);
  });

  it("pembatalan pengguna diteruskan sebagai AbortError, bukan timeout", async () => {
    pasangFetchMenggantung();
    const pengendali = new AbortController();
    const janji = ukurKecepatanUnduh({
      timeoutMs: 10_000,
      sinyal: pengendali.signal,
    });
    pengendali.abort();
    await expect(janji).rejects.toBeInstanceOf(DOMException);
    await expect(janji).rejects.toMatchObject({ name: "AbortError" });
  });
});
