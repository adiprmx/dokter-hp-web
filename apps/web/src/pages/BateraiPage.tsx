import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilRiwayatDokter,
  buatBodiBaterai,
  formatPerkiraanJam,
  hapusEntriDokter,
  labelStatusBaterai,
  parseAngka,
  perkiraanJamPakai,
  pesanGalatHapus,
  pesanGalatMuat,
  pesanGalatSimpan,
  simpanEntriDokter,
  validasiBaterai,
  type EntriBaterai,
  type StatusBaterai,
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

const FIELDS_BATERAI: DoctorField[] = [
  {
    name: "persen",
    label: "Level baterai (%)",
    type: "number",
    required: true,
    inputMode: "numeric",
    placeholder: "Contoh: 45",
    helperText: "Lihat angka persen di bilah status HP.",
  },
  {
    name: "status_baterai",
    label: "Status",
    type: "radio",
    required: true,
    options: [
      { value: "mengisi", label: "Mengisi daya" },
      { value: "dipakai", label: "Dipakai" },
      { value: "penuh", label: "Penuh" },
    ],
  },
  {
    name: "hemat_daya",
    label: "Mode hemat daya sedang aktif",
    type: "checkbox",
  },
];

const TIPS_BATERAI = [
  "Hindari HP kepanasan terlalu lama, misalnya dipakai sambil mengisi daya di bawah sinar matahari.",
  "Aktifkan mode hemat daya bila baterai tinggal sedikit dan tidak ada pengisi daya.",
  "Kurangi kecerahan layar bila baterai cepat habis.",
];

type StatusMuat = "memuat" | "siap" | "galat";

// Dokter Baterai (/baterai): riwayat level baterai + input manual.
// Batasan jujur web: browser tidak bisa membaca baterai HP secara
// langsung — data di layar ini berasal dari riwayat aplikasi
// Dokter HP atau dari yang diisi sendiri (copy.md 6).
export default function BateraiPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);
  const [entri, setEntri] = useState<EntriBaterai[]>([]);
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
      const data = await ambilRiwayatDokter("baterai");
      setEntri(
        data.filter(
          (item): item is EntriBaterai => item.jenis === "baterai",
        ),
      );
      setStatusMuat("siap");
    } catch (error) {
      setGalatMuat(pesanGalatMuat(error));
      setStatusMuat("galat");
    }
  }, []);

  useEffect(() => {
    document.title = "Dokter Baterai — Dokter HP";
    judulRef.current?.focus();
    void muat();
  }, [muat]);

  function validasi(values: DoctorFormValues): Record<string, string> {
    return validasiBaterai({
      persen: String(values.persen ?? ""),
      statusBaterai: String(values.status_baterai ?? ""),
    });
  }

  async function simpan(values: DoctorFormValues): Promise<void> {
    const persen = parseAngka(String(values.persen ?? "")) ?? 0;
    const statusBaterai = String(
      values.status_baterai ?? "",
    ) as StatusBaterai;
    const hematDaya = values.hemat_daya === true;
    try {
      const entriBaru = await simpanEntriDokter(
        "baterai",
        buatBodiBaterai(persen, statusBaterai, hematDaya),
      );
      if (entriBaru.jenis === "baterai") {
        setEntri((sebelum) => [entriBaru, ...sebelum]);
      }
      setPesanSukses("Data baterai tersimpan.");
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <h1
        ref={judulRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] focus:outline-none"
      >
        Dokter Baterai
      </h1>
      <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">
        Riwayat dan kondisi baterai HP Anda.
      </p>

      <section
        aria-label="Batasan versi web"
        className="mt-4 rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-4"
      >
        <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
          Versi web tidak bisa membaca baterai HP secara langsung. Data di
          layar ini berasal dari riwayat aplikasi Dokter HP atau dari yang
          Anda isi sendiri. Untuk melihat aplikasi yang paling banyak memakai
          baterai, buka Pengaturan &gt; Baterai di HP.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
          Cara mencatat: lihat level baterai di HP, ketuk Tambah catatan di
          bawah, lalu isi level dan statusnya.
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

      <section aria-label="Tambah catatan baterai" className="mt-6">
        <button
          type="button"
          onClick={() => setFormTerbuka((buka) => !buka)}
          aria-expanded={formTerbuka}
          aria-controls="form-baterai"
          className={`${KELAS_TOMBOL_PRIMER} w-full sm:w-auto`}
        >
          {formTerbuka ? "Tutup formulir" : "Tambah catatan"}
        </button>
        {formTerbuka ? (
          <div
            id="form-baterai"
            className="mt-4 rounded-xl bg-[var(--color-surface)] p-4"
          >
            <DoctorEntryForm
              idFormulir="baterai"
              judul="Isi kondisi baterai"
              fields={FIELDS_BATERAI}
              validate={validasi}
              onSubmit={simpan}
              infoDinamis={(values) => {
                const persen = parseAngka(String(values.persen ?? ""));
                if (persen === null || persen < 0 || persen > 100) return null;
                const jam = perkiraanJamPakai(persen);
                if (jam === null) return null;
                return (
                  <div
                    aria-live="polite"
                    className="rounded-lg bg-[var(--color-surface-raised)] p-4"
                  >
                    <p className="text-sm text-[var(--color-text-primary)]">
                      Perkiraan waktu pakai:{" "}
                      <span className="dh-numeric font-semibold">
                        {formatPerkiraanJam(jam)}
                      </span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
                      Perkiraan ini dihitung dari asumsi pemakaian rata-rata
                      10% per jam. Angka sebenarnya bisa berbeda tergantung
                      pemakaian.
                    </p>
                  </div>
                );
              }}
              onBatal={() => setFormTerbuka(false)}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="riwayat-baterai-judul" className="mt-8">
        <h2
          id="riwayat-baterai-judul"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Riwayat baterai
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
              judul="Belum ada data baterai"
              isi="Belum ada riwayat baterai. Isi kondisi baterai secara manual, atau sinkronkan dari aplikasi Dokter HP di Android."
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
                const persen = item.detail.persen;
                const jam =
                  persen !== undefined ? perkiraanJamPakai(persen) : null;
                return (
                  <>
                    <p>
                      Level baterai:{" "}
                      <span className="dh-numeric font-semibold">
                        {persen !== undefined ? `${persen}%` : "tidak tersedia"}
                      </span>
                    </p>
                    <p>
                      Status:{" "}
                      {item.detail.statusBaterai
                        ? labelStatusBaterai(item.detail.statusBaterai)
                        : "tidak tersedia"}
                    </p>
                    <p>
                      Mode hemat daya:{" "}
                      {item.detail.hematDaya === undefined
                        ? "tidak tersedia"
                        : item.detail.hematDaya
                          ? "Aktif"
                          : "Tidak aktif"}
                    </p>
                    {jam !== null ? (
                      <p>
                        Perkiraan waktu pakai:{" "}
                        <span className="dh-numeric font-semibold">
                          {formatPerkiraanJam(jam)}
                        </span>{" "}
                        <span className="text-[var(--color-text-muted)]">
                          (perkiraan, asumsi pemakaian rata-rata 10% per jam)
                        </span>
                      </p>
                    ) : null}
                  </>
                );
              }}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="tips-baterai-judul" className="mt-8">
        <h2
          id="tips-baterai-judul"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Tips merawat baterai
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {TIPS_BATERAI.map((tip) => (
            <li
              key={tip}
              className="rounded-xl bg-[var(--color-surface)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)]"
            >
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
