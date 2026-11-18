// apps/web/src/components/ui/BrandLogo.tsx
// Logo brand resmi sebagai asset LOKAL (public/brand) — tanpa host
// eksternal (K-78) dan tanpa hotlink. Logo dipakai HANYA di samping
// fitur terkait (spec §7): "G" Google di tombol Masuk dengan Google.
//
// Sumber logo Google "G" (verbatim, tidak diubah):
// https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg
// (FirebaseUI, Google; © 2016 Google Inc.) — dipakai sesuai panduan
// brand Sign in with Google:
// https://developers.google.com/identity/branding-guidelines
// (bundel resmi "Download Pre-Approved Brand Icons" di halaman itu
// hanya berisi tombol utuh, bukan "G" mandiri — "G" mandiri resmi
// diambil dari asset FirebaseUI Google di atas; 4 warna resmi
// #4285F4/#34A853/#FBBC05/#EA4335, aspek rasio dipertahankan SVG.)
//
// Logo bersifat dekoratif di samping teks yang sudah menyebut nama
// brand-nya ("Masuk dengan Google"), jadi alt="" + aria-hidden agar
// pembaca layar tidak mendengar nama brand dua kali. Ukuran tetap
// 20×20 di semua pemakaian.

/** Merek yang logonya tersedia sebagai asset lokal. */
export type MerekLogo = "google";

const SUMBER_LOGO: Record<MerekLogo, string> = {
  google: "/brand/google-g.svg",
};

export default function BrandLogo({ merek }: { merek: MerekLogo }) {
  return (
    <img
      src={SUMBER_LOGO[merek]}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
      className="h-5 w-5 shrink-0"
    />
  );
}
