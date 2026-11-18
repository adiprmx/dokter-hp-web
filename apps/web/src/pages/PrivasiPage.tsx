import { useEffect } from "react";
import { Link } from "react-router-dom";
import { MeterStrip } from "../components/ui/MeterStrip";

// Halaman Kebijakan Privasi (/privasi). Publik, bisa dibuka tanpa masuk.
// Isi mengikuti docs/kebijakan-privasi.md (ditinjau 18 November 2026),
// diringkas seperlunya tanpa mengubah maknanya. Bila ada perbedaan,
// dokumen di repo adalah acuan.
// Redesign v2.0 (mode Read): RESTYLE VISUAL SAJA. Isi kebijakan sudah
// ditinjau dan diperbaiki Tim Privasi Wave 1. Tidak satu pun fakta,
// angka, atau klaim diubah di sini; yang berubah hanya tata letak dan
// komponen (kolom baca 65ch, teks tubuh 16px, daftar isi jangkar).

const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

interface ButirDaftarIsi {
  id: string;
  label: string;
}

const DAFTAR_ISI: ReadonlyArray<ButirDaftarIsi> = [
  { id: "ringkasan", label: "Ringkasan singkat" },
  { id: "data", label: "1. Data yang dikumpulkan dan tujuannya" },
  { id: "penyimpanan", label: "2. Di mana data disimpan" },
  { id: "akses", label: "3. Siapa yang bisa melihat data" },
  { id: "retensi", label: "4. Berapa lama data disimpan" },
  { id: "cookie", label: "5. Cookie dan sesi" },
  { id: "ai", label: "6. Data AI (Diagnosis AI)" },
  { id: "pihak-ketiga", label: "7. Layanan pihak ketiga yang dipakai" },
  { id: "keamanan", label: "8. Keamanan data" },
  { id: "hak", label: "9. Hak pengguna" },
  { id: "perubahan", label: "10. Perubahan kebijakan" },
  { id: "kontak", label: "11. Kontak" },
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

export default function PrivasiPage() {
  useEffect(() => {
    document.title = "Kebijakan Privasi — Dokter HP";
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
              Kebijakan Privasi
            </h1>
            <MeterStrip className="mt-5" />
            <p className="mt-5 text-sm text-[var(--color-text-muted)]">
              Terakhir diperbarui: 18 November 2026
            </p>
          </header>

          <p className="mt-6 text-base leading-relaxed text-[var(--color-text-secondary)]">
            Dokter HP adalah aplikasi web yang membantu pengguna memeriksa
            kondisi HP mereka, mulai dari WiFi, baterai, penyimpanan,
            performa, hingga keamanan, lewat browser. Dokumen ini menjelaskan
            data apa saja yang dikumpulkan Dokter HP, untuk apa data itu
            dipakai, di mana data itu disimpan, dan hak apa saja yang dimiliki
            pengguna atas datanya.
          </p>

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

          <section aria-labelledby="ringkasan" className="mt-10">
            <h2
              id="ringkasan"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              Ringkasan singkat
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
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

          <section aria-labelledby="data" className="mt-10">
            <h2
              id="data"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              1. Data yang dikumpulkan dan tujuannya
            </h2>

            <h3 className="mt-6 text-base font-semibold text-white">
              1.1 Data akun
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Saat pengguna masuk dengan Google, Dokter HP menerima dan
              menyimpan nama (untuk ditampilkan di profil dan dashboard) dan
              alamat email (untuk mengidentifikasi akun). Akun yang sama
              dikenali dari alamat email Google yang terverifikasi; pengenal
              akun Google (sub) hanya dipakai sesaat untuk memvalidasi profil
              saat masuk dan tidak disimpan. Data ini hanya diambil setelah
              pengguna menekan tombol masuk dan menyetujui di halaman Google.
              Dokter HP tidak menerima atau menyimpan kata sandi Google
              pengguna.
            </p>

            <h3 className="mt-6 text-base font-semibold text-white">
              1.2 PIN aplikasi
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pengguna boleh mengatur PIN 4–8 digit sebagai kunci tambahan.
              PIN asli tidak pernah disimpan. Yang disimpan hanya hasil hash
              HMAC-SHA256 dari PIN yang dicampur salt (nilai acak) dan kunci
              rahasia server (pepper) yang tidak tersimpan di database.
              Karena itu, tidak ada pihak mana pun, termasuk pengembang, yang
              bisa melihat PIN pengguna. Bila lupa PIN, pemulihannya adalah
              masuk ulang dengan Google lalu mengatur PIN baru dari
              Pengaturan; riwayat tetap aman. Dokter HP juga mencatat jumlah
              percobaan PIN salah berturut-turut: setelah 5 kali salah,
              masukan PIN dikunci selama 30 detik.
            </p>

            <h3 className="mt-6 text-base font-semibold text-white">
              1.3 Riwayat pemeriksaan kesehatan
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Setiap kali pengguna menjalankan diagnosis, Dokter HP menyimpan
              skor kesehatan HP (0–100) dan ringkasan hasil pemeriksaan
              (status baterai, penyimpanan, performa, keamanan, dan sumber
              tiap komponen: dari tes web, input manual, atau riwayat APK).
              Tujuannya: menampilkan skor, grafik riwayat, dan tiga
              pemeriksaan terakhir di dashboard.
            </p>

            <h3 className="mt-6 text-base font-semibold text-white">
              1.4 Laporan WiFi
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Setiap kali pengguna menjalankan tes WiFi sambil masuk, Dokter
              HP menyimpan hasil tes kecepatan unduh dan latensi HTTP yang
              diukur di browser, info jaringan yang diisi manual (misalnya
              nama WiFi, kekuatan sinyal, channel, dan DNS), sampel kecepatan
              per detik dari tes bertahan 30 detik (maksimal 30 sampel per
              laporan), dan rekomendasi yang ditampilkan bersama hasil tes.
              Browser tidak bisa membaca nama WiFi, sinyal, channel, atau DNS
              secara otomatis. Kolom-kolom itu hanya terisi bila pengguna
              mengisinya sendiri. Tes WiFi tanpa masuk tidak menyimpan apa
              pun.
            </p>

            <h3 className="mt-6 text-base font-semibold text-white">
              1.5 Riwayat tanya-jawab AI
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Saat pengguna memakai Diagnosis AI, Dokter HP menyimpan
              pertanyaan yang dikirim dan jawaban yang diterima, agar pengguna
              bisa melihat kembali riwayat tanya-jawabnya. Penjelasan lebih
              lanjut tentang pemrosesan data AI ada di bagian 6.
            </p>

            <h3 className="mt-6 text-base font-semibold text-white">
              1.6 Data sesi dan teknis
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Agar pengguna tetap masuk dan layanan berjalan aman, Dokter HP
              menyimpan hash token sesi (SHA-256; token mentahnya hanya ada
              di cookie browser pengguna dan tidak pernah disimpan di server),
              info perangkat lunak browser dan alamat IP terakhir (untuk
              menampilkan daftar sesi aktif di Pengaturan). Alamat IP publik
              memang tampil saat tes WiFi dijalankan, tetapi tidak disimpan
              bersama laporan WiFi. Dokter HP tidak mencatat isi PIN, token
              sesi mentah, atau isi lengkap jawaban AI di log server; log
              hanya berisi id, status, dan waktu.
            </p>

            <h3 className="mt-6 text-base font-semibold text-white">
              1.7 Data yang TIDAK dikumpulkan
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
              <li>
                Dokter HP tidak membaca daftar aplikasi, level baterai,
                penyimpanan, RAM, CPU, atau suhu HP secara langsung dari
                browser. Browser tidak mengizinkannya. Data semacam itu hanya
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

          <section aria-labelledby="penyimpanan" className="mt-10">
            <h2
              id="penyimpanan"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              2. Di mana data disimpan
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Seluruh data pengguna disimpan di database Cloudflare D1, yaitu
              database yang dikelola untuk proyek Dokter HP. Data inti (akun,
              riwayat, diagnosis) tinggal di database ini dan tidak diserahkan
              ke layanan pihak ketiga lain, kecuali dua pengecualian yang
              dijelaskan di bagian 6 dan 7. Seluruh komunikasi antara browser
              dan server memakai HTTPS (koneksi terenkripsi).
            </p>
          </section>

          <section aria-labelledby="akses" className="mt-10">
            <h2
              id="akses"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              3. Siapa yang bisa melihat data
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
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

          <section aria-labelledby="retensi" className="mt-10">
            <h2
              id="retensi"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              4. Berapa lama data disimpan
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
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

          <section aria-labelledby="cookie" className="mt-10">
            <h2
              id="cookie"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              5. Cookie dan sesi
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Dokter HP memakai cookie hanya untuk keperluan login, bukan
              untuk pelacakan: cookie sesi (__Host-dokter_hp_session, 30 hari)
              agar pengguna tetap masuk, dan cookie sementara saat masuk
              Google (penanda keamanan selama proses masuk, berakhir setelah
              proses selesai). Cookie sesi bersifat HttpOnly (tidak bisa
              dibaca skrip di halaman), Secure (hanya lewat HTTPS), dan
              SameSite=None (diperlukan karena halaman web dan server API
              berada di alamat yang berbeda). Dokter HP tidak memakai cookie
              iklan, cookie pelacak, atau cookie pihak ketiga. Bila pengguna
              memblokir cookie, fitur masuk dan penyimpanan riwayat tidak akan
              berfungsi, tetapi tes WiFi tanpa akun tetap bisa dijalankan.
            </p>
          </section>

          <section aria-labelledby="ai" className="mt-10">
            <h2
              id="ai"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              6. Data AI (Diagnosis AI)
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Saat pengguna mengirim pertanyaan ke Diagnosis AI, pertanyaan
              dikirim dari browser ke server Dokter HP. Server menambahkan
              ringkasan data perangkat pengguna (pemeriksaan terakhir dan
              laporan WiFi terakhir) sebagai konteks, lalu mengirim pertanyaan
              beserta konteks tersebut ke layanan Google Gemini. Pengiriman
              ini terjadi dari server, bukan dari browser, dan kunci API tidak
              pernah ada di browser. Jawaban dari Gemini disimpan ke riwayat
              tanya-jawab pengguna dan ditampilkan di layar.
            </p>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Artinya, pertanyaan pengguna dan ringkasan data perangkatnya
              diproses oleh Google Gemini untuk menghasilkan jawaban. Pengguna
              disarankan tidak menuliskan informasi yang sangat sensitif
              (misalnya kata sandi, nomor rekening, atau nomor identitas) di
              dalam pertanyaan AI. Jawaban AI adalah saran, bukan vonis pasti.
            </p>
          </section>

          <section aria-labelledby="pihak-ketiga" className="mt-10">
            <h2
              id="pihak-ketiga"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              7. Layanan pihak ketiga yang dipakai
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Dokter HP memakai dua layanan pihak ketiga: Google (Masuk dengan
              Google) untuk identitas akun. Google mengembalikan nama, email,
              dan pengenal akun ke server Dokter HP. Google Gemini sebagai
              mesin Diagnosis AI menerima pertanyaan pengguna dan ringkasan
              data perangkat, dikirim dari server. Selain kedua layanan di
              atas, Dokter HP tidak mengirim data pengguna ke pihak ketiga mana
              pun. Laporan PDF dibuat di browser pengguna sendiri, bukan
              dikirim ke layanan PDF pihak ketiga.
            </p>
          </section>

          <section aria-labelledby="keamanan" className="mt-10">
            <h2
              id="keamanan"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              8. Keamanan data
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
              <li>Seluruh komunikasi memakai HTTPS.</li>
              <li>
                PIN disimpan sebagai hash HMAC-SHA256 + salt + kunci rahasia
                server (pepper), bukan teks asli.
              </li>
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
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Tidak ada sistem yang bisa menjamin keamanan mutlak. Bila
              terjadi gangguan keamanan yang memengaruhi data pengguna,
              pengembang akan menginformasikannya melalui aplikasi dan
              memperbaikinya secepat mungkin.
            </p>
          </section>

          <section aria-labelledby="hak" className="mt-10">
            <h2
              id="hak"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              9. Hak pengguna
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
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
                (penghapusan akun bersifat permanen dan tidak bisa
                dibatalkan).
              </li>
              <li>
                Mengubah datanya: mengubah nama tampilan dan PIN dari
                Pengaturan.
              </li>
              <li>Keluar dari satu atau semua sesi dari Pengaturan.</li>
              <li>
                Memakai layanan tanpa akun untuk tes WiFi sekali jalan, tanpa
                data apa pun yang tersimpan.
              </li>
            </ul>
          </section>

          <section aria-labelledby="perubahan" className="mt-10">
            <h2
              id="perubahan"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              10. Perubahan kebijakan
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Bila kebijakan ini berubah, versi terbaru akan ditampilkan di
              aplikasi dan tanggal &quot;Terakhir diperbarui&quot; di atas
              akan disesuaikan. Perubahan yang bersifat besar (misalnya jenis
              data baru yang dikumpulkan) akan diumumkan di dalam aplikasi
              sebelum berlaku. Pengguna yang tidak setuju dengan perubahan
              tersebut dapat menghapus akunnya beserta seluruh datanya.
            </p>
          </section>

          <section aria-labelledby="kontak" className="mt-10">
            <h2
              id="kontak"
              className="scroll-mt-20 text-xl font-semibold tracking-tight text-white"
            >
              11. Kontak
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
              Pertanyaan, keberatan, atau permintaan terkait data pribadi
              dapat disampaikan kepada pengembang Dokter HP melalui repositori
              publik proyek Dokter HP (repo adiprmx/dokter-hp) atau melalui
              halaman Tentang di dalam aplikasi.
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
              to="/syarat"
              className={`text-white underline underline-offset-4 ${FOKUS}`}
            >
              Lihat juga Syarat Layanan
            </Link>
          </p>
        </article>
      </div>
    </div>
  );
}
