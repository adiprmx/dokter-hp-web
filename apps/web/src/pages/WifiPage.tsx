// Dokter WiFi — /wifi
// Tes kecepatan unduh, latensi HTTP, dan tes bertahan 30 detik.
// BISA DIPAKAI TANPA AKUN: hasil tampil di layar; penyimpanan
// riwayat dan riwayat laporan hanya bila sudah masuk.
//
// Acuan: PRODUCT.md 4.4, docs/copy.md 5, docs/api-contracts.md 4
// dan 7, docs/panduan-pengguna.md 4, docs/a11y.md 6.7,
// docs/performance.md 3.5 (halaman ini tidak mem-prefetch apa pun
// selama tes berjalan).
//
// Catatan: rute /wifi didaftarkan di App.tsx oleh koordinator;
// file ini hanya komponen halamannya.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchJson } from "../lib/api";
import {
  DURASI_TES_BERTAHAN_DETIK,
  GalatTes,
  bacaInfoJaringan,
  formatKecepatan,
  formatLatensi,
  hitungKecepatanKbps,
  jalankanTesBertahan,
  klasifikasiKecepatan,
  labelSinyalDariDbm,
  nilaiTesBertahan,
  ukurKecepatanUnduh,
  ukurLatensiHttp,
  type HasilTesBertahan,
  type KlasifikasiKecepatan,
  type SampelBertahan,
} from "../lib/speedtest";
import GrafikBertahan from "../components/wifi/GrafikBertahan";
import RekomendasiWifi, {
  rangkumRekomendasi,
  type MasukanRekomendasi,
} from "../components/wifi/RekomendasiWifi";

// ------------------------------------------------------------------
// Tipe
// ------------------------------------------------------------------

type TahapTes =
  | "idle"
  | "info"
  | "unduh"
  | "latensi"
  | "menyusun"
  | "selesai"
  | "galat";

interface HasilTes {
  kecepatanKbps: number;
  klasifikasi: KlasifikasiKecepatan;
  latensiMs: number | null;
  ip: string | null;
  jenisKoneksi: string | null;
  downlinkMbps: number | null;
  diukurPada: Date;
}

interface KeadaanBertahan {
  berjalan: boolean;
  detikKe: number;
  sampel: SampelBertahan[];
  hasil: HasilTesBertahan | null;
  galat: string | null;
}

/** Laporan WiFi dari API (docs/api-contracts.md 4). */
interface LaporanWifi {
  id: string;
  ssid: string | null;
  kecepatan_koneksi_mbps: number | null;
  kekuatan_sinyal: string | null;
  channel: number | null;
  dns: string | null;
  ping_ms: number | null;
  rekomendasi: string | null;
  kecepatan_unduh_kbps: number | null;
  sumber: string;
  durasi_tes_detik: number | null;
  dibuat_pada: string;
}

interface InfoManual {
  ssid: string;
  sinyalDbm: string;
  channel: string;
  dns: string;
}

// ------------------------------------------------------------------
// Konstanta dan utilitas kecil
// ------------------------------------------------------------------

const TAHAP_TES: {
  id: Exclude<TahapTes, "idle" | "selesai" | "galat">;
  label: string;
}[] = [
  { id: "info", label: "Membaca info jaringan" },
  { id: "unduh", label: "Mengukur kecepatan unduh" },
  { id: "latensi", label: "Mengukur latensi" },
  { id: "menyusun", label: "Menyusun hasil" },
];

const KUNCI_INFO_MANUAL = "dokter-hp-info-jaringan";

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatTanggal(d: Date | string): string {
  const waktu = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(waktu.getTime())) return "tidak tersedia";
  return FORMAT_TANGGAL.format(waktu);
}

/** Membuka envelope API { success, data } atau memakai JSON apa adanya. */
function bukaData<T>(json: unknown): T {
  if (json !== null && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/** Panggilan API dengan cookie sesi (credentials: include). */
async function panggilApi<T>(path: string, init?: RequestInit): Promise<T> {
  const json = await fetchJson<unknown>(path, {
    credentials: "include",
    ...init,
  });
  return bukaData<T>(json);
}

function jeda(ms: number, sinyal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sinyal?.aborted) {
      reject(new DOMException("Dibatalkan.", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      sinyal?.removeEventListener("abort", batal);
      resolve();
    }, ms);
    const batal = () => {
      clearTimeout(timer);
      reject(new DOMException("Dibatalkan.", "AbortError"));
    };
    sinyal?.addEventListener("abort", batal, { once: true });
  });
}

/** Validasi input manual. Mengembalikan nilai angka atau null (kosong). */
function parseDbm(teks: string): {
  nilai: number | null;
  galat: string | null;
} {
  const isi = teks.trim();
  if (isi === "") return { nilai: null, galat: null };
  const n = Number(isi);
  if (!Number.isFinite(n) || n > 0 || n < -120) {
    return { nilai: null, galat: "Sinyal diisi angka dBm, misalnya -65." };
  }
  return { nilai: n, galat: null };
}

function parseChannel(teks: string): {
  nilai: number | null;
  galat: string | null;
} {
  const isi = teks.trim();
  if (isi === "") return { nilai: null, galat: null };
  const n = Number(isi);
  const valid =
    Number.isInteger(n) && ((n >= 1 && n <= 14) || (n >= 32 && n <= 177));
  if (!valid) {
    return {
      nilai: null,
      galat:
        "Channel diisi 1 sampai 14 (2,4 GHz) atau 32 sampai 177 (5 GHz).",
    };
  }
  return { nilai: n, galat: null };
}

function teksVerdict(hasil: HasilTesBertahan): string {
  if (hasil.verdict === "bertahan") {
    return "Kecepatan stabil selama 30 detik.";
  }
  if (hasil.verdict === "jatuh") {
    return (
      `Kecepatan mulai ${formatKecepatan(hasil.awalKbps)} lalu jatuh ke ` +
      `${formatKecepatan(hasil.akhirKbps)}. Pola seperti ini biasanya ` +
      "berasal dari router atau jaringan, bukan dari HP."
    );
  }
  return (
    "Kecepatan tidak stabil selama 30 detik — naik turun tanpa pola " +
    "yang jelas. Coba tes lagi saat jaringan tidak dipakai perangkat lain."
  );
}

function labelSumber(sumber: string): string {
  if (sumber === "apk") return "Dari aplikasi Dokter HP";
  if (sumber === "manual") return "Diisi manual";
  return "Dari tes web";
}

// ------------------------------------------------------------------
// Halaman
// ------------------------------------------------------------------

export default function WifiPage() {
  const judulRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sesi dan server.
  const [masuk, setMasuk] = useState<boolean | null>(null);
  const [serverTerhubung, setServerTerhubung] = useState<boolean | null>(null);

  // Tes utama.
  const [tahap, setTahap] = useState<TahapTes>("idle");
  const [hasil, setHasil] = useState<HasilTes | null>(null);
  const [liveKbps, setLiveKbps] = useState<number | null>(null);
  const [liveLatensiMs, setLiveLatensiMs] = useState<number | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pengumuman, setPengumuman] = useState("");

  // Tes bertahan.
  const [bertahan, setBertahan] = useState<KeadaanBertahan>({
    berjalan: false,
    detikKe: 0,
    sampel: [],
    hasil: null,
    galat: null,
  });

  // Input manual.
  const [manual, setManual] = useState<InfoManual>({
    ssid: "",
    sinyalDbm: "",
    channel: "",
    dns: "",
  });
  const [galatManual, setGalatManual] = useState<string | null>(null);
  const [pesanManual, setPesanManual] = useState<string | null>(null);

  // Simpan dan berbagi.
  const [menyimpan, setMenyimpan] = useState(false);
  const [sudahDisimpan, setSudahDisimpan] = useState(false);
  const [pesanSimpan, setPesanSimpan] = useState<string | null>(null);
  const [pesanBerbagi, setPesanBerbagi] = useState<string | null>(null);

  // Riwayat.
  const [riwayat, setRiwayat] = useState<LaporanWifi[] | null>(null);
  const [riwayatMemuat, setRiwayatMemuat] = useState(false);
  const [riwayatGalat, setRiwayatGalat] = useState<string | null>(null);

  const tesBerjalan =
    tahap === "info" ||
    tahap === "unduh" ||
    tahap === "latensi" ||
    tahap === "menyusun";

  // Judul halaman + fokus ke judul saat rute dibuka (a11y 5.4).
  useEffect(() => {
    document.title = "Dokter WiFi — Dokter HP";
    judulRef.current?.focus();
  }, []);

  // Status masuk + status server saat halaman dibuka.
  useEffect(() => {
    let aktif = true;
    panggilApi<{ nama?: string }>("/api/auth/me")
      .then(() => {
        if (aktif) setMasuk(true);
      })
      .catch(() => {
        if (aktif) setMasuk(false);
      });
    fetchJson<unknown>("/api/health")
      .then((json) => {
        if (!aktif) return;
        const data = bukaData<{ status?: string; ok?: boolean }>(json);
        setServerTerhubung(data?.status === "ok" || data?.ok === true);
      })
      .catch(() => {
        if (aktif) setServerTerhubung(false);
      });
    return () => {
      aktif = false;
    };
  }, []);

  // Info manual tersimpan di perangkat (localStorage).
  useEffect(() => {
    try {
      const mentah = localStorage.getItem(KUNCI_INFO_MANUAL);
      if (!mentah) return;
      const parsed = JSON.parse(mentah) as Partial<InfoManual>;
      setManual({
        ssid: typeof parsed.ssid === "string" ? parsed.ssid : "",
        sinyalDbm: typeof parsed.sinyalDbm === "string" ? parsed.sinyalDbm : "",
        channel: typeof parsed.channel === "string" ? parsed.channel : "",
        dns: typeof parsed.dns === "string" ? parsed.dns : "",
      });
    } catch {
      // Data tersimpan rusak — abaikan, mulai dari kosong.
    }
  }, []);

  const muatRiwayat = useCallback(async () => {
    setRiwayatMemuat(true);
    setRiwayatGalat(null);
    try {
      const daftar = await panggilApi<LaporanWifi[]>(
        "/api/wifi-reports?limit=20&offset=0",
      );
      setRiwayat(Array.isArray(daftar) ? daftar : []);
    } catch {
      setRiwayatGalat("Data tidak bisa dimuat. Coba lagi.");
      setRiwayat([]);
    } finally {
      setRiwayatMemuat(false);
    }
  }, []);

  // Riwayat hanya dimuat bila sudah masuk.
  useEffect(() => {
    if (masuk === true) {
      void muatRiwayat();
    }
  }, [masuk, muatRiwayat]);

  // ----------------------------------------------------------------
  // Tes utama
  // ----------------------------------------------------------------

  const jalankanTes = useCallback(async () => {
    if (tesBerjalan || bertahan.berjalan) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGalat(null);
    setHasil(null);
    setLiveKbps(null);
    setLiveLatensiMs(null);
    setSudahDisimpan(false);
    setPesanSimpan(null);
    setBertahan((b) => ({ ...b, sampel: [], hasil: null, galat: null }));
    try {
      setTahap("info");
      setPengumuman("Membaca info jaringan…");
      const info = bacaInfoJaringan();
      // Jeda singkat agar tahap pertama sempat terlihat.
      await jeda(300, controller.signal);

      setTahap("unduh");
      setPengumuman("Mengukur kecepatan unduh…");
      const unduh = await ukurKecepatanUnduh({
        sinyal: controller.signal,
        onKemajuan: (byte, durasiMs) =>
          setLiveKbps(hitungKecepatanKbps(byte, durasiMs)),
      });

      setTahap("latensi");
      setPengumuman("Mengukur latensi…");
      const latensi = await ukurLatensiHttp({
        sinyal: controller.signal,
        onSampel: (ms) => setLiveLatensiMs(ms),
      });

      setTahap("menyusun");
      setPengumuman("Menyusun hasil…");
      const klasifikasi = klasifikasiKecepatan(unduh.kbps);
      setHasil({
        kecepatanKbps: unduh.kbps,
        klasifikasi,
        latensiMs: latensi.medianMs,
        ip: latensi.ip,
        jenisKoneksi: info.jenisKoneksi,
        downlinkMbps: info.downlinkMbps,
        diukurPada: new Date(),
      });
      setTahap("selesai");
      setPengumuman(
        `Tes WiFi selesai. Kecepatan unduh ${formatKecepatan(unduh.kbps)} ` +
          `(${klasifikasi.label}).`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setTahap("idle");
        setPengumuman("Tes dibatalkan.");
        return;
      }
      setGalat("Tes WiFi tidak selesai. Periksa koneksi, lalu coba lagi.");
      setTahap("galat");
      setPengumuman(
        "Tes WiFi tidak selesai. Periksa koneksi, lalu coba lagi.",
      );
    } finally {
      abortRef.current = null;
    }
  }, [tesBerjalan, bertahan.berjalan]);

  const batalkanTes = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ----------------------------------------------------------------
  // Tes bertahan
  // ----------------------------------------------------------------

  const jalankanBertahan = useCallback(async () => {
    if (tesBerjalan || bertahan.berjalan) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBertahan({
      berjalan: true,
      detikKe: 0,
      sampel: [],
      hasil: null,
      galat: null,
    });
    setPengumuman("Memulai tes bertahan 30 detik.");
    try {
      const daftar = await jalankanTesBertahan(
        (s) =>
          setBertahan((b) => ({
            ...b,
            detikKe: s.detikKe + 1,
            sampel: [...b.sampel, s],
          })),
        { sinyal: controller.signal },
      );
      const hasilTes = nilaiTesBertahan(daftar.map((s) => s.kbps));
      setBertahan((b) => ({ ...b, berjalan: false, hasil: hasilTes }));
      setPengumuman(
        "Tes bertahan selesai. Lihat grafik kecepatan per detik di bawah.",
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setBertahan((b) => ({ ...b, berjalan: false }));
        setPengumuman("Tes bertahan dibatalkan.");
        return;
      }
      if (err instanceof GalatTes) {
        setBertahan((b) => ({
          ...b,
          berjalan: false,
          galat: "Tes bertahan tidak selesai. Coba lagi.",
        }));
        setPengumuman("Tes bertahan tidak selesai. Coba lagi.");
      }
    } finally {
      abortRef.current = null;
    }
  }, [tesBerjalan, bertahan.berjalan]);

  // ----------------------------------------------------------------
  // Input manual, simpan, berbagi
  // ----------------------------------------------------------------

  const simpanInfoManual = useCallback(() => {
    const dbm = parseDbm(manual.sinyalDbm);
    const ch = parseChannel(manual.channel);
    if (dbm.galat) {
      setGalatManual(dbm.galat);
      setPesanManual(null);
      return;
    }
    if (ch.galat) {
      setGalatManual(ch.galat);
      setPesanManual(null);
      return;
    }
    if (manual.ssid.length > 32) {
      setGalatManual("Nama WiFi maksimal 32 karakter.");
      setPesanManual(null);
      return;
    }
    if (manual.dns.length > 64) {
      setGalatManual("DNS maksimal 64 karakter.");
      setPesanManual(null);
      return;
    }
    try {
      localStorage.setItem(KUNCI_INFO_MANUAL, JSON.stringify(manual));
    } catch {
      // Penyimpanan perangkat penuh/ditolak — info tetap dipakai
      // untuk laporan di sesi ini.
    }
    setGalatManual(null);
    setPesanManual("Info jaringan tersimpan.");
  }, [manual]);

  const simpanLaporan = useCallback(async () => {
    if (!hasil || !masuk || menyimpan) return;
    const dbm = parseDbm(manual.sinyalDbm);
    const ch = parseChannel(manual.channel);
    if (dbm.galat || ch.galat) {
      setGalatManual(dbm.galat ?? ch.galat);
      setPesanSimpan("Periksa lagi info jaringan sebelum menyimpan.");
      return;
    }
    setMenyimpan(true);
    setPesanSimpan(null);
    try {
      const adaBertahan =
        bertahan.sampel.length >= DURASI_TES_BERTAHAN_DETIK &&
        bertahan.hasil !== null;
      const masukan: MasukanRekomendasi = {
        kecepatanKbps: hasil.kecepatanKbps,
        latensiMs: hasil.latensiMs,
        sinyalDbm: dbm.nilai,
      };
      const payload = {
        ssid: manual.ssid.trim() === "" ? null : manual.ssid.trim(),
        kecepatan_koneksi_mbps: hasil.downlinkMbps,
        kekuatan_sinyal:
          dbm.nilai === null ? null : labelSinyalDariDbm(dbm.nilai),
        channel: ch.nilai,
        dns: manual.dns.trim() === "" ? null : manual.dns.trim(),
        ping_ms:
          hasil.latensiMs === null ? null : Math.round(hasil.latensiMs),
        rekomendasi: rangkumRekomendasi(masukan),
        kecepatan_unduh_kbps: Math.round(hasil.kecepatanKbps * 10) / 10,
        sumber: "web",
        durasi_tes_detik: adaBertahan ? DURASI_TES_BERTAHAN_DETIK : null,
      };
      const dibuat = await panggilApi<LaporanWifi>("/api/wifi-reports", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (adaBertahan && dibuat?.id) {
        await panggilApi(`/api/wifi-reports/${dibuat.id}/samples`, {
          method: "POST",
          body: JSON.stringify({
            samples: bertahan.sampel.map((s) => ({
              detik_ke: s.detikKe,
              kecepatan_kbps: Math.round(s.kbps * 10) / 10,
            })),
          }),
        });
      }
      setSudahDisimpan(true);
      setPesanSimpan("Hasil tes tersimpan ke riwayat.");
      void muatRiwayat();
    } catch {
      setPesanSimpan("Data tidak bisa disimpan. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }, [hasil, masuk, menyimpan, manual, bertahan, muatRiwayat]);

  const bagikanHasil = useCallback(async () => {
    if (!hasil) return;
    const teks =
      "Tes WiFi Dokter HP: kecepatan unduh " +
      `${formatKecepatan(hasil.kecepatanKbps)} (${hasil.klasifikasi.label}), ` +
      `latensi ${hasil.latensiMs === null ? "tidak tersedia" : formatLatensi(hasil.latensiMs)}. ` +
      `Diukur ${formatTanggal(hasil.diukurPada)}.`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: teks, title: "Hasil tes WiFi" });
        setPesanBerbagi("Ringkasan hasil dibagikan.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(teks);
        setPesanBerbagi("Ringkasan hasil tersalin.");
      } else {
        setPesanBerbagi(
          "Tidak bisa menyalin otomatis. Salin manual dari layar.",
        );
      }
    } catch (err) {
      // Pengguna menutup menu berbagi — bukan galat.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPesanBerbagi("Hasil tidak bisa dibagikan. Coba salin manual.");
    }
  }, [hasil]);

  // ----------------------------------------------------------------
  // Turunan tampilan
  // ----------------------------------------------------------------

  const indeksTahapAktif = TAHAP_TES.findIndex((t) => t.id === tahap);
  const dbmTerisi = parseDbm(manual.sinyalDbm).nilai;
  const masukanRekomendasi: MasukanRekomendasi = {
    kecepatanKbps: hasil?.kecepatanKbps ?? null,
    latensiMs: hasil?.latensiMs ?? null,
    sinyalDbm: dbmTerisi,
  };

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="inline-flex min-h-[48px] items-center text-sm text-zinc-300 underline"
        >
          Kembali ke beranda
        </Link>

        <h1
          ref={judulRef}
          tabIndex={-1}
          className="mt-2 text-2xl font-bold tracking-tight outline-none"
        >
          Dokter WiFi
        </h1>
        <p className="mt-2 text-base leading-relaxed text-zinc-400">
          Ukur kecepatan WiFi dan cari tahu penyebabnya bila lemot.
        </p>

        {/* Wilayah pengumuman untuk pembaca layar (a11y 3.5). */}
        <div role="status" aria-live="polite" className="sr-only">
          {pengumuman}
        </div>
        {galat && (
          <div role="alert" aria-live="assertive" className="sr-only">
            {galat}
          </div>
        )}

        {/* Banner server tidak terjangkau. */}
        {serverTerhubung === false && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-yellow-400 bg-yellow-400/10 px-4 py-3"
          >
            <p className="text-sm font-medium text-yellow-400">
              Tidak tersambung ke server — hasil tes tidak tersimpan
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              Tes WiFi tetap bisa dijalankan, tetapi hasilnya tidak
              tersimpan sampai sambungan ke server pulih.
            </p>
          </div>
        )}

        {/* Banner tamu (belum masuk). */}
        {masuk === false && (
          <div className="mt-4 rounded-lg border border-zinc-500 bg-zinc-900 px-4 py-3">
            <p className="text-sm text-zinc-100">
              Anda belum masuk. Hasil tes tidak tersimpan.
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Hasil tes tampil di layar, tetapi tidak tersimpan. Masuk
              untuk menyimpan riwayat.
            </p>
            <Link
              to="/masuk"
              className="mt-2 inline-flex min-h-[48px] items-center font-medium text-white underline"
            >
              Masuk untuk menyimpan
            </Link>
          </div>
        )}

        {/* Tes kecepatan */}
        <section
          aria-labelledby="judul-tes"
          className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          <h2 id="judul-tes" className="text-lg font-semibold">
            Tes kecepatan
          </h2>

          {/* Progres 4 tahap (a11y 6.7: status dalam teks). */}
          <ol className="mt-4 space-y-2" aria-label="Tahap tes">
            {TAHAP_TES.map((t, i) => {
              const status =
                tahap === "selesai"
                  ? "Selesai"
                  : i < indeksTahapAktif
                    ? "Selesai"
                    : i === indeksTahapAktif
                      ? "Berjalan"
                      : "Belum dimulai";
              return (
                <li
                  key={t.id}
                  aria-current={i === indeksTahapAktif ? "step" : undefined}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2"
                >
                  <span className="text-sm text-zinc-100">
                    {i + 1}. {t.label}
                  </span>
                  <span className="shrink-0 text-sm text-zinc-400">
                    {status}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Pemantau live — sengaja BUKAN aria-live (a11y 6.7). */}
          {(tesBerjalan || hasil) && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-800 px-3 py-2">
                <p className="text-xs text-zinc-400">Kecepatan saat ini</p>
                <p className="mt-1 font-mono text-base text-white">
                  {liveKbps === null ? "—" : formatKecepatan(liveKbps)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-3 py-2">
                <p className="text-xs text-zinc-400">Latensi saat ini</p>
                <p className="mt-1 font-mono text-base text-white">
                  {liveLatensiMs === null
                    ? "—"
                    : formatLatensi(liveLatensiMs)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void jalankanTes()}
              disabled={tesBerjalan || bertahan.berjalan}
              className="min-h-[48px] w-full rounded-lg bg-white px-4 py-3 text-base font-semibold text-black hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-white disabled:bg-zinc-800 disabled:text-zinc-400"
            >
              {tesBerjalan ? "Sedang memeriksa…" : "Periksa WiFi sekarang"}
            </button>
            {tesBerjalan && (
              <button
                type="button"
                onClick={batalkanTes}
                className="min-h-[48px] w-full rounded-lg border border-zinc-500 bg-transparent px-4 py-3 text-base font-medium text-zinc-100 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white"
              >
                Batalkan
              </button>
            )}
          </div>

          {tahap === "galat" && galat && (
            <div className="mt-4 rounded-lg border border-red-400 bg-red-400/10 px-4 py-3">
              <p className="text-sm text-red-400">{galat}</p>
              <button
                type="button"
                onClick={() => void jalankanTes()}
                className="mt-2 min-h-[48px] rounded-lg border border-zinc-500 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                Coba lagi
              </button>
            </div>
          )}

          {!hasil && tahap === "idle" && (
            <div className="mt-4 rounded-lg border border-zinc-800 px-4 py-4">
              <p className="font-medium text-zinc-100">Belum ada tes WiFi</p>
              <p className="mt-1 text-sm text-zinc-400">
                Ketuk Periksa WiFi sekarang untuk mengukur kecepatan
                koneksi yang sedang dipakai.
              </p>
            </div>
          )}
        </section>

        {/* Hasil tes */}
        {hasil && (
          <section
            aria-labelledby="judul-hasil"
            className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <h2 id="judul-hasil" className="text-lg font-semibold">
              Hasil tes WiFi
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Diukur {formatTanggal(hasil.diukurPada)}
            </p>

            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">Kecepatan unduh</dt>
                <dd className="text-right font-mono text-lg font-semibold text-white">
                  {formatKecepatan(hasil.kecepatanKbps)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800 px-3 py-2">
                <p className="font-medium text-white">
                  {hasil.klasifikasi.label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                  {hasil.klasifikasi.penjelasan}
                </p>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">Latensi HTTP</dt>
                <dd className="font-mono text-base text-white">
                  {hasil.latensiMs === null
                    ? "tidak tersedia"
                    : formatLatensi(hasil.latensiMs)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">Alamat IP publik</dt>
                <dd className="font-mono text-base text-white">
                  {hasil.ip ?? "tidak tersedia"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">Jenis koneksi</dt>
                <dd className="text-base text-white">
                  {hasil.jenisKoneksi ?? "tidak tersedia"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">Nama WiFi</dt>
                <dd className="text-base text-white">
                  {manual.ssid.trim() === "" ? "tidak tersedia" : manual.ssid}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">Kekuatan sinyal</dt>
                <dd className="text-base text-white">
                  {dbmTerisi === null
                    ? "tidak tersedia"
                    : `${dbmTerisi} dBm (${labelSinyalDariDbm(dbmTerisi)})`}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">Channel</dt>
                <dd className="text-base text-white">
                  {manual.channel.trim() === "" ? "tidak tersedia" : manual.channel}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-zinc-400">DNS</dt>
                <dd className="font-mono text-base text-white">
                  {manual.dns.trim() === "" ? "tidak tersedia" : manual.dns}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Latensi HTTP adalah waktu yang dibutuhkan satu permintaan
              kecil bolak-balik ke server. Browser tidak bisa mengukur
              ping biasa, jadi yang ditampilkan adalah latensi HTTP.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void bagikanHasil()}
                className="min-h-[48px] w-full rounded-lg border border-zinc-500 bg-transparent px-4 py-3 text-base font-medium text-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white"
              >
                Bagikan hasil
              </button>
              {pesanBerbagi && (
                <p role="status" className="text-sm text-zinc-300">
                  {pesanBerbagi}
                </p>
              )}
              {masuk === true ? (
                <>
                  <button
                    type="button"
                    onClick={() => void simpanLaporan()}
                    disabled={menyimpan || sudahDisimpan}
                    className="min-h-[48px] w-full rounded-lg bg-white px-4 py-3 text-base font-semibold text-black hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-white disabled:bg-zinc-800 disabled:text-zinc-400"
                  >
                    {menyimpan
                      ? "Menyimpan…"
                      : sudahDisimpan
                        ? "Sudah tersimpan"
                        : "Simpan laporan"}
                  </button>
                  <p className="text-sm text-zinc-400">
                    Hasil tersimpan otomatis ke riwayat.
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-400">
                  Hasil tidak tersimpan karena Anda belum masuk. Masuk
                  untuk menyimpan riwayat.
                </p>
              )}
              {pesanSimpan && (
                <p role="status" className="text-sm text-zinc-300">
                  {pesanSimpan}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Tes bertahan 30 detik */}
        <section
          aria-labelledby="judul-bertahan"
          className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          <h2 id="judul-bertahan" className="text-lg font-semibold">
            Tes bertahan 30 detik
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Tes ini mengukur kecepatan selama 30 detik penuh untuk
            melihat apakah kecepatan bertahan dari awal sampai akhir,
            atau mulai cepat lalu jatuh di tengah jalan.
          </p>

          {bertahan.berjalan && (
            <p className="mt-4 font-mono text-base text-white" aria-live="off">
              Mengukur… detik ke-{bertahan.detikKe} dari{" "}
              {DURASI_TES_BERTAHAN_DETIK}
            </p>
          )}

          {bertahan.sampel.length > 0 && (
            <div className="mt-4">
              <h3 className="text-base font-medium">Kecepatan per detik</h3>
              <div className="mt-2">
                <GrafikBertahan sampel={bertahan.sampel} />
              </div>
            </div>
          )}

          {bertahan.hasil && (
            <p className="mt-4 rounded-lg border border-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-100">
              {teksVerdict(bertahan.hasil)}
            </p>
          )}

          {bertahan.galat && (
            <div className="mt-4 rounded-lg border border-red-400 bg-red-400/10 px-4 py-3">
              <p className="text-sm text-red-400">{bertahan.galat}</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void jalankanBertahan()}
              disabled={tesBerjalan || bertahan.berjalan}
              className="min-h-[48px] w-full rounded-lg border border-zinc-500 bg-transparent px-4 py-3 text-base font-medium text-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white disabled:border-zinc-800 disabled:text-zinc-400"
            >
              {bertahan.berjalan
                ? "Tes bertahan berjalan…"
                : "Tes bertahan 30 detik"}
            </button>
            {bertahan.berjalan && (
              <button
                type="button"
                onClick={batalkanTes}
                className="min-h-[48px] w-full rounded-lg border border-zinc-500 bg-transparent px-4 py-3 text-base font-medium text-zinc-100 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white"
              >
                Batalkan
              </button>
            )}
          </div>
        </section>

        {/* Rekomendasi */}
        <section
          aria-labelledby="judul-rekomendasi"
          className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          <h2 id="judul-rekomendasi" className="text-lg font-semibold">
            Saran perbaikan
          </h2>
          <div className="mt-4">
            <RekomendasiWifi masukan={masukanRekomendasi} />
          </div>
        </section>

        {/* Panduan WiFi lemot (copy.md 5) */}
        <section
          id="panduan-wifi-lemot"
          aria-labelledby="judul-panduan"
          className="mt-6 scroll-mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          <h2 id="judul-panduan" className="text-lg font-semibold">
            WiFi lemot: cara mencari penyebabnya
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
            <p>
              Sebagai patokan, kecepatan unduh yang wajar biasanya
              sekitar 1 MB/detik atau lebih. Bila hasil tes jauh di
              bawah itu, ada yang perlu diperiksa.
            </p>
            <p>
              Penyebab yang sering terjadi adalah pengaturan router
              yang masih memakai mode lama. Mode lama membatasi
              kecepatan seluruh jaringan WiFi, walau sinyal terlihat
              penuh.
            </p>
            <p>
              Coba HP lain di WiFi yang sama. Bila HP lain juga lemot,
              masalahnya ada di router atau jaringan, bukan di HP.
            </p>
            <p>
              Coba data seluler. Bila data seluler lancar, masalahnya
              ada di WiFi, bukan di HP.
            </p>
          </div>
        </section>

        {/* Input manual */}
        <section
          aria-labelledby="judul-manual"
          className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          <h2 id="judul-manual" className="text-lg font-semibold">
            Lengkapi info jaringan
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Browser tidak bisa membaca nama WiFi, kekuatan sinyal, dan
            channel secara langsung. Bila Anda mengetahuinya —
            misalnya dari halaman pengaturan router — isi di sini agar
            hasilnya lebih lengkap. Boleh dikosongkan.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="manual-ssid"
                className="block text-sm font-medium text-zinc-100"
              >
                Nama WiFi
              </label>
              <input
                id="manual-ssid"
                type="text"
                value={manual.ssid}
                maxLength={32}
                autoComplete="off"
                placeholder="Misalnya: WiFi Rumah"
                onChange={(e) =>
                  setManual((m) => ({ ...m, ssid: e.target.value }))
                }
                className="mt-1 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-3 py-2 text-base text-white placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-white"
              />
            </div>
            <div>
              <label
                htmlFor="manual-sinyal"
                className="block text-sm font-medium text-zinc-100"
              >
                Kekuatan sinyal (dBm)
              </label>
              <input
                id="manual-sinyal"
                type="text"
                inputMode="numeric"
                value={manual.sinyalDbm}
                autoComplete="off"
                placeholder="Misalnya: -65"
                aria-describedby={
                  galatManual ? "galat-manual" : undefined
                }
                aria-invalid={galatManual !== null}
                onChange={(e) =>
                  setManual((m) => ({ ...m, sinyalDbm: e.target.value }))
                }
                className="mt-1 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-3 py-2 text-base font-mono text-white placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-white"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Angka negatif; semakin dekat ke nol, semakin kuat.
                Misalnya -50 kuat, -65 sedang, -80 lemah.
              </p>
            </div>
            <div>
              <label
                htmlFor="manual-channel"
                className="block text-sm font-medium text-zinc-100"
              >
                Channel
              </label>
              <input
                id="manual-channel"
                type="text"
                inputMode="numeric"
                value={manual.channel}
                autoComplete="off"
                placeholder="Misalnya: 6"
                aria-describedby={
                  galatManual ? "galat-manual" : undefined
                }
                aria-invalid={galatManual !== null}
                onChange={(e) =>
                  setManual((m) => ({ ...m, channel: e.target.value }))
                }
                className="mt-1 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-3 py-2 text-base font-mono text-white placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-white"
              />
            </div>
            <div>
              <label
                htmlFor="manual-dns"
                className="block text-sm font-medium text-zinc-100"
              >
                DNS
              </label>
              <input
                id="manual-dns"
                type="text"
                value={manual.dns}
                maxLength={64}
                autoComplete="off"
                placeholder="Misalnya: 1.1.1.1"
                onChange={(e) =>
                  setManual((m) => ({ ...m, dns: e.target.value }))
                }
                className="mt-1 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-3 py-2 text-base font-mono text-white placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-white"
              />
            </div>
          </div>

          {galatManual && (
            <p id="galat-manual" role="alert" className="mt-3 text-sm text-red-400">
              {galatManual}
            </p>
          )}
          {pesanManual && (
            <p role="status" className="mt-3 text-sm text-zinc-300">
              {pesanManual}
            </p>
          )}

          <button
            type="button"
            onClick={simpanInfoManual}
            className="mt-4 min-h-[48px] w-full rounded-lg bg-white px-4 py-3 text-base font-semibold text-black hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-white"
          >
            Simpan info jaringan
          </button>
        </section>

        {/* Riwayat laporan (hanya bila masuk) */}
        {masuk === true && (
          <section
            aria-labelledby="judul-riwayat"
            className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <h2 id="judul-riwayat" className="text-lg font-semibold">
              Riwayat tes WiFi
            </h2>
            {riwayatMemuat && (
              <p role="status" className="mt-4 text-sm text-zinc-400">
                Mengambil data…
              </p>
            )}
            {riwayatGalat && (
              <div className="mt-4 rounded-lg border border-red-400 bg-red-400/10 px-4 py-3">
                <p className="text-sm text-red-400">{riwayatGalat}</p>
                <button
                  type="button"
                  onClick={() => void muatRiwayat()}
                  className="mt-2 min-h-[48px] rounded-lg border border-zinc-500 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  Coba lagi
                </button>
              </div>
            )}
            {!riwayatMemuat && !riwayatGalat && riwayat !== null && riwayat.length === 0 && (
              <div className="mt-4 rounded-lg border border-zinc-800 px-4 py-4">
                <p className="font-medium text-zinc-100">
                  Belum ada riwayat tes
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Hasil tes yang sudah dijalankan akan tampil di sini.
                </p>
              </div>
            )}
            {!riwayatMemuat && riwayat !== null && riwayat.length > 0 && (
              <ul className="mt-4 space-y-3">
                {riwayat.map((laporan) => {
                  const klasifikasi =
                    laporan.kecepatan_unduh_kbps === null
                      ? null
                      : klasifikasiKecepatan(laporan.kecepatan_unduh_kbps);
                  return (
                    <li
                      key={laporan.id}
                      className="rounded-lg border border-zinc-800 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-zinc-100">
                        {laporan.kecepatan_unduh_kbps === null
                          ? "Tes WiFi"
                          : `Tes WiFi — ${formatKecepatan(laporan.kecepatan_unduh_kbps)}${klasifikasi ? ` (${klasifikasi.label})` : ""}`}
                        {laporan.durasi_tes_detik === 30
                          ? " — Tes bertahan 30 detik"
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {laporan.ping_ms === null
                          ? "Latensi HTTP tidak tersedia"
                          : `Latensi HTTP ${formatLatensi(laporan.ping_ms)}`}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {labelSumber(laporan.sumber)} —{" "}
                        {formatTanggal(laporan.dibuat_pada)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <p className="mt-6 pb-4 text-center text-xs text-zinc-400">
          Dokter HP tidak menjanjikan HP jadi lebih cepat. Aplikasi ini
          membantu menemukan masalah dan menunjukkan langkah
          perbaikannya.
        </p>
      </div>
    </main>
  );
}
