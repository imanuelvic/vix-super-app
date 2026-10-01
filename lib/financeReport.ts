import { activeCategories, categoryOf, FINANCE_TYPES, type FinanceType } from './categories';
import { MONTH_NAMES, monthId } from './format';
import type { Transaction } from './transactions';

// 📊 Laporan keuangan berkolom BULAN — bahan PDF yang bisa dipresentasikan.
//
// Bentuknya sengaja seperti lembar kerja yang sudah biasa dipakai: kategori
// turun ke bawah, bulan melintang ke samping, total di ujung kanan. Dengan
// begitu "Snacks bulan apa saja yang jebol" terjawab dengan menyapu satu baris
// mata, bukan membuka dua belas layar Monthly Review satu per satu.
//
// Berkas ini MURNI: tidak menyentuh Firestore, jaringan, jam sistem, maupun
// HTML. Dengan begitu seluruh angkanya bisa diuji dengan transaksi buatan,
// dan yang di PDF dijamin sama dengan yang dihitung di sini.
//
// Pembagian tugasnya:
//   lib/financeReport.ts     angka (berkas ini)
//   lib/financeReportPdf.ts  rupanya (tabel HTML + cetak + share sheet)

/** Berapa bulan ke belakang yang ditarik. */
export type ReportRange = 1 | 3 | 6 | 12;

export const REPORT_RANGES: { months: ReportRange; label: string; sub: string }[] = [
  { months: 1, label: '1 bulan', sub: 'bulan ini saja' },
  { months: 3, label: '3 bulan', sub: 'satu kuartal' },
  { months: 6, label: '6 bulan', sub: 'setengah tahun' },
  { months: 12, label: '12 bulan', sub: 'setahun penuh' },
];

export type ReportMonth = {
  id: string; // "2026-09"
  year: number;
  month: number; // 0-11
  /** "Sep" — judul kolom; tahunnya ikut kalau laporannya melintasi tahun. */
  label: string;
};

export type ReportRow = {
  key: string;
  /** "🍟 Snacks" */
  label: string;
  /** Satu angka per bulan, urut sama dengan `months`. */
  perMonth: number[];
  total: number;
};

export type ReportSection = {
  type: FinanceType;
  label: string;
  /** Hanya kategori yang PERNAH terpakai di rentang ini. */
  rows: ReportRow[];
  totalPerMonth: number[];
  total: number;
};

export type FinanceReport = {
  months: ReportMonth[];
  sections: ReportSection[];
  /** Income dikurangi expense + saving + investment, per bulan. */
  netPerMonth: number[];
  netTotal: number;
  /** Berapa transaksi yang masuk hitungan — penanda laporan ini kosong/tidak. */
  txCount: number;
};

const TYPE_LABEL: Record<FinanceType, string> = {
  income: '💰 Income',
  expense: '🛒 Expense',
  saving: '🏦 Saving',
  investment: '📈 Investment',
};

/**
 * Deret bulan yang BERAKHIR di (year, month), sebanyak `count`, urut dari yang
 * paling lama ke yang paling baru — arah baca tabelnya kiri ke kanan.
 *
 * Label bulannya menyebut tahun HANYA kalau laporannya melintasi pergantian
 * tahun. Di laporan 12 bulan itu wajib ("Jan" yang mana?), di laporan 3 bulan
 * dalam satu tahun ia cuma bikin judul kolom jadi sempit tanpa guna.
 */
export function reportMonths(
  year: number,
  month: number,
  count: ReportRange,
): ReportMonth[] {
  const out: ReportMonth[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    out.push({
      id: monthId(d.getFullYear(), d.getMonth()),
      year: d.getFullYear(),
      month: d.getMonth(),
      label: MONTH_NAMES[d.getMonth()].slice(0, 3),
    });
  }
  const lintasTahun = new Set(out.map((m) => m.year)).size > 1;
  return lintasTahun
    ? out.map((m) => ({ ...m, label: `${m.label} ${String(m.year).slice(2)}` }))
    : out;
}

/** Tanggal awal (inklusif) & akhir (eksklusif) deret bulan — untuk query. */
export function reportBounds(months: ReportMonth[]): { start: Date; end: Date } {
  const awal = months[0];
  const akhir = months[months.length - 1];
  return {
    start: new Date(awal.year, awal.month, 1),
    end: new Date(akhir.year, akhir.month + 1, 1),
  };
}

/**
 * Susun laporannya. MURNI.
 *
 * Transaksi di luar deret bulannya diabaikan diam-diam (bukan dibuang dari
 * hitungan lain): pemanggil boleh mengoper hasil query yang sedikit lebih
 * lebar tanpa angkanya jadi salah.
 *
 * Kategori yang NOL di seluruh rentang tidak ikut jadi baris. Laporan dengan
 * dua puluh baris nol cuma menyembunyikan baris yang benar-benar berisi.
 */
export function buildFinanceReport(
  items: Transaction[],
  months: ReportMonth[],
): FinanceReport {
  const indeks = new Map(months.map((m, i) => [m.id, i]));
  const n = months.length;
  const nol = () => new Array<number>(n).fill(0);

  // type → categoryKey → angka per bulan
  const kumpul = new Map<FinanceType, Map<string, number[]>>();
  for (const t of FINANCE_TYPES) kumpul.set(t, new Map());

  let txCount = 0;
  for (const t of items) {
    if (!t.date) continue;
    const d = t.date.toDate();
    const i = indeks.get(monthId(d.getFullYear(), d.getMonth()));
    if (i === undefined) continue;
    const perKategori = kumpul.get(t.type);
    if (!perKategori) continue; // jenis yang tidak dikenal: tidak dikarang
    if (!perKategori.has(t.category)) perKategori.set(t.category, nol());
    perKategori.get(t.category)![i] += t.amount;
    txCount += 1;
  }

  const sections: ReportSection[] = [];
  for (const type of FINANCE_TYPES) {
    const perKategori = kumpul.get(type)!;
    // Urutannya mengikuti daftar kategori app, bukan besarnya angka: laporan
    // bulan ini dan bulan depan harus bisa ditumpuk & dibandingkan baris per
    // baris. Kategori yang sudah dinonaktifkan tapi masih punya angka tetap
    // ikut, di ekor, supaya totalnya tidak pernah bocor.
    const urut = activeCategories(type).map((c) => c.key);
    const sisa = [...perKategori.keys()].filter((k) => !urut.includes(k)).sort();
    const rows: ReportRow[] = [];
    for (const key of [...urut, ...sisa]) {
      const perMonth = perKategori.get(key);
      if (!perMonth) continue;
      const total = perMonth.reduce((a, b) => a + b, 0);
      if (total === 0) continue;
      const cat = categoryOf(type, key);
      rows.push({ key, label: `${cat.icon} ${cat.label}`, perMonth, total });
    }
    const totalPerMonth = nol();
    for (const r of rows) for (let i = 0; i < n; i++) totalPerMonth[i] += r.perMonth[i];
    sections.push({
      type,
      label: TYPE_LABEL[type],
      rows,
      totalPerMonth,
      total: totalPerMonth.reduce((a, b) => a + b, 0),
    });
  }

  const byType = (t: FinanceType) => sections.find((s) => s.type === t)!.totalPerMonth;
  const income = byType('income');
  const keluar = ['expense', 'saving', 'investment'] as const;
  const netPerMonth = income.map(
    (masuk, i) => masuk - keluar.reduce((a, t) => a + byType(t)[i], 0),
  );

  return {
    months,
    sections,
    netPerMonth,
    netTotal: netPerMonth.reduce((a, b) => a + b, 0),
    txCount,
  };
}

/** Judul laporannya, mis. "September 2026" atau "Oktober 2025 sampai September 2026". */
export function reportTitle(months: ReportMonth[]): string {
  const awal = months[0];
  const akhir = months[months.length - 1];
  const nama = (m: ReportMonth) => `${MONTH_NAMES[m.month]} ${m.year}`;
  return months.length === 1 ? nama(akhir) : `${nama(awal)} sampai ${nama(akhir)}`;
}
