/**
 * StatBox — Small stat cell showing a label and monospace value.
 * Used in the Pinging stats grid.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';

interface StatBoxProps {
  label: string;
  value: string;
  unit?: string;
  valueColor?: string;
  /** Highlight with a primary bottom border */
  highlighted?: boolean;
  style?: ViewStyle;
}

export default React.memo(function StatBox({
  label,
  value,
  unit,
  valueColor = Colors.onSurface,
  highlighted,
  style,
}: StatBoxProps) {
  return (
    <View
      style={[
        styles.container,
        highlighted && styles.highlighted,
        style,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>
        {value}
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.stackGap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlighted: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  label: {
    ...Typography.labelCaps,
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  value: {
    ...Typography.codeLg,
    color: Colors.onSurface,
  },
  unit: {
    ...Typography.codeSm,
    fontSize: 10,
    color: Colors.onSurfaceVariant,
  },
});
