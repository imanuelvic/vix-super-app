import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Deretan tab segmen sebaris — label di atas, keterangan kecil di bawah.
// Dipakai Health → Habits (Pagi/Siang/Malam) dan Spiritual → Bible Read
// (Pagi/Malam). Satu tampilan, satu tempat ubah.
export type SegmentTab<T extends string> = {
  key: T;
  label: string; // mis. "🌅 Pagi"
  sub: string; // mis. "5/8" atau "✅ beres"
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
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <PressableScale
            key={t.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(t.key)}>
            <VixText
              heading="bold"
              numberOfLines={1}
              additionalStyle={[styles.label, active && styles.labelActive]}>
              {t.label}
            </VixText>
            <VixText
              heading="label"
              additionalStyle={[styles.sub, active && styles.subActive]}>
              {t.sub}
            </VixText>
          </PressableScale>
        );
      })}
    </View>
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
  tabActive: {
    borderColor: Color.MAIN,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  label: { color: Color.TEXT_LABEL },
  labelActive: { color: Color.MAIN_DARK },
  sub: { color: Color.TEXT_PLACEHOLDER },
  subActive: { color: Color.MAIN },
});
