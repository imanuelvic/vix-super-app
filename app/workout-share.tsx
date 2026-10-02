import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
import { SECTION_SPACE } from '@/assets/style/section';
import { ActionStack } from '@/components/common/ActionStack';
import { CardPreview } from '@/components/common/CardPreview';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ShareStylePicker } from '@/components/common/ShareStylePicker';
import { VixText } from '@/components/common/VixText';
import { WorkoutShareCard } from '@/components/fitness/WorkoutShareCard';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useCardPng } from '@/hooks/useCardPng';
import { useNow } from '@/hooks/useNow';
import { fitKindMeta, type FitKind } from '@/lib/fitness';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import {
  designOf,
  photoErrorMessage,
  savePngToPhotos,
  SHARE_DESIGNS,
  sharePng,
} from '@/lib/shareImage';
import { shareTextToWhatsApp, WHATSAPP_ERROR } from '@/lib/whatsapp';
import {
  workoutCaption,
  workoutCheer,
  workoutFileName,
  workoutGreeting,
  WORKOUT_H,
  WORKOUT_W,
  type WorkoutShare,
} from '@/lib/workoutShare';

// Sesi olahraga 💪 → kartu persegi untuk grup keluarga di WhatsApp.
//
// Sesinya dioper lewat parameter (pendek: jenis, detik, km, lokasi, hari),
// jadi layar ini TIDAK membaca Firestore sama sekali — sama seperti layar
// Story ayat & Share Reminder.
//
// Tiga tombol, tiga maksud berbeda:
//   📤 Bagikan Fotonya   → lembar berbagi iOS. Di situlah grup keluarganya
//                          dipilih; WhatsApp tidak punya tautan "kirim ke grup
//                          X", jadi tidak ada cara lain yang jujur.
//   💬 Kirim Teksnya     → WhatsApp terbuka dengan kalimatnya sudah siap,
//                          tanpa gambar. Untuk hari yang kamu malas menunggu
//                          gambarnya dibuat.
//   💾 Simpan ke Foto    → masuk galeri, untuk dipakai lagi nanti.
export default function WorkoutShareScreen() {
  const { now, todayId } = useNow();
  const params = useLocalSearchParams<{
    kind?: string;
    seconds?: string;
    km?: string;
    place?: string;
    dayId?: string;
  }>();

  const angka = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const kind = (params.kind ?? 'run') as FitKind;
  const seconds = angka(params.seconds);
  const km = angka(params.km);
  const place = typeof params.place === 'string' ? params.place : '';
  const dayId = typeof params.dayId === 'string' && params.dayId ? params.dayId : todayId;

  // Kalimatnya diundi per hari, lalu bisa digeser sendiri sampai ketemu yang
  // pas. Yang digeser nomornya, bukan undiannya — jadi kembali ke 0 selalu
  // memberi kalimat yang sama seperti saat layar ini dibuka.
  const [putar, setPutar] = useState(0);
  const [pickedKey, setPickedKey] = useState<string>(SHARE_DESIGNS[0].key);
  const [error, setError] = useState<string | null>(null);
  const kerja = useBusyTask<'share' | 'text' | 'save'>();

  const { svgRef, buatPng } = useCardPng(WORKOUT_W, WORKOUT_H);
  const design = designOf(pickedKey);

  const share: WorkoutShare = {
    kind,
    seconds,
    km,
    place,
    dateLabel: formatFullDate(dayIdToDate(dayId)),
    // Sapaannya ikut jam SEKARANG, bukan jam sesinya: yang membaca di grup
    // membacanya sekarang, jadi "selamat pagi" di jam 9 malam cuma aneh.
    greeting: workoutGreeting(now),
    cheer: workoutCheer(dayId, putar),
  };
  const caption = workoutCaption(share);

  async function jalankan(mode: 'share' | 'text' | 'save') {
    await kerja.run({
      key: mode,
      start: () => setError(null),
      task: async () => {
        if (mode === 'text') {
          await shareTextToWhatsApp(caption, () => setError(WHATSAPP_ERROR));
          return;
        }
        const png = await buatPng();
        const nama = workoutFileName(dayId, kind);
        if (mode === 'share') {
          await sharePng(png, nama, 'Bagikan ke grup keluarga');
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
        backLabel="Fitness"
        title="Share Workout 💪"
        subtitle="Pilih grup keluarga di lembar berbagi"
      />

      <ScreenError message={error} />

      {seconds <= 0 ? (
        <View style={styles.emptyWrap}>
          <VixText heading="label" additionalStyle={styles.empty}>
            Tidak ada sesi yang dibagikan. Buka lagi dari sub-tab Record ⏱️ di
            Fitness ya.
          </VixText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <CardPreview width={WORKOUT_W} height={WORKOUT_H}>
            <WorkoutShareCard
              ref={svgRef}
              share={share}
              design={design}
              width={WORKOUT_W}
            />
          </CardPreview>

          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            💬 Kata-kata Penyemangat
          </VixText>
          <PressableScale
            style={styles.cheerCard}
            onPress={() => setPutar((n) => n + 1)}>
            <VixText heading="paragraph" additionalStyle={styles.cheerText}>
              {share.cheer}
            </VixText>
            <VixText heading="label" additionalStyle={styles.cheerHint}>
              🔄 Click untuk ganti kalimatnya
            </VixText>
          </PressableScale>

          <ShareStylePicker value={design.key} onChange={setPickedKey} />

          {/* Yang akan terkirim kalau teksnya dikirim sendiri — ditampilkan
              apa adanya, supaya tidak ada kejutan di grup keluarga. */}
          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            📝 Pesannya
          </VixText>
          <View style={styles.captionBox}>
            <VixText heading="paragraph" additionalStyle={styles.captionText}>
              {caption}
            </VixText>
          </View>

          <ActionStack>
            <PrimaryButton
              label={`📤 Bagikan ${fitKindMeta(kind).emoji} Fotonya`}
              busy={kerja.busy === 'share'}
              onPress={() => jalankan('share')}
              background={Color.WHATSAPP}
            />
            <PrimaryButton
              label="💬 Kirim Teksnya Saja"
              busy={kerja.busy === 'text'}
              onPress={() => jalankan('text')}
              background={Color.FITNESS_DARK}
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
  safe: { ...SCREEN_SAFE },
  content: { ...SCREEN_CONTENT, paddingBottom: 32 },
  emptyWrap: { paddingHorizontal: 20, paddingTop: 20 },
  empty: { textAlign: 'center' },
  sectionTitle: { ...SECTION_SPACE },
  cheerCard: {
    ...PANEL,
    borderLeftWidth: 3,
    borderLeftColor: Color.FITNESS_DARK,
    padding: 14,
    gap: 6,
  },
  cheerText: { color: Color.TEXT_TITLE, lineHeight: 24 },
  cheerHint: { color: Color.FITNESS_DARK },
  captionBox: { ...PANEL, padding: 14 },
  captionText: { color: Color.TEXT_PARAGRAPH, lineHeight: 22 },
});
