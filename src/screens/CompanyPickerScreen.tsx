import React from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { CompanyCard } from '../api/types'
import { Banner } from '../components/ui'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { useTheme } from '../theme/ThemeProvider'
import { font, MIN_TOUCH, radius, spacing } from '../theme/tokens'

export default function CompanyPickerScreen({
  companies,
  busy,
  error,
  onPick,
  onBack,
}: {
  companies: CompanyCard[]
  busy: boolean
  error: string | null
  onPick: (companyId: string) => void
  onBack: () => void
}) {
  const { colors } = useTheme()
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.head}>
        <Text style={[s.title, { color: colors.textPrimary }]}>اختر الشركة</Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          حسابك مرتبط بأكثر من شركة. اختر الشركة التي تريد العمل عليها الآن.
        </Text>
      </View>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <View style={s.list}>
        {companies.map((c) => {
          const name = c.name_ar || c.name
          const secondary = c.name_en && c.name_en !== name ? c.name_en : null
          return (
            <Pressable
              key={c.id}
              onPress={() => onPick(c.id)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{ disabled: busy, busy }}
              card
              style={[
                s.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
                busy && s.rowDim,
              ]}
            >
              <View style={[s.dot, { backgroundColor: colors.brand }]} />
              <View style={s.rowText}>
                <Text style={[s.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {name}
                </Text>
                {secondary ? (
                  <Text style={[s.meta, { color: colors.textMuted }]} numberOfLines={1}>
                    {secondary}
                  </Text>
                ) : null}
              </View>
              <Text style={[s.chevron, { color: colors.textMuted }]}>‹</Text>
            </Pressable>
          )
        })}
      </View>

      <Pressable
        onPress={onBack}
        disabled={busy}
        accessibilityRole="button"
        style={s.back}
      >
        <Text style={[s.backText, { color: colors.textMuted }]}>رجوع لتعديل بيانات الدخول</Text>
      </Pressable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.sm },
  title: {
    fontSize: 24,
    fontFamily: font.familyBold,
  },
  sub: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: { gap: spacing.md },
  row: {
    minHeight: MIN_TOUCH + 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  rowDim: { opacity: 0.5 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  rowText: { flex: 1, gap: 2 },
  name: {
    fontSize: font.size.xl,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  meta: {
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
  },
  chevron: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: font.family,
  },
  back: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  backText: {
    fontSize: font.size.md,
    fontFamily: font.family,
  },
})
