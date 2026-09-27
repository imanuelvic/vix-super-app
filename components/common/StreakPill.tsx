import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';
import type { RewardCategoryKey } from '@/lib/reward';

// Pil streak 🔥 → buka halaman Rewards (streak & pencapaian).
// Dipakai di baris sapaan (<GreetingHeader/>) dan di pojok kanan atas
// header layar (mis. tab Habits). Satu tampilan, satu tempat ubah.
//
// `category` = kategori pencapaian yang diwakili angka di pil ini. Kalau
// dioper, modal kategori itu LANGSUNG terbuka di layar Reward — pilnya
// menunjuk satu streak tertentu, jadi tidak masuk akal kalau yang dibuka cuma
// daftar semua kategori lalu harus dicari lagi. Tanpa `category` (mis. pil
// umum 🏆 di Home yang tidak mewakili satu kategori), layarnya terbuka biasa.
//
// Saat angkanya NAIK, pil ini meletup sekali — hadiah kecil yang langsung
// terlihat begitu streak hari bertambah.
export function StreakPill({
  streak,
  category,
  onBand = false,
}: {
  streak: string | number;
  category?: RewardCategoryKey;
  /**
   * Pil ini duduk DI DALAM pita header berwarna fitur (28 Sep 2026).
   *
   * Bawaannya pil memakai `Color.ACCENT`, dan itu benar selama latarnya krem
   * (baris sapaan). Tapi di pita header layar Habits, warna fiturnya JUGA
   * `Color.ACCENT` — pil dan pita jadi satu warna persis, dan tombolnya
   * praktis menghilang. Di atas pita, pil memakai warna PALING GELAP fitur itu
   * dengan tulisan terang: tetap sewarna keluarga fiturnya, tapi mustahil
   * menyatu dengan latarnya sendiri.
   */
  onBand?: boolean;
}) {
  const router = useRouter();
  const theme = useFeatureTheme();

  const count = Number(streak);
  const previous = useRef(count);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (Number.isFinite(count) && count > previous.current) {
      pop.value = withSequence(
        withTiming(1.25, { duration: 140 }),
        withSpring(1, { damping: 8, stiffness: 240 }),
      );
    }
    previous.current = count;
  }, [count, pop]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  // Letupan dipasang di pembungkus luar supaya tidak bentrok dengan animasi
  // mengecil milik PressableScale (satu view hanya boleh punya satu transform).
  return (
    <Animated.View style={popStyle}>
      <PressableScale
        style={[styles.pill, onBand && { backgroundColor: theme.deep }]}
        onPress={() =>
          router.push(
            category
              ? { pathname: '/reward-category', params: { cat: category } }
              : '/reward',
          )
        }
        hitSlop={8}>
        <VixText
          heading="bold"
          additionalStyle={onBand ? styles.textOnBand : styles.text}>
          🔥 {streak}
        </VixText>
      </PressableScale>
    </Animated.View>
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
  textOnBand: { color: Color.TEXT_REVERSE },
});
