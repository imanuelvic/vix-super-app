import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';

// Spinner loading di tengah — dipakai saat data belum termuat. Default mengisi
// ruang (flex:1) & center; layar dengan kebutuhan lain cukup oper `style`.
export function LoadingCenter({
  style,
  size = 'small',
}: {
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'large';
}) {
  return (
    <View style={[styles.center, style]}>
      <ActivityIndicator color={Color.MAIN} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
