import { useState, type ReactNode } from "react";
import {
  formatTanggalWaktu,
  labelSumber,
  type DoctorEntry,
} from "../../lib/doctor";
import { labelStatus, statusDariDoctor } from "../../lib/status-warna";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { StatusBadge } from "../ui/StatusBadge";

export interface DoctorHistoryListProps<E extends DoctorEntry> {
  entri: E[];
  /** Isi detail tiap entri (nilai-nilai yang dicatat). */
  renderDetail: (entri: E) => ReactNode;
  /** Dipanggil saat pengguna mengonfirmasi hapus; melempar galat bila gagal. */
  onHapus: (id: string) => Promise<void>;
  /** Id entri yang sedang dihapus (tombolnya dinonaktifkan). */
  menghapusId: string | null;
}

// Keadaan kosong yang jujur untuk layar dokter (pola yang sama dengan
// components/ui/EmptyState): judul + penjelasan + langkah berikutnya.
// Judul memakai <p> agar halaman yang menentukan hierarki heading.
export function DoctorEmptyState({
  judul,
  isi,
}: {
  judul: string;
  isi: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <p className="text-base font-semibold text-[var(--color-text-primary)]">
        {judul}
      </p>
      <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-[var(--color-text-muted)]">
        {isi}
      </p>
    </div>
  );
}

// Daftar riwayat bersama untuk keempat layar dokter: tanggal, sumber,
// status, detail, dan tombol hapus per entri. Hapus memakai konfirmasi
// dua langkah di tempat (Hapus -> Ya, hapus / Batal) agar tidak ada
// penghapusan yang tidak disengaja dan tidak perlu dialog modal.
// Nama tombol hapus menyebut tanggal entri (a11y.md 6.8).
//
// Redesign v2.0: tiap entri adalah Card status (tinta + bingkai warna
// dari statusDariDoctor, satu-satunya pemetaan di lib/status-warna)
// dengan StatusBadge berlabel teks. Props dan perilaku tidak berubah:
// halaman pemanggil tetap mengendalikan data, hapus, dan detail.
export function DoctorHistoryList<E extends DoctorEntry>({
  entri,
  renderDetail,
  onHapus,
  menghapusId,
}: DoctorHistoryListProps<E>) {
  const [konfirmasiId, setKonfirmasiId] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-3">
      {entri.map((item) => {
        const tanggal = formatTanggalWaktu(item.dibuatPada);
        const sedangMenghapus = menghapusId === item.id;
        const menungguKonfirmasi = konfirmasiId === item.id;
        const statusWarna = item.status
          ? statusDariDoctor(item.status)
          : null;
        return (
          <li key={item.id}>
            <Card status={statusWarna ?? undefined}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {tanggal}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                    {labelSumber(item.sumber)}
                  </p>
                </div>
                {item.status && statusWarna ? (
                  <StatusBadge status={statusWarna}>
                    {labelStatus(statusWarna)}
                  </StatusBadge>
                ) : null}
              </div>

              <div className="mt-3 flex flex-col gap-1 text-sm leading-relaxed text-[var(--color-text-primary)]">
                {renderDetail(item)}
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {menungguKonfirmasi ? (
                  <>
                    <p className="w-full text-sm text-[var(--color-text-muted)]">
                      Entri ini akan dihapus dari riwayat Anda.
                    </p>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        try {
                          await onHapus(item.id);
                        } finally {
                          setKonfirmasiId(null);
                        }
                      }}
                      disabled={sedangMenghapus}
                      loading={sedangMenghapus}
                    >
                      {sedangMenghapus ? "Menghapus…" : "Ya, hapus"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setKonfirmasiId(null)}
                      disabled={sedangMenghapus}
                    >
                      Batal
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => setKonfirmasiId(item.id)}
                    disabled={sedangMenghapus}
                    aria-label={`Hapus catatan ${tanggal}`}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
