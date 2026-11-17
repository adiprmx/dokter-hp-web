import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  VERSI_APLIKASI_WEB,
  formatTanggalWaktu,
  konfirmasiHapusValid,
  labelPerangkat,
  validasiNama,
} from "../lib/akun";

// Halaman Pengaturan akun (/pengaturan). Wajib masuk: tanpa sesi yang
// sah, pengguna diarahkan ke /masuk; bila sesi terkunci PIN,
// diarahkan ke /kunci.
//
// Endpoint yang dipakai (kontrak API, awalan /api sesuai K-07):
// GET /api/auth/me, GET/PATCH /api/account/profile,
// GET /api/account/sessions, DELETE /api/account/sessions/:id,
// GET /api/account/export, DELETE /api/account, POST /auth/logout.

// Kata konfirmasi hapus akun bergantung bahasa aktif (kunci i18n
// settings.deleteAccountConfirmWord: "HAPUS" untuk Indonesia,
// "DELETE" untuk Inggris). Pemilih bahasa belum dipasang di
// aplikasi, jadi untuk sekarang dipakai "HAPUS". Setelah tim
// integrasi memasang i18n, ganti konstanta ini dengan kata dari
// bahasa aktif — fungsi validasi di lib/akun.ts sudah menerima kata
// yang diharapkan sebagai parameter, tanpa hardcode.
// Catatan untuk koordinator: kontrak API §6.5 saat ini hanya
// menerima "HAPUS" di sisi server; bila bahasa Inggris diaktifkan,
// server perlu menerima "DELETE" juga (atau frontend memetakan kata
// ke "HAPUS" sebelum mengirim).
const KATA_KONFIRMASI_HAPUS = "HAPUS";

// Basis API sama seperti lib/api.ts: VITE_API_URL bila API di domain
// berbeda, jalur relatif /api bila tidak diisi.
const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? ""
).replace(/\/$/, "");

interface Profil {
  id: string;
  nama: string;
  email: string;
  dibuat_pada: string;
}

interface InfoSaya {
  id: string;
  nama: string;
  email: string;
  pin_diatur: boolean;
  sesi_terkunci: boolean;
  sesi_kedaluwarsa_pada: string;
}

interface Sesi {
  id: string;
  saat_ini: boolean;
  user_agent: string | null;
  ip_terakhir: string | null;
  dibuat_pada: string;
  kedaluwarsa_pada: string;
}

interface EnvelopeGalat {
  success: false;
  error: { code: string; message: string };
}

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function pesanDariGalat(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return "Terjadi kesalahan. Coba lagi.";
}

// Klien kecil khusus halaman ini: lib/api.ts (fetchJson) tidak
// mengirim credentials: "include" yang wajib untuk cookie sesi
// lintas origin (kontrak API §0.4), dan tidak meneruskan kode
// galat server — keduanya dibutuhkan halaman ini (redirect saat
// 401, pesan KONFIRMASI_SALAH). api.ts tidak diubah (di luar
// cakupan tim ini); tim klien API diminta memperbaikinya di sana.
async function panggilApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | EnvelopeGalat
    | null;
  if (!res.ok || !json || json.success !== true) {
    const galat = (json as EnvelopeGalat | null)?.error;
    throw new ApiError(
      res.status,
      galat?.code,
      galat?.message ?? "Terjadi kesalahan. Coba lagi.",
    );
  }
  return json.data;
}

type Pesan = { jenis: "sukses" | "galat"; teks: string } | null;

function PesanStatus({ pesan }: { pesan: Pesan }) {
  if (!pesan) {
    return null;
  }
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        pesan.jenis === "sukses" ? "text-sm text-emerald-400" : "text-sm text-red-400"
      }
    >
      {pesan.teks}
    </p>
  );
}

export default function PengaturanPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"memuat" | "siap" | "galat">("memuat");
  const [profil, setProfil] = useState<Profil | null>(null);
  const [pinDiatur, setPinDiatur] = useState(false);
  const [daftarSesi, setDaftarSesi] = useState<Sesi[]>([]);

  const [namaInput, setNamaInput] = useState("");
  const [menyimpanNama, setMenyimpanNama] = useState(false);
  const [pesanProfil, setPesanProfil] = useState<Pesan>(null);

  const [menghapusSesiId, setMenghapusSesiId] = useState<string | null>(null);
  const [mengeluarkanSemua, setMengeluarkanSemua] = useState(false);
  const [pesanSesi, setPesanSesi] = useState<Pesan>(null);

  const [mengunduhEkspor, setMengunduhEkspor] = useState(false);
  const [pesanEkspor, setPesanEkspor] = useState<Pesan>(null);

  const [tampilKonfirmasiHapus, setTampilKonfirmasiHapus] = useState(false);
  const [inputHapus, setInputHapus] = useState("");
  const [menghapusAkun, setMenghapusAkun] = useState(false);
  const [pesanHapus, setPesanHapus] = useState<Pesan>(null);

  const [mengeluarkan, setMengeluarkan] = useState(false);

  // Dukungan notifikasi web di browser ini (docs/notifikasi.md §5.2).
  // Implementasi push adalah gelombang berikutnya — di versi ini
  // tombol hanya menampilkan status jujur, tidak pernah meminta izin.
  const [dukunganNotifikasi] = useState(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );

  const sudahDimuat = useRef(false);

  const muat = useCallback(async () => {
    setStatus("memuat");
    setPesanProfil(null);
    setPesanSesi(null);
    setPesanEkspor(null);
    try {
      const saya = await panggilApi<InfoSaya>("/api/auth/me");
      if (saya.sesi_terkunci) {
        navigate("/kunci", { replace: true });
        return;
      }
      const [profilData, sesiData] = await Promise.all([
        panggilApi<Profil>("/api/account/profile"),
        panggilApi<Sesi[]>("/api/account/sessions?limit=100"),
      ]);
      setPinDiatur(saya.pin_diatur);
      setProfil(profilData);
      setNamaInput(profilData.nama);
      setDaftarSesi(sesiData);
      setStatus("siap");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/masuk", { replace: true });
        return;
      }
      if (err instanceof ApiError && err.code === "SESSION_LOCKED") {
        navigate("/kunci", { replace: true });
        return;
      }
      setStatus("galat");
    }
  }, [navigate]);

  useEffect(() => {
    document.title = "Pengaturan akun — Dokter HP";
  }, []);

  useEffect(() => {
    if (sudahDimuat.current) {
      return;
    }
    sudahDimuat.current = true;
    void muat();
  }, [muat]);

  const simpanNama = async () => {
    const hasil = validasiNama(namaInput);
    if (!hasil.valid) {
      setPesanProfil({ jenis: "galat", teks: hasil.pesan });
      return;
    }
    setMenyimpanNama(true);
    setPesanProfil(null);
    try {
      const diperbarui = await panggilApi<Profil>("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ nama: hasil.nama }),
      });
      setProfil(diperbarui);
      setNamaInput(diperbarui.nama);
      setPesanProfil({ jenis: "sukses", teks: "Nama berhasil disimpan." });
    } catch (err) {
      setPesanProfil({ jenis: "galat", teks: pesanDariGalat(err) });
    } finally {
      setMenyimpanNama(false);
    }
  };

  const keluarDariSesi = async (id: string) => {
    setMenghapusSesiId(id);
    setPesanSesi(null);
    try {
      await panggilApi(`/api/account/sessions/${id}`, { method: "DELETE" });
      setDaftarSesi((daftar) => daftar.filter((sesi) => sesi.id !== id));
      setPesanSesi({ jenis: "sukses", teks: "Berhasil keluar dari sesi itu." });
    } catch (err) {
      setPesanSesi({ jenis: "galat", teks: pesanDariGalat(err) });
    } finally {
      setMenghapusSesiId(null);
    }
  };

  const keluarDariSemuaPerangkatLain = async () => {
    const sesiLain = daftarSesi.filter((sesi) => !sesi.saat_ini);
    if (sesiLain.length === 0) {
      return;
    }
    setMengeluarkanSemua(true);
    setPesanSesi(null);
    let gagal = 0;
    for (const sesi of sesiLain) {
      try {
        await panggilApi(`/api/account/sessions/${sesi.id}`, {
          method: "DELETE",
        });
      } catch {
        gagal += 1;
      }
    }
    try {
      const sesiBaru = await panggilApi<Sesi[]>("/api/account/sessions?limit=100");
      setDaftarSesi(sesiBaru);
    } catch {
      // Daftar tidak bisa dimuat ulang; tampilkan pesan galat saja.
      setPesanSesi({ jenis: "galat", teks: "Data tidak bisa dimuat. Coba lagi." });
      setMengeluarkanSemua(false);
      return;
    }
    setMengeluarkanSemua(false);
    if (gagal === 0) {
      setPesanSesi({
        jenis: "sukses",
        teks: "Berhasil keluar dari semua perangkat lain.",
      });
    } else {
      setPesanSesi({
        jenis: "galat",
        teks: "Sebagian sesi tidak bisa dihapus. Coba lagi.",
      });
    }
  };

  const unduhData = async () => {
    setMengunduhEkspor(true);
    setPesanEkspor(null);
    try {
      const res = await fetch(`${API_URL}/api/account/export`, {
        credentials: "include",
      });
      const teks = await res.text();
      if (!res.ok) {
        let pesan = "Data tidak bisa diunduh. Coba lagi.";
        try {
          const galat = JSON.parse(teks) as EnvelopeGalat;
          if (galat?.error?.message) {
            pesan = galat.error.message;
          }
        } catch {
          // Pakai pesan umum bila badan galat bukan JSON.
        }
        if (res.status === 401) {
          navigate("/masuk", { replace: true });
          return;
        }
        throw new Error(pesan);
      }
      let terpotong = false;
      try {
        const isi = JSON.parse(teks) as { terpotong?: boolean };
        terpotong = isi.terpotong === true;
      } catch {
        throw new Error("Data tidak bisa diunduh. Coba lagi.");
      }
      const kecocokan = /filename="?([^";]+)"?/.exec(
        res.headers.get("Content-Disposition") ?? "",
      );
      const namaFile =
        kecocokan?.[1] ??
        `dokter-hp-export-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([teks], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = url;
      tautan.download = namaFile;
      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();
      URL.revokeObjectURL(url);
      setPesanEkspor({
        jenis: terpotong ? "galat" : "sukses",
        teks: terpotong
          ? "Data berhasil diunduh, tetapi ekspor ini tidak lengkap: sebagian data terpotong karena jumlahnya melebihi batas."
          : "Data berhasil diunduh.",
      });
    } catch (err) {
      setPesanEkspor({
        jenis: "galat",
        teks: err instanceof Error ? err.message : "Data tidak bisa diunduh. Coba lagi.",
      });
    } finally {
      setMengunduhEkspor(false);
    }
  };

  const hapusAkun = async () => {
    // Pengaman ganda: tombol sudah nonaktif bila tidak cocok, tetapi
    // logika di sini tetap menolak tanpa pengecualian.
    if (!konfirmasiHapusValid(inputHapus, KATA_KONFIRMASI_HAPUS)) {
      setPesanHapus({
        jenis: "galat",
        teks: `Ketik ${KATA_KONFIRMASI_HAPUS} persis seperti contoh untuk melanjutkan.`,
      });
      return;
    }
    setMenghapusAkun(true);
    setPesanHapus(null);
    try {
      await panggilApi("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ konfirmasi: inputHapus }),
      });
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "KONFIRMASI_SALAH") {
        setPesanHapus({
          jenis: "galat",
          teks: `Ketik ${KATA_KONFIRMASI_HAPUS} persis seperti contoh untuk melanjutkan.`,
        });
      } else {
        setPesanHapus({ jenis: "galat", teks: "Akun tidak bisa dihapus. Coba lagi." });
      }
    } finally {
      setMenghapusAkun(false);
    }
  };

  const keluar = async () => {
    setMengeluarkan(true);
    try {
      await panggilApi("/api/auth/logout", { method: "POST" });
    } catch {
      // Keluar bersifat idempotent: sesi yang sudah tidak ada pun
      // tetap mengarah ke halaman depan.
    }
    navigate("/", { replace: true });
  };

  const sesiLain = daftarSesi.filter((sesi) => !sesi.saat_ini);
  const konfirmasiCocok = konfirmasiHapusValid(inputHapus, KATA_KONFIRMASI_HAPUS);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/dashboard"
          className="inline-flex min-h-[48px] items-center text-sm text-zinc-300 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Kembali ke dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Pengaturan akun</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Kelola profil, PIN, sesi, dan akun Anda.
        </p>

        {status === "memuat" && (
          <p role="status" className="mt-8 text-sm text-zinc-400">
            Mengambil data…
          </p>
        )}

        {status === "galat" && (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6">
            <p role="alert" className="text-sm text-red-400">
              Data tidak bisa dimuat. Coba lagi.
            </p>
            <button
              type="button"
              onClick={() => void muat()}
              className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-white px-4 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Coba lagi
            </button>
          </div>
        )}

        {status === "siap" && profil && (
          <div className="mt-6 space-y-4">
            {/* Profil */}
            <section
              aria-labelledby="judul-profil"
              className="rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-profil" className="text-lg font-semibold">
                Profil
              </h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="nama-tampilan"
                    className="block text-sm font-medium text-zinc-300"
                  >
                    Nama tampilan
                  </label>
                  <input
                    id="nama-tampilan"
                    type="text"
                    value={namaInput}
                    maxLength={100}
                    autoComplete="name"
                    onChange={(e) => setNamaInput(e.target.value)}
                    className="mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">Email</p>
                  <p className="mt-2 break-all text-sm text-zinc-100">{profil.email}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Email berasal dari akun Google dan tidak bisa diubah di
                    sini.
                  </p>
                </div>
                <PesanStatus pesan={pesanProfil} />
                <button
                  type="button"
                  onClick={() => void simpanNama()}
                  disabled={menyimpanNama || namaInput.trim() === profil.nama}
                  className="inline-flex min-h-[48px] items-center rounded-lg bg-white px-4 text-sm font-medium text-black disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  {menyimpanNama ? "Menyimpan…" : "Simpan nama"}
                </button>
              </div>
            </section>

            {/* PIN aplikasi */}
            <section
              aria-labelledby="judul-pin"
              className="rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-pin" className="text-lg font-semibold">
                PIN aplikasi
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                PIN melindungi riwayat pemeriksaan di aplikasi ini. PIN
                diminta setiap kali sesi baru dimulai.
              </p>
              <p className="mt-4 flex min-h-[48px] items-center text-sm text-zinc-100">
                {pinDiatur
                  ? "PIN sudah diatur."
                  : "PIN belum diatur. Aplikasi langsung terbuka tanpa PIN."}
              </p>
              <Link
                to="/pengaturan/pin"
                className="inline-flex min-h-[48px] items-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {pinDiatur ? "Ubah PIN" : "Atur PIN"}
              </Link>
            </section>

            {/* Sesi aktif */}
            <section
              aria-labelledby="judul-sesi"
              className="rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-sesi" className="text-lg font-semibold">
                Sesi aktif
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Perangkat yang sedang masuk dengan akun Anda. Bila ada sesi
                yang tidak dikenal, keluar dari sesi itu dan periksa keamanan
                akun Google Anda.
              </p>
              {daftarSesi.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">Tidak ada sesi aktif.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {daftarSesi.map((sesi) => (
                    <li
                      key={sesi.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-zinc-100">
                          {labelPerangkat(sesi.user_agent)}
                        </p>
                        {sesi.saat_ini && (
                          <span className="rounded-full border border-zinc-500 px-2 py-0.5 text-xs text-zinc-300">
                            Sesi ini
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">
                        Masuk sejak {formatTanggalWaktu(sesi.dibuat_pada)}
                      </p>
                      <p className="text-sm text-zinc-400">
                        Berlaku sampai {formatTanggalWaktu(sesi.kedaluwarsa_pada)}
                      </p>
                      {!sesi.saat_ini && (
                        <button
                          type="button"
                          onClick={() => void keluarDariSesi(sesi.id)}
                          disabled={menghapusSesiId === sesi.id}
                          className="mt-3 inline-flex min-h-[48px] items-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          {menghapusSesiId === sesi.id
                            ? "Mengeluarkan…"
                            : "Keluar dari sesi ini"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <PesanStatus pesan={pesanSesi} />
              {sesiLain.length > 0 && (
                <button
                  type="button"
                  onClick={() => void keluarDariSemuaPerangkatLain()}
                  disabled={mengeluarkanSemua}
                  className="mt-4 inline-flex min-h-[48px] items-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {mengeluarkanSemua
                    ? "Mengeluarkan…"
                    : "Keluar dari semua perangkat lain"}
                </button>
              )}
            </section>

            {/* Ekspor data */}
            <section
              aria-labelledby="judul-ekspor"
              className="rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-ekspor" className="text-lg font-semibold">
                Ekspor data
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Unduh seluruh data akun — profil, riwayat pemeriksaan,
                laporan WiFi, dan tanya jawab — sebagai satu berkas JSON.
                Ekspor dibatasi 5.000 baris per jenis data dan bisa diunduh
                maksimal 5 kali sehari.
              </p>
              <PesanStatus pesan={pesanEkspor} />
              <button
                type="button"
                onClick={() => void unduhData()}
                disabled={mengunduhEkspor}
                className="mt-4 inline-flex min-h-[48px] items-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {mengunduhEkspor ? "Mengunduh…" : "Unduh data saya"}
              </button>
            </section>

            {/* Pengingat skor turun */}
            <section
              aria-labelledby="judul-pengingat"
              className="rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-pengingat" className="text-lg font-semibold">
                Pengingat skor turun
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Aktifkan supaya aplikasi memberi tahu Anda bila skor kesehatan
                HP turun.
              </p>
              <p className="mt-4 flex min-h-[48px] items-center gap-2 text-sm text-zinc-100">
                <span className="rounded-full border border-zinc-500 px-2 py-0.5 text-xs text-zinc-300">
                  Segera hadir
                </span>
                Pengingat belum aktif.
              </p>
              <p className="text-sm text-zinc-400">
                {dukunganNotifikasi
                  ? "Pengingat skor turun segera hadir di pembaruan berikutnya. Tombol di bawah belum bisa dipakai karena layanan pengingat masih disiapkan."
                  : "Browser ini belum mendukung notifikasi. Coba buka dengan Chrome di HP Android."}
              </p>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Pengingat skor turun segera hadir"
                className="mt-4 inline-flex min-h-[48px] cursor-not-allowed items-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-400 opacity-50"
              >
                Aktifkan pengingat
              </button>
            </section>

            {/* Hapus akun */}
            <section
              aria-labelledby="judul-hapus-akun"
              className="rounded-2xl border border-red-900 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-hapus-akun" className="text-lg font-semibold">
                Hapus akun
              </h2>
              <p className="mt-2 text-sm text-red-400">
                Menghapus akun akan menghapus profil dan seluruh data Anda —
                riwayat pemeriksaan, tes WiFi, dan tanya jawab — secara
                permanen. Tindakan ini tidak bisa dibatalkan.
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Bila masih ingin menyimpan riwayat, unduh data Anda terlebih
                dahulu dari bagian Ekspor data di atas.
              </p>
              {!tampilKonfirmasiHapus ? (
                <button
                  type="button"
                  onClick={() => setTampilKonfirmasiHapus(true)}
                  className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Hapus akun saya
                </button>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="konfirmasi-hapus"
                      className="block text-sm font-medium text-zinc-300"
                    >
                      Ketik {KATA_KONFIRMASI_HAPUS} untuk mengonfirmasi
                    </label>
                    <input
                      id="konfirmasi-hapus"
                      type="text"
                      value={inputHapus}
                      autoComplete="off"
                      autoCapitalize="characters"
                      onChange={(e) => setInputHapus(e.target.value)}
                      placeholder={KATA_KONFIRMASI_HAPUS}
                      className="mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    />
                    <p className="mt-1 text-sm text-zinc-400">
                      Ketik persis seperti contoh, dengan huruf besar semua.
                    </p>
                  </div>
                  <PesanStatus pesan={pesanHapus} />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void hapusAkun()}
                      disabled={!konfirmasiCocok || menghapusAkun}
                      className="inline-flex min-h-[48px] items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      {menghapusAkun ? "Menghapus…" : "Ya, hapus akun saya"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTampilKonfirmasiHapus(false);
                        setInputHapus("");
                        setPesanHapus(null);
                      }}
                      disabled={menghapusAkun}
                      className="inline-flex min-h-[48px] items-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Tentang */}
            <section
              aria-labelledby="judul-tentang"
              className="rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-tentang" className="text-lg font-semibold">
                Tentang
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Versi aplikasi web:{" "}
                <span className="text-zinc-100">{VERSI_APLIKASI_WEB}</span>
              </p>
              <nav aria-label="Tentang aplikasi" className="mt-2">
                <ul className="divide-y divide-zinc-800">
                  <li>
                    <Link
                      to="/tentang"
                      className="flex min-h-[48px] items-center text-sm text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Tentang Dokter HP
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/privasi"
                      className="flex min-h-[48px] items-center text-sm text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Kebijakan Privasi
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/syarat"
                      className="flex min-h-[48px] items-center text-sm text-zinc-100 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Syarat Layanan
                    </Link>
                  </li>
                </ul>
              </nav>
            </section>

            {/* Keluar */}
            <section
              aria-labelledby="judul-keluar"
              className="rounded-2xl border border-zinc-800 bg-[#121215] p-4 sm:p-6"
            >
              <h2 id="judul-keluar" className="text-lg font-semibold">
                Keluar
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Keluar hanya mengakhiri sesi di perangkat ini. Riwayat yang
                sudah tersimpan tetap aman dan akan terlihat lagi saat masuk
                kembali.
              </p>
              <button
                type="button"
                onClick={() => void keluar()}
                disabled={mengeluarkan}
                className="mt-4 inline-flex min-h-[48px] items-center rounded-lg border border-zinc-500 px-4 text-sm font-medium text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {mengeluarkan ? "Keluar…" : "Keluar"}
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
