// apps/api/src/lib/asal.test.ts
// Tes unit helper origin (K-73): daftar koma, loopback, sama-host,
// dan mode fail-closed bila ALLOWED_ORIGIN tidak diatur.

import { describe, expect, it } from 'vitest';
import {
  apakahOriginDiizinkan,
  apakahOriginLoopback,
  apakahOriginSamaHost,
  hostPermintaanDariUrl,
  uraiDaftarOrigin,
} from './asal';

describe('uraiDaftarOrigin', () => {
  it('mengembalikan daftar kosong bila nilai tidak diatur', () => {
    expect(uraiDaftarOrigin(undefined)).toEqual([]);
    expect(uraiDaftarOrigin(null)).toEqual([]);
    expect(uraiDaftarOrigin('')).toEqual([]);
    expect(uraiDaftarOrigin('   ')).toEqual([]);
  });

  it('memisah daftar koma dan memangkas spasi (K-73c)', () => {
    expect(
      uraiDaftarOrigin('https://a.pages.dev, https://b.vercel.app'),
    ).toEqual(['https://a.pages.dev', 'https://b.vercel.app']);
    expect(uraiDaftarOrigin('https://a.pages.dev')).toEqual([
      'https://a.pages.dev',
    ]);
  });

  it('membuang entri kosong di tengah daftar', () => {
    expect(uraiDaftarOrigin('https://a.pages.dev,, https://b.vercel.app,')).toEqual([
      'https://a.pages.dev',
      'https://b.vercel.app',
    ]);
  });
});

describe('apakahOriginLoopback', () => {
  it('menerima localhost dan 127.0.0.1 dengan port apa pun', () => {
    expect(apakahOriginLoopback('http://localhost:5173')).toBe(true);
    expect(apakahOriginLoopback('http://localhost')).toBe(true);
    expect(apakahOriginLoopback('http://127.0.0.1:8787')).toBe(true);
    expect(apakahOriginLoopback('http://[::1]:8787')).toBe(true);
  });

  it('menolak host bukan loopback, termasuk yang mirip localhost', () => {
    expect(apakahOriginLoopback('https://evil.example')).toBe(false);
    expect(apakahOriginLoopback('https://localhost.evil.example')).toBe(false);
    expect(apakahOriginLoopback('https://localhostx.example')).toBe(false);
    expect(apakahOriginLoopback('bukan-url')).toBe(false);
    expect(apakahOriginLoopback('')).toBe(false);
  });
});

describe('apakahOriginSamaHost', () => {
  it('menerima origin dengan host yang sama (termasuk port)', () => {
    expect(
      apakahOriginSamaHost(
        'https://dokter-hp-api.contoh.workers.dev',
        'dokter-hp-api.contoh.workers.dev',
      ),
    ).toBe(true);
    expect(
      apakahOriginSamaHost('http://localhost:8787', 'localhost:8787'),
    ).toBe(true);
  });

  it('menolak host berbeda atau port berbeda', () => {
    expect(
      apakahOriginSamaHost(
        'https://evil.example',
        'dokter-hp-api.contoh.workers.dev',
      ),
    ).toBe(false);
    expect(
      apakahOriginSamaHost('http://localhost:5173', 'localhost:8787'),
    ).toBe(false);
  });
});

describe('apakahOriginDiizinkan', () => {
  const HOST_API = 'dokter-hp-api.contoh.workers.dev';

  it('dengan daftar terkonfigurasi: hanya origin dalam daftar yang diizinkan', () => {
    const daftar = ['https://a.pages.dev', 'https://b.vercel.app'];
    expect(
      apakahOriginDiizinkan('https://a.pages.dev', daftar, HOST_API),
    ).toBe(true);
    expect(
      apakahOriginDiizinkan('https://b.vercel.app', daftar, HOST_API),
    ).toBe(true);
    expect(
      apakahOriginDiizinkan('https://evil.example', daftar, HOST_API),
    ).toBe(false);
    // Loopback TIDAK diizinkan otomatis bila daftar terkonfigurasi.
    expect(
      apakahOriginDiizinkan('http://localhost:5173', daftar, HOST_API),
    ).toBe(false);
    // Pencocokan persis: awalan yang mirip tidak cukup.
    expect(
      apakahOriginDiizinkan('https://a.pages.dev.evil.example', daftar, HOST_API),
    ).toBe(false);
  });

  it('tanpa daftar (fail-closed): hanya loopback atau sama-host', () => {
    expect(
      apakahOriginDiizinkan('http://localhost:5173', [], HOST_API),
    ).toBe(true);
    expect(
      apakahOriginDiizinkan('http://127.0.0.1:8787', [], HOST_API),
    ).toBe(true);
    expect(
      apakahOriginDiizinkan(`https://${HOST_API}`, [], HOST_API),
    ).toBe(true);
    // Origin situs mana pun TIDAK diizinkan — tidak ada echo (R-01).
    expect(
      apakahOriginDiizinkan('https://evil.example', [], HOST_API),
    ).toBe(false);
    expect(
      apakahOriginDiizinkan('https://aplikasi.contoh.test', [], HOST_API),
    ).toBe(false);
  });
});

describe('hostPermintaanDariUrl', () => {
  it('mengembalikan host beserta port dalam huruf kecil', () => {
    expect(
      hostPermintaanDariUrl('https://API.Contoh.Test:8443/api/health'),
    ).toBe('api.contoh.test:8443');
    expect(hostPermintaanDariUrl('http://localhost:8787/api/health')).toBe(
      'localhost:8787',
    );
  });

  it('mengembalikan string kosong untuk URL tidak valid', () => {
    expect(hostPermintaanDariUrl('bukan-url')).toBe('');
  });
});
