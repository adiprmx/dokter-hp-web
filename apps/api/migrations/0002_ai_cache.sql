-- Migrasi 0002: cache jawaban AI (D1 / SQLite).
-- Tabel ai_cache menyimpan jawaban Gemini agar pertanyaan yang sama
-- dapat dilayani tanpa memanggil Gemini lagi (kuota proyek 500
-- request/hari adalah limit paling ketat di stack).
--
-- pertanyaan_hash adalah SHA-256 (heksadesimal, 64 karakter) dari
-- versi konteks + id pengguna + pertanyaan yang dinormalisasi +
-- sidik jari data pemeriksaan (lihat apps/api/src/ai/cache.ts).
-- Kunci unik ini membuat pencarian cache satu baris, tanpa memindai
-- riwayat. Cache sengaja per pengguna: jawaban dapat memuat data
-- pemeriksaan penanya, sehingga tidak tepat dipakai pengguna lain.
-- TTL 7 hari ditegakkan di kode (bacaCache), bukan di skema:
-- entri kedaluwarsa tidak dipakai dan ditimpa INSERT OR REPLACE.

CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  pertanyaan_hash TEXT NOT NULL UNIQUE,
  jawaban TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_pertanyaan_hash ON ai_cache (pertanyaan_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_dibuat_pada ON ai_cache (dibuat_pada);
