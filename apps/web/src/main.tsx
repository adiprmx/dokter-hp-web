import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// Daftarkan service worker hanya di build produksi, bukan saat
// pengembangan (vite dev), agar cache tidak mengganggu proses dev.
// (docs/pwa.md §8 — kode pendaftaran resmi PWA.)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Pantau pembaruan: bila ada service worker baru yang menunggu,
        // beri tahu pengguna lewat banner "Versi baru tersedia".
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // Ada versi baru yang menunggu. AppLayout menampilkan
              // banner "Versi baru tersedia"; saat pengguna mengetuk
              // "Perbarui", banner mengirim SKIP_WAITING ke worker baru
              // dan halaman dimuat ulang sekali (controllerchange).
              window.dispatchEvent(
                new CustomEvent("dokter-hp:update-tersedia"),
              );
            }
          });
        });
      })
      .catch((error) => {
        // Gagal mendaftar bukan galat bagi pengguna: aplikasi tetap
        // berfungsi penuh sebagai situs web biasa, hanya tanpa PWA.
        console.warn("Service worker gagal didaftarkan:", error);
      });

    // Muat ulang sekali setelah service worker baru mengambil alih,
    // agar pengguna langsung memakai versi terbaru.
    let sudahDimuatUlang = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!sudahDimuatUlang) {
        sudahDimuatUlang = true;
        window.location.reload();
      }
    });
  });
}
