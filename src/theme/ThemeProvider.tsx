/**
 * ThemeProvider — manages light/dark/system theme for Delton Core Supervisor.
 *
 * - Mode persisted in expo-secure-store (@delton_theme_mode).
 * - Read on first render before any UI paints → no flash.
 * - Switching modes fades a full-screen overlay over 180 ms each way.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useColorScheme, type ColorSchemeName } from 'react-native'
import { Animated } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import {
  darkColors,
  lightColors,
  type ThemeColors,
  type ThemeMode,
  brandGradient,
  crimsonGradient,
  darkPageGradient,
  lightPageGradient,
} from './tokens'

const STORAGE_KEY = '@delton_theme_mode'

interface Gradients {
  brand: readonly [string, string, string]
  crimson: readonly [string, string, string]
  page: readonly [string, string]
}

interface ThemeContextValue {
  colors: ThemeColors
  gradients: Gradients
  mode: ThemeMode
  isDark: boolean
  setMode: (next: ThemeMode) => void
  transition: Animated.Value
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveMode(stored: ThemeMode | null, system: ColorSchemeName | null): ThemeMode {
  if (stored === 'light' || stored === 'dark') return stored
  if (system === 'light') return 'light'
  if (system === 'dark') return 'dark'
  return 'light'
}

function isDarkFor(mode: ThemeMode, system: ColorSchemeName | null): boolean {
  if (mode === 'light') return false
  if (mode === 'dark') return true
  return system === 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme()
  const [stored, setStored] = useState<ThemeMode | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [systemColor, setSystemColor] = useState<ColorSchemeName | null>(null)

  const transition = useMemo(() => new Animated.Value(0), [])

  // Read persisted mode before anything renders.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY)
        if (cancelled) return
        setStored((raw === 'light' || raw === 'dark') ? raw : null)
      } catch {
        if (cancelled) return
        setStored(null)
      } finally {
        if (!cancelled) setInitialized(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Track when the system color scheme is available
  useEffect(() => {
    setSystemColor(system)
  }, [system])

  const setMode = useCallback(
    (next: ThemeMode) => {
      // Fade out → switch → fade in in under 400 ms.
      Animated.timing(transition, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setStored(next === 'system' ? null : next)
        SecureStore.setItemAsync(STORAGE_KEY, next === 'system' ? '' : next).catch(() => {})
        Animated.timing(transition, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start()
      })
    },
    [transition]
  )

  // All hooks must run in the same order every render — compute context before any early return.
  const ready = initialized && systemColor !== null
  const effectiveMode = useMemo(() => resolveMode(stored, systemColor), [stored, systemColor])
  const isDark = useMemo(() => isDarkFor(effectiveMode, systemColor), [effectiveMode, systemColor])
  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark])
  const gradients = useMemo(
    () => ({
      brand: brandGradient,
      crimson: crimsonGradient,
      page: isDark ? darkPageGradient : lightPageGradient,
    }),
    [isDark]
  )

  const value: ThemeContextValue = useMemo(
    () => ({ colors, gradients, mode: stored ?? 'system', isDark, setMode, transition }),
    [colors, gradients, stored, isDark, setMode, transition]
  )

  // Don't paint anything until we know the persisted mode and system scheme (no flash).
  if (!ready) return null

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
