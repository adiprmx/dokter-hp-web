import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilRiwayatDokter,
  buatBodiPenyimpanan,
  formatTanggalWaktu,
  hapusEntriDokter,
  hitungPersenPenyimpanan,
  hitungRuangKosongGb,
  klasifikasiPenyimpanan,
  parseAngka,
  pesanGalatHapus,
  pesanGalatMuat,
  pesanGalatSimpan,
  simpanEntriDokter,
  validasiPenyimpanan,
  type EntriPenyimpanan,
} from "../lib/doctor";
import {
  labelStatus,
  statusDariDoctor,
  tokenStatus,
} from "../lib/status-warna";
import {
  DoctorEntryForm,
  KELAS_TOMBOL_PRIMER,
  KELAS_TOMBOL_SEKUNDER,
  type DoctorField,
  type DoctorFormValues,
} from "../components/doctor/DoctorEntryForm";
import { DoctorHistoryList } from "../components/doctor/DoctorHistoryList";
import { StorageBar } from "../components/charts/StorageBar";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";

const FIELDS_PENYIMPANAN: DoctorField[] = [
  {
    name: "total_gb",
    label: "Total penyimpanan (GB)",
    type: "number",
    required: true,
    inputMode: "decimal",
    placeholder: "Contoh: 128",
    helperText: "Lihat angkanya di Pengaturan > Penyimpanan di HP.",
  },
  {
    name: "terpakai_gb",
    label: "Yang terpakai (GB)",
    type: "number",
    required: true,
    inputMode: "decimal",
    placeholder: "Contoh: 96",
    helperText: "Jumlah ruang yang sudah terisi.",
  },
];

// Satu GB dalam byte: StorageBar menerima byte, halaman ini bekerja
// dalam GB (satuan yang dicatat pengguna).
const GB_KE_BYTE = 1024 ** 3;

type StatusMuat = "memuat" | "siap" | "galat";

function formatGb(nilai: number): string {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

function formatPersen(nilai: number): string {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

// Dokter Penyimpanan (/penyimpanan): riwayat pemakaian penyimpanan +
// input manual. Tanpa tombol bersih-bersih: browser tidak bisa
// membersihkan file di HP (copy.md 7, PRODUCT.md 11).
//
// Redesign v2.0 (docs/redesign-v20-spec.md §8.4): strip status
// berwarna di atas (angka besar + label status + StorageBar),
// form + riwayat di bawah. Bilah inline v1.0 sudah dihapus:
// StorageBar adalah satu-satunya tampilan bilah, di bagian utama
// maupun di tiap entri riwayat. Warna status HANYA lewat
// statusDariDoctor(klasifikasiPenyimpanan) + tokenStatus.
// Ambang 70/90 hidup di lib/doctor.ts dan tidak berubah.
// Peringatan "hampir penuh" tampil di dalam kartu galat (bagian
// utama memakai status kartu galat saat klasifikasi
// perlu_perhatian); kalimatnya adalah kalimat kanonis copy.md §7
// yang ditampilkan StorageBar, jadi tidak diulang kedua kali.
export default function PenyimpananPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);
  const [entri, setEntri] = useState<EntriPenyimpanan[]>([]);
  const [statusMuat, setStatusMuat] = useState<StatusMuat>("memuat");
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [menghapusId, setMenghapusId] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setStatusMuat("memuat");
    setGalatMuat(null);
    try {
      const data = await ambilRiwayatDokter("penyimpanan");
      setEntri(
        data.filter(
          (item): item is EntriPenyimpanan => item.jenis === "penyimpanan",
        ),
      );
      setStatusMuat("siap");
    } catch (error) {
      setGalatMuat(pesanGalatMuat(error));
      setStatusMuat("galat");
    }
  }, []);

  useEffect(() => {
    document.title = "Dokter Penyimpanan — Dokter HP";
    judulRef.current?.focus();
    void muat();
  }, [muat]);

  function validasi(values: DoctorFormValues): Record<string, string> {
    return validasiPenyimpanan({
      totalGb: String(values.total_gb ?? ""),
      terpakaiGb: String(values.terpakai_gb ?? ""),
    });
  }

  async function simpan(values: DoctorFormValues): Promise<void> {
    const total = parseAngka(String(values.total_gb ?? "")) ?? 0;
    const terpakai = parseAngka(String(values.terpakai_gb ?? "")) ?? 0;
    try {
      const entriBaru = await simpanEntriDokter(
        "penyimpanan",
        buatBodiPenyimpanan(total, terpakai),
      );
      if (entriBaru.jenis === "penyimpanan") {
        setEntri((sebelum) => [entriBaru, ...sebelum]);
      }
      setPesanSukses("Data penyimpanan tersimpan.");
      setPesanGalat(null);
      setFormTerbuka(false);
    } catch (error) {
      setPesanGalat(pesanGalatSimpan(error));
      setPesanSukses(null);
      throw error;
    }
  }

  async function hapus(id: string): Promise<void> {
    setMenghapusId(id);
    try {
      await hapusEntriDokter(id);
      setEntri((sebelum) => sebelum.filter((item) => item.id !== id));
      setPesanSukses("Entri berhasil dihapus.");
      setPesanGalat(null);
    } catch (error) {
      setPesanGalat(pesanGalatHapus(error));
      setPesanSukses(null);
      throw error;
    } finally {
      setMenghapusId(null);
    }
  }

  // Bilah memakai catatan terbaru yang punya angka lengkap.
  const entriTerbaruBerangka = entri.find(
    (item) =>
      item.detail.totalGb !== undefined &&
      item.detail.terpakaiGb !== undefined,
  );
  const persenTerbaru =
    entriTerbaruBerangka &&
    entriTerbaruBerangka.detail.totalGb !== undefined &&
    entriTerbaruBerangka.detail.terpakaiGb !== undefined
      ? hitungPersenPenyimpanan(
          entriTerbaruBerangka.detail.totalGb,
          entriTerbaruBerangka.detail.terpakaiGb,
        )
      : null;
  const kosongTerbaru =
    entriTerbaruBerangka &&
    entriTerbaruBerangka.detail.totalGb !== undefined &&
    entriTerbaruBerangka.detail.terpakaiGb !== undefined
      ? hitungRuangKosongGb(
          entriTerbaruBerangka.detail.totalGb,
          entriTerbaruBerangka.detail.terpakaiGb,
        )
      : null;
  // Status bagian utama: klasifikasi kanonis -> warna lewat helper
  // status-warna (satu-satunya pemetaan keadaan ke warna).
  const klasifikasiTerbaru =
    persenTerbaru !== null ? klasifikasiPenyimpanan(persenTerbaru) : null;
  const statusTerbaru = klasifikasiTerbaru
    ? statusDariDoctor(klasifikasiTerbaru)
    : null;
  const tokenTerbaru = statusTerbaru ? tokenStatus(statusTerbaru) : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <h1
        ref={judulRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] focus:outline-none"
      >
        Dokter Penyimpanan
      </h1>
      <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">
        Pemakaian ruang penyimpanan HP Anda.
      </p>

      <Card status="info" className="mt-4">
        <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
          Versi web tidak bisa membaca penyimpanan HP secara langsung. Data
          di layar ini berasal dari riwayat aplikasi Dokter HP atau dari
          yang Anda isi sendiri. Versi web juga tidak bisa membersihkan
          file di HP. Hapus file yang tidak perlu langsung dari HP.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
          Cara mencatat: lihat angkanya di Pengaturan &gt; Penyimpanan di
          HP, ketuk Tambah catatan di bawah, lalu salin total dan yang
          terpakai ke sini.
        </p>
      </Card>

      {pesanSukses ? (
        <Card status="sukses" className="mt-4">
          <p
            role="status"
            className="text-sm text-[var(--color-success)]"
          >
            {pesanSukses}
          </p>
        </Card>
      ) : null}
      {pesanGalat ? (
        <Card status="galat" className="mt-4">
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {pesanGalat}
          </p>
        </Card>
      ) : null}

      <section aria-label="Tambah catatan penyimpanan" className="mt-6">
        <button
          type="button"
          onClick={() => setFormTerbuka((buka) => !buka)}
          aria-expanded={formTerbuka}
          aria-controls="form-penyimpanan"
          className={`${KELAS_TOMBOL_PRIMER} w-full sm:w-auto`}
        >
          {formTerbuka ? "Tutup formulir" : "Tambah catatan"}
        </button>
        {formTerbuka ? (
          <Card className="mt-4">
            <div id="form-penyimpanan">
              <DoctorEntryForm
                idFormulir="penyimpanan"
                judul="Isi pemakaian penyimpanan"
                fields={FIELDS_PENYIMPANAN}
                validate={validasi}
                onSubmit={simpan}
                onBatal={() => setFormTerbuka(false)}
              />
            </div>
          </Card>
        ) : null}
      </section>

      {statusMuat === "siap" &&
      entriTerbaruBerangka &&
      persenTerbaru !== null &&
      kosongTerbaru !== null &&
      statusTerbaru &&
      tokenTerbaru &&
      entriTerbaruBerangka.detail.totalGb !== undefined &&
      entriTerbaruBerangka.detail.terpakaiGb !== undefined ? (
        <section aria-labelledby="pemakaian-judul" className="mt-8">
          <Card status={statusTerbaru} padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="pemakaian-judul"
                  className="text-lg font-semibold text-[var(--color-text-primary)]"
                >
                  Pemakaian penyimpanan
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Catatan terbaru dari data yang dicatat, bukan pembacaan
                  langsung.
                </p>
              </div>
              <StatusBadge status={statusTerbaru} dot>
                {labelStatus(statusTerbaru)}
              </StatusBadge>
            </div>
            <p
              className="dh-numeric mt-4 text-[length:var(--text-display-lg)] font-bold leading-[var(--leading-display)]"
              style={{ color: tokenTerbaru.teks }}
            >
              {formatPersen(persenTerbaru)}%
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              dari{" "}
              <span className="dh-numeric text-[var(--color-text-primary)]">
                {formatGb(entriTerbaruBerangka.detail.totalGb)} GB
              </span>{" "}
              terpakai
            </p>
            <div className="mt-4">
              <StorageBar
                terpakai={
                  entriTerbaruBerangka.detail.terpakaiGb * GB_KE_BYTE
                }
                total={entriTerbaruBerangka.detail.totalGb * GB_KE_BYTE}
              />
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Masih kosong:{" "}
              <span className="dh-numeric text-[var(--color-text-primary)]">
                {formatGb(kosongTerbaru)} GB
              </span>
            </p>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="riwayat-penyimpanan-judul" className="mt-8">
        <h2
          id="riwayat-penyimpanan-judul"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Riwayat penyimpanan
        </h2>
        {statusMuat === "memuat" ? (
          <div className="mt-4 flex flex-col gap-3">
            <p
              role="status"
              className="text-sm text-[var(--color-text-muted)]"
            >
              Mengambil data…
            </p>
            <Skeleton
              height={118}
              rounded="lg"
              label="Memuat riwayat penyimpanan"
            />
            <Skeleton
              height={118}
              rounded="lg"
              label="Memuat riwayat penyimpanan"
            />
          </div>
        ) : null}
        {statusMuat === "galat" ? (
          <Card status="galat" className="mt-4">
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {galatMuat ?? "Data tidak bisa dimuat. Coba lagi."}
            </p>
            <button
              type="button"
              onClick={() => void muat()}
              className={`${KELAS_TOMBOL_SEKUNDER} mt-3`}
            >
              Coba lagi
            </button>
          </Card>
        ) : null}
        {statusMuat === "siap" && entri.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Belum ada data penyimpanan"
              description="Belum ada riwayat penyimpanan. Isi pemakaian penyimpanan secara manual, atau sinkronkan dari aplikasi Dokter HP di Android."
            />
          </div>
        ) : null}
        {statusMuat === "siap" && entri.length > 0 ? (
          <div className="mt-4">
            <DoctorHistoryList
              entri={entri}
              menghapusId={menghapusId}
              onHapus={hapus}
              renderDetail={(item) => {
                const total = item.detail.totalGb;
                const terpakai = item.detail.terpakaiGb;
                const persen =
                  total !== undefined && terpakai !== undefined
                    ? hitungPersenPenyimpanan(total, terpakai)
                    : null;
                const kosong =
                  total !== undefined && terpakai !== undefined
                    ? hitungRuangKosongGb(total, terpakai)
                    : null;
                if (total === undefined && terpakai === undefined) {
                  return <p>tidak tersedia</p>;
                }
                // Angka tidak lengkap atau tidak valid (misalnya
                // terpakai melebihi total): tampilkan teks apa
                // adanya seperti v1.0, tanpa bilah.
                if (
                  persen === null ||
                  total === undefined ||
                  terpakai === undefined
                ) {
                  return (
                    <>
                      <p>
                        Total penyimpanan:{" "}
                        <span className="dh-numeric font-semibold">
                          {total !== undefined
                            ? `${formatGb(total)} GB`
                            : "tidak tersedia"}
                        </span>
                      </p>
                      <p>
                        Terpakai:{" "}
                        <span className="dh-numeric font-semibold">
                          {terpakai !== undefined
                            ? `${formatGb(terpakai)} GB`
                            : "tidak tersedia"}
                        </span>
                      </p>
                      <p>
                        Masih kosong:{" "}
                        <span className="dh-numeric font-semibold">
                          {kosong !== null
                            ? `${formatGb(kosong)} GB`
                            : "tidak tersedia"}
                        </span>
                      </p>
                    </>
                  );
                }
                // Angka lengkap: bilah status yang sama dengan
                // bagian utama, supaya tiap kartu riwayat membawa
                // warnanya sendiri.
                return (
                  <>
                    <StorageBar
                      terpakai={terpakai * GB_KE_BYTE}
                      total={total * GB_KE_BYTE}
                      label={`Penyimpanan terpakai, catatan ${formatTanggalWaktu(item.dibuatPada)}`}
                    />
                    <p className="mt-1">
                      Masih kosong:{" "}
                      <span className="dh-numeric font-semibold">
                        {kosong !== null
                          ? `${formatGb(kosong)} GB`
                          : "tidak tersedia"}
                      </span>
                    </p>
                  </>
                );
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
