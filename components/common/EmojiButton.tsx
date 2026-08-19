import { useEffect, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tombol bundar kecil — untuk pojok kanan atas header (mis. 🕘 riwayat
// visitasi, 👛 Saku) maupun tombol aksi di dalam kartu. `active` = sedang
// aktif (mis. filter menyala) → latar hijau muda sebagai penanda, dan
// perpindahannya memudar halus.
//
// Isinya boleh emoji apa adanya, ATAU ikon simbol berwarna tunggal (`icon`) —
// rupanya rata & ringan, sama seperti ikon tile di grid Home. Emoji sengaja
// dipertahankan untuk pintasan navigasi (tiap tujuan punya lambangnya
// sendiri), sedangkan tombol aksi di dalam kartu memakai ikon supaya tidak
// ramai warna.
//
// Garis tepinya SELALU ada (saat nonaktif warnanya disamakan dengan latar) —
// dulu garis itu baru muncul saat aktif, jadi tombolnya sempat "berkedut"
// mengecil setiap kali dinyalakan.
type IconName = ComponentProps<typeof IconSymbol>['name'];

export function EmojiButton({
  emoji,
  icon,
  iconColor = Color.MAIN_DARK,
  onPress,
  active = false,
  badge = 0,
  busy = false,
  disabled = false,
}: {
  emoji?: string;
  /** Dipakai sebagai ganti `emoji` — ikon rata sewarna, bukan emoji berwarna. */
  icon?: IconName;
  iconColor?: string;
  onPress: () => void;
  active?: boolean;
  /** Angka merah di pojok — bentuknya sama dengan badge tile Home & tab bawah. */
  badge?: number;
  /** Sedang bekerja → spinner menggantikan isinya (mis. PDF sedang dibuat). */
  busy?: boolean;
  disabled?: boolean;
}) {
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, on]);

  const skin = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      [Color.ACCENT, Color.MAIN_LIGHT],
    ),
    borderColor: interpolateColor(on.value, [0, 1], [Color.ACCENT, Color.MAIN]),
  }));

  // Badge dipasang di pembungkus, BUKAN di dalam tombol: PressableScale
  // memakai `overflow` bulatnya sendiri, dan angkanya memang harus
  // menggantung keluar dari lingkaran.
  return (
    <View>
      <PressableScale
        style={[styles.button, skin]}
        onPress={onPress}
        disabled={disabled || busy}
        hitSlop={6}>
        {busy ? (
          <ActivityIndicator size="small" color={Color.MAIN} />
        ) : icon ? (
          <IconSymbol name={icon} size={19} color={iconColor} />
        ) : (
          <VixText additionalStyle={styles.emoji}>{emoji}</VixText>
        )}
      </PressableScale>
      {badge > 0 && (
        <Animated.View entering={ZoomIn.duration(220)} style={styles.badge}>
          <VixText heading="label" additionalStyle={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </VixText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: Color.ACCENT,
    backgroundColor: Color.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 19, lineHeight: 25 },
  // Ukuran & warnanya disamakan persis dengan badge di BottomTabs.
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Color.DANGER,
    borderWidth: 1.5,
    borderColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Color.TEXT_REVERSE, fontSize: 11, lineHeight: 16 },
});
