import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Svg from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { RhemaStoryCard } from '@/components/spiritual/RhemaStoryCard';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { formatFullDate } from '@/lib/format';
import {
  habitNoteDone,
  isNoteDrivenHabit,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import { subscribeHabitDay, type HabitDay } from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';
import {
  designOf,
  designOfDay,
  shareStoryPng,
  storyFileName,
  STORY_DESIGNS,
  STORY_H,
  STORY_W,
} from '@/lib/rhemaStory';

// Bagikan rhema pagi ke Instagram Story ✍️
//
// Rancangannya dipilihkan app (berganti tiap hari), tinggal ditekan bagikan.
// Boleh diganti manual kalau nuansa hari itu tidak cocok.
export default function RhemaStoryScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { now, todayId } = useNow();

  const [habits, setHabits] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // null = ikut undian harian; diisi kalau kamu memilih sendiri.
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  const svgRef = useRef<Svg>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeHabitSchedule(user.uid, setHabits, fail),
      subscribeHabitDay(user.uid, todayId, setDay, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, todayId]);

  const rhemaHabit = habits?.find(isNoteDrivenHabit);
  const rhemaText = rhemaHabit ? (day?.notes[rhemaHabit.id] ?? '') : '';
  const ada = habitNoteDone(rhemaText);
  const design = pickedKey ? designOf(pickedKey) : designOfDay(todayId);
  const dateLabel = formatFullDate(now);

  // Pratinjau selebar layar dikurangi tepi, tapi dibatasi supaya tetap muat
  // tegak di layar mana pun.
  const previewW = Math.min(width - 40, 320);

  async function handleShare() {
    if (!svgRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Digambar ulang pada ukuran Story sebenarnya (1080×1920), bukan sebesar
      // pratinjaunya — kalau tidak, gambarnya pecah saat diunggah.
      const base64 = await new Promise<string>((resolve, reject) => {
        const svg = svgRef.current;
        if (!svg) {
          reject(new Error('kartu belum siap'));
          return;
        }
        svg.toDataURL((data) => resolve(data), {
          width: STORY_W,
          height: STORY_H,
        });
      });
      await shareStoryPng(base64, storyFileName(todayId));
    } catch {
      setError('Gagal membuat gambar Story-nya. Coba lagi ya.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Rhema Story ✍️"
        subtitle="Dirancang otomatis, tinggal dibagikan"
      />

      <ScreenError message={error} />

      {habits === null || day === null ? (
        <LoadingCenter />
      ) : !ada ? (
        <View style={styles.emptyWrap}>
          <VixText heading="label" additionalStyle={styles.empty}>
            Rhema hari ini belum ditulis. Isi dulu di Habits → sesi Pagi →
            ✍️ Rhema, baru bisa dibagikan.
          </VixText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.previewWrap}>
            <RhemaStoryCard
              ref={svgRef}
              text={rhemaText}
              design={design}
              dateLabel={dateLabel}
              width={previewW}
            />
          </View>

          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🎨 Rancangan
          </VixText>
          <View style={styles.chipWrap}>
            {STORY_DESIGNS.map((d) => (
              <Chip
                key={d.key}
                label={d.label}
                active={d.key === design.key}
                onPress={() => setPickedKey(d.key)}
              />
            ))}
          </View>
          <VixText heading="label" additionalStyle={styles.hint}>
            Tiap pagi app memilihkan satu rancangan sendiri — kamu tidak perlu
            memilih apa pun. Ganti di atas kalau nuansanya kurang pas.
          </VixText>

          <PressableScale
            style={styles.shareButton}
            disabled={busy}
            onPress={handleShare}>
            {busy ? (
              <ActivityIndicator color={Color.TEXT_REVERSE} />
            ) : (
              <VixText heading="bold" additionalStyle={styles.shareText}>
                📤 Bagikan ke Instagram Story
              </VixText>
            )}
          </PressableScale>
          <VixText heading="label" additionalStyle={styles.hint}>
            Nanti muncul pilihan aplikasi — pilih Instagram, lalu Story.
            Gambarnya dibuat di HP-mu sendiri dan tidak dikirim ke mana pun.
          </VixText>
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
  // Pratinjau ditengahkan & diberi bayangan tepi lembut supaya terasa seperti
  // selembar gambar, bukan bagian dari layar.
  previewWrap: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sectionTitle: { marginTop: 14, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: Color.TEXT_LABEL, marginTop: 8 },
  shareButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 16,
  },
  shareText: { color: Color.TEXT_REVERSE },
});
