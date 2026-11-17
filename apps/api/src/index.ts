import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiRouter } from "./routes/api";

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  ALLOWED_ORIGIN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS: asal diizinkan dibaca dari variabel lingkungan ALLOWED_ORIGIN.
// Nilai bawaan "*" hanya untuk tahap scaffold — tim keamanan wajib
// menguncinya ke domain produksi sebelum rilis.
// c.env bisa undefined saat app.request() dipanggil tanpa env (tes).
app.use("/api/*", async (c, next) => {
  const origin = c.env?.ALLOWED_ORIGIN ?? "*";
  return cors({ origin })(c, next);
});

app.route("/api", apiRouter);

// Rute API yang belum dikenal: 404 JSON yang konsisten.
app.notFound((c) => c.json({ success: false, error: { code: "NOT_FOUND", message: "Rute tidak ditemukan." } }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan di server." } },
    500,
  );
});

export default app;
