import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { categoryOf } from '@/lib/categories';
import { formatShortDayDate } from '@/lib/format';
import { formatRupiah, type Transaction } from '@/lib/transactions';

// Tab Air-Listrik 💧⚡ — REKAP READ-ONLY. Datanya tidak diinput manual lagi;
// otomatis dibaca dari transaksi Finance berkategori Electricity & Water.
// Baris list murni tampilan (tidak bisa dipencet). Untuk menambah/mengubah,
// lakukan di fitur Finance.
export function ResidenceUtilityTab({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const now = new Date();

  const { waterMonth, electricMonth, lastWater, lastElectric } = useMemo(() => {
    const sameMonth = (d: Date) =>
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    let waterMonth = 0;
    let electricMonth = 0;
    let lastWater: Transaction | undefined;
    let lastElectric: Transaction | undefined;
    // transactions sudah urut terbaru dulu → entri pertama tiap jenis = terakhir.
    for (const t of transactions) {
      const d = t.date.toDate();
      if (t.category === 'water') {
        if (sameMonth(d)) waterMonth += t.amount;
        if (!lastWater) lastWater = t;
      } else if (t.category === 'electricity') {
        if (sameMonth(d)) electricMonth += t.amount;
        if (!lastElectric) lastElectric = t;
      }
    }
    return { waterMonth, electricMonth, lastWater, lastElectric };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan pemakaian bulan ini per jenis */}
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            Pemakaian bulan ini
          </VixText>
          <View style={styles.utilRow}>
            <VixText heading="bold" additionalStyle={summaryText.value}>
              💧 Air PAM
            </VixText>
            <VixText heading="bold" additionalStyle={summaryText.value}>
              {formatRupiah(waterMonth)}
            </VixText>
          </View>
          <View style={styles.utilRow}>
            <VixText heading="bold" additionalStyle={summaryText.value}>
              ⚡ Listrik (token)
            </VixText>
            <VixText heading="bold" additionalStyle={summaryText.value}>
              {formatRupiah(electricMonth)}
            </VixText>
          </View>
        </SummaryCard>

        {/* Transaksi terakhir tiap jenis */}
        <View style={styles.quickCard}>
          <VixText heading="label">
            💧 Terakhir bayar air:{' '}
            {lastWater
              ? `${formatShortDayDate(lastWater.date.toDate())} · ${formatRupiah(lastWater.amount)}`
              : 'belum tercatat'}
          </VixText>
          <VixText heading="label">
            ⚡ Terakhir isi token:{' '}
            {lastElectric
              ? `${formatShortDayDate(lastElectric.date.toDate())} · ${formatRupiah(lastElectric.amount)}`
              : 'belum tercatat'}
          </VixText>
        </View>

        <VixText heading="label" additionalStyle={styles.hint}>
          Otomatis dari transaksi Finance kategori ⚡ Electricity & 💧 Water.
          Untuk menambah, catat di fitur Finance.
        </VixText>

        {transactions.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada transaksi listrik/air. Catat di Finance dengan kategori ⚡
            Electricity atau 💧 Water.
          </VixText>
        ) : (
          transactions.map((t) => {
            const cat = categoryOf('expense', t.category);
            return (
              <View key={t.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <VixText heading="bold" additionalStyle={styles.rowTitle}>
                    {cat.icon} {cat.label}
                  </VixText>
                  {t.note ? <VixText heading="label">{t.note}</VixText> : null}
                  <VixText heading="label">
                    {formatShortDayDate(t.date.toDate())}
                  </VixText>
                </View>
                <VixText heading="bold" additionalStyle={styles.rowCost}>
                  {formatRupiah(t.amount)}
                </VixText>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  utilRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 4,
    marginBottom: 10,
  },
  hint: { color: Color.TEXT_PARAGRAPH, marginBottom: 12 },
  empty: { textAlign: 'center', marginVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowCost: { color: Color.MAIN_DARK },
});
