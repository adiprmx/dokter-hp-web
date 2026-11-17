// apps/api/src/ai/gemini.ts
// Panggilan server-side ke Google Gemini API (v1beta generateContent).
// Kunci API HANYA diterima lewat parameter (berasal dari secret Worker
// GEMINI_API_KEY). File ini tidak pernah menyimpan, mencatat, atau
// mencetak kunci. Detail galat dari Gemini tidak pernah diteruskan
// mentah ke client.
//
// Model utama: Flash-Lite (kuota free tier 500 request/hari per
// proyek — lihat docs/riset-free-tier.md bagian 3). Model Flash
// standar hanya 20 request/hari dan TIDAK dipakai.
// ID model TERVERIFIKASI VIA API (17 Nov 2026, GET /v1beta/models
// memakai kunci proyek — 50 model terdaftar): `gemini-3.5-flash-lite`
// adalah varian Flash-Lite stabil terbaru yang mendukung
// generateContent, dan `gemini-3.1-flash-lite` tersedia sebagai
// cadangan. Model lama `gemini-2.0-flash` TIDAK ada lagi di daftar
// API dan tidak boleh dipakai. Angka kuota 500 RPD masih bersumber
// sekunder (dokumentasi resmi Google tidak memublikasikan angka per
// model) — wajib dikonfirmasi di halaman rate limit AI Studio
// sebelum peluncuran (riset-free-tier.md).
//
// Privasi: konten yang dikirim lewat free tier dapat dipakai Google
// untuk meningkatkan produknya. Modul ini hanya mengirim pertanyaan
// pengguna + ringkasan data pemeriksaan (skor, kecepatan, latensi) —
// tanpa nama, email, nomor telepon, atau data pribadi lain.
//
// Catatan API: mulai model Gemini 3.6 Flash / 3.5 Flash-Lite,
// parameter sampling `temperature`, `top_p`, `top_k` sudah tidak
// berlaku (deprecated) — generationConfig di sini hanya memakai
// maxOutputTokens.

/**
 * Model utama Diagnosis AI: Gemini 3.5 Flash-Lite (500 RPD free tier).
 */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Model cadangan: Gemini 3.1 Flash-Lite (500 RPD free tier).
 * Dipakai satu kali bila model utama menjawab 404 (model tidak
 * ditemukan) atau 429 (kuota model utama habis — RPD dihitung
 * per model per proyek, sehingga model cadangan punya jatah
 * sendiri). Bila cadangan juga gagal, galat diteruskan.
 */
export const GEMINI_MODEL_CADANGAN = 'gemini-3.1-flash-lite';

/** Batas waktu tiap percobaan panggilan Gemini (30 detik). */
export const GEMINI_TIMEOUT_MS = 30_000;

/** Batas atas panjang jawaban yang disimpan (karakter). */
export const JAWABAN_MAKS_KARAKTER = 8_000;

/** Kode galat internal Gemini (tidak diekspos mentah ke client). */
export type KodeGalatGemini =
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_TIDAK_TERSEDIA'
  | 'GEMINI_KUOTA_HABIS'
  | 'GEMINI_RESPON_TIDAK_VALID'
  | 'GEMINI_KUNCI_BELUM_DIATUR';

/**
 * Galat dari pemanggilan Gemini. Pesan `message` aman untuk log
 * server (tidak memuat kunci, isi respons, atau detail internal
 * penyedia). Pesan untuk pengguna akhir diputuskan di lapisan rute.
 */
export class GalatGemini extends Error {
  readonly kode: KodeGalatGemini;
  readonly statusHttp?: number;

  constructor(kode: KodeGalatGemini, statusHttp?: number) {
    super(kode);
    this.name = 'GalatGemini';
    this.kode = kode;
    this.statusHttp = statusHttp;
  }
}

export interface OpsiTanyaGemini {
  /** Kunci API Gemini (dari secret Worker GEMINI_API_KEY). */
  kunciApi: string;
  /** Prompt sistem (lihat prompt.ts). */
  promptSistem: string;
  /** Pesan pengguna (pertanyaan + konteks perangkat). */
  pesanPengguna: string;
  /** Model utama; bawaan GEMINI_MODEL. */
  model?: string;
  /**
   * Model cadangan; bawaan GEMINI_MODEL_CADANGAN. Isi null untuk
   * menonaktifkan percobaan cadangan.
   */
  modelCadangan?: string | null;
  /** Batas waktu per percobaan dalam milidetik; bawaan GEMINI_TIMEOUT_MS. */
  batasWaktuMs?: number;
  /**
   * Implementasi fetch yang dipakai. Bawaan fetch global.
   * Parameter ini ada untuk pengujian (mock fetch).
   */
  fetchFn?: typeof fetch;
  /** Sinyal pembatalan dari pemanggil (opsional). */
  sinyal?: AbortSignal;
}

/** Bentuk minimal respons generateContent yang dipakai modul ini. */
interface BagianTeks {
  text?: unknown;
}

interface KandidatGemini {
  content?: { parts?: unknown };
  finishReason?: unknown;
}

interface ResponsGemini {
  candidates?: unknown;
  promptFeedback?: unknown;
}

/**
 * Mengambil teks jawaban dari badan JSON respons Gemini secara aman.
 * Mengembalikan null bila struktur tidak sesuai, bila tidak ada
 * kandidat, bila semua bagian teks kosong, atau bila respons
 * diblokir sehingga tidak ada teks yang bisa dipakai.
 */
export function parseJawabanGemini(badan: unknown): string | null {
  if (typeof badan !== 'object' || badan === null) {
    return null;
  }
  const respons = badan as ResponsGemini;
  if (!Array.isArray(respons.candidates) || respons.candidates.length === 0) {
    return null;
  }
  const teks: string[] = [];
  for (const kandidat of respons.candidates as KandidatGemini[]) {
    if (typeof kandidat !== 'object' || kandidat === null) {
      continue;
    }
    const parts = kandidat.content?.parts;
    if (!Array.isArray(parts)) {
      continue;
    }
    for (const bagian of parts as BagianTeks[]) {
      if (
        typeof bagian === 'object' &&
        bagian !== null &&
        typeof bagian.text === 'string' &&
        bagian.text.length > 0
      ) {
        teks.push(bagian.text);
      }
    }
  }
  if (teks.length === 0) {
    return null;
  }
  const gabungan = teks.join('').trim();
  if (gabungan.length === 0) {
    return null;
  }
  return gabungan.slice(0, JAWABAN_MAKS_KARAKTER);
}

function bangunUrl(model: string, kunciApi: string): string {
  const dasar = 'https://generativelanguage.googleapis.com';
  return `${dasar}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(kunciApi)}`;
}

/**
 * Satu percobaan panggilan generateContent ke satu model.
 * Melempar GalatGemini dengan statusHttp bila respons HTTP gagal.
 */
async function panggilSekali(
  model: string,
  kunciApi: string,
  promptSistem: string,
  pesanPengguna: string,
  batasWaktuMs: number,
  fetchFn: typeof fetch,
  sinyal?: AbortSignal,
): Promise<string> {
  const pengendali = new AbortController();
  const pengaturWaktu = setTimeout(() => pengendali.abort(), batasWaktuMs);

  const batalkanBilaSinyalLuar = (): void => pengendali.abort();
  if (sinyal) {
    if (sinyal.aborted) {
      clearTimeout(pengaturWaktu);
      throw new GalatGemini('GEMINI_TIMEOUT');
    }
    sinyal.addEventListener('abort', batalkanBilaSinyalLuar, { once: true });
  }

  try {
    let respons: Response;
    try {
      respons = await fetchFn(bangunUrl(model, kunciApi), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: promptSistem }] },
          contents: [{ role: 'user', parts: [{ text: pesanPengguna }] }],
          // Tanpa temperature/top_p/top_k: parameter sampling sudah
          // deprecated sejak model 3.5/3.6 (lihat catatan di atas).
          generationConfig: { maxOutputTokens: 2048 },
        }),
        signal: pengendali.signal,
      });
    } catch {
      if (pengendali.signal.aborted) {
        throw new GalatGemini('GEMINI_TIMEOUT');
      }
      throw new GalatGemini('GEMINI_TIDAK_TERSEDIA');
    }

    if (!respons.ok) {
      // 429 berarti kuota model ini habis (RPD/RPM/TPM) — dipetakan
      // ke kode sendiri (GEMINI_KUOTA_HABIS) agar lapisan rute dapat
      // memberi pesan jujur dan agar model cadangan (yang punya
      // jatah RPD sendiri per model per proyek) dicoba. Status lain
      // dipetakan ke GEMINI_TIDAK_TERSEDIA; status tidak diteruskan
      // ke client.
      if (respons.status === 429) {
        throw new GalatGemini('GEMINI_KUOTA_HABIS', 429);
      }
      throw new GalatGemini('GEMINI_TIDAK_TERSEDIA', respons.status);
    }

    let badan: unknown;
    try {
      badan = (await respons.json()) as unknown;
    } catch {
      throw new GalatGemini('GEMINI_RESPON_TIDAK_VALID');
    }

    const jawaban = parseJawabanGemini(badan);
    if (jawaban === null) {
      throw new GalatGemini('GEMINI_RESPON_TIDAK_VALID');
    }
    return jawaban;
  } finally {
    clearTimeout(pengaturWaktu);
    if (sinyal) {
      sinyal.removeEventListener('abort', batalkanBilaSinyalLuar);
    }
  }
}

/**
 * Mengirim satu pertanyaan ke Gemini dan mengembalikan teks jawaban.
 *
 * - Timeout 30 detik per percobaan (AbortController; sinyal
 *   pemanggil dihormati).
 * - Kunci API hanya dipakai di URL panggilan server-side ini.
 * - Bila model utama menjawab 404 atau 429, dicoba satu kali
 *   model cadangan (kecuali cadangan dinonaktifkan).
 * - Galat jaringan / HTTP / parsing dipetakan ke GalatGemini
 *   dengan kode internal; detail respons tidak pernah dibocorkan.
 */
export async function tanyaGemini(opsi: OpsiTanyaGemini): Promise<string> {
  const {
    kunciApi,
    promptSistem,
    pesanPengguna,
    model = GEMINI_MODEL,
    modelCadangan = GEMINI_MODEL_CADANGAN,
    batasWaktuMs = GEMINI_TIMEOUT_MS,
    fetchFn = fetch,
    sinyal,
  } = opsi;

  if (!kunciApi || kunciApi.trim().length === 0) {
    throw new GalatGemini('GEMINI_KUNCI_BELUM_DIATUR');
  }

  try {
    return await panggilSekali(
      model,
      kunciApi,
      promptSistem,
      pesanPengguna,
      batasWaktuMs,
      fetchFn,
      sinyal,
    );
  } catch (galat) {
    const bolehCadangan =
      modelCadangan !== null &&
      modelCadangan !== '' &&
      modelCadangan !== model &&
      galat instanceof GalatGemini &&
      ((galat.kode === 'GEMINI_KUOTA_HABIS' && galat.statusHttp === 429) ||
        (galat.kode === 'GEMINI_TIDAK_TERSEDIA' &&
          galat.statusHttp === 404));
    if (!bolehCadangan || !(galat instanceof GalatGemini)) {
      throw galat;
    }
    // Percobaan cadangan: hasilnya (sukses/gagal) adalah hasil akhir.
    return panggilSekali(
      modelCadangan as string,
      kunciApi,
      promptSistem,
      pesanPengguna,
      batasWaktuMs,
      fetchFn,
      sinyal,
    );
  }
}
