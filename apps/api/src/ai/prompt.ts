// apps/api/src/ai/prompt.ts
// Prompt sistem Diagnosis AI Dokter HP (server-side).
// Bahasa Indonesia netral dan profesional.

/**
 * Konteks perangkat pengguna yang dirakit Worker dari D1 sebelum
 * pertanyaan dikirim ke Gemini. Semua kolom opsional: bila data
 * tidak tersedia, konteks dilewati dan model diberitahu bahwa
 * data tidak tersedia (bukan diisi angka contoh).
 */
export interface KonteksPerangkat {
  /** Skor pemeriksaan kesehatan terakhir (0-100), bila ada. */
  skorTerakhir?: number;
  /** Tanggal pemeriksaan terakhir (ISO 8601), bila ada. */
  tanggalPemeriksaanTerakhir?: string;
  /** Ringkasan pemeriksaan terakhir dalam bentuk teks singkat, bila ada. */
  ringkasanPemeriksaanTerakhir?: string;
  /** Kecepatan unduh WiFi terakhir dalam KB/detik, bila ada. */
  kecepatanUnduhKbpsTerakhir?: number;
  /** Latensi HTTP terakhir dalam milidetik, bila ada. */
  latensiHttpMsTerakhir?: number;
  /** Kekuatan sinyal terakhir (lemah / sedang / kuat), bila ada. */
  kekuatanSinyalTerakhir?: string;
}

/**
 * Prompt sistem untuk Diagnosis AI. Aturan yang diikat di sini:
 * jawab praktis langkah-demi-langkah, akui bila tidak tahu, jangan
 * mengarang, dan jawaban selalu dilabeli sebagai saran.
 */
export const SYSTEM_PROMPT = [
  'Anda adalah asisten diagnosis HP pada aplikasi Dokter HP.',
  'Tugas Anda: membantu pengguna memahami masalah HP sehari-hari (WiFi, baterai, penyimpanan, performa, keamanan) dan memberi langkah perbaikan yang praktis.',
  '',
  'Aturan jawaban:',
  '1. Jawab dalam Bahasa Indonesia yang netral, sopan, dan mudah dipahami pengguna awam.',
  '2. Beri langkah perbaikan yang praktis dan berurutan, dengan nomor langkah.',
  '3. Bila data yang tersedia tidak cukup untuk memastikan penyebab, katakan dengan jujur bahwa penyebab belum bisa dipastikan, lalu beri langkah pemeriksaan lanjutan.',
  '4. Jangan mengarang spesifikasi, angka, nama fitur, atau menu yang tidak Anda ketahui. Bila tidak tahu, katakan tidak tahu.',
  '5. Bila gejalanya mengarah ke kerusakan perangkat keras (misalnya baterai menggelembung, HP panas berlebih, layar bergaris), sarankan pengguna membawa HP ke teknisi dan jangan menyarankan membuka perangkat sendiri.',
  '6. Jangan pernah mengklaim bisa membaca sensor HP, sinyal WiFi, atau kondisi perangkat secara langsung. Aplikasi web hanya tahu data yang diberikan pada konteks di bawah ini.',
  '7. Jangan meminta atau mengulang data pribadi seperti nama lengkap, alamat, nomor telepon, atau kata sandi.',
  '8. Jawaban Anda adalah saran, bukan vonis pasti. Akhiri jawaban dengan satu kalimat penutup: "Jawaban ini adalah saran, bukan vonis pasti. Bila masalah berlanjut, pertimbangkan bantuan teknisi."',
  '9. Jawaban ringkas dan langsung ke inti; hindari pengantar yang bertele-tele.',
].join('\n');

/** Label penanda jawaban AI sebagai saran (dipakai di respons API). */
export const LABEL_SARAN =
  'Jawaban ini adalah saran, bukan vonis pasti. Bila masalah berlanjut, pertimbangkan bantuan teknisi.';

/**
 * Merakit pesan pengguna untuk Gemini dari pertanyaan + konteks
 * perangkat. Konteks yang kosong dinyatakan tidak tersedia secara
 * eksplisit agar model tidak mengarang data perangkat.
 */
export function buildUserMessage(
  pertanyaan: string,
  konteks?: KonteksPerangkat,
): string {
  const bagian: string[] = [];

  if (konteks) {
    const baris: string[] = [];
    if (konteks.skorTerakhir !== undefined) {
      baris.push(`- Skor kesehatan terakhir: ${konteks.skorTerakhir} dari 100.`);
    }
    if (konteks.tanggalPemeriksaanTerakhir) {
      baris.push(
        `- Tanggal pemeriksaan terakhir: ${konteks.tanggalPemeriksaanTerakhir}.`,
      );
    }
    if (konteks.ringkasanPemeriksaanTerakhir) {
      baris.push(
        `- Ringkasan pemeriksaan terakhir: ${konteks.ringkasanPemeriksaanTerakhir}.`,
      );
    }
    if (konteks.kecepatanUnduhKbpsTerakhir !== undefined) {
      baris.push(
        `- Kecepatan unduh WiFi terakhir: ${konteks.kecepatanUnduhKbpsTerakhir} KB/detik.`,
      );
    }
    if (konteks.latensiHttpMsTerakhir !== undefined) {
      baris.push(
        `- Latensi HTTP terakhir: ${konteks.latensiHttpMsTerakhir} milidetik.`,
      );
    }
    if (konteks.kekuatanSinyalTerakhir) {
      baris.push(
        `- Kekuatan sinyal WiFi terakhir: ${konteks.kekuatanSinyalTerakhir}.`,
      );
    }
    if (baris.length > 0) {
      bagian.push(
        'Data perangkat pengguna (dari riwayat pemeriksaan):\n' +
          baris.join('\n'),
      );
    } else {
      bagian.push(
        'Data perangkat pengguna: tidak tersedia. Jangan mengasumsikan kondisi perangkat tertentu.',
      );
    }
  } else {
    bagian.push(
      'Data perangkat pengguna: tidak tersedia. Jangan mengasumsikan kondisi perangkat tertentu.',
    );
  }

  bagian.push(`Keluhan pengguna: ${pertanyaan}`);
  return bagian.join('\n\n');
}
