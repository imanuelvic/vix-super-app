import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import Animated from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { useTabJump } from '@/components/common/BottomTabs';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Ikon kelima tab utama di kaki app (Today · Walk · CORE · Work · Life).
//
// Dua penanda "kamu sekarang di sini", keduanya sama persis dengan sub-tab di
// dalam fitur (BottomTabs) supaya berpindah tab di mana pun terasa satu bahasa:
//   • PIL di belakang ikon yang aktif — terbaca sebelum warnanya sempat
//     dibandingkan. Dulu tab utama cuma berganti warna ikon, dan bedanya
//     tipis sekali.
//   • lompatan kecil saat tab-nya BARU jadi aktif (useTabJump).
//
// 24 Sep 2026: kaki app jadi BAR EMERALD GELAP, jadi pasangan warnanya
// dibalik. Dulu pil mint terang di atas bar putih; sekarang pil emerald
// (TABBAR_PILL) di atas bar emerald gelap, dengan ikon mint di atasnya.
//
// Pilnya berposisi mutlak & melebar keluar dari kotak ikon, jadi ia tidak
// menggeser tinggi tab bar sedikit pun.
export function BounceTabIcon({
  name,
  color,
  focused,
}: {
  name: ComponentProps<typeof IconSymbol>['name'];
  /**
   * Warna dari React Navigation. Dipakai apa adanya HANYA saat tab-nya tidak
   * aktif; yang aktif memakai mint sendiri, karena warna aktif dari navigator
   * (putih) memang sengaja dipilih untuk TULISANNYA, bukan ikonnya. Ikon putih
   * di atas pil emerald akan menghilangkan beda antara ikon dan label.
   */
  color: ColorValue;
  focused: boolean;
}) {
  const lompat = useTabJump(focused);
  return (
    <View>
      {focused && <View style={styles.pil} />}
      <Animated.View style={lompat}>
        <IconSymbol
          size={28}
          name={name}
          color={focused ? Color.TABBAR_ACTIVE : color}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pil: {
    position: 'absolute',
    top: -5,
    bottom: -5,
    left: -16,
    right: -16,
    borderRadius: 999,
    backgroundColor: Color.TABBAR_PILL,
  },
});
