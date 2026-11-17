import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchJson } from "../lib/api";
import {
  URUTAN_KOMPONEN,
  formatKecepatan,
  formatSumber,
  formatTanggalWaktu,
  gabungRiwayat,
  generatePdf,
  kategoriSkor,
  klasifikasiKecepatan,
  labelKomponen,
  labelSinyal,
  labelStatusKomponen,
  type AiDiagnosis,
  type EntriRiwayat,
  type HealthCheck,
  type WifiReport,
} from "../lib/pdf";

// Halaman Riwayat — rute /riwayat (wajib masuk; pengait rute di App.tsx
// menjadi tanggung jawab tim integrasi, bersama lazy loading rute).
// Menggabungkan tiga daftar dari API (pemeriksaan kesehatan, laporan
// WiFi, diagnosis AI), terbaru dulu, dengan filter per jenis, hapus
// per entri, dan unduh laporan PDF client-side.
//
// Teks layar mengikuti docs/copy.md bagian 11. Desain mengikuti design
// lock hitam/putih dan token a11y (K-11): teks minimal Zinc 400,
// border komponen interaktif minimal Zinc 500, target sentuh 48x48 px.

// Jumlah maksimum baris per daftar yang diminta ke API (batas atas
// kontrak: limit 1-100). Riwayat mengambil halaman pertama tiap jenis;
// bila masih ada entri lama di luar itu, halaman menampilkan catatan.
const BATAS_DAFTAR = 100;

type Filter = "semua" | "kesehatan" | "wifi" | "ai";

const LABEL_FILTER: Record<Filter, string> = {
  semua: "Semua",
  kesehatan: "Pemeriksaan kesehatan",
  wifi: "Tes WiFi",
  ai: "Diagnosis AI",
};

const DAFTAR_FILTER: Filter[] = ["semua", "kesehatan", "wifi", "ai"];

interface DaftarResponse<T> {
  success: boolean;
  data: T[];
  meta?: {
    pagination?: {
      limit: number;
      offset: number;
      total: number;
      has_more: boolean;
    };
  };
}

interface MeResponse {
  success: boolean;
  data: { id: string; nama: string; email: string };
}

type StatusMuat = "memuat" | "siap" | "galat" | "sesi-habis";

interface Pesan {
  jenis: "sukses" | "galat";
  teks: string;
}

const KELAS_TOMBOL_UTAMA =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50";

const KELAS_TOMBOL_SEKUNDER =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50";

const KELAS_TOMBOL_BAHAYA =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50";

async function ambilDaftar<T>(
  path: string,
): Promise<{ items: T[]; adaLagi: boolean }> {
  const res = await fetchJson<DaftarResponse<T>>(
    `${path}?limit=${BATAS_DAFTAR}&offset=0`,
    { credentials: "include" },
  );
  return {
    items: Array.isArray(res.data) ? res.data : [],
    adaLagi: res.meta?.pagination?.has_more === true,
  };
}

// Nama pengguna untuk kepala laporan PDF. Gagal dimuat bukan galat
// fatal: laporan dibuat tanpa baris nama, bukan dengan nama karangan.
async function ambilNamaPengguna(): Promise<string | null> {
  try {
    const res = await fetchJson<MeResponse>("/api/auth/me", {
      credentials: "include",
    });
    return typeof res.data?.nama === "string" && res.data.nama.length > 0
      ? res.data.nama
      : null;
  } catch {
    return null;
  }
}

// fetchJson melempar Error "Permintaan <path> gagal: <status>" —
// status 401 berarti sesi sudah berakhir.
function galatKarenaSesi(err: unknown): boolean {
  return err instanceof Error && err.message.includes("401");
}

// Endpoint hapus per jenis entri. Diagnosis AI tidak punya endpoint
// hapus per entri (docs/api-contracts.md 5.2): riwayat AI hanya
// terhapus bersama akun, jadi entri AI tidak menampilkan tombol hapus.
function pathHapus(entri: EntriRiwayat): string | null {
  if (entri.jenis === "kesehatan") return `/api/health-checks/${entri.id}`;
  if (entri.jenis === "wifi") return `/api/wifi-reports/${entri.id}`;
  return null;
}

function judulWifi(data: WifiReport): string {
  const waktu = formatTanggalWaktu(data.dibuat_pada);
  if (
    data.kecepatan_unduh_kbps !== null &&
    data.kecepatan_unduh_kbps !== undefined
  ) {
    return `Tes WiFi — ${formatKecepatan(data.kecepatan_unduh_kbps)} (${klasifikasiKecepatan(data.kecepatan_unduh_kbps)}) — ${waktu}`;
  }
  if (data.ping_ms !== null && data.ping_ms !== undefined) {
    return `Tes WiFi — latensi HTTP ${data.ping_ms} ms — ${waktu}`;
  }
  return `Tes WiFi — ${waktu}`;
}

interface EntriItemProps {
  entri: EntriRiwayat;
  konfirmasi: boolean;
  menghapus: boolean;
  onMintaHapus: () => void;
  onBatalHapus: () => void;
  onKonfirmasiHapus: () => void;
}

function EntriItem({
  entri,
  konfirmasi,
  menghapus,
  onMintaHapus,
  onBatalHapus,
  onKonfirmasiHapus,
}: EntriItemProps) {
  const bisaDihapus = pathHapus(entri) !== null;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      {entri.jenis === "kesehatan" && (
        <div>
          <span className="inline-block rounded-full border border-zinc-500 px-3 py-1 text-xs font-medium text-zinc-300">
            Pemeriksaan kesehatan
          </span>
          <p className="mt-3 text-base font-semibold text-zinc-100">
            Skor {entri.data.skor} — {kategoriSkor(entri.data.skor)} —{" "}
            {formatTanggalWaktu(entri.data.dibuat_pada)}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {URUTAN_KOMPONEN.map((kunci) => {
              const komponen = entri.data.ringkasan?.[kunci];
              if (!komponen) return null;
              return (
                <li key={kunci}>
                  {labelKomponen(kunci)}:{" "}
                  {labelStatusKomponen(komponen.status)} (skor{" "}
                  {komponen.skor}) — {formatSumber(komponen.sumber)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {entri.jenis === "wifi" && (
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-block rounded-full border border-zinc-500 px-3 py-1 text-xs font-medium text-zinc-300">
              Tes WiFi
            </span>
            {entri.data.durasi_tes_detik === 30 && (
              <span className="inline-block rounded-full border border-zinc-500 px-3 py-1 text-xs font-medium text-zinc-300">
                Tes bertahan 30 detik
              </span>
            )}
          </div>
          <p className="mt-3 text-base font-semibold text-zinc-100">
            {judulWifi(entri.data)}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {entri.data.ssid && <li>Nama WiFi: {entri.data.ssid}</li>}
            {entri.data.ping_ms !== null &&
              entri.data.ping_ms !== undefined && (
                <li>Latensi HTTP: {entri.data.ping_ms} ms</li>
              )}
            {entri.data.kekuatan_sinyal && (
              <li>
                Kekuatan sinyal: {labelSinyal(entri.data.kekuatan_sinyal)}
              </li>
            )}
            <li>Sumber: {formatSumber(entri.data.sumber)}</li>
          </ul>
        </div>
      )}

      {entri.jenis === "ai" && (
        <div>
          <span className="inline-block rounded-full border border-zinc-500 px-3 py-1 text-xs font-medium text-zinc-300">
            Diagnosis AI
          </span>
          <p className="mt-3 text-base font-semibold text-zinc-100">
            Tanya jawab — {formatTanggalWaktu(entri.data.dibuat_pada)}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-zinc-300">
            {entri.data.pertanyaan}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-100 underline underline-offset-4">
              Lihat tanya jawab lengkap
            </summary>
            <div className="mt-3 space-y-3 text-sm text-zinc-300">
              <p>
                <span className="font-semibold text-zinc-100">
                  Pertanyaan:{" "}
                </span>
                {entri.data.pertanyaan}
              </p>
              <p className="whitespace-pre-wrap">
                <span className="font-semibold text-zinc-100">Jawaban: </span>
                {entri.data.jawaban}
              </p>
            </div>
          </details>
          <p className="mt-3 text-xs text-zinc-400">
            Tanya jawab hanya bisa dihapus bersama akun.
          </p>
        </div>
      )}

      {bisaDihapus &&
        (konfirmasi ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 p-4"
          >
            <p className="font-semibold text-zinc-100">Hapus entri ini?</p>
            <p className="mt-1 text-sm text-zinc-300">
              Entri ini akan dihapus dari riwayat Anda.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={onKonfirmasiHapus}
                disabled={menghapus}
                className={`${KELAS_TOMBOL_BAHAYA} flex-1`}
              >
                {menghapus ? "Menghapus…" : "Ya, hapus"}
              </button>
              <button
                type="button"
                onClick={onBatalHapus}
                disabled={menghapus}
                className={`${KELAS_TOMBOL_SEKUNDER} flex-1`}
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onMintaHapus}
            className={`${KELAS_TOMBOL_SEKUNDER} mt-4 text-red-400`}
          >
            Hapus
          </button>
        ))}
    </li>
  );
}

export default function RiwayatPage() {
  const [status, setStatus] = useState<StatusMuat>("memuat");
  const [entri, setEntri] = useState<EntriRiwayat[]>([]);
  const [namaPengguna, setNamaPengguna] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("semua");
  const [sebagianGagal, setSebagianGagal] = useState(false);
  const [adaLagi, setAdaLagi] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null);
  const [menghapusId, setMenghapusId] = useState<string | null>(null);
  const [membuatPdf, setMembuatPdf] = useState(false);
  const [pesan, setPesan] = useState<Pesan | null>(null);

  const muatRiwayat = useCallback(async () => {
    setStatus("memuat");
    setPesan(null);
    setSebagianGagal(false);
    const [hasilKesehatan, hasilWifi, hasilAi, hasilNama] =
      await Promise.allSettled([
        ambilDaftar<HealthCheck>("/api/health-checks"),
        ambilDaftar<WifiReport>("/api/wifi-reports"),
        ambilDaftar<AiDiagnosis>("/api/ai/diagnoses"),
        ambilNamaPengguna(),
      ]);
    const daftarHasil = [hasilKesehatan, hasilWifi, hasilAi];
    const gagal = daftarHasil.filter(
      (hasil): hasil is PromiseRejectedResult =>
        hasil.status === "rejected",
    );
    if (gagal.length === daftarHasil.length) {
      setStatus(
        gagal.some((hasil) => galatKarenaSesi(hasil.reason))
          ? "sesi-habis"
          : "galat",
      );
      return;
    }
    if (gagal.length > 0) setSebagianGagal(true);
    const kesehatan =
      hasilKesehatan.status === "fulfilled"
        ? hasilKesehatan.value.items
        : [];
    const wifi =
      hasilWifi.status === "fulfilled" ? hasilWifi.value.items : [];
    const ai = hasilAi.status === "fulfilled" ? hasilAi.value.items : [];
    setAdaLagi(
      daftarHasil.some(
        (hasil) => hasil.status === "fulfilled" && hasil.value.adaLagi,
      ),
    );
    setNamaPengguna(
      hasilNama.status === "fulfilled" ? hasilNama.value : null,
    );
    setEntri(gabungRiwayat(kesehatan, wifi, ai));
    setStatus("siap");
  }, []);

  useEffect(() => {
    void muatRiwayat();
  }, [muatRiwayat]);

  const jumlahPerFilter = useMemo(() => {
    const jumlah: Record<Filter, number> = {
      semua: entri.length,
      kesehatan: 0,
      wifi: 0,
      ai: 0,
    };
    for (const item of entri) {
      jumlah[item.jenis] += 1;
    }
    return jumlah;
  }, [entri]);

  const entriTerfilter = useMemo(
    () =>
      filter === "semua"
        ? entri
        : entri.filter((item) => item.jenis === filter),
    [entri, filter],
  );

  const hapusEntri = async (target: EntriRiwayat) => {
    const path = pathHapus(target);
    if (!path) return;
    setMenghapusId(target.id);
    try {
      await fetchJson(path, { method: "DELETE", credentials: "include" });
      setEntri((daftar) => daftar.filter((item) => item.id !== target.id));
      setPesan({ jenis: "sukses", teks: "Entri berhasil dihapus." });
    } catch {
      setPesan({ jenis: "galat", teks: "Entri tidak bisa dihapus. Coba lagi." });
    } finally {
      setMenghapusId(null);
      setKonfirmasiHapus(null);
    }
  };

  const unduhPdf = async () => {
    setMembuatPdf(true);
    setPesan(null);
    try {
      await generatePdf({
        namaPengguna,
        judulFilter: LABEL_FILTER[filter],
        entri: entriTerfilter,
        dibuatPada: new Date(),
      });
      setPesan({ jenis: "sukses", teks: "Laporan PDF berhasil diunduh." });
    } catch {
      setPesan({
        jenis: "galat",
        teks: "Laporan PDF tidak bisa dibuat. Coba lagi.",
      });
    } finally {
      setMembuatPdf(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-black px-4 py-6 text-zinc-100 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Riwayat</h1>
      <p className="mt-1 text-sm text-zinc-300">
        Semua hasil pemeriksaan dan tes WiFi Anda.
      </p>

      <div aria-live="polite">
        {pesan && (
          <p
            role={pesan.jenis === "galat" ? "alert" : "status"}
            className={`mt-4 rounded-lg border p-4 text-sm ${
              pesan.jenis === "galat"
                ? "border-red-400/40 bg-red-400/10 text-zinc-100"
                : "border-green-400/40 bg-green-400/10 text-zinc-100"
            }`}
          >
            {pesan.teks}
          </p>
        )}
      </div>

      {status === "memuat" && (
        <div role="status" aria-label="Mengambil data" className="mt-6">
          <p className="text-sm text-zinc-300">Mengambil data…</p>
          <div className="mt-4 space-y-3" aria-hidden="true">
            {[0, 1, 2].map((indeks) => (
              <div
                key={indeks}
                className="h-24 animate-pulse rounded-xl bg-zinc-900"
              />
            ))}
          </div>
        </div>
      )}

      {status === "galat" && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-400/40 bg-red-400/10 p-6"
        >
          <p className="font-semibold text-zinc-100">
            Data tidak bisa dimuat. Coba lagi.
          </p>
          <button
            type="button"
            onClick={() => void muatRiwayat()}
            className={`${KELAS_TOMBOL_SEKUNDER} mt-4`}
          >
            Coba lagi
          </button>
        </div>
      )}

      {status === "sesi-habis" && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="font-semibold text-zinc-100">
            Sesi sudah berakhir. Masuk lagi untuk lanjut.
          </p>
          <Link to="/masuk" className={`${KELAS_TOMBOL_UTAMA} mt-4`}>
            Masuk
          </Link>
        </div>
      )}

      {status === "siap" && (
        <div>
          {sebagianGagal && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4"
            >
              <p className="text-sm text-zinc-100">
                Sebagian riwayat tidak bisa dimuat.
              </p>
              <button
                type="button"
                onClick={() => void muatRiwayat()}
                className={KELAS_TOMBOL_SEKUNDER}
              >
                Coba lagi
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void unduhPdf()}
            disabled={membuatPdf}
            className={`${KELAS_TOMBOL_UTAMA} mt-6 w-full`}
          >
            {membuatPdf ? "Membuat laporan…" : "Unduh laporan PDF"}
          </button>

          {adaLagi && (
            <p className="mt-3 text-xs text-zinc-400">
              Menampilkan 100 entri terbaru per jenis. Entri yang lebih lama
              tidak tampil di halaman ini.
            </p>
          )}

          <div className="mt-6">
            <p
              id="label-filter-riwayat"
              className="text-sm font-medium text-zinc-100"
            >
              Tampilkan
            </p>
            <div
              role="group"
              aria-labelledby="label-filter-riwayat"
              className="mt-2 flex flex-wrap gap-2"
            >
              {DAFTAR_FILTER.map((pilihan) => {
                const aktif = pilihan === filter;
                return (
                  <button
                    key={pilihan}
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => setFilter(pilihan)}
                    className={`min-h-[48px] rounded-full px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                      aktif
                        ? "bg-white font-semibold text-black"
                        : "border border-zinc-500 font-medium text-zinc-100"
                    }`}
                  >
                    {LABEL_FILTER[pilihan]} ({jumlahPerFilter[pilihan]})
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-400">Terbaru dulu</p>
          </div>

          {entri.length === 0 ? (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <p className="text-base font-semibold text-zinc-100">
                Belum ada riwayat
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Hasil pemeriksaan dan tes WiFi yang tersimpan akan tampil di
                sini. Jalankan diagnosis atau tes WiFi untuk mulai.
              </p>
            </div>
          ) : entriTerfilter.length === 0 ? (
            <p className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-300">
              Belum ada riwayat untuk jenis ini.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {entriTerfilter.map((item) => (
                <EntriItem
                  key={`${item.jenis}-${item.id}`}
                  entri={item}
                  konfirmasi={konfirmasiHapus === item.id}
                  menghapus={menghapusId === item.id}
                  onMintaHapus={() => setKonfirmasiHapus(item.id)}
                  onBatalHapus={() => setKonfirmasiHapus(null)}
                  onKonfirmasiHapus={() => void hapusEntri(item)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
