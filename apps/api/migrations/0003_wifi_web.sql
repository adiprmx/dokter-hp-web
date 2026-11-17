-- Migrasi 0003: kolom web wifi_reports + tabel wifi_sustained_samples.
--
-- Migrasi 0001_init.sql hanya memuat kolom wifi_reports dari rancangan
-- Supabase APK. Kolom tambahan web dari ARCHITECTURE.md bagian 5 dan
-- docs/api-contracts.md bagian 4 (kecepatan_unduh_kbps, sumber,
-- durasi_tes_detik, updated_at, deleted_at) serta tabel sampel tes
-- bertahan 30 detik ditambahkan di sini, karena endpoint
-- /wifi-reports dan /wifi-reports/:id/samples membutuhkannya.
--
-- updated_at diisi nilai sementara saat kolom ditambahkan, lalu
-- di-backfill dari dibuat_pada untuk baris yang sudah ada (SQLite
-- tidak mengizinkan ADD COLUMN NOT NULL tanpa default).

-- ---------------------------------------------------------------------------
-- wifi_reports: kolom tambahan web.
-- ---------------------------------------------------------------------------
ALTER TABLE wifi_reports ADD COLUMN kecepatan_unduh_kbps REAL;
ALTER TABLE wifi_reports ADD COLUMN sumber TEXT NOT NULL DEFAULT 'web';
ALTER TABLE wifi_reports ADD COLUMN durasi_tes_detik INTEGER;
ALTER TABLE wifi_reports ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE wifi_reports ADD COLUMN deleted_at TEXT;

UPDATE wifi_reports SET updated_at = dibuat_pada
WHERE updated_at = '1970-01-01T00:00:00.000Z';

-- ---------------------------------------------------------------------------
-- wifi_sustained_samples: sampel per detik dari tes bertahan 30 detik.
-- detik_ke 0-29, unik per laporan (upsert pada konflik).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wifi_sustained_samples (
  id TEXT PRIMARY KEY,
  wifi_report_id TEXT NOT NULL REFERENCES wifi_reports (id) ON DELETE CASCADE,
  detik_ke INTEGER NOT NULL CHECK (detik_ke >= 0 AND detik_ke < 30),
  kecepatan_kbps REAL NOT NULL,
  dibuat_pada TEXT NOT NULL,
  UNIQUE (wifi_report_id, detik_ke)
);

CREATE INDEX IF NOT EXISTS idx_wifi_sustained_samples_report
  ON wifi_sustained_samples (wifi_report_id);
