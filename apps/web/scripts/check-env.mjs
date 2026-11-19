// Guard prebuild (hook npm `prebuild`): gagal CEPAT sebelum tsc/vite
// jalan bila VITE_API_BASE_URL kosong atau bukan URL https absolut
// yang valid. Lapisan kedua ada di vite.config.ts (plugin) yang
// menangkap pemanggilan `vite build` langsung yang melewati npm.
// Guard TIDAK menyentuh `vite dev` maupun vitest — keduanya tidak
// menjalankan script `build`.
import {
  kesalahanApiBaseUrl,
  muatApiBaseUrl,
  pesanGuardApiBaseUrl,
} from "./api-base-url.mjs";

const nilai = muatApiBaseUrl();
const galat = kesalahanApiBaseUrl(nilai);
if (galat) {
  console.error(pesanGuardApiBaseUrl(galat));
  process.exit(1);
}
console.log(`check-env OK: VITE_API_BASE_URL=${nilai}`);
