import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { formatShortDayDate, monthLabel } from '@/lib/format';
import { RESIDENCE_LOG_TYPES } from '@/lib/residence';
import {
  formatRupiah,
  utilityKindOf,
  type Transaction,
} from '@/lib/transactions';

export function UtilityTab({
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
    //
    // Jenisnya TIDAK lagi dibaca dari `t.category` langsung: sejak Electricity
    // & Water melebur jadi sub-kategori Residence, transaksi baru berbentuk
    // `residence › electric/water` sementara yang lama tetap `electricity` /
    // `water`. utilityKindOf mengerti keduanya (lihat lib/transactions.ts).
    for (const t of transactions) {
      const d = t.date.toDate();
      const jenis = utilityKindOf(t);
      if (jenis === 'water') {
        if (sameMonth(d)) waterMonth += t.amount;
        if (!lastWater) lastWater = t;
      } else if (jenis === 'electric') {
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
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            Pemakaian bulan {monthLabel(now)}
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
              ⚡ Listrik Token
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

        <VixText heading="label" additionalStyle={styles.source}>
          💰 Data dari Finance — dicatat & diubah di sana.
        </VixText>

        {transactions.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada transaksi listrik/air. Catat di Finance dengan kategori 🏠
            Residence → 💧 Air PAM atau ⚡ Listrik Token.
          </VixText>
        ) : (
          transactions.map((t) => {
            // Judulnya JENIS-nya (Air PAM / Listrik Token), bukan nama
            // kategorinya. Sejak keduanya melebur ke Residence, seluruh baris
            // di sini akan berbunyi "🏠 Residence" — persis sama semua, dan
            // yang membedakannya justru sub-jenisnya.
            const jenis = utilityKindOf(t);
            const meta = jenis
              ? RESIDENCE_LOG_TYPES.find((r) => r.key === jenis)
              : undefined;
            return (
              <View key={t.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <VixText heading="bold" additionalStyle={styles.rowTitle}>
                    {meta ? `${meta.icon} ${meta.label}` : t.note || 'Utilitas'}
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
  // Penanda asal data — bunyinya sama persis dengan tab Log & Log di Car 🚗.
  source: { color: Color.MAIN, marginBottom: 10 },
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
