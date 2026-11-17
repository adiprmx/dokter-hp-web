// apps/api/src/lib/db.ts
// Helper query D1 + paginasi untuk Dokter HP Web App.
//
// Antarmuka D1Like meniru permukaan D1Database (prepare/bind/all/
// first/run) secara struktural, sehingga helper ini bisa dipakai
// dengan D1 asli maupun dengan D1 tiruan pada unit test tanpa
// bergantung pada runtime Cloudflare.
//
// Paginasi (keputusan koordinator K-32):
// - Cursor keyset (encodeCursor/decodeCursor/cursorClause +
//   paginateRows) adalah paginasi kanonis SEMUA endpoint daftar.
//   Parameter: `limit` (bawaan 20, 1-100) + `cursor` (string
//   base64url buram dari meta.pagination.next_cursor halaman
//   sebelumnya). Meta respons: { limit, next_cursor, has_more }.
//   Cursor yang cacat ditolak 400 VALIDATION_ERROR.
// - Paginasi offset (limit/offset + total) DIPENSIUNKAN dan
//   dihapus: helper parseOffsetParam/buatPaginationMeta tidak ada
//   lagi. Urutan daftar selalu dibuat_pada DESC, id DESC.

import type { HasilValidasi } from './validate';

// ------------------------------------------------------------------
// Antarmuka D1 minimal (kompatibel struktural dengan D1Database)
// ------------------------------------------------------------------

export interface D1ResultLike<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number | string;
    duration?: number;
  };
}

export interface D1StatementLike {
  bind(...params: unknown[]): D1StatementLike;
  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  first<T = Record<string, unknown>>(col?: string): Promise<T | null>;
  run(): Promise<D1ResultLike>;
}

export interface D1Like {
  prepare(query: string): D1StatementLike;
}

// ------------------------------------------------------------------
// Utilitas umum
// ------------------------------------------------------------------

/** Waktu sekarang sebagai ISO 8601 (format timestamptz D1). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** ID baru (UUID v4) untuk baris yang dibuat di Worker. */
export function newId(): string {
  return crypto.randomUUID();
}

// ------------------------------------------------------------------
// Helper query (selalu prepared statement + parameter terikat)
// ------------------------------------------------------------------

/** Menjalankan SELECT dan mengembalikan semua baris (array kosong bila tidak ada). */
export async function queryAll<T>(
  db: D1Like,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const hasil = await db.prepare(sql).bind(...params).all<T>();
  return hasil.results ?? [];
}

/** Menjalankan SELECT dan mengembalikan satu baris atau null. */
export async function queryOne<T>(
  db: D1Like,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>();
}

/** Menjalankan INSERT/UPDATE/DELETE dan mengembalikan jumlah baris yang berubah. */
export async function runQuery(
  db: D1Like,
  sql: string,
  ...params: unknown[]
): Promise<number> {
  const hasil = await db.prepare(sql).bind(...params).run();
  return hasil.meta?.changes ?? 0;
}

/** Menghitung total baris untuk paginasi offset (SELECT COUNT(*) ...). */
export async function queryTotal(
  db: D1Like,
  sql: string,
  ...params: unknown[]
): Promise<number> {
  const row = await queryOne<{ jumlah: number }>(db, sql, ...params);
  return row?.jumlah ?? 0;
}

// ------------------------------------------------------------------
// Paginasi cursor (kontrak api-contracts.md bagian 0.6, K-32)
// ------------------------------------------------------------------

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Mengurai parameter `limit` secara ketat (kontrak 0.6):
 * tidak ada -> default 20; bukan angka -> galat; di luar 1-100 ->
 * diklem ke batas terdekat (bukan galat).
 */
export function parseLimitParam(raw: string | undefined): HasilValidasi<number> {
  if (raw === undefined) return { ok: true, value: DEFAULT_LIMIT };
  if (raw.trim() === '' || !/^-?\d+$/.test(raw.trim())) {
    return { ok: false, field: 'limit', message: 'Limit harus berupa angka.' };
  }
  const angka = Number.parseInt(raw, 10);
  if (angka < 1) return { ok: true, value: 1 };
  if (angka > MAX_LIMIT) return { ok: true, value: MAX_LIMIT };
  return { ok: true, value: angka };
}

/**
 * Mengurai parameter `limit` secara longgar (nilai tidak valid memakai
 * default). Dipakai bila endpoint tidak perlu menolak limit yang salah;
 * endpoint daftar kontrak memakai parseLimitParam yang ketat.
 */
export function parseLimit(
  raw: string | undefined,
  nilaiDefault: number = DEFAULT_LIMIT,
): number {
  if (raw === undefined) return nilaiDefault;
  const angka = Number.parseInt(raw, 10);
  if (!Number.isFinite(angka) || angka < 1) return nilaiDefault;
  return Math.min(angka, MAX_LIMIT);
}

// ------------------------------------------------------------------
// Paginasi cursor keyset (dibuat_pada DESC, id DESC)
// ------------------------------------------------------------------

/** Posisi cursor: baris terakhir pada halaman sebelumnya. */
export interface Cursor {
  dibuat_pada: string;
  id: string;
}

/** Mengodekan cursor menjadi string base64url (aman di query string). */
export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify(cursor);
  const bytes = new TextEncoder().encode(json);
  let biner = '';
  for (const b of bytes) biner += String.fromCharCode(b);
  return btoa(biner)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** Mendekodekan string cursor; mengembalikan null bila tidak valid. */
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const base64 = raw.replaceAll('-', '+').replaceAll('_', '/');
    const lengkap = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const biner = atob(lengkap);
    const bytes = Uint8Array.from(biner, (karakter) => karakter.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const objek = JSON.parse(json) as unknown;
    if (typeof objek !== 'object' || objek === null) return null;
    const { dibuat_pada, id } = objek as Record<string, unknown>;
    if (typeof dibuat_pada !== 'string' || typeof id !== 'string') return null;
    if (!dibuat_pada || !id) return null;
    return { dibuat_pada, id };
  } catch {
    return null;
  }
}

/**
 * Mengurai parameter query `cursor` secara ketat (kontrak 0.6):
 * tidak ada atau kosong -> null (halaman pertama); string yang
 * tidak bisa didekode menjadi cursor valid -> galat
 * VALIDATION_ERROR (bukan diam-diam halaman pertama, agar client
 * yang mengirim cursor rusak langsung tahu).
 */
export function parseCursorParam(raw: string | undefined): HasilValidasi<Cursor | null> {
  if (raw === undefined || raw === '') return { ok: true, value: null };
  const cursor = decodeCursor(raw);
  if (!cursor) {
    return { ok: false, field: 'cursor', message: 'Cursor tidak valid.' };
  }
  return { ok: true, value: cursor };
}

export interface CursorClause {
  /** Fragmen SQL (diawali AND) untuk ditambahkan setelah kondisi WHERE. */
  sql: string;
  params: unknown[];
}

/**
 * Fragmen keyset untuk halaman berikutnya pada urutan terbaru dulu.
 * Baris yang dikembalikan adalah baris yang "lebih kecil" dari cursor
 * pada kunci (dibuat_pada DESC, id DESC).
 */
export function cursorClause(cursor: Cursor | null): CursorClause {
  if (!cursor) return { sql: '', params: [] };
  return {
    sql: 'AND (dibuat_pada < ? OR (dibuat_pada = ? AND id < ?))',
    params: [cursor.dibuat_pada, cursor.dibuat_pada, cursor.id],
  };
}

export interface PageMeta extends Record<string, unknown> {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * Memotong hasil query (yang diambil sebanyak limit + 1) menjadi satu
 * halaman cursor dan menghitung meta paginasi. Baris WAJIB sudah
 * terurut dibuat_pada DESC, id DESC.
 */
export function paginateRows<T extends { dibuat_pada: string; id: string }>(
  baris: T[],
  limit: number,
): { items: T[]; meta: PageMeta } {
  const hasMore = baris.length > limit;
  const items = hasMore ? baris.slice(0, limit) : baris;
  const terakhir = items[items.length - 1];
  return {
    items,
    meta: {
      limit,
      next_cursor:
        hasMore && terakhir
          ? encodeCursor({ dibuat_pada: terakhir.dibuat_pada, id: terakhir.id })
          : null,
      has_more: hasMore,
    },
  };
}
