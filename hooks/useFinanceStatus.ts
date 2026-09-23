import { useMemo, useState } from 'react';

import { useLiveAll } from '@/hooks/useLiveAll';
import {
  EMPTY_BUDGET,
  subLabelOf,
  subscribeBudget,
  subscribeSubcategories,
  type BudgetDoc,
  type SubcategoryMap,
} from '@/lib/budgets';
import { focusProgress, subscribeFinanceFocus, type FocusItem } from '@/lib/financeFocus';
import { financeStatusLines } from '@/lib/financeInsight';
import { subscribeTransactionsByMonth, type Transaction } from '@/lib/transactions';

/**
 * 💰 Keadaan Finance hari ini TANPA nominal — untuk layar Today & Semua
 * Pengingat (Finance dikunci PIN; di luar gerbang cuma statusnya yang boleh
 * tampil: "masih sesuai rencana", "Food mendekati batas", "Gojek 2× lagi").
 *
 * Langganannya sama persis dengan layar Finance (bulan berjalan + budget +
 * fokus + sub-kategori), jadi lewat ref-count lib/liveDoc tidak ada listener
 * ganda. null = datanya belum termuat.
 *
 * Teks 🔔 notifikasinya TIDAK lagi dijadwalkan di sini: sejak 23 Sep 2026
 * seluruh pengingat (rohani, CORE, Work, Life, Finance) dijadwalkan sekali
 * dari hooks/useTodayData lewat lib/notify.ts.
 */
export function useFinanceStatus(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [budgetDoc, setBudgetDoc] = useState<BudgetDoc>(EMPTY_BUDGET);
  const [focus, setFocus] = useState<FocusItem[]>([]);
  const [subcats, setSubcats] = useState<SubcategoryMap>({});

  useLiveAll(
    (uid) => [
      subscribeTransactionsByMonth(uid, year, month, setItems, () => setItems([])),
      subscribeBudget(uid, year, month, setBudgetDoc, () => {}),
      subscribeFinanceFocus(uid, setFocus, () => {}),
      subscribeSubcategories(uid, setSubcats, () => {}),
    ],
    { deps: [year, month] },
  );

  const teks = useMemo(() => {
    if (items === null) return null;
    const progress = focusProgress(
      items,
      focus,
      now,
      (f) => subLabelOf(subcats, 'expense', f.category, f.sub || undefined),
      // Nominal TIDAK dipakai di sini; pemformatnya cuma pemenuh tanda tangan.
      () => '',
    );
    return financeStatusLines(budgetDoc.allocations, items, progress, now);
  }, [items, focus, subcats, budgetDoc, now]);

  return teks;
}
