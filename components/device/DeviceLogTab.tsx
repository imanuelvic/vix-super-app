import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ExpenseRow } from '@/components/common/ExpenseRow';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { categoryOf } from '@/lib/categories';
import { formatShortDayDate, monthLabel } from '@/lib/format';
import { formatRupiah, type Transaction } from '@/lib/transactions';

// Tab Log 🧾 — pengeluaran soal perangkat, BACA-SAJA.
//
// Sumbernya transaksi Finance kategori "Mobile, Data & Administration" — bukan
// catatan terpisah. Aturannya sama persis dengan Log di Car 🚗 & Air-Listrik di
// Residence 🏠: satu pengeluaran cuma boleh punya SATU tempat pencatatan,
// supaya tidak pernah ada dua angka yang berbeda untuk hal yang sama.
// Mengubahnya di Finance, bukan di sini.
export function DeviceLogTab({ transactions }: { transactions: Transaction[] }) {
  const now = new Date();

  const { bulanIni, total } = useMemo(() => {
    let bulanIni = 0;
    let total = 0;
    for (const t of transactions) {
      const d = t.date.toDate();
      total += t.amount;
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      ) {
        bulanIni += t.amount;
      }
    }
    return { bulanIni, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            📱 Pengeluaran perangkat {monthLabel(now)}
          </VixText>
          <VixText heading="subheader" additionalStyle={summaryText.value}>
            {formatRupiah(bulanIni)}
          </VixText>
          <VixText heading="label" additionalStyle={summaryText.label}>
            Seluruhnya {formatRupiah(total)}
          </VixText>
        </SummaryCard>

        {transactions.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada pengeluaran perangkat. Catat pulsa/paket datamu di Finance,
            nanti otomatis muncul di sini 📱
          </VixText>
        ) : (
          transactions.map((t) => {
            const cat = categoryOf('expense', t.category);
            return (
              // `active={false}` + `disabled` = baris baca-saja, rupanya sama
              // dengan baris dari Finance di Log Car & Residence.
              <ExpenseRow
                key={t.id}
                title={`${cat.icon} ${t.note || cat.label}`}
                cost={t.amount}
                active={false}
                disabled>
                <VixText heading="label">
                  {formatShortDayDate(t.date.toDate())}
                </VixText>
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
  empty: { textAlign: 'center', marginVertical: 10 },
});
