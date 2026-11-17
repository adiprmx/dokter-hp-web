// Utilitas format angka untuk tampilan.
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const satuan = ["B", "KB", "MB", "GB", "TB"];
  let nilai = bytes;
  let indeks = 0;
  while (nilai >= 1024 && indeks < satuan.length - 1) {
    nilai /= 1024;
    indeks += 1;
  }
  const teks = nilai >= 100 || Number.isInteger(nilai) ? nilai.toFixed(0) : nilai.toFixed(1);
  return `${teks} ${satuan[indeks]}`;
}
