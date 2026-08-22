import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
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
  dueStep,
  EMPTY_WEEK,
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
  const [topicsDone, setTopicsDone] = useState<TopicsDone>({});
  // Rentetan minggu tuntas berturut-turut 🔥 — dasar achievement 🎓 Learning.
  const [streak, setStreak] = useState<WeekStreak>(EMPTY_WEEK_STREAK);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeLearningWeek(user.uid, weekId, setWeek),
      subscribeSkillsDone(user.uid, setSkillsDone),
      subscribeTopicsDone(user.uid, setTopicsDone),
      subscribeLearningStreak(user.uid, setStreak),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, weekId]);

  const current = week ?? EMPTY_WEEK;
  // Badge sub-menu "Minggu Ini": 1 = ada langkah yang harinya sudah tiba tapi
  // belum dikerjakan. Sama artinya dengan kartu reminder di Dashboard.
  const pending = dueStep(current.steps, now) ? 1 : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Learning 🎓"
        subtitle="Satu ilmu baru tiap minggu"
      />

      <View style={styles.content} key={scrollKey}>
        {week === null ? (
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
