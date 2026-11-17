// apps/api/src/ai/ratelimit.ts
// Batas pemakaian Diagnosis AI: 20 pertanyaan per hari per pengguna
// (UTC), ditegakkan ATOMIK lewat tabel rate_limits (R-05).
//
// Semantik reserve-then-confirm:
// - Sebelum memanggil Gemini, rute memanggil cadangkanKuotaAi()
//   yang menaikkan penghitung harian lewat cekDanCatat (INSERT OR
//   IGNORE + UPDATE bersyarat — tepat 20 permintaan paralel yang
//   diizinkan, tanpa TOCTOU).
// - Cadangan DIKONFIRMASI oleh tersimpannya baris ai_diagnoses
//   (jawaban AI maupun cache) — tidak ada langkah konfirmasi
//   terpisah karena penghitung dan baris diagnosis sama-sama
//   bertambah satu per pertanyaan yang berhasil.
// - Bila Gemini gagal (fallback aturan dipakai) atau simpan
//   diagnosis gagal, cadangan DILEPAS lewat lepaskanKuotaAi()
//   sehingga kuota pengguna tidak terpotong.
// - cekBatasAi() membaca penghitung rate_limits yang sama (satu
//   sumber kebenaran); hitungPertanyaanHariIni() dipertahankan
//   sebagai metrik (jumlah baris diagnosis hari ini).
// KV tidak dipakai (batas tulis 1.000/hari).

import { cekDanCatat, jendelaHarian, type Jendela } from '../lib/ratelimit';
import type { DbD1, PernyataanD1 } from '../auth/session';

export type { DbD1, PernyataanD1 };

/** Batas pertanyaan AI per pengguna per hari (UTC). */
export const BATAS_AI_HARIAN = 20;

export interface StatusBatasAi {
  /** True bila pengguna masih boleh bertanya hari ini. */
  diizinkan: boolean;
  /** Jumlah pertanyaan yang sudah dipakai hari ini. */
  terpakai: number;
  /** Batas harian (BATAS_AI_HARIAN). */
  batas: number;
  /** Sisa pertanyaan hari ini (tidak pernah negatif). */
  sisa: number;
}

/** Jendela harian kuota AI satu pengguna (kunci `ai:<user>:<tanggal>`). */
export function jendelaKuotaAi(idPengguna: string, sekarang: Date = new Date()): Jendela {
  return jendelaHarian('ai', idPengguna, sekarang);
}

/**
 * Mencadangkan satu kuota AI secara atomik. Mengembalikan status
 * SESUDAH cadangan (terpakai sudah termasuk cadangan ini) dan
 * jendela yang dipakai, agar pemanggil dapat melepas cadangan
 * bila pertanyaan akhirnya tidak jadi dihitung.
 */
export async function cadangkanKuotaAi(
  db: DbD1,
  idPengguna: string,
  sekarang: Date = new Date(),
): Promise<{ status: StatusBatasAi; jendela: Jendela }> {
  const jendela = jendelaKuotaAi(idPengguna, sekarang);
  const hasil = await cekDanCatat(db, jendela, BATAS_AI_HARIAN);
  return {
    status: {
      diizinkan: hasil.diizinkan,
      terpakai: hasil.terpakai,
      batas: hasil.batas,
      sisa: hasil.sisa,
    },
    jendela,
  };
}

/**
 * Melepas satu cadangan kuota (bila Gemini gagal atau simpan
 * diagnosis gagal). Best-effort: kegagalan ditelan agar tidak
 * mengubah respons pengguna; penghitung tidak pernah di bawah 0.
 */
export async function lepaskanKuotaAi(db: DbD1, jendela: Jendela): Promise<void> {
  try {
    await db
      .prepare('UPDATE rate_limits SET jumlah = jumlah - 1 WHERE kunci = ? AND jumlah > 0')
      .bind(jendela.kunci)
      .run();
  } catch {
    // Abaikan: pelepasan gagal hanya berarti satu kuota hilang
    // sampai reset harian, bukan galat yang terlihat pengguna.
  }
}

/**
 * Menghitung pertanyaan AI pengguna pada hari ini (UTC) dari
 * baris ai_diagnoses yang tersimpan. Dipakai sebagai metrik;
 * penegakan batas memakai penghitung rate_limits (cadangkanKuotaAi).
 */
export async function hitungPertanyaanHariIni(
  db: DbD1,
  idPengguna: string,
  sekarang: Date = new Date(),
): Promise<number> {
  const pernyataan = db
    .prepare(
      'SELECT COUNT(*) AS jumlah FROM ai_diagnoses ' +
        'WHERE user_id = ? AND date(dibuat_pada) = date(?)',
    )
    .bind(idPengguna, sekarang.toISOString());
  const baris = await pernyataan.first<{ jumlah?: unknown }>();
  const jumlah = baris?.jumlah;
  if (typeof jumlah === 'number' && Number.isFinite(jumlah) && jumlah >= 0) {
    return Math.floor(jumlah);
  }
  if (typeof jumlah === 'string') {
    const angka = Number.parseInt(jumlah, 10);
    if (Number.isFinite(angka) && angka >= 0) {
      return angka;
    }
  }
  return 0;
}

/**
 * Memeriksa apakah pengguna masih boleh bertanya hari ini, dibaca
 * dari penghitung rate_limits (satu sumber kebenaran dengan
 * cadangkanKuotaAi). Tidak mengubah penghitung.
 */
export async function cekBatasAi(
  db: DbD1,
  idPengguna: string,
  sekarang: Date = new Date(),
): Promise<StatusBatasAi> {
  const jendela = jendelaKuotaAi(idPengguna, sekarang);
  const baris = await db
    .prepare('SELECT jumlah FROM rate_limits WHERE kunci = ?')
    .bind(jendela.kunci)
    .first<{ jumlah?: unknown }>();
  const jumlah = baris?.jumlah;
  const terpakai =
    typeof jumlah === 'number' && Number.isFinite(jumlah) && jumlah >= 0
      ? Math.floor(jumlah)
      : 0;
  const batas = BATAS_AI_HARIAN;
  const sisa = Math.max(0, batas - terpakai);
  return { diizinkan: terpakai < batas, terpakai, batas, sisa };
}
