import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Baris "label di kiri, nilai di kanan" untuk kartu identitas/keterangan —
// dipakai tab Info mobil 🚗 & rumah 🏠. Nilainya boleh membungkus ke baris
// berikutnya (flexShrink) tapi tetap rata kanan, jadi baris panjang seperti
// nomor rangka tidak mendorong labelnya keluar.
export function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  /**
   * Warna khusus untuk nilainya — dipakai baris yang isinya sekaligus
   * PENILAIAN, bukan sekadar angka (mis. "25,2 · Obesitas I" merah di kartu
   * data tubuh CL). Kosong = warna judul biasa.
   */
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <VixText heading="label">{label}</VixText>
      <VixText
        heading="bold"
        additionalStyle={[styles.value, valueColor ? { color: valueColor } : null]}>
        {value}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  value: { color: Color.TEXT_TITLE, flexShrink: 1, textAlign: 'right' },
});
