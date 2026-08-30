import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Deretan tab segmen sebaris — label di atas, keterangan kecil di bawah.
// Dipakai Habits (Pagi/Siang/Malam) dan Spiritual → Bible Reading
// (Pagi/Malam). Satu tampilan, satu tempat ubah.
export type SegmentTab<T extends string> = {
  key: T;
  label: string; // mis. "🌅 Pagi"
  sub?: string; // mis. "5/8" atau "✅ beres" — kosongkan kalau tak perlu angka
  /**
   * Warna khusus keterangannya — untuk keadaan yang harus langsung terbaca
   * "ini bukan kabar baik" (mis. sesi yang tuntas tapi ada yang dilewati).
   * Kosong = ikut warna bawaan (ikut aktif/tidaknya tab).
   */
  subColor?: string;
  /**
   * true = SELURUH tabnya ikut memerah, bukan cuma keterangannya.
   *
   * Bedanya penting: tulisan merah kecil di bawah label mudah terlewat waktu
   * mata cuma menyapu deretan tab. Kartunya yang memerah terbaca sebelum satu
   * huruf pun dibaca — dan itulah gunanya penanda "tak tuntas".
   */
  danger?: boolean;
};

export function SegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: SegmentTab<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.tabs}>
      {tabs.map((t) => (
        <Segment
          key={t.key}
          tab={t}
          active={t.key === value}
          onPress={() => onChange(t.key)}
        />
      ))}
    </View>
  );
}

// Satu segmen. Warna latar & garis tepinya berpindah halus (200 ms) supaya
// perpindahan tab terasa mengalir, bukan berkedip.
function Segment<T extends string>({
  tab,
  active,
  onPress,
}: {
  tab: SegmentTab<T>;
  active: boolean;
  onPress: () => void;
}) {
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 200 });
  }, [active, on]);

  // Tab bertanda bahaya memakai pasangan warna MERAH-nya sendiri — tapi tetap
  // ikut animasi aktif/tidaknya, jadi perpindahan tab terasa sama halusnya.
  const diam = tab.danger ? Color.DANGER_TRANSPARENT : Color.CONTAINER;
  const nyala = tab.danger ? Color.DANGER_TRANSPARENT : Color.MAIN_TRANSPARENT;
  const tepiDiam = tab.danger ? Color.DANGER : Color.BORDER;
  const tepiNyala = tab.danger ? Color.DANGER : Color.MAIN;

  const skin = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [diam, nyala]),
    borderColor: interpolateColor(on.value, [0, 1], [tepiDiam, tepiNyala]),
  }));

  return (
    <PressableScale style={[styles.tab, skin]} onPress={onPress}>
      {/* Label panjang ("🇮🇩 Indonesia" di News) mengecil sendiri agar tetap
          satu baris — tanpa ini ia terpotong. Label pendek tak terpengaruh.
          Cara yang sama dipakai tab bar bawah (components/common/BottomTabs). */}
      <VixText
        heading="bold"
        numberOfLines={1}
        adjustsFontSizeToFit
        additionalStyle={[
          styles.label,
          active && styles.labelActive,
          tab.danger && styles.labelDanger,
        ]}>
        {tab.label}
      </VixText>
      {tab.sub ? (
        <VixText
          heading="label"
          additionalStyle={[
            styles.sub,
            active && styles.subActive,
            tab.subColor ? { color: tab.subColor } : null,
          ]}>
          {tab.sub}
        </VixText>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  label: { color: Color.TEXT_LABEL },
  labelActive: { color: Color.MAIN_DARK },
  labelDanger: { color: Color.DANGER },
  sub: { color: Color.TEXT_PLACEHOLDER },
  subActive: { color: Color.MAIN },
});
