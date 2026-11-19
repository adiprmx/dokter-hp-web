// Gate isi bundle (hook npm `postbuild`): memastikan origin API yang
// dikonfigurasi BENAR-BENAR tertanam di dist/assets/*.js. GAGAL bila:
// - VITE_API_BASE_URL tidak valid (tidak ada origin yang bisa diverifikasi),
// - dist/assets tidak ada, atau
// - origin tidak muncul sama sekali di bundle.
// Fail-closed: keraguan apa pun = exit 1, dist tidak boleh di-deploy.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  kesalahanApiBaseUrl,
  muatApiBaseUrl,
  webRoot,
} from "./api-base-url.mjs";

function gagal(pesan) {
  console.error(`GALAT GATE BUNDLE: ${pesan}`);
  process.exit(1);
}

const nilai = muatApiBaseUrl();
const galat = kesalahanApiBaseUrl(nilai);
if (galat) {
  gagal(
    `tidak bisa memverifikasi bundle — VITE_API_BASE_URL ${galat}. ` +
      `Jalankan gate ini lewat \`npm run build\` / \`npm run build:prod\`.`,
  );
}
const origin = new URL(nilai).origin;

const dirAset = join(webRoot, "dist", "assets");
if (!existsSync(dirAset)) {
  gagal(`direktori ${dirAset} tidak ditemukan — build mungkin gagal / belum jalan.`);
}
const berkasJs = readdirSync(dirAset).filter((nama) => nama.endsWith(".js"));
if (berkasJs.length === 0) {
  gagal(`tidak ada berkas *.js di ${dirAset}.`);
}
let kemunculan = 0;
let berkasMengandung = 0;
for (const nama of berkasJs) {
  const isi = readFileSync(join(dirAset, nama), "utf8");
  const hitung = isi.split(origin).length - 1;
  if (hitung > 0) {
    berkasMengandung += 1;
    kemunculan += hitung;
  }
}
if (kemunculan === 0) {
  gagal(
    `origin API ${origin} TIDAK DITEMUKAN di ${berkasJs.length} berkas JS ` +
      `dist/assets — bundle dibangun tanpa VITE_API_BASE_URL dan AKAN ` +
      `memakai jalur relatif /api yang 404 di Pages. JANGAN deploy dist ini.`,
  );
}
console.log(
  `Gate bundle OK: origin ${origin} muncul ${kemunculan} kali di ` +
    `${berkasMengandung}/${berkasJs.length} berkas JS dist/assets.`,
);
