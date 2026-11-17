// apps/api/src/auth/middleware.ts
// Middleware Hono untuk autentikasi sesi + envelope respons JSON
// standar Dokter HP Web App.
//
// Envelope mengikuti docs/api-contracts.md bagian 0.3 (kanonis):
//   Sukses: { success: true, data, meta: { timestamp } }
//   Galat:  { success: false, error: { code, message, details? },
//             meta: { timestamp } }
// Kode galat mengikuti api-contracts.md bagian 0.5:
//   sesi tidak valid -> 401 UNAUTHORIZED
//   sesi terkunci    -> 403 SESSION_LOCKED
// Frontend bercabang dari kode ini (RequireAuth, AiPage, pin.ts),
// jadi kode di sini tidak boleh diubah tanpa mengubah kontrak.
//
// Middleware yang disediakan:
//   - wajibLogin: sesi wajib; menetapkan pengguna, sesi, userId,
//     dan sessionId di konteks. Dipakai rute auth (me, logout, PIN)
//     dan sebagai langkah pertama authMiddleware.
//   - wajibTidakTerkunci: menolak sesi terkunci gerbang PIN (403
//     SESSION_LOCKED). Dipasang SETELAH wajibLogin. Endpoint PIN
//     dan /me TIDAK memakai middleware ini.
//   - authMiddleware: komposisi wajibLogin + wajibTidakTerkunci
//     untuk rute data (health, wifi, history, account).
//   - getUserId / getSessionId: membaca id pemilik/sesi dari
//     konteks. Rute data TIDAK BOLEH membaca user_id dari mana pun
//     selain getUserId(c) — D1 tanpa RLS, kepemilikan ditegakkan
//     di kode lewat user_id dari sesi.
//
// Variabel konteks mencakup BOTH bentuk yang dipakai konsumen:
// `pengguna`/`sesi` (objek baris D1, dipakai rute auth) dan
// `userId`/`sessionId` (string, dipakai rute data dan rute AI
// lewat c.get('userId')). Keempatnya selalu ditetapkan bersamaan
// oleh wajibLogin.
//
// Catatan: helper envelope didefinisikan di sini (mandiri, tidak
// bergantung pada src/lib/envelope.ts) agar modul auth tetap
// berdiri sendiri tanpa dependensi silang ke lib rute data.
// Bentuk keluarannya sama persis dengan envelope.ts (kontrak 0.3).

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { D1Database } from '@cloudflare/workers-types';
import { apakahSesiTerkunci } from './pin';
import {
  bacaTokenDariCookie,
  validasiSesi,
  type BarisPengguna,
  type BarisSesi,
  type DbD1,
  type EnvAuth,
} from './session';

/**
 * Variabel konteks yang ditetapkan middleware auth. Keempatnya
 * selalu ada bersamaan setelah wajibLogin berhasil.
 */
export interface VariabelAuth {
  /** Pengguna dari sesi yang terverifikasi (baris users). */
  pengguna: BarisPengguna;
  /** Sesi yang terverifikasi (baris sessions). */
  sesi: BarisSesi;
  /** ID pengguna (sama dengan pengguna.id). Dipakai rute data/AI. */
  userId: string;
  /** ID sesi saat ini (sama dengan sesi.id). */
  sessionId: string;
}

/** Binding Worker untuk rute data (D1 saja). */
export interface Bindings {
  DB: D1Database;
}

/** Variabel konteks untuk rute data (sama dengan VariabelAuth). */
export type Variables = VariabelAuth;

/** Tipe Env Hono untuk rute data. */
export type AppEnv = { Bindings: Bindings; Variables: Variables };

/**
 * Env minimal middleware: hanya DB (antarmuka DbD1 yang dipersempit)
 * sehingga middleware bisa dipakai di aplikasi Hono mana pun yang
 * menyediakan binding D1 — baik AppEnv rute data maupun EnvAuth
 * router auth.
 */
type EnvMiddleware = { Bindings: { DB: DbD1 }; Variables: VariabelAuth };

/** Tipe konteks Hono untuk rute yang memakai middleware auth. */
export type KonteksAuth = Context<{ Bindings: EnvAuth; Variables: VariabelAuth }>;

/**
 * Mengirim respons sukses dengan envelope standar (kontrak 0.3).
 */
export function responsSukses(
  c: Context,
  data: unknown,
  status: ContentfulStatusCode = 200,
): Response {
  return c.json(
    { success: true, data, meta: { timestamp: new Date().toISOString() } },
    status,
  );
}

/**
 * Mengirim respons galat dengan envelope standar (kontrak 0.3/0.5),
 * termasuk meta.timestamp. Pesan memakai bahasa sehari-hari dan
 * tidak memuat rincian teknis sistem. Parameter rincian (opsional)
 * hanya untuk info tambahan yang aman bagi client (misalnya
 * sisa_percobaan atau sisa_detik pada galat PIN).
 */
export function responsGalat(
  c: Context,
  status: ContentfulStatusCode,
  kode: string,
  pesan: string,
  rincian?: Record<string, unknown>,
): Response {
  const galat: Record<string, unknown> = { code: kode, message: pesan };
  if (rincian !== undefined) {
    galat.details = rincian;
  }
  return c.json(
    { success: false, error: galat, meta: { timestamp: new Date().toISOString() } },
    status,
  );
}

/**
 * Middleware wajib login: membaca token sesi dari cookie, memvalidasi
 * ke D1, lalu menyimpan pengguna, sesi, userId, dan sessionId ke
 * konteks. Bila sesi tidak valid atau kedaluwarsa, menjawab 401
 * dengan kode UNAUTHORIZED (kontrak 0.5).
 */
export const wajibLogin = createMiddleware<EnvMiddleware>(async (c, next) => {
  const token = bacaTokenDariCookie(c.req.header('Cookie'));
  const hasil = await validasiSesi(c.env.DB, token);
  if (!hasil) {
    return responsGalat(c, 401, 'UNAUTHORIZED', 'Sesi Anda sudah berakhir, silakan masuk lagi.');
  }
  c.set('pengguna', hasil.pengguna);
  c.set('sesi', hasil.sesi);
  c.set('userId', hasil.pengguna.id);
  c.set('sessionId', hasil.sesi.id);
  await next();
});

/**
 * Middleware gerbang PIN: dipakai SETELAH wajibLogin pada endpoint
 * data (riwayat, WiFi, AI, akun, dan sebagainya). Bila pengguna sudah
 * mengatur PIN tetapi sesi ini belum dibuka dengan PIN, menjawab 403
 * dengan kode SESSION_LOCKED (kontrak 0.5). Endpoint PIN sendiri
 * (/pin/set, /pin/verify, /pin/hapus, /pin/delete) dan /me TIDAK
 * memakai middleware ini.
 */
export const wajibTidakTerkunci = createMiddleware<EnvMiddleware>(async (c, next) => {
  const pengguna = c.get('pengguna');
  const sesi = c.get('sesi');
  if (!pengguna || !sesi) {
    return responsGalat(c, 401, 'UNAUTHORIZED', 'Sesi Anda sudah berakhir, silakan masuk lagi.');
  }
  const terkunci = await apakahSesiTerkunci(c.env.DB, sesi.id, pengguna.pin_hash !== null);
  if (terkunci) {
    return responsGalat(c, 403, 'SESSION_LOCKED', 'Aplikasi terkunci, masukkan PIN untuk membuka.');
  }
  await next();
});

/**
 * Middleware gabungan untuk rute data: sesi wajib + tidak terkunci.
 * Komposisi wajibLogin lalu wajibTidakTerkunci.
 */
export const authMiddleware = createMiddleware<EnvMiddleware>(async (c, next) => {
  // Komposisi manual: wajibLogin memanggil next() tanpa meneruskan
  // nilai baliknya, jadi respons 403 dari wajibTidakTerkunci harus
  // ditangkap lewat variabel agar tidak hilang (kalau hilang, Hono
  // menganggap konteks tidak selesai dan menjawab 500).
  let responsTerkunci: Response | undefined;
  const responsLogin = await wajibLogin(c, async () => {
    responsTerkunci = (await wajibTidakTerkunci(c, next)) ?? undefined;
  });
  if (responsLogin) {
    return responsLogin;
  }
  if (responsTerkunci) {
    return responsTerkunci;
  }
});

/** Mengambil id pengguna dari sesi yang sudah terverifikasi. */
export function getUserId(c: { get(key: 'userId'): string }): string {
  return c.get('userId');
}

/** Mengambil id sesi saat ini (untuk menandai sesi di daftar sesi). */
export function getSessionId(c: { get(key: 'sessionId'): string }): string {
  return c.get('sessionId');
}
