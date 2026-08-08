/**
 * ConnectionStatusBar — Top connection status indicator.
 * Shows connectivity state, network type, and carrier.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';

interface ConnectionStatusBarProps {
  connected?: boolean;
  networkType?: string;
  carrier?: string;
}

export default function ConnectionStatusBar({
  connected = true,
  networkType = '4G LTE',
  carrier = 'Dialog',
}: ConnectionStatusBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={[gs.statusDotGlow, !connected && { backgroundColor: Colors.error }]} />
        <Text style={[gs.bodyMd, { color: Colors.onSurface }]}>
          {connected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>{networkType}</Text>
        <View style={styles.separator} />
        <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>{carrier}</Text>
      </View>

      <MaterialIcons name="info-outline" size={20} color={Colors.onSurfaceVariant} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 12,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: Colors.outlineVariant,
  },
});
