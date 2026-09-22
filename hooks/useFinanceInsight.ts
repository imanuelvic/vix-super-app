import { useMemo } from 'react';

import { subLabelOf, type BudgetDoc, type SubcategoryMap } from '@/lib/budgets';
import { buildCoachFacts, type CoachFacts } from '@/lib/financeCoach';
import { focusProgress, type FocusItem, type FocusProgress } from '@/lib/financeFocus';
import {
  budgetHealth,
  elapsedFraction,
  historyStats,
  localInsights,
  referenceDay,
  safeToSpend,
  weekVsAverage,
  type CategoryHealth,
  type HistoryStats,
  type Insight,
  type MonthSlice,
  type SafeToSpend,
  type WeekCompare,
} from '@/lib/financeInsight';
import { formatRupiah, type Transaction } from '@/lib/transactions';

export type FinanceInsight = {
  ref: Date;
  elapsed: number;
  safe: SafeToSpend;
  health: CategoryHealth[];
  history: HistoryStats;
  weekCompare: WeekCompare[];
  insights: Insight[];
  focus: FocusProgress[];
  facts: CoachFacts;
};

/**
 * Semua angka "Financial Awareness" untuk bulan yang dilihat, dihitung sekali
 * dari transaksi + budget + riwayat (lib/financeInsight) dan dipakai bersama
 * Dashboard, Coach, kartu fokus, dan review. `history` = 3 bulan SEBELUM bulan
 * yang dilihat (transaksi + budget-nya).
 */
export function useFinanceInsight(input: {
  items: Transaction[];
  budgetDoc: BudgetDoc;
  history: MonthSlice[];
  focusItems: FocusItem[];
  subcats: SubcategoryMap;
  year: number;
  month: number;
  now: Date;
}): FinanceInsight {
  const { items, budgetDoc, history, focusItems, subcats, year, month, now } = input;
  return useMemo(() => {
    const ref = referenceDay(now, year, month);
    const elapsed = elapsedFraction(ref, year, month);
    const budget = budgetDoc.allocations;
    const safe = safeToSpend(budget, items, now, year, month);
    const health = budgetHealth(budget, items, ref, year, month);
    const stats = historyStats(history);
    const allItems = [...items, ...history.flatMap((h) => h.items)];
    const weekCompare = weekVsAverage(allItems, stats, ref);
    const insights = localInsights({ safe, health, history: stats, weekCompare, budgetDoc, elapsed });
    const focus = focusProgress(
      items,
      focusItems,
      ref,
      (f) => subLabelOf(subcats, 'expense', f.category, f.sub || undefined),
      formatRupiah,
    );
    const facts = buildCoachFacts({
      safe,
      health,
      history: stats,
      weekCompare,
      budgetDoc,
      focus,
      year,
      month,
      ref,
    });
    return { ref, elapsed, safe, health, history: stats, weekCompare, insights, focus, facts };
  }, [items, budgetDoc, history, focusItems, subcats, year, month, now]);
}
