import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// "✅ Tersimpan di Photos" di bawah tombol Simpan ke Foto — tiga layar kartu
// (Bagikan Ayat 📖, Pause & Pray 🙏, Generate Feed 🖼️) dulu menyalin baris &
// gayanya sendiri-sendiri. Kapan ia muncul diputuskan `useSaveToPhotos`
// (`tersimpan`): gambar yang SEDANG tampil memang sudah ada di Foto.
export function PhotoSavedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <VixText heading="label" additionalStyle={styles.note}>
      ✅ Tersimpan di Photos
    </VixText>
  );
}

const styles = StyleSheet.create({
  note: { textAlign: 'center', color: Color.SUCCESS },
});
