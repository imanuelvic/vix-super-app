import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Pil streak 🔥 → buka halaman Achievements (streak & pencapaian).
// Dipakai di baris sapaan (<GreetingHeader/>) dan di pojok kanan atas
// header layar (mis. Health → sub-tab Habits). Satu tampilan, satu tempat ubah.
export function StreakPill({ streak }: { streak: string | number }) {
  const router = useRouter();
  return (
    <PressableScale
      style={styles.pill}
      onPress={() => router.push('/achievements')}
      hitSlop={8}>
      <VixText heading="bold" additionalStyle={styles.text}>
        🔥 {streak}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: { color: Color.ACCENT_DARK },
});
