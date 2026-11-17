import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GalatApi,
  PESAN_GALAT_UMUM,
  PESAN_PIN_TIDAK_VALID,
  PESAN_TANPA_KONEKSI,
  buatUrlMasukGoogle,
  panggilApi,
  parseResponsKunciPin,
  parseSisaPercobaan,
  validasiFormatPin,
  type InfoPengguna,
} from "../lib/pin";

// Layar kunci PIN (/kunci): keypad PIN 4-8 digit, verifikasi lewat
// POST /api/auth/pin/verify, kunci 30 detik + hitung mundur setelah
// 5x salah (kode PIN_TERKUNCI), dan jalur lupa PIN (masuk ulang Google
// lalu atur PIN baru dari Pengaturan).
//
// Aksesibilitas (docs/a11y.md 6.2): setiap kotak digit adalah satu input
// dengan label "Digit ke-N dari 8"; hitung mundur diumumkan lewat wilayah
// live saat kunci dimulai dan berakhir, bukan setiap detik (angka yang
// berubah tiap detik ditandai aria-hidden).
// Teks mengikuti docs/copy.md bagian 3 dan 13.

const JUMLAH_KOTAK = 8;

const CINCIN_FOKUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function kotakKosong(): string[] {
  return Array.from({ length: JUMLAH_KOTAK }, () => "");
}

export default function KunciPinPage() {
  const navigate = useNavigate();
  const [digit, setDigit] = useState<string[]>(kotakKosong);
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [sesiHabis, setSesiHabis] = useState(false);
  const [memeriksa, setMemeriksa] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [kunciSampai, setKunciSampai] = useState<number | null>(null);
  const [sisaDetik, setSisaDetik] = useState(0);
  const [pengumuman, setPengumuman] = useState("");
  const [tampilLupaPin, setTampilLupaPin] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const pin = digit.join("");
  const terkunci = kunciSampai !== null;
  const bisaKirim =
    pin.length >= 4 && !terkunci && !memeriksa && !memuat && !gagalMuat;

  // Memeriksa status sesi + PIN: layar kunci hanya tampil bila PIN sudah
  // diatur dan sesi masih terkunci. Bila tidak, langsung ke dashboard.
  const periksaSesi = useCallback(async () => {
    setMemuat(true);
    setGagalMuat(false);
    setSesiHabis(false);
    setPesan(null);
    try {
      const saya = await panggilApi<InfoPengguna>("/api/auth/me");
      if (!saya || !saya.pin_diatur || !saya.sesi_terkunci) {
        navigate("/dashboard", { replace: true });
        return;
      }
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
  }, [navigate]);

  useEffect(() => {
    document.title = "Masukkan PIN — Dokter HP";
    void periksaSesi();
  }, [periksaSesi]);

  useEffect(() => {
    if (!memuat && !sesiHabis && !gagalMuat && !terkunci) {
      inputRefs.current[0]?.focus();
    }
  }, [memuat, sesiHabis, gagalMuat, terkunci]);

  // Hitung mundur kunci: angka tampil diperbarui tiap detik (aria-hidden),
  // pengumuman wilayah live hanya saat kunci berakhir.
  useEffect(() => {
    if (kunciSampai === null) return;
    const id = window.setInterval(() => {
      const sisa = Math.ceil((kunciSampai - Date.now()) / 1000);
      if (sisa <= 0) {
        window.clearInterval(id);
        setKunciSampai(null);
        setSisaDetik(0);
        setPesan(null);
        setPengumuman("Kunci sudah dibuka. Silakan masukkan PIN lagi.");
        setDigit(kotakKosong());
        inputRefs.current[0]?.focus();
      } else {
        setSisaDetik(sisa);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [kunciSampai]);

  const fokusKotak = (indeks: number) => {
    inputRefs.current[indeks]?.focus();
  };

  const ubahDigit = (indeks: number, nilai: string) => {
    if (nilai === "") {
      // Pengguna menghapus isi kotak.
      setDigit((sebelum) => {
        const baru = [...sebelum];
        baru[indeks] = "";
        return baru;
      });
      return;
    }
    const angka = nilai.replace(/\D/g, "").slice(-1);
    if (angka === "") return; // Bukan angka: abaikan, kotak tidak berubah.
    setDigit((sebelum) => {
      const baru = [...sebelum];
      baru[indeks] = angka;
      return baru;
    });
    if (indeks < JUMLAH_KOTAK - 1) fokusKotak(indeks + 1);
  };

  const tombolKotak = (
    indeks: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && digit[indeks] === "" && indeks > 0) {
      event.preventDefault();
      setDigit((sebelum) => {
        const baru = [...sebelum];
        baru[indeks - 1] = "";
        return baru;
      });
      fokusKotak(indeks - 1);
    } else if (event.key === "ArrowLeft" && indeks > 0) {
      event.preventDefault();
      fokusKotak(indeks - 1);
    } else if (event.key === "ArrowRight" && indeks < JUMLAH_KOTAK - 1) {
      event.preventDefault();
      fokusKotak(indeks + 1);
    }
  };

  const tempelDigit = (
    indeks: number,
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    event.preventDefault();
    const angka = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, JUMLAH_KOTAK - indeks);
    if (angka === "") return;
    setDigit((sebelum) => {
      const baru = [...sebelum];
      for (let i = 0; i < angka.length; i += 1) {
        baru[indeks + i] = angka[i];
      }
      return baru;
    });
    fokusKotak(Math.min(indeks + angka.length, JUMLAH_KOTAK - 1));
  };

  const tekanAngka = (angka: string) => {
    const kosong = digit.findIndex((d) => d === "");
    if (kosong === -1) return;
    setDigit((sebelum) => {
      const baru = [...sebelum];
      baru[kosong] = angka;
      return baru;
    });
    fokusKotak(Math.min(kosong + 1, JUMLAH_KOTAK - 1));
  };

  const hapusDigitTerakhir = () => {
    let terakhir = -1;
    for (let i = digit.length - 1; i >= 0; i -= 1) {
      if (digit[i] !== "") {
        terakhir = i;
        break;
      }
    }
    if (terakhir === -1) return;
    setDigit((sebelum) => {
      const baru = [...sebelum];
      baru[terakhir] = "";
      return baru;
    });
    fokusKotak(terakhir);
  };

  const kirimPin = async () => {
    if (!bisaKirim) return;
    if (!validasiFormatPin(pin)) {
      setPesan(PESAN_PIN_TIDAK_VALID);
      return;
    }
    setMemeriksa(true);
    setPesan(null);
    try {
      await panggilApi<{ valid: boolean }>("/api/auth/pin/verify", {
        method: "POST",
        body: { pin },
      });
      navigate("/dashboard", { replace: true });
    } catch (galat) {
      if (galat instanceof GalatApi) {
        const kunci = parseResponsKunciPin(galat.badan);
        if (kunci) {
          setSisaDetik(kunci.sisaDetik);
          setKunciSampai(Date.now() + kunci.sisaDetik * 1000);
          setPesan(
            "Terlalu banyak percobaan salah. Tunggu 30 detik sebelum mencoba lagi.",
          );
          setDigit(kotakKosong());
          setMemeriksa(false);
          return;
        }
        if (galat.kode === "PIN_SALAH") {
          const sisa = parseSisaPercobaan(galat.badan);
          setPesan(
            sisa !== null
              ? `PIN salah. ${sisa} percobaan lagi sebelum terkunci sementara.`
              : "PIN salah. Coba lagi.",
          );
          setDigit(kotakKosong());
          fokusKotak(0);
          setMemeriksa(false);
          return;
        }
        if (galat.kode === "PIN_BELUM_DIATUR" || galat.kode === "CONFLICT") {
          // PIN belum diatur: tidak ada yang perlu dibuka.
          navigate("/dashboard", { replace: true });
          return;
        }
        if (galat.status === 401) {
          setSesiHabis(true);
          setMemeriksa(false);
          return;
        }
        setPesan(galat.message || PESAN_GALAT_UMUM);
        setMemeriksa(false);
        return;
      }
      setPesan(PESAN_TANPA_KONEKSI);
      setMemeriksa(false);
    }
  };

  if (memuat) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-4 py-12 text-zinc-100">
        <div role="status" className="text-center text-base text-zinc-400">
          Memuat…
        </div>
      </main>
    );
  }

  if (sesiHabis) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-4 py-12 text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Masukkan PIN
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
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-4 py-12 text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Masukkan PIN
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-black px-4 py-12 text-zinc-100">
      <h1
        id="judul-kunci"
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-white"
      >
        Masukkan PIN
      </h1>
      <p className="mt-2 text-base leading-relaxed text-zinc-400">
        PIN melindungi riwayat pemeriksaan di aplikasi ini.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        PIN adalah kode 4 sampai 8 angka yang hanya Anda ketahui. PIN dipakai
        untuk membuka aplikasi ini setiap kali sesi baru dimulai. PIN tidak
        tersimpan sebagai angka asli — yang disimpan hanya bentuk acaknya di
        server, jadi tidak ada yang bisa melihat PIN Anda, termasuk kami.
      </p>

      {pesan && (
        <div
          id="pesan-pin"
          role="alert"
          className="mt-6 rounded-xl border border-red-400/45 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-400"
        >
          {pesan}
          {terkunci && (
            <span aria-hidden="true" className="mt-1 block">
              Coba lagi dalam {sisaDetik} detik.
            </span>
          )}
        </div>
      )}

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void kirimPin();
        }}
      >
        <fieldset>
          <legend className="text-sm font-medium text-zinc-100">PIN</legend>
          <div className="mt-3 flex gap-2">
            {digit.map((nilai, indeks) => (
              <input
                key={indeks}
                ref={(el) => {
                  inputRefs.current[indeks] = el;
                }}
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                maxLength={1}
                value={nilai}
                disabled={terkunci || memeriksa}
                aria-label={`Digit ke-${indeks + 1} dari ${JUMLAH_KOTAK}`}
                aria-invalid={pesan !== null}
                aria-describedby={pesan ? "pesan-pin" : undefined}
                onChange={(event) => ubahDigit(indeks, event.target.value)}
                onKeyDown={(event) => tombolKotak(indeks, event)}
                onPaste={(event) => tempelDigit(indeks, event)}
                className={`min-h-[48px] min-w-0 flex-1 rounded-lg border border-zinc-500 bg-zinc-900 text-center text-xl font-semibold text-white disabled:opacity-50 ${CINCIN_FOKUS}`}
              />
            ))}
          </div>
        </fieldset>

        <div
          className="mt-6 grid grid-cols-3 gap-2"
          role="group"
          aria-label="Keypad angka"
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((angka) => (
            <button
              key={angka}
              type="button"
              disabled={terkunci || memeriksa}
              onClick={() => tekanAngka(angka)}
              aria-label={`Angka ${angka}`}
              className={`min-h-[56px] rounded-xl border border-zinc-500 bg-zinc-900 text-xl font-semibold text-white active:bg-zinc-800 disabled:opacity-50 ${CINCIN_FOKUS}`}
            >
              {angka}
            </button>
          ))}
          <span aria-hidden="true" />
          <button
            type="button"
            disabled={terkunci || memeriksa}
            onClick={() => tekanAngka("0")}
            aria-label="Angka 0"
            className={`min-h-[56px] rounded-xl border border-zinc-500 bg-zinc-900 text-xl font-semibold text-white active:bg-zinc-800 disabled:opacity-50 ${CINCIN_FOKUS}`}
          >
            0
          </button>
          <button
            type="button"
            disabled={terkunci || memeriksa}
            onClick={hapusDigitTerakhir}
            aria-label="Hapus digit terakhir"
            className={`min-h-[56px] rounded-xl border border-zinc-500 bg-zinc-900 text-base font-semibold text-white active:bg-zinc-800 disabled:opacity-50 ${CINCIN_FOKUS}`}
          >
            Hapus
          </button>
        </div>

        <button
          type="submit"
          disabled={!bisaKirim}
          className={`mt-6 min-h-[48px] w-full rounded-xl bg-white px-4 py-3 text-base font-semibold text-black disabled:opacity-50 ${CINCIN_FOKUS}`}
        >
          {memeriksa ? "Memeriksa…" : "Buka"}
        </button>
      </form>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setTampilLupaPin((tampil) => !tampil)}
          aria-expanded={tampilLupaPin}
          aria-controls="panel-lupa-pin"
          className={`min-h-[48px] text-sm text-zinc-100 underline underline-offset-4 ${CINCIN_FOKUS}`}
        >
          Lupa PIN?
        </button>
        {tampilLupaPin && (
          <div
            id="panel-lupa-pin"
            className="mt-3 rounded-xl border border-zinc-500 bg-zinc-900 px-4 py-4"
          >
            <h2 className="text-base font-semibold text-white">Lupa PIN</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              PIN tidak bisa dilihat kembali karena yang tersimpan hanya bentuk
              acaknya. Untuk membuka aplikasi, masuk ulang dengan Google, lalu
              atur PIN baru dari Pengaturan. Riwayat Anda tetap aman.
            </p>
            <a
              href={buatUrlMasukGoogle("/pengaturan/pin")}
              className={`mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black ${CINCIN_FOKUS}`}
            >
              Masuk ulang dengan Google
            </a>
          </div>
        )}
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {pengumuman || (memeriksa ? "Memeriksa PIN…" : "")}
      </div>
    </main>
  );
}
