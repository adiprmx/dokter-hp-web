import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { MeterStrip } from "../components/ui/MeterStrip";
import { SkeletonText } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
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
import { statusDariSkor, tokenStatus } from "../lib/status-warna";

// Layar 10, Diagnosis AI (rute `/ai`, wajib masuk). Semua teks
// mengikuti docs/copy.md §10 dan §13; contoh pertanyaan dari
// docs/panduan-pengguna.md §6.2. Frontend tidak pernah memanggil
// Gemini langsung, pertanyaan dikirim ke POST /api/ai/diagnose
// dan kunci API hanya ada di server (Worker). Pemanggilan API
// memakai lib/api.ts (credentials: "include" + ApiError bertipe,
// K-13/K-16); kode galat yang ditangani: AI_QUOTA_HABIS,
// UNAUTHORIZED, SESSION_LOCKED, RATE_LIMITED, DATABASE_SIBUK.
// Kode 502 AI_TIDAK_TERSEDIA sudah pensiun (K-23): bila Gemini
// gagal, server menjawab 200 dengan jawaban fallback berlabel
// (sumber_jawaban "aturan").
//
// Redesign v2.0 (docs/redesign-v20-spec.md §8.6, mode Operate).
// Design Read: permukaan Operate alat ukur kesehatan HP untuk
// pemilik HP yang punya masalah nyata, bahasa "Alat ukur, hidup":
// kanvas hitam, aksen primer putih, warna hanya informasi status.
// Dial antislop ENERGY 3 / RHYTHM 4 / MOTION 2; taste 5/3/5.
// Keputusan warna (R-31, satu baris alasan per keputusan):
// - Strip kuota: angka + meter memakai statusDariSkor atas persen
//   sisa kuota, karena sisa kuota adalah ukuran 0-100 seperti skor
//   (banyak sisa hijau, menipis kuning, tinggal sedikit merah).
// - Badge sumber jawaban: "AI" biru info (asal jawaban adalah
//   informasi), "Aturan" netral (fallback bukan galat dan bukan
//   sukses); keduanya tampil selalu, tidak pernah disamarkan.
// - Skor konteks: angka diurai dari teks skor lalu lewat
//   statusDariSkor; bila tidak terurai, tampil netral tanpa warna.
// - Semua warna status lewat helper status-warna + token CSS;
//   tidak ada peta keadaan ke warna di file ini.
// Logika (API, label sumber, batas kuota) TIDAK berubah; yang
// berubah hanya tampilan. Prosa pengguna tanpa em dash.

const JUDUL_HALAMAN = "Diagnosis AI | Dokter HP";

// Disclaimer (docs/copy.md §10; em dash diganti koma agar prosa
// pengguna bebas em dash, artinya sama persis).
const DISCLAIMER =
  "Jawaban di bawah ini adalah saran berdasarkan data yang tersedia, bukan vonis pasti. " +
  "Bila masalah menyangkut kerusakan fisik, misalnya HP jatuh atau terkena air, bawa ke teknisi.";

// Contoh pertanyaan yang baik (docs/panduan-pengguna.md §6.2).
const CONTOH_PERTANYAAN = [
  "WiFi lemot padahal sinyal penuh. Kecepatan unduh 30 KB/detik. Sudah coba lupakan jaringan dan sambung ulang, tapi tetap lambat.",
  "Baterai HP cepat habis sejak kemarin. Dari 100% ke 40% dalam 3 jam padahal hanya dipakai chat. Apa yang harus diperiksa?",
  "Penyimpanan hampir penuh, tersisa 2 GB dari 128 GB. Apa yang aman dihapus?",
];

// Tautan bergaya tombol (cerminan varian Button primary/secondary,
// karena Button hanya merender <button>). Tanpa margin: pemanggil
// yang menentukan jaraknya.
const TAUTAN_UTAMA =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-5 text-base font-medium text-black transition-colors hover:bg-zinc-200";
const TAUTAN_SEKUNDER =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg border border-[var(--color-border-strong)] bg-transparent px-5 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-white/5";

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
            className="inline-flex min-h-[48px] items-center text-base font-medium text-[var(--color-text-primary)] underline decoration-[var(--color-border-strong)] underline-offset-4"
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
      // Backend: kegagalan Gemini tidak lagi 502, melainkan jawaban
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

  // Status strip kuota: persen sisa kuota lewat helper kanonis
  // statusDariSkor (ambang 80/50). Label kata menyertai warna
  // (warna tidak pernah berdiri sendiri). Sisa 0 berlabel
  // "Kuota habis" walau kuotaHabis belum dikunci server, karena
  // angka yang tampil memang 0.
  const persenKuota =
    sisaKuota === null
      ? null
      : (sisaKuota / BATAS_PERTANYAAN_HARIAN) * 100;
  const statusKuota =
    persenKuota === null ? null : statusDariSkor(persenKuota);
  const labelKuota =
    sisaKuota === 0
      ? "Kuota habis"
      : statusKuota === "sukses"
        ? "Kuota cukup"
        : statusKuota === "peringatan"
          ? "Kuota menipis"
          : "Kuota tinggal sedikit";

  // Skor konteks untuk warna angka: teks skor ("68 dari 100")
  // diurai ke angka lalu lewat helper kanonis; bila tidak terurai,
  // angka tampil netral tanpa warna (bukan 0 karangan).
  const skorKonteks = konteks
    ? Number.parseFloat(konteks.skorTeks)
    : Number.NaN;
  const statusSkorKonteks = Number.isFinite(skorKonteks)
    ? statusDariSkor(skorKonteks)
    : null;

  return (
    <div className="min-h-dvh bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10 sm:pt-14">
        <nav aria-label="Navigasi halaman">
          <Link
            to="/dashboard"
            className="inline-flex min-h-[48px] items-center text-base font-medium text-[var(--color-text-primary)] underline decoration-[var(--color-border-strong)] underline-offset-4"
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
          <p className="mt-3 max-w-[65ch] text-base leading-relaxed text-zinc-400">
            Ceritakan masalah HP, dapatkan saran langkah perbaikan.
          </p>
          {sisaKuota !== null && !kuotaHabis && statusKuota !== null ? (
            <div className="mt-6 border-t border-[var(--color-border)] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-base font-medium text-[var(--color-text-primary)]">
                  Sisa pertanyaan hari ini
                </p>
                <StatusBadge status={statusKuota}>
                  {labelKuota}
                </StatusBadge>
              </div>
              <p className="mt-3">
                <span
                  className="dh-numeric text-[length:var(--text-display-lg)] font-bold leading-[var(--leading-display)]"
                  style={{ color: tokenStatus(statusKuota).teks }}
                >
                  {sisaKuota}
                </span>
                <span className="ml-2 text-base text-zinc-400">
                  dari {BATAS_PERTANYAAN_HARIAN} pertanyaan
                </span>
              </p>
              <MeterStrip
                value={persenKuota}
                ariaLabel={`Sisa kuota ${sisaKuota} dari ${BATAS_PERTANYAAN_HARIAN} pertanyaan`}
                className="mt-3"
              />
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Batas ini diberlakukan agar kuota layanan cukup untuk semua
                pengguna.
              </p>
            </div>
          ) : null}
        </header>

        {sesiBerakhir ? (
          <section aria-labelledby="sesi-berakhir" className="mt-8">
            <Card padding="lg">
              <h2
                id="sesi-berakhir"
                className="text-lg font-semibold text-white"
              >
                Sesi sudah berakhir
              </h2>
              <p className="mt-2 text-base leading-relaxed text-zinc-100">
                Sesi sudah berakhir. Masuk lagi untuk lanjut.
              </p>
              <Link to="/masuk" className={`${TAUTAN_UTAMA} mt-4`}>
                Masuk
              </Link>
            </Card>
          </section>
        ) : null}

        {sesiTerkunci ? (
          <section aria-labelledby="sesi-terkunci" className="mt-8">
            <Card padding="lg">
              <h2
                id="sesi-terkunci"
                className="text-lg font-semibold text-white"
              >
                Aplikasi terkunci
              </h2>
              <p className="mt-2 text-base leading-relaxed text-zinc-100">
                Aplikasi terkunci, masukkan PIN untuk membuka.
              </p>
              <Link to="/kunci" className={`${TAUTAN_UTAMA} mt-4`}>
                Buka dengan PIN
              </Link>
            </Card>
          </section>
        ) : null}

        {!sesiBerakhir && !sesiTerkunci && (
          <>
            {kuotaHabis ? (
              <section aria-labelledby="kuota-habis" className="mt-8">
                <Card padding="lg" status="peringatan">
                  <h2
                    id="kuota-habis"
                    className="text-lg font-semibold"
                    style={{ color: tokenStatus("peringatan").teks }}
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
                </Card>
              </section>
            ) : null}

            <section aria-labelledby="tanya-ai" className="mt-8">
              <h2
                id="tanya-ai"
                className="text-xl font-semibold tracking-tight text-white"
              >
                Tanya Diagnosis AI
              </h2>
              <Card padding="lg" className="mt-4">
                <form onSubmit={kirimPertanyaan} noValidate>
                  <label
                    htmlFor="pertanyaan-ai"
                    className="block text-base font-medium text-[var(--color-text-primary)]"
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
                    className="mt-2 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-3 text-base leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-disabled)]"
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
                      className="mt-2 text-base font-medium"
                      style={{ color: tokenStatus("galat").teks }}
                    >
                      {galatForm}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    variant="primary"
                    loading={mengirim}
                    disabled={formNonaktif}
                    fullWidth
                    className="mt-4 sm:w-auto"
                  >
                    {mengirim ? "Sedang menyiapkan jawaban…" : "Kirim"}
                  </Button>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                    Jawaban AI adalah saran, bukan vonis pasti.
                  </p>
                </form>
              </Card>

              <div className="mt-8">
                <h3 className="text-base font-semibold text-white">
                  Contoh pertanyaan yang baik
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                  Ketuk satu contoh untuk memakainya sebagai pertanyaan.
                </p>
                <Card padding="none" className="mt-3 overflow-hidden">
                  <ul className="divide-y divide-[var(--color-border)]">
                    {CONTOH_PERTANYAAN.map((contoh) => (
                      <li key={contoh}>
                        <button
                          type="button"
                          onClick={() => pilihContoh(contoh)}
                          disabled={formNonaktif}
                          className="block min-h-[48px] w-full px-4 py-3 text-left text-base leading-relaxed text-zinc-100 transition-colors hover:bg-white/5 disabled:text-[var(--color-text-disabled)]"
                        >
                          {contoh}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </section>

            {mengirim ? (
              <section
                aria-label="Jawaban sedang disiapkan"
                className="mt-10"
              >
                <Card padding="lg">
                  <p className="text-base font-medium text-[var(--color-text-primary)]">
                    Sedang menyiapkan jawaban…
                  </p>
                  <SkeletonText
                    lines={5}
                    className="mt-4"
                    label="Memuat jawaban"
                  />
                </Card>
              </section>
            ) : null}

            {galatKirim ? (
              <section
                aria-labelledby="galat-kirim"
                role="alert"
                className="mt-8"
              >
                <Card padding="lg" status="galat">
                  <h2
                    id="galat-kirim"
                    className="text-lg font-semibold"
                    style={{ color: tokenStatus("galat").teks }}
                  >
                    Pertanyaan belum terkirim
                  </h2>
                  <p className="mt-2 text-base leading-relaxed text-zinc-100">
                    {galatKirim}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={cobaLagiKirim}
                    className="mt-4"
                  >
                    Coba lagi
                  </Button>
                </Card>
              </section>
            ) : null}

            {jawabanTerbaru ? (
              <section aria-labelledby="jawaban-ai" className="mt-12">
                <div className="flex flex-wrap items-center gap-3">
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
                  <StatusBadge
                    status={
                      jawabanTerbaru.sumber === "aturan" ? "netral" : "info"
                    }
                  >
                    {jawabanTerbaru.sumber === "aturan" ? "Aturan" : "AI"}
                  </StatusBadge>
                </div>
                {jawabanTerbaru.sumber === "aturan" ? (
                  <Card padding="lg" status="info" className="mt-4">
                    <p className="text-base leading-relaxed text-zinc-100">
                      Layanan AI sedang tidak tersedia saat ini. Jawaban di
                      bawah disusun dari data pemeriksaan dan panduan langkah
                      standar, bukan dari AI, dan tidak tersimpan ke
                      riwayat.
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-zinc-100">
                      Panduan langkah perbaikan manual:
                    </p>
                    <DaftarPanduan />
                  </Card>
                ) : null}
                {jawabanTerbaru.sumber === "cache" ? (
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                    Jawaban ini sama dengan jawaban sebelumnya untuk
                    pertanyaan yang sama.
                  </p>
                ) : null}
                <Card padding="lg" className="mt-4">
                  <p className="text-base font-medium leading-relaxed text-zinc-100">
                    {jawabanTerbaru.pertanyaan}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {formatTanggalJam(jawabanTerbaru.dibuat_pada)}
                  </p>
                  <p className="mt-4 max-w-[65ch] whitespace-pre-wrap text-base leading-relaxed text-zinc-100">
                    {jawabanTerbaru.jawaban}
                  </p>
                </Card>
                <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-zinc-400">
                  {DISCLAIMER}
                </p>
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
                <div className="mt-4">
                  <p className="text-base text-zinc-400">
                    Memuat ringkasan pemeriksaan…
                  </p>
                  <SkeletonText
                    lines={3}
                    className="mt-4"
                    label="Memuat ringkasan pemeriksaan"
                  />
                </div>
              ) : null}
              {statusKonteks === "siap" && konteks ? (
                <Card padding="lg" className="mt-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {Number.isFinite(skorKonteks) &&
                    statusSkorKonteks !== null ? (
                      <p>
                        <span
                          className="dh-numeric text-[length:var(--text-display-lg)] font-bold leading-[var(--leading-display)]"
                          style={{
                            color: tokenStatus(statusSkorKonteks).teks,
                          }}
                        >
                          {skorKonteks}
                        </span>
                        <span className="ml-2 text-base text-zinc-400">
                          dari 100
                        </span>
                      </p>
                    ) : (
                      <p className="text-base text-zinc-100">
                        Skor kesehatan:{" "}
                        <span className="font-semibold tabular-nums">
                          {konteks.skorTeks}
                        </span>
                      </p>
                    )}
                    <p className="text-base text-zinc-100">
                      {konteks.kategori}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    Pemeriksaan {konteks.tanggalTeks}
                  </p>
                  {konteks.komponen.length > 0 ? (
                    <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      {konteks.komponen.map((item) => (
                        <div key={item.label}>
                          <dt className="text-sm text-zinc-400">
                            {item.label}
                          </dt>
                          <dd className="mt-1 text-base text-zinc-100">
                            {item.nilai}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </Card>
              ) : null}
              {statusKonteks === "kosong" ? (
                <div className="mt-4">
                  <EmptyState
                    title="Belum ada pemeriksaan"
                    description="AI menjawab dari pertanyaan saja. Jalankan Diagnosis satu ketuk di dashboard agar jawaban berikutnya memakai data HP."
                    action={
                      <Link to="/dashboard" className={TAUTAN_SEKUNDER}>
                        Buka dashboard
                      </Link>
                    }
                  />
                </div>
              ) : null}
              {statusKonteks === "galat" ? (
                <div className="mt-4">
                  <Card padding="lg" status="galat">
                    <p className="text-base leading-relaxed text-zinc-100">
                      Ringkasan pemeriksaan terakhir belum bisa ditampilkan.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void muatKonteks()}
                      className="mt-4"
                    >
                      Coba lagi
                    </Button>
                  </Card>
                </div>
              ) : null}
            </section>

            <section aria-labelledby="riwayat-ai" className="mt-12">
              <h2
                id="riwayat-ai"
                className="text-xl font-semibold tracking-tight text-white"
              >
                Tanya jawab sebelumnya
              </h2>
              {statusRiwayat === "memuat" ? (
                <div className="mt-4">
                  <p className="text-base text-zinc-400">Mengambil data…</p>
                  <SkeletonText
                    lines={3}
                    className="mt-4"
                    label="Memuat riwayat"
                  />
                </div>
              ) : null}
              {statusRiwayat === "galat" ? (
                <div className="mt-4">
                  <Card padding="lg" status="galat">
                    <p className="text-base leading-relaxed text-zinc-100">
                      Data tidak bisa dimuat. Coba lagi.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void muatRiwayat()}
                      className="mt-4"
                    >
                      Coba lagi
                    </Button>
                  </Card>
                </div>
              ) : null}
              {statusRiwayat === "siap" && riwayat.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="Belum ada tanya jawab"
                    description="Tulis keluhan di atas untuk mulai."
                  />
                </div>
              ) : null}
              {statusRiwayat === "siap" && riwayat.length > 0 ? (
                <Card padding="none" className="mt-4 overflow-hidden">
                  <ul className="divide-y divide-[var(--color-border)]">
                    {riwayat.map((entri) => {
                      const dibuka = terbuka.has(entri.id);
                      return (
                        <li key={entri.id}>
                          <button
                            type="button"
                            aria-expanded={dibuka}
                            aria-controls={`jawaban-${entri.id}`}
                            onClick={() => alihkanRiwayat(entri.id)}
                            className="block min-h-[48px] w-full px-5 py-4 text-left transition-colors hover:bg-white/5"
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
                              className="border-t border-[var(--color-border)] px-5 py-4"
                            >
                              <p className="max-w-[65ch] whitespace-pre-wrap text-base leading-relaxed text-zinc-100">
                                {entri.jawaban}
                              </p>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
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
