// Laporan PDF riwayat + utilitas format tampilan riwayat.
//
// generatePdf() memakai dynamic import("jspdf") agar library jsPDF
// TIDAK masuk chunk awal (docs/performance.md bagian 3.2: jsPDF wajib
// lazy load, dimuat saat pengguna mengetuk "Unduh laporan PDF").
// Paket jspdf BELUM terpasang — deklarasi tipe lokal ada di
// src/types/jspdf.d.ts; tim integrasi memasang paket aslinya.
//
// Semua fungsi lain di file ini murni (tanpa efek samping) dan tidak
// bergantung pada jspdf, sehingga bisa diuji tanpa paket terpasang.
// Semua teks yang dihasilkan memakai data asli dari API — tanpa angka
// atau entri contoh (PRODUCT.md bagian 8).

// ---------------------------------------------------------------------------
// Tipe data API (bentuk sesuai docs/api-contracts.md)
// ---------------------------------------------------------------------------

export type SumberData = "web" | "apk" | "manual";

export type StatusKomponen = "baik" | "cukup" | "perlu_perhatian";

export interface KomponenRingkasan {
  status: StatusKomponen;
  skor: number;
  sumber: SumberData;
}

export type KunciKomponen =
  | "wifi"
  | "baterai"
  | "penyimpanan"
  | "performa"
  | "keamanan";

export interface HealthCheck {
  id: string;
  user_id: string;
  skor: number;
  ringkasan: Partial<Record<KunciKomponen, KomponenRingkasan>>;
  dibuat_pada: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: "pending" | "synced" | "failed";
}

export interface WifiReport {
  id: string;
  user_id: string;
  ssid: string | null;
  kecepatan_koneksi_mbps: number | null;
  kekuatan_sinyal: "lemah" | "sedang" | "kuat" | null;
  channel: number | null;
  dns: string | null;
  ping_ms: number | null;
  rekomendasi: string | null;
  kecepatan_unduh_kbps: number | null;
  sumber: SumberData;
  durasi_tes_detik: number | null;
  dibuat_pada: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AiDiagnosis {
  id: string;
  user_id: string;
  health_check_id: string | null;
  pertanyaan: string;
  jawaban: string;
  dibuat_pada: string;
}

// Satu entri riwayat yang sudah disatukan dari ketiga sumber.
export type EntriRiwayat =
  | { jenis: "kesehatan"; id: string; dibuatPada: string; data: HealthCheck }
  | { jenis: "wifi"; id: string; dibuatPada: string; data: WifiReport }
  | { jenis: "ai"; id: string; dibuatPada: string; data: AiDiagnosis };

export type JenisRiwayat = EntriRiwayat["jenis"];

export interface RingkasanJumlah {
  total: number;
  kesehatan: number;
  wifi: number;
  ai: number;
}

export interface LaporanPdfData {
  // Nama pengguna dari /auth/me; null bila tidak berhasil dimuat —
  // baris nama dihilangkan dari laporan, bukan dikarang.
  namaPengguna: string | null;
  // Label filter yang sedang aktif di halaman Riwayat
  // ("Semua", "Pemeriksaan kesehatan", "Tes WiFi", "Diagnosis AI").
  judulFilter: string;
  // Entri yang tampil di halaman (sudah terfilter), terbaru dulu.
  entri: EntriRiwayat[];
  dibuatPada: Date;
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

export const URUTAN_KOMPONEN: KunciKomponen[] = [
  "wifi",
  "baterai",
  "penyimpanan",
  "performa",
  "keamanan",
];

const LABEL_KOMPONEN: Record<KunciKomponen, string> = {
  wifi: "WiFi",
  baterai: "Baterai",
  penyimpanan: "Penyimpanan",
  performa: "Performa",
  keamanan: "Keamanan",
};

const LABEL_STATUS_KOMPONEN: Record<StatusKomponen, string> = {
  baik: "Baik",
  cukup: "Cukup",
  perlu_perhatian: "Perlu perhatian",
};

export function labelKomponen(kunci: KunciKomponen): string {
  return LABEL_KOMPONEN[kunci];
}

export function labelStatusKomponen(status: StatusKomponen): string {
  return LABEL_STATUS_KOMPONEN[status];
}

export function labelSinyal(
  sinyal: string | null | undefined,
): string {
  if (sinyal === "lemah") return "Lemah";
  if (sinyal === "sedang") return "Sedang";
  if (sinyal === "kuat") return "Kuat";
  return "tidak tersedia";
}

// Label sumber sesuai docs/copy.md bagian 0.
export function formatSumber(sumber: string | null | undefined): string {
  if (sumber === "web") return "Dari tes web";
  if (sumber === "manual") return "Diisi manual";
  if (sumber === "apk") return "Dari aplikasi Dokter HP";
  return "tidak tersedia";
}

// ---------------------------------------------------------------------------
// Format tanggal Indonesia (waktu lokal perangkat)
// ---------------------------------------------------------------------------

const FORMAT_TANGGAL_ID = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// "17 November 2026". Tanggal tidak valid menjadi "tidak tersedia".
export function formatTanggal(iso: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "tidak tersedia";
  return FORMAT_TANGGAL_ID.format(tanggal);
}

// "17 November 2026, 22.15" — format "[tanggal], [jam]" dari
// docs/copy.md bagian 0. Tanggal tidak valid menjadi "tidak tersedia".
export function formatTanggalWaktu(iso: string): string {
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "tidak tersedia";
  const jam = String(tanggal.getHours()).padStart(2, "0");
  const menit = String(tanggal.getMinutes()).padStart(2, "0");
  return `${FORMAT_TANGGAL_ID.format(tanggal)}, ${jam}.${menit}`;
}

// ---------------------------------------------------------------------------
// Kategori skor dan klasifikasi kecepatan
// ---------------------------------------------------------------------------

// Ambang kategori skor adalah konvensi tampilan frontend (80/50):
// dokumen produk menyebut tiga kategori (Baik / Cukup / Perlu
// perhatian) tanpa ambang angka. Tim dashboard memakai ambang yang
// sama agar kategori konsisten di semua layar.
export function kategoriSkor(
  skor: number,
): "Baik" | "Cukup" | "Perlu perhatian" {
  if (skor >= 80) return "Baik";
  if (skor >= 50) return "Cukup";
  return "Perlu perhatian";
}

export type KlasifikasiKecepatan =
  | "sangat lambat"
  | "lambat"
  | "cukup"
  | "cepat"
  | "sangat cepat";

// Ambang klasifikasi sesuai docs/api-contracts.md bagian 4
// (KB/detik, sama dengan APK).
export function klasifikasiKecepatan(kbps: number): KlasifikasiKecepatan {
  if (kbps < 50) return "sangat lambat";
  if (kbps < 200) return "lambat";
  if (kbps < 1000) return "cukup";
  if (kbps < 5000) return "cepat";
  return "sangat cepat";
}

// "3,2 KB/detik", "1,5 MB/detik". Nilai kosong menjadi "tidak tersedia".
export function formatKecepatan(
  kbps: number | null | undefined,
): string {
  if (kbps === null || kbps === undefined || !Number.isFinite(kbps) || kbps < 0) {
    return "tidak tersedia";
  }
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    return `${mbps.toLocaleString("id-ID", { maximumFractionDigits: 2 })} MB/detik`;
  }
  return `${kbps.toLocaleString("id-ID", { maximumFractionDigits: 1 })} KB/detik`;
}

// ---------------------------------------------------------------------------
// Penggabungan dan ringkasan riwayat (fungsi murni)
// ---------------------------------------------------------------------------

// Menggabungkan tiga daftar menjadi satu, diurutkan terbaru dulu.
export function gabungRiwayat(
  kesehatan: HealthCheck[],
  wifi: WifiReport[],
  ai: AiDiagnosis[],
): EntriRiwayat[] {
  const semua: EntriRiwayat[] = [
    ...kesehatan.map(
      (data): EntriRiwayat => ({
        jenis: "kesehatan",
        id: data.id,
        dibuatPada: data.dibuat_pada,
        data,
      }),
    ),
    ...wifi.map(
      (data): EntriRiwayat => ({
        jenis: "wifi",
        id: data.id,
        dibuatPada: data.dibuat_pada,
        data,
      }),
    ),
    ...ai.map(
      (data): EntriRiwayat => ({
        jenis: "ai",
        id: data.id,
        dibuatPada: data.dibuat_pada,
        data,
      }),
    ),
  ];
  semua.sort(
    (a, b) =>
      new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime(),
  );
  return semua;
}

export function hitungRingkasan(entri: EntriRiwayat[]): RingkasanJumlah {
  const jumlah: RingkasanJumlah = { total: entri.length, kesehatan: 0, wifi: 0, ai: 0 };
  for (const item of entri) {
    jumlah[item.jenis] += 1;
  }
  return jumlah;
}

// ---------------------------------------------------------------------------
// Entri menjadi baris teks (dipakai isi laporan PDF)
// ---------------------------------------------------------------------------

function barisKesehatan(data: HealthCheck): string[] {
  const baris = [
    `Pemeriksaan kesehatan — ${formatTanggalWaktu(data.dibuat_pada)}`,
    `Skor ${data.skor} dari 100 — ${kategoriSkor(data.skor)}`,
  ];
  const ringkasan = data.ringkasan ?? {};
  for (const kunci of URUTAN_KOMPONEN) {
    const komponen = ringkasan[kunci];
    if (!komponen) continue;
    baris.push(
      `${labelKomponen(kunci)}: ${labelStatusKomponen(komponen.status)} (skor ${komponen.skor}) — ${formatSumber(komponen.sumber)}`,
    );
  }
  return baris;
}

function barisWifi(data: WifiReport): string[] {
  const tesBertahan =
    data.durasi_tes_detik === 30 ? " (tes bertahan 30 detik)" : "";
  const baris = [
    `Tes WiFi${tesBertahan} — ${formatTanggalWaktu(data.dibuat_pada)}`,
  ];
  if (
    data.kecepatan_unduh_kbps === null ||
    data.kecepatan_unduh_kbps === undefined
  ) {
    baris.push("Kecepatan unduh: tidak tersedia");
  } else {
    baris.push(
      `Kecepatan unduh: ${formatKecepatan(data.kecepatan_unduh_kbps)} (${klasifikasiKecepatan(data.kecepatan_unduh_kbps)})`,
    );
  }
  if (data.ping_ms !== null && data.ping_ms !== undefined) {
    baris.push(`Latensi HTTP: ${data.ping_ms} ms`);
  }
  if (data.ssid) baris.push(`Nama WiFi: ${data.ssid}`);
  if (data.kekuatan_sinyal) {
    baris.push(`Kekuatan sinyal: ${labelSinyal(data.kekuatan_sinyal)}`);
  }
  if (data.channel !== null && data.channel !== undefined) {
    baris.push(`Channel: ${data.channel}`);
  }
  if (data.dns) baris.push(`DNS: ${data.dns}`);
  baris.push(`Sumber: ${formatSumber(data.sumber)}`);
  if (data.rekomendasi) baris.push(`Rekomendasi: ${data.rekomendasi}`);
  return baris;
}

function barisAi(data: AiDiagnosis): string[] {
  return [
    `Diagnosis AI — ${formatTanggalWaktu(data.dibuat_pada)}`,
    `Pertanyaan: ${data.pertanyaan}`,
    `Jawaban: ${data.jawaban}`,
  ];
}

// Mengubah satu entri riwayat menjadi baris-baris teks laporan.
// Baris pertama adalah judul entri; baris berikutnya adalah detail.
export function barisEntri(entri: EntriRiwayat): string[] {
  if (entri.jenis === "kesehatan") return barisKesehatan(entri.data);
  if (entri.jenis === "wifi") return barisWifi(entri.data);
  return barisAi(entri.data);
}

// ---------------------------------------------------------------------------
// Pembuatan PDF (client-side, data asli saja)
// ---------------------------------------------------------------------------

export function namaFilePdf(tanggal: Date): string {
  const tahun = tanggal.getFullYear();
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `dokter-hp-riwayat-${tahun}-${bulan}-${hari}.pdf`;
}

// Membuat laporan PDF di browser dari data riwayat asli, lalu mengunduh
// file-nya. jsPDF dimuat malas di sini (dynamic import) — bukan di
// bagian atas file — agar tidak masuk chunk awal.
export async function generatePdf(data: LaporanPdfData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const lebarHalaman = doc.internal.pageSize.getWidth();
  const tinggiHalaman = doc.internal.pageSize.getHeight();
  const margin = 15;
  const lebarTeks = lebarHalaman - margin * 2;
  const batasBawah = tinggiHalaman - margin;
  let y = margin;

  const halamanBaruBilaPerlu = (tinggiButuh: number): void => {
    if (y + tinggiButuh > batasBawah) {
      doc.addPage();
      y = margin;
    }
  };

  const tulisBaris = (teks: string, ukuran = 11, tebal = false): void => {
    doc.setFontSize(ukuran);
    doc.setFont("helvetica", tebal ? "bold" : "normal");
    const tinggiBaris = ukuran * 0.55;
    const potongan = doc.splitTextToSize(teks, lebarTeks);
    for (const baris of potongan) {
      halamanBaruBilaPerlu(tinggiBaris);
      doc.text(baris, margin, y);
      y += tinggiBaris;
    }
  };

  const spasi = (jarak = 4): void => {
    y += jarak;
  };

  // Kepala laporan.
  tulisBaris("Laporan Riwayat Dokter HP", 16, true);
  spasi(2);
  tulisBaris(`Dibuat: ${formatTanggalWaktu(data.dibuatPada.toISOString())}`);
  if (data.namaPengguna) {
    tulisBaris(`Nama: ${data.namaPengguna}`);
  }
  tulisBaris(`Filter: ${data.judulFilter}`);
  const jumlah = hitungRingkasan(data.entri);
  tulisBaris(
    `Jumlah entri: ${jumlah.total} (pemeriksaan kesehatan ${jumlah.kesehatan}, tes WiFi ${jumlah.wifi}, diagnosis AI ${jumlah.ai})`,
  );
  spasi(4);

  // Isi laporan — entri asli, tanpa angka contoh. Bila riwayat kosong,
  // laporan berisi baris jujur, bukan data karangan.
  if (data.entri.length === 0) {
    tulisBaris("Belum ada riwayat.");
  } else {
    data.entri.forEach((entri, indeks) => {
      if (indeks > 0) spasi(4);
      const baris = barisEntri(entri);
      baris.forEach((teks, posisi) => {
        tulisBaris(teks, 11, posisi === 0);
      });
    });
  }

  spasi(6);
  tulisBaris(
    "Laporan ini dibuat di browser dari data riwayat akun Anda. Data tidak dikirim ke layanan pihak ketiga.",
    9,
  );

  // Nomor halaman di setiap halaman.
  const totalHalaman = doc.getNumberOfPages();
  for (let halaman = 1; halaman <= totalHalaman; halaman += 1) {
    doc.setPage(halaman);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Halaman ${halaman} dari ${totalHalaman}`,
      margin,
      tinggiHalaman - 8,
    );
  }

  doc.save(namaFilePdf(data.dibuatPada));
}
