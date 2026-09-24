import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { ActionStack } from '@/components/common/ActionStack';
import { CardPreview } from '@/components/common/CardPreview';
import { Chip } from '@/components/common/Chip';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { ReminderShareCard } from '@/components/spiritual/ReminderShareCard';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useCardPng } from '@/hooks/useCardPng';
import { useNow } from '@/hooks/useNow';
import { formatFullDate } from '@/lib/format';
import {
  REMINDER_H,
  REMINDER_W,
  reminderFileName,
} from '@/lib/reminderImage';
import {
  designOf,
  photoErrorMessage,
  savePngToPhotos,
  SHARE_DESIGNS,
  sharePng,
} from '@/lib/shareImage';

// Reminder 🕊️ → gambar persegi yang bisa dikirim ke WhatsApp.
//
// Kalimatnya dioper lewat parameter (?text=…), bukan diundi ulang di sini —
// yang dibagikan harus PERSIS kalimat yang kamu lihat di Home. Kalau layar ini
// mengundi sendiri, kartu yang keluar bisa berbeda dari yang barusan kamu baca.
//
// Dua tombol, dua maksud berbeda:
//   📤 Bagikan   → lembar berbagi iOS (WhatsApp, Telegram, …). Gambarnya cuma
//                  singgah di cache, TIDAK menambah apa pun ke galeri Foto.
//   💾 Simpan    → masuk ke Foto, untuk dipakai lagi nanti.
export default function ReminderShareScreen() {
  const { now, todayId } = useNow();
  const { text } = useLocalSearchParams<{ text?: string }>();

  const kalimat = typeof text === 'string' ? text.trim() : '';

  const [pickedKey, setPickedKey] = useState<string>(SHARE_DESIGNS[0].key);
  const [error, setError] = useState<string | null>(null);
  const kerja = useBusyTask<'share' | 'save'>();

  const { svgRef, buatPng } = useCardPng(REMINDER_W, REMINDER_H);
  const design = designOf(pickedKey);

  async function jalankan(mode: 'share' | 'save') {
    await kerja.run({
      key: mode,
      start: () => setError(null),
      task: async () => {
        const png = await buatPng();
        const nama = reminderFileName(todayId);
        if (mode === 'share') {
          await sharePng(png, nama, 'Bagikan reminder hari ini');
        } else {
          await savePngToPhotos(png, nama);
        }
      },
      fail: (e) => setError(photoErrorMessage(e)),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Share Reminder 🕊️"
        subtitle="Kirim ke WhatsApp"
      />

      <ScreenError message={error} />

      {!kalimat ? (
        <View style={styles.emptyWrap}>
          <VixText heading="label" additionalStyle={styles.empty}>
            Tidak ada kalimat yang dibagikan. Buka lagi dari kartu Reminder 🕊️
            di Home ya.
          </VixText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <CardPreview width={REMINDER_W} height={REMINDER_H}>
            <ReminderShareCard
              ref={svgRef}
              text={kalimat}
              design={design}
              dateLabel={formatFullDate(now)}
              width={REMINDER_W}
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

          <ActionStack>
            <PrimaryButton
              label="📤 Bagikan ke WhatsApp"
              busy={kerja.busy === 'share'}
              onPress={() => jalankan('share')}
              background={Color.WHATSAPP}
            />
            <PrimaryButton
              label="💾 Simpan ke Foto"
              busy={kerja.busy === 'save'}
              onPress={() => jalankan('save')}
              background={Color.MAIN_DARK}
            />
          </ActionStack>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  emptyWrap: { paddingHorizontal: 20, paddingTop: 20 },
  empty: { textAlign: 'center' },
  sectionTitle: { ...SECTION_SPACE },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
