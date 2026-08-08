/**
 * SettingsRow — Settings row with a label and a right-side control.
 */
import React from 'react';
import { View, Text, Switch, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';

interface SettingsRowProps {
  label: string;
  /** Right-side element — rendered in place of children */
  children?: React.ReactNode;
  /** Show a top border (use for rows after the first) */
  bordered?: boolean;
  style?: ViewStyle;
}

export default function SettingsRow({
  label,
  children,
  bordered,
  style,
}: SettingsRowProps) {
  return (
    <View style={[styles.row, bordered && styles.bordered, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>{children}</View>
    </View>
  );
}

/* ── Toggle shorthand ──────────────────────────────────── */
interface SettingsToggleProps {
  label: string;
  value: boolean;
  onValueChange?: (val: boolean) => void;
  bordered?: boolean;
}

export function SettingsToggle({
  label,
  value,
  onValueChange,
  bordered,
}: SettingsToggleProps) {
  return (
    <SettingsRow label={label} bordered={bordered}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: Colors.surfaceContainerHighest,
          true: Colors.primary,
        }}
        thumbColor="#fff"
      />
    </SettingsRow>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  bordered: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  label: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
