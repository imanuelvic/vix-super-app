import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Header standar layar: tombol kembali + judul + subjudul/konten tambahan.
export function ScreenHeader({
  backLabel,
  title,
  subtitle,
  children,
}: {
  backLabel: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View>
      <Pressable
        style={styles.backRow}
        onPress={() => router.back()}
        hitSlop={8}>
        <IconSymbol name="chevron.left" size={22} color={Color.MAIN} />
        <VixText heading="bold" additionalStyle={styles.backText}>
          {backLabel}
        </VixText>
      </Pressable>
      <View style={styles.header}>
        <VixText heading="header" additionalStyle={styles.title}>
          {title}
        </VixText>
        {subtitle ? <VixText heading="label">{subtitle}</VixText> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  backText: { color: Color.MAIN },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  title: { color: Color.MAIN },
});
