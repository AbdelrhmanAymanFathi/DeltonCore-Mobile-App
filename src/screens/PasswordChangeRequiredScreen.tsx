import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { Banner, Card, SolidButton } from '../components/ui'
import { colors, font, radius, spacing } from '../theme/tokens'

/**
 * Shown instead of the app when the backend flags `password_policy.force_change`.
 *
 * There is no password-change endpoint under `core/mobile/` — the supervisor
 * app has no way to set a new password, and inventing a screen that posts to a
 * route that does not exist would be worse than saying so plainly. Until the
 * password is changed on the desktop the account will eventually lock itself
 * (`password_locked`, HTTP 423), so the honest thing is a blocking gate with
 * one way out: sign out.
 */
export default function PasswordChangeRequiredScreen() {
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
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <Card style={s.card}>
          <View style={s.head}>
            <View style={s.pill}>
              <Text style={s.pillText}>كلمة المرور</Text>
            </View>
            <Text style={s.title}>انتهت صلاحية كلمة المرور</Text>
          </View>

          <Banner tone="warn">
            {days > 0
              ? `تبقّى ${days} يومًا قبل أن يُقفل حسابك. يجب تغيير كلمة المرور من النسخة الويب.`
              : 'انتهت صلاحية كلمة المرور. يجب تغييرها من النسخة الويب قبل استخدام التطبيق.'}
          </Banner>

          <Text style={s.body}>
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
  screen: { flex: 1, backgroundColor: colors.page },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  card: { gap: spacing.xl },
  head: { alignItems: 'center', gap: spacing.md },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  pillText: {
    color: colors.warning,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: font.familySemiBold,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: font.familyBold,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'right',
    lineHeight: 24,
  },
})
