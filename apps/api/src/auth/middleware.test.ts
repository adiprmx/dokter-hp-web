// apps/api/src/auth/middleware.test.ts
// Test middleware auth ASLI (bukan mock): wajibLogin,
// wajibTidakTerkunci, dan komposisi authMiddleware, dengan D1
// tiruan (FakeD1) + modul session.ts / pin.ts Tim Auth yang nyata.
//
// Tes ini penting karena komposisi manual authMiddleware pernah
// mengandung bug senyap: respons 403 dari wajibTidakTerkunci
// hilang karena wajibLogin tidak meneruskan nilai balik next().
// Tes "PIN diatur + sesi belum dibuka" adalah regresi untuk bug itu.

import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import {
  authMiddleware,
  getSessionId,
  getUserId,
  responsGalat,
  responsSukses,
  wajibLogin,
  wajibTidakTerkunci,
  type VariabelAuth,
} from './middleware';
import { hashToken, type DbD1 } from './session';
import { FakeD1, type Seed } from '../test/fake-d1';

/** Env uji: DB memenuhi D1Database sekaligus DbD1 (keduanya dipakai). */
type EnvUji = {
  Bindings: { DB: D1Database & DbD1 };
  Variables: VariabelAuth;
};

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_PIN = '33333333-3333-4333-8333-333333333333';

const TOKEN_A = 'token-mentah-a-0123456789abcdef';
const TOKEN_PIN = 'token-mentah-pin-0123456789abcde';
const TOKEN_PIN_BUKA = 'token-mentah-pin-buka-0123456789';
const TOKEN_KADALUWARSA = 'token-mentah-kadaluarsa-01234567';
const TOKEN_ASING = 'token-mentah-asing-tidak-dikenal';

const SESI_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const SESI_PIN = 'aaaaaaaa-0000-4000-8000-000000000002';
const SESI_PIN_BUKA = 'aaaaaaaa-0000-4000-8000-000000000003';
const SESI_KADALUWARSA = 'aaaaaaaa-0000-4000-8000-000000000004';

const MASA_DEPAN = '2999-01-01T00:00:00.000Z';
const MASA_LALU = '2020-01-01T00:00:00.000Z';

async function seedAwal(): Promise<Seed> {
  const [hashA, hashPin, hashPinBuka, hashKadaluarsa] = await Promise.all([
    hashToken(TOKEN_A),
    hashToken(TOKEN_PIN),
    hashToken(TOKEN_PIN_BUKA),
    hashToken(TOKEN_KADALUWARSA),
  ]);
  return {
    users: [
      { id: USER_A, email: 'a@contoh.id', nama: 'Pengguna A', provider: 'google', pin_hash: null, pin_salt: null, dibuat_pada: '2026-11-01T00:00:00.000Z' },
      { id: USER_PIN, email: 'pin@contoh.id', nama: 'Pengguna PIN', provider: 'google', pin_hash: 'hash-pin-uji', pin_salt: 'salt-pin-uji', dibuat_pada: '2026-11-01T00:00:00.000Z' },
    ],
    sessions: [
      { id: SESI_A, user_id: USER_A, token_hash: hashA, expires_at: MASA_DEPAN, dibuat_pada: '2026-11-17T00:00:00.000Z' },
      { id: SESI_PIN, user_id: USER_PIN, token_hash: hashPin, expires_at: MASA_DEPAN, dibuat_pada: '2026-11-17T00:00:00.000Z' },
      { id: SESI_PIN_BUKA, user_id: USER_PIN, token_hash: hashPinBuka, expires_at: MASA_DEPAN, dibuat_pada: '2026-11-17T00:00:00.000Z' },
      { id: SESI_KADALUWARSA, user_id: USER_A, token_hash: hashKadaluarsa, expires_at: MASA_LALU, dibuat_pada: '2020-01-01T00:00:00.000Z' },
    ],
    pin_unlocks: [
      { session_id: SESI_PIN_BUKA, dibuka_pada: '2026-11-17T10:00:00.000Z' },
    ],
  };
}

function buatApp(): Hono<EnvUji> {
  const app = new Hono<EnvUji>();
  app.use('/data/*', authMiddleware);
  app.get('/data/ok', (c) =>
    c.json({ userId: getUserId(c), sessionId: getSessionId(c) }),
  );
  app.use('/login-saja/*', wajibLogin);
  app.get('/login-saja/ok', (c) => c.json({ ok: true, userId: getUserId(c) }));
  app.use('/pin-saja/*', wajibTidakTerkunci);
  app.get('/pin-saja/ok', (c) => c.json({ ok: true }));
  app.get('/envelope/sukses', (c) => responsSukses(c, { a: 1 }, 201));
  app.get('/envelope/galat', (c) =>
    responsGalat(c, 422, 'KONFIRMASI_SALAH', 'Konfirmasi salah.', { contoh: 1 }),
  );
  return app;
}

let db: FakeD1;
let app: Hono<EnvUji>;

beforeEach(async () => {
  db = new FakeD1(await seedAwal());
  app = buatApp();
});

async function minta(
  path: string,
  token?: string,
): Promise<{ status: number; body: any; res: Response }> {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers.Cookie = `dokter_hp_session=${token}`;
  }
  const res = await app.request(`http://localhost${path}`, { headers }, {
    DB: db as unknown as D1Database & DbD1,
  });
  const body = (await res.json()) as any;
  return { status: res.status, body, res };
}

describe('authMiddleware (komposisi wajibLogin + wajibTidakTerkunci)', () => {
  it('tanpa cookie mengembalikan 401 UNAUTHORIZED', async () => {
    const { status, body } = await minta('/data/ok');
    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.meta.timestamp).toBe('string');
  });

  it('token tidak dikenal mengembalikan 401 UNAUTHORIZED', async () => {
    const { status, body } = await minta('/data/ok', TOKEN_ASING);
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('sesi kedaluwarsa mengembalikan 401 dan sesi dihapus dari D1', async () => {
    const { status, body } = await minta('/data/ok', TOKEN_KADALUWARSA);
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(db.baris('sessions').some((r) => r.id === SESI_KADALUWARSA)).toBe(false);
  });

  it('sesi valid tanpa PIN meloloskan request dan menetapkan userId/sessionId', async () => {
    const { status, body } = await minta('/data/ok', TOKEN_A);
    expect(status).toBe(200);
    expect(body).toEqual({ userId: USER_A, sessionId: SESI_A });
  });

  it('PIN diatur + sesi belum dibuka mengembalikan 403 SESSION_LOCKED (regresi komposisi)', async () => {
    const { status, body } = await minta('/data/ok', TOKEN_PIN);
    expect(status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SESSION_LOCKED');
  });

  it('PIN diatur + sesi sudah dibuka meloloskan request', async () => {
    const { status, body } = await minta('/data/ok', TOKEN_PIN_BUKA);
    expect(status).toBe(200);
    expect(body).toEqual({ userId: USER_PIN, sessionId: SESI_PIN_BUKA });
  });
});

describe('wajibLogin dan wajibTidakTerkunci terpisah', () => {
  it('wajibLogin saja meloloskan sesi yang terkunci PIN (gerbang PIN bukan tugasnya)', async () => {
    const { status, body } = await minta('/login-saja/ok', TOKEN_PIN);
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, userId: USER_PIN });
  });

  it('wajibLogin saja menolak tanpa cookie dengan 401', async () => {
    const { status, body } = await minta('/login-saja/ok');
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('wajibTidakTerkunci tanpa wajibLogin mengembalikan 401 (tidak ada pengguna di konteks)', async () => {
    const { status, body } = await minta('/pin-saja/ok', TOKEN_A);
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('helper envelope middleware', () => {
  it('responsSukses memakai envelope standar + status yang diminta', async () => {
    const { status, body } = await minta('/envelope/sukses');
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ a: 1 });
    expect(typeof body.meta.timestamp).toBe('string');
  });

  it('responsGalat menyertakan code, message, details, dan meta.timestamp', async () => {
    const { status, body } = await minta('/envelope/galat');
    expect(status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toEqual({
      code: 'KONFIRMASI_SALAH',
      message: 'Konfirmasi salah.',
      details: { contoh: 1 },
    });
    expect(typeof body.meta.timestamp).toBe('string');
  });
});
