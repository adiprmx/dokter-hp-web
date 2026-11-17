import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilRiwayatDokter,
  buatBodiPenyimpanan,
  hapusEntriDokter,
  hitungPersenPenyimpanan,
  hitungRuangKosongGb,
  parseAngka,
  penyimpananHampirPenuh,
  pesanGalatHapus,
  pesanGalatMuat,
  pesanGalatSimpan,
  simpanEntriDokter,
  validasiPenyimpanan,
  type EntriPenyimpanan,
} from "../lib/doctor";
import {
  DoctorEntryForm,
  KELAS_TOMBOL_PRIMER,
  KELAS_TOMBOL_SEKUNDER,
  type DoctorField,
  type DoctorFormValues,
} from "../components/doctor/DoctorEntryForm";
import {
  DoctorEmptyState,
  DoctorHistoryList,
} from "../components/doctor/DoctorHistoryList";

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

type StatusMuat = "memuat" | "siap" | "galat";

function formatGb(nilai: number): string {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

function formatPersen(nilai: number): string {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

// Bilah pemakaian penyimpanan sederhana (dibuat di file ini karena
// components/charts/StorageBar belum ada — lihat laporan akhir).
// Nilai persen dan angka tampil sebagai teks; bilah memakai
// role="progressbar" (a11y.md 6.4).
function BilahPenyimpanan({
  persen,
  totalGb,
  terpakaiGb,
  kosongGb,
}: {
  persen: number;
  totalGb: number;
  terpakaiGb: number;
  kosongGb: number;
}) {
  const lebar = Math.min(100, Math.max(0, persen));
  const hampirPenuh = penyimpananHampirPenuh(persen);
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(persen)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Penyimpanan terpakai"
        className="h-3 w-full overflow-hidden rounded-full bg-[#27272a]"
      >
        <div
          aria-hidden="true"
          className={`h-full rounded-full ${
            hampirPenuh ? "bg-[var(--color-error)]" : "bg-white"
          }`}
          style={{ width: `${lebar}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-primary)]">
        <span className="dh-numeric font-semibold">
          {formatGb(terpakaiGb)} GB
        </span>{" "}
        dari{" "}
        <span className="dh-numeric font-semibold">{formatGb(totalGb)} GB</span>{" "}
        terpakai (
        <span className="dh-numeric font-semibold">
          {formatPersen(persen)}%
        </span>
        )
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Masih kosong:{" "}
        <span className="dh-numeric">{formatGb(kosongGb)} GB</span>
      </p>
    </div>
  );
}

// Dokter Penyimpanan (/penyimpanan): riwayat pemakaian penyimpanan +
// input manual. Tanpa tombol bersih-bersih: browser tidak bisa
// membersihkan file di HP (copy.md 7, PRODUCT.md 11).
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

      <section
        aria-label="Batasan versi web"
        className="mt-4 rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-4"
      >
        <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
          Versi web tidak bisa membaca penyimpanan HP secara langsung. Data
          di layar ini berasal dari riwayat aplikasi Dokter HP atau dari
          yang Anda isi sendiri. Versi web juga tidak bisa membersihkan
          file di HP — hapus file yang tidak perlu langsung dari HP.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
          Cara mencatat: lihat angkanya di Pengaturan &gt; Penyimpanan di
          HP, ketuk Tambah catatan di bawah, lalu salin total dan yang
          terpakai ke sini.
        </p>
      </section>

      {pesanSukses ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm text-[var(--color-success)]"
        >
          {pesanSukses}
        </p>
      ) : null}
      {pesanGalat ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]"
        >
          {pesanGalat}
        </p>
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
          <div
            id="form-penyimpanan"
            className="mt-4 rounded-xl bg-[var(--color-surface)] p-4"
          >
            <DoctorEntryForm
              idFormulir="penyimpanan"
              judul="Isi pemakaian penyimpanan"
              fields={FIELDS_PENYIMPANAN}
              validate={validasi}
              onSubmit={simpan}
              onBatal={() => setFormTerbuka(false)}
            />
          </div>
        ) : null}
      </section>

      {statusMuat === "siap" &&
      entriTerbaruBerangka &&
      persenTerbaru !== null &&
      kosongTerbaru !== null &&
      entriTerbaruBerangka.detail.totalGb !== undefined &&
      entriTerbaruBerangka.detail.terpakaiGb !== undefined ? (
        <section
          aria-labelledby="pemakaian-judul"
          className="mt-8 rounded-xl bg-[var(--color-surface)] p-4"
        >
          <h2
            id="pemakaian-judul"
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            Pemakaian penyimpanan
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Catatan terbaru — dari data yang dicatat, bukan pembacaan
            langsung.
          </p>
          <div className="mt-4">
            <BilahPenyimpanan
              persen={persenTerbaru}
              totalGb={entriTerbaruBerangka.detail.totalGb}
              terpakaiGb={entriTerbaruBerangka.detail.terpakaiGb}
              kosongGb={kosongTerbaru}
            />
          </div>
          {penyimpananHampirPenuh(persenTerbaru) ? (
            <p className="mt-4 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-warning)]">
              Penyimpanan hampir penuh. HP bisa terasa berat bila ruang
              kosong tinggal sedikit. Hapus file atau aplikasi yang tidak
              dipakai lagi.
            </p>
          ) : null}
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
          <p role="status" className="mt-4 text-sm text-[var(--color-text-muted)]">
            Mengambil data…
          </p>
        ) : null}
        {statusMuat === "galat" ? (
          <div className="mt-4 flex flex-col items-start gap-3">
            <p
              role="alert"
              className="text-sm text-[var(--color-error)]"
            >
              {galatMuat ?? "Data tidak bisa dimuat. Coba lagi."}
            </p>
            <button
              type="button"
              onClick={() => void muat()}
              className={KELAS_TOMBOL_SEKUNDER}
            >
              Coba lagi
            </button>
          </div>
        ) : null}
        {statusMuat === "siap" && entri.length === 0 ? (
          <div className="mt-4 rounded-xl bg-[var(--color-surface)]">
            <DoctorEmptyState
              judul="Belum ada data penyimpanan"
              isi="Belum ada riwayat penyimpanan. Isi pemakaian penyimpanan secara manual, atau sinkronkan dari aplikasi Dokter HP di Android."
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
                      {persen !== null ? (
                        <>
                          {" "}
                          (
                          <span className="dh-numeric">
                            {formatPersen(persen)}%
                          </span>
                          )
                        </>
                      ) : null}
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
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
