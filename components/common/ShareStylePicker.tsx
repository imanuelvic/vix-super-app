import { StyleSheet, View } from 'react-native';

import { SECTION_SPACE } from '@/assets/style/section';
import { Chip } from '@/components/common/Chip';
import { VixText } from '@/components/common/VixText';
import { SHARE_DESIGNS } from '@/lib/shareImage';

// 🎨 Pilih rupa kartu — Morning🌅 · Midday🌤️ · Night🌙.
//
// Dipakai KEEMPAT layar "kartu jadi gambar": Bagikan Ayat 📖, Pause & Pray 🙏,
// Bagikan Reminder 🕊️, & Share Workout 💪. Sebelum ini blok yang sama persis
// disalin di keempatnya, lengkap dengan dua entri gayanya — dan empat salinan
// yang identik hanya identik SAMPAI salah satunya diubah.
//
// Daftar rupanya sendiri tidak dioper: ia memang satu untuk seluruh app
// (lib/shareImage.ts), dan itulah yang membuat gambar dari fitur mana pun
// terbaca sebagai satu arsip yang sama.
export function ShareStylePicker({
  value,
  onChange,
}: {
  /** Kunci rupa yang sedang aktif (`designOf(value)` di layarnya). */
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <>
      <VixText heading="title" additionalStyle={styles.title}>
        🎨 Style
      </VixText>
      <View style={styles.chips}>
        {SHARE_DESIGNS.map((d) => (
          <Chip
            key={d.key}
            label={d.label}
            active={d.key === value}
            onPress={() => onChange(d.key)}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { ...SECTION_SPACE },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
