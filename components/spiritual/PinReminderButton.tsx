import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// 📌 Pasang tulisan ini jadi salah satu reminder harian di Home.
//
// Menempel di sebelah label kolomnya (✨ Rhema / 🏃🏻‍➡️ Aplikasi), bukan jadi
// tombol lebar penuh di bawah: yang dipasang itu ISI SATU KOLOM, jadi tombolnya
// harus jelas milik kolom yang mana. Tombol lebar di bawah kedua kolom pasti
// bikin ragu — yang mana yang barusan dipasang?
//
// Sudah terpasang → tombolnya jadi pekat & bertanda ✅, dan menekannya lagi
// MELEPAS kalimat itu (permanen, barisnya hilang dari daftar).
export function PinReminderButton({
  active,
  disabled = false,
  onPress,
}: {
  /** Kalimat kolom ini sudah terpasang jadi reminder harian? */
  active: boolean;
  /** Kolomnya masih kosong / sedang sibuk → tak ada yang bisa dipasang. */
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      style={[styles.pill, active && styles.pillOn, disabled && styles.off]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      haptic={active ? 'light' : 'success'}>
      <VixText
        heading="label"
        additionalStyle={active ? styles.textOn : styles.text}>
        {active ? '✅ Reminder harian' : '📌 Jadikan reminder'}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Color.MAIN,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  pillOn: { backgroundColor: Color.MAIN, borderColor: Color.MAIN },
  off: { opacity: 0.4 },
  text: { color: Color.MAIN_DARK },
  textOn: { color: Color.TEXT_REVERSE },
});
