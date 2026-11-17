import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, ApiFailure, messageFor, newIdempotencyKey } from '../api/client'
import type { PenaltyFormContext, PenaltyTypeOption, SiteEmployee } from '../api/types'
import { Button, ScreenHeader, SolidButton } from '../components/ui'
import { Icon } from '../components/Icon'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing, lineHeightFor, baseText } from '../theme/tokens'
import { t, tCount, formatNumber } from '../i18n'
import { DAY_FORMS } from '../i18n/plural'

interface Props {
  onBack: () => void
  onDone: () => void
  onPickEmployee: () => void
  pickedEmployee: SiteEmployee | null
  onUnsavedChange?: (dirty: boolean) => void
}

export default function PenaltyScreen({
  onBack,
  onDone,
  onPickEmployee,
  pickedEmployee,
  onUnsavedChange,
}: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [ctx, setCtx] = useState<PenaltyFormContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [penaltyType, setPenaltyType] = useState<PenaltyTypeOption | null>(null)
  const [days, setDays] = useState(1)
  const [reason, setReason] = useState('')
  const [reasonFocused, setReasonFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successVisible, setSuccessVisible] = useState(false)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idemKey = useRef(newIdempotencyKey())

  const dirty = reason.trim().length > 0
  useEffect(() => {
    onUnsavedChange?.(dirty)
  }, [dirty, onUnsavedChange])

  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await api.penaltyForm()
      setCtx(res)
      if (res.penalty_types.length === 1) setPenaltyType(res.penalty_types[0])
    } catch (e) {
      setLoadError(messageFor(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const daysValid = Number.isFinite(days) && days >= 1
  const periodOpen = ctx?.open_period != null
  const overCap = Boolean(ctx && days > ctx.max_days_before_review)
  const ready =
    periodOpen &&
    pickedEmployee !== null &&
    penaltyType !== null &&
    daysValid &&
    reason.trim().length > 0 &&
    !submitting &&
    !successVisible
  const unavailable = !periodOpen
  const controlsDisabled = unavailable || submitting || successVisible

  async function submit() {
    if (!ready || !pickedEmployee || !penaltyType) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.createPenalty(
        {
          employee_id: pickedEmployee.id,
          penalty_type_id: penaltyType.id,
          days: String(days),
          penalty_date: new Date().toISOString().slice(0, 10),
          reason: reason.trim(),
        },
        idemKey.current,
      )
      idemKey.current = newIdempotencyKey()
      setSuccessVisible(true)
      successTimer.current = setTimeout(onDone, 1000)
    } catch (e) {
      setSubmitError(messageFor(e))
      if (e instanceof ApiFailure && e.code !== 'timeout') {
        idemKey.current = newIdempotencyKey()
      }
    } finally {
      setSubmitting(false)
    }
  }

  function confirmSubmission() {
    if (!ready || !pickedEmployee || !penaltyType) return
    Alert.alert(
      t("penalty.confirmTitle"),
      t("penalty.confirmMessage", {
        type: penaltyType.name,
        name: pickedEmployee.name,
        duration: tCount(days, DAY_FORMS),
      }),
      [
        { text: t("common.cancel"), style: 'cancel' },
        { text: t("common.confirm"), style: 'destructive', onPress: () => void submit() },
      ],
    )
  }

  const missingFields = [
    !pickedEmployee && t("penalty.missingEmployee"),
    !penaltyType && t("penalty.missingType"),
    !daysValid && t("penalty.missingDays"),
    reason.trim().length === 0 && t("penalty.missingReason"),
  ].filter(Boolean) as string[]

  if (loading) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t("penalty.title")} onBack={onBack} />
        <View style={s.skeletonContainer}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[s.skeletonLine, { backgroundColor: colors.surfaceElevated }]} />
          ))}
        </View>
      </View>
    )
  }

  if (loadError || !ctx) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t("penalty.title")} onBack={onBack} />
        <View style={s.center}>
          <Text style={[s.centerText, { color: colors.textMuted }]}>{loadError}</Text>
          <SolidButton label={t("common.retry")} tone="neutral" onPress={load} />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[s.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <ScreenHeader title={t("penalty.title")} onBack={onBack} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {periodOpen ? (
          <View style={[s.periodChip, { backgroundColor: colors.tintSuccess }]}>
            <View style={[s.periodDot, { backgroundColor: colors.success }]} />
            <Text style={[s.periodText, { color: colors.success }]}>
              {t("penalty.periodOpen", { label: ctx.open_period!.label })}
            </Text>
          </View>
        ) : (
          <View style={[s.closedBanner, { backgroundColor: colors.tintCrimson, borderColor: colors.crimson }]}>
            <Icon name="alert-circle" size={20} color={colors.crimson} accessible={false} />
            <Text style={[s.closedText, { color: colors.crimson }]}>
              {t("penalty.periodClosedShort")}
            </Text>
          </View>
        )}

        <StepCard step={1} title={t("penalty.employee")} colors={colors} disabled={controlsDisabled}>
          <Pressable
            onPress={onPickEmployee}
            disabled={controlsDisabled}
            accessibilityRole="button"
            accessibilityLabel={pickedEmployee ? pickedEmployee.name : t("penalty.chooseEmployee")}
            style={[
              s.employeeCard,
              {
                backgroundColor: controlsDisabled ? colors.surfaceElevated : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {pickedEmployee ? (
              <>
                <View style={[s.employeeAvatar, { backgroundColor: colors.tintBrand }]}>
                  <Text style={[s.employeeInitials, { color: colors.brandText }]}>
                    {employeeInitials(pickedEmployee.name)}
                  </Text>
                </View>
                <View style={s.employeeText}>
                  <Text style={[s.employeeName, { color: controlsDisabled ? colors.textMuted : colors.textPrimary }]} numberOfLines={1}>
                    {pickedEmployee.name}
                  </Text>
                  <Text style={[s.employeeNumber, { color: colors.textMuted }]}>{pickedEmployee.employee_number}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[s.employeeAvatar, { backgroundColor: colors.tintBrand }]}>
                  <Icon name="account-search" family="material-community" size={22} color={colors.brandText} accessible={false} />
                </View>
                <Text style={[s.employeeName, { color: controlsDisabled ? colors.textMuted : colors.textSecondary }]}>
                  {t("penalty.chooseEmployee")}
                </Text>
              </>
            )}
            <Icon name="chevron-down" family="material-community" size={20} color={colors.textMuted} accessible={false} />
          </Pressable>
        </StepCard>

        <StepCard step={2} title={t("penalty.penaltyType")} colors={colors} disabled={controlsDisabled}>
          <View style={s.typeGrid}>
            {ctx.penalty_types.map((type) => {
              const active = penaltyType?.id === type.id
              const icon = penaltyIcon(type.id)
              return (
                <Pressable
                  key={type.id}
                  onPress={() => setPenaltyType(type)}
                  disabled={controlsDisabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: controlsDisabled }}
                  style={[
                    s.typeOption,
                    {
                      backgroundColor: active ? colors.tintBrand : colors.surface,
                      borderColor: active ? colors.brand : colors.border,
                      borderWidth: active ? 1.5 : 1,
                    },
                  ]}
                >
                  <View style={[s.typeIcon, { backgroundColor: active ? colors.tintBrand : colors.surfaceElevated }]}>
                    <Icon name={icon} family="material-community" size={22} color={active ? colors.brandText : colors.textSecondary} accessible={false} />
                  </View>
                  <Text style={[s.typeName, { color: controlsDisabled ? colors.textMuted : colors.textPrimary }]} numberOfLines={2}>
                    {type.name}
                  </Text>
                  {active ? (
                    <View style={[s.selectedCheck, { backgroundColor: colors.brand }]}>
                      <Icon name="check" size={12} color={colors.onBrand} accessible={false} />
                    </View>
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        </StepCard>

        <StepCard step={3} title={t("penalty.days")} colors={colors} disabled={controlsDisabled}>
          <View style={s.stepper}>
            <Pressable
              onPress={() => setDays((value) => Math.max(1, value - 1))}
              disabled={controlsDisabled || days <= 1}
              accessibilityRole="button"
              accessibilityLabel={t("penalty.decreaseDays")}
              style={[
                s.stepperButton,
                { backgroundColor: controlsDisabled || days <= 1 ? colors.surfaceElevated : colors.surface, borderColor: colors.border },
              ]}
            >
              <Icon name="minus" size={20} color={controlsDisabled || days <= 1 ? colors.textMuted : colors.textPrimary} accessible={false} />
            </Pressable>
            <Text style={[s.daysNumber, { color: controlsDisabled ? colors.textMuted : colors.textPrimary }]}>
              {formatNumber(days)}
            </Text>
            <Pressable
              onPress={() => setDays((value) => value + 1)}
              disabled={controlsDisabled}
              accessibilityRole="button"
              accessibilityLabel={t("penalty.increaseDays")}
              style={[
                s.stepperButton,
                { backgroundColor: controlsDisabled ? colors.surfaceElevated : colors.surface, borderColor: colors.border },
              ]}
            >
              <Icon name="plus" size={20} color={controlsDisabled ? colors.textMuted : colors.textPrimary} accessible={false} />
            </Pressable>
          </View>
          <View style={s.daysHintRow}>
            <Text style={[s.daysHint, { color: colors.textSecondary }]}>
              {t("penalty.daysHint", {
                count: formatNumber(days),
                unit: tCount(days, DAY_FORMS),
              })}
            </Text>
            {overCap ? (
              <View style={[s.reviewChip, { backgroundColor: colors.tintBrand }]}>
                <Icon name="alert-circle-outline" size={14} color={colors.warning} accessible={false} />
                <Text style={[s.reviewText, { color: colors.warning }]}>{t("penalty.review")}</Text>
              </View>
            ) : null}
          </View>
        </StepCard>

        <StepCard step={4} title={t("penalty.reason")} colors={colors} disabled={controlsDisabled}>
          <TextInput
            style={[
              s.textarea,
              {
                backgroundColor: controlsDisabled ? colors.surfaceElevated : colors.surface,
                color: controlsDisabled ? colors.textMuted : colors.inputText,
                borderColor: reasonFocused && !controlsDisabled ? colors.brand : colors.border,
                borderWidth: reasonFocused && !controlsDisabled ? 1.5 : 1,
              },
            ]}
            value={reason}
            onChangeText={setReason}
            onFocus={() => setReasonFocused(true)}
            onBlur={() => setReasonFocused(false)}
            multiline
            maxLength={300}
            editable={!controlsDisabled}
            placeholder={t("penalty.reasonPlaceholder")}
            placeholderTextColor={colors.inputPlaceholder}
            textAlign="right"
            textAlignVertical="top"
          />
          <View style={s.reasonMeta}>
            <Text style={[s.note, { color: colors.textMuted }]}>
              {t("penalty.reasonNote")}
            </Text>
            <Text style={[s.counter, { color: colors.textMuted }]}>
              {formatNumber(reason.length)}/300
            </Text>
          </View>
        </StepCard>

        {submitError ? (
          <View style={[s.errorBanner, { backgroundColor: colors.tintCrimson }]}>
            <Icon name="alert-circle" size={18} color={colors.crimson} accessible={false} />
            <Text style={[s.errorText, { color: colors.crimson }]}>{submitError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[
        s.footer,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}>
        <Button
          label={t("penalty.submit")}
          variant="danger"
          dangerEmphasis
          onPress={confirmSubmission}
          busy={submitting}
          busyLabel={t("penalty.submitting")}
          disabled={!ready}
          iconName="check"
          style={{ backgroundColor: ready ? colors.crimson : colors.surface }}
        />
        {!ready ? (
          <Text style={[s.footerHint, { color: colors.textMuted }]}>
            {unavailable
              ? t("penalty.periodClosedFooter")
              : successVisible
                ? t("penalty.successFooter")
                : missingFields.join(t("common.listSeparator"))}
          </Text>
        ) : null}
      </View>

      {successVisible ? (
        <View style={[s.toast, { top: insets.top + spacing.sm, backgroundColor: colors.tintSuccess, borderColor: colors.success }]}>
          <Icon name="check-circle" size={20} color={colors.success} accessible={false} />
          <Text style={[s.toastText, { color: colors.success }]}>{t("penalty.success")}</Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

function StepCard({
  step,
  title,
  colors,
  disabled,
  children,
}: {
  step: number
  title: string
  colors: {
    surface: string
    border: string
    brand: string
    brandText: string
    tintBrand: string
    textPrimary: string
  }
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <View style={[
      s.stepCard,
      { backgroundColor: colors.surface, borderColor: colors.border },
      disabled && { opacity: 0.78 },
    ]}>
      <View style={s.stepHeading}>
        <View style={[s.stepNumber, { backgroundColor: colors.tintBrand }]}>
          <Text style={[s.stepNumberText, { color: colors.brandText }]}>
            {formatNumber(step)}
          </Text>
        </View>
        <Text style={[s.stepTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

function employeeInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('')
}

function penaltyIcon(typeId: number): string {
  if (typeId === 1) return 'clock-alert-outline'
  if (typeId === 2) return 'account-off-outline'
  if (typeId === 3) return 'hard-hat'
  if (typeId === 4) return 'account-alert-outline'
  return 'gavel'
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  skeletonContainer: { padding: spacing.lg, gap: spacing.md },
  skeletonLine: { height: 96, borderRadius: radius.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  centerText: { fontSize: font.size.base, fontFamily: font.family, textAlign: 'center', lineHeight: lineHeightFor(font.size.base), ...baseText },
  periodChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  periodDot: { width: 8, height: 8, borderRadius: radius.pill },
  periodText: { fontSize: font.size.sm, fontFamily: font.familySemiBold, lineHeight: lineHeightFor(font.size.sm), ...baseText },
  closedBanner: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  closedText: { flex: 1, fontSize: font.size.base, lineHeight: lineHeightFor(font.size.base), fontFamily: font.familySemiBold, textAlign: 'right', ...baseText },
  stepCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  stepHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm },
  stepNumber: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: font.size.sm, fontFamily: font.familyBold, lineHeight: lineHeightFor(font.size.sm), ...baseText },
  stepTitle: { fontSize: font.size.md, fontFamily: font.familySemiBold, lineHeight: lineHeightFor(font.size.md), ...baseText },
  employeeCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  employeeAvatar: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  employeeInitials: { fontSize: font.size.md, fontFamily: font.familyBold, lineHeight: lineHeightFor(font.size.md), ...baseText },
  employeeText: { flex: 1, gap: 2 },
  employeeName: { flex: 1, textAlign: 'right', fontSize: font.size.base, fontFamily: font.familySemiBold, lineHeight: lineHeightFor(font.size.base), ...baseText },
  employeeNumber: { textAlign: 'right', fontSize: font.size.xs, fontFamily: font.family, lineHeight: lineHeightFor(font.size.xs), ...baseText },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeOption: {
    width: '48%',
    minHeight: 72,
    flexGrow: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    position: 'relative',
  },
  typeIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  typeName: { flex: 1, textAlign: 'right', fontSize: font.size.sm, lineHeight: lineHeightFor(font.size.sm), fontFamily: font.familyMedium, ...baseText },
  selectedCheck: { position: 'absolute', top: spacing.xs, right: spacing.xs, width: 18, height: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  stepperButton: { width: 44, height: 44, borderWidth: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  daysNumber: { minWidth: 48, textAlign: 'center', fontSize: 28, lineHeight: lineHeightFor(28), fontFamily: font.familyBold, ...baseText },
  daysHintRow: { alignItems: 'center', gap: spacing.sm },
  daysHint: { fontSize: font.size.sm, fontFamily: font.family, textAlign: 'center', lineHeight: lineHeightFor(font.size.sm), ...baseText },
  reviewChip: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  reviewText: { fontSize: font.size.xs, fontFamily: font.familySemiBold, lineHeight: lineHeightFor(font.size.xs), ...baseText },
  textarea: {
    minHeight: 120,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: font.size.base,
    lineHeight: lineHeightFor(font.size.base),
    fontFamily: font.family,
    ...baseText,
  },
  reasonMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  note: { flex: 1, fontSize: font.size.xs, fontFamily: font.family, textAlign: 'right', lineHeight: lineHeightFor(font.size.xs), ...baseText },
  counter: { fontSize: font.size.xs, fontFamily: font.family, lineHeight: lineHeightFor(font.size.xs), ...baseText },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  errorText: { flex: 1, fontSize: font.size.sm, fontFamily: font.family, textAlign: 'right', lineHeight: lineHeightFor(font.size.sm), ...baseText },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.sm },
  footerHint: { textAlign: 'center', fontSize: font.size.xs, fontFamily: font.family, lineHeight: lineHeightFor(font.size.xs), ...baseText },
  toast: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    zIndex: 1100,
  },
  toastText: { fontSize: font.size.sm, fontFamily: font.familySemiBold, lineHeight: lineHeightFor(font.size.sm), ...baseText },
})
