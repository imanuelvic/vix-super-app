import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { Color } from '@/assets/style/color';
import { ReminderCard } from '@/components/common/ReminderCard';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  EMPTY_BUDGET,
  subLabelOf,
  subscribeBudget,
  subscribeSubcategories,
  type BudgetDoc,
  type SubcategoryMap,
} from '@/lib/budgets';
import {
  focusProgress,
  subscribeFinanceFocus,
  type FocusItem,
} from '@/lib/financeFocus';
import { financeStatusLines } from '@/lib/financeInsight';
import { notifyTexts, syncFinanceNotifications } from '@/lib/financeNotify';
import { subscribeTransactionsByMonth, type Transaction } from '@/lib/transactions';

// 💰 Kartu Finance di Dashboard Home: keadaan hari ini TANPA nominal.
//
// Finance dikunci PIN dan punya tombol 👁 sembunyikan angka, jadi yang boleh
// tampil di luar gerbang cuma statusnya: "masih sesuai rencana", "Food
// mendekati batas", "Gojek 2× lagi minggu ini", "belum ada transaksi tercatat
// hari ini". Angkanya menunggu di dalam (click → Finance → PIN).
//
// Langganannya sama persis dengan yang dipakai layar Finance (bulan berjalan +
// budget + fokus), jadi lewat ref-count lib/liveDoc tidak ada listener ganda.
export function FinanceStatusCard({ now }: { now: Date }) {
  const router = useRouter();
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
      // Nominal TIDAK dipakai di kartu ini; pemformatnya cuma pemenuh tanda tangan.
      () => '',
    );
    return financeStatusLines(budgetDoc.allocations, items, progress, now);
  }, [items, focus, subcats, budgetDoc, now]);

  // 🔔 Teks notifikasi harian ikut keadaan terakhir (tanpa nominal). Hanya
  // menjadwalkan ulang kalau teksnya berubah & preferensinya aktif.
  useEffect(() => {
    if (!teks) return;
    syncFinanceNotifications(notifyTexts(teks.statusLines, teks.focusLines)).catch(() => {});
  }, [teks]);

  if (!teks) return null;
  return (
    <ReminderCard
      bg={Color.FINANCE}
      fg={Color.FINANCE_DARK}
      title={`💰 Finance hari ini ${teks.emoji}`}
      texts={teks.lines}
      onPress={() => router.push('/finance')}
      corner="→"
    />
  );
}
