import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="mt-4 text-base text-neutral-600">
        Alamat yang dibuka tidak tersedia.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
      >
        Kembali ke beranda
      </Link>
    </main>
  );
}
