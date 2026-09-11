import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { filledNoteLines, joinNoteLines, splitNoteLines } from '@/lib/habits';

// Catatan panjang yang diisi lewat MODAL, bukan kolom yang terjepit di daftar.
//
// Kolom isian yang duduk di antara kartu-kartu selalu kalah dua kali: ia cuma
// setinggi dua-tiga baris, dan begitu keyboard naik ia terdorong ke tepi layar
// sementara isinya sendiri tidak ikut kelihatan. Padahal justru catatan macam
// ini — refleksi harian, rangkuman mingguan — yang paling butuh ruang.
//
// Karena itu yang berdiri di daftar cuma PRATINJAU: sebuah tombol berbentuk
// kartu yang menampilkan apa yang sudah ditulis (atau ajakan mengisinya kalau
// masih kosong). Di-click → sheet terbuka dengan kolom yang lega, dan
// Batal/Simpan yang menempel di bawah.
//
// Dua bentuk isian, satu komponen:
//   • `lines` = 0 → satu paragraf bebas (refleksi harian, rangkuman)
//   • `lines` > 0 → poin bernomor ("🙏 Bersyukur 3 Hal" minta tepat tiga)
//
// Kotak pratinjaunya sengaja memakai CARD, jadi bentuknya sudah sama dengan
// kartu daftar di sekelilingnya; yang biasanya perlu ditimpa cuma tinggi
// minimumnya lewat `boxStyle` — samakan dengan kolom yang digantikannya supaya
// daftarnya tidak bergeser sedikit pun saat perubahan ini dipasang.
export function NoteField({
  title,
  placeholder,
  subtitle,
  value,
  lines = 0,
  boxStyle,
  onSave,
}: {
  /** Judul sheet-nya, mis. "📓 Catatan Hari Ini". */
  title: string;
  /** Ajakan saat masih kosong — dan, kalau `subtitle` tidak diisi, subjudulnya. */
  placeholder: string;
  /**
   * Subjudul sheet. Diisi kalau `placeholder`-nya tidak enak dibaca sebagai
   * kalimat (mis. contoh format "1. … 2. … 3. …" — bagus di kolom kosong,
   * aneh sebagai keterangan judul).
   */
  subtitle?: string;
  value: string;
  /** >0 = isinya poin bernomor, bukan satu paragraf. */
  lines?: number;
  /** Tambahan gaya untuk kotak pratinjau (biasanya `minHeight`). */
  boxStyle?: StyleProp<ViewStyle>;
  onSave: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [poin, setPoin] = useState<string[]>(() =>
    splitNoteLines(value, Math.max(lines, 1)),
  );

  const berpoin = lines > 0;
  // Pratinjau baris: poinnya dirangkai jadi satu baris pendek supaya kartunya
  // tidak memanjang tiga kali lipat.
  const pratinjau = berpoin ? filledNoteLines(value).join(' · ') : value;

  function simpan() {
    const isi = berpoin ? joinNoteLines(poin) : text.trim();
    if (isi !== value) onSave(isi);
    setOpen(false);
  }

  return (
    <>
      <PressableScale
        style={[styles.noteBox, boxStyle]}
        onPress={() => {
          // selalu mulai dari yang tersimpan
          setText(value);
          setPoin(splitNoteLines(value, Math.max(lines, 1)));
          setOpen(true);
        }}>
        <VixText
          heading="paragraph"
          additionalStyle={value ? styles.noteFilled : styles.notePlaceholder}>
          {pratinjau || placeholder}
        </VixText>
        <VixText heading="label" additionalStyle={styles.noteHint}>
          ✍️
        </VixText>
      </PressableScale>

      <SheetModal
        visible={open}
        title={title}
        subtitle={subtitle ?? placeholder}
        onClose={() => setOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            onCancel={() => setOpen(false)}
            onConfirm={simpan}
          />
        }>
        {berpoin ? (
          poin.map((isi, i) => (
            <View key={i} style={styles.noteLineBox}>
              <VixText heading="label" additionalStyle={styles.noteLineLabel}>
                {i + 1}.
              </VixText>
              <FormInput
                style={styles.noteLineInput}
                placeholder={`Hal ke-${i + 1}`}
                value={isi}
                onChangeText={(t) =>
                  setPoin((lama) => lama.map((v, j) => (j === i ? t : v)))
                }
                autoFocus={i === 0}
              />
            </View>
          ))
        ) : (
          <FormInput
            style={styles.noteSheetInput}
            placeholder={placeholder}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />
        )}
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  // Pratinjau catatan di daftar — bentuknya sama persis dengan kolom isian yang
  // digantikannya (tinggi minimum, jarak, garis tepi), jadi daftarnya tidak
  // bergeser sama sekali; bedanya ia tombol, bukan kolom.
  noteBox: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minHeight: 64,
    marginTop: -2,
    marginBottom: 8,
  },
  noteFilled: { flex: 1, color: Color.TEXT_TITLE },
  notePlaceholder: { flex: 1, color: Color.TEXT_PLACEHOLDER },
  noteHint: { color: Color.TEXT_LABEL },
  // Kolom isian DI DALAM sheet — dibuat lega, karena di sinilah menulisnya.
  noteSheetInput: { minHeight: 180, textAlignVertical: 'top' },
  // Tiga kotak kecil bernomor — bentuk untuk catatan yang isinya poin.
  noteLineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  noteLineLabel: { color: Color.TEXT_LABEL, width: 16 },
  noteLineInput: { flex: 1 },
});
