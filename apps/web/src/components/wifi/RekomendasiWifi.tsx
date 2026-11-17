// Daftar rekomendasi Dokter WiFi berdasarkan hasil tes.
// Keenam teks berasal dari docs/copy.md 5 (bagian Rekomendasi);
// urutan disesuaikan dengan hasil tes — yang paling sesuai
// dengan hasil tampil paling atas, sisanya tetap tampil.

export interface MasukanRekomendasi {
  /** Kecepatan unduh hasil tes (KB/detik), atau null bila belum ada. */
  kecepatanKbps: number | null;
  /** Latensi HTTP hasil tes (ms), atau null bila belum ada. */
  latensiMs: number | null;
  /** Kekuatan sinyal input manual (dBm, negatif), atau null. */
  sinyalDbm: number | null;
}

interface Rekomendasi {
  id: string;
  teks: string;
  /** Benar bila rekomendasi ini paling sesuai dengan hasil tes. */
  sesuai: boolean;
}

function susunRekomendasi(masukan: MasukanRekomendasi): Rekomendasi[] {
  const { kecepatanKbps, latensiMs, sinyalDbm } = masukan;
  const daftar: Rekomendasi[] = [
    {
      id: "dekat-router",
      teks: "Coba mendekat ke router, lalu tes lagi.",
      sesuai: sinyalDbm !== null && sinyalDbm < -70,
    },
    {
      id: "unduhan-lain",
      teks:
        "Tutup unduhan atau video yang sedang berjalan di perangkat " +
        "lain, lalu tes lagi.",
      sesuai: latensiMs !== null && latensiMs >= 150,
    },
    {
      id: "channel-router",
      teks:
        "Bila masih lemot, ganti channel router 2,4 GHz ke 1, 6, " +
        "atau 11. Ketiga channel itu tidak saling mengganggu.",
      sesuai: kecepatanKbps !== null && kecepatanKbps < 200,
    },
    {
      id: "mode-router",
      teks:
        "Periksa mode router di halaman pengaturan router. Bila " +
        "masih memakai mode lama, ubah ke mode campuran (b/g/n) " +
        "agar kecepatan tidak dibatasi.",
      sesuai: kecepatanKbps !== null && kecepatanKbps < 50,
    },
    {
      id: "ganti-dns",
      teks:
        "Coba ganti DNS ke 1.1.1.1 atau 8.8.8.8 dari pengaturan " +
        "jaringan di HP.",
      sesuai: latensiMs !== null && latensiMs >= 150,
    },
    {
      id: "lupakan-jaringan",
      teks:
        "Coba lupakan jaringan WiFi ini, lalu sambung ulang dengan " +
        "memasukkan kata sandi lagi.",
      sesuai: false,
    },
  ];
  // Yang sesuai hasil tampil dulu; urutan sisanya dipertahankan.
  return [...daftar].sort(
    (a, b) => Number(b.sesuai) - Number(a.sesuai),
  );
}

/**
 * Ringkasan rekomendasi sebagai satu teks (untuk kolom `rekomendasi`
 * laporan WiFi, maks 2000 karakter di kontrak API).
 */
export function rangkumRekomendasi(masukan: MasukanRekomendasi): string {
  return susunRekomendasi(masukan)
    .map((r) => r.teks)
    .join(" ");
}

interface RekomendasiWifiProps {
  masukan: MasukanRekomendasi;
}

export default function RekomendasiWifi({ masukan }: RekomendasiWifiProps) {
  const daftar = susunRekomendasi(masukan);

  return (
    <div>
      <ul className="space-y-3">
        {daftar.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-zinc-500 bg-zinc-900 px-4 py-3"
          >
            <p className="text-sm leading-relaxed text-zinc-100">
              {item.teks}
            </p>
            {item.sesuai && (
              <p className="mt-1 text-xs text-zinc-300">
                Paling sesuai dengan hasil tes Anda.
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        Versi web tidak bisa membuka pengaturan WiFi di HP secara
        langsung. Langkah di atas perlu dilakukan sendiri dari
        pengaturan HP atau halaman router.
      </p>
      <p className="mt-3 text-sm">
        <a
          href="#panduan-wifi-lemot"
          className="font-medium text-white underline focus-visible:outline-2 focus-visible:outline-white"
        >
          Baca panduan WiFi lemot: cara mencari penyebabnya
        </a>
      </p>
    </div>
  );
}
