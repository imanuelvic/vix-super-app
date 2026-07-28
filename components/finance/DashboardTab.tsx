import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { TypeChips } from '@/components/finance/TypeChips';
import {
  categoryOf,
  FINANCE_TYPE_LABEL,
  type FinanceCategory,
  type FinanceType,
} from '@/lib/categories';
import { hashString } from '@/lib/core';
import { formatShortRupiah } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { formatRupiah, type Transaction } from '@/lib/transactions';

type CategoryTotal = {
  key: string;
  category: FinanceCategory;
  value: number;
  color: string;
};

// Quote harian: kelola uang dengan bijak, jangan cinta uang.
// Diambil bergiliran (deterministik per hari) dari Alkitab,
// Psychology of Money, dan Atomic Habits.
const QUOTES: { text: string; source: string }[] = [
  {
    text: 'Akar segala kejahatan adalah CINTA uang — bukan uangnya. Kelola uang, jangan dikuasai uang.',
    source: '1 Timotius 6:10',
  },
  {
    text: 'Kekayaan sejati adalah uang yang TIDAK kamu belanjakan. Yang kelihatan mewah itu bukan kaya — itu uang yang sudah pergi.',
    source: 'Psychology of Money — Morgan Housel',
  },
  {
    text: 'Menabung adalah jarak antara ego dan penghasilanmu. Makin kecil gengsi, makin cepat tenang.',
    source: 'Psychology of Money — Morgan Housel',
  },
  {
    text: 'Kamu tidak naik ke level tujuanmu — kamu turun ke level sistemmu. Bangun sistem keuangan, bukan sekadar niat.',
    source: 'Atomic Habits — James Clear',
  },
  {
    text: 'Lebih baik 1% lebih baik setiap hari daripada sempurna sekali lalu berhenti. Catat terus transaksimu!',
    source: 'Atomic Habits — James Clear',
  },
  {
    text: 'Orang bijak menyimpan harta dan minyak di rumahnya, tetapi orang bebal memboroskannya.',
    source: 'Amsal 21:20',
  },
  {
    text: 'Kebebasan finansial bukan soal banyaknya uang, tapi kendali penuh atas waktumu.',
    source: 'Psychology of Money — Morgan Housel',
  },
  {
    text: 'Kamu tidak dapat mengabdi kepada Allah dan kepada Mamon. Uang itu alat, bukan tuan.',
    source: 'Matius 6:24',
  },
];

/** Target rasio nabung+investasi yang sehat (aturan 50/30/20). */
const SAVING_TARGET_PCT = 20;

// Tab Dashboard: kondisi keuangan bulan ini sekali lihat (menang/boros),
// rasio nabung, laju pengeluaran harian, grafik, dan quote pengingat.
export function DashboardTab({
  items,
  year,
  month,
  scrollTick,
}: {
  items: Transaction[];
  year: number;
  month: number; // 0–11
  scrollTick?: number; // naik tiap tab Dashboard ditekan → scroll ke atas
}) {
  const [type, setType] = useState<FinanceType>('expense');

  // Scroll ke paling atas saat tombol tab-nya ditekan.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollTick]);

  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // ===== Ringkasan bulan: pemasukan / pengeluaran / nabung =====
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let saved = 0; // saving + investment
    const perDay = Array.from({ length: daysInMonth }, () => 0);
    for (const t of items) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') {
        expense += t.amount;
        perDay[t.date.toDate().getDate() - 1] += t.amount;
      } else saved += t.amount;
    }
    // Laju & proyeksi hanya relevan untuk bulan berjalan.
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
    const dailyAvg = daysElapsed > 0 ? expense / daysElapsed : 0;
    return {
      income,
      expense,
      saved,
      net: income - expense - saved, // sisa cashflow
      spentPct: income > 0 ? (expense / income) * 100 : null,
      savingPct: income > 0 ? (saved / income) * 100 : 0,
      perDay,
      maxDay: Math.max(...perDay, 1),
      dailyAvg,
      projection: dailyAvg * daysInMonth,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, daysInMonth, isCurrentMonth]);

  // Kondisi menang/boros — sekali lihat langsung paham.
  const hasData = summary.income > 0 || summary.expense > 0;
  const win = summary.expense <= summary.income;

  // ===== Donat per kategori (jenis terpilih) =====
  const { data, total } = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.type === type) {
        map.set(item.category, (map.get(item.category) ?? 0) + item.amount);
      }
    }
    const data: CategoryTotal[] = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value], index) => ({
        key,
        value,
        category: categoryOf(type, key),
        color: Color.CHART_COLORS[index % Color.CHART_COLORS.length],
      }));
    const total = data.reduce((sum, d) => sum + d.value, 0);
    return { data, total };
  }, [items, type]);

  // Quote hari ini (ganti otomatis tiap hari).
  const quote = QUOTES[hashString(dayDocId(now)) % QUOTES.length];

  const savingTone =
    summary.savingPct >= SAVING_TARGET_PCT
      ? styles.toneOk
      : summary.savingPct >= 10
        ? styles.toneWarn
        : styles.toneDanger;

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
      {/* ===== Kondisi bulan ini: MENANG / BOROS ===== */}
      <View
        style={[
          styles.verdictCard,
          hasData && (win ? styles.verdictWin : styles.verdictLose),
        ]}>
        {/* Tanpa data → card terang, jadi teksnya harus gelap */}
        <VixText
          heading="label"
          additionalStyle={
            hasData ? styles.verdictLabel : styles.verdictLabelNeutral
          }>
          Kondisi Bulan Ini
        </VixText>
        <VixText
          heading="header"
          additionalStyle={
            hasData ? styles.verdictValue : styles.verdictValueNeutral
          }>
          {!hasData ? 'Belum ada data 📭' : win ? 'MENANG 🏆' : 'BOROS 🚨'}
        </VixText>
        {hasData && (
          <VixText heading="label" additionalStyle={styles.verdictLabel}>
            {summary.spentPct !== null
              ? `Pengeluaran ${summary.spentPct.toFixed(0)}% dari pemasukan · sisa cashflow ${formatShortRupiah(summary.net)}`
              : 'Belum ada pemasukan tercatat bulan ini.'}
          </VixText>
        )}
      </View>

      {/* ===== 3 angka utama ===== */}
      <View style={styles.statRow}>
        <StatTile label="💰 Masuk" value={formatShortRupiah(summary.income)} />
        <StatTile label="💸 Keluar" value={formatShortRupiah(summary.expense)} />
        <StatTile label="🏦 Nabung" value={formatShortRupiah(summary.saved)} />
      </View>

      {/* ===== Rasio nabung + investasi (aturan 50/30/20) ===== */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <VixText heading="title">🏦 Rasio Nabung + Investasi</VixText>
          <VixText heading="bold" additionalStyle={savingTone}>
            {summary.savingPct.toFixed(0)}%
          </VixText>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.min(summary.savingPct, 100)}%` },
            ]}
          />
        </View>
        <VixText heading="label">
          Target sehat ≥{SAVING_TARGET_PCT}% dari pemasukan (aturan 50/30/20:
          kebutuhan/keinginan/nabung).
        </VixText>
      </View>

      {/* ===== Laju pengeluaran harian + grafik batang ===== */}
      <View style={styles.card}>
        <VixText heading="title" additionalStyle={styles.cardTitle}>
          📉 Pengeluaran Harian
        </VixText>
        <View style={styles.barsRow}>
          {summary.perDay.map((v, i) => {
            const isToday = isCurrentMonth && i === now.getDate() - 1;
            return (
              <View key={i} style={styles.barSlot}>
                <View
                  style={[
                    styles.dayBar,
                    { height: Math.max(3, (v / summary.maxDay) * 56) },
                    isToday && styles.dayBarToday,
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.axisRow}>
          <VixText heading="label">1</VixText>
          <VixText heading="label">{Math.round(daysInMonth / 2)}</VixText>
          <VixText heading="label">{daysInMonth}</VixText>
        </View>
        <VixText heading="label">
          Rata-rata {formatShortRupiah(summary.dailyAvg)}/hari
          {isCurrentMonth
            ? ` · proyeksi akhir bulan ±${formatShortRupiah(summary.projection)}`
            : ''}
        </VixText>
      </View>

      {/* ===== Quote pengingat hari ini ===== */}
      <View style={styles.quoteCard}>
        <VixText heading="paragraph" additionalStyle={styles.quoteText}>
          “{quote.text}”
        </VixText>
        <VixText heading="label" additionalStyle={styles.quoteSource}>
          — {quote.source}
        </VixText>
      </View>

      {/* ===== Rincian per kategori ===== */}
      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        🔍 Rincian per Kategori
      </VixText>
      <TypeChips value={type} onChange={setType} />

      <View style={styles.chartWrap}>
        <DonutChart slices={data}>
          <VixText heading="label">Total {FINANCE_TYPE_LABEL[type]}</VixText>
          <VixText heading="bold" additionalStyle={styles.chartTotal}>
            {formatRupiah(total)}
          </VixText>
        </DonutChart>
      </View>

      {data.length === 0 ? (
        <VixText heading="label" additionalStyle={styles.empty}>
          Belum ada transaksi {FINANCE_TYPE_LABEL[type]} bulan ini.
        </VixText>
      ) : (
        data.map((d) => (
          <View key={d.key} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: d.color }]} />
            <VixText
              heading="paragraph"
              numberOfLines={1}
              additionalStyle={styles.rowLabel}>
              {d.category.icon} {d.category.label}
            </VixText>
            <View style={styles.rowRight}>
              <VixText heading="bold">{formatRupiah(d.value)}</VixText>
              <VixText heading="label">
                {((d.value / total) * 100).toFixed(1)}%
              </VixText>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// Kotak kecil satu angka utama.
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <VixText heading="bold" additionalStyle={styles.statValue}>
        {value}
      </VixText>
      <VixText heading="label">{label}</VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  verdictCard: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: 10,
  },
  verdictWin: { backgroundColor: Color.MAIN_DARK },
  verdictLose: { backgroundColor: Color.DANGER },
  verdictLabel: { color: Color.TEXT_ON_DARK_MUTED },
  verdictValue: { color: Color.TEXT_REVERSE },
  verdictLabelNeutral: { color: Color.TEXT_LABEL },
  verdictValueNeutral: { color: Color.TEXT_TITLE },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statTile: {
    flex: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: Color.TEXT_TITLE },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 8,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { marginBottom: 2 },
  toneOk: { color: Color.SUCCESS },
  toneWarn: { color: Color.WARNING },
  toneDanger: { color: Color.DANGER },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Color.MAIN,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 2,
  },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  dayBar: {
    width: '100%',
    borderRadius: 3,
    backgroundColor: Color.FINANCE_EXPENSE,
  },
  dayBarToday: { backgroundColor: Color.DANGER },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  quoteCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginBottom: 14,
  },
  quoteText: { color: Color.ACCENT_DARK, fontStyle: 'italic' },
  quoteSource: { color: Color.ACCENT_DARK, textAlign: 'right' },
  sectionTitle: { marginBottom: 10 },
  chartWrap: { alignItems: 'center', marginVertical: 16 },
  chartTotal: { color: Color.TEXT_TITLE, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowLabel: { flex: 1, color: Color.TEXT_TITLE },
  rowRight: { alignItems: 'flex-end' },
});
