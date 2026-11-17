// apps/api/src/auth/routes.ts
// Router Hono untuk endpoint autentikasi Dokter HP Web App.
// Kontrak endpoint mengikuti docs/api-contracts.md bagian 1-2
// (kanonis): kode galat, bentuk respons, dan tujuan redirect.
//
// Router ini mendefinisikan jalur RELATIF dan dipasang tim
// integrasi di "/api/auth" (lihat catatan integrasi di bawah),
// sehingga jalur lengkapnya menjadi:
//   GET  /api/auth/google            -> mulai masuk Google
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
// dan sisa_detik), VALIDATION_ERROR (400, format tidak valid),
// CONFLICT (409, PIN belum diatur), INTERNAL_ERROR (500).

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
  apakahPinTerkunci,
  apakahSesiTerkunci,
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
} from './pin';
import {
  bacaNilaiCookie,
  bacaTokenDariCookie,
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
 * Memvalidasi tujuan redirect setelah masuk (kontrak 1.1): hanya
 * path relatif yang diawali `/` dan tanpa `//` di awal. Nilai lain
 * (termasuk kosong) diganti `/dashboard`.
 */
export function validasiRedirect(nilai: string | null | undefined): string {
  if (!nilai || nilai.length > PANJANG_MAKS_REDIRECT) {
    return '/dashboard';
  }
  if (!nilai.startsWith('/') || nilai.startsWith('//')) {
    return '/dashboard';
  }
  return nilai;
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

/**
 * Membuat router auth Hono. Tim integrasi memasangnya dengan
 * apiRouter.route("/auth", buatRouterAuth()).
 */
export function buatRouterAuth(): Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }> {
  const router = new Hono<{ Bindings: EnvAuth; Variables: VariabelAuth }>();

  // -------------------------------------------------------------------------
  // GET /google — mulai masuk Google (redirect ke Google OAuth)
  // -------------------------------------------------------------------------
  router.get('/google', async (c) => {
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return responsGalat(
        c,
        500,
        'INTERNAL_ERROR',
        'Terjadi kesalahan di server, coba lagi nanti.',
      );
    }
    // Batas mulai OAuth: 10/menit per IP (kontrak 0.7, K-02).
    // Fail-open bila D1 galat: alur OAuth tetap berjalan dan
    // kegagalan D1 nyata akan terlihat di callback (server_sibuk).
    const ip = c.req.header('CF-Connecting-IP')?.trim() || 'tidak-diketahui';
    try {
      const status = await cekDanCatat(
        c.env.DB,
        jendelaMenit('oauth', ip),
        BATAS_OAUTH_PER_MENIT,
      );
      if (!status.diizinkan) {
        return responsGalat(c, 429, 'RATE_LIMITED', 'Terlalu sering, coba lagi sebentar.');
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
    // Tujuan redirect opsional (?redirect=/wifi). Hanya disimpan bila
    // valid; bila tidak valid, callback memakai /dashboard.
    const redirectDiminta = c.req.query('redirect');
    if (
      redirectDiminta &&
      redirectDiminta !== '/dashboard' &&
      validasiRedirect(redirectDiminta) === redirectDiminta
    ) {
      c.header(
        'Set-Cookie',
        buatCookie(NAMA_COOKIE_REDIRECT, redirectDiminta, opsiCookieOAuth),
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
    if (!stateTersimpan || !verifier || stateTersimpan !== hasilCallback.state) {
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

    const tujuan = validasiRedirect(bacaNilaiCookie(cookie, NAMA_COOKIE_REDIRECT));
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
  // POST /pin/set — atur PIN baru atau ubah PIN lama
  // -------------------------------------------------------------------------
  router.post('/pin/set', wajibLogin, batasLaju, async (c) => {
    const pin = ambilPinDariBadan(await bacaJsonBadan(c));
    if (!validasiFormatPin(pin)) {
      return responsGalat(c, 400, 'VALIDATION_ERROR', 'PIN harus 4 sampai 8 angka.');
    }
    await pastikanTabelPin(c.env.DB);
    await simpanPin(c.env.DB, c.get('pengguna').id, pin);
    // Sesi yang sedang berjalan dianggap sudah dibuka — pengguna
    // yang baru mengatur PIN tidak langsung dikunci di sesi ini.
    await tandaiSesiTerbuka(c.env.DB, c.get('sesi').id);
    return responsSukses(c, { pin_diatur: true });
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
    const cocok = await verifikasiPin(pin, status.pinSalt, status.pinHash);
    if (!cocok) {
      const hasil = await catatPinGagal(c.env.DB, c.get('pengguna').id, status.gagalBerturut);
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
      return responsGalat(c, 401, 'PIN_SALAH', 'PIN salah, coba lagi.', {
        sisa_percobaan: PIN_MAKS_GAGAL - hasil.gagalBaru,
      });
    }
    await resetPinGagal(c.env.DB, c.get('pengguna').id);
    await tandaiSesiTerbuka(c.env.DB, c.get('sesi').id);
    return responsSukses(c, { valid: true, sesi_terkunci: false });
  });

  // -------------------------------------------------------------------------
  // POST /pin/delete (+ alias /pin/hapus) — hapus PIN
  // -------------------------------------------------------------------------
  const daftarkanHapusPin = (jalur: string): void => {
    router.post(jalur, wajibLogin, batasLaju, async (c) => {
      await pastikanTabelPin(c.env.DB);
      const status = await ambilStatusPin(c.env.DB, c.get('pengguna').id);
      if (!status || !status.pinDiatur) {
        return responsGalat(c, 409, 'CONFLICT', 'PIN belum diatur.');
      }
      await hapusPin(c.env.DB, c.get('pengguna').id);
      return responsSukses(c, { pin_diatur: false });
    });
  };
  daftarkanHapusPin('/pin/delete');
  daftarkanHapusPin('/pin/hapus');

  return router;
}
