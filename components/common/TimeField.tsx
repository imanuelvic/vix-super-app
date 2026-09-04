import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { closePickers } from '@/components/common/pickerBus';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { usePickerSlot } from '@/hooks/usePickerSlot';
import { formatTime } from '@/lib/format';

// Field JAM — kembaran <DateField/> tapi memilih jam-menit, bukan tanggal.
// Ikut aturan pickerBus yang sama: hanya SATU picker terbuka di seluruh app.
export function TimeField({
  value,
  label,
  minimumDate,
  onChange,
}: {
  value: Date;
  /** Emoji/teks kecil di depan jam, mis. "🛏️ Tidur". */
  label?: string;
  /**
   * Jam paling awal yang boleh dipilih — dipakai "sampai jam" (tak boleh
   * lebih awal dari jam mulai). Roda jamnya sendiri yang menolak, jadi jam
   * yang salah tidak pernah sempat terpilih.
   *
   * ⚠️ Bukan pengganti penjagaan saat menyimpan: Android mengabaikannya, dan
   * nilai lama di data tetap harus diperiksa.
   */
  minimumDate?: Date;
  onChange: (date: Date) => void;
}) {
  // Sama persis dengan <DateField> — lihat hooks/usePickerSlot.
  const { open, toggle } = usePickerSlot();

  function handlePick(event: DateTimePickerEvent, selected?: Date) {
    // Android menutup dialognya sendiri; closePickers() mematikan `open`
    // lewat subscriber usePickerSlot.
    if (Platform.OS === 'android') closePickers();
    if (event.type !== 'dismissed' && selected) onChange(selected);
  }

  return (
    <>
      <PressableScale style={styles.field} onPress={toggle}>
        <VixText heading="paragraph" additionalStyle={styles.text}>
          {label ? `${label} · ` : ''}
          {formatTime(value)}
        </VixText>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={18}
          color={Color.TEXT_LABEL}
        />
      </PressableScale>
      {open && (
        <DateTimePicker
          value={value}
          minimumDate={minimumDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          style={Platform.OS === 'ios' ? styles.picker : undefined}
          // App ini selalu terang — paksa picker iOS ikut terang.
          themeVariant="light"
          textColor={Color.TEXT_TITLE}
          onChange={handlePick}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  text: { color: Color.TEXT_TITLE },
  picker: { alignSelf: 'center', width: '100%', maxWidth: 320 },
});
