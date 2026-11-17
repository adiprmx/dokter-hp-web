import { useEffect } from "react";
import { checkApiHealth } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

// Halaman placeholder — membuktikan build dan routing berjalan.
// BUKAN desain final; tim desain mengisi tampilan sebenarnya.
export default function HomePage() {
  const apiStatus = useAppStore((s) => s.apiStatus);
  const setApiStatus = useAppStore((s) => s.setApiStatus);

  useEffect(() => {
    let aktif = true;
    checkApiHealth()
      .then((ok) => {
        if (aktif) setApiStatus(ok ? "terhubung" : "tidak-terjangkau");
      })
      .catch(() => {
        if (aktif) setApiStatus("tidak-terjangkau");
      });
    return () => {
      aktif = false;
    };
  }, [setApiStatus]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Dokter HP Web
      </h1>
      <p className="mt-4 text-base text-neutral-600">
        Pendamping web untuk diagnosis kesehatan HP, laporan WiFi, dan bantuan
        AI. Halaman ini masih placeholder — fitur lengkap sedang dibangun.
      </p>
      <p className="mt-8 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
        Status API:{" "}
        <span className="font-semibold">
          {apiStatus === "memeriksa" && "Memeriksa…"}
          {apiStatus === "terhubung" && "Terhubung"}
          {apiStatus === "tidak-terjangkau" && "Tidak terjangkau"}
        </span>
      </p>
    </main>
  );
}
