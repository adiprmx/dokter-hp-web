// apps/web/src/lib/pin.ts — Logika PIN dan galat autentikasi.
//
// Kontrak yang diikuti: docs/api-contracts.md (grup Auth Google + PIN)
// dengan awalan /api (keputusan koordinator K-07), sesuai implementasi
// Worker di apps/api/src/auth/routes.ts:
//   GET  /api/auth/google       — mulai masuk Google (navigasi browser)
//   GET  /api/auth/me           — info pengguna + status PIN/sesi
//   POST /api/auth/pin/set      — atur/ubah PIN
//   POST /api/auth/pin/verify   — verifikasi PIN (buka sesi)
//   POST /api/auth/pin/delete   — hapus PIN (POST, bukan DELETE)
//
// Sesi memakai cookie HttpOnly dari server; frontend tidak pernah
// menyimpan token di localStorage atau sessionStorage. Semua panggilan
// API memakai credentials: "include" agar cookie ikut terkirim.

/** Panjang PIN minimum dan maksimum (digit), sesuai kontrak API. */
export const PIN_MIN_DIGIT = 4;
export const PIN_MAKS_DIGIT = 8;

/** Percobaan PIN salah berturut-turut sebelum kunci sementara aktif. */
export const PIN_MAKS_GAGAL = 5;

/** Durasi kunci sementara PIN (detik) setelah 5 kali salah. */
export const PIN_KUNCI_DETIK = 30;

/** Batas atas sisa detik kunci yang diterima dari server (pengaman). */
const SISA_DETIK_MAKSIMUM = 3600;

/** Pesan validasi format PIN (docs/copy.md bagian 3 dan 12). */
export const PESAN_PIN_TIDAK_VALID = "PIN harus 4 sampai 8 angka.";

/** Pesan galat umum (docs/copy.md bagian 0). */
export const PESAN_GALAT_UMUM = "Terjadi kesalahan. Coba lagi.";

/** Pesan saat permintaan jaringan gagal total (docs/copy.md bagian 13). */
export const PESAN_TANPA_KONEKSI =
  "Tidak ada koneksi internet. Periksa sambungan, lalu coba lagi.";

/**
 * Memeriksa format PIN: hanya digit 0-9, panjang 4-8 karakter.
 * PIN diterima sebagai string agar PIN berawalan 0 (misalnya "0123")
 * tidak kehilangan angka nolnya.
 */
export function validasiFormatPin(pin: unknown): pin is string {
  if (typeof pin !== "string") return false;
  const pola = new RegExp(`^[0-9]{${PIN_MIN_DIGIT},${PIN_MAKS_DIGIT}}$`);
  return pola.test(pin);
}

/** Pesan validasi untuk PIN, atau null bila formatnya sudah benar. */
export function pesanValidasiPin(pin: string): string | null {
  return validasiFormatPin(pin) ? null : PESAN_PIN_TIDAK_VALID;
}

// ---------------------------------------------------------------------------
// Pengurai envelope galat API ({ success: false, error: { code, message,
// details } }). Semua pengurai tahan terhadap badan yang cacat: nilai yang
// tidak sesuai bentuk dibaca sebagai "tidak ada", bukan dilempar.
// ---------------------------------------------------------------------------

interface BadanGalat {
  error?: { code?: unknown; message?: unknown; details?: unknown };
}

function objekGalat(body: unknown): BadanGalat["error"] | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as BadanGalat).error;
  if (typeof error !== "object" || error === null) return null;
  return error;
}

/** Mengambil kode galat mesin (misalnya "PIN_SALAH") dari badan respons. */
export function kodeGalatApi(body: unknown): string | null {
  const code = objekGalat(body)?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Mengambil pesan galat untuk pengguna dari badan respons. Kontrak API
 * menjamin pesan ini berbahasa sehari-hari dan aman ditampilkan langsung.
 */
export function pesanGalatApi(body: unknown): string | null {
  const message = objekGalat(body)?.message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

/** Mengambil rincian tambahan galat (details) dari badan respons. */
export function rincianGalatApi(body: unknown): unknown {
  return objekGalat(body)?.details;
}

function objekRincian(body: unknown): Record<string, unknown> | null {
  const rincian = rincianGalatApi(body);
  if (typeof rincian !== "object" || rincian === null) return null;
  return rincian as Record<string, unknown>;
}

export interface StatusKunciPin {
  terkunci: true;
  /** Sisa detik sampai kunci berakhir (selalu >= 1). */
  sisaDetik: number;
}

/**
 * Mengurai respons kunci PIN (kode PIN_TERKUNCI). Sisa waktu dibaca dari
 * `details.sisa_detik` bila ada; bila tidak, dihitung dari
 * `details.terkunci_sampai` (ISO 8601) terhadap `sekarang`; bila keduanya
 * tidak ada atau tidak valid, dipakai durasi baku 30 detik.
 * Mengembalikan null bila badan bukan respons PIN_TERKUNCI.
 */
export function parseResponsKunciPin(
  body: unknown,
  sekarang = Date.now(),
): StatusKunciPin | null {
  if (kodeGalatApi(body) !== "PIN_TERKUNCI") return null;
  const rincian = objekRincian(body);

  const sisaAngka = rincian?.["sisa_detik"];
  if (
    typeof sisaAngka === "number" &&
    Number.isFinite(sisaAngka) &&
    sisaAngka > 0
  ) {
    return {
      terkunci: true,
      sisaDetik: Math.min(Math.ceil(sisaAngka), SISA_DETIK_MAKSIMUM),
    };
  }

  const sampai = rincian?.["terkunci_sampai"];
  if (typeof sampai === "string") {
    const waktu = Date.parse(sampai);
    if (Number.isFinite(waktu) && waktu > sekarang) {
      return {
        terkunci: true,
        sisaDetik: Math.min(
          Math.ceil((waktu - sekarang) / 1000),
          SISA_DETIK_MAKSIMUM,
        ),
      };
    }
  }

  return { terkunci: true, sisaDetik: PIN_KUNCI_DETIK };
}

/**
 * Mengurai sisa percobaan dari respons PIN_SALAH
 * (`details.sisa_percobaan`, 0-5). Mengembalikan null bila badan bukan
 * respons PIN_SALAH atau nilainya tidak ada/tidak valid.
 */
export function parseSisaPercobaan(body: unknown): number | null {
  if (kodeGalatApi(body) !== "PIN_SALAH") return null;
  const sisa = objekRincian(body)?.["sisa_percobaan"];
  if (
    typeof sisa === "number" &&
    Number.isInteger(sisa) &&
    sisa >= 0 &&
    sisa <= PIN_MAKS_GAGAL
  ) {
    return sisa;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Galat masuk Google (?error=...) — nilai redirect dari Worker callback,
// lihat docs/api-contracts.md 1.2. Nilai yang tidak dikenal diperlakukan
// sebagai oauth_gagal. Pesan mengikuti docs/copy.md bagian 13.
// ---------------------------------------------------------------------------

/** Pesan galat masuk untuk nilai query ?error=, atau null bila tidak ada. */
export function pesanGalatMasuk(nilai: string | null): string | null {
  if (!nilai) return null;
  if (nilai === "ditolak") {
    return "Masuk dibatalkan. Ketuk Masuk dengan Google untuk mencoba lagi.";
  }
  if (nilai === "server_sibuk") {
    return "Server sedang sibuk, coba lagi nanti.";
  }
  return "Masuk dengan Google gagal. Coba lagi.";
}

// ---------------------------------------------------------------------------
// URL mulai masuk Google + pemanggil API bertanda tangan sesi.
// ---------------------------------------------------------------------------

/**
 * Memvalidasi tujuan redirect setelah masuk: hanya path relatif dalam
 * aplikasi yang diawali "/" (dan bukan "//"). Nilai lain diganti
 * "/dashboard", sesuai kontrak API 1.1.
 */
export function validasiRedirect(tujuan: string | null | undefined): string {
  if (
    typeof tujuan === "string" &&
    tujuan.startsWith("/") &&
    !tujuan.startsWith("//")
  ) {
    return tujuan;
  }
  return "/dashboard";
}

/**
 * Basis URL API. Mengikuti apps/web/src/lib/api.ts: VITE_API_URL diisi
 * saat deploy bila API berada di domain berbeda; kosong berarti memakai
 * jalur relatif /api (proxy Vite saat dev, atau route Pages saat produksi).
 */
export function basisApi(): string {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  return (url ?? "").replace(/\/$/, "");
}

/**
 * URL untuk memulai masuk Google (dipakai lewat navigasi browser penuh,
 * bukan fetch, karena responsnya redirect 302 ke Google).
 */
export function buatUrlMasukGoogle(redirect?: string | null): string {
  const tujuan = encodeURIComponent(validasiRedirect(redirect));
  return `${basisApi()}/api/auth/google?redirect=${tujuan}`;
}

/** Informasi pengguna dari GET /api/auth/me (kontrak API 1.4). */
export interface InfoPengguna {
  id: string;
  nama: string;
  email: string;
  pin_diatur: boolean;
  sesi_terkunci: boolean;
  sesi_kedaluwarsa_pada: string;
}

/**
 * Galat dari API: membawa status HTTP, kode galat mesin, dan badan
 * respons mentah (untuk diurai pemilah PIN_TERKUNCI / PIN_SALAH).
 * Kegagalan jaringan (fetch melempar) BUKAN GalatApi — pemanggil
 * membedakannya dengan `instanceof GalatApi`.
 */
export class GalatApi extends Error {
  readonly status: number;
  readonly kode: string | null;
  readonly badan: unknown;

  constructor(
    status: number,
    kode: string | null,
    pesan: string,
    badan: unknown,
  ) {
    super(pesan);
    this.name = "GalatApi";
    this.status = status;
    this.kode = kode;
    this.badan = badan;
  }
}

/**
 * Memanggil endpoint API dan mengembalikan isi `data` dari envelope
 * sukses. Cookie sesi ikut terkirim (credentials: "include").
 * Bila respons gagal, melempar GalatApi. Bila jaringan gagal, fetch
 * melempar seperti biasa (TypeError).
 *
 * Catatan: fetchJson di lib/api.ts tidak dipakai di sini karena ia tidak
 * mengirim credentials dan tidak meneruskan badan galat (kode + rincian)
 * yang dibutuhkan layar PIN.
 */
export async function panggilApi<T>(
  path: string,
  opsi?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${basisApi()}${path}`, {
    method: opsi?.method ?? "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: opsi?.body === undefined ? undefined : JSON.stringify(opsi.body),
  });
  const isi: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new GalatApi(
      res.status,
      kodeGalatApi(isi),
      pesanGalatApi(isi) ?? PESAN_GALAT_UMUM,
      isi,
    );
  }
  return (isi as { data?: T } | null)?.data as T;
}
