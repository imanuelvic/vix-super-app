import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';

// Chip keterangan kecil — "🎤 Ps. Michael", "🕙 Ibadah 3", "🔒 Arsip",
// "📖 Yeremia 29:11", "🕗 18.00–20.00".
//
// BUKAN tombol: ia tidak bisa diklik dan tidak menandakan pilihan. Tugasnya
// memecah beberapa keterangan pendek jadi butir-butir terpisah, supaya mata
// bisa mencari SATU hal (jam? pengkhotbah? iuran?) tanpa membaca seluruh
// barisnya. Yang bisa diklik ada bentuknya sendiri: <MiniButton/> untuk aksi,
// <Chip/> untuk pilihan.
//
// Sebelum ini tiap layar menulis pilnya sendiri — dan pil yang sama persis
// tertulis DUA KALI untuk satu hal yang sama: daftar Catatan Khotbah dan
// halaman catatannya masing-masing punya salinan `metaChip` & `lockChip`.
// Dua salinan begitu sama HANYA sampai salah satunya diubah.

/**
 * Warna chipnya.
 *
 * `feature` — ikut fitur tempat ia berdiri (useFeatureTheme), sama seperti
 *   <MiniButton/> & <SummaryCard/>: ungu di Spiritual, cokelat di Friends.
 * `muted`   — krem netral untuk keadaan yang BUKAN kabar, cuma penanda
 *   (mis. "🔒 Arsip"): ia tidak boleh menyaingi keterangan aslinya.
 * `onDark`  — putih redup, untuk chip yang berdiri DI ATAS kartu gelap
 *   (<SummaryCard/>), tempat warna fitur justru menghilang ke latarnya.
 */
export type ChipTone = 'feature' | 'muted' | 'onDark';

export function InfoChip({
  label,
  tone = 'feature',
}: {
  label: string;
  tone?: ChipTone;
}) {
  const theme = useFeatureTheme();
  const warna =
    tone === 'muted'
      ? { backgroundColor: Color.CONTRAST_CONTAINER, color: Color.TEXT_LABEL }
      : tone === 'onDark'
        ? {
            backgroundColor: Color.SURFACE_ON_DARK,
            color: Color.TEXT_ON_DARK_SOFT,
          }
        : { backgroundColor: theme.bg, color: theme.fg };

  return (
    <VixText heading="label" additionalStyle={[styles.chip, warna]}>
      {label}
    </VixText>
  );
}

const styles = StyleSheet.create({
  // Latar melengkung pada <Text> tetap SIKU di iOS tanpa `overflow: 'hidden'`.
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
});
