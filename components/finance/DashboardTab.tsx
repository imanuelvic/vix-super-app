import { useMemo, useState } from 'react';
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
import { formatRupiah, type Transaction } from '@/lib/transactions';

type CategoryTotal = {
  key: string;
  category: FinanceCategory;
  value: number;
  color: string;
};

// Tab Dashboard: grafik donat + total transaksi per kategori
// untuk bulan yang sedang dipilih (bulan dikontrol dari header Finance).
export function DashboardTab({ items }: { items: Transaction[] }) {
  const [type, setType] = useState<FinanceType>('expense');

  const { data, total } = useMemo(() => {
    // Jumlahkan nominal per kategori untuk jenis yang dipilih.
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.type === type) {
        map.set(item.category, (map.get(item.category) ?? 0) + item.amount);
      }
    }
    // Urutkan dari terbesar, lalu beri warna irisan bergiliran.
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
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
