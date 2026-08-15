import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Color } from '@/assets/style/color';
import { HapticTab } from '@/components/haptic-tab';
import { RaisedHomeTab } from '@/components/raised-home-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  pendingHabits,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import { dayDocId, subscribeHabitDay, type HabitDay } from '@/lib/health';

// Home tetap tab pembuka meski Dashboard dideklarasikan lebih dulu (paling kiri).
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const { user } = useAuth();

  // Badge merah di tab Habits: kebiasaan yang sesinya sudah tiba tapi belum
  // dicentang. Dulu angka ini nempel di tile Health; sekarang kebiasaannya
  // pindah ke tab ini, jadi badge-nya ikut pindah ke sini.
  const [schedule, setSchedule] = useState<ScheduledHabit[]>([]);
  const [day, setDay] = useState<HabitDay | null>(null);

  // Jam berjalan (per menit) supaya lewat tengah malam badge ikut kereset.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const todayId = dayDocId(now);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeHabitSchedule(user.uid, setSchedule),
      subscribeHabitDay(user.uid, todayId, setDay),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, todayId]);

  const habitsLeft = day
    ? pendingHabits(schedule, day.done, now).length
    : 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Color.MAIN,
        tabBarInactiveTintColor: Color.TEXT_LABEL,
        tabBarStyle: {
          backgroundColor: Color.CONTAINER,
          borderTopColor: Color.BORDER,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/* Urutan tab: Dashboard · Habits · Home · Profile · System.
          Tournament 🏆 pindah ke grid Home; tempatnya di sini diisi Habits
          (kebiasaan harian + Diet + Sleep) yang memang dibuka tiap hari. */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          // Ikon kisi (bukan lonceng) — lonceng dipakai fitur Reminder.
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarBadge: habitsLeft > 0 ? habitsLeft : undefined,
          tabBarBadgeStyle: { backgroundColor: Color.DANGER },
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="checklist" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // Tombol Home menonjol/mengambang di tengah — render sendiri ikon +
          // labelnya, jadi tabBarIcon default tidak dipakai.
          tabBarButton: (props) => <RaisedHomeTab {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="version"
        options={{
          title: 'System',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
