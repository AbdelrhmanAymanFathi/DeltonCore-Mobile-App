import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ApiFailure, api, messageFor, newIdempotencyKey } from '../api/client'
import type { ApprovalRequestDetail } from '../api/types'
import {
  Banner,
  Card,
  DetailRows,
  ScreenHeader,
  SolidButton,
  TypeBadge,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing } from '../theme/tokens'

interface Props {
  requestId: string
  onBack: () => void
  onDecided: (id: string) => void
  onUnsavedChange?: (dirty: boolean) => void
}

export default function RequestDetailScreen({
  requestId,
  onBack,
  onDecided,
  onUnsavedChange,
}: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [data, setData] = useState<ApprovalRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const idemKey = useRef(newIdempotencyKey())
  const conflictTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null)

  useEffect(() => {
    if (mode !== 'rejecting') return
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const subscription = Keyboard.addListener(eventName, () => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    })
    return () => subscription.remove()
  }, [mode])

  const dirty = mode === 'rejecting' && reason.trim().length > 0
  useEffect(() => {
    onUnsavedChange?.(dirty)
  }, [dirty, onUnsavedChange])

  useEffect(() => {
    return () => {
      if (conflictTimer.current) clearTimeout(conflictTimer.current)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.requestDetail(requestId))
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    load()
  }, [load])

  async function decide(decision: 'approve' | 'reject') {
    if (decision === 'reject' && reason.trim().length === 0) return
    setSubmitting(decision)
    setActionError(null)
    try {
      await api.decide(
        requestId,
        { decision, reason: decision === 'reject' ? reason.trim() : undefined },
        idemKey.current,
      )
      onDecided(requestId)
      idemKey.current = newIdempotencyKey()
    } catch (e) {
      setActionError(messageFor(e))
      if (e instanceof ApiFailure && e.code !== 'timeout') {
        idemKey.current = newIdempotencyKey()
      }
      if (e instanceof ApiFailure && e.code === 'state_conflict') {
        conflictTimer.current = setTimeout(() => onDecided(requestId), 1800)
      }
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="تفاصيل الطلب" onBack={onBack} />
        <View style={s.skeletonContainer}>
          <View style={[s.skeletonLine, { backgroundColor: colors.surfaceElevated }]} />
          <View style={[s.skeletonLine, { width: '40%', backgroundColor: colors.surfaceElevated }]} />
          <View style={[s.skeletonLine, { backgroundColor: colors.surfaceElevated }]} />
          <View style={[s.skeletonLine, { width: '60%', backgroundColor: colors.surfaceElevated }]} />
        </View>
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="تفاصيل الطلب" onBack={onBack} />
        <View style={s.center}>
          <Text style={[s.centerText, { color: colors.textMuted }]}>{error}</Text>
          <SolidButton label="إعادة المحاولة" tone="neutral" onPress={load} />
        </View>
      </View>
    )
  }

  const pending = data.status === 'pending'
  const rejectBlocked = mode === 'rejecting' && reason.trim().length === 0

  return (
    <KeyboardAvoidingView
      style={[s.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <ScreenHeader
        title="تفاصيل الطلب"
        onBack={onBack}
        right={<StatusPill status={data.status} colors={colors} />}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={s.employeeRow}>
            <View style={[s.avatar, { backgroundColor: colors.tintBrand }]}>
              <Text style={[s.avatarText, { color: colors.brandText }]}>{initials(data.employee.full_name_ar)}</Text>
            </View>
            <View style={s.employeeText}>
              <Text style={[s.employeeName, { color: colors.textPrimary }]}>{data.employee.full_name_ar}</Text>
              <Text style={[s.employeeMeta, { color: colors.textMuted }]}>{data.employee.employee_number}</Text>
            </View>
            <TypeBadge type={data.request_type} />
          </View>
        </Card>

        <DetailRows rows={data.details} />

        {data.actions.length > 0 ? (
          <Card>
            <Text style={[s.sectionLabel, { color: colors.textMuted }]}>سجل الاعتماد</Text>
            {data.actions.map((a) => (
              <View key={a.id} style={s.timelineRow}>
                <View
                  style={[
                    s.dot,
                    {
                      backgroundColor:
                        a.decision === 'approved' ? colors.success : colors.crimson,
                    },
                  ]}
                />
                <View style={s.timelineText}>
                  <Text style={[s.timelineTitle, { color: colors.textPrimary }]}>
                    {a.decision === 'approved' ? 'اعتمده' : 'رفضه'} {a.actor_name}
                    {a.client_source === 'app' ? ' — من التطبيق' : ''}
                  </Text>
                  {a.reason ? <Text style={[s.timelineReason, { color: colors.textMuted }]}>{a.reason}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {pending && data.next_step ? <Banner tone="info">{data.next_step}</Banner> : null}

        {mode === 'rejecting' ? (
          <Card>
            <Text style={[s.sectionLabel, { color: colors.textMuted }]}>سبب الرفض</Text>
            <TextInput
              style={[s.reasonInput, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              autoFocus
              placeholder="اكتب السبب — يظهر لمقدّم الطلب"
              placeholderTextColor={colors.inputPlaceholder}
            />
            <Text style={[s.reasonHint, { color: colors.textMuted }]}>السبب إلزامي عند الرفض.</Text>
          </Card>
        ) : null}

        {actionError ? <Banner tone="error">{actionError}</Banner> : null}
      </ScrollView>

      {pending ? (
        <View style={[s.actions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {mode === 'idle' ? (
            <>
              <SolidButton
                label="رفض"
                tone="reject"
                style={s.flex1}
                onPress={() => setMode('rejecting')}
              />
              <SolidButton
                label="موافقة"
                tone="approve"
                style={s.flex2}
                iconName="check-circle"
                busy={submitting === 'approve'}
                disabled={submitting !== null}
                onPress={() => decide('approve')}
              />
            </>
          ) : (
            <>
              <SolidButton
                label="إلغاء"
                tone="neutral"
                style={s.flex1}
                onPress={() => {
                  setMode('idle')
                  setReason('')
                  setActionError(null)
                }}
              />
              <SolidButton
                label="تأكيد الرفض"
                tone="reject"
                style={s.flex2}
                iconName="x-circle"
                busy={submitting === 'reject'}
                disabled={rejectBlocked || submitting !== null}
                onPress={() => decide('reject')}
              />
            </>
          )}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  )
}

function StatusPill({ status, colors }: { status: ApprovalRequestDetail['status']; colors: any }) {
  const map = {
    pending: { bg: colors.tintCrimson, fg: colors.crimson, label: 'منتظر قرارك' },
    approved: { bg: colors.tintSuccess, fg: colors.success, label: 'معتمَد' },
    rejected: { bg: colors.tintCrimson, fg: colors.crimson, label: 'مرفوض' },
    cancelled: { bg: colors.surfaceElevated, fg: colors.textMuted, label: 'ملغي' },
  }[status]
  return (
    <View style={[s.pill, { backgroundColor: map.bg }]}>
      <Text style={[s.pillText, { color: map.fg }]}>{map.label}</Text>
    </View>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]).join(' ')
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  skeletonContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 4,
  },
  centerText: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    lineHeight: 24,
  },
  employeeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: font.size.xl,
    fontFamily: font.familySemiBold,
  },
  employeeText: { flex: 1 },
  employeeName: {
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  employeeMeta: {
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    marginTop: 3,
  },
  sectionLabel: {
    fontSize: font.size.sm,
    fontFamily: font.familyMedium,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  timelineText: { flex: 1 },
  timelineTitle: {
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  timelineReason: {
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    marginTop: 3,
    lineHeight: 20,
  },
  reasonInput: {
    minHeight: 92,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: font.size.lg,
    fontFamily: font.family,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  reasonHint: {
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: 11,
    padding: spacing.lg,
    paddingBottom: 22,
    borderTopWidth: 1,
  },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  pill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: font.size.sm, fontFamily: font.familySemiBold },
})
