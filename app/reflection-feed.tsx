import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
import { SECTION_SPACE } from '@/assets/style/section';
import { ActionStack } from '@/components/common/ActionStack';
import { CardPreview } from '@/components/common/CardPreview';
import { Chip } from '@/components/common/Chip';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PhotoSavedNote } from '@/components/common/PhotoSavedNote';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { ReflectionFeedCard } from '@/components/spiritual/ReflectionFeedCard';
import { useAuth } from '@/contexts/auth';
import { useCardPng } from '@/hooks/useCardPng';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import { useSaveToPhotos, type PhotoMode } from '@/hooks/useSaveToPhotos';
import { formatFullDate } from '@/lib/format';
import {
  habitNoteDone,
  isNoteDrivenHabit,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import { subscribeHabitDay, type HabitDay } from '@/lib/health';
import {
  archiveNo,
  designOf,
  FEED_DESIGNS,
  FEED_H,
  FEED_W,
  feedFileName,
  markFeedGenerated,
} from '@/lib/reflectionFeed';

// Daily Reflection Journal 📓 → gambar Instagram Feed 4:5.
//
// Refleksi yang kamu tulis di Habits ditata jadi selembar arsip
// `vixtory.archive`, bisa dilihat dulu, lalu disimpan ke Foto atau langsung
// dibawa ke Instagram.
export default function ReflectionFeedScreen() {
  const { user } = useAuth();
  const { now, todayId } = useNow();

  const [habits, setHabits] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickedKey, setPickedKey] = useState<string>(FEED_DESIGNS[0].key);

  const { svgRef, buatPng } = useCardPng(FEED_W, FEED_H);

  useLiveAll(
    (uid, fail) => [
      subscribeHabitSchedule(uid, setHabits, fail),
      subscribeHabitDay(uid, todayId, setDay, fail),
    ],
    { onError: setError, deps: [todayId] },
  );

  const reflectionHabit = habits?.find(isNoteDrivenHabit);
  const text = reflectionHabit ? (day?.notes[reflectionHabit.id] ?? '') : '';
  const ada = habitNoteDone(text);
  const design = designOf(pickedKey);

  // 💾 Simpan ke Foto / 📸 simpan lalu buka Instagram — alurnya milik bersama
  // ketiga layar kartu (hooks/useSaveToPhotos.ts). Kunci gambarnya = rupa +
  // isi tulisannya.
  const foto = useSaveToPhotos({
    kunci: `${design.key}|${text}`,
    buatPng,
    namaBerkas: feedFileName(todayId),
    instagram: 'app',
    setError,
    // Tombol "Generate Feed" di Home berhenti menagih setelah ini. Sengaja
    // ditandai SESUDAH gambarnya jadi — gagal di tengah jalan tidak boleh
    // membuat tombolnya hilang.
    sesudah: async () => {
      if (user) await markFeedGenerated(user.uid, todayId);
    },
  });

  function jalankan(mode: PhotoMode) {
    if (!user) return;
    return foto.jalankan(mode);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Generate Feed 🖼️"
        subtitle="Feed Instagram"
      />

      <ScreenError message={error} />

      {habits === null || day === null ? (
        <LoadingCenter />
      ) : !ada ? (
        <View style={styles.emptyWrap}>
          <VixText heading="label" additionalStyle={styles.empty}>
            Refleksi hari ini belum ditulis. Isi dulu di Habits → sesi Pagi →
            📓 Daily Reflection Journal, baru bisa dibuatkan feed-nya.
          </VixText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <CardPreview width={FEED_W} height={FEED_H} pad={8}>
            <ReflectionFeedCard
              ref={svgRef}
              text={text}
              design={design}
              dateLabel={formatFullDate(now)}
              archiveLabel={archiveNo(todayId)}
              width={FEED_W}
            />
          </CardPreview>

          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🎨 Style
          </VixText>
          <View style={styles.chipWrap}>
            {FEED_DESIGNS.map((d) => (
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
              label="💾 Simpan ke Foto"
              busy={foto.busy === 'save'}
              onPress={() => jalankan('save')}
              background={Color.MAIN_DARK}
            />
            <PrimaryButton
              label="📸 Buka Instagram"
              busy={foto.busy === 'ig'}
              onPress={() => jalankan('ig')}
              background={Color.SPIRITUAL_DARK}
            />

            <PhotoSavedNote show={foto.tersimpan} />
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
