import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, BackHandler, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import HomeScreen from '../screens/HomeScreen'
import InboxScreen from '../screens/InboxScreen'
import RequestDetailScreen from '../screens/RequestDetailScreen'
import EmployeePickerScreen from '../screens/EmployeePickerScreen'
import PenaltyFlow from '../screens/PenaltyFlow'
import { useAuth } from '../auth/AuthContext'
import { useBadge } from '../hooks/useBadge'
import { Icon } from '../components/Icon'
import { colors, font, radius, spacing } from '../theme/tokens'

/**
 * Navigation without react-navigation.
 *
 * Three tabs and two pushed screens do not need a navigation library, its
 * peer dependencies, or its native gesture setup. When this grows a deep
 * stack or deep links from notifications, swap it — the screens take plain
 * callback props precisely so that swap touches only this file.
 */

type Tab = 'home' | 'inbox' | 'employees'
type Pushed =
  | { screen: 'requestDetail'; id: string }
  | { screen: 'penalty' }
  | null

export default function AppNavigator() {
  const { session } = useAuth()
  const { counts, refresh: refreshBadge } = useBadge()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('home')
  const [pushed, setPushed] = useState<Pushed>(null)
  /** Bumped to force the inbox to refetch after a decision. */
  const [inboxEpoch, setInboxEpoch] = useState(0)
  /** True while a pushed screen holds edits it has not saved. */
  const dirtyRef = useRef(false)
  /** Set by a pushed screen that has a nested screen of its own to close first. */
  const nestedBackRef = useRef<(() => void) | null>(null)

  const pending = counts?.pending_approvals_count ?? null

  /** A decision changes the count, so re-read it rather than wait for the tick. */
  function afterWrite() {
    setInboxEpoch((n) => n + 1)
    setPushed(null)
    refreshBadge()
  }

  /** Leaving a screen with unsaved input asks first: the reason text is real work. */
  const closePushed = useCallback(() => {
    if (dirtyRef.current) {
      Alert.alert('تجاهل التغييرات؟', 'لديك بيانات لم تُحفظ. الخروج الآن يعني فقدانها.', [
        { text: 'متابعة التحرير', style: 'cancel' },
        {
          text: 'خروج دون حفظ',
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    dirtyRef.current = false
    nestedBackRef.current = null
  }, [pushed, tab])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pushed === null) {
        // A tab other than home goes home; home lets Android close the app.
        if (tab !== 'home') {
          setTab('home')
          return true
        }
        return false
      }
      // A nested screen (the penalty employee picker) closes first and loses
      // nothing, so it bypasses the unsaved-edits question.
      const nested = nestedBackRef.current
      if (nested) {
        nested()
        return true
      }
      closePushed()
      return true
    })
    return () => sub.remove()
  }, [pushed, tab, closePushed])

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

  const canApprove = session?.capabilities.can_approve ?? false

  return (
    <View style={s.root}>
      <View style={s.content}>
        {tab === 'home' ? (
          <HomeScreen
            pendingCount={pending}
            onOpenInbox={() => setTab('inbox')}
            onOpenPenalty={() => setPushed({ screen: 'penalty' })}
            onOpenEmployees={() => setTab('employees')}
            onCompanyChanged={() => {
              setInboxEpoch((n) => n + 1)
              refreshBadge()
            }}
          />
        ) : tab === 'inbox' ? (
          <InboxScreen
            key={inboxEpoch}
            onOpenRequest={(id) => setPushed({ screen: 'requestDetail', id })}
          />
        ) : (
          <EmployeePickerScreen onBack={() => setTab('home')} />
        )}
      </View>

      <View style={[s.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TabButton
          label="الرئيسية"
          active={tab === 'home'}
          icon="home"
          onPress={() => setTab('home')}
        />
        {canApprove ? (
          <TabButton
            label="الطلبات"
            active={tab === 'inbox'}
            icon="inbox"
            badge={pending}
            onPress={() => setTab('inbox')}
          />
        ) : null}
        <TabButton
          label="الموظفين"
          active={tab === 'employees'}
          icon="users"
          onPress={() => setTab('employees')}
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
}: {
  label: string
  active: boolean
  badge?: number | null
  icon?: string
  onPress: () => void
}) {
  const showBadge = typeof badge === 'number' && badge > 0
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={showBadge ? `${label}، ${badge} بانتظار قرارك` : label}
      hitSlop={8}
      style={s.tab}
    >
      <View style={s.tabLabelRow}>
        {icon ? (
          <View style={s.tabIconWrap}>
            <Icon
              name={icon}
              size={24}
              color={active ? colors.teal : '#64748B'}
              accessible={false}
            />
            {showBadge ? (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeText}>{badge > 99 ? '٩٩+' : badge}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={active ? s.tabTextActive : s.tabText}>{label}</Text>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { flex: 1 },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.header,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    minHeight: 64,
    paddingBottom: 12,
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
  indicatorActive: { backgroundColor: colors.teal },
  tabIconWrap: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: colors.page,
    fontSize: 10,
    fontFamily: font.familyBold,
    textAlign: 'center',
  },
  tabLabelRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabText: {
    color: '#64748B',
    fontSize: font.size.sm,
    fontFamily: font.familyMedium,
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.teal,
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
    textAlign: 'center',
  },
})
