import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../auth/AuthContext'
import { api, ApiFailure, messageFor } from '../api/client'
import type { CompanySelectionRequired, MobileLoginResult } from '../api/types'
import { colors, font, gradient, radius, spacing } from '../theme/tokens'
import CompanyPickerScreen from './CompanyPickerScreen'
import TwoFactorScreen from './TwoFactorScreen'

type Phase = 'credentials' | 'code' | 'company'

export default function LoginScreen() {
  const { signIn, adoptSession } = useAuth()
  const [phase, setPhase] = useState<Phase>('credentials')
  const [username, setUsername] = useState('')
  /**
   * Held in memory only, for the lifetime of the login flow: it is replayed
   * with the second factor and never written to storage.
   */
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<CompanySelectionRequired | null>(null)

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy

  /** A successful single-company login is already committed by signIn. */
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
        // Not a failure: the password is accepted, a code is needed next.
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
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.card}>
          <View style={s.head}>
            <View style={s.pill}>
              <Text style={s.pillText}>ENTERPRISE HR SYSTEM</Text>
            </View>
            <Text style={s.brand}>Delton Core People</Text>
            <Text style={s.sub}>تطبيق المشرفين — ادخل بحساب النظام</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>اسم المستخدم</Text>
            <TextInput
              style={s.input}
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
            <Text style={s.label}>كلمة المرور</Text>
            <TextInput
              style={s.input}
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
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submitCredentials}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy }}
            style={({ pressed }) => [
              s.buttonWrap,
              !canSubmit && s.buttonDisabled,
              pressed && canSubmit && s.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={[...gradient.primary]}
              locations={[...gradient.locations]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.button}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={s.buttonText}>تسجيل الدخول</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={s.note}>
            الدخول متاح لمن لديه صلاحية اعتماد أو تسجيل حضور. الحساب المقفول أو
            منتهي كلمة السر يُرفض من أول محاولة.
          </Text>
        </View>

        <Text style={s.footer}>© 2026 Delton Core · اتصال مؤمَّن عبر HTTPS</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 24,
    gap: spacing.xl,
  },
  head: { alignItems: 'center', gap: spacing.md },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.tealSurface,
    borderWidth: 1,
    borderColor: colors.tealBorder,
  },
  pillText: {
    color: colors.tealBright,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: font.familySemiBold,
  },
  brand: {
    color: colors.text,
    fontSize: 25,
    fontFamily: font.familyBold,
  },
  sub: {
    color: colors.textMuted,
    fontSize: font.size.base,
    fontFamily: font.family,
  },
  field: { gap: spacing.sm },
  label: {
    color: colors.textStrong,
    fontSize: font.size.md,
    fontFamily: font.familySemiBold,
    textAlign: 'right',
  },
  input: {
    height: 50,
    paddingHorizontal: 15,
    borderRadius: 11,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    fontSize: font.size.lg,
    fontFamily: font.familyMedium,
    textAlign: 'right',
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: font.size.md,
    fontFamily: font.familyMedium,
    textAlign: 'right',
    lineHeight: 21,
  },
  buttonWrap: { borderRadius: 11, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text,
    fontSize: font.size.xl,
    fontFamily: font.familyBold,
  },
  note: {
    color: colors.textFaint,
    fontSize: 12.5,
    lineHeight: 21,
    fontFamily: font.family,
    textAlign: 'right',
  },
  footer: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontFamily: font.family,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
