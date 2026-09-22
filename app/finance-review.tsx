import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SoftPill } from '@/components/common/SoftPill';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { CoachAnswerView } from '@/components/finance/CoachCard';
import { useAuth } from '@/contexts/auth';
import { useFinanceInsight } from '@/hooks/useFinanceInsight';
import { useFormSave } from '@/hooks/useFormSave';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  EMPTY_BUDGET,
  subscribeBudgetRange,
  subscribeSubcategories,
  type BudgetDoc,
  type SubcategoryMap,
} from '@/lib/budgets';
import {
  askCoach,
  coachErrorMessage,
  loadCoachDay,
  saveCoachDay,
  type CoachAnswer,
  type CoachDay,
  type CoachQuestionKey,
} from '@/lib/financeCoach';
import {
  newFocusId,
  saveFinanceFocus,
  subscribeFinanceFocus,
  type FocusItem,
} from '@/lib/financeFocus';
import {
  addDays,
  catName,
  HISTORY_MONTHS,
  historySlices,
  monthlyReview,
  monthShortName,
  weeklyReview,
  type MonthlyReview,
  type WeeklyReview,
} from '@/lib/financeInsight';
import { dayId, dayIdToDate, formatWeekRange, MONTH_NAMES, monthId } from '@/lib/format';
import { LOAD_ERROR } from '@/lib/messages';
import { formatRupiah, subscribeTransactionsRange, type Transaction } from '@/lib/transactions';

// 📅 Weekly Money Review & 📆 Monthly Review (22 Sep 2026).
//
//   /finance-review?kind=week&day=YYYY-MM-DD   (Senin minggunya)
//   /finance-review?kind=month&id=YYYY-MM
//
// Semua angka dari lib/financeInsight (rumus, atas data nyata). Kalimat
// "Coach" di kartu = insight lokal; tombol ✨ meminta ringkasan Gemini sekali
// (cache per hari, jatah bersama Coach di Dashboard). Dari weekly review,
// kategori yang "perlu diperhatikan" bisa langsung dijadikan 🎯 fokus minggu
// depan dengan batas = rata-rata mingguan riwayatnya.
type Kind = 'week' | 'month';

export default function FinanceReviewScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ kind?: string; day?: string; id?: string }>();
  const kind: Kind = params.kind === 'month' ? 'month' : 'week';

  // Bulan acuan: bulan tempat Senin-nya (weekly) atau bulan review (monthly).
  const monday = useMemo(
    () => (kind === 'week' && params.day ? dayIdToDate(params.day) : null),
    [kind, params.day],
  );
  const acuan = useMemo(() => {
    if (monday) return monday;
    if (params.id) return new Date(Number(params.id.slice(0, 4)), Number(params.id.slice(5, 7)) - 1, 1);
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1);
  }, [monday, params.id]);
  const year = acuan.getFullYear();
  const month = acuan.getMonth();

  const [items, setItems] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Record<string, BudgetDoc>>({});
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const [subcats, setSubcats] = useState<SubcategoryMap>({});
  const [error, setError] = useState<string | null>(null);

  // Satu rentang: HISTORY_MONTHS bulan sebelum bulan acuan s.d. akhir bulan
  // acuan (atau akhir minggunya kalau minggunya menyeberang bulan).
  const from = new Date(year, month - HISTORY_MONTHS, 1);
  const monthEnd = useMemo(() => new Date(year, month + 1, 1), [year, month]);
  const to = monday && addDays(monday, 7) > monthEnd ? addDays(monday, 7) : monthEnd;
  useLiveAll(
    (uid, fail) => [
      subscribeTransactionsRange(uid, from, to, setItems, fail),
      subscribeBudgetRange(
        uid,
        monthId(from.getFullYear(), from.getMonth()),
        monthId(year, month),
        setBudgets,
        fail,
      ),
      subscribeFinanceFocus(uid, setFocusItems, () => {}),
      subscribeSubcategories(uid, setSubcats, () => {}),
    ],
    { onError: setError, deps: [year, month, to.getTime()] },
  );

  const monthItems = useMemo(() => {
    const a = new Date(year, month, 1).getTime();
    const b = monthEnd.getTime();
    return (items ?? []).filter((t) => {
      const ms = t.date.toMillis();
      return ms >= a && ms < b;
    });
  }, [items, year, month, monthEnd]);
  const history = useMemo(
    () => historySlices(items ?? [], budgets, year, month),
    [items, budgets, year, month],
  );
  const budgetDoc = budgets[monthId(year, month)] ?? EMPTY_BUDGET;

  // "Sekarang" untuk angka review = akhir periodenya (bukan hari ini), supaya
  // review minggu lalu tidak berubah gara-gara transaksi minggu ini.
  const asOf = useMemo(() => {
    const real = new Date();
    const akhir = monday ? addDays(monday, 7) : monthEnd;
    return real < akhir ? real : new Date(akhir.getTime() - 1);
  }, [monday, monthEnd]);

  const insight = useFinanceInsight({
    items: monthItems,
    budgetDoc,
    history,
    focusItems,
    subcats,
    year,
    month,
    now: asOf,
  });

  const weekly: WeeklyReview | null = useMemo(
    () =>
      monday
        ? weeklyReview({
            monday,
            allItems: items ?? [],
            monthItems,
            budget: budgetDoc.allocations,
            history: insight.history,
          })
        : null,
    [monday, items, monthItems, budgetDoc, insight.history],
  );
  const monthly: MonthlyReview | null = useMemo(
    () =>
      kind === 'month'
        ? monthlyReview({
            slice: { monthId: monthId(year, month), year, month, items: monthItems, budget: budgetDoc.allocations },
            budgetDoc,
            prev: history[history.length - 1] ?? null,
            history: insight.history,
          })
        : null,
    [kind, year, month, monthItems, budgetDoc, history, insight.history],
  );

  // ✨ Ringkasan Coach (Gemini) — pertanyaan 'weekly' / 'monthly'.
  const todayId = dayId(new Date());
  const [day, setDay] = useState<CoachDay | null>(null);
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  useEffect(() => {
    let hidup = true;
    loadCoachDay(todayId).then((d) => {
      if (hidup) setDay(d);
    });
    return () => {
      hidup = false;
    };
  }, [todayId]);

  async function minta() {
    if (busy || !day) return;
    const q: CoachQuestionKey = kind === 'week' ? 'weekly' : 'monthly';
    setBusy(true);
    setAiError(null);
    try {
      const hasil = await askCoach(q, insight.facts, todayId, day);
      setAnswer(hasil.answer);
      if (!hasil.fromCache) {
        setDay(hasil.day);
        await saveCoachDay(todayId, hasil.day);
      }
    } catch (e) {
      setAiError(coachErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // 🎯 Jadikan fokus minggu depan (dari kategori "perlu diperhatikan").
  const { busy: focusBusy, formError: focusError, save } = useFormSave();
  const [focusAdded, setFocusAdded] = useState(false);
  const watchTop = weekly?.watch[0] ?? null;
  const sudahFokus = watchTop
    ? focusItems.some((f) => f.category === watchTop.category.key && !f.sub)
    : false;
  async function jadikanFokus() {
    if (!user || !watchTop) return;
    const avg = insight.history.weeklyAvgByKey.get(watchTop.category.key) ?? 0;
    const item: FocusItem = {
      id: newFocusId(),
      category: watchTop.category.key,
      sub: '',
      limitAmount: Math.max(10_000, Math.round(avg / 1000) * 1000),
      limitCount: 0,
    };
    await save(async () => {
      await saveFinanceFocus(user.uid, [...focusItems, item]);
      setFocusAdded(true);
    });
  }

  const judul = kind === 'week' ? '📅 Weekly Money Review' : '📆 Monthly Review';
  const sub =
    kind === 'week' && monday
      ? formatWeekRange(monday)
      : `${MONTH_NAMES[month]} ${year}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader backLabel="Finance" title={judul} subtitle={sub} />
      <ScreenError message={error === LOAD_ERROR ? error : null} />
      {items === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {weekly && (
            <>
              <SummaryCard>
                <VixText heading="label" additionalStyle={summaryText.label}>
                  Bagaimana minggu kamu?
                </VixText>
                <VixText heading="header" additionalStyle={summaryText.value}>
                  {formatRupiah(weekly.totalSpent)}
                </VixText>
                <VixText heading="label" additionalStyle={summaryText.label}>
                  💰 Total spent · {weekly.txCount} transaksi
                </VixText>
              </SummaryCard>

              <Kartu judul="🎯 Budget used">
                <VixText heading="paragraph">
                  {weekly.budgetUsedPct === null
                    ? 'Bulan ini belum ada budget expense.'
                    : `${Math.round(weekly.budgetUsedPct)}% dari budget bulan terpakai sampai akhir minggu ini.`}
                </VixText>
              </Kartu>

              <Kartu judul="📈 Biggest category">
                {weekly.byCategory.length === 0 ? (
                  <VixText heading="paragraph">Tidak ada pengeluaran minggu ini.</VixText>
                ) : (
                  weekly.byCategory.slice(0, 5).map((r) => (
                    <Baris key={r.category.key} kiri={catName(r.category)} kanan={formatRupiah(r.amount)} />
                  ))
                )}
              </Kartu>

              <Kartu judul="⚠️ Watch">
                {!weekly.enough ? (
                  <VixText heading="paragraph">
                    Pembanding mingguan belum ada: riwayat baru {insight.history.monthsAvailable}{' '}
                    bulan. Setelah 2 bulan atau lebih, kategori yang naik dari polanya muncul di sini.
                  </VixText>
                ) : weekly.watch.length === 0 ? (
                  <VixText heading="paragraph">
                    Tidak ada kategori yang jauh di atas rata-rata mingguanmu. 👍
                  </VixText>
                ) : (
                  weekly.watch.map((w) => (
                    <Baris
                      key={w.category.key}
                      kiri={`${catName(w.category)} naik ${Math.round(w.pct)}%`}
                      kanan={formatRupiah(w.amount)}
                    />
                  ))
                )}
              </Kartu>

              <Kartu judul="💡 Coach">
                <VixText heading="paragraph">{weekly.coachLine}</VixText>
                <VixText heading="bold" additionalStyle={styles.fokus}>
                  Fokus minggu depan: {weekly.focusLine}
                </VixText>
                {watchTop && (
                  <View style={styles.aksi}>
                    <SoftPill
                      label={
                        sudahFokus || focusAdded
                          ? `✓ ${catName(watchTop.category)} sudah jadi fokus`
                          : `🎯 Jadikan ${catName(watchTop.category)} fokus minggu depan`
                      }
                      onPress={jadikanFokus}
                      busy={focusBusy}
                      disabled={sudahFokus || focusAdded}
                    />
                    <FormError message={focusError} gap="top" />
                  </View>
                )}
              </Kartu>
            </>
          )}

          {monthly && (
            <>
              <SummaryCard>
                <VixText heading="label" additionalStyle={summaryText.label}>
                  Financial Summary · {monthly.label}
                </VixText>
                <VixText heading="header" additionalStyle={summaryText.value}>
                  {monthly.adherencePct === null ? formatRupiah(monthly.expense) : `${Math.round(monthly.adherencePct)}%`}
                </VixText>
                <VixText heading="label" additionalStyle={summaryText.label}>
                  {monthly.adherencePct === null
                    ? 'total pengeluaran (belum ada budget expense)'
                    : `dari total budget expense ${formatRupiah(monthly.budgetTotal)} terpakai`}
                  {monthly.locked ? ' · 🔒 terkunci' : ''}
                  {monthly.unlocks > 0 ? ` · 🔓 unlock ${monthly.unlocks}×` : ''}
                </VixText>
              </SummaryCard>

              <Kartu judul="💵 Arus bulan ini">
                <Baris kiri="Total income" kanan={formatRupiah(monthly.income)} />
                <Baris kiri="Total spending" kanan={formatRupiah(monthly.expense)} />
                <Baris kiri="Total saved" kanan={formatRupiah(monthly.saving)} />
                <Baris kiri="Total invested" kanan={formatRupiah(monthly.investment)} />
                <Baris kiri="Emergency fund contribution" kanan={formatRupiah(monthly.emergency)} />
              </Kartu>

              <Kartu judul="🎯 Budget adherence">
                {monthly.over.length === 0 && monthly.under.length === 0 ? (
                  <VixText heading="paragraph">Belum ada budget expense bulan ini.</VixText>
                ) : (
                  <>
                    <VixText heading="label">Over budget ({monthly.over.length})</VixText>
                    {monthly.over.length === 0 ? (
                      <VixText heading="paragraph">Tidak ada. 👍</VixText>
                    ) : (
                      monthly.over.map((h) => (
                        <Baris
                          key={h.key}
                          kiri={catName(h.category)}
                          kanan={`${Math.round(h.pct)}% · lewat ${formatRupiah(-h.remaining)}`}
                          merah
                        />
                      ))
                    )}
                    <VixText heading="label" additionalStyle={styles.subJudul}>
                      Under budget ({monthly.under.length})
                    </VixText>
                    {monthly.under.slice(0, 6).map((h) => (
                      <Baris key={h.key} kiri={catName(h.category)} kanan={`${Math.round(h.pct)}%`} />
                    ))}
                  </>
                )}
              </Kartu>

              <Kartu judul="📈 Pola">
                <VixText heading="paragraph">
                  Terbesar: {monthly.biggest ? `${catName(monthly.biggest.category)} ${formatRupiah(monthly.biggest.spent)}` : 'belum ada'}.
                </VixText>
                <VixText heading="paragraph">
                  Dibanding bulan sebelumnya:{' '}
                  {monthly.vsPrevPct === null
                    ? 'belum ada pembanding.'
                    : `pengeluaran ${monthly.vsPrevPct >= 0 ? 'naik' : 'turun'} ${Math.round(Math.abs(monthly.vsPrevPct))}%.`}
                </VixText>
                {monthly.enough ? (
                  monthly.trend3.map((c) => (
                    <View key={c.key} style={styles.tren}>
                      <VixText heading="bold" additionalStyle={styles.trenJudul}>
                        {catName(c.category)} ·{' '}
                        {c.trend === 'up' ? 'meningkat' : c.trend === 'down' ? 'menurun' : c.trend === 'flat' ? 'stabil' : 'belum cukup data'}
                      </VixText>
                      <VixText heading="label">
                        {c.months.map((m) => `${monthShortName(m.monthId)}: ${formatRupiah(m.spent)}`).join(' · ')}
                      </VixText>
                    </View>
                  ))
                ) : (
                  <VixText heading="label">
                    Tren 3 bulan belum bisa disimpulkan: riwayat baru{' '}
                    {insight.history.monthsAvailable} bulan.
                  </VixText>
                )}
              </Kartu>

              <Kartu judul="💡 Coach">
                <VixText heading="label">3 hal yang terlihat:</VixText>
                {monthly.points.map((p, i) => (
                  <VixText key={i} heading="paragraph">
                    {i + 1}. {p}
                  </VixText>
                ))}
                <VixText heading="bold" additionalStyle={styles.fokus}>
                  Fokus bulan depan: {monthly.focus}
                </VixText>
              </Kartu>
            </>
          )}

          <View style={styles.ai}>
            {busy ? (
              <SoftPill label="Coach sedang membaca angkamu…" busy onPress={() => {}} />
            ) : (
              <SoftPill
                label={answer ? '✨ Minta lagi ringkasan Coach' : '✨ Minta ringkasan Coach (AI)'}
                onPress={minta}
                disabled={!day}
              />
            )}
            <FormError message={aiError} gap="top" />
            {answer && !busy && <CoachAnswerView answer={answer} />}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Kartu({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <VixText heading="title">{judul}</VixText>
      {children}
    </View>
  );
}

function Baris({ kiri, kanan, merah = false }: { kiri: string; kanan: string; merah?: boolean }) {
  return (
    <View style={styles.baris}>
      <VixText heading="paragraph" numberOfLines={1} additionalStyle={styles.barisKiri}>
        {kiri}
      </VixText>
      <VixText heading="bold" additionalStyle={merah ? styles.merah : styles.barisKanan}>
        {kanan}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 6,
    marginBottom: CARD_GAP,
  },
  baris: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  barisKiri: { flex: 1, color: Color.TEXT_TITLE },
  barisKanan: { color: Color.TEXT_TITLE },
  merah: { color: Color.DANGER },
  subJudul: { marginTop: 6 },
  fokus: { color: Color.MAIN_DARK, marginTop: 4 },
  aksi: { marginTop: 6 },
  tren: { gap: 1, marginTop: 4 },
  trenJudul: { color: Color.TEXT_TITLE },
  ai: { gap: 10, marginTop: 2 },
});
