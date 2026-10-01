import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_SAFE } from '@/assets/style/layout';
import { BusinessTab } from '@/components/career/BusinessTab';
import { FreelanceTab } from '@/components/career/FreelanceTab';
import { FulltimeTab } from '@/components/career/FulltimeTab';
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
import {
  subscribeFreelance,
  subscribeRoadmap,
  workAttention,
  type FreelanceProject,
  type RoadmapItem,
} from '@/lib/career';
import { subscribeTasks, type Task } from '@/lib/tasks';

type CareerTab = 'fulltime' | 'freelance' | 'business';

// Sub-tab Work (pil di bawah pita).
//
// 1 Okt 2026: Focus & Affiliate DIHAPUS TOTAL atas permintaan pemilik app.
// Focus cuma mengumpulkan ulang hal yang sudah tampil di tab Today (P1,
// tenggat dekat, task WORK hari ini, tiga prioritas harian), jadi ia layar
// kedua untuk jawaban yang sama. Affiliate tidak lagi dijalani.
const TABS: BottomTab<CareerTab>[] = [
  { key: 'fulltime', label: 'Fulltime', icon: 'laptopcomputer' },
  { key: 'freelance', label: 'Freelance', icon: 'globe' },
  { key: 'business', label: 'Business', icon: 'cart.fill' },
];

// Career 💼 — tiga topi pekerjaan: engineer NDC, freelancer, dan (nanti)
// bisnis kuliner Manado.
export default function CareerScreen() {
  const router = useRouter();

  // ?edit=<id> untuk otomatis membuka modal edit item yang di-click.
  // (?tab=… diurus useTabScroll di bawah.)
  const { edit: editParam } = useLocalSearchParams<{ edit?: string }>();

  // Setelah tab memakai ?edit=… (membuka modal), bersihkan param dari URL. Tanpa
  // ini, modal auto-terbuka lagi tiap kembali ke subtab (konten di-mount ulang
  // oleh key={scrollKey}). Dipanggil tab lewat onEditConsumed SETELAH modal
  // dibuka — jadi param tak keburu hilang sebelum datanya termuat.
  const clearEditParam = useCallback(() => {
    if (editParam) router.setParams({ edit: '' });
  }, [editParam, router]);
  // Hook bersama: ganti tab + scroll ke atas tiap tab di-click, plus buka
  // sub-tab tertentu lewat ?tab=… (reminder Dashboard & deep link).
  const { tab, scrollKey, onTabPress } = useTabScroll<CareerTab>('fulltime', {
    tabs: TABS,
  });

  const [roadmap, setRoadmap] = useState<RoadmapItem[] | null>(null);
  const [freelance, setFreelance] = useState<FreelanceProject[] | null>(null);
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
      subscribeTasks(uid, setTasks, fail),
    ],
    { onError: setError },
  );

  // Semua angka badge layar ini (dan badge tab Work di kaki app) datang dari
  // SATU fungsi — lihat komentarnya di lib/career.ts.
  const perhatian = workAttention({
    roadmap: roadmap ?? [],
    freelance: freelance ?? [],
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
          // Langsung ke kategori WORK, bukan daftar kategori bawaan
          // (PERSONAL): badge di tombol ini memang menghitung task WORK hari
          // ini, jadi membuka kategori lain berarti angkanya tidak kelihatan
          // di layar yang baru dibuka.
          <EmojiButton
            emoji="🔔"
            badge={perhatian.tasks}
            onPress={() =>
              router.push({ pathname: '/tasks', params: { category: 'work' } })
            }
          />
        }
      />

      {/* Badge sub-tab = PECAHAN dari badge tab Work di kaki app, dan sejak
          28 Sep 2026 keduanya benar-benar dijumlah dari angka yang sama
          (workAttention di lib/career.ts). Aturannya satu: angka di kaki app =
          jumlah semua angka yang kelihatan rinciannya di layar ini. Task WORK
          hari ini tidak punya sub-tab, jadi ia memakai badge tombol 🔔 di
          pojok kanan — dengan begitu ketiga pecahannya benar-benar terlihat
          dan bisa dijumlah sendiri. */}
      <BottomTabs
        placement="top"
        tabs={withBadge(TABS, {
          fulltime: perhatian.fulltime,
          freelance: perhatian.freelance,
        })}
        value={tab}
        onChange={onTabPress}
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {roadmap === null || freelance === null ? (
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
