// apps/api/src/lib/envelope.ts
// Envelope respons JSON standar + galat API untuk Dokter HP Web App.
//
// Mengikuti docs/api-contracts.md bagian 0.3 dan 0.5 (kontrak kanonis
// untuk bentuk request/response):
//   Sukses: { success: true, data, meta: { timestamp, ... } }
//   Galat:  { success: false, error: { code, message, details? },
//             meta: { timestamp } }
// Kode galat memakai kode kontrak (VALIDATION_ERROR, UNAUTHORIZED,
// NOT_FOUND, SESSION_LOCKED, KONFIRMASI_SALAH, RATE_LIMITED,
// INTERNAL_ERROR, dan seterusnya). Pesan galat memakai bahasa
// sehari-hari, tanpa rincian teknis.

import type { Context, Env } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Galat API dengan status HTTP, kode kontrak, dan rincian opsional. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Galat 400 — input tidak valid (kode kontrak VALIDATION_ERROR). */
export function tidakValid(
  message: string,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details);
}

/** Galat 400 — badan bukan JSON yang bisa dibaca (kode kontrak INVALID_JSON). */
export function jsonTidakValid(): ApiError {
  return new ApiError(400, 'INVALID_JSON', 'Format data yang dikirim tidak dikenali.');
}

/** Galat 404 — data tidak ditemukan (dipakai juga saat data milik pengguna lain). */
export function tidakDitemukan(apa = 'Data'): ApiError {
  return new ApiError(404, 'NOT_FOUND', `${apa} tidak ditemukan.`);
}

/** Galat 401 — sesi tidak ada, tidak valid, atau kedaluwarsa. */
export function sesiTidakValid(): ApiError {
  return new ApiError(
    401,
    'UNAUTHORIZED',
    'Sesi Anda sudah berakhir, silakan masuk lagi.',
  );
}

/** Galat 403 — sesi terkunci PIN; buka dulu dengan PIN. */
export function sesiTerkunci(): ApiError {
  return new ApiError(
    403,
    'SESSION_LOCKED',
    'Aplikasi terkunci, masukkan PIN untuk membuka.',
  );
}

/** Galat 422 — teks konfirmasi hapus akun tidak cocok. */
export function konfirmasiSalah(): ApiError {
  return new ApiError(
    422,
    'KONFIRMASI_SALAH',
    'Teks konfirmasi tidak cocok. Ketik HAPUS untuk melanjutkan.',
  );
}

/** Galat 429 — terlalu banyak permintaan. */
export function terlaluSering(): ApiError {
  return new ApiError(429, 'RATE_LIMITED', 'Terlalu sering, coba lagi sebentar.');
}

export interface SuksesBody<T> {
  success: true;
  data: T;
  meta: Record<string, unknown> & { timestamp: string };
}

export interface GagalBody {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  meta: { timestamp: string };
}

/** Merakit badan respons sukses (tanpa mengirim). */
export function sukses<T>(data: T, meta?: Record<string, unknown>): SuksesBody<T> {
  return {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), ...(meta ?? {}) },
  };
}

/** Merakit badan respons galat (tanpa mengirim). */
export function gagal(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): GagalBody {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: { timestamp: new Date().toISOString() },
  };
}

/** Mengirim respons sukses sebagai JSON. */
export function balasSukses<T>(
  c: Context,
  data: T,
  status: ContentfulStatusCode = 200,
  meta?: Record<string, unknown>,
): Response {
  return c.json(sukses(data, meta), status);
}

/**
 * Mengubah galat apa pun menjadi respons galat JSON standar.
 * ApiError memakai status/kode sendiri; galat lain menjadi 500
 * INTERNAL_ERROR dengan pesan umum (rincian teknis tidak pernah
 * dibocorkan).
 */
export function balasGagal(c: Context, err: unknown): Response {
  if (err instanceof ApiError) {
    return c.json(
      gagal(err.code, err.message, err.details),
      err.status as ContentfulStatusCode,
    );
  }
  return c.json(
    gagal('INTERNAL_ERROR', 'Terjadi kesalahan di server, coba lagi nanti.'),
    500,
  );
}

/** Membungkus handler rute agar semua galat menjadi envelope standar. */
export function bungkus<E extends Env>(
  handler: (c: Context<E>) => Promise<Response>,
): (c: Context<E>) => Promise<Response> {
  return async (c: Context<E>) => {
    try {
      return await handler(c);
    } catch (err) {
      return balasGagal(c, err);
    }
  };
}

/** Membaca badan JSON; melempar ApiError 400 INVALID_JSON bila badan bukan JSON valid. */
export async function bacaBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw jsonTidakValid();
  }
}
