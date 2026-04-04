import { Tabs } from 'expo-router';
import React from 'react';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Theme } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Theme.bg,
          borderTopColor: Theme.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Theme.accent,
        tabBarInactiveTintColor: Theme.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.5,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Track',
          tabBarIcon: ({ color, size }) => <Icon name="run" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Icon name="chart-timeline-variant" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
