import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  GalatApi,
  PESAN_GALAT_UMUM,
  PESAN_PIN_TIDAK_VALID,
  PESAN_TANPA_KONEKSI,
  panggilApi,
  validasiFormatPin,
  type InfoPengguna,
} from "../lib/pin";

// Layar atur/ubah/hapus PIN (/pengaturan/pin): atur PIN baru atau ubah PIN
// lama (POST /api/auth/pin/set), hapus PIN (POST /api/auth/pin/delete),
// validasi 4-8 digit angka. Status PIN saat ini dibaca dari
// GET /api/auth/me. Endpoint PIN boleh dipanggil saat sesi terkunci
// (keputusan koordinator K-05) — jalur pemulihan bila PIN lupa.
// Teks mengikuti docs/copy.md bagian 12 dan 13.

const PESAN_PIN_TIDAK_SAMA = "PIN yang diulang tidak sama. Periksa lagi.";

const CINCIN_FOKUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function hanyaDigit(nilai: string): string {
  return nilai.replace(/\D/g, "").slice(0, 8);
}

export default function AturPinPage() {
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [sesiHabis, setSesiHabis] = useState(false);
  const [pinDiatur, setPinDiatur] = useState<boolean | null>(null);
  const [pinBaru, setPinBaru] = useState("");
  const [pinUlang, setPinUlang] = useState("");
  const [galatPin, setGalatPin] = useState<string | null>(null);
  const [galatUlang, setGalatUlang] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const [tampilKonfirmasi, setTampilKonfirmasi] = useState(false);
  const pinBaruRef = useRef<HTMLInputElement | null>(null);
  const pinUlangRef = useRef<HTMLInputElement | null>(null);

  const periksaSesi = useCallback(async () => {
    setMemuat(true);
    setGagalMuat(false);
    setSesiHabis(false);
    setPesan(null);
    try {
      const saya = await panggilApi<InfoPengguna>("/api/auth/me");
      if (!saya) {
        setPesan("Data tidak bisa dimuat. Coba lagi.");
        setGagalMuat(true);
        setMemuat(false);
        return;
      }
      setPinDiatur(saya.pin_diatur);
      setMemuat(false);
    } catch (galat) {
      if (galat instanceof GalatApi && galat.status === 401) {
        setSesiHabis(true);
        setMemuat(false);
        return;
      }
      setPesan("Data tidak bisa dimuat. Coba lagi.");
      setGagalMuat(true);
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    document.title = "PIN aplikasi — Dokter HP";
    void periksaSesi();
  }, [periksaSesi]);

  // Pindahkan fokus ke judul setelah konten termuat (saat memuat, judul
  // belum dirender sehingga fokus di efek mount tidak menemukan apa-apa).
  useEffect(() => {
    if (!memuat && !sesiHabis && !gagalMuat) {
      document.getElementById("judul-atur-pin")?.focus();
    }
  }, [memuat, sesiHabis, gagalMuat]);

  const simpanPin = async (event: FormEvent) => {
    event.preventDefault();
    setGalatPin(null);
    setGalatUlang(null);
    setPesan(null);
    setSukses(null);
    if (!validasiFormatPin(pinBaru)) {
      setGalatPin(PESAN_PIN_TIDAK_VALID);
      pinBaruRef.current?.focus();
      return;
    }
    if (pinBaru !== pinUlang) {
      setGalatUlang(PESAN_PIN_TIDAK_SAMA);
      pinUlangRef.current?.focus();
      return;
    }
    setMenyimpan(true);
    try {
      await panggilApi<{ pin_diatur: boolean }>("/api/auth/pin/set", {
        method: "POST",
        body: { pin: pinBaru },
      });
      setSukses(pinDiatur ? "PIN berhasil diubah." : "PIN berhasil diatur.");
      setPinDiatur(true);
      setPinBaru("");
      setPinUlang("");
    } catch (galat) {
      if (galat instanceof GalatApi) {
        if (galat.status === 401) {
          setSesiHabis(true);
          return;
        }
        if (galat.kode === "VALIDATION_ERROR" || galat.kode === "PIN_TIDAK_VALID") {
          setGalatPin(PESAN_PIN_TIDAK_VALID);
          pinBaruRef.current?.focus();
          return;
        }
        setPesan(galat.message || PESAN_GALAT_UMUM);
        return;
      }
      setPesan(PESAN_TANPA_KONEKSI);
    } finally {
      setMenyimpan(false);
    }
  };

  const hapusPin = async () => {
    setPesan(null);
    setSukses(null);
    setMenghapus(true);
    try {
      await panggilApi<{ pin_diatur: boolean }>("/api/auth/pin/delete", {
        method: "POST",
      });
      setSukses("PIN berhasil dihapus.");
      setPinDiatur(false);
      setTampilKonfirmasi(false);
    } catch (galat) {
      if (galat instanceof GalatApi) {
        if (galat.status === 401) {
          setSesiHabis(true);
          return;
        }
        if (galat.kode === "CONFLICT") {
          // PIN sudah tidak ada: keadaan akhir sama dengan terhapus.
          setSukses("PIN berhasil dihapus.");
          setPinDiatur(false);
          setTampilKonfirmasi(false);
          return;
        }
        setPesan(galat.message || PESAN_GALAT_UMUM);
        return;
      }
      setPesan(PESAN_TANPA_KONEKSI);
    } finally {
      setMenghapus(false);
    }
  };

  if (memuat) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
        <div role="status" className="text-center text-base text-zinc-400">
          Memuat…
        </div>
      </main>
    );
  }

  if (sesiHabis) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          PIN aplikasi
        </h1>
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-400/45 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-400"
        >
          Sesi sudah berakhir. Masuk lagi untuk lanjut.
        </div>
        <Link
          to="/masuk"
          className={`mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-base font-semibold text-black ${CINCIN_FOKUS}`}
        >
          Masuk
        </Link>
      </main>
    );
  }

  if (gagalMuat) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          PIN aplikasi
        </h1>
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-400/45 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-400"
        >
          {pesan ?? "Data tidak bisa dimuat. Coba lagi."}
        </div>
        <button
          type="button"
          onClick={() => void periksaSesi()}
          className={`mt-6 min-h-[48px] w-full rounded-xl bg-white px-4 py-3 text-base font-semibold text-black ${CINCIN_FOKUS}`}
        >
          Coba lagi
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
      <h1
        id="judul-atur-pin"
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-white"
      >
        PIN aplikasi
      </h1>
      <p className="mt-2 text-base leading-relaxed text-zinc-400">
        PIN melindungi riwayat pemeriksaan di aplikasi ini. PIN diminta setiap
        kali sesi baru dimulai.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        {pinDiatur
          ? "PIN sudah diatur."
          : "PIN belum diatur. Aplikasi langsung terbuka tanpa PIN."}
      </p>

      {sukses && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-emerald-400/45 bg-emerald-400/10 px-4 py-3 text-sm leading-relaxed text-emerald-400"
        >
          {sukses}
        </div>
      )}
      {pesan && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-400/45 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-400"
        >
          {pesan}
        </div>
      )}

      <form className="mt-6" onSubmit={(event) => void simpanPin(event)} noValidate>
        <div>
          <label
            htmlFor="pin-baru"
            className="block text-sm font-medium text-zinc-100"
          >
            PIN baru (4–8 angka)
          </label>
          <input
            id="pin-baru"
            ref={pinBaruRef}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            maxLength={8}
            value={pinBaru}
            onChange={(event) => {
              setPinBaru(hanyaDigit(event.target.value));
              setGalatPin(null);
            }}
            aria-invalid={galatPin !== null}
            aria-describedby={galatPin ? "galat-pin-baru" : undefined}
            className={`mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-4 py-3 text-lg tracking-widest text-white placeholder-zinc-400 disabled:opacity-50 ${CINCIN_FOKUS}`}
          />
          {galatPin && (
            <p id="galat-pin-baru" role="alert" className="mt-2 text-sm text-red-400">
              {galatPin}
            </p>
          )}
        </div>

        <div className="mt-5">
          <label
            htmlFor="pin-ulang"
            className="block text-sm font-medium text-zinc-100"
          >
            Ulangi PIN baru
          </label>
          <input
            id="pin-ulang"
            ref={pinUlangRef}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            maxLength={8}
            value={pinUlang}
            onChange={(event) => {
              setPinUlang(hanyaDigit(event.target.value));
              setGalatUlang(null);
            }}
            aria-invalid={galatUlang !== null}
            aria-describedby={galatUlang ? "galat-pin-ulang" : undefined}
            className={`mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-4 py-3 text-lg tracking-widest text-white placeholder-zinc-400 disabled:opacity-50 ${CINCIN_FOKUS}`}
          />
          {galatUlang && (
            <p id="galat-pin-ulang" role="alert" className="mt-2 text-sm text-red-400">
              {galatUlang}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={menyimpan}
          className={`mt-6 min-h-[48px] w-full rounded-xl bg-white px-4 py-3 text-base font-semibold text-black disabled:opacity-50 ${CINCIN_FOKUS}`}
        >
          {menyimpan ? "Menyimpan…" : pinDiatur ? "Ubah PIN" : "Atur PIN"}
        </button>
      </form>

      {pinDiatur && (
        <section
          aria-labelledby="judul-hapus-pin"
          className="mt-10 border-t border-zinc-800 pt-6"
        >
          <h2 id="judul-hapus-pin" className="text-base font-semibold text-white">
            Hapus PIN
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            PIN akan dihapus. Aplikasi tidak lagi meminta PIN saat dibuka.
          </p>
          {!tampilKonfirmasi ? (
            <button
              type="button"
              onClick={() => setTampilKonfirmasi(true)}
              className={`mt-4 min-h-[48px] rounded-xl border border-zinc-500 bg-transparent px-4 py-3 text-sm font-semibold text-white ${CINCIN_FOKUS}`}
            >
              Hapus PIN
            </button>
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void hapusPin()}
                disabled={menghapus}
                className={`min-h-[48px] flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${CINCIN_FOKUS}`}
              >
                {menghapus ? "Menghapus…" : "Ya, hapus"}
              </button>
              <button
                type="button"
                onClick={() => setTampilKonfirmasi(false)}
                disabled={menghapus}
                className={`min-h-[48px] flex-1 rounded-xl border border-zinc-500 bg-transparent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${CINCIN_FOKUS}`}
              >
                Batal
              </button>
            </div>
          )}
        </section>
      )}

      <p className="mt-10 text-center">
        <Link
          to="/pengaturan"
          className={`inline-flex min-h-[48px] items-center text-sm text-zinc-100 underline underline-offset-4 ${CINCIN_FOKUS}`}
        >
          Kembali ke Pengaturan
        </Link>
      </p>
    </main>
  );
}
