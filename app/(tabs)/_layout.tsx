import { Tabs } from 'expo-router';
import React, { useState } from 'react';

import { SHADOW_RAISED } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { BounceTabIcon } from '@/components/bounce-tab-icon';
import { HapticTab } from '@/components/haptic-tab';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import {
  effectiveRoadmap,
  freelanceReminderWindow,
  subscribeFreelance,
  subscribeRoadmap,
  type FreelanceProject,
  type RoadmapItem,
} from '@/lib/career';
import {
  coreAttention,
  EMPTY_WEEKLY_FOCUS,
  subscribeBirthdayGreets,
  subscribeCoreLeaders,
  subscribeMainTeam,
  subscribeVisitations,
  subscribeWeeklyFocus,
  type BirthdayGreets,
  type CoreLeader,
  type MainTeamMember,
  type Visitation,
  type WeeklyFocus,
} from '@/lib/core';
import { subscribeTasks, type Task } from '@/lib/tasks';

export const unstable_settings = {
  initialRouteName: 'index',
};

// ============================================================================
// LIMA TAB UTAMA (22 Sep 2026, versi 2.0) — urutan perhatian, bukan urutan
// fitur:  🏠 Today · ✝️ Walk · 👥 CORE · 💼 Work · ☰ Life
//
// Badge hanya di CORE & Work — dua tab yang memang punya "tagihan hari ini"
// (tagihan CORE: kirim panduan, follow up, ulang tahun; tagihan Work: P1 &
// tenggat H-7 + task WORK hari ini). Today tanpa badge (isinya sudah
// tagihan), Walk tanpa badge (hubungan, bukan tugas), Life tanpa badge (yang
// perlu perhatian sudah disebut di Today). Angkanya dihitung dari fungsi yang
// SAMA dengan badge sub-tab di dalam layarnya, lewat langganan yang dibagi
// dengan Today (ref-count liveDoc) — tidak ada bacaan tambahan.
// ============================================================================
export default function TabLayout() {
  const { now, todayId } = useNow();
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[]>([]);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [greets, setGreets] = useState<BirthdayGreets>({});
  const [focus, setFocus] = useState<WeeklyFocus>(EMPTY_WEEKLY_FOCUS);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [freelance, setFreelance] = useState<FreelanceProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useLiveAll((uid) => [
    subscribeCoreLeaders(uid, setLeaders),
    subscribeMainTeam(uid, setMainTeam),
    subscribeVisitations(uid, setVisitations),
    subscribeBirthdayGreets(uid, setGreets),
    subscribeWeeklyFocus(uid, setFocus),
    subscribeRoadmap(uid, setRoadmap),
    subscribeFreelance(uid, setFreelance),
    subscribeTasks(uid, setTasks),
  ]);

  const coreBadge = coreAttention({ leaders, mainTeam, visitations, greets, focus, now, todayId })
    .total;
  const workBadge =
    roadmap.filter((r) => r.status !== 'done' && effectiveRoadmap(r, now).priority === 1).length +
    freelance.filter((p) => freelanceReminderWindow(p, now)).length +
    tasks.filter((t) => !t.done && t.dayId === todayId && t.category === 'work').length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Color.MAIN_DARK,
        tabBarInactiveTintColor: Color.TEXT_LABEL,
        // Tab bar tanpa garis atas: bayangan halus yang memisahkannya dari isi.
        tabBarStyle: {
          ...SHADOW_RAISED,
          backgroundColor: Color.CONTAINER,
          borderTopWidth: 0,
        },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: Color.DANGER, fontFamily: 'Inter_700Bold' },
        headerShown: false,
        tabBarButton: HapticTab,
        freezeOnBlur: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="house.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="walk"
        options={{
          title: 'Walk',
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="bird.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="core"
        options={{
          title: 'CORE',
          tabBarBadge: coreBadge > 0 ? coreBadge : undefined,
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="person.2.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: 'Work',
          tabBarBadge: workBadge > 0 ? workBadge : undefined,
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="briefcase.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="life"
        options={{
          title: 'Life',
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="line.3.horizontal" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
