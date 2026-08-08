/**
 * Network Tab — Dashboard showing connection overview,
 * speed test card, quality score, and data usage.
 * Recreates UI/network_dashboard/screen.png.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import DataCard from '@/components/DataCard';
import CircularProgress from '@/components/CircularProgress';

export default function NetworkScreen() {
  return (
    <ScrollView
      style={gs.screenContainer}
      contentContainerStyle={gs.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Connection Overview Card ─────────────────────── */}
      <View style={styles.connectionCard}>
        {/* Header */}
        <View style={styles.connectionHeader}>
          <View style={styles.connectionLeft}>
            <View style={styles.connectionIconWrap}>
              <MaterialIcons name="cell-tower" size={24} color={Colors.onSecondaryContainer} />
            </View>
            <View>
              <Text style={gs.headlineMd}>Verizon 5G UWB</Text>
              <View style={styles.activeRow}>
                <View style={[gs.statusDot, { backgroundColor: Colors.tertiary }]} />
                <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant }]}>
                  Active Connection
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.signalWrap}>
            <Text style={[gs.codeLg, { color: Colors.secondaryContainer }]}>-85 dBm</Text>
            <Text style={[gs.labelCaps, { color: Colors.outline }]}>Signal Strength</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={gs.divider} />

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <MetricItem label="Local IP" value="192.168.1.142" />
          <MetricItem label="Public IP" value="174.203.8.44" />
          <MetricItem label="Gateway" value="192.168.1.1" />
          <MetricItem label="DNS" value="1.1.1.1, 8.8.8.8" />
        </View>

        {/* Activity Graph */}
        <View style={styles.activityGraph}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.sparklineSvg}>
            <Path
              d="M0,100 L0,80 Q10,70 20,85 T40,60 T60,75 T80,40 T100,50 L100,100 Z"
              fill={Colors.secondary}
              opacity={0.15}
            />
          </Svg>
          <View style={styles.activityOverlay}>
            <View style={styles.activityStat}>
              <MaterialIcons name="arrow-downward" size={14} color={Colors.tertiary} />
              <Text style={[gs.labelCaps, { color: Colors.tertiary }]}>24.5 Mbps</Text>
            </View>
            <View style={styles.activityStat}>
              <Text style={[gs.labelCaps, { color: Colors.primary }]}>8.2 Mbps</Text>
              <MaterialIcons name="arrow-upward" size={14} color={Colors.primary} />
            </View>
          </View>
        </View>
      </View>

      {/* ── Speed Test Card ──────────────────────────────── */}
      <View style={styles.speedTestCard}>
        {/* Decorative glows */}
        <View style={[styles.decorGlow, styles.decorGlowTopRight]} />
        <View style={[styles.decorGlow, styles.decorGlowBottomLeft]} />

        <Text style={[gs.labelCaps, { color: Colors.outline, marginBottom: 20 }]}>
          Speed Test
        </Text>

        <TouchableOpacity style={styles.goButton} activeOpacity={0.85}>
          <Text style={styles.goText}>GO</Text>
        </TouchableOpacity>

        <View style={styles.serverInfo}>
          <Text style={[gs.labelCaps, { color: Colors.onSurfaceVariant }]}>
            Server: NY, USA (Optimal)
          </Text>
          <TouchableOpacity>
            <Text style={[gs.labelCaps, { color: Colors.primary, marginTop: 4 }]}>
              Change Server
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Network Quality Card ─────────────────────────── */}
      <DataCard title="Network Quality" icon="network-check" glass>
        <View style={styles.qualityContent}>
          <CircularProgress
            progress={92}
            size={80}
            strokeWidth={6}
            color={Colors.tertiary}
            subLabel="SCORE"
          />
          <View style={styles.qualityMetrics}>
            <QualityRow label="Avg Ping" value="14 ms" color={Colors.secondaryContainer} />
            <QualityRow label="Jitter" value="2 ms" color={Colors.tertiary} bordered />
            <QualityRow label="Loss" value="0.0%" color={Colors.onSurface} bordered />
          </View>
        </View>
      </DataCard>

      {/* ── Data Usage Card ──────────────────────────────── */}
      <DataCard glass>
        <View style={styles.dataUsageHeader}>
          <Text style={[gs.labelCaps, { color: Colors.outline }]}>
            Data Usage (Billing Cycle)
          </Text>
          <View style={styles.daysLeftBadge}>
            <Text style={[gs.labelCaps, { color: Colors.onSurface }]}>5 Days Left</Text>
          </View>
        </View>

        <View style={styles.dataUsageContent}>
          <CircularProgress
            progress={75}
            size={80}
            strokeWidth={8}
            color={Colors.primary}
            displayValue="75%"
          />
          <View style={styles.dataUsageText}>
            <Text style={gs.headlineMd}>
              37.5 GB{' '}
              <Text style={[gs.bodyMd, { color: Colors.outline, fontWeight: '400' }]}>/ 50 GB</Text>
            </Text>
            <Text style={[gs.labelCaps, { color: Colors.onSurfaceVariant }]}>
              12.5 GB Remaining
            </Text>
          </View>
        </View>

        {/* 7-Day Bar Chart */}
        <View style={styles.weekChart}>
          {[40, 60, 30, 80, 50, 90, 100].map((pct, i) => (
            <View key={i} style={styles.weekBarWrap}>
              <View
                style={[
                  styles.weekBar,
                  {
                    height: `${pct}%`,
                    backgroundColor: i === 6 ? Colors.primary : Colors.surfaceContainerHigh,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.weekLabels}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text
              key={i}
              style={[
                styles.weekLabel,
                i === 6 && { color: Colors.primary },
              ]}
            >
              {d}
            </Text>
          ))}
        </View>
      </DataCard>
    </ScrollView>
  );
}

// ── Helper subcomponents ─────────────────────────────────

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={[gs.labelCaps, { color: Colors.outline, marginBottom: 2 }]}>{label}</Text>
      <Text style={gs.codeSm}>{value}</Text>
    </View>
  );
}

function QualityRow({
  label,
  value,
  color,
  bordered,
}: {
  label: string;
  value: string;
  color: string;
  bordered?: boolean;
}) {
  return (
    <View
      style={[
        styles.qualityRow,
        bordered && { borderTopWidth: 1, borderTopColor: Colors.surfaceContainerHigh },
      ]}
    >
      <Text style={[gs.labelCaps, { color: Colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[gs.codeLg, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Connection Card ────────────────────────────────────
  connectionCard: {
    backgroundColor: 'rgba(20, 27, 38, 0.6)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(31, 41, 55, 0.8)',
    padding: Spacing.containerPadding,
    gap: Spacing.stackGap,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: Spacing.stackGap,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  connectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionIconWrap: {
    backgroundColor: Colors.secondaryContainer,
    padding: 8,
    borderRadius: BorderRadius.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  signalWrap: {
    alignItems: 'flex-end',
  },

  // ── Metrics Grid ───────────────────────────────────────
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricItem: {
    width: '45%',
  },

  // ── Activity Graph ─────────────────────────────────────
  activityGraph: {
    height: 96,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    overflow: 'hidden',
    marginTop: 4,
  },
  sparklineSvg: {
    position: 'absolute',
    bottom: 0,
  },
  activityOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  activityStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // ── Speed Test Card ────────────────────────────────────
  speedTestCard: {
    backgroundColor: 'rgba(20, 27, 38, 0.6)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(31, 41, 55, 0.8)',
    padding: Spacing.containerPadding,
    alignItems: 'center',
    minHeight: 300,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  decorGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.1,
  },
  decorGlowTopRight: {
    top: -40,
    right: -40,
    backgroundColor: Colors.primary,
  },
  decorGlowBottomLeft: {
    bottom: -40,
    left: -40,
    backgroundColor: Colors.secondaryContainer,
  },
  goButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sectionMargin,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  goText: {
    ...Typography.headlineLg,
    color: Colors.onPrimary,
  },
  serverInfo: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    paddingTop: Spacing.containerPadding,
    alignItems: 'center',
    width: '100%',
  },

  // ── Network Quality ────────────────────────────────────
  qualityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sectionMargin,
    marginTop: 8,
  },
  qualityMetrics: {
    flex: 1,
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },

  // ── Data Usage ─────────────────────────────────────────
  dataUsageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.containerPadding,
  },
  daysLeftBadge: {
    backgroundColor: Colors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  dataUsageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sectionMargin,
    marginBottom: Spacing.containerPadding,
  },
  dataUsageText: {
    flex: 1,
  },

  // ── Week Chart ─────────────────────────────────────────
  weekChart: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 8,
  },
  weekBarWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  weekBar: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  weekLabel: {
    ...Typography.codeSm,
    fontSize: 10,
    color: Colors.outline,
    flex: 1,
    textAlign: 'center',
  },
});
