interface Env {
  DB: D1Database;
  KV: KVNamespace;
  // Asal frontend yang diizinkan CORS (misal domain Pages produksi).
  // Produksi WAJIB mengaturnya (K-49); kosong berarti echo origin
  // (hanya untuk pengembangan lokal).
  ALLOWED_ORIGIN?: string;
  // Google OAuth (secret Worker via `wrangler secret put`).
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
  // Diagnosis AI (GEMINI_API_KEY secret Worker; GEMINI_MODEL
  // variabel biasa, bawaan gemini-3.5-flash-lite).
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}
