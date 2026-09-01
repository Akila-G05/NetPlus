/**
 * NetPlus — Global StyleSheet
 *
 * Reusable style compositions built on top of the theme tokens.
 * Import `gs` (global styles) wherever you need shared styles.
 */
import { StyleSheet } from 'react-native';
import { Colors, FontFamily, Typography, Spacing, BorderRadius, Elevation } from '@/constants/theme';

export const gs = StyleSheet.create({
  // ── Screen / Layout ─────────────────────────────────────
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.containerPadding,
    paddingBottom: 100, // room above bottom nav
    gap: Spacing.sectionMargin,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowGap4: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  rowGap6: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  rowGap8: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  column: {
    flexDirection: 'column',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Text Styles ─────────────────────────────────────────
  headlineLg: {
    ...Typography.headlineLg,
    color: Colors.onSurface,
  },
  headlineMd: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  bodyLg: {
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  bodyMd: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  codeLg: {
    ...Typography.codeLg,
    color: Colors.onSurface,
  },
  codeSm: {
    ...Typography.codeSm,
    color: Colors.onSurface,
  },
  labelCaps: {
    ...Typography.labelCaps,
    color: Colors.onSurfaceVariant,
  },

  // ── Cards ───────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  cardSurface: {
    ...Elevation.level1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.containerPadding,
  },
  glassCard: {
    backgroundColor: 'rgba(20, 27, 38, 0.6)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(31, 41, 55, 0.8)',
    padding: Spacing.containerPadding,
  },

  // ── Buttons ─────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: Spacing.elementGap,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  btnPrimaryText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.onPrimary,
    textAlign: 'center' as const,
  },
  btnSecondary: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: Spacing.elementGap,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  btnSecondaryText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.onSurface,
    textAlign: 'center' as const,
  },
  btnDanger: {
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: Spacing.elementGap,
  },
  btnDangerText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ffffff',
    textAlign: 'center' as const,
  },

  // ── Status ──────────────────────────────────────────────
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGlow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.tertiary,
    shadowColor: Colors.tertiary,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },

  // ── Inputs ──────────────────────────────────────────────
  input: {
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...Typography.codeSm,
    color: Colors.onSurface,
  },

  // ── Divider ─────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
  },

  // ── Chip ────────────────────────────────────────────────
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
});
