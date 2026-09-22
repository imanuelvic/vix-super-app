import { budgetKey, totalBudgetOf, type BudgetDoc, type BudgetMap } from './budgets';
import {
  categoryOf,
  dailyPaceCategories,
  FINANCE_CATEGORIES,
  type FinanceCategory,
  type FinanceType,
} from './categories';
import { MONTH_NAMES, mondayIndex, monthId, startOfDay } from './format';
import { formatRupiah, type Transaction } from './transactions';

// 🧠 Mesin "Financial Awareness" Finance (22 Sep 2026): SEMUA rumus di sini
// murni, hanya menerima transaksi + budget yang sudah ada di app dan
// mengembalikan angka/kalimat. Tidak menyentuh Firestore, tidak menyentuh AI.
// Layar Finance menjalankannya atas data nyata di HP; AI Coach
// (lib/financeCoach.ts) hanya menerima ringkasan angkanya, bukan transaksi.
//
// Empat pertanyaan yang dijawab, urut dari "sekarang" ke "kemarin":
//   1. Safe to Spend: berapa yang aman dipakai HARI INI, sisa minggu ini,
//      sisa bulan ini (kategori berirama harian, lihat CategoryPace).
//   2. Budget Health: tiap kategori berbudget, sudah terpakai berapa dibanding
//      seberapa jauh bulannya berjalan.
//   3. Riwayat 3 bulan: tren per kategori, kategori yang paling sering lewat
//      budget, minggu terakhir vs rata-rata mingguan.
//   4. Kalimat insight lokal: tenang, tanpa label, tanpa menghakimi. Kalau
//      datanya belum cukup, kalimatnya bilang begitu.
//
// Bahasa: TIDAK ada "boros", "gagal", "jangan beli". Yang ada: "mendekati
// batas", "lebih tinggi dari pola biasanya", "masih punya ruang".

const MS_PER_DAY = 86_400_000;

// ========================= Tanggal & minggu =========================

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Senin 00.00 dari minggu yang memuat `d` (minggu Senin-dulu). */
export function mondayOf(d: Date): Date {
  const s = startOfDay(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - mondayIndex(s));
}

/** "2026-06" → "Jun" (nama bulan pendek dari monthId, untuk label riwayat). */
export function monthShortName(id: string): string {
  const m = Number(id.slice(5, 7)) - 1;
  return MONTH_NAMES[m]?.slice(0, 3) ?? id;
}

/** Tanggal + n hari (00.00). Indonesia tanpa DST, jadi aritmetika hari aman. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Titik acuan "hari ini" untuk bulan yang sedang DILIHAT: bulan berjalan →
 * sekarang; bulan lalu → hari terakhir bulan itu (semuanya sudah lewat);
 * bulan depan → tanggal 1 (belum ada yang berjalan).
 */
export function referenceDay(now: Date, year: number, month: number): Date {
  const cur = monthId(now.getFullYear(), now.getMonth());
  const seen = monthId(year, month);
  if (seen === cur) return now;
  if (seen < cur) return new Date(year, month, daysInMonth(year, month), 23, 59, 59);
  return new Date(year, month, 1);
}

/** Bagian bulan yang sudah berjalan (0..1), hari ini dihitung penuh. */
export function elapsedFraction(ref: Date, year: number, month: number): number {
  return Math.min(1, ref.getDate() / daysInMonth(year, month));
}

// ========================= Penjumlahan dasar =========================

/** Total per "jenis:kategori" dari sekumpulan transaksi. */
export function spendByKey(items: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of items) {
    const key = budgetKey(t.type, t.category);
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return map;
}

/** Total transaksi satu kategori expense dalam [from, to). */
function sumIn(items: Transaction[], key: string, from: Date, to: Date): number {
  const a = from.getTime();
  const b = to.getTime();
  let total = 0;
  for (const t of items) {
    if (t.type !== 'expense' || t.category !== key) continue;
    const ms = t.date.toMillis();
    if (ms >= a && ms < b) total += t.amount;
  }
  return total;
}

function sumType(items: Transaction[], type: FinanceType): number {
  let total = 0;
  for (const t of items) if (t.type === type) total += t.amount;
  return total;
}

// ========================= Status irama =========================

/**
 * Keadaan satu kategori dibanding jalannya bulan:
 *   on-track  → terpakai ≤ bagian bulan yang berjalan (+10 poin toleransi)
 *   watch     → mulai mendekati batas (lebih cepat dari irama bulan, atau ≥ 90%)
 *   over      → sudah melewati budget
 *   no-budget → belum dianggarkan
 */
export type PaceStatus = 'on-track' | 'watch' | 'over' | 'no-budget';

export function paceStatus(spent: number, budget: number, elapsed: number): PaceStatus {
  if (budget <= 0) return 'no-budget';
  if (spent > budget) return 'over';
  const used = spent / budget;
  if (used >= 0.9 || used > elapsed + 0.1) return 'watch';
  return 'on-track';
}

export const PACE_LABEL: Record<PaceStatus, string> = {
  'on-track': 'Sesuai rencana',
  watch: 'Mendekati batas',
  over: 'Melewati budget',
  'no-budget': 'Belum dianggarkan',
};

export const PACE_EMOJI: Record<PaceStatus, string> = {
  'on-track': '🟢',
  watch: '🟡',
  over: '🔴',
  'no-budget': '⚪',
};

// ========================= Budget Health =========================

export type CategoryHealth = {
  category: FinanceCategory;
  key: string;
  budget: number;
  spent: number;
  remaining: number;
  /** 0..∞ (persen terpakai). */
  pct: number;
  status: PaceStatus;
  daily: boolean;
};

/**
 * Semua kategori EXPENSE yang punya budget bulan ini, urut dari yang paling
 * banyak terpakai (persen). Kategori tanpa budget tapi ada transaksi ikut,
 * dengan status no-budget, supaya pengeluaran tak teranggarkan tetap kelihatan.
 */
export function budgetHealth(
  budget: BudgetMap,
  items: Transaction[],
  ref: Date,
  year: number,
  month: number,
): CategoryHealth[] {
  const spent = spendByKey(items);
  const elapsed = elapsedFraction(ref, year, month);
  const rows: CategoryHealth[] = [];
  for (const c of FINANCE_CATEGORIES.expense) {
    const key = budgetKey('expense', c.key);
    const b = budget[key] ?? 0;
    const s = spent.get(key) ?? 0;
    if (b <= 0 && s <= 0) continue;
    rows.push({
      category: c,
      key: c.key,
      budget: b,
      spent: s,
      remaining: b - s,
      pct: b > 0 ? (s / b) * 100 : 0,
      status: paceStatus(s, b, elapsed),
      daily: c.pace === 'daily',
    });
  }
  return rows.sort((a, b) => {
    if (a.budget > 0 !== b.budget > 0) return a.budget > 0 ? -1 : 1;
    return b.pct - a.pct || b.spent - a.spent;
  });
}

// ========================= Safe to Spend =========================

export type SafeRow = {
  category: FinanceCategory;
  key: string;
  budget: number;
  spentMonth: number;
  remainingMonth: number;
  /** Jatah rata-rata per hari dari sisa di awal hari ini sampai akhir bulan. */
  dailyAllowance: number;
  spentToday: number;
  /** Jatah hari ini dikurangi yang sudah dipakai hari ini (bisa minus). */
  safeToday: number;
  weekBudget: number;
  spentWeek: number;
  remainingWeek: number;
  status: PaceStatus;
};

export type SafeToSpend = {
  rows: SafeRow[];
  /** Jumlah safeToday semua kategori harian (dipotong di 0). */
  today: number;
  /** Jumlah remainingWeek semua kategori harian (bisa minus). */
  week: number;
  /** Jumlah remainingMonth semua kategori harian (bisa minus). */
  month: number;
  /** Rata-rata aman per hari untuk sisa bulan (sisa bulan ÷ hari tersisa). */
  avgPerDay: number;
  daysLeft: number;
  /** Sudah ada kategori harian yang dianggarkan? Kalau belum, angkanya kosong. */
  hasBudget: boolean;
  status: PaceStatus;
  isCurrentMonth: boolean;
  /** Senin & batas minggu ini (dipotong ke batas bulan). */
  weekFrom: Date;
  weekTo: Date;
};

/**
 * Safe to Spend untuk kategori berirama harian, dihitung dari TANGGAL AKTUAL:
 *
 *   jatah harian   = (budget − terpakai sebelum hari ini) ÷ hari tersisa (termasuk hari ini)
 *   aman hari ini  = jatah harian − terpakai hari ini
 *   budget minggu  = (budget − terpakai sebelum Senin) ÷ hari dari Senin s.d. akhir bulan
 *                    × jumlah hari minggu ini yang masih di bulan ini
 *   sisa minggu    = budget minggu − terpakai sejak Senin
 *
 * Contoh spesifikasi: budget 1.500.000, terpakai 1.050.000, sisa 10 hari →
 * sisa 450.000, rata-rata 45.000/hari.
 */
export function safeToSpend(
  budget: BudgetMap,
  items: Transaction[],
  now: Date,
  year: number,
  month: number,
): SafeToSpend {
  const ref = referenceDay(now, year, month);
  const isCurrentMonth = monthId(now.getFullYear(), now.getMonth()) === monthId(year, month);
  const dim = daysInMonth(year, month);
  const today0 = startOfDay(ref);
  const tomorrow0 = addDays(today0, 1);
  const daysLeft = dim - ref.getDate() + 1;
  const monthStart = new Date(year, month, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const elapsed = elapsedFraction(ref, year, month);

  const monday = mondayOf(ref);
  const weekFrom = monday < monthStart ? monthStart : monday;
  const weekEnd = addDays(monday, 7);
  const weekTo = weekEnd > nextMonth ? nextMonth : weekEnd;
  const weekDays = Math.round((weekTo.getTime() - weekFrom.getTime()) / MS_PER_DAY);
  const daysFromWeekStart = dim - weekFrom.getDate() + 1;

  const rows: SafeRow[] = [];
  for (const c of dailyPaceCategories()) {
    const b = budget[budgetKey('expense', c.key)] ?? 0;
    if (b <= 0) continue;
    const spentMonth = sumIn(items, c.key, monthStart, nextMonth);
    const spentBeforeToday = sumIn(items, c.key, monthStart, today0);
    const spentToday = sumIn(items, c.key, today0, tomorrow0);
    const dailyAllowance = Math.max(0, b - spentBeforeToday) / daysLeft;
    const spentBeforeWeek = sumIn(items, c.key, monthStart, weekFrom);
    const weekBudget =
      (Math.max(0, b - spentBeforeWeek) / daysFromWeekStart) * weekDays;
    const spentWeek = sumIn(items, c.key, weekFrom, weekTo);
    rows.push({
      category: c,
      key: c.key,
      budget: b,
      spentMonth,
      remainingMonth: b - spentMonth,
      dailyAllowance,
      spentToday,
      safeToday: dailyAllowance - spentToday,
      weekBudget,
      spentWeek,
      remainingWeek: weekBudget - spentWeek,
      status: paceStatus(spentMonth, b, elapsed),
    });
  }

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spentMonth, 0);
  const monthLeft = totalBudget - totalSpent;
  return {
    rows,
    today: rows.reduce((s, r) => s + Math.max(0, r.safeToday), 0),
    week: rows.reduce((s, r) => s + r.remainingWeek, 0),
    month: monthLeft,
    avgPerDay: Math.max(0, monthLeft) / daysLeft,
    daysLeft,
    hasBudget: rows.length > 0,
    status: rows.length === 0 ? 'no-budget' : paceStatus(totalSpent, totalBudget, elapsed),
    isCurrentMonth,
    weekFrom,
    weekTo,
  };
}

// ========================= Riwayat 3 bulan =========================

/** Berapa bulan SEBELUM bulan yang dilihat yang dibaca sebagai riwayat. */
export const HISTORY_MONTHS = 3;

/** Satu bulan riwayat: transaksinya + budget bulan itu (null = tak pernah dibuat). */
export type MonthSlice = {
  monthId: string;
  year: number;
  month: number;
  items: Transaction[];
  budget: BudgetMap | null;
};

/**
 * Pecah transaksi riwayat (satu langganan rentang) + budget per bulan jadi
 * irisan per bulan, lama → baru: HISTORY_MONTHS bulan sebelum (year, month).
 * Bulan tanpa transaksi tetap ada (items kosong) supaya "berapa bulan yang
 * berisi" bisa dihitung jujur.
 */
export function historySlices(
  items: Transaction[],
  budgets: Record<string, BudgetDoc>,
  year: number,
  month: number,
): MonthSlice[] {
  const out: MonthSlice[] = [];
  for (let k = HISTORY_MONTHS; k >= 1; k--) {
    const d = new Date(year, month - k, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const id = monthId(y, m);
    const start = d.getTime();
    const end = new Date(y, m + 1, 1).getTime();
    out.push({
      monthId: id,
      year: y,
      month: m,
      items: items.filter((t) => {
        const ms = t.date.toMillis();
        return ms >= start && ms < end;
      }),
      budget: budgets[id]?.allocations ?? null,
    });
  }
  return out;
}

export type Trend = 'up' | 'down' | 'flat' | 'insufficient';

export type CategoryTrend = {
  category: FinanceCategory;
  key: string;
  /** Urut lama → baru, hanya bulan yang ada di riwayat. */
  months: { monthId: string; spent: number; budget: number }[];
  avg: number;
  trend: Trend;
  /** Berapa bulan (yang berbudget) realisasinya melewati budget. */
  overCount: number;
  monthsWithBudget: number;
  /** Perubahan bulan terakhir vs bulan sebelumnya (persen), null kalau tak ada. */
  changePct: number | null;
};

export type HistoryStats = {
  /** Bulan riwayat yang punya transaksi. */
  monthsAvailable: number;
  /** ≥ 2 bulan riwayat berisi: pola 3 bulan boleh disimpulkan. */
  enough: boolean;
  byCategory: CategoryTrend[];
  totalsByMonth: {
    monthId: string;
    income: number;
    expense: number;
    saving: number;
    investment: number;
    budget: number;
  }[];
  mostOverBudget: CategoryTrend | null;
  biggest: CategoryTrend | null;
  /** Rata-rata pengeluaran per 7 hari tiap kategori expense (dari bulan riwayat). */
  weeklyAvgByKey: Map<string, number>;
};

/** Arah tren dari deret bulanan (lama → baru). */
export function trendOf(values: number[]): Trend {
  if (values.length < 2) return 'insufficient';
  const naik = values.every((v, i) => i === 0 || v > values[i - 1]);
  const turun = values.every((v, i) => i === 0 || v < values[i - 1]);
  if (values.length >= 3 && naik) return 'up';
  if (values.length >= 3 && turun) return 'down';
  const last = values[values.length - 1];
  const rest = values.slice(0, -1);
  const avgRest = rest.reduce((s, v) => s + v, 0) / rest.length;
  if (avgRest <= 0) return last > 0 ? 'up' : 'flat';
  const change = last / avgRest - 1;
  if (change > 0.15) return 'up';
  if (change < -0.15) return 'down';
  return 'flat';
}

export function historyStats(prev: MonthSlice[]): HistoryStats {
  const slices = [...prev].sort((a, b) => (a.monthId < b.monthId ? -1 : 1));
  const withData = slices.filter((s) => s.items.length > 0);
  const totalDays = withData.reduce((s, m) => s + daysInMonth(m.year, m.month), 0);

  const byCategory: CategoryTrend[] = [];
  const weeklyAvgByKey = new Map<string, number>();
  for (const c of FINANCE_CATEGORIES.expense) {
    const months = withData.map((m) => ({
      monthId: m.monthId,
      spent: sumIn(m.items, c.key, new Date(m.year, m.month, 1), new Date(m.year, m.month + 1, 1)),
      budget: m.budget?.[budgetKey('expense', c.key)] ?? 0,
    }));
    const spentAll = months.reduce((s, m) => s + m.spent, 0);
    if (spentAll <= 0 && months.every((m) => m.budget <= 0)) continue;
    const berbudget = months.filter((m) => m.budget > 0);
    const values = months.map((m) => m.spent);
    const last = values[values.length - 1];
    const before = values[values.length - 2];
    byCategory.push({
      category: c,
      key: c.key,
      months,
      avg: months.length > 0 ? spentAll / months.length : 0,
      trend: trendOf(values),
      overCount: berbudget.filter((m) => m.spent > m.budget).length,
      monthsWithBudget: berbudget.length,
      changePct:
        values.length >= 2 && before > 0 ? (last / before - 1) * 100 : null,
    });
    if (totalDays > 0) weeklyAvgByKey.set(c.key, (spentAll / totalDays) * 7);
  }
  byCategory.sort((a, b) => b.avg - a.avg);

  const totalsByMonth = slices.map((m) => ({
    monthId: m.monthId,
    income: sumType(m.items, 'income'),
    expense: sumType(m.items, 'expense'),
    saving: sumType(m.items, 'saving'),
    investment: sumType(m.items, 'investment'),
    budget: m.budget ? totalBudgetOf(m.budget, 'expense') : 0,
  }));

  const over = byCategory
    .filter((c) => c.overCount > 0)
    .sort((a, b) => b.overCount - a.overCount || b.avg - a.avg);

  return {
    monthsAvailable: withData.length,
    enough: withData.length >= 2,
    byCategory,
    totalsByMonth,
    mostOverBudget: over[0] ?? null,
    biggest: byCategory[0] ?? null,
    weeklyAvgByKey,
  };
}

// ========================= 7 hari terakhir vs rata-rata =========================

export type WeekCompare = {
  category: FinanceCategory;
  key: string;
  /** Pengeluaran 7 hari terakhir (termasuk hari ini). */
  last7: number;
  avgWeek: number;
  /** +22 = 22% lebih tinggi dari rata-rata mingguan riwayat; null kalau tak ada pembanding. */
  pct: number | null;
};

/**
 * 7 hari terakhir tiap kategori expense dibanding rata-rata mingguan riwayat.
 * `allItems` = riwayat + bulan ini (7 hari bisa menyeberang bulan). Hanya
 * kategori yang punya pembanding (rata-rata > 0) atau ada pengeluaran.
 */
export function weekVsAverage(
  allItems: Transaction[],
  history: HistoryStats,
  now: Date,
): WeekCompare[] {
  const to = addDays(startOfDay(now), 1);
  const from = addDays(to, -7);
  const out: WeekCompare[] = [];
  for (const c of FINANCE_CATEGORIES.expense) {
    const last7 = sumIn(allItems, c.key, from, to);
    const avgWeek = history.weeklyAvgByKey.get(c.key) ?? 0;
    if (last7 <= 0 && avgWeek <= 0) continue;
    out.push({
      category: c,
      key: c.key,
      last7,
      avgWeek,
      pct: avgWeek > 0 ? (last7 / avgWeek - 1) * 100 : null,
    });
  }
  return out.sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity));
}

// ========================= Insight lokal =========================

export type InsightLevel = 'ok' | 'watch' | 'over' | 'info';

export type Insight = {
  emoji: string;
  text: string;
  level: InsightLevel;
};

// Kalimat menenangkan (ok) hanya lahir kalau tak ada watch/over, dan saat itu
// ia yang jadi headline; info (tren, kunci) menyusul di bawahnya.
const LEVEL_ORDER: Record<InsightLevel, number> = { over: 0, watch: 1, ok: 2, info: 3 };

/** "🍛 Food Drink" */
export function catName(c: FinanceCategory): string {
  return `${c.icon} ${c.label}`;
}

function pctText(n: number): string {
  return `${Math.round(Math.abs(n))}%`;
}

/**
 * Kalimat insight dari angka-angka di atas, tanpa AI. Urutan: yang melewati
 * budget → mendekati batas → info (tren, kunci) → kalimat menenangkan.
 * Yang pertama = headline kartu Coach. Kalau riwayat belum cukup, ada satu
 * kalimat yang bilang begitu; tak ada kesimpulan pola yang dipaksakan.
 */
export function localInsights(input: {
  safe: SafeToSpend;
  health: CategoryHealth[];
  history: HistoryStats;
  weekCompare: WeekCompare[];
  budgetDoc: BudgetDoc;
  elapsed: number;
}): Insight[] {
  const { safe, health, history, weekCompare, budgetDoc, elapsed } = input;
  const out: Insight[] = [];
  const elapsedPct = Math.round(elapsed * 100);

  for (const h of health) {
    if (h.status === 'over') {
      out.push({
        emoji: h.category.icon,
        level: 'over',
        text: `${h.category.label} sudah melewati budget bulan ini sebesar ${formatRupiah(-h.remaining)}. Pengeluaran berikutnya di kategori ini di luar rencana.`,
      });
    } else if (h.status === 'watch') {
      out.push({
        emoji: h.category.icon,
        level: 'watch',
        text: `${h.category.label} mulai mendekati batas: terpakai ${Math.round(h.pct)}% padahal bulan baru berjalan ${elapsedPct}%. Masih ada ruang ${formatRupiah(h.remaining)}.`,
      });
    }
  }

  if (history.enough) {
    for (const w of weekCompare) {
      if (w.pct !== null && w.pct >= 15 && w.last7 > 0) {
        out.push({
          emoji: w.category.icon,
          level: 'watch',
          text: `${w.category.label} 7 hari terakhir ${pctText(w.pct)} lebih tinggi dari rata-rata mingguan ${history.monthsAvailable} bulan terakhir.`,
        });
      }
    }
    for (const c of history.byCategory.slice(0, 5)) {
      if (c.trend === 'up' && c.months.length >= 2) {
        out.push({
          emoji: c.category.icon,
          level: 'info',
          text: `${c.category.label} cenderung naik ${c.months.length} bulan terakhir (rata-rata ${formatRupiah(c.avg)}/bulan). Coba perhatikan apakah ada perubahan rutinitas.`,
        });
      }
    }
    if (history.mostOverBudget && history.mostOverBudget.overCount >= 2) {
      const m = history.mostOverBudget;
      out.push({
        emoji: m.category.icon,
        level: 'info',
        text: `${m.category.label} melewati budget di ${m.overCount} dari ${m.monthsWithBudget} bulan berbudget terakhir. Budget-nya mungkin perlu dilihat lagi, atau polanya.`,
      });
    }
  } else {
    out.push({
      emoji: '📊',
      level: 'info',
      text:
        history.monthsAvailable === 0
          ? 'Riwayat bulan sebelumnya belum ada, jadi pola 3 bulan belum bisa disimpulkan. Mulai dari bulan ini.'
          : `Riwayat baru ${history.monthsAvailable} bulan, pola 3 bulan belum bisa disimpulkan dengan yakin.`,
    });
  }

  if (budgetDoc.unlocks.length > 0) {
    out.push({
      emoji: '🔓',
      level: 'info',
      text: `Budget bulan ini pernah di-unlock ${budgetDoc.unlocks.length}×. Bandingkan realisasi dengan komitmen awalmu.`,
    });
  } else if (!budgetDoc.locked && Object.keys(budgetDoc.allocations).length > 0 && safe.isCurrentMonth) {
    out.push({
      emoji: '🔒',
      level: 'info',
      text: 'Budget bulan ini belum dikunci. Kunci begitu rencananya mantap, supaya jadi komitmen yang dibandingkan.',
    });
  }

  if (!safe.hasBudget) {
    out.push({
      emoji: '🗓️',
      level: 'info',
      text: 'Belum ada budget untuk kategori harian (makan, jajan, transportasi) bulan ini. Atur di Budgeting supaya Safe to Spend terhitung.',
    });
  } else if (out.every((i) => i.level !== 'over' && i.level !== 'watch')) {
    out.unshift({
      emoji: '👍',
      level: 'ok',
      text: `Kamu masih sesuai rencana bulan ini. Rata-rata aman ${formatRupiah(safe.avgPerDay)}/hari untuk ${safe.daysLeft} hari ke depan.`,
    });
  }

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

// ========================= Quick check (jeda sebelum menyimpan) =========================

export type QuickCheck = {
  category: FinanceCategory;
  budget: number;
  remainingBefore: number;
  remainingAfter: number;
  /** Jatah harian sesudah transaksi ini, hanya untuk kategori harian. */
  dailyAfter: number | null;
  daysLeft: number;
  reason: 'over' | 'near' | 'pace';
};

/**
 * Perlu "Quick check 👀" sebelum transaksi expense ini disimpan?
 *   over → sesudahnya budget kategori jadi minus
 *   near → sesudahnya sisa < 15% budget
 *   pace → kategori harian: nominalnya > 1,5× jatah harian DAN sisa sesudahnya < 35%
 * Tanpa budget → tidak pernah (tak ada yang dibandingkan). Ambangnya sengaja
 * tidak rendah: jeda ini harus terasa jarang dan berarti, bukan tiap transaksi.
 */
export function quickCheck(input: {
  type: FinanceType;
  category: string;
  amount: number;
  budget: BudgetMap;
  items: Transaction[];
  now: Date;
  year: number;
  month: number;
}): QuickCheck | null {
  const { type, category, amount, budget, items, now, year, month } = input;
  if (type !== 'expense' || amount <= 0) return null;
  const b = budget[budgetKey('expense', category)] ?? 0;
  if (b <= 0) return null;
  const c = categoryOf('expense', category);
  const ref = referenceDay(now, year, month);
  const monthStart = new Date(year, month, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const spent = sumIn(items, category, monthStart, nextMonth);
  const before = b - spent;
  const after = before - amount;
  const daysLeft = daysInMonth(year, month) - ref.getDate() + 1;
  const daily = c.pace === 'daily';
  const dailyAfter = daily ? Math.max(0, after) / daysLeft : null;
  const dasar = { category: c, budget: b, remainingBefore: before, remainingAfter: after, dailyAfter, daysLeft };
  if (after < 0) return { ...dasar, reason: 'over' };
  if (after / b < 0.15) return { ...dasar, reason: 'near' };
  if (daily) {
    const spentBeforeToday = sumIn(items, category, monthStart, startOfDay(ref));
    const allowance = Math.max(0, b - spentBeforeToday) / daysLeft;
    if (amount > allowance * 1.5 && after / b < 0.35) return { ...dasar, reason: 'pace' };
  }
  return null;
}

// ========================= Weekly review =========================

export type WeeklyReview = {
  monday: Date;
  from: Date;
  /** Eksklusif. */
  to: Date;
  totalSpent: number;
  txCount: number;
  /** Budget expense bulan (yang memuat Senin-nya) terpakai s.d. akhir minggu; null tanpa budget. */
  budgetUsedPct: number | null;
  biggest: { category: FinanceCategory; amount: number } | null;
  byCategory: { category: FinanceCategory; amount: number }[];
  /** Kategori yang minggu ini ≥ 15% di atas rata-rata mingguan riwayat. */
  watch: { category: FinanceCategory; pct: number; amount: number }[];
  enough: boolean;
  coachLine: string;
  focusLine: string;
};

/**
 * Review satu minggu (Senin s.d. Minggu) dari transaksinya. `budget` = budget
 * bulan tempat Senin-nya berada; `monthItems` = transaksi bulan itu (untuk
 * "budget terpakai s.d. akhir minggu").
 */
export function weeklyReview(input: {
  monday: Date;
  allItems: Transaction[];
  monthItems: Transaction[];
  budget: BudgetMap;
  history: HistoryStats;
}): WeeklyReview {
  const { monday, allItems, monthItems, budget, history } = input;
  const from = startOfDay(monday);
  const to = addDays(from, 7);
  const a = from.getTime();
  const b = to.getTime();
  const perCat = new Map<string, number>();
  let totalSpent = 0;
  let txCount = 0;
  for (const t of allItems) {
    if (t.type !== 'expense') continue;
    const ms = t.date.toMillis();
    if (ms < a || ms >= b) continue;
    totalSpent += t.amount;
    txCount++;
    perCat.set(t.category, (perCat.get(t.category) ?? 0) + t.amount);
  }
  const byCategory = [...perCat.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([key, amount]) => ({ category: categoryOf('expense', key), amount }));

  const totalBudget = totalBudgetOf(budget, 'expense');
  let usedToWeekEnd = 0;
  for (const t of monthItems) {
    if (t.type === 'expense' && t.date.toMillis() < b) usedToWeekEnd += t.amount;
  }
  const budgetUsedPct = totalBudget > 0 ? (usedToWeekEnd / totalBudget) * 100 : null;

  const watch: WeeklyReview['watch'] = [];
  if (history.enough) {
    for (const [key, amount] of perCat) {
      const avg = history.weeklyAvgByKey.get(key) ?? 0;
      if (avg <= 0) continue;
      const pct = (amount / avg - 1) * 100;
      if (pct >= 15) watch.push({ category: categoryOf('expense', key), pct, amount });
    }
    watch.sort((x, y) => y.pct - x.pct);
  }

  const biggest = byCategory[0] ?? null;
  // Hari yang tersisa di bulan ini sesudah minggunya berakhir (untuk jatah
  // harian di kalimat fokus). Minggu yang menyeberang ke bulan depan → 1.
  const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const daysAfterWeek = Math.max(1, Math.round((monthEnd.getTime() - to.getTime()) / MS_PER_DAY));

  let coachLine: string;
  if (txCount === 0) {
    coachLine = 'Tidak ada pengeluaran tercatat minggu ini. Kalau memang ada yang belum dicatat, catat dulu supaya gambarannya utuh.';
  } else if (watch.length > 0) {
    const w = watch[0];
    coachLine =
      budgetUsedPct !== null && budgetUsedPct <= 100
        ? `Minggu ini kamu masih dalam budget keseluruhan, tetapi ${catName(w.category)} ${pctText(w.pct)} di atas rata-rata mingguanmu.`
        : `${catName(w.category)} minggu ini ${pctText(w.pct)} di atas rata-rata mingguanmu, dan budget bulan sudah terpakai ${Math.round(budgetUsedPct ?? 0)}%.`;
  } else if (!history.enough) {
    coachLine = `Total minggu ini ${formatRupiah(totalSpent)}${biggest ? `, terbesar di ${catName(biggest.category)}` : ''}. Pembanding mingguan belum ada karena riwayat belum cukup.`;
  } else {
    coachLine = `Minggu ini semua kategori berada di sekitar pola biasanya${budgetUsedPct !== null ? ` dan budget bulan terpakai ${Math.round(budgetUsedPct)}%` : ''}. Pertahankan.`;
  }

  let focusLine: string;
  const target = watch[0]?.category ?? (biggest?.category.pace === 'daily' ? biggest.category : null);
  if (target) {
    const key = budgetKey('expense', target.key);
    const bud = budget[key] ?? 0;
    if (bud > 0) {
      const sisa = Math.max(0, bud - (spendByKey(monthItems).get(key) ?? 0));
      focusLine = `Jaga ${catName(target)} tetap di bawah ${formatRupiah(sisa / daysAfterWeek)}/hari sampai akhir bulan.`;
    } else {
      focusLine = `Perhatikan ${catName(target)}: kategori terbesar minggu ini dan belum punya budget.`;
    }
  } else {
    focusLine = 'Catat tiap pengeluaran di hari yang sama supaya Safe to Spend-mu selalu akurat.';
  }

  return {
    monday: from,
    from,
    to,
    totalSpent,
    txCount,
    budgetUsedPct,
    biggest,
    byCategory,
    watch,
    enough: history.enough,
    coachLine,
    focusLine,
  };
}

// ========================= Monthly review =========================

export type MonthlyReview = {
  monthId: string;
  label: string;
  income: number;
  expense: number;
  saving: number;
  investment: number;
  emergency: number;
  budgetTotal: number;
  /** Realisasi expense ÷ total budget expense (persen); null tanpa budget. */
  adherencePct: number | null;
  over: CategoryHealth[];
  under: CategoryHealth[];
  biggest: CategoryHealth | null;
  /** Perubahan expense vs bulan sebelumnya (persen); null tanpa pembanding. */
  vsPrevPct: number | null;
  /** Tiga kategori terbesar 3 bulan terakhir + arah trennya. */
  trend3: CategoryTrend[];
  locked: boolean;
  unlocks: number;
  points: string[];
  focus: string;
  enough: boolean;
};

export function monthlyReview(input: {
  slice: MonthSlice;
  budgetDoc: BudgetDoc;
  prev: MonthSlice | null;
  history: HistoryStats;
}): MonthlyReview {
  const { slice, budgetDoc, prev, history } = input;
  const { year, month, items } = slice;
  const budget = budgetDoc.allocations;
  const ref = new Date(year, month, daysInMonth(year, month));
  const semua = budgetHealth(budget, items, ref, year, month);
  const health = semua.filter((h) => h.budget > 0);
  const income = sumType(items, 'income');
  const expense = sumType(items, 'expense');
  const saving = sumType(items, 'saving');
  const investment = sumType(items, 'investment');
  let emergency = 0;
  for (const t of items) if (t.type === 'saving' && t.category === 'emergency-fund') emergency += t.amount;
  const budgetTotal = totalBudgetOf(budget, 'expense');
  const adherencePct = budgetTotal > 0 ? (expense / budgetTotal) * 100 : null;
  const over = health.filter((h) => h.spent > h.budget).sort((a, b) => b.pct - a.pct);
  const under = health.filter((h) => h.spent <= h.budget).sort((a, b) => a.pct - b.pct);
  const biggest = [...semua].sort((a, b) => b.spent - a.spent)[0] ?? null;
  const prevExpense = prev ? sumType(prev.items, 'expense') : 0;
  const vsPrevPct = prev && prevExpense > 0 ? (expense / prevExpense - 1) * 100 : null;

  const points: string[] = [];
  if (over.length > 0) {
    points.push(`${over.length} kategori melewati budget: ${over.slice(0, 3).map((h) => catName(h.category)).join(', ')}.`);
  }
  const naik = history.byCategory.filter((c) => c.trend === 'up').slice(0, 2);
  for (const c of naik) points.push(`${catName(c.category)} cenderung naik beberapa bulan terakhir.`);
  const savingBudget = totalBudgetOf(budget, 'saving') + totalBudgetOf(budget, 'investment');
  if (savingBudget > 0 && points.length < 3) {
    points.push(
      saving + investment >= savingBudget
        ? 'Target saving & investment tercapai.'
        : `Saving & investment ${Math.round(((saving + investment) / savingBudget) * 100)}% dari rencana.`,
    );
  }
  const stabil = history.byCategory.filter((c) => c.trend === 'flat' && c.category.pace === 'daily')[0];
  if (stabil && points.length < 3) points.push(`${catName(stabil.category)} relatif stabil.`);
  if (points.length === 0) {
    points.push(
      adherencePct === null
        ? 'Bulan ini belum ada budget expense, jadi belum ada yang bisa dibandingkan.'
        : `Pengeluaran ${Math.round(adherencePct)}% dari total budget.`,
    );
  }

  const fokusCat: FinanceCategory | null =
    over.find((h) => h.category.pace === 'daily')?.category ??
    naik.find((c) => c.category.pace === 'daily')?.category ??
    null;
  const focus = fokusCat
    ? `Perhatikan ${catName(fokusCat)} bulan depan: cek Safe to Spend sebelum pengeluaran yang tidak direncanakan.`
    : 'Kunci budget bulan depan di awal bulan dan cek Safe to Spend sebelum pengeluaran yang tidak direncanakan.';

  return {
    monthId: slice.monthId,
    label: `${MONTH_NAMES[month]} ${year}`,
    income,
    expense,
    saving,
    investment,
    emergency,
    budgetTotal,
    adherencePct,
    over,
    under,
    biggest,
    vsPrevPct,
    trend3: history.byCategory.slice(0, 3),
    locked: budgetDoc.locked,
    unlocks: budgetDoc.unlocks.length,
    points: points.slice(0, 3),
    focus,
    enough: history.enough,
  };
}

// ========================= Monthly planning (roll-up) =========================

export type PlanGroupKey =
  | 'income'
  | 'fixed'
  | 'variable'
  | 'saving'
  | 'emergency'
  | 'investment'
  | 'flexible';

export type PlanGroup = {
  key: PlanGroupKey;
  emoji: string;
  label: string;
  amount: number;
  /** Persen dari rencana income; null kalau income belum dianggarkan. */
  pct: number | null;
};

export type PlanRollup = {
  income: number;
  fixed: number;
  variable: number;
  saving: number;
  emergency: number;
  investment: number;
  /** Semua alokasi keluar (fixed + variable + saving + emergency + investment). */
  allocated: number;
  /** Sisa income yang belum dialokasikan (bisa minus). */
  flexible: number;
  groups: PlanGroup[];
  weeklyAllowance: number;
  dailyAllowance: number;
  daysInMonth: number;
};

const EMERGENCY_KEY = budgetKey('saving', 'emergency-fund');

/**
 * Alur Monthly Planning dari alokasi yang SUDAH ada di dokumen budget:
 * Income → Fixed → Variable → Savings → Emergency Fund → Investment → sisa
 * Flexible. Tidak ada aturan 50/20/10 yang dipaksakan; persennya dihitung dari
 * budget-mu sendiri.
 */
export function planRollup(budget: BudgetMap, year: number, month: number): PlanRollup {
  const income = totalBudgetOf(budget, 'income');
  let fixed = 0;
  let variable = 0;
  for (const c of FINANCE_CATEGORIES.expense) {
    const v = budget[budgetKey('expense', c.key)] ?? 0;
    if (c.pace === 'daily') variable += v;
    else fixed += v;
  }
  const emergency = budget[EMERGENCY_KEY] ?? 0;
  const saving = totalBudgetOf(budget, 'saving') - emergency;
  const investment = totalBudgetOf(budget, 'investment');
  const allocated = fixed + variable + saving + emergency + investment;
  const flexible = income - allocated;
  const pct = (n: number) => (income > 0 ? (n / income) * 100 : null);
  const dim = daysInMonth(year, month);
  return {
    income,
    fixed,
    variable,
    saving,
    emergency,
    investment,
    allocated,
    flexible,
    groups: [
      { key: 'income', emoji: '💰', label: 'Income', amount: income, pct: income > 0 ? 100 : null },
      { key: 'fixed', emoji: '🏠', label: 'Fixed expenses', amount: fixed, pct: pct(fixed) },
      { key: 'variable', emoji: '🍜', label: 'Variable expenses', amount: variable, pct: pct(variable) },
      { key: 'saving', emoji: '🏦', label: 'Savings', amount: saving, pct: pct(saving) },
      { key: 'emergency', emoji: '🚨', label: 'Emergency Fund', amount: emergency, pct: pct(emergency) },
      { key: 'investment', emoji: '📈', label: 'Investment', amount: investment, pct: pct(investment) },
      { key: 'flexible', emoji: '🎈', label: 'Flexible spending', amount: flexible, pct: pct(flexible) },
    ],
    weeklyAllowance: (variable / dim) * 7,
    dailyAllowance: variable / dim,
    daysInMonth: dim,
  };
}

// ========================= Status tanpa angka (Home & notifikasi) =========================

export type FinanceStatus = {
  level: PaceStatus;
  /** Kalimat pendek TANPA nominal, aman tampil di luar gerbang PIN. */
  lines: string[];
};

/**
 * Ringkasan untuk kartu Home & notifikasi: keadaan saja, tidak ada rupiah.
 * Finance dikunci PIN, jadi angkanya tidak boleh bocor ke sana.
 */
export function financeStatus(safe: SafeToSpend, health: CategoryHealth[]): FinanceStatus {
  if (!safe.hasBudget) {
    return { level: 'no-budget', lines: ['Budget kategori harian bulan ini belum diatur.'] };
  }
  const over = health.filter((h) => h.status === 'over');
  const watch = health.filter((h) => h.status === 'watch');
  const lines: string[] = [];
  if (over.length > 0) lines.push(`${over.map((h) => catName(h.category)).join(', ')} sudah melewati budget.`);
  if (watch.length > 0) lines.push(`${watch.map((h) => catName(h.category)).join(', ')} mendekati batas.`);
  if (lines.length === 0) lines.push('Semua kategori masih sesuai rencana. Cek Safe to Spend sebelum pengeluaran yang tidak direncanakan.');
  const level: PaceStatus = over.length > 0 ? 'over' : watch.length > 0 ? 'watch' : 'on-track';
  return { level, lines };
}

/** Jam mulai "malam": sesudah ini, hari tanpa transaksi tercatat diingatkan. */
export const LOG_NUDGE_HOUR = 19;

/**
 * Baris kartu Home & isi notifikasi, semuanya TANPA rupiah: status budget,
 * progres tiap fokus mingguan (jumlah kali / persen jatah), dan ajakan mencatat
 * kalau sampai malam belum ada transaksi tercatat hari ini.
 */
export function financeStatusLines(
  budget: BudgetMap,
  items: Transaction[],
  focus: { category: FinanceCategory; subLabel: string; count: number; spent: number; status: PaceStatus; item: { limitAmount: number; limitCount: number } }[],
  now: Date,
): { emoji: string; level: PaceStatus; lines: string[]; statusLines: string[]; focusLines: string[] } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const safe = safeToSpend(budget, items, now, year, month);
  const health = budgetHealth(budget, items, now, year, month);
  const status = financeStatus(safe, health);
  const statusLines = [...status.lines];
  const focusLines: string[] = [];
  let level = status.level;

  for (const f of focus) {
    const nama = f.subLabel ? `${catName(f.category)} › ${f.subLabel}` : catName(f.category);
    const bagian: string[] = [];
    if (f.item.limitCount > 0) bagian.push(`${f.count}/${f.item.limitCount}× minggu ini`);
    if (f.item.limitAmount > 0) {
      bagian.push(`${Math.round((f.spent / f.item.limitAmount) * 100)}% jatah minggu ini`);
    }
    focusLines.push(`${PACE_EMOJI[f.status]} ${nama}: ${bagian.join(' · ')}`);
    if (f.status === 'over') level = 'over';
    else if (f.status === 'watch' && level !== 'over') level = 'watch';
  }

  const lines = [...statusLines, ...focusLines];
  const today0 = startOfDay(now).getTime();
  const adaHariIni = items.some((t) => t.date.toMillis() >= today0);
  if (now.getHours() >= LOG_NUDGE_HOUR && !adaHariIni) {
    lines.push('📝 Belum ada transaksi tercatat hari ini. Kalau ada pengeluaran, catat sebelum tidur.');
  }
  return { emoji: PACE_EMOJI[level], level, lines, statusLines, focusLines };
}
