// Inisialisasi i18n (K-19): react-i18next + resource Indonesia/Inggris.
// Bahasa aktif disimpan di localStorage (kunci "dokter-hp-bahasa"),
// bawaan "id". Cakupan Wave 3b minimal: infrastruktur + pemilih
// bahasa di Pengaturan + kata konfirmasi hapus akun dari i18n.
// Penerjemahan seluruh halaman adalah gelombang berikutnya.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import id from "./id.json";
import en from "./en.json";

export const KUNCI_BAHASA = "dokter-hp-bahasa";

export type KodeBahasa = "id" | "en";

export function bacaBahasaTersimpan(): KodeBahasa {
  try {
    const tersimpan = localStorage.getItem(KUNCI_BAHASA);
    return tersimpan === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

export function simpanBahasa(bahasa: KodeBahasa): void {
  try {
    localStorage.setItem(KUNCI_BAHASA, bahasa);
  } catch {
    // Penyimpanan tidak tersedia (mode privat) — bahasa tetap
    // berlaku untuk sesi ini lewat changeLanguage.
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: bacaBahasaTersimpan(),
  fallbackLng: "id",
  interpolation: { escapeValue: false },
});

export default i18n;
