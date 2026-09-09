/**
 * PingLog — Scrollable history console of live ping results.
 * Shows the most recent ping entries with timestamp, host,
 * latency, and OK/FAIL status. Newest entries appear at top.
 */
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

export interface PingLogEntry {
  /** Formatted "HH:MM:SS" timestamp */
  time: string;
  host: string;
  /** Round-trip latency in ms, null when the ping failed */
  latency: number | null;
}

interface PingLogProps {
  entries: PingLogEntry[];
  maxHeight?: number;
}

function formatResult(entry: PingLogEntry): string {
  return entry.latency === null ? 'FAIL' : `${entry.latency} ms`;
}

export default React.memo(function PingLog({ entries, maxHeight = 200 }: PingLogProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="receipt-long" size={14} color={Colors.primary} />
          <Text style={styles.title}>PING LOG</Text>
        </View>
        <Text style={styles.count}>{entries.length}</Text>
      </View>

      <ScrollView
        style={[styles.body, { maxHeight }]}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {entries.length === 0 ? (
          <Text style={styles.empty}>waiting for pings…</Text>
        ) : (
          entries.map((entry, index) => {
            const ok = entry.latency !== null;
            return (
              <View
                key={`${entry.time}-${index}`}
                style={[styles.row, index > 0 && styles.rowBorder]}
              >
                <Text style={styles.time}>{entry.time}</Text>
                <Text style={styles.host} numberOfLines={1}>
                  
                </Text>
                <Text
                  style={[
                    styles.result,
                    { color: ok ? Colors.tertiary : Colors.error },
                  ]}
                >
                  {formatResult(entry)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginTop: Spacing.stackGap,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerPadding,
    paddingVertical: Spacing.unit * 3,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.unit * 2,
  },
  title: {
    ...Typography.labelCaps,
    color: Colors.primary,
  },
  count: {
    ...Typography.codeSm,
    color: Colors.onSurfaceVariant,
  },
  body: {
    paddingHorizontal: Spacing.containerPadding,
  },
  empty: {
    ...Typography.codeSm,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: Spacing.unit * 4,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.unit * 3,
    paddingVertical: Spacing.unit * 2 + 1,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
  },
  time: {
    ...Typography.codeSm,
    color: Colors.onSurfaceVariant,
    fontVariant: ['tabular-nums'],
  },
  host: {
    ...Typography.codeSm,
    color: Colors.onSurface,
    flex: 1,
  },
  result: {
    ...Typography.codeSm,
    fontVariant: ['tabular-nums'],
  },
});