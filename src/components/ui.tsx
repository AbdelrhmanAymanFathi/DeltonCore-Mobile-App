import React from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../theme/ThemeProvider'
import {
  font,
  crimsonGradient,
  MIN_TOUCH,
  radius,
  requestTypeBadge,
  spacing,
  lineHeightFor,
  baseText,
} from '../theme/tokens'
import type { RequestType } from '../api/types'
import { Icon } from './Icon'
import { PressableScale } from './ui/PressableScale'
import { t, useLocale } from '../i18n'

type Tone = 'approve' | 'reject' | 'neutral'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  success = false,
  dangerEmphasis = false,
  iconName,
  busyLabel,
  style,
}: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  busy?: boolean
  disabled?: boolean
  success?: boolean
  dangerEmphasis?: boolean
  iconName?: string
  busyLabel?: string
  style?: ViewStyle
}) {
  const { colors, gradients } = useTheme()
  const off = disabled || busy
  const fill = variant === 'primary' ? gradients.brand : crimsonGradient
  const title = busy ? busyLabel ?? label : label
  const foreground = off
    ? colors.textMuted
    : success
      ? colors.success
      : variant === 'primary'
        ? colors.onBrand
        : variant === 'danger'
          ? dangerEmphasis
            ? colors.onCrimson
            : colors.crimson
          : variant === 'ghost'
            ? colors.brandText
            : colors.textPrimary

  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      accessibilityState={{ disabled: off, busy }}
      style={[
        buttonStyles.base,
        {
          backgroundColor: off
            ? colors.surface
            : success
              ? colors.tintSuccess
              : variant === 'primary'
                ? 'transparent'
                : variant === 'secondary'
                  ? colors.surface
                  : variant === 'danger'
                    ? colors.tintCrimson
                    : 'transparent',
          borderColor: variant === 'secondary' ? colors.border : success ? colors.success : 'transparent',
          borderWidth: variant === 'secondary' || success ? 1 : 0,
        },
        style,
      ]}
      accessibilityLabel={label}
    >
      {({ pressed }) => {
        const useGradient = !off && !success && (
          variant === 'primary' || (variant === 'danger' && (dangerEmphasis || pressed))
        )
        return (
          <LinearGradient
            colors={
              useGradient
                ? variant === 'danger'
                  ? crimsonGradient
                  : pressed
                    ? [colors.brand, colors.brandDeep, colors.brandDeep]
                    : fill
                : [off ? colors.surface : 'transparent', off ? colors.surface : 'transparent']
            }
            style={buttonStyles.content}
          >
            {busy ? (
              <ActivityIndicator color={foreground} />
            ) : success ? (
              <Icon name="check" size={20} color={foreground} accessible={false} />
            ) : null}
            <Text
              style={[
                buttonStyles.label,
                {
                  color: useGradient
                    ? variant === 'danger'
                      ? colors.onCrimson
                      : colors.onBrand
                    : foreground,
                  fontFamily: variant === 'primary' ? font.familyBold : font.familySemiBold,
                },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {success ? t("common.saved") : title}
            </Text>
            {!busy && !success && iconName ? (
              <Icon
                name={iconName}
                size={20}
                color={useGradient ? (variant === 'danger' ? colors.onCrimson : colors.onBrand) : foreground}
                accessible={false}
              />
            ) : null}
          </LinearGradient>
        )
      }}
    </PressableScale>
  )
}

/** The one primary action per screen. Never two on the same screen. */
export function GradientButton({
  label,
  onPress,
  busy,
  disabled,
  iconName,
}: {
  label: string
  onPress: () => void
  busy?: boolean
  disabled?: boolean
  iconName?: string
}) {
  return (
    <Button
      variant="primary"
      label={label}
      onPress={onPress}
      busy={busy}
      disabled={disabled}
      iconName={iconName}
      busyLabel={t("home.punching")}
    />
  )
}

export function SolidButton({
  label,
  onPress,
  tone,
  busy,
  disabled,
  style,
  iconName,
}: {
  label: string
  onPress: () => void
  tone: Tone
  busy?: boolean
  disabled?: boolean
  style?: ViewStyle
  iconName?: string
}) {
  return (
    <Button
      variant={tone === 'approve' ? 'primary' : tone === 'reject' ? 'danger' : 'secondary'}
      label={label}
      onPress={onPress}
      busy={busy}
      disabled={disabled}
      iconName={iconName}
      style={style}
    />
  )
}

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string
  onBack?: () => void
  right?: React.ReactNode
}) {
  const { colors } = useTheme()
  const { align, rtl } = useLocale()
  const insets = useSafeAreaInsets()
  return (
    <View style={[
      {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingTop: insets.top + spacing.md,
      },
    ]}>
      {onBack ? (
        <PressableScale
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={10}
          style={{
            width: MIN_TOUCH - 12,
            height: MIN_TOUCH - 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={rtl ? "chevron-right" : "chevron-left"} size={24} color={colors.textSecondary} accessible={false} />
        </PressableScale>
      ) : null}
      <Text style={{ flex: 1, color: colors.textPrimary, fontSize: font.size.title, fontFamily: font.familySemiBold, textAlign: align, lineHeight: lineHeightFor(font.size.title), ...baseText }} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      {right}
    </View>
  )
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode
  style?: ViewStyle
}) {
  const { colors, isDark } = useTheme()
  return (
    <View style={[
      {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.lg,
        ...(isDark ? {} : { shadowColor: colors.brandDeep, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }),
      },
      style,
    ]}>{children}</View>
  )
}

export function DetailRows({
  rows,
}: {
  rows: { label: string; value: string; emphasis?: 'good' | 'bad' }[]
}) {
  const { colors } = useTheme()
  const { align, rtl } = useLocale()
  return (
    <Card style={{ paddingVertical: 0, paddingHorizontal: spacing.lg }}>
      {rows.map((r, i) => (
        <View
          key={`${r.label}-${i}`}
          style={[
            {
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.md,
              paddingVertical: 12,
            },
            i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
          ]}
        >
          <Text style={{ flex: 1, color: colors.textMuted, fontSize: font.size.md, fontFamily: font.family, textAlign: align, lineHeight: lineHeightFor(font.size.md), ...baseText }}>
            {r.label}
          </Text>
          <Text
            style={[
              { flexShrink: 1, color: colors.textPrimary, fontSize: font.size.base, fontFamily: font.familySemiBold, textAlign: align, maxWidth: '62%', lineHeight: lineHeightFor(font.size.base), ...baseText },
              r.emphasis === 'good' && { color: colors.success },
              r.emphasis === 'bad' && { color: colors.crimson },
            ]}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </Card>
  )
}

export function TypeBadge({ type }: { type: RequestType }) {
  const { colors } = useTheme()
  const b = requestTypeBadge[type]
  const bgKey = b.bg as keyof typeof colors
  const fgKey = b.fg as keyof typeof colors
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors[bgKey] }}>
      <Text style={{ color: colors[fgKey], fontSize: font.size.xs, fontFamily: font.familySemiBold, lineHeight: lineHeightFor(font.size.xs), ...baseText }}>{b.label}</Text>
    </View>
  )
}

export function Banner({
  tone,
  children,
}: {
  tone: 'warn' | 'error' | 'info'
  children: React.ReactNode
}) {
  const { colors } = useTheme()
  const { align, rtl } = useLocale()
  const iconMap = { warn: 'alert-triangle', error: 'alert-circle', info: 'info' }
  const map = {
    warn: { bg: colors.tintBrand, bd: colors.warning, fg: colors.warning },
    error: { bg: colors.tintCrimson, bd: colors.crimson, fg: colors.crimson },
    info: { bg: colors.tintBrand, bd: colors.info, fg: colors.info },
  }[tone]
  return (
    <View style={[
      { borderWidth: 1, borderColor: map.bd, borderRadius: radius.md, padding: spacing.md, backgroundColor: map.bg },
    ]}>
      <Icon name={iconMap[tone]} size={14} color={map.fg} accessible={false} />
      <Text style={{ fontSize: 12.5, lineHeight: 21, fontFamily: font.family, textAlign: align, color: map.fg, ...baseText }}>{children}</Text>
    </View>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  const { colors } = useTheme()
  const { align, rtl } = useLocale()
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textSecondary, fontSize: font.size.md, fontFamily: font.familySemiBold, textAlign: align, lineHeight: lineHeightFor(font.size.md), ...baseText }}>
        {label}
      </Text>
      {children}
      {hint ? <Text style={{ color: colors.textMuted, fontSize: font.size.sm, fontFamily: font.family, textAlign: align, lineHeight: lineHeightFor(font.size.sm), ...baseText }}>{hint}</Text> : null}
    </View>
  )
}

const ui = StyleSheet.create({
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
})

const buttonStyles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  content: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: 16,
    lineHeight: lineHeightFor(16),
    textAlignVertical: 'center',
    ...baseText,
  },
})

export { ui }
