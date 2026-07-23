import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

type IconName = ComponentProps<typeof IconSymbol>['name'];

export type BottomTab<T extends string> = {
  key: T;
  label: string;
  icon: IconName;
};

// Tab bar bawah di dalam layar fitur (Finance, Health, CORE, Car) —
// satu komponen untuk semua, biar gaya & perilakunya seragam.
export function BottomTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: BottomTab<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <Pressable
            key={t.key}
            style={styles.tabButton}
            onPress={() => onChange(t.key)}>
            <IconSymbol
              name={t.icon}
              size={24}
              color={active ? Color.MAIN : Color.TEXT_LABEL}
            />
            <VixText
              heading="label"
              additionalStyle={active ? styles.active : undefined}>
              {t.label}
            </VixText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Color.CONTAINER,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    paddingVertical: 8,
  },
  tabButton: { flex: 1, alignItems: 'center', gap: 2 },
  active: { color: Color.MAIN },
});
