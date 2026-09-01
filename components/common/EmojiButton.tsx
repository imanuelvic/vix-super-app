import { useEffect, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { Badge } from '@/components/common/Badge';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';

// Tombol bundar kecil — untuk pojok kanan atas header (mis. 🕘 riwayat
// visitasi, 👛 Saku) maupun tombol aksi di dalam kartu.
//
// WARNANYA IKUT FITUR tempat ia berdiri: bundaran PEKAT sewarna judul layarnya
// (biru tua di CORE, ungu di Spiritual, hijau tua di Finance). Dulu semuanya
// krem — di atas pita header yang kini berwarna, krem itu terbaca seperti
// tempelan yang bukan bagian dari layarnya.
//
// `active` = sedang menyala (mis. filter aktif) → warnanya BERTUKAR jadi
// pastel fitur dengan garis tepi gelap, dan perpindahannya memudar halus.
// `danger` = aksi merusak (hapus permanen) → merah, apa pun fiturnya: bahaya
// tidak boleh ikut berganti rupa dari layar ke layar.
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
  iconColor,
  onPress,
  active = false,
  badge = 0,
  busy = false,
  danger = false,
  disabled = false,
}: {
  emoji?: string;
  /** Dipakai sebagai ganti `emoji` — ikon rata sewarna, bukan emoji berwarna. */
  icon?: IconName;
  /** Kosongkan = ikut warna tombolnya (putih di atas bundaran pekat). */
  iconColor?: string;
  onPress: () => void;
  active?: boolean;
  /** Angka merah di pojok — bentuknya sama dengan badge tile Home & tab bawah. */
  badge?: number;
  /** Sedang bekerja → spinner menggantikan isinya (mis. PDF sedang dibuat). */
  busy?: boolean;
  /** Aksi merusak (hapus permanen) → merah, tidak ikut warna fitur. */
  danger?: boolean;
  disabled?: boolean;
}) {
  const theme = useFeatureTheme();
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, on]);

  // Diam = bundaran pekat sewarna fitur; nyala = pastelnya, bergaris tepi
  // pekat. Garis tepinya sama di kedua keadaan → ukurannya tidak berubah.
  const latarDiam = danger ? Color.DANGER : theme.fg;
  const latarNyala = danger ? Color.DANGER : theme.bg;
  const tepi = danger ? Color.DANGER : theme.fg;
  // Isi tombol: putih di atas bundaran pekat, warna fitur di atas pastelnya.
  const isi = active && !danger ? theme.fg : Color.TEXT_REVERSE;

  const skin = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [latarDiam, latarNyala]),
    borderColor: tepi,
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
          <ActivityIndicator size="small" color={isi} />
        ) : icon ? (
          <IconSymbol name={icon} size={19} color={iconColor ?? isi} />
        ) : (
          <VixText additionalStyle={styles.emoji}>{emoji}</VixText>
        )}
      </PressableScale>
      {/* Bentuknya milik <Badge> — angka yang sama dengan tile Home & sub-tab,
          jadi bentuknya pun harus sama. Tepinya krem karena tombol ini
          berdiri di atas pita header, bukan di tab bar putih. */}
      <Badge count={badge} ring={Color.BACKGROUND} style={styles.badge} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Warna latar & tepinya diisi di komponennya (ikut fitur berjalan).
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 19, lineHeight: 25 },
  badge: { position: 'absolute', top: -4, right: -6 },
});
