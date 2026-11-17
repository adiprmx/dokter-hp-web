import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambilRiwayatDokter,
  buatBodiPerforma,
  hapusEntriDokter,
  labelKondisiPerforma,
  parseAngka,
  pesanGalatHapus,
  pesanGalatMuat,
  pesanGalatSimpan,
  simpanEntriDokter,
  validasiPerforma,
  type EntriPerforma,
  type KondisiPerforma,
  type NilaiFormPerforma,
  type PerformaDetail,
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

const FIELDS_PERFORMA: DoctorField[] = [
  {
    name: "kondisi",
    label: "Kondisi performa HP",
    type: "radio",
    required: true,
    options: [
      { value: "lancar", label: "Lancar" },
      { value: "kadang_lambat", label: "Kadang lambat" },
      { value: "sering_lambat", label: "Sering lambat" },
    ],
  },
  {
    name: "catatan",
    label: "Catatan",
    type: "textarea",
    placeholder: "Contoh: HP terasa berat saat membuka kamera.",
    helperText: "Tulis apa yang dirasakan, bila ada.",
  },
  {
    name: "ram_total_gb",
    label: "RAM total (GB)",
    type: "number",
    inputMode: "decimal",
    placeholder: "Contoh: 8",
    bagian: "Detail tambahan (opsional)",
  },
  {
    name: "ram_kosong_gb",
    label: "RAM yang masih kosong (GB)",
    type: "number",
    inputMode: "decimal",
    placeholder: "Contoh: 2",
    bagian: "Detail tambahan (opsional)",
  },
  {
    name: "cpu_persen",
    label: "Beban prosesor (%)",
    type: "number",
    inputMode: "numeric",
    placeholder: "Contoh: 80",
    bagian: "Detail tambahan (opsional)",
  },
  {
    name: "suhu_c",
    label: "Suhu (°C)",
    type: "number",
    inputMode: "decimal",
    placeholder: "Contoh: 41",
    bagian: "Detail tambahan (opsional)",
  },
  {
    name: "perangkat",
    label: "Perangkat",
    type: "text",
    placeholder: "Contoh: POCO M7 Pro",
    helperText: "Merek dan model HP, bila diketahui.",
    bagian: "Detail tambahan (opsional)",
  },
  {
    name: "android",
    label: "Versi Android",
    type: "text",
    placeholder: "Contoh: 14",
    bagian: "Detail tambahan (opsional)",
  },
  {
    name: "prosesor",
    label: "Prosesor",
    type: "text",
    placeholder: "Contoh: Dimensity 7025",
    bagian: "Detail tambahan (opsional)",
  },
];

type StatusMuat = "memuat" | "siap" | "galat";

function formatAngka(nilai: number): string {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

function nilaiKeForm(values: DoctorFormValues): NilaiFormPerforma {
  return {
    kondisi: String(values.kondisi ?? ""),
    catatan: String(values.catatan ?? ""),
    ramTotalGb: String(values.ram_total_gb ?? ""),
    ramKosongGb: String(values.ram_kosong_gb ?? ""),
    cpuPersen: String(values.cpu_persen ?? ""),
    suhuC: String(values.suhu_c ?? ""),
    perangkat: String(values.perangkat ?? ""),
    android: String(values.android ?? ""),
    prosesor: String(values.prosesor ?? ""),
  };
}

function nilaiKeDetail(nilai: NilaiFormPerforma): PerformaDetail {
  const detail: PerformaDetail = {
    kondisi: nilai.kondisi as KondisiPerforma,
  };
  const catatan = nilai.catatan.trim();
  if (catatan !== "") detail.catatan = catatan;
  const ramTotal = parseAngka(nilai.ramTotalGb);
  if (ramTotal !== null) detail.ramTotalGb = ramTotal;
  const ramKosong = parseAngka(nilai.ramKosongGb);
  if (ramKosong !== null) detail.ramKosongGb = ramKosong;
  const cpu = parseAngka(nilai.cpuPersen);
  if (cpu !== null) detail.cpuPersen = cpu;
  const suhu = parseAngka(nilai.suhuC);
  if (suhu !== null) detail.suhuC = suhu;
  const perangkat = nilai.perangkat.trim();
  if (perangkat !== "") detail.perangkat = perangkat;
  const android = nilai.android.trim();
  if (android !== "") detail.android = android;
  const prosesor = nilai.prosesor.trim();
  if (prosesor !== "") detail.prosesor = prosesor;
  return detail;
}

// Dokter Performa (/performa): riwayat kondisi performa + input manual.
// Tanpa klaim menutup aplikasi lain: web tidak bisa menutup aplikasi
// lain — pengguna diarahkan ke layar aplikasi terakhir atau mulai
// ulang HP (copy.md 8, PRODUCT.md 11).
export default function PerformaPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);
  const [entri, setEntri] = useState<EntriPerforma[]>([]);
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
      const data = await ambilRiwayatDokter("performa");
      setEntri(
        data.filter(
          (item): item is EntriPerforma => item.jenis === "performa",
        ),
      );
      setStatusMuat("siap");
    } catch (error) {
      setGalatMuat(pesanGalatMuat(error));
      setStatusMuat("galat");
    }
  }, []);

  useEffect(() => {
    document.title = "Dokter Performa — Dokter HP";
    judulRef.current?.focus();
    void muat();
  }, [muat]);

  async function simpan(values: DoctorFormValues): Promise<void> {
    const nilai = nilaiKeForm(values);
    try {
      const entriBaru = await simpanEntriDokter(
        "performa",
        buatBodiPerforma(nilaiKeDetail(nilai)),
      );
      if (entriBaru.jenis === "performa") {
        setEntri((sebelum) => [entriBaru, ...sebelum]);
      }
      setPesanSukses("Data performa tersimpan.");
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

  const kondisiTerbaru = entri[0]?.detail.kondisi;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <h1
        ref={judulRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] focus:outline-none"
      >
        Dokter Performa
      </h1>
      <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">
        Riwayat kecepatan dan beban HP Anda.
      </p>

      <section
        aria-label="Batasan versi web"
        className="mt-4 rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-4"
      >
        <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
          Versi web tidak bisa membaca RAM, beban prosesor, atau suhu HP
          secara langsung. Data di layar ini berasal dari riwayat aplikasi
          Dokter HP atau dari yang Anda isi sendiri. Versi web juga tidak
          bisa menutup aplikasi lain — tutup aplikasi dari layar aplikasi
          terakhir di HP, atau mulai ulang HP bila terasa berat.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
          Cara mencatat: ketuk Tambah catatan di bawah, pilih kondisi HP
          saat ini, dan isi detail yang diketahui. Info perangkat bisa
          dilihat di Pengaturan &gt; Tentang ponsel di HP.
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

      <section aria-label="Tambah catatan performa" className="mt-6">
        <button
          type="button"
          onClick={() => setFormTerbuka((buka) => !buka)}
          aria-expanded={formTerbuka}
          aria-controls="form-performa"
          className={`${KELAS_TOMBOL_PRIMER} w-full sm:w-auto`}
        >
          {formTerbuka ? "Tutup formulir" : "Tambah catatan"}
        </button>
        {formTerbuka ? (
          <div
            id="form-performa"
            className="mt-4 rounded-xl bg-[var(--color-surface)] p-4"
          >
            <DoctorEntryForm
              idFormulir="performa"
              judul="Isi kondisi performa"
              fields={FIELDS_PERFORMA}
              validate={(values) => validasiPerforma(nilaiKeForm(values))}
              onSubmit={simpan}
              onBatal={() => setFormTerbuka(false)}
            />
          </div>
        ) : null}
      </section>

      {statusMuat === "siap" && kondisiTerbaru === "sering_lambat" ? (
        <section
          aria-label="Saran"
          className="mt-8 rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4"
        >
          <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
            HP terasa berat menurut catatan terbaru. Coba mulai ulang HP —
            mulai ulang menutup aplikasi yang sedang berjalan dan sering
            membuat HP terasa ringan lagi. Bila masih berat, tutup aplikasi
            yang tidak dipakai dari layar aplikasi terakhir di HP.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="riwayat-performa-judul" className="mt-8">
        <h2
          id="riwayat-performa-judul"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Riwayat performa
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
              judul="Belum ada data performa"
              isi="Belum ada riwayat performa. Isi kondisi performa secara manual, atau sinkronkan dari aplikasi Dokter HP di Android."
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
                const detail = item.detail;
                return (
                  <>
                    <p>
                      Kondisi:{" "}
                      <span className="font-semibold">
                        {detail.kondisi
                          ? labelKondisiPerforma(detail.kondisi)
                          : "tidak tersedia"}
                      </span>
                    </p>
                    {detail.catatan ? <p>{detail.catatan}</p> : null}
                    {detail.ramTotalGb !== undefined ? (
                      <p>
                        RAM:{" "}
                        <span className="dh-numeric">
                          {formatAngka(detail.ramTotalGb)} GB
                        </span>
                      </p>
                    ) : null}
                    {detail.ramKosongGb !== undefined ? (
                      <p>
                        RAM yang masih kosong:{" "}
                        <span className="dh-numeric">
                          {formatAngka(detail.ramKosongGb)} GB
                        </span>
                      </p>
                    ) : null}
                    {detail.cpuPersen !== undefined ? (
                      <p>
                        Beban prosesor:{" "}
                        <span className="dh-numeric">
                          {formatAngka(detail.cpuPersen)}%
                        </span>
                      </p>
                    ) : null}
                    {detail.suhuC !== undefined ? (
                      <p>
                        Suhu:{" "}
                        <span className="dh-numeric">
                          {formatAngka(detail.suhuC)}°C
                        </span>
                      </p>
                    ) : null}
                    {detail.perangkat ? (
                      <p>Perangkat: {detail.perangkat}</p>
                    ) : null}
                    {detail.android ? (
                      <p>Versi Android: {detail.android}</p>
                    ) : null}
                    {detail.prosesor ? (
                      <p>Prosesor: {detail.prosesor}</p>
                    ) : null}
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
