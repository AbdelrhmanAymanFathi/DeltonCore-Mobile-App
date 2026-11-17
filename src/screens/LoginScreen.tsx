import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { api, ApiFailure, messageFor } from '../api/client'
import type { CompanySelectionRequired, MobileLoginResult } from '../api/types'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui'
import { PressableScale } from '../components/ui/PressableScale'
import { useTheme } from '../theme/ThemeProvider'
import { font, radius, spacing, lineHeightFor, baseText } from '../theme/tokens'
import { t } from '../i18n'
import CompanyPickerScreen from './CompanyPickerScreen'
import TwoFactorScreen from './TwoFactorScreen'

type Phase = 'credentials' | 'code' | 'company'
type CredentialField = 'username' | 'password'

export default function LoginScreen() {
  const { colors, isDark } = useTheme()
  const { signIn, adoptSession } = useAuth()
  const insets = useSafeAreaInsets()
  const [phase, setPhase] = useState<Phase>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<CredentialField | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<CompanySelectionRequired | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})
  const passwordInput = useRef<React.ElementRef<typeof TextInput>>(null)
  const shake = useRef(new Animated.Value(0)).current
  const usernameFocus = useRef(new Animated.Value(0)).current
  const passwordFocus = useRef(new Animated.Value(0)).current
  const previousError = useRef<string | null>(null)

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy
  const usernameFocused = focusedField === 'username'
  const passwordFocused = focusedField === 'password'

  useEffect(() => {
    if (!error || error === previousError.current) {
      previousError.current = error
      return
    }
    previousError.current = error
    shake.setValue(0)
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -0.8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }, [error, shake])

  useEffect(() => {
    Animated.timing(usernameFocus, {
      toValue: usernameFocused ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start()
  }, [usernameFocus, usernameFocused])

  useEffect(() => {
    Animated.timing(passwordFocus, {
      toValue: passwordFocused ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start()
  }, [passwordFocus, passwordFocused])

  function route(res: MobileLoginResult) {
    if ('company_required' in res && res.company_required) {
      setSelection(res)
      setError(null)
      setPhase('company')
    }
  }

  async function submitCredentials() {
    if (busy) return
    const nextFieldErrors = {
      username: username.trim().length === 0 ? t("login.usernameRequired") : undefined,
      password: password.length === 0 ? t("login.passwordRequired") : undefined,
    }
    setFieldErrors(nextFieldErrors)
    if (nextFieldErrors.username || nextFieldErrors.password) return

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

  const focusRing = (focusValue: Animated.Value) => [
    styles.fieldOuter,
    {
      backgroundColor: focusValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', colors.tintBrand],
      }),
    },
  ]

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[colors.brandGlow, 'transparent']}
        style={styles.glow}
      />
      <ScrollView
        style={styles.loginScroll}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.form,
              {
                transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) }],
              },
            ]}
          >
            <View style={styles.brandHeader}>
              <View style={[styles.logoFrame, { backgroundColor: colors.surface, borderColor: colors.brandOutline }]}>
                <Image
                  source={require('../../assets/appicon-foreground-removebg-preview.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t("login.title")}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("login.subtitle")}</Text>
            </View>

            <View style={styles.fields}>
              <View style={styles.field}>
                <View style={styles.labelWrap}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t("login.usernameLabel")}</Text>
                </View>
                <Animated.View style={focusRing(usernameFocus)}>
                  <Animated.View
                    style={[
                      styles.inputRow,
                      {
                        backgroundColor: colors.surface,
                        borderColor: fieldErrors.username
                          ? colors.crimson
                          : usernameFocus.interpolate({
                              inputRange: [0, 1],
                              outputRange: [colors.border, colors.brandText],
                            }),
                        shadowColor: colors.brandDeep,
                        shadowOpacity: usernameFocus.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, !isDark ? 0.08 : 0],
                        }),
                      },
                    ]}
                  >
                    <Icon
                      name="user"
                      size={20}
                      color={usernameFocused ? colors.brandText : colors.textMuted}
                      accessible={false}
                    />
                    <TextInput
                      style={[
                        styles.input,
                        { color: colors.textPrimary, writingDirection: containsLatin(username) ? 'ltr' : 'rtl' },
                      ]}
                      value={username}
                      onChangeText={(value) => {
                        setUsername(value)
                        if (fieldErrors.username) setFieldErrors((current) => ({ ...current, username: undefined }))
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="username"
                      textContentType="username"
                      returnKeyType="next"
                      placeholder={t("login.usernamePlaceholder")}
                      placeholderTextColor={colors.textMuted}
                      editable={!busy}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={() => passwordInput.current?.focus()}
                      accessibilityLabel={t("login.usernameLabel")}
                    />
                  </Animated.View>
                </Animated.View>
                <FieldError message={fieldErrors.username} color={colors.crimson} />
              </View>

              <View style={styles.field}>
                <View style={styles.labelWrap}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t("login.passwordLabel")}</Text>
                </View>
                <Animated.View style={focusRing(passwordFocus)}>
                  <Animated.View
                    style={[
                      styles.inputRow,
                      {
                        backgroundColor: colors.surface,
                        borderColor: fieldErrors.password
                          ? colors.crimson
                          : passwordFocus.interpolate({
                              inputRange: [0, 1],
                              outputRange: [colors.border, colors.brandText],
                            }),
                        shadowColor: colors.brandDeep,
                        shadowOpacity: passwordFocus.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, !isDark ? 0.08 : 0],
                        }),
                      },
                    ]}
                  >
                    <Icon
                      name="lock"
                      size={20}
                      color={passwordFocused ? colors.brandText : colors.textMuted}
                      accessible={false}
                    />
                    <TextInput
                      ref={passwordInput}
                      style={[
                        styles.input,
                        { color: colors.textPrimary, writingDirection: containsLatin(password) ? 'ltr' : 'rtl' },
                      ]}
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value)
                        if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }))
                      }}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                      textContentType="password"
                      returnKeyType="done"
                      placeholder={t("login.passwordPlaceholder")}
                      placeholderTextColor={colors.textMuted}
                      editable={!busy}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={submitCredentials}
                      accessibilityLabel={t("login.passwordLabel")}
                    />
                    <PressableScale
                      onPress={() => setShowPassword((value) => !value)}
                      disabled={busy}
                      accessibilityLabel={t("login.showPassword")}
                      accessibilityState={{ selected: showPassword }}
                      hitSlop={4}
                      style={styles.eyeButton}
                    >
                      <Icon
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color={colors.textMuted}
                        accessible={false}
                      />
                    </PressableScale>
                  </Animated.View>
                </Animated.View>
                <FieldError message={fieldErrors.password} color={colors.crimson} />
              </View>
            </View>

          </Animated.View>

        </View>
      </ScrollView>
      <View style={[styles.footerWrap, { backgroundColor: colors.background, paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.submitArea}>
          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.tintCrimson, borderColor: colors.tintCrimson }]}>
              <Icon name="alert-circle" size={18} color={colors.crimson} accessible={false} />
              <Text style={[styles.errorText, { color: colors.crimson }]}>{error}</Text>
            </View>
          ) : null}
          <Button
            label={t("login.signIn")}
            busyLabel={t("login.signingIn")}
            onPress={submitCredentials}
            busy={busy}
            disabled={!canSubmit}
            iconName="log-in"
            style={{
              width: '100%',
              height: 56,
              borderRadius: radius.lg,
              ...(isDark && canSubmit
                ? {
                    shadowColor: colors.brand,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.2,
                    shadowRadius: 12,
                    elevation: 5,
                  }
                : {}),
            }}
          />
        </View>
        <View style={styles.helpList}>
          <HelpLine
            icon="shield"
            text={t("login.helpAccess")}
            colors={colors}
          />
          <HelpLine
            icon="info"
            text={t("login.helpLocked")}
            colors={colors}
          />
        </View>
        <View style={styles.footer}>
          <View style={styles.footerSide}>
            <Icon name="lock" size={12} color={colors.textMuted} accessible={false} />
            <Text style={[styles.footerArabic, { color: colors.textMuted }]}>{t("login.secureConnection")}</Text>
          </View>
          <View style={[styles.footerDot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.footerEnglish, { color: colors.textMuted }]}>{t("login.copyright", { year: 2026 })}</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

function FieldError({ message, color }: { message?: string; color: string }) {
  return (
    <View style={styles.fieldErrorSlot}>
      {message ? (
        <View style={styles.fieldError}>
          <Icon name="alert-circle" size={14} color={color} accessible={false} />
          <Text style={[styles.fieldErrorText, { color }]}>{message}</Text>
        </View>
      ) : null}
    </View>
  )
}

function HelpLine({
  icon,
  text,
  colors,
}: {
  icon: string
  text: string
  colors: { tintBrand: string; brandText: string; textSecondary: string }
}) {
  return (
    <View style={styles.helpRow}>
      <View style={[styles.helpIcon, { backgroundColor: colors.tintBrand }]}>
        <Icon name={icon} size={15} color={colors.brandText} accessible={false} />
      </View>
      <Text style={[styles.helpText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  )
}

function containsLatin(value: string) {
  return /[A-Za-z0-9]/.test(value)
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loginScroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: { gap: spacing.xl },
  brandHeader: { alignItems: 'center', gap: spacing.sm },
  logoFrame: {
    width: 84,
    height: 84,
    borderRadius: radius.xxl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logo: { width: 76, height: 76 },
  title: { fontSize: 28, lineHeight: lineHeightFor(28), fontFamily: font.familyBold, textAlign: 'center', ...baseText },
  subtitle: { fontSize: 15, lineHeight: lineHeightFor(15), fontFamily: font.family, textAlign: 'center', ...baseText },
  fields: { gap: spacing.lg, marginTop: spacing.xl },
  field: { gap: spacing.sm },
  labelWrap: { width: '100%', direction: 'ltr', alignItems: 'flex-end' },
  label: { width: '100%', fontSize: 13, lineHeight: lineHeightFor(13), fontFamily: font.familySemiBold, textAlign: 'right', ...baseText },
  fieldOuter: { borderRadius: radius.lg, padding: 2 },
  inputRow: {
    height: 56,
    flexDirection: 'row',
    direction: 'rtl',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 1,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 16,
    lineHeight: lineHeightFor(16),
    fontFamily: font.family,
    textAlign: 'right',
    ...baseText,
  },
  eyeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldErrorSlot: { height: 18, justifyContent: 'center' },
  fieldError: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, direction: 'rtl' },
  fieldErrorText: { fontSize: font.size.xs, lineHeight: lineHeightFor(font.size.xs), fontFamily: font.family, ...baseText },
  submitArea: { gap: spacing.xs },
  errorSlot: { minHeight: 0, justifyContent: 'center' },
  errorBanner: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  errorText: { flex: 1, fontSize: font.size.sm, lineHeight: lineHeightFor(font.size.sm), fontFamily: font.family, textAlign: 'right', ...baseText },
  helpList: { gap: spacing.md },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, direction: 'rtl' },
  helpIcon: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  helpText: { flex: 1, fontSize: font.size.sm, lineHeight: lineHeightFor(font.size.sm), fontFamily: font.family, textAlign: 'right', ...baseText },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  footerWrap: { width: '100%', maxWidth: 420, alignSelf: 'center', paddingHorizontal: 24, paddingTop: spacing.md, gap: spacing.md },
  footerSide: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  footerArabic: { fontSize: 11, lineHeight: lineHeightFor(11), fontFamily: font.family, ...baseText },
  footerDot: { width: 3, height: 3, borderRadius: radius.pill },
  footerEnglish: { fontSize: 11, lineHeight: lineHeightFor(11), fontFamily: font.family, writingDirection: 'ltr', textAlign: 'center', ...baseText },
})
