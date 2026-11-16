import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { CompanyCard } from '../api/types'
import { Banner } from '../components/ui'
import { colors, font, MIN_TOUCH, radius, spacing } from '../theme/tokens'

/**
 * The company step of a multi-company login.
 *
 * It appears only when the identity may enter more than one company — the
 * backend answers the login with a `selection_token` instead of a token pair.
 * The picked `id` is an opaque public id and goes back verbatim.
 */
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
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.head}>
        <Text style={s.title}>اختر الشركة</Text>
        <Text style={s.sub}>
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
              style={({ pressed }) => [s.row, pressed && !busy && s.rowPressed, busy && s.rowDim]}
            >
              <View style={s.dot} />
              <View style={s.rowText}>
                <Text style={s.name} numberOfLines={1}>
                  {name}
                </Text>
                {secondary ? (
                  <Text style={s.meta} numberOfLines={1}>
                    {secondary}
                  </Text>
                ) : null}
              </View>
              {/* In RTL a left-pointing chevron reads as "onward". */}
              <Text style={s.chevron}>‹</Text>
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
        <Text style={s.backText}>رجوع لتعديل بيانات الدخول</Text>
      </Pressable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontFamily: font.familyBold },
  sub: {
    color: colors.textMuted,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  rowPressed: { backgroundColor: colors.cardRaised },
  rowDim: { opacity: 0.5 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.teal,
  },
  rowText: { flex: 1, gap: 2 },
  name: {
    color: colors.text,
    fontSize: font.size.xl,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  meta: {
    color: colors.textMuted,
    fontSize: font.size.sm,
    fontFamily: font.family,
    textAlign: 'right',
  },
  chevron: {
    color: colors.textFaint,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: font.family,
  },
  back: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  backText: {
    color: colors.textFaint,
    fontSize: font.size.md,
    fontFamily: font.family,
  },
})
