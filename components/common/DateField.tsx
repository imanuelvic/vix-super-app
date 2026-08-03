import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import {
  closePickers,
  nextPickerId,
  openPicker,
  subscribePicker,
} from '@/components/common/pickerBus';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatFullDate, mergeDate } from '@/lib/format';

// Field tanggal: tekan untuk buka date picker. Jam-menit asli dipertahankan
// saat ganti tanggal supaya urutan dalam satu hari tetap stabil.
// Selalu tampilkan nama harinya juga ("Jumat, 24 Juli 2026") biar langsung
// tahu itu hari apa. Hanya SATU picker terbuka di seluruh app (lihat pickerBus):
// membuka picker/kolom lain otomatis menutup picker ini.
export function DateField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) idRef.current = nextPickerId();
  const myId = idRef.current;

  // Tutup diri kalau ada picker LAIN yang dibuka (atau semua ditutup).
  useEffect(
    () => subscribePicker((openId) => setOpen(openId === myId)),
    [myId],
  );

  function toggle() {
    if (open) {
      setOpen(false);
      closePickers();
    } else {
      // Tutup keyboard teks dulu supaya spinner tidak menumpuk dengan keyboard.
      Keyboard.dismiss();
      // openPicker akan menutup picker lain lewat subscriber, lalu buka ini.
      setOpen(true);
      openPicker(myId);
    }
  }

  function handlePick(event: DateTimePickerEvent, selected?: Date) {
    // Android: dialog menutup sendiri; iOS: spinner tetap tampil.
    if (Platform.OS === 'android') {
      setOpen(false);
      closePickers();
    }
    if (event.type !== 'dismissed' && selected) {
      onChange(mergeDate(value, selected));
    }
  }

  return (
    <>
      <PressableScale style={styles.field} onPress={toggle}>
        <VixText heading="paragraph" additionalStyle={styles.text}>
          📅 {formatFullDate(value)}
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
