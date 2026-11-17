// Data 7 panduan perbaikan Dokter HP Web App.
// Sumber isi: docs/panduan-pengguna.md §4–§5, panduan WiFi APK
// (~/workspace/projects/dokter-hp/docs/panduan-wifi-turun.md),
// PRODUCT.md, dan docs/seo.md (judul/deskripsi per panduan).
// Klaim di luar dokumen-dokumen itu tidak dimasukkan.
// Bahasa: Indonesia netral profesional, tanpa kata gaul.

export interface FaqPanduan {
  pertanyaan: string;
  jawaban: string;
}

export interface Panduan {
  /** Segmen URL: /panduan/:slug. */
  slug: string;
  /** Judul tampil di halaman (h1). */
  judul: string;
  /** Judul dokumen (document.title), dari docs/seo.md §3. */
  judulSeo: string;
  /** Pengantar panduan; juga dipakai sebagai deskripsi meta. */
  deskripsi: string;
  /** Langkah bernomor, bahasa sehari-hari, istilah teknis dijelaskan. */
  langkah: string[];
  /** Tanya-jawab untuk JSON-LD FAQPage (baru wifi-lemot yang punya, seo.md §5.2). */
  faq?: FaqPanduan[];
}

export const PANDUAN: Panduan[] = [
  {
    slug: "wifi-lemot",
    judul: "WiFi lemot padahal sinyal penuh",
    judulSeo:
      "WiFi Lemot Padahal Sinyal Penuh? Penyebab & Cara Mengatasinya | Dokter HP",
    deskripsi:
      "WiFi lemot padahal sinyal penuh biasanya bukan salah HP Anda. Kenali penyebabnya — dari mode router 802.11b Only sampai channel yang bertabrakan — dan cara memperbaikinya.",
    langkah: [
      "Ukur dulu kecepatan yang sebenarnya. Buka halaman Dokter WiFi dan ketuk Periksa WiFi sekarang. Sebagai patokan, kecepatan unduh yang wajar biasanya sekitar 1 MB/detik atau lebih. Bila hasil tes jauh di bawah itu, ada yang perlu diperiksa.",
      "Coba putar video kualitas tinggi selama 1 menit sambil memperhatikan kecepatan. Bila kecepatan kembali normal saat video diputar, angka kecil tadi muncul karena tidak ada data yang sedang berjalan. Bila kecepatan tetap jatuh ke KB/detik meski video sedang diputar, masalahnya nyata.",
      "Coba HP lain di WiFi yang sama. Bila HP lain juga lemot, masalahnya ada di router atau jaringan, bukan di HP. Bila hanya HP ini yang lemot, masalahnya ada di pengaturan HP ini.",
      "Periksa penghemat baterai dan penghemat data di HP. Buka Pengaturan, lalu Baterai, dan matikan Penghemat Baterai sementara; lalu buka Pengaturan, lalu Jaringan atau Koneksi, dan matikan Penghemat Data sementara. Tes lagi setelah keduanya dimatikan.",
      "Lupakan jaringan WiFi ini, lalu sambung ulang. Buka pengaturan WiFi di HP, pilih jaringan yang dipakai, ketuk Lupakan, lalu sambung lagi dengan memasukkan kata sandi.",
      "Mulai ulang router bila masih lambat. Cabut kabel daya router, tunggu 5 menit, colokkan lagi, dan tunggu sampai lampu router menyala normal, lalu tes lagi.",
      "Periksa mode router di halaman pengaturan router. Mode lama (disebut 802.11b Only, teknologi tahun 1999) membatasi kecepatan seluruh jaringan sampai 11 Mbps walau sinyal terlihat penuh. Ubah ke mode campuran (b/g/n) agar kecepatan tidak dibatasi. Alamat dan kata sandi halaman router biasanya ada di stiker bawah router.",
      "Coba ganti channel router ke 1, 6, atau 11. Channel adalah saluran yang dipakai router untuk mengirim sinyal; di pita 2,4 GHz hanya ketiga channel itu yang tidak saling mengganggu dengan router tetangga. Cara lengkapnya ada di panduan ganti channel router.",
      "Berdiri 1–2 meter dari router tanpa dinding di antaranya, lalu tes lagi. Bila di dekat router kecepatannya normal, penyebabnya adalah jarak atau halangan.",
      "Setelah setiap perbaikan, jalankan tes bertahan 30 detik, bukan hanya tes singkat, untuk memastikan kecepatan benar-benar bertahan dari awal sampai akhir.",
    ],
    faq: [
      {
        pertanyaan: "Kenapa WiFi lemot padahal sinyal penuh?",
        jawaban:
          "Sinyal penuh hanya berarti HP dekat dengan router, bukan berarti kecepatan internetnya bagus. Penyebab umum: mode router 802.11b Only yang membatasi kecepatan sampai 11 Mbps, channel WiFi yang bertabrakan dengan tetangga, atau terlalu banyak perangkat memakai jaringan yang sama.",
      },
      {
        pertanyaan: "Berapa kecepatan unduh WiFi yang normal?",
        jawaban:
          "Patokan normal Dokter HP adalah 1 MB/detik, dan biasanya di atas 2 MB/detik. Di bawah 50 KB/detik tergolong sangat lambat dan perlu diperiksa lebih lanjut.",
      },
      {
        pertanyaan:
          "Channel router mana yang paling baik untuk WiFi 2,4 GHz?",
        jawaban:
          "Channel 1, 6, dan 11 — hanya ketiganya yang tidak saling tumpang tindih di pita 2,4 GHz. Mengganti channel router ke salah satu dari ketiganya sering memperbaiki WiFi yang lemot karena gangguan dari jaringan tetangga.",
      },
      {
        pertanyaan: "Apakah tes kecepatan WiFi di Dokter HP perlu akun?",
        jawaban:
          "Tidak. Tes kecepatan dan latensi WiFi bisa dijalankan tanpa akun dan tanpa memasang aplikasi. Hasilnya tampil langsung di layar; penyimpanan hasil ke riwayat baru membutuhkan akun.",
      },
      {
        pertanyaan:
          "Bagaimana cara tahu masalahnya ada di HP atau di router?",
        jawaban:
          "Coba dua tes pembeda: pertama, periksa apakah HP lain di jaringan yang sama juga lemot — bila hanya satu HP yang lemot, masalahnya ada di HP itu. Kedua, coba data seluler — bila data seluler lancar, masalahnya ada di WiFi atau router, bukan di HP.",
      },
    ],
  },
  {
    slug: "ganti-channel-router",
    judul: "Cara ganti channel router ke 1, 6, atau 11",
    judulSeo:
      "Cara Ganti Channel Router ke 1, 6, atau 11 agar WiFi Stabil | Dokter HP",
    deskripsi:
      "Di pita 2,4 GHz hanya channel 1, 6, dan 11 yang tidak saling tumpang tindih. Pelajari cara mengganti channel router Anda langkah demi langkah, termasuk contoh router ZTE F660.",
    langkah: [
      "Pahami dulu apa itu channel. Channel adalah saluran yang dipakai router untuk mengirim sinyal WiFi. Bila banyak router tetangga memakai channel yang sama atau berdekatan, sinyalnya saling mengganggu dan WiFi jadi lemot. Di pita 2,4 GHz — pita yang dipakai sebagian besar router rumahan — hanya channel 1, 6, dan 11 yang tidak saling tumpang tindih.",
      "Siapkan alamat dan kata sandi halaman pengaturan router. Keduanya biasanya tertulis di stiker di bawah router, atau diberikan oleh yang memasang router. Tanpa ini, channel tidak bisa diubah.",
      "Buka halaman pengaturan router dari browser HP. Ketik alamat router di kolom alamat browser, lalu masuk dengan kata sandi admin router (bukan kata sandi WiFi).",
      "Cari menu pengaturan WiFi. Di router ZTE F660, menunya ada di Network, lalu WLAN, lalu Basic. Di router lain namanya bisa berbeda — cari menu bernama WiFi, Wireless, atau WLAN.",
      "Ubah Channel ke 1 atau 11. Coba satu dulu, jangan keduanya sekaligus, supaya hasilnya bisa dibandingkan.",
      "Sebelum menekan Simpan, pastikan nama WiFi tampil dengan benar di halaman itu. Jangan simpan saat kolom nama WiFi masih kosong — pengaturan bisa tersimpan dengan salah. Jangan ubah pengaturan lain di halaman router, terutama halaman PPPoE (pengaturan sambungan internet).",
      "Simpan pengaturan, tunggu router menerapkan perubahan, lalu sambungkan ulang HP ke WiFi.",
      "Jalankan tes kecepatan di Dokter WiFi. Bila belum membaik, ulangi langkah di atas dengan channel yang satunya lagi (1 atau 11, yang belum dicoba), lalu pakai channel yang hasilnya paling cepat.",
      "Bila kedua channel sudah dicoba dan WiFi masih lemot, penyebabnya mungkin bukan channel. Kembali ke panduan WiFi lemot untuk memeriksa penyebab lain, seperti mode router yang masih memakai mode lama.",
    ],
  },
  {
    slug: "ganti-dns",
    judul: "Cara ganti DNS HP ke 1.1.1.1 atau 8.8.8.8",
    judulSeo: "Cara Ganti DNS HP ke 1.1.1.1 atau 8.8.8.8 | Dokter HP",
    deskripsi:
      "Mengganti DNS kadang membuat browsing terasa lebih cepat dan stabil. Panduan langkah demi langkah mengganti DNS di HP Android ke 1.1.1.1 atau 8.8.8.8.",
    langkah: [
      "Pahami dulu apa itu DNS. DNS adalah layanan yang menerjemahkan nama situs yang diketik di browser menjadi alamat yang dipakai HP untuk menyambung ke situs itu. Bila layanan DNS yang dipakai lambat, membuka situs terasa lama walau kecepatan unduh normal.",
      "Ketahui dulu batasnya: mengganti DNS tidak menambah kecepatan unduh. DNS hanya membantu saat membuka situs terasa lambat padahal hasil tes kecepatan normal.",
      "Buka Pengaturan di HP, lalu cari menu DNS Pribadi. Letaknya berbeda di tiap HP — biasanya di Jaringan dan Internet, lalu DNS Pribadi, atau ketik DNS Pribadi di kolom pencarian Pengaturan.",
      "Pilih opsi memasukkan nama penyedia DNS Pribadi (biasanya bernama Nama host penyedia DNS Pribadi).",
      "Isi nama host-nya: ketik one.one.one.one untuk memakai DNS 1.1.1.1, atau dns.google untuk memakai DNS 8.8.8.8. Lalu simpan.",
      "Buka beberapa situs dan rasakan perbedaannya. Bila membuka situs terasa lebih cepat dan stabil, pengaturan baru ini bisa dipakai terus.",
      "Bila tidak ada perubahan atau justru terasa lebih lambat, kembali ke menu DNS Pribadi dan pilih Otomatis untuk kembali ke pengaturan semula. Tidak ada yang rusak — DNS bisa diganti kapan saja.",
    ],
  },
  {
    slug: "baterai-boros",
    judul: "Baterai HP boros",
    judulSeo: "Baterai HP Boros? Penyebab & Cara Menghematnya | Dokter HP",
    deskripsi:
      "Baterai HP cepat habis? Kenali penyebab umum baterai boros dan cara menghematnya — dari mode hemat daya sampai memeriksa aplikasi yang paling banyak memakai baterai.",
    langkah: [
      "Lihat dulu apa yang paling banyak memakai baterai. Buka Pengaturan, lalu Baterai. Di sana terlihat aplikasi apa saja yang paling banyak memakai baterai sejak terakhir diisi penuh.",
      "Periksa aplikasi yang paling boros. Bila ada aplikasi yang jarang dipakai tetapi banyak memakai baterai, pertimbangkan untuk membatasi pemakaian baterainya dari pengaturan aplikasi itu, atau menghapusnya bila memang tidak dipakai lagi.",
      "Kurangi kecerahan layar. Layar adalah salah satu pemakai baterai terbesar. Turunkan kecerahan ke tingkat yang masih nyaman dibaca, atau aktifkan kecerahan otomatis bila tersedia.",
      "Aktifkan mode hemat daya bila baterai tinggal sedikit dan tidak ada pengisi daya. Mode ini membatasi kegiatan di latar belakang supaya baterai bertahan lebih lama. Perlu diingat: di sebagian HP, mode hemat daya ikut membatasi WiFi — matikan sementara bila sedang butuh kecepatan penuh.",
      "Hindari HP kepanasan terlalu lama, misalnya dipakai sambil mengisi daya di bawah sinar matahari. Panas membuat baterai lebih cepat habis dan memperpendek umur baterai.",
      "Perhatikan pola pemakaiannya. Bila baterai tiba-tiba jauh lebih cepat habis dari biasanya tanpa ada perubahan pemakaian, catat kapan mulainya — perubahan mendadak sering berkaitan dengan aplikasi yang baru dipasang atau diperbarui.",
      "Versi web Dokter HP tidak bisa membaca baterai HP secara langsung. Untuk mencatat kondisi baterai dari waktu ke waktu, isi level baterai secara manual di halaman Dokter Baterai setelah masuk, atau lihat pembacaan langsung di aplikasi Dokter HP di Android.",
    ],
  },
  {
    slug: "penyimpanan-penuh",
    judul: "Penyimpanan HP penuh",
    judulSeo:
      "Penyimpanan HP Penuh? Cara Mengosongkannya dengan Aman | Dokter HP",
    deskripsi:
      "Penyimpanan HP penuh membuat HP lambat dan gagal menyimpan foto. Pelajari cara memeriksa pemakaian penyimpanan dan mengosongkannya dengan aman tanpa menghapus data penting.",
    langkah: [
      "Lihat dulu apa yang memenuhi penyimpanan. Buka Pengaturan, lalu Penyimpanan. Di sana terlihat berapa besar ruang yang dipakai foto dan video, aplikasi, dan file lain, serta berapa ruang yang masih kosong.",
      "Mulai dari foto dan video, karena biasanya inilah yang paling besar. Hapus foto dan video yang sudah tidak diperlukan, atau pindahkan ke tempat lain sebelum menghapusnya dari HP.",
      "Hapus aplikasi yang sudah tidak dipakai lagi. Buka Pengaturan, lalu Aplikasi, dan hapus aplikasi yang sudah lama tidak dibuka. Aplikasi sistem — bagian dari HP — biasanya tidak bisa dihapus.",
      "Periksa folder unduhan. Buka aplikasi File di HP, buka folder Unduhan, dan hapus file yang sudah tidak diperlukan.",
      "Kosongkan tempat sampah bila ada. Di sebagian HP, file yang dihapus masih tersimpan sementara di tempat sampah dan tetap memakai ruang sampai dikosongkan.",
      "Periksa lagi ruang kosong setelah membersihkan. Bila ruang kosong masih sangat sedikit, HP bisa terasa berat dan gagal menyimpan foto atau memperbarui aplikasi — ulangi langkah di atas sampai ada ruang kosong yang cukup.",
      "Catatan: versi web Dokter HP tidak bisa membersihkan file di HP — penghapusan dilakukan langsung dari HP. Untuk mencatat pemakaian penyimpanan dari waktu ke waktu, isi angkanya secara manual di halaman Dokter Penyimpanan setelah masuk.",
    ],
  },
  {
    slug: "hp-lemot",
    judul: "HP lemot",
    judulSeo: "HP Lemot? Penyebab & Cara Mempercepat Performa HP | Dokter HP",
    deskripsi:
      "HP lemot tidak selalu berarti HP sudah rusak. Kenali penyebab umum HP lambat — penyimpanan penuh, aplikasi menumpuk, sampai HP perlu dimulai ulang — dan cara mempercepatnya.",
    langkah: [
      "Mulai ulang HP. Tekan tombol daya, pilih Mulai ulang, dan tunggu sampai HP menyala lagi. Langkah sederhana ini menutup semua aplikasi yang berjalan dan sering membuat HP terasa ringan lagi.",
      "Tutup aplikasi yang tidak dipakai. Buka layar aplikasi terakhir (biasanya dengan menggeser dari bawah layar ke atas, atau menekan tombol kotak di bilah navigasi), lalu tutup aplikasi yang tidak sedang dipakai.",
      "Periksa penyimpanan HP. Buka Pengaturan, lalu Penyimpanan. Bila ruang kosong tinggal sedikit, HP bisa terasa berat — ikuti panduan penyimpanan penuh untuk mengosongkannya.",
      "Periksa apakah HP kepanasan. HP yang panas akan memperlambat dirinya sendiri untuk mendinginkan suhu. Bila HP terasa panas, hentikan pemakaian berat sebentar dan biarkan HP mendingin.",
      "Kurangi aplikasi yang berjalan bersamaan. Bila banyak aplikasi dibuka sekaligus, HP harus membagi tenaganya — tutup aplikasi berat seperti game atau video saat sedang tidak dipakai.",
      "Catatan: versi web Dokter HP tidak bisa menutup aplikasi lain atau membaca beban HP secara langsung. Untuk mencatat kondisi performa dari waktu ke waktu, isi datanya secara manual di halaman Dokter Performa setelah masuk, atau lihat pembacaan langsung di aplikasi Dokter HP di Android.",
      "Bila semua langkah di atas sudah dicoba dan HP tetap terasa lambat, bisa jadi HP sudah tidak kuat lagi untuk aplikasi yang dipakai, atau ada kerusakan perangkat. Dokter HP tidak bisa memperbaiki kerusakan perangkat — bawa HP ke teknisi untuk diperiksa lebih lanjut.",
    ],
  },
  {
    slug: "keamanan-hp",
    judul: "Cek keamanan HP",
    judulSeo:
      "Cek Keamanan HP: Izin Aplikasi Berbahaya yang Perlu Ditinjau | Dokter HP",
    deskripsi:
      "Beberapa aplikasi meminta izin yang tidak perlu — lokasi, kontak, hingga SMS. Pelajari cara memeriksa izin aplikasi di HP Anda dan meninjau aplikasi yang meminta terlalu banyak izin.",
    langkah: [
      "Pahami dulu apa itu izin aplikasi. Izin adalah persetujuan yang diberikan ke aplikasi untuk memakai sesuatu di HP — misalnya lokasi, kontak, kamera, mikrofon, atau pesan. Aplikasi yang meminta izin jauh lebih banyak dari yang dibutuhkannya patut dicurigai.",
      "Buka daftar aplikasi di HP. Buka Pengaturan, lalu Aplikasi, dan lihat semua aplikasi yang terpasang. Perhatikan apakah ada aplikasi yang tidak dikenal atau tidak pernah dipasang.",
      "Periksa izin tiap aplikasi yang dicurigai. Ketuk nama aplikasi, lalu ketuk Izin. Di sana terlihat izin apa saja yang sudah diberikan ke aplikasi itu.",
      "Cabut izin yang tidak perlu. Misalnya, aplikasi lampu senter tidak butuh akses ke kontak atau lokasi. Ketuk izin yang tidak masuk akal, lalu pilih untuk tidak mengizinkannya.",
      "Perhatikan aplikasi yang meminta banyak izin sekaligus. Di aplikasi Dokter HP di Android, bagian Perlu ditinjau menampilkan aplikasi yang meminta 4 izin berbahaya atau lebih — tinjau satu per satu.",
      "Hapus aplikasi yang tidak dikenal atau tidak dipakai lagi. Bila ada aplikasi yang tidak dikenal dan tidak bisa dijelaskan asalnya, hapus dari Pengaturan, lalu Aplikasi. Aplikasi sistem adalah bagian dari HP dan biasanya tidak bisa dihapus.",
      "Pasang aplikasi hanya dari toko aplikasi resmi. Aplikasi dari luar toko resmi tidak melewati pemeriksaan keamanan dan lebih berisiko membawa hal yang tidak diinginkan.",
      "Catatan: versi web tidak bisa memindai aplikasi di HP. Untuk pemindaian baru dan daftar izin berbahaya per aplikasi, jalankan Dokter Keamanan dari aplikasi Dokter HP di Android.",
    ],
  },
];

/** Cari panduan dari slug rute; undefined bila slug tidak dikenal. */
export function cariPanduan(slug: string): Panduan | undefined {
  return PANDUAN.find((p) => p.slug === slug);
}
