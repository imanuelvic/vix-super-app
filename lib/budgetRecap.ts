import { budgetKey, type BudgetDoc } from './budgets';
import {
  categoryOf,
  FINANCE_CATEGORIES,
  type FinanceType,
} from './categories';
import { monthId } from './format';
import type { Transaction } from './transactions';

// 📊 Rekap Budgeting — setahun penuh dalam satu tabel.
//
// Sub-tab Budgeting menjawab "bulan ini berapa?". Yang TIDAK bisa dijawabnya:
// "Food Drink tahun ini aku anggarkan berapa saja, dan bulan mana yang jebol?".
// Untuk itu harus membuka dua belas bulan satu per satu lalu mengingat sendiri.
//
// Di sini keduanya berdampingan dalam bentuk yang sama: kategori turun ke
// bawah, bulan melintang ke samping. Satu sakelar menukar isinya antara
// RENCANA (budget yang ditetapkan) dan KENYATAAN (realisasi dari transaksi),
// jadi membandingkan keduanya cuma perlu satu click, bukan dua layar.
//
// MURNI: tidak menyentuh Firestore maupun jam sistem.

export type RecapMode = 'budget' | 'realisasi';

export type RecapRow = {
  key: string;
  /** Nama kategori beserta emojinya, mis. "🍛 Food Drink". */
  label: string;
  /** Dua belas bulan, Januari sampai Desember. */
  perMonth: number[];
  total: number;
  /** Rata-rata dari bulan yang nilainya BUKAN nol. */
  average: number;
  /** Berapa bulan yang ada isinya. */
  months: number;
};

export type BudgetRecap = {
  year: number;
  type: FinanceType;
  mode: RecapMode;
  rows: RecapRow[];
  /** Jumlah seluruh kategori per bulan. */
  totalPerMonth: number[];
  total: number;
  /** Rata-rata total bulanan, dari bulan yang ada isinya. */
  average: number;
};

const KOSONG = (): number[] => Array(12).fill(0);

/**
 * Realisasi per kategori per bulan, dari transaksi setahun.
 *
 * Transaksi di luar `year` diabaikan, jadi pemanggil boleh mengirim rentang
 * yang lebih lebar tanpa angkanya jadi salah.
 */
function realisasiOf(
  items: Transaction[],
  type: FinanceType,
  year: number,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const t of items) {
    if (t.type !== type) continue;
    const d = t.date.toDate();
    if (d.getFullYear() !== year) continue;
    const baris = out.get(t.category) ?? KOSONG();
    baris[d.getMonth()] += t.amount;
    out.set(t.category, baris);
  }
  return out;
}

/**
 * Budget per kategori per bulan, dari dokumen budget tiap bulan.
 *
 * Sub-budget ("jenis:kategori:sub") SENGAJA tidak ikut dijumlah: nominalnya
 * sudah termasuk di budget kategorinya, jadi menjumlah keduanya bikin angkanya
 * dobel. Aturan yang sama berlaku di `totalBudgetOf` (lihat lib/budgets.ts).
 */
function budgetOf(
  docs: Record<string, BudgetDoc>,
  type: FinanceType,
  year: number,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (let m = 0; m < 12; m++) {
    const alokasi = docs[monthId(year, m)]?.allocations ?? {};
    for (const c of FINANCE_CATEGORIES[type]) {
      const nilai = alokasi[budgetKey(type, c.key)] ?? 0;
      if (nilai === 0) continue;
      const baris = out.get(c.key) ?? KOSONG();
      baris[m] = nilai;
      out.set(c.key, baris);
    }
  }
  return out;
}

function baris(key: string, type: FinanceType, perMonth: number[]): RecapRow {
  const terisi = perMonth.filter((v) => v !== 0);
  const total = perMonth.reduce((a, b) => a + b, 0);
  const kategori = categoryOf(type, key);
  return {
    key,
    label: `${kategori.icon} ${kategori.label}`,
    perMonth,
    total,
    months: terisi.length,
    average: terisi.length > 0 ? Math.round(total / terisi.length) : 0,
  };
}

/**
 * Susun rekap setahun.
 *
 * Urutan barisnya mengikuti daftar kategori app, BUKAN besar angkanya, supaya
 * rekap dua tahun berbeda bisa ditumpuk dan dibandingkan baris per baris.
 * Kategori yang nol sepanjang tahun tidak ditampilkan: dua belas kolom titik
 * cuma memanjangkan tabel tanpa menambah satu pun jawaban.
 */
export function buildBudgetRecap({
  year,
  type,
  mode,
  budgets,
  items,
}: {
  year: number;
  type: FinanceType;
  mode: RecapMode;
  /** monthId ("YYYY-MM") → dokumen budget bulan itu. */
  budgets: Record<string, BudgetDoc>;
  items: Transaction[];
}): BudgetRecap {
  const sumber =
    mode === 'budget'
      ? budgetOf(budgets, type, year)
      : realisasiOf(items, type, year);

  const rows: RecapRow[] = [];
  for (const c of FINANCE_CATEGORIES[type]) {
    const perMonth = sumber.get(c.key);
    if (!perMonth) continue;
    const r = baris(c.key, type, perMonth);
    if (r.total === 0) continue;
    rows.push(r);
  }

  const totalPerMonth = KOSONG();
  for (const r of rows) {
    r.perMonth.forEach((v, i) => {
      totalPerMonth[i] += v;
    });
  }
  const total = totalPerMonth.reduce((a, b) => a + b, 0);
  const terisi = totalPerMonth.filter((v) => v !== 0).length;

  return {
    year,
    type,
    mode,
    rows,
    totalPerMonth,
    total,
    average: terisi > 0 ? Math.round(total / terisi) : 0,
  };
}

/**
 * Selisih rencana dengan kenyataan per bulan, untuk PDF yang memuat keduanya.
 * Positif = kenyataannya LEBIH BESAR daripada yang dianggarkan.
 */
export function recapGap(budget: BudgetRecap, realisasi: BudgetRecap): number[] {
  return realisasi.totalPerMonth.map((v, i) => v - budget.totalPerMonth[i]);
}
