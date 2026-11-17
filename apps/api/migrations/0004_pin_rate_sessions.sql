-- Migrasi 0004 Dokter HP Web (D1 / SQLite) — Wave 3b.
-- Tiga hal:
--   1. Memformalkan tabel PIN (K-48): pin_attempts + pin_unlocks.
--      SQL IDENTIK dengan pastikanTabelPin di src/auth/pin.ts
--      (pembuatan malas di kode tetap dipertahankan sebagai
--      cadangan untuk database yang belum dimigrasi).
--   2. Kolom sessions.user_agent + sessions.ip_terakhir (K-44),
--      diisi saat sesi dibuat lewat callback Google; dipakai
--      daftar sesi aktif di Pengaturan.
--   3. Tabel rate_limits (K-02/K-42): rate limit ekspor 5/hari
--      + batas kontrak bagian 0.7 (tulis 60/menit, baca
--      300/menit, OAuth 10/menit per IP). Skema sesuai
--      ARCHITECTURE.md bagian 5.
-- Semua waktu disimpan sebagai teks ISO 8601 (UTC).

-- ---------------------------------------------------------------------------
-- pin_attempts: penghitung percobaan PIN salah per pengguna.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pin_attempts (
  user_id TEXT PRIMARY KEY,
  gagal_berturut INTEGER NOT NULL DEFAULT 0,
  terkunci_sampai TEXT
);

-- ---------------------------------------------------------------------------
-- pin_unlocks: penanda sesi yang sudah dibuka dengan PIN.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pin_unlocks (
  session_id TEXT PRIMARY KEY,
  dibuka_pada TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- sessions: tambah user_agent + ip_terakhir (K-44).
-- ---------------------------------------------------------------------------
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN ip_terakhir TEXT;

-- ---------------------------------------------------------------------------
-- rate_limits: hitungan rate limit per kunci "cakupan:subjek:jendela".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  kunci TEXT PRIMARY KEY,
  jumlah INTEGER NOT NULL DEFAULT 0,
  jendela_mulai TEXT NOT NULL,
  kedaluwarsa_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_kedaluwarsa ON rate_limits (kedaluwarsa_pada);
