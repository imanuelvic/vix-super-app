import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { TypeChips } from '@/components/finance/TypeChips';
import type { BudgetMap } from '@/lib/budgets';
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

// Tiga jenis yang dibandingkan realisasi vs budget (income tidak dianggarkan).
const PLAN_TYPES: { key: FinanceType; icon: string; color: string }[] = [
  { key: 'expense', icon: '💸', color: Color.FINANCE_EXPENSE_DARK },
  { key: 'saving', icon: '🏦', color: Color.FINANCE_SAVING_DARK },
  { key: 'investment', icon: '📈', color: Color.FINANCE_INVESTMENT_DARK },
];

// Tab Dashboard: kondisi keuangan bulan ini sekali lihat (menang/boros),
// perbandingan budget vs realisasi, laju pengeluaran harian, dan quote.
export function DashboardTab({
  items,
  budget,
  year,
  month,
}: {
  items: Transaction[];
  budget: BudgetMap;
  year: number;
  month: number; // 0–11
}) {
  const [type, setType] = useState<FinanceType>('expense');

  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // ===== Ringkasan bulan: pemasukan / pengeluaran / nabung =====
  // Catatan: `perDay` (grafik Pengeluaran Harian) SENGAJA hanya menghitung
  // transaksi berjenis Expense — saving & investment tidak ikut.
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

  // ===== Budget vs realisasi per jenis (expense / saving / investment) =====
  // Budget diambil dari alokasi yang dibuat di sub-tab Budgeting; key-nya
  // berformat "jenis:kategori", jadi cukup dijumlah per awalan jenis.
  const plan = useMemo(() => {
    const rows = PLAN_TYPES.map((p) => {
      let actual = 0;
      for (const t of items) if (t.type === p.key) actual += t.amount;
      let planned = 0;
      for (const [key, value] of Object.entries(budget)) {
        if (key.startsWith(`${p.key}:`)) planned += value;
      }
      return { ...p, actual, planned };
    });
    return {
      rows,
      actualTotal: rows.reduce((s, r) => s + r.actual, 0),
      plannedTotal: rows.reduce((s, r) => s + r.planned, 0),
    };
  }, [items, budget]);

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

  return (
    <ScrollView contentContainerStyle={styles.content}>
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

      {/* ===== Budget vs realisasi: pembagian expense / saving / investment ===== */}
      <View style={styles.card}>
        <VixText heading="title" additionalStyle={styles.cardTitle}>
          📊 Budget vs Realisasi
        </VixText>

        {plan.plannedTotal === 0 && plan.actualTotal === 0 ? (
          <VixText heading="label">
            Belum ada budget & transaksi bulan ini. Atur alokasinya di sub-tab
            Budgeting 📝
          </VixText>
        ) : (
          <>
            {/* Dua batang bertumpuk: komposisi rencana vs kenyataan */}
            <CompositionBar
              label="Budget"
              total={plan.plannedTotal}
              parts={plan.rows.map((r) => ({
                key: r.key,
                value: r.planned,
                color: r.color,
              }))}
            />
            <CompositionBar
              label="Realisasi"
              total={plan.actualTotal}
              parts={plan.rows.map((r) => ({
                key: r.key,
                value: r.actual,
                color: r.color,
              }))}
            />

            {/* Rincian per jenis: nominal, persentase komposisi & serapan budget */}
            {plan.rows.map((r) => {
              const usedPct = r.planned > 0 ? (r.actual / r.planned) * 100 : null;
              const over = usedPct !== null && usedPct > 100;
              return (
                <View key={r.key} style={styles.planRow}>
                  <View style={[styles.planDot, { backgroundColor: r.color }]} />
                  <View style={styles.planMain}>
                    <VixText heading="bold" additionalStyle={styles.planLabel}>
                      {r.icon} {FINANCE_TYPE_LABEL[r.key]}
                    </VixText>
                    <VixText heading="label">
                      {formatShortRupiah(r.actual)} dari{' '}
                      {r.planned > 0
                        ? formatShortRupiah(r.planned)
                        : 'belum dianggarkan'}
                    </VixText>
                  </View>
                  <VixText
                    heading="bold"
                    additionalStyle={
                      usedPct === null
                        ? styles.toneWarn
                        : over
                          ? styles.toneDanger
                          : styles.toneOk
                    }>
                    {usedPct === null ? '—' : `${usedPct.toFixed(0)}%`}
                  </VixText>
                </View>
              );
            })}
            <VixText heading="label">
              Persentase = realisasi dibanding budget yang kamu buat di sub-tab
              Budgeting. Batang atas = rencana, batang bawah = kenyataan.
            </VixText>
          </>
        )}
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

// Batang bertumpuk: satu baris menunjukkan pembagian persentase antar jenis.
// Total 0 → batang kosong (abu) supaya tetap terbaca "belum ada isinya".
function CompositionBar({
  label,
  total,
  parts,
}: {
  label: string;
  total: number;
  parts: { key: string; value: number; color: string }[];
}) {
  return (
    <View style={styles.compBlock}>
      <View style={styles.compTop}>
        <VixText heading="label">{label}</VixText>
        <VixText heading="label">{formatShortRupiah(total)}</VixText>
      </View>
      <View style={styles.barTrack}>
        {total > 0 &&
          parts.map((p) =>
            p.value > 0 ? (
              <View
                key={p.key}
                style={{
                  width: `${(p.value / total) * 100}%`,
                  backgroundColor: p.color,
                }}
              />
            ) : null,
          )}
      </View>
      {total > 0 && (
        <View style={styles.compTop}>
          {parts.map((p) => (
            <VixText key={p.key} heading="label" additionalStyle={{ color: p.color }}>
              {((p.value / total) * 100).toFixed(0)}%
            </VixText>
          ))}
        </View>
      )}
    </View>
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
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  // Blok satu batang komposisi (label + batang + persentase).
  compBlock: { gap: 4 },
  compTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  // Rincian per jenis di bawah batang.
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planDot: { width: 10, height: 10, borderRadius: 5 },
  planMain: { flex: 1, gap: 1 },
  planLabel: { color: Color.TEXT_TITLE },
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
