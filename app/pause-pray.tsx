import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
import { SECTION_SPACE } from '@/assets/style/section';
import { ActionStack } from '@/components/common/ActionStack';
import { CardPreview } from '@/components/common/CardPreview';
import { FormInput } from '@/components/common/FormInput';
import { PhotoSavedNote } from '@/components/common/PhotoSavedNote';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ShareStylePicker } from '@/components/common/ShareStylePicker';
import { VixText } from '@/components/common/VixText';
import { BibleStoryCard } from '@/components/spiritual/BibleStoryCard';
import { useCardPng } from '@/hooks/useCardPng';
import { useNow } from '@/hooks/useNow';
import { useSaveToPhotos, type PhotoMode } from '@/hooks/useSaveToPhotos';
import {
  layoutStory,
  storyFileName,
  STORY_H,
  STORY_W,
} from '@/lib/bibleStory';
import { formatFullDate } from '@/lib/format';
import { archiveNo, designOf, SHARE_DESIGNS } from '@/lib/shareImage';

// Pause & Pray 🙏 → doa singkat jadi Story Instagram 9:16.
//
// Kembarannya Bagikan Ayat 📖: kartunya PERSIS sama (lihat BibleStoryCard),
// yang berganti cuma kop di atasnya — "MIDDAY READING" jadi "PAUSE & PRAY" —
// dan tidak ada baris acuan, karena yang dibagikan doamu sendiri, bukan kutipan
// dari kitab mana pun.
//
// Layar ini TIDAK menyimpan apa pun ke Firestore. Doanya diketik, dijadikan
// gambar, lalu selesai — persis seperti Bagikan Ayat & Bagikan Reminder. Yang
// mau disimpan sebagai catatan punya tempatnya sendiri (Revive, Syukur).
const KOP = 'PAUSE & PRAY';

// Nama berkas di Foto/Files — sekeluarga dengan Story ayat & Feed refleksi.
const NAMA_BERKAS = 'Pause & Pray';

export default function PausePrayScreen() {
  const { now, todayId } = useNow();

  const [prayer, setPrayer] = useState('');
  const [pickedKey, setPickedKey] = useState(SHARE_DESIGNS[0].key);
  const [error, setError] = useState<string | null>(null);

  const { svgRef, buatPng } = useCardPng(STORY_W, STORY_H);
  const design = designOf(pickedKey);
  const doa = prayer.trim();

  // Doa yang terlalu panjang DIPOTONG oleh penata teksnya (lihat layoutText):
  // sesudah ukuran huruf terkecil pun tak cukup, sisa barisnya dibuang. Itu
  // tidak boleh terjadi diam-diam — kalimat terakhir doamu hilang tanpa kamu
  // tahu. Jadi dihitung ulang di sini & diberitahukan.
  const muat = layoutStory(doa).lines.join(' ').length;
  const terpotong = doa.length > 0 && muat < doa.replace(/\s+/g, ' ').length;

  // 💾 Simpan ke Foto / 📸 simpan lalu buka kamera Story — alurnya milik
  // bersama ketiga layar kartu (hooks/useSaveToPhotos.ts). Kunci gambarnya =
  // rupa + isi doanya.
  const foto = useSaveToPhotos({
    kunci: `${design.key}|${doa}`,
    buatPng,
    namaBerkas: storyFileName(todayId, NAMA_BERKAS),
    instagram: 'story',
    setError,
  });

  /** Doa kosong tidak ada gunanya dijadikan gambar (tombolnya juga diredupkan). */
  function buatStory(mode: PhotoMode) {
    if (!doa) return;
    return foto.jalankan(mode);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title="Pause & Pray 🙏"
        subtitle="Berhenti sejenak, dan abadikan doa-mu"
      />

      <ScreenError message={error} />

      <ScrollView contentContainerStyle={styles.content}>
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🙏 Tulis Doa
        </VixText>
        <FormInput
          style={styles.prayerInput}
          placeholder="Doa"
          value={prayer}
          onChangeText={setPrayer}
          multiline
          editable={foto.busy === null}
        />
        {terpotong && (
          <VixText heading="label" additionalStyle={styles.tooLong}>
            ✂️ Doanya kepanjangan
          </VixText>
        )}

        <CardPreview width={STORY_W} height={STORY_H} max={260}>
          <BibleStoryCard
            ref={svgRef}
            verse={doa}
            sessionLabel={KOP}
            design={design}
            dateLabel={formatFullDate(now)}
            archiveLabel={archiveNo(todayId)}
            width={STORY_W}
          />
        </CardPreview>

        <ShareStylePicker value={design.key} onChange={setPickedKey} />

        {/* Kartu kosong tidak ada gunanya disimpan — tombolnya diredupkan
            sampai doanya diketik (buatStory juga menjaga). */}
        <ActionStack>
          <PrimaryButton
            label="💾 Simpan ke Foto"
            busy={foto.busy === 'save'}
            onPress={() => buatStory('save')}
            background={Color.MAIN_DARK}
            additionalStyle={!doa ? styles.disabled : undefined}
          />
          <PrimaryButton
            label="📸 Buka Instagram Story"
            busy={foto.busy === 'ig'}
            onPress={() => buatStory('ig')}
            background={Color.SPIRITUAL_DARK}
            additionalStyle={!doa ? styles.disabled : undefined}
          />

          <PhotoSavedNote show={foto.tersimpan} />
        </ActionStack>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...SCREEN_SAFE },
  content: { ...SCREEN_CONTENT, paddingBottom: 32 },
  sectionTitle: { ...SECTION_SPACE },
  prayerInput: { minHeight: 110, textAlignVertical: 'top' },
  tooLong: { color: Color.DANGER, marginTop: 6 },
  disabled: { opacity: 0.45 },
});
