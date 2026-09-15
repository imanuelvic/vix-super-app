import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Color } from '@/assets/style/color';
import { BounceTabIcon } from '@/components/bounce-tab-icon';
import { HapticTab } from '@/components/haptic-tab';
import { RaisedHomeTab } from '@/components/raised-home-tab';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import {
  countedHabits,
  pendingHabits,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import { subscribeHabitDay, type HabitDay } from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const { user } = useAuth();

  const [schedule, setSchedule] = useState<ScheduledHabit[]>([]);
  const [day, setDay] = useState<HabitDay | null>(null);

  const { now, todayId } = useNow();

  useEffect(() => {
    if (!user) return;
    return unsubscribeAll([
      subscribeHabitSchedule(user.uid, setSchedule),
      subscribeHabitDay(user.uid, todayId, setDay),
    ]);
  }, [user, todayId]);

  const habitsLeft = day
    ? pendingHabits(countedHabits(schedule, day.skipped), day.done, now).length
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
        // Tombolnya mengecil saat disentuh & ikonnya melompat saat jadi aktif
        // (BounceTabIcon) — pantulan yang sama dengan sub-tab di dalam fitur.
        tabBarButton: HapticTab,
        freezeOnBlur: true,
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="square.grid.2x2.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarBadge: habitsLeft > 0 ? habitsLeft : undefined,
          tabBarBadgeStyle: { backgroundColor: Color.DANGER },
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="checklist" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarButton: (props) => <RaisedHomeTab {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="person.crop.circle.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="version"
        options={{
          title: 'System',
          tabBarIcon: ({ color, focused }) => (
            <BounceTabIcon name="gearshape.fill" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
