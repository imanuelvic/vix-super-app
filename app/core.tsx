import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { FollowupTab } from '@/components/core/FollowupTab';
import { LeadersTab } from '@/components/core/LeadersTab';
import { VisitationTab } from '@/components/core/VisitationTab';
import { useAuth } from '@/contexts/auth';
import {
  EMPTY_CORE_IDEAS,
  subscribeCoreIdeas,
  subscribeCoreLeaders,
  subscribeMainTeam,
  subscribeVisitations,
  type CoreIdeasData,
  type CoreLeader,
  type MainTeamMember,
  type Visitation,
} from '@/lib/core';
import { dayDocId } from '@/lib/health';

type CoreTab = 'visitation' | 'followup' | 'leaders';

// Tab bar bawah di dalam layar CORE.
const TABS: BottomTab<CoreTab>[] = [
  { key: 'visitation', label: 'Visitasi', icon: 'calendar' },
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
  const [tab, setTab] = useState<CoreTab>(
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
  }, [tabParam]);
  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[] | null>(null);
  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [ideas, setIdeas] = useState<CoreIdeasData>(EMPTY_CORE_IDEAS);
  const [error, setError] = useState<string | null>(null);

  const dayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
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
          // Riwayat seluruh visitasi 🕘
          <EmojiButton
            emoji="🕘"
            onPress={() => router.push('/visitations')}
          />
        }
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content}>
        {leaders === null || mainTeam === null || visitations === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : tab === 'visitation' ? (
          <VisitationTab visitations={visitations} leaders={leaders} />
        ) : tab === 'followup' ? (
          <FollowupTab
            leaders={leaders}
            mainTeam={mainTeam}
            dayId={dayId}
            ideas={ideas}
          />
        ) : (
          <LeadersTab leaders={leaders} mainTeam={mainTeam} />
        )}
      </View>

      {/* Tab bar bawah khusus layar CORE */}
      <BottomTabs tabs={TABS} value={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
