/**
 * ConnectionStatusBar — Top connection status indicator.
 * Live connectivity state, network generation (2G/3G/4G/5G), and
 * carrier/provider name via @react-native-community/netinfo.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Colors, BorderRadius } from '@/constants/theme';
import { GENERATION_LABELS } from '@/constants/network';
import { gs } from '@/styles/globalStyles';

type IconName = keyof typeof MaterialIcons.glyphMap;

export default React.memo(function ConnectionStatusBar() {
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(setState);
    NetInfo.fetch().then(setState);
    return () => unsubscribe();
  }, []);

  const connected = state?.isConnected ?? false;
  const internetReachable = state?.isInternetReachable;

  const status = !connected
    ? 'Disconnected'
    : internetReachable === false
      ? 'Limited'
      : 'Connected';

  let networkType = '';
  let carrier = '';
  let statusIcon: IconName = 'signal-wifi-off';

  if (connected && state) {
    switch (state.type) {
      case 'cellular': {
        const gen = state.details.cellularGeneration;
        networkType =
          gen != null ? GENERATION_LABELS[gen] ?? gen.toUpperCase() : 'CELLULAR';
        carrier = state.details.carrier ?? '';
        statusIcon = 'signal-cellular-alt';
        break;
      }
      case 'wifi': {
        networkType = 'WI-FI';
        carrier = state.details.ssid ?? '';
        statusIcon = 'wifi';
        break;
      }
      case 'ethernet':
        networkType = 'ETHERNET';
        statusIcon = 'lan';
        break;
      default:
        networkType = 'ONLINE';
        statusIcon = 'public';
        break;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View
          style={[
            gs.statusDotGlow,
            (!connected || internetReachable === false) && { backgroundColor: Colors.error },
          ]}
        />
        <Text style={[gs.bodyMd, { color: Colors.onSurface }]}>{status}</Text>
      </View>

      <View style={styles.right}>
        {connected && (
          <>
            <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>
              {networkType}
            </Text>
            {carrier ? (
              <>
                <View style={styles.separator} />
                <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>
                  {carrier.toUpperCase()}
                </Text>
              </>
            ) : null}
          </>
        )}
      </View>

      <MaterialIcons name={statusIcon} size={20} color={Colors.onSurfaceVariant} />
    </View>
  );
});

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
