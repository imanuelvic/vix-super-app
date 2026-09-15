import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTabJump } from '@/components/common/BottomTabs';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Ikon tab utama di kaki app (Dashboard · Habits · Profile · System) yang
// MELOMPAT kecil saat tab-nya jadi aktif — pantulan yang sama persis dengan
// sub-tab di dalam fitur (useTabJump di BottomTabs), supaya berpindah tab di
// mana pun terasa satu bahasa. Tombol Home punya bentuknya sendiri
// (raised-home-tab.tsx) dan melompat lewat hook yang sama.
export function BounceTabIcon({
  name,
  color,
  focused,
}: {
  name: ComponentProps<typeof IconSymbol>['name'];
  color: ColorValue;
  focused: boolean;
}) {
  const lompat = useTabJump(focused);
  return (
    <Animated.View style={lompat}>
      <IconSymbol size={28} name={name} color={color} />
    </Animated.View>
  );
}
