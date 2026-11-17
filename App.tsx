import React, { useEffect } from 'react'
import { I18nManager, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
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
import { font } from './src/theme/tokens'
import { PressableScale } from './src/components/ui/PressableScale'

// RTL must be forced before the first render. On Android this only takes full
// effect after a restart, which is why it is set here and also declared in
// app.json — a fresh install comes up right the first time.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}

installMockApi()
SplashScreen.preventAutoHideAsync().catch(() => {})

function ThemeStatusBar() {
  const { isDark } = useTheme()
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
}

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeStatusBar />
          <Root />
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  )
}

function Root() {
  const { status, session, authError, retryAuth } = useAuth()

  let screen: React.ReactNode
  if (status === 'loading') {
    if (authError) {
      screen = (
        <View style={s.splash}>
          <PressableScale style={s.retry} onPress={retryAuth} accessibilityRole="button" accessibilityLabel="إعادة المحاولة">
            <Text style={s.retryText}>إعادة المحاولة</Text>
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
    <View style={s.root}>
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
    fontFamily: font.familyMedium,
  },
})
