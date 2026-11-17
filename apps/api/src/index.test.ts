import { describe, expect, it } from "vitest";
import app from "./index";

describe("GET /api/health", () => {
  it("mengembalikan { ok: true }", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("rute stub", () => {
  it("mengembalikan 501 untuk endpoint yang belum diimplementasikan", async () => {
    const res = await app.request("/api/health-checks");
    expect(res.status).toBe(501);
  });

  it("mengembalikan 404 untuk rute yang tidak dikenal", async () => {
    const res = await app.request("/api/tidak-ada");
    expect(res.status).toBe(404);
  });
});
