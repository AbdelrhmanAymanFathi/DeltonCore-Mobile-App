import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { api, messageFor, newIdempotencyKey } from '../api/client'
import type { PenaltyFormContext, PenaltyTypeOption, SiteEmployee } from '../api/types'
import { Banner, Card, Field, GradientButton, ScreenHeader, SolidButton } from '../components/ui'
import { colors, font, radius, spacing } from '../theme/tokens'

interface Props {
  onBack: () => void
  onDone: () => void
  /** Opens the employee picker; resolves through onEmployeePicked. */
  onPickEmployee: () => void
  pickedEmployee: SiteEmployee | null
  /** Lets the navigator warn before a hardware back drops a written reason. */
  onUnsavedChange?: (dirty: boolean) => void
}

export default function PenaltyScreen({
  onBack,
  onDone,
  onPickEmployee,
  pickedEmployee,
  onUnsavedChange,
}: Props) {
  const [ctx, setCtx] = useState<PenaltyFormContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [penaltyType, setPenaltyType] = useState<PenaltyTypeOption | null>(null)
  const [days, setDays] = useState('1')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const idemKey = useRef(newIdempotencyKey())

  const dirty = reason.trim().length > 0
  useEffect(() => {
    onUnsavedChange?.(dirty)
  }, [dirty, onUnsavedChange])

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

  const daysValue = Number(days.replace(',', '.'))
  const daysValid = Number.isFinite(daysValue) && daysValue > 0
  const periodOpen = ctx?.open_period != null
  const ready =
    periodOpen &&
    pickedEmployee !== null &&
    penaltyType !== null &&
    daysValid &&
    reason.trim().length > 0 &&
    !submitting

  async function submit() {
    if (!ready || !pickedEmployee || !penaltyType) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.createPenalty(
        {
          employee_id: pickedEmployee.id,
          penalty_type_id: penaltyType.id,
          days: String(daysValue),
          penalty_date: new Date().toISOString().slice(0, 10),
          reason: reason.trim(),
        },
        idemKey.current,
      )
      onDone()
    } catch (e) {
      setSubmitError(messageFor(e))
      idemKey.current = newIdempotencyKey()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={s.screen}>
        <ScreenHeader title="تسجيل جزاء" onBack={onBack} />
        <View style={s.center}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </View>
    )
  }

  if (loadError || !ctx) {
    return (
      <View style={s.screen}>
        <ScreenHeader title="تسجيل جزاء" onBack={onBack} />
        <View style={s.center}>
          <Text style={s.centerText}>{loadError}</Text>
          <SolidButton label="إعادة المحاولة" tone="neutral" onPress={load} />
        </View>
      </View>
    )
  }

  const overCap = daysValid && daysValue > ctx.max_days_before_review

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="تسجيل جزاء" onBack={onBack} />

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* The payroll period gates everything. Say so before the form, not
            after a rejected submit. */}
        {periodOpen ? (
          <Banner tone="warn">
            الفترة المحاسبية {ctx.open_period!.label} مفتوحة. لا يمكن تسجيل جزاء في
            فترة مغلقة.
          </Banner>
        ) : (
          <Banner tone="error">
            لا توجد فترة محاسبية مفتوحة. لا يمكن تسجيل جزاء الآن — راجع الموارد
            البشرية.
          </Banner>
        )}

        <Field label="الموظف">
          <Pressable
            onPress={onPickEmployee}
            disabled={!periodOpen}
            accessibilityRole="button"
            style={({ pressed }) => [s.select, pressed && s.selectPressed]}
          >
            <Text style={pickedEmployee ? s.selectValue : s.selectPlaceholder}>
              {pickedEmployee ? pickedEmployee.name : 'اختر من موظفي الموقع'}
            </Text>
          </Pressable>
        </Field>

        <Field label="نوع الجزاء">
          <View style={s.options}>
            {ctx.penalty_types.map((t) => {
              const active = penaltyType?.id === t.id
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setPenaltyType(t)}
                  disabled={!periodOpen}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[s.option, active ? s.optionActive : s.optionIdle]}
                >
                  <Text style={active ? s.optionTextActive : s.optionText}>{t.name}</Text>
                </Pressable>
              )
            })}
          </View>
        </Field>

        <Field
          label="عدد الأيام"
          hint={`أساس الخصم في الرواتب. ما يتجاوز ${ctx.max_days_before_review} أيام يُعلَّم للمراجعة.`}
        >
          <TextInput
            style={s.input}
            value={days}
            onChangeText={setDays}
            keyboardType="decimal-pad"
            editable={periodOpen}
          />
        </Field>

        {overCap ? (
          <Banner tone="warn">
            تجاوزت {ctx.max_days_before_review} أيام. سيُسجَّل الجزاء ويُعلَّم لمراجعة
            الموارد البشرية.
          </Banner>
        ) : null}

        <Field label="السبب">
          <TextInput
            style={[s.input, s.textarea]}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            editable={periodOpen}
            placeholder="ماذا حدث بالضبط ومتى"
            placeholderTextColor={colors.inputPlaceholder}
          />
        </Field>

        {submitError ? <Banner tone="error">{submitError}</Banner> : null}

        <Card>
          <Text style={s.note}>
            يُسجَّل الجزاء بحالة «منتظر الاعتماد» وينتقل إلى صندوق الطلبات عند
            المعتمِد المختص. لا يُخصم من الراتب قبل اعتماده.
          </Text>
        </Card>
      </ScrollView>

      <View style={s.footer}>
        <GradientButton
          label="تسجيل الجزاء"
          onPress={submit}
          busy={submitting}
          disabled={!ready}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: spacing.lg, gap: spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  centerText: {
    color: colors.textMuted,
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    lineHeight: 24,
  },
  select: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
  },
  selectPressed: { opacity: 0.85 },
  selectValue: {
    color: colors.inputText,
    fontSize: font.size.lg,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  selectPlaceholder: {
    color: colors.inputPlaceholder,
    fontSize: font.size.lg,
    fontFamily: font.family,
    textAlign: 'right',
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  optionIdle: {
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  optionActive: { backgroundColor: colors.inputBg },
  optionText: {
    color: colors.textMuted,
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
  },
  optionTextActive: {
    color: colors.inputText,
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    fontSize: font.size.lg,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  textarea: {
    minHeight: 96,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    fontFamily: font.family,
  },
  note: {
    color: colors.textFaint,
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    lineHeight: 21,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: 22,
    backgroundColor: colors.header,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
})
