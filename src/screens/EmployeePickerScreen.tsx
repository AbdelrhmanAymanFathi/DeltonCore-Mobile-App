import React, { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { api, messageFor } from '../api/client'
import type { SiteEmployee } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ScreenHeader, SolidButton } from '../components/ui'
import { Icon } from '../components/Icon'
import { colors, elevation, font, radius, spacing } from '../theme/tokens'

interface Props {
  title?: string
  onBack: () => void
  /** Omitted when the screen is used as a read-only directory. */
  onPick?: (employee: SiteEmployee) => void
}

export default function EmployeePickerScreen({ title, onBack, onPick }: Props) {
  const { session } = useAuth()
  const siteId = session?.site?.id ?? null

  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<SiteEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (q: string) => {
      if (siteId === null) {
        setError('حسابك غير مرتبط بموقع، فلا توجد قائمة موظفين لعرضها.')
        setLoading(false)
        return
      }
      setError(null)
      try {
        const res = await api.siteEmployees(siteId, q || undefined)
        setRows(res.results)
      } catch (e) {
        setError(messageFor(e))
      } finally {
        setLoading(false)
      }
    },
    [siteId],
  )

  // Debounced so typing a name does not fire a request per keystroke on a
  // field connection.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      load(query.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [query, load])

  return (
    <View style={s.screen}>
      <ScreenHeader title={title ?? 'موظفو الموقع'} onBack={onBack} />

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث بالاسم أو الرقم الوظيفي"
          placeholderTextColor={colors.inputPlaceholder}
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={s.list}>
          {[0, 1, 2].map((i) => (
            <EmployeeSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.centerText}>{error}</Text>
          <SolidButton
            label="إعادة المحاولة"
            tone="neutral"
            onPress={() => load(query.trim())}
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Icon name="users" size={32} color={colors.textFaint} accessible={false} />
              <Text style={s.empty}>
                {query ? 'لا نتائج مطابقة.' : 'لا يوجد موظفون في هذا الموقع.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPick?.(item)}
              disabled={!onPick}
              accessibilityRole={onPick ? 'button' : 'text'}
              style={({ pressed }) => [s.row, pressed && onPick && s.rowPressed]}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={s.rowText}>
                <Text style={s.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={s.rowMeta}>{item.employee_number}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]).join(' ')
}

function EmployeeSkeleton() {
  return (
    <Pressable style={s.skeletonRow} accessibilityRole="button">
      <View style={s.skeletonAvatar} />
      <View style={s.skeletonText}>
        <View style={s.skeletonLine} />
        <View style={[s.skeletonLine, { width: '60%' }]} />
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  searchWrap: {
    padding: spacing.lg,
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  search: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    fontSize: font.size.lg,
    fontFamily: font.family,
    textAlign: 'right',
  },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 64,
  },
  rowPressed: { backgroundColor: colors.cardRaised },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.tealSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.tealBright,
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
  },
  rowText: { flex: 1 },
  rowName: {
    color: colors.text,
    fontSize: font.size.base,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  rowMeta: {
    color: colors.textFaint,
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
    marginTop: 2,
  },
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
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 64,
    marginBottom: spacing.sm,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.cardRaised,
  },
  skeletonText: { flex: 1 },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.cardRaised,
    marginBottom: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: spacing.md,
  },
  empty: {
    color: colors.textFaint,
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
  },
})
