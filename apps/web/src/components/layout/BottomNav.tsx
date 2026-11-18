import { NavLink } from "react-router-dom";

// Navigasi bawah HP (Tim Layout, redesign v2.0). Hanya tampil di
// layar kecil (di tablet/desktop navigasi memakai header). Setiap
// item punya label teks yang terlihat, bukan ikon saja (a11y.md
// §6.6), target sentuh minimal 48 px (K-11), dan halaman aktif
// ditandai PIL berisi di balik ikon (latar permukaan terangkat,
// 56 x 32 px, bahasa yang sama dengan pil aktif di header): bentuk
// yang membedakan, bukan hanya warna atau garis tipis. Pil selalu
// dirender (latar berubah lewat kelas) agar peralihan warnanya
// halus, bukan muncul/hilang mendadak.
// Tinggi total nav 68 px (padding 8 + pil 32 + jarak 4 + label 16
// + padding 8); penyangga di AppLayout memakai angka yang sama.
// Label tanpa padding horizontal (px-0): label terpanjang
// ("Pengaturan") butuh seluruh lebar item 72 px di layar 360 px.
// Fokus keyboard memakai aturan global :focus-visible di
// styles/tokens.css (satu sumber kebenaran, seperti ui/Button).
// Padding bawah safe-area agar nav tidak tertutup bilah gestur HP.

function IkonBeranda() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M3 11.5 12 3l9 8.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function IkonWifi() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M4 11a12 12 0 0 1 16 0" />
      <path d="M7.5 14.5a7 7 0 0 1 9 0" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IkonDashboard() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

function IkonRiwayat() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IkonPengaturan() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M4 8h8" />
      <path d="M16 8h4" />
      <circle cx="14" cy="8" r="2" />
      <path d="M4 16h2" />
      <path d="M10 16h10" />
      <circle cx="8" cy="16" r="2" />
    </svg>
  );
}

const ITEM_NAV = [
  { ke: "/", label: "Beranda", Ikon: IkonBeranda, akhir: true },
  { ke: "/wifi", label: "WiFi", Ikon: IkonWifi, akhir: false },
  { ke: "/dashboard", label: "Dashboard", Ikon: IkonDashboard, akhir: false },
  { ke: "/riwayat", label: "Riwayat", Ikon: IkonRiwayat, akhir: false },
  {
    ke: "/pengaturan",
    label: "Pengaturan",
    Ikon: IkonPengaturan,
    akhir: false,
  },
] as const;

export default function BottomNav() {
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--color-border)] bg-[var(--color-bg)] pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="mx-auto flex w-full max-w-5xl">
        {ITEM_NAV.map((item) => (
          <li key={item.ke} className="flex-1">
            <NavLink
              to={item.ke}
              end={item.akhir}
              className={({ isActive }) =>
                `flex min-h-[48px] flex-col items-center justify-center gap-1 px-0 py-2 text-xs ${
                  isActive
                    ? "font-semibold text-white"
                    : "text-[var(--color-text-muted)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`flex h-8 items-center justify-center rounded-full px-4 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
                      isActive
                        ? "bg-[var(--color-surface-raised)]"
                        : "bg-transparent"
                    }`}
                  >
                    <item.Ikon />
                  </span>
                  <span className="tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
