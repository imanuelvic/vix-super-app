import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { useTabScroll } from '@/components/common/useTabScroll';
import { EmojiButton } from '@/components/common/EmojiButton';
import { GreetingHeader } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { BibleReadingTab } from '@/components/spiritual/BibleReadingTab';
import { FastingTab } from '@/components/spiritual/FastingTab';
import { SermonTab } from '@/components/spiritual/SermonTab';
import { useAuth } from '@/contexts/auth';
import { subscribeFastingPlans, type FastingPlan } from '@/lib/fasting';
import { dayDocId } from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';
import { subscribeSermons, type SermonNote } from '@/lib/sermon';
import {
  subscribeBibleReadingDays,
  subscribeReviveEntries,
  type BibleReadingDay,
  type ReviveEntry,
} from '@/lib/spiritual';

type Tab = 'revive' | 'sermon' | 'bible' | 'fasting';

const TABS: BottomTab<Tab>[] = [
  { key: 'revive', label: 'Revive', icon: 'book.closed.fill' },
  { key: 'sermon', label: 'Sermon', icon: 'mic.fill' },
  { key: 'bible', label: 'Bible Reading', icon: 'books.vertical.fill' },
  { key: 'fasting', label: 'Fasting', icon: 'figure.mind.and.body' },
];

function isTab(value?: string): value is Tab {
  return TABS.some((t) => t.key === value);
}

export default function SpiritualScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, setTab, scrollKey, onTabPress } = useTabScroll<Tab>(
    isTab(tabParam) ? tabParam : 'revive',
  );
  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [sermons, setSermons] = useState<SermonNote[]>([]);
  const [bibleDays, setBibleDays] = useState<BibleReadingDay[]>([]);
  const [fastingPlans, setFastingPlans] = useState<FastingPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reminder Dashboard bisa mengarahkan ke tab tertentu lewat param.
  useEffect(() => {
    if (isTab(tabParam)) setTab(tabParam);
  }, [tabParam, setTab]);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeReviveEntries(
        user.uid,
        (next) => {
          setEntries(next);
          setError(null);
        },
        fail,
      ),
      subscribeSermons(user.uid, setSermons, fail),
      subscribeBibleReadingDays(user.uid, setBibleDays, fail),
      subscribeFastingPlans(user.uid, setFastingPlans, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const todayId = dayDocId(new Date());
  const todayEntry = entries?.find((e) => e.id === todayId) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Spiritual ✝️"
        subtitle="Being with God, bukan sekadar doing for God"
        right={
          tab === 'revive' ? (
            <EmojiButton
              emoji="📖"
              onPress={() => router.push('/revive-history')}
            />
          ) : undefined
        }
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.body} key={scrollKey}>
        {entries === null ? (
          <LoadingCenter />
        ) : tab === 'revive' ? (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Sapaan + tanggal (streak dihapus — sudah ada di Home) */}
            <GreetingHeader />

            {/* Rhema hari ini — tampil PENUH kalau sudah diisi */}
            {todayEntry ? (
              <PressableScale
                style={styles.todayCard}
                onPress={() =>
                  router.push({
                    pathname: '/revive',
                    params: { day: todayEntry.id },
                  })
                }>
                <VixText heading="title" additionalStyle={styles.todayTitle}>
                  {todayEntry.title}
                </VixText>
                {todayEntry.passage ? (
                  <VixText heading="label" additionalStyle={styles.todayPassage}>
                    📖 {todayEntry.passage}
                  </VixText>
                ) : null}
                <VixText heading="paragraph" additionalStyle={styles.todayRhema}>
                  “{todayEntry.rhema}”
                </VixText>
                {todayEntry.reflection ? (
                  <VixText
                    heading="label"
                    additionalStyle={styles.todayReflection}>
                    🏃🏻‍➡️ {todayEntry.reflection}
                  </VixText>
                ) : null}
              </PressableScale>
            ) : (
              <PrimaryButton
                label="✍️ Tulis Revive Hari Ini"
                onPress={() => router.push('/revive')}
                additionalStyle={styles.writeButton}
              />
            )}
          </ScrollView>
        ) : tab === 'sermon' ? (
          <SermonTab sermons={sermons} />
        ) : tab === 'bible' ? (
          <BibleReadingTab days={bibleDays} />
        ) : (
          <FastingTab plans={fastingPlans} />
        )}
      </View>

      {/* Tab bar bawah */}
      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  body: { flex: 1 },
  // Jarak atas SAMA dengan tab Sermon & Bible Reading (dan layar lain).
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  writeButton: { marginTop: 4 },
  todayCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.SPIRITUAL_DARK,
    padding: 18,
    gap: 8,
  },
  todayTitle: { color: Color.TEXT_TITLE },
  todayPassage: { color: Color.SPIRITUAL_DARK },
  todayRhema: { color: Color.TEXT_TITLE, fontStyle: 'italic' },
  todayReflection: { color: Color.SPIRITUAL_DARK },
});
