// apps/api/src/ai/fallback.ts
// Diagnosis tanpa AI (aturan berbasis data pemeriksaan).
//
// Dipakai saat layanan Gemini tidak tersedia — kuota harian proyek
// habis, galat jaringan, timeout, atau kunci belum diatur. Jawaban
// disusun dari data pemeriksaan pengguna (skor, kecepatan WiFi,
// latensi, sinyal) + langkah standar per topik, dan SELALU diawali
// pesan jujur bahwa jawaban ini bukan dari AI.
//
// Aturan kejujuran yang sama dengan prompt AI berlaku di sini:
// jangan mengarang data. Bila data pemeriksaan tidak tersedia,
// modul ini mengatakannya dan memberi langkah umum + saran untuk
// menjalankan pemeriksaan dulu.

import { LABEL_SARAN } from './prompt';
import type { KonteksPerangkat } from './prompt';

/** Topik keluhan yang dikenali dari kata kunci pertanyaan. */
export type TopikKeluhan =
  | 'wifi'
  | 'baterai'
  | 'penyimpanan'
  | 'performa'
  | 'keamanan'
  | 'umum';

/** Pesan jujur yang mengawali setiap jawaban fallback. */
export const PESAN_FALLBACK =
  'Diagnosis AI sedang tidak tersedia saat ini, jadi jawaban di bawah ini ' +
  'disusun dari data pemeriksaan Anda dengan panduan langkah standar — ' +
  'bukan dari AI.';

/**
 * Mendeteksi topik dari kata kunci dalam pertanyaan.
 * Pencocokan tidak peka huruf besar/kecil.
 */
export function deteksiTopik(pertanyaan: string): TopikKeluhan {
  const teks = pertanyaan.toLowerCase();
  if (
    /(wifi|wi-fi|internet|sinyal|jaringan|router|online|lemot.*unduh|unduh.*lemot)/.test(
      teks,
    )
  ) {
    return 'wifi';
  }
  if (/(baterai|batre|boros|panas|ngecas|cas|daya|habis.*cepat|cepat.*habis)/.test(teks)) {
    return 'baterai';
  }
  if (/(penyimpanan|penuh|memori|ruang|storage|tidak.*cukup.*ruang)/.test(teks)) {
    return 'penyimpanan';
  }
  if (/(lemot|lambat|lag|berat|macet|hang|nge-freeze|restart.*sendiri)/.test(teks)) {
    return 'performa';
  }
  if (/(keamanan|aman|virus|malware|izin|aplikasi.*asing|diretas|hack)/.test(teks)) {
    return 'keamanan';
  }
  return 'umum';
}

/** Klasifikasi kecepatan unduh (sama dengan PRODUCT.md bagian 4.4). */
function klasifikasiKecepatan(kbps: number): string {
  if (kbps < 50) return 'sangat lambat';
  if (kbps < 200) return 'lambat';
  if (kbps < 1000) return 'cukup';
  if (kbps < 5000) return 'cepat';
  return 'sangat cepat';
}

/**
 * Merangkai pengamatan dari data pemeriksaan. Mengembalikan daftar
 * kalimat; daftar kosong bila tidak ada data sama sekali.
 */
export function pengamatanDariData(konteks?: KonteksPerangkat): string[] {
  if (!konteks) {
    return [];
  }
  const hasil: string[] = [];
  if (konteks.skorTerakhir !== undefined) {
    const skor = konteks.skorTerakhir;
    const kategori =
      skor >= 80 ? 'Baik' : skor >= 50 ? 'Cukup' : 'Perlu perhatian';
    hasil.push(
      `Skor kesehatan terakhir Anda ${skor} dari 100 (kategori ${kategori}).`,
    );
  }
  if (konteks.kecepatanUnduhKbpsTerakhir !== undefined) {
    const kbps = konteks.kecepatanUnduhKbpsTerakhir;
    hasil.push(
      `Kecepatan unduh WiFi terakhir ${kbps} KB/detik (tergolong ${klasifikasiKecepatan(kbps)}).`,
    );
  }
  if (konteks.latensiHttpMsTerakhir !== undefined) {
    const ms = konteks.latensiHttpMsTerakhir;
    const kategori = ms > 300 ? 'tinggi' : ms > 100 ? 'sedang' : 'rendah';
    hasil.push(`Latensi HTTP terakhir ${ms} milidetik (tergolong ${kategori}).`);
  }
  if (konteks.kekuatanSinyalTerakhir) {
    hasil.push(
      `Kekuatan sinyal WiFi terakhir: ${konteks.kekuatanSinyalTerakhir}.`,
    );
  }
  return hasil;
}

const LANGKAH_PER_TOPIK: Record<TopikKeluhan, string[]> = {
  wifi: [
    'Dekatkan HP ke router, lalu ukur lagi kecepatan unduhnya.',
    'Matikan lalu nyalakan kembali WiFi di HP.',
    'Tutup unduhan atau video yang sedang berjalan di perangkat lain.',
    'Bila lambat hanya di HP ini, coba lupakan jaringan lalu sambungkan ulang.',
    'Bila lambat di semua perangkat, mulai ulang router dan tunggu 1 menit.',
    'Untuk pita 2,4 GHz, pastikan channel router memakai 1, 6, atau 11.',
  ],
  baterai: [
    'Buka Pengaturan > Baterai di HP untuk melihat aplikasi yang paling banyak memakai baterai.',
    'Kurangi kecerahan layar atau aktifkan kecerahan otomatis.',
    'Matikan Bluetooth, GPS, dan sinkronisasi otomatis bila tidak dipakai.',
    'Hindari mengisi daya sambil memakai HP untuk tugas berat.',
    'Bila baterai menggelembung atau HP sangat panas, berhenti memakai HP dan bawa ke teknisi.',
  ],
  penyimpanan: [
    'Buka Pengaturan > Penyimpanan untuk melihat apa yang paling banyak memakai ruang.',
    'Hapus foto dan video ganda, atau pindahkan ke penyimpanan lain.',
    'Hapus aplikasi yang sudah lama tidak dipakai.',
    'Kosongkan folder unduhan dari berkas yang sudah tidak perlu.',
  ],
  performa: [
    'Mulai ulang HP — ini menyelesaikan banyak masalah sementara.',
    'Tutup aplikasi yang berjalan di latar belakang.',
    'Periksa ruang penyimpanan kosong; HP melambat bila penyimpanan hampir penuh.',
    'Perbarui aplikasi dan sistem bila pembaruan tersedia.',
  ],
  keamanan: [
    'Buka Pengaturan > Aplikasi dan periksa aplikasi yang tidak dikenal.',
    'Hapus aplikasi yang tidak dikenal atau tidak pernah dipasang.',
    'Periksa izin aplikasi: aplikasi yang meminta izin di luar fungsinya patut dicurigai.',
    'Aktifkan kunci layar dan perbarui sistem bila pembaruan tersedia.',
  ],
  umum: [
    'Mulai ulang HP, lalu periksa apakah masalah masih muncul.',
    'Jalankan pemeriksaan di aplikasi ini agar kondisi HP tercatat.',
    'Perbarui aplikasi dan sistem bila pembaruan tersedia.',
  ],
};

/**
 * Menyusun jawaban fallback dari pertanyaan + data pemeriksaan.
 * Jawaban selalu diawali pesan jujur (bukan dari AI), diikuti
 * pengamatan data bila ada, lalu langkah per topik, dan ditutup
 * label saran.
 */
export function susunJawabanAturan(
  pertanyaan: string,
  konteks?: KonteksPerangkat,
): string {
  const topik = deteksiTopik(pertanyaan);
  const pengamatan = pengamatanDariData(konteks);
  const langkah = [...LANGKAH_PER_TOPIK[topik]];

  // Langkah tambahan berbasis data (bukan karangan): WiFi di bawah
  // 50 KB/detik hampir selalu soal router/jaringan, bukan HP —
  // sarankan memeriksa mode dan channel router.
  if (
    konteks?.kecepatanUnduhKbpsTerakhir !== undefined &&
    konteks.kecepatanUnduhKbpsTerakhir < 50
  ) {
    langkah.unshift(
      'Kecepatan WiFi Anda di bawah 50 KB/detik — periksa mode router ' +
        '(pita 2,4 GHz atau 5 GHz) dan channel yang dipakai; untuk pita ' +
        '2,4 GHz, channel 1, 6, atau 11 biasanya paling sedikit gangguan.',
    );
  }

  const bagian: string[] = [PESAN_FALLBACK, ''];
  if (pengamatan.length > 0) {
    bagian.push('Data pemeriksaan Anda:');
    for (const kalimat of pengamatan) {
      bagian.push(`- ${kalimat}`);
    }
    // Skor di bawah 50 berarti beberapa kategori perlu perhatian —
    // arahkan pengguna ke langkah per kategori dari pemeriksaan.
    if (konteks?.skorTerakhir !== undefined && konteks.skorTerakhir < 50) {
      bagian.push(
        'Skor di bawah 50 berarti beberapa kategori perlu perhatian — ' +
          'jalankan pemeriksaan untuk melihat kategori mana yang paling ' +
          'rendah, lalu mulai dari langkah kategori tersebut.',
      );
    }
    bagian.push('');
  } else {
    bagian.push(
      'Data pemeriksaan Anda belum tersedia, jadi langkah di bawah ini ' +
        'bersifat umum. Jalankan pemeriksaan di aplikasi ini agar ' +
        'panduan berikutnya bisa memakai data Anda.',
      '',
    );
  }
  bagian.push('Langkah yang dapat dicoba:');
  langkah.forEach((isi, i) => {
    bagian.push(`${i + 1}. ${isi}`);
  });
  bagian.push('', LABEL_SARAN);
  return bagian.join('\n');
}
