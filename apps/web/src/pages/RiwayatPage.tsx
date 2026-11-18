import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, fetchJson, panggilApi } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { MeterStrip } from "../components/ui/MeterStrip";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  labelStatus,
  statusDariDoctor,
  statusDariSkor,
  tokenStatus,
} from "../lib/status-warna";
import {
  URUTAN_KOMPONEN,
  formatKecepatan,
  formatSumber,
  formatTanggalWaktu,
  generatePdf,
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
// Mengambil riwayat gabungan dari satu endpoint GET /api/history
// (K-33, kontrak §7): pemeriksaan kesehatan, laporan WiFi, dan
// diagnosis AI sudah digabung + diurutkan terbaru dulu oleh server,
// dengan filter per jenis, hapus per entri (DELETE /api/history/:jenis/:id
// untuk ketiga jenis, termasuk AI), dan unduh laporan PDF client-side.
//
// Teks layar mengikuti docs/copy.md bagian 11. Desain mengikuti design
// lock hitam/putih dan token a11y (K-11): teks minimal Zinc 400,
// border komponen interaktif minimal Zinc 500, target sentuh 48x48 px.
//
// Redesign v2.0 (docs/redesign-v20-spec.md §8.5, mode Operate,
// "Alat ukur, hidup"): tiap entri pemeriksaan memakai cip skor berwarna
// lewat helper status-warna (statusDariSkor) + label kategori teks,
// angka skor tampil besar dengan strip meter zona 80/50, dan warna
// status komponen memakai helper yang sama (statusDariDoctor). Warna
// status TIDAK PERNAH dipetakan di file ini — semua lewat
// lib/status-warna.ts, dan StatusBadge/Card memakai kosakata status
// yang sama (StatusWarna, K-95), jadi tidak ada adaptor di sini.
// Alasan desain (R-31): skor besar + meter = angka ukur dibaca dulu;
// cip berwarna = keadaan terbaca sekilas; kartu bertinta status =
// keadaan entri terlihat tanpa membaca teks; EmptyState + CTA =
// halaman kosong memberi langkah berikutnya, bukan jalan buntu.

// Jumlah maksimum entri yang diminta ke API (batas atas kontrak:
// limit 1-100). Halaman mengambil 100 entri terbaru gabungan;
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

type StatusMuat = "memuat" | "siap" | "galat" | "sesi-habis";

interface Pesan {
  jenis: "sukses" | "galat";
  teks: string;
}

/** Satu item GET /api/history (kontrak §7): data adalah proyeksi ringkas
 *  per jenis — id dan dibuat_pada ada di tingkat item, bukan di data. */
interface ItemRiwayatApi {
  jenis: "kesehatan" | "wifi" | "ai";
  id: string;
  dibuat_pada: string;
  data: Record<string, unknown>;
}

function angkaAtauNull(nilai: unknown): number | null {
  return typeof nilai === "number" && Number.isFinite(nilai) ? nilai : null;
}

function teksAtauNull(nilai: unknown): string | null {
  return typeof nilai === "string" ? nilai : null;
}

/**
 * Memetakan satu item /api/history ke EntriRiwayat (lib/pdf.ts).
 * Field yang tidak dibawa proyeksi ringkas (user_id, updated_at,
 * deleted_at) dibiarkan kosong — tidak pernah ditampilkan di layar
 * maupun di PDF. Mengembalikan null bila bentuk item tidak valid,
 * agar satu item rusak tidak menggagalkan seluruh daftar.
 */
function petakanItem(item: ItemRiwayatApi): EntriRiwayat | null {
  if (
    typeof item !== "object" ||
    item === null ||
    typeof item.id !== "string" ||
    typeof item.dibuat_pada !== "string" ||
    typeof item.data !== "object" ||
    item.data === null
  ) {
    return null;
  }
  const data = item.data;
  if (item.jenis === "kesehatan") {
    if (
      typeof data.skor !== "number" ||
      typeof data.ringkasan !== "object" ||
      data.ringkasan === null
    ) {
      return null;
    }
    const kesehatan: HealthCheck = {
      id: item.id,
      skor: data.skor,
      ringkasan: data.ringkasan as HealthCheck["ringkasan"],
      dibuat_pada: item.dibuat_pada,
      // sync_status tidak ditampilkan di layar maupun PDF; nilai
      // cadangan "pending" hanya memenuhi tipe bila server mengirim
      // nilai di luar tiga status yang dikenal.
      sync_status:
        data.sync_status === "pending" ||
        data.sync_status === "synced" ||
        data.sync_status === "failed"
          ? data.sync_status
          : "pending",
    };
    return {
      jenis: "kesehatan",
      id: item.id,
      dibuatPada: item.dibuat_pada,
      data: kesehatan,
    };
  }
  if (item.jenis === "wifi") {
    // Sumber ditampilkan di layar ("Dari tes web" dsb.), jadi nilai
    // yang tidak dikenal tidak boleh ditebak — entrinya dibuang.
    if (
      data.sumber !== "web" &&
      data.sumber !== "apk" &&
      data.sumber !== "manual"
    ) {
      return null;
    }
    const wifi: WifiReport = {
      id: item.id,
      ssid: teksAtauNull(data.ssid),
      kecepatan_koneksi_mbps: angkaAtauNull(data.kecepatan_koneksi_mbps),
      kekuatan_sinyal:
        data.kekuatan_sinyal === "lemah" ||
        data.kekuatan_sinyal === "sedang" ||
        data.kekuatan_sinyal === "kuat"
          ? data.kekuatan_sinyal
          : null,
      channel: angkaAtauNull(data.channel),
      dns: teksAtauNull(data.dns),
      ping_ms: angkaAtauNull(data.ping_ms),
      rekomendasi: teksAtauNull(data.rekomendasi),
      kecepatan_unduh_kbps: angkaAtauNull(data.kecepatan_unduh_kbps),
      sumber: data.sumber,
      durasi_tes_detik: angkaAtauNull(data.durasi_tes_detik),
      dibuat_pada: item.dibuat_pada,
    };
    return { jenis: "wifi", id: item.id, dibuatPada: item.dibuat_pada, data: wifi };
  }
  if (item.jenis === "ai") {
    if (
      typeof data.pertanyaan !== "string" ||
      typeof data.jawaban !== "string"
    ) {
      return null;
    }
    const ai: AiDiagnosis = {
      id: item.id,
      health_check_id: teksAtauNull(data.health_check_id),
      pertanyaan: data.pertanyaan,
      jawaban: data.jawaban,
      dibuat_pada: item.dibuat_pada,
    };
    return { jenis: "ai", id: item.id, dibuatPada: item.dibuat_pada, data: ai };
  }
  return null;
}

// Nama pengguna untuk kepala laporan PDF. Gagal dimuat bukan galat
// fatal: laporan dibuat tanpa baris nama, bukan dengan nama karangan.
async function ambilNamaPengguna(): Promise<string | null> {
  try {
    const saya = await panggilApi<{ nama?: string }>("/api/auth/me");
    return typeof saya.nama === "string" && saya.nama.length > 0
      ? saya.nama
      : null;
  } catch {
    return null;
  }
}

// ApiError 401 berarti sesi sudah berakhir.
function galatKarenaSesi(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

// Endpoint hapus per entri (kontrak §7): DELETE /api/history/:jenis/:id
// berlaku untuk ketiga jenis, termasuk diagnosis AI.
function pathHapus(entri: EntriRiwayat): string {
  return `/api/history/${entri.jenis}/${entri.id}`;
}

// Baris utama entri WiFi: kecepatan unduh bila ada, latensi HTTP bila
// kecepatan tidak ada, judul polos bila keduanya tidak ada. Fakta yang
// sama dengan judul v1.0, hanya dipisah dari tanggal (tanggal tampil
// di baris atas kartu) dan tanpa pemisah em dash.
function utamaWifi(data: WifiReport): { utama: string; tambahan: string | null } {
  if (
    data.kecepatan_unduh_kbps !== null &&
    data.kecepatan_unduh_kbps !== undefined
  ) {
    return {
      utama: formatKecepatan(data.kecepatan_unduh_kbps),
      tambahan: `(${klasifikasiKecepatan(data.kecepatan_unduh_kbps)})`,
    };
  }
  if (data.ping_ms !== null && data.ping_ms !== undefined) {
    return { utama: `Latensi HTTP ${data.ping_ms} ms`, tambahan: null };
  }
  return { utama: "Tes WiFi", tambahan: null };
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
  // Status kartu hanya bermakna untuk entri pemeriksaan (skor punya
  // ambang 80/50); entri WiFi dan AI memakai kartu netral karena tidak
  // ada pemetaan status kanonis untuk kecepatan maupun tanya jawab —
  // jangan mengarangnya.
  const statusKartu =
    entri.jenis === "kesehatan" ? statusDariSkor(entri.data.skor) : undefined;
  return (
    <li>
      <Card status={statusKartu} padding="lg">
        {entri.jenis === "kesehatan" && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Pemeriksaan kesehatan
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {formatTanggalWaktu(entri.data.dibuat_pada)}
              </p>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className="dh-numeric text-[length:var(--text-display)] leading-[var(--leading-display)] font-bold"
                style={{ color: tokenStatus(statusDariSkor(entri.data.skor)).teks }}
              >
                {entri.data.skor}
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">
                dari 100
              </span>
              <StatusBadge status={statusDariSkor(entri.data.skor)}>
                {labelStatus(statusDariSkor(entri.data.skor))}
              </StatusBadge>
            </p>
            <MeterStrip
              value={entri.data.skor}
              className="mt-3"
              ariaLabel={`Skor ${entri.data.skor} dari 100, ${labelStatus(statusDariSkor(entri.data.skor))}`}
            />
            <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
              {URUTAN_KOMPONEN.map((kunci) => {
                const komponen = entri.data.ringkasan?.[kunci];
                if (!komponen) return null;
                return (
                  <li key={kunci}>
                    {labelKomponen(kunci)}:{" "}
                    <span
                      className="font-medium"
                      style={{
                        color: tokenStatus(statusDariDoctor(komponen.status))
                          .teks,
                      }}
                    >
                      {labelStatusKomponen(komponen.status)}
                    </span>{" "}
                    (skor {komponen.skor}), {formatSumber(komponen.sumber)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {entri.jenis === "wifi" && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="netral">Tes WiFi</StatusBadge>
                {entri.data.durasi_tes_detik === 30 && (
                  <StatusBadge status="netral">
                    Tes bertahan 30 detik
                  </StatusBadge>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {formatTanggalWaktu(entri.data.dibuat_pada)}
              </p>
            </div>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="dh-numeric text-xl font-semibold text-[var(--color-text-primary)]">
                {utamaWifi(entri.data).utama}
              </span>
              {utamaWifi(entri.data).tambahan && (
                <span className="text-sm text-[var(--color-text-muted)]">
                  {utamaWifi(entri.data).tambahan}
                </span>
              )}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
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
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <StatusBadge status="netral">Diagnosis AI</StatusBadge>
              <p className="text-sm text-[var(--color-text-muted)]">
                {formatTanggalWaktu(entri.data.dibuat_pada)}
              </p>
            </div>
            <p className="mt-3 text-base font-semibold text-[var(--color-text-primary)]">
              Tanya jawab
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
              {entri.data.pertanyaan}
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-[var(--color-text-primary)] underline underline-offset-4">
                Lihat tanya jawab lengkap
              </summary>
              <div className="mt-3 space-y-3 text-sm text-[var(--color-text-secondary)]">
                <p>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Pertanyaan:{" "}
                  </span>
                  {entri.data.pertanyaan}
                </p>
                <p className="whitespace-pre-wrap">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Jawaban:{" "}
                  </span>
                  {entri.data.jawaban}
                </p>
              </div>
            </details>
          </div>
        )}

        {konfirmasi ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4"
          >
            <p className="font-semibold text-[var(--color-text-primary)]">
              Hapus entri ini?
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Entri ini akan dihapus dari riwayat Anda.
            </p>
            <div className="mt-3 flex gap-3">
              <Button
                variant="danger"
                onClick={onKonfirmasiHapus}
                loading={menghapus}
                className="flex-1"
              >
                Ya, hapus
              </Button>
              <Button
                variant="secondary"
                onClick={onBatalHapus}
                disabled={menghapus}
                className="flex-1"
              >
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={onMintaHapus} className="mt-4">
            Hapus
          </Button>
        )}
      </Card>
    </li>
  );
}

export default function RiwayatPage() {
  const [status, setStatus] = useState<StatusMuat>("memuat");
  const [entri, setEntri] = useState<EntriRiwayat[]>([]);
  const [namaPengguna, setNamaPengguna] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("semua");
  const [adaLagi, setAdaLagi] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null);
  const [menghapusId, setMenghapusId] = useState<string | null>(null);
  const [membuatPdf, setMembuatPdf] = useState(false);
  const [pesan, setPesan] = useState<Pesan | null>(null);

  const muatRiwayat = useCallback(async () => {
    setStatus("memuat");
    setPesan(null);
    try {
      const [envelope, nama] = await Promise.all([
        fetchJson<ItemRiwayatApi[]>(`/api/history?limit=${BATAS_DAFTAR}`),
        ambilNamaPengguna(),
      ]);
      const daftar = Array.isArray(envelope.data) ? envelope.data : [];
      const dipetakan: EntriRiwayat[] = [];
      for (const item of daftar) {
        const entriBaru = petakanItem(item);
        if (entriBaru) dipetakan.push(entriBaru);
      }
      // Meta paginasi cursor ada di meta.pagination (kontrak §0.6).
      const paginasi = envelope.meta?.pagination as
        | { has_more?: unknown }
        | undefined;
      setAdaLagi(paginasi?.has_more === true);
      setNamaPengguna(nama);
      setEntri(dipetakan);
      setStatus("siap");
    } catch (err) {
      setStatus(galatKarenaSesi(err) ? "sesi-habis" : "galat");
    }
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
    setMenghapusId(target.id);
    try {
      await panggilApi(pathHapus(target), { method: "DELETE" });
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
    <div className="mx-auto min-h-dvh w-full max-w-3xl bg-black px-4 py-6 text-zinc-100 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Riwayat</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Semua hasil pemeriksaan dan tes WiFi Anda.
      </p>

      <div aria-live="polite">
        {pesan && (
          <p
            role={pesan.jenis === "galat" ? "alert" : "status"}
            className={`mt-4 rounded-lg border p-4 text-sm text-[var(--color-text-primary)] ${
              pesan.jenis === "galat"
                ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]"
                : "border-[var(--color-success-border)] bg-[var(--color-success-bg)]"
            }`}
          >
            {pesan.teks}
          </p>
        )}
      </div>

      {status === "memuat" && (
        <div role="status" aria-label="Mengambil data" className="mt-6">
          <p className="text-sm text-[var(--color-text-muted)]">
            Mengambil data…
          </p>
          <div className="mt-4 space-y-3" aria-hidden="true">
            {[0, 1, 2].map((indeks) => (
              <Skeleton key={indeks} height={132} rounded="lg" />
            ))}
          </div>
        </div>
      )}

      {status === "galat" && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-6"
        >
          <p className="font-semibold text-[var(--color-text-primary)]">
            Data tidak bisa dimuat. Coba lagi.
          </p>
          <Button
            variant="secondary"
            onClick={() => void muatRiwayat()}
            className="mt-4"
          >
            Coba lagi
          </Button>
        </div>
      )}

      {status === "sesi-habis" && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="font-semibold text-zinc-100">
            Sesi sudah berakhir. Masuk lagi untuk lanjut.
          </p>
          <Link
            to="/masuk"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-5 text-base font-medium text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Masuk
          </Link>
        </div>
      )}

      {status === "siap" && (
        <div>
          <div className="mt-6 flex">
            <Button
              onClick={() => void unduhPdf()}
              loading={membuatPdf}
              className="w-full sm:w-auto"
            >
              {membuatPdf ? "Membuat laporan…" : "Unduh laporan PDF"}
            </Button>
          </div>

          <div className="mt-6">
            <p
              id="label-filter-riwayat"
              className="text-sm font-medium text-[var(--color-text-primary)]"
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
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Terbaru dulu
            </p>
          </div>

          {entri.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Belum ada riwayat"
                description="Hasil pemeriksaan dan tes WiFi yang tersimpan akan tampil di sini. Jalankan diagnosis atau tes WiFi untuk mulai."
                action={
                  <Link
                    to="/dashboard"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-5 text-base font-medium text-black transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-zinc-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Jalankan diagnosis
                  </Link>
                }
              />
            </div>
          ) : entriTerfilter.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Belum ada riwayat untuk jenis ini"
                description="Coba filter lain untuk melihat entri yang tersimpan."
              />
            </div>
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

          {adaLagi && (
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">
              Menampilkan 100 entri terbaru. Entri yang lebih lama tidak
              tampil di halaman ini.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
