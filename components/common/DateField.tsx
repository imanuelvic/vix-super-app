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
  placeholder,
  maximumDate,
  minimumDate,
}: {
  /**
   * null = BELUM diisi. Tanpa ini, kolom kosong terpaksa diberi tanggal hari
   * ini sebagai nilai awal — dan di layar ia terbaca seolah tanggalnya sudah
   * dipilih, padahal belum (mis. tanggal lahir yang belum diisi).
   */
  value: Date | null;
  onChange: (date: Date) => void;
  /** Tulisan saat `value` null. Wajib ada kalau kolomnya boleh kosong. */
  placeholder?: string;
  /** Batas tanggal terjauh — mis. tanggal lahir tak boleh di masa depan. */
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  // Id, "tutup diri kalau picker lain dibuka", & sakelar buka/tutup diurus
  // hooks/usePickerSlot — blok yang sama persis dulu disalin di <TimeField>.
  const { open, toggle } = usePickerSlot();

  // Roda picker harus selalu berdiri di suatu tanggal. Saat kolomnya masih
  // kosong ia mulai dari batas terjauh yang diizinkan (kalau ada) — untuk
  // tanggal lahir itu berarti hari ini, bukan tanggal acak di masa depan.
  const shown = value ?? maximumDate ?? new Date();

  function handlePick(event: DateTimePickerEvent, selected?: Date) {
    // Android: dialog menutup sendiri; iOS: spinner tetap tampil.
    // closePickers() sekalian menutup yang ini — subscriber-nya (di
    // usePickerSlot) menerima null lalu mematikan `open`. Jadi setOpen(false)
    // yang dulu ditulis di sini memang sudah tidak diperlukan.
    if (Platform.OS === 'android') closePickers();
    if (event.type !== 'dismissed' && selected) {
      // Kolom yang masih kosong belum punya jam untuk dipertahankan.
      onChange(value ? mergeDate(value, selected) : selected);
    }
  }

  return (
    <>
      <PressableScale style={styles.field} onPress={toggle}>
        <VixText
          heading="paragraph"
          additionalStyle={value ? styles.text : styles.placeholder}>
          📅 {value ? formatFullDate(value) : (placeholder ?? 'Pilih tanggal')}
        </VixText>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={18}
          color={Color.TEXT_LABEL}
        />
      </PressableScale>
      {open && (
        <DateTimePicker
          value={shown}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
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
  // Sama redupnya dengan placeholder kolom isian & SelectField — supaya "belum
  // diisi" terbaca sama di mana pun bentuk kolomnya.
  placeholder: { color: Color.TEXT_PLACEHOLDER },
  // Spinner tanggal iOS — lebar dibatasi & ditengahkan (lihat catatan di atas).
  picker: { alignSelf: 'center', width: '100%', maxWidth: 320 },
});
