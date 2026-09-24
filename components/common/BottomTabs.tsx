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
import { BAND_GAP } from '@/components/common/ScreenHeader';
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
//
// 24 Sep 2026: BAR-nya sendiri jadi emerald gelap (Color.TABBAR_BG) dengan
// garis pemisah, sama seperti kaki app. Pil aktifnya TETAP pastel fitur, dan
// itu disengaja: pastel di atas gelap justru makin menyala, jadi sistem warna
// fitur yang jadi tulang punggung app ini tidak hilang. Yang berubah cuma
// latarnya, dan tab yang TIDAK aktif kini memakai mint redup
// (Color.TABBAR_INACTIVE) karena abu-abu lama tenggelam di latar gelap.
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
  // Pita di BAWAH tab bar (area home indicator iPhone) ikut jadi segelap
  // barnya. Sejak 24 Sep 2026 warnanya emerald gelap, bukan putih; caranya
  // persis sama, yang berubah cuma warnanya.
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
            color={active ? fg : Color.TABBAR_INACTIVE}
          />
        </Animated.View>
        {/* Bentuk & aturan angkanya milik <Badge> — sama persis dengan badge
            tile di Home, karena memang angka yang sama. */}
        <Badge count={tab.badge ?? 0} style={styles.badge} />
      </View>
      {/* Label panjang (mis. "Multiplication" di layar CORE yang punya 5 tab)
          mengecil sendiri agar tetap satu baris — tanpa ini ia terpotong dan
          tinggi tab jadi tidak rata. Label pendek tak terpengaruh.

          Warna aktifnya PASTEL fitur (bg), bukan warna gelapnya (fg), dan itu
          bukan selera: labelnya duduk DI LUAR pil, langsung di atas bar
          emerald gelap. Warna gelap fitur di sana tak terbaca sama sekali —
          `TASKS_DARK` bahkan persis #0B3D36, warna barnya sendiri, jadi label
          "Daily" di layar Reminder benar-benar hilang (kontras 1,00:1).
          Pastelnya aman untuk SEMUA fitur: yang terendah pun 6,03:1, jauh di
          atas syarat 4,5:1 (dijaga cek-pil-grid-notulen.js).

          Ikonnya tetap `fg` karena ia ada DI DALAM pil pastel itu. */}
      <VixText
        heading="label"
        numberOfLines={1}
        adjustsFontSizeToFit
        additionalStyle={{ color: active ? bg : Color.TABBAR_INACTIVE }}>
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
      <IconSymbol name={tab.icon} size={16} color={active ? fg : Color.TABBAR_INACTIVE} />
      <VixText
        heading="label"
        additionalStyle={{ color: active ? fg : Color.TABBAR_INACTIVE }}>
        {tab.label}
      </VixText>
      <Badge count={tab.badge ?? 0} style={styles.pillBadge} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Deretan pil di bawah pita header. Tidak ikut menggulung bersama isi
  // (berdiri di luar ScrollView layar), jadi selalu terjangkau.
  //
  // Latar emerald gelap: barisnya jadi satu keping utuh, bukan pil-pil yang
  // mengambang di atas krem.
  //
  // `marginTop: -BAND_GAP` MENIADAKAN napas di bawah pita ScreenHeader, jadi
  // bar ini benar-benar menempel ke pita berwarna fitur di atasnya. Keduanya
  // lalu terbaca sebagai SATU kepala layar dua warna: pastel fitur di atas,
  // emerald gelap di bawah. Dengan napas 6pt itu masih ada, di antara keduanya
  // tersisa sepotong krem dan sambungannya terlihat terputus.
  //
  // Lengkungan kepala layar sekarang dipegang di SINI (sudut bawah 24), bukan
  // di pitanya — pitanya sudah rata keempat sudutnya.
  topBar: {
    flexGrow: 0,
    marginTop: -BAND_GAP,
    backgroundColor: Color.TABBAR_BG,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: Color.TABBAR_LINE,
  },
  // paddingTop 10, bukan 2: badge pil menggantung 6pt DI ATAS pilnya, dan
  // ScrollView memotong apa pun yang keluar dari kotaknya. Dengan 2, angka
  // "5" & "2" di sub-tab Work terpotong separuh oleh pita header. Sekarang
  // ruangnya cukup, jadi badge-nya utuh di paling atas.
  topBarContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 8 },
  // Pil yang TIDAK aktif: tembus pandang bergaris tipis, bukan putih. Putih di
  // atas bar gelap terbaca seperti tombol yang menyala, jadi semua sub-tab
  // tampak aktif sekaligus dan yang benar-benar aktif kehilangan artinya.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.TABBAR_LINE,
    backgroundColor: 'transparent',
  },
  pillBadge: { position: 'absolute', top: -6, right: -6 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Color.TABBAR_BG,
    // Sudut ATAS membulat, isi layar terlihat di belakangnya — bar-nya jadi
    // terasa menumpang di atas layar, bukan memotongnya.
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: Color.TABBAR_LINE,
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
