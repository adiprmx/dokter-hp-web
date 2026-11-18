import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ambilRiwayatDokter,
  buatBodiPerforma,
  formatTanggalWaktu,
  hapusEntriDokter,
  klasifikasiPerforma,
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
  labelStatus,
  statusDariDoctor,
  tokenStatus,
} from "../lib/status-warna";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { MeterStrip } from "../components/ui/MeterStrip";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  DoctorEntryForm,
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

// Satu pasangan label/nilai di dalam daftar definisi (strip beban
// terbaru dan detail tiap entri riwayat). Label selalu teks biasa,
// nilai angka selalu mono tabular (.dh-numeric) dari pemanggil.
function NilaiDetail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-[var(--color-text-primary)]">
        {children}
      </dd>
    </div>
  );
}

// Dokter Performa (/performa): riwayat kondisi performa + input manual.
// Tanpa klaim menutup aplikasi lain: web tidak bisa menutup aplikasi
// lain: pengguna diarahkan ke layar aplikasi terakhir atau mulai
// ulang HP (copy.md 8, PRODUCT.md 11).
//
// Redesign v2.0 (docs/redesign-v20-spec.md §8.4, mode Operate):
// strip status berwarna di atas (kondisi terbaru + skor + beban HP),
// formulir dan riwayat di bawah. Alasan tiap keputusan (R-31):
// - Strip di atas: kondisi terbaru adalah jawaban yang dicari
//   pengguna, jadi tampil pertama, besar, dan berwarna.
// - Warna strip dari statusDariDoctor(klasifikasiPerforma):
//   klasifikasi kanonis lib/doctor.ts, tidak ada ambang di halaman.
// - MeterStrip skor: skor komponen server (data nyata) dengan zona
//   warna sebagai arti skala, identitas "Alat ukur".
// - Grid beban (CPU, suhu, RAM, perangkat): nilai terbaru terbaca
//   sekilas; hanya nilai yang ada yang tampil, tanpa kotak kosong.
// - Lebar max-w-2xl dipertahankan: konsistensi keempat halaman
//   dokter; strip memakai grid 2/4 kolom di dalam lebar itu.
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
    document.title = "Dokter Performa | Dokter HP";
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

  const entriTerbaru = entri[0];
  const kondisiTerbaru = entriTerbaru?.detail.kondisi;
  const statusTerbaru = kondisiTerbaru
    ? statusDariDoctor(klasifikasiPerforma(kondisiTerbaru))
    : null;
  const tokenTerbaru = statusTerbaru ? tokenStatus(statusTerbaru) : null;
  const detailTerbaru = entriTerbaru?.detail;

  // Teks RAM strip: "2 GB dari 8 GB" bila keduanya ada, satu nilai
  // bila hanya satu yang dicatat. Label mengikuti copy.md 8.
  const teksRam =
    detailTerbaru?.ramKosongGb !== undefined &&
    detailTerbaru?.ramTotalGb !== undefined
      ? `${formatAngka(detailTerbaru.ramKosongGb)} GB dari ${formatAngka(detailTerbaru.ramTotalGb)} GB`
      : detailTerbaru?.ramKosongGb !== undefined
        ? `${formatAngka(detailTerbaru.ramKosongGb)} GB`
        : detailTerbaru?.ramTotalGb !== undefined
          ? `${formatAngka(detailTerbaru.ramTotalGb)} GB`
          : null;
  const labelRam =
    detailTerbaru?.ramKosongGb !== undefined ? "RAM yang masih kosong" : "RAM";

  const adaBeban =
    detailTerbaru !== undefined &&
    (detailTerbaru.cpuPersen !== undefined ||
      detailTerbaru.suhuC !== undefined ||
      teksRam !== null ||
      detailTerbaru.perangkat !== undefined);

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

      {statusMuat === "memuat" ? (
        <div aria-hidden="true" className="mt-6">
          <Skeleton height={200} rounded="lg" />
        </div>
      ) : null}

      {statusMuat === "siap" &&
      entriTerbaru &&
      kondisiTerbaru &&
      statusTerbaru &&
      tokenTerbaru ? (
        <section aria-label="Kondisi performa terbaru" className="mt-6">
          <Card status={statusTerbaru} padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Kondisi terbaru
                </p>
                <p
                  className="mt-1 text-[length:var(--text-display-lg)] font-bold leading-[var(--leading-display)] tracking-tight"
                  style={{ color: tokenTerbaru.teks }}
                >
                  {labelKondisiPerforma(kondisiTerbaru)}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Catatan terbaru:{" "}
                  {formatTanggalWaktu(entriTerbaru.dibuatPada)}
                </p>
              </div>
              <StatusBadge status={statusTerbaru} dot>
                {labelStatus(statusTerbaru)}
              </StatusBadge>
            </div>
            {entriTerbaru.skor !== null ? (
              <div className="mt-5">
                <p className="text-sm text-[var(--color-text-primary)]">
                  Skor{" "}
                  <span className="dh-numeric font-semibold">
                    {entriTerbaru.skor}
                  </span>{" "}
                  dari 100
                </p>
                <MeterStrip value={entriTerbaru.skor} className="mt-2" />
              </div>
            ) : null}
            {adaBeban && detailTerbaru ? (
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                {detailTerbaru.cpuPersen !== undefined ? (
                  <NilaiDetail label="Beban prosesor">
                    <span className="dh-numeric font-semibold">
                      {formatAngka(detailTerbaru.cpuPersen)}%
                    </span>
                  </NilaiDetail>
                ) : null}
                {detailTerbaru.suhuC !== undefined ? (
                  <NilaiDetail label="Suhu">
                    <span className="dh-numeric font-semibold">
                      {formatAngka(detailTerbaru.suhuC)}°C
                    </span>
                  </NilaiDetail>
                ) : null}
                {teksRam !== null ? (
                  <NilaiDetail label={labelRam}>
                    <span className="dh-numeric font-semibold">{teksRam}</span>
                  </NilaiDetail>
                ) : null}
                {detailTerbaru.perangkat ? (
                  <NilaiDetail label="Perangkat">
                    {detailTerbaru.perangkat}
                  </NilaiDetail>
                ) : null}
              </dl>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section aria-label="Batasan versi web" className="mt-6">
        <Card status="info">
          <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
            Versi web tidak bisa membaca RAM, beban prosesor, atau suhu HP
            secara langsung. Data di layar ini berasal dari riwayat aplikasi
            Dokter HP atau dari yang Anda isi sendiri. Versi web juga tidak
            bisa menutup aplikasi lain. Tutup aplikasi dari layar aplikasi
            terakhir di HP, atau mulai ulang HP bila terasa berat.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
            Cara mencatat: ketuk Tambah catatan di bawah, pilih kondisi HP
            saat ini, dan isi detail yang diketahui. Info perangkat bisa
            dilihat di Pengaturan &gt; Tentang ponsel di HP.
          </p>
        </Card>
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
        <Button
          onClick={() => setFormTerbuka((buka) => !buka)}
          aria-expanded={formTerbuka}
          aria-controls="form-performa"
          className="w-full sm:w-auto"
        >
          {formTerbuka ? "Tutup formulir" : "Tambah catatan"}
        </Button>
        {formTerbuka ? (
          <div id="form-performa" className="mt-4">
            <Card>
              <DoctorEntryForm
                idFormulir="performa"
                judul="Isi kondisi performa"
                fields={FIELDS_PERFORMA}
                validate={(values) => validasiPerforma(nilaiKeForm(values))}
                onSubmit={simpan}
                onBatal={() => setFormTerbuka(false)}
              />
            </Card>
          </div>
        ) : null}
      </section>

      {statusMuat === "siap" && kondisiTerbaru === "sering_lambat" ? (
        <section aria-labelledby="saran-performa-judul" className="mt-8">
          <Card status="peringatan">
            <h2
              id="saran-performa-judul"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              Saran
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
              HP terasa berat menurut catatan terbaru. Coba mulai ulang HP.
              Mulai ulang menutup aplikasi yang sedang berjalan dan sering
              membuat HP terasa ringan lagi. Bila masih berat, tutup aplikasi
              yang tidak dipakai dari layar aplikasi terakhir di HP.
            </p>
          </Card>
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
          <>
            <p
              role="status"
              className="mt-4 text-sm text-[var(--color-text-muted)]"
            >
              Mengambil data…
            </p>
            <div aria-hidden="true" className="mt-4 flex flex-col gap-3">
              <Skeleton height={120} rounded="lg" />
              <Skeleton height={120} rounded="lg" />
            </div>
          </>
        ) : null}
        {statusMuat === "galat" ? (
          <div className="mt-4">
            <Card status="galat">
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {galatMuat ?? "Data tidak bisa dimuat. Coba lagi."}
              </p>
              <Button
                variant="secondary"
                onClick={() => void muat()}
                className="mt-3"
              >
                Coba lagi
              </Button>
            </Card>
          </div>
        ) : null}
        {statusMuat === "siap" && entri.length === 0 ? (
          <div className="mt-4">
            <Card padding="none">
              <DoctorEmptyState
                judul="Belum ada data performa"
                isi="Belum ada riwayat performa. Isi kondisi performa secara manual, atau sinkronkan dari aplikasi Dokter HP di Android."
              />
            </Card>
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
                const kondisi = detail.kondisi;
                const warnaKondisi = kondisi
                  ? tokenStatus(
                      statusDariDoctor(klasifikasiPerforma(kondisi)),
                    ).teks
                  : undefined;
                const adaNilai =
                  detail.ramTotalGb !== undefined ||
                  detail.ramKosongGb !== undefined ||
                  detail.cpuPersen !== undefined ||
                  detail.suhuC !== undefined ||
                  detail.perangkat !== undefined ||
                  detail.android !== undefined ||
                  detail.prosesor !== undefined;
                return (
                  <>
                    <p>
                      Kondisi:{" "}
                      <span
                        className="font-semibold"
                        style={
                          warnaKondisi ? { color: warnaKondisi } : undefined
                        }
                      >
                        {kondisi
                          ? labelKondisiPerforma(kondisi)
                          : "tidak tersedia"}
                      </span>
                    </p>
                    {detail.catatan ? <p>{detail.catatan}</p> : null}
                    {adaNilai ? (
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                        {detail.ramTotalGb !== undefined ? (
                          <NilaiDetail label="RAM">
                            <span className="dh-numeric">
                              {formatAngka(detail.ramTotalGb)} GB
                            </span>
                          </NilaiDetail>
                        ) : null}
                        {detail.ramKosongGb !== undefined ? (
                          <NilaiDetail label="RAM yang masih kosong">
                            <span className="dh-numeric">
                              {formatAngka(detail.ramKosongGb)} GB
                            </span>
                          </NilaiDetail>
                        ) : null}
                        {detail.cpuPersen !== undefined ? (
                          <NilaiDetail label="Beban prosesor">
                            <span className="dh-numeric">
                              {formatAngka(detail.cpuPersen)}%
                            </span>
                          </NilaiDetail>
                        ) : null}
                        {detail.suhuC !== undefined ? (
                          <NilaiDetail label="Suhu">
                            <span className="dh-numeric">
                              {formatAngka(detail.suhuC)}°C
                            </span>
                          </NilaiDetail>
                        ) : null}
                        {detail.perangkat ? (
                          <NilaiDetail label="Perangkat">
                            {detail.perangkat}
                          </NilaiDetail>
                        ) : null}
                        {detail.android ? (
                          <NilaiDetail label="Versi Android">
                            {detail.android}
                          </NilaiDetail>
                        ) : null}
                        {detail.prosesor ? (
                          <NilaiDetail label="Prosesor">
                            {detail.prosesor}
                          </NilaiDetail>
                        ) : null}
                      </dl>
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
