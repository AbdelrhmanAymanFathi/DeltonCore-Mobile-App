import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { api, messageFor } from '../api/client'
import type { ApprovalRequestSummary, RequestType } from '../api/types'
import { colors, font, radius, requestTypeBadge, spacing } from '../theme/tokens'

const FILTERS: { key: RequestType | 'all'; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'leave', label: 'إجازة' },
  { key: 'loan', label: 'سلفة' },
  { key: 'mission', label: 'إذن' },
  { key: 'penalty', label: 'جزاء' },
]

interface Props {
  onOpenRequest: (id: string) => void
}

export default function InboxScreen({ onOpenRequest }: Props) {
  const [tab, setTab] = useState<'pending' | 'decided'>('pending')
  const [filter, setFilter] = useState<RequestType | 'all'>('all')
  const [rows, setRows] = useState<ApprovalRequestSummary[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.inbox({
        status: tab,
        type: filter === 'all' ? undefined : filter,
      })
      setRows(res.results)
      setCount(res.count)
    } catch (e) {
      setError(messageFor(e))
    }
  }, [tab, filter])

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
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>صندوق الطلبات</Text>
      </View>

      <View style={s.tabs}>
        <Tab
          label="منتظر قراري"
          badge={tab === 'pending' ? count : undefined}
          active={tab === 'pending'}
          onPress={() => setTab('pending')}
        />
        <Tab
          label="تم البت فيه"
          active={tab === 'decided'}
          onPress={() => setTab('decided')}
        />
      </View>

      <View style={s.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              style={[s.chip, active ? s.chipActive : s.chipIdle]}
            >
              <Text style={active ? s.chipTextActive : s.chipText}>{f.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.teal} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.error}>{error}</Text>
          <Pressable onPress={onRefresh} style={s.retry} accessibilityRole="button">
            <Text style={s.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
            />
          }
          ListEmptyComponent={
            <Text style={s.empty}>
              {tab === 'pending'
                ? 'لا يوجد ما ينتظر قرارك الآن.'
                : 'لم تبتّ في أي طلب بعد.'}
            </Text>
          }
          ListFooterComponent={
            rows.length > 0 ? (
              <Text style={s.foot}>
                يظهر هنا ما ينتظر قرارك أنت فقط، حسب صلاحياتك وسير الاعتماد.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <RequestCard item={item} onPress={() => onOpenRequest(item.id)} />
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
}: {
  label: string
  badge?: number
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" style={s.tab}>
      <View style={[s.tabInner, active && s.tabActive]}>
        <Text style={active ? s.tabTextActive : s.tabText}>{label}</Text>
        {badge !== undefined ? (
          <View style={s.tabBadge}>
            <Text style={s.tabBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

function RequestCard({
  item,
  onPress,
}: {
  item: ApprovalRequestSummary
  onPress: () => void
}) {
  const badge = requestTypeBadge[item.request_type]
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
    >
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <View style={[s.typeBadge, { backgroundColor: badge.bg }]}>
            <Text style={[s.typeBadgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
          <Text style={s.when}>{relativeTime(item.source_created_at)}</Text>
        </View>
        <Text style={s.name} numberOfLines={1}>
          {item.employee.full_name_ar}
        </Text>
        <Text style={s.detail} numberOfLines={1}>
          {item.title} · {item.subtitle}
        </Text>
      </View>
    </Pressable>
  )
}

/** Arabic relative time, coarse on purpose — exact minutes help nobody here. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 60) return 'منذ دقائق'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours === 1 ? 'منذ ساعة' : `منذ ${hours} ساعات`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'أمس'
  if (days < 7) return `منذ ${days} أيام`
  return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  header: {
    backgroundColor: colors.header,
    paddingTop: 52,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: font.size.title,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    gap: 24,
  },
  tab: { paddingVertical: 2 },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.teal },
  tabText: {
    color: colors.textFaint,
    fontSize: font.size.base,
    fontFamily: font.familyMedium,
  },
  tabTextActive: {
    color: colors.teal,
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.tealSurface,
  },
  tabBadgeText: {
    color: colors.tealBright,
    fontSize: font.size.xs,
    fontFamily: font.familySemiBold,
  },
  filters: {
    flexDirection: 'row',
    gap: 7,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  chipIdle: {
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  chipActive: { backgroundColor: colors.inputBg },
  chipText: {
    color: colors.textMuted,
    fontSize: font.size.sm,
    fontFamily: font.familyMedium,
  },
  chipTextActive: {
    color: colors.inputText,
    fontSize: font.size.sm,
    fontFamily: font.familySemiBold,
  },
  list: { padding: spacing.lg, gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardPressed: { backgroundColor: colors.cardRaised },
  cardBody: { gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  typeBadgeText: { fontSize: font.size.xs, fontFamily: font.familySemiBold },
  when: {
    color: colors.textFaint,
    fontSize: font.size.sm,
    fontFamily: font.family,
  },
  name: {
    color: colors.text,
    fontSize: font.size.lg,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  detail: {
    color: colors.textMuted,
    fontSize: font.size.md,
    fontFamily: font.family,
    textAlign: 'right',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  error: {
    color: colors.textMuted,
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    lineHeight: 24,
  },
  retry: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  retryText: {
    color: colors.textStrong,
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
  },
  empty: {
    color: colors.textFaint,
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    marginTop: 60,
  },
  foot: {
    color: colors.textFaint,
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})
