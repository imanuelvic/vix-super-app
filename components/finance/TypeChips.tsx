import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import {
  FINANCE_TYPES,
  FINANCE_TYPE_COLOR,
  FINANCE_TYPE_COLOR_DARK,
  FINANCE_TYPE_LABEL,
  type FinanceType,
} from '@/lib/categories';

// Kepekatan tombol jenis: nonaktif diredupkan, aktif tampil penuh.
const DIM = 0.45;

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
        <TypeChip
          key={t}
          type={t}
          active={value === t}
          onPress={() => onChange(t)}
        />
      ))}
    </View>
  );
}

// Satu tombol jenis. Yang dipilih MENYALA perlahan dan yang lain meredup
// bersamaan — jadi perpindahannya terbaca sebagai satu gerakan, bukan empat
// kotak yang berkedip sendiri-sendiri.
function TypeChip({
  type,
  active,
  onPress,
}: {
  type: FinanceType;
  active: boolean;
  onPress: () => void;
}) {
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, on]);

  const skin = useAnimatedStyle(() => ({
    opacity: DIM + on.value * (1 - DIM),
  }));

  return (
    <PressableScale
      style={[
        styles.chip,
        {
          backgroundColor: FINANCE_TYPE_COLOR[type],
          borderColor: FINANCE_TYPE_COLOR_DARK[type], // border versi gelap tiap jenis
        },
        skin,
      ]}
      onPress={onPress}>
      <VixText heading="label" additionalStyle={styles.text}>
        {FINANCE_TYPE_LABEL[type]}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1, // border gelap tiap jenis (warna diisi inline)
  },
  text: { color: Color.TEXT_TITLE },
});
