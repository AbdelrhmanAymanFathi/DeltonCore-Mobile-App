import React, { useEffect } from 'react'
import { I18nManager, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic'
import { AuthProvider, useAuth } from './src/auth/AuthContext'
import LoginScreen from './src/screens/LoginScreen'
import PasswordChangeRequiredScreen from './src/screens/PasswordChangeRequiredScreen'
import AppNavigator from './src/navigation/AppNavigator'
import { installMockApi } from './src/api/mock'
import { MockIndicator } from './src/components/MockIndicator'
import { StatusBarCover } from './src/components/StatusBarCover'
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider'
import { font, lineHeightFor, baseText } from './src/theme/tokens'
import { PressableScale } from './src/components/ui/PressableScale'
import { t, LocaleProvider, useLocale } from './src/i18n'

// The native layout flag stays RTL for every language: the active language's
// direction is applied by the root view's `direction` style (see Root), so the
// language can be switched at runtime with no app restart.
I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

installMockApi()
SplashScreen.preventAutoHideAsync().catch(() => {})

function ThemeStatusBar() {
  const { isDark } = useTheme()
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
}

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <LocaleProvider>
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeStatusBar />
          <Root />
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
    </LocaleProvider>
  )
}

function Root() {
  const { status, session, authError, retryAuth } = useAuth()
  const { dir } = useLocale()

  let screen: React.ReactNode
  if (status === 'loading') {
    if (authError) {
      screen = (
        <View style={s.splash}>
          <PressableScale style={s.retry} onPress={retryAuth} accessibilityRole="button" accessibilityLabel={t("common.retry")}>
            <Text style={s.retryText}>{t("common.retry")}</Text>
          </PressableScale>
        </View>
      )
    } else {
      screen = <View style={s.splash} />
    }
  } else if (status === 'signedOut') {
    screen = <LoginScreen />
  } else if (session?.password_policy.force_change) {
    screen = <PasswordChangeRequiredScreen />
  } else {
    screen = <AppNavigator />
  }

  return (
    <View style={[s.root, { direction: dir }]}>
      {screen}
      <StatusBarCover />
      <MockIndicator />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontSize: font.size.base,
    lineHeight: lineHeightFor(font.size.base),
    fontFamily: font.familySemiBold,
    ...baseText,
  },
})
