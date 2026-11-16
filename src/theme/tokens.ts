/**
 * Design tokens — taken from the Delton Core People desktop identity.
 * Every colour in the app comes from here. Nothing hardcodes a hex.
 */

export const colors = {
  // Surfaces
  page: '#0A111C',
  header: '#0D1522',
  card: '#121B28',
  cardRaised: '#16212F',

  // Lines
  border: '#22303F',
  borderSoft: '#1A2634',
  borderRaised: '#253445',

  // Text
  text: '#FFFFFF',
  textStrong: '#D6DEE9',
  textMuted: '#9FB0C6',
  textFaint: '#6B7C92',
  textDisabled: '#4A5A70',

  // Brand
  teal: '#2DD4BF',
  tealBright: '#5EEAD4',
  tealSurface: '#123A3C',
  tealBorder: '#1D5254',

  // Inputs stay light on dark cards — this is the desktop's signature.
  inputBg: '#E8EDF7',
  inputText: '#14171A',
  inputPlaceholder: '#5E6670',

  // Semantic
  success: '#34D399',
  successSurface: '#12332A',
  successText: '#06231A',
  danger: '#F87171',
  dangerSurface: '#331A1E',
  dangerBorder: '#4A2429',
  warning: '#FBBF24',
  warningSurface: '#332714',
  warningBorder: '#4D3A1B',
  warningText: '#F3D9A0',
  info: '#7DA9F5',
  infoSurface: '#16273F',
} as const

/**
 * The primary-action gradient. Deliberately darker at the cyan end than the
 * desktop button: white text on light cyan fails contrast, and this app is
 * used outdoors. Same identity, readable in sunlight.
 */
export const gradient = {
  primary: ['#0E93B8', '#3F6BE0', '#7C3AED'] as const,
  locations: [0, 0.52, 1] as const,
}

/** One badge style per request type. Keys match ApprovalRequest.request_type. */
export const requestTypeBadge = {
  leave: { bg: colors.tealSurface, fg: colors.tealBright, label: 'إجازة' },
  loan: { bg: colors.warningSurface, fg: colors.warning, label: 'سلفة' },
  mission: { bg: colors.infoSurface, fg: colors.info, label: 'إذن' },
  penalty: { bg: colors.dangerSurface, fg: colors.danger, label: 'جزاء' },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const

export const radius = {
  sm: 7,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 99,
} as const

export const font = {
  family: 'IBMPlexSansArabic_400Regular',
  familyMedium: 'IBMPlexSansArabic_500Medium',
  familySemiBold: 'IBMPlexSansArabic_600SemiBold',
  familyBold: 'IBMPlexSansArabic_700Bold',
  size: {
    xs: 11,
    sm: 12,
    md: 13,
    base: 14,
    lg: 15,
    xl: 16,
    title: 19,
    display: 22,
  },
} as const

/** Android minimum touch target. Never size a pressable below this. */
export const MIN_TOUCH = 48

/** Elevation shadows — page (flat), card (low), raised card (medium). */
export const elevation = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  low: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
} as const

/** Standard icon sizes used by the Icon component. */
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const
