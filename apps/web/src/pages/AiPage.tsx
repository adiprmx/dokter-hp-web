import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { PANDUAN } from "../data/panduan";
import {
  BATAS_PERTANYAAN_HARIAN,
  formatTanggalJam,
  hitungSisaKuotaDariRiwayat,
  parseSisaKuota,
  PERTANYAAN_MAKS_KARAKTER,
  ringkasPemeriksaanTerakhir,
  validasiPertanyaan,
} from "../lib/ai";
import type { RingkasanPemeriksaan } from "../lib/ai";
import { ApiError, panggilApi } from "../lib/api";

// Layar 10 — Diagnosis AI (rute `/ai`, wajib masuk). Semua teks
// mengikuti docs/copy.md §10 dan §13; contoh pertanyaan dari
// docs/panduan-pengguna.md §6.2. Frontend tidak pernah memanggil
// Gemini langsung — pertanyaan dikirim ke POST /api/ai/diagnose
// dan kunci API hanya ada di server (Worker). Pemanggilan API
// memakai lib/api.ts (credentials: "include" + ApiError bertipe,
// K-13/K-16); kode galat yang ditangani: AI_QUOTA_HABIS,
// UNAUTHORIZED, SESSION_LOCKED, RATE_LIMITED, DATABASE_SIBUK.
// Kode 502 AI_TIDAK_TERSEDIA sudah pensiun (K-23): bila Gemini
// gagal, server menjawab 200 dengan jawaban fallback berlabel
// (sumber_jawaban "aturan").

// Indikator fokus keyboard (a11y.md §3.2) — dipasang eksplisit di
// setiap elemen interaktif karena tokens.css belum tentu terimpor.
const FOKUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

const TOMBOL_UTAMA = `mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-zinc-200 ${FOKUS}`;

const TOMBOL_SEKUNDER = `mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-zinc-500 bg-transparent px-5 py-3 text-base font-semibold text-zinc-100 transition-colors hover:bg-white/5 ${FOKUS}`;

const JUDUL_HALAMAN = "Diagnosis AI | Dokter HP";

// Disclaimer (docs/copy.md §10).
const DISCLAIMER =
  "Jawaban di bawah ini adalah saran berdasarkan data yang tersedia, bukan vonis pasti. " +
  "Bila masalah menyangkut kerusakan fisik — misalnya HP jatuh atau terkena air — bawa ke teknisi.";

// Contoh pertanyaan yang baik (docs/panduan-pengguna.md §6.2).
const CONTOH_PERTANYAAN = [
  "WiFi lemot padahal sinyal penuh. Kecepatan unduh 30 KB/detik. Sudah coba lupakan jaringan dan sambung ulang, tapi tetap lambat.",
  "Baterai HP cepat habis sejak kemarin. Dari 100% ke 40% dalam 3 jam padahal hanya dipakai chat. Apa yang harus diperiksa?",
  "Penyimpanan hampir penuh, tersisa 2 GB dari 128 GB. Apa yang aman dihapus?",
];

interface Diagnosis {
  id: string;
  pertanyaan: string;
  jawaban: string;
  dibuat_pada: string;
}

interface DiagnosisApi {
  id?: unknown;
  pertanyaan?: unknown;
  jawaban?: unknown;
  dibuat_pada?: unknown;
  sumber_jawaban?: unknown;
  tersimpan?: unknown;
}

/** Asal jawaban dari respons POST /api/ai/diagnose (backend ai/routes.ts). */
type SumberJawaban = "ai" | "cache" | "aturan";

interface JawabanTerbaru {
  pertanyaan: string;
  jawaban: string;
  sumber: SumberJawaban;
  tersimpan: boolean;
  dibuat_pada: string;
}

type StatusRiwayat = "memuat" | "siap" | "galat";
type StatusKonteks = "memuat" | "siap" | "kosong" | "galat";

/** Mengubah satu baris respons API menjadi Diagnosis; null bila tidak lengkap. */
function sebagaiDiagnosis(nilai: unknown): Diagnosis | null {
  if (typeof nilai !== "object" || nilai === null) {
    return null;
  }
  const baris = nilai as DiagnosisApi;
  if (
    typeof baris.id !== "string" ||
    typeof baris.pertanyaan !== "string" ||
    typeof baris.jawaban !== "string" ||
    typeof baris.dibuat_pada !== "string"
  ) {
    return null;
  }
  return {
    id: baris.id,
    pertanyaan: baris.pertanyaan,
    jawaban: baris.jawaban,
    dibuat_pada: baris.dibuat_pada,
  };
}

/** Daftar tautan panduan manual (src/data/panduan.ts). */
function DaftarPanduan() {
  return (
    <ul className="mt-4 space-y-1">
      {PANDUAN.map((item) => (
        <li key={item.slug}>
          <Link
            to={`/panduan/${item.slug}`}
            className={`inline-flex min-h-[48px] items-center text-base font-medium text-zinc-100 underline decoration-zinc-500 underline-offset-4 ${FOKUS}`}
          >
            {item.judul}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function AiPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);
  const jawabanRef = useRef<HTMLHeadingElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aktifRef = useRef(true);
  const mengirimRef = useRef(false);

  const [pertanyaan, setPertanyaan] = useState("");
  const [galatForm, setGalatForm] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [sisaKuota, setSisaKuota] = useState<number | null>(null);
  const [kuotaHabis, setKuotaHabis] = useState(false);
  const [galatKirim, setGalatKirim] = useState<string | null>(null);
  const [sesiBerakhir, setSesiBerakhir] = useState(false);
  const [sesiTerkunci, setSesiTerkunci] = useState(false);
  const [jawabanTerbaru, setJawabanTerbaru] =
    useState<JawabanTerbaru | null>(null);
  const [riwayat, setRiwayat] = useState<Diagnosis[]>([]);
  const [statusRiwayat, setStatusRiwayat] = useState<StatusRiwayat>("memuat");
  const [konteks, setKonteks] = useState<RingkasanPemeriksaan | null>(null);
  const [statusKonteks, setStatusKonteks] = useState<StatusKonteks>("memuat");
  const [pengumuman, setPengumuman] = useState("");
  const [terbuka, setTerbuka] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    document.title = JUDUL_HALAMAN;
    judulRef.current?.focus();
    aktifRef.current = true;
    return () => {
      aktifRef.current = false;
    };
  }, []);

  // Fokus ke jawaban begitu jawaban baru tampil, supaya pengguna
  // pembaca layar langsung menemukannya (a11y.md §3.5 dan §6.2).
  useEffect(() => {
    if (jawabanTerbaru) {
      jawabanRef.current?.focus();
    }
  }, [jawabanTerbaru]);

  async function muatRiwayat() {
    setStatusRiwayat("memuat");
    try {
      const data = await panggilApi<unknown>("/api/ai/diagnoses?limit=20");
      if (!aktifRef.current) {
        return;
      }
      const daftar = (Array.isArray(data) ? data : [])
        .map(sebagaiDiagnosis)
        .filter((entri): entri is Diagnosis => entri !== null);
      setRiwayat(daftar);
      // Nilai awal kuota dari riwayat hari ini; nilai dari respons
      // POST selalu lebih utama dan tidak ditimpa di sini.
      setSisaKuota((sebelum) =>
        sebelum === null ? hitungSisaKuotaDariRiwayat(daftar) : sebelum,
      );
      setStatusRiwayat("siap");
    } catch (galat) {
      if (!aktifRef.current) {
        return;
      }
      if (galat instanceof ApiError && galat.code === "UNAUTHORIZED") {
        setSesiBerakhir(true);
      } else if (galat instanceof ApiError && galat.code === "SESSION_LOCKED") {
        setSesiTerkunci(true);
      } else {
        setStatusRiwayat("galat");
      }
    }
  }

  async function muatKonteks() {
    setStatusKonteks("memuat");
    try {
      const data = await panggilApi<unknown>("/api/health-checks?limit=1");
      if (!aktifRef.current) {
        return;
      }
      const daftar = Array.isArray(data) ? data : [];
      const ringkasan =
        daftar.length > 0
          ? ringkasPemeriksaanTerakhir(
              daftar[0] as {
                skor?: unknown;
                dibuat_pada?: unknown;
                ringkasan?: unknown;
              },
            )
          : null;
      if (ringkasan) {
        setKonteks(ringkasan);
        setStatusKonteks("siap");
      } else {
        setStatusKonteks("kosong");
      }
    } catch (galat) {
      if (!aktifRef.current) {
        return;
      }
      if (galat instanceof ApiError && galat.code === "UNAUTHORIZED") {
        setSesiBerakhir(true);
      } else if (galat instanceof ApiError && galat.code === "SESSION_LOCKED") {
        setSesiTerkunci(true);
      } else {
        setStatusKonteks("galat");
      }
    }
  }

  useEffect(() => {
    void muatRiwayat();
    void muatKonteks();
  }, []);

  async function kirimPertanyaan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Pelindung kirim ganda: ref (bukan hanya state) supaya dua
    // ketukan cepat sebelum render ulang tidak mengirim dua kali.
    if (mengirimRef.current || kuotaHabis) {
      return;
    }
    setGalatForm(null);
    setGalatKirim(null);
    const hasil = validasiPertanyaan(pertanyaan);
    if (!hasil.ok) {
      setGalatForm(hasil.pesan);
      textareaRef.current?.focus();
      return;
    }
    mengirimRef.current = true;
    setMengirim(true);
    setPengumuman("Sedang menyiapkan jawaban…");
    try {
      const data = await panggilApi<DiagnosisApi | null>("/api/ai/diagnose", {
        method: "POST",
        body: JSON.stringify({ pertanyaan: hasil.pertanyaan }),
      });
      const sisa = parseSisaKuota(data);
      if (sisa !== null) {
        setSisaKuota(sisa);
        if (sisa === 0) {
          setKuotaHabis(true);
        }
      }
      const jawaban =
        typeof data?.jawaban === "string" ? data.jawaban : "";
      if (!jawaban) {
        setGalatKirim("Jawaban tidak bisa ditampilkan. Coba lagi.");
        setPengumuman("Jawaban tidak bisa ditampilkan.");
        return;
      }
      // Backend: kegagalan Gemini tidak lagi 502 — melainkan jawaban
      // fallback 200 dengan sumber_jawaban "aturan" (tidak tersimpan,
      // tidak memotong kuota). Teks jawabannya sendiri sudah diawali
      // pesan jujur bahwa itu bukan dari AI.
      const sumber: SumberJawaban =
        data?.sumber_jawaban === "aturan"
          ? "aturan"
          : data?.sumber_jawaban === "cache"
            ? "cache"
            : "ai";
      const tersimpan = data?.tersimpan === true;
      const dibuatPada =
        typeof data?.dibuat_pada === "string" && data.dibuat_pada
          ? data.dibuat_pada
          : new Date().toISOString();
      setJawabanTerbaru({
        pertanyaan: hasil.pertanyaan,
        jawaban,
        sumber,
        tersimpan,
        dibuat_pada: dibuatPada,
      });
      if (tersimpan) {
        const id =
          typeof data?.id === "string" && data.id
            ? data.id
            : `baru-${dibuatPada}`;
        setRiwayat((sebelum) => [
          {
            id,
            pertanyaan: hasil.pertanyaan,
            jawaban,
            dibuat_pada: dibuatPada,
          },
          ...sebelum,
        ]);
      }
      setPertanyaan("");
      if (sumber === "aturan") {
        setPengumuman(
          "Jawaban sudah tampil di bawah. Jawaban ini disusun dari panduan langkah standar, bukan dari AI, dan tidak tersimpan ke riwayat.",
        );
      } else {
        setPengumuman(
          "Jawaban sudah tampil di bawah. Tanya jawab ini tersimpan ke riwayat.",
        );
      }
    } catch (galat) {
      if (galat instanceof ApiError) {
        if (galat.code === "AI_QUOTA_HABIS") {
          setSisaKuota(0);
          setKuotaHabis(true);
          setPengumuman(
            "Batas 20 pertanyaan hari ini sudah habis. Batas kembali besok.",
          );
        } else if (galat.code === "UNAUTHORIZED") {
          setSesiBerakhir(true);
          setPengumuman("Sesi sudah berakhir. Masuk lagi untuk lanjut.");
        } else if (galat.code === "SESSION_LOCKED") {
          setSesiTerkunci(true);
          setPengumuman("Aplikasi terkunci, masukkan PIN untuk membuka.");
        } else if (galat.code === "RATE_LIMITED") {
          setGalatKirim("Terlalu sering, coba lagi sebentar.");
          setPengumuman("Terlalu sering, coba lagi sebentar.");
        } else if (galat.code === "DATABASE_SIBUK") {
          setGalatKirim("Server sedang sibuk, coba lagi nanti.");
          setPengumuman("Server sedang sibuk, coba lagi nanti.");
        } else {
          setGalatKirim(galat.message);
          setPengumuman(galat.message);
        }
      } else {
        setGalatKirim(
          "Tidak ada koneksi internet. Periksa sambungan, lalu coba lagi.",
        );
        setPengumuman(
          "Tidak ada koneksi internet. Periksa sambungan, lalu coba lagi.",
        );
      }
    } finally {
      mengirimRef.current = false;
      setMengirim(false);
    }
  }

  function cobaLagiKirim() {
    setGalatKirim(null);
    textareaRef.current?.focus();
  }

  function pilihContoh(contoh: string) {
    setPertanyaan(contoh);
    setGalatForm(null);
    textareaRef.current?.focus();
  }

  function alihkanRiwayat(id: string) {
    setTerbuka((sebelum) => {
      const berikut = new Set(sebelum);
      if (berikut.has(id)) {
        berikut.delete(id);
      } else {
        berikut.add(id);
      }
      return berikut;
    });
  }

  const formNonaktif = mengirim || kuotaHabis;

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-10 sm:pt-14">
        <nav aria-label="Navigasi halaman">
          <Link
            to="/dashboard"
            className={`inline-flex min-h-[48px] items-center text-base font-medium text-zinc-100 underline decoration-zinc-500 underline-offset-4 ${FOKUS}`}
          >
            Kembali ke dashboard
          </Link>
        </nav>

        <header className="mt-4">
          <h1
            ref={judulRef}
            tabIndex={-1}
            className="text-3xl font-bold leading-tight tracking-tight text-white"
          >
            Diagnosis AI
          </h1>
          <p className="mt-3 text-base leading-relaxed text-zinc-400">
            Ceritakan masalah HP, dapatkan saran langkah perbaikan.
          </p>
          {sisaKuota !== null && !kuotaHabis ? (
            <>
              <p className="mt-4 text-base text-zinc-100">
                Sisa pertanyaan hari ini:{" "}
                <span className="font-semibold tabular-nums">
                  {sisaKuota} dari {BATAS_PERTANYAAN_HARIAN}
                </span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Batas ini diberlakukan agar kuota layanan cukup untuk semua
                pengguna.
              </p>
            </>
          ) : null}
        </header>

        {sesiBerakhir ? (
          <section
            aria-labelledby="sesi-berakhir"
            className="mt-8 rounded-xl border border-zinc-500 bg-zinc-950 px-5 py-4"
          >
            <h2
              id="sesi-berakhir"
              className="text-lg font-semibold text-white"
            >
              Sesi sudah berakhir
            </h2>
            <p className="mt-2 text-base leading-relaxed text-zinc-100">
              Sesi sudah berakhir. Masuk lagi untuk lanjut.
            </p>
            <Link to="/masuk" className={TOMBOL_UTAMA}>
              Masuk
            </Link>
          </section>
        ) : null}

        {sesiTerkunci ? (
          <section
            aria-labelledby="sesi-terkunci"
            className="mt-8 rounded-xl border border-zinc-500 bg-zinc-950 px-5 py-4"
          >
            <h2
              id="sesi-terkunci"
              className="text-lg font-semibold text-white"
            >
              Aplikasi terkunci
            </h2>
            <p className="mt-2 text-base leading-relaxed text-zinc-100">
              Aplikasi terkunci, masukkan PIN untuk membuka.
            </p>
            <Link to="/kunci" className={TOMBOL_UTAMA}>
              Buka dengan PIN
            </Link>
          </section>
        ) : null}

        {!sesiBerakhir && !sesiTerkunci && (
          <>
            {kuotaHabis ? (
              <section
                aria-labelledby="kuota-habis"
                className="mt-8 rounded-xl border border-yellow-400/45 bg-yellow-400/10 px-5 py-4"
              >
                <h2
                  id="kuota-habis"
                  className="text-lg font-semibold text-yellow-400"
                >
                  Batas pertanyaan hari ini sudah habis
                </h2>
                <p className="mt-2 text-base leading-relaxed text-zinc-100">
                  Batas 20 pertanyaan hari ini sudah habis. Batas kembali
                  besok.
                </p>
                <p className="mt-2 text-base leading-relaxed text-zinc-100">
                  Batas ini diberlakukan agar kuota layanan cukup untuk semua
                  pengguna. Sementara itu, panduan langkah perbaikan manual
                  tetap bisa dibaca, dan riwayat tanya jawab di bawah tetap
                  bisa dibuka kapan pun.
                </p>
                <DaftarPanduan />
              </section>
            ) : null}

            <section aria-labelledby="tanya-ai" className="mt-8">
              <h2
                id="tanya-ai"
                className="text-xl font-semibold tracking-tight text-white"
              >
                Tanya Diagnosis AI
              </h2>
              <form onSubmit={kirimPertanyaan} className="mt-4" noValidate>
                <label
                  htmlFor="pertanyaan-ai"
                  className="block text-base font-medium text-zinc-100"
                >
                  Keluhan atau pertanyaan{" "}
                  <span className="text-zinc-400">(wajib diisi)</span>
                </label>
                <textarea
                  id="pertanyaan-ai"
                  ref={textareaRef}
                  value={pertanyaan}
                  onChange={(e) => {
                    setPertanyaan(e.target.value);
                    if (galatForm) {
                      setGalatForm(null);
                    }
                  }}
                  rows={5}
                  disabled={formNonaktif}
                  aria-invalid={galatForm ? true : undefined}
                  aria-describedby={
                    galatForm
                      ? "bantuan-pertanyaan galat-pertanyaan"
                      : "bantuan-pertanyaan"
                  }
                  placeholder="Contoh: WiFi lemot padahal sinyal penuh. Apa yang harus diperiksa dulu?"
                  className={`mt-2 w-full rounded-xl border border-zinc-500 bg-zinc-900 px-4 py-3 text-base leading-relaxed text-zinc-100 placeholder-zinc-400 disabled:bg-zinc-800 disabled:text-zinc-400 ${FOKUS}`}
                />
                <p
                  id="bantuan-pertanyaan"
                  className="mt-2 text-sm leading-relaxed text-zinc-400"
                >
                  Sertakan apa masalahnya, kapan terjadi, dan apa yang sudah
                  dicoba.{" "}
                  <span className="tabular-nums">
                    {pertanyaan.length} dari {PERTANYAAN_MAKS_KARAKTER}{" "}
                    karakter.
                  </span>
                </p>
                {galatForm ? (
                  <p
                    id="galat-pertanyaan"
                    role="alert"
                    className="mt-2 text-base font-medium text-red-400"
                  >
                    {galatForm}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={formNonaktif}
                  aria-busy={mengirim || undefined}
                  className={`mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-base font-semibold text-black transition-colors hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-400 sm:w-auto ${FOKUS}`}
                >
                  {mengirim ? (
                    <>
                      <svg
                        className="h-5 w-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeOpacity="0.25"
                          strokeWidth="3"
                        />
                        <path
                          d="M22 12a10 10 0 0 0-10-10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Sedang menyiapkan jawaban…
                    </>
                  ) : (
                    "Kirim"
                  )}
                </button>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Jawaban AI adalah saran, bukan vonis pasti.
                </p>
              </form>

              <div className="mt-6">
                <h3 className="text-base font-semibold text-white">
                  Contoh pertanyaan yang baik
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                  Ketuk satu contoh untuk memakainya sebagai pertanyaan.
                </p>
                <ul className="mt-3 space-y-3">
                  {CONTOH_PERTANYAAN.map((contoh) => (
                    <li key={contoh}>
                      <button
                        type="button"
                        onClick={() => pilihContoh(contoh)}
                        disabled={formNonaktif}
                        className={`block min-h-[48px] w-full rounded-xl border border-zinc-500 bg-transparent px-4 py-3 text-left text-base leading-relaxed text-zinc-100 transition-colors hover:bg-white/5 disabled:border-zinc-800 disabled:text-zinc-400 ${FOKUS}`}
                      >
                        {contoh}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {galatKirim ? (
              <section
                aria-labelledby="galat-kirim"
                role="alert"
                className="mt-8 rounded-xl border border-red-400/45 bg-red-400/10 px-5 py-4"
              >
                <h2
                  id="galat-kirim"
                  className="text-lg font-semibold text-red-400"
                >
                  Pertanyaan belum terkirim
                </h2>
                <p className="mt-2 text-base leading-relaxed text-zinc-100">
                  {galatKirim}
                </p>
                <button
                  type="button"
                  onClick={cobaLagiKirim}
                  className={TOMBOL_SEKUNDER}
                >
                  Coba lagi
                </button>
              </section>
            ) : null}

            <section aria-labelledby="konteks-pemeriksaan" className="mt-12">
              <h2
                id="konteks-pemeriksaan"
                className="text-xl font-semibold tracking-tight text-white"
              >
                Ringkasan pemeriksaan terakhir
              </h2>
              <p className="mt-2 text-base leading-relaxed text-zinc-400">
                Data ini dipakai AI saat menjawab pertanyaan.
              </p>
              {statusKonteks === "memuat" ? (
                <p role="status" className="mt-4 text-base text-zinc-400">
                  Memuat ringkasan pemeriksaan…
                </p>
              ) : null}
              {statusKonteks === "siap" && konteks ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4">
                  <p className="text-base text-zinc-100">
                    Skor kesehatan:{" "}
                    <span className="font-semibold tabular-nums">
                      {konteks.skorTeks}
                    </span>{" "}
                    · {konteks.kategori}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Pemeriksaan {konteks.tanggalTeks}
                  </p>
                  {konteks.komponen.length > 0 ? (
                    <dl className="mt-4 space-y-2">
                      {konteks.komponen.map((item) => (
                        <div
                          key={item.label}
                          className="flex flex-wrap items-baseline justify-between gap-2"
                        >
                          <dt className="text-base text-zinc-400">
                            {item.label}
                          </dt>
                          <dd className="text-base text-zinc-100">
                            {item.nilai}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              ) : null}
              {statusKonteks === "kosong" ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4">
                  <p className="text-base leading-relaxed text-zinc-100">
                    Belum ada pemeriksaan. AI menjawab dari pertanyaan saja.
                    Jalankan Diagnosis satu ketuk di dashboard agar jawaban
                    berikutnya memakai data HP.
                  </p>
                  <Link to="/dashboard" className={TOMBOL_SEKUNDER}>
                    Buka dashboard
                  </Link>
                </div>
              ) : null}
              {statusKonteks === "galat" ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4">
                  <p className="text-base leading-relaxed text-zinc-100">
                    Ringkasan pemeriksaan terakhir belum bisa ditampilkan.
                  </p>
                  <button
                    type="button"
                    onClick={() => void muatKonteks()}
                    className={TOMBOL_SEKUNDER}
                  >
                    Coba lagi
                  </button>
                </div>
              ) : null}
            </section>

            {jawabanTerbaru ? (
              <section aria-labelledby="jawaban-ai" className="mt-12">
                <h2
                  id="jawaban-ai"
                  ref={jawabanRef}
                  tabIndex={-1}
                  className="text-xl font-semibold tracking-tight text-white"
                >
                  {jawabanTerbaru.sumber === "aturan"
                    ? "Saran dari panduan"
                    : "Saran dari AI"}
                </h2>
                {jawabanTerbaru.sumber === "aturan" ? (
                  <div className="mt-4 rounded-xl border border-blue-400/45 bg-blue-400/10 px-5 py-4">
                    <p className="text-base leading-relaxed text-zinc-100">
                      Layanan AI sedang tidak tersedia saat ini. Jawaban di
                      bawah disusun dari data pemeriksaan dan panduan langkah
                      standar — bukan dari AI — dan tidak tersimpan ke
                      riwayat.
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-zinc-100">
                      Panduan langkah perbaikan manual:
                    </p>
                    <DaftarPanduan />
                  </div>
                ) : null}
                {jawabanTerbaru.sumber === "cache" ? (
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                    Jawaban ini sama dengan jawaban sebelumnya untuk
                    pertanyaan yang sama.
                  </p>
                ) : null}
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4">
                  <p className="text-base font-medium leading-relaxed text-zinc-100">
                    {jawabanTerbaru.pertanyaan}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {formatTanggalJam(jawabanTerbaru.dibuat_pada)}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-zinc-100">
                    {jawabanTerbaru.jawaban}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  {DISCLAIMER}
                </p>
              </section>
            ) : null}

            <section aria-labelledby="riwayat-ai" className="mt-12">
              <h2
                id="riwayat-ai"
                className="text-xl font-semibold tracking-tight text-white"
              >
                Tanya jawab sebelumnya
              </h2>
              {statusRiwayat === "memuat" ? (
                <p role="status" className="mt-4 text-base text-zinc-400">
                  Mengambil data…
                </p>
              ) : null}
              {statusRiwayat === "galat" ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4">
                  <p className="text-base leading-relaxed text-zinc-100">
                    Data tidak bisa dimuat. Coba lagi.
                  </p>
                  <button
                    type="button"
                    onClick={() => void muatRiwayat()}
                    className={TOMBOL_SEKUNDER}
                  >
                    Coba lagi
                  </button>
                </div>
              ) : null}
              {statusRiwayat === "siap" && riwayat.length === 0 ? (
                <p className="mt-4 text-base leading-relaxed text-zinc-400">
                  Belum ada tanya jawab. Tulis keluhan di atas untuk mulai.
                </p>
              ) : null}
              {statusRiwayat === "siap" && riwayat.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {riwayat.map((entri) => {
                    const dibuka = terbuka.has(entri.id);
                    return (
                      <li
                        key={entri.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-950"
                      >
                        <button
                          type="button"
                          aria-expanded={dibuka}
                          aria-controls={`jawaban-${entri.id}`}
                          onClick={() => alihkanRiwayat(entri.id)}
                          className={`block min-h-[48px] w-full rounded-xl px-5 py-4 text-left ${FOKUS}`}
                        >
                          <span className="block text-base font-medium leading-relaxed text-zinc-100">
                            {entri.pertanyaan}
                          </span>
                          <span className="mt-1 block text-sm text-zinc-400">
                            {formatTanggalJam(entri.dibuat_pada)}
                          </span>
                        </button>
                        {dibuka ? (
                          <div
                            id={`jawaban-${entri.id}`}
                            className="border-t border-zinc-800 px-5 py-4"
                          >
                            <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-100">
                              {entri.jawaban}
                            </p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          </>
        )}

        <div role="status" aria-live="polite" className="sr-only">
          {pengumuman}
        </div>
      </div>
    </div>
  );
}
