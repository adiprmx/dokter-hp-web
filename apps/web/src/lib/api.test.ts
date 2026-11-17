// Tes unit klien HTTP kanonis (lib/api.ts, K-13/K-16): fetchJson,
// panggilApi, ApiError, checkApiHealth — dengan fetch yang diganti
// (stub). Tidak ada panggilan jaringan nyata.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, checkApiHealth, fetchJson, panggilApi } from "./api";
import { parseSisaPercobaan } from "./pin";

function responsJson(ok: boolean, status: number, badan: unknown): Response {
  return {
    ok,
    status,
    json: async () => badan,
  } as unknown as Response;
}

describe("ApiError", () => {
  it("membawa status, kode, pesan, rincian, dan badan mentah", () => {
    const badan = {
      success: false,
      error: { code: "PIN_SALAH", message: "PIN salah." },
    };
    const galat = new ApiError(401, "PIN_SALAH", "PIN salah.", { sisa: 3 }, badan);
    expect(galat).toBeInstanceOf(Error);
    expect(galat.name).toBe("ApiError");
    expect(galat.status).toBe(401);
    expect(galat.code).toBe("PIN_SALAH");
    expect(galat.message).toBe("PIN salah.");
    expect(galat.details).toEqual({ sisa: 3 });
    expect(galat.body).toBe(badan);
  });
});

describe("fetchJson / panggilApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mengembalikan envelope sukses dan mengirim cookie sesi", async () => {
    const fetchMock = vi.fn(async () =>
      responsJson(true, 200, {
        success: true,
        data: { valid: true },
        meta: { timestamp: "2026-11-18T00:00:00.000Z" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const envelope = await fetchJson<{ valid: boolean }>("/api/auth/pin/verify", {
      method: "POST",
      body: { pin: "1234" },
    });

    expect(envelope.data).toEqual({ valid: true });
    expect(envelope.meta.timestamp).toBe("2026-11-18T00:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const panggilan = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(panggilan[0]).toBe("/api/auth/pin/verify");
    expect(panggilan[1].method).toBe("POST");
    expect(panggilan[1].credentials).toBe("include");
    expect(new Headers(panggilan[1].headers).get("Content-Type")).toBe(
      "application/json",
    );
    expect(panggilan[1].body).toBe(JSON.stringify({ pin: "1234" }));
  });

  it("panggilApi mengembalikan data saja", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responsJson(true, 200, { success: true, data: [1, 2], meta: {} }),
      ),
    );
    await expect(panggilApi<number[]>("/api/history")).resolves.toEqual([1, 2]);
  });

  it("meneruskan body string apa adanya (tanpa JSON.stringify ganda)", async () => {
    const fetchMock = vi.fn(async () =>
      responsJson(true, 200, { success: true, data: {}, meta: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await panggilApi("/api/health-checks", {
      method: "POST",
      body: '{"skor":75}',
    });
    const panggilan = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(panggilan[1].body).toBe('{"skor":75}');
  });

  it("melempar ApiError dengan kode dan badan saat respons gagal", async () => {
    const fetchMock = vi.fn(async () =>
      responsJson(false, 401, {
        success: false,
        error: {
          code: "PIN_SALAH",
          message: "PIN salah. Coba lagi.",
          details: { sisa_percobaan: 3 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      panggilApi("/api/auth/pin/verify", {
        method: "POST",
        body: { pin: "0000" },
      }),
    ).rejects.toMatchObject({ status: 401, code: "PIN_SALAH" });

    try {
      await panggilApi("/api/auth/pin/verify", {
        method: "POST",
        body: { pin: "0000" },
      });
      expect.unreachable();
    } catch (galat) {
      expect(galat).toBeInstanceOf(ApiError);
      // Badan mentah tetap bisa diurai pemilah PIN.
      expect(parseSisaPercobaan((galat as ApiError).body)).toBe(3);
    }
  });

  it("memakai pesan galat umum bila badan respons tidak bisa dibaca", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("bukan JSON");
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(panggilApi("/api/auth/me")).rejects.toMatchObject({
      status: 500,
      code: null,
      message: "Terjadi kesalahan. Coba lagi.",
    });
  });

  it("menolak respons 2xx yang bukan envelope sukses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responsJson(true, 200, { ok: true })),
    );
    await expect(fetchJson("/api/health")).rejects.toMatchObject({
      status: 200,
      code: null,
    });
  });
});

describe("checkApiHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("true bila /api/health menjawab envelope { status: 'ok' } (K-24)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responsJson(true, 200, {
          success: true,
          data: { status: "ok" },
          meta: {},
        }),
      ),
    );
    await expect(checkApiHealth()).resolves.toBe(true);
  });

  it("false bila status bukan ok atau permintaan gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        responsJson(true, 200, {
          success: true,
          data: { status: "down" },
          meta: {},
        }),
      ),
    );
    await expect(checkApiHealth()).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => responsJson(false, 500, null)));
    await expect(checkApiHealth()).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(checkApiHealth()).resolves.toBe(false);
  });
});
