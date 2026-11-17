import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, messageFor } from '../api/client'
import type { ApprovalRequestSummary, RequestType } from '../api/types'
import { font, radius, spacing, type ThemeColors } from '../theme/tokens'
import { useTheme } from '../theme/ThemeProvider'
import { Icon } from '../components/Icon'
import { ScreenHeader } from '../components/ui'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { getRequestTypeAppearance } from '../constants/requestTypes'

const FILTERS: { key: RequestType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'الكل', icon: 'view-grid-outline' },
  { key: 'leave', label: 'إجازة', icon: 'palm-tree' },
  { key: 'loan', label: 'سلفة', icon: 'cash-fast' },
  { key: 'mission', label: 'إذن', icon: 'clock-out' },
  { key: 'penalty', label: 'جزاء', icon: 'gavel' },
]

interface Props {
  onOpenRequest: (id: string) => void
  onBack?: () => void
}

export default function InboxScreen({ onOpenRequest, onBack }: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<'pending' | 'decided'>('pending')
  const [filter, setFilter] = useState<RequestType | 'all'>('all')
  const [rows, setRows] = useState<ApprovalRequestSummary[]>([])
  const [allRows, setAllRows] = useState<ApprovalRequestSummary[]>([])
  const [allCount, setAllCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [segmentWidth, setSegmentWidth] = useState(0)
  const segmentPosition = useRef(new Animated.Value(0)).current
  const requestSequence = useRef(0)

  useEffect(() => {
    Animated.timing(segmentPosition, {
      toValue: tab === 'pending' ? 0 : 1,
      duration: 180,
      useNativeDriver: false,
    }).start()
  }, [segmentPosition, tab])

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current
    setError(null)
    try {
      const res = await api.inbox({
        status: tab,
        type: filter === 'all' ? undefined : filter,
      })
      if (requestId !== requestSequence.current) return
      setRows(res.results)
      if (filter === 'all') {
        setAllRows(res.results)
        setAllCount(res.count)
        if (tab === 'pending') setPendingCount(res.count)
      }
    } catch (e) {
      if (requestId === requestSequence.current) setError(messageFor(e))
    }
  }, [filter, tab])

  useEffect(() => {
    let alive = true
    setLoading(true)
    load().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="صندوق الطلبات" onBack={onBack} />

      <View
        style={[s.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
      >
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              s.segmentIndicator,
              {
                width: (segmentWidth - spacing.xs * 2) / 2,
                right: Animated.add(
                  segmentPosition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [(segmentWidth - spacing.xs * 2) / 2, 0],
                  }),
                  spacing.xs,
                ),
                backgroundColor: colors.tintBrand,
                borderColor: colors.brand,
              },
            ]}
          />
        ) : null}
        <Tab
          label="منتظر قراري"
          badge={pendingCount > 0 ? pendingCount : undefined}
          active={tab === 'pending'}
          onPress={() => {
            if (tab === 'pending') void onRefresh()
            else setTab('pending')
          }}
          colors={colors}
        />
        <Tab
          label="تم البت"
          active={tab === 'decided'}
          onPress={() => {
            if (tab === 'decided') void onRefresh()
            else setTab('decided')
          }}
          colors={colors}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filters}
      >
        {FILTERS.map((item) => {
          const active = filter === item.key
          const typeAppearance = item.key === 'all' ? null : getRequestTypeAppearance(item.key, colors)
          const iconColor = active
            ? colors.brandText
            : typeAppearance?.color ?? colors.textMuted
          const typeCount = item.key === 'all'
            ? allCount
            : allRows.filter((row) => row.request_type === item.key).length

          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                s.chip,
                {
                  backgroundColor: active ? colors.tintBrand : colors.surface,
                  borderColor: active ? colors.brand : colors.border,
                },
              ]}
            >
              <Icon
                name={item.icon}
                family="material-community"
                size={16}
                color={iconColor}
                accessible={false}
              />
              <Text style={[s.chipText, { color: active ? colors.brandText : colors.textSecondary }]}>
                {item.label}
              </Text>
              <Text style={[s.chipCount, { color: active ? colors.brandText : colors.textMuted }]}>
                {typeCount.toLocaleString('ar-EG-u-nu-latn')}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {loading ? (
        <View style={s.list}>
          {[0, 1, 2, 3].map((index) => <SkeletonRow key={index} colors={colors} />)}
        </View>
      ) : error ? (
        <View style={s.center}>
          <Icon name="alert-circle" size={32} color={colors.crimson} accessible={false} />
          <Text style={[s.error, { color: colors.textMuted }]}>{error}</Text>
          <Pressable
            onPress={onRefresh}
            style={[s.retry, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[s.retryText, { color: colors.textPrimary }]}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.list,
            { paddingBottom: 88 + 24 + insets.bottom },
            rows.length === 0 && s.emptyList,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          }
          ListEmptyComponent={<EmptyState decided={tab === 'decided'} colors={colors} />}
          ListFooterComponent={
            rows.length > 0 ? (
              <Text style={[s.foot, { color: colors.textMuted }]}>
                يظهر هنا ما ينتظر قرارك أنت فقط، حسب صلاحياتك وسير الاعتماد.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <RequestCard item={item} onPress={() => onOpenRequest(item.id)} colors={colors} />
          )}
        />
      )}
    </View>
  )
}

function Tab({
  label,
  badge,
  active,
  onPress,
  colors,
}: {
  label: string
  badge?: number
  active: boolean
  onPress: () => void
  colors: ThemeColors
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={s.tab}
    >
      <Text style={[
        s.tabText,
        { color: active ? colors.brandText : colors.textSecondary },
        active && { fontFamily: font.familyBold },
      ]}>
        {label}
      </Text>
      {badge !== undefined ? (
        <View style={[s.tabBadge, { backgroundColor: colors.badgeCrimson }]}>
          <Text style={[s.tabBadgeText, { color: colors.onCrimson }]}>
            {badge > 99 ? '99+' : badge.toLocaleString('ar-EG-u-nu-latn')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function RequestCard({
  item,
  onPress,
  colors,
}: {
  item: ApprovalRequestSummary
  onPress: () => void
  colors: ThemeColors
}) {
  const appearance = getRequestTypeAppearance(item.request_type, colors)
  const timestamp = new Date(item.source_created_at).getTime()
  const ageInHours = Number.isNaN(timestamp) ? 0 : (Date.now() - timestamp) / 3_600_000
  const date = formatRequestDate(item.source_created_at)

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.employee.full_name_ar}، ${appearance.label}`}
      card
      style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={s.cardRow}>
        <View style={[s.requestIcon, { backgroundColor: appearance.tintBg }]}>
          <Icon
            name={appearance.icon}
            family="material-community"
            size={24}
            color={appearance.color}
            accessible={false}
          />
        </View>
        <View style={s.cardText}>
          <Text style={[s.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.employee.full_name_ar}
          </Text>
          <View style={[s.typeBadge, { backgroundColor: appearance.tintBg }]}>
            <Text style={[s.typeBadgeText, { color: appearance.color }]} numberOfLines={1}>
              {appearance.label}
            </Text>
          </View>
          <Text style={[s.detail, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.title}{item.subtitle ? ` · ${item.subtitle}` : ''}
          </Text>
        </View>
        <View style={s.cardMeta}>
          <View style={s.dateRow}>
            {date && ageInHours > 48 ? <View style={[s.staleDot, { backgroundColor: colors.warning }]} /> : null}
            <Text style={[s.when, { color: colors.textMuted }]} numberOfLines={1}>{date}</Text>
          </View>
          <Icon name="chevron-left" size={18} color={colors.textMuted} accessible={false} />
        </View>
      </View>
    </Pressable>
  )
}

function EmptyState({ decided, colors }: { decided: boolean; colors: ThemeColors }) {
  return (
    <View style={s.emptyState}>
      <View style={[s.emptyIcon, { backgroundColor: colors.tintBrand }]}>
        <Icon name="inbox" size={34} color={colors.brandText} accessible={false} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>لا توجد طلبات</Text>
      <Text style={[s.emptyDescription, { color: colors.textMuted }]}>
        {decided ? 'ستظهر هنا الطلبات التي تم البت فيها.' : 'لا توجد طلبات تنتظر قرارك الآن.'}
      </Text>
    </View>
  )
}

function SkeletonRow({ colors }: { colors: ThemeColors }) {
  return (
    <View style={[s.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[s.skeletonIcon, { backgroundColor: colors.surfaceElevated }]} />
      <View style={s.skeletonText}>
        <View style={[s.skeletonName, { backgroundColor: colors.surfaceElevated }]} />
        <View style={[s.skeletonDetail, { backgroundColor: colors.surfaceElevated }]} />
      </View>
    </View>
  )
}

function formatRequestDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' })
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  tabText: { fontSize: font.size.base, fontFamily: font.familyMedium },
  tabBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { fontSize: font.size.xs, fontFamily: font.familyBold },
  filterScroll: { flexGrow: 0, height: 60, direction: 'rtl' },
  filters: {
    flexDirection: 'row',
    direction: 'rtl',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  chip: {
    height: 36,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: font.size.sm, fontFamily: font.familyMedium },
  chipCount: { fontSize: font.size.xs, fontFamily: font.familySemiBold },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 20, padding: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, direction: 'rtl' },
  requestIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, alignItems: 'flex-start', gap: spacing.xs },
  name: { alignSelf: 'stretch', textAlign: 'right', fontSize: 15, fontFamily: font.familyBold },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  typeBadgeText: { fontSize: font.size.xs, fontFamily: font.familySemiBold },
  detail: { alignSelf: 'stretch', textAlign: 'right', fontSize: font.size.md, lineHeight: 20, fontFamily: font.family },
  cardMeta: { width: 64, flexShrink: 0, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between' },
  dateRow: { width: '100%', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  staleDot: { width: 7, height: 7, borderRadius: radius.pill },
  when: { fontSize: font.size.xs, fontFamily: font.family, textAlign: 'left' },
  skeletonCard: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skeletonIcon: { width: 48, height: 48, borderRadius: 14 },
  skeletonText: { flex: 1, gap: spacing.sm },
  skeletonName: { width: '65%', height: 16, borderRadius: radius.sm },
  skeletonDetail: { width: '90%', height: 13, borderRadius: radius.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  error: { fontSize: font.size.base, fontFamily: font.family, textAlign: 'center', lineHeight: 24 },
  retry: { paddingHorizontal: spacing.xl, minHeight: 44, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  retryText: { fontSize: font.size.base, fontFamily: font.familySemiBold },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 76, height: 76, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: font.size.title, fontFamily: font.familySemiBold },
  emptyDescription: { fontSize: font.size.sm, fontFamily: font.family, textAlign: 'center' },
  foot: { fontSize: font.size.sm, fontFamily: font.family, textAlign: 'center', marginVertical: spacing.sm },
})
