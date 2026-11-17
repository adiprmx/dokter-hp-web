-- Migrasi awal Dokter HP Web (D1 / SQLite).
-- Skema kompatibel Supabase (nama tabel dan kolom sama dengan
-- rancangan backend APK) agar sinkronisasi data tetap selaras.
-- Semua waktu disimpan sebagai teks ISO 8601 (UTC).
-- ID memakai TEXT (UUID v4) agar sama di D1 dan Supabase.

-- ---------------------------------------------------------------------------
-- profiles: profil pengguna aplikasi.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  nama TEXT,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_dibuat_pada ON profiles (dibuat_pada);

-- ---------------------------------------------------------------------------
-- health_checks: hasil pemeriksaan kesehatan HP.
-- ringkasan disimpan sebagai JSON (teks).
-- deleted_at NULL berarti baris aktif (soft delete untuk sinkronisasi).
-- sync_status: pending | synced | failed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skor INTEGER NOT NULL CHECK (skor BETWEEN 0 AND 100),
  ringkasan TEXT,
  dibuat_pada TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_health_checks_user_id ON health_checks (user_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_dibuat_pada ON health_checks (dibuat_pada);

-- ---------------------------------------------------------------------------
-- wifi_reports: laporan pengukuran jaringan WiFi.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wifi_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ssid TEXT,
  kecepatan_koneksi_mbps REAL,
  kekuatan_sinyal TEXT,
  channel INTEGER,
  dns TEXT,
  ping_ms INTEGER,
  rekomendasi TEXT,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wifi_reports_user_id ON wifi_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_wifi_reports_dibuat_pada ON wifi_reports (dibuat_pada);

-- ---------------------------------------------------------------------------
-- ai_diagnoses: riwayat tanya-jawab diagnosis AI.
-- health_check_id boleh NULL bila pertanyaan tidak terikat pemeriksaan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_diagnoses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  health_check_id TEXT,
  pertanyaan TEXT NOT NULL,
  jawaban TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_user_id ON ai_diagnoses (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_dibuat_pada ON ai_diagnoses (dibuat_pada);
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_health_check_id ON ai_diagnoses (health_check_id);

-- ---------------------------------------------------------------------------
-- users: akun pengguna web (login email + PIN opsional).
-- pin_hash dan pin_salt NULL bila pengguna belum mengatur PIN.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nama TEXT,
  provider TEXT NOT NULL,
  pin_hash TEXT,
  pin_salt TEXT,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_dibuat_pada ON users (dibuat_pada);

-- ---------------------------------------------------------------------------
-- sessions: sesi login. Hanya hash token yang disimpan, bukan token mentah.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
