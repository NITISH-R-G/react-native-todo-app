/**
 * Central design tokens (Material 3 Expressive direction).
 *
 * Provenance of values:
 *  - SAMPLED: pixel-sampled from the reference APK screenshots (docs/evidence/reference-apk).
 *  - DERIVED: standard Material 3 tonal-palette roles for the same blue seed; not seen in the reference.
 *  - DECISION: chosen for this implementation; the reference does not establish them.
 * See docs/design-system.md for the table.
 */

export interface ColorRoles {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainer: string; // cards, form groups
  surfaceContainerHigh: string; // nav bar
  outline: string;
  outlineVariant: string;
  inverseSurface: string; // snackbar
  inverseOnSurface: string;
  scrim: string;
  // Semantic priority accents (DECISION except high = SAMPLED stripe colour).
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
}

export const lightColors: ColorRoles = {
  primary: '#0061A4', // SAMPLED (FAB, Next button)
  onPrimary: '#FFFFFF',
  primaryContainer: '#D1E4FF', // SAMPLED
  onPrimaryContainer: '#001D36',
  secondary: '#535F70',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D7E3F7', // SAMPLED (nav pill, selected segment)
  onSecondaryContainer: '#101C2B',
  tertiary: '#6B5778',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F2DAFF',
  onTertiaryContainer: '#251431',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  background: '#F8F9FF', // SAMPLED (content sheet)
  onBackground: '#191C20',
  surface: '#F8F9FF',
  onSurface: '#191C20',
  surfaceVariant: '#DFE2EB', // SAMPLED (progress track)
  onSurfaceVariant: '#43474E',
  surfaceContainer: '#E6EEF9', // SAMPLED (task card / form container ~#E4ECF8)
  surfaceContainerHigh: '#E5ECF4', // SAMPLED (bottom bar)
  outline: '#73777F',
  outlineVariant: '#C3C7CF',
  inverseSurface: '#322F35', // SAMPLED (snackbar)
  inverseOnSurface: '#F5EFF7',
  scrim: '#000000',
  priorityHigh: '#E53935', // SAMPLED (card stripe)
  priorityMedium: '#B45F06', // DECISION: amber-brown, >=3:1 on cards (reference orange #F57C00 was only 2.3:1)
  priorityLow: '#2E7D32', // DECISION
};

export const darkColors: ColorRoles = {
  primary: '#9FCAFF', // DERIVED
  onPrimary: '#003258',
  primaryContainer: '#00497D',
  onPrimaryContainer: '#D1E4FF',
  secondary: '#BBC7DB',
  onSecondary: '#253140',
  secondaryContainer: '#3B4858',
  onSecondaryContainer: '#D7E3F7',
  tertiary: '#D7BEE4',
  onTertiary: '#3B2948',
  tertiaryContainer: '#523F5F',
  onTertiaryContainer: '#F2DAFF',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#101418',
  onBackground: '#E0E2E8',
  surface: '#101418',
  onSurface: '#E0E2E8',
  surfaceVariant: '#43474E',
  onSurfaceVariant: '#C3C7CF',
  surfaceContainer: '#1C2024',
  surfaceContainerHigh: '#262A2F',
  outline: '#8D9199',
  outlineVariant: '#43474E',
  inverseSurface: '#E0E2E8',
  inverseOnSurface: '#2E3135',
  scrim: '#000000',
  priorityHigh: '#FF6B66',
  priorityMedium: '#FFB74D',
  priorityLow: '#81C784',
};

/** Corner radii (dp). Expressive favours large, varied radii. All DECISION values. */
export const shape = {
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28, // cards, text-field containers
  sheet: 32, // content sheet top corners
  full: 999, // pills / chips / buttons
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Minimum interactive size per Material / Android accessibility guidance. */
export const touchTarget = 48;

/** Motion (DECISION): short, ease-out; Expressive uses spring-like overshoot sparingly. */
export const motion = {
  fast: 150,
  standard: 250,
  emphasized: 400,
} as const;

/** Type scale; sizes follow the Material 3 type scale, weights are DECISION (bold display titles). */
export const typography = {
  displayTitle: { fontSize: 36, lineHeight: 44, fontWeight: '800' as const, letterSpacing: -0.5 },
  headline: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.15 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.5 },
  sectionLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800' as const, letterSpacing: 1.5 },
} as const;

export type TypeStyle = keyof typeof typography;
