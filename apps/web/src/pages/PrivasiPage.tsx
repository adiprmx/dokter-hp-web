import { useEffect } from "react";
import { Link } from "react-router-dom";

// Halaman Kebijakan Privasi (/privasi). Publik — bisa dibuka tanpa masuk.
// Isi mengikuti docs/kebijakan-privasi.md (17 November 2026, draf),
// diringkas seperlunya tanpa mengubah maknanya. Bila ada perbedaan,
// dokumen di repo adalah acuan.

export default function PrivasiPage() {
  useEffect(() => {
    document.title = "Kebijakan Privasi — Dokter HP";
  }, []);

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/tentang"
          className="inline-flex min-h-[48px] items-center text-sm text-zinc-300 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Kembali ke Tentang
        </Link>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Kebijakan Privasi
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Terakhir diperbarui: 17 November 2026
        </p>
        <p className="mt-4 rounded-xl border border-zinc-800 bg-[#121215] p-4 text-sm text-zinc-300">
          Dokumen ini adalah draf dan perlu peninjauan akhir sebelum tayang.
        </p>

        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          Dokter HP adalah aplikasi web yang membantu pengguna memeriksa
          kondisi HP mereka — mulai dari WiFi, baterai, penyimpanan,
          performa, hingga keamanan — lewat browser. Dokumen ini menjelaskan
          data apa saja yang dikumpulkan Dokter HP, untuk apa data itu
          dipakai, di mana data itu disimpan, dan hak apa saja yang dimiliki
          pengguna atas datanya.
        </p>

        <section aria-labelledby="ringkasan" className="mt-8">
          <h2 id="ringkasan" className="text-lg font-semibold">
            Ringkasan singkat
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Dokter HP hanya mengumpulkan data yang dibutuhkan agar
              fitur-fiturnya berjalan: akun, riwayat pemeriksaan, laporan
              WiFi, dan riwayat tanya-jawab AI.
            </li>
            <li>Data hanya bisa dilihat oleh pemilik akun itu sendiri.</li>
            <li>
              Dokter HP tidak menampilkan iklan, tidak memakai pelacakan
              pihak ketiga, tidak menjual data, dan tidak memakai payment
              gateway.
            </li>
            <li>
              Pengguna bisa melihat, mengekspor, dan menghapus seluruh
              datanya kapan saja.
            </li>
          </ul>
        </section>

        <section aria-labelledby="data" className="mt-8">
          <h2 id="data" className="text-lg font-semibold">
            1. Data yang dikumpulkan dan tujuannya
          </h2>

          <h3 className="mt-5 text-base font-semibold">1.1 Data akun</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Saat pengguna masuk dengan Google, Dokter HP menerima dan
            menyimpan nama (untuk ditampilkan di profil dan dashboard),
            alamat email (untuk mengidentifikasi akun), dan pengenal akun
            Google (untuk mengenali akun yang sama saat masuk kembali). Data
            ini hanya diambil setelah pengguna menekan tombol masuk dan
            menyetujui di halaman Google. Dokter HP tidak menerima atau
            menyimpan kata sandi Google pengguna.
          </p>

          <h3 className="mt-5 text-base font-semibold">1.2 PIN aplikasi</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Pengguna boleh mengatur PIN 4–8 digit sebagai kunci tambahan.
            PIN asli tidak pernah disimpan — yang disimpan hanya hasil hash
            SHA-256 dari PIN yang dicampur salt (nilai acak). Karena itu,
            tidak ada pihak mana pun, termasuk pengembang, yang bisa melihat
            PIN pengguna. Bila lupa PIN, pemulihannya adalah masuk ulang
            dengan Google lalu mengatur PIN baru dari Pengaturan; riwayat
            tetap aman. Dokter HP juga mencatat jumlah percobaan PIN salah
            berturut-turut: setelah 5 kali salah, masukan PIN dikunci selama
            30 detik.
          </p>

          <h3 className="mt-5 text-base font-semibold">
            1.3 Riwayat pemeriksaan kesehatan
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Setiap kali pengguna menjalankan diagnosis, Dokter HP menyimpan
            skor kesehatan HP (0–100) dan ringkasan hasil pemeriksaan (status
            baterai, penyimpanan, performa, keamanan, dan sumber tiap
            komponen — dari tes web, input manual, atau riwayat APK).
            Tujuannya: menampilkan skor, grafik riwayat, dan tiga pemeriksaan
            terakhir di dashboard.
          </p>

          <h3 className="mt-5 text-base font-semibold">1.4 Laporan WiFi</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Setiap kali pengguna menjalankan tes WiFi sambil masuk, Dokter HP
            menyimpan hasil tes kecepatan unduh dan latensi HTTP yang diukur
            di browser, info jaringan yang diisi manual (misalnya nama WiFi,
            kekuatan sinyal, channel, dan DNS), sampel kecepatan per detik
            dari tes bertahan 30 detik (maksimal 30 sampel per laporan), dan
            rekomendasi yang ditampilkan bersama hasil tes. Browser tidak
            bisa membaca nama WiFi, sinyal, channel, atau DNS secara
            otomatis — kolom-kolom itu hanya terisi bila pengguna mengisinya
            sendiri. Tes WiFi tanpa masuk tidak menyimpan apa pun.
          </p>

          <h3 className="mt-5 text-base font-semibold">
            1.5 Riwayat tanya-jawab AI
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Saat pengguna memakai Diagnosis AI, Dokter HP menyimpan
            pertanyaan yang dikirim dan jawaban yang diterima, agar pengguna
            bisa melihat kembali riwayat tanya-jawabnya. Penjelasan lebih
            lanjut tentang pemrosesan data AI ada di bagian 6.
          </p>

          <h3 className="mt-5 text-base font-semibold">
            1.6 Data sesi dan teknis
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Agar pengguna tetap masuk dan layanan berjalan aman, Dokter HP
            menyimpan hash token sesi (SHA-256; token mentahnya hanya ada di
            cookie browser pengguna dan tidak pernah disimpan di server),
            info perangkat lunak browser dan alamat IP terakhir (untuk
            menampilkan daftar sesi aktif di Pengaturan), dan alamat IP
            publik saat tes WiFi dijalankan (karena alamat IP adalah bagian
            dari hasil tes jaringan). Dokter HP tidak mencatat isi PIN, token
            sesi mentah, atau isi lengkap jawaban AI di log server; log hanya
            berisi id, status, dan waktu.
          </p>

          <h3 className="mt-5 text-base font-semibold">
            1.7 Data yang TIDAK dikumpulkan
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Dokter HP tidak membaca daftar aplikasi, level baterai,
              penyimpanan, RAM, CPU, atau suhu HP secara langsung dari
              browser — browser tidak mengizinkannya. Data semacam itu hanya
              ada bila pengguna mengisinya manual atau berasal dari riwayat
              APK.
            </li>
            <li>
              Dokter HP tidak mengumpulkan lokasi, kontak, foto, atau file
              dari perangkat pengguna.
            </li>
            <li>
              Dokter HP tidak memakai iklan dan tidak memakai alat pelacak
              pihak ketiga.
            </li>
          </ul>
        </section>

        <section aria-labelledby="penyimpanan" className="mt-8">
          <h2 id="penyimpanan" className="text-lg font-semibold">
            2. Di mana data disimpan
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Seluruh data pengguna disimpan di database Cloudflare D1, yaitu
            database yang dikelola untuk proyek Dokter HP. Data inti (akun,
            riwayat, diagnosis) tinggal di database ini dan tidak diserahkan
            ke layanan pihak ketiga lain, kecuali dua pengecualian yang
            dijelaskan di bagian 6 dan 7. Seluruh komunikasi antara browser
            dan server memakai HTTPS (koneksi terenkripsi).
          </p>
        </section>

        <section aria-labelledby="akses" className="mt-8">
          <h2 id="akses" className="text-lg font-semibold">
            3. Siapa yang bisa melihat data
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Hanya pengguna sendiri. Setiap permintaan data difilter
              berdasarkan akun yang sedang masuk. Pengguna A tidak bisa
              membaca, mengubah, atau menghapus data pengguna B.
            </li>
            <li>
              Pengembang tidak mengakses data pengguna untuk keperluan
              sehari-hari. Akses ke database hanya dilakukan bila diperlukan
              untuk pemeliharaan teknis atau perbaikan gangguan, dan tidak
              dipakai untuk membaca isi data pribadi pengguna.
            </li>
            <li>
              Tidak ada pihak lain. Dokter HP tidak membagikan, menyewakan,
              atau menjual data pengguna kepada siapa pun.
            </li>
          </ul>
        </section>

        <section aria-labelledby="retensi" className="mt-8">
          <h2 id="retensi" className="text-lg font-semibold">
            4. Berapa lama data disimpan
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Data akun dan riwayat disimpan selama akun masih ada. Pengguna
              bisa menghapus entri riwayat satu per satu dari halaman
              Riwayat. Entri yang dihapus disembunyikan dari tampilan dan
              dihapus permanen saat akun dihapus.
            </li>
            <li>
              Sesi login berlaku 30 hari sejak dibuat, lalu kedaluwarsa
              secara otomatis. Pengguna bisa keluar kapan saja, dan keluar
              akan menghapus sesi tersebut dari server.
            </li>
            <li>
              PIN tersimpan sebagai hash selama pengguna tidak menghapusnya.
              Pengguna bisa mengubah atau menghapus PIN dari Pengaturan.
            </li>
            <li>
              Menghapus akun akan menghapus profil dan seluruh data pengguna
              secara permanen, termasuk riwayat pemeriksaan, laporan WiFi,
              dan riwayat tanya-jawab AI. Penghapusan akun tidak bisa
              dibatalkan.
            </li>
          </ul>
        </section>

        <section aria-labelledby="cookie" className="mt-8">
          <h2 id="cookie" className="text-lg font-semibold">
            5. Cookie dan sesi
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Dokter HP memakai cookie hanya untuk keperluan login, bukan untuk
            pelacakan: cookie sesi (dokter_hp_session, 30 hari) agar pengguna
            tetap masuk, dan cookie sementara saat masuk Google (penanda
            keamanan selama proses masuk, berakhir setelah proses selesai).
            Cookie sesi bersifat HttpOnly (tidak bisa dibaca skrip di
            halaman), Secure (hanya lewat HTTPS), dan SameSite=Lax. Dokter HP
            tidak memakai cookie iklan, cookie pelacak, atau cookie pihak
            ketiga. Bila pengguna memblokir cookie, fitur masuk dan
            penyimpanan riwayat tidak akan berfungsi, tetapi tes WiFi tanpa
            akun tetap bisa dijalankan.
          </p>
        </section>

        <section aria-labelledby="ai" className="mt-8">
          <h2 id="ai" className="text-lg font-semibold">
            6. Data AI (Diagnosis AI)
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Saat pengguna mengirim pertanyaan ke Diagnosis AI, pertanyaan
            dikirim dari browser ke server Dokter HP. Server menambahkan
            ringkasan data perangkat pengguna (pemeriksaan terakhir dan
            laporan WiFi terakhir) sebagai konteks, lalu mengirim pertanyaan
            beserta konteks tersebut ke layanan Google Gemini — pengiriman
            ini terjadi dari server, bukan dari browser, dan kunci API tidak
            pernah ada di browser. Jawaban dari Gemini disimpan ke riwayat
            tanya-jawab pengguna dan ditampilkan di layar.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Artinya, pertanyaan pengguna dan ringkasan data perangkatnya
            diproses oleh Google Gemini untuk menghasilkan jawaban. Pengguna
            disarankan tidak menuliskan informasi yang sangat sensitif
            (misalnya kata sandi, nomor rekening, atau nomor identitas) di
            dalam pertanyaan AI. Jawaban AI adalah saran, bukan vonis pasti.
          </p>
        </section>

        <section aria-labelledby="pihak-ketiga" className="mt-8">
          <h2 id="pihak-ketiga" className="text-lg font-semibold">
            7. Layanan pihak ketiga yang dipakai
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Dokter HP memakai dua layanan pihak ketiga: Google (Masuk dengan
            Google) untuk identitas akun — Google mengembalikan nama, email,
            dan pengenal akun ke server Dokter HP; dan Google Gemini sebagai
            mesin Diagnosis AI — menerima pertanyaan pengguna dan ringkasan
            data perangkat, dikirim dari server. Selain kedua layanan di
            atas, Dokter HP tidak mengirim data pengguna ke pihak ketiga mana
            pun. Laporan PDF dibuat di browser pengguna sendiri, bukan
            dikirim ke layanan PDF pihak ketiga.
          </p>
        </section>

        <section aria-labelledby="keamanan" className="mt-8">
          <h2 id="keamanan" className="text-lg font-semibold">
            8. Keamanan data
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Seluruh komunikasi memakai HTTPS.</li>
            <li>PIN disimpan sebagai hash SHA-256 + salt, bukan teks asli.</li>
            <li>
              Token sesi disimpan sebagai hash; token mentah hanya ada di
              cookie pengguna.
            </li>
            <li>
              Kunci API dan secret lain hanya tersimpan di sisi server dan
              tidak pernah ada di kode aplikasi atau di browser.
            </li>
            <li>
              Setiap permintaan data memeriksa kepemilikan akun sebelum
              mengembalikan apa pun.
            </li>
            <li>
              Percobaan PIN dibatasi: 5 kali salah berturut-turut mengunci
              masukan selama 30 detik.
            </li>
            <li>
              Permintaan ke layanan AI dibatasi per pengguna per hari agar
              kuota bersama tidak dihabiskan satu pengguna.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Tidak ada sistem yang bisa menjamin keamanan mutlak. Bila terjadi
            gangguan keamanan yang memengaruhi data pengguna, pengembang akan
            menginformasikannya melalui aplikasi dan memperbaikinya secepat
            mungkin.
          </p>
        </section>

        <section aria-labelledby="hak" className="mt-8">
          <h2 id="hak" className="text-lg font-semibold">
            9. Hak pengguna
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>
              Melihat seluruh datanya: profil di Pengaturan, riwayat di
              halaman Riwayat, dan riwayat tanya-jawab di halaman Diagnosis
              AI.
            </li>
            <li>
              Mengekspor datanya: mengunduh laporan PDF berisi riwayat
              pemeriksaan dan WiFi dari halaman Riwayat, atau mengunduh
              seluruh data sebagai berkas JSON dari Pengaturan.
            </li>
            <li>
              Menghapus datanya: menghapus entri riwayat satu per satu, atau
              menghapus akun beserta seluruh datanya dari Pengaturan
              (penghapusan akun bersifat permanen dan tidak bisa dibatalkan).
            </li>
            <li>
              Mengubah datanya: mengubah nama tampilan dan PIN dari
              Pengaturan.
            </li>
            <li>Keluar dari satu atau semua sesi dari Pengaturan.</li>
            <li>
              Memakai layanan tanpa akun untuk tes WiFi sekali jalan — tanpa
              data apa pun yang tersimpan.
            </li>
          </ul>
        </section>

        <section aria-labelledby="perubahan" className="mt-8">
          <h2 id="perubahan" className="text-lg font-semibold">
            10. Perubahan kebijakan
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Bila kebijakan ini berubah, versi terbaru akan ditampilkan di
            aplikasi dan tanggal &quot;Terakhir diperbarui&quot; di atas akan
            disesuaikan. Perubahan yang bersifat besar (misalnya jenis data
            baru yang dikumpulkan) akan diumumkan di dalam aplikasi sebelum
            berlaku. Pengguna yang tidak setuju dengan perubahan tersebut
            dapat menghapus akunnya beserta seluruh datanya.
          </p>
        </section>

        <section aria-labelledby="kontak" className="mt-8">
          <h2 id="kontak" className="text-lg font-semibold">
            11. Kontak
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pertanyaan, keberatan, atau permintaan terkait data pribadi dapat
            disampaikan kepada pengembang Dokter HP melalui repositori publik
            proyek Dokter HP (repo adiprmx/dokter-hp) atau melalui halaman
            Tentang di dalam aplikasi.
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
            to="/syarat"
            className="text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Lihat juga Syarat Layanan
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
