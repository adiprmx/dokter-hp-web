import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Konfigurasi Vite untuk frontend Dokter HP Web.
// Proxy /api mengarah ke Worker lokal (wrangler dev, port 8787)
// agar pengembangan frontend dan backend berjalan berdampingan.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
