import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BusinessTab } from '@/components/career/BusinessTab';
import { FreelanceTab } from '@/components/career/FreelanceTab';
import { FulltimeTab } from '@/components/career/FulltimeTab';
import { InsuranceTab } from '@/components/career/InsuranceTab';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  subscribeFreelance,
  subscribeInsurance,
  subscribeRoadmap,
  type FreelanceProject,
  type InsuranceMonths,
  type RoadmapItem,
} from '@/lib/career';
import { LOAD_ERROR } from '@/lib/messages';

type CareerTab = 'fulltime' | 'freelance' | 'insurance' | 'business';

// Tab bar bawah di dalam layar Career.
const TABS: BottomTab<CareerTab>[] = [
  { key: 'fulltime', label: 'Fulltime', icon: 'laptopcomputer' },
  { key: 'freelance', label: 'Freelance', icon: 'globe' },
  { key: 'insurance', label: 'Insurance', icon: 'shield.fill' },
  { key: 'business', label: 'Business', icon: 'cart.fill' },
];

// Career 💼 — empat topi pekerjaan: engineer NDC, freelancer,
// agent Allianz, dan (nanti) bisnis kuliner Manado.
export default function CareerScreen() {
  const { user } = useAuth();

  // Reminder Home bisa mengarahkan langsung ke tab tertentu lewat ?tab=…
  // dan ?edit=<id> untuk otomatis membuka modal edit item yang ditekan.
  const { tab: tabParam, edit: editParam } = useLocalSearchParams<{
    tab?: string;
    edit?: string;
  }>();
  const isCareerTab = (t?: string): t is CareerTab =>
    t === 'fulltime' ||
    t === 'freelance' ||
    t === 'insurance' ||
    t === 'business';

  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, setTab, scrollKey, onTabPress } = useTabScroll<CareerTab>(
    isCareerTab(tabParam) ? tabParam : 'fulltime',
  );
  useEffect(() => {
    if (isCareerTab(tabParam)) setTab(tabParam);
  }, [tabParam, setTab]);

  const [roadmap, setRoadmap] = useState<RoadmapItem[] | null>(null);
  const [freelance, setFreelance] = useState<FreelanceProject[] | null>(null);
  const [insurance, setInsurance] = useState<InsuranceMonths | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeRoadmap(
        user.uid,
        (next) => {
          setRoadmap(next);
          setError(null);
        },
        fail,
      ),
      subscribeFreelance(user.uid, setFreelance, fail),
      subscribeInsurance(user.uid, setInsurance, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Career 💼"
        subtitle="Empat topi, satu panggilan"
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content} key={scrollKey}>
        {roadmap === null || freelance === null || insurance === null ? (
          <LoadingCenter />
        ) : tab === 'fulltime' ? (
          <FulltimeTab items={roadmap} editId={editParam} />
        ) : tab === 'freelance' ? (
          <FreelanceTab projects={freelance} editId={editParam} />
        ) : tab === 'insurance' ? (
          <InsuranceTab months={insurance} />
        ) : (
          <BusinessTab />
        )}
      </View>

      {/* Tab bar bawah khusus layar Career */}
      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
});
