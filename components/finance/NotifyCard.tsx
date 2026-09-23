import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { notifyAvailable } from '@/lib/notify';

// 🔔 Pintu ke layar Pengingat dari Dashboard Finance.
//
// Sakelarnya sendiri sudah pindah ke satu tempat (app/notifications.tsx, 23 Sep
// 2026): sejak pengingatnya bukan cuma Finance, dua sakelar untuk hal yang sama
// cuma bikin bingung mana yang menang. Yang tinggal di sini tautannya, plus
// keterangan jam & janji "tanpa nominal" — itu yang memang khas Finance.
export function NotifyCard() {
  const router = useRouter();
  const tersedia = notifyAvailable();
  return (
    <PressableScale style={styles.card} onPress={() => router.push('/notifications')}>
      <View style={styles.main}>
        <VixText heading="bold" additionalStyle={styles.title}>
          🔔 Pengingat harian di HP
        </VixText>
        <VixText heading="label">
          Pagi 07.30 status jatah hari ini · malam 20.30 catat pengeluaran. Tanpa nominal.
        </VixText>
        {!tersedia && (
          <VixText heading="label" additionalStyle={styles.warn}>
            Butuh build app baru (expo-notifications belum ada di build ini).
          </VixText>
        )}
      </View>
      <IconSymbol name="chevron.right" size={18} color={Color.TEXT_PLACEHOLDER} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: CARD_GAP,
  },
  main: { flex: 1, gap: 2 },
  title: { color: Color.TEXT_TITLE },
  warn: { color: Color.WARNING },
});
