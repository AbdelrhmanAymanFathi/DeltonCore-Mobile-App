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
import { useAuth } from '../auth/AuthContext'
import { api, ApiFailure, messageFor } from '../api/client'
import type { CompanySelectionRequired, MobileLoginResult } from '../api/types'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing } from '../theme/tokens'
import CompanyPickerScreen from './CompanyPickerScreen'
import TwoFactorScreen from './TwoFactorScreen'
import { Button } from '../components/ui'

type Phase = 'credentials' | 'code' | 'company'

export default function LoginScreen() {
  const { colors } = useTheme()
  const { signIn, adoptSession } = useAuth()
  const [phase, setPhase] = useState<Phase>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<CompanySelectionRequired | null>(null)

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy

  function route(res: MobileLoginResult) {
    if ('company_required' in res && res.company_required) {
      setSelection(res)
      setError(null)
      setPhase('company')
    }
  }

  async function submitCredentials() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      route(await signIn(username.trim(), password))
    } catch (e) {
      if (e instanceof ApiFailure && e.code === 'two_factor_required') {
        setError(null)
        setPhase('code')
      } else {
        setError(messageFor(e))
      }
    } finally {
      setBusy(false)
    }
  }

  async function submitCode({ code, kind }: { code: string; kind: 'totp' | 'backup' }) {
    setBusy(true)
    setError(null)
    try {
      route(
        await signIn(
          username.trim(),
          password,
          kind === 'backup' ? { backup_code: code } : { totp_code: code },
        ),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  async function pickCompany(companyId: string) {
    if (!selection) return
    setBusy(true)
    setError(null)
    try {
      await adoptSession(
        await api.selectCompany({
          company_id: companyId,
          selection_token: selection.selection_token,
        }),
      )
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  function backToCredentials() {
    setPhase('credentials')
    setError(null)
    setPassword('')
    setSelection(null)
  }

  if (phase === 'code') {
    return (
      <TwoFactorScreen
        username={username.trim()}
        busy={busy}
        error={error}
        onBack={backToCredentials}
        onSubmit={submitCode}
      />
    )
  }

  if (phase === 'company') {
    return (
      <CompanyPickerScreen
        companies={selection?.companies ?? []}
        busy={busy}
        error={error}
        onPick={pickCompany}
        onBack={backToCredentials}
      />
    )
  }

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.head}>
            <View style={[s.pill, { backgroundColor: colors.tintBrand, borderColor: colors.brand }]}>
              <Text style={[s.pillText, { color: colors.brandText }]}>ENTERPRISE HR SYSTEM</Text>
            </View>
            <Text style={[s.brand, { color: colors.textPrimary }]}>Delton Core People</Text>
            <Text style={[s.sub, { color: colors.textSecondary }]}>تطبيق المشرفين — ادخل بحساب النظام</Text>
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: colors.textSecondary }]}>اسم المستخدم</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              placeholderTextColor={colors.inputPlaceholder}
              editable={!busy}
            />
          </View>

          <View style={s.field}>
            <Text style={[s.label, { color: colors.textSecondary }]}>كلمة المرور</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              placeholderTextColor={colors.inputPlaceholder}
              editable={!busy}
              onSubmitEditing={submitCredentials}
              returnKeyType="go"
            />
          </View>

          {error ? (
            <View style={[s.errorBox, { backgroundColor: colors.tintCrimson, borderColor: colors.crimson }]}>
              <Text style={[s.errorText, { color: colors.crimson }]}>{error}</Text>
            </View>
          ) : null}

          <Button
            label="تسجيل الدخول"
            busyLabel="جارٍ تسجيل الدخول…"
            onPress={submitCredentials}
            busy={busy}
            disabled={!canSubmit}
          />

          <Text style={[s.note, { color: colors.textMuted }]}>
            الدخول متاح لمن لديه صلاحية اعتماد أو تسجيل حضور. الحساب المقفّل أو
            منتهي كلمة السر يُرفض من أول محاولة.
          </Text>
        </View>

        <Text style={[s.footer, { color: colors.textMuted }]}>© 2026 Delton Core · اتصال مؤمَّن عبر HTTPS</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: spacing.xl,
  },
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
  brand: {
    fontSize: 25,
    fontFamily: font.familyBold,
  },
  sub: {
    fontSize: font.size.base,
    fontFamily: font.family,
  },
  field: { gap: spacing.sm },
  label: {
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  input: {
    height: 50,
    paddingHorizontal: 15,
    borderRadius: 11,
    fontSize: font.size.lg,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
    textAlign: 'right',
    lineHeight: 21,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 21,
    fontFamily: font.family,
    textAlign: 'right',
  },
  footer: {
    fontSize: 11.5,
    fontFamily: font.family,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
