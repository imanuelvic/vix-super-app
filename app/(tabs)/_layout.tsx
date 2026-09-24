import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { type ColorValue } from 'react-native';

import { SHADOW_RAISED } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { BounceTabIcon } from '@/components/bounce-tab-icon';
import { VixText } from '@/components/common/VixText';
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

/**
 * Label tab di kaki app: PUTIH TEBAL saat aktif, mint redup saat tidak.
 *
 * Ditulis sebagai fungsi, bukan lewat `tabBarLabelStyle`, karena gaya di situ
 * berlaku untuk SEMUA tab sekaligus dan tidak bisa berbeda menurut aktif atau
 * tidak. Ukuran & tinggi barisnya disebut eksplisit supaya tinggi tab bar
 * tidak bergeser sedikit pun saat tebalnya berganti.
 *
 * `color` datang dari navigator (tabBarActiveTintColor / InactiveTintColor),
 * jadi warnanya tetap satu sumber.
 */
function tabLabel(teks: string) {
  // Navigator MEMANGGIL fungsi ini (`label({ focused, color, … })`), bukan
  // memasangnya sebagai komponen — jadi identitasnya boleh berganti tiap
  // render tanpa ada yang di-remount. Namanya ada supaya maksudnya terbaca
  // dan aturan react/display-name tidak salah menuduhnya komponen.
  return function TabLabel({
    focused,
    color,
  }: {
    focused: boolean;
    color: ColorValue;
  }) {
    return (
      <VixText
        heading={focused ? 'bold' : 'label'}
        numberOfLines={1}
        additionalStyle={{ color, fontSize: 11, lineHeight: 14 }}>
        {teks}
      </VixText>
    );
  };
}

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
        // Putih untuk TULISANNYA. Ikon aktif memakai mint sendiri di
        // BounceTabIcon — ikon putih di atas pil emerald akan menyatu dengan
        // labelnya dan pil-nya kehilangan gunanya.
        tabBarActiveTintColor: Color.TEXT_REVERSE,
        tabBarInactiveTintColor: Color.TABBAR_INACTIVE,
        // 24 Sep 2026: kaki app jadi BAR EMERALD GELAP dengan garis pemisah di
        // atasnya. Sebelumnya putih tanpa garis, dan di layar krem yang terang
        // batas antara isi dan kaki layar nyaris tak terlihat. Bayangannya
        // tetap dipakai supaya barnya terasa MENGAMBANG di atas isi, bukan
        // sekadar blok gelap yang menempel.
        tabBarStyle: {
          ...SHADOW_RAISED,
          backgroundColor: Color.TABBAR_BG,
          // Sudut atas membulat, isi layar terlihat di belakangnya — sama
          // dengan bar sub-tab di layar fitur (components/common/BottomTabs).
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderTopColor: Color.TABBAR_LINE,
        },
        tabBarBadgeStyle: { backgroundColor: Color.DANGER, fontFamily: 'Inter_700Bold' },
        headerShown: false,
        tabBarButton: HapticTab,
        freezeOnBlur: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarLabel: tabLabel('Today'),
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="house.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="walk"
        options={{
          title: 'Walk',
          tabBarLabel: tabLabel('Walk'),
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="bird.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="core"
        options={{
          title: 'CORE',
          tabBarLabel: tabLabel('CORE'),
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
          tabBarLabel: tabLabel('Work'),
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
          tabBarLabel: tabLabel('Life'),
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="line.3.horizontal" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
