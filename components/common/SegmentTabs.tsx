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

  const skin = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      [Color.CONTAINER, Color.MAIN_TRANSPARENT],
    ),
    borderColor: interpolateColor(on.value, [0, 1], [Color.BORDER, Color.MAIN]),
  }));

  return (
    <PressableScale style={[styles.tab, skin]} onPress={onPress}>
      <VixText
        heading="bold"
        numberOfLines={1}
        additionalStyle={[styles.label, active && styles.labelActive]}>
        {tab.label}
      </VixText>
      {tab.sub ? (
        <VixText
          heading="label"
          additionalStyle={[styles.sub, active && styles.subActive]}>
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
  sub: { color: Color.TEXT_PLACEHOLDER },
  subActive: { color: Color.MAIN },
});
