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
  // Id, "tutup diri kalau picker lain dibuka", & sakelar buka/tutup diurus
  // hooks/usePickerSlot — blok yang sama persis dulu disalin di <TimeField>.
  const { open, toggle } = usePickerSlot();

  function handlePick(event: DateTimePickerEvent, selected?: Date) {
    // Android: dialog menutup sendiri; iOS: spinner tetap tampil.
    // closePickers() sekalian menutup yang ini — subscriber-nya (di
    // usePickerSlot) menerima null lalu mematikan `open`. Jadi setOpen(false)
    // yang dulu ditulis di sini memang sudah tidak diperlukan.
    if (Platform.OS === 'android') closePickers();
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
          // iOS: batasi lebar & tengahkan. Di layar lebar (iPad landscape)
          // spinner memakai lebar penuh tapi rodanya menempel ke KIRI — dengan
          // maxWidth + alignSelf center, rodanya jadi di tengah. Di HP lebar
          // layar < 320 jadi tampilannya tetap sama seperti sebelumnya.
          style={Platform.OS === 'ios' ? styles.picker : undefined}
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
  // Spinner tanggal iOS — lebar dibatasi & ditengahkan (lihat catatan di atas).
  picker: { alignSelf: 'center', width: '100%', maxWidth: 320 },
});
