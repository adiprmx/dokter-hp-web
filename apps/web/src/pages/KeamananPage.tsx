import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ambilRiwayatDokter,
  aplikasiPerluDitinjau,
  buatBodiKeamanan,
  formatTanggalWaktu,
  gabungAplikasiKeamanan,
  hapusEntriDokter,
  labelSumber,
  parseAngka,
  pesanGalatHapus,
  pesanGalatMuat,
  pesanGalatSimpan,
  simpanEntriDokter,
  validasiKeamanan,
  type AplikasiDenganAsal,
  type EntriKeamanan,
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

function BarisAplikasi({ aplikasi }: { aplikasi: AplikasiDenganAsal }) {
  return (
    <li className="rounded-xl bg-[var(--color-surface)] p-4">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {aplikasi.nama} —{" "}
        <span className="dh-numeric">
          {aplikasi.izinBerbahaya} izin berbahaya
        </span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <span>
          {labelSumber(aplikasi.sumber)} —{" "}
          {formatTanggalWaktu(aplikasi.dibuatPada)}
        </span>
        {aplikasi.sistem ? (
          <span className="inline-flex items-center rounded-full border border-[var(--color-border-strong)] px-3 py-0.5 text-sm text-[var(--color-text-primary)]">
            Aplikasi sistem
          </span>
        ) : null}
      </p>
    </li>
  );
}

// Dokter Keamanan (/keamanan): daftar temuan keamanan dari riwayat.
// Data hanya berasal dari APK Dokter HP atau catatan manual — di web
// TIDAK ADA pemindaian baru (copy.md 9, PRODUCT.md 4.5).
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
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <h1
        ref={judulRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] focus:outline-none"
      >
        Dokter Keamanan
      </h1>
      <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">
        Tinjau aplikasi dan izin yang berisiko di HP Anda.
      </p>

      <section
        aria-label="Batasan versi web"
        className="mt-4 rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-4"
      >
        <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
          Versi web tidak bisa memindai aplikasi di HP. Data di layar ini
          hanya berasal dari riwayat aplikasi Dokter HP di Android. Untuk
          pemindaian baru, jalankan Dokter Keamanan dari aplikasi Android.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
          Cara mencatat: salin nama aplikasi dan jumlah izin berbahayanya
          dari hasil pemindaian di aplikasi Dokter HP, lalu ketuk Tambah
          catatan di bawah.
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

      <section aria-label="Tambah catatan keamanan" className="mt-6">
        <button
          type="button"
          onClick={() => setFormTerbuka((buka) => !buka)}
          aria-expanded={formTerbuka}
          aria-controls="form-keamanan"
          className={`${KELAS_TOMBOL_PRIMER} w-full sm:w-auto`}
        >
          {formTerbuka ? "Tutup formulir" : "Tambah catatan"}
        </button>
        {formTerbuka ? (
          <div
            id="form-keamanan"
            className="mt-4 rounded-xl bg-[var(--color-surface)] p-4"
          >
            <DoctorEntryForm
              idFormulir="keamanan"
              judul="Isi temuan keamanan"
              deskripsi="Satu aplikasi per catatan. Salin dari hasil pemindaian aplikasi Dokter HP di Android."
              fields={FIELDS_KEAMANAN}
              validate={validasi}
              onSubmit={simpan}
              onBatal={() => setFormTerbuka(false)}
            />
          </div>
        ) : null}
      </section>

      {statusMuat === "memuat" ? (
        <p role="status" className="mt-8 text-sm text-[var(--color-text-muted)]">
          Mengambil data…
        </p>
      ) : null}
      {statusMuat === "galat" ? (
        <div className="mt-8 flex flex-col items-start gap-3">
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
        <div className="mt-8 rounded-xl bg-[var(--color-surface)]">
          <DoctorEmptyState
            judul="Belum ada data keamanan"
            isi="Belum ada riwayat pemindaian keamanan. Jalankan Dokter Keamanan dari aplikasi Dokter HP di Android untuk mengisi data ini."
          />
        </div>
      ) : null}

      {statusMuat === "siap" && entri.length > 0 ? (
        <>
          <section aria-labelledby="perlu-ditinjau-judul" className="mt-8">
            <h2
              id="perlu-ditinjau-judul"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Perlu ditinjau
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Aplikasi di bawah ini meminta 4 izin berbahaya atau lebih.
              Tinjau satu per satu: bila aplikasi tidak dikenal atau tidak
              dipakai lagi, hapus dari Pengaturan &gt; Aplikasi di HP.
            </p>
            {perluDitinjau.length === 0 ? (
              <p className="mt-4 rounded-xl bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                Tidak ada aplikasi yang perlu ditinjau dari data terakhir.
              </p>
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

          <section aria-labelledby="semua-aplikasi-judul" className="mt-8">
            <h2
              id="semua-aplikasi-judul"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Semua aplikasi
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Aplikasi sistem adalah bagian dari HP dan biasanya tidak bisa
              dihapus.
            </p>
            {semuaAplikasi.length === 0 ? (
              <p className="mt-4 rounded-xl bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                Catatan yang tersimpan belum berisi daftar aplikasi.
              </p>
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
                          {aplikasi.nama} —{" "}
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
    </main>
  );
}
