import { Pressable, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import {
  FINANCE_TYPES,
  FINANCE_TYPE_COLOR,
  FINANCE_TYPE_LABEL,
  type FinanceType,
} from '@/lib/categories';

// Baris 4 tombol jenis transaksi (Income/Expense/Saving/Investment)
// dengan warna pastel khasnya — dipakai di tab Transaksi dan Dashboard.
export function TypeChips({
  value,
  onChange,
}: {
  value: FinanceType;
  onChange: (type: FinanceType) => void;
}) {
  return (
    <View style={styles.row}>
      {FINANCE_TYPES.map((t) => (
        <Pressable
          key={t}
          style={[
            styles.chip,
            { backgroundColor: FINANCE_TYPE_COLOR[t] },
            value === t ? styles.chipActive : styles.chipInactive,
          ]}
          onPress={() => onChange(t)}>
          <VixText heading="label" additionalStyle={styles.text}>
            {FINANCE_TYPE_LABEL[t]}
          </VixText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipActive: { borderColor: Color.TEXT_TITLE },
  chipInactive: { borderColor: 'transparent', opacity: 0.55 },
  text: { color: Color.TEXT_TITLE },
});
