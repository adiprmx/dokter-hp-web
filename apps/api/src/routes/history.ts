// apps/api/src/routes/history.ts
// Riwayat gabungan (pemeriksaan kesehatan + laporan WiFi + diagnosis AI)
// — di belakang auth. Semua query memfilter user_id dari sesi; data
// pengguna lain tidak pernah dikembalikan (D1 tanpa RLS, kepemilikan
// ditegakkan di kode).
//
// Endpoint ini tambahan di luar docs/api-contracts.md (kontrak tidak
// mendefinisikan /history — frontend menggabungkan ketiga daftar di
// client). Bentuk respons mengikuti konvensi kontrak: envelope standar,
// paginasi offset dengan meta.pagination, dan kode galat kontrak.
//
// Paginasi gabungan: tiap jenis diambil sebanyak offset+limit, lalu
// digabung, diurutkan (terbaru dulu), dan dipotong di kode.

import { Hono } from 'hono';
import { authMiddleware, getUserId, type AppEnv } from '../auth/middleware';
import {
  buatPaginationMeta,
  nowIso,
  parseLimitParam,
  parseOffsetParam,
  queryAll,
  queryTotal,
  runQuery,
  type D1Like,
} from '../lib/db';
import {
  assertValid,
  JENIS_RIWAYAT,
  validateJenisRiwayat,
  validateUuid,
  type JenisRiwayat,
} from '../lib/validate';
import { balasSukses, bungkus, tidakDitemukan, tidakValid } from '../lib/envelope';
import { toHealthCheckResponse, type HealthCheckRow } from './health';
import { toWifiReportResponse, type WifiReportRow } from './wifi';

export interface ItemRiwayat {
  jenis: JenisRiwayat;
  id: string;
  dibuat_pada: string;
  data: Record<string, unknown>;
}

interface AiDiagnosisRow {
  id: string;
  user_id: string;
  health_check_id: string | null;
  pertanyaan: string;
  jawaban: string;
  dibuat_pada: string;
}

export const historyRoutes = new Hono<AppEnv>();
historyRoutes.use(authMiddleware);

async function ambilKesehatan(
  db: D1Like,
  userId: string,
  ambil: number,
): Promise<ItemRiwayat[]> {
  const rows = await queryAll<HealthCheckRow>(
    db,
    `SELECT id, user_id, skor, ringkasan, dibuat_pada, updated_at, deleted_at, sync_status
     FROM health_checks WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
    userId,
    ambil,
  );
  return rows.map((row) => {
    const respons = toHealthCheckResponse(row);
    return {
      jenis: 'kesehatan' as const,
      id: row.id,
      dibuat_pada: row.dibuat_pada,
      data: {
        skor: respons.skor,
        ringkasan: respons.ringkasan,
        sync_status: respons.sync_status,
      },
    };
  });
}

async function ambilWifi(
  db: D1Like,
  userId: string,
  ambil: number,
): Promise<ItemRiwayat[]> {
  const rows = await queryAll<WifiReportRow>(
    db,
    `SELECT id, user_id, ssid, kecepatan_koneksi_mbps, kekuatan_sinyal, channel, dns, ping_ms, rekomendasi, kecepatan_unduh_kbps, sumber, durasi_tes_detik, dibuat_pada, updated_at, deleted_at
     FROM wifi_reports WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
    userId,
    ambil,
  );
  return rows.map((row) => {
    const respons = toWifiReportResponse(row);
    return {
      jenis: 'wifi' as const,
      id: row.id,
      dibuat_pada: row.dibuat_pada,
      data: {
        ssid: respons.ssid,
        kecepatan_koneksi_mbps: respons.kecepatan_koneksi_mbps,
        kekuatan_sinyal: respons.kekuatan_sinyal,
        kecepatan_unduh_kbps: respons.kecepatan_unduh_kbps,
        ping_ms: respons.ping_ms,
        rekomendasi: respons.rekomendasi,
        sumber: respons.sumber,
      },
    };
  });
}

async function ambilAi(
  db: D1Like,
  userId: string,
  ambil: number,
): Promise<ItemRiwayat[]> {
  const rows = await queryAll<AiDiagnosisRow>(
    db,
    `SELECT id, user_id, health_check_id, pertanyaan, jawaban, dibuat_pada
     FROM ai_diagnoses WHERE user_id = ?
     ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
    userId,
    ambil,
  );
  return rows.map((row) => ({
    jenis: 'ai' as const,
    id: row.id,
    dibuat_pada: row.dibuat_pada,
    data: {
      health_check_id: row.health_check_id,
      pertanyaan: row.pertanyaan,
      jawaban: row.jawaban,
    },
  }));
}

/** Urutan gabungan: terbaru dulu, id sebagai penentu seri. */
function urutGabungan(a: ItemRiwayat, b: ItemRiwayat): number {
  if (a.dibuat_pada !== b.dibuat_pada) {
    return a.dibuat_pada < b.dibuat_pada ? 1 : -1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

// GET /history — riwayat gabungan (?jenis=kesehatan|wifi|ai|semua, limit, offset).
historyRoutes.get(
  '/history',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const limit = assertValid(parseLimitParam(c.req.query('limit')));
    const offset = assertValid(parseOffsetParam(c.req.query('offset')));
    const jenisParam = c.req.query('jenis');
    let jenis: JenisRiwayat[] = [...JENIS_RIWAYAT];
    if (jenisParam !== undefined && jenisParam !== 'semua') {
      const satu = assertValid(validateJenisRiwayat(jenisParam));
      jenis = satu ? [satu] : [...JENIS_RIWAYAT];
    }
    const ambil = offset + limit;
    const tugas: Promise<ItemRiwayat[]>[] = [];
    const hitung: Promise<number>[] = [];
    if (jenis.includes('kesehatan')) {
      tugas.push(ambilKesehatan(c.env.DB, userId, ambil));
      hitung.push(
        queryTotal(
          c.env.DB,
          'SELECT COUNT(*) AS jumlah FROM health_checks WHERE user_id = ? AND deleted_at IS NULL',
          userId,
        ),
      );
    }
    if (jenis.includes('wifi')) {
      tugas.push(ambilWifi(c.env.DB, userId, ambil));
      hitung.push(
        queryTotal(
          c.env.DB,
          'SELECT COUNT(*) AS jumlah FROM wifi_reports WHERE user_id = ? AND deleted_at IS NULL',
          userId,
        ),
      );
    }
    if (jenis.includes('ai')) {
      tugas.push(ambilAi(c.env.DB, userId, ambil));
      hitung.push(
        queryTotal(
          c.env.DB,
          'SELECT COUNT(*) AS jumlah FROM ai_diagnoses WHERE user_id = ?',
          userId,
        ),
      );
    }
    const [hasil, jumlah] = await Promise.all([
      Promise.all(tugas),
      Promise.all(hitung),
    ]);
    const total = jumlah.reduce((a, b) => a + b, 0);
    const gabungan = hasil.flat().sort(urutGabungan);
    const halaman = gabungan.slice(offset, offset + limit);
    return balasSukses(c, halaman, 200, {
      pagination: buatPaginationMeta(limit, offset, total),
      jenis: jenisParam ?? 'semua',
    });
  }),
);

// DELETE /history/:jenis/:id — hapus satu entri riwayat.
// kesehatan/wifi: soft-delete. ai: hapus permanen (tabel tanpa deleted_at).
historyRoutes.delete(
  '/history/:jenis/:id',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const jenis = assertValid(validateJenisRiwayat(c.req.param('jenis')));
    const id = assertValid(validateUuid(c.req.param('id')));
    if (!jenis) throw tidakValid('Jenis riwayat tidak valid.');
    const sekarang = nowIso();
    let berubah = 0;
    let deletedAt: string | null = null;
    if (jenis === 'kesehatan') {
      berubah = await runQuery(
        c.env.DB,
        'UPDATE health_checks SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        sekarang,
        sekarang,
        id,
        userId,
      );
      deletedAt = sekarang;
    } else if (jenis === 'wifi') {
      berubah = await runQuery(
        c.env.DB,
        'UPDATE wifi_reports SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        sekarang,
        sekarang,
        id,
        userId,
      );
      deletedAt = sekarang;
    } else {
      berubah = await runQuery(
        c.env.DB,
        'DELETE FROM ai_diagnoses WHERE id = ? AND user_id = ?',
        id,
        userId,
      );
    }
    if (berubah === 0) throw tidakDitemukan('Entri riwayat');
    return balasSukses(c, { id, jenis, deleted: true, deleted_at: deletedAt });
  }),
);
