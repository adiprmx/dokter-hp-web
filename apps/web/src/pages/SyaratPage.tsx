import { useEffect } from "react";
import { Link } from "react-router-dom";

// Halaman Syarat Layanan (/syarat). Publik — bisa dibuka tanpa masuk.
// Isi mengikuti docs/syarat-layanan.md (17 November 2026, draf),
// diringkas seperlunya tanpa mengubah maknanya. Bila ada perbedaan,
// dokumen di repo adalah acuan.

export default function SyaratPage() {
  useEffect(() => {
    document.title = "Syarat Layanan — Dokter HP";
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/tentang"
          className="inline-flex min-h-[48px] items-center text-sm text-zinc-300 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Kembali ke Tentang
        </Link>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Syarat Layanan
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Terakhir diperbarui: 17 November 2026
        </p>
        <p className="mt-4 rounded-xl border border-zinc-800 bg-[#121215] p-4 text-sm text-zinc-300">
          Dokumen ini adalah draf dan perlu peninjauan akhir sebelum tayang.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          Dengan memakai Dokter HP, pengguna menyetujui syarat-syarat
          berikut. Bila pengguna tidak menyetujui syarat ini, pengguna
          sebaiknya tidak memakai layanan.
        </p>

        <section aria-labelledby="layanan" className="mt-8">
          <h2 id="layanan" className="text-lg font-semibold">
            1. Layanan
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Dokter HP adalah aplikasi web gratis yang membantu pengguna
            memeriksa kondisi HP mereka — WiFi, baterai, penyimpanan,
            performa, dan keamanan — serta memberikan rekomendasi perbaikan
            dan diagnosis berbasis AI.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Layanan diberikan gratis dan apa adanya (&quot;as is&quot;), tanpa
            jaminan apa pun, baik tersurat maupun tersirat. Dokter HP tidak
            memungut biaya, tidak memakai payment gateway, dan tidak
            menampilkan iklan.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pengembang dapat mengubah, menunda, atau menghentikan sebagian
            atau seluruh layanan kapan saja, dengan atau tanpa pemberitahuan
            terlebih dahulu. Bila layanan dihentikan, pengguna tetap dapat
            mengekspor dan menghapus datanya selama layanan masih tersedia.
          </p>
        </section>

        <section aria-labelledby="akun" className="mt-8">
          <h2 id="akun" className="text-lg font-semibold">
            2. Akun pengguna
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Untuk menyimpan riwayat pemeriksaan, pengguna masuk dengan akun
              Google. Tes WiFi sekali jalan dapat dipakai tanpa akun dan
              tanpa menyimpan data.
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

        <section aria-labelledby="larangan" className="mt-8">
          <h2 id="larangan" className="text-lg font-semibold">
            3. Penggunaan yang dilarang
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pengguna dilarang:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Memakai layanan untuk tujuan yang melanggar hukum yang berlaku.
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
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pengembang berhak membatasi atau menghentikan akses pengguna yang
            melanggar ketentuan ini.
          </p>
        </section>

        <section aria-labelledby="ai" className="mt-8">
          <h2 id="ai" className="text-lg font-semibold">
            4. Diagnosis AI adalah saran, bukan vonis
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Jawaban Diagnosis AI adalah saran berdasarkan data yang
              tersedia dan pertanyaan pengguna. Jawaban tersebut bukan
              diagnosis pasti, bukan pengganti teknisi, dan bukan jaminan
              bahwa suatu langkah perbaikan akan menyelesaikan masalah.
            </li>
            <li>
              Skor kesehatan, estimasi waktu pakai baterai, dan rekomendasi
              lain bersifat perkiraan berdasarkan data yang tersedia;
              komponen tanpa data dilewati dalam perhitungan.
            </li>
            <li>
              Untuk kerusakan perangkat keras atau masalah yang tidak kunjung
              teratasi, pengguna disarankan berkonsultasi dengan teknisi.
            </li>
            <li>
              Pengguna memakai saran dan rekomendasi Dokter HP atas risiko
              dan pertimbangannya sendiri.
            </li>
          </ul>
        </section>

        <section aria-labelledby="tanggung-jawab" className="mt-8">
          <h2 id="tanggung-jawab" className="text-lg font-semibold">
            5. Batasan tanggung jawab
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Dokter HP diberikan apa adanya tanpa jaminan bahwa layanan akan
              selalu tersedia, bebas gangguan, atau bebas dari kesalahan.
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

        <section aria-labelledby="privasi" className="mt-8">
          <h2 id="privasi" className="text-lg font-semibold">
            6. Data dan privasi
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pengumpulan, penyimpanan, dan pemakaian data pengguna diatur
            dalam{" "}
            <Link
              to="/privasi"
              className="text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Kebijakan Privasi
            </Link>{" "}
            Dokter HP. Dengan memakai layanan, pengguna menyetujui
            pengumpulan dan pemakaian data sebagaimana dijelaskan di sana.
          </p>
        </section>

        <section aria-labelledby="perubahan" className="mt-8">
          <h2 id="perubahan" className="text-lg font-semibold">
            7. Perubahan syarat
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pengembang dapat mengubah syarat ini dari waktu ke waktu. Versi
            terbaru akan ditampilkan di aplikasi dan tanggal &quot;Terakhir
            diperbarui&quot; di atas akan disesuaikan. Pemakaian layanan
            setelah perubahan berlaku dianggap sebagai persetujuan atas syarat
            yang baru. Pengguna yang tidak setuju dapat berhenti memakai
            layanan dan menghapus akunnya beserta seluruh datanya.
          </p>
        </section>

        <section aria-labelledby="kontak" className="mt-8">
          <h2 id="kontak" className="text-lg font-semibold">
            8. Kontak
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pertanyaan tentang syarat layanan ini dapat disampaikan kepada
            pengembang Dokter HP melalui repositori publik proyek Dokter HP
            (repo adiprmx/dokter-hp) atau melalui halaman Tentang di dalam
            aplikasi.
          </p>
          <a
            href="https://github.com/adiprmx/dokter-hp"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-[48px] items-center text-sm text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Repositori publik Dokter HP (GitHub)
          </a>
        </section>

        <p className="mt-8 border-t border-zinc-800 pt-4 text-sm text-zinc-400">
          Dokumen ini adalah draf dan perlu peninjauan akhir sebelum tayang.{" "}
          <Link
            to="/privasi"
            className="text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Lihat juga Kebijakan Privasi
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
