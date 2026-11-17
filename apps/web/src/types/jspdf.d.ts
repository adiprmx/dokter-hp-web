// Deklarasi tipe lokal minimal untuk modul "jspdf".
//
// Paket jspdf BELUM terpasang di proyek ini (lihat laporan Tim Frontend
// Riwayat + PDF: "jspdf" adalah dependensi yang dibutuhkan dan akan
// dipasang tim integrasi). Deklarasi ini membuat typecheck lolos tanpa
// paket terpasang, dan hanya mendeklarasikan anggota API yang dipakai
// oleh src/lib/pdf.ts — bukan seluruh permukaan API jsPDF.
//
// Bila paket asli sudah terpasang, deklarasi ini tetap aman: TypeScript
// memakai tipe bawaan paket bila tersedia, dan deklarasi lokal ini hanya
// menjadi cadangan. Jangan menambah anggota ke deklarasi ini tanpa
// memeriksa dokumentasi jsPDF yang terpasang.
declare module "jspdf" {
  export interface JsPdfOptions {
    orientation?: "portrait" | "landscape";
    unit?: "pt" | "mm" | "cm" | "in";
    format?: string | number[];
  }

  export interface JsPdfPageSize {
    getWidth(): number;
    getHeight(): number;
  }

  export class jsPDF {
    constructor(options?: JsPdfOptions);
    internal: { pageSize: JsPdfPageSize };
    setFontSize(size: number): jsPDF;
    setFont(fontName: string, fontStyle?: string): jsPDF;
    text(text: string | string[], x: number, y: number): jsPDF;
    splitTextToSize(text: string, maxWidth: number): string[];
    addPage(): jsPDF;
    setPage(page: number): jsPDF;
    getNumberOfPages(): number;
    save(filename: string): void;
  }

  export default jsPDF;
}
