import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AffiliateTab } from '@/components/career/AffiliateTab';
import { BusinessTab } from '@/components/career/BusinessTab';
import { FreelanceTab } from '@/components/career/FreelanceTab';
import { FulltimeTab } from '@/components/career/FulltimeTab';
import { WorkFocusTab } from '@/components/career/WorkFocusTab';
import { EmojiButton } from '@/components/common/EmojiButton';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useLiveAll } from '@/hooks/useLiveAll';
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

type CareerTab = 'focus' | 'fulltime' | 'freelance' | 'affiliate' | 'business';

// Sub-tab Work (pil di bawah pita). Focus = "apa yang harus kukirim hari
// ini?": P1, tenggat ≤ 7 hari, task WORK hari ini, & 3 prioritas harian.
const TABS: BottomTab<CareerTab>[] = [
  { key: 'focus', label: 'Focus', icon: 'target' },
  { key: 'fulltime', label: 'Fulltime', icon: 'laptopcomputer' },
  { key: 'freelance', label: 'Freelance', icon: 'globe' },
  { key: 'affiliate', label: 'Affiliate', icon: 'megaphone.fill' },
  { key: 'business', label: 'Business', icon: 'cart.fill' },
];

// Career 💼 — empat topi pekerjaan: engineer NDC, freelancer, content creator /
// affiliate, dan (nanti) bisnis kuliner Manado.
export default function CareerScreen() {
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
  const { tab, scrollKey, onTabPress } = useTabScroll<CareerTab>('focus', {
    tabs: TABS,
  });

  const [roadmap, setRoadmap] = useState<RoadmapItem[] | null>(null);
  const [freelance, setFreelance] = useState<FreelanceProject[] | null>(null);
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLiveAll(
    (uid, fail) => [
      subscribeRoadmap(
        uid,
        (next) => {
          setRoadmap(next);
          setError(null);
        },
        fail,
      ),
      subscribeFreelance(uid, setFreelance, fail),
      subscribeAffiliateIdeas(uid, setIdeas, fail),
    ],
    { onError: setError },
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Tab utama Work 💼 (22 Sep 2026): Focus (yang harus dikirim hari ini)
          + keempat topi Career; Reminder ✅ (task harian & prioritas) dibuka
          dari tombol pojok kanan. Tanpa tombol kembali, sub-tab jadi pil. */}
      <ScreenHeader
        title="Work 💼"
        subtitle="Kerjakan segenap hati, hasilnya menyusul"
        right={<EmojiButton emoji="✅" onPress={() => router.push('/tasks')} />}
      />

      {/* Badge = pecahan dari badge tab Work di kaki app: P1 Fulltime yang
          belum selesai, dan Freelance yang deadline-nya sudah H-7. */}
      <BottomTabs
        placement="top"
        tabs={withBadge(TABS, {
          fulltime: (roadmap ?? []).filter(
            (r) =>
              r.status !== 'done' &&
              effectiveRoadmap(r, new Date()).priority === 1,
          ).length,
          freelance: (freelance ?? []).filter((p) =>
            freelanceReminderWindow(p, new Date()),
          ).length,
          // Ide konten yang belum tayang — sengaja TIDAK ikut ke badge tab
          // Work: ide yang menunggu itu antrean kreatif, bukan tagihan harian.
          affiliate: pendingIdeas(ideas ?? []),
        })}
        value={tab}
        onChange={onTabPress}
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {roadmap === null || freelance === null || ideas === null ? (
          <LoadingCenter />
        ) : tab === 'focus' ? (
          <WorkFocusTab roadmap={roadmap} freelance={freelance} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
});
