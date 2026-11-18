import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ambilRiwayatDokter,
  buatBodiBaterai,
  formatPerkiraanJam,
  formatTanggalWaktu,
  hapusEntriDokter,
  klasifikasiBaterai,
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
  labelStatus,
  statusDariDoctor,
  tokenStatus,
} from "../lib/status-warna";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
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

// Satu pasangan label/nilai di dalam daftar definisi (strip level
// terbaru). Label selalu teks biasa, nilai angka selalu mono tabular
// (.dh-numeric) dari pemanggil.
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

// Dokter Baterai (/baterai): riwayat level baterai + input manual.
// Batasan jujur web: browser tidak bisa membaca baterai HP secara
// langsung — data di layar ini berasal dari riwayat aplikasi
// Dokter HP atau dari yang diisi sendiri (copy.md 6).
//
// Redesign v2.0 (docs/redesign-v20-spec.md §8.4, mode Operate):
// strip status berwarna di atas (level terbaru + batang isi +
// perkiraan waktu pakai), formulir dan riwayat di bawah. Alasan
// tiap keputusan (R-31):
// - Strip di atas: level terbaru adalah jawaban yang dicari
//   pengguna, jadi tampil pertama, besar, dan berwarna.
// - Warna strip dari statusDariDoctor(klasifikasiBaterai):
//   klasifikasi kanonis lib/doctor.ts (ambang 50/20), tidak ada
//   ambang di halaman. Label badge memakai labelStatus
//   lib/status-warna (K-94: Baik/Perlu diperhatikan/Bermasalah)
//   agar sama dengan badge riwayat.
// - Batang isi digambar sendiri, bukan MeterStrip: zona MeterStrip
//   memakai ambang skor 80/50, sedangkan ambang baterai 50/20.
//   Memakai MeterStrip akan memberi warna yang salah.
// - Tips dalam satu kartu berdaftar, bukan tiga kartu identik:
//   ritme halaman bervariasi (RHYTHM 4).
// - Lebar max-w-2xl dipertahankan: konsistensi keempat halaman
//   dokter.
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

  const entriTerbaru = entri[0];
  const persenTerbaru = entriTerbaru?.detail.persen;
  const statusDokterTerbaru =
    persenTerbaru !== undefined
      ? klasifikasiBaterai(persenTerbaru)
      : null;
  const statusTerbaru = statusDokterTerbaru
    ? statusDariDoctor(statusDokterTerbaru)
    : null;
  const tokenTerbaru = statusTerbaru ? tokenStatus(statusTerbaru) : null;
  const jamTerbaru =
    persenTerbaru !== undefined ? perkiraanJamPakai(persenTerbaru) : null;

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

      {statusMuat === "memuat" ? (
        <div aria-hidden="true" className="mt-6">
          <Skeleton height={200} rounded="lg" />
        </div>
      ) : null}

      {statusMuat === "siap" &&
      entriTerbaru &&
      persenTerbaru !== undefined &&
      statusDokterTerbaru &&
      statusTerbaru &&
      tokenTerbaru ? (
        <section aria-label="Level baterai terbaru" className="mt-6">
          <Card status={statusTerbaru} padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Level baterai terbaru
                </p>
                <p
                  className="dh-numeric mt-1 text-[length:var(--text-display-lg)] font-bold leading-[var(--leading-display)] tracking-tight"
                  style={{ color: tokenTerbaru.teks }}
                >
                  {persenTerbaru}%
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
            <div
              aria-hidden="true"
              className="mt-5 h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-raised)]"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${persenTerbaru}%`,
                  backgroundColor: tokenTerbaru.teks,
                  transition: `width var(--duration-slow) var(--ease-out)`,
                }}
              />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <NilaiDetail label="Status">
                {entriTerbaru.detail.statusBaterai
                  ? labelStatusBaterai(entriTerbaru.detail.statusBaterai)
                  : "tidak tersedia"}
              </NilaiDetail>
              <NilaiDetail label="Mode hemat daya">
                {entriTerbaru.detail.hematDaya === undefined
                  ? "tidak tersedia"
                  : entriTerbaru.detail.hematDaya
                    ? "Aktif"
                    : "Tidak aktif"}
              </NilaiDetail>
              <NilaiDetail label="Perkiraan waktu pakai">
                {jamTerbaru !== null ? (
                  <span className="dh-numeric font-semibold">
                    {formatPerkiraanJam(jamTerbaru)}
                  </span>
                ) : (
                  "tidak tersedia"
                )}
              </NilaiDetail>
            </dl>
          </Card>
        </section>
      ) : null}

      <section aria-label="Batasan versi web" className="mt-6">
        <Card status="info">
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

      <section aria-label="Tambah catatan baterai" className="mt-6">
        <Button
          onClick={() => setFormTerbuka((buka) => !buka)}
          aria-expanded={formTerbuka}
          aria-controls="form-baterai"
          className="w-full sm:w-auto"
        >
          {formTerbuka ? "Tutup formulir" : "Tambah catatan"}
        </Button>
        {formTerbuka ? (
          <div id="form-baterai" className="mt-4">
            <Card>
              <DoctorEntryForm
                idFormulir="baterai"
                judul="Isi kondisi baterai"
                fields={FIELDS_BATERAI}
                validate={validasi}
                onSubmit={simpan}
                infoDinamis={(values) => {
                  const persen = parseAngka(String(values.persen ?? ""));
                  if (persen === null || persen < 0 || persen > 100)
                    return null;
                  const jam = perkiraanJamPakai(persen);
                  if (jam === null) return null;
                  const statusDokter = klasifikasiBaterai(persen);
                  const status = statusDariDoctor(statusDokter);
                  const token = tokenStatus(status);
                  return (
                    <div
                      aria-live="polite"
                      className="rounded-lg bg-[var(--color-surface-raised)] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-[var(--color-text-primary)]">
                          Perkiraan waktu pakai:{" "}
                          <span
                            className="dh-numeric font-semibold"
                            style={{ color: token.teks }}
                          >
                            {formatPerkiraanJam(jam)}
                          </span>
                        </p>
                        <StatusBadge status={status}>
                          {labelStatus(status)}
                        </StatusBadge>
                      </div>
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
            </Card>
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
                judul="Belum ada data baterai"
                isi="Belum ada riwayat baterai. Isi kondisi baterai secara manual, atau sinkronkan dari aplikasi Dokter HP di Android."
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
                const persen = item.detail.persen;
                const jam =
                  persen !== undefined ? perkiraanJamPakai(persen) : null;
                const warnaLevel =
                  persen !== undefined
                    ? tokenStatus(statusDariDoctor(klasifikasiBaterai(persen)))
                        .teks
                    : undefined;
                return (
                  <>
                    <p>
                      Level baterai:{" "}
                      <span
                        className="dh-numeric font-semibold"
                        style={
                          warnaLevel ? { color: warnaLevel } : undefined
                        }
                      >
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
        <div className="mt-4">
          <Card padding="none">
            <ul className="divide-y divide-[var(--color-border)]">
              {TIPS_BATERAI.map((tip) => (
                <li
                  key={tip}
                  className="px-4 py-4 text-sm leading-relaxed text-[var(--color-text-primary)]"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
