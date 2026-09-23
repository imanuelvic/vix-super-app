import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTabJump } from '@/components/common/BottomTabs';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Ikon kelima tab utama di kaki app (Today · Walk · CORE · Work · Life) yang
// MELOMPAT kecil saat tab-nya jadi aktif — pantulan yang sama persis dengan
// sub-tab di dalam fitur (useTabJump di BottomTabs), supaya berpindah tab di
// mana pun terasa satu bahasa. (22 Sep 2026: tombol Home timbul dibuang;
// Today kini tab pertama yang bentuknya sama dengan yang lain.)
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
