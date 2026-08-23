/**
 * Tabs Layout — Bottom tab navigator with 5 tabs.
 * Order: Pinging → Injector → SpeedTest → Network → Settings
 */
import React, { useEffect, useState, memo } from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Colors, Typography, Spacing } from '@/constants/theme';

type IconName = keyof typeof MaterialIcons.glyphMap;

// Memoized Header Title component
const HeaderTitle = memo(function HeaderTitle() {
  return (
    <View style={styles.headerTitle}>
      <MaterialIcons name="settings-input-antenna" size={22} color={Colors.primary} />
      <Text style={styles.headerText}>NetPulse</Text>
    </View>
  );
});

// Memoized Header Connection Status component — isolates NetInfo updates
const HeaderConnectionStatus = memo(function HeaderConnectionStatus() {
  const [netState, setNetState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(setNetState);
    NetInfo.fetch().then(setNetState);
    return () => unsubscribe();
  }, []);

  const connected = netState?.isConnected ?? false;
  let connIcon: IconName = 'signal-wifi-off';
  if (connected && netState) {
    switch (netState.type) {
      case 'cellular':
        connIcon = 'signal-cellular-4-bar';
        break;
      case 'wifi':
        connIcon = 'wifi';
        break;
      case 'ethernet':
        connIcon = 'lan';
        break;
      default:
        connIcon = 'public';
        break;
    }
  }

  return (
    <View style={styles.headerRight}>
      <MaterialIcons
        name={connIcon}
        size={20}
        color={connected ? Colors.tertiary : Colors.error}
      />
    </View>
  );
});

// Memoized TabBarIcon helper
interface TabBarIconProps {
  name: IconName;
  color: string;
  focused: boolean;
}

const TabBarIcon = memo(function TabBarIcon({ name, color, focused }: TabBarIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.activeIconWrap]}>
      <MaterialIcons name={name} size={22} color={focused ? Colors.primary : color} />
    </View>
  );
});

const renderHeaderTitle = () => <HeaderTitle />;
const renderHeaderRight = () => <HeaderConnectionStatus />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // ── Performance & Animations ────────────────────
        freezeOnBlur: true,
        animation: 'fade',
        sceneStyle: { backgroundColor: Colors.background },

        // ── Header ───────────────────────────────────────
        headerStyle: {
          backgroundColor: Colors.surfaceContainer,
          borderBottomWidth: 1,
          borderBottomColor: Colors.outlineVariant,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitle: renderHeaderTitle,
        headerRight: renderHeaderRight,
        headerTitleAlign: 'left',

        // ── Tab bar ──────────────────────────────────────
        tabBarStyle: {
          backgroundColor: Colors.surfaceContainer,
          borderTopWidth: 1,
          borderTopColor: Colors.outlineVariant,
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 0,
          shadowColor: 'transparent',
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
        tabBarLabelStyle: {
          ...Typography.labelCaps,
          fontSize: 10,
          marginTop: 4,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveBackgroundColor: 'transparent',
      }}
    >
      {/* ── Pinging ────────────────────────────────────── */}
      <Tabs.Screen
        name="pinging"
        options={{
          title: 'Pinging',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="wifi-tethering" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Injector ───────────────────────────────────── */}
      <Tabs.Screen
        name="injector"
        options={{
          title: 'Injector',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="terminal" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── SpeedTest ──────────────────────────────────── */}
      <Tabs.Screen
        name="speedtest"
        options={{
          title: 'SpeedTest',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="speed" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Network ────────────────────────────────────── */}
      <Tabs.Screen
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="router" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Settings ───────────────────────────────────── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="settings" color={color} focused={focused} />
          ),
        }}
      />

      {/* Hide index from tabs */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.elementGap,
  },
  headerText: {
    ...Typography.headlineLg,
    fontSize: 20,
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.elementGap,
    marginRight: Spacing.containerPadding,
  },
  iconWrap: {
    width: 52,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  activeIconWrap: {
    backgroundColor: 'rgba(75, 142, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.3)',
  },
});
