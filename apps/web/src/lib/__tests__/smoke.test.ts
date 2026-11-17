// apps/web/src/lib/__tests__/smoke.test.ts — Contoh unit test Vitest.
//
// Tes ini membuktikan rantai tes frontend bekerja: Vitest jalan,
// lingkungan jsdom tersedia, dan asersi berjalan.
//
// Ambang klasifikasi di bawah diambil dari PRODUCT.md 4.4
// (tes kecepatan unduh) — bukan angka karangan:
//   sangat lambat < 50, lambat < 200, cukup < 1000,
//   cepat < 5000, sangat cepat >= 5000 (KB/detik).
// Fungsi klasifikasi diimpor dari lib/speedtest.ts (satu sumber);
// asersi memakai field `id` (bentuk hyphenated, mis. "sangat-lambat").

import { describe, expect, it } from 'vitest';
import { klasifikasiKecepatan } from '../speedtest';

describe('lingkungan tes (smoke)', () => {
  it('jsdom tersedia: document dan window bisa dipakai', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
    expect(document.body).toBeTruthy();
  });
});

describe('klasifikasi kecepatan unduh (PRODUCT.md 4.4)', () => {
  it.each([
    [3.2, 'sangat-lambat'],
    [49.9, 'sangat-lambat'],
    [50, 'lambat'],
    [199.9, 'lambat'],
    [200, 'cukup'],
    [999.9, 'cukup'],
    [1000, 'cepat'],
    [4999.9, 'cepat'],
    [5000, 'sangat-cepat'],
    [12000, 'sangat-cepat'],
  ])('%s KB/detik -> %s', (kbps, hasil) => {
    expect(klasifikasiKecepatan(kbps).id).toBe(hasil);
  });

  it('kasus awal produk: 3,2 KB/detik tergolong sangat lambat', () => {
    // Kasus WiFi ACHA di PRODUCT.md 1.1: unduhan jatuh ke 3,2 KB/detik.
    expect(klasifikasiKecepatan(3.2).id).toBe('sangat-lambat');
  });
});
