import { create } from "zustand";

export type ApiStatus = "memeriksa" | "terhubung" | "tidak-terjangkau";

interface AppState {
  apiStatus: ApiStatus;
  setApiStatus: (status: ApiStatus) => void;
}

// State global aplikasi. Tim fitur menambah slice sesuai kebutuhan.
export const useAppStore = create<AppState>((set) => ({
  apiStatus: "memeriksa",
  setApiStatus: (status) => set({ apiStatus: status }),
}));
