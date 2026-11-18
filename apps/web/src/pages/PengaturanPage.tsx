import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  VERSI_APLIKASI_WEB,
  formatTanggalWaktu,
  konfirmasiHapusValid,
  labelPerangkat,
  validasiNama,
} from "../lib/akun";
import { ApiError, basisApi, panggilApi } from "../lib/api";
import { tokenStatus } from "../lib/status-warna";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { simpanBahasa, type KodeBahasa } from "../i18n";
import { useAppStore } from "../store/useAppStore";

// Halaman Pengaturan akun (/pengaturan). Wajib masuk: tanpa sesi yang
// sah, pengguna diarahkan ke /masuk; bila sesi terkunci PIN,
// diarahkan ke /kunci.
//
// Endpoint yang dipakai (kontrak API, awalan /api sesuai K-07):
// GET /api/auth/me, GET/PATCH /api/account/profile,
// GET /api/account/sessions, DELETE /api/account/sessions/:id,
// GET /api/account/export, DELETE /api/account, POST /auth/logout.
//
// Kata konfirmasi hapus akun bergantung bahasa aktif (kunci i18n
// settings.deleteAccountConfirmWord: "HAPUS" untuk Indonesia,
// "DELETE" untuk Inggris) dan dibaca lewat useTranslation — server
// menerima keduanya (K-26). Pemilih bahasa ada di bagian Bahasa
// halaman ini.
//
// Redesign v2.0 (docs/redesign-v20-spec.md §8.9, mode Operate):
// bagian dikelompokkan (Akun, Keamanan, lalu Ekspor, Hapus akun,
// Tentang, Keluar), warna hanya sebagai informasi status lewat
// helper status-warna (bukan peta lokal), tombol nonaktif memakai
// gaya eksplisit komponen Button (K-53, tanpa opacity), dan semua
// keadaan ditangani (kerangka muat, kosong jujur, galat + coba lagi,
// konfirmasi hapus akun yang tenang). Logika, rute, dan endpoint
// TIDAK berubah.

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

function pesanDariGalat(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return "Terjadi kesalahan. Coba lagi.";
}

type Pesan = { jenis: "sukses" | "galat"; teks: string } | null;

// Panel pesan hasil aksi: tinta latar + bingkai + teks dari token
// status lewat helper status-warna (jenis "sukses"/"galat" adalah
// keadaan status kanonis, bukan peta lokal). Galat memakai
// role="alert" agar pembaca layar langsung mengumumkannya; sukses
// memakai role="status".
function PesanStatus({ pesan }: { pesan: Pesan }) {
  if (!pesan) {
    return null;
  }
  const token = tokenStatus(pesan.jenis);
  return (
    <p
      role={pesan.jenis === "sukses" ? "status" : "alert"}
      aria-live="polite"
      className="mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed"
      style={{
        backgroundColor: token.latar,
        borderColor: token.bingkai,
        color: token.teks,
      }}
    >
      {pesan.teks}
    </p>
  );
}

export default function PengaturanPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const setStatusMasuk = useAppStore((s) => s.setStatusMasuk);
  // Kata konfirmasi dari bahasa aktif (K-19): "HAPUS" (id) atau
  // "DELETE" (en); server menerima keduanya (K-26).
  const kataKonfirmasi = t("settings.deleteAccountConfirmWord");
  const bahasaAktif: KodeBahasa = i18n.language === "en" ? "en" : "id";

  const gantiBahasa = (bahasa: KodeBahasa) => {
    void i18n.changeLanguage(bahasa);
    simpanBahasa(bahasa);
  };
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
  // R-09 (K-72): hapus akun wajib autentikasi baru ≤10 menit. Bila
  // server menjawab LOGIN_ULANG_DIPERLUKAN, tampilkan tombol masuk lagi.
  const [perluMasukLagi, setPerluMasukLagi] = useState(false);

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
      const res = await fetch(`${basisApi()}/api/account/export`, {
        credentials: "include",
      });
      const teks = await res.text();
      if (!res.ok) {
        let pesan = "Data tidak bisa diunduh. Coba lagi.";
        try {
          const galat = JSON.parse(teks) as { error?: { message?: string } } | null;
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
    if (!konfirmasiHapusValid(inputHapus, kataKonfirmasi)) {
      setPesanHapus({
        jenis: "galat",
        teks: `Ketik ${kataKonfirmasi} persis seperti contoh untuk melanjutkan.`,
      });
      return;
    }
    setMenghapusAkun(true);
    setPesanHapus(null);
    setPerluMasukLagi(false);
    try {
      await panggilApi("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ konfirmasi: inputHapus }),
      });
      setStatusMasuk("tidak-masuk");
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "KONFIRMASI_SALAH") {
        setPesanHapus({
          jenis: "galat",
          teks: `Ketik ${kataKonfirmasi} persis seperti contoh untuk melanjutkan.`,
        });
      } else if (err instanceof ApiError && err.code === "LOGIN_ULANG_DIPERLUKAN") {
        setPesanHapus({
          jenis: "galat",
          teks: "Demi keamanan, masuk lagi terlebih dahulu sebelum menghapus akun.",
        });
        setPerluMasukLagi(true);
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
    setStatusMasuk("tidak-masuk");
    navigate("/", { replace: true });
  };

  const sesiLain = daftarSesi.filter((sesi) => !sesi.saat_ini);
  const konfirmasiCocok = konfirmasiHapusValid(inputHapus, kataKonfirmasi);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6">
      <Link
        to="/dashboard"
        className="inline-flex min-h-[48px] items-center text-sm text-zinc-300 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Kembali ke dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
        Pengaturan akun
      </h1>
      <p className="mt-2 text-base leading-relaxed text-[var(--color-text-muted)]">
        Kelola profil, PIN, sesi, dan akun Anda.
      </p>

      {status === "memuat" && (
        <div className="mt-8 space-y-4">
          <p role="status" className="text-sm text-[var(--color-text-muted)]">
            Mengambil data…
          </p>
          <Skeleton height={220} rounded="lg" label="Memuat pengaturan" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton height={180} rounded="lg" label="Memuat pengaturan" />
            <Skeleton height={180} rounded="lg" label="Memuat pengaturan" />
          </div>
          <Skeleton height={260} rounded="lg" label="Memuat pengaturan" />
        </div>
      )}

      {status === "galat" && (
        <div className="mt-8">
          <Card status="galat" padding="lg">
            <p role="alert" className="text-sm text-[var(--color-error)]">
              Data tidak bisa dimuat. Coba lagi.
            </p>
            <Button onClick={() => void muat()} className="mt-4">
              Coba lagi
            </Button>
          </Card>
        </div>
      )}

      {status === "siap" && profil && (
        <div className="mt-8 space-y-10">
          {/* Kelompok Akun: profil, bahasa, PIN */}
          <section aria-labelledby="kelompok-akun">
            <h2
              id="kelompok-akun"
              className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]"
            >
              Akun
            </h2>
            <div className="mt-4 space-y-4">
              <section aria-labelledby="judul-profil">
                <Card padding="lg">
                  <h3
                    id="judul-profil"
                    className="text-base font-semibold text-[var(--color-text-primary)]"
                  >
                    Profil
                  </h3>
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
                      <p className="mt-2 break-all text-sm text-zinc-100">
                        {profil.email}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Email berasal dari akun Google dan tidak bisa diubah di
                        sini.
                      </p>
                    </div>
                    <PesanStatus pesan={pesanProfil} />
                    <Button
                      onClick={() => void simpanNama()}
                      loading={menyimpanNama}
                      disabled={namaInput.trim() === profil.nama}
                      className="mt-4"
                    >
                      Simpan nama
                    </Button>
                  </div>
                </Card>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Bahasa */}
                <section aria-labelledby="judul-bahasa">
                  <Card padding="lg" className="h-full">
                    <h3
                      id="judul-bahasa"
                      className="text-base font-semibold text-[var(--color-text-primary)]"
                    >
                      {t("settings.languageTitle")}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      {t("settings.languageDesc")}
                    </p>
                    <div
                      role="group"
                      aria-label={t("settings.languageTitle")}
                      className="mt-4 flex flex-wrap gap-2"
                    >
                      <button
                        type="button"
                        aria-pressed={bahasaAktif === "id"}
                        onClick={() => gantiBahasa("id")}
                        className={`inline-flex min-h-[48px] items-center rounded-lg px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          bahasaAktif === "id"
                            ? "bg-white text-black"
                            : "border border-[var(--color-border-strong)] text-zinc-100"
                        }`}
                      >
                        Indonesia
                      </button>
                      <button
                        type="button"
                        aria-pressed={bahasaAktif === "en"}
                        onClick={() => gantiBahasa("en")}
                        className={`inline-flex min-h-[48px] items-center rounded-lg px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          bahasaAktif === "en"
                            ? "bg-white text-black"
                            : "border border-[var(--color-border-strong)] text-zinc-100"
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </Card>
                </section>

                {/* PIN aplikasi */}
                <section aria-labelledby="judul-pin">
                  <Card padding="lg" className="h-full">
                    <h3
                      id="judul-pin"
                      className="text-base font-semibold text-[var(--color-text-primary)]"
                    >
                      PIN aplikasi
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      PIN melindungi riwayat pemeriksaan di aplikasi ini. PIN
                      diminta setiap kali sesi baru dimulai.
                    </p>
                    <p className="mt-4 flex min-h-[48px] flex-wrap items-center gap-2 text-sm text-zinc-100">
                      <StatusBadge status={pinDiatur ? "sukses" : "peringatan"}>
                        {pinDiatur ? "PIN aktif" : "Belum diatur"}
                      </StatusBadge>
                      {!pinDiatur && "Aplikasi langsung terbuka tanpa PIN."}
                    </p>
                    <Link
                      to="/pengaturan/pin"
                      className="mt-4 inline-flex min-h-[48px] items-center rounded-lg border border-[var(--color-border-strong)] px-4 text-sm font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {pinDiatur ? "Ubah PIN" : "Atur PIN"}
                    </Link>
                  </Card>
                </section>
              </div>
            </div>
          </section>

          {/* Kelompok Keamanan: sesi aktif, pengingat skor turun */}
          <section aria-labelledby="kelompok-keamanan">
            <h2
              id="kelompok-keamanan"
              className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]"
            >
              Keamanan
            </h2>
            <div className="mt-4 space-y-4">
              <section aria-labelledby="judul-sesi">
                <Card padding="lg">
                  <h3
                    id="judul-sesi"
                    className="text-base font-semibold text-[var(--color-text-primary)]"
                  >
                    Sesi aktif
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    Perangkat yang sedang masuk dengan akun Anda. Bila ada sesi
                    yang tidak dikenal, keluar dari sesi itu dan periksa
                    keamanan akun Google Anda.
                  </p>
                  {daftarSesi.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState
                        title="Tidak ada sesi aktif"
                        description="Daftar sesi kosong. Muat ulang untuk memeriksa lagi."
                        action={
                          <Button
                            variant="secondary"
                            onClick={() => void muat()}
                          >
                            Muat ulang
                          </Button>
                        }
                      />
                    </div>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {daftarSesi.map((sesi) => (
                        <li
                          key={sesi.id}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-zinc-100">
                              {labelPerangkat(sesi.user_agent)}
                            </p>
                            {sesi.saat_ini && (
                              <StatusBadge status="sukses" dot>
                                Sesi ini
                              </StatusBadge>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">
                            Masuk sejak {formatTanggalWaktu(sesi.dibuat_pada)}
                          </p>
                          <p className="text-sm text-zinc-400">
                            Berlaku sampai{" "}
                            {formatTanggalWaktu(sesi.kedaluwarsa_pada)}
                          </p>
                          <p className="text-sm text-zinc-400">
                            IP terakhir:{" "}
                            <span className="dh-numeric text-zinc-100">
                              {sesi.ip_terakhir ?? "tidak tersedia"}
                            </span>
                          </p>
                          {!sesi.saat_ini && (
                            <Button
                              variant="secondary"
                              onClick={() => void keluarDariSesi(sesi.id)}
                              loading={menghapusSesiId === sesi.id}
                              className="mt-3"
                            >
                              Keluar dari sesi ini
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <PesanStatus pesan={pesanSesi} />
                  {sesiLain.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => void keluarDariSemuaPerangkatLain()}
                      loading={mengeluarkanSemua}
                      className="mt-4"
                    >
                      Keluar dari semua perangkat lain
                    </Button>
                  )}
                </Card>
              </section>

              {/* Pengingat skor turun */}
              <section aria-labelledby="judul-pengingat">
                <Card padding="lg">
                  <h3
                    id="judul-pengingat"
                    className="text-base font-semibold text-[var(--color-text-primary)]"
                  >
                    Pengingat skor turun
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    Aktifkan supaya aplikasi memberi tahu Anda bila skor
                    kesehatan HP turun.
                  </p>
                  <p className="mt-4 flex min-h-[48px] flex-wrap items-center gap-2 text-sm text-zinc-100">
                    <StatusBadge status="netral">Segera hadir</StatusBadge>
                    Pengingat belum aktif.
                  </p>
                  <p className="text-sm text-zinc-400">
                    {dukunganNotifikasi
                      ? "Pengingat skor turun segera hadir di pembaruan berikutnya. Tombol di bawah belum bisa dipakai karena layanan pengingat masih disiapkan."
                      : "Browser ini belum mendukung notifikasi. Coba buka dengan Chrome di HP Android."}
                  </p>
                  <Button
                    variant="secondary"
                    disabled
                    title="Pengingat skor turun segera hadir"
                    className="mt-4"
                  >
                    Aktifkan pengingat
                  </Button>
                </Card>
              </section>
            </div>
          </section>

          {/* Ekspor data */}
          <section aria-labelledby="judul-ekspor">
            <Card padding="lg">
              <h2
                id="judul-ekspor"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Ekspor data
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Unduh seluruh data akun sebagai satu berkas JSON: profil,
                riwayat pemeriksaan, laporan WiFi, dan tanya jawab. Ekspor
                dibatasi 5.000 baris per jenis data dan bisa diunduh maksimal
                5 kali sehari.
              </p>
              <PesanStatus pesan={pesanEkspor} />
              <Button
                variant="secondary"
                onClick={() => void unduhData()}
                loading={mengunduhEkspor}
                className="mt-4"
              >
                Unduh data saya
              </Button>
            </Card>
          </section>

          {/* Hapus akun — zona bahaya. Kartu bertinta merah menandai
              keadaan destruktif; teksnya faktual dan tenang, bukan
              menakut-nakuti. */}
          <section aria-labelledby="judul-hapus-akun">
            <Card status="galat" padding="lg">
              <h2
                id="judul-hapus-akun"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Hapus akun
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-error)]">
                Menghapus akun akan menghapus profil dan seluruh data Anda
                secara permanen, termasuk riwayat pemeriksaan, tes WiFi, dan
                tanya jawab. Tindakan ini tidak bisa dibatalkan.
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Bila masih ingin menyimpan riwayat, unduh data Anda terlebih
                dahulu dari bagian Ekspor data di atas.
              </p>
              {!tampilKonfirmasiHapus ? (
                <Button
                  variant="danger"
                  onClick={() => setTampilKonfirmasiHapus(true)}
                  className="mt-4"
                >
                  Hapus akun saya
                </Button>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="konfirmasi-hapus"
                      className="block text-sm font-medium text-zinc-300"
                    >
                      Ketik {kataKonfirmasi} untuk mengonfirmasi
                    </label>
                    <input
                      id="konfirmasi-hapus"
                      type="text"
                      value={inputHapus}
                      autoComplete="off"
                      autoCapitalize="characters"
                      onChange={(e) => setInputHapus(e.target.value)}
                      placeholder={kataKonfirmasi}
                      className="mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    />
                    <p className="mt-1 text-sm text-zinc-400">
                      Ketik persis seperti contoh, dengan huruf besar semua.
                    </p>
                  </div>
                  <PesanStatus pesan={pesanHapus} />
                  <div className="flex flex-wrap gap-3">
                    {perluMasukLagi ? (
                      <Button
                        onClick={() => navigate("/masuk", { replace: true })}
                      >
                        Masuk lagi
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        onClick={() => void hapusAkun()}
                        loading={menghapusAkun}
                        disabled={!konfirmasiCocok}
                      >
                        Ya, hapus akun saya
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTampilKonfirmasiHapus(false);
                        setInputHapus("");
                        setPesanHapus(null);
                        setPerluMasukLagi(false);
                      }}
                      disabled={menghapusAkun}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Tentang */}
            <section aria-labelledby="judul-tentang">
              <Card padding="lg" className="h-full">
                <h2
                  id="judul-tentang"
                  className="text-lg font-semibold text-[var(--color-text-primary)]"
                >
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
              </Card>
            </section>

            {/* Keluar */}
            <section aria-labelledby="judul-keluar">
              <Card padding="lg" className="h-full">
                <h2
                  id="judul-keluar"
                  className="text-lg font-semibold text-[var(--color-text-primary)]"
                >
                  Keluar
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Keluar hanya mengakhiri sesi di perangkat ini. Riwayat yang
                  sudah tersimpan tetap aman dan akan terlihat lagi saat masuk
                  kembali.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => void keluar()}
                  loading={mengeluarkan}
                  className="mt-4"
                >
                  Keluar
                </Button>
              </Card>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
