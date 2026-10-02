import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { BibleRefField } from '@/components/common/BibleRefField';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { BIBLE_VERSION_DEFAULT } from '@/lib/spiritual';

// Daftar isian "Bacaan 1, Bacaan 2, …" + tombol tambah kitab.
//
// Dipakai DUA tempat yang memang harus terasa sama: layar Baca Alkitab
// (mengisi bacaan hari ini) dan sheet ubah di sub-tab Bible Reading (membetulkan
// catatan lama). Sebelumnya keduanya menyalin blok yang sama persis — sampai
// gaya kartunya pun disalin utuh, lengkap dengan komentar "bentuknya disamakan
// dengan layar Baca Alkitab". Menyamakannya dengan cara menyalin berarti
// keduanya tetap sama HANYA sampai salah satunya diubah.
//
// Bedanya cuma tiga, dan ketiganya jadi prop:
//   • `inlinePicker` — daftar kitab mengembang di tempat, bukan sebagai dialog:
//     dipakai saat komponen ini berada DI DALAM sheet (modal di atas modal
//     tidak andal di iOS).
//   • `hint` — baris kecil di bawah kartu PERTAMA, mis. saran bacaan hari ini.
//   • `version` / `onVersionChange` — kolom Terjemahan di dalam kartu
//     pertama. Dulu bloknya disalin di KEDUA pemakainya, sebaris polos di
//     luar kartu; sekarang ia ikut masuk ke kartu acuannya, sekali saja.
//   • `tone` — warnanya. Bawaannya ungu Spiritual; Bible Journey 📖
//     mengopernya dari warna sesi (2 Okt 2026), supaya kartu acuan di layar
//     baca tidak jadi satu-satunya benda ungu di tengah layar pagi/malam.
export function BibleRefList({
  refs,
  onChange,
  editable = true,
  inlinePicker,
  hint,
  version,
  onVersionChange,
  tone = SPIRITUAL_REF_TONE,
}: {
  refs: string[];
  onChange: (refs: string[]) => void;
  editable?: boolean;
  inlinePicker?: boolean;
  hint?: string | null;
  /**
   * Terjemahan yang dibaca ("TB", "BIS", "NIV", …) — SATU untuk seluruh
   * bacaan hari itu, jadi kolomnya duduk di kartu PERTAMA saja. Bebas
   * diketik: daftar terjemahan di YouVersion terlalu panjang untuk dijadikan
   * pilihan, dan yang dipakai sehari-hari cuma segelintir. Kosong = TB.
   *
   * Dioper berdua dengan `onVersionChange`; tanpa keduanya kolomnya tidak
   * muncul sama sekali.
   */
  version?: string;
  onVersionChange?: (version: string) => void;
  tone?: BibleRefTone;
}) {
  return (
    <>
      {refs.map((ref, i) => (
        <View
          key={i}
          style={[
            styles.refCard,
            { backgroundColor: tone.soft, borderColor: tone.accent },
          ]}>
          <View style={styles.refTop}>
            <VixText heading="bold" additionalStyle={{ color: tone.accent }}>
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
            <VixText heading="label" additionalStyle={{ color: tone.hint }}>
              {hint}
            </VixText>
          ) : null}
          {/* Kitab & pasal saja. Yang dicatat di sini "hari ini saya baca
              Amsal 5" — ayat ke berapanya baru berarti waktu satu ayat
              dipajang ke Story, dan kolomnya ada di sana. */}
          <BibleRefField
            value={ref}
            onChange={(next) => onChange(refs.map((r, x) => (x === i ? next : r)))}
            editable={editable}
            inlinePicker={inlinePicker}
            chapterOnly
          />

          {/* Terjemahannya, di kartu yang sama dengan acuannya. Dipisah garis
              tipis: masih satu kartu, tapi jelas keterangan yang berbeda.

              Lebih dari satu kitab hari itu → labelnya menyebutkan bahwa
              satu kolom ini berlaku untuk semuanya. Tanpa itu ia terbaca
              seperti milik "Bacaan 1" saja, padahal praktiknya memang satu:
              satu app dibuka, satu terjemahan dipilih, lalu semua pasalnya
              dibaca di situ. */}
          {i === 0 && onVersionChange ? (
            <View style={[styles.versionRow, { borderTopColor: tone.accent }]}>
              <VixText heading="label" additionalStyle={{ color: tone.accent }}>
                Terjemahan{refs.length > 1 ? ' (semua bacaan)' : ''}
              </VixText>
              <FormInput
                placeholder={BIBLE_VERSION_DEFAULT}
                value={version ?? ''}
                onChangeText={onVersionChange}
                editable={editable}
                autoCapitalize="characters"
                maxLength={12}
                style={styles.versionInput}
              />
            </View>
          ) : null}
        </View>
      ))}

      {/* Baca lebih dari satu kitab hari itu? Tambah baris baru. */}
      <PressableScale
        style={[styles.addButton, { borderColor: tone.accent }]}
        onPress={() => onChange([...refs, ''])}>
        <VixText heading="bold" additionalStyle={{ color: tone.accent }}>
          ➕ Tambah kitab lain
        </VixText>
      </PressableScale>
    </>
  );
}

/**
 * Warna kartu acuan. `soft` latar kartunya, `accent` judul/garis/tepinya,
 * `hint` baris saran di bawah judul (sengaja lebih pekat dari accent, supaya
 * ia terbaca sebagai keterangan, bukan judul kedua).
 */
export type BibleRefTone = { soft: string; accent: string; hint: string };

export const SPIRITUAL_REF_TONE: BibleRefTone = {
  soft: Color.SPIRITUAL,
  accent: Color.SPIRITUAL_DARK,
  hint: Color.SPIRITUAL_DEEP,
};

const styles = StyleSheet.create({
  refCard: {
    borderRadius: 18,
    borderWidth: 1.5,
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
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  // Sempit: isinya cuma singkatan 2–4 huruf (TB, BIS, NIV, TSI).
  versionInput: { flex: 1, maxWidth: 140 },
  removeText: { color: Color.DANGER },
  addButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
});
