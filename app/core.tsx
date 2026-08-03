import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { useTabScroll } from '@/components/common/useTabScroll';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { FollowupTab } from '@/components/core/FollowupTab';
import { LeadersTab } from '@/components/core/LeadersTab';
import { VisitationTab } from '@/components/core/VisitationTab';
import { useAuth } from '@/contexts/auth';
import {
  EMPTY_CORE_IDEAS,
  EMPTY_MONTHLY_PRAYERS,
  subscribeCoreIdeas,
  subscribeCoreLeaders,
  subscribeMainTeam,
  subscribeMonthlyPrayers,
  subscribeVisitations,
  type CoreIdeasData,
  type CoreLeader,
  type MainTeamMember,
  type MonthlyPrayers,
  type Visitation,
} from '@/lib/core';
import { dayDocId } from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type CoreTab = 'visitation' | 'followup' | 'leaders';

// Tab bar bawah di dalam layar CORE.
const TABS: BottomTab<CoreTab>[] = [
  { key: 'visitation', label: 'Pertemuan', icon: 'calendar' },
  { key: 'followup', label: 'Follow Up', icon: 'bubble.left.fill' },
  { key: 'leaders', label: 'Leaders', icon: 'person.2.fill' },
];

// CORE — penggembalaan sebagai MCL: follow up harian para CORE Leader.
export default function CoreScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Default masuk ke Follow Up: itu tugas harianmu. Bisa dioverride lewat
  // param ?tab=… (mis. kartu reminder visitasi di Home).
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, setTab, scrollKey, onTabPress } = useTabScroll<CoreTab>(
    tabParam === 'visitation' || tabParam === 'leaders' ? tabParam : 'followup',
  );

  useEffect(() => {
    if (
      tabParam === 'visitation' ||
      tabParam === 'followup' ||
      tabParam === 'leaders'
    ) {
      setTab(tabParam);
    }
  }, [tabParam, setTab]);
  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[] | null>(null);
  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [ideas, setIdeas] = useState<CoreIdeasData>(EMPTY_CORE_IDEAS);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );
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
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="CORE 🙏"
        subtitle="Gembalakan & muridkan CORE Leader-mu"
        right={
          <View style={styles.headerButtons}>
            {/* Riwayat seluruh visitasi 🕘 */}
            <EmojiButton emoji="🕘" onPress={() => router.push('/visitations')} />
            {/* Pokok Doa Bulanan 📿 */}
            <EmojiButton
              emoji="📿"
              onPress={() => router.push('/monthly-prayers')}
            />
          </View>
        }
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content} key={scrollKey}>
        {leaders === null || mainTeam === null || visitations === null ? (
          <LoadingCenter />
        ) : tab === 'visitation' ? (
          <VisitationTab visitations={visitations} leaders={leaders} />
        ) : tab === 'followup' ? (
          <FollowupTab
            leaders={leaders}
            mainTeam={mainTeam}
            dayId={dayId}
            ideas={ideas}
            monthlyPrayers={monthlyPrayers}
          />
        ) : (
          <LeadersTab leaders={leaders} mainTeam={mainTeam} />
        )}
      </View>

      {/* Tab bar bawah khusus layar CORE */}
      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
  headerButtons: { flexDirection: 'row', gap: 8 },
});
