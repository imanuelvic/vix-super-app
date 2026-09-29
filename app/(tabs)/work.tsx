import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_SAFE } from '@/assets/style/layout';
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
import { useNow } from '@/hooks/useNow';
import { subscribeAffiliateIdeas, type ContentIdea } from '@/lib/affiliate';
import {
  subscribeFreelance,
  subscribeRoadmap,
  workAttention,
  type FreelanceProject,
  type RoadmapItem,
} from '@/lib/career';
import { subscribeTasks, type Task } from '@/lib/tasks';

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
  // Task harian kategori WORK — bukan untuk digambar di sini, tapi untuk badge
  // tombol 🔔 supaya pecahan badge tab Work terlihat lengkap.
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { now, todayId } = useNow();

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
      subscribeTasks(uid, setTasks, fail),
    ],
    { onError: setError },
  );

  // Semua angka badge layar ini (dan badge tab Work di kaki app) datang dari
  // SATU fungsi — lihat komentarnya di lib/career.ts.
  const perhatian = workAttention({
    roadmap: roadmap ?? [],
    freelance: freelance ?? [],
    ideas: ideas ?? [],
    tasks: tasks ?? [],
    now,
    todayId,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Tab utama Work 💼 (22 Sep 2026): Focus (yang harus dikirim hari ini)
          + keempat topi Career; Reminder 🔔 (task harian & prioritas) dibuka
          dari tombol pojok kanan. Tanpa tombol kembali, sub-tab jadi pil. */}
      <ScreenHeader
        title="Work 💼"
        subtitle="Kerjakan segenap hati, hasilnya menyusul"
        right={
          <EmojiButton
            emoji="🔔"
            badge={perhatian.tasks}
            onPress={() => router.push('/tasks')}
          />
        }
      />

      {/* Badge sub-tab = PECAHAN dari badge tab Work di kaki app, dan sejak
          28 Sep 2026 keduanya benar-benar dijumlah dari angka yang sama
          (workAttention di lib/career.ts). Aturannya satu: angka di kaki app =
          jumlah semua angka yang kelihatan rinciannya di layar ini. Task WORK
          hari ini tidak punya sub-tab, jadi ia memakai badge tombol 🔔 di
          pojok kanan — dengan begitu keempat pecahannya benar-benar terlihat
          dan bisa dijumlah sendiri. */}
      <BottomTabs
        placement="top"
        tabs={withBadge(TABS, {
          fulltime: perhatian.fulltime,
          freelance: perhatian.freelance,
          affiliate: perhatian.affiliate,
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
  safe: { ...SCREEN_SAFE },
  content: { flex: 1 },
});
