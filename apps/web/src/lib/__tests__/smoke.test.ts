// apps/web/src/lib/__tests__/smoke.test.ts — Contoh unit test Vitest.
//
// Tes ini membuktikan rantai tes frontend bekerja: Vitest jalan,
// lingkungan jsdom tersedia, dan asersi berjalan. Tes ini mandiri
// (tidak mengimpor modul aplikasi lain) supaya tetap hijau sebelum
// modul frontend dibuat.
//
// Ambang klasifikasi di bawah diambil dari PRODUCT.md 4.4
// (tes kecepatan unduh) — bukan angka karangan:
//   sangat lambat < 50, lambat < 200, cukup < 1000,
//   cepat < 5000, sangat cepat >= 5000 (KB/detik).
//
// Begitu modul lib/speedtest.ts tersedia, ganti fungsi lokal
// `klasifikasiKecepatan` di bawah dengan impor dari modul tersebut
// dan hapus definisi lokalnya.

import { describe, expect, it } from 'vitest';

/** Klasifikasi kecepatan unduh (KB/detik) — cermin PRODUCT.md 4.4. */
function klasifikasiKecepatan(kbps: number): string {
  if (kbps < 50) return 'sangat lambat';
  if (kbps < 200) return 'lambat';
  if (kbps < 1000) return 'cukup';
  if (kbps < 5000) return 'cepat';
  return 'sangat cepat';
}

describe('lingkungan tes (smoke)', () => {
  it('jsdom tersedia: document dan window bisa dipakai', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
    expect(document.body).toBeTruthy();
  });
});

describe('klasifikasi kecepatan unduh (PRODUCT.md 4.4)', () => {
  it.each([
    [3.2, 'sangat lambat'],
    [49.9, 'sangat lambat'],
    [50, 'lambat'],
    [199.9, 'lambat'],
    [200, 'cukup'],
    [999.9, 'cukup'],
    [1000, 'cepat'],
    [4999.9, 'cepat'],
    [5000, 'sangat cepat'],
    [12000, 'sangat cepat'],
  ])('%s KB/detik -> %s', (kbps, hasil) => {
    expect(klasifikasiKecepatan(kbps)).toBe(hasil);
  });

  it('kasus awal produk: 3,2 KB/detik tergolong sangat lambat', () => {
    // Kasus WiFi ACHA di PRODUCT.md 1.1: unduhan jatuh ke 3,2 KB/detik.
    expect(klasifikasiKecepatan(3.2)).toBe('sangat lambat');
  });
});
