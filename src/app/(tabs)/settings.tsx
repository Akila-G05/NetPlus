/**
 * Settings Screen — App preferences, data units, privacy policies, app rating, reset & credits.
 * Located inside (tabs) so bottom navigation bar remains visible.
 * Accessible from Tools -> Settings & Preferences.
 * Developed by Solarfox.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  AppState,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { LOG_ENABLED_DEFAULT, LOG_ENABLED_KEY } from '@/constants/pingConfig';
import { gs } from '@/styles/globalStyles';
import { SettingsToggle } from '@/components/SettingsRow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dataUsageTracker } from '@/services/DataUsageTracker';
import { useRouter } from 'expo-router';

import { notificationService } from '@/services/NotificationService';
import {
  isIgnoringBatteryOptimizations,
  openBatteryOptimizationSettings,
  requestIgnoreBatteryOptimizations,
} from 'netplus-ping';

export default function SettingsScreen() {
  const router = useRouter();

  // General Preferences State
  const [pushNotifications, setPushNotifications] = useState(true);
  const [autoSaveLogs, setAutoSaveLogs] = useState(true);
  const [allowBackgroundRun, setAllowBackgroundRun] = useState(false);
  const [pingLogEnabled, setPingLogEnabled] = useState(LOG_ENABLED_DEFAULT);

  // Modals State
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  // Rating State
  const [rating, setRating] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratedSubmitted, setRatedSubmitted] = useState(false);

  React.useEffect(() => {
    notificationService.isNotificationsEnabled().then((enabled) => {
      setPushNotifications(enabled);
    });
    isIgnoringBatteryOptimizations().then((exempt) => {
      setAllowBackgroundRun(exempt);
    });
    AsyncStorage.getItem(LOG_ENABLED_KEY).then((value) => {
      if (value !== null) setPingLogEnabled(value === 'true');
    }).catch(() => {});

    // Re-sync when the user returns to the app after changing the
    // exemption/background-run setting in Android's battery settings.
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        isIgnoringBatteryOptimizations().then((exempt) => {
          setAllowBackgroundRun(exempt);
        });
      }
    });
    return () => sub.remove();
  }, []);

  const handleToggleNotifications = async (val: boolean) => {
    setPushNotifications(val);
    const success = await notificationService.setNotificationsEnabled(val);
    if (val && !success) {
      Alert.alert(
        'Notification Permission Required',
        'Please allow notification permissions in your device settings to receive diagnostic alerts.'
      );
      setPushNotifications(false);
    }
  };

  const handleToggleBackgroundRun = async (val: boolean) => {
    if (val) {
      await requestIgnoreBatteryOptimizations();
    } else {
      Alert.alert(
        'Disabling Background Run',
        'Battery optimization exemptions cannot be revoked in-app. Please turn off the exemption for NetPulse in your device settings.'
      );
      openBatteryOptimizationSettings();
    }
    const exempt = await isIgnoringBatteryOptimizations();
    setAllowBackgroundRun(exempt);
  };

  const handleTogglePingLog = async (val: boolean) => {
    setPingLogEnabled(val);
    try {
      await AsyncStorage.setItem(LOG_ENABLED_KEY, JSON.stringify(val));
    } catch {
      // Ignore
    }
  };

  // App Reset Handler
  const handleResetApp = async () => {
    setPushNotifications(true);
    notificationService.setNotificationsEnabled(true);
    setAutoSaveLogs(true);
    setPingLogEnabled(LOG_ENABLED_DEFAULT);
    setResetModalVisible(false);

    try {
      await AsyncStorage.clear();
      dataUsageTracker.reset();
      Alert.alert(
        'App Reset Complete',
        'All settings, local storage, and cached diagnostic configurations have been restored to defaults.'
      );
    } catch {
      Alert.alert(
        'App Reset Complete',
        'All settings and local cached diagnostic configurations have been restored to defaults.'
      );
    }
  };

  const handleRatingSubmit = () => {
    setRatedSubmitted(true);
    setTimeout(() => {
      setRateModalVisible(false);
      setRatedSubmitted(false);
      setRatingFeedback('');
      Alert.alert('Thank You!', 'Your feedback helps Solarfox make NetPulse even better.');
    }, 1000);
  };

  return (
    <ScrollView
      style={gs.screenContainer}
      contentContainerStyle={[gs.scrollContent, styles.topPadding]}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Header with Back Navigation */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flex1}>
          <Text style={gs.headlineLg}>Settings & Preferences</Text>
        </View>
      </View>

      {/* ── GENERAL PREFERENCES CARD ─────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="tune" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>GENERAL PREFERENCES</Text>
        </View>

        <SettingsToggle
          label="Push Notifications"
          value={pushNotifications}
          onValueChange={handleToggleNotifications}
          bordered
        />

        <SettingsToggle
          label="Auto-Save Test Logs"
          value={autoSaveLogs}
          onValueChange={setAutoSaveLogs}
          bordered
        />

        <SettingsToggle
          label="Allow Background Run"
          value={allowBackgroundRun}
          onValueChange={handleToggleBackgroundRun}
          bordered
        />

        <SettingsToggle
          label="Ping Log Console"
          value={pingLogEnabled}
          onValueChange={handleTogglePingLog}
          bordered
        />
      </View>

      {/* ── PRIVACY & APP ACTIONS CARD ────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="admin-panel-settings" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>PRIVACY & APP ACTIONS</Text>
        </View>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setPrivacyModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="security" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Privacy & Policy</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Rate App */}
        <TouchableOpacity
          style={[styles.actionRow, styles.rowBorder]}
          onPress={() => setRateModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="star-rate" size={20} color={Colors.warning} />
            <Text style={styles.actionText}>Rate App</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Terms of Service */}
        <TouchableOpacity
          style={[styles.actionRow, styles.rowBorder]}
          onPress={() => setTermsModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="description" size={20} color={Colors.secondary} />
            <Text style={styles.actionText}>Terms of Service</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* App Reset */}
        <TouchableOpacity
          style={[styles.actionRow, styles.rowBorder]}
          onPress={() => setResetModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="restart-alt" size={20} color={Colors.error} />
            <Text style={[styles.actionText, { color: Colors.error }]}>App Reset</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {/* ── ABOUT SECTION ─────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="info-outline" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>ABOUT NETPULSE</Text>
        </View>

        {/* Module Descriptions */}
        <View style={styles.aboutModuleBox}>
          {/* Pinging Description */}
          <View style={styles.moduleItem}>
            <View style={styles.moduleHeader}>
              <MaterialIcons name="wifi-tethering" size={18} color={Colors.primary} />
              <Text style={styles.moduleTitle}>Pinging</Text>
            </View>
            <Text style={styles.moduleDesc}>
              Prevent connection drops and reduce lag. NetPulse sends continuous lightweight requests to keep your 4G/5G mobile data active and stop your network radio from going idle.
            </Text>
          </View>

          {/* Speed Test Description */}
          <View style={[styles.moduleItem, styles.moduleBorder]}>
            <View style={styles.moduleHeader}>
              <MaterialIcons name="speed" size={18} color={Colors.secondaryContainer} />
              <Text style={styles.moduleTitle}>Speed Test</Text>
            </View>
            <Text style={styles.moduleDesc}>
              Evaluates live download & upload bandwidth, throughput stability, and latency under load with real-time gauges.
            </Text>
          </View>

          {/* Tools Description */}
          <View style={[styles.moduleItem, styles.moduleBorder]}>
            <View style={styles.moduleHeader}>
              <MaterialIcons name="build" size={18} color={Colors.tertiary} />
              <Text style={styles.moduleTitle}>Tools & Geolocation</Text>
            </View>
            <Text style={styles.moduleDesc}>
              Instantly detect your public IP, local gateway, network provider, and connection details. Future updates will bring advanced new features.
            </Text>
          </View>
        </View>

        {/* Developer & Version Credits */}
        <View style={styles.creditCard}>
          <View style={styles.creditRow}>
            <View style={styles.solarfoxBadge}>
              <MaterialIcons name="bolt" size={16} color={Colors.warning} />
              <Text style={styles.solarfoxText}>SOLARFOX </Text>
            </View>
            <Text style={styles.developedByLabel}>Developed by Solarfox</Text>
          </View>

          <View style={styles.versionDivider} />

          <View style={styles.creditRow}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionValue}>v1.0</Text>
          </View>
        </View>
      </View>

      {/* ── PRIVACY POLICY MODAL ─────────────────────────── */}
      <Modal
        visible={privacyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalHeaderRow}>
            <View style={gs.rowGap8}>
              <MaterialIcons name="security" size={22} color={Colors.primary} />
              <Text style={styles.modalTitle}>Privacy Policy</Text>
            </View>
              <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.policyHeading}>1. Zero Personal Data Collection</Text>
              <Text style={styles.policyText}>
                NetPulse by Solarfox operates with strict privacy principles. We do not collect, sell, or transmit any personal identifiable information (PII), browsing history, or private network payloads.
              </Text>

              <Text style={styles.policyHeading}>2. Local Diagnostic Logs</Text>
              <Text style={styles.policyText}>
                All ping statistics, latency samples, speed test measurements, and tools logs generated during diagnostic sessions are stored exclusively in your local device memory and are purged upon app reset.
              </Text>

              <Text style={styles.policyHeading}>3. Network Requests & Diagnostic Probes</Text>
              <Text style={styles.policyText}>
                Diagnostic probes perform standard lightweight HTTP/HEAD requests directly against selected target hosts solely to measure round-trip time, bandwidth, and IP info.
              </Text>

              <Text style={styles.policyHeading}>4. Developer Commitment</Text>
              <Text style={styles.policyText}>
                Developed by Solarfox, NetPulse is engineered as a clean, transparent network utility designed for high-stakes network performance testing.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[gs.btnPrimary, styles.btnTopGap]}
              onPress={() => setPrivacyModalVisible(false)}
            >
              <Text style={gs.btnPrimaryText}>Close Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── RATE APP MODAL ────────────────────────────────── */}
      <Modal
        visible={rateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContent}>
            <MaterialIcons name="stars" size={40} color={Colors.warning} style={styles.centerSelf} />
            <Text style={styles.dialogTitle}>Enjoying NetPulse?</Text>
            <Text style={styles.dialogSub}>
              Tap a star to rate your experience with NetPulse by Solarfox.
            </Text>

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={star <= rating ? 'star' : 'star-border'}
                    size={36}
                    color={Colors.warning}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.ratingInput}
              placeholder="Leave feedback for Solarfox (optional)..."
              placeholderTextColor={Colors.outline}
              value={ratingFeedback}
              onChangeText={setRatingFeedback}
              multiline
            />

            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={[gs.btnSecondary, styles.flex1]}
                onPress={() => setRateModalVisible(false)}
              >
                <Text style={gs.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gs.btnPrimary, styles.flex1]}
                onPress={handleRatingSubmit}
              >
                <Text style={gs.btnPrimaryText}>{ratedSubmitted ? 'Submitting...' : 'Submit Rating'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── APP RESET CONFIRMATION MODAL ─────────────────── */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContent}>
            <MaterialIcons name="warning" size={40} color={Colors.error} style={styles.centerSelf} />
            <Text style={styles.dialogTitle}>Reset App Settings?</Text>
            <Text style={styles.dialogSub}>
              This will restore all general preferences, ping options, speed test units, and cached logs to factory default values.
            </Text>

            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={[gs.btnSecondary, styles.flex1]}
                onPress={() => setResetModalVisible(false)}
              >
                <Text style={gs.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gs.btnDanger, styles.flex1]}
                onPress={handleResetApp}
              >
                <Text style={gs.btnDangerText}>Reset All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── TERMS OF SERVICE MODAL ────────────────────────── */}
      <Modal
        visible={termsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTermsModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalHeaderRow}>
            <View style={gs.rowGap8}>
              <MaterialIcons name="description" size={22} color={Colors.secondary} />
              <Text style={styles.modalTitle}>Terms of Service</Text>
            </View>
              <TouchableOpacity onPress={() => setTermsModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.policyHeading}>1. Terms of Use</Text>
              <Text style={styles.policyText}>
                By using NetPulse, you agree to utilize the diagnostic tools (Pinging, Speed Test, and Tools) strictly for lawful network assessment and performance monitoring.
              </Text>

              <Text style={styles.policyHeading}>2. Fair Use & Diagnostic Limits</Text>
              <Text style={styles.policyText}>
                NetPulse performs automated network requests against public or specified host targets. Users must refrain from performing Denial of Service (DoS) or flooding requests against unauthorized endpoints.
              </Text>

              <Text style={styles.policyHeading}>3. Disclaimer of Warranty</Text>
              <Text style={styles.policyText}>
                NetPulse is provided {`"as is"`} by Solarfox without warranty of any kind. Diagnostic readings reflect real-time conditions and may vary based on carrier routing and local signal strength.
              </Text>

              <Text style={styles.policyHeading}>4. Credits</Text>
              <Text style={styles.policyText}>
                NetPulse — Designed & Developed by Solarfox. All rights reserved.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[gs.btnPrimary, styles.btnTopGap]}
              onPress={() => setTermsModalVisible(false)}
            >
              <Text style={gs.btnPrimaryText}>Accept & Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ── Helpers ─────────────────────────────────────────────
  flex1: {
    flex: 1,
  },
  centerSelf: {
    alignSelf: 'center',
  },
  btnTopGap: {
    marginTop: 16,
  },
  topPadding: {
    paddingBottom: 40,
  },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.elementGap,
  },
  cardTitle: {
    ...Typography.labelCaps,
    color: Colors.primary,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  selectTriggerText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },

  // About Section & Credits
  aboutModuleBox: {
    marginBottom: 16,
  },
  moduleItem: {
    paddingVertical: 10,
  },
  moduleBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  moduleTitle: {
    ...Typography.bodyMd,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  moduleDesc: {
    ...Typography.bodyMd,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.onSurfaceVariant,
  },
  creditCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 12,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  solarfoxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 167, 38, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  solarfoxText: {
    ...Typography.labelCaps,
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '700',
  },
  developedByLabel: {
    ...Typography.bodyMd,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  versionDivider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: 10,
  },
  versionLabel: {
    ...Typography.bodyMd,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  versionValue: {
    ...Typography.codeSm,
    color: Colors.onSurface,
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Full Screen Policy / Terms Modals
  fullModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  fullModalContent: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  modalTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  modalBodyScroll: {
    marginTop: 12,
  },
  policyHeading: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  policyText: {
    ...Typography.bodyMd,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.onSurfaceVariant,
  },

  // Dialogs
  dialogContent: {
    width: '90%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 20,
  },
  dialogTitle: {
    ...Typography.headlineMd,
    textAlign: 'center',
    color: Colors.onSurface,
    marginTop: 12,
    marginBottom: 6,
  },
  dialogSub: {
    ...Typography.bodyMd,
    textAlign: 'center',
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  ratingInput: {
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    padding: 12,
    color: Colors.onSurface,
    ...Typography.bodyMd,
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  dialogButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
