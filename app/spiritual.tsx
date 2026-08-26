import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AchievementButton } from '@/components/common/AchievementButton';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { useTabScroll } from '@/components/common/useTabScroll';
import { EmojiButton } from '@/components/common/EmojiButton';
import { GreetingHeader } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SkipButton, SkipNotice } from '@/components/common/SkipToday';
import { VixText } from '@/components/common/VixText';
import { BibleReadingTab } from '@/components/spiritual/BibleReadingTab';
import { FastingTab } from '@/components/spiritual/FastingTab';
import { SermonTab } from '@/components/spiritual/SermonTab';
import { useAuth } from '@/contexts/auth';
import { BIBLE_CATEGORY } from '@/lib/achievements';
import { subscribeFastingPlans, type FastingPlan } from '@/lib/fasting';
import { dayDocId } from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import { subscribeSermons, type SermonNote } from '@/lib/sermon';
import {
  bibleSessionNow,
  reviveHandledToday,
  setReviveSkipped,
  subscribeBibleReadingDays,
  subscribeReviveEntries,
  subscribeReviveStreak,
  type BibleReadingDay,
  type ReviveEntry,
  type ReviveStreak,
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
  // Streak Revive — dibaca di sini bukan untuk angkanya, tapi untuk tanda
  // "hari ini dilewati" yang menempel di dokumen yang sama.
  const [reviveStreak, setReviveStreak] = useState<ReviveStreak | null>(null);
  const [skipBusy, setSkipBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reminder Dashboard bisa mengarahkan ke tab tertentu lewat param.
  useEffect(() => {
    if (isTab(tabParam)) setTab(tabParam);
  }, [tabParam, setTab]);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
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
      subscribeReviveStreak(user.uid, setReviveStreak, fail),
    ]);
  }, [user]);

  const now = new Date();
  const todayId = dayDocId(now);
  const todayEntry = entries?.find((e) => e.id === todayId) ?? null;
  // Hari ini sengaja dilewati? (tandanya menempel di dokumen streak yang sama)
  const skippedToday = reviveStreak?.skippedDayId === todayId;

  async function toggleSkip() {
    if (!user || skipBusy) return;
    setSkipBusy(true);
    try {
      await setReviveSkipped(user.uid, reviveStreak, todayId, !skippedToday);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setSkipBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Spiritual ✝️"
        subtitle="Being with God, bukan sekadar doing for God"
        // Pojok kanan menyesuaikan sub-tab:
        //   Revive  → 📖 riwayat + 🔥 "Doa Pagi" (Revive memang langkah 1
        //             gerbang pagi — kategori "Revive Rohani" sengaja dihapus
        //             dulu karena pemicunya sama persis, lihat lib/achievements)
        //   Bible   → 🔥 sesi yang JENDELANYA sedang berjalan (di luar jam
        //             baca mana pun, jatuh ke pagi 🌅 sebagai patokan)
        //   Sermon & Fasting belum punya pencapaian → tak ada tombol 🔥.
        right={
          tab === 'revive' ? (
            <>
              <EmojiButton
                emoji="📖"
                onPress={() => router.push('/revive-history')}
              />
              <AchievementButton category="login" />
            </>
          ) : tab === 'bible' ? (
            <AchievementButton
              category={BIBLE_CATEGORY[bibleSessionNow(now) ?? 'morning']}
            />
          ) : undefined
        }
      />

      <ScreenError message={error} />

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
            ) : skippedToday ? (
              <SkipNotice
                title="⏭️ Revive hari ini dilewati"
                detail={
                  '🔥 Streak tidak bertambah hari ini. Masih bisa '
                }
                additionalStyle={styles.skippedGap}
              />
            ) : (
              <PrimaryButton
                label="✍️ Tulis Revive Hari Ini"
                onPress={() => router.push('/revive')}
                additionalStyle={styles.writeButton}
              />
            )}

            {/* ⏭️ Lewati hari ini — badge harian Revive ikut hilang. Tidak
                pakai konfirmasi karena tidak ada yang hangus & bisa dibatalkan
                kapan saja (sama seperti lewati baca Alkitab). */}
            {!todayEntry && (
              <SkipButton
                skipped={skippedToday}
                label="⏭️ Lewati Revive hari ini"
                busy={skipBusy}
                onPress={toggleSkip}
                additionalStyle={styles.skippedGap}
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

      {/* Badge Revive = 1 kalau Revive hari ini belum ditulis DAN belum
          ditandai dilewati — aturan yang sama persis dengan badge tile
          Spiritual di Home. */}
      <BottomTabs
        tabs={withBadge(TABS, {
          revive:
            todayEntry || reviveHandledToday(reviveStreak, todayId) ? 0 : 1,
        })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  body: { flex: 1 },
  // Jarak atas SAMA dengan tab Sermon & Bible Reading (dan layar lain).
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  writeButton: { marginTop: 4 },
  // Bentuk kartu & tombolnya ada di components/common/SkipToday.tsx.
  skippedGap: { marginTop: 4 },
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
