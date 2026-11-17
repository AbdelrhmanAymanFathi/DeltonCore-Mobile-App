import React, { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { api, messageFor } from '../api/client'
import type { SiteEmployee } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ScreenHeader, SolidButton } from '../components/ui'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { Icon } from '../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing } from '../theme/tokens'

interface Props {
  title?: string
  onBack: () => void
  onPick?: (employee: SiteEmployee) => void
}

export default function EmployeePickerScreen({ title, onBack, onPick }: Props) {
  const { colors } = useTheme()
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

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      load(query.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [query, load])

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title={title ?? 'موظفو الموقع'} onBack={onBack} />

      <View style={[s.searchWrap, { borderBottomColor: colors.border }]}>
        <TextInput
          style={[s.search, { backgroundColor: colors.inputBg, color: colors.inputText }]}
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
            <EmployeeSkeleton key={i} colors={colors} />
          ))}
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={[s.centerText, { color: colors.textMuted }]}>{error}</Text>
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
              <Icon name="users" size={32} color={colors.textMuted} accessible={false} />
              <Text style={[s.empty, { color: colors.textMuted }]}>
                {query ? 'لا نتائج مطابقة.' : 'لا يوجد موظفون في هذا الموقع.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPick?.(item)}
              disabled={!onPick}
              accessibilityRole={onPick ? 'button' : 'text'}
              card
              style={({ pressed }) => [
                s.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && onPick && { backgroundColor: colors.background },
              ]}
            >
              <View style={[s.avatar, { backgroundColor: colors.tintBrand }]}>
                <Text style={[s.avatarText, { color: colors.brandText }]}>{initials(item.name)}</Text>
              </View>
              <View style={s.rowText}>
                <Text style={[s.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[s.rowMeta, { color: colors.textMuted }]}>{item.employee_number}</Text>
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

function EmployeeSkeleton({ colors }: { colors: { surface: string; border: string; surfaceElevated: string } }) {
  return (
    <View style={[s.skeletonRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[s.skeletonAvatar, { backgroundColor: colors.surfaceElevated }]} />
      <View style={s.skeletonText}>
        <View style={[s.skeletonLine, { backgroundColor: colors.surfaceElevated }]} />
        <View style={[s.skeletonLine, { width: '60%', backgroundColor: colors.surfaceElevated }]} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  searchWrap: {
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  search: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    fontSize: font.size.lg,
    fontFamily: font.family,
    textAlign: 'right',
  },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 64,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
  },
  rowText: { flex: 1 },
  rowName: {
    fontSize: font.size.base,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  rowMeta: {
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
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    lineHeight: 24,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 64,
    marginBottom: spacing.sm,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
  },
  skeletonText: { flex: 1 },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    marginBottom: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: spacing.md,
  },
  empty: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
  },
})
