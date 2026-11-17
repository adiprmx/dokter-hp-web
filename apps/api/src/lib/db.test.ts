// apps/api/src/lib/db.test.ts
// Unit test helper D1 + paginasi cursor (K-32).

import { describe, expect, it } from 'vitest';
import {
  cursorClause,
  decodeCursor,
  encodeCursor,
  newId,
  nowIso,
  paginateRows,
  parseCursorParam,
  parseLimit,
  parseLimitParam,
  queryAll,
  queryOne,
  runQuery,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from './db';
import { FakeD1 } from '../test/fake-d1';

describe('nowIso / newId', () => {
  it('menghasilkan ISO 8601 yang bisa diurai', () => {
    expect(Number.isNaN(Date.parse(nowIso()))).toBe(false);
  });

  it('menghasilkan UUID unik', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('parseLimit (longgar)', () => {
  it('memakai default bila tidak ada atau tidak valid', () => {
    expect(parseLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(parseLimit('abc')).toBe(DEFAULT_LIMIT);
    expect(parseLimit('0')).toBe(DEFAULT_LIMIT);
    expect(parseLimit('-5')).toBe(DEFAULT_LIMIT);
    expect(parseLimit('')).toBe(DEFAULT_LIMIT);
  });

  it('memotong nilai di atas maksimum', () => {
    expect(parseLimit('500')).toBe(MAX_LIMIT);
    expect(parseLimit('100')).toBe(100);
    expect(parseLimit('5')).toBe(5);
  });
});

describe('parseLimitParam / parseCursorParam (ketat, kontrak 0.6)', () => {
  it('limit: default 20, diklem ke 1-100, bukan angka ditolak', () => {
    expect(parseLimitParam(undefined)).toEqual({ ok: true, value: 20 });
    expect(parseLimitParam('5')).toEqual({ ok: true, value: 5 });
    expect(parseLimitParam('0')).toEqual({ ok: true, value: 1 });
    expect(parseLimitParam('500')).toEqual({ ok: true, value: 100 });
    expect(parseLimitParam('abc').ok).toBe(false);
    expect(parseLimitParam('').ok).toBe(false);
    expect(parseLimitParam('10.5').ok).toBe(false);
  });

  it('cursor: tidak ada berarti halaman pertama, cursor cacat ditolak', () => {
    expect(parseCursorParam(undefined)).toEqual({ ok: true, value: null });
    expect(parseCursorParam('')).toEqual({ ok: true, value: null });
    const cursor = { dibuat_pada: '2026-11-17T10:00:00.000Z', id: 'abc-123' };
    expect(parseCursorParam(encodeCursor(cursor))).toEqual({ ok: true, value: cursor });
    expect(parseCursorParam('bukan-base64!!!').ok).toBe(false);
    expect(parseCursorParam(encodeCursor({ dibuat_pada: '', id: 'x' })).ok).toBe(false);
  });
});

describe('encodeCursor / decodeCursor', () => {
  it('bolak-balik tanpa kehilangan data', () => {
    const cursor = { dibuat_pada: '2026-11-17T10:00:00.000Z', id: 'abc-123' };
    const kode = encodeCursor(cursor);
    expect(typeof kode).toBe('string');
    expect(kode).not.toContain('+');
    expect(kode).not.toContain('/');
    expect(kode).not.toContain('=');
    expect(decodeCursor(kode)).toEqual(cursor);
  });

  it('mengembalikan null untuk cursor rusak atau kosong', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('bukan-base64!!!')).toBeNull();
    expect(decodeCursor(encodeCursor({ dibuat_pada: '', id: 'x' }))).toBeNull();
  });
});

describe('cursorClause', () => {
  it('mengembalikan fragmen kosong tanpa cursor', () => {
    expect(cursorClause(null)).toEqual({ sql: '', params: [] });
  });

  it('mengembalikan fragmen keyset dengan 3 parameter', () => {
    const klausul = cursorClause({ dibuat_pada: '2026-11-17T10:00:00.000Z', id: 'abc' });
    expect(klausul.sql).toContain('dibuat_pada < ?');
    expect(klausul.sql).toContain('dibuat_pada = ?');
    expect(klausul.sql).toContain('id < ?');
    expect(klausul.params).toEqual(['2026-11-17T10:00:00.000Z', '2026-11-17T10:00:00.000Z', 'abc']);
  });
});

describe('paginateRows (cursor)', () => {
  const buat = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${String(i).padStart(2, '0')}`,
      dibuat_pada: `2026-11-17T10:${String(59 - i).padStart(2, '0')}:00.000Z`,
    }));

  it('memotong ke limit dan memberi next_cursor bila masih ada halaman', () => {
    const { items, meta } = paginateRows(buat(11), 10);
    expect(items).toHaveLength(10);
    expect(meta.has_more).toBe(true);
    expect(meta.limit).toBe(10);
    expect(meta.next_cursor).not.toBeNull();
    expect(decodeCursor(meta.next_cursor ?? undefined)).toEqual({
      dibuat_pada: '2026-11-17T10:50:00.000Z',
      id: 'id-09',
    });
  });

  it('next_cursor null dan has_more false di halaman terakhir', () => {
    const { items, meta } = paginateRows(buat(5), 10);
    expect(items).toHaveLength(5);
    expect(meta.has_more).toBe(false);
    expect(meta.next_cursor).toBeNull();
  });

  it('tepat sebanyak limit berarti tidak ada halaman lagi', () => {
    const { meta } = paginateRows(buat(10), 10);
    expect(meta.has_more).toBe(false);
    expect(meta.next_cursor).toBeNull();
  });
});

describe('queryAll / queryOne / runQuery (dengan FakeD1)', () => {
  it('menyisipkan, membaca, dan memperbarui baris', async () => {
    const db = new FakeD1({ health_checks: [] });
    const berubah = await runQuery(
      db,
      'INSERT INTO health_checks (id, user_id, skor, ringkasan, dibuat_pada, updated_at, deleted_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
      'id-1',
      'user-1',
      80,
      '{}',
      '2026-11-17T10:00:00.000Z',
      '2026-11-17T10:00:00.000Z',
      'synced',
    );
    expect(berubah).toBe(1);
    const satu = await queryOne<{ skor: number }>(
      db,
      'SELECT id, skor FROM health_checks WHERE id = ? AND user_id = ?',
      'id-1',
      'user-1',
    );
    expect(satu?.skor).toBe(80);
    const tidakAda = await queryOne(
      db,
      'SELECT id FROM health_checks WHERE id = ? AND user_id = ?',
      'id-1',
      'user-lain',
    );
    expect(tidakAda).toBeNull();
    const semua = await queryAll(
      db,
      'SELECT id FROM health_checks WHERE user_id = ? AND deleted_at IS NULL ORDER BY dibuat_pada DESC, id DESC LIMIT ?',
      'user-1',
      10,
    );
    expect(semua).toHaveLength(1);
    const hapus = await runQuery(
      db,
      'UPDATE health_checks SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      '2026-11-17T11:00:00.000Z',
      '2026-11-17T11:00:00.000Z',
      'id-1',
      'user-1',
    );
    expect(hapus).toBe(1);
    const setelah = await queryAll(
      db,
      'SELECT id FROM health_checks WHERE user_id = ? AND deleted_at IS NULL',
      'user-1',
    );
    expect(setelah).toHaveLength(0);
  });

  it('cursor keyset memotong halaman dengan benar (tanpa OFFSET)', async () => {
    const db = new FakeD1({
      health_checks: Array.from({ length: 5 }, (_, i) => ({
        id: `id-${i}`,
        user_id: 'user-1',
        skor: 50 + i,
        ringkasan: '{}',
        dibuat_pada: `2026-11-17T10:0${i}:00.000Z`,
        updated_at: '2026-11-17T10:00:00.000Z',
        deleted_at: null,
        sync_status: 'synced',
      })),
    });
    const halaman1 = await queryAll<{ id: string; dibuat_pada: string }>(
      db,
      'SELECT id, dibuat_pada FROM health_checks WHERE user_id = ? ORDER BY dibuat_pada DESC, id DESC LIMIT ?',
      'user-1',
      3,
    );
    expect(halaman1.map((r) => r.id)).toEqual(['id-4', 'id-3', 'id-2']);
    const klausul = cursorClause({
      dibuat_pada: halaman1[2]?.dibuat_pada as string,
      id: halaman1[2]?.id as string,
    });
    const halaman2 = await queryAll<{ id: string }>(
      db,
      `SELECT id, dibuat_pada FROM health_checks WHERE user_id = ? ${klausul.sql} ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
      'user-1',
      ...klausul.params,
      3,
    );
    expect(halaman2.map((r) => r.id)).toEqual(['id-1', 'id-0']);
  });
});
