import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { PACE_EMOJI, PACE_LABEL, type SafeToSpend } from '@/lib/financeInsight';
import { formatRupiah } from '@/lib/transactions';

// 💰 Kartu teratas Dashboard Finance: SAFE TO SPEND TODAY, lalu sisa minggu &
// bulan untuk kategori harian (makan, jajan, transportasi, …). Ini jawaban
// atas "boleh pakai berapa hari ini?" sebelum uangnya keluar, bukan catatan
// sesudahnya. Angkanya dihitung dari tanggal aktual (lib/financeInsight),
// tidak ada angka statis.
//
// Bulan lampau: yang tersisa cuma "sisa bulan" (hari ini & minggu ini tidak
// berarti). Belum ada budget kategori harian → ajakan mengaturnya, tanpa angka
// palsu.
export function SafeToSpendHero({
  safe,
  onSetBudget,
}: {
  safe: SafeToSpend;
  /** Buka sub-tab Budgeting (saat budget kategori harian belum ada). */
  onSetBudget: () => void;
}) {
  if (!safe.hasBudget) {
    return (
      <SummaryCard>
        <VixText heading="label" additionalStyle={summaryText.label}>
          Safe to Spend
        </VixText>
        <VixText heading="subheader" additionalStyle={summaryText.value}>
          Belum terhitung
        </VixText>
        <VixText heading="label" additionalStyle={summaryText.label}>
          Atur budget kategori harian (Food, Snacks, Transportation, …) supaya
          jatah harianmu terhitung dari tanggal aktual.
        </VixText>
        <PressableScale onPress={onSetBudget} hitSlop={6}>
          <VixText heading="bold" additionalStyle={styles.link}>
            Atur di Budgeting ›
          </VixText>
        </PressableScale>
      </SummaryCard>
    );
  }

  const over = safe.rows.filter((r) => r.status === 'over');
  const watch = safe.rows.filter((r) => r.status === 'watch');
  const statusLine =
    safe.status === 'on-track'
      ? "You're on track 👍"
      : over.length > 0
        ? `${over.map((r) => r.category.icon).join(' ')} sudah melewati budget kategorinya`
        : `${watch.map((r) => r.category.icon).join(' ')} mulai mendekati batas`;

  if (!safe.isCurrentMonth) {
    return (
      <SummaryCard>
        <VixText heading="label" additionalStyle={summaryText.label}>
          Sisa budget kategori harian bulan ini
        </VixText>
        <VixText heading="header" additionalStyle={summaryText.value}>
          {formatRupiah(safe.month)}
        </VixText>
        <VixText heading="label" additionalStyle={summaryText.label}>
          {PACE_EMOJI[safe.status]} {PACE_LABEL[safe.status]} · kategori harian
        </VixText>
      </SummaryCard>
    );
  }

  return (
    <SummaryCard>
      <VixText heading="label" additionalStyle={summaryText.label}>
        Safe to Spend Today
      </VixText>
      <VixText heading="header" additionalStyle={summaryText.value}>
        {formatRupiah(safe.today)}
      </VixText>
      <VixText heading="label" additionalStyle={summaryText.label}>
        {statusLine}
      </VixText>

      <View style={styles.cols}>
        <View style={styles.col}>
          <VixText heading="label" additionalStyle={summaryText.label}>
            This Week
          </VixText>
          <VixText heading="bold" additionalStyle={summaryText.value}>
            {formatRupiah(Math.max(0, safe.week))}
            {safe.week < 0 ? ' (lewat)' : ''}
          </VixText>
          <VixText heading="label" additionalStyle={summaryText.label}>
            remaining
          </VixText>
        </View>
        <View style={styles.col}>
          <VixText heading="label" additionalStyle={summaryText.label}>
            This Month
          </VixText>
          <VixText heading="bold" additionalStyle={summaryText.value}>
            {formatRupiah(Math.max(0, safe.month))}
            {safe.month < 0 ? ' (lewat)' : ''}
          </VixText>
          <VixText heading="label" additionalStyle={summaryText.label}>
            remaining
          </VixText>
        </View>
      </View>

      <VixText heading="label" additionalStyle={summaryText.label}>
        Agar tetap sesuai budget, rata-rata sekitar {formatRupiah(safe.avgPerDay)}/hari
        untuk {safe.daysLeft} hari ke depan.
      </VixText>
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  cols: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  col: {
    flex: 1,
    backgroundColor: Color.SURFACE_ON_DARK,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 1,
  },
  link: { color: Color.TEXT_REVERSE, marginTop: 6 },
});
