import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { VixText } from '@/components/common/VixText';
import { CoachCard } from '@/components/finance/CoachCard';
import { FocusCard } from '@/components/finance/FocusCard';
import { MonthDetails } from '@/components/finance/MonthDetails';
import { NotifyCard } from '@/components/finance/NotifyCard';
import { ReviewCard } from '@/components/finance/ReviewCard';
import { SafeToSpendHero } from '@/components/finance/SafeToSpendHero';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFinanceInsight } from '@/hooks/useFinanceInsight';
import { subLabelOf, type BudgetDoc, type SubcategoryMap } from '@/lib/budgets';
import { categoryOf } from '@/lib/categories';
import type { FocusItem } from '@/lib/financeFocus';
import { PACE_EMOJI, PACE_LABEL, type MonthSlice } from '@/lib/financeInsight';
import { dayId, dayShort, MONTH_NAMES } from '@/lib/format';
import { formatRupiah, type Transaction } from '@/lib/transactions';

// Tab Dashboard Finance (22 Sep 2026: Financial Awareness). Urutan sengaja
// dari "keputusan berikutnya" ke "yang sudah terjadi":
//
//   1. Safe to Spend today · minggu ini · bulan ini   (hero)
//   2. Weekly / Monthly Review                          (saat waktunya)
//   3. 🤖 Vix Financial Coach                            (insight lokal + tanya)
//   4. 🎯 Fokus minggu ini                               (batas yang kamu tetapkan)
//      + 🔔 sakelar pengingat harian di HP
//   5. 📊 Spending Pattern                               (kategori terbesar)
//   6. 🎯 Budget Health                                  (tiap kategori berbudget)
//   7. Transaksi terbaru
//   8. "Lihat detail bulan ini" → MonthDetails (isi Dashboard lama)
//
// Progressive disclosure: yang penting dulu, rinciannya dibuka kalau mau.
// Semua angka dari lib/financeInsight atas data nyata; tidak ada dummy.
export function DashboardTab({
  items,
  budgetDoc,
  history,
  focusItems,
  subcats,
  year,
  month,
  now,
  onShowTab,
}: {
  items: Transaction[];
  budgetDoc: BudgetDoc;
  /** 3 bulan sebelum bulan yang dilihat (transaksi + budget). */
  history: MonthSlice[];
  focusItems: FocusItem[];
  subcats: SubcategoryMap;
  year: number;
  month: number; // 0–11
  now: Date;
  onShowTab: (tab: 'transactions' | 'budgeting') => void;
}) {
  const [detail, setDetail] = useState(false);
  const [allHealth, setAllHealth] = useState(false);

  const insight = useFinanceInsight({
    items,
    budgetDoc,
    history,
    focusItems,
    subcats,
    year,
    month,
    now,
  });

  // Top 5 kategori expense bulan ini (batang mendatar, relatif ke terbesar).
  const pattern = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) {
      if (t.type === 'expense') map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    const rows = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, amount]) => ({ key, category: categoryOf('expense', key), amount }));
    return { rows, max: rows[0]?.amount ?? 0, total: [...map.values()].reduce((s, v) => s + v, 0) };
  }, [items]);

  const recent = items.slice(0, 5);
  const healthRows = allHealth ? insight.health : insight.health.slice(0, 6);
  const todayId = dayId(now);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SafeToSpendHero safe={insight.safe} onSetBudget={() => onShowTab('budgeting')} />

      <ReviewCard now={now} />

      <CoachCard
        insights={insight.insights}
        facts={insight.facts}
        dayId={todayId}
        onSeeInsight={() => setAllHealth(true)}
      />

      <FocusCard progress={insight.focus} items={focusItems} subcats={subcats} />

      <NotifyCard />

      {/* ===== Spending pattern ===== */}
      <View style={styles.card}>
        <VixText heading="title">📊 Spending Pattern</VixText>
        {pattern.rows.length === 0 ? (
          <VixText heading="label">Belum ada pengeluaran bulan ini.</VixText>
        ) : (
          pattern.rows.map((r) => (
            <View key={r.key} style={styles.patternRow}>
              <VixText heading="label" numberOfLines={1} additionalStyle={styles.patternLabel}>
                {r.category.icon} {r.category.label}
              </VixText>
              <View style={styles.patternBarWrap}>
                <ProgressBar
                  value={r.amount}
                  total={pattern.max}
                  height={10}
                  color={Color.FINANCE_DARK}
                  track={Color.CONTRAST_CONTAINER}
                />
              </View>
              <VixText heading="label" additionalStyle={styles.patternValue}>
                {pattern.total > 0 ? `${Math.round((r.amount / pattern.total) * 100)}%` : ''}
              </VixText>
            </View>
          ))
        )}
      </View>

      {/* ===== Budget health ===== */}
      <View style={styles.card}>
        <VixText heading="title">🎯 Budget Health</VixText>
        {insight.health.length === 0 ? (
          <VixText heading="label">
            Belum ada budget expense bulan ini. Atur di Budgeting supaya tiap kategori
            punya batas yang bisa dibandingkan.
          </VixText>
        ) : (
          healthRows.map((h) => (
            <View key={h.key} style={styles.healthRow}>
              <View style={styles.healthTop}>
                <VixText heading="bold" numberOfLines={1} additionalStyle={styles.healthLabel}>
                  {PACE_EMOJI[h.status]} {h.category.icon} {h.category.label}
                </VixText>
                <VixText
                  heading="bold"
                  additionalStyle={h.status === 'over' ? styles.over : styles.pct}>
                  {h.budget > 0 ? `${Math.round(h.pct)}%` : 'tanpa budget'}
                </VixText>
              </View>
              <ProgressBar
                value={Math.min(h.pct, 100)}
                total={100}
                height={6}
                color={
                  h.status === 'over'
                    ? Color.DANGER
                    : h.status === 'watch'
                      ? Color.BUDGET_WARN
                      : h.status === 'no-budget'
                        ? Color.DISABLED
                        : Color.MAIN_LIGHT
                }
                track={Color.CONTRAST_CONTAINER}
              />
              <VixText heading="label">
                {h.budget > 0
                  ? h.remaining >= 0
                    ? `Masih ada ruang ${formatRupiah(h.remaining)} · ${PACE_LABEL[h.status]}`
                    : `Lewat ${formatRupiah(-h.remaining)} dari ${formatRupiah(h.budget)}`
                  : `${formatRupiah(h.spent)} terpakai · ${PACE_LABEL[h.status]}`}
              </VixText>
            </View>
          ))
        )}
        {insight.health.length > 6 && (
          <PressableScale onPress={() => setAllHealth((v) => !v)} hitSlop={8}>
            <VixText heading="label" additionalStyle={styles.link}>
              {allHealth ? 'Tampilkan lebih sedikit' : `Lihat semua (${insight.health.length})`}
            </VixText>
          </PressableScale>
        )}
      </View>

      {/* ===== Transaksi terbaru ===== */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <VixText heading="title">🧾 Recent Transactions</VixText>
          <PressableScale onPress={() => onShowTab('transactions')} hitSlop={8}>
            <VixText heading="label" additionalStyle={styles.link}>
              Lihat semua ›
            </VixText>
          </PressableScale>
        </View>
        {recent.length === 0 ? (
          <VixText heading="label">Belum ada transaksi {MONTH_NAMES[month]} {year}.</VixText>
        ) : (
          recent.map((t) => {
            const cat = categoryOf(t.type, t.category);
            const subName = subLabelOf(subcats, t.type, t.category, t.sub);
            const d = t.date.toDate();
            return (
              <View key={t.id} style={styles.txRow}>
                <VixText heading="title">{cat.icon}</VixText>
                <View style={styles.txMain}>
                  <VixText heading="bold" numberOfLines={1} additionalStyle={styles.txLabel}>
                    {cat.label}
                    {subName ? ` › ${subName}` : ''}
                  </VixText>
                  <VixText heading="label" numberOfLines={1}>
                    {dayShort(d)}, {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                    {t.note ? ` · ${t.note}` : ''}
                  </VixText>
                </View>
                <VixText heading="bold" additionalStyle={t.type === 'income' ? styles.income : styles.txLabel}>
                  {t.type === 'income' ? '+' : '-'}
                  {formatRupiah(t.amount)}
                </VixText>
              </View>
            );
          })
        )}
      </View>

      {/* ===== Rincian bulan ini (Dashboard lama) ===== */}
      <PressableScale style={styles.detailToggle} onPress={() => setDetail((v) => !v)}>
        <VixText heading="bold" additionalStyle={styles.detailText}>
          {detail ? 'Sembunyikan detail bulan ini' : 'Lihat detail bulan ini'}
        </VixText>
        <IconSymbol
          name={detail ? 'chevron.up' : 'chevron.down'}
          size={18}
          color={Color.MAIN_DARK}
        />
      </PressableScale>
      {detail && (
        <MonthDetails items={items} budget={budgetDoc.allocations} year={year} month={month} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 10,
    marginBottom: CARD_GAP,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  link: { color: Color.MAIN_DARK },
  patternRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  patternLabel: { width: 120, color: Color.TEXT_TITLE },
  patternBarWrap: { flex: 1 },
  patternValue: { width: 38, textAlign: 'right' },
  healthRow: { gap: 5 },
  healthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  healthLabel: { flex: 1, color: Color.TEXT_TITLE },
  pct: { color: Color.TEXT_TITLE },
  over: { color: Color.DANGER },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  txMain: { flex: 1 },
  txLabel: { color: Color.TEXT_TITLE },
  income: { color: Color.SUCCESS },
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: CARD_GAP,
  },
  detailText: { color: Color.MAIN_DARK },
});
