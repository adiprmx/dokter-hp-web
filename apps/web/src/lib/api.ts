// Klien HTTP kanonis untuk API Worker (K-13, K-16).
// - Basis URL dari VITE_API_BASE_URL; kosong berarti jalur relatif
//   /api (proxy Vite saat dev, atau route Pages saat produksi).
// - SEMUA permintaan memakai credentials: 'include' (cookie sesi
//   SameSite=None; Secure, lintas domain Pages <-> Workers).
// - Respons dibaca sebagai envelope kontrak
//   { success, data, error, meta } (kontrak 0.3).
// - Galat dilempar sebagai ApiError bertipe (status, code, details,
//   body) agar halaman bisa bercabang dari kode kontrak
//   (UNAUTHORIZED, SESSION_LOCKED, RATE_LIMITED, ...) bukan dari
//   teks pesan galat.
// Halaman WAJIB memakai modul ini — jangan membuat panggilApi /
// GalatApi lokal lagi (workaround lokal sudah dihapus di Wave 3b).

/** Basis URL API tanpa garis miring akhir ('' = relatif). */
export function basisApi(): string {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (base ?? '').replace(/\/$/, '');
}

/** Galat API bertipe: status HTTP + kode kontrak + rincian. */
export class ApiError extends Error {
  status: number;
  /** Kode kontrak (mis. UNAUTHORIZED); null bila respons bukan envelope galat. */
  code: string | null;
  details?: Record<string, unknown>;
  /** Badan respons mentah (bila bisa diurai sebagai JSON). */
  body?: unknown;

  constructor(
    status: number,
    code: string | null,
    message: string,
    details?: Record<string, unknown>,
    body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.body = body;
  }
}

/** Envelope sukses kontrak 0.3. */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta: { timestamp: string; [kunci: string]: unknown };
}

interface BadanGalat {
  success?: boolean;
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

/**
 * Opsi permintaan API: seperti RequestInit, tetapi body boleh objek
 * apa pun (di-JSON.stringify otomatis oleh fetchJson) — bukan hanya
 * BodyInit. Dipakai `object` agar interface (mis. BodiEntriDokter)
 * ikut diterima; Record<string, unknown> menolak interface tanpa
 * index signature.
 */
export type OpsiApi = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
};

function sebagaiBadanGalat(nilai: unknown): BadanGalat | null {
  if (typeof nilai === 'object' && nilai !== null) return nilai as BadanGalat;
  return null;
}

/**
 * Memanggil endpoint API dan mengembalikan envelope sukses utuh
 * (termasuk meta.pagination untuk endpoint daftar). init.body
 * boleh objek (di-JSON.stringify otomatis) atau string.
 * Melempar ApiError bila status tidak 2xx atau badan bukan JSON.
 */
export async function fetchJson<T>(
  path: string,
  init?: OpsiApi,
): Promise<ApiEnvelope<T>> {
  const { body, headers, ...sisaInit } = init ?? {};
  const header = new Headers(headers as HeadersInit | undefined);
  if (!header.has('Content-Type')) {
    header.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${basisApi()}${path}`, {
    credentials: 'include',
    headers: header,
    body:
      body === undefined || typeof body === 'string' || body instanceof FormData
        ? (body as BodyInit | undefined)
        : JSON.stringify(body),
    ...sisaInit,
  });
  const terurai: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const galat = sebagaiBadanGalat(terurai)?.error;
    throw new ApiError(
      res.status,
      galat?.code ?? null,
      galat?.message ?? "Terjadi kesalahan. Coba lagi.",
      galat?.details,
      terurai,
    );
  }
  const envelope = terurai as ApiEnvelope<T> | null;
  if (!envelope || envelope.success !== true) {
    throw new ApiError(res.status, null, `Respons ${path} tidak valid.`, undefined, terurai);
  }
  return envelope;
}

/**
 * Memanggil endpoint API dan mengembalikan data-nya saja
 * (envelope.data). Untuk endpoint daftar yang butuh
 * meta.pagination, pakai fetchJson.
 */
export async function panggilApi<T>(
  path: string,
  init?: OpsiApi,
): Promise<T> {
  const envelope = await fetchJson<T>(path, init);
  return envelope.data;
}

/**
 * Memeriksa kesehatan API: true bila GET /api/health menjawab
 * envelope sukses dengan data.status === 'ok' (K-24).
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const envelope = await fetchJson<{ status: string }>('/api/health');
    return envelope.data.status === 'ok';
  } catch {
    return false;
  }
}
