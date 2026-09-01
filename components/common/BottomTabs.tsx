import { useEffect, useRef, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { Badge } from '@/components/common/Badge';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';

type IconName = ComponentProps<typeof IconSymbol>['name'];

export type BottomTab<T extends string> = {
  key: T;
  label: string;
  icon: IconName;
  /** Angka merah di pojok ikon — sama artinya dengan badge tile di Home. */
  badge?: number;
};

/**
 * Tempelkan angka badge ke tab tertentu:
 *   <BottomTabs tabs={withBadge(TABS, { parts: jumlahPerluPerhatian })} … />
 * Tab yang tidak disebut dibiarkan apa adanya. Dipakai semua layar yang
 * badge-nya harus sama dengan badge tile di Home.
 */
export function withBadge<T extends string>(
  tabs: BottomTab<T>[],
  badges: Partial<Record<T, number>>,
): BottomTab<T>[] {
  return tabs.map((t) =>
    badges[t.key] === undefined ? t : { ...t, badge: badges[t.key] },
  );
}

// Tab bar bawah di dalam layar fitur (Finance, Health, CORE, Car) —
// satu komponen untuk semua, biar gaya & perilakunya seragam.
// Badge memakai bentuk yang sama dengan badge tile di Home: bulat merah,
// >9 jadi "9+", 0 = tidak ditampilkan (tanda hari ini beres 🎉).
//
// Sub-menu yang sedang dibuka memakai WARNA FITURNYA (pil pastel + ikon &
// tulisan gelap senada) — pasangan warna yang sama dengan pita header di atas
// layar, jadi fiturnya terbingkai warna itu dari kepala sampai kaki.
export function BottomTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: BottomTab<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  const theme = useFeatureTheme();
  // Pita di BAWAH tab bar (area home indicator iPhone) ikut jadi putih.
  //
  // Dulu pita itu berwarna krem: layar fiturnya memakai SafeAreaView
  // edges={['top','bottom']}, jadi ruang aman bawah tergambar sebagai
  // paddingBottom milik SafeAreaView — latarnya Color.BACKGROUND, sedangkan
  // tab bar-nya Color.CONTAINER. Hasilnya dua warna bertumpuk.
  //
  // Caranya: tab bar dibuat lebih tinggi sebesar ruang aman itu
  // (paddingBottom), lalu ditarik balik dengan marginBottom NEGATIF sebesar
  // yang sama. Tinggi yang "dipesan" ke flexbox tetap seperti semula →
  // isi layar, tombol melayang (mis. FAB Reminder), dan posisi tulisan tab
  // TIDAK bergeser sedikit pun; yang berubah cuma latar putihnya kini
  // menutup sampai ujung bawah layar.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.tabBar,
        { paddingBottom: 8 + insets.bottom, marginBottom: -insets.bottom },
      ]}>
      {tabs.map((t) => (
        <Tab
          key={t.key}
          tab={t}
          active={value === t.key}
          bg={theme.bg}
          fg={theme.fg}
          onPress={() => onChange(t.key)}
        />
      ))}
    </View>
  );
}

// Satu tab. Saat jadi aktif, ikonnya melompat kecil (membesar + naik lalu
// memantul balik) — penanda "kamu sekarang di sini" yang terasa, bukan cuma
// warna yang berubah diam-diam.
function Tab<T extends string>({
  tab,
  active,
  bg,
  fg,
  onPress,
}: {
  tab: BottomTab<T>;
  active: boolean;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  const jump = useSharedValue(0);
  // Jangan melompat saat layar pertama dibuka — hanya saat pengguna berpindah.
  const mounted = useRef(false);

  useEffect(() => {
    if (active && mounted.current) {
      jump.value = withSequence(
        withTiming(1, { duration: 130 }),
        withSpring(0, { damping: 8, stiffness: 260 }),
      );
    }
    mounted.current = true;
  }, [active, jump]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + jump.value * 0.25 },
      { translateY: jump.value * -4 },
    ],
  }));

  return (
    <PressableScale style={styles.tabButton} onPress={onPress}>
      <View>
        {/* Pil pastel di belakang ikon yang sedang aktif — penanda "kamu di
            sini" yang terbaca sebelum warnanya sempat dibandingkan, dan
            sekaligus membawa warna fitur turun ke kaki layar. */}
        {active && (
          <View style={[styles.activePill, { backgroundColor: bg }]} />
        )}
        {/* Hanya ikonnya yang melompat; badge tetap diam di pojok. */}
        <Animated.View style={iconStyle}>
          <IconSymbol
            name={tab.icon}
            size={24}
            color={active ? fg : Color.TEXT_LABEL}
          />
        </Animated.View>
        {/* Bentuk & aturan angkanya milik <Badge> — sama persis dengan badge
            tile di Home, karena memang angka yang sama. */}
        <Badge count={tab.badge ?? 0} style={styles.badge} />
      </View>
      {/* Label panjang (mis. "Multiplication" di layar CORE yang punya 5 tab)
          mengecil sendiri agar tetap satu baris — tanpa ini ia terpotong dan
          tinggi tab jadi tidak rata. Label pendek tak terpengaruh. */}
      <VixText
        heading="label"
        numberOfLines={1}
        adjustsFontSizeToFit
        additionalStyle={active ? { color: fg } : undefined}>
        {tab.label}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Color.CONTAINER,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    // paddingBottom ditimpa di komponennya (8 + ruang aman bawah).
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabButton: { flex: 1, alignItems: 'center', gap: 2 },
  // Pil di BELAKANG ikon (posisi mutlak, melebar keluar dari kotak ikon 24pt)
  // supaya menambahkannya tidak menggeser tinggi tab sedikit pun.
  activePill: {
    position: 'absolute',
    top: -5,
    bottom: -5,
    left: -14,
    right: -14,
    borderRadius: 999,
  },
  badge: { position: 'absolute', top: -6, right: -10 },
});
