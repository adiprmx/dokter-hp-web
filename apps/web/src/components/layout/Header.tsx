import { Link, NavLink } from "react-router-dom";

// Header aplikasi (Tim Shell/Routing). Menempel di atas, design lock
// hitam/putih, target sentuh minimal 48 px (K-11). Halaman aktif
// ditandai tebal + garis bawah, bukan hanya warna (a11y.md §6.6).
// Header sengaja tidak memanggil /api/auth/me: status login diperiksa
// RequireAuth di rute yang butuh masuk, tanpa panggilan API tambahan
// di setiap halaman.

const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

const TAUTAN_NAV = [
  { ke: "/", label: "Beranda" },
  { ke: "/wifi", label: "Tes WiFi" },
  { ke: "/tentang", label: "Tentang" },
] as const;

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className={`flex min-h-[48px] items-center gap-2 rounded-lg ${FOKUS}`}
        >
          <img
            src="/logo.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="text-base font-bold tracking-tight text-white">
            Dokter HP
          </span>
        </Link>
        <nav aria-label="Navigasi utama" className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {TAUTAN_NAV.map((tautan) => (
              <li key={tautan.ke}>
                <NavLink
                  to={tautan.ke}
                  end={tautan.ke === "/"}
                  className={({ isActive }) =>
                    `flex min-h-[48px] items-center rounded-lg px-3 text-sm ${FOKUS} ${
                      isActive
                        ? "font-semibold text-white underline underline-offset-4"
                        : "text-zinc-400"
                    }`
                  }
                >
                  {tautan.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          to="/masuk"
          className={`flex min-h-[48px] items-center rounded-lg bg-white px-4 text-sm font-semibold text-black ${FOKUS}`}
        >
          Masuk
        </Link>
      </div>
    </header>
  );
}
