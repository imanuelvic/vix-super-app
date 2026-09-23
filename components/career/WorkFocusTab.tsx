import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BLOCK_CARD, CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { PrioritiesBlock } from '@/components/today/PrioritiesBlock';
import { TodayRow } from '@/components/today/TodaySection';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import {
  deadlineDaysUntil,
  effectiveRoadmap,
  roadmapDaysUntil,
  type FreelanceProject,
  type RoadmapItem,
} from '@/lib/career';
import { whenLabel } from '@/lib/format';
import { EMPTY_PRIORITY_DAY, subscribePriorityDay, type PriorityDay } from '@/lib/priority';
import {
  effectiveOtherTask,
  otherTaskDaysUntil,
  subscribeOtherTasks,
  subscribeTasks,
  type OtherTask,
  type Task,
} from '@/lib/tasks';
import type { TodayItem } from '@/lib/today';

// 🎯 Sub-tab Focus di Work — "What's the one thing I should ship today?"
//
// Bukan sistem manajemen proyek. Satu layar, tiga hal:
//   1. 💡 3 hal terpenting hari ini (pilihanmu; blok yang sama dengan Today),
//   2. yang HARUS dikirim: P1, tenggat ≤ 7 hari, task kategori WORK hari ini,
//   3. sesudahnya: roadmap Fulltime & proyek Freelance yang belum selesai,
//      urut tenggat — supaya hari kosong pun tahu mau mengerjakan apa.
// Datanya langganan yang sama dengan sub-tab Fulltime/Freelance (dioper) dan
// Today (ref-count liveDoc), jadi tab ini tidak menambah bacaan.
export function WorkFocusTab({
  roadmap,
  freelance,
}: {
  roadmap: RoadmapItem[];
  freelance: FreelanceProject[];
}) {
  const router = useRouter();
  const { now, todayId } = useNow();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [otherTasks, setOtherTasks] = useState<OtherTask[]>([]);
  const [priorities, setPriorities] = useState<PriorityDay>(EMPTY_PRIORITY_DAY);

  useLiveAll(
    (uid) => [
      subscribeTasks(uid, setTasks),
      subscribeOtherTasks(uid, setOtherTasks),
      subscribePriorityDay(uid, todayId, setPriorities),
    ],
    { deps: [todayId] },
  );

  // ===== Harus dikirim: tenggat ≤ 7 hari (termasuk lewat) & task WORK hari ini =====
  const mendesak: TodayItem[] = [];
  for (const t of tasks.filter((t) => t.dayId === todayId && !t.done && t.category === 'work')) {
    mendesak.push({
      id: `task-${t.id}`,
      section: 'work',
      tier: 'today',
      rank: 2,
      emoji: '💼',
      title: t.title,
      detail: 'Task hari ini',
      href: { pathname: '/tasks', params: { category: 'work' } },
    });
  }
  for (const t of otherTasks
    .filter(
      (t) =>
        !t.done &&
        (t.category === 'work' || t.category === undefined) &&
        effectiveOtherTask(t, now).priority === 1,
    )
    .sort((a, b) => (a.deadline?.toMillis() ?? 0) - (b.deadline?.toMillis() ?? 0))) {
    const days = otherTaskDaysUntil(t, now);
    mendesak.push({
      id: `prio-${t.id}`,
      section: 'work',
      tier: 'today',
      rank: 2,
      emoji: '📌',
      title: t.title,
      detail: days === null ? 'P1' : `P1 · ${whenLabel(days)}`,
      href: { pathname: '/tasks', params: { tab: 'priority' } },
    });
  }
  const roadmapAktif = roadmap
    .filter((r) => r.status !== 'done' && r.deadline)
    .map((r) => ({ r, days: roadmapDaysUntil(r.deadline!, now) }))
    .sort((a, b) => a.days - b.days);
  const freelanceAktif = freelance
    .filter((p) => !p.done)
    .map((p) => ({ p, days: deadlineDaysUntil(p, now) }))
    .sort((a, b) => a.days - b.days);
  for (const { r, days } of roadmapAktif.filter((x) => x.days <= 7)) {
    mendesak.push({
      id: `ft-${r.id}`,
      section: 'work',
      tier: 'today',
      rank: 4,
      emoji: '💻',
      title: r.title,
      detail: `${whenLabel(days)}${r.pic ? ` · ${r.pic}` : ''}`,
      href: { pathname: '/work', params: { tab: 'fulltime', edit: r.id } },
    });
  }
  for (const { p, days } of freelanceAktif.filter((x) => x.days <= 7)) {
    mendesak.push({
      id: `fl-${p.id}`,
      section: 'work',
      tier: 'today',
      rank: 4,
      emoji: '🌐',
      title: `${p.name}${p.client ? ` (${p.client})` : ''}`,
      detail: whenLabel(days),
      href: { pathname: '/work', params: { tab: 'freelance', edit: p.id } },
    });
  }

  // ===== Sesudahnya: sisanya yang belum selesai, urut tenggat (maks 5) =====
  const berikut: TodayItem[] = [
    ...roadmapAktif
      .filter((x) => x.days > 7)
      .map(({ r, days }) => ({
        id: `ft-next-${r.id}`,
        section: 'work' as const,
        tier: 'next' as const,
        rank: 4,
        emoji: '💻',
        title: r.title,
        detail: `P${effectiveRoadmap(r, now).priority} · ${whenLabel(days)}`,
        href: { pathname: '/work', params: { tab: 'fulltime', edit: r.id } },
      })),
    ...freelanceAktif
      .filter((x) => x.days > 7)
      .map(({ p, days }) => ({
        id: `fl-next-${p.id}`,
        section: 'work' as const,
        tier: 'next' as const,
        rank: 4,
        emoji: '🌐',
        title: `${p.name}${p.client ? ` (${p.client})` : ''}`,
        detail: whenLabel(days),
        href: { pathname: '/work', params: { tab: 'freelance', edit: p.id } },
      })),
  ]
    .sort((a, b) => (a.detail ?? '').localeCompare(b.detail ?? ''))
    .slice(0, 5);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PrioritiesBlock day={priorities} todayId={todayId} />

      <View style={styles.card}>
        <VixText heading="eyebrow" additionalStyle={styles.eyebrow}>
          Harus dikirim
        </VixText>
        {mendesak.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.quiet}>
            Tidak ada tenggat yang mendesak. Pilih satu dari daftar di bawah dan kirim hari ini.
          </VixText>
        ) : (
          mendesak.map((it) => <TodayRow key={it.id} item={it} />)
        )}
        <PressableScale style={styles.link} onPress={() => router.push('/tasks')} hitSlop={6}>
          <VixText heading="label" additionalStyle={styles.linkText}>
            ✅ Semua task & prioritas →
          </VixText>
        </PressableScale>
      </View>

      {berikut.length > 0 && (
        <View style={styles.card}>
          <VixText heading="eyebrow" additionalStyle={styles.eyebrow}>
            Sesudahnya
          </VixText>
          {berikut.map((it) => (
            <TodayRow key={it.id} item={it} muted />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: CARD_GAP + 2 },
  card: { ...BLOCK_CARD },
  eyebrow: { color: Color.CAREER_DARK, marginBottom: 4 },
  quiet: { paddingVertical: 6 },
  link: { alignSelf: 'flex-end', marginTop: 4 },
  linkText: { color: Color.CAREER_DARK },
});
