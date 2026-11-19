// Build produksi KANONIS: menyuntik VITE_API_BASE_URL origin produksi
// lalu menjalankan `npm run build` (yang otomatis menjalankan guard
// prebuild + gate bundle postbuild). Satu-satunya tempat nilai origin
// produksi ditulis adalah scripts/api-base-url.mjs — CI dan docs
// memanggil script ini, bukan menyalin URL.
import { spawnSync } from "node:child_process";
import { PROD_API_ORIGIN, webRoot } from "./api-base-url.mjs";

const sudahAda = process.env.VITE_API_BASE_URL;
if (sudahAda !== undefined && sudahAda !== PROD_API_ORIGIN) {
  console.error(
    `PERINGATAN build:prod: VITE_API_BASE_URL sudah diatur ke ${JSON.stringify(sudahAda)} — ditimpa origin produksi ${PROD_API_ORIGIN}.`,
  );
}
console.log(`build:prod: VITE_API_BASE_URL=${PROD_API_ORIGIN}`);

const hasil = spawnSync("npm", ["run", "build"], {
  cwd: webRoot,
  env: { ...process.env, VITE_API_BASE_URL: PROD_API_ORIGIN },
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (hasil.error) {
  console.error(
    `GALAT build:prod: gagal menjalankan npm run build: ${hasil.error.message}`,
  );
  process.exit(1);
}
process.exit(hasil.status ?? 1);
