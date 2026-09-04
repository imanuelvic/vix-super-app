import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AchievementButton } from '@/components/common/AchievementButton';
import { AttentionMark } from '@/components/common/Badge';
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
import { QuoteBox } from '@/components/spiritual/QuoteBox';
import { SermonTab } from '@/components/spiritual/SermonTab';
import { useAuth } from '@/contexts/auth';
import { BIBLE_CATEGORY } from '@/lib/achievements';
import { subscribeFastingPlans, type FastingPlan } from '@/lib/fasting';
import { dayDocId } from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import { subscribeSermons, type SermonNote } from '@/lib/sermon';
import {
  BIBLE_SESSIONS,
  bibleSessionNow,
  repairedReviveStreak,
  saveReviveStreak,
  reviveHandledToday,
  setReviveSkipped,
  subscribeBibleReadingDays,
  subscribeReviveEntries,
  subscribeReviveStreak,
  worshipVerseOfDay,
  type BibleReadingDay,
  type BibleSession,
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

export default function SpiritualScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan. Reminder
  // Dashboard bisa mengarahkan ke tab tertentu lewat ?tab=…
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('revive', {
    tabs: TABS,
  });
  // ?session=… — dioper layar Baca Alkitab sesudah "✅ Sudah baca", supaya
  // arsipnya langsung terbuka di sesi yang barusan dicatat. Tanpa param ini
  // (dibuka dari mana pun yang lain) sub-tabnya ikut jam sekarang seperti biasa.
  const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();
  const sesiDituju = BIBLE_SESSIONS.some((s) => s.key === sessionParam)
    ? (sessionParam as BibleSession)
    : undefined;
  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [sermons, setSermons] = useState<SermonNote[]>([]);
  const [bibleDays, setBibleDays] = useState<BibleReadingDay[]>([]);
  const [fastingPlans, setFastingPlans] = useState<FastingPlan[]>([]);
  // Streak Revive — dibaca di sini bukan untuk angkanya, tapi untuk tanda
  // "hari ini dilewati" yang menempel di dokumen yang sama.
  const [reviveStreak, setReviveStreak] = useState<ReviveStreak | null>(null);
  const [skipBusy, setSkipBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Satu-satunya penentu badge Revive — di Home, di sub-tab bawah, dan di
  // gerbang doa pagi. Sengaja HANYA `reviveHandledToday`: layar ini dulu
  // menambahkan `todayEntry ||` sendiri, dan di situlah kebingunganmu lahir.
  // Home tidak membaca daftar Revive (mahal), jadi kalau catatannya tersimpan
  // tapi streaknya tidak ikut tercatat, Home menyalakan badge sementara di
  // dalam fiturnya tidak ada satu pun tanda — angka merah yang menyuruh masuk
  // lalu tidak menunjuk ke mana-mana.
  const reviveBeres = reviveHandledToday(reviveStreak, todayId);

  // …dan kalau ketidakcocokan itu terjadi, DIPERBAIKI, bukan ditutupi.
  //
  // Yang menentukan streak adalah CATATANNYA — berapa hari berturut-turut kamu
  // menulis Revive & menekan Simpan. Penghitung di dokumen streak cuma
  // salinannya, dan salinan itu bisa meleset: penyimpanan yang gagal saat
  // sinyal putus, Revive yang ditulis menyusul untuk tanggal kemarin, atau
  // tombol reset achievement. Sekali meleset, penghitungnya tak pernah
  // membetulkan diri — itulah kenapa angkanya bisa berhenti di 3 padahal
  // catatannya sudah 12 hari berturut-turut.
  //
  // Layar ini memang sudah memegang daftar catatannya, jadi di sinilah
  // salinannya dicocokkan. Menulis hanya kalau memang beda.
  const diperbaiki = useRef(false);
  useEffect(() => {
    if (!user || !entries || diperbaiki.current) return;
    const benar = repairedReviveStreak(
      reviveStreak,
      entries.map((e) => e.id),
      todayId,
    );
    if (!benar) return;
    diperbaiki.current = true;
    saveReviveStreak(user.uid, benar).catch(() => {
      diperbaiki.current = false;
    });
  }, [user, entries, reviveStreak, todayId]);

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
        // Ayat penyembahan hari ini — berganti tiap hari, tapi TETAP sama
        // sepanjang hari itu (diundi dari tanggalnya, lihat lib/spiritual.ts),
        // jadi pindah-pindah sub-tab tidak menggantinya di tengah jalan.
        subtitle={worshipVerseOfDay(todayId)}
        // Pojok kanan menyesuaikan sub-tab:
        //   Revive  → 📖 riwayat + 🔥 "Doa Pagi" (Revive memang langkah 1
        //             gerbang pagi — kategori "Revive Rohani" sengaja dihapus
        //             dulu karena pemicunya sama persis, lihat lib/achievements)
        //   Bible   → ⏸️ Pause & Pray + 🔥 sesi yang JENDELANYA sedang berjalan
        //             (di luar jam baca mana pun, jatuh ke pagi 🌅 sebagai
        //             patokan)
        //   Sermon & Fasting belum punya pencapaian → ⏸️ saja.
        //
        // ⏸️ Pause & Pray sengaja TIDAK ikut di tab Revive: pojok itu sudah
        // berisi tiga tombol (📖 🙏 🔥 = 142pt) dan judul "Spiritual ✝️"
        // menghabiskan sisanya — tombol keempat memaksa judulnya pecah baris.
        right={
          tab === 'revive' ? (
            <>
              <EmojiButton
                emoji="📖"
                onPress={() => router.push('/revive-history')}
              />
              {/* 🙏 Riwayat Syukur — "3 hal" yang kamu tulis tiap malam di
                  Habits. Ditaruh di sini, bukan di Habits: Habits tempat
                  MENULISNYA, Spiritual tempat MEMBACANYA lagi. */}
              <EmojiButton
                emoji="🙏"
                onPress={() => router.push('/gratitude')}
              />
              <AchievementButton category="login" />
            </>
          ) : (
            <>
              {/* ⏸️ Doa singkat → Story Instagram. Sekeluarga dengan "Bagikan
                  ayatnya" di layar Baca Alkitab: kartunya sama persis, cuma
                  kopnya yang berganti jadi PAUSE & PRAY. */}
              <EmojiButton
                emoji="⏸️"
                onPress={() => router.push('/pause-pray')}
              />
              {tab === 'bible' && (
                <AchievementButton
                  category={BIBLE_CATEGORY[bibleSessionNow(now) ?? 'morning']}
                />
              )}
            </>
          )
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
                {/* Rhema-nya dibingkai jadi kutipan — "kartu di dalam kartu",
                    bentuk yang sama dengan kutipan di daftar Catatan Khotbah.
                    Latarnya krem di atas kartu ungu, jadi kalimat yang paling
                    berharga di kartu ini tidak lagi menyatu dengan sisanya. */}
                <QuoteBox text={todayEntry.rhema} accent={Color.SPIRITUAL_DARK} />
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
              // INI penyebab badge merah di tile Spiritual & di sub-tab Revive.
              // Titik berdenyut di pojoknya = "yang ini yang menyalakannya" —
              // tanpa itu, angka merah di Home menyuruh masuk tapi begitu
              // sampai tak ada yang menunjuk ke mana.
              <View style={styles.writeWrap}>
                <PrimaryButton
                  label="✍️ Tulis Revive Hari Ini"
                  onPress={() => router.push('/revive')}
                />
                <AttentionMark corner />
              </View>
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
          <BibleReadingTab days={bibleDays} openSession={sesiDituju} />
        ) : (
          <FastingTab plans={fastingPlans} />
        )}
      </View>

      {/* Badge Revive = 1 kalau Revive hari ini belum ditulis DAN belum
          ditandai dilewati — angka yang PERSIS sama dengan badge tile
          Spiritual di Home, karena keduanya memanggil fungsi yang sama. */}
      <BottomTabs
        tabs={withBadge(TABS, { revive: reviveBeres ? 0 : 1 })}
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
  writeWrap: { marginTop: 4 },
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
  todayReflection: { color: Color.SPIRITUAL_DARK },
});
