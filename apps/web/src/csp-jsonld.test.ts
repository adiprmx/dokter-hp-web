// apps/web/src/csp-jsonld.test.ts
// Tes konsistensi CSP JSON-LD (N-01, K-82): hash SHA-256 di
// public/_headers WAJIB sama dengan hash blok JSON-LD statis di
// index.html, dihitung ulang dari isi berkas (bukan disalin dari
// laporan). Bila isi blok berubah tanpa memperbarui hash, browser
// menolak blok itu dan structured data hilang diam-diam.
//
// Berkas dibaca lewat node:fs — tes ini jalan di Node lewat
// Vitest, jadi impor Node bekerja saat runtime. Typecheck
// frontend tidak memuat tipe Node (tsconfig hanya vite/client),
// sehingga impor Node dan `process` di bawah memakai direktif
// penekan galat (ts-expect-error). Jalur berkas dihitung dari
// process.cwd()
// (direktori apps/web saat `npm run test --workspace=apps/web`
// dijalankan — perintah kanonis K-54); import.meta.url TIDAK
// bisa dipakai karena di bawah Vitest ia bukan URL file.
// (Impor `?raw` Vite tidak bisa dipakai: Vite menolak me-resolve
// index.html sebagai modul dalam Vitest.)

import { describe, expect, it } from "vitest";
// @ts-expect-error Node: impor Node sengaja dipakai di tes ini (lihat komentar atas).
import { createHash } from "node:crypto";
// @ts-expect-error Node: impor Node sengaja dipakai di tes ini (lihat komentar atas).
import { readFileSync } from "node:fs";

// @ts-expect-error Node: process hanya tersedia saat runtime Node (Vitest).
const DIREKTORI_WEB: string = process.cwd();

const JALUR_INDEX = `${DIREKTORI_WEB}/index.html`;
const JALUR_HEADERS = `${DIREKTORI_WEB}/public/_headers`;

/** Hash SHA-256 (base64) teks di dalam tag script JSON-LD statis. */
function hashJsonLdStatis(): string {
  const html = readFileSync(JALUR_INDEX, "utf8");
  const cocok = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  expect(cocok, "blok JSON-LD statis tidak ditemukan di index.html").not.toBeNull();
  return createHash("sha256").update(cocok![1], "utf8").digest("base64");
}

describe("CSP JSON-LD statis (N-01)", () => {
  it("_headers memuat hash SHA-256 blok JSON-LD di index.html", () => {
    const hash = hashJsonLdStatis();
    const headers = readFileSync(JALUR_HEADERS, "utf8");
    expect(headers).toContain(`'sha256-${hash}'`);
  });
});
