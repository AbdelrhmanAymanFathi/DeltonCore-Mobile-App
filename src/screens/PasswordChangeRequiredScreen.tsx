import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { Banner, Card, SolidButton } from '../components/ui'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing, lineHeightFor, baseText } from '../theme/tokens'
import { t, tCount } from '../i18n'
import { DAY_FORMS } from '../i18n/plural'

export default function PasswordChangeRequiredScreen() {
  const { colors } = useTheme()
  const { session, signOut } = useAuth()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)

  const days = session?.password_policy.days_until_expiry ?? 0

  async function leave() {
    setBusy(true)
    try {
      await signOut()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={s.card}>
          <View style={s.head}>
            <View style={[s.pill, { backgroundColor: colors.tintCrimson, borderColor: colors.crimson }]}>
              <Text style={[s.pillText, { color: colors.crimson }]}>{t("login.passwordLabel")}</Text>
            </View>
            <Text style={[s.title, { color: colors.textPrimary }]}>{t("common.passwordExpired")}</Text>
          </View>

          <Banner tone="warn">
            {days > 0
              ? t("common.passwordExpireSoon", { days: tCount(days, DAY_FORMS) })
              : t("common.passwordExpiredMsg")}
          </Banner>

          <Text style={[s.body, { color: colors.textMuted }]}>
            {t("common.passwordBody")}
          </Text>

          <SolidButton
            label={t("common.logout")}
            tone="neutral"
            busy={busy}
            disabled={busy}
            onPress={leave}
          />
        </Card>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  card: { gap: spacing.xl },
  head: { alignItems: 'center', gap: spacing.md },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontFamily: font.familySemiBold,
    lineHeight: lineHeightFor(10),
    ...baseText,
  },
  title: {
    fontSize: 22,
    fontFamily: font.familyBold,
    textAlign: 'center',
    lineHeight: lineHeightFor(22),
    ...baseText,
  },
  body: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'right',
    lineHeight: lineHeightFor(font.size.base),
    ...baseText,
  },
})
