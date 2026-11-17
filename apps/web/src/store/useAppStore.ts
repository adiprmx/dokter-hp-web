import { create } from "zustand";
import { panggilApi } from "../lib/api";

export type ApiStatus = "memeriksa" | "terhubung" | "tidak-terjangkau";

/** Status sesi pengguna: belum dicek / masuk / tidak masuk. */
export type StatusMasuk = "memeriksa" | "masuk" | "tidak-masuk";

interface InfoSaya {
  nama: string;
}

interface AppState {
  apiStatus: ApiStatus;
  setApiStatus: (status: ApiStatus) => void;
  /** Status sesi untuk Header sadar-auth. */
  statusMasuk: StatusMasuk;
  /** Nama pengguna yang masuk (null bila tidak diketahui). */
  namaPengguna: string | null;
  setStatusMasuk: (status: StatusMasuk, nama?: string | null) => void;
  /**
   * Memeriksa sesi lewat GET /api/auth/me (sekali per panggilan;
   * panggilan bersamaan digabung ke satu janji). Dipanggil Header
   * saat mount dan saat rute berubah (agar status segar setelah
   * masuk dari halaman /masuk).
   */
  muatStatusMasuk: () => Promise<void>;
}

// Janji muat yang sedang berjalan (dedupe panggilan bersamaan).
let janjiMuat: Promise<void> | null = null;

// State global aplikasi. Tim fitur menambah slice sesuai kebutuhan.
export const useAppStore = create<AppState>((set) => ({
  apiStatus: "memeriksa",
  setApiStatus: (status) => set({ apiStatus: status }),
  statusMasuk: "memeriksa",
  namaPengguna: null,
  setStatusMasuk: (status, nama) =>
    set({ statusMasuk: status, namaPengguna: nama ?? null }),
  muatStatusMasuk: () => {
    if (janjiMuat) return janjiMuat;
    janjiMuat = (async () => {
      try {
        const saya = await panggilApi<InfoSaya>("/api/auth/me");
        set({ statusMasuk: "masuk", namaPengguna: saya.nama || null });
      } catch {
        // 401 berarti tidak masuk; galat lain (jaringan, server
        // sibuk) juga ditampilkan sebagai tidak masuk agar Header
        // tidak menggantung di status memeriksa — pengguna bisa
        // mengetuk Masuk dan mencoba lagi.
        set({ statusMasuk: "tidak-masuk", namaPengguna: null });
      } finally {
        janjiMuat = null;
      }
    })();
    return janjiMuat;
  },
}));
