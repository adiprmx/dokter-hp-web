// apps/api/src/routes/health.ts
// Rute pemeriksaan kesehatan (health_checks) — di belakang auth.
// Mengikuti docs/api-contracts.md bagian 3.
// Semua query memfilter user_id dari sesi; data pengguna lain tidak
// pernah dikembalikan (D1 tanpa RLS, kepemilikan ditegakkan di kode).

import { Hono } from 'hono';
import { authMiddleware, getUserId, type AppEnv } from '../auth/middleware';
import {
  cursorClause,
  newId,
  nowIso,
  paginateRows,
  parseCursorParam,
  parseLimitParam,
  queryAll,
  queryOne,
  runQuery,
} from '../lib/db';
import { batasLaju } from '../lib/ratelimit';
import {
  assertValid,
  sebagaiObjek,
  validateRingkasan,
  validateSkor,
  validateSyncStatus,
  validateUuid,
} from '../lib/validate';
import { bacaBody, balasSukses, bungkus, tidakDitemukan, tidakValid } from '../lib/envelope';

export interface HealthCheckRow {
  id: string;
  user_id: string;
  skor: number;
  ringkasan: string | null;
  dibuat_pada: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export interface HealthCheckResponse {
  id: string;
  user_id: string;
  skor: number;
  ringkasan: Record<string, unknown>;
  dibuat_pada: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

const KOLOM =
  'id, user_id, skor, ringkasan, dibuat_pada, updated_at, deleted_at, sync_status';

/** Mengubah baris D1 menjadi objek respons kontrak (ringkasan JSON diurai). */
export function toHealthCheckResponse(row: HealthCheckRow): HealthCheckResponse {
  let ringkasan: Record<string, unknown> = {};
  if (row.ringkasan) {
    try {
      const parsed = JSON.parse(row.ringkasan) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        ringkasan = parsed as Record<string, unknown>;
      }
    } catch {
      ringkasan = {};
    }
  }
  return {
    id: row.id,
    user_id: row.user_id,
    skor: row.skor,
    ringkasan,
    dibuat_pada: row.dibuat_pada,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    sync_status: row.sync_status,
  };
}

export const healthRoutes = new Hono<AppEnv>();
// Middleware dibatasi ke prefix rute ini: use() tanpa path akan
// bocor ke semua rute /api/* saat router dipasang di apiRouter
// (termasuk rute utilitas publik /health, /ping).
healthRoutes.use('/health-checks*', authMiddleware);
healthRoutes.use('/health-checks*', batasLaju);

// POST /health-checks — menyimpan pemeriksaan baru (baris web selalu sync_status "synced").
healthRoutes.post(
  '/health-checks',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const body = sebagaiObjek(await bacaBody(c));
    if (!body) {
      throw tidakValid('Isi permintaan tidak valid.');
    }
    const skor = assertValid(validateSkor(body.skor));
    const ringkasan = assertValid(validateRingkasan(body.ringkasan));
    const id = newId();
    const sekarang = nowIso();
    await runQuery(
      c.env.DB,
      `INSERT INTO health_checks (id, user_id, skor, ringkasan, dibuat_pada, updated_at, deleted_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'synced')`,
      id,
      userId,
      skor,
      JSON.stringify(ringkasan),
      sekarang,
      sekarang,
    );
    const row = await queryOne<HealthCheckRow>(
      c.env.DB,
      `SELECT ${KOLOM} FROM health_checks WHERE id = ? AND user_id = ?`,
      id,
      userId,
    );
    if (!row) throw tidakDitemukan('Pemeriksaan');
    return balasSukses(c, toHealthCheckResponse(row), 201);
  }),
);

// GET /health-checks — daftar milik pengguna, terbaru dulu (cursor keyset, K-32).
healthRoutes.get(
  '/health-checks',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const limit = assertValid(parseLimitParam(c.req.query('limit')));
    const cursor = assertValid(parseCursorParam(c.req.query('cursor')));
    const filterSync =
      c.req.query('sync_status') === undefined
        ? null
        : assertValid(validateSyncStatus(c.req.query('sync_status'), true));
    const params: unknown[] = [userId];
    let where = 'WHERE user_id = ? AND deleted_at IS NULL';
    if (filterSync) {
      where += ' AND sync_status = ?';
      params.push(filterSync);
    }
    const klausul = cursorClause(cursor);
    const rows = await queryAll<HealthCheckRow>(
      c.env.DB,
      `SELECT ${KOLOM} FROM health_checks ${where} ${klausul.sql} ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
      ...params,
      ...klausul.params,
      limit + 1,
    );
    const { items, meta } = paginateRows(rows, limit);
    return balasSukses(c, items.map(toHealthCheckResponse), 200, {
      pagination: meta,
    });
  }),
);

// GET /health-checks/:id — satu pemeriksaan milik pengguna.
healthRoutes.get(
  '/health-checks/:id',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const id = assertValid(validateUuid(c.req.param('id')));
    const row = await queryOne<HealthCheckRow>(
      c.env.DB,
      `SELECT ${KOLOM} FROM health_checks WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      id,
      userId,
    );
    if (!row) throw tidakDitemukan('Pemeriksaan');
    return balasSukses(c, toHealthCheckResponse(row));
  }),
);

// DELETE /health-checks/:id — soft-delete (deleted_at diisi).
healthRoutes.delete(
  '/health-checks/:id',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const id = assertValid(validateUuid(c.req.param('id')));
    const sekarang = nowIso();
    const berubah = await runQuery(
      c.env.DB,
      'UPDATE health_checks SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      sekarang,
      sekarang,
      id,
      userId,
    );
    if (berubah === 0) throw tidakDitemukan('Pemeriksaan');
    return balasSukses(c, { id, deleted: true, deleted_at: sekarang });
  }),
);
