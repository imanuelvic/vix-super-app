import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { FollowupTab } from '@/components/core/FollowupTab';
import { LeadersTab } from '@/components/core/LeadersTab';
import { MonthlyTab } from '@/components/core/MonthlyTab';
import { MultiplicationTab } from '@/components/core/MultiplicationTab';
import { VisitationTab } from '@/components/core/VisitationTab';
import { useAuth } from '@/contexts/auth';
import {
    EMPTY_MONTHLY_PRAYERS,
    subscribeBirthdayGreets,
    subscribeCoreLeaders,
    subscribeExLeaders,
    subscribeMainTeam,
    subscribeMonthlyMeetings,
    subscribeMonthlyPrayers,
    subscribeVisitations,
    subscribeWeeklyFocus,
    EMPTY_WEEKLY_FOCUS,
    coreAttention,
    type BirthdayGreets,
    type WeeklyFocus,
    type CoreLeader,
    type ExLeader,
    type MainTeamMember,
    type MonthlyMeeting,
    type MonthlyPrayers,
    type Visitation,
} from '@/lib/core';
import { useNow } from '@/hooks/useNow';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';

type CoreTab =
  | 'visitation'
  | 'followup'
  | 'monthly'
  | 'leaders'
  | 'multiplication';

// Tab bar bawah di dalam layar CORE.
const TABS: BottomTab<CoreTab>[] = [
  { key: 'visitation', label: 'Visitation', icon: 'calendar' },
  { key: 'monthly', label: 'Monthly', icon: 'list.bullet' },
  { key: 'followup', label: 'Follow Up', icon: 'bubble.left.fill' },
  { key: 'leaders', label: 'Leaders', icon: 'person.2.fill' },
  { key: 'multiplication', label: 'Multiplication', icon: 'arrow.triangle.branch' },
];

// CORE — penggembalaan sebagai MCL: follow up harian para CORE Leader.
export default function CoreScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Default masuk ke Follow Up: itu tugas harianmu. Bisa dioverride lewat
  // param ?tab=… (mis. kartu reminder visitasi di Dashboard), plus ?edit=<id>
  // untuk otomatis membuka modal visitasi yang ditekan.
  const { edit: editParam } = useLocalSearchParams<{ edit?: string }>();

  // Setelah ?edit=… dipakai (modal terbuka), bersihkan param dari URL. Tanpa
  // ini modal auto-terbuka lagi tiap balik ke subtab Visitation (konten
  // di-mount ulang oleh key={scrollKey}). Dipanggil tab lewat onEditConsumed
  // SETELAH modal dibuka — jadi param tak keburu hilang sebelum data termuat.
  const clearEditParam = useCallback(() => {
    if (editParam) router.setParams({ edit: '' });
  }, [editParam, router]);
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan, plus ?tab=…
  const { tab, scrollKey, onTabPress } = useTabScroll<CoreTab>('followup', {
    tabs: TABS,
  });

  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  // Ex CORE Leader ikut didengarkan — BUKAN untuk dijadwalkan lagi, tapi supaya
  // visitasi lama dengan mereka tetap bisa menampilkan namanya & ikut ketemu
  // saat dicari. Tanpa ini kartunya cuma tertulis "(CL tidak ditemukan)".
  const [exLeaders, setExLeaders] = useState<ExLeader[]>([]);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[] | null>(null);
  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );
  const [meetings, setMeetings] = useState<MonthlyMeeting[]>([]);
  // Undian ulang 🎲 fokus minggu ini (dokumen kecil) — dipakai kartu Follow Up
  // Mingguan DAN badge tab-nya, supaya keduanya menyebut orang yang sama.
  const [weeklyFocus, setWeeklyFocus] = useState<WeeklyFocus>(EMPTY_WEEKLY_FOCUS);
  // Ucapan ulang tahun yang sudah dikirim hari ini — dibaca di sini (bukan
  // cuma di dalam sub-tab Follow Up) supaya badge-nya ikut padam begitu
  // ucapannya terkirim, bukan menunggu tabnya dibuka.
  const [greets, setGreets] = useState<BirthdayGreets>({});
  const [error, setError] = useState<string | null>(null);

  // Jam BERJALAN (di-segarkan tiap menit): badge Follow Up menyala sendiri
  // tepat jam 09.00 tanpa perlu layarnya dibuka ulang.
  const { now, todayId: dayId } = useNow();

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeCoreLeaders(
        user.uid,
        (next) => {
          setLeaders(next);
          setError(null);
        },
        fail,
      ),
      subscribeExLeaders(user.uid, setExLeaders, fail),
      subscribeMainTeam(user.uid, setMainTeam, fail),
      subscribeVisitations(user.uid, setVisitations, fail),
      subscribeMonthlyPrayers(user.uid, setMonthlyPrayers, fail),
      subscribeMonthlyMeetings(user.uid, setMeetings, fail),
      subscribeWeeklyFocus(user.uid, setWeeklyFocus, fail),
      subscribeBirthdayGreets(user.uid, setGreets, fail),
    ]);
  }, [user]);

  // Tagihan CORE hari ini — angka yang SAMA dipakai badge tile di Home.
  const perhatian = coreAttention({
    leaders: leaders ?? [],
    mainTeam: mainTeam ?? [],
    visitations: visitations ?? [],
    greets,
    focus: weeklyFocus,
    now,
    todayId: dayId,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="CORE 🙏"
        subtitle="Gembalakan & muridkan CORE Leader-mu"
        // Tombol kanan atas menyesuaikan tab yang aktif:
        // Visitation → 📜 Rules & Suggestions + 🕘 riwayat visitasi ·
        // Follow Up → 💬 template chat + 🙏 pokok doa bulanan ·
        // Leaders → 🗂️ Ex CORE Leader (yang sudah tidak dipegang) ·
        // Multiplication → 🧭 Pedoman Calon CORE Leader.
        // Monthly belum punya halaman pendamping.
        right={
          tab === 'visitation' ? (
            <View style={styles.headerButtons}>
              <EmojiButton
                emoji="📜"
                onPress={() => router.push('/core-rules')}
              />
              <EmojiButton
                emoji="🕘"
                onPress={() => router.push('/visitations')}
              />
            </View>
          ) : tab === 'followup' ? (
            <View style={styles.headerButtons}>
              {/* Template chat 💬 — kata-kata siap kirim (kedukaan, get well,
                  wisuda, motivasi harian) untuk CL maupun grup CORE. */}
              {/* Idea For CORE 💡 — masukan yang dikumpulkan pelan-pelan.
                  Dulu menumpang di ujung bawah tab ini; sekarang layarnya
                  sendiri, dan pintunya di sini, sebelah template chat. */}
              <EmojiButton
                emoji="💡"
                onPress={() => router.push('/core-ideas')}
              />
              <EmojiButton
                emoji="💬"
                onPress={() => router.push('/chat-templates')}
              />
              <EmojiButton
                emoji="🙏"
                onPress={() => router.push('/monthly-prayers')}
              />
            </View>
          ) : tab === 'leaders' ? (
            <EmojiButton emoji="🗂️" onPress={() => router.push('/ex-leaders')} />
          ) : tab === 'multiplication' ? (
            /* Pedoman 🧭 — dua lembar sekaligus: syarat calon CORE Leader
               baru, dan tugas yang dipegangnya setelah memimpin. Tempatnya di
               sini karena keduanya dibaca tiap kali menyiapkan siapa yang akan
               memimpin CORE hasil pemekaran. */
            <EmojiButton
              emoji="🧭"
              onPress={() => router.push('/leader-criteria')}
            />
          ) : undefined
        }
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {leaders === null || mainTeam === null || visitations === null ? (
          <LoadingCenter />
        ) : tab === 'visitation' ? (
          <VisitationTab
            visitations={visitations}
            leaders={leaders}
            pastLeaders={exLeaders}
            editId={editParam}
            onEditConsumed={clearEditParam}
          />
        ) : tab === 'followup' ? (
          <FollowupTab
            leaders={leaders}
            mainTeam={mainTeam}
            dayId={dayId}
            monthlyPrayers={monthlyPrayers}
            weeklyFocus={weeklyFocus}
          />
        ) : tab === 'monthly' ? (
          <MonthlyTab meetings={meetings} />
        ) : tab === 'leaders' ? (
          <LeadersTab leaders={leaders} mainTeam={mainTeam} />
        ) : (
          <MultiplicationTab />
        )}
      </View>

      {/* Badge sub-tab dihitung DARI SUMBER YANG SAMA dengan badge tile CORE
          di Home (coreAttention di lib/core.ts), jadi angka di luar selalu
          punya tujuan di dalam:
            Visitation → acara yang panduannya perlu dikirim hari ini
            Follow Up  → CL fokus yang belum di-follow up (mulai jam 09.00)
                         + ulang tahun hari ini yang belum diucapkan */}
      <BottomTabs
        tabs={withBadge(TABS, {
          visitation: perhatian.visitation,
          followup: perhatian.followup,
        })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
  // Dua tombol emoji berdampingan di kanan atas (tab Pertemuan).
  headerButtons: { flexDirection: 'row', gap: 8 },
});
