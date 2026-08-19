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
    EMPTY_CORE_IDEAS,
    EMPTY_MONTHLY_PRAYERS,
    subscribeCoreIdeas,
    subscribeCoreLeaders,
    subscribeMainTeam,
    subscribeMonthlyMeetings,
    subscribeMonthlyPrayers,
    subscribeVisitations,
    weekIndex,
    WEEKLY_FOCUS_COUNT,
    weeklyLeaders,
    type CoreIdeasData,
    type CoreLeader,
    type MainTeamMember,
    type MonthlyMeeting,
    type MonthlyPrayers,
    type Visitation,
} from '@/lib/core';
import { dayDocId } from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type CoreTab =
  | 'visitation'
  | 'followup'
  | 'monthly'
  | 'leaders'
  | 'multiplication';

// Tab bar bawah di dalam layar CORE.
const TABS: BottomTab<CoreTab>[] = [
  { key: 'visitation', label: 'Pertemuan', icon: 'calendar' },
  { key: 'followup', label: 'Follow Up', icon: 'bubble.left.fill' },
  { key: 'monthly', label: 'Monthly', icon: 'list.bullet' },
  { key: 'leaders', label: 'Leaders', icon: 'person.2.fill' },
  { key: 'multiplication', label: 'Multiplication', icon: 'arrow.triangle.branch' },
];

/** Nilai ?tab=… yang dikenali (dipakai reminder Dashboard & deep link). */
function asCoreTab(value?: string): CoreTab | null {
  return TABS.some((t) => t.key === value) ? (value as CoreTab) : null;
}

// CORE — penggembalaan sebagai MCL: follow up harian para CORE Leader.
export default function CoreScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Default masuk ke Follow Up: itu tugas harianmu. Bisa dioverride lewat
  // param ?tab=… (mis. kartu reminder visitasi di Dashboard), plus ?edit=<id>
  // untuk otomatis membuka modal pertemuan yang ditekan.
  const { tab: tabParam, edit: editParam } = useLocalSearchParams<{
    tab?: string;
    edit?: string;
  }>();

  // Setelah ?edit=… dipakai (modal terbuka), bersihkan param dari URL. Tanpa
  // ini modal auto-terbuka lagi tiap balik ke subtab Pertemuan (konten
  // di-mount ulang oleh key={scrollKey}). Dipanggil tab lewat onEditConsumed
  // SETELAH modal dibuka — jadi param tak keburu hilang sebelum data termuat.
  const clearEditParam = useCallback(() => {
    if (editParam) router.setParams({ edit: '' });
  }, [editParam, router]);
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, setTab, scrollKey, onTabPress } = useTabScroll<CoreTab>(
    asCoreTab(tabParam) ?? 'followup',
  );

  useEffect(() => {
    const next = asCoreTab(tabParam);
    if (next) setTab(next);
  }, [tabParam, setTab]);
  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[] | null>(null);
  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [ideas, setIdeas] = useState<CoreIdeasData>(EMPTY_CORE_IDEAS);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );
  const [meetings, setMeetings] = useState<MonthlyMeeting[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeCoreLeaders(
        user.uid,
        (next) => {
          setLeaders(next);
          setError(null);
        },
        fail,
      ),
      subscribeMainTeam(user.uid, setMainTeam, fail),
      subscribeVisitations(user.uid, setVisitations, fail),
      subscribeCoreIdeas(user.uid, setIdeas, fail),
      subscribeMonthlyPrayers(user.uid, setMonthlyPrayers, fail),
      subscribeMonthlyMeetings(user.uid, setMeetings, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="CORE 🙏"
        subtitle="Gembalakan & muridkan CORE Leader-mu"
        // Tombol kanan atas menyesuaikan tab yang aktif:
        // Pertemuan → 📜 Rules & Suggestions + 🕘 riwayat pertemuan ·
        // Follow Up → 🙏 pokok doa bulanan ·
        // Leaders → 🗂️ Ex CORE Leader (yang sudah tidak dipegang).
        // Monthly & Multiplication belum punya halaman pendamping.
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
            <EmojiButton
              emoji="🙏"
              onPress={() => router.push('/monthly-prayers')}
            />
          ) : tab === 'leaders' ? (
            <EmojiButton emoji="🗂️" onPress={() => router.push('/ex-leaders')} />
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
            editId={editParam}
            onEditConsumed={clearEditParam}
          />
        ) : tab === 'followup' ? (
          <FollowupTab
            leaders={leaders}
            mainTeam={mainTeam}
            dayId={dayId}
            ideas={ideas}
            monthlyPrayers={monthlyPrayers}
          />
        ) : tab === 'monthly' ? (
          <MonthlyTab meetings={meetings} />
        ) : tab === 'leaders' ? (
          <LeadersTab leaders={leaders} mainTeam={mainTeam} />
        ) : (
          <MultiplicationTab />
        )}
      </View>

      {/* Badge Follow Up = 2 CL fokus minggu ini yang belum di-follow up hari
          ini — angka yang sama dengan badge tile CORE di Home. */}
      <BottomTabs
        tabs={withBadge(TABS, {
          followup: weeklyLeaders(
            leaders ?? [],
            weekIndex(new Date()),
            WEEKLY_FOCUS_COUNT,
          ).filter((l) => l.lastFollowupDayId !== dayId).length,
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
