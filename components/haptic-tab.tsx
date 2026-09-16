import { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";

import { useTabPress } from '@/hooks/useTabPress';

/**
 * Tombol tab utama di kaki app: getaran halus + sedikit MENGECIL saat disentuh
 * lalu memantul balik (15 Sep 2026; sebelumnya cuma bergetar), sama dengan
 * sub-tab di dalam fitur (PressableScale di BottomTabs). Rasa sentuhnya ada
 * di hooks/useTabPress (dipakai juga RaisedHomeTab); lompatan ikonnya sendiri
 * ada di BounceTabIcon.
 */
export function HapticTab({ style, onPressIn, onPressOut, ...rest }: BottomTabBarButtonProps) {
  const sentuh = useTabPress(onPressIn, onPressOut);
  return (
    <PlatformPressable
      {...rest}
      style={[style, sentuh.scaleStyle]}
      onPressIn={sentuh.onPressIn}
      onPressOut={sentuh.onPressOut}
    />
  );
}
