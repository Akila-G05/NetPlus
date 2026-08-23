import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import SettingsRow from '@/components/SettingsRow';
import StatBox from '@/components/StatBox';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ── SimpleSelect dropdown modal helper ───────────────────
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
          style={styles.selectModalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.selectModalContent}>
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

// ── Pulse animation hook ─────────────────────────────────
function usePulse() {
  const anim = React.useRef(new Animated.Value(0.95)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.95,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [anim]);
  return anim;
}

export default function PingingScreen() {
  const pulseScale = usePulse();

  // Ping Configuration State
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [targetConnection, setTargetConnection] = useState('Google DNS — 8.8.8.8');
  const [customHost, setCustomHost] = useState('');
  const [pingDuration, setPingDuration] = useState('Continuous');
  const [pingInterval, setPingInterval] = useState('1000 ms (1s)');

  const targetOptions = [
    'Google DNS — 8.8.8.8',
    'Cloudflare DNS — 1.1.1.1',
    'Quad9 DNS — 9.9.9.9',
    'Local Gateway — 192.168.1.1',
    'Custom Host / IP',
  ];

  const durationOptions = [
    '10 Seconds',
    '30 Seconds',
    '1 Minute',
    '5 Minutes',
    'Continuous',
  ];

  const intervalOptions = [
    '500 ms',
    '1000 ms (1s)',
    '2000 ms (2s)',
    '5000 ms (5s)',
  ];

  return (
    <ScrollView
      style={gs.screenContainer}
      contentContainerStyle={gs.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Connection Status Bar ────────────────────────── */}
      <ConnectionStatusBar />

      {/* ── Main Ping Card ───────────────────────────────── */}
      <View style={styles.pingCard}>
        {/* Radial glow background */}
        <View style={styles.pingGlow} />

        {/* Destination */}
        <TouchableOpacity
          style={styles.destinationWrap}
          disabled={true}
          onPress={() => {
            console.log("Pressed");
          }}
          activeOpacity={0.7}
        >
          <Text style={[gs.labelCaps, styles.destinationLabel]}>Destination</Text>
          <View style={gs.chip}>
            <MaterialIcons name="public" size={14} color={Colors.primary} />
            <Text style={[gs.codeSm, { color: Colors.onSurface }]}>
              {targetConnection === 'Custom Host / IP' && customHost
                ? customHost
                : targetConnection}
            </Text>
            <MaterialIcons name="edit" size={14} color={Colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>

        {/* Ping value with pulse rings */}
        <View style={styles.pingValueWrap}>
          {/* Outer pulse ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingOuter,
              { transform: [{ scale: pulseScale }] },
            ]}
          />
          {/* Inner pulse ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingInner,
              { transform: [{ scale: pulseScale }], opacity: 0.3 },
            ]}
          />

          {/* Value */}
          <View style={styles.pingValueCenter}>
            <Text style={styles.pingNumber}>
              42
              <Text style={styles.pingUnit}>ms</Text>
            </Text>
            <View style={styles.excellentBadge}>
              <Text style={styles.excellentText}>EXCELLENT</Text>
            </View>
          </View>
        </View>

        {/* Start Ping Button */}
        <TouchableOpacity style={gs.btnPrimary} activeOpacity={0.8}>
          <MaterialIcons name="play-arrow" size={24} color={Colors.onPrimary} />
          <Text style={gs.btnPrimaryText}>Start Ping</Text>
        </TouchableOpacity>
      </View>
      
      {/* ── Settings shortcut ────────────────────────────── */}
      <TouchableOpacity
        style={styles.settingsRow}
        activeOpacity={0.7}
        onPress={() => setConfigModalVisible(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="tune" size={18} color={Colors.primary} />
          <Text style={[gs.bodyMd, { color: Colors.onSurface }]}>Target & Time Settings</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>

      {/* ── Statistics Grid ──────────────────────────────── */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatBox label="MIN" value="38" unit="ms" style={styles.statCell} />
          <StatBox label="AVG" value="42" unit="ms" highlighted valueColor={Colors.primary} style={styles.statCell} />
          <StatBox label="MAX" value="85" unit="ms" style={styles.statCell} />
        </View>
        <View style={styles.statsRow}>
          <StatBox label="JITTER" value="2" unit="ms" style={styles.statCell} />
          <StatBox label="LOSS" value="0%" valueColor={Colors.tertiary} style={styles.statCell} />
          <StatBox label="SUCCESS" value="100%" valueColor={Colors.tertiary} style={styles.statCell} />
        </View>
      </View>

      {/* ── Packet Stats ─────────────────────────────────── */}
      <View style={styles.packetRow}>
        <View style={styles.packetStat}>
          <Text style={gs.labelCaps}>SENT </Text>
          <Text style={gs.codeSm}>142</Text>
        </View>
        <View style={styles.packetDivider} />
        <View style={styles.packetStat}>
          <Text style={gs.labelCaps}>RECV </Text>
          <Text style={gs.codeSm}>142</Text>
        </View>
        <View style={styles.packetDivider} />
        <View style={styles.packetStat}>
          <Text style={gs.labelCaps}>FAIL </Text>
          <Text style={[gs.codeSm, { color: Colors.error }]}>0</Text>
        </View>
      </View>

      {/* ── Latency Graph ────────────────────────────────── */}
      {/* <View style={styles.graphCard}>
        <View style={styles.graphHeader}>
          <Text style={gs.labelCaps}>LATENCY (LAST 60S)</Text>
          <View style={styles.graphLegend}>
            <View style={[styles.legendDot, { backgroundColor: Colors.tertiary }]} />
            <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
          </View>
        </View>
        <View style={styles.graphArea}>
          
          {[40, 42, 38, 45, 85, 41, 39, 42].map((val, i) => {
            const isSpike = val > 60;
            return (
              <View
                key={i}
                style={[
                  styles.graphBar,
                  {
                    height: `${val}%`,
                    backgroundColor: isSpike
                      ? 'rgba(255, 167, 38, 0.4)'
                      : 'rgba(173, 198, 255, 0.2)',
                  },
                ]}
              />
            );
          })}


          <View style={[styles.thresholdLine, { bottom: '60%', borderColor: 'rgba(255, 167, 38, 0.3)' }]} />
          <View style={[styles.thresholdLine, { bottom: '80%', borderColor: 'rgba(255, 180, 171, 0.3)' }]} />
        </View>
      </View> */}

      {/* ── Recent Sessions ──────────────────────────────── */}
      {/* <View style={styles.sessionsSection}>
        <Text style={[gs.labelCaps, { marginBottom: 8 }]}>RECENT SESSIONS</Text>
        <TouchableOpacity style={styles.sessionItem} activeOpacity={0.7}>
          <View style={styles.sessionLeft}>
            <View style={styles.sessionIcon}>
              <MaterialIcons name="history" size={22} color={Colors.onSurface} />
            </View>
            <View>
              <Text style={[gs.bodyMd, { fontWeight: '600', color: Colors.onSurface }]}>
                Google DNS
              </Text>
              <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>
                Today, 14:20
              </Text>
            </View>
          </View>
          <View style={styles.sessionRight}>
            <Text style={[gs.codeSm, { color: Colors.primary }]}>Avg: 41ms</Text>
            <View style={styles.sessionLoss}>
              <Text style={gs.labelCaps}>Loss: 0%</Text>
              <View style={[styles.legendDot, { backgroundColor: Colors.tertiary }]} />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sessionItem, { opacity: 0.7 }]} activeOpacity={0.7}>
          <View style={styles.sessionLeft}>
            <View style={styles.sessionIcon}>
              <MaterialIcons name="sports-esports" size={22} color={Colors.onSurface} />
            </View>
            <View>
              <Text style={[gs.bodyMd, { fontWeight: '600', color: Colors.onSurface }]}>
                Game Server
              </Text>
              <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>
                Yesterday, 21:05
              </Text>
            </View>
          </View>
          <View style={styles.sessionRight}>
            <Text style={[gs.codeSm, { color: Colors.warning }]}>Avg: 112ms</Text>
            <View style={styles.sessionLoss}>
              <Text style={gs.labelCaps}>Loss: 2%</Text>
              <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            </View>
          </View>
        </TouchableOpacity>
      </View> */}

      {/* ── Ping Target & Timing Configuration Modal ──────────────── */}
      <Modal
        visible={configModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.configModalOverlay}
          activeOpacity={1}
          onPress={() => setConfigModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.cardModalContainer}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="tune" size={20} color={Colors.primary} />
                  <Text style={styles.cardTitle}>TARGET & TIMING</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setConfigModalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <SettingsRow label="Target Connection">
                <SimpleSelect
                  options={targetOptions}
                  selectedOption={targetConnection}
                  onSelect={setTargetConnection}
                />
              </SettingsRow>

              {targetConnection === 'Custom Host / IP' && (
                <View style={styles.customHostWrap}>
                  <Text style={styles.customHostLabel}>Custom IP or Hostname:</Text>
                  <TextInput
                    style={styles.customHostInput}
                    placeholder="e.g. 192.168.1.50 or example.com"
                    placeholderTextColor={Colors.outline}
                    value={customHost}
                    onChangeText={setCustomHost}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              <SettingsRow label="Ping Interval" bordered>
                <SimpleSelect
                  options={intervalOptions}
                  selectedOption={pingInterval}
                  onSelect={setPingInterval}
                />
              </SettingsRow>

              <TouchableOpacity
                style={[gs.btnPrimary, { marginTop: 16 }]}
                onPress={() => setConfigModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={gs.btnPrimaryText}>Save & Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Ping Card ──────────────────────────────────────────
  pingCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.sectionMargin,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pingGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    backgroundColor: 'transparent',
  },
  destinationWrap: {
    alignItems: 'center',
    marginBottom: Spacing.sectionMargin,
  },
  destinationLabel: {
    marginBottom: 8,
  },

  // ── Pulse value area ───────────────────────────────────
  pingValueWrap: {
    width: 192,
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  pulseRingOuter: {
    width: 192,
    height: 192,
    borderWidth: 2,
    borderColor: Colors.primaryContainer,
    opacity: 0.5,
  },
  pulseRingInner: {
    width: 176,
    height: 176,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pingValueCenter: {
    alignItems: 'center',
  },
  pingNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: Typography.headlineLg.fontFamily,
  },
  pingUnit: {
    fontSize: 24,
    fontWeight: '400',
    color: Colors.onSurfaceVariant,
    marginLeft: 4,
  },
  excellentBadge: {
    backgroundColor: 'rgba(120, 220, 119, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  excellentText: {
    ...Typography.labelCaps,
    fontSize: 10,
    color: Colors.tertiary,
  },

  // ── Stats grid ─────────────────────────────────────────
  statsGrid: {
    gap: Spacing.unit,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.unit,
  },
  statCell: {
    flex: 1,
  },

  // ── Packet row ─────────────────────────────────────────
  packetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  packetStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packetDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.outlineVariant,
  },

  // ── Settings row ───────────────────────────────────────
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },

  // ── Latency Graph ──────────────────────────────────────
  graphCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
    height: 200,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  graphLegend: {
    flexDirection: 'row',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  graphArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    backgroundColor: Colors.surfaceDim,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  graphBar: {
    flex: 1,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  thresholdLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },

  // ── Recent Sessions ────────────────────────────────────
  sessionsSection: {
    gap: 8,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  sessionLoss: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },

  // ── Modal & Select Styles ──────────────────────────────
  cardModalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  configModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 10,
    marginBottom: 8,
  },
  cardTitle: {
    ...Typography.labelCaps,
    color: Colors.onSurface,
  },
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
  selectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectModalContent: {
    width: '80%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    maxHeight: 300,
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
  customHostWrap: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  customHostLabel: {
    ...Typography.codeSm,
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },
  customHostInput: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.onSurface,
    ...Typography.codeSm,
  },
});

