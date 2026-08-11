import { useRouter } from 'expo-router';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText, type VixHeading } from '@/components/common/VixText';
import { formatFullDate } from '@/lib/format';

/** Teks sapaan sesuai jam perangkat (pagi/siang/sore/malam). */
export function greetingText(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi ☀️';
  if (h < 15) return 'Selamat siang 🌤️';
  if (h < 19) return 'Selamat sore 🌇';
  return 'Selamat malam 🌙';
}

// Sapaan personal sesuai jam — teks saja (dipakai di kartu welcome Home yang
// punya layout khusus). Untuk baris sapaan + tanggal standar, pakai
// <GreetingHeader/> di bawah.
export function Greeting({
  heading = 'subheader',
  color,
  style,
}: {
  heading?: VixHeading;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <VixText
      heading={heading}
      additionalStyle={[color ? { color } : null, style]}>
      {greetingText()}
    </VixText>
  );
}

// Baris standar SAPAAN + TANGGAL — SATU tampilan untuk semua layar berdate
// (Health Summary & To-do, CORE Follow Up, Spiritual). Kalau layar punya
// streak, oper `streak` supaya muncul pil 🔥 di samping tanggal. Ubah di sini
// = semua ikut berubah, biar konsisten & rapi.
export function GreetingHeader({ streak }: { streak?: string | number }) {
  const router = useRouter();
  return (
    <View style={styles.block}>
      <Greeting heading="title" />
      <View style={styles.row}>
        <VixText heading="label">📆 {formatFullDate(new Date())}</VixText>
        {streak != null && (
          // Pil streak 🔥 → buka halaman Achievements (streak & pencapaian).
          <PressableScale
            style={styles.streakPill}
            onPress={() => router.push('/achievements')}
            hitSlop={8}>
            <VixText heading="bold" additionalStyle={styles.streakText}>
              🔥 {streak}
            </VixText>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakPill: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  streakText: { color: Color.ACCENT_DARK },
});
