/**
 * Design tokens — Delton Facility Management identity.
 * Dark / Light mode ready. No hex literals should appear in components.
 */

export type ThemeMode = 'system' | 'light' | 'dark'

export interface ThemeColors {
  background: string
  surface: string
  surfaceElevated: string
  border: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  brand: string
  brandOutline: string
  brandLight: string
  brandDeep: string
  onBrand: string
  onCrimson: string
  brandText: string
  crimson: string
  badgeCrimson: string
  success: string
  onSuccess: string
  warning: string
  warningText: string
  info: string
  infoText: string
  tintBrand: string
  brandGlow: string
  tintCrimson: string
  tintSuccess: string
  rippleBrand: string
  pressOverlay: string
  pressedBorder: string
  scrim: string
  inputBg: string
  inputText: string
  inputPlaceholder: string
}

export const lightColors: ThemeColors = {
  background: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E7E2D7',
  textPrimary: '#24262C',
  textSecondary: '#5E6068',
  textMuted: '#6C6E75',
  brand: '#D4A24C',
  brandOutline: 'rgba(169,118,30,0.40)',
  brandLight: '#F0CB74',
  brandDeep: '#A9761E',
  onBrand: '#1A1306',
  onCrimson: '#FFFFFF',
  brandText: '#8A5E14',
  crimson: '#C8102E',
  badgeCrimson: '#C8102E',
  success: '#0F9F6E',
  onSuccess: '#071E17',
  warning: '#A75A00',
  warningText: '#8A4A00',
  info: '#3B6FB0',
  infoText: '#2E5D99',
  tintBrand: 'rgba(212,162,76,0.16)',
  brandGlow: 'rgba(212,162,76,0.14)',
  tintCrimson: 'rgba(200,16,46,0.08)',
  tintSuccess: 'rgba(15,159,110,0.10)',
  rippleBrand: 'rgba(212,162,76,0.20)',
  pressOverlay: 'rgba(0,0,0,0.10)',
  pressedBorder: 'rgba(169,118,30,0.50)',
  scrim: 'rgba(13,14,18,0.40)',
  inputBg: '#F7F5F0',
  inputText: '#24262C',
  inputPlaceholder: '#8E8F96',
}

export const darkColors: ThemeColors = {
  background: '#0D0E12',
  surface: '#16181F',
  surfaceElevated: '#1D2029',
  border: '#2A2D38',
  textPrimary: '#F5F2EB',
  textSecondary: '#A8A59C',
  textMuted: '#AAA79F',
  brand: '#D4A24C',
  brandOutline: 'rgba(212,162,76,0.40)',
  brandLight: '#F0CB74',
  brandDeep: '#A9761E',
  onBrand: '#1A1306',
  onCrimson: '#FFFFFF',
  rippleBrand: 'rgba(212,162,76,0.20)',
  brandText: '#D4A24C',
  crimson: '#FF6B70',
  badgeCrimson: '#C8102E',
  success: '#34D399',
  onSuccess: '#073222',
  warning: '#FB923C',
  warningText: '#FB923C',
  info: '#7DA7D9',
  infoText: '#7DA7D9',
  tintBrand: 'rgba(212,162,76,0.12)',
  brandGlow: 'rgba(212,162,76,0.10)',
  tintCrimson: 'rgba(229,72,77,0.12)',
  tintSuccess: 'rgba(52,211,153,0.12)',
  pressOverlay: 'rgba(255,255,255,0.10)',
  pressedBorder: 'rgba(212,162,76,0.50)',
  scrim: 'rgba(0,0,0,0.55)',
  inputBg: '#16181F',
  inputText: '#F5F2EB',
  inputPlaceholder: '#6F6D66',
}

export const brandGradient = ['#F0CB74', '#D4A24C', '#A9761E'] as const
export const crimsonGradient = ['#C8102E', '#A40E25', '#760A1E'] as const
export const lightPageGradient = ['#F7F5F0', '#FBF9F4'] as const
export const darkPageGradient = ['#0D0E12', '#14120D'] as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

export const radius = {
  sm: 12,
  md: 12,
  lg: 16,
  xl: 16,
  xxl: 24,
  hero: 28,
  pill: 999,
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

export const MIN_TOUCH = 48

export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const

/** Elevation: Light uses soft shadow, Dark uses border only. */
export const elevationLight = {
  card: {
    shadowColor: '#A9761E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  none: { shadowOpacity: 0, elevation: 0 },
} as const

/** Request type badges — keys match ApprovalRequest.request_type. */
export const requestTypeBadge = {
  leave: { bg: 'brand', fg: 'brandDeep', label: 'إجازة' },
  loan: { bg: 'warning', fg: 'warning', label: 'سلفة' },
  mission: { bg: 'info', fg: 'info', label: 'إذن' },
  penalty: { bg: 'crimson', fg: 'crimson', label: 'جزاء' },
} as const

/** Resolve a semantic color name to an actual hex from the active theme. */
export function resolveColor(theme: ThemeColors, key: keyof ThemeColors): string {
  return theme[key]
}
