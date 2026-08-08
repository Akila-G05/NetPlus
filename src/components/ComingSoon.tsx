/**
 * ComingSoon — Placeholder screen for tabs without designs yet.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';

interface ComingSoonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
}

export default function ComingSoon({ icon, title, description }: ComingSoonProps) {
  return (
    <View style={[gs.screenContainer, gs.centerContent]}>
      {/* Decorative glow */}
      <View style={styles.glowOuter}>
        <View style={styles.glowInner}>
          <MaterialIcons name={icon} size={48} color={Colors.primary} />
        </View>
      </View>

      <Text style={[gs.headlineLg, styles.title]}>{title}</Text>

      <View style={styles.badge}>
        <View style={[gs.statusDot, { backgroundColor: Colors.secondaryContainer }]} />
        <Text style={[gs.labelCaps, { color: Colors.secondaryContainer }]}>
          Coming Soon
        </Text>
      </View>

      {description && (
        <Text style={styles.description}>{description}</Text>
      )}

      {/* Decorative bottom element */}
      <View style={styles.decorBar}>
        <View style={styles.decorSegment} />
        <View style={[styles.decorSegment, { backgroundColor: Colors.primary, opacity: 0.4 }]} />
        <View style={styles.decorSegment} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glowOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(75, 142, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sectionMargin,
  },
  glowInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(75, 142, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.2)',
  },
  title: {
    color: Colors.onSurface,
    marginBottom: Spacing.stackGap,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    marginBottom: Spacing.sectionMargin,
  },
  description: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 48,
    lineHeight: 22,
  },
  decorBar: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 48,
  },
  decorSegment: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    opacity: 0.5,
  },
});
