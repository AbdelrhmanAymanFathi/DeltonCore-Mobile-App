import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Alert, Animated, BackHandler, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import HomeScreen from '../screens/HomeScreen'
import InboxScreen from '../screens/InboxScreen'
import RequestDetailScreen from '../screens/RequestDetailScreen'
import EmployeePickerScreen from '../screens/EmployeePickerScreen'
import PenaltyFlow from '../screens/PenaltyFlow'
import ProfileScreen from '../screens/ProfileScreen'
import { useAuth } from '../auth/AuthContext'
import { useBadge } from '../hooks/useBadge'
import { Icon } from '../components/Icon'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing, lineHeightFor, baseText } from '../theme/tokens'
import { t, formatNumber, tCount } from '../i18n'
import { REQUEST_FORMS } from '../i18n/plural'

type Tab = 'home' | 'inbox' | 'employees'
type Pushed =
  | { screen: 'requestDetail'; id: string }
  | { screen: 'penalty' }
  | { screen: 'profile' }
  | null

export default function AppNavigator() {
  const { colors, isDark } = useTheme()
  const { session } = useAuth()
  const { counts, refresh: refreshBadge } = useBadge()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('home')
  const [reduceMotion, setReduceMotion] = useState(false)
  const [pushed, setPushed] = useState<Pushed>(null)
  const [inboxEpoch, setInboxEpoch] = useState(0)
  const dirtyRef = useRef(false)
  const nestedBackRef = useRef<(() => void) | null>(null)

  const pending = counts?.pending_approvals_count ?? null
  const switchTab = useCallback((next: Tab) => setTab(next), [])

  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  function afterWrite() {
    setInboxEpoch((n) => n + 1)
    setPushed(null)
    refreshBadge()
  }

  const closePushed = useCallback(() => {
    if (dirtyRef.current) {
      Alert.alert(t("nav.discardTitle"), t("nav.discardBody"), [
        { text: t("nav.discardKeep"), style: 'cancel' },
        {
          text: t("nav.discardLeave"),
          style: 'destructive',
          onPress: () => {
            dirtyRef.current = false
            setPushed(null)
          },
        },
      ])
      return
    }
    setPushed(null)
  }, [])

  useEffect(() => {
    dirtyRef.current = false
    nestedBackRef.current = null
  }, [pushed, tab])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pushed === null) {
        if (tab !== 'home') {
          switchTab('home')
          return true
        }
        return false
      }
      const nested = nestedBackRef.current
      if (nested) {
        nested()
        return true
      }
      closePushed()
      return true
    })
    return () => sub.remove()
  }, [pushed, tab, closePushed, switchTab])

  if (pushed?.screen === 'requestDetail') {
    return (
      <RequestDetailScreen
        requestId={pushed.id}
        onBack={closePushed}
        onDecided={afterWrite}
        onUnsavedChange={(dirty) => {
          dirtyRef.current = dirty
        }}
      />
    )
  }

  if (pushed?.screen === 'penalty') {
    return (
      <PenaltyFlow
        onBack={closePushed}
        onDone={afterWrite}
        backRef={nestedBackRef}
        onUnsavedChange={(dirty) => {
          dirtyRef.current = dirty
        }}
      />
    )
  }

  if (pushed?.screen === 'profile') {
    return <ProfileScreen onBack={closePushed} />
  }

  const canApprove = session?.capabilities.can_approve ?? false

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.content}>
        {tab === 'home' ? (
          <HomeScreen
            pendingCount={pending}
            onOpenInbox={() => switchTab('inbox')}
            onOpenPenalty={() => setPushed({ screen: 'penalty' })}
            onOpenEmployees={() => switchTab('employees')}
            onOpenProfile={() => setPushed({ screen: 'profile' })}
            onCompanyChanged={() => {
              setInboxEpoch((n) => n + 1)
              refreshBadge()
            }}
          />
        ) : tab === 'inbox' ? (
          <InboxScreen
            key={inboxEpoch}
            onOpenRequest={(id) => setPushed({ screen: 'requestDetail', id })}
            onBack={() => switchTab('home')}
          />
        ) : (
          <EmployeePickerScreen onBack={() => switchTab('home')} />
        )}
      </View>

      <View style={[
        s.bar,
        {
          marginHorizontal: spacing.md,
          marginBottom: Math.max(insets.bottom, spacing.sm),
          paddingBottom: spacing.sm,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...(isDark ? {} : {
            shadowColor: colors.brandDeep,
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 5,
          }),
        },
      ]}>
        <TabButton
          label={t("nav.home")}
          active={tab === 'home'}
          icon="home"
          onPress={() => switchTab('home')}
          colors={colors}
          reduceMotion={reduceMotion}
        />
        {canApprove ? (
          <TabButton
            label={t("nav.requests")}
            active={tab === 'inbox'}
            icon="inbox"
            badge={pending}
            onPress={() => switchTab('inbox')}
            colors={colors}
            reduceMotion={reduceMotion}
          />
        ) : null}
        <TabButton
          label={t("nav.employees")}
          active={tab === 'employees'}
          icon="users"
          onPress={() => switchTab('employees')}
          colors={colors}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  )
}

function TabButton({
  label,
  active,
  badge,
  icon,
  onPress,
  colors,
  reduceMotion,
}: {
  label: string
  active: boolean
  badge?: number | null
  icon?: string
  onPress: () => void
  colors: {
    brandText: string
    tintBrand: string
    textMuted: string
    crimson: string
    badgeCrimson: string
    onCrimson: string
    surface: string
  }
  reduceMotion: boolean
}) {
  const showBadge = typeof badge === 'number' && badge > 0
  const pillOpacity = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) {
      pillOpacity.setValue(active ? 1 : 0)
      return
    }
    Animated.timing(pillOpacity, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [active, pillOpacity, reduceMotion])

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={showBadge ? t("nav.badgeA11y", { label, count: tCount(badge, REQUEST_FORMS) }) : label}
      hitSlop={8}
      style={s.tab}
    >
      <View style={s.tabLabelRow}>
        {icon ? (
          <View style={s.tabIconWrap}>
            <Animated.View
              pointerEvents="none"
              style={[s.tabPill, { backgroundColor: colors.tintBrand, opacity: pillOpacity }]}
            />
            <Icon
              name={icon}
              size={24}
              color={active ? colors.brandText : colors.textMuted}
              accessible={false}
            />
            {showBadge ? (
              <View style={[s.tabBadge, { backgroundColor: colors.badgeCrimson, borderColor: colors.surface }]}>
                <Text style={[s.tabBadgeText, { color: colors.onCrimson }]}>{badge > 99 ? '99+' : formatNumber(badge)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={[
          s.tabLabelBase,
          active ? { color: colors.brandText, fontFamily: font.familyBold } : { color: colors.textMuted, fontFamily: font.familySemiBold },
        ]}>{label}</Text>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  bar: {
    flexDirection: 'row',
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.xl + spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  indicator: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: [{ translateX: -11 }],
  },
  tabIconWrap: {
    position: 'relative',
    direction: 'ltr',
    width: 42,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: radius.pill,
    minWidth: 18,
    height: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontFamily: font.familyBold,
    textAlign: 'center',
    lineHeight: lineHeightFor(11),
    ...baseText,
  },
  tabLabelRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabelBase: {
    fontSize: font.size.sm,
    textAlign: 'center',
    lineHeight: lineHeightFor(font.size.sm),
    ...baseText,
  },
})
