interface Env {
  DB: D1Database;
  KV: KVNamespace;
  // Asal frontend yang diizinkan CORS (misal domain Pages produksi),
  // dipisah koma bila lebih dari satu (K-73c). Produksi WAJIB
  // mengaturnya (K-49); bila tidak diatur, CORS FAIL-CLOSED — hanya
  // origin loopback dan sama-host yang diizinkan (K-73a).
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
  // Pepper HMAC-SHA256 untuk hash PIN (secret Worker via
  // `wrangler secret put`; fail-closed bila tidak diatur — K-71).
  // Pengembangan lokal memakai dummy di .dev.vars (lihat deploy.md).
  PIN_PEPPER?: string;
}
