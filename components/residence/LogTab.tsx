import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { ExpenseRow } from '@/components/common/ExpenseRow';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { formatDate, monthLabel, sameMonth } from '@/lib/format';
import {
  RESIDENCE_LOG_TYPES,
  type ResidenceLog,
  type ResidenceLogType,
} from '@/lib/residence';
import { formatRupiah } from '@/lib/transactions';

const TYPE_META = Object.fromEntries(
  RESIDENCE_LOG_TYPES.map((t) => [t.key, t]),
) as Record<ResidenceLogType, (typeof RESIDENCE_LOG_TYPES)[number]>;

// Tab Log 🧾 — pengeluaran rumah selain listrik/air, BACA-SAJA.
//
// Sumbernya SATU: transaksi Finance (Expense › Residence › jenisnya), yang
// otomatis tercatat ke sini. Tombol "Catat Pengeluaran" sudah dibuang — dulu
// ada dua pintu untuk satu pengeluaran yang sama, dan itu artinya satu
// pembayaran bisa tercatat dua kali dengan angka berbeda: sekali di Finance
// (masuk budget) dan sekali di sini (tidak masuk budget). Sekarang mencatatnya
// di Finance, membacanya di sini.
//
// Air & listrik direkap terpisah di tab Air-Listrik (UtilityTab).
export function LogTab({ items }: { items: ResidenceLog[] }) {
  const now = new Date();

  const types = RESIDENCE_LOG_TYPES.filter((t) => t.group === 'log');
  const typeKeys = types.map((t) => t.key);
  const logs = items.filter((l) => typeKeys.includes(l.type));

  const monthTotal = useMemo(
    () =>
      logs
        .filter((l) => sameMonth(l.date.toDate(), now))
        .reduce((sum, l) => sum + l.cost, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs],
  );

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan Log: total pengeluaran rumah (selain air/listrik) bulan ini */}
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            Pemakaian bulan {monthLabel(now)}
          </VixText>
          <VixText heading="bold" additionalStyle={summaryText.value}>
            {formatRupiah(monthTotal)}
          </VixText>
        </SummaryCard>
        <VixText heading="label" additionalStyle={styles.source}>
          💰 Data dari Finance
        </VixText>

        {logs.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan. Catat pengeluaran rumahmu di Finance dengan
            kategori 🏠 Residence, nanti otomatis muncul di sini.
          </VixText>
        ) : (
          logs.map((item) => {
            const meta = TYPE_META[item.type];
            return (
              // `active={false}` + `disabled` = baris baca-saja, rupanya sama
              // dengan baris dari Finance di Log Car 🚗 & Device 📱.
              <ExpenseRow
                key={item.id}
                title={`${meta.icon} ${item.title}`}
                cost={item.cost}
                active={false}
                disabled>
                <VixText heading="label">
                  {meta.label}
                  {item.note ? ` · ${item.note}` : ''}
                </VixText>
                <VixText heading="label">{formatDate(item.date.toDate())}</VixText>
              </ExpenseRow>
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
  source: { color: Color.MAIN, marginTop: 8, marginBottom: 10 },
  empty: { textAlign: 'center', marginVertical: 10 },
});
