/**
 * Locale state for the whole app: current language, persistence, direction.
 *
 * - The choice is persisted in expo-secure-store and read synchronously at
 *   module load, so the very first render is already in the right language.
 * - `t()` and the formatters read the module-level locale; components that
 *   must re-render on a switch call `useLocale()`.
 * - Direction is applied with a root `direction` style (see App.tsx), so
 *   switching between Arabic (RTL) and English (LTR) needs no app restart.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import * as SecureStore from 'expo-secure-store'

export type Locale = 'ar' | 'en'

export const DEFAULT_LOCALE: Locale = 'ar'
const STORAGE_KEY = '@delton_locale'

function readStoredLocale(): Locale {
  try {
    const value = SecureStore.getItem?.(STORAGE_KEY)
    if (value === 'ar' || value === 'en') return value
  } catch {
    // Storage can be unavailable (tests, first launch); fall back to default.
  }
  return DEFAULT_LOCALE
}

let currentLocale: Locale = readStoredLocale()

export function getLocale(): Locale {
  return currentLocale
}

export function isRTLLocale(locale: Locale = currentLocale): boolean {
  return locale === 'ar'
}

/** Test/internal hook: set the module locale without touching storage. */
export function setLocaleForTests(locale: Locale): void {
  currentLocale = locale
  styleCache.clear()
}

const styleCache = new Map<string, unknown>()

/** Direction-dependent values handed to `localeStyles` factories. */
export interface LocaleTokens {
  rtl: boolean
  /** Text alignment for the "reading start" side: right in Arabic, left in English. */
  align: 'left' | 'right'
  /** Opposite side of `align`. */
  alignOpposite: 'left' | 'right'
  /** Writing / layout direction for the active language. */
  dir: 'rtl' | 'ltr'
  /** Opposite of `dir`. */
  dirOpposite: 'rtl' | 'ltr'
  /**
   * For containers pinned to `direction: 'ltr'` (the Arabic layout is drawn in
   * physical coordinates there): a row that reads right-to-left in Arabic and
   * mirrors for English.
   */
  ltrRow: 'row' | 'row-reverse'
  /** Physical "reading start" edge inside a pinned-ltr column: right in Arabic, left in English. */
  ltrEnd: 'flex-start' | 'flex-end'
  ltrStart: 'flex-start' | 'flex-end'
}

export function localeTokens(locale: Locale = currentLocale): LocaleTokens {
  const rtl = isRTLLocale(locale)
  return {
    rtl,
    align: rtl ? 'right' : 'left',
    alignOpposite: rtl ? 'left' : 'right',
    dir: rtl ? 'rtl' : 'ltr',
    dirOpposite: rtl ? 'ltr' : 'rtl',
    ltrRow: rtl ? 'row' : 'row-reverse',
    ltrEnd: rtl ? 'flex-end' : 'flex-start',
    ltrStart: rtl ? 'flex-start' : 'flex-end',
  }
}

let styleFactoryId = 0

/**
 * Like StyleSheet.create, but the factory receives direction tokens and the
 * result follows the active locale. The returned object is used exactly like
 * a normal `StyleSheet.create` result (`s.card`); each property access
 * resolves against the current locale, so a re-render after a language switch
 * is all that is needed.
 */
type AnyStyle = ViewStyle | TextStyle | ImageStyle

export function localeStyles<T extends { [key: string]: AnyStyle }>(
  factory: (l: LocaleTokens) => T,
): T {
  const id = `f${styleFactoryId++}`
  const resolve = (): T => {
    const key = `${id}:${currentLocale}`
    const cached = styleCache.get(key) as T | undefined
    if (cached) return cached
    const sheet = StyleSheet.create(factory(localeTokens(currentLocale))) as T
    styleCache.set(key, sheet)
    return sheet
  }
  return new Proxy({} as T, {
    get: (_target, prop) => (resolve() as Record<string | symbol, unknown>)[prop],
    has: (_target, prop) => prop in (resolve() as object),
    ownKeys: () => Reflect.ownKeys(resolve() as object),
    getOwnPropertyDescriptor: (_target, prop) =>
      Object.getOwnPropertyDescriptor(resolve() as object, prop) && {
        enumerable: true,
        configurable: true,
        value: (resolve() as Record<string | symbol, unknown>)[prop],
      },
  })
}

interface LocaleContextValue extends LocaleTokens {
  locale: Locale
  setLocale: (next: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(currentLocale)

  const setLocale = useCallback((next: Locale) => {
    currentLocale = next
    setLocaleState(next)
    try {
      SecureStore.setItem?.(STORAGE_KEY, next)
    } catch {
      // Persisting is best effort; the switch still applies for this session.
    }
  }, [])

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, ...localeTokens(locale) }),
    [locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    // Outside a provider (e.g. isolated component tests): behave from module state.
    return { locale: currentLocale, setLocale: () => {}, ...localeTokens(currentLocale) }
  }
  return ctx
}
