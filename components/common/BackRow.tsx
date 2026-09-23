import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

/**
 * Baris "‹ Kembali" kecil untuk layar yang punya kepala sendiri (bukan
 * ScreenHeader berpita): Habits, Profile, System, Semua Pengingat. Keempatnya
 * dulu tab utama tanpa tombol kembali; sejak jadi layar biasa (22 Sep 2026,
 * versi 2.0) mereka butuh jalan pulang yang sama seperti layar lain.
 */
export function BackRow({ label = 'Kembali' }: { label?: string }) {
  const router = useRouter();
  return (
    <PressableScale style={styles.row} onPress={() => router.back()} hitSlop={8}>
      <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
      <VixText heading="bold" additionalStyle={styles.text}>
        {label}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    alignSelf: 'flex-start',
  },
  text: { color: Color.MAIN },
});
