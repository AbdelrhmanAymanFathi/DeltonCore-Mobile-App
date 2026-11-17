import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  ActivityIndicator,
  Animated,
  AppState,
  AccessibilityInfo,
  type AppStateStatus,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { api, ApiFailure, messageFor, newIdempotencyKey } from '../api/client'
import type { PunchResponse, TodayStatus } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import {
  messageForLocationFailure,
  usePunchLocation,
} from '../location/usePunchLocation'
import { Banner, Button, Card, GradientButton } from '../components/ui'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { Icon } from '../components/Icon'
import CompanyPickerScreen from './CompanyPickerScreen'
import { useTheme } from '../theme/ThemeProvider'
import { getRequestTypeAppearance } from '../constants/requestTypes'
import {
  font,
  iconSize,
  MIN_TOUCH,
  radius,
  spacing,
  lineHeightFor,
  baseText,
} from '../theme/tokens'
import { t, tCount, formatDateShort, formatTime12, formatNumber, formatDistance } from '../i18n'
import { DAY_FORMS, REQUEST_FORMS } from '../i18n/plural'

const PASSWORD_WARN_DAYS = 7

interface Props {
  pendingCount: number | null
  onOpenInbox: () => void
  onOpenPenalty: () => void
  onOpenEmployees: () => void
  onOpenProfile: () => void
  onCompanyChanged: () => void
}

type PunchOutcome =
  | { kind: 'success'; res: PunchResponse }
  | {
      kind: 'error'
      message: string
      geofence?: { distance: number | null; allowed: number | null }
    }

export default function HomeScreen({
  pendingCount,
  onOpenInbox,
  onOpenPenalty,
  onOpenEmployees,
  onOpenProfile,
  onCompanyChanged,
}: Props) {
  const { colors, gradients, setMode, mode } = useTheme()
  const { session, companies, switchCompany, signOut } = useAuth()
  const location = usePunchLocation()
  const insets = useSafeAreaInsets()

  const [today, setToday] = useState<TodayStatus | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const [reduceMotion, setReduceMotion] = useState(false)
  const [todayError, setTodayError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [punching, setPunching] = useState(false)
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null)

  const [pickingCompany, setPickingCompany] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const popupAnim = useRef(new Animated.Value(0)).current
  const segmentedAnim = useRef(new Animated.Value(modeIndex(mode))).current
  const [segmentedWidth, setSegmentedWidth] = useState(0)

  useEffect(() => {
    if (reduceMotion) {
      segmentedAnim.setValue(modeIndex(mode))
      return
    }
    Animated.timing(segmentedAnim, {
      toValue: modeIndex(mode),
      duration: 180,
      useNativeDriver: false,
    }).start()
  }, [mode, reduceMotion, segmentedAnim])

  const idemKey = useRef(newIdempotencyKey())
  const employeeId = session?.employee.id
  const companyId = session?.company?.id ?? null
  const companyName = session?.company?.name_ar || session?.company?.name || null
  const canSwitch = companies.length > 1
  const rawName = session?.user?.full_name
  const userName = typeof rawName === 'string' ? rawName : ''
  const firstName = userName.split(/\s+/)[0] || t('common.defaultName')
  const userInitial = userName.charAt(0) || t('common.userInitial')
  const isCheckedIn = today?.last_punch === 'check_in' && today.next_action === 'check_out'
  const hasRegisteredToday = today !== null && today.last_punch !== null
  const lastDateRef = useRef<string | null>(null)

  const pulseAnim = useRef(new Animated.Value(0)).current
  const checkScale = useRef(new Animated.Value(1)).current
  const entryAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current

  useEffect(() => {
    let active = true
    let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!active) return
      setReduceMotion(enabled)
      if (enabled) {
        entryAnimations.forEach((value) => value.setValue(1))
        return
      }
      Animated.stagger(60, entryAnimations.map((value) => Animated.timing(value, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }))).start()
    }, () => {
      entryAnimations.forEach((value) => value.setValue(1))
    })
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled)
      if (enabled) {
        entryAnimations.forEach((value) => value.setValue(1))
        pulseAnim.stopAnimation()
      }
    })
    return () => {
      active = false
      subscription?.remove()
    }
  }, [entryAnimations, pulseAnim])

  useEffect(() => {
    let active = true
    if (isCheckedIn) pulseAnim.setValue(0)
    const startPulse = () => Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ])).start()
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled)
      if (active && !enabled && !isCheckedIn) startPulse()
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled)
      if (enabled) {
        pulseAnim.stopAnimation()
        pulseAnim.setValue(0)
      } else if (!isCheckedIn) {
        pulseAnim.setValue(0)
        startPulse()
      }
    })
    return () => {
      active = false
      subscription.remove()
      pulseAnim.stopAnimation()
    }
  }, [isCheckedIn, pulseAnim])

  useEffect(() => {
    if (reduceMotion) {
      checkScale.setValue(1)
      return
    }
    if (!isCheckedIn) {
      checkScale.setValue(1)
      return
    }
    checkScale.setValue(0.82)
    Animated.spring(checkScale, {
      toValue: 1,
      speed: 22,
      bounciness: 3,
      useNativeDriver: true,
    }).start()
  }, [checkScale, isCheckedIn, reduceMotion])

  const load = useCallback(async () => {
    if (!employeeId) return
    const todayKey = new Date().toLocaleDateString('ar-EG-u-nu-latn')
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

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') load()
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [load])

  useEffect(() => {
    if (!employeeId) return
    const timer = setInterval(() => {
      const todayKey = new Date().toLocaleDateString('ar-EG-u-nu-latn')
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
      idemKey.current = newIdempotencyKey()
      await load()
    } catch (e) {
      const geofence = e instanceof ApiFailure && e.code === 'out_of_range'
        ? {
            distance: e.payload.gps_distance_meters ?? null,
            allowed: e.payload.allowed_radius_meters ?? null,
          }
        : undefined
      setOutcome({ kind: 'error', message: messageFor(e), geofence })
      if (e instanceof ApiFailure && e.code !== 'timeout') {
        idemKey.current = newIdempotencyKey()
      }
    } finally {
      setPunching(false)
      setSwitching(false)
    }
  }

  async function pickCompany(id: string) {
    setSwitching(true)
    setSwitchError(null)
    try {
      await switchCompany(id)
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

  const toggleAccountMenu = () => {
    setAccountMenuOpen((prev) => {
      if (!prev) {
        if (reduceMotion) popupAnim.setValue(1)
        else Animated.timing(popupAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }).start()
      }
      return !prev
    })
  }

  const closeAccountMenu = () => {
    if (reduceMotion) {
      popupAnim.setValue(0)
      setAccountMenuOpen(false)
      return
    }
    Animated.timing(popupAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start(() => setAccountMenuOpen(false))
  }

  const handleLogoutPress = () => {
    closeAccountMenu()
    Alert.alert(
      t("common.logoutConfirmTitle"),
      t("common.logoutConfirmBody"),
      [
        { text: t("common.cancel"), style: 'cancel' },
        { text: t("common.logout"), style: 'destructive', onPress: () => void signOut() },
      ],
    )
  }

  const setAppearance = (next: 'system' | 'light' | 'dark') => {
    if (reduceMotion) segmentedAnim.setValue(modeIndex(next))
    else Animated.timing(segmentedAnim, {
        toValue: modeIndex(next),
        duration: 180,
        useNativeDriver: false,
      }).start()
    setMode(next)
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
  const entryStyle = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  })

  const inboxAppearance = getRequestTypeAppearance('unknown', colors)

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
    <ScrollView
      style={[s.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingBottom: 88 + 24 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand}
        />
      }
    >
      <LinearGradient
        pointerEvents="none"
        colors={[colors.tintBrand, 'transparent']}
        style={s.backgroundGlow}
      />
      <View style={[s.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={s.notifLtr}>
        <Pressable
          onPress={onOpenInbox}
          accessibilityRole="button"
          accessibilityLabel={t("home.notifications")}
          hitSlop={12}
          style={[s.notifPressable, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={s.notifWrap}>
            <Icon name="bell" size={20} color={colors.textPrimary} accessible={false} />
            {typeof pendingCount === 'number' && pendingCount > 0 ? (
              <View style={[s.badgeWrap, { backgroundColor: colors.badgeCrimson, borderColor: colors.background }]}>
                <Text style={[s.badgeText, { color: colors.onCrimson }]}>{pendingCount > 99 ? '99+' : formatNumber(pendingCount)}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        </View>

        <View style={s.headerText}>
          <Text style={[s.greeting, { color: colors.textSecondary }]}>
            {clock.getHours() < 12 ? t("home.greetingMorning", { name: firstName }) : t("home.greetingEvening", { name: firstName })}
          </Text>
          <View style={s.siteRow}>
            <Icon name="factory" family="material-community" size={16} color={colors.brand} accessible={false} />
            <Text style={[s.siteName, { color: colors.textPrimary }]} numberOfLines={1}>
              {session?.site?.name_ar || companyName || ''}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={toggleAccountMenu}
          accessibilityRole="button"
          accessibilityLabel={t("home.accountMenu")}
          hitSlop={12}
          style={s.avatarPressable}
        >
          <View style={s.avatarWrap}>
            <LinearGradient
              colors={[colors.brandLight, colors.brand, colors.brandDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.avatarGradient}
            >
              <Text style={[s.avatarText, { color: colors.onBrand }]}>{userInitial}</Text>
            </LinearGradient>
            <View style={[s.statusDot, isCheckedIn ? { backgroundColor: colors.success, borderColor: colors.background } : { backgroundColor: colors.textMuted, borderColor: colors.background }]} />
          </View>
        </Pressable>
      </View>

      <View style={s.body}>
          {passwordWarn ? (
            <Banner tone="warn">
              {t("home.passwordExpires", { days: tCount(daysLeft ?? 0, DAY_FORMS) })}
            </Banner>
          ) : null}

        {canPunch ? (
          <Animated.View style={entryStyle(entryAnimations[0])}>
          <Card style={s.punchCard}>
            <View style={[s.heroLight, { backgroundColor: colors.brand }]} />
            <View style={s.heroTop}>
              <View style={s.todayStatusWrap}>
                <View style={[s.todayStatus, { backgroundColor: hasRegisteredToday ? colors.tintSuccess : colors.tintBrand }]}>
                  <Text style={{ color: hasRegisteredToday ? colors.success : colors.brandText, fontFamily: font.familySemiBold, fontSize: font.size.xs }}>
                    {today === null
                      ? t("home.loading")
                      : hasRegisteredToday && today.last_punch === 'check_in'
                        ? t("home.checkedIn")
                        : today?.last_punch === 'check_out'
                          ? t("home.checkedOut")
                          : t("home.notCheckedIn")}
                  </Text>
                </View>
              </View>
              <View style={s.heroClock}>
                <Text style={[s.heroTime, { color: colors.textPrimary }]}>{timeNow(clock)}</Text>
                <Text style={[s.heroDate, { color: colors.textSecondary }]}>{todayLabel(clock)}</Text>
              </View>
            </View>

            {todayError ? (
              <View style={s.todayError}>
                <Text style={[s.state, { color: colors.textPrimary }]}>{todayError}</Text>
                <Pressable
                  onPress={load}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.retry")}
                  style={[s.retry, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                >
                  <Text style={[s.retryText, { color: colors.brandText }]}>{t("home.retry")}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.heroAction}>
                {!isCheckedIn ? <Animated.View
                  pointerEvents="none"
                  style={[
                    s.pulseRing,
                    {
                      borderColor: colors.brand,
                      opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                      transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
                    },
                  ]}
                /> : null}
                {!isCheckedIn ? <Animated.View
                  pointerEvents="none"
                  style={[
                    s.pulseRing,
                    s.pulseRingInner,
                    {
                      borderColor: colors.brand,
                      opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] }),
                      transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }],
                    },
                  ]}
                /> : null}
                <Pressable
                  onPress={punch}
                  disabled={today === null || todayError !== null || punching || location.busy}
                  accessibilityRole="button"
                  accessibilityLabel={checkingIn ? t("home.punchIn") : t("home.punchOut")}
                  accessibilityState={{ disabled: today === null || todayError !== null, busy: punching || location.busy }}
                  style={[s.punchCircle, { borderColor: isCheckedIn ? colors.success : colors.brand }]}
                >
                  <LinearGradient
                    colors={isCheckedIn ? [colors.success, colors.success] : gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.punchCircleGradient}
                  >
                    {punching || location.busy ? (
                      <ActivityIndicator size="large" color={colors.onBrand} />
                    ) : isCheckedIn ? (
                      <Animated.View style={{ alignItems: 'center', transform: [{ scale: checkScale }] }}>
                        <Icon name="check" size={34} color={colors.onSuccess} accessible={false} />
                        <Text style={[s.punchTime, { color: colors.onSuccess }]}>{timeOf(today?.last_punch_at ?? null)}</Text>
                      </Animated.View>
                    ) : (
                      <Icon name={checkingIn ? 'fingerprint' : 'log-out'} family={checkingIn ? 'material-community' : 'feather'} size={44} color={colors.onBrand} accessible={false} />
                    )}
                  </LinearGradient>
                </Pressable>
                <Text style={[s.punchLabel, { color: colors.textPrimary }]}>
                  {punching || location.busy ? t("home.punching") : checkingIn ? t("home.punchIn") : t("home.punchOut")}
                </Text>
              </View>
            )}

            {outcome?.kind === 'error' ? (
              <View style={[s.locationChip, { backgroundColor: colors.tintCrimson }]}>
                <View style={[s.locationDot, { backgroundColor: colors.crimson }]} />
                <Text style={[s.locationText, { color: colors.crimson }]} numberOfLines={2}>
                  {outcome.geofence
                    ? t("home.outOfRange", {
                        distance: formatDistance(outcome.geofence.distance),
                        allowed: formatDistance(outcome.geofence.allowed),
                      })
                    : t("home.locationUnverified")}
                </Text>
              </View>
            ) : outcome?.kind === 'success' && outcome.res.location_status === 'verified' ? (
              <View style={[s.locationChip, { backgroundColor: colors.tintSuccess }]}>
                <View style={[s.locationDot, { backgroundColor: colors.success }]} />
                <Text style={[s.locationText, { color: colors.success }]} numberOfLines={2}>
                  {t("home.withinRange", { distance: formatDistance(outcome.res.gps_distance_meters) })}
                </Text>
              </View>
            ) : (
              <View style={[s.locationChip, { backgroundColor: colors.tintBrand }]}>
                <View style={[s.locationDot, { backgroundColor: colors.warning }]} />
                <Text style={[s.locationText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {t("home.locationDefault")}
                </Text>
              </View>
            )}
            {outcome?.kind === 'error' ? (
              <Text style={[s.hint, { color: colors.textMuted }]}>{outcome.message}</Text>
            ) : (
              <Text style={[s.hint, { color: colors.textMuted }]}>{t("home.locationHint")}</Text>
            )}
          </Card>
          </Animated.View>
        ) : null}

        <Animated.View style={entryStyle(entryAnimations[1])}>
          <Pressable onPress={onOpenInbox} accessibilityRole="button" card>
            <Card style={s.requestsCard}>
              <View style={s.cardHead}>
                <View style={s.requestsTitle}>
                  <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{t("requests.title")}</Text>
                  {pendingCount !== null ? (
                    <View style={[s.countPill, { backgroundColor: pendingCount ? colors.tintCrimson : colors.surfaceElevated }]}>
                      <Text style={[s.countText, { color: pendingCount ? colors.crimson : colors.textMuted }]}>
                        {pendingCount.toLocaleString('ar-EG-u-nu-latn')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.grow} />
                <Button label={t("requests.viewAll")} variant="ghost" onPress={onOpenInbox} style={s.showAllButton} />
              </View>
              <View style={[s.emptyState, { borderTopColor: colors.border }]}>
                <View style={[s.emptyIcon, { backgroundColor: colors.tintBrand }]}>
                  <Icon
                    name={inboxAppearance.icon}
                    family="material-community"
                    size={20}
                    color={inboxAppearance.color}
                    accessible={false}
                  />
                </View>
                <Text style={[s.hint, { color: colors.textMuted, marginTop: 0 }]}>
                  {pendingCount === 0
                    ? t("requests.emptyPending")
                    : pendingCount === null
                      ? t("requests.requestsUnavailable")
                      : t("home.haveRequests", { count: tCount(pendingCount, REQUEST_FORMS) })}
                </Text>
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View style={[s.tiles, entryStyle(entryAnimations[2])]}>
          {session?.capabilities.can_create_penalty ? (
            <Tile label={t("home.penalty")} iconName="alert-circle" onPress={onOpenPenalty} tone="crimson" colors={colors} />
          ) : null}
          <Tile label={t("home.employees")} iconName="users" onPress={onOpenEmployees} tone="brand" colors={colors} />
        </Animated.View>
      </View>
    </ScrollView>

    {accountMenuOpen ? (
      <View
        style={[s.popupBackdrop, { backgroundColor: colors.scrim }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeAccountMenu}
          accessibilityRole="button"
          accessibilityLabel={t("home.closeMenu")}
        />
        <Animated.View
          style={[
            s.popup,
            { right: spacing.sm, top: insets.top + 72 + spacing.sm, backgroundColor: colors.surfaceElevated, borderColor: colors.border, shadowColor: colors.background, shadowOpacity: 0.25 },
            {
              opacity: popupAnim,
              transform: [
                {
                  scale: popupAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.popupHeader}>
            <Text style={[s.popupName, { color: colors.textPrimary }]}>{userName}</Text>
            <Text style={[s.popupRole, { color: colors.textMuted }]}>{session?.site?.name_ar || ''}</Text>
          </View>
          <View style={[s.popupDivider, { backgroundColor: colors.border }]} />

          <View style={s.popupSection}>
            <Text style={[s.popupSectionTitle, { color: colors.textSecondary }]}>{t("home.theme")}</Text>
            <View
              style={[s.segmentedControl, { backgroundColor: colors.surface }]}
              onLayout={(event) => setSegmentedWidth(event.nativeEvent.layout.width)}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  s.segmentIndicator,
                  {
                    right: segmentedAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, segmentedWidth / 3, (segmentedWidth * 2) / 3],
                    }),
                    width: segmentedWidth / 3,
                    backgroundColor: colors.brand,
                  },
                ]}
              />
              <Pressable
                onPress={() => setAppearance('dark')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'dark' }}
                style={s.segmentItem}
              >
                <Text style={[s.segmentText, { color: mode === 'dark' ? colors.onBrand : colors.textSecondary }]}>{t("home.dark")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setAppearance('light')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'light' }}
                style={s.segmentItem}
              >
                <Text style={[s.segmentText, { color: mode === 'light' ? colors.onBrand : colors.textSecondary }]}>{t("home.light")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setAppearance('system')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'system' }}
                style={s.segmentItem}
              >
                <Text style={[s.segmentText, { color: mode === 'system' ? colors.onBrand : colors.textSecondary }]}>{t("home.system")}</Text>
              </Pressable>
            </View>
          </View>

          <View style={[s.popupDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={() => {
              closeAccountMenu()
              onOpenProfile()
            }}
            accessibilityRole="button"
            accessibilityLabel={t("home.profile")}
            style={({ pressed }) => [s.popupItem, { backgroundColor: pressed ? colors.tintBrand : 'transparent' }]}
          >
            <Text style={[s.popupActionText, { color: colors.textPrimary }]}>{t("home.profile")}</Text>
            <Icon name="user" size={18} color={colors.brandText} accessible={false} />
          </Pressable>

          <View style={[s.popupDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={handleLogoutPress}
            accessibilityRole="button"
            accessibilityLabel={t("home.logoutItem")}
            style={({ pressed }) => [s.popupItem, { backgroundColor: pressed ? colors.tintCrimson : 'transparent' }]}
          >
            <View style={s.popupItemLabelWrap}>
              <Text style={[s.popupItemText, { color: colors.crimson }]}>{t("home.logoutItem")}</Text>
            </View>
            <Icon name="log-out" size={16} color={colors.crimson} accessible={false} />
          </Pressable>
        </Animated.View>
      </View>
    ) : null}
    </View>
  )
}

function Tile({
  label,
  iconName,
  onPress,
  tone,
  colors,
}: {
  label: string
  iconName?: string
  onPress: () => void
  tone: 'brand' | 'crimson'
  colors: {
    brand: string
    brandText: string
    crimson: string
    tintBrand: string
    tintCrimson: string
    surface: string
    border: string
    textPrimary: string
    textSecondary: string
    textMuted: string
  }
}) {
  const iconColor = tone === 'brand' ? colors.brandText : colors.crimson
  const iconBackground = tone === 'brand' ? colors.tintBrand : colors.tintCrimson
  const subtitle = tone === 'brand' ? t("home.subtitleEmployees") : t("home.subtitlePenalty")
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${t("common.listSeparator")}${subtitle}`}
      card
      style={[
        s.tile,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[s.tileIcon, { backgroundColor: iconBackground }]}>
        {iconName ? <Icon name={iconName} size={20} color={iconColor} accessible={false} /> : null}
      </View>
      <View style={s.tileText}>
        <Text style={[s.tileLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[s.tileSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      <Icon name="chevron-left" size={18} color={colors.textMuted} accessible={false} />
    </Pressable>
  )
}

function todayLabel(date: Date) {
  return formatDateShort(date)
}

function modeIndex(mode: 'system' | 'light' | 'dark') {
  return mode === 'system' ? 0 : mode === 'light' ? 1 : 2
}

function timeNow(date: Date) {
  return formatTime12(date)
}

function timeOf(iso: string | null) {
  if (!iso) return ''
  return formatTime12(new Date(iso))
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xxl, position: 'relative' },
  backgroundGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  header: {
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: spacing.md,
    position: 'relative',
    minHeight: 72,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  notifLtr: { direction: 'ltr' },
  headerText: { flex: 1, direction: 'ltr', alignItems: 'flex-end' },
  greeting: {
    fontSize: font.size.md,
    fontFamily: font.family,
    textAlign: 'right',
    alignSelf: 'flex-end',
    writingDirection: 'rtl',
    lineHeight: lineHeightFor(font.size.md),
    ...baseText,
  },
  siteRow: {
    flexDirection: 'row',
    direction: 'rtl',
    alignItems: 'center',
    gap: spacing.xs,
  },
  siteName: {
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  avatarPressable: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'visible',
    position: 'relative',
  },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
    textAlign: 'center',
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    position: 'absolute',
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  notifPressable: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    overflow: 'visible',
  },
  notifWrap: {
    position: 'relative',
  },
  badgeWrap: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: font.familyBold,
    textAlign: 'center',
    lineHeight: lineHeightFor(11),
    ...baseText,
  },
  popupBackdrop: {
    position: 'absolute',
    inset: 0,
    direction: 'ltr',
    zIndex: 100,
  },
  popup: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    direction: 'rtl',
    width: 280,
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xs,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 101,
  },
  popupHeader: {
    width: '100%',
    direction: 'ltr',
    padding: spacing.sm,
    gap: spacing.xs,
    alignSelf: 'stretch',
    alignItems: 'flex-end',
  },
  popupName: {
    width: '100%',
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    writingDirection: 'rtl',
    alignSelf: 'stretch',
    lineHeight: lineHeightFor(font.size.base),
    ...baseText,
  },
  popupRole: {
    width: '100%',
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    writingDirection: 'rtl',
    alignSelf: 'stretch',
    lineHeight: lineHeightFor(font.size.sm),
    ...baseText,
  },
  popupItemText: {
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
    flexShrink: 0,
    writingDirection: 'rtl',
    lineHeight: lineHeightFor(font.size.md),
    ...baseText,
  },
  popupActionText: {
    flex: 1,
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: lineHeightFor(font.size.md),
    ...baseText,
  },
  popupSectionTitle: {
    width: '100%',
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    writingDirection: 'rtl',
    alignSelf: 'stretch',
    marginBottom: spacing.xs,
    lineHeight: lineHeightFor(font.size.sm),
    ...baseText,
  },
  popupDivider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  popupItem: {
    width: '100%',
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: spacing.sm,
    borderRadius: radius.sm,
    minHeight: 48,
  },
  popupItemLabelWrap: {
    flexDirection: 'row',
    direction: 'rtl',
    justifyContent: 'flex-start',
    gap: spacing.xs,
    width: 180,
    alignItems: 'center',
  },
  popupSection: {
    width: '100%',
    direction: 'ltr',
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
  },
  segmentedControl: {
    width: '100%',
    flexDirection: 'row',
    direction: 'ltr',
    borderRadius: radius.md,
    overflow: 'hidden',
    height: 40,
    position: 'relative',
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: font.size.sm,
    fontFamily: font.familyMedium,
    textAlign: 'center',
    lineHeight: lineHeightFor(font.size.sm),
    ...baseText,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.md,
  },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardLabel: {
    flex: 1,
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
    textAlign: 'right',
    lineHeight: lineHeightFor(font.size.md),
    ...baseText,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: lineHeightFor(20),
    fontFamily: font.familySemiBold,
    ...baseText,
  },
  requestsTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  countPill: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
    lineHeight: lineHeightFor(font.size.sm),
    ...baseText,
  },
  state: {
    fontSize: font.size.title,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    marginBottom: spacing.lg,
    lineHeight: lineHeightFor(font.size.title),
    ...baseText,
  },
  hint: {
    fontSize: 12,
    fontFamily: font.family,
    textAlign: 'right',
    marginTop: spacing.sm,
    lineHeight: lineHeightFor(12),
    ...baseText,
  },
  todayError: { gap: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  punchCard: {
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.hero,
    overflow: 'hidden',
    gap: spacing.md,
  },
  heroLight: {
    position: 'absolute',
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 1,
    opacity: 0.65,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  todayStatusWrap: { flex: 1, alignItems: 'flex-start', paddingTop: 2 },
  todayStatus: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  heroClock: { alignItems: 'flex-end' },
  heroTime: {
    fontSize: 32,
    lineHeight: lineHeightFor(32),
    fontFamily: font.familyBold,
    fontVariant: ['tabular-nums'],
    ...baseText,
  },
  heroDate: { fontSize: 12, lineHeight: lineHeightFor(12), fontFamily: font.family, ...baseText },
  heroAction: { alignItems: 'center', justifyContent: 'center', minHeight: 194 },
  pulseRing: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  pulseRingInner: { width: 154, height: 154 },
  punchCircle: {
    width: 140,
    height: 140,
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  punchCircleGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  punchTime: { fontSize: 15, lineHeight: lineHeightFor(15), fontFamily: font.familyBold, ...baseText },
  punchLabel: {
    alignSelf: 'stretch',
    fontSize: 16,
    lineHeight: lineHeightFor(16),
    fontFamily: font.familyBold,
    marginTop: spacing.sm,
    textAlign: 'center',
    ...baseText,
  },
  locationChip: {
    minHeight: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  locationDot: { width: 7, height: 7, borderRadius: radius.pill },
  locationText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    lineHeight: lineHeightFor(12),
    fontFamily: font.familySemiBold,
    textAlign: 'center',
    ...baseText,
  },
  requestsCard: { padding: spacing.lg, borderRadius: radius.xl },
  emptyState: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAllButton: { width: 132, minHeight: 44, paddingHorizontal: spacing.sm },
  emptyStateText: { fontSize: 13, lineHeight: lineHeightFor(13), fontFamily: font.family, textAlign: 'center', ...baseText },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  retryText: {
    fontSize: font.size.base,
    lineHeight: lineHeightFor(font.size.base),
    fontFamily: font.familySemiBold,
    ...baseText,
  },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 100,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { flex: 1, gap: spacing.xs },
  tileLabel: {
    fontSize: 15,
    lineHeight: lineHeightFor(15),
    fontFamily: font.familySemiBold,
    textAlign: 'right',
    ...baseText,
  },
  tileSubtitle: {
    fontSize: 12,
    lineHeight: lineHeightFor(12),
    fontFamily: font.family,
    textAlign: 'right',
    ...baseText,
  },
})
