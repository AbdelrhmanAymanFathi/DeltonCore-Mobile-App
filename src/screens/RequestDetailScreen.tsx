import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
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
import { colors, font, radius, spacing } from '../theme/tokens'

interface Props {
  requestId: string
  onBack: () => void
  /** Called after a successful decision so the inbox can drop the row. */
  onDecided: (id: string) => void
  /** Lets the navigator warn before a hardware back drops a written reason. */
  onUnsavedChange?: (dirty: boolean) => void
}

export default function RequestDetailScreen({
  requestId,
  onBack,
  onDecided,
  onUnsavedChange,
}: Props) {
  const [data, setData] = useState<ApprovalRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /**
   * One key per user intent, not per HTTP attempt. If the network drops and
   * the user taps again, the same key goes out and the server returns the
   * first result instead of deducting a leave balance twice.
   */
  const idemKey = useRef(newIdempotencyKey())
  /** Lets the state-conflict notice stay on screen before the inbox refreshes. */
  const conflictTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    } catch (e) {
      setActionError(messageFor(e))
      // A fresh key for the next genuine attempt: the previous one is now
      // bound to a request the server may have partly processed.
      idemKey.current = newIdempotencyKey()
      // Someone else decided this request while the screen was open, so the
      // row in the inbox is stale. Say so, then refresh it automatically.
      if (e instanceof ApiFailure && e.code === 'state_conflict') {
        conflictTimer.current = setTimeout(() => onDecided(requestId), 1800)
      }
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <View style={s.screen}>
        <ScreenHeader title="تفاصيل الطلب" onBack={onBack} />
        <View style={s.center}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={s.screen}>
        <ScreenHeader title="تفاصيل الطلب" onBack={onBack} />
        <View style={s.center}>
          <Text style={s.centerText}>{error}</Text>
          <SolidButton label="إعادة المحاولة" tone="neutral" onPress={load} />
        </View>
      </View>
    )
  }

  const pending = data.status === 'pending'
  const rejectBlocked = mode === 'rejecting' && reason.trim().length === 0

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="تفاصيل الطلب"
        onBack={onBack}
        right={<StatusPill status={data.status} />}
      />

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={s.employeeRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials(data.employee.full_name_ar)}</Text>
            </View>
            <View style={s.employeeText}>
              <Text style={s.employeeName}>{data.employee.full_name_ar}</Text>
              <Text style={s.employeeMeta}>{data.employee.employee_number}</Text>
            </View>
            <TypeBadge type={data.request_type} />
          </View>
        </Card>

        <DetailRows rows={data.details} />

        {data.actions.length > 0 ? (
          <Card>
            <Text style={s.sectionLabel}>سجل الاعتماد</Text>
            {data.actions.map((a) => (
              <View key={a.id} style={s.timelineRow}>
                <View
                  style={[
                    s.dot,
                    {
                      backgroundColor:
                        a.decision === 'approved' ? colors.success : colors.danger,
                    },
                  ]}
                />
                <View style={s.timelineText}>
                  <Text style={s.timelineTitle}>
                    {a.decision === 'approved' ? 'اعتمده' : 'رفضه'} {a.actor_name}
                    {a.client_source === 'app' ? ' — من التطبيق' : ''}
                  </Text>
                  {a.reason ? <Text style={s.timelineReason}>{a.reason}</Text> : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {pending && data.next_step ? <Banner tone="info">{data.next_step}</Banner> : null}

        {mode === 'rejecting' ? (
          <Card>
            <Text style={s.sectionLabel}>سبب الرفض</Text>
            <TextInput
              style={s.reasonInput}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              autoFocus
              placeholder="اكتب السبب — يظهر لمقدّم الطلب"
              placeholderTextColor={colors.inputPlaceholder}
            />
            <Text style={s.reasonHint}>السبب إلزامي عند الرفض.</Text>
          </Card>
        ) : null}

        {actionError ? <Banner tone="error">{actionError}</Banner> : null}
      </ScrollView>

      {pending ? (
        <View style={s.actions}>
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

function StatusPill({ status }: { status: ApprovalRequestDetail['status'] }) {
  const map = {
    pending: { bg: colors.warningSurface, fg: colors.warning, label: 'منتظر قرارك' },
    approved: { bg: colors.successSurface, fg: colors.success, label: 'معتمَد' },
    rejected: { bg: colors.dangerSurface, fg: colors.danger, label: 'مرفوض' },
    cancelled: { bg: colors.cardRaised, fg: colors.textFaint, label: 'ملغي' },
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
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: spacing.lg, gap: spacing.md },
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
  employeeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.tealSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.tealBright,
    fontSize: font.size.xl,
    fontFamily: font.familySemiBold,
  },
  employeeText: { flex: 1 },
  employeeName: {
    color: colors.text,
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  employeeMeta: {
    color: colors.textMuted,
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    marginTop: 3,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: font.size.sm,
    fontFamily: font.familyMedium,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  timelineText: { flex: 1 },
  timelineTitle: {
    color: colors.textStrong,
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  timelineReason: {
    color: colors.textFaint,
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
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    fontSize: font.size.lg,
    fontFamily: font.family,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  reasonHint: {
    color: colors.textFaint,
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
    backgroundColor: colors.header,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  pill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: font.size.sm, fontFamily: font.familySemiBold },
})
