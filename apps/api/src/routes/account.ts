// apps/api/src/routes/account.ts
// Rute akun: profil, sesi aktif, ekspor data JSON, hapus akun —
// di belakang auth. Mengikuti docs/api-contracts.md bagian 6.
// Semua query memfilter user_id dari sesi; data pengguna lain tidak
// pernah dikembalikan (D1 tanpa RLS, kepemilikan ditegakkan di kode).
//
// Hapus akun menghapus baris anak secara eksplisit dari kode (bukan
// mengandalkan PRAGMA foreign_keys, karena D1 tidak menjamin cascade
// aktif di setiap koneksi). Skema nyata migrasi 0001 tidak punya
// foreign key antar tabel data, jadi penghapusan eksplisit adalah
// satu-satunya jalan yang bisa diandalkan.

import { Hono } from 'hono';
import {
  authMiddleware,
  getSessionId,
  getUserId,
  type AppEnv,
} from '../auth/middleware';
import { buatCookieHapusSesi } from '../auth/session';
import {
  cursorClause,
  nowIso,
  paginateRows,
  parseCursorParam,
  parseLimitParam,
  queryAll,
  queryOne,
  runQuery,
  type D1Like,
} from '../lib/db';
import {
  batasLaju,
  catatEkspor,
  detikSampaiKedaluwarsa,
} from '../lib/ratelimit';
import { assertValid, sebagaiObjek, validateString, validateUuid } from '../lib/validate';
import {
  bacaBody,
  balasSukses,
  bungkus,
  konfirmasiSalah,
  terlaluSering,
  tidakDitemukan,
  tidakValid,
} from '../lib/envelope';
import { toHealthCheckResponse, type HealthCheckRow } from './health';
import { toWifiReportResponse, type SampelRow, type WifiReportRow } from './wifi';

/** Batas baris per tabel pada ekspor (kontrak 6.6): 5.000. */
export const BATAS_EKSPOR_PER_TABEL = 5000;
/** Batas total sampel pada ekspor (5.000 laporan x 30 sampel akan sangat besar; dibatasi praktis). */
export const BATAS_EKSPOR_SAMPEL = 30_000;

interface ProfilRow {
  id: string;
  email: string;
  nama: string | null;
  dibuat_pada: string;
}

interface AiDiagnosisRow {
  id: string;
  user_id: string;
  health_check_id: string | null;
  pertanyaan: string;
  jawaban: string;
  dibuat_pada: string;
}

interface SesiRow {
  id: string;
  user_id: string;
  user_agent: string | null;
  ip_terakhir: string | null;
  dibuat_pada: string;
  expires_at: string;
}

export const accountRoutes = new Hono<AppEnv>();
// Middleware dibatasi ke prefix rute ini (lihat health.ts).
accountRoutes.use('/account*', authMiddleware);
accountRoutes.use('/account*', batasLaju);

async function ambilProfil(db: D1Like, userId: string): Promise<ProfilRow> {
  // Dua query sederhana (tanpa JOIN): users adalah sumber kebenaran
  // akun, profiles adalah cermin nama tampilan.
  const user = await queryOne<{
    id: string;
    email: string;
    nama: string | null;
    dibuat_pada: string;
  }>(db, 'SELECT id, email, nama, dibuat_pada FROM users WHERE id = ?', userId);
  if (!user) throw tidakDitemukan('Profil');
  const profil = await queryOne<{ nama: string | null }>(
    db,
    'SELECT nama FROM profiles WHERE id = ?',
    userId,
  );
  return {
    id: user.id,
    email: user.email,
    nama: profil?.nama ?? user.nama,
    dibuat_pada: user.dibuat_pada,
  };
}

// GET /account/profile — profil milik pengguna.
accountRoutes.get(
  '/account/profile',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const row = await ambilProfil(c.env.DB, userId);
    return balasSukses(c, {
      id: row.id,
      nama: row.nama,
      email: row.email,
      dibuat_pada: row.dibuat_pada,
    });
  }),
);

// PATCH /account/profile — ubah nama tampilan (profiles + users tetap sinkron).
accountRoutes.patch(
  '/account/profile',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const body = sebagaiObjek(await bacaBody(c));
    if (!body) {
      throw tidakValid('Isi permintaan tidak valid.');
    }
    const nama = assertValid(
      validateString(body.nama, 'nama', { required: true, min: 1, max: 100 }),
    );
    await ambilProfil(c.env.DB, userId);
    const sekarang = nowIso();
    await runQuery(
      c.env.DB,
      `INSERT INTO profiles (id, nama, dibuat_pada) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nama = excluded.nama`,
      userId,
      nama,
      sekarang,
    );
    await runQuery(c.env.DB, 'UPDATE users SET nama = ? WHERE id = ?', nama, userId);
    const row = await ambilProfil(c.env.DB, userId);
    return balasSukses(c, {
      id: row.id,
      nama: row.nama,
      email: row.email,
      dibuat_pada: row.dibuat_pada,
    });
  }),
);

// GET /account/sessions — daftar sesi aktif milik pengguna (terbaru dulu,
// cursor keyset K-32). user_agent/ip_terakhir diisi sejak migrasi 0004
// (K-44); sesi lama yang dibuat sebelum migrasi tetap null.
accountRoutes.get(
  '/account/sessions',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const sesiSaatIni = getSessionId(c);
    const limit = assertValid(parseLimitParam(c.req.query('limit')));
    const cursor = assertValid(parseCursorParam(c.req.query('cursor')));
    const sekarang = nowIso();
    const klausul = cursorClause(cursor);
    const rows = await queryAll<SesiRow>(
      c.env.DB,
      `SELECT id, user_id, user_agent, ip_terakhir, dibuat_pada, expires_at FROM sessions
       WHERE user_id = ? AND expires_at > ? ${klausul.sql}
       ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
      userId,
      sekarang,
      ...klausul.params,
      limit + 1,
    );
    const { items, meta } = paginateRows(rows, limit);
    return balasSukses(
      c,
      items.map((s) => ({
        id: s.id,
        saat_ini: s.id === sesiSaatIni,
        user_agent: s.user_agent ?? null,
        ip_terakhir: s.ip_terakhir ?? null,
        dibuat_pada: s.dibuat_pada,
        kedaluwarsa_pada: s.expires_at,
      })),
      200,
      { pagination: meta },
    );
  }),
);

// DELETE /account/sessions/:id — keluar dari satu sesi milik pengguna.
// Bila sesi yang dihapus adalah sesi saat ini, cookie ikut dihapus.
accountRoutes.delete(
  '/account/sessions/:id',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const sesiSaatIni = getSessionId(c);
    const id = assertValid(validateUuid(c.req.param('id')));
    const sekarang = nowIso();
    const row = await queryOne<{ id: string }>(
      c.env.DB,
      'SELECT id FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?',
      id,
      userId,
      sekarang,
    );
    if (!row) throw tidakDitemukan('Sesi');
    await runQuery(
      c.env.DB,
      'DELETE FROM sessions WHERE id = ? AND user_id = ?',
      id,
      userId,
    );
    try {
      await runQuery(
        c.env.DB,
        'DELETE FROM pin_unlocks WHERE session_id = ?',
        id,
      );
    } catch {
      // Tabel pin_unlocks belum ada bila pengguna tidak pernah memakai PIN.
    }
    if (id === sesiSaatIni) {
      c.header('Set-Cookie', buatCookieHapusSesi());
    }
    return balasSukses(c, { id, deleted: true });
  }),
);

// GET /account/export — ekspor seluruh data milik pengguna sebagai
// satu file JSON TANPA envelope (kontrak 6.6: ini berkas unduhan).
// Dibatasi 5/hari per pengguna (K-42/K-59); cek batas dilakukan
// SEBELUM query berat agar upaya ke-6 tidak membebani D1.
accountRoutes.get(
  '/account/export',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const { status, jendela } = await catatEkspor(c.env.DB, userId);
    if (!status.diizinkan) {
      throw terlaluSering(detikSampaiKedaluwarsa(jendela));
    }
    const batas = BATAS_EKSPOR_PER_TABEL;
    const profil = await ambilProfil(c.env.DB, userId);
    const kesehatan = await queryAll<HealthCheckRow>(
      c.env.DB,
      `SELECT id, user_id, skor, ringkasan, dibuat_pada, updated_at, deleted_at, sync_status
       FROM health_checks WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
      userId,
      batas + 1,
    );
    const wifi = await queryAll<WifiReportRow>(
      c.env.DB,
      `SELECT id, user_id, ssid, kecepatan_koneksi_mbps, kekuatan_sinyal, channel, dns, ping_ms, rekomendasi, kecepatan_unduh_kbps, sumber, durasi_tes_detik, dibuat_pada, updated_at, deleted_at
       FROM wifi_reports WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
      userId,
      batas + 1,
    );
    const ai = await queryAll<AiDiagnosisRow>(
      c.env.DB,
      `SELECT id, user_id, health_check_id, pertanyaan, jawaban, dibuat_pada
       FROM ai_diagnoses WHERE user_id = ? ORDER BY dibuat_pada DESC, id DESC LIMIT ?`,
      userId,
      batas + 1,
    );
    // Sampel hanya untuk laporan yang ikut diekspor (IN dengan placeholder terikat).
    const idLaporan = wifi.slice(0, batas).map((w) => w.id);
    let sampel: SampelRow[] = [];
    if (idLaporan.length > 0) {
      const placeholder = idLaporan.map(() => '?').join(', ');
      sampel = await queryAll<SampelRow>(
        c.env.DB,
        `SELECT id, wifi_report_id, detik_ke, kecepatan_kbps, dibuat_pada
         FROM wifi_sustained_samples WHERE wifi_report_id IN (${placeholder})
         ORDER BY wifi_report_id ASC, detik_ke ASC LIMIT ?`,
        ...idLaporan,
        BATAS_EKSPOR_SAMPEL + 1,
      );
    }
    const sampelPerLaporan = new Map<string, { detik_ke: number; kecepatan_kbps: number }[]>();
    for (const s of sampel.slice(0, BATAS_EKSPOR_SAMPEL)) {
      const daftar = sampelPerLaporan.get(s.wifi_report_id) ?? [];
      daftar.push({ detik_ke: s.detik_ke, kecepatan_kbps: s.kecepatan_kbps });
      sampelPerLaporan.set(s.wifi_report_id, daftar);
    }
    const terpotong =
      kesehatan.length > batas ||
      wifi.length > batas ||
      ai.length > batas ||
      sampel.length > BATAS_EKSPOR_SAMPEL;
    const tanggal = new Date().toISOString().slice(0, 10);
    const berkas = {
      format: 'dokter-hp-export',
      versi: 1,
      dieksport_pada: nowIso(),
      ...(terpotong ? { terpotong: true } : {}),
      profil: {
        id: profil.id,
        nama: profil.nama,
        email: profil.email,
        dibuat_pada: profil.dibuat_pada,
      },
      health_checks: kesehatan.slice(0, batas).map((row) => {
        const respons = toHealthCheckResponse(row);
        return {
          id: respons.id,
          skor: respons.skor,
          ringkasan: respons.ringkasan,
          dibuat_pada: respons.dibuat_pada,
          sync_status: respons.sync_status,
        };
      }),
      wifi_reports: wifi.slice(0, batas).map((row) => {
        const respons = toWifiReportResponse(row);
        return {
          id: respons.id,
          ssid: respons.ssid,
          kecepatan_koneksi_mbps: respons.kecepatan_koneksi_mbps,
          kekuatan_sinyal: respons.kekuatan_sinyal,
          channel: respons.channel,
          dns: respons.dns,
          ping_ms: respons.ping_ms,
          rekomendasi: respons.rekomendasi,
          kecepatan_unduh_kbps: respons.kecepatan_unduh_kbps,
          sumber: respons.sumber,
          durasi_tes_detik: respons.durasi_tes_detik,
          dibuat_pada: respons.dibuat_pada,
          samples: sampelPerLaporan.get(row.id) ?? [],
        };
      }),
      ai_diagnoses: ai.slice(0, batas).map((a) => ({
        id: a.id,
        health_check_id: a.health_check_id,
        pertanyaan: a.pertanyaan,
        jawaban: a.jawaban,
        dibuat_pada: a.dibuat_pada,
      })),
    };
    c.header('Content-Disposition', `attachment; filename="dokter-hp-export-${tanggal}.json"`);
    return c.json(berkas, 200);
  }),
);

// DELETE /account — hapus akun + seluruh data milik pengguna.
// Wajib konfirmasi badan { "konfirmasi": "HAPUS" } atau "DELETE" (K-26).
accountRoutes.delete(
  '/account',
  bungkus<AppEnv>(async (c) => {
    const userId = getUserId(c);
    const body = sebagaiObjek(await bacaBody(c));
    if (!body || body.konfirmasi === undefined || typeof body.konfirmasi !== 'string') {
      throw tidakValid('Teks konfirmasi wajib diisi.');
    }
    if (body.konfirmasi !== 'HAPUS' && body.konfirmasi !== 'DELETE') {
      throw konfirmasiSalah();
    }
    const profil = await ambilProfil(c.env.DB, userId);
    const db = c.env.DB;
    // Upaya aktifkan cascade (best-effort); penghapusan di bawah ini
    // tetap eksplisit agar tidak bergantung pada PRAGMA.
    try {
      await db.prepare('PRAGMA foreign_keys = ON').run();
    } catch {
      // Abaikan — penghapusan eksplisit di bawah tetap berjalan.
    }
    // 1. Sampel tes bertahan milik laporan pengguna.
    const laporan = await queryAll<{ id: string }>(
      db,
      'SELECT id FROM wifi_reports WHERE user_id = ?',
      userId,
    );
    if (laporan.length > 0) {
      const placeholder = laporan.map(() => '?').join(', ');
      await runQuery(
        db,
        `DELETE FROM wifi_sustained_samples WHERE wifi_report_id IN (${placeholder})`,
        ...laporan.map((w) => w.id),
      );
    }
    // 2. Penanda buka PIN milik sesi pengguna + penghitung gagal PIN.
    // Best-effort: kedua tabel hanya ada bila pengguna pernah memakai PIN.
    try {
      const sesi = await queryAll<{ id: string }>(
        db,
        'SELECT id FROM sessions WHERE user_id = ?',
        userId,
      );
      if (sesi.length > 0) {
        const placeholder = sesi.map(() => '?').join(', ');
        await runQuery(
          db,
          `DELETE FROM pin_unlocks WHERE session_id IN (${placeholder})`,
          ...sesi.map((s) => s.id),
        );
      }
      await runQuery(db, 'DELETE FROM pin_attempts WHERE user_id = ?', userId);
    } catch {
      // Abaikan — tabel PIN belum ada berarti tidak ada data PIN.
    }
    // 3. Diagnosis AI, laporan WiFi, pemeriksaan kesehatan, sesi.
    await runQuery(db, 'DELETE FROM ai_diagnoses WHERE user_id = ?', userId);
    await runQuery(db, 'DELETE FROM wifi_reports WHERE user_id = ?', userId);
    await runQuery(db, 'DELETE FROM health_checks WHERE user_id = ?', userId);
    await runQuery(db, 'DELETE FROM sessions WHERE user_id = ?', userId);
    // 4. Profil, lalu pengguna.
    await runQuery(db, 'DELETE FROM profiles WHERE id = ?', userId);
    const berubah = await runQuery(db, 'DELETE FROM users WHERE id = ?', userId);
    if (berubah === 0) throw tidakDitemukan('Akun');
    c.header('Set-Cookie', buatCookieHapusSesi());
    return balasSukses(c, { deleted: true, email: profil.email });
  }),
);
