/**
 * Settings Tab — Application preferences, privacy, system diagnostics, and about info.
 * Includes Solarfox developer details, feature descriptions, Privacy Policy, App Rating & Reset.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import SettingsRow, { SettingsToggle } from '@/components/SettingsRow';
import {
  registerBackgroundPingAsync,
  unregisterBackgroundPingAsync,
  isBackgroundPingRegisteredAsync,
  getBackgroundLogsAsync,
  clearBackgroundLogsAsync,
  type BackgroundLogEntry,
} from '@/services/BackgroundTaskService';

interface SimpleSelectProps {
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
}

function SimpleSelect({ options, selectedOption, onSelect }: SimpleSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.selectTrigger}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectTriggerText}>{selectedOption}</Text>
        <MaterialIcons name="arrow-drop-down" size={18} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    item === selectedOption && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      item === selectedOption && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {item === selectedOption && (
                    <MaterialIcons name="check" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function SettingsScreen() {
  // General State — kept for when Theme/Language/Notifications UI is re-enabled
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_theme, _setTheme] = useState('Dark Mode');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_language, _setLanguage] = useState('English (US)');
  const [dataUnits, setDataUnits] = useState('Mbps');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_notifications, _setNotifications] = useState(true);
  const [autoSaveLogs, setAutoSaveLogs] = useState(true);

  // Modals state
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  // Rating State
  const [rating, setRating] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratedSubmitted, setRatedSubmitted] = useState(false);

  // Background Pinging State
  const [bgPingEnabled, setBgPingEnabled] = useState(false);
  const [bgInterval, setBgInterval] = useState('15 Minutes');
  const [bgLogsModalVisible, setBgLogsModalVisible] = useState(false);
  const [bgLogs, setBgLogs] = useState<BackgroundLogEntry[]>([]);

  useEffect(() => {
    isBackgroundPingRegisteredAsync().then(setBgPingEnabled);
  }, []);

  const handleToggleBgPing = async (val: boolean) => {
    setBgPingEnabled(val);
    if (val) {
      const intervalNum = parseInt(bgInterval, 10) || 15;
      const success = await registerBackgroundPingAsync(intervalNum);
      if (success) {
        Alert.alert(
          'Background Monitoring Active',
          `NetPulse will monitor network status & latency in the background every ${intervalNum} minutes.`
        );
      } else {
        setBgPingEnabled(false);
        Alert.alert('Error', 'Could not register background monitoring task.');
      }
    } else {
      await unregisterBackgroundPingAsync();
      Alert.alert(
        'Background Monitoring Stopped',
        'Periodic background ping monitoring is disabled.'
      );
    }
  };

  const handleOpenBgLogs = async () => {
    const logs = await getBackgroundLogsAsync();
    setBgLogs(logs);
    setBgLogsModalVisible(true);
  };

  const handleClearBgLogs = async () => {
    await clearBackgroundLogsAsync();
    setBgLogs([]);
    Alert.alert('Logs Cleared', 'Background diagnostic logs have been reset.');
  };

  // App Reset Handler
  const handleResetApp = () => {
    _setTheme('Dark Mode');
    _setLanguage('English (US)');
    setDataUnits('Mbps');
    _setNotifications(true);
    setAutoSaveLogs(true);
    setResetModalVisible(false);
    Alert.alert('App Reset Complete', 'All settings and local cached diagnostic configurations have been restored to defaults.');
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
      contentContainerStyle={[gs.scrollContent, { paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={gs.headlineLg}>Settings</Text>
        <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 4 }]}>
          Preferences, privacy policy, and application diagnostic overview.
        </Text>
      </View>

      {/* ── GENERAL PREFERENCES CARD ─────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="tune" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>GENERAL PREFERENCES</Text>
        </View>

        {/* <SettingsRow label="Theme">
          <SimpleSelect
            options={['Dark Mode', 'Light Mode', 'System Default']}
            selectedOption={theme}
            onSelect={setTheme}
          />
        </SettingsRow>

        <SettingsRow label="Language" bordered>
          <SimpleSelect
            options={['English (US)', 'Sinhala', 'Spanish', 'French']}
            selectedOption={language}
            onSelect={setLanguage}
          />
        </SettingsRow> */}

        <SettingsRow label="Data Units" bordered>
          <SimpleSelect
            options={['Mbps', 'MB/s', 'Kbps']}
            selectedOption={dataUnits}
            onSelect={setDataUnits}
          />
        </SettingsRow>

        {/* <SettingsToggle
          label="Push Notifications"
          value={notifications}
          onValueChange={setNotifications}
          bordered
        /> */}

        <SettingsToggle
          label="Auto-Save Test Logs"
          value={autoSaveLogs}
          onValueChange={setAutoSaveLogs}
          bordered
        />
      </View>

      {/* ── BACKGROUND EXECUTION & MONITORING CARD ─────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="run-circle" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>BACKGROUND EXECUTION & MONITORING</Text>
        </View>

        <SettingsToggle
          label="Background Ping Monitoring"
          value={bgPingEnabled}
          onValueChange={handleToggleBgPing}
        />

        <SettingsRow label="Monitoring Interval" bordered>
          <SimpleSelect
            options={['15 Minutes', '30 Minutes', '60 Minutes']}
            selectedOption={bgInterval}
            onSelect={(val) => {
              setBgInterval(val);
              if (bgPingEnabled) {
                const intervalNum = parseInt(val, 10) || 15;
                registerBackgroundPingAsync(intervalNum);
              }
            }}
          />
        </SettingsRow>

        <TouchableOpacity
          style={[styles.actionRow, styles.rowBorder]}
          onPress={handleOpenBgLogs}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="history" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>View Background Diagnostic Logs</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* ── PRIVACY & UTILITIES CARD ──────────────────────── */}
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
              Measures real-time network latency, jitter, and packet loss against Sri Lankan ISP servers (Dialog, Hutch, Mobitel/SLT, Airtel) and global DNS endpoints to evaluate instant response times.
            </Text>
          </View>

          {/* Speed Test Description */}
          <View style={[styles.moduleItem, styles.moduleBorder]}>
            <View style={styles.moduleHeader}>
              <MaterialIcons name="speed" size={18} color={Colors.secondaryContainer} />
              <Text style={styles.moduleTitle}>Speed Test</Text>
            </View>
            <Text style={styles.moduleDesc}>
              Evaluates live download & upload bandwidth, throughput stability, and latency under network load with real-time gauge meters and detailed stats graphs.
            </Text>
          </View>

          {/* Tunneling Description */}
          <View style={[styles.moduleItem, styles.moduleBorder]}>
            <View style={styles.moduleHeader}>
              <MaterialIcons name="vpn-key" size={18} color={Colors.tertiary} />
              <Text style={styles.moduleTitle}>Tunneling & Proxy</Text>
            </View>
            <Text style={styles.moduleDesc}>
              Provides encrypted packet routing, proxy metrics, interface state monitoring, and secure tunnel diagnostics for advanced network routing and privacy inspection.
            </Text>
          </View>
        </View>

        {/* Developer & Version Credits */}
        <View style={styles.creditCard}>
          <View style={styles.creditRow}>
            <View style={styles.solarfoxBadge}>
              <MaterialIcons name="bolt" size={16} color={Colors.warning} />
              <Text style={styles.solarfoxText}>Solarfox</Text>
            </View>
            <Text style={styles.developedByLabel}>Developed by Solarfox</Text>
          </View>

          <View style={styles.versionDivider} />

          <View style={styles.creditRow}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionValue}>v1.0.0 (Build 102)</Text>
          </View>
        </View>
      </View>

      {/* ── PRO ACCOUNT BANNER ────────────────────────────── */}
      <View style={[styles.card, styles.proCard]}>
        <View style={styles.proHeader}>
          <MaterialIcons name="workspace-premium" size={22} color={Colors.secondaryContainer} />
          <Text style={styles.proTitle}>NETPULSE PRO</Text>
        </View>
        <Text style={[gs.bodyMd, { color: Colors.onSurface, marginVertical: 12 }]}>
          Unlock advanced route tracing, continuous ping logs, and custom proxy protocol tools.
        </Text>
        <TouchableOpacity
          style={gs.btnPrimary}
          activeOpacity={0.8}
          onPress={() => Alert.alert('NetPulse Pro', 'You are running the full developer edition of NetPulse by Solarfox.')}
        >
          <Text style={gs.btnPrimaryText}>Upgrade to Pro</Text>
        </TouchableOpacity>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                All ping statistics, latency samples, speed test measurements, and tunneling logs generated during diagnostic sessions are stored exclusively in your local device memory and are purged upon app reset.
              </Text>

              <Text style={styles.policyHeading}>3. Network Requests & ICMP/HTTP Pings</Text>
              <Text style={styles.policyText}>
                Ping and speed tests perform standard lightweight HTTP/HEAD requests directly against selected target hosts (such as Sri Lankan ISP gateways or public DNS servers) solely to measure round-trip time and bandwidth.
              </Text>

              <Text style={styles.policyHeading}>4. Developer Commitment</Text>
              <Text style={styles.policyText}>
                Developed by Solarfox, NetPulse is engineered as a clean, transparent network utility designed for high-stakes network performance testing.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[gs.btnPrimary, { marginTop: 16 }]}
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
            <MaterialIcons name="stars" size={40} color={Colors.warning} style={{ alignSelf: 'center' }} />
            <Text style={styles.dialogTitle}>Enjoying NetPulse?</Text>
            <Text style={styles.dialogSub}>
              Tap a star to rate your experience with NetPulse by Solarfox.
            </Text>

            {/* Star Rating Buttons */}
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

            {/* Optional feedback text */}
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
                style={[gs.btnPrimary, { flex: 1, backgroundColor: Colors.surfaceContainerHighest }]}
                onPress={() => setRateModalVisible(false)}
              >
                <Text style={[gs.btnPrimaryText, { color: Colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gs.btnPrimary, { flex: 1 }]}
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
            <MaterialIcons name="warning" size={40} color={Colors.error} style={{ alignSelf: 'center' }} />
            <Text style={styles.dialogTitle}>Reset App Settings?</Text>
            <Text style={styles.dialogSub}>
              This will restore all general preferences, ping options, speed test units, and cached logs to factory default values.
            </Text>

            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={[gs.btnPrimary, { flex: 1, backgroundColor: Colors.surfaceContainerHighest }]}
                onPress={() => setResetModalVisible(false)}
              >
                <Text style={[gs.btnPrimaryText, { color: Colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gs.btnPrimary, { flex: 1, backgroundColor: Colors.error }]}
                onPress={handleResetApp}
              >
                <Text style={[gs.btnPrimaryText, { color: '#ffffff' }]}>Reset All</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                By using NetPulse, you agree to utilize the diagnostic tools (Pinging, Speed Test, and Tunneling) strictly for lawful network assessment and performance monitoring.
              </Text>

              <Text style={styles.policyHeading}>2. Fair Use & Diagnostic Limits</Text>
              <Text style={styles.policyText}>
                NetPulse performs automated network requests against public or specified host targets. Users must refrain from performing Denial of Service (DoS) or flooding requests against unauthorized endpoints.
              </Text>

              <Text style={styles.policyHeading}>3. Disclaimer of Warranty</Text>
              <Text style={styles.policyText}>
                NetPulse is provided {`"as is"`} by Solarfox without warranty of any kind. Latency and bandwidth readings reflect real-time conditions and may vary based on carrier routing and local signal strength.
              </Text>

              <Text style={styles.policyHeading}>4. Credits</Text>
              <Text style={styles.policyText}>
                NetPulse — Designed & Developed by Solarfox. All rights reserved.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[gs.btnPrimary, { marginTop: 16 }]}
              onPress={() => setTermsModalVisible(false)}
            >
              <Text style={gs.btnPrimaryText}>Accept & Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── BACKGROUND DIAGNOSTIC LOGS MODAL ───────────────── */}
      <Modal
        visible={bgLogsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBgLogsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="history" size={22} color={Colors.primary} />
              <Text style={styles.modalTitle}>Background Diagnostic Logs</Text>
            </View>

            {bgLogs.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <MaterialIcons name="event-note" size={40} color={Colors.outline} />
                <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 8 }]}>
                  No background logs recorded yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={bgLogs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
                renderItem={({ item }) => (
                  <View
                    style={{
                      backgroundColor: Colors.surfaceContainerHigh,
                      borderRadius: BorderRadius.default,
                      padding: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View>
                      <Text style={[gs.codeSm, { color: Colors.onSurface }]}>
                        {item.timestamp} • {item.host}
                      </Text>
                      <Text style={[gs.labelCaps, { color: Colors.onSurfaceVariant, marginTop: 2 }]}>
                        {item.networkType} • {item.latencyMs} ms
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 4,
                        backgroundColor:
                          item.status === 'SUCCESS'
                            ? 'rgba(120, 220, 119, 0.15)'
                            : item.status === 'HIGH_LATENCY'
                            ? 'rgba(255, 167, 38, 0.15)'
                            : 'rgba(255, 180, 171, 0.15)',
                      }}
                    >
                      <Text
                        style={[
                          gs.labelCaps,
                          {
                            color:
                              item.status === 'SUCCESS'
                                ? Colors.tertiary
                                : item.status === 'HIGH_LATENCY'
                                ? Colors.warning
                                : Colors.error,
                            fontSize: 10,
                          },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[gs.btnSecondary, { flex: 1 }]}
                onPress={handleClearBgLogs}
              >
                <Text style={gs.btnSecondaryText}>Clear Logs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[gs.btnPrimary, { flex: 1 }]}
                onPress={() => setBgLogsModalVisible(false)}
              >
                <Text style={gs.btnPrimaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 10,
    marginBottom: 8,
  },
  cardTitle: {
    ...Typography.labelCaps,
    color: Colors.onSurface,
    letterSpacing: 1,
  },

  // Select Trigger
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  selectTriggerText: {
    ...Typography.codeSm,
    color: Colors.onSurface,
  },

  // Action Rows
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },

  // About Module Descriptions
  aboutModuleBox: {
    marginVertical: 4,
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
    fontWeight: '700',
    color: Colors.onSurface,
  },
  moduleDesc: {
    ...Typography.bodyMd,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.onSurfaceVariant,
  },

  // Credit & Version Card
  creditCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 12,
    marginTop: 12,
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
    backgroundColor: 'rgba(255, 167, 38, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  solarfoxText: {
    ...Typography.labelCaps,
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '800',
  },
  developedByLabel: {
    ...Typography.bodyMd,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  versionDivider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: 10,
  },
  versionLabel: {
    ...Typography.codeSm,
    color: Colors.onSurfaceVariant,
  },
  versionValue: {
    ...Typography.codeSm,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Pro Card
  proCard: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderColor: Colors.outlineVariant,
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proTitle: {
    ...Typography.labelCaps,
    color: Colors.secondaryContainer,
  },

  // Modal Overlay & Select Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    maxHeight: 320,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalOptionSelected: {
    backgroundColor: Colors.surfaceBright,
  },
  modalOptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  modalOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
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

  // Dialogs (Rate App & App Reset)
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
