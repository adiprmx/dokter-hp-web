import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  PESAN_GALAT_UMUM,
  PESAN_PIN_LEMAH,
  PESAN_PIN_TIDAK_VALID,
  PESAN_TANPA_KONEKSI,
  SARAN_PIN_KUAT,
  pesanValidasiPinBaru,
  validasiFormatPin,
  type InfoPengguna,
} from "../lib/pin";
import { ApiError, panggilApi } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";
import { tokenStatus } from "../lib/status-warna";

// Layar atur/ubah/hapus PIN (/pengaturan/pin): atur PIN baru atau ubah PIN
// lama (POST /api/auth/pin/set), hapus PIN (POST /api/auth/pin/delete),
// validasi 4-8 digit angka + tolak PIN lemah (R-11). Status PIN saat ini
// dibaca dari GET /api/auth/me. Endpoint PIN boleh dipanggil saat sesi
// terkunci (keputusan koordinator K-05) — jalur pemulihan bila PIN lupa.
// Ubah/hapus PIN dari sesi terkunci wajib PIN lama atau login Google
// segar (K-70): bila server menjawab PIN_LAMA_DIPERLUKAN, kolom PIN lama
// dimunculkan. /pin/set TIDAK PERNAH membuka sesi — sesudah berhasil,
// sesi yang terkunci tetap terkunci dan pengguna diarahkan ke /kunci.
// Teks mengikuti docs/copy.md bagian 12 dan 13.
//
// Redesign v2.0 (Tim Auth, Wave 2): logika TIDAK BERUBAH. Status PIN
// tampil sebagai StatusBadge (hijau bila sudah diatur, biru bila belum
// — belum diatur bukan galat, jadi bukan merah); pesan sukses memakai
// Card status sukses dan pesan galat memakai Card status galat;
// penolakan PIN lemah tampil jelas lewat tiga penanda sekaligus:
// bingkai galat pada kolom PIN baru, pesan galat merah di bawah kolom
// (role alert, fokus dipindah ke kolom — perilaku lama dipertahankan),
// dan saran PIN kuat yang sudah ada di pesan; formulir hidup di Card
// permukaan agar tugasnya jelas terpisah dari bagian hapus PIN;
// keadaan muat memakai kerangka yang meniru tata letak akhir + teks
// "Memuat…" yang terlihat. Warna status HANYA lewat helper
// status-warna + Card/StatusBadge (spec §4).

const PESAN_PIN_TIDAK_SAMA = "PIN yang diulang tidak sama. Periksa lagi.";
const PESAN_PIN_LAMA_DIPERLUKAN =
  "Masukkan PIN lama untuk mengubah PIN.";

const CINCIN_FOKUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

// Bingkai galat kolom memakai nilai PENUH token galat (teks), bukan
// bingkai 45%: garis 1px pada alpha 45% hanya 2,26:1 terhadap latar
// gelap — di bawah ambang 3:1 non-teks WCAG 1.4.11 untuk batas kolom;
// nilai penuh 6,40:1. (Bingkai Card status tetap memakai token
// bingkai — itu komponen bersama, di luar cakupan halaman ini.)
const BINGKAI_GALAT_KOLOM = tokenStatus("galat").teks;

function hanyaDigit(nilai: string): string {
  return nilai.replace(/\D/g, "").slice(0, 8);
}

export default function AturPinPage() {
  const [memuat, setMemuat] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [sesiHabis, setSesiHabis] = useState(false);
  const [pinDiatur, setPinDiatur] = useState<boolean | null>(null);
  const [sesiTerkunci, setSesiTerkunci] = useState(false);
  const [pinBaru, setPinBaru] = useState("");
  const [pinUlang, setPinUlang] = useState("");
  const [pinLama, setPinLama] = useState("");
  const [perluPinLama, setPerluPinLama] = useState(false);
  const [aksiTertunda, setAksiTertunda] = useState<"set" | "hapus" | null>(null);
  const [galatPin, setGalatPin] = useState<string | null>(null);
  const [galatUlang, setGalatUlang] = useState<string | null>(null);
  const [galatPinLama, setGalatPinLama] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const [tampilKonfirmasi, setTampilKonfirmasi] = useState(false);
  const pinBaruRef = useRef<HTMLInputElement | null>(null);
  const pinUlangRef = useRef<HTMLInputElement | null>(null);
  const pinLamaRef = useRef<HTMLInputElement | null>(null);

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
      setSesiTerkunci(saya.sesi_terkunci);
      setMemuat(false);
    } catch (galat) {
      if (galat instanceof ApiError && galat.status === 401) {
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
    setGalatPinLama(null);
    setPesan(null);
    setSukses(null);
    const galatBaru = pesanValidasiPinBaru(pinBaru);
    if (galatBaru) {
      setGalatPin(galatBaru === PESAN_PIN_LEMAH ? `${galatBaru} ${SARAN_PIN_KUAT}` : galatBaru);
      pinBaruRef.current?.focus();
      return;
    }
    if (pinBaru !== pinUlang) {
      setGalatUlang(PESAN_PIN_TIDAK_SAMA);
      pinUlangRef.current?.focus();
      return;
    }
    if (perluPinLama && !validasiFormatPin(pinLama)) {
      setGalatPinLama(PESAN_PIN_TIDAK_VALID);
      pinLamaRef.current?.focus();
      return;
    }
    setMenyimpan(true);
    try {
      const hasil = await panggilApi<{ pin_diatur: boolean; sesi_terkunci: boolean }>(
        "/api/auth/pin/set",
        {
          method: "POST",
          body: pinLama ? { pin: pinBaru, pin_lama: pinLama } : { pin: pinBaru },
        },
      );
      setSukses(pinDiatur ? "PIN berhasil diubah." : "PIN berhasil diatur.");
      setPinDiatur(true);
      setSesiTerkunci(hasil?.sesi_terkunci ?? false);
      setPinBaru("");
      setPinUlang("");
      setPinLama("");
      setPerluPinLama(false);
      setAksiTertunda(null);
    } catch (galat) {
      if (galat instanceof ApiError) {
        if (galat.status === 401) {
          if (galat.code === "PIN_SALAH") {
            setGalatPinLama("PIN lama salah, coba lagi.");
            pinLamaRef.current?.focus();
            return;
          }
          setSesiHabis(true);
          return;
        }
        if (galat.code === "PIN_LAMA_DIPERLUKAN") {
          setPerluPinLama(true);
          setAksiTertunda("set");
          setPesan(PESAN_PIN_LAMA_DIPERLUKAN);
          // Fokus dipindah setelah kolom PIN lama dirender.
          setTimeout(() => pinLamaRef.current?.focus(), 0);
          return;
        }
        if (galat.code === "VALIDATION_ERROR" || galat.code === "PIN_TIDAK_VALID") {
          if (galat.details?.["alasan"] === "PIN_LEMAH") {
            setGalatPin(`${PESAN_PIN_LEMAH} ${SARAN_PIN_KUAT}`);
          } else {
            setGalatPin(PESAN_PIN_TIDAK_VALID);
          }
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
    setGalatPinLama(null);
    if (perluPinLama && !validasiFormatPin(pinLama)) {
      setGalatPinLama(PESAN_PIN_TIDAK_VALID);
      pinLamaRef.current?.focus();
      return;
    }
    setMenghapus(true);
    try {
      await panggilApi<{ pin_diatur: boolean }>("/api/auth/pin/delete", {
        method: "POST",
        body: pinLama ? { pin_lama: pinLama } : {},
      });
      setSukses("PIN berhasil dihapus.");
      setPinDiatur(false);
      setSesiTerkunci(false);
      setTampilKonfirmasi(false);
      setPinLama("");
      setPerluPinLama(false);
      setAksiTertunda(null);
    } catch (galat) {
      if (galat instanceof ApiError) {
        if (galat.status === 401) {
          if (galat.code === "PIN_SALAH") {
            setGalatPinLama("PIN lama salah, coba lagi.");
            pinLamaRef.current?.focus();
            return;
          }
          setSesiHabis(true);
          return;
        }
        if (galat.code === "PIN_LAMA_DIPERLUKAN") {
          setPerluPinLama(true);
          setAksiTertunda("hapus");
          setPesan(PESAN_PIN_LAMA_DIPERLUKAN);
          setTimeout(() => pinLamaRef.current?.focus(), 0);
          return;
        }
        if (galat.code === "CONFLICT") {
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
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
        <p role="status" className="text-base text-zinc-400">
          Memuat…
        </p>
        <div aria-hidden="true" className="mt-6">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-[var(--color-surface-hover)]" />
          <div className="mt-6 h-7 w-36 animate-pulse rounded-full bg-[var(--color-surface-hover)]" />
          <div className="mt-6 space-y-5">
            <div className="h-12 animate-pulse rounded-lg bg-[var(--color-surface-hover)]" />
            <div className="h-12 animate-pulse rounded-lg bg-[var(--color-surface-hover)]" />
            <div className="h-12 animate-pulse rounded-lg bg-[var(--color-surface-hover)]" />
          </div>
        </div>
      </div>
    );
  }

  if (sesiHabis) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          PIN aplikasi
        </h1>
        <Card
          status="galat"
          role="alert"
          className="mt-6"
          style={{ color: tokenStatus("galat").teks }}
        >
          <p className="text-sm leading-relaxed">
            Sesi sudah berakhir. Masuk lagi untuk lanjut.
          </p>
        </Card>
        <Link
          to="/masuk"
          className={`mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-base font-semibold text-black ${CINCIN_FOKUS}`}
        >
          Masuk
        </Link>
      </div>
    );
  }

  if (gagalMuat) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          PIN aplikasi
        </h1>
        <Card
          status="galat"
          role="alert"
          className="mt-6"
          style={{ color: tokenStatus("galat").teks }}
        >
          <p className="text-sm leading-relaxed">
            {pesan ?? "Data tidak bisa dimuat. Coba lagi."}
          </p>
        </Card>
        <Button
          onClick={() => void periksaSesi()}
          fullWidth
          className={`mt-6 ${CINCIN_FOKUS}`}
        >
          Coba lagi
        </Button>
      </div>
    );
  }

  const kolomPinLama = (
    <div>
      <label
        htmlFor="pin-lama"
        className="block text-sm font-medium text-zinc-100"
      >
        PIN lama
      </label>
      <input
        id="pin-lama"
        ref={pinLamaRef}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        maxLength={8}
        value={pinLama}
        onChange={(event) => {
          setPinLama(hanyaDigit(event.target.value));
          setGalatPinLama(null);
        }}
        aria-invalid={galatPinLama !== null}
        aria-describedby={galatPinLama ? "galat-pin-lama" : undefined}
        style={
          galatPinLama
            ? { borderColor: BINGKAI_GALAT_KOLOM }
            : undefined
        }
        className={`mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-4 py-3 text-lg tracking-widest text-white placeholder-zinc-400 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-disabled)] disabled:placeholder-zinc-500 ${CINCIN_FOKUS}`}
      />
      {galatPinLama && (
        <p
          id="galat-pin-lama"
          role="alert"
          className="mt-2 text-sm"
          style={{ color: tokenStatus("galat").teks }}
        >
          {galatPinLama}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-black px-6 py-12 text-zinc-100">
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
      <div className="mt-4">
        {pinDiatur ? (
          <StatusBadge status="sukses">PIN sudah diatur</StatusBadge>
        ) : (
          <StatusBadge status="info">PIN belum diatur</StatusBadge>
        )}
        {!pinDiatur && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Aplikasi langsung terbuka tanpa PIN.
          </p>
        )}
      </div>

      {sukses && (
        <Card
          status="sukses"
          role="status"
          className="mt-6"
          style={{ color: tokenStatus("sukses").teks }}
        >
          <p className="text-sm leading-relaxed">{sukses}</p>
          {sesiTerkunci && (
            <p className="mt-2 text-sm leading-relaxed">
              Sesi masih terkunci.{" "}
              <Link
                to="/kunci"
                className={`font-semibold underline underline-offset-4 ${CINCIN_FOKUS}`}
              >
                Buka dengan PIN baru
              </Link>
            </p>
          )}
        </Card>
      )}
      {pesan && (
        <Card
          status="galat"
          role="alert"
          className="mt-6"
          style={{ color: tokenStatus("galat").teks }}
        >
          <p className="text-sm leading-relaxed">{pesan}</p>
        </Card>
      )}

      <Card padding="lg" className="mt-6">
        <form onSubmit={(event) => void simpanPin(event)} noValidate>
          {perluPinLama && aksiTertunda === "set" && (
            <div className="mb-5">{kolomPinLama}</div>
          )}
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
              style={
                galatPin
                  ? { borderColor: BINGKAI_GALAT_KOLOM }
                  : undefined
              }
              className={`mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-4 py-3 text-lg tracking-widest text-white placeholder-zinc-400 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-disabled)] disabled:placeholder-zinc-500 ${CINCIN_FOKUS}`}
            />
            {galatPin && (
              <p
                id="galat-pin-baru"
                role="alert"
                className="mt-2 text-sm leading-relaxed"
                style={{ color: tokenStatus("galat").teks }}
              >
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
              style={
                galatUlang
                  ? { borderColor: BINGKAI_GALAT_KOLOM }
                  : undefined
              }
              className={`mt-2 min-h-[48px] w-full rounded-lg border border-zinc-500 bg-zinc-900 px-4 py-3 text-lg tracking-widest text-white placeholder-zinc-400 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-disabled)] disabled:placeholder-zinc-500 ${CINCIN_FOKUS}`}
            />
            {galatUlang && (
              <p
                id="galat-pin-ulang"
                role="alert"
                className="mt-2 text-sm leading-relaxed"
                style={{ color: tokenStatus("galat").teks }}
              >
                {galatUlang}
              </p>
            )}
          </div>

          <Button
            type="submit"
            loading={menyimpan}
            fullWidth
            className={`mt-6 ${CINCIN_FOKUS}`}
          >
            {pinDiatur ? "Ubah PIN" : "Atur PIN"}
          </Button>
        </form>
      </Card>

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
          {perluPinLama && aksiTertunda === "hapus" && (
            <div className="mt-4">{kolomPinLama}</div>
          )}
          {!tampilKonfirmasi ? (
            <Button
              variant="secondary"
              onClick={() => setTampilKonfirmasi(true)}
              className={`mt-4 ${CINCIN_FOKUS}`}
            >
              Hapus PIN
            </Button>
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="danger"
                onClick={() => void hapusPin()}
                loading={menghapus}
                className={`flex-1 ${CINCIN_FOKUS}`}
              >
                Ya, hapus
              </Button>
              <Button
                variant="secondary"
                onClick={() => setTampilKonfirmasi(false)}
                disabled={menghapus}
                className={`flex-1 ${CINCIN_FOKUS}`}
              >
                Batal
              </Button>
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
    </div>
  );
}
