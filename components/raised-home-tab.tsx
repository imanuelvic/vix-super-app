import { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import { StyleSheet, View } from 'react-native';
import Reanimated from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { useTabJump } from '@/components/common/BottomTabs';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTabPress } from '@/hooks/useTabPress';

// Tombol Home menonjol (mengambang) di tengah tab bar — meniru tombol aksi
// utama (spt tombol "Scan" di aplikasi lain). Lingkaran teal timbul ke atas dari
// bar dengan ikon rumah putih; label "Home" di bawahnya.
//
// Ikut memantul seperti tab lain (15 Sep 2026): mengecil + bergetar saat
// disentuh (useTabPress, rasa yang sama dengan HapticTab) & lingkarannya
// melompat saat Home jadi tab aktif (useTabJump, pegas yang sama dengan
// sub-tab fitur).
export function RaisedHomeTab({
  accessibilityState,
  onPressIn,
  onPressOut,
  children: _children,
  ...rest
}: BottomTabBarButtonProps) {
  const selected = !!accessibilityState?.selected;
  const sentuh = useTabPress(onPressIn, onPressOut);
  const lompat = useTabJump(selected);
  return (
    <PlatformPressable
      {...rest}
      accessibilityState={accessibilityState}
      style={[styles.button, sentuh.scaleStyle]}
      onPressIn={sentuh.onPressIn}
      onPressOut={sentuh.onPressOut}>
      <View style={styles.lift}>
        <Reanimated.View style={[styles.circle, selected && styles.circleActive, lompat]}>
          <IconSymbol name="house.fill" size={28} color={Color.TEXT_REVERSE} />
        </Reanimated.View>
        <VixText heading="label" additionalStyle={styles.label}>
          Home
        </VixText>
      </View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // Angkat ke atas supaya lingkaran menonjol di atas garis tab bar.
  lift: { alignItems: 'center', marginTop: -20 },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
    // Cincin warna latar agar terlihat "terpotong" dari bar (spt notch).
    borderWidth: 4,
    borderColor: Color.BACKGROUND,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  circleActive: { backgroundColor: Color.MAIN_DARK },
  label: { color: Color.MAIN, marginTop: 2 },
});
