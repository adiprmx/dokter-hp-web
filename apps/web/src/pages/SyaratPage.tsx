import { useEffect } from "react";
import { Link } from "react-router-dom";
import { MeterStrip } from "../components/ui/MeterStrip";

// Halaman Syarat Layanan (/syarat). Publik, bisa dibuka tanpa masuk.
// Isi mengikuti docs/syarat-layanan.md (ditinjau 18 November 2026),
// diringkas seperlunya tanpa mengubah maknanya. Bila ada perbedaan,
// dokumen di repo adalah acuan.
// Redesign v2.0 (mode Read): kolom baca 65ch, teks tubuh 16px,
// daftar isi jangkar (panel samping menempel di desktop, rincian
// lipat di HP). Isi sudah ditinjau Tim Syarat Wave 2
// (18 November 2026).

const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

interface ButirDaftarIsi {
  id: string;
  label: string;
}

const DAFTAR_ISI: ReadonlyArray<ButirDaftarIsi> = [
  { id: "layanan", label: "1. Layanan" },
  { id: "akun", label: "2. Akun pengguna" },
  { id: "larangan", label: "3. Penggunaan yang dilarang" },
  { id: "ai", label: "4. Diagnosis AI adalah saran, bukan vonis" },
  { id: "tanggung-jawab", label: "5. Batasan tanggung jawab" },
  { id: "privasi", label: "6. Data dan privasi" },
  { id: "perubahan", label: "7. Perubahan syarat" },
  { id: "kontak", label: "8. Kontak" },
];

function DaftarIsiList() {
  return (
    <ul className="space-y-1">
      {DAFTAR_ISI.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={`block rounded-lg px-3 py-3 text-base leading-snug text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-white ${FOKUS}`}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function SyaratPage() {
  useEffect(() => {
    document.title = "Syarat Layanan — Dokter HP";
  }, []);

  return (
    <div className="bg-black text-[var(--color-text-primary)]">
      <div className="mx-auto w-full max-w-[65ch] pb-16 pt-4 lg:grid lg:max-w-none lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden self-start lg:sticky lg:top-20 lg:block">
          <nav aria-label="Daftar isi">
            <h2 className="text-base font-semibold text-white">Daftar isi</h2>
            <div className="mt-3">
              <DaftarIsiList />
            </div>
          </nav>
        </aside>

        <article className="min-w-0 max-w-[65ch]">
          <Link
            to="/tentang"
            className={`inline-flex min-h-[48px] items-center text-base text-[var(--color-text-secondary)] underline underline-offset-4 ${FOKUS}`}
          >
            Kembali ke Tentang
          </Link>

          <header className="mt-2">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Syarat Layanan
            </h1>
            <MeterStrip className="mt-5" />
            <p className="mt-5 text-sm text-[var(--color-text-muted)]">
              Terakhir diperbarui: 18 November 2026
            </p>
          </header>

          <details className="mt-6 rounded-xl bg-[var(--color-surface)] px-5 lg:hidden">
            <summary
              className={`flex min-h-[48px] cursor-pointer items-center text-base font-semibold text-white ${FOKUS}`}
            >
              Daftar isi
            </summary>
            <nav aria-label="Daftar isi" className="pb-3">
              <DaftarIsiList />
            </nav>
          </details>

          <p className="mt-6 text-base leading-relaxed text-[var(--color-text-secondary)]">
            Dengan memakai Dokter HP, pengguna menyetujui syarat-syarat
            berikut. Bila pengguna tidak menyetujui syarat ini, pengguna
            sebaiknya tidak memakai layanan.
          </p>

          <section aria-labelledby="layanan" className="mt-10">
            <h2
              id="layanan"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              1. Layanan
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Dokter HP adalah aplikasi web gratis yang membantu pengguna
              memeriksa kondisi HP mereka (WiFi, baterai, penyimpanan,
              performa, dan keamanan) serta memberikan rekomendasi perbaikan
              dan diagnosis berbasis AI.
            </p>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Layanan diberikan gratis dan apa adanya (&quot;as is&quot;),
              tanpa jaminan apa pun, baik tersurat maupun tersirat. Dokter HP
              tidak memungut biaya, tidak memakai payment gateway, dan tidak
              menampilkan iklan.
            </p>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pengembang dapat mengubah, menunda, atau menghentikan sebagian
              atau seluruh layanan kapan saja, dengan atau tanpa pemberitahuan
              terlebih dahulu. Bila layanan dihentikan, pengguna tetap dapat
              mengekspor dan menghapus datanya selama layanan masih tersedia.
            </p>
          </section>

          <section aria-labelledby="akun" className="mt-10">
            <h2
              id="akun"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              2. Akun pengguna
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
              <li>
                Untuk menyimpan riwayat pemeriksaan, pengguna masuk dengan
                akun Google. Tes WiFi sekali jalan dapat dipakai tanpa akun
                dan tanpa menyimpan data.
              </li>
              <li>
                Pengguna bertanggung jawab penuh atas keamanan akunnya,
                termasuk menjaga kerahasiaan akun Google yang dipakai untuk
                masuk dan menjaga kerahasiaan PIN aplikasi bila PIN diatur.
              </li>
              <li>
                Pengguna wajib segera keluar dari sesi di perangkat yang bukan
                miliknya dan dapat memakai fitur keluar dari sesi lain di
                Pengaturan bila merasa akunnya dipakai pihak lain.
              </li>
              <li>
                Pengembang tidak bertanggung jawab atas kerugian yang timbul
                karena pengguna membagikan akses akunnya kepada orang lain.
              </li>
            </ul>
          </section>

          <section aria-labelledby="larangan" className="mt-10">
            <h2
              id="larangan"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              3. Penggunaan yang dilarang
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pengguna dilarang:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
              <li>
                Memakai layanan untuk tujuan yang melanggar hukum yang
                berlaku.
              </li>
              <li>
                Mencoba mengakses data pengguna lain, membobol sistem, atau
                mengganggu berjalannya layanan.
              </li>
              <li>
                Mengirim permintaan dalam jumlah berlebihan yang sengaja
                membebani server (termasuk melewati batas pemakaian wajar
                Diagnosis AI).
              </li>
              <li>
                Memakai layanan untuk menyebarkan konten yang berbahaya,
                menipu, atau melanggar hak pihak lain.
              </li>
              <li>
                Meniru, menyalin, atau mengatasnamakan Dokter HP untuk menipu
                pihak lain.
              </li>
            </ul>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pengembang berhak membatasi atau menghentikan akses pengguna
              yang melanggar ketentuan ini.
            </p>
          </section>

          <section aria-labelledby="ai" className="mt-10">
            <h2
              id="ai"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              4. Diagnosis AI adalah saran, bukan vonis
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
              <li>
                Jawaban Diagnosis AI adalah saran berdasarkan data yang
                tersedia dan pertanyaan pengguna. Jawaban tersebut bukan
                diagnosis pasti, bukan pengganti teknisi, dan bukan jaminan
                bahwa suatu langkah perbaikan akan menyelesaikan masalah.
              </li>
              <li>
                Skor kesehatan, estimasi waktu pakai baterai, dan rekomendasi
                lain bersifat perkiraan berdasarkan data yang tersedia.
                Skor setiap pemeriksaan dihitung dari komponen yang
                diperiksa saja.
              </li>
              <li>
                Untuk kerusakan perangkat keras atau masalah yang tidak
                kunjung teratasi, pengguna disarankan berkonsultasi dengan
                teknisi.
              </li>
              <li>
                Pengguna memakai saran dan rekomendasi Dokter HP atas risiko
                dan pertimbangannya sendiri.
              </li>
            </ul>
          </section>

          <section aria-labelledby="tanggung-jawab" className="mt-10">
            <h2
              id="tanggung-jawab"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              5. Batasan tanggung jawab
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
              <li>
                Dokter HP diberikan apa adanya tanpa jaminan bahwa layanan
                akan selalu tersedia, bebas gangguan, atau bebas dari
                kesalahan.
              </li>
              <li>
                Pengembang tidak bertanggung jawab atas kerugian langsung
                maupun tidak langsung yang timbul dari pemakaian layanan,
                termasuk kehilangan data, kerusakan perangkat, atau biaya yang
                timbul akibat mengikuti saran dari aplikasi.
              </li>
              <li>
                Dokter HP bergantung pada layanan pihak ketiga (Google untuk
                masuk akun dan Gemini untuk Diagnosis AI). Gangguan pada
                layanan tersebut berada di luar kendali pengembang.
              </li>
              <li>
                Pengguna bertanggung jawab atas data yang diisinya secara
                manual dan atas pertanyaan yang dikirimkannya ke Diagnosis AI.
                Pengguna disarankan tidak menuliskan informasi yang sangat
                sensitif (misalnya kata sandi atau nomor identitas) di dalam
                pertanyaan AI.
              </li>
            </ul>
          </section>

          <section aria-labelledby="privasi" className="mt-10">
            <h2
              id="privasi"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              6. Data dan privasi
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pengumpulan, penyimpanan, dan pemakaian data pengguna diatur
              dalam{" "}
              <Link
                to="/privasi"
                className={`text-white underline underline-offset-4 ${FOKUS}`}
              >
                Kebijakan Privasi
              </Link>{" "}
              Dokter HP. Dengan memakai layanan, pengguna menyetujui
              pengumpulan dan pemakaian data sebagaimana dijelaskan di sana.
            </p>
          </section>

          <section aria-labelledby="perubahan" className="mt-10">
            <h2
              id="perubahan"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              7. Perubahan syarat
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pengembang dapat mengubah syarat ini dari waktu ke waktu. Versi
              terbaru akan ditampilkan di aplikasi dan tanggal &quot;Terakhir
              diperbarui&quot; di atas akan disesuaikan. Pemakaian layanan
              setelah perubahan berlaku dianggap sebagai persetujuan atas
              syarat yang baru. Pengguna yang tidak setuju dapat berhenti
              memakai layanan dan menghapus akunnya beserta seluruh datanya.
            </p>
          </section>

          <section aria-labelledby="kontak" className="mt-10">
            <h2
              id="kontak"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              8. Kontak
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pertanyaan tentang syarat layanan ini dapat disampaikan kepada
              pengembang Dokter HP melalui repositori publik proyek Dokter HP
              (repo adiprmx/dokter-hp) atau melalui halaman Tentang di dalam
              aplikasi.
            </p>
            <a
              href="https://github.com/adiprmx/dokter-hp"
              target="_blank"
              rel="noreferrer"
              className={`mt-2 inline-flex min-h-[48px] items-center text-base text-white underline underline-offset-4 ${FOKUS}`}
            >
              Repositori publik Dokter HP (GitHub)
            </a>
          </section>

          <p className="mt-10 border-t border-[var(--color-border)] pt-5 text-base text-[var(--color-text-muted)]">
            <Link
              to="/privasi"
              className={`text-white underline underline-offset-4 ${FOKUS}`}
            >
              Lihat juga Kebijakan Privasi
            </Link>
          </p>
        </article>
      </div>
    </div>
  );
}
