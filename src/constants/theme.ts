/**
 * NetPlus Design System — Theme Tokens
 *
 * All values sourced from UI/DESIGN.md.
 * "Corporate Modern" dark palette optimised for
 * high-stakes network utility dashboards.
 */

// ─── Colors ──────────────────────────────────────────────
export const Colors = {
  // Surface hierarchy
  surface: '#0d141e',
  surfaceDim: '#0d141e',
  surfaceBright: '#333946',
  surfaceContainerLowest: '#070e19',
  surfaceContainerLow: '#151c27',
  surfaceContainer: '#19202b',
  surfaceContainerHigh: '#232a36',
  surfaceContainerHighest: '#2e3541',

  // On-surface
  onSurface: '#dce3f2',
  onSurfaceVariant: '#c1c6d7',

  // Inverse
  inverseSurface: '#dce3f2',
  inverseOnSurface: '#2a313c',

  // Outline
  outline: '#8b90a0',
  outlineVariant: '#414755',

  // Surface tint
  surfaceTint: '#adc6ff',

  // Primary
  primary: '#adc6ff',
  onPrimary: '#002e69',
  primaryContainer: '#4b8eff',
  onPrimaryContainer: '#00285c',
  inversePrimary: '#005bc1',

  // Secondary
  secondary: '#bdf4ff',
  onSecondary: '#00363d',
  secondaryContainer: '#00e3fd',
  onSecondaryContainer: '#00616d',

  // Tertiary
  tertiary: '#78dc77',
  onTertiary: '#00390a',
  tertiaryContainer: '#41a447',
  onTertiaryContainer: '#003208',

  // Error
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  // Fixed / Dim variants
  primaryFixed: '#d8e2ff',
  primaryFixedDim: '#adc6ff',
  onPrimaryFixed: '#001a41',
  onPrimaryFixedVariant: '#004493',

  secondaryFixed: '#9cf0ff',
  secondaryFixedDim: '#00daf3',
  onSecondaryFixed: '#001f24',
  onSecondaryFixedVariant: '#004f58',

  tertiaryFixed: '#94f990',
  tertiaryFixedDim: '#78dc77',
  onTertiaryFixed: '#002204',
  onTertiaryFixedVariant: '#005313',

  // Background
  background: '#0d141e',
  onBackground: '#dce3f2',

  // Surface variant
  surfaceVariant: '#2e3541',

  // Functional / semantic extras
  warning: '#FFA726', // Amber – not in DESIGN.md tokens but used in graphs
} as const;

export const DarkColors = Colors;
export const LightColors = Colors;


// ─── Typography ──────────────────────────────────────────
export const FontFamily = {
  inter: 'Inter',
  interSemiBold: 'Inter-SemiBold',
  interBold: 'Inter-Bold',
  jetbrainsMono: 'JetBrainsMono',
} as const;

export const Typography = {
  headlineLg: {
    fontFamily: FontFamily.interBold,
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.48, // -0.02em
  },
  headlineMd: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.2, // -0.01em
  },
  bodyLg: {
    fontFamily: FontFamily.inter,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: FontFamily.inter,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  codeLg: {
    fontFamily: FontFamily.jetbrainsMono,
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  codeSm: {
    fontFamily: FontFamily.jetbrainsMono,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  labelCaps: {
    fontFamily: FontFamily.interBold,
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 16,
    letterSpacing: 0.55, // 0.05em
    textTransform: 'uppercase' as const,
  },
} as const;

// ─── Spacing (4px baseline grid) ────────────────────────
export const Spacing = {
  unit: 4,
  containerPadding: 16,
  elementGap: 8,
  stackGap: 12,
  sectionMargin: 24,
} as const;

// ─── Border Radius ──────────────────────────────────────
export const BorderRadius = {
  sm: 4,    // 0.25rem
  default: 8,  // 0.5rem — buttons / inputs
  md: 12,   // 0.75rem
  lg: 16,   // 1rem — cards
  xl: 24,   // 1.5rem
  full: 9999,
} as const;

// ─── Elevation (Tonal Layering) ─────────────────────────
export const Elevation = {
  level0: {
    backgroundColor: '#0A0E14',
  },
  level1: {
    backgroundColor: '#141B26',
    borderColor: '#1F2937',
    borderWidth: 1,
  },
  level2: {
    backgroundColor: '#1C2533',
    shadowColor: '#000000',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
