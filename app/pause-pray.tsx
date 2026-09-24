import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { ActionStack } from '@/components/common/ActionStack';
import { CardPreview } from '@/components/common/CardPreview';
import { Chip } from '@/components/common/Chip';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { BibleStoryCard } from '@/components/spiritual/BibleStoryCard';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useCardPng } from '@/hooks/useCardPng';
import { useNow } from '@/hooks/useNow';
import {
  layoutStory,
  storyFileName,
  STORY_H,
  STORY_W,
} from '@/lib/bibleStory';
import { formatFullDate } from '@/lib/format';
import {
  archiveNo,
  designOf,
  openInstagram,
  photoErrorMessage,
  savePngToPhotos,
  SHARE_DESIGNS,
} from '@/lib/shareImage';

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
  // Tombol mana yang sedang bekerja — dua tombol, satu proses.
  const kerja = useBusyTask<'save' | 'ig'>();
  // Gambar mana yang SUDAH tersimpan di Foto (kunci = rupa + isi doanya).
  // Dipakai supaya menekan "Buka Instagram" sesudah "Simpan" tidak menyimpan
  // gambar yang sama dua kali ke galerimu.
  const [saved, setSaved] = useState<string | null>(null);
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

  /** Simpan ke Foto — dilewati kalau gambar yang persis sama sudah tersimpan. */
  async function simpanKeFoto(): Promise<void> {
    const kunci = `${design.key}|${doa}`;
    if (saved === kunci) return;
    await savePngToPhotos(await buatPng(), storyFileName(todayId, NAMA_BERKAS));
    setSaved(kunci);
  }

  /**
   * `save` = simpan ke Foto saja.
   * `ig`   = simpan ke Foto LALU buka kamera Story Instagram. Urutannya memang
   *          begitu: iOS tidak mengizinkan app lain menaruh gambar langsung ke
   *          dalam Instagram, jadi gambarnya harus sudah ada di galeri dulu —
   *          di kamera Story, foto terbaru muncul di pojok kiri bawah.
   */
  async function buatStory(mode: 'save' | 'ig') {
    if (!doa) return;
    await kerja.run({
      key: mode,
      start: () => setError(null),
      task: async () => {
        await simpanKeFoto();
        if (mode === 'ig') await openInstagram('story');
      },
      fail: (e) => setError(photoErrorMessage(e)),
    });
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
          editable={kerja.busy === null}
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

        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🎨 Style
        </VixText>
        <View style={styles.chipWrap}>
          {SHARE_DESIGNS.map((d) => (
            <Chip
              key={d.key}
              label={d.label}
              active={d.key === design.key}
              onPress={() => setPickedKey(d.key)}
            />
          ))}
        </View>

        {/* Kartu kosong tidak ada gunanya disimpan — tombolnya diredupkan
            sampai doanya diketik (buatStory juga menjaga). */}
        <ActionStack>
          <PrimaryButton
            label="💾 Simpan ke Foto"
            busy={kerja.busy === 'save'}
            onPress={() => buatStory('save')}
            background={Color.MAIN_DARK}
            additionalStyle={!doa ? styles.disabled : undefined}
          />
          <PrimaryButton
            label="📸 Buka Instagram Story"
            busy={kerja.busy === 'ig'}
            onPress={() => buatStory('ig')}
            background={Color.SPIRITUAL_DARK}
            additionalStyle={!doa ? styles.disabled : undefined}
          />

          {saved === `${design.key}|${doa}` && (
            <VixText heading="label" additionalStyle={styles.savedNote}>
              ✅ Tersimpan di Photos
            </VixText>
          )}
        </ActionStack>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  sectionTitle: { ...SECTION_SPACE },
  prayerInput: { minHeight: 110, textAlignVertical: 'top' },
  tooLong: { color: Color.DANGER, marginTop: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  disabled: { opacity: 0.45 },
  savedNote: { textAlign: 'center', color: Color.SUCCESS },
});
