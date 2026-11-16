import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  colors,
  font,
  gradient,
  MIN_TOUCH,
  radius,
  requestTypeBadge,
  spacing,
} from '../theme/tokens'
import type { RequestType } from '../api/types'
import { Icon } from './Icon'

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
  /** Feather icon name shown next to the label. */
  iconName?: string
}) {
  const off = disabled || busy
  const iconEl = iconName ? <Icon name={iconName} size={16} accessible={false} /> : null
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [
        ui.gradWrap,
        off && ui.dim,
        pressed && !off && ui.pressed,
      ]}
    >
      <LinearGradient
        colors={[...gradient.primary]}
        locations={[...gradient.locations]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={ui.grad}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            {iconEl}
            <Text style={ui.gradText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
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
  tone: 'approve' | 'reject' | 'neutral'
  busy?: boolean
  disabled?: boolean
  style?: ViewStyle
  iconName?: string
}) {
  const off = disabled || busy
  const toneStyle =
    tone === 'approve' ? ui.approve : tone === 'reject' ? ui.reject : ui.neutral
  const textStyle =
    tone === 'approve'
      ? ui.approveText
      : tone === 'reject'
        ? ui.rejectText
        : ui.neutralText
  const iconEl = iconName ? <Icon name={iconName} size={16} accessible={false} /> : null
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [
        ui.solid,
        toneStyle,
        style,
        off && ui.dim,
        pressed && !off && ui.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone === 'approve' ? colors.successText : colors.danger} />
      ) : (
        <>
          {iconEl}
          <Text style={textStyle}>{label}</Text>
        </>
      )}
    </Pressable>
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
  // Android 15 draws apps edge-to-edge, so the clock sits over the top of the
  // window: pad by the real inset instead of a guessed constant.
  const insets = useSafeAreaInsets()
  return (
    <View style={[ui.header, { paddingTop: insets.top + spacing.md }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          hitSlop={10}
          style={ui.back}
        >
          {/* Chevron points right: in RTL that is "back". */}
          <Text style={ui.backGlyph}>›</Text>
        </Pressable>
      ) : null}
      <Text style={ui.headerTitle} numberOfLines={1}>
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
  return <View style={[ui.card, style]}>{children}</View>
}

/** Label/value rows inside a Card, hairline-separated. */
export function DetailRows({
  rows,
}: {
  rows: { label: string; value: string; emphasis?: 'good' | 'bad' }[]
}) {
  return (
    <Card style={ui.rowsCard}>
      {rows.map((r, i) => (
        <View
          key={`${r.label}-${i}`}
          style={[ui.row, i < rows.length - 1 && ui.rowDivider]}
        >
          <Text style={ui.rowLabel}>{r.label}</Text>
          <Text
            style={[
              ui.rowValue,
              r.emphasis === 'good' && { color: colors.success },
              r.emphasis === 'bad' && { color: colors.danger },
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
  const b = requestTypeBadge[type]
  return (
    <View style={[ui.badge, { backgroundColor: b.bg }]}>
      <Text style={[ui.badgeText, { color: b.fg }]}>{b.label}</Text>
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
  const iconMap = {
    warn: 'alert-triangle',
    error: 'alert-circle',
    info: 'info',
  }
  const map = {
    warn: { bg: colors.warningSurface, bd: colors.warningBorder, fg: colors.warningText },
    error: { bg: colors.dangerSurface, bd: colors.dangerBorder, fg: colors.danger },
    info: { bg: colors.infoSurface, bd: colors.border, fg: colors.info },
  }[tone]
  return (
    <View style={[ui.banner, { backgroundColor: map.bg, borderColor: map.bd }]}>
      <Icon name={iconMap[tone]} size={14} color={map.fg} accessible={false} />
      <Text style={[ui.bannerText, { color: map.fg }]}>{children}</Text>
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
  return (
    <View style={ui.field}>
      <Text style={ui.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={ui.fieldHint}>{hint}</Text> : null}
    </View>
  )
}

const ui = StyleSheet.create({
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.85 },

  gradWrap: { borderRadius: radius.md, overflow: 'hidden' },
  grad: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  gradIcon: {},
  gradText: {
    color: colors.text,
    fontSize: font.size.xl,
    fontFamily: font.familyBold,
  },

  solid: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  approve: { backgroundColor: colors.success },
  approveText: {
    color: colors.successText,
    fontSize: font.size.lg,
    fontFamily: font.familyBold,
  },
  reject: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
  },
  rejectText: {
    color: colors.danger,
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
  },
  neutral: {
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  neutralText: {
    color: colors.textStrong,
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
  },

  header: {
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    width: MIN_TOUCH - 12,
    height: MIN_TOUCH - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    color: colors.textStrong,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: font.family,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: font.size.title,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  rowsCard: { paddingVertical: 0, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 12,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  rowLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: font.size.md,
    fontFamily: font.family,
    textAlign: 'right',
  },
  rowValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: font.size.base,
    fontFamily: font.familyMedium,
    textAlign: 'left',
    maxWidth: '62%',
  },

  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: font.size.xs, fontFamily: font.familySemiBold },

  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: {
    fontSize: 12.5,
    lineHeight: 21,
    fontFamily: font.family,
    textAlign: 'right',
  },

  field: { gap: spacing.sm },
  fieldLabel: {
    color: colors.textStrong,
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  fieldHint: {
    color: colors.textFaint,
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
  },
})
