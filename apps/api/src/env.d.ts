interface Env {
  DB: D1Database;
  KV: KVNamespace;
  // Asal frontend yang diizinkan CORS (misal domain Pages produksi).
  // Kosong berarti semua asal diizinkan — tim keamanan wajib
  // mengunci nilai ini sebelum rilis publik.
  ALLOWED_ORIGIN?: string;
}
