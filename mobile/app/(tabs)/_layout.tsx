/**
 * Tab Layout — Three-tab navigation: Queue, History, Settings.
 * Dark theme with custom icons and badge support.
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/Colors';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.brand.primary,
        tabBarInactiveTintColor: palette.text.tertiary,
        tabBarStyle: {
          backgroundColor: palette.dark.surface,
          borderTopColor: palette.dark.border,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        headerStyle: {
          backgroundColor: palette.dark.surface,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitleStyle: {
          color: palette.text.primary,
          fontWeight: '700',
          fontSize: 18,
        },
        headerTintColor: palette.text.primary,
      }}
    >
      <Tabs.Screen
        name="dms"
        options={{
          title: 'Review',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubbles" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <Ionicons name="time" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
