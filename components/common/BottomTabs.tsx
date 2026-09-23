import { useEffect, useRef, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
  placement = 'bottom',
}: {
  tabs: BottomTab<T>[];
  value: T;
  onChange: (key: T) => void;
  /**
   * 'top' (22 Sep 2026): deretan PIL di bawah pita header — untuk layar yang
   * sudah menjadi tab utama (Walk · CORE · Work). Dua tab bar bertumpuk di
   * kaki layar tidak enak dipakai, jadi sub-tabnya naik ke atas. Warna &
   * badge-nya sama; hanya bentuknya yang jadi pil, bisa digeser kalau lebih
   * dari muat.
   */
  placement?: 'bottom' | 'top';
}) {
  const theme = useFeatureTheme();
  // Ruang aman bawah (dipakai mode bawah saja; hook harus dipanggil selalu).
  const insets = useSafeAreaInsets();
  if (placement === 'top') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.topBar}
        contentContainerStyle={styles.topBarContent}>
        {tabs.map((t) => (
          <TopTab
            key={t.key}
            tab={t}
            active={value === t.key}
            bg={theme.bg}
            fg={theme.fg}
            onPress={() => onChange(t.key)}
          />
        ))}
      </ScrollView>
    );
  }
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

/**
 * Lompatan kecil ikon tab saat tab-nya JADI aktif: membesar + naik, lalu
 * memantul balik. Penanda "kamu sekarang di sini" yang terasa, bukan cuma
 * warna yang berubah diam-diam. Tidak melompat saat layar pertama dibuka —
 * hanya saat pengguna berpindah.
 *
 * Diekspor supaya tab UTAMA di kaki app (Dashboard · Habits · Home · Profile ·
 * System, app/(tabs)/_layout.tsx) memantul persis sama dengan sub-tab fitur
 * (15 Sep 2026); sebelumnya yang di bawah cuma berganti warna.
 */
export function useTabJump(active: boolean) {
  const jump = useSharedValue(0);
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

  return useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + jump.value * 0.25 },
      { translateY: jump.value * -4 },
    ],
  }));
}

// Satu tab. Saat jadi aktif, ikonnya melompat kecil (lihat useTabJump).
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
  const iconStyle = useTabJump(active);

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

// Satu pil sub-tab di ATAS (placement="top"): ikon + label sebaris; yang aktif
// berlatar pastel fitur, yang lain putih bergaris rambut.
function TopTab<T extends string>({
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
  return (
    <PressableScale
      style={[styles.pill, active && { backgroundColor: bg, borderColor: bg }]}
      onPress={onPress}>
      <IconSymbol name={tab.icon} size={16} color={active ? fg : Color.TEXT_LABEL} />
      <VixText heading="label" additionalStyle={active ? { color: fg } : undefined}>
        {tab.label}
      </VixText>
      <Badge count={tab.badge ?? 0} style={styles.pillBadge} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Deretan pil di bawah pita header. Tidak ikut menggulung bersama isi
  // (berdiri di luar ScrollView layar), jadi selalu terjangkau.
  topBar: { flexGrow: 0 },
  topBarContent: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8, gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  pillBadge: { position: 'absolute', top: -6, right: -6 },
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
