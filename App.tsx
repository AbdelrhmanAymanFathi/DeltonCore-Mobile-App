import React, { useEffect } from 'react'
import { ActivityIndicator, I18nManager, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
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
import { colors, font } from './src/theme/tokens'

// RTL must be forced before the first render. On Android this only takes full
// effect after a restart, which is why it is set here and also declared in
// app.json — a fresh install comes up right the first time.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}

installMockApi()
SplashScreen.preventAutoHideAsync().catch(() => {})

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
    // The inset provider has to be above every screen: the headers and the tab
    // bar read the system bars' heights from it.
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

function Root() {
  const { status, session, authError, retryAuth } = useAuth()

  if (status === 'loading') {
    if (authError) {
      return (
        <View style={s.splash}>
          <ActivityIndicator color={colors.teal} />
          <Pressable style={s.retry} onPress={retryAuth} accessibilityRole="button" accessibilityLabel="إعادة المحاولة">
            <Text style={s.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      )
    }
    return (
      <View style={s.splash}>
        <ActivityIndicator color={colors.teal} />
      </View>
    )
  }

  if (status === 'signedOut') return <LoginScreen />

  // The server lets an expired password log in but flags it: every request
  // would still work, yet the account is days from locking itself. There is
  // no mobile password-change endpoint, so the app can only point at the web.
  if (session?.password_policy.force_change) return <PasswordChangeRequiredScreen />

  return <AppNavigator />
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.borderRaised,
  },
  retryText: {
    color: colors.tealBright,
    fontSize: font.size.base,
    fontFamily: font.familyMedium,
  },
})
