import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, ApiFailure, messageFor, newIdempotencyKey } from '../api/client'
import type { PunchResponse, TodayStatus } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import {
  messageForLocationFailure,
  usePunchLocation,
} from '../location/usePunchLocation'
import { Banner, Card, GradientButton } from '../components/ui'
import { Icon } from '../components/Icon'
import CompanyPickerScreen from './CompanyPickerScreen'
import { colors, elevation, font, iconSize, MIN_TOUCH, radius, spacing } from '../theme/tokens'

/** Show the password-expiry warning from this many days out. */
const PASSWORD_WARN_DAYS = 7

interface Props {
  /** From the badge poll — the home screen does not fetch the inbox itself. */
  pendingCount: number | null
  onOpenInbox: () => void
  onOpenPenalty: () => void
  onOpenEmployees: () => void
  /** Lets the navigator refresh the badge and drop cached inbox rows. */
  onCompanyChanged: () => void
}

type PunchOutcome =
  | { kind: 'success'; res: PunchResponse }
  | { kind: 'error'; message: string }

export default function HomeScreen({
  pendingCount,
  onOpenInbox,
  onOpenPenalty,
  onOpenEmployees,
  onCompanyChanged,
}: Props) {
  const { session, companies, switchCompany, signOut } = useAuth()
  const location = usePunchLocation()
  const insets = useSafeAreaInsets()

  const [today, setToday] = useState<TodayStatus | null>(null)
  const [todayError, setTodayError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [punching, setPunching] = useState(false)
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null)

  const [pickingCompany, setPickingCompany] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const idemKey = useRef(newIdempotencyKey())
  const employeeId = session?.employee.id
  const companyId = session?.company?.id ?? null
  const companyName = session?.company?.name_ar || session?.company?.name || null
  const canSwitch = companies.length > 1
  /** Tracks the last date we loaded today's status for, to detect a local date change. */
  const lastDateRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!employeeId) return
    // Detect a local date change: a new day means today's status is stale.
    const todayKey = new Date().toLocaleDateString('ar-EG')
    if (lastDateRef.current !== null && lastDateRef.current !== todayKey) {
      setToday(null)
      setTodayError(null)
    }
    lastDateRef.current = todayKey
    setTodayError(null)
    try {
      setToday(await api.today(employeeId))
    } catch (e) {
      setTodayError(messageFor(e))
    }
  }, [employeeId, companyId])

  useEffect(() => {
    load()
  }, [load])

  // Re-fetch today's status when the app returns to the foreground, so a
  // punch made on another device or the desktop is reflected here.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') load()
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [load])

  // Poll lightly for a local date change while the app is open, so a new day
  // refreshes today's status without the user having to pull.
  useEffect(() => {
    if (!employeeId) return
    const timer = setInterval(() => {
      const todayKey = new Date().toLocaleDateString('ar-EG')
      if (lastDateRef.current !== null && lastDateRef.current !== todayKey) {
        load()
      }
    }, 30_000)
    return () => clearInterval(timer)
  }, [employeeId, load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function punch() {
    if (!employeeId || !today) return
    setOutcome(null)
    setPunching(true)
    try {
      const result = await location.acquire()
      if (!result.ok) {
        setOutcome({
          kind: 'error',
          message: messageForLocationFailure(result.failure),
        })
        return
      }
      const fix = result.fix
      const res = await api.punch(
        {
          employee_id: employeeId,
          attendance_type: today.next_action,
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy_meters: fix.accuracy_meters,
          is_mocked: fix.is_mocked,
        },
        idemKey.current,
      )
      setOutcome({ kind: 'success', res })
      // A definite server answer: rotate so the next tap is a new intent.
      idemKey.current = newIdempotencyKey()
      await load()
    } catch (e) {
      setOutcome({ kind: 'error', message: messageFor(e) })
      // Keep the same key after a network error or a client-side timeout so a
      // retry reuses it and the server recognises the repeat. Rotate only on a
      // definite server answer (4xx/5xx with a code).
      if (e instanceof ApiFailure && e.code !== 'timeout') {
        idemKey.current = newIdempotencyKey()
      }
    } finally {
      setPunching(false)
    }
  }

  function confirmSignOut() {
    Alert.alert('تسجيل الخروج', 'ستُلغى جلستك على هذا الجهاز. متابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: () => void signOut() },
    ])
  }

  async function pickCompany(id: string) {
    setSwitching(true)
    setSwitchError(null)
    try {
      await switchCompany(id)
      // Everything on screen belonged to the previous company: reset the punch
      // intent and re-read, then let the navigator drop its cached counts.
      idemKey.current = newIdempotencyKey()
      setOutcome(null)
      setToday(null)
      setPickingCompany(false)
      onCompanyChanged()
    } catch (e) {
      setSwitchError(messageFor(e))
    } finally {
      setSwitching(false)
    }
  }

  if (pickingCompany) {
    return (
      <CompanyPickerScreen
        companies={companies}
        busy={switching}
        error={switchError}
        onPick={pickCompany}
        onBack={() => {
          setPickingCompany(false)
          setSwitchError(null)
        }}
      />
    )
  }

  const checkingIn = today?.next_action !== 'check_out'
  const canPunch = session?.capabilities.can_punch ?? false
  const daysLeft = session?.password_policy.days_until_expiry ?? null
  const passwordWarn = daysLeft !== null && daysLeft > 0 && daysLeft <= PASSWORD_WARN_DAYS

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.teal}
        />
      }
    >
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={s.headerText}>
          <Text style={s.greeting}>أهلًا</Text>
          <Text style={s.name}>{session?.user.full_name}</Text>
          {session?.site ? <Text style={s.site}>{session.site.name_ar}</Text> : null}
          {companyName ? (
            <View style={s.companyRow}>
              <View style={s.companyDot} />
              <Text style={s.companyName} numberOfLines={1}>
                {companyName}
              </Text>
              {canSwitch ? (
                <Pressable
                  onPress={() => setPickingCompany(true)}
                  accessibilityRole="button"
                  accessibilityLabel="تبديل الشركة"
                  hitSlop={8}
                  style={({ pressed }) => [s.companySwitch, pressed && s.pressed]}
                >
                  <Icon name="refresh-cw" size={14} color={colors.tealBright} accessible={false} />
                  <Text style={s.companySwitchText}>تبديل</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          accessibilityLabel="تسجيل الخروج"
          hitSlop={8}
          style={({ pressed }) => [s.logout, pressed && s.pressed]}
        >
          <Icon name="log-out" size={16} color={colors.textMuted} accessible={false} />
          <Text style={s.logoutText}>خروج</Text>
        </Pressable>
      </View>

      <View style={s.body}>
        {passwordWarn ? (
          <Banner tone="warn">
            {`تنتهي صلاحية كلمة مرورك خلال ${daysLeft} يومًا. غيّرها من النسخة الويب قبل أن يُقفل الحساب.`}
          </Banner>
        ) : null}

        {canPunch ? (
          <Card style={s.punchCard}>
            <View style={s.cardHead}>
              <Text style={s.cardLabel}>حالة اليوم</Text>
              <Text style={s.cardDate}>{todayLabel()}</Text>
            </View>
            {todayError ? (
              <View style={s.todayError}>
                <Text style={s.state}>{todayError}</Text>
                <Pressable
                  onPress={load}
                  accessibilityRole="button"
                  accessibilityLabel="إعادة المحاولة"
                  style={s.retry}
                >
                  <Text style={s.retryText}>إعادة المحاولة</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[s.state, checkingIn ? s.stateCheckedIn : s.stateCheckedOut]}>
                {today === null
                  ? '—'
                  : today.last_punch === null
                    ? 'لم تسجّل حضورك بعد'
                    : checkingIn
                      ? 'سجّلت الانصراف'
                      : `سجّلت الحضور ${timeOf(today.last_punch_at)}`}
              </Text>
            )}

            <GradientButton
              label={checkingIn ? 'تسجيل حضور' : 'تسجيل انصراف'}
              iconName={checkingIn ? 'play' : 'log-out'}
              busy={punching || location.busy}
              disabled={today === null || todayError !== null}
              onPress={punch}
            />

            {outcome?.kind === 'error' ? (
              <View style={s.outcome}>
                <Banner tone="error">{outcome.message}</Banner>
              </View>
            ) : outcome?.kind === 'success' ? (
              <View style={s.outcome}>
                <Banner tone={outcome.res.location_status === 'verified' ? 'info' : 'warn'}>
                  {outcome.res.location_status === 'verified'
                    ? `تم التسجيل والتحقق من الموقع${
                        outcome.res.gps_distance_meters !== null
                          ? ` — على بعد ${outcome.res.gps_distance_meters} مترًا`
                          : ''
                      }.`
                    : 'تم التسجيل، لكن موقع العمل لم تُضبط إحداثياته بعد فلم يُتحقق من موقعك.'}
                </Banner>
              </View>
            ) : (
              <Text style={s.hint}>
                يُلتقط موقعك عند التسجيل ويُتحقق أنك داخل نطاق الموقع.
              </Text>
            )}
          </Card>
        ) : null}

        <Pressable onPress={onOpenInbox} accessibilityRole="button">
          <Card>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>صندوق الطلبات</Text>
              {pendingCount !== null && pendingCount > 0 ? (
                <View style={s.countPill}>
                  <Text style={s.countText}>{pendingCount} منتظرة</Text>
                </View>
              ) : null}
              <View style={s.grow} />
              <Text style={s.link}>عرض الكل</Text>
            </View>
            <Text style={s.hint}>
              {pendingCount === 0
                ? 'لا يوجد ما ينتظر قرارك الآن.'
                : 'كل ما ينتظر قرارك، من كل الأنواع، في قائمة واحدة.'}
            </Text>
          </Card>
        </Pressable>

        <View style={s.tiles}>
          {session?.capabilities.can_create_penalty ? (
            <Tile label="تسجيل جزاء" iconName="alert-circle" onPress={onOpenPenalty} tone={colors.danger} />
          ) : null}
          <Tile label="موظفو الموقع" iconName="users" onPress={onOpenEmployees} tone={colors.teal} />
        </View>
      </View>
    </ScrollView>
  )
}

function Tile({
  label,
  iconName,
  onPress,
  tone,
}: {
  label: string
  iconName?: string
  onPress: () => void
  tone: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.tile, pressed && s.tilePressed]}
    >
      {iconName ? <Icon name={iconName} size={16} color={tone} accessible={false} /> : null}
      <View style={[s.tileDot, { backgroundColor: tone }]} />
      <Text style={s.tileLabel}>{label}</Text>
    </Pressable>
  )
}

function todayLabel() {
  return new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function timeOf(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingBottom: spacing.xxl },
  header: {
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  pressed: { opacity: 0.7 },
  logout: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  logoutText: {
    color: colors.textMuted,
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
  },
  greeting: {
    color: colors.textFaint,
    fontSize: font.size.md,
    fontFamily: font.family,
    textAlign: 'right',
  },
  name: {
    color: colors.text,
    fontSize: font.size.display,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    marginTop: 2,
  },
  site: {
    color: colors.teal,
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
    textAlign: 'right',
    marginTop: 6,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 8,
  },
  companyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  companyName: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  companySwitch: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.tealBorder,
    backgroundColor: colors.tealSurface,
  },
  companySwitchText: {
    color: colors.tealBright,
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
  },
  body: { padding: spacing.lg, gap: spacing.lg },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardLabel: {
    flex: 1,
    color: colors.textFaint,
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  cardDate: {
    color: colors.textFaint,
    fontSize: font.size.md,
    fontFamily: font.family,
  },
  cardTitle: {
    color: colors.text,
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
  },
  grow: { flex: 1 },
  countPill: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSurface,
  },
  countText: {
    color: colors.danger,
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
  },
  link: {
    color: colors.teal,
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
  },
  state: {
    color: colors.text,
    fontSize: font.size.title,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    marginBottom: spacing.lg,
  },
  hint: {
    color: colors.textFaint,
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    marginTop: 10,
    lineHeight: 20,
  },
  outcome: { marginTop: spacing.md },
  todayError: { gap: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  punchCard: {
    ...elevation.medium,
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  stateCheckedIn: { color: colors.success },
  stateCheckedOut: { color: colors.teal },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  retryText: {
    color: colors.teal,
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
  },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: 92,
    justifyContent: 'center',
  },
  tilePressed: { backgroundColor: colors.cardRaised },
  tileDot: { width: 10, height: 10, borderRadius: 5 },
  tileLabel: {
    color: colors.text,
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
})
