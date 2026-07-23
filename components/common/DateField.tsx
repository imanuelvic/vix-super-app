import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatDate, mergeDate } from '@/lib/format';

// Field tanggal: tekan untuk buka date picker. Jam-menit asli dipertahankan
// saat ganti tanggal supaya urutan dalam satu hari tetap stabil.
export function DateField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);

  function handlePick(event: DateTimePickerEvent, selected?: Date) {
    // Android: dialog menutup sendiri; iOS: spinner tetap tampil.
    if (Platform.OS === 'android') setOpen(false);
    if (event.type !== 'dismissed' && selected) {
      onChange(mergeDate(value, selected));
    }
  }

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen((o) => !o)}>
        <VixText heading="paragraph" additionalStyle={styles.text}>
          📅 {formatDate(value)}
        </VixText>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={18}
          color={Color.TEXT_LABEL}
        />
      </Pressable>
      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          // App ini selalu terang — paksa picker iOS ikut terang juga,
          // kalau tidak teksnya putih (mode gelap iPhone) dan tak terbaca.
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
});
