import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AchievementButton } from '@/components/common/AchievementButton';
import { BottomTabs, withBadge, type BottomTab } from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { SkillsTab } from '@/components/learning/SkillsTab';
import { TopicsTab } from '@/components/learning/TopicsTab';
import { WeekTab } from '@/components/learning/WeekTab';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import {
  EMPTY_WEEK,
  learningPending,
  subscribeLearningStreak,
  subscribeLearningWeek,
  subscribeSkillsDone,
  subscribeTopicsDone,
  weekDocId,
  type LearningWeek,
  type SkillsDone,
  type TopicsDone,
  type WeekStreak,
} from '@/lib/learning';
import { unsubscribeAll } from '@/lib/liveDoc';
import { EMPTY_DAY_STREAK as EMPTY_WEEK_STREAK } from '@/lib/streak';

type LearningTabKey = 'week' | 'skills' | 'topics';

// Fitur Learning 🎓 — satu ilmu baru tiap minggu.
//   🎯 Minggu Ini — topik giliran minggu ini + 4 langkah kecilnya
//   🧠 Skills     — 22 topik dari daftarmu, per bidang
//   💬 Diskusi    — 62 bahan percakapan, supaya ilmunya keluar jadi omongan
const TABS: BottomTab<LearningTabKey>[] = [
  { key: 'week', label: 'Target', icon: 'target' },
  { key: 'skills', label: 'Skills', icon: 'graduationcap.fill' },
  { key: 'topics', label: 'Discussion', icon: 'bubble.left.fill' },
];

export default function LearningScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<LearningTabKey>('week');
  const { now } = useNow();

  // id minggu = tanggal Senin minggu ini → otomatis ganti tiap Senin.
  const weekId = weekDocId(now);

  const [week, setWeek] = useState<LearningWeek | null>(null);
  const [skillsDone, setSkillsDone] = useState<SkillsDone>({});
  // null = belum termuat. Badge ikut menunggunya (lihat `pending` di bawah)
  // supaya angkanya tidak sempat salah sekejap saat layar dibuka.
  const [topicsDone, setTopicsDone] = useState<TopicsDone | null>(null);
  // Streak minggu tuntas berturut-turut 🔥 — dasar achievement 🎓 Learning.
  const [streak, setStreak] = useState<WeekStreak>(EMPTY_WEEK_STREAK);

  useEffect(() => {
    if (!user) return;
    return unsubscribeAll([
      subscribeLearningWeek(user.uid, weekId, setWeek),
      subscribeSkillsDone(user.uid, setSkillsDone),
      subscribeTopicsDone(user.uid, setTopicsDone),
      subscribeLearningStreak(user.uid, setStreak),
    ]);
  }, [user, weekId]);

  const current = week ?? EMPTY_WEEK;
  // Badge sub-tab 🎯 Target = ANGKA YANG SAMA dengan badge tile Learning di
  // Home: langkah yang harinya sudah tiba tapi belum dikerjakan + topik
  // diskusi minggu ini yang belum diobrolkan. Keduanya lewat learningPending,
  // jadi mustahil berbeda pendapat. Semua yang dihitung memang ada di sub-tab
  // ini (4 langkah + bagian "Diskusi Dalam Minggu Ini").
  const pending =
    week === null || topicsDone === null
      ? 0
      : learningPending(week.steps, topicsDone, now);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Learning 🎓"
        subtitle="Satu ilmu baru tiap minggu"
        // Streak MINGGUAN Learning 🎓 lahir dari 4 langkah di layar ini.
        right={<AchievementButton category="learning" />}
      />

      <View style={styles.content} key={scrollKey}>
        {week === null || topicsDone === null ? (
          <LoadingCenter />
        ) : tab === 'week' ? (
          <WeekTab
            week={current}
            weekId={weekId}
            now={now}
            skillsDone={skillsDone}
            topicsDone={topicsDone}
            streak={streak}
          />
        ) : tab === 'skills' ? (
          <SkillsTab
            week={current}
            weekId={weekId}
            now={now}
            skillsDone={skillsDone}
          />
        ) : (
          <TopicsTab topicsDone={topicsDone} />
        )}
      </View>

      <BottomTabs
        tabs={withBadge(TABS, { week: pending })}
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
