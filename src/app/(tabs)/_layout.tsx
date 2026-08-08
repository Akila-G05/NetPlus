/**
 * Tabs Layout — Bottom tab navigator with 5 tabs.
 * Order: Pinging → Injector → SpeedTest → Network → Settings
 */
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // ── Header ───────────────────────────────────────
        headerStyle: {
          backgroundColor: Colors.surfaceContainer,
          borderBottomWidth: 1,
          borderBottomColor: Colors.outlineVariant,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitle: () => (
          <View style={styles.headerTitle}>
            <MaterialIcons name="settings-input-antenna" size={22} color={Colors.primary} />
            <Text style={styles.headerText}>Network Utility</Text>
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerRight}>
            <Text style={styles.headerStatus}>5G • LTE</Text>
            <View style={styles.statusDotSmall} />
          </View>
        ),
        headerTitleAlign: 'left',

        // ── Tab bar ──────────────────────────────────────
        tabBarStyle: {
          backgroundColor: Colors.surfaceContainer,
          borderTopWidth: 1,
          borderTopColor: Colors.outlineVariant,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
          elevation: 0,
          shadowColor: 'transparent',
        },
        tabBarActiveTintColor: Colors.onSecondaryContainer,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
        tabBarLabelStyle: {
          ...Typography.labelCaps,
          fontSize: 10,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
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
            <View style={focused ? styles.activeIconWrap : undefined}>
              <MaterialIcons
                name="wifi-tethering"
                size={22}
                color={focused ? Colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      {/* ── Injector ───────────────────────────────────── */}
      <Tabs.Screen
        name="injector"
        options={{
          title: 'Injector',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <MaterialIcons
                name="terminal"
                size={22}
                color={focused ? Colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      {/* ── SpeedTest ──────────────────────────────────── */}
      <Tabs.Screen
        name="speedtest"
        options={{
          title: 'SpeedTest',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <MaterialIcons
                name="speed"
                size={22}
                color={focused ? Colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      {/* ── Network ────────────────────────────────────── */}
      <Tabs.Screen
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <MaterialIcons
                name="router"
                size={22}
                color={focused ? Colors.onSecondaryContainer : color}
              />
            </View>
          ),
        }}
      />

      {/* ── Settings ───────────────────────────────────── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <MaterialIcons
                name="settings"
                size={22}
                color={focused ? Colors.onSecondaryContainer : color}
              />
            </View>
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
  // ── Header ─────────────────────────────────────────────
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
  headerStatus: {
    ...Typography.codeSm,
    color: Colors.onSurfaceVariant,
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.tertiary,
  },

  // ── Tab bar ────────────────────────────────────────────
  activeIconWrap: {
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
});
