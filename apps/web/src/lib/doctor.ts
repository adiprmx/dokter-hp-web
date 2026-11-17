// Logika domain Dokter HP: Baterai, Penyimpanan, Performa, Keamanan.
//
// File ini berisi fungsi murni (perhitungan, klasifikasi, validasi,
// penguraian data API) ditambah pemanggil API /health-checks yang tipis.
// Semua pesan memakai Bahasa Indonesia netral.
//
// BATASAN JUJUR WEB: browser tidak bisa membaca sensor HP (level
// baterai, isi penyimpanan, RAM, CPU, suhu, daftar aplikasi). Data di
// keempat layar ini adalah RIWAYAT — entri yang dicatat manual oleh
// pengguna atau berasal dari APK Dokter HP — bukan pengukuran langsung.
// Tidak ada satu pun fungsi di file ini yang mengklaim membaca sensor.

import { fetchJson } from "./api";

// ------------------------------------------------------------------
// Jenis dan bentuk data
// ------------------------------------------------------------------

export type DoctorKind = "baterai" | "penyimpanan" | "performa" | "keamanan";

export type DoctorStatus = "baik" | "cukup" | "perlu_perhatian";

export type DoctorSumber = "web" | "apk" | "manual";

export type StatusBaterai = "mengisi" | "dipakai" | "penuh";

export type KondisiPerforma = "lancar" | "kadang_lambat" | "sering_lambat";

export interface BateraiDetail {
  /** Level baterai dalam persen (0-100). */
  persen?: number;
  statusBaterai?: StatusBaterai;
  hematDaya?: boolean;
}

export interface PenyimpananDetail {
  totalGb?: number;
  terpakaiGb?: number;
}

export interface PerformaDetail {
  kondisi?: KondisiPerforma;
  catatan?: string;
  ramTotalGb?: number;
  ramKosongGb?: number;
  cpuPersen?: number;
  suhuC?: number;
  perangkat?: string;
  android?: string;
  prosesor?: string;
}

export interface AplikasiKeamanan {
  nama: string;
  izinBerbahaya: number;
  sistem: boolean;
}

export interface KeamananDetail {
  aplikasi: AplikasiKeamanan[];
}

interface EntriDasar {
  id: string;
  /** Skor keseluruhan baris health check (0-100), bila ada. */
  skor: number | null;
  status: DoctorStatus | null;
  /** null bila server tidak mengirim sumber yang dikenali. */
  sumber: DoctorSumber | null;
  /** Waktu dibuat (ISO 8601 dari server). */
  dibuatPada: string;
}

export interface EntriBaterai extends EntriDasar {
  jenis: "baterai";
  detail: BateraiDetail;
}

export interface EntriPenyimpanan extends EntriDasar {
  jenis: "penyimpanan";
  detail: PenyimpananDetail;
}

export interface EntriPerforma extends EntriDasar {
  jenis: "performa";
  detail: PerformaDetail;
}

export interface EntriKeamanan extends EntriDasar {
  jenis: "keamanan";
  detail: KeamananDetail;
}

export type DoctorEntry =
  | EntriBaterai
  | EntriPenyimpanan
  | EntriPerforma
  | EntriKeamanan;

/** Aplikasi hasil gabungan seluruh entri keamanan, beserta asal datanya. */
export interface AplikasiDenganAsal extends AplikasiKeamanan {
  sumber: DoctorSumber | null;
  dibuatPada: string;
}

/** Body POST /health-checks untuk satu entri dokter. */
export interface BodiEntriDokter {
  skor: number;
  ringkasan: Record<string, Record<string, unknown>>;
}

const STATUS_VALID: readonly string[] = ["baik", "cukup", "perlu_perhatian"];
const SUMBER_VALID: readonly string[] = ["web", "apk", "manual"];
const STATUS_BATERAI_VALID: readonly string[] = ["mengisi", "dipakai", "penuh"];
const KONDISI_PERFORMA_VALID: readonly string[] = [
  "lancar",
  "kadang_lambat",
  "sering_lambat",
];

/** Batas izin berbahaya agar aplikasi masuk "Perlu ditinjau" (PRODUCT.md 4.5). */
export const BATAS_IZIN_PERLU_TINJAU = 4;

/** Batas persen pemakaian penyimpanan untuk peringatan "hampir penuh". */
export const BATAS_PENYIMPANAN_HAMPIR_PENUH = 90;

/** Asumsi pemakaian baterai rata-rata untuk perkiraan waktu pakai (PRODUCT.md 4.5). */
export const ASUMSI_PEMAKAIAN_BATERAI_PER_JAM = 10;

// ------------------------------------------------------------------
// Penguraian angka dari formulir
// ------------------------------------------------------------------

/**
 * Mengubah teks input menjadi angka. Koma desimal Indonesia ("12,5")
 * diterima dan diubah ke titik. Mengembalikan null untuk teks kosong
 * atau bukan angka.
 */
export function parseAngka(nilai: string): number | null {
  const bersih = nilai.trim().replace(",", ".");
  if (bersih === "") return null;
  const angka = Number(bersih);
  return Number.isFinite(angka) ? angka : null;
}

// ------------------------------------------------------------------
// Penyimpanan
// ------------------------------------------------------------------

/** Persen penyimpanan yang terpakai (0-100, satu desimal), null bila tidak valid. */
export function hitungPersenPenyimpanan(
  totalGb: number,
  terpakaiGb: number,
): number | null {
  if (
    !Number.isFinite(totalGb) ||
    !Number.isFinite(terpakaiGb) ||
    totalGb <= 0 ||
    terpakaiGb < 0 ||
    terpakaiGb > totalGb
  ) {
    return null;
  }
  return Math.round((terpakaiGb / totalGb) * 1000) / 10;
}

/** Ruang kosong dalam GB (satu desimal), null bila angka tidak valid. */
export function hitungRuangKosongGb(
  totalGb: number,
  terpakaiGb: number,
): number | null {
  if (
    !Number.isFinite(totalGb) ||
    !Number.isFinite(terpakaiGb) ||
    totalGb <= 0 ||
    terpakaiGb < 0 ||
    terpakaiGb > totalGb
  ) {
    return null;
  }
  return Math.round((totalGb - terpakaiGb) * 10) / 10;
}

/**
 * Klasifikasi pemakaian penyimpanan dari persen terpakai:
 * di bawah 70% baik, 70-90% cukup, di atas 90% perlu perhatian.
 */
export function klasifikasiPenyimpanan(persen: number): DoctorStatus {
  if (persen > BATAS_PENYIMPANAN_HAMPIR_PENUH) return "perlu_perhatian";
  if (persen >= 70) return "cukup";
  return "baik";
}

/** true bila penyimpanan hampir penuh (di atas 90% terpakai). */
export function penyimpananHampirPenuh(persen: number): boolean {
  return persen > BATAS_PENYIMPANAN_HAMPIR_PENUH;
}

// ------------------------------------------------------------------
// Baterai
// ------------------------------------------------------------------

/**
 * Klasifikasi dari level baterai: 50% ke atas baik, 20-49% cukup,
 * di bawah 20% perlu perhatian. Status mengisi/penuh tidak mengubah
 * klasifikasi — yang dinilai adalah levelnya.
 */
export function klasifikasiBaterai(persen: number): DoctorStatus {
  if (persen >= 50) return "baik";
  if (persen >= 20) return "cukup";
  return "perlu_perhatian";
}

/**
 * Perkiraan waktu pakai dalam jam (satu desimal), dari asumsi
 * pemakaian rata-rata 10% per jam. Ini PERKIRAAN, bukan pengukuran.
 * Mengembalikan null bila persen di luar 0-100.
 */
export function perkiraanJamPakai(persen: number): number | null {
  if (!Number.isFinite(persen) || persen < 0 || persen > 100) return null;
  return Math.round((persen / ASUMSI_PEMAKAIAN_BATERAI_PER_JAM) * 10) / 10;
}

/**
 * Teks perkiraan waktu pakai, misalnya "±4,5 jam" atau "±30 menit"
 * bila kurang dari satu jam. Selalu memakai tanda ± dan kata
 * "perkiraan" ditambahkan oleh pemanggil (lihat copy.md 6).
 */
export function formatPerkiraanJam(jam: number): string {
  if (jam < 1) {
    const menit = Math.max(1, Math.round(jam * 60));
    return `±${menit} menit`;
  }
  const teks = jam.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return `±${teks} jam`;
}

// ------------------------------------------------------------------
// Performa
// ------------------------------------------------------------------

export function klasifikasiPerforma(kondisi: KondisiPerforma): DoctorStatus {
  if (kondisi === "lancar") return "baik";
  if (kondisi === "kadang_lambat") return "cukup";
  return "perlu_perhatian";
}

export function labelKondisiPerforma(kondisi: KondisiPerforma): string {
  if (kondisi === "lancar") return "Lancar";
  if (kondisi === "kadang_lambat") return "Kadang lambat";
  return "Sering lambat";
}

// ------------------------------------------------------------------
// Keamanan
// ------------------------------------------------------------------

/**
 * Aplikasi yang masuk "Perlu ditinjau": bukan aplikasi sistem dan
 * meminta 4 izin berbahaya atau lebih (PRODUCT.md 4.5). Generik agar
 * field tambahan (misalnya asal data) tetap terbawa di hasil.
 */
export function aplikasiPerluDitinjau<T extends AplikasiKeamanan>(
  daftar: T[],
): T[] {
  return daftar.filter(
    (aplikasi) =>
      !aplikasi.sistem && aplikasi.izinBerbahaya >= BATAS_IZIN_PERLU_TINJAU,
  );
}

/**
 * Klasifikasi keamanan dari jumlah aplikasi yang perlu ditinjau:
 * 0 baik, 1-2 cukup, 3 atau lebih perlu perhatian.
 */
export function klasifikasiKeamanan(jumlahPerluTinjau: number): DoctorStatus {
  if (jumlahPerluTinjau <= 0) return "baik";
  if (jumlahPerluTinjau <= 2) return "cukup";
  return "perlu_perhatian";
}

/**
 * Menggabungkan aplikasi dari seluruh entri keamanan. Bila satu nama
 * aplikasi muncul di beberapa entri, entri terbaru yang dipakai
 * (daftar entri sudah terurut terbaru dulu). Nama dibandingkan tanpa
 * membedakan huruf besar/kecil dan spasi di ujung.
 */
export function gabungAplikasiKeamanan(
  entri: EntriKeamanan[],
): AplikasiDenganAsal[] {
  const sudahAda = new Map<string, AplikasiDenganAsal>();
  for (const item of entri) {
    for (const aplikasi of item.detail.aplikasi) {
      const kunci = aplikasi.nama.trim().toLowerCase();
      if (kunci === "" || sudahAda.has(kunci)) continue;
      sudahAda.set(kunci, {
        ...aplikasi,
        sumber: item.sumber,
        dibuatPada: item.dibuatPada,
      });
    }
  }
  return [...sudahAda.values()];
}

// ------------------------------------------------------------------
// Skor dan label
// ------------------------------------------------------------------

/** Skor komponen (0-100) dari status — dipakai sebagai skor entri. */
export function skorKomponen(status: DoctorStatus): number {
  if (status === "baik") return 85;
  if (status === "cukup") return 65;
  return 40;
}

export function labelStatus(status: DoctorStatus): string {
  if (status === "baik") return "Baik";
  if (status === "cukup") return "Cukup";
  return "Perlu perhatian";
}

export function labelSumber(sumber: DoctorSumber | null): string {
  if (sumber === "manual") return "Diisi manual";
  if (sumber === "apk") return "Dari aplikasi Dokter HP";
  if (sumber === "web") return "Dari tes web";
  return "tidak tersedia";
}

export function labelStatusBaterai(status: StatusBaterai): string {
  if (status === "mengisi") return "Mengisi daya";
  if (status === "penuh") return "Penuh";
  return "Dipakai";
}

/** "17 November 2026, 22.15" — atau "tidak tersedia" bila tanggal rusak. */
export function formatTanggalWaktu(iso: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "tidak tersedia";
  const tanggalTeks = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(tanggal);
  const jamTeks = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(tanggal);
  return `${tanggalTeks}, ${jamTeks}`;
}

// ------------------------------------------------------------------
// Validasi formulir
//
// Setiap validator menerima nilai mentah formulir (teks) dan
// mengembalikan peta nama field -> pesan galat. Peta kosong berarti
// valid. Kunci peta sama dengan nama field di DoctorEntryForm agar
// pesan tampil di bawah input yang salah.
// ------------------------------------------------------------------

export interface NilaiFormBaterai {
  persen: string;
  statusBaterai: string;
}

export function validasiBaterai(
  nilai: NilaiFormBaterai,
): Record<string, string> {
  const galat: Record<string, string> = {};
  const persen = parseAngka(nilai.persen);
  if (
    persen === null ||
    !Number.isInteger(persen) ||
    persen < 0 ||
    persen > 100
  ) {
    galat.persen = "Isi level baterai dengan angka 0 sampai 100.";
  }
  if (!STATUS_BATERAI_VALID.includes(nilai.statusBaterai)) {
    galat.status_baterai = "Pilih status baterai.";
  }
  return galat;
}

export interface NilaiFormPenyimpanan {
  totalGb: string;
  terpakaiGb: string;
}

export function validasiPenyimpanan(
  nilai: NilaiFormPenyimpanan,
): Record<string, string> {
  const galat: Record<string, string> = {};
  const total = parseAngka(nilai.totalGb);
  const terpakai = parseAngka(nilai.terpakaiGb);
  if (total === null || total <= 0 || total > 100000) {
    galat.total_gb = "Isi total penyimpanan dengan angka lebih dari 0.";
  }
  if (terpakai === null || terpakai < 0 || terpakai > 100000) {
    galat.terpakai_gb = "Isi yang terpakai dengan angka 0 atau lebih.";
  } else if (total !== null && total > 0 && terpakai > total) {
    galat.terpakai_gb =
      "Yang terpakai tidak boleh lebih besar dari total penyimpanan.";
  }
  return galat;
}

export interface NilaiFormPerforma {
  kondisi: string;
  catatan: string;
  ramTotalGb: string;
  ramKosongGb: string;
  cpuPersen: string;
  suhuC: string;
  perangkat: string;
  android: string;
  prosesor: string;
}

export function validasiPerforma(
  nilai: NilaiFormPerforma,
): Record<string, string> {
  const galat: Record<string, string> = {};
  if (!KONDISI_PERFORMA_VALID.includes(nilai.kondisi)) {
    galat.kondisi = "Pilih kondisi performa HP.";
  }
  if (nilai.catatan.trim().length > 500) {
    galat.catatan = "Catatan terlalu panjang, maksimal 500 huruf.";
  }
  const ramTotal = parseAngka(nilai.ramTotalGb);
  if (nilai.ramTotalGb.trim() !== "" && (ramTotal === null || ramTotal <= 0)) {
    galat.ram_total_gb = "Isi RAM total dengan angka lebih dari 0.";
  }
  const ramKosong = parseAngka(nilai.ramKosongGb);
  if (
    nilai.ramKosongGb.trim() !== "" &&
    (ramKosong === null || ramKosong < 0)
  ) {
    galat.ram_kosong_gb = "Isi RAM yang masih kosong dengan angka 0 atau lebih.";
  } else if (
    ramTotal !== null &&
    ramTotal > 0 &&
    ramKosong !== null &&
    ramKosong > ramTotal
  ) {
    galat.ram_kosong_gb = "RAM yang masih kosong tidak boleh lebih besar dari RAM total.";
  }
  const cpu = parseAngka(nilai.cpuPersen);
  if (nilai.cpuPersen.trim() !== "" && (cpu === null || cpu < 0 || cpu > 100)) {
    galat.cpu_persen = "Isi beban prosesor dengan angka 0 sampai 100.";
  }
  const suhu = parseAngka(nilai.suhuC);
  if (nilai.suhuC.trim() !== "" && (suhu === null || suhu < -20 || suhu > 120)) {
    galat.suhu_c = "Isi suhu dengan angka antara -20 sampai 120.";
  }
  for (const [kunci, label] of [
    ["perangkat", "Perangkat"],
    ["android", "Versi Android"],
    ["prosesor", "Prosesor"],
  ] as const) {
    if (nilai[kunci].trim().length > 100) {
      galat[kunci] = `${label} terlalu panjang, maksimal 100 huruf.`;
    }
  }
  return galat;
}

export interface NilaiFormKeamanan {
  namaAplikasi: string;
  izinBerbahaya: string;
}

export function validasiKeamanan(
  nilai: NilaiFormKeamanan,
): Record<string, string> {
  const galat: Record<string, string> = {};
  const nama = nilai.namaAplikasi.trim();
  if (nama === "") {
    galat.nama_aplikasi = "Isi nama aplikasi.";
  } else if (nama.length > 100) {
    galat.nama_aplikasi = "Nama aplikasi terlalu panjang, maksimal 100 huruf.";
  }
  const izin = parseAngka(nilai.izinBerbahaya);
  if (izin === null || !Number.isInteger(izin) || izin < 0 || izin > 100) {
    galat.izin_berbahaya = "Isi jumlah izin berbahaya dengan angka 0 sampai 100.";
  }
  return galat;
}

// ------------------------------------------------------------------
// Pembuatan body entri (untuk POST /health-checks)
//
// Satu entri dokter = satu baris health check dengan satu komponen di
// ringkasan. Detail mentah (persen, GB, nama aplikasi) disimpan di
// dalam objek komponen, di samping status/skor/sumber yang diwajibkan
// kontrak — validasi ringkasan server menerima objek JSON apa pun
// (api-contracts.md 3.1; validateRingkasan di scaffold API hanya
// memeriksa bentuk objek dan batas ukuran).
// ------------------------------------------------------------------

export function buatBodiBaterai(
  persen: number,
  statusBaterai: StatusBaterai,
  hematDaya: boolean,
): BodiEntriDokter {
  const status = klasifikasiBaterai(persen);
  const skor = skorKomponen(status);
  return {
    skor,
    ringkasan: {
      baterai: {
        status,
        skor,
        sumber: "manual",
        persen,
        status_baterai: statusBaterai,
        hemat_daya: hematDaya,
      },
    },
  };
}

export function buatBodiPenyimpanan(
  totalGb: number,
  terpakaiGb: number,
): BodiEntriDokter {
  const persen = hitungPersenPenyimpanan(totalGb, terpakaiGb) ?? 0;
  const status = klasifikasiPenyimpanan(persen);
  const skor = skorKomponen(status);
  return {
    skor,
    ringkasan: {
      penyimpanan: {
        status,
        skor,
        sumber: "manual",
        total_gb: totalGb,
        terpakai_gb: terpakaiGb,
      },
    },
  };
}

export function buatBodiPerforma(detail: PerformaDetail): BodiEntriDokter {
  const kondisi = detail.kondisi ?? "kadang_lambat";
  const status = klasifikasiPerforma(kondisi);
  const skor = skorKomponen(status);
  const komponen: Record<string, unknown> = {
    status,
    skor,
    sumber: "manual",
    kondisi,
  };
  if (detail.catatan !== undefined && detail.catatan !== "") {
    komponen.catatan = detail.catatan;
  }
  if (detail.ramTotalGb !== undefined) komponen.ram_total_gb = detail.ramTotalGb;
  if (detail.ramKosongGb !== undefined) {
    komponen.ram_kosong_gb = detail.ramKosongGb;
  }
  if (detail.cpuPersen !== undefined) komponen.cpu_persen = detail.cpuPersen;
  if (detail.suhuC !== undefined) komponen.suhu_c = detail.suhuC;
  if (detail.perangkat !== undefined) komponen.perangkat = detail.perangkat;
  if (detail.android !== undefined) komponen.android = detail.android;
  if (detail.prosesor !== undefined) komponen.prosesor = detail.prosesor;
  return { skor, ringkasan: { performa: komponen } };
}

export function buatBodiKeamanan(
  aplikasi: AplikasiKeamanan[],
): BodiEntriDokter {
  const status = klasifikasiKeamanan(aplikasiPerluDitinjau(aplikasi).length);
  const skor = skorKomponen(status);
  return {
    skor,
    ringkasan: {
      keamanan: {
        status,
        skor,
        sumber: "manual",
        aplikasi: aplikasi.map((item) => ({
          nama: item.nama,
          izin_berbahaya: item.izinBerbahaya,
          sistem: item.sistem,
        })),
      },
    },
  };
}

// ------------------------------------------------------------------
// Penguraian respons API
//
// Penguraian bersifat defensif: field yang tidak dikenali atau
// berformat salah diabaikan (menjadi undefined/null), bukan membuat
// seluruh daftar gagal tampil. Baris tanpa id, tanpa tanggal, atau
// tanpa komponen jenis yang diminta dilewati.
// ------------------------------------------------------------------

function sebagaiAngka(nilai: unknown): number | null {
  return typeof nilai === "number" && Number.isFinite(nilai) ? nilai : null;
}

function sebagaiTeks(nilai: unknown): string | undefined {
  if (typeof nilai !== "string") return undefined;
  const bersih = nilai.trim();
  return bersih === "" ? undefined : bersih;
}

function sebagaiBoolean(nilai: unknown): boolean | undefined {
  return typeof nilai === "boolean" ? nilai : undefined;
}

function sebagaiStatus(nilai: unknown): DoctorStatus | null {
  return typeof nilai === "string" && STATUS_VALID.includes(nilai)
    ? (nilai as DoctorStatus)
    : null;
}

function sebagaiSumber(nilai: unknown): DoctorSumber | null {
  return typeof nilai === "string" && SUMBER_VALID.includes(nilai)
    ? (nilai as DoctorSumber)
    : null;
}

function uraiDetailBaterai(komponen: Record<string, unknown>): BateraiDetail {
  const detail: BateraiDetail = {};
  const persen = sebagaiAngka(komponen.persen);
  if (persen !== null && persen >= 0 && persen <= 100) detail.persen = persen;
  if (
    typeof komponen.status_baterai === "string" &&
    STATUS_BATERAI_VALID.includes(komponen.status_baterai)
  ) {
    detail.statusBaterai = komponen.status_baterai as StatusBaterai;
  }
  const hematDaya = sebagaiBoolean(komponen.hemat_daya);
  if (hematDaya !== undefined) detail.hematDaya = hematDaya;
  return detail;
}

function uraiDetailPenyimpanan(
  komponen: Record<string, unknown>,
): PenyimpananDetail {
  const detail: PenyimpananDetail = {};
  const total = sebagaiAngka(komponen.total_gb);
  if (total !== null && total > 0) detail.totalGb = total;
  const terpakai = sebagaiAngka(komponen.terpakai_gb);
  if (terpakai !== null && terpakai >= 0) detail.terpakaiGb = terpakai;
  return detail;
}

function uraiDetailPerforma(komponen: Record<string, unknown>): PerformaDetail {
  const detail: PerformaDetail = {};
  if (
    typeof komponen.kondisi === "string" &&
    KONDISI_PERFORMA_VALID.includes(komponen.kondisi)
  ) {
    detail.kondisi = komponen.kondisi as KondisiPerforma;
  }
  const catatan = sebagaiTeks(komponen.catatan);
  if (catatan !== undefined) detail.catatan = catatan;
  const ramTotal = sebagaiAngka(komponen.ram_total_gb);
  if (ramTotal !== null && ramTotal > 0) detail.ramTotalGb = ramTotal;
  const ramKosong = sebagaiAngka(komponen.ram_kosong_gb);
  if (ramKosong !== null && ramKosong >= 0) detail.ramKosongGb = ramKosong;
  const cpu = sebagaiAngka(komponen.cpu_persen);
  if (cpu !== null && cpu >= 0 && cpu <= 100) detail.cpuPersen = cpu;
  const suhu = sebagaiAngka(komponen.suhu_c);
  if (suhu !== null) detail.suhuC = suhu;
  const perangkat = sebagaiTeks(komponen.perangkat);
  if (perangkat !== undefined) detail.perangkat = perangkat;
  const android = sebagaiTeks(komponen.android);
  if (android !== undefined) detail.android = android;
  const prosesor = sebagaiTeks(komponen.prosesor);
  if (prosesor !== undefined) detail.prosesor = prosesor;
  return detail;
}

function uraiSatuAplikasi(nilai: unknown): AplikasiKeamanan | null {
  if (typeof nilai !== "object" || nilai === null || Array.isArray(nilai)) {
    return null;
  }
  const objek = nilai as Record<string, unknown>;
  const nama = sebagaiTeks(objek.nama);
  const izin = sebagaiAngka(objek.izin_berbahaya);
  if (nama === undefined || izin === null || izin < 0) return null;
  return {
    nama,
    izinBerbahaya: Math.floor(izin),
    sistem: sebagaiBoolean(objek.sistem) ?? false,
  };
}

function uraiDetailKeamanan(komponen: Record<string, unknown>): KeamananDetail {
  const aplikasi: AplikasiKeamanan[] = [];
  if (Array.isArray(komponen.aplikasi)) {
    for (const item of komponen.aplikasi) {
      const parsed = uraiSatuAplikasi(item);
      if (parsed) aplikasi.push(parsed);
    }
  } else {
    // Bentuk lama/alternatif: satu aplikasi langsung di komponen.
    const tunggal = uraiSatuAplikasi({
      nama: komponen.nama_aplikasi,
      izin_berbahaya: komponen.izin_berbahaya,
      sistem: komponen.sistem,
    });
    if (tunggal) aplikasi.push(tunggal);
  }
  return { aplikasi };
}

/**
 * Mengurai satu baris health check dari API menjadi entri dokter
 * untuk jenis yang diminta. Mengembalikan null bila baris tidak
 * memiliki komponen jenis itu atau datanya tidak bisa dibaca.
 */
export function uraiEntriDokter(
  jenis: DoctorKind,
  baris: unknown,
): DoctorEntry | null {
  if (typeof baris !== "object" || baris === null || Array.isArray(baris)) {
    return null;
  }
  const objek = baris as Record<string, unknown>;
  const id = sebagaiTeks(objek.id);
  const dibuatPada = sebagaiTeks(objek.dibuat_pada);
  if (id === undefined || dibuatPada === undefined) return null;
  if (Number.isNaN(new Date(dibuatPada).getTime())) return null;

  let ringkasan: unknown = objek.ringkasan;
  if (typeof ringkasan === "string") {
    try {
      ringkasan = JSON.parse(ringkasan) as unknown;
    } catch {
      return null;
    }
  }
  if (
    typeof ringkasan !== "object" ||
    ringkasan === null ||
    Array.isArray(ringkasan)
  ) {
    return null;
  }
  const komponen = (ringkasan as Record<string, unknown>)[jenis];
  if (
    typeof komponen !== "object" ||
    komponen === null ||
    Array.isArray(komponen)
  ) {
    return null;
  }
  const komponenObjek = komponen as Record<string, unknown>;
  const skor = sebagaiAngka(objek.skor);
  const dasar: EntriDasar = {
    id,
    skor: skor !== null && skor >= 0 && skor <= 100 ? Math.round(skor) : null,
    status: sebagaiStatus(komponenObjek.status),
    sumber: sebagaiSumber(komponenObjek.sumber),
    dibuatPada,
  };

  switch (jenis) {
    case "baterai":
      return { ...dasar, jenis, detail: uraiDetailBaterai(komponenObjek) };
    case "penyimpanan":
      return {
        ...dasar,
        jenis,
        detail: uraiDetailPenyimpanan(komponenObjek),
      };
    case "performa":
      return { ...dasar, jenis, detail: uraiDetailPerforma(komponenObjek) };
    case "keamanan":
      return { ...dasar, jenis, detail: uraiDetailKeamanan(komponenObjek) };
  }
}

// ------------------------------------------------------------------
// Pesan galat (bahasa sehari-hari, tanpa rincian teknis — copy.md 13)
// ------------------------------------------------------------------

function pesanDariStatus(error: unknown, pesanUmum: string): string {
  if (error instanceof Error) {
    if (/401/.test(error.message)) {
      return "Sesi sudah berakhir. Masuk lagi untuk lanjut.";
    }
    if (/403/.test(error.message)) {
      return "Aplikasi terkunci, masukkan PIN untuk membuka.";
    }
    if (/429/.test(error.message)) {
      return "Terlalu sering, coba lagi sebentar.";
    }
  }
  if (error instanceof TypeError) {
    return "Tidak ada koneksi internet. Periksa sambungan, lalu coba lagi.";
  }
  return pesanUmum;
}

export function pesanGalatMuat(error: unknown): string {
  return pesanDariStatus(error, "Data tidak bisa dimuat. Coba lagi.");
}

export function pesanGalatSimpan(error: unknown): string {
  return pesanDariStatus(error, "Data tidak bisa disimpan. Coba lagi.");
}

export function pesanGalatHapus(error: unknown): string {
  return pesanDariStatus(error, "Entri tidak bisa dihapus. Coba lagi.");
}

// ------------------------------------------------------------------
// Pemanggil API (/api/health-checks)
//
// Kontrak API (docs/api-contracts.md 3) tidak menyediakan filter
// per jenis di server — GET hanya mendukung limit/offset — jadi
// penyaringan per jenis dilakukan di sisi client lewat
// uraiEntriDokter. Diambil 100 baris terbaru; cukup untuk riwayat
// catatan manual. Cookie sesi dikirim lewat credentials: "include"
// (kontrak 0.4); fetchJson meneruskan init ke fetch.
// ------------------------------------------------------------------

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

const BATAS_AMBIL_RIWAYAT = 100;

export async function ambilRiwayatDokter(
  jenis: DoctorKind,
): Promise<DoctorEntry[]> {
  const respons = await fetchJson<Envelope<unknown>>(
    `/api/health-checks?limit=${BATAS_AMBIL_RIWAYAT}`,
    { credentials: "include" },
  );
  if (!respons || respons.success !== true || !Array.isArray(respons.data)) {
    throw new Error("Format data tidak dikenali.");
  }
  const hasil: DoctorEntry[] = [];
  for (const baris of respons.data) {
    const entri = uraiEntriDokter(jenis, baris);
    if (entri) hasil.push(entri);
  }
  return hasil;
}

export async function simpanEntriDokter(
  jenis: DoctorKind,
  bodi: BodiEntriDokter,
): Promise<DoctorEntry> {
  const respons = await fetchJson<Envelope<unknown>>("/api/health-checks", {
    method: "POST",
    body: JSON.stringify(bodi),
    credentials: "include",
  });
  if (!respons || respons.success !== true) {
    throw new Error("Format data tidak dikenali.");
  }
  const entri = uraiEntriDokter(jenis, respons.data);
  if (!entri) throw new Error("Format data tidak dikenali.");
  return entri;
}

export async function hapusEntriDokter(id: string): Promise<void> {
  await fetchJson<Envelope<unknown>>(
    `/api/health-checks/${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" },
  );
}
