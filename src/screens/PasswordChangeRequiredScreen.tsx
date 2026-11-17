import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { Banner, Card, SolidButton } from '../components/ui'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing } from '../theme/tokens'

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
      >
        <Card style={s.card}>
          <View style={s.head}>
            <View style={[s.pill, { backgroundColor: colors.tintCrimson, borderColor: colors.crimson }]}>
              <Text style={[s.pillText, { color: colors.crimson }]}>كلمة المرور</Text>
            </View>
            <Text style={[s.title, { color: colors.textPrimary }]}>انتهت صلاحية كلمة المرور</Text>
          </View>

          <Banner tone="warn">
            {days > 0
              ? `تبقّى ${days.toLocaleString('ar-EG-u-nu-latn')} يومًا قبل أن يُقفل حسابك. يجب تغيير كلمة المرور من النسخة الويب.`
              : 'انتهت صلاحية كلمة المرور. يجب تغييرها من النسخة الويب قبل استخدام التطبيق.'}
          </Banner>

          <Text style={[s.body, { color: colors.textMuted }]}>
            تطبيق المشرفين لا يتيح تغيير كلمة المرور. افتح Delton Core People على
            الحاسب، غيّر كلمة المرور من إعدادات حسابك، ثم سجّل الدخول هنا من جديد.
          </Text>

          <SolidButton
            label="تسجيل الخروج"
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
    letterSpacing: 1.4,
    fontFamily: font.familySemiBold,
  },
  title: {
    fontSize: 22,
    fontFamily: font.familyBold,
    textAlign: 'center',
  },
  body: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'right',
    lineHeight: 24,
  },
})
