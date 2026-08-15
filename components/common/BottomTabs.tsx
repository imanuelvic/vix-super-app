import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
          <PressableScale
            key={t.key}
            style={styles.tabButton}
            onPress={() => onChange(t.key)}>
            <View>
              <IconSymbol
                name={t.icon}
                size={24}
                color={active ? Color.MAIN : Color.TEXT_LABEL}
              />
              {!!t.badge && t.badge > 0 && (
                <View style={styles.badge}>
                  <VixText heading="label" additionalStyle={styles.badgeText}>
                    {t.badge > 9 ? '9+' : t.badge}
                  </VixText>
                </View>
              )}
            </View>
            <VixText
              heading="label"
              additionalStyle={active ? styles.active : undefined}>
              {t.label}
            </VixText>
          </PressableScale>
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
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Color.DANGER,
    borderWidth: 1.5,
    borderColor: Color.CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Color.TEXT_REVERSE, fontSize: 11, lineHeight: 16 },
});
