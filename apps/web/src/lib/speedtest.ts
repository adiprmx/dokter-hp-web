// Tes kecepatan WiFi di browser: unduh file 1 MB, latensi HTTP,
// dan tes bertahan 30 detik. Semua angka berasal dari pengukuran
// nyata di browser; tidak ada angka contoh.
//
// Acuan:
// - PRODUCT.md 4.4 (tes unduh 1 MB, timeout 15 detik, klasifikasi)
// - docs/api-contracts.md 4 (klasifikasi), 8.2 (GET /ping),
//   8.3 (info file tes)
// - docs/copy.md 5 (teks klasifikasi dan tes bertahan)
// - docs/performance.md 3.6 (file tes no-store; cache-buster +
//   cache: "no-store" agar hasil ukur nyata, bukan dari cache)
//
// File tes disajikan sebagai aset statis dari origin yang sama
// (/speedtest-1mb.bin, 1.048.576 byte, K-27) — lihat
// apps/web/public/speedtest-1mb.bin. Service worker tidak pernah
// men-cache file ini (public/sw.js, SPEEDTEST_PATH).

// ------------------------------------------------------------------
// Konstanta
// ------------------------------------------------------------------

/** Path file tes di origin frontend (aset statis Pages/Vercel). */
export const FILE_TES_KECEPATAN = "/speedtest-1mb.bin";

/** Ukuran file tes dalam byte (1 MB = 1.048.576 byte). */
export const UKURAN_FILE_TES_BYTE = 1048576;

/** Batas waktu tes unduh (PRODUCT.md 4.4). */
export const TIMEOUT_TES_MS = 15000;

/** Durasi tes bertahan (PRODUCT.md 4.4). */
export const DURASI_TES_BERTAHAN_DETIK = 30;

/** Jumlah percobaan latensi HTTP; median yang dipakai. */
export const JUMLAH_SAMPEL_LATENSI = 3;

// ------------------------------------------------------------------
// Galat
// ------------------------------------------------------------------

export type KodeGalatTes = "timeout" | "jaringan" | "http";

/** Galat tes yang bisa dijelaskan ke pengguna dengan bahasa sehari-hari. */
export class GalatTes extends Error {
  readonly kode: KodeGalatTes;

  constructor(kode: KodeGalatTes, pesan: string) {
    super(pesan);
    this.name = "GalatTes";
    this.kode = kode;
  }
}

// ------------------------------------------------------------------
// Fungsi murni (tanpa jaringan — diuji di speedtest.test.ts)
// ------------------------------------------------------------------

export type IdKlasifikasi =
  | "sangat-lambat"
  | "lambat"
  | "cukup"
  | "cepat"
  | "sangat-cepat";

export interface KlasifikasiKecepatan {
  id: IdKlasifikasi;
  /** Label tampilan, misalnya "Sangat lambat". */
  label: string;
  /** Penjelasan dari docs/copy.md 5. */
  penjelasan: string;
}

const KLASIFIKASI: Record<IdKlasifikasi, KlasifikasiKecepatan> = {
  "sangat-lambat": {
    id: "sangat-lambat",
    label: "Sangat lambat",
    penjelasan:
      "Sangat lambat. Membuka halaman saja akan terasa berat. " +
      "Lihat panduan di bawah untuk mencari penyebabnya.",
  },
  lambat: {
    id: "lambat",
    label: "Lambat",
    penjelasan:
      "Lambat. Pesan dan halaman ringan masih bisa, tetapi video " +
      "dan unduhan akan tersendat.",
  },
  cukup: {
    id: "cukup",
    label: "Cukup",
    penjelasan:
      "Cukup untuk pemakaian sehari-hari, tetapi belum ideal " +
      "untuk video kualitas tinggi.",
  },
  cepat: {
    id: "cepat",
    label: "Cepat",
    penjelasan:
      "Cepat. Cukup untuk video, panggilan, dan unduhan sehari-hari.",
  },
  "sangat-cepat": {
    id: "sangat-cepat",
    label: "Sangat cepat",
    penjelasan:
      "Sangat cepat. Koneksi ini sudah lebih dari cukup untuk " +
      "pemakaian sehari-hari.",
  },
};

/**
 * Klasifikasi kecepatan unduh (KB/detik), sama dengan APK:
 * sangat lambat < 50, lambat < 200, cukup < 1000,
 * cepat < 5000, sangat cepat >= 5000.
 */
export function klasifikasiKecepatan(kbps: number): KlasifikasiKecepatan {
  const nilai = Number.isFinite(kbps) && kbps > 0 ? kbps : 0;
  if (nilai < 50) return KLASIFIKASI["sangat-lambat"];
  if (nilai < 200) return KLASIFIKASI.lambat;
  if (nilai < 1000) return KLASIFIKASI.cukup;
  if (nilai < 5000) return KLASIFIKASI.cepat;
  return KLASIFIKASI["sangat-cepat"];
}

/** Median dari sekumpulan angka; null bila kosong. */
export function median(nilai: number[]): number | null {
  if (nilai.length === 0) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  const tengah = Math.floor(urut.length / 2);
  if (urut.length % 2 === 1) return urut[tengah];
  return (urut[tengah - 1] + urut[tengah]) / 2;
}

/** Kecepatan KB/detik dari jumlah byte dan durasi milidetik. */
export function hitungKecepatanKbps(byte: number, durasiMs: number): number {
  if (!Number.isFinite(byte) || !Number.isFinite(durasiMs)) return 0;
  if (byte <= 0 || durasiMs <= 0) return 0;
  return byte / 1024 / (durasiMs / 1000);
}

/**
 * Format kecepatan untuk tampilan: KB/detik di bawah 1.000,
 * MB/detik di atasnya. Desimal memakai koma (Indonesia).
 */
export function formatKecepatan(kbps: number): string {
  const nilai = Number.isFinite(kbps) && kbps > 0 ? kbps : 0;
  if (nilai >= 1000) {
    return `${(nilai / 1000).toFixed(1).replace(".", ",")} MB/detik`;
  }
  const desimal = nilai >= 100 ? 0 : 1;
  return `${nilai.toFixed(desimal).replace(".", ",")} KB/detik`;
}

/** Format latensi milidetik untuk tampilan ("42 ms"). */
export function formatLatensi(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "tidak tersedia";
  return `${Math.round(ms)} ms`;
}

export type VerdictBertahan = "bertahan" | "jatuh" | "tidak-stabil";

export interface HasilTesBertahan {
  verdict: VerdictBertahan;
  rataRataKbps: number;
  terendahKbps: number;
  tertinggiKbps: number;
  /** Rata-rata 5 detik pertama (KB/detik). */
  awalKbps: number;
  /** Rata-rata 5 detik terakhir (KB/detik). */
  akhirKbps: number;
  jumlahSampel: number;
}

/**
 * Vonis tes bertahan dari sampel per detik (KB/detik, indeks =
 * detik ke-0 sampai ke-29). Logika sama dengan APK v1.0.1:
 * - "bertahan": rata-rata >= 1.000 KB/detik DAN tidak ada sampel
 *   di bawah 200 KB/detik setelah detik ke-3.
 * - "jatuh": rata-rata 5 detik terakhir kurang dari separuh
 *   rata-rata 5 detik pertama (dan 5 detik pertama >= 200).
 * - "tidak-stabil": selain kedua di atas.
 */
export function nilaiTesBertahan(sampel: number[]): HasilTesBertahan {
  const kosong: HasilTesBertahan = {
    verdict: "tidak-stabil",
    rataRataKbps: 0,
    terendahKbps: 0,
    tertinggiKbps: 0,
    awalKbps: 0,
    akhirKbps: 0,
    jumlahSampel: 0,
  };
  if (sampel.length === 0) return kosong;

  const bersih = sampel.map((v) =>
    Number.isFinite(v) && v > 0 ? v : 0,
  );
  const jumlah = bersih.reduce((a, b) => a + b, 0);
  const rataRata = jumlah / bersih.length;
  const terendah = Math.min(...bersih);
  const tertinggi = Math.max(...bersih);
  const limaAwal = bersih.slice(0, 5);
  const limaAkhir = bersih.slice(-5);
  const awalKbps =
    limaAwal.reduce((a, b) => a + b, 0) / limaAwal.length;
  const akhirKbps =
    limaAkhir.reduce((a, b) => a + b, 0) / limaAkhir.length;

  // Sampel "setelah detik ke-3" = detik ke-4 dan seterusnya.
  const setelahDetik3 = bersih.filter((_, i) => i > 3);
  const bertahan =
    rataRata >= 1000 && setelahDetik3.every((v) => v >= 200);
  const jatuh = awalKbps >= 200 && akhirKbps < awalKbps * 0.5;

  return {
    verdict: bertahan ? "bertahan" : jatuh ? "jatuh" : "tidak-stabil",
    rataRataKbps: rataRata,
    terendahKbps: terendah,
    tertinggiKbps: tertinggi,
    awalKbps,
    akhirKbps,
    jumlahSampel: bersih.length,
  };
}

/**
 * Label kekuatan sinyal dari nilai dBm (input manual pengguna):
 * -55 dBm ke atas = kuat, -70 sampai -55 = sedang,
 * di bawah -70 = lemah. Nilai dBm selalu negatif; semakin dekat
 * ke nol, semakin kuat sinyalnya.
 */
export function labelSinyalDariDbm(dbm: number): "lemah" | "sedang" | "kuat" {
  if (dbm >= -55) return "kuat";
  if (dbm >= -70) return "sedang";
  return "lemah";
}

// ------------------------------------------------------------------
// Info jaringan dari browser (Network Information API)
// ------------------------------------------------------------------

export interface InfoJaringan {
  /** Jenis koneksi yang bisa dibaca browser, atau null. */
  jenisKoneksi: string | null;
  /** Perkiraan kecepatan unduh browser (Mbps), atau null. */
  downlinkMbps: number | null;
  /** Mode hemat data aktif di browser. */
  hematData: boolean;
}

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  type?: string;
}

interface NavigatorDenganKoneksi extends Navigator {
  connection?: NetworkInformationLike;
}

function labelJenisKoneksi(info: NetworkInformationLike): string | null {
  const jenis = info.type;
  if (jenis === "wifi") return "WiFi";
  if (jenis === "cellular") return "Data seluler";
  if (jenis === "ethernet") return "Kabel";
  if (jenis === "bluetooth") return "Bluetooth";
  const efektif = info.effectiveType;
  if (efektif === "slow-2g") return "2G lambat";
  if (efektif === "2g") return "2G";
  if (efektif === "3g") return "3G";
  if (efektif === "4g") return "4G";
  return null;
}

/**
 * Membaca info koneksi lewat Network Information API bila tersedia.
 * API ini tidak ada di semua browser — hasilnya null dan kolom
 * tampil "tidak tersedia" bila tidak didukung.
 */
export function bacaInfoJaringan(): InfoJaringan {
  const kosong: InfoJaringan = {
    jenisKoneksi: null,
    downlinkMbps: null,
    hematData: false,
  };
  if (typeof navigator === "undefined") return kosong;
  const koneksi = (navigator as NavigatorDenganKoneksi).connection;
  if (!koneksi) return kosong;
  return {
    jenisKoneksi: labelJenisKoneksi(koneksi),
    downlinkMbps:
      typeof koneksi.downlink === "number" && koneksi.downlink > 0
        ? koneksi.downlink
        : null,
    hematData: koneksi.saveData === true,
  };
}

// ------------------------------------------------------------------
// Pengukuran (memakai jaringan)
// ------------------------------------------------------------------

export interface HasilUnduh {
  /** Kecepatan unduh (KB/detik). */
  kbps: number;
  /** Byte yang benar-benar diterima. */
  byte: number;
  /** Durasi unduh (milidetik). */
  durasiMs: number;
}

export interface OpsiUnduh {
  timeoutMs?: number;
  sinyal?: AbortSignal;
  /** Dipanggil tiap potongan data tiba (untuk pemantau live). */
  onKemajuan?: (byte: number, durasiMs: number) => void;
}

/**
 * Mengunduh file tes 1 MB dan mengukur kecepatannya. Cache-buster
 * + cache "no-store" agar yang diukur adalah koneksi, bukan cache.
 * Timeout 15 detik (PRODUCT.md 4.4).
 */
export async function ukurKecepatanUnduh(
  opsi: OpsiUnduh = {},
): Promise<HasilUnduh> {
  const timeoutMs = opsi.timeoutMs ?? TIMEOUT_TES_MS;
  const controller = new AbortController();
  const batalkan = () => controller.abort();
  opsi.sinyal?.addEventListener("abort", batalkan, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const mulai = performance.now();
  try {
    const res = await fetch(`${FILE_TES_KECEPATAN}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new GalatTes("http", `Server menjawab ${res.status}.`);
    }
    let byte = 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        byte += value.byteLength;
        opsi.onKemajuan?.(byte, performance.now() - mulai);
      }
    } else {
      // Browser tanpa ReadableStream: baca seluruh body sekaligus.
      const buf = await res.arrayBuffer();
      byte = buf.byteLength;
      opsi.onKemajuan?.(byte, performance.now() - mulai);
    }
    const durasiMs = performance.now() - mulai;
    return { kbps: hitungKecepatanKbps(byte, durasiMs), byte, durasiMs };
  } catch (err) {
    if (err instanceof GalatTes) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      // Dibatalkan pengguna — teruskan apa adanya agar halaman
      // bisa membedakan batal dengan gagal.
      if (opsi.sinyal?.aborted) throw err;
      throw new GalatTes(
        "timeout",
        "Tes kecepatan melewati batas 15 detik.",
      );
    }
    throw new GalatTes("jaringan", "Unduhan file tes gagal.");
  } finally {
    clearTimeout(timer);
    opsi.sinyal?.removeEventListener("abort", batalkan);
  }
}

export interface HasilLatensi {
  /** Median latensi (milidetik). */
  medianMs: number;
  /** Tiap percobaan latensi (milidetik). */
  sampelMs: number[];
  /** Alamat IP publik bila API mengembalikannya, atau null. */
  ip: string | null;
}

export interface OpsiLatensi {
  jumlah?: number;
  sinyal?: AbortSignal;
  /** Dipanggil tiap percobaan selesai (untuk pemantau live). */
  onSampel?: (ms: number) => void;
}

/** Mengambil alamat IP dari respons /api/ping bila ada. */
function cariIpDariTeks(teks: string): string | null {
  try {
    const json = JSON.parse(teks) as {
      data?: { ip?: unknown };
      ip?: unknown;
    };
    const kandidat = json?.data?.ip ?? json?.ip;
    return typeof kandidat === "string" && kandidat.length > 0
      ? kandidat
      : null;
  } catch {
    return null;
  }
}

/**
 * Mengukur latensi HTTP: round-trip GET /api/ping beberapa kali,
 * diambil mediannya. Dilabeli "latensi HTTP" karena browser tidak
 * bisa mengirim ping ICMP mentah (PRODUCT.md 8.4).
 */
export async function ukurLatensiHttp(
  opsi: OpsiLatensi = {},
): Promise<HasilLatensi> {
  const jumlah = opsi.jumlah ?? JUMLAH_SAMPEL_LATENSI;
  const sampel: number[] = [];
  let ip: string | null = null;
  for (let i = 0; i < jumlah; i++) {
    if (opsi.sinyal?.aborted) {
      throw new DOMException("Dibatalkan.", "AbortError");
    }
    const mulai = performance.now();
    const res = await fetch(`/api/ping?t=${Date.now()}`, {
      cache: "no-store",
      signal: opsi.sinyal,
    });
    const teks = await res.text();
    const ms = performance.now() - mulai;
    sampel.push(ms);
    opsi.onSampel?.(ms);
    if (ip === null) ip = cariIpDariTeks(teks);
  }
  return {
    medianMs: median(sampel) ?? 0,
    sampelMs: sampel,
    ip,
  };
}

export interface SampelBertahan {
  /** Detik ke-0 sampai ke-29. */
  detikKe: number;
  /** Kecepatan pada detik itu (KB/detik). */
  kbps: number;
}

export interface OpsiTesBertahan {
  durasiDetik?: number;
  sinyal?: AbortSignal;
}

function jeda(ms: number, sinyal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sinyal?.aborted) {
      reject(new DOMException("Dibatalkan.", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      sinyal?.removeEventListener("abort", batal);
      resolve();
    }, ms);
    const batal = () => {
      clearTimeout(timer);
      reject(new DOMException("Dibatalkan.", "AbortError"));
    };
    sinyal?.addEventListener("abort", batal, { once: true });
  });
}

/**
 * Satu sampel tes bertahan: mengunduh file tes selama maksimal
 * ~1 detik dan menghitung kecepatan dari byte yang sempat tiba.
 * Detik tanpa data sama sekali dicatat 0 KB/detik (jujur, bukan
 * dilewati) — kecuali pembatalan pengguna yang diteruskan.
 */
async function ukurSatuDetik(sinyal?: AbortSignal): Promise<number> {
  const controller = new AbortController();
  const batalkan = () => controller.abort();
  sinyal?.addEventListener("abort", batalkan, { once: true });
  const timer = setTimeout(() => controller.abort(), 1050);
  const mulai = performance.now();
  let byte = 0;
  try {
    const res = await fetch(`${FILE_TES_KECEPATAN}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        byte += value.byteLength;
      }
    } else {
      byte = (await res.arrayBuffer()).byteLength;
    }
    return hitungKecepatanKbps(byte, performance.now() - mulai);
  } catch (err) {
    if (sinyal?.aborted) {
      throw new DOMException("Dibatalkan.", "AbortError");
    }
    // Abort karena jendela 1 detik habis: hitung dari byte yang
    // sempat tiba (bila ada); bila tidak ada byte sama sekali,
    // detik itu memang 0 KB/detik.
    if (err instanceof DOMException && err.name === "AbortError") {
      return hitungKecepatanKbps(byte, performance.now() - mulai);
    }
    return 0;
  } finally {
    clearTimeout(timer);
    sinyal?.removeEventListener("abort", batalkan);
  }
}

/**
 * Tes bertahan 30 detik: satu sampel kecepatan tiap detik.
 * `onSampel` dipanggil tiap detik agar grafik live diperbarui.
 * Melempar GalatTes bila tidak ada satu pun data yang tiba.
 */
export async function jalankanTesBertahan(
  onSampel: (sampel: SampelBertahan) => void,
  opsi: OpsiTesBertahan = {},
): Promise<SampelBertahan[]> {
  const durasi = opsi.durasiDetik ?? DURASI_TES_BERTAHAN_DETIK;
  const hasil: SampelBertahan[] = [];
  for (let detik = 0; detik < durasi; detik++) {
    if (opsi.sinyal?.aborted) {
      throw new DOMException("Dibatalkan.", "AbortError");
    }
    const mulaiSampel = performance.now();
    const kbps = await ukurSatuDetik(opsi.sinyal);
    const sampel: SampelBertahan = { detikKe: detik, kbps };
    hasil.push(sampel);
    onSampel(sampel);
    // Jaga irama satu sampel per detik.
    if (detik < durasi - 1) {
      const sisa = 1000 - (performance.now() - mulaiSampel);
      if (sisa > 0) await jeda(sisa, opsi.sinyal);
    }
  }
  if (hasil.every((s) => s.kbps <= 0)) {
    throw new GalatTes(
      "jaringan",
      "Tidak ada data yang berhasil diunduh selama tes bertahan.",
    );
  }
  return hasil;
}
