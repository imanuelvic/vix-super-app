import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AffiliateTab } from '@/components/career/AffiliateTab';
import { BusinessTab } from '@/components/career/BusinessTab';
import { FreelanceTab } from '@/components/career/FreelanceTab';
import { FulltimeTab } from '@/components/career/FulltimeTab';
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
  pendingIdeas,
  subscribeAffiliateIdeas,
  type ContentIdea,
} from '@/lib/affiliate';
import {
  effectiveRoadmap,
  freelanceReminderWindow,
  subscribeFreelance,
  subscribeRoadmap,
  type FreelanceProject,
  type RoadmapItem,
} from '@/lib/career';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';

type CareerTab = 'fulltime' | 'freelance' | 'affiliate' | 'business';

// Tab bar bawah di dalam layar Career.
const TABS: BottomTab<CareerTab>[] = [
  { key: 'fulltime', label: 'Fulltime', icon: 'laptopcomputer' },
  { key: 'freelance', label: 'Freelance', icon: 'globe' },
  { key: 'affiliate', label: 'Affiliate', icon: 'megaphone.fill' },
  { key: 'business', label: 'Business', icon: 'cart.fill' },
];

// Career 💼 — empat topi pekerjaan: engineer NDC, freelancer, content creator /
// affiliate, dan (nanti) bisnis kuliner Manado.
export default function CareerScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // ?edit=<id> untuk otomatis membuka modal edit item yang ditekan.
  // (?tab=… diurus useTabScroll di bawah.)
  const { edit: editParam } = useLocalSearchParams<{ edit?: string }>();

  // Setelah tab memakai ?edit=… (membuka modal), bersihkan param dari URL. Tanpa
  // ini, modal auto-terbuka lagi tiap kembali ke subtab (konten di-mount ulang
  // oleh key={scrollKey}). Dipanggil tab lewat onEditConsumed SETELAH modal
  // dibuka — jadi param tak keburu hilang sebelum datanya termuat.
  const clearEditParam = useCallback(() => {
    if (editParam) router.setParams({ edit: '' });
  }, [editParam, router]);
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan, plus buka
  // sub-tab tertentu lewat ?tab=… (reminder Dashboard & deep link).
  const { tab, scrollKey, onTabPress } = useTabScroll<CareerTab>('fulltime', {
    tabs: TABS,
  });

  const [roadmap, setRoadmap] = useState<RoadmapItem[] | null>(null);
  const [freelance, setFreelance] = useState<FreelanceProject[] | null>(null);
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeRoadmap(
        user.uid,
        (next) => {
          setRoadmap(next);
          setError(null);
        },
        fail,
      ),
      subscribeFreelance(user.uid, setFreelance, fail),
      subscribeAffiliateIdeas(user.uid, setIdeas, fail),
    ]);
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Career 💼"
        subtitle="Kerjakan segenap hati, hasilnya menyusul"
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {roadmap === null || freelance === null || ideas === null ? (
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
        ) : tab === 'affiliate' ? (
          <AffiliateTab ideas={ideas} />
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
          // Ide konten yang belum tayang — sengaja TIDAK ikut ke badge tile
          // Career di Home: ide yang menunggu itu antrean kreatif, bukan
          // tagihan harian, dan tidak boleh ikut membuat Home terlihat penuh.
          affiliate: pendingIdeas(ideas ?? []),
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
