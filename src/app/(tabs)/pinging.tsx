/**
 * Pinging Tab — Main ping diagnostic screen.
 * Faithfully recreates the design from UI/pinging_home/screen.png.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import StatBox from '@/components/StatBox';

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
        <View style={styles.destinationWrap}>
          <Text style={[gs.labelCaps, styles.destinationLabel]}>Destination</Text>
          <View style={gs.chip}>
            <MaterialIcons name="public" size={14} color={Colors.primary} />
            <Text style={[gs.codeSm, { color: Colors.onSurface }]}>
              Google DNS — 8.8.8.8
            </Text>
          </View>
        </View>

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

      {/* ── Settings shortcut ────────────────────────────── */}
      <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7}>
        <Text style={[gs.bodyMd, { color: Colors.onSurface }]}>Settings</Text>
        <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>

      {/* ── Latency Graph ────────────────────────────────── */}
      <View style={styles.graphCard}>
        <View style={styles.graphHeader}>
          <Text style={gs.labelCaps}>LATENCY (LAST 60S)</Text>
          <View style={styles.graphLegend}>
            <View style={[styles.legendDot, { backgroundColor: Colors.tertiary }]} />
            <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
          </View>
        </View>
        <View style={styles.graphArea}>
          {/* Simple bar chart representation */}
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
          {/* Threshold lines */}
          <View style={[styles.thresholdLine, { bottom: '60%', borderColor: 'rgba(255, 167, 38, 0.3)' }]} />
          <View style={[styles.thresholdLine, { bottom: '80%', borderColor: 'rgba(255, 180, 171, 0.3)' }]} />
        </View>
      </View>

      {/* ── Recent Sessions ──────────────────────────────── */}
      <View style={styles.sessionsSection}>
        <Text style={[gs.labelCaps, { marginBottom: 8 }]}>RECENT SESSIONS</Text>

        {/* Session 1 */}
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

        {/* Session 2 */}
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
      </View>
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
    // Simulated radial gradient via a centered colored overlay
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
});
