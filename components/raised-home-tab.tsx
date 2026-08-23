import { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tombol Home menonjol (mengambang) di tengah tab bar — meniru tombol aksi
// utama (spt tombol "Scan" di aplikasi lain). Lingkaran teal timbul ke atas dari
// bar dengan ikon rumah putih; label "Home" di bawahnya.
export function RaisedHomeTab({
  accessibilityState,
  onPressIn,
  children: _children,
  ...rest
}: BottomTabBarButtonProps) {
  const selected = accessibilityState?.selected;
  return (
    <PlatformPressable
      {...rest}
      accessibilityState={accessibilityState}
      style={styles.button}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}>
      <View style={styles.lift}>
        <View style={[styles.circle, selected && styles.circleActive]}>
          <IconSymbol name="house.fill" size={28} color={Color.TEXT_REVERSE} />
        </View>
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
