// apps/api/src/lib/validate.ts
// Validasi input untuk Dokter HP Web App (tanpa pustaka luar).
// Batas-batas mengikuti docs/api-contracts.md (bagian 3.1, 4.1, 4.5).
//
// Setiap validator mengembalikan { ok: true, value } bila valid atau
// { ok: false, field, message } bila tidak. `assertValid` mengubah
// hasil gagal menjadi ApiError 400 agar handler rute tetap ringkas.
// Semua pesan memakai Bahasa Indonesia yang mudah dipahami.

import { ApiError } from './envelope';

export type HasilValidasi<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

function ok<T>(value: T): HasilValidasi<T> {
  return { ok: true, value };
}

function gagal<T>(field: string, message: string): HasilValidasi<T> {
  return { ok: false, field, message };
}

/** Mengambil nilai dari hasil validasi, atau melempar ApiError 400 bila gagal. */
export function assertValid<T>(hasil: HasilValidasi<T>): T {
  if (!hasil.ok) {
    throw new ApiError(400, 'VALIDATION_ERROR', hasil.message);
  }
  return hasil.value;
}

// ------------------------------------------------------------------
// UUID
// ------------------------------------------------------------------

const POLA_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True bila nilai berupa string UUID (8-4-4-4-12 heksadesimal). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && POLA_UUID.test(value);
}

export function validateUuid(value: unknown, field = 'id'): HasilValidasi<string> {
  if (!isUuid(value)) {
    return gagal(field, 'ID tidak valid.');
  }
  return ok(value);
}

// ------------------------------------------------------------------
// String
// ------------------------------------------------------------------

export interface OpsiString {
  /** Bila true, nilai wajib ada dan tidak kosong. */
  required?: boolean;
  /** Panjang maksimum (dalam karakter) setelah dirapikan. */
  max?: number;
  /** Panjang minimum (dalam karakter) setelah dirapikan. */
  min?: number;
}

/**
 * Memvalidasi string. Nilai opsional yang kosong (undefined, null,
 * atau hanya spasi) menjadi null. Nilai yang dikembalikan sudah
 * dirapikan (spasi ujung dibuang).
 */
export function validateString(
  value: unknown,
  field: string,
  opsi: OpsiString = {},
): HasilValidasi<string | null> {
  const { required = false, max, min } = opsi;
  if (value === undefined || value === null || value === '') {
    if (required) {
      return gagal(field, `${label(field)} wajib diisi.`);
    }
    return ok(null);
  }
  if (typeof value !== 'string') {
    return gagal(field, `${label(field)} harus berupa teks.`);
  }
  const rapi = value.trim();
  if (rapi === '') {
    if (required) {
      return gagal(field, `${label(field)} wajib diisi.`);
    }
    return ok(null);
  }
  if (min !== undefined && rapi.length < min) {
    return gagal(field, `${label(field)} minimal ${min} karakter.`);
  }
  if (max !== undefined && rapi.length > max) {
    return gagal(field, `${label(field)} maksimal ${max} karakter.`);
  }
  return ok(rapi);
}

/** Label ramah dari nama field (garis bawah menjadi spasi). */
function label(field: string): string {
  return field.replaceAll('_', ' ');
}

// ------------------------------------------------------------------
// Angka
// ------------------------------------------------------------------

export interface OpsiAngka {
  required?: boolean;
  min?: number;
  max?: number;
  /** Batas bawah eksklusif: nilai harus LEBIH BESAR dari ini. */
  minExclusive?: number;
  /** Batas atas eksklusif: nilai harus LEBIH KECIL dari ini. */
  maxExclusive?: number;
  /** Bila true, nilai harus bilangan bulat. */
  bulat?: boolean;
}

function validateAngka(
  value: unknown,
  field: string,
  opsi: OpsiAngka,
): HasilValidasi<number | null> {
  const { required = false, min, max, minExclusive, maxExclusive, bulat = false } = opsi;
  if (value === undefined || value === null || value === '') {
    if (required) {
      return gagal(field, `${label(field)} wajib diisi.`);
    }
    return ok(null);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return gagal(field, `${label(field)} harus berupa angka.`);
  }
  if (bulat && !Number.isInteger(value)) {
    return gagal(field, `${label(field)} harus berupa angka bulat.`);
  }
  if (min !== undefined && value < min) {
    return gagal(field, `${label(field)} minimal ${min}.`);
  }
  if (max !== undefined && value > max) {
    return gagal(field, `${label(field)} maksimal ${max}.`);
  }
  if (minExclusive !== undefined && value <= minExclusive) {
    return gagal(field, `${label(field)} harus lebih besar dari ${minExclusive}.`);
  }
  if (maxExclusive !== undefined && value >= maxExclusive) {
    return gagal(field, `${label(field)} harus lebih kecil dari ${maxExclusive}.`);
  }
  return ok(value);
}

/** Bilangan bulat dalam rentang (untuk channel, ping, detik, dan sejenisnya). */
export function validateInteger(
  value: unknown,
  field: string,
  opsi: OpsiAngka = {},
): HasilValidasi<number | null> {
  return validateAngka(value, field, { ...opsi, bulat: true });
}

/** Angka (boleh desimal) dalam rentang. */
export function validateNumber(
  value: unknown,
  field: string,
  opsi: OpsiAngka = {},
): HasilValidasi<number | null> {
  return validateAngka(value, field, { ...opsi, bulat: false });
}

/** Skor kesehatan: bilangan bulat 0-100, wajib diisi. */
export function validateSkor(value: unknown): HasilValidasi<number> {
  const hasil = validateAngka(value, 'skor', {
    required: true,
    min: 0,
    max: 100,
    bulat: true,
  });
  if (!hasil.ok) {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      return gagal('skor', 'Skor harus berupa angka bulat antara 0 dan 100.');
    }
    if (typeof value === 'number') {
      return gagal('skor', 'Skor harus berada di antara 0 dan 100.');
    }
    return gagal('skor', 'Skor wajib diisi dengan angka bulat antara 0 dan 100.');
  }
  return ok(hasil.value as number);
}

/**
 * Channel WiFi (kontrak 4.1): 1-14 (pita 2,4 GHz) atau 32-177
 * (pita 5 GHz). Nilai di luar kedua rentang ditolak.
 */
export function validateChannel(value: unknown): HasilValidasi<number | null> {
  if (value === undefined || value === null || value === '') {
    return ok(null);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return gagal('channel', 'Channel harus berupa angka bulat.');
  }
  const di24 = value >= 1 && value <= 14;
  const di5 = value >= 32 && value <= 177;
  if (!di24 && !di5) {
    return gagal('channel', 'Channel harus 1 sampai 14 (2,4 GHz) atau 32 sampai 177 (5 GHz).');
  }
  return ok(value);
}

/**
 * Durasi tes bertahan (kontrak 4.1): bila terisi, harus 30 —
 * satu-satunya durasi tes bertahan yang didukung.
 */
export function validateDurasiTes(value: unknown): HasilValidasi<number | null> {
  if (value === undefined || value === null || value === '') {
    return ok(null);
  }
  if (value !== 30) {
    return gagal('durasi_tes_detik', 'Durasi tes bertahan harus 30 detik.');
  }
  return ok(30);
}

// ------------------------------------------------------------------
// Enum
// ------------------------------------------------------------------

function validateEnum<T extends string>(
  value: unknown,
  field: string,
  pilihan: readonly T[],
  required = false,
): HasilValidasi<T | null> {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return gagal(field, `${label(field)} wajib diisi.`);
    }
    return ok(null);
  }
  if (typeof value !== 'string' || !(pilihan as readonly string[]).includes(value)) {
    return gagal(field, `${label(field)} harus salah satu dari: ${pilihan.join(', ')}.`);
  }
  return ok(value as T);
}

export const SYNC_STATUS = ['pending', 'synced', 'failed'] as const;
export type SyncStatus = (typeof SYNC_STATUS)[number];

/** Status sinkron: pending / synced / failed (kontrak 3). */
export function validateSyncStatus(
  value: unknown,
  required = false,
): HasilValidasi<SyncStatus | null> {
  return validateEnum(value, 'sync_status', SYNC_STATUS, required);
}

export const KEKUATAN_SINYAL = ['lemah', 'sedang', 'kuat'] as const;
export type KekuatanSinyal = (typeof KEKUATAN_SINYAL)[number];

/** Kekuatan sinyal: lemah / sedang / kuat. */
export function validateKekuatanSinyal(
  value: unknown,
): HasilValidasi<KekuatanSinyal | null> {
  return validateEnum(value, 'kekuatan_sinyal', KEKUATAN_SINYAL);
}

export const SUMBER_LAPORAN = ['web', 'apk', 'manual'] as const;
export type SumberLaporan = (typeof SUMBER_LAPORAN)[number];

/** Sumber laporan: web / apk / manual. */
export function validateSumber(value: unknown): HasilValidasi<SumberLaporan | null> {
  return validateEnum(value, 'sumber', SUMBER_LAPORAN);
}

export const JENIS_RIWAYAT = ['kesehatan', 'wifi', 'ai'] as const;
export type JenisRiwayat = (typeof JENIS_RIWAYAT)[number];

/** Jenis riwayat: kesehatan / wifi / ai. */
export function validateJenisRiwayat(
  value: unknown,
): HasilValidasi<JenisRiwayat | null> {
  return validateEnum(value, 'jenis', JENIS_RIWAYAT);
}

// ------------------------------------------------------------------
// Objek ringkasan (health_checks.ringkasan)
// ------------------------------------------------------------------

/** Batas ukuran JSON ringkasan (kontrak 3.1): 10 KB. */
export const MAX_RINGKASAN_JSON = 10_240;

/**
 * Ringkasan pemeriksaan: harus berupa objek JSON biasa (bukan array
 * atau null) dengan ukuran JSON maksimal 10 KB. Nilai yang tidak
 * diberikan menjadi objek kosong. Isi objek tidak divalidasi ketat
 * — frontend menyimpan detail mentah tiap komponen di dalamnya
 * (persen baterai, GB penyimpanan, daftar aplikasi, dan lainnya).
 */
export function validateRingkasan(
  value: unknown,
): HasilValidasi<Record<string, unknown>> {
  if (value === undefined || value === null) return ok({});
  if (typeof value !== 'object' || Array.isArray(value)) {
    return gagal('ringkasan', 'Ringkasan harus berupa objek.');
  }
  const json = JSON.stringify(value);
  if (json.length > MAX_RINGKASAN_JSON) {
    return gagal('ringkasan', 'Ringkasan terlalu besar (maksimal 10 KB).');
  }
  return ok(value as Record<string, unknown>);
}

// ------------------------------------------------------------------
// Sampel tes bertahan (wifi_sustained_samples)
// ------------------------------------------------------------------

export interface SampelTes {
  detik_ke: number;
  kecepatan_kbps: number;
}

export const MAX_SAMPEL_PER_LAPORAN = 30;
export const MAX_DETIK_TES = 29;
/** Batas kecepatan sampel (kontrak 4.5): 1.000.000 KB/detik. */
export const MAX_KECEPATAN_KBPS = 1_000_000;

/**
 * Memvalidasi daftar sampel tes bertahan: 1-30 sampel, detik_ke
 * bilangan bulat 0-29 tanpa duplikat, kecepatan_kbps angka 0 sampai
 * 1.000.000. Hasil diurutkan berdasarkan detik_ke.
 */
export function validateSamples(value: unknown): HasilValidasi<SampelTes[]> {
  if (!Array.isArray(value)) {
    return gagal('samples', 'Sampel harus berupa daftar.');
  }
  if (value.length === 0) {
    return gagal('samples', 'Sampel tidak boleh kosong.');
  }
  if (value.length > MAX_SAMPEL_PER_LAPORAN) {
    return gagal('samples', 'Maksimal 30 sampel per laporan.');
  }
  const sudahAda = new Set<number>();
  const hasil: SampelTes[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i] as Record<string, unknown> | null;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return gagal('samples', `Sampel ke-${i + 1} tidak valid.`);
    }
    const detik = validateInteger(item.detik_ke, 'detik_ke', {
      required: true,
      min: 0,
      max: MAX_DETIK_TES,
    });
    if (!detik.ok) {
      return gagal('samples', `Sampel ke-${i + 1}: detik harus berada di antara 0 dan 29.`);
    }
    const detikKe = detik.value as number;
    if (sudahAda.has(detikKe)) {
      return gagal('samples', `Sampel ke-${i + 1}: detik ${detikKe} sudah ada.`);
    }
    sudahAda.add(detikKe);
    const kecepatan = validateNumber(item.kecepatan_kbps, 'kecepatan_kbps', {
      required: true,
      min: 0,
      max: MAX_KECEPATAN_KBPS,
    });
    if (!kecepatan.ok) {
      return gagal(
        'samples',
        `Sampel ke-${i + 1}: kecepatan harus berupa angka 0 sampai 1.000.000.`,
      );
    }
    hasil.push({ detik_ke: detikKe, kecepatan_kbps: kecepatan.value as number });
  }
  hasil.sort((a, b) => a.detik_ke - b.detik_ke);
  return ok(hasil);
}

// ------------------------------------------------------------------
// Badan request
// ------------------------------------------------------------------

/**
 * Memastikan badan JSON adalah objek biasa (bukan array, null,
 * atau tipe lain). Mengembalikan null bila bukan objek.
 */
export function sebagaiObjek(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  return body as Record<string, unknown>;
}
