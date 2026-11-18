import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ambilRiwayatDokter,
  aplikasiPerluDitinjau,
  BATAS_IZIN_PERLU_TINJAU,
  buatBodiKeamanan,
  formatTanggalWaktu,
  gabungAplikasiKeamanan,
  hapusEntriDokter,
  klasifikasiKeamanan,
  labelSumber,
  parseAngka,
  pesanGalatHapus,
  pesanGalatMuat,
  pesanGalatSimpan,
  simpanEntriDokter,
  validasiKeamanan,
  type AplikasiDenganAsal,
  type DoctorStatus,
  type EntriKeamanan,
} from "../lib/doctor";
import {
  labelStatus,
  statusDariDoctor,
  tokenStatus,
} from "../lib/status-warna";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  DoctorEntryForm,
  type DoctorField,
  type DoctorFormValues,
} from "../components/doctor/DoctorEntryForm";
import { DoctorHistoryList } from "../components/doctor/DoctorHistoryList";

const FIELDS_KEAMANAN: DoctorField[] = [
  {
    name: "nama_aplikasi",
    label: "Nama aplikasi",
    type: "text",
    required: true,
    placeholder: "Contoh: Chat Cepat",
    helperText: "Salin nama aplikasi dari hasil pemindaian di aplikasi Dokter HP.",
  },
  {
    name: "izin_berbahaya",
    label: "Jumlah izin berbahaya",
    type: "number",
    required: true,
    inputMode: "numeric",
    placeholder: "Contoh: 5",
    helperText: "Jumlah izin berbahaya aplikasi itu menurut aplikasi Dokter HP.",
  },
  {
    name: "sistem",
    label: "Aplikasi sistem",
    type: "checkbox",
    helperText: "Aplikasi sistem adalah bagian dari HP dan biasanya tidak bisa dihapus.",
  },
];

type StatusMuat = "memuat" | "siap" | "galat";

// Klasifikasi TAMPILAN satu aplikasi, memakai ambang yang sudah ada
// (BATAS_IZIN_PERLU_TINJAU, PRODUCT.md 4.5). Bukan logika penilaian
// baru: daftar "Perlu ditinjau" tetap dihitung aplikasiPerluDitinjau,
// dan fungsi ini hanya menentukan warna kartu + label tiap baris.
// Aplikasi sistem yang meminta banyak izin tidak bisa dihapus, jadi
// warnanya kuning ("Periksa"), bukan merah.
function statusAplikasi(aplikasi: AplikasiDenganAsal): DoctorStatus {
  if (aplikasi.izinBerbahaya < BATAS_IZIN_PERLU_TINJAU) return "baik";
  return aplikasi.sistem ? "cukup" : "perlu_perhatian";
}

// Label cip tiap aplikasi. Makna selalu dibawa teks ini, bukan hanya
// warna kartu (aksesibilitas: buta warna).
function labelAplikasi(status: DoctorStatus): string {
  if (status === "perlu_perhatian") return "Berisiko";
  if (status === "cukup") return "Periksa";
  return "Aman";
}

function BarisAplikasi({ aplikasi }: { aplikasi: AplikasiDenganAsal }) {
  const statusDoctor = statusAplikasi(aplikasi);
  const status = statusDariDoctor(statusDoctor);
  const token = tokenStatus(status);
  return (
    <li>
      <Card status={status}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 break-words text-base font-medium text-[var(--color-text-primary)]">
            {aplikasi.nama}
          </p>
          <StatusBadge status={status}>
            {labelAplikasi(statusDoctor)}
          </StatusBadge>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span
            className="dh-numeric font-semibold"
            style={{ color: token.teks }}
          >
            {aplikasi.izinBerbahaya} izin berbahaya
          </span>
          {aplikasi.sistem ? (
            <span className="inline-flex items-center rounded-full border border-[var(--color-border-strong)] px-3 py-0.5 text-sm text-[var(--color-text-primary)]">
              Aplikasi sistem
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {labelSumber(aplikasi.sumber)} ·{" "}
          {formatTanggalWaktu(aplikasi.dibuatPada)}
        </p>
      </Card>
    </li>
  );
}

// Dokter Keamanan (/keamanan): daftar temuan keamanan dari riwayat.
// Data hanya berasal dari APK Dokter HP atau catatan manual. Di web
// tidak ada pemindaian baru (copy.md 9, PRODUCT.md 4.5).
// Redesign v2.0: strip ringkasan berwarna di atas (jumlah + label
// status), tiap aplikasi dalam kartu status + cip berlabel teks,
// dua daftar berdampingan di desktop. Logika penilaian risiko dan
// ambang tidak berubah, hanya tampilan.
export default function KeamananPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);
  const [entri, setEntri] = useState<EntriKeamanan[]>([]);
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
      const data = await ambilRiwayatDokter("keamanan");
      setEntri(
        data.filter(
          (item): item is EntriKeamanan => item.jenis === "keamanan",
        ),
      );
      setStatusMuat("siap");
    } catch (error) {
      setGalatMuat(pesanGalatMuat(error));
      setStatusMuat("galat");
    }
  }, []);

  useEffect(() => {
    document.title = "Dokter Keamanan — Dokter HP";
    judulRef.current?.focus();
    void muat();
  }, [muat]);

  const semuaAplikasi = useMemo(
    () => gabungAplikasiKeamanan(entri),
    [entri],
  );
  const perluDitinjau = useMemo(
    () => aplikasiPerluDitinjau(semuaAplikasi),
    [semuaAplikasi],
  );
  const statusKeamanan = useMemo(
    () => klasifikasiKeamanan(perluDitinjau.length),
    [perluDitinjau],
  );
  const statusRingkasan = statusDariDoctor(statusKeamanan);
  const jumlahSistem = useMemo(
    () => semuaAplikasi.filter((aplikasi) => aplikasi.sistem).length,
    [semuaAplikasi],
  );
  const kalimatRingkasan =
    statusKeamanan === "baik"
      ? "Tidak ada aplikasi yang perlu ditinjau dari data terakhir."
      : `Aplikasi di bawah meminta ${BATAS_IZIN_PERLU_TINJAU} izin berbahaya atau lebih. Tinjau satu per satu.`;

  function validasi(values: DoctorFormValues): Record<string, string> {
    return validasiKeamanan({
      namaAplikasi: String(values.nama_aplikasi ?? ""),
      izinBerbahaya: String(values.izin_berbahaya ?? ""),
    });
  }

  async function simpan(values: DoctorFormValues): Promise<void> {
    const nama = String(values.nama_aplikasi ?? "").trim();
    const izin = parseAngka(String(values.izin_berbahaya ?? "")) ?? 0;
    const sistem = values.sistem === true;
    try {
      const entriBaru = await simpanEntriDokter(
        "keamanan",
        buatBodiKeamanan([{ nama, izinBerbahaya: izin, sistem }]),
      );
      if (entriBaru.jenis === "keamanan") {
        setEntri((sebelum) => [entriBaru, ...sebelum]);
      }
      setPesanSukses("Data keamanan tersimpan.");
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
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6">
      <h1
        ref={judulRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] focus:outline-none"
      >
        Dokter Keamanan
      </h1>
      <p className="mt-2 max-w-[65ch] text-base leading-relaxed text-[var(--color-text-muted)]">
        Tinjau aplikasi dan izin yang berisiko di HP Anda.
      </p>

      <section aria-label="Batasan versi web" className="mt-4">
        <Card status="info">
          <p className="max-w-[65ch] text-sm leading-relaxed text-[var(--color-text-primary)]">
            Versi web tidak bisa memindai aplikasi di HP. Data di layar ini
            hanya berasal dari riwayat aplikasi Dokter HP di Android. Untuk
            pemindaian baru, jalankan Dokter Keamanan dari aplikasi Android.
          </p>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[var(--color-text-primary)]">
            Cara mencatat: salin nama aplikasi dan jumlah izin berbahayanya
            dari hasil pemindaian di aplikasi Dokter HP, lalu ketuk Tambah
            catatan di bawah.
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

      <section aria-label="Tambah catatan keamanan" className="mt-6">
        <Button
          onClick={() => setFormTerbuka((buka) => !buka)}
          aria-expanded={formTerbuka}
          aria-controls="form-keamanan"
          className="w-full sm:w-auto"
        >
          {formTerbuka ? "Tutup formulir" : "Tambah catatan"}
        </Button>
        {formTerbuka ? (
          <div id="form-keamanan" className="mt-4">
            <Card>
              <DoctorEntryForm
                idFormulir="keamanan"
                judul="Isi temuan keamanan"
                deskripsi="Satu aplikasi per catatan. Salin dari hasil pemindaian aplikasi Dokter HP di Android."
                fields={FIELDS_KEAMANAN}
                validate={validasi}
                onSubmit={simpan}
                onBatal={() => setFormTerbuka(false)}
              />
            </Card>
          </div>
        ) : null}
      </section>

      {statusMuat === "memuat" ? (
        <div className="mt-8">
          <p role="status" className="text-sm text-[var(--color-text-muted)]">
            Mengambil data…
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton
              height={132}
              rounded="lg"
              label="Memuat ringkasan keamanan"
            />
            <Skeleton
              height={104}
              rounded="lg"
              label="Memuat daftar aplikasi"
            />
            <Skeleton
              height={104}
              rounded="lg"
              label="Memuat daftar aplikasi"
            />
            <Skeleton
              height={104}
              rounded="lg"
              label="Memuat daftar aplikasi"
            />
          </div>
        </div>
      ) : null}
      {statusMuat === "galat" ? (
        <div className="mt-8">
          <Card status="galat">
            <p
              role="alert"
              className="text-sm leading-relaxed text-[var(--color-error)]"
            >
              {galatMuat ?? "Data tidak bisa dimuat. Coba lagi."}
            </p>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => void muat()}>
                Coba lagi
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {statusMuat === "siap" && entri.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Belum ada data keamanan"
            description="Belum ada riwayat pemindaian keamanan. Jalankan Dokter Keamanan dari aplikasi Dokter HP di Android untuk mengisi data ini."
          />
        </div>
      ) : null}

      {statusMuat === "siap" && entri.length > 0 ? (
        <>
          <section aria-labelledby="ringkasan-keamanan-judul" className="mt-8">
            <Card status={statusRingkasan} padding="lg">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="ringkasan-keamanan-judul"
                    className="text-lg font-semibold text-[var(--color-text-primary)]"
                  >
                    Ringkasan keamanan
                  </h2>
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                    <span
                      className="dh-numeric text-[length:var(--text-display-lg)] font-bold leading-[var(--leading-display)]"
                      style={{ color: tokenStatus(statusRingkasan).teks }}
                    >
                      {perluDitinjau.length}
                    </span>
                    <span className="text-base text-[var(--color-text-primary)]">
                      aplikasi perlu ditinjau
                    </span>
                  </p>
                  <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[var(--color-text-primary)]">
                    {kalimatRingkasan}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {semuaAplikasi.length} aplikasi diperiksa. {jumlahSistem}{" "}
                    di antaranya aplikasi sistem.
                  </p>
                </div>
                <StatusBadge status={statusRingkasan}>
                  {labelStatus(statusRingkasan)}
                </StatusBadge>
              </div>
            </Card>
          </section>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section
              aria-labelledby="perlu-ditinjau-judul"
              className="min-w-0"
            >
              <h2
                id="perlu-ditinjau-judul"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Perlu ditinjau
              </h2>
              <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-[var(--color-text-muted)]">
                Aplikasi di bawah ini meminta {BATAS_IZIN_PERLU_TINJAU} izin
                berbahaya atau lebih. Tinjau satu per satu: bila aplikasi
                tidak dikenal atau tidak dipakai lagi, hapus dari Pengaturan
                &gt; Aplikasi di HP.
              </p>
              {perluDitinjau.length === 0 ? (
                <div className="mt-4">
                  <Card status="sukses">
                    <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
                      Tidak ada aplikasi yang perlu ditinjau dari data
                      terakhir.
                    </p>
                  </Card>
                </div>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {perluDitinjau.map((aplikasi) => (
                    <BarisAplikasi
                      key={aplikasi.nama.toLowerCase()}
                      aplikasi={aplikasi}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="semua-aplikasi-judul"
              className="min-w-0"
            >
              <h2
                id="semua-aplikasi-judul"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Semua aplikasi
              </h2>
              <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-[var(--color-text-muted)]">
                Aplikasi sistem adalah bagian dari HP dan biasanya tidak bisa
                dihapus.
              </p>
              {semuaAplikasi.length === 0 ? (
                <div className="mt-4">
                  <Card>
                    <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
                      Catatan yang tersimpan belum berisi daftar aplikasi.
                    </p>
                  </Card>
                </div>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {semuaAplikasi.map((aplikasi) => (
                    <BarisAplikasi
                      key={aplikasi.nama.toLowerCase()}
                      aplikasi={aplikasi}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="riwayat-keamanan-judul" className="mt-8">
            <h2
              id="riwayat-keamanan-judul"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Riwayat catatan
            </h2>
            <div className="mt-4">
              <DoctorHistoryList
                entri={entri}
                menghapusId={menghapusId}
                onHapus={hapus}
                renderDetail={(item) => {
                  if (item.detail.aplikasi.length === 0) {
                    return <p>Catatan ini tidak berisi daftar aplikasi.</p>;
                  }
                  return (
                    <>
                      {item.detail.aplikasi.map((aplikasi) => (
                        <p key={aplikasi.nama}>
                          {aplikasi.nama}:{" "}
                          <span className="dh-numeric">
                            {aplikasi.izinBerbahaya} izin berbahaya
                          </span>
                          {aplikasi.sistem ? " (aplikasi sistem)" : ""}
                        </p>
                      ))}
                    </>
                  );
                }}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
