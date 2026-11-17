// apps/api/src/test/fake-d1.ts
// D1 tiruan berbasis memori untuk unit test rute.
// Mengimplementasikan permukaan D1Like (prepare/bind/all/first/run)
// dengan eksekutor SQL mini yang menangani pola query yang dipakai
// rute data: SELECT (WHERE =, IS NULL, <, >, LIKE, IN, cursor keyset,
// ORDER BY, LIMIT, OFFSET, COUNT(*)), INSERT (termasuk OR REPLACE dan
// ON CONFLICT DO UPDATE — penyalinan excluded.* maupun increment
// atomik `jumlah = rate_limits.jumlah + 1`), UPDATE (penetapan
// parameter maupun aritmetika `jumlah = jumlah - 1`), DELETE, dan
// PRAGMA.
// Setiap query yang dijalankan dicatat di `queries` agar test bisa
// menegaskan bahwa filter kepemilikan (user_id) selalu terikat.

import type { D1Like, D1ResultLike, D1StatementLike } from '../lib/db';

export type Row = Record<string, unknown>;
export type Seed = Record<string, Row[]>;

export interface QueryTercatat {
  sql: string;
  params: unknown[];
}

type Kondisi =
  | { kind: 'eq'; col: string; param: number }
  | { kind: 'lt'; col: string; param: number }
  | { kind: 'gt'; col: string; param: number }
  | { kind: 'lte'; col: string; param: number }
  | { kind: 'gte'; col: string; param: number }
  | { kind: 'like'; col: string; param: number }
  | { kind: 'isNull'; col: string }
  | { kind: 'isNotNull'; col: string }
  | { kind: 'isNullOrLte'; col: string; param: number }
  | { kind: 'in'; col: string; params: number[] }
  | { kind: 'cursor'; params: [number, number, number] };

/** Mengubah pola LIKE SQL (%, _) menjadi RegExp. */
function polaLikeKeRegex(pola: string): RegExp {
  const lolos = pola.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${lolos.replace(/%/g, '.*').replace(/_/g, '.')}$`, 's');
}

/** Kunci unik per tabel untuk INSERT OR REPLACE / OR IGNORE. */
const KUNCI_UNIK: Record<string, string[]> = {
  wifi_sustained_samples: ['wifi_report_id', 'detik_ke'],
  rate_limits: ['kunci'],
  pin_attempts: ['user_id'],
};

function normalisasi(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/** Membagi klausa WHERE berdasarkan AND di tingkat atas (di luar kurung). */
function bagiAnd(where: string): string[] {
  const bagian: string[] = [];
  let dalam = 0;
  let mulai = 0;
  const rendah = where.toLowerCase();
  for (let i = 0; i < where.length; i++) {
    const kar = where[i];
    if (kar === '(') dalam++;
    else if (kar === ')') dalam--;
    if (dalam === 0 && rendah.startsWith(' and ', i)) {
      // ' and ' dengan spasi di kedua sisi selalu AND mandiri;
      // tidak perlu cek karakter sebelumnya (dulu penjaga batas
      // kata di sini menolak '?' sehingga "id = ? AND user_id = ?"
      // gagal diurai).
      bagian.push(where.slice(mulai, i).trim());
      mulai = i + 5;
      i += 4;
    }
  }
  bagian.push(where.slice(mulai).trim());
  return bagian.filter((b) => b.length > 0);
}

function banding(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  return String(a) < String(b) ? -1 : 1;
}

export class FakeD1 implements D1Like {
  tables: Record<string, Row[]> = {};
  queries: QueryTercatat[] = [];

  constructor(seed: Seed = {}) {
    for (const [tabel, baris] of Object.entries(seed)) {
      this.tables[tabel] = baris.map((b) => ({ ...b }));
    }
  }

  prepare(query: string): D1StatementLike {
    return new FakeStatement(this, normalisasi(query));
  }

  /** Baris pada sebuah tabel (salinan, untuk asersi test). */
  baris(tabel: string): Row[] {
    return (this.tables[tabel] ?? []).map((b) => ({ ...b }));
  }
}

class FakeStatement implements D1StatementLike {
  private params: unknown[] = [];

  constructor(
    private db: FakeD1,
    private sql: string,
  ) {}

  bind(...params: unknown[]): D1StatementLike {
    this.params = params;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    const hasil = this.jalankan();
    return { results: hasil.rows as T[], success: true, meta: { changes: hasil.changes } };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const hasil = this.jalankan();
    return (hasil.rows[0] as T | undefined) ?? null;
  }

  async run(): Promise<D1ResultLike> {
    const hasil = this.jalankan();
    return { results: [], success: true, meta: { changes: hasil.changes } };
  }

  private jalankan(): { rows: Row[]; changes: number } {
    this.db.queries.push({ sql: this.sql, params: [...this.params] });
    const rendah = this.sql.toLowerCase();
    if (rendah.startsWith('pragma')) return { rows: [], changes: 0 };
    if (rendah.startsWith('insert')) return this.jalankanInsert();
    if (rendah.startsWith('select')) return this.jalankanSelect();
    if (rendah.startsWith('update')) return this.jalankanUpdate();
    if (rendah.startsWith('delete')) return this.jalankanDelete();
    throw new Error(`FakeD1: SQL tidak didukung: ${this.sql}`);
  }

  // -- parsing klausa WHERE ------------------------------------------------

  private uraiKondisi(where: string, awalParam: number): { kondisi: Kondisi[]; akhirParam: number } {
    const kondisi: Kondisi[] = [];
    let indeksParam = awalParam;
    for (const mentah of bagiAnd(where)) {
      const teks = mentah.trim();
      const rendah = teks.toLowerCase();
      let cocok: RegExpMatchArray | null;
      if ((cocok = rendah.match(/^(\w+)\s+is not null$/))) {
        kondisi.push({ kind: 'isNotNull', col: cocok[1] as string });
      } else if ((cocok = rendah.match(/^(\w+)\s+is null$/))) {
        kondisi.push({ kind: 'isNull', col: cocok[1] as string });
      } else if (
        (cocok = rendah.match(/^\(\s*(\w+)\s+is null\s+or\s+(\w+)\s*<=\s*\?\)$/)) &&
        cocok[1] === cocok[2]
      ) {
        // Guard atomik penguncian PIN: kunci hanya bila belum ada
        // kunci aktif (null atau sudah kedaluwarsa).
        kondisi.push({ kind: 'isNullOrLte', col: cocok[1] as string, param: indeksParam++ });
      } else if (
        (cocok = rendah.match(
          /^\(\s*dibuat_pada\s*<\s*\?\s+or\s*\(\s*dibuat_pada\s*=\s*\?\s+and\s+id\s*<\s*\?\)\s*\)$/,
        ))
      ) {
        kondisi.push({
          kind: 'cursor',
          params: [indeksParam, indeksParam + 1, indeksParam + 2] as [number, number, number],
        });
        indeksParam += 3;
      } else if ((cocok = rendah.match(/^(\w+)\s+in\s*\(([\s?,]+)\)$/))) {
        const jumlah = (cocok[2] as string).split(',').filter((p) => p.trim() === '?').length;
        const daftar: number[] = [];
        for (let i = 0; i < jumlah; i++) daftar.push(indeksParam++);
        kondisi.push({ kind: 'in', col: cocok[1] as string, params: daftar });
      } else if ((cocok = rendah.match(/^(\w+)\s+like\s*\?$/))) {
        kondisi.push({ kind: 'like', col: cocok[1] as string, param: indeksParam++ });
      } else if ((cocok = rendah.match(/^(\w+)\s*(<=|>=|<|>|=)\s*\?$/))) {
        const op = cocok[2] as string;
        const kind =
          op === '=' ? 'eq' : op === '<' ? 'lt' : op === '>' ? 'gt' : op === '<=' ? 'lte' : 'gte';
        kondisi.push({ kind, col: cocok[1] as string, param: indeksParam++ });
      } else {
        throw new Error(`FakeD1: kondisi WHERE tidak didukung: ${teks}`);
      }
    }
    return { kondisi, akhirParam: indeksParam };
  }

  private cocok(row: Row, kondisi: Kondisi[]): boolean {
    for (const k of kondisi) {
      switch (k.kind) {
        case 'eq':
          if (row[k.col] !== this.params[k.param]) return false;
          break;
        case 'lt':
          if (!(banding(row[k.col], this.params[k.param]) < 0)) return false;
          break;
        case 'gt':
          if (!(banding(row[k.col], this.params[k.param]) > 0)) return false;
          break;
        case 'lte':
          if (!(banding(row[k.col], this.params[k.param]) <= 0)) return false;
          break;
        case 'gte':
          if (!(banding(row[k.col], this.params[k.param]) >= 0)) return false;
          break;
        case 'like': {
          const pola = this.params[k.param];
          const nilai = row[k.col];
          if (typeof pola !== 'string' || typeof nilai !== 'string') return false;
          if (!polaLikeKeRegex(pola).test(nilai)) return false;
          break;
        }
        case 'isNull':
          if (row[k.col] !== null && row[k.col] !== undefined) return false;
          break;
        case 'isNullOrLte': {
          const nilai = row[k.col];
          if (nilai === null || nilai === undefined) break;
          if (!(banding(nilai, this.params[k.param]) <= 0)) return false;
          break;
        }
        case 'isNotNull':
          if (row[k.col] === null || row[k.col] === undefined) return false;
          break;
        case 'in': {
          const nilai = k.params.map((i) => this.params[i]);
          if (!nilai.includes(row[k.col])) return false;
          break;
        }
        case 'cursor': {
          const [p0, p1, p2] = k.params;
          const dibuat = row.dibuat_pada as string;
          const id = row.id as string;
          const lewat =
            banding(dibuat, this.params[p0]) < 0 ||
            (dibuat === this.params[p1] && banding(id, this.params[p2]) < 0);
          if (!lewat) return false;
          break;
        }
      }
    }
    return true;
  }

  private pisahSelect(): {
    tabel: string;
    where: string | null;
    orderBy: { col: string; turun: boolean }[];
    limitParam: number | null;
    limitLiteral: number | null;
    offsetParam: number | null;
    offsetLiteral: number | null;
    countAlias: string | null;
  } {
    const sql = this.sql;
    const rendah = sql.toLowerCase();
    const dari = rendah.indexOf(' from ');
    if (dari === -1) throw new Error(`FakeD1: SELECT tanpa FROM: ${sql}`);
    const daftarKolom = sql.slice(0, dari).replace(/^select\s+/i, '');
    const countCocok = daftarKolom.match(/count\(\*\)\s+as\s+(\w+)/i);
    let sisa = sql.slice(dari + 6);
    const rendahSisa = sisa.toLowerCase();
    let tabel = sisa;
    let where: string | null = null;
    let orderBy: { col: string; turun: boolean }[] = [];
    let limitParam: number | null = null;
    let limitLiteral: number | null = null;
    let offsetParam: number | null = null;
    let offsetLiteral: number | null = null;
    const idxWhere = rendahSisa.indexOf(' where ');
    const idxOrder = rendahSisa.indexOf(' order by ');
    const idxLimit = rendahSisa.indexOf(' limit ');
    const idxOffset = rendahSisa.indexOf(' offset ');
    const potongTabel = [idxWhere, idxOrder, idxLimit, idxOffset].filter((i) => i !== -1);
    const akhirTabel = potongTabel.length > 0 ? Math.min(...potongTabel) : sisa.length;
    tabel = sisa.slice(0, akhirTabel).trim();
    if (idxWhere !== -1) {
      const akhir = [idxOrder, idxLimit, idxOffset].filter((i) => i !== -1);
      const akhirWhere = akhir.length > 0 ? Math.min(...akhir) : sisa.length;
      where = sisa.slice(idxWhere + 7, akhirWhere).trim();
    }
    if (idxOrder !== -1) {
      const akhirBatas = [idxLimit, idxOffset].filter((i) => i !== -1);
      const akhir = akhirBatas.length > 0 ? Math.min(...akhirBatas) : sisa.length;
      const teksOrder = sisa.slice(idxOrder + 10, akhir).trim();
      orderBy = teksOrder.split(',').map((b) => {
        const [col, arah] = b.trim().split(/\s+/);
        return { col: col as string, turun: (arah ?? 'asc').toLowerCase() === 'desc' };
      });
    }
    if (idxLimit !== -1) {
      const akhirLimit = idxOffset !== -1 ? idxOffset : sisa.length;
      const teksLimit = sisa.slice(idxLimit + 7, akhirLimit).trim();
      if (teksLimit === '?') limitParam = -1; // diisi dari urutan param
      else limitLiteral = Number.parseInt(teksLimit, 10);
    }
    if (idxOffset !== -1) {
      const teksOffset = sisa.slice(idxOffset + 8).trim();
      if (teksOffset === '?') offsetParam = -1; // diisi dari urutan param
      else offsetLiteral = Number.parseInt(teksOffset, 10);
    }
    return { tabel, where, orderBy, limitParam, limitLiteral, offsetParam, offsetLiteral, countAlias: countCocok ? (countCocok[1] as string) : null };
  }

  // -- eksekusi ------------------------------------------------------------

  private jalankanSelect(): { rows: Row[]; changes: number } {
    const { tabel, where, orderBy, limitParam, limitLiteral, offsetParam, offsetLiteral, countAlias } = this.pisahSelect();
    let baris = [...(this.db.tables[tabel] ?? [])];
    let akhirParam = 0;
    if (where) {
      const { kondisi, akhirParam: akhir } = this.uraiKondisi(where, 0);
      akhirParam = akhir;
      baris = baris.filter((r) => this.cocok(r, kondisi));
    }
    if (countAlias) {
      return { rows: [{ [countAlias]: baris.length }], changes: 0 };
    }
    if (orderBy.length > 0) {
      baris.sort((a, b) => {
        for (const { col, turun } of orderBy) {
          const hasil = banding(a[col], b[col]);
          if (hasil !== 0) return turun ? -hasil : hasil;
        }
        return 0;
      });
    }
    let batas: number | null = null;
    if (limitParam !== null) {
      batas = this.params[akhirParam] as number;
      akhirParam++;
    } else if (limitLiteral !== null) {
      batas = limitLiteral;
    }
    let lewati = 0;
    if (offsetParam !== null) {
      lewati = this.params[akhirParam] as number;
    } else if (offsetLiteral !== null) {
      lewati = offsetLiteral;
    }
    if (lewati > 0) baris = baris.slice(lewati);
    if (batas !== null) baris = baris.slice(0, batas);
    return { rows: baris.map((b) => ({ ...b })), changes: 0 };
  }

  private jalankanInsert(): { rows: Row[]; changes: number } {
    const cocok = this.sql.match(
      /^insert(?: or replace| or ignore)? into (\w+) \(([^)]+)\) values \(([^)]+)\)(?: on conflict\((\w+)\) do update set (.+))?$/i,
    );
    if (!cocok) throw new Error(`FakeD1: INSERT tidak didukung: ${this.sql}`);
    const [, tabel, kolomTeks, nilaiTeks, konflikKol, setTeks] = cocok as unknown as [
      string,
      string,
      string,
      string,
      string | undefined,
      string | undefined,
    ];
    const ganti = this.sql.toLowerCase().startsWith('insert or replace');
    const abaikan = this.sql.toLowerCase().startsWith('insert or ignore');
    const kolom = kolomTeks.split(',').map((k) => k.trim());
    const nilai = nilaiTeks.split(',').map((n) => n.trim());
    const barisBaru: Row = {};
    let indeksParam = 0;
    for (let i = 0; i < kolom.length; i++) {
      const token = nilai[i] as string;
      if (token === '?') {
        barisBaru[kolom[i] as string] = this.params[indeksParam++];
      } else if (token.toLowerCase() === 'null') {
        barisBaru[kolom[i] as string] = null;
      } else if (/^-?\d+(\.\d+)?$/.test(token)) {
        // Literal angka (mis. VALUES (?, 1, ?, ?) pada upsert atomik).
        barisBaru[kolom[i] as string] = Number(token);
      } else if (/^'.*'$/.test(token)) {
        // Literal string SQL ('synced') — valid di D1 nyata.
        // Keterbatasan: literal yang mengandung koma tidak didukung
        // karena pemisahan nilai memakai koma.
        barisBaru[kolom[i] as string] = token.slice(1, -1).replace(/''/g, "'");
      } else {
        throw new Error(`FakeD1: nilai INSERT tidak didukung: ${token}`);
      }
    }
    const tabelBaris = (this.db.tables[tabel] ??= []);
    // ON CONFLICT ... DO UPDATE: perbarui baris yang sudah ada.
    if (konflikKol && setTeks) {
      const kunci = barisBaru[konflikKol];
      const lama = tabelBaris.find((r) => r[konflikKol] === kunci);
      if (lama) {
        for (const tugas of setTeks.split(',').map((s) => s.trim())) {
          // Penyalinan dari nilai yang diusulkan: col = excluded.col.
          const m = tugas.match(/^(\w+)\s*=\s*excluded\.(\w+)$/);
          if (m) {
            lama[m[1] as string] = barisBaru[m[2] as string];
            continue;
          }
          // Increment/decrement atomik: col = [tabel.]col +/- N.
          // Dipakai rate limit (jumlah) dan penghitung PIN gagal.
          const hitung = tugas.match(
            /^(\w+)\s*=\s*(?:\w+\.)?(\w+)\s*([+-])\s*(\d+)$/,
          );
          if (hitung) {
            const [, target, sumber, op, angka] = hitung as unknown as [
              string,
              string,
              string,
              string,
              string,
            ];
            if (target !== sumber) {
              throw new Error(`FakeD1: SET ON CONFLICT tidak didukung: ${tugas}`);
            }
            const nilaiLama = lama[target] as number;
            lama[target] = op === '+' ? nilaiLama + Number(angka) : nilaiLama - Number(angka);
            continue;
          }
          throw new Error(`FakeD1: SET ON CONFLICT tidak didukung: ${tugas}`);
        }
        return { rows: [], changes: 1 };
      }
      tabelBaris.push(barisBaru);
      return { rows: [], changes: 1 };
    }
    if (ganti) {
      const kunci = KUNCI_UNIK[tabel] ?? ['id'];
      const idx = tabelBaris.findIndex((r) => kunci.every((k) => r[k] === barisBaru[k]));
      if (idx !== -1) tabelBaris.splice(idx, 1);
    }
    if (abaikan) {
      // INSERT OR IGNORE: baris dengan kunci unik yang sama dibiarkan,
      // tanpa galat dan tanpa perubahan (changes 0).
      const kunci = KUNCI_UNIK[tabel] ?? ['id'];
      const ada = tabelBaris.some((r) => kunci.every((k) => r[k] === barisBaru[k]));
      if (ada) {
        return { rows: [], changes: 0 };
      }
    }
    tabelBaris.push(barisBaru);
    return { rows: [], changes: 1 };
  }

  private jalankanUpdate(): { rows: Row[]; changes: number } {
    const cocok = this.sql.match(/^update (\w+) set (.+?) where (.+)$/i);
    if (!cocok) throw new Error(`FakeD1: UPDATE tidak didukung: ${this.sql}`);
    const [, tabel, setTeks, where] = cocok as unknown as [string, string, string, string];
    const tugas = setTeks.split(',').map((s) => s.trim());
    const penetapan: { col: string; param: number }[] = [];
    const aritmetika: { col: string; op: '+' | '-'; angka: number }[] = [];
    let indeksParam = 0;
    for (const t of tugas) {
      // Aritmetika atas nilai lama: col = [tabel.]col +/- N
      // (dipakai pelepasan cadangan kuota AI: jumlah = jumlah - 1).
      const hitung = t.match(/^(\w+)\s*=\s*(?:\w+\.)?(\w+)\s*([+-])\s*(\d+)$/);
      if (hitung) {
        const [, target, sumber, op, angka] = hitung as unknown as [
          string,
          string,
          string,
          string,
          string,
        ];
        if (target !== sumber) throw new Error(`FakeD1: SET UPDATE tidak didukung: ${t}`);
        aritmetika.push({ col: target, op: op as '+' | '-', angka: Number(angka) });
        continue;
      }
      const m = t.match(/^(\w+)\s*=\s*\?$/);
      if (!m) throw new Error(`FakeD1: SET UPDATE tidak didukung: ${t}`);
      penetapan.push({ col: m[1] as string, param: indeksParam++ });
    }
    const { kondisi } = this.uraiKondisi(where, indeksParam);
    let berubah = 0;
    for (const row of this.db.tables[tabel] ?? []) {
      if (!this.cocok(row, kondisi)) continue;
      for (const p of penetapan) row[p.col] = this.params[p.param];
      for (const a of aritmetika) {
        const nilaiLama = row[a.col] as number;
        row[a.col] = a.op === '+' ? nilaiLama + a.angka : nilaiLama - a.angka;
      }
      berubah++;
    }
    return { rows: [], changes: berubah };
  }

  private jalankanDelete(): { rows: Row[]; changes: number } {
    const cocok = this.sql.match(/^delete from (\w+)(?: where (.+))?$/i);
    if (!cocok) throw new Error(`FakeD1: DELETE tidak didukung: ${this.sql}`);
    const [, tabel, where] = cocok as unknown as [string, string, string | undefined];
    const lama = this.db.tables[tabel] ?? [];
    if (!where) {
      this.db.tables[tabel] = [];
      return { rows: [], changes: lama.length };
    }
    const { kondisi } = this.uraiKondisi(where, 0);
    const sisa = lama.filter((r) => !this.cocok(r, kondisi));
    const berubah = lama.length - sisa.length;
    this.db.tables[tabel] = sisa;
    return { rows: [], changes: berubah };
  }
}
