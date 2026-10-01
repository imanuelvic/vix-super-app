import type { ReviewYear } from './financeReview';
import type { FundEntry } from './saku';

// 🚨 Emergency Fund & 🪑 Pension Fund — berapa yang harus dikejar, dan sudah
// sampai mana.
//
// ── Dari mana angka targetnya ─────────────────────────────────────────────
// Pemilik app sudah punya kedua angka ini di spreadsheet-nya sejak lama, di
// panel kanan tiap tahun Financial Review. Rumusnya tidak pernah ditulis di
// sana, jadi dicari balik dari angkanya dan DIBUKTIKAN cocok persis di seluruh
// tahun yang punya datanya (2023 sampai 2026):
//
//   Emergency Fund = rata-rata PEMASUKAN bulanan × 5
//   Pension Fund   = rata-rata PENGELUARAN bulanan × 300   (25 tahun × 12)
//
// Dua rumus itu dipakai apa adanya di sini, bukan diganti dengan patokan umum
// "3 sampai 6 bulan pengeluaran". Alasannya sederhana: angka yang berselisih
// dengan lembar yang sudah dibaca bertahun-tahun akan terbaca sebagai salah
// hitung, bukan sebagai patokan yang lebih baik.
//
// ── Kenapa dihitung, bukan diketik ────────────────────────────────────────
// Target yang diketik tangan langsung basi begitu penghasilan atau gaya
// hidupnya berubah, dan tidak ada yang mengingatkan. Dihitung dari rata-rata
// bulanan yang memang sudah tercatat, ia ikut bergerak sendiri.

/** Berapa kali rata-rata pemasukan bulanan yang harus ada sebagai dana darurat. */
export const EMERGENCY_MULTIPLIER = 5;

/** 25 tahun × 12 bulan pengeluaran — itulah dana pensiunnya. */
export const PENSION_MONTHS = 300;

export type FundTarget = {
  /** Nominal yang harus dikejar. */
  target: number;
  /** Rata-rata bulanan yang jadi dasarnya. */
  perMonth: number;
  /** Berapa bulan tercatat yang ikut dirata-rata. 0 = belum bisa dihitung. */
  months: number;
};

/**
 * Rata-rata bulanan dari BEBERAPA tahun terakhir yang ada isinya.
 *
 * Bukan cuma tahun berjalan: di bulan Januari, tahun berjalan baru punya satu
 * bulan, dan target yang dihitung dari satu bulan ikut melompat tiap kali satu
 * transaksi besar masuk. `tahunDipakai` tahun terakhir yang ADA ISINYA sudah
 * cukup meredam itu tanpa menyeret angka sepuluh tahun lalu.
 */
function rataBulanan(
  years: ReviewYear[],
  ambil: (y: ReviewYear) => { total: number; months: number },
  tahunDipakai: number,
): { per: number; months: number } {
  let total = 0;
  let months = 0;
  let dipakai = 0;
  // `years` sudah terurut terbaru di depan (lihat lib/financeReview.ts).
  for (const y of years) {
    const baris = ambil(y);
    if (baris.months === 0) continue;
    total += baris.total;
    months += baris.months;
    dipakai += 1;
    if (dipakai >= tahunDipakai) break;
  }
  return { per: months > 0 ? total / months : 0, months };
}

/** Berapa tahun terakhir yang ikut dirata-rata. */
export const TARGET_YEARS = 2;

/** 🚨 Dana darurat: rata-rata pemasukan bulanan × 5. */
export function emergencyTarget(years: ReviewYear[]): FundTarget {
  const { per, months } = rataBulanan(years, (y) => y.income, TARGET_YEARS);
  return {
    target: Math.round(per * EMERGENCY_MULTIPLIER),
    perMonth: Math.round(per),
    months,
  };
}

/** 🪑 Dana pensiun: rata-rata pengeluaran bulanan × 300. */
export function pensionTarget(years: ReviewYear[]): FundTarget {
  const { per, months } = rataBulanan(years, (y) => y.expense, TARGET_YEARS);
  return {
    target: Math.round(per * PENSION_MONTHS),
    perMonth: Math.round(per),
    months,
  };
}

// ===================== Kemajuan =====================

export type FundProgress = {
  /** Sudah terkumpul. */
  saved: number;
  target: number;
  /** Sisa yang harus dikejar; 0 kalau targetnya sudah terlampaui. */
  short: number;
  /** 0 sampai 100, dipatok 100 supaya bar tidak meluber. */
  percent: number;
  /** Targetnya sudah tercapai? */
  done: boolean;
};

export function fundProgress(saved: number, target: number): FundProgress {
  const aman = Math.max(0, target);
  const persen = aman > 0 ? (saved / aman) * 100 : 0;
  return {
    saved,
    target: aman,
    short: Math.max(0, aman - saved),
    percent: Math.max(0, Math.min(100, persen)),
    done: aman > 0 && saved >= aman,
  };
}

/**
 * Berapa bulan lagi sampai targetnya tercapai, kalau menabung `perBulan`.
 * `null` = belum bisa dijawab (belum pernah menabung, atau sudah tercapai).
 */
export function monthsToTarget(
  progress: FundProgress,
  perBulan: number,
): number | null {
  if (progress.done || perBulan <= 0) return null;
  return Math.ceil(progress.short / perBulan);
}

// ===================== Mutasi beserta saldo berjalannya =====================

export type FundRow = {
  entry: FundEntry;
  /** Saldo SESUDAH mutasi ini — kolom "Accumulated Funds" di lembar aslinya. */
  running: number;
};

/**
 * Mutasi + saldo berjalannya, TERBARU DI DEPAN.
 *
 * Saldo berjalan dihitung dari yang paling lama: itu satu-satunya arah yang
 * benar. Lalu dibalik untuk ditampilkan, karena yang paling ingin dilihat
 * adalah mutasi terakhir. Inilah yang membuat daftar ini beda dari mutasi
 * Saku biasa: tiap baris menjawab "waktu itu sudah terkumpul berapa".
 */
export function fundRows(entries: FundEntry[]): FundRow[] {
  const lama = [...entries].sort(
    (a, b) => a.date.toMillis() - b.date.toMillis(),
  );
  let saldo = 0;
  const out: FundRow[] = [];
  for (const entry of lama) {
    saldo += entry.direction === 'debit' ? entry.amount : -entry.amount;
    out.push({ entry, running: saldo });
  }
  return out.reverse();
}

/** Jumlah uang MASUK & KELUAR seluruh mutasi. */
export function fundFlow(entries: FundEntry[]): {
  addition: number;
  reduction: number;
} {
  let addition = 0;
  let reduction = 0;
  for (const e of entries) {
    if (e.direction === 'debit') addition += e.amount;
    else reduction += e.amount;
  }
  return { addition, reduction };
}

/**
 * Rata-rata setoran per bulan, dari bulan-bulan yang BENAR-BENAR ada
 * setorannya. Dipakai menjawab "berapa bulan lagi sampai target".
 */
export function averageDeposit(entries: FundEntry[]): number {
  const perBulan = new Map<string, number>();
  for (const e of entries) {
    if (e.direction !== 'debit') continue;
    const d = e.date.toDate();
    const id = `${d.getFullYear()}-${d.getMonth()}`;
    perBulan.set(id, (perBulan.get(id) ?? 0) + e.amount);
  }
  if (perBulan.size === 0) return 0;
  let total = 0;
  for (const v of perBulan.values()) total += v;
  return Math.round(total / perBulan.size);
}
