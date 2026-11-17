// apps/api/src/auth/routes.ts
// Router Hono untuk endpoint autentikasi Dokter HP Web App.
// Kontrak endpoint mengikuti docs/api-contracts.md bagian 1-2
// (kanonis): kode galat, bentuk respons, dan tujuan redirect.
//
// Router ini mendefinisikan jalur RELATIF dan dipasang tim
// integrasi di "/api/auth" (lihat catatan integrasi di bawah),
// sehingga jalur lengkapnya menjadi:
//   GET  /api/auth/google            -> mulai masuk Google
//   GET  /api/auth/status            -> status ketersediaan login Google (K-89, endpoint #31)
//   GET  /api/auth/google/callback   -> callback Google (buat sesi)
//   POST /api/auth/logout            -> keluar (hapus sesi)
//   GET  /api/auth/me                -> profil pengguna saat ini
//   POST /api/auth/pin/set           -> atur/ubah PIN
//   POST /api/auth/pin/verify        -> verifikasi PIN (buka sesi)
//   POST /api/auth/pin/delete        -> hapus PIN (nama kontrak)
//   POST /api/auth/pin/hapus         -> alias /pin/delete
//
// Integrasi (tim integrasi, di src/routes/api.ts):
//   import { buatRouterAuth } from "../auth/routes";
//   apiRouter.route("/auth", buatRouterAuth());
//   ...dan HAPUS baris stub apiRouter.all("/auth/*", ...).
// Selain itu tambahkan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// GOOGLE_REDIRECT_URI, dan FRONTEND_URL ke src/env.d.ts dan ke
// Bindings di src/index.ts. Secret diatur lewat
// `wrangler secret put` — tidak pernah di wrangler.toml / repo.
//
// Alur masuk Google memakai state + PKCE (S256). State,
// code_verifier, dan tujuan redirect disimpan di cookie HttpOnly
// berumur 10 menit (Path=/api/auth, sesuai mount router ini) dan
// dicocokkan/dibaca saat callback; ketiganya dihapus di callback
// baik sukses maupun gagal. Redirect setelah masuk selalu ke
// FRONTEND_URL + path relatif yang divalidasi (bawaan /dashboard)
// agar tidak bisa dibelokkan ke situs luar.
//
// Kode galat (kontrak 0.5): UNAUTHORIZED (401, sesi tidak valid),
// PIN_SALAH (401, PIN salah + details.sisa_percobaan),
// SESSION_LOCKED (403, gerbang PIN di middleware),
// PIN_TERKUNCI (403, kunci 30 detik + details terkunci_sampai
// dan sisa_detik), PIN_LAMA_DIPERLUKAN (403, ubah/hapus PIN dari
// sesi terkunci tanpa PIN lama dan di luar tenggang login Google
// 10 menit — K-70), VALIDATION_ERROR (400, format tidak valid /
// PIN lemah), CONFLICT (409, PIN belum diatur), INTERNAL_ERROR (500).

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  ambilProfilGoogle,
  buatCodeChallenge,
  buatCodeVerifier,
  buatStateAcak,
  buatUrlAuthGoogle,
  cariAtauBuatPengguna,
  GalatGoogle,
  tukarKodeGoogle,
  uraiCallbackGoogle,
  type ProfilGoogle,
} from './google';
import { responsGalat, responsSukses, wajibLogin, type VariabelAuth } from './middleware';
import {
  ambilStatusPin,
  apakahPinLemah,
  apakahPinTerkunci,
  apakahSesiTerkunci,
  apakahWaktuDalamTenggang,
  catatPinGagal,
  hapusPin,
  hapusTandaSesiTerbuka,
  pastikanTabelPin,
  PIN_MAKS_GAGAL,
  resetPinGagal,
  simpanPin,
  sisaDetikKunci,
  tandaiSesiTerbuka,
  validasiFormatPin,
  verifikasiPin,
  type HasilPercobaanGagal,
  type StatusPin,
} from './pin';
import {
  bacaNilaiCookie,
  bacaTokenDariCookie,
  bandingkanStringAman,
  buatCookie,
  buatCookieHapusSesi,
  buatCookieSesi,
  buatSesi,
  hapusSesi,
  type EnvAuth,
  type OpsiCookie,
} from './session';
import {
  BATAS_OAUTH_PER_MENIT,
  batasLaju,
  cekDanCatat,
  detikSampaiKedaluwarsa,
  jendelaMenit,
} from '../lib/ratelimit';

/** Nama cookie sementara untuk nilai state OAuth. */
const NAMA_COOKIE_STATE = 'dokter_hp_oauth_state';

/** Nama cookie sementara untuk code_verifier PKCE. */
const NAMA_COOKIE_VERIFIER = 'dokter_hp_oauth_verifier';

/** Nama cookie sementara untuk tujuan redirect setelah masuk. */
const NAMA_COOKIE_REDIRECT = 'dokter_hp_oauth_redirect';

/** Masa berlaku cookie OAuth sementara dalam detik (10 menit). */
const MASA_BERLAKU_COOKIE_OAUTH_DETIK = 600;

/**
 * Path cookie OAuth sementara. Mengikuti mount router ini
 * (/api/auth) agar cookie hanya terkirim ke endpoint auth.
 * Bila mount berubah, ubah konstanta ini.
 */
const JALUR_COOKIE_OAUTH = '/api/auth';

/** Panjang maksimum path redirect (cegah cookie berukuran absurd). */
const PANJANG_MAKS_REDIRECT = 500;

/**
 * Asal frontend dari env, tanpa garis miring akhir. Bila
 * FRONTEND_URL tidak diatur, mengembalikan string kosong sehingga
 * redirect menjadi jalur relatif (hanya benar bila API dan
 * frontend satu origin — tim integrasi wajib mengatur FRONTEND_URL).
 */
function asalFrontend(env: EnvAuth): string {
  return (env.FRONTEND_URL ?? '').replace(/\/+$/, '');
}

/**
 * Ketersediaan login Google (K-89): true hanya bila ketiga nilai
 * konfigurasi OAuth terisi — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * dan GOOGLE_REDIRECT_URI. Dipakai GET /api/auth/status dan jaring
 * pengaman GET /api/auth/google. Fungsi ini TIDAK PERNAH
 * mengembalikan nilai secret apa pun — hanya boolean.
 */
export function apakahGoogleTersedia(env: EnvAuth): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Memvalidasi tujuan redirect setelah masuk (kontrak 1.1, R-06):
 * path relatif yang diawali `/` dan tanpa `//` di awal, atau URL
 * absolut yang origin-nya sama persis dengan FRONTEND_URL (bagian
 * path + query + fragment-nya dikembalikan). Nilai lain — termasuk
 * yang mengandung backslash (browser menormalkan `/\evil.com`
 * menjadi `//evil.com`) atau karakter kontrol — diganti
 * `/dashboard`.
 */
export function validasiRedirect(
  nilai: string | null | undefined,
  asal?: string,
): string {
  if (!nilai || nilai.length > PANJANG_MAKS_REDIRECT) {
    return '/dashboard';
  }
  if (nilai.includes('\\') || /[\u0000-\u001F\u007F]/.test(nilai)) {
    return '/dashboard';
  }
  if (nilai.startsWith('/')) {
    if (nilai.startsWith('//')) {
      return '/dashboard';
    }
    return nilai;
  }
  if (asal) {
    try {
      const tujuan = new URL(nilai);
      const basis = new URL(asal);
      if (tujuan.origin === basis.origin) {
        return `${tujuan.pathname}${tujuan.search}${tujuan.hash}`;
      }
    } catch {
      // URL absolut tidak valid -> /dashboard.
    }
  }
  return '/dashboard';
}

/** Membaca badan JSON secara aman; null bila badan bukan JSON valid. */
async function bacaJsonBadan(c: Context): Promise<unknown> {
  try {
    return (await c.req.json()) as unknown;
  } catch {
    return null;
  }
}

/** Mengambil bidang pin dari badan JSON. */
function ambilPinDariBadan(badan: unknown): unknown {
  if (typeof badan !== 'object' || badan === null) {
    return undefined;
  }
  return (badan as { pin?: unknown }).pin;
}

/** Mengambil bidang pin_lama dari badan JSON (K-70). */
function ambilPinLamaDariBadan(badan: unknown): unknown {
  if (typeof badan !== 'object' || badan === null) {
    return undefined;
  }
  return (badan as { pin_lama?: unknown }).pin_lama;
}

/**
 * Respons untuk satu percobaan PIN yang salah (N-02): PIN_TERKUNCI
 * bila percobaan ini mengunci PIN atau kunci sudah aktif, dan
 * PIN_SALAH hanya bila PIN benar-benar belum terkunci.
 *
 * Pada burst paralel, catatPinGagal hanya mengembalikan
 * terkunci: true untuk pemanggil yang menulis kunci; pemanggil
 * lain yang increment-nya mendarat sesudah kunci dibuat mendapat
 * terkunci: false dengan gagalBaru sudah di/lewat batas — tanpa
 * penanganan ini mereka menjawab PIN_SALAH dengan sisa_percobaan
 * 0. Bila gagalBaru sudah di batas tetapi kunci bukan ditulis
 * pemanggil ini, status dibaca ulang dari D1: bila kunci aktif,
 * jawab PIN_TERKUNCI dengan terkunci_sampai yang sebenarnya
 * (waktu kunci tidak pernah ditulis ulang di sini).
 */
async function responsPercobaanPinSalah(
  c: Context<{ Bindings: EnvAuth; Variables: VariabelAuth }>,
  hasil: HasilPercobaanGagal,
  pesanSalah: string,
): Promise<Response> {
  if (hasil.terkunci) {
    // Percobaan ke-5 yang salah: kunci aktif dan responsnya
    // PIN_TERKUNCI (403), bukan PIN_SALAH (kontrak 2.2).
    return responsGalat(
      c,
      403,
      'PIN_TERKUNCI',
      'Terlalu banyak percobaan salah. Coba lagi dalam 30 detik.',
      { terkunci_sampai: hasil.terkunciSampai, sisa_detik: 30 },
    );
  }
  if (hasil.gagalBaru >= PIN_MAKS_GAGAL) {
    const statusBaru = await ambilStatusPin(c.env.DB, c.get('pengguna').id);
    if (statusBaru && apakahPinTerkunci(statusBaru.terkunciSampai)) {
      const sisa = sisaDetikKunci(statusBaru.terkunciSampai);
      return responsGalat(
        c,
        403,
        'PIN_TERKUNCI',
        `Terlalu banyak percobaan salah. Coba lagi dalam ${sisa} detik.`,
        { terkunci_sampai: statusBaru.terkunciSampai, sisa_detik: sisa },
      );
    }
    // Kunci tidak ditemukan (balapan dengan reset yang nyaris
    // mustahil): jatuh ke PIN_SALAH di bawah — percobaan
    // berikutnya akan membaca status kunci yang terbaru.
  }
  return responsGalat(c, 401, 'PIN_SALAH', pesanSalah, {
    sisa_percobaan: Math.max(0, PIN_MAKS_GAGAL - hasil.gagalBaru),
  });
}

/**
 * Otorisasi ubah/hapus PIN (K-70, R-02): mengembalikan null bila
 * diizinkan, atau respons galat yang harus dikembalikan.
 *
 * Diizinkan bila sesi masih dalam tenggang login Google (dibuat
 * ≤ 10 menit lalu) ATAU PIN lama yang dikirim benar. Bila PIN
 * sedang terkunci, selalu ditolak dulu — mencegah bypass kunci
 * lewat /pin/set dan /pin/delete. PIN lama yang salah dicatat
 * sebagai percobaan gagal (mencegah /pin/set menjadi oracle
 * tebakan tanpa batas).
 */
async function tolakBilaTidakBerwenangUbahPin(
  c: Context<{ Bindings: EnvAuth; Variables: VariabelAuth }>,
  status: StatusPin,
  pinLama: unknown,
): Promise<Response | null> {
  if (apakahPinTerkunci(status.terkunciSampai)) {
    const sisa = sisaDetikKunci(status.terkunciSampai);
    return responsGalat(
      c,
      403,
      'PIN_TERKUNCI',
      `Terlalu banyak percobaan salah. Coba lagi dalam ${sisa} detik.`,
      { terkunci_sampai: status.terkunciSampai, sisa_detik: sisa },
    );
  }
  if (apakahWaktuDalamTenggang(c.get('sesi').dibuat_pada)) {
    return null;
  }
  if (!validasiFormatPin(pinLama)) {
    return responsGalat(
      c,
      403,
      'PIN_LAMA_DIPERLUKAN',
      'Masukkan PIN lama untuk mengubah PIN.',
    );
  }
  const cocok = await verifikasiPin(
    pinLama,
    status.pinSalt,
    status.pinHash,
    c.env.PIN_PEPPER,
  );
  if (!cocok) {
    const hasil = await catatPinGagal(c.env.DB, c.get('pengguna').id);
    return responsPercobaanPinSalah(c, hasil, 'PIN lama salah, coba lagi.');
  }
  return null;
}

/**
 * Membuat router auth Hono. Tim integrasi memasangnya dengan
 * apiRouter.route("/auth", buatRouterAuth()).
 */
export function buatRouterAuth(): Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }> {
  const router = new Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }>();

  // -------------------------------------------------------------------------
  // GET /status — status ketersediaan login Google (K-89, endpoint #31)
  // -------------------------------------------------------------------------
  // Publik, tanpa sesi, tanpa akses D1: hanya membaca konfigurasi
  // OAuth dari env. Frontend /masuk memanggilnya saat dimuat untuk
  // menampilkan tombol Google dalam keadaan jujur ("belum
  // disiapkan") bila konfigurasi belum lengkap. Respons TIDAK
  // PERNAH berisi nilai secret — hanya boolean google_tersedia.
  router.get('/status', (c) => {
    return responsSukses(c, { google_tersedia: apakahGoogleTersedia(c.env) });
  });

  // -------------------------------------------------------------------------
  // GET /google — mulai masuk Google (redirect ke Google OAuth)
  // -------------------------------------------------------------------------
  router.get('/google', async (c) => {
    // Jaring pengaman (K-89): bila konfigurasi OAuth belum lengkap,
    // JANGAN menjawab 500 JSON mentah di luar UI aplikasi — arahkan
    // browser kembali ke /masuk dengan kode galat yang ramah.
    // Bila FRONTEND_URL tidak diatur, redirect relatif dipakai
    // (hanya benar bila API dan frontend satu origin).
    if (!apakahGoogleTersedia(c.env)) {
      const asal = asalFrontend(c.env);
      return c.redirect(`${asal}/masuk?error=oauth_belum_disiapkan`, 302);
    }
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI;
    // Batas mulai OAuth: 10/menit per IP (kontrak 0.7, K-02).
    // Fail-open bila D1 galat: alur OAuth tetap berjalan dan
    // kegagalan D1 nyata akan terlihat di callback (server_sibuk).
    const ip = c.req.header('CF-Connecting-IP')?.trim() || 'tidak-diketahui';
    try {
      const jendela = jendelaMenit('oauth', ip);
      const status = await cekDanCatat(c.env.DB, jendela, BATAS_OAUTH_PER_MENIT);
      if (!status.diizinkan) {
        // R-12: sertakan Retry-After agar client tahu kapan boleh
        // mencoba lagi.
        return responsGalat(
          c,
          429,
          'RATE_LIMITED',
          'Terlalu sering, coba lagi sebentar.',
          undefined,
          { 'Retry-After': String(detikSampaiKedaluwarsa(jendela)) },
        );
      }
    } catch {
      console.warn('[auth] Rate limit OAuth tidak dapat diperiksa (D1 galat); lanjut tanpa batas.');
    }
    const state = buatStateAcak();
    const verifier = buatCodeVerifier();
    const challenge = await buatCodeChallenge(verifier);
    const url = buatUrlAuthGoogle({ clientId, redirectUri, state, codeChallenge: challenge });
    // Cookie OAuth TETAP SameSite=Lax (K-50): hanya dipakai dalam
    // alur redirect di domain API sendiri, bukan fetch lintas situs.
    const opsiCookieOAuth: OpsiCookie = {
      maxAgeDetik: MASA_BERLAKU_COOKIE_OAUTH_DETIK,
      path: JALUR_COOKIE_OAUTH,
      sameSite: 'Lax',
    };
    c.header('Set-Cookie', buatCookie(NAMA_COOKIE_STATE, state, opsiCookieOAuth), {
      append: true,
    });
    c.header('Set-Cookie', buatCookie(NAMA_COOKIE_VERIFIER, verifier, opsiCookieOAuth), {
      append: true,
    });
    // Tujuan redirect opsional (?redirect=/wifi). Disimpan dalam
    // bentuk yang sudah divalidasi (path satu origin); bila tidak
    // valid, callback memakai /dashboard.
    const redirectDiminta = c.req.query('redirect');
    const tujuanValid = redirectDiminta
      ? validasiRedirect(redirectDiminta, asalFrontend(c.env))
      : '/dashboard';
    if (tujuanValid !== '/dashboard') {
      c.header(
        'Set-Cookie',
        buatCookie(NAMA_COOKIE_REDIRECT, tujuanValid, opsiCookieOAuth),
        { append: true },
      );
    }
    return c.redirect(url, 302);
  });

  // -------------------------------------------------------------------------
  // GET /google/callback — terima kode Google, buat sesi, redirect ke frontend
  // -------------------------------------------------------------------------
  router.get('/google/callback', async (c) => {
    const asal = asalFrontend(c.env);
    const hapusCookieOAuth = (): void => {
      const opsiHapus: OpsiCookie = {
        maxAgeDetik: 0,
        path: JALUR_COOKIE_OAUTH,
        sameSite: 'Lax',
      };
      c.header('Set-Cookie', buatCookie(NAMA_COOKIE_STATE, '', opsiHapus), { append: true });
      c.header('Set-Cookie', buatCookie(NAMA_COOKIE_VERIFIER, '', opsiHapus), { append: true });
      c.header('Set-Cookie', buatCookie(NAMA_COOKIE_REDIRECT, '', opsiHapus), { append: true });
    };
    // Redirect galat memakai ?error= (kontrak 1.2): ditolak bila
    // pengguna menolak di Google, oauth_gagal untuk kegagalan alur
    // OAuth, server_sibuk untuk galat database. Cookie OAuth
    // sementara selalu dihapus, sukses maupun gagal.
    const keMasuk = (kode: string): Response => {
      hapusCookieOAuth();
      return c.redirect(`${asal}/masuk?error=${kode}`, 302);
    };

    const query = new URL(c.req.url).searchParams;
    let hasilCallback: { code: string; state: string };
    try {
      hasilCallback = uraiCallbackGoogle(query);
    } catch (galat) {
      if (galat instanceof GalatGoogle && galat.kode === 'GOOGLE_DITOLAK') {
        return keMasuk('ditolak');
      }
      return keMasuk('oauth_gagal');
    }

    const cookie = c.req.header('Cookie');
    const stateTersimpan = bacaNilaiCookie(cookie, NAMA_COOKIE_STATE);
    const verifier = bacaNilaiCookie(cookie, NAMA_COOKIE_VERIFIER);
    // R-18: perbandingan state waktu-konstan.
    if (
      !stateTersimpan ||
      !verifier ||
      !bandingkanStringAman(stateTersimpan, hasilCallback.state)
    ) {
      return keMasuk('oauth_gagal');
    }

    // Panggilan ke Google: gagal -> oauth_gagal.
    let profil: ProfilGoogle;
    try {
      const { accessToken } = await tukarKodeGoogle({
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        redirectUri: c.env.GOOGLE_REDIRECT_URI,
        code: hasilCallback.code,
        codeVerifier: verifier,
      });
      profil = await ambilProfilGoogle({ accessToken });
    } catch {
      return keMasuk('oauth_gagal');
    }

    // Operasi database: gagal -> server_sibuk.
    let token: string;
    try {
      const pengguna = await cariAtauBuatPengguna(c.env.DB, profil);
      // Rekam User-Agent + IP pembuat sesi (K-44) untuk daftar
      // sesi aktif di Pengaturan.
      ({ token } = await buatSesi(c.env.DB, {
        idPengguna: pengguna.id,
        userAgent: c.req.header('User-Agent') ?? null,
        ipTerakhir: c.req.header('CF-Connecting-IP')?.trim() || null,
      }));
    } catch {
      return keMasuk('server_sibuk');
    }

    const tujuan = validasiRedirect(bacaNilaiCookie(cookie, NAMA_COOKIE_REDIRECT), asal);
    c.header('Set-Cookie', buatCookieSesi(token), { append: true });
    hapusCookieOAuth();
    return c.redirect(`${asal}${tujuan}`, 302);
  });

  // -------------------------------------------------------------------------
  // POST /logout — hapus sesi di D1 + hapus cookie
  // -------------------------------------------------------------------------
  router.post('/logout', wajibLogin, batasLaju, async (c) => {
    const token = bacaTokenDariCookie(c.req.header('Cookie'));
    if (token) {
      await hapusSesi(c.env.DB, token);
    }
    // Pembersihan penanda buka bersifat best-effort: tabel
    // pin_unlocks mungkin belum ada bila pengguna tidak pernah
    // memakai PIN. Sesi sudah terhapus, jadi penanda yang tertinggal
    // tidak berbahaya (penanda terikat ID sesi yang sudah tidak ada).
    try {
      await hapusTandaSesiTerbuka(c.env.DB, c.get('sesi').id);
    } catch {
      // Abaikan: keluar tetap berhasil.
    }
    c.header('Set-Cookie', buatCookieHapusSesi());
    return responsSukses(c, { keluar: true });
  });

  // -------------------------------------------------------------------------
  // GET /me — profil pengguna saat ini (+ status PIN dan kunci sesi)
  // -------------------------------------------------------------------------
  router.get('/me', wajibLogin, batasLaju, async (c) => {
    const pengguna = c.get('pengguna');
    const sesi = c.get('sesi');
    const pinDiatur = pengguna.pin_hash !== null;
    const terkunci = await apakahSesiTerkunci(c.env.DB, sesi.id, pinDiatur);
    return responsSukses(c, {
      id: pengguna.id,
      nama: pengguna.nama ?? '',
      email: pengguna.email,
      pin_diatur: pinDiatur,
      sesi_terkunci: terkunci,
      sesi_kedaluwarsa_pada: sesi.expires_at,
    });
  });

  // -------------------------------------------------------------------------
  // POST /pin/set — atur PIN baru atau ubah PIN lama (K-70, R-02)
  // -------------------------------------------------------------------------
  router.post('/pin/set', wajibLogin, batasLaju, async (c) => {
    const badan = await bacaJsonBadan(c);
    const pin = ambilPinDariBadan(badan);
    if (!validasiFormatPin(pin)) {
      return responsGalat(c, 400, 'VALIDATION_ERROR', 'PIN harus 4 sampai 8 angka.');
    }
    if (apakahPinLemah(pin)) {
      return responsGalat(
        c,
        400,
        'VALIDATION_ERROR',
        'PIN terlalu mudah ditebak, pilih kombinasi lain.',
        { alasan: 'PIN_LEMAH' },
      );
    }
    if (!c.env.PIN_PEPPER) {
      return responsGalat(
        c,
        500,
        'INTERNAL_ERROR',
        'Terjadi kesalahan di server, coba lagi nanti.',
      );
    }
    await pastikanTabelPin(c.env.DB);
    const pengguna = c.get('pengguna');
    const status = await ambilStatusPin(c.env.DB, pengguna.id);
    if (status?.pinDiatur) {
      // PIN sudah diatur: ubah PIN wajib PIN lama atau tenggang
      // login Google 10 menit. Tanpa keduanya, 403
      // PIN_LAMA_DIPERLUKAN — sesi terkunci TIDAK bisa mengatur
      // PIN baru dan melewati gerbang (R-02).
      const penolakan = await tolakBilaTidakBerwenangUbahPin(
        c,
        status,
        ambilPinLamaDariBadan(badan),
      );
      if (penolakan) {
        return penolakan;
      }
    }
    await simpanPin(c.env.DB, pengguna.id, pin, c.env.PIN_PEPPER);
    // /pin/set TIDAK PERNAH membuka sesi (K-70b): sesi yang
    // terkunci tetap terkunci dan harus dibuka lewat /pin/verify.
    const sesiTerkunci = await apakahSesiTerkunci(c.env.DB, c.get('sesi').id, true);
    return responsSukses(c, { pin_diatur: true, sesi_terkunci: sesiTerkunci });
  });

  // -------------------------------------------------------------------------
  // POST /pin/verify — verifikasi PIN dan buka sesi
  // -------------------------------------------------------------------------
  router.post('/pin/verify', wajibLogin, batasLaju, async (c) => {
    const pin = ambilPinDariBadan(await bacaJsonBadan(c));
    // Format salah -> VALIDATION_ERROR dan TIDAK dihitung sebagai
    // percobaan salah (kontrak 2.2).
    if (!validasiFormatPin(pin)) {
      return responsGalat(c, 400, 'VALIDATION_ERROR', 'PIN harus 4 sampai 8 angka.');
    }
    if (!c.env.PIN_PEPPER) {
      return responsGalat(
        c,
        500,
        'INTERNAL_ERROR',
        'Terjadi kesalahan di server, coba lagi nanti.',
      );
    }
    await pastikanTabelPin(c.env.DB);
    const status = await ambilStatusPin(c.env.DB, c.get('pengguna').id);
    if (!status || !status.pinDiatur || !status.pinHash || !status.pinSalt) {
      return responsGalat(c, 409, 'CONFLICT', 'PIN belum diatur.');
    }
    if (apakahPinTerkunci(status.terkunciSampai)) {
      const sisa = sisaDetikKunci(status.terkunciSampai);
      return responsGalat(
        c,
        403,
        'PIN_TERKUNCI',
        `Terlalu banyak percobaan salah. Coba lagi dalam ${sisa} detik.`,
        { terkunci_sampai: status.terkunciSampai, sisa_detik: sisa },
      );
    }
    const cocok = await verifikasiPin(pin, status.pinSalt, status.pinHash, c.env.PIN_PEPPER);
    if (!cocok) {
      // R-04: penghitung dinaikkan atomik di dalam catatPinGagal —
      // tidak ada lagi nilai gagal lama dari pemanggil.
      const hasil = await catatPinGagal(c.env.DB, c.get('pengguna').id);
      // N-02: PIN_SALAH hanya bila PIN benar-benar belum terkunci;
      // bila kunci sudah aktif (termasuk ditulis pemanggil lain
      // dalam burst paralel), responsnya PIN_TERKUNCI.
      return responsPercobaanPinSalah(c, hasil, 'PIN salah, coba lagi.');
    }
    await resetPinGagal(c.env.DB, c.get('pengguna').id);
    await tandaiSesiTerbuka(c.env.DB, c.get('sesi').id);
    return responsSukses(c, { valid: true, sesi_terkunci: false });
  });

  // -------------------------------------------------------------------------
  // POST /pin/delete (+ alias /pin/hapus) — hapus PIN (K-70, R-02)
  // -------------------------------------------------------------------------
  const daftarkanHapusPin = (jalur: string): void => {
    router.post(jalur, wajibLogin, batasLaju, async (c) => {
      if (!c.env.PIN_PEPPER) {
        return responsGalat(
          c,
          500,
          'INTERNAL_ERROR',
          'Terjadi kesalahan di server, coba lagi nanti.',
        );
      }
      await pastikanTabelPin(c.env.DB);
      const status = await ambilStatusPin(c.env.DB, c.get('pengguna').id);
      if (!status || !status.pinDiatur) {
        return responsGalat(c, 409, 'CONFLICT', 'PIN belum diatur.');
      }
      // Hapus PIN dari sesi terkunci wajib PIN lama atau tenggang
      // login Google 10 menit — sama seperti ubah PIN.
      const penolakan = await tolakBilaTidakBerwenangUbahPin(
        c,
        status,
        ambilPinLamaDariBadan(await bacaJsonBadan(c)),
      );
      if (penolakan) {
        return penolakan;
      }
      await hapusPin(c.env.DB, c.get('pengguna').id);
      return responsSukses(c, { pin_diatur: false });
    });
  };
  daftarkanHapusPin('/pin/delete');
  daftarkanHapusPin('/pin/hapus');

  return router;
}
