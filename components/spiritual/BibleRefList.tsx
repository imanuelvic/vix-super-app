import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { BibleRefField } from '@/components/common/BibleRefField';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Daftar isian "Bacaan 1, Bacaan 2, …" + tombol tambah kitab.
//
// Dipakai DUA tempat yang memang harus terasa sama: layar Baca Alkitab
// (mengisi bacaan hari ini) dan sheet ubah di sub-tab Bible Reading (membetulkan
// catatan lama). Sebelumnya keduanya menyalin blok yang sama persis — sampai
// gaya kartunya pun disalin utuh, lengkap dengan komentar "bentuknya disamakan
// dengan layar Baca Alkitab". Menyamakannya dengan cara menyalin berarti
// keduanya tetap sama HANYA sampai salah satunya diubah.
//
// Bedanya cuma dua, dan keduanya jadi prop:
//   • `inlinePicker` — daftar kitab mengembang di tempat, bukan sebagai dialog:
//     dipakai saat komponen ini berada DI DALAM sheet (modal di atas modal
//     tidak andal di iOS).
//   • `hint` — baris kecil di bawah kartu PERTAMA, mis. saran bacaan hari ini.
export function BibleRefList({
  refs,
  onChange,
  editable = true,
  inlinePicker,
  hint,
}: {
  refs: string[];
  onChange: (refs: string[]) => void;
  editable?: boolean;
  inlinePicker?: boolean;
  hint?: string | null;
}) {
  return (
    <>
      {refs.map((ref, i) => (
        <View key={i} style={styles.refCard}>
          <View style={styles.refTop}>
            <VixText heading="bold" additionalStyle={styles.refTitle}>
              Bacaan {i + 1}
            </VixText>
            {/* Tombol hapus baru muncul saat barisnya lebih dari satu:
                menghapus satu-satunya baris cuma menyisakan formulir kosong. */}
            {refs.length > 1 && (
              <PressableScale
                onPress={() => onChange(refs.filter((_, x) => x !== i))}
                hitSlop={10}>
                <VixText heading="label" additionalStyle={styles.removeText}>
                  Hapus
                </VixText>
              </PressableScale>
            )}
          </View>
          {i === 0 && hint ? (
            <VixText heading="label" additionalStyle={styles.suggestHint}>
              {hint}
            </VixText>
          ) : null}
          <BibleRefField
            value={ref}
            onChange={(next) => onChange(refs.map((r, x) => (x === i ? next : r)))}
            editable={editable}
            inlinePicker={inlinePicker}
          />
        </View>
      ))}

      {/* Baca lebih dari satu kitab hari itu? Tambah baris baru. */}
      <PressableScale
        style={styles.addButton}
        onPress={() => onChange([...refs, ''])}>
        <VixText heading="bold" additionalStyle={styles.addText}>
          ➕ Tambah kitab lain
        </VixText>
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  refCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  refTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  refTitle: { color: Color.SPIRITUAL_DARK },
  // Sedikit lebih gelap dari judul kartunya: keterangan, bukan judul kedua.
  suggestHint: { color: Color.SPIRITUAL_DEEP },
  removeText: { color: Color.DANGER },
  addButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.SPIRITUAL_DARK,
    marginBottom: 12,
  },
  addText: { color: Color.SPIRITUAL_DARK },
});
