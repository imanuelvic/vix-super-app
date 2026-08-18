import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BusinessTab } from '@/components/career/BusinessTab';
import { FreelanceTab } from '@/components/career/FreelanceTab';
import { FulltimeTab } from '@/components/career/FulltimeTab';
import { InsuranceTab } from '@/components/career/InsuranceTab';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useAuth } from '@/contexts/auth';
import {
  effectiveRoadmap,
  freelanceReminderWindow,
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
// agent Manulife, dan (nanti) bisnis kuliner Manado.
export default function CareerScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Reminder Home bisa mengarahkan langsung ke tab tertentu lewat ?tab=…
  // dan ?edit=<id> untuk otomatis membuka modal edit item yang ditekan.
  const { tab: tabParam, edit: editParam } = useLocalSearchParams<{
    tab?: string;
    edit?: string;
  }>();

  // Setelah tab memakai ?edit=… (membuka modal), bersihkan param dari URL. Tanpa
  // ini, modal auto-terbuka lagi tiap kembali ke subtab (konten di-mount ulang
  // oleh key={scrollKey}). Dipanggil tab lewat onEditConsumed SETELAH modal
  // dibuka — jadi param tak keburu hilang sebelum datanya termuat.
  const clearEditParam = useCallback(() => {
    if (editParam) router.setParams({ edit: '' });
  }, [editParam, router]);
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

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {roadmap === null || freelance === null || insurance === null ? (
          <LoadingCenter />
        ) : tab === 'fulltime' ? (
          <FulltimeTab
            items={roadmap}
            editId={editParam}
            onEditConsumed={clearEditParam}
          />
        ) : tab === 'freelance' ? (
          <FreelanceTab
            projects={freelance}
            editId={editParam}
            onEditConsumed={clearEditParam}
          />
        ) : tab === 'insurance' ? (
          <InsuranceTab months={insurance} />
        ) : (
          <BusinessTab />
        )}
      </View>

      {/* Badge = pecahan dari badge tile Career di Home: P1 Fulltime yang
          belum selesai, dan Freelance yang deadline-nya sudah H-7. */}
      <BottomTabs
        tabs={withBadge(TABS, {
          fulltime: (roadmap ?? []).filter(
            (r) =>
              r.status !== 'done' &&
              effectiveRoadmap(r, new Date()).priority === 1,
          ).length,
          freelance: (freelance ?? []).filter((p) =>
            freelanceReminderWindow(p, new Date()),
          ).length,
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
});
