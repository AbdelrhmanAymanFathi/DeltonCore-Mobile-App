import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Banner, Card, GradientButton } from '../components/ui'
import { PressableScale as Pressable } from '../components/ui/PressableScale'
import { useTheme } from '../theme/ThemeProvider'
import { font, MIN_TOUCH, radius, spacing } from '../theme/tokens'

export default function TwoFactorScreen({
  username,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  username: string
  busy: boolean
  error: string | null
  onBack: () => void
  onSubmit: (factor: { code: string; kind: 'totp' | 'backup' }) => void
}) {
  const { colors } = useTheme()
  const [useBackup, setUseBackup] = useState(false)
  const [code, setCode] = useState('')

  const trimmed = code.trim()
  const ready = useBackup ? trimmed.length > 0 : trimmed.length === 6

  function toggleKind() {
    setUseBackup((v) => !v)
    setCode('')
  }

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Card style={s.card}>
          <View style={s.head}>
            <View style={[s.pill, { backgroundColor: colors.tintBrand, borderColor: colors.brand }]}>
              <Text style={[s.pillText, { color: colors.brandText }]}>التحقق بخطوتين</Text>
            </View>
            <Text style={[s.title, { color: colors.textPrimary }]}>أدخل رمز التحقق</Text>
            <Text style={[s.sub, { color: colors.textMuted }]}>
              {useBackup
                ? `اكتب أحد الرموز الاحتياطية لحساب ${username}. يُستخدم مرة واحدة فقط.`
                : `افتح تطبيق المصادقة وأدخل الرمز المكوَّن من 6 أرقام لحساب ${username}.`}
            </Text>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: colors.textSecondary }]}>{useBackup ? 'الرمز الاحتياطي' : 'رمز التحقق'}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.inputText }, useBackup && s.inputBackup]}
              value={code}
              onChangeText={(v) => setCode(useBackup ? v : v.replace(/[^0-9]/g, ''))}
              keyboardType={useBackup ? 'default' : 'number-pad'}
              maxLength={useBackup ? 32 : 6}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              editable={!busy}
              accessibilityLabel={useBackup ? 'الرمز الاحتياطي' : 'رمز التحقق'}
              placeholder={useBackup ? '' : '••••••'}
              placeholderTextColor={colors.inputPlaceholder}
              onSubmitEditing={() => {
                if (ready && !busy) {
                  onSubmit({ code: trimmed, kind: useBackup ? 'backup' : 'totp' })
                }
              }}
              returnKeyType="go"
            />
          </View>

          {error ? <Banner tone="error">{error}</Banner> : null}

          <GradientButton
            label="تحقق"
            busy={busy}
            disabled={!ready}
            onPress={() => onSubmit({ code: trimmed, kind: useBackup ? 'backup' : 'totp' })}
          />

          <Pressable
            onPress={toggleKind}
            disabled={busy}
            accessibilityRole="button"
            style={s.toggle}
          >
            <Text style={[s.toggleText, { color: colors.brandText }]}>
              {useBackup ? 'استخدم رمز التطبيق' : 'استخدم رمزًا احتياطيًا'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onBack}
            disabled={busy}
            accessibilityRole="button"
            style={s.toggle}
          >
            <Text style={[s.backText, { color: colors.textMuted }]}>رجوع لتعديل بيانات الدخول</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
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
  },
  sub: {
    fontSize: font.size.base,
    fontFamily: font.family,
    textAlign: 'center',
    lineHeight: 22,
  },
  field: { gap: spacing.sm },
  label: {
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  input: {
    minHeight: MIN_TOUCH,
    height: 58,
    paddingHorizontal: 15,
    borderRadius: 11,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: font.familyBold,
  },
  inputBackup: {
    fontSize: font.size.xl,
    letterSpacing: 1,
    fontFamily: font.familyMedium,
  },
  toggle: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  toggleText: {
    fontSize: font.size.base,
    fontFamily: font.familySemiBold,
  },
  backText: {
    fontSize: font.size.md,
    fontFamily: font.family,
  },
})
