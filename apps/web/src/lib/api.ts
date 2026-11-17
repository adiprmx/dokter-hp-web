// Klien HTTP tipis untuk API Worker.
// VITE_API_URL diisi saat deploy bila API berada di domain berbeda;
// kosong berarti memakai jalur relatif /api (proxy Vite saat dev,
// atau route Pages saat produksi).
const API_URL = import.meta.env.VITE_API_URL as string | undefined;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = (API_URL ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Permintaan ${path} gagal: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const data = await fetchJson<{ ok: boolean }>("/api/health");
    return data.ok === true;
  } catch {
    return false;
  }
}

export { fetchJson };
