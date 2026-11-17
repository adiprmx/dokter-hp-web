// Utilitas murni untuk layar Pengaturan akun (/pengaturan).
// Fungsi-fungsi di sini tidak menyentuh jaringan atau DOM, sehingga
// bisa diuji langsung (lihat akun.test.ts).

/**
 * Versi aplikasi web yang tampil di Pengaturan dan Tentang.
 * Samakan dengan "version" di apps/web/package.json.
 */
export const VERSI_APLIKASI_WEB = "0.1.0";

/** Panjang nama tampilan yang diterima server (kontrak API §6.2). */
export const PANJANG_NAMA_MAKSIMAL = 100;

/**
 * Memeriksa teks konfirmasi hapus akun.
 *
 * Perbandingan persis (peka huruf besar-kecil, tanpa memangkas
 * spasi): server hanya menerima kata yang persis sama
 * (kontrak API §6.5).
 *
 * Kata yang diharapkan diterima sebagai parameter, bukan ditulis
 * langsung di sini — kata ini bergantung bahasa aktif (kunci i18n
 * settings.deleteAccountConfirmWord: "HAPUS" untuk Indonesia,
 * "DELETE" untuk Inggris). Selama pemilih bahasa belum dipasang,
 * pemanggil memakai "HAPUS".
 */
export function konfirmasiHapusValid(
  masukan: string,
  kataYangDiharapkan: string,
): boolean {
  return masukan === kataYangDiharapkan;
}

export type HasilValidasiNama =
  | { valid: true; nama: string }
  | { valid: false; pesan: string };

/**
 * Memvalidasi nama tampilan: tidak boleh kosong dan maksimal 100
 * karakter setelah dipangkas (kontrak API §6.2). Bila valid,
 * kembalikan nama yang sudah dipangkas agar yang dikirim ke server
 * bersih dari spasi di ujung.
 */
export function validasiNama(nama: string): HasilValidasiNama {
  const sudahDipangkas = nama.trim();
  if (sudahDipangkas.length === 0) {
    return { valid: false, pesan: "Nama tidak boleh kosong." };
  }
  if (sudahDipangkas.length > PANJANG_NAMA_MAKSIMAL) {
    return {
      valid: false,
      pesan: `Nama terlalu panjang. Maksimal ${PANJANG_NAMA_MAKSIMAL} karakter.`,
    };
  }
  return { valid: true, nama: sudahDipangkas };
}

/**
 * Mengubah user agent menjadi label perangkat yang mudah dibaca,
 * misalnya "Chrome di Android". Bila user agent kosong, kembalikan
 * "tidak tersedia" — bukan tebakan.
 */
export function labelPerangkat(userAgent: string | null | undefined): string {
  if (!userAgent) {
    return "tidak tersedia";
  }
  let sistem = "";
  if (/Android/i.test(userAgent)) {
    sistem = "Android";
  } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
    sistem = "iPhone/iPad";
  } else if (/Windows/i.test(userAgent)) {
    sistem = "Windows";
  } else if (/Mac OS X/i.test(userAgent)) {
    sistem = "Mac";
  } else if (/Linux/i.test(userAgent)) {
    sistem = "Linux";
  }

  let peramban = "";
  if (/Edg\//i.test(userAgent)) {
    peramban = "Edge";
  } else if (/SamsungBrowser/i.test(userAgent)) {
    peramban = "Samsung Internet";
  } else if (/Firefox/i.test(userAgent)) {
    peramban = "Firefox";
  } else if (/Chrome/i.test(userAgent)) {
    peramban = "Chrome";
  } else if (/Safari/i.test(userAgent)) {
    peramban = "Safari";
  }

  if (peramban && sistem) {
    return `${peramban} di ${sistem}`;
  }
  if (peramban) {
    return peramban;
  }
  if (sistem) {
    return sistem;
  }
  return "Perangkat tidak dikenal";
}

/**
 * Memformat waktu ISO 8601 menjadi "17 November 2026, 22.15"
 * (format copy.md §0). Nilai yang tidak bisa dibaca menghasilkan
 * "tidak tersedia". Zona waktu opsional; tanpa zona waktu, dipakai
 * zona waktu perangkat.
 */
export function formatTanggalWaktu(iso: string, zonaWaktu?: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) {
    return "tidak tersedia";
  }
  const bagianTanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: zonaWaktu,
  }).format(tanggal);
  const bagianJam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zonaWaktu,
  }).format(tanggal);
  return `${bagianTanggal}, ${bagianJam}`;
}
