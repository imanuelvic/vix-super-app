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
import { formatTime } from '@/lib/format';

// Field JAM — kembaran <DateField/> tapi memilih jam-menit, bukan tanggal.
// Ikut aturan pickerBus yang sama: hanya SATU picker terbuka di seluruh app.
export function TimeField({
  value,
  label,
  onChange,
}: {
  value: Date;
  /** Emoji/teks kecil di depan jam, mis. "🛏️ Tidur". */
  label?: string;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) idRef.current = nextPickerId();
  const myId = idRef.current;

  useEffect(
    () => subscribePicker((openId) => setOpen(openId === myId)),
    [myId],
  );

  function toggle() {
    if (open) {
      setOpen(false);
      closePickers();
    } else {
      Keyboard.dismiss();
      setOpen(true);
      openPicker(myId);
    }
  }

  function handlePick(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      closePickers();
    }
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
