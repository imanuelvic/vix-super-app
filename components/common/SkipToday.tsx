import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Pasangan komponen untuk fitur yang punya tombol "lewati hari ini":
// Baca Alkitab 📖, Revive ✝️, dan sesi latihan Fitness 💪.
//
// Artinya SAMA di ketiganya — "hari ini sengaja tidak dikerjakan, dicatat
// jujur, streak 🔥 tidak bertambah" — jadi tampilannya harus sama juga.
// Sebelum ini bloknya disalin apa adanya di tiap layar dan sempat melenceng
// beberapa piksel satu sama lain.
//
// Jarak antar-elemen sengaja TIDAK dipatok di sini: tiap layar menaruhnya di
// posisi berbeda, jadi marginnya dioper lewat `additionalStyle`.

/** Kartu status "sedang dilewati" — muncul menggantikan tombol utamanya. */
export function SkipNotice({
  title,
  detail,
  additionalStyle,
}: {
  title: string;
  detail: string;
  additionalStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, additionalStyle]}>
      <VixText heading="bold" additionalStyle={styles.cardText}>
        {title}
      </VixText>
      <VixText heading="label" additionalStyle={styles.cardText}>
        {detail}
      </VixText>
    </View>
  );
}

/**
 * Tombol lewati / batalkan lewati. `label` = teks saat BELUM dilewati
 * (mis. "⏭️ Lewati baca hari ini"); teks pembatalnya sama di semua fitur
 * jadi ditulis sekali di sini.
 */
export function SkipButton({
  skipped,
  label,
  busy = false,
  onPress,
  additionalStyle,
}: {
  skipped: boolean;
  label: string;
  busy?: boolean;
  onPress: () => void;
  additionalStyle?: StyleProp<ViewStyle>;
}) {
  return (
    // Getaran "warning": ini jalur yang mengorbankan streak, bukan klik
    // biasa — sama seperti tombol ✗ di Habits.
    <PressableScale
      style={[styles.button, additionalStyle]}
      onPress={onPress}
      disabled={busy}
      haptic="warning">
      <VixText heading="bold" additionalStyle={styles.buttonText}>
        {skipped ? '↩️ Batalkan lewati' : label}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  cardText: { color: Color.ACCENT_DARK },
  button: { alignItems: 'center', paddingVertical: 12 },
  buttonText: { color: Color.TEXT_LABEL },
});
