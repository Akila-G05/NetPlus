/**
 * DataCard — Bordered card with label-caps section header.
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';

interface DataCardProps {
  title?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Use the glass card variant */
  glass?: boolean;
}

export default React.memo(function DataCard({
  title,
  icon,
  iconColor = Colors.primary,
  children,
  style,
  glass,
}: DataCardProps) {
  return (
    <View style={[glass ? styles.glassCard : styles.card, style]}>
      {title && (
        <View style={styles.header}>
          {icon && <MaterialIcons name={icon} size={20} color={iconColor} />}
          <Text style={styles.headerText}>{title}</Text>
        </View>
      )}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  glassCard: {
    backgroundColor: 'rgba(20, 27, 38, 0.6)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(31, 41, 55, 0.8)',
    padding: Spacing.containerPadding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  headerText: {
    ...Typography.labelCaps,
    color: Colors.onSurface,
  },
});
