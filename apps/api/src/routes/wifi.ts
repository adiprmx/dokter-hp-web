// apps/api/src/routes/wifi.ts
// Rute laporan WiFi (wifi_reports) + sampel tes bertahan
// (wifi_sustained_samples) — di belakang auth.
// Mengikuti docs/api-contracts.md bagian 4.
// Semua query memfilter user_id dari sesi; data pengguna lain tidak
// pernah dikembalikan (D1 tanpa RLS, kepemilikan ditegakkan di kode).
//
// Kolom web wifi_reports (kecepatan_unduh_kbps, sumber,
// durasi_tes_detik, updated_at, deleted_at) dan tabel
// wifi_sustained_samples ditambahkan migrasi 0003_wifi_web.sql —
// migrasi 0001_init.sql belum memuatnya.

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
  type D1Like,
} from '../lib/db';
import { batasLaju } from '../lib/ratelimit';
import {
  assertValid,
  MAX_SAMPEL_PER_LAPORAN,
  sebagaiObjek,
  validateChannel,
  validateDurasiTes,
  validateInteger,
  validateKekuatanSinyal,
  validateNumber,
  validateSamples,
  validateString,
  validateSumber,
  validateUuid,
} from '../lib/validate';
import { ApiError, bacaBody, balasSukses, bungkus, tidakDitemukan, tidakValid } from '../lib/envelope';

export interface WifiReportRow {
  id: string;
  user_id: string;
  ssid: string | null;
  kecepatan_koneksi_mbps: number | null;
  kekuatan_sinyal: string | null;
  channel: number | null;
  dns: string | null;
  ping_ms: number | null;
  rekomendasi: string | null;
  kecepatan_unduh_kbps: number | null;
  sumber: string;
  durasi_tes_detik: number | null;
  dibuat_pada: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WifiReportResponse {
  id: string;
  user_id: string;
  ssid: string | null;
  kecepatan_koneksi_mbps: number | null;
  kekuatan_sinyal: string | null;
  channel: number | null;
  dns: string | null;
  ping_ms: number | null;
  rekomendasi: string | null;
  kecepatan_unduh_kbps: number | null;
  sumber: string;
  durasi_tes_detik: number | null;
  dibuat_pada: string;
  updated_at: string;
  deleted_at: string | null;
  samples?: SampelResponse[];
}

export interface SampelRow {
  id: string;
  wifi_report_id: string;
  detik_ke: number;
  kecepatan_kbps: number;
  dibuat_pada: string;
}

export interface SampelResponse {
  detik_ke: number;
  kecepatan_kbps: number;
}

const KOLOM_LAPORAN =
  'id, user_id, ssid, kecepatan_koneksi_mbps, kekuatan_sinyal, channel, dns, ping_ms, rekomendasi, kecepatan_unduh_kbps, sumber, durasi_tes_detik, dibuat_pada, updated_at, deleted_at';

/** Mengubah baris D1 menjadi objek respons kontrak. */
export function toWifiReportResponse(row: WifiReportRow): WifiReportResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    ssid: row.ssid,
    kecepatan_koneksi_mbps: row.kecepatan_koneksi_mbps,
    kekuatan_sinyal: row.kekuatan_sinyal,
    channel: row.channel,
    dns: row.dns,
    ping_ms: row.ping_ms,
    rekomendasi: row.rekomendasi,
    kecepatan_unduh_kbps: row.kecepatan_unduh_kbps,
    sumber: row.sumber,
    durasi_tes_detik: row.durasi_tes_detik,
    dibuat_pada: row.dibuat_pada,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export const wifiRoutes = new Hono<AppEnv>();
// Middleware dibatasi ke prefix rute ini (lihat health.ts).
wifiRoutes.use('/wifi-reports*', authMiddleware);
wifiRoutes.use('/wifi-reports*', batasLaju);

/** Memastikan laporan ada dan milik pengguna; mengembalikan barisnya atau melempar 404. */
async function ambilLaporanMilik(
  db: D1Like,
  reportId: string,
  userId: string,
): Promise<WifiReportRow> {
  const row = await queryOne<WifiReportRow>(
    db,
    `SELECT ${KOLOM_LAPORAN} FROM wifi_reports WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    reportId,
    userId,
  );
  if (!row) throw tidakDitemukan('Laporan WiFi');
  return row;
}

async function ambilSampel(db: D1Like, reportId: string): Promise<SampelResponse[]> {
  const sampel = await queryAll<SampelRow>(
    db,
    'SELECT id, wifi_report_id, detik_ke, kecepatan_kbps, dibuat_pada FROM wifi_sustained_samples WHERE wifi_report_id = ? ORDER BY detik_ke ASC',
    reportId,
  );
  return sampel.map((s) => ({ detik_ke: s.detik_ke, kecepatan_kbps: s.kecepatan_kbps }));
}

// POST /wifi-reports — menyimpan laporan WiFi baru.
wifiRoutes.post(
  '/wifi-reports',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const body = sebagaiObjek(await bacaBody(c));
    if (!body) {
      throw tidakValid('Isi permintaan tidak valid.');
    }
    const ssid = assertValid(validateString(body.ssid, 'ssid', { max: 32 }));
    const kecepatanKoneksi = assertValid(
      validateNumber(body.kecepatan_koneksi_mbps, 'kecepatan_koneksi_mbps', {
        minExclusive: 0,
        max: 10_000,
      }),
    );
    const kekuatanSinyal = assertValid(validateKekuatanSinyal(body.kekuatan_sinyal));
    const channel = assertValid(validateChannel(body.channel));
    const dns = assertValid(validateString(body.dns, 'dns', { max: 64 }));
    const pingMs = assertValid(
      validateInteger(body.ping_ms, 'ping_ms', { min: 0, max: 60_000 }),
    );
    const rekomendasi = assertValid(
      validateString(body.rekomendasi, 'rekomendasi', { max: 2000 }),
    );
    const kecepatanUnduh = assertValid(
      validateNumber(body.kecepatan_unduh_kbps, 'kecepatan_unduh_kbps', {
        min: 0,
        max: 1_000_000,
      }),
    );
    const sumber = assertValid(validateSumber(body.sumber)) ?? 'web';
    const durasiTes = assertValid(validateDurasiTes(body.durasi_tes_detik));
    if (kecepatanUnduh === null && pingMs === null) {
      throw tidakValid('Laporan harus memiliki hasil ukur kecepatan unduh atau latensi.');
    }
    const id = newId();
    const sekarang = nowIso();
    await runQuery(
      c.env.DB,
      `INSERT INTO wifi_reports (id, user_id, ssid, kecepatan_koneksi_mbps, kekuatan_sinyal, channel, dns, ping_ms, rekomendasi, kecepatan_unduh_kbps, sumber, durasi_tes_detik, dibuat_pada, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      id,
      userId,
      ssid,
      kecepatanKoneksi,
      kekuatanSinyal,
      channel,
      dns,
      pingMs,
      rekomendasi,
      kecepatanUnduh,
      sumber,
      durasiTes,
      sekarang,
      sekarang,
    );
    const row = await queryOne<WifiReportRow>(
      c.env.DB,
      `SELECT ${KOLOM_LAPORAN} FROM wifi_reports WHERE id = ? AND user_id = ?`,
      id,
      userId,
    );
    if (!row) throw tidakDitemukan('Laporan WiFi');
    return balasSukses(c, toWifiReportResponse(row), 201);
  }),
);

// GET /wifi-reports — daftar milik pengguna, terbaru dulu (cursor keyset, K-32).
wifiRoutes.get(
  '/wifi-reports',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const limit = assertValid(parseLimitParam(c.req.query('limit')));
    const cursor = assertValid(parseCursorParam(c.req.query('cursor')));
    const filterSumber =
      c.req.query('sumber') === undefined
        ? null
        : assertValid(validateSumber(c.req.query('sumber')));
    const params: unknown[] = [userId];
    let where = 'WHERE user_id = ? AND deleted_at IS NULL';
    if (filterSumber) {
      where += ' AND sumber = ?';
      params.push(filterSumber);
    }
    const klausul = cursorClause(cursor);
    const rows = await queryAll<WifiReportRow>(
      c.env.DB,
      `SELECT ${KOLOM_LAPORAN} FROM wifi_reports ${where} ${klausul.sql} ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
      ...params,
      ...klausul.params,
      limit + 1,
    );
    const { items, meta } = paginateRows(rows, limit);
    return balasSukses(c, items.map(toWifiReportResponse), 200, {
      pagination: meta,
    });
  }),
);

// GET /wifi-reports/:id — satu laporan milik pengguna + sampel tes bertahan bila ada.
wifiRoutes.get(
  '/wifi-reports/:id',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const id = assertValid(validateUuid(c.req.param('id')));
    const row = await ambilLaporanMilik(c.env.DB, id, userId);
    const respons = toWifiReportResponse(row);
    respons.samples = await ambilSampel(c.env.DB, id);
    return balasSukses(c, respons);
  }),
);

// POST /wifi-reports/:id/samples — menyimpan sampel tes bertahan (maks 30 per laporan).
// Mengirim ulang detik yang sama menimpa nilai lama (upsert), bukan galat.
wifiRoutes.post(
  '/wifi-reports/:id/samples',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const id = assertValid(validateUuid(c.req.param('id')));
    const body = sebagaiObjek(await bacaBody(c));
    if (!body) {
      throw tidakValid('Isi permintaan tidak valid.');
    }
    const sampelBaru = assertValid(validateSamples(body.samples));
    const laporan = await ambilLaporanMilik(c.env.DB, id, userId);
    if (laporan.durasi_tes_detik !== 30) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Sampel hanya bisa dikirim untuk laporan tes bertahan 30 detik.',
      );
    }
    const sudahAda = await queryAll<{ detik_ke: number }>(
      c.env.DB,
      'SELECT detik_ke FROM wifi_sustained_samples WHERE wifi_report_id = ?',
      id,
    );
    const gabungan = new Set<number>(sudahAda.map((s) => s.detik_ke));
    for (const sampel of sampelBaru) gabungan.add(sampel.detik_ke);
    if (gabungan.size > MAX_SAMPEL_PER_LAPORAN) {
      throw tidakValid(
        `Laporan ini sudah punya ${sudahAda.length} sampel, maksimal ${MAX_SAMPEL_PER_LAPORAN} sampel per laporan.`,
      );
    }
    const sekarang = nowIso();
    for (const sampel of sampelBaru) {
      await runQuery(
        c.env.DB,
        `INSERT OR REPLACE INTO wifi_sustained_samples (id, wifi_report_id, detik_ke, kecepatan_kbps, dibuat_pada)
         VALUES (?, ?, ?, ?, ?)`,
        newId(),
        id,
        sampel.detik_ke,
        sampel.kecepatan_kbps,
        sekarang,
      );
    }
    return balasSukses(c, {
      wifi_report_id: id,
      disimpan: sampelBaru.length,
      total_sampel: gabungan.size,
    });
  }),
);

// GET /wifi-reports/:id/samples — daftar sampel tes bertahan milik pengguna
// (endpoint #29, kontrak bagian 4.6).
wifiRoutes.get(
  '/wifi-reports/:id/samples',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const id = assertValid(validateUuid(c.req.param('id')));
    await ambilLaporanMilik(c.env.DB, id, userId);
    return balasSukses(c, await ambilSampel(c.env.DB, id));
  }),
);

// DELETE /wifi-reports/:id — soft-delete (deleted_at diisi; sampel ikut tersembunyi lewat laporan).
wifiRoutes.delete(
  '/wifi-reports/:id',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const id = assertValid(validateUuid(c.req.param('id')));
    const sekarang = nowIso();
    const berubah = await runQuery(
      c.env.DB,
      'UPDATE wifi_reports SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      sekarang,
      sekarang,
      id,
      userId,
    );
    if (berubah === 0) throw tidakDitemukan('Laporan WiFi');
    return balasSukses(c, { id, deleted: true, deleted_at: sekarang });
  }),
);
