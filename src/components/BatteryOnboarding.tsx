/**
 * BatteryOnboarding — Root-level provider that shows the battery
 * optimization modal on first app entry (any screen). Exposes
 * `batteryModalDismissed` so child screens (e.g. pinging) can
 * display a persistent "re-enable" banner.
 */
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Modal, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
  openBatteryOptimizationSettings,
} from 'netplus-ping';

const BATTERY_TIP_KEY = '@netplus/battery-tip-shown';

interface BatteryOnboardingCtx {
  batteryModalDismissed: boolean;
  showBatteryModal: () => void;
}

const BatteryOnboardingContext = createContext<BatteryOnboardingCtx>({
  batteryModalDismissed: false,
  showBatteryModal: () => {},
});

export function useBatteryOnboarding() {
  return useContext(BatteryOnboardingContext);
}

interface Props {
  children: ReactNode;
}

export default function BatteryOnboarding({ children }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [exempt, setExempt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [isExempt, tipShown] = await Promise.all([
          isIgnoringBatteryOptimizations(),
          AsyncStorage.getItem(BATTERY_TIP_KEY),
        ]);
        if (!active) return;
        setExempt(isExempt);
        if (!isExempt && tipShown !== 'true') {
          setModalVisible(true);
          await AsyncStorage.setItem(BATTERY_TIP_KEY, 'true');
        } else if (tipShown === 'true') {
          setDismissed(true);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const handleClose = async () => {
    setModalVisible(false);
    setDismissed(true);
    try {
      await AsyncStorage.setItem(BATTERY_TIP_KEY, 'true');
    } catch {}
  };

  const handleAllow = async () => {
    setBusy(true);
    await requestIgnoreBatteryOptimizations();
    const isExempt = await isIgnoringBatteryOptimizations();
    setExempt(isExempt);
    setBusy(false);
    if (isExempt) {
      setModalVisible(false);
    }
  };

  return (
    <BatteryOnboardingContext.Provider value={{ batteryModalDismissed: dismissed, showBatteryModal: () => setModalVisible(true) }}>
      {children}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity activeOpacity={1} style={styles.container}>
            <View style={styles.card}>
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="battery-alert" size={20} color={Colors.warning} />
                  <Text style={styles.title}>ALLOW BACKGROUND RUN</Text>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <Text style={[gs.bodyMd, { color: Colors.onSurface, marginBottom: 10 }]}>
                Some phones (especially Honor / Huawei / Xiaomi) pause background
                apps when the screen is off, which can pause pinging. Allowing
                NetPlus to ignore battery optimization keeps pinging running
                reliably in the background.
              </Text>

              {exempt ? (
                <View style={[styles.okBanner, { marginBottom: 12 }]}>
                  <MaterialIcons name="check-circle" size={18} color={Colors.tertiary} />
                  <Text style={[gs.bodyMd, { color: Colors.tertiary, flex: 1 }]}>
                    Battery optimization is already disabled for NetPlus.
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[gs.btnPrimary, { marginBottom: 10 }]}
                    activeOpacity={0.8}
                    disabled={busy}
                    onPress={handleAllow}
                  >
                    <Text style={gs.btnPrimaryText}>
                      {busy ? 'Opening…' : 'Allow Background Always'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[gs.btnSecondary, { marginBottom: 6 }]}
                    activeOpacity={0.8}
                    onPress={() => openBatteryOptimizationSettings()}
                  >
                    <Text style={gs.btnSecondaryText}>Open Battery Settings</Text>
                  </TouchableOpacity>
                </>
              )}

              <Text style={[Typography.labelCaps, { color: Colors.onSurfaceVariant, marginTop: 10 }]}>
                HONOR / HUAWEI STEP-BY-STEP
              </Text>
              <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 6 }]}>
                1. Open Settings → Battery → App launch
                {'\n'}2. Find NetPlus → tap it → select {'Manage manually'}
                {'\n'}3. Enable ALL toggles (Auto-launch, Secondary launch, Run in background)
                {'\n'}4. Also {'Lock'} NetPlus in Recent Apps.
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </BatteryOnboardingContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 10,
    marginBottom: 8,
  },
  title: {
    ...Typography.labelCaps,
    color: Colors.onSurface,
  },
  okBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(120, 220, 119, 0.1)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(120, 220, 119, 0.3)',
    padding: 10,
  },
});
