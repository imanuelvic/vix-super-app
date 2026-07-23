import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Header standar layar (pola 3 kolom seperti Header.js lama):
// tombol kembali + Title/Subtitle di kiri + slot `right` di ujung kanan
// (mis. tombol emoji riwayat/budget khusus) + konten tambahan di bawah.
export function ScreenHeader({
  backLabel,
  title,
  subtitle,
  right,
  children,
}: {
  backLabel: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
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
        <View style={styles.titleRow}>
          <View style={styles.titleBox}>
            <VixText heading="header" additionalStyle={styles.title}>
              {title}
            </VixText>
            {subtitle ? <VixText heading="label">{subtitle}</VixText> : null}
          </View>
          {right ? <View style={styles.rightBox}>{right}</View> : null}
        </View>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleBox: { flex: 1 },
  title: { color: Color.MAIN },
  rightBox: { paddingTop: 4 },
});
