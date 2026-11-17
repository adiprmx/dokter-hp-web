// apps/api/src/ai/cache.ts
// Cache jawaban AI di D1 (tabel ai_cache, migrasi 0002).
//
// Satu jawaban Gemini tersimpan dapat melayani pertanyaan yang sama
// berulang kali tanpa memanggil Gemini lagi — melindungi kuota
// harian proyek (Flash-Lite 500 request/hari, limit paling ketat
// di stack; lihat docs/riset-free-tier.md).
//
// Kunci cache adalah SHA-256 (heksadesimal, 64 karakter) dari:
//   versi konteks + id pengguna + pertanyaan yang dinormalisasi
//   + sidik jari data pemeriksaan (skor, kecepatan WiFi, latensi,
//   sinyal, tanggal pemeriksaan).
// Id pengguna masuk kunci agar jawaban yang memuat data pemeriksaan
// penanya tidak pernah dipakai untuk pengguna lain. Sidik jari data
// masuk kunci agar jawaban tersimpan hanya dipakai bila data
// pemeriksaan masih sama — setelah pemeriksaan baru, pertanyaan
// yang sama menghasilkan kunci baru dan jawaban dihitung ulang.
// Versi konteks dinaikkan bila format konteks/prompt berubah,
// sehingga cache lama tidak dipakai untuk konteks baru.
//
// TTL 7 hari: entri lebih tua dari itu dianggap kedaluwarsa dan
// tidak dipakai (ditulis ulang saat pertanyaan yang sama masuk).
// Entri kedaluwarsa tidak dihapus aktif — tabel kecil (satu baris
// per kombinasi pertanyaan + konteks) dan INSERT OR REPLACE
// menimpa baris lama dengan kunci yang sama.
//
// Semua fungsi di sini best-effort: kegagalan baca/tulis D1 tidak
// pernah melempar — baca mengembalikan null (alur lanjut ke Gemini)
// dan tulis mengembalikan false. Cache tidak boleh menggagalkan
// diagnosis.

import type { DbD1 } from './ratelimit';
import type { KonteksPerangkat } from './prompt';

/** Versi format konteks cache. Naikkan bila format berubah. */
export const VERSI_KONTEKS_CACHE = 'v1';

/** Masa berlaku entri cache (hari). */
export const CACHE_AI_TTL_HARI = 7;

/** Masa berlaku entri cache (milidetik). */
export const CACHE_AI_TTL_MS = CACHE_AI_TTL_HARI * 24 * 60 * 60 * 1000;

/**
 * Normalisasi pertanyaan untuk kunci cache: pangkas spasi ujung,
 * huruf kecil, dan rapatkan spasi di tengah menjadi satu spasi.
 * "WiFi   LEMOT?" dan "wifi lemot?" menghasilkan kunci yang sama.
 */
export function normalisasiPertanyaanCache(pertanyaan: string): string {
  return pertanyaan.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Sidik jari data pemeriksaan untuk kunci cache. Hanya kolom yang
 * terisi yang dipakai, dalam urutan tetap, agar hasil stabil.
 * Mengembalikan 'tanpa-konteks' bila tidak ada data sama sekali.
 */
export function sidikJariKonteks(konteks?: KonteksPerangkat): string {
  if (!konteks) {
    return 'tanpa-konteks';
  }
  const bagian: string[] = [];
  if (konteks.skorTerakhir !== undefined) {
    bagian.push(`skor=${konteks.skorTerakhir}`);
  }
  if (konteks.tanggalPemeriksaanTerakhir) {
    bagian.push(`tgl=${konteks.tanggalPemeriksaanTerakhir}`);
  }
  if (konteks.ringkasanPemeriksaanTerakhir) {
    bagian.push(`ringkasan=${konteks.ringkasanPemeriksaanTerakhir}`);
  }
  if (konteks.kecepatanUnduhKbpsTerakhir !== undefined) {
    bagian.push(`unduh=${konteks.kecepatanUnduhKbpsTerakhir}`);
  }
  if (konteks.latensiHttpMsTerakhir !== undefined) {
    bagian.push(`latensi=${konteks.latensiHttpMsTerakhir}`);
  }
  if (konteks.kekuatanSinyalTerakhir) {
    bagian.push(`sinyal=${konteks.kekuatanSinyalTerakhir}`);
  }
  return bagian.length > 0 ? bagian.join('|') : 'tanpa-konteks';
}

/**
 * Menghitung kunci cache (SHA-256 heksadesimal) dari id pengguna,
 * pertanyaan yang dinormalisasi, dan sidik jari konteks. Kunci
 * yang sama berarti pertanyaan + pengguna + data pemeriksaan sama.
 */
export async function hitungKunciCache(
  idPengguna: string,
  pertanyaan: string,
  konteks?: KonteksPerangkat,
): Promise<string> {
  const bahan = [
    VERSI_KONTEKS_CACHE,
    idPengguna,
    normalisasiPertanyaanCache(pertanyaan),
    sidikJariKonteks(konteks),
  ].join('\n');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(bahan),
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface BarisCacheAi {
  jawaban?: unknown;
  dibuat_pada?: unknown;
}

/**
 * Membaca jawaban tersimpan dari ai_cache. Mengembalikan jawaban
 * bila entri ada dan belum kedaluwarsa (maksimal 7 hari), null bila
 * tidak ada, kedaluwarsa, rusak, atau D1 gagal dibaca. `sekarang`
 * dapat diisi eksplisit untuk pengujian; bawaan waktu saat ini.
 */
export async function bacaCache(
  db: DbD1,
  kunciHash: string,
  sekarang: Date = new Date(),
): Promise<string | null> {
  try {
    const baris = await db
      .prepare(
        'SELECT jawaban, dibuat_pada FROM ai_cache ' +
          'WHERE pertanyaan_hash = ?',
      )
      .bind(kunciHash)
      .first<BarisCacheAi>();
    if (
      !baris ||
      typeof baris.jawaban !== 'string' ||
      baris.jawaban.length === 0 ||
      typeof baris.dibuat_pada !== 'string'
    ) {
      return null;
    }
    const waktu = Date.parse(baris.dibuat_pada);
    if (!Number.isFinite(waktu)) {
      return null;
    }
    if (sekarang.getTime() - waktu > CACHE_AI_TTL_MS) {
      return null;
    }
    return baris.jawaban;
  } catch {
    return null;
  }
}

/**
 * Menyimpan jawaban ke ai_cache (INSERT OR REPLACE — pertanyaan
 * yang sama menimpa entri lama, termasuk yang kedaluwarsa).
 * Mengembalikan true bila tersimpan, false bila jawaban kosong
 * atau D1 gagal ditulis. Tidak pernah melempar.
 */
export async function tulisCache(
  db: DbD1,
  kunciHash: string,
  jawaban: string,
  sekarang: Date = new Date(),
): Promise<boolean> {
  try {
    if (jawaban.length === 0) {
      return false;
    }
    await db
      .prepare(
        'INSERT OR REPLACE INTO ai_cache ' +
          '(id, pertanyaan_hash, jawaban, dibuat_pada) ' +
          'VALUES (?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        kunciHash,
        jawaban,
        sekarang.toISOString(),
      )
      .run();
    return true;
  } catch {
    return false;
  }
}
