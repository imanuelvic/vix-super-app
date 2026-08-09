import { Tabs } from 'expo-router';
import React from 'react';

import { Color } from '@/assets/style/color';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Home tetap tab pembuka meski Finance dideklarasikan lebih dulu (paling kiri).
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
      {/* Urutan tab: Finance · Home · Profile · System */}
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="banknote" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
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
