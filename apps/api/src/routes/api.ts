import { Hono } from "hono";

// Router /api. Rute fitur diisi tim backend per modul:
// auth, health-checks, wifi-reports, ai-diagnoses, sinkronisasi.
export const apiRouter = new Hono();

// Pemeriksaan kesehatan — dipakai frontend dan monitor uptime.
apiRouter.get("/health", (c) => c.json({ ok: true }));

// Rute stub: mengembalikan 501 sampai modulnya diimplementasikan.
// Daftar ini sekaligus peta endpoint yang direncanakan (lihat
// docs/api-contracts.md untuk kontrak lengkapnya).
const belumDiimplementasikan = (c: { json: (body: unknown, status: number) => Response }) =>
  c.json(
    {
      success: false,
      error: { code: "NOT_IMPLEMENTED", message: "Endpoint belum diimplementasikan." },
    },
    501,
  );

apiRouter.all("/auth/*", belumDiimplementasikan);
apiRouter.all("/health-checks/*", belumDiimplementasikan);
apiRouter.all("/health-checks", belumDiimplementasikan);
apiRouter.all("/wifi-reports/*", belumDiimplementasikan);
apiRouter.all("/wifi-reports", belumDiimplementasikan);
apiRouter.all("/ai-diagnoses/*", belumDiimplementasikan);
apiRouter.all("/ai-diagnoses", belumDiimplementasikan);
apiRouter.all("/sync/*", belumDiimplementasikan);
