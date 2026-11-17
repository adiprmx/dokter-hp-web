// apps/api/src/ai/routes.ts
// Rute Diagnosis AI (server-side, Hono).
//
// Endpoint kanonis (keputusan koordinator K-37):
//   POST /api/ai/diagnose  — kirim pertanyaan ke Diagnosis AI
//   GET  /api/ai/diagnoses — daftar tanya jawab milik pengguna
// Alias lama (tetap didukung):
//   POST /api/ai/tanya
//   GET  /api/ai/riwayat
// Alias tanpa awalan /api (/ai/diagnose, /ai/diagnoses) DIHAPUS
// (Wave 3b): semua endpoint memakai prefix /api (K-07).
//
// Autentikasi: rute ini mengharapkan variabel konteks `userId` sudah
// diisi middleware sesi di entry Worker (index.ts) sebelum request
// sampai ke rute ini. Bila `userId` tidak ada, rute menjawab 401.
// Middleware sesi (tim Auth) juga wajib menolak sesi terkunci PIN
// (403 SESSION_LOCKED) sebelum request mencapai rute ini — rute AI
// tidak dapat membedakan sesi terkunci dari sesi biasa.
// Rute ini tidak pernah menerima user_id dari client.
//
// Kunci Gemini dibaca dari binding GEMINI_API_KEY (secret Worker)
// dan hanya diteruskan ke modul gemini.ts. Kunci tidak pernah
// dicatat, tidak pernah dikembalikan, dan tidak pernah ada di repo.
// Model dapat diganti tanpa ubah kode lewat variabel lingkungan
// GEMINI_MODEL (bukan secret; bawaan gemini-3.5-flash-lite).
//
// Kuota Gemini (lihat docs/riset-free-tier.md): model Flash-Lite
// 500 request/hari per proyek — limit paling ketat di stack. Tiga
// lapisan melindungi kuota itu:
//   1. Cache jawaban (tabel ai_cache di D1, modul cache.ts):
//      pertanyaan yang sama dari pengguna yang sama dengan data
//      pemeriksaan yang sama memakai jawaban tersimpan (7 hari),
//      tanpa memanggil Gemini. Kunci cache adalah SHA-256 dari
//      pertanyaan yang dinormalisasi + versi konteks + id
//      pengguna + sidik jari data pemeriksaan — cache sengaja
//      per pengguna, karena jawaban dapat memuat data pemeriksaan
//      penanya, sehingga tidak tepat dipakai untuk pengguna lain.
//      KV TIDAK dipakai untuk cache (tulis KV hanya 1.000/hari).
//   2. Batas 20 pertanyaan/hari per pengguna (dihitung dari D1).
//   3. Fallback aturan (fallback.ts): bila Gemini gagal — kuota
//      proyek habis, timeout, galat jaringan, atau kunci belum
//      diatur — pengguna tetap mendapat jawaban dari data
//      pemeriksaannya, dengan pesan jujur bahwa jawaban itu bukan
//      dari AI. Jawaban fallback TIDAK disimpan ke riwayat
//      (agar header "AI sedang tidak tersedia" tidak menjadi basi
//      bila dibaca kembali nanti) dan tidak memotong kuota harian.
//
// Keputusan kanonis (Wave 3b; kontrak bagian 5 sudah diselaraskan):
//   - Pertanyaan dibatasi 1-1000 karakter (K-36).
//   - Kegagalan Gemini TIDAK menjawab 502 AI_TIDAK_TERSEDIA,
//     melainkan jawaban fallback 200 (sumber_jawaban "aturan");
//     kode 502 itu pensiun (K-23).
//   - Respons sukses POST memuat objek diagnosis lengkap sesuai
//     kontrak, ditambah field sumber_jawaban, sisa_hari_ini,
//     label_saran, dan tersimpan.
//   - Riwayat memakai paginasi cursor keyset (K-38), sama seperti
//     semua endpoint daftar lain (K-32).

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { GalatGemini, GEMINI_MODEL, tanyaGemini } from './gemini';
import { bacaCache, hitungKunciCache, tulisCache } from './cache';
import { susunJawabanAturan } from './fallback';
import { LABEL_SARAN, SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { KonteksPerangkat } from './prompt';
import { cekBatasAi } from './ratelimit';
import type { DbD1 } from './ratelimit';
import type { VariabelAuth } from '../auth/middleware';
import {
  cursorClause,
  paginateRows,
  parseCursorParam,
  parseLimitParam,
  type Cursor,
} from '../lib/db';

export type { DbD1 };

/** Binding Worker yang dibutuhkan rute AI. */
export interface AiBindings {
  /** Binding D1 (database Dokter HP). */
  DB: DbD1;
  /** Secret Worker GEMINI_API_KEY (diatur lewat wrangler secret). */
  GEMINI_API_KEY: string;
  /**
   * Model Gemini (variabel biasa, bukan secret). Bila tidak diisi,
   * memakai GEMINI_MODEL (gemini-3.5-flash-lite).
   */
  GEMINI_MODEL?: string;
}

/**
 * Variabel konteks Hono untuk rute AI: sama dengan VariabelAuth
 * (diisi wajibLogin di entry Worker). Rute AI hanya membaca
 * `userId`; tiga variabel lain diabaikan. Memakai tipe yang sama
 * agar aiRoutes bisa dipasang di aplikasi utama tanpa cast
 * (Hono mensyaratkan SubEnv extends Env saat route()).
 */
export type AiVariables = VariabelAuth;

type AiContext = Context<{
  Bindings: AiBindings;
  Variables: AiVariables;
}>;

/** Panjang pertanyaan minimum dan maksimum (karakter, setelah trim). */
export const PERTANYAAN_MIN_KARAKTER = 1;
export const PERTANYAAN_MAKS_KARAKTER = 1000;

/** Asal jawaban yang dikembalikan ke pengguna. */
export type SumberJawaban = 'ai' | 'cache' | 'aturan';

// ---------------------------------------------------------------------
// Envelope respons (sesuai ARCHITECTURE.md bagian 3 + kontrak 0.3/0.6)
// ---------------------------------------------------------------------

function stempelWaktu(): string {
  return new Date().toISOString();
}

function jawabSukses(
  c: AiContext,
  data: unknown,
  status: ContentfulStatusCode = 200,
): Response {
  return c.json(
    { success: true, data, meta: { timestamp: stempelWaktu() } },
    status,
  );
}

function jawabDaftar(
  c: AiContext,
  items: unknown[],
  paginasi: { limit: number; next_cursor: string | null; has_more: boolean },
): Response {
  return c.json({
    success: true,
    data: items,
    meta: {
      timestamp: stempelWaktu(),
      pagination: {
        limit: paginasi.limit,
        next_cursor: paginasi.next_cursor,
        has_more: paginasi.has_more,
      },
    },
  });
}

function jawabGalat(
  c: AiContext,
  status: ContentfulStatusCode,
  kode: string,
  pesan: string,
  header?: Record<string, string>,
): Response {
  return c.json(
    {
      success: false,
      error: { code: kode, message: pesan },
      meta: { timestamp: stempelWaktu() },
    },
    status,
    header,
  );
}

// ---------------------------------------------------------------------
// Validasi (fungsi murni — diuji unit)
// ---------------------------------------------------------------------

export type HasilValidasiPertanyaan =
  | { ok: true; pertanyaan: string }
  | { ok: false; kode: string; pesan: string };

/**
 * Memvalidasi pertanyaan: harus string, setelah trim berisi
 * 1-1000 karakter. Mengembalikan pertanyaan yang sudah di-trim.
 */
export function validasiPertanyaan(
  nilai: unknown,
): HasilValidasiPertanyaan {
  if (typeof nilai !== 'string') {
    return {
      ok: false,
      kode: 'VALIDATION_ERROR',
      pesan: 'Pertanyaan wajib berupa teks.',
    };
  }
  const pertanyaan = nilai.trim();
  if (pertanyaan.length < PERTANYAAN_MIN_KARAKTER) {
    return {
      ok: false,
      kode: 'VALIDATION_ERROR',
      pesan: 'Pertanyaan tidak boleh kosong.',
    };
  }
  if (pertanyaan.length > PERTANYAAN_MAKS_KARAKTER) {
    return {
      ok: false,
      kode: 'VALIDATION_ERROR',
      pesan: 'Pertanyaan maksimal 1000 karakter.',
    };
  }
  return { ok: true, pertanyaan };
}

const POLA_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Memeriksa format UUID v4 (dipakai untuk health_check_id). */
export function apakahUuidValid(nilai: string): boolean {
  return POLA_UUID.test(nilai);
}

export type HasilPaginasi =
  | { ok: true; limit: number; cursor: Cursor | null }
  | { ok: false; kode: string; pesan: string };

/**
 * Mengurai parameter paginasi ?limit=&cursor= sesuai kontrak 0.6
 * (cursor keyset, K-32/K-38): limit bawaan 20, di luar 1-100
 * diklem ke batas terdekat; limit bukan angka -> galat; cursor
 * cacat -> galat (bukan diam-diam halaman pertama).
 */
export function parsePaginasi(query: {
  limit?: string | undefined;
  cursor?: string | undefined;
}): HasilPaginasi {
  const limitHasil = parseLimitParam(query.limit);
  if (!limitHasil.ok) {
    return { ok: false, kode: 'VALIDATION_ERROR', pesan: limitHasil.message };
  }
  const cursorHasil = parseCursorParam(query.cursor);
  if (!cursorHasil.ok) {
    return { ok: false, kode: 'VALIDATION_ERROR', pesan: cursorHasil.message };
  }
  return { ok: true, limit: limitHasil.value, cursor: cursorHasil.value };
}

/**
 * Detik sampai reset kuota harian berikutnya (00:00 UTC).
 * Dipakai sebagai header Retry-After pada respons 429.
 */
export function detikSampaiResetUTC(sekarang: Date = new Date()): number {
  const resetBerikutnya = new Date(sekarang);
  resetBerikutnya.setUTCHours(24, 0, 0, 0);
  const detik = Math.ceil(
    (resetBerikutnya.getTime() - sekarang.getTime()) / 1000,
  );
  return Math.min(Math.max(detik, 1), 86_400);
}

// ---------------------------------------------------------------------
// Konteks perangkat dari D1 (best-effort)
// ---------------------------------------------------------------------

interface BarisPemeriksaan {
  skor?: unknown;
  ringkasan?: unknown;
  dibuat_pada?: unknown;
}

interface BarisWifi {
  kecepatan_unduh_kbps?: unknown;
  ping_ms?: unknown;
  kekuatan_sinyal?: unknown;
}

function sebagaiAngka(nilai: unknown): number | undefined {
  return typeof nilai === 'number' && Number.isFinite(nilai)
    ? nilai
    : undefined;
}

function sebagaiTeks(nilai: unknown): string | undefined {
  return typeof nilai === 'string' && nilai.length > 0 ? nilai : undefined;
}

/** Meringkas kolom ringkasan (TEXT JSON) menjadi teks singkat. */
function ringkasRingkasan(nilai: unknown): string | undefined {
  if (typeof nilai !== 'string' || nilai.length === 0) {
    return undefined;
  }
  const teks = nilai.trim();
  if (teks === '' || teks === '{}') {
    return undefined;
  }
  return teks.slice(0, 500);
}

/**
 * Merakit konteks perangkat dari D1: pemeriksaan kesehatan terakhir
 * (atau pemeriksaan yang dipilih lewat health_check_id) + laporan
 * WiFi terakhir milik pengguna. Kegagalan baca D1 di sini tidak
 * menggagalkan pertanyaan — konteks dikembalikan kosong dan model
 * diberitahu bahwa data tidak tersedia.
 */
export async function ambilKonteksPerangkat(
  db: DbD1,
  idPengguna: string,
  idPemeriksaan?: string,
): Promise<KonteksPerangkat | undefined> {
  try {
    let pemeriksaan: BarisPemeriksaan | null = null;
    if (idPemeriksaan) {
      pemeriksaan = await db
        .prepare(
          'SELECT skor, ringkasan, dibuat_pada FROM health_checks ' +
            'WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        )
        .bind(idPemeriksaan, idPengguna)
        .first<BarisPemeriksaan>();
    } else {
      pemeriksaan = await db
        .prepare(
          'SELECT skor, ringkasan, dibuat_pada FROM health_checks ' +
            'WHERE user_id = ? AND deleted_at IS NULL ' +
            'ORDER BY dibuat_pada DESC LIMIT 1',
        )
        .bind(idPengguna)
        .first<BarisPemeriksaan>();
    }

    const wifi = await db
      .prepare(
        'SELECT kecepatan_unduh_kbps, ping_ms, kekuatan_sinyal ' +
          'FROM wifi_reports WHERE user_id = ? AND deleted_at IS NULL ' +
          'ORDER BY dibuat_pada DESC LIMIT 1',
      )
      .bind(idPengguna)
      .first<BarisWifi>();

    const konteks: KonteksPerangkat = {};
    const skor = sebagaiAngka(pemeriksaan?.skor);
    if (skor !== undefined) konteks.skorTerakhir = skor;
    const tanggal = sebagaiTeks(pemeriksaan?.dibuat_pada);
    if (tanggal) konteks.tanggalPemeriksaanTerakhir = tanggal;
    const ringkasan = ringkasRingkasan(pemeriksaan?.ringkasan);
    if (ringkasan) konteks.ringkasanPemeriksaanTerakhir = ringkasan;
    const unduh = sebagaiAngka(wifi?.kecepatan_unduh_kbps);
    if (unduh !== undefined) konteks.kecepatanUnduhKbpsTerakhir = unduh;
    const latensi = sebagaiAngka(wifi?.ping_ms);
    if (latensi !== undefined) konteks.latensiHttpMsTerakhir = latensi;
    const sinyal = sebagaiTeks(wifi?.kekuatan_sinyal);
    if (sinyal) konteks.kekuatanSinyalTerakhir = sinyal;
    return konteks;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------
// Middleware: wajib ada userId dari middleware sesi
// ---------------------------------------------------------------------

async function wajibMasuk(c: AiContext, next: () => Promise<void>): Promise<Response | void> {
  const idPengguna = c.get('userId');
  if (!idPengguna) {
    return jawabGalat(
      c,
      401,
      'UNAUTHORIZED',
      'Sesi Anda sudah berakhir, silakan masuk lagi.',
    );
  }
  await next();
}

// ---------------------------------------------------------------------
// Handler POST tanya
// ---------------------------------------------------------------------

interface BadanTanya {
  pertanyaan?: unknown;
  health_check_id?: unknown;
}

async function simpanDiagnosis(
  db: DbD1,
  id: string,
  idPengguna: string,
  idPemeriksaan: string | null,
  pertanyaan: string,
  jawaban: string,
  dibuatPada: string,
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO ai_diagnoses ' +
        '(id, user_id, health_check_id, pertanyaan, jawaban, dibuat_pada) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, idPengguna, idPemeriksaan, pertanyaan, jawaban, dibuatPada)
    .run();
}

async function handleTanya(c: AiContext): Promise<Response> {
  const idPengguna = c.get('userId');
  const db = c.env.DB;

  let badan: BadanTanya;
  try {
    badan = (await c.req.json()) as BadanTanya;
  } catch {
    return jawabGalat(
      c,
      400,
      'INVALID_JSON',
      'Format data yang dikirim tidak dikenali.',
    );
  }
  if (typeof badan !== 'object' || badan === null) {
    return jawabGalat(
      c,
      400,
      'INVALID_JSON',
      'Format data yang dikirim tidak dikenali.',
    );
  }

  const validasi = validasiPertanyaan(badan.pertanyaan);
  if (!validasi.ok) {
    return jawabGalat(c, 400, validasi.kode, validasi.pesan);
  }
  const pertanyaan = validasi.pertanyaan;

  // health_check_id opsional; bila diisi harus UUID valid dan milik
  // pengguna (kontrak 5.1: bukan UUID -> VALIDATION_ERROR; tidak ada
  // atau bukan milik pengguna -> NOT_FOUND 404).
  let idPemeriksaan: string | undefined;
  if (badan.health_check_id !== undefined && badan.health_check_id !== null) {
    if (
      typeof badan.health_check_id !== 'string' ||
      !apakahUuidValid(badan.health_check_id.trim())
    ) {
      return jawabGalat(
        c,
        400,
        'VALIDATION_ERROR',
        'Id pemeriksaan tidak valid.',
      );
    }
    idPemeriksaan = badan.health_check_id.trim();
    let milik: { id?: unknown } | null = null;
    try {
      milik = await db
        .prepare(
          'SELECT id FROM health_checks ' +
            'WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        )
        .bind(idPemeriksaan, idPengguna)
        .first<{ id?: unknown }>();
    } catch {
      return jawabGalat(
        c,
        503,
        'DATABASE_SIBUK',
        'Server sedang sibuk, coba lagi nanti.',
      );
    }
    if (!milik) {
      return jawabGalat(c, 404, 'NOT_FOUND', 'Data tidak ditemukan.');
    }
  }

  // Rate limit: 20 pertanyaan/hari per pengguna (dihitung dari D1).
  let statusBatas;
  try {
    statusBatas = await cekBatasAi(db, idPengguna);
  } catch {
    return jawabGalat(
      c,
      503,
      'DATABASE_SIBUK',
      'Server sedang sibuk, coba lagi nanti.',
    );
  }
  if (!statusBatas.diizinkan) {
    return jawabGalat(
      c,
      429,
      'AI_QUOTA_HABIS',
      'Kuota Diagnosis AI hari ini sudah habis, coba lagi besok.',
      { 'Retry-After': String(detikSampaiResetUTC()) },
    );
  }

  const konteks = await ambilKonteksPerangkat(db, idPengguna, idPemeriksaan);
  const dibuatPada = new Date().toISOString();
  const sisaSesudahSimpan = Math.max(0, statusBatas.sisa - 1);

  // Lapisan 1: cache jawaban ai_cache (tanpa memanggil Gemini).
  // Kunci dihitung dari pertanyaan + id pengguna + sidik jari data
  // pemeriksaan, sehingga jawaban tersimpan hanya dipakai bila
  // data pemeriksaan masih sama.
  const kunciCache = await hitungKunciCache(idPengguna, pertanyaan, konteks);
  const jawabanCache = await bacaCache(db, kunciCache);
  if (jawabanCache !== null) {
    const idDiagnosis = crypto.randomUUID();
    try {
      await simpanDiagnosis(
        db,
        idDiagnosis,
        idPengguna,
        idPemeriksaan ?? null,
        pertanyaan,
        jawabanCache,
        dibuatPada,
      );
    } catch {
      return jawabGalat(
        c,
        503,
        'DATABASE_SIBUK',
        'Server sedang sibuk, coba lagi nanti.',
      );
    }
    return jawabSukses(c, {
      id: idDiagnosis,
      user_id: idPengguna,
      health_check_id: idPemeriksaan ?? null,
      pertanyaan,
      jawaban: jawabanCache,
      dibuat_pada: dibuatPada,
      sumber_jawaban: 'cache' as SumberJawaban,
      sisa_hari_ini: sisaSesudahSimpan,
      label_saran: LABEL_SARAN,
      tersimpan: true,
    });
  }

  // Lapisan 2: Gemini (model Flash-Lite + cadangan di gemini.ts).
  const pesanPengguna = buildUserMessage(pertanyaan, konteks);
  let jawaban: string;
  try {
    jawaban = await tanyaGemini({
      kunciApi: c.env.GEMINI_API_KEY,
      promptSistem: SYSTEM_PROMPT,
      pesanPengguna,
      model: c.env.GEMINI_MODEL?.trim() ? c.env.GEMINI_MODEL.trim() : GEMINI_MODEL,
    });
  } catch (galat) {
    if (galat instanceof GalatGemini) {
      // Kuota proyek habis (kedua model menjawab 429) dicatat ke
      // log Worker agar terlihat di observabilitas; pertanyaan dan
      // data pengguna TIDAK dicatat.
      if (galat.kode === 'GEMINI_KUOTA_HABIS') {
        console.warn(
          '[ai] Kuota Gemini habis (kedua model 429); fallback aturan dipakai.',
        );
      }
      // Lapisan 3: fallback aturan tanpa AI. Jawaban fallback
      // TIDAK disimpan ke riwayat dan tidak memotong kuota harian.
      const jawabanAturan = susunJawabanAturan(pertanyaan, konteks);
      return jawabSukses(c, {
        id: null,
        user_id: idPengguna,
        health_check_id: idPemeriksaan ?? null,
        pertanyaan,
        jawaban: jawabanAturan,
        dibuat_pada: dibuatPada,
        sumber_jawaban: 'aturan' as SumberJawaban,
        sisa_hari_ini: statusBatas.sisa,
        label_saran: LABEL_SARAN,
        tersimpan: false,
      });
    }
    return jawabGalat(
      c,
      500,
      'INTERNAL_ERROR',
      'Terjadi kesalahan di server, coba lagi nanti.',
    );
  }

  // Simpan jawaban ke ai_cache (best-effort: kegagalan tulis
  // cache tidak menggagalkan jawaban). Jawaban fallback TIDAK
  // pernah masuk cache — hanya jawaban Gemini.
  await tulisCache(db, kunciCache, jawaban);

  // Simpan Q&A ke ai_diagnoses. Bila simpan gagal, jawaban tidak
  // dikembalikan agar riwayat tetap konsisten (pengguna dapat
  // mengulang tanpa kuota terpotong, karena kuota dihitung dari
  // baris yang tersimpan).
  const idDiagnosis = crypto.randomUUID();
  try {
    await simpanDiagnosis(
      db,
      idDiagnosis,
      idPengguna,
      idPemeriksaan ?? null,
      pertanyaan,
      jawaban,
      dibuatPada,
    );
  } catch {
    return jawabGalat(
      c,
      503,
      'DATABASE_SIBUK',
      'Server sedang sibuk, coba lagi nanti.',
    );
  }

  return jawabSukses(c, {
    id: idDiagnosis,
    user_id: idPengguna,
    health_check_id: idPemeriksaan ?? null,
    pertanyaan,
    jawaban,
    dibuat_pada: dibuatPada,
    sumber_jawaban: 'ai' as SumberJawaban,
    sisa_hari_ini: sisaSesudahSimpan,
    label_saran: LABEL_SARAN,
    tersimpan: true,
  });
}

// ---------------------------------------------------------------------
// Handler GET riwayat
// ---------------------------------------------------------------------

interface BarisRiwayat {
  id?: unknown;
  user_id?: unknown;
  pertanyaan?: unknown;
  jawaban?: unknown;
  health_check_id?: unknown;
  dibuat_pada?: unknown;
}

async function handleRiwayat(c: AiContext): Promise<Response> {
  const idPengguna = c.get('userId');
  const db = c.env.DB;
  const paginasi = parsePaginasi({
    limit: c.req.query('limit'),
    cursor: c.req.query('cursor'),
  });
  if (!paginasi.ok) {
    return jawabGalat(c, 400, paginasi.kode, paginasi.pesan);
  }
  const { limit, cursor } = paginasi;

  try {
    const klausul = cursorClause(cursor);
    const hasil = await db
      .prepare(
        'SELECT id, user_id, pertanyaan, jawaban, health_check_id, dibuat_pada ' +
          'FROM ai_diagnoses WHERE user_id = ? ' +
          klausul.sql +
          ' ORDER BY dibuat_pada DESC, id DESC LIMIT ?',
      )
      .bind(idPengguna, ...klausul.params, limit + 1)
      .all<BarisRiwayat>();

    const semua = (hasil.results ?? []).map((baris) => ({
      id: typeof baris.id === 'string' ? baris.id : '',
      user_id: typeof baris.user_id === 'string' ? baris.user_id : idPengguna,
      pertanyaan:
        typeof baris.pertanyaan === 'string' ? baris.pertanyaan : '',
      jawaban: typeof baris.jawaban === 'string' ? baris.jawaban : '',
      health_check_id:
        typeof baris.health_check_id === 'string'
          ? baris.health_check_id
          : null,
      dibuat_pada:
        typeof baris.dibuat_pada === 'string' ? baris.dibuat_pada : '',
    }));

    const { items, meta } = paginateRows(semua, limit);
    return jawabDaftar(c, items, meta);
  } catch {
    return jawabGalat(
      c,
      503,
      'DATABASE_SIBUK',
      'Server sedang sibuk, coba lagi nanti.',
    );
  }
}

// ---------------------------------------------------------------------
// Aplikasi Hono rute AI
// ---------------------------------------------------------------------

/**
 * Rute Diagnosis AI. Dipasang di entry Worker (index.ts), misalnya:
 *
 *   import { aiRoutes } from './ai/routes';
 *   app.use('/api/ai/*', authMiddleware); // mengisi c.set('userId', ...)
 *   app.route('/', aiRoutes);
 *
 * Rute memakai path absolut (termasuk awalan /api/ai), sehingga
 * dipasang di root — bukan di bawah apiRouter (yang sudah dipasang
 * di /api). Middleware sesi (tim Auth) wajib mengisi variabel
 * `userId` dari token sesi terverifikasi dan menolak sesi terkunci
 * PIN sebelum request mencapai rute ini.
 */
export const aiRoutes = new Hono<{
  Bindings: AiBindings;
  Variables: AiVariables;
}>();

aiRoutes.use('/api/ai/*', wajibMasuk);
// Endpoint kanonis (K-37).
aiRoutes.post('/api/ai/diagnose', handleTanya);
aiRoutes.get('/api/ai/diagnoses', handleRiwayat);
// Alias lama (tetap didukung).
aiRoutes.post('/api/ai/tanya', handleTanya);
aiRoutes.get('/api/ai/riwayat', handleRiwayat);
