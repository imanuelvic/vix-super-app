import { Tabs } from 'expo-router';
import React from 'react';

import { Color } from '@/assets/style/color';
import { HapticTab } from '@/components/haptic-tab';
import { RaisedHomeTab } from '@/components/raised-home-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Home tetap tab pembuka meski Dashboard dideklarasikan lebih dulu (paling kiri).
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
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
      {/* Urutan tab: Dashboard · Tournament · Home · Profile · System */}
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
        name="tournament"
        options={{
          title: 'Tournament',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="trophy.fill" color={color} />
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
