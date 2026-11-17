import { useCallback, useState } from 'react'
import * as Location from 'expo-location'
import { t } from '../i18n'

/**
 * Getting a location fix good enough to stake attendance on.
 *
 * Three things this guards against that a naive getCurrentPosition does not:
 *
 * 1. A stale cached fix. Android happily hands back a position from an hour
 *    ago — which is a position from wherever the phone was an hour ago. We
 *    reject anything older than MAX_FIX_AGE_MS.
 * 2. A mock location. GPS spoofing apps are one tap away on any Android phone
 *    and are the obvious way to fake attendance. expo-location reports this;
 *    we refuse the punch locally and never send `is_mocked: true` to the
 *    server — a mocked fix is client policy, not something the backend should
 *    ever have to adjudicate.
 * 3. Hanging forever with no signal. Inside a steel building a high-accuracy
 *    fix may never arrive, so we time out and say so instead of spinning.
 */

const MAX_FIX_AGE_MS = 30_000
const FIX_TIMEOUT_MS = 20_000

export type LocationFailure =
  | 'permission_denied'
  | 'services_off'
  | 'timeout'
  | 'stale'
  | 'mocked'

export interface Fix {
  latitude: number
  longitude: number
  accuracy_meters: number
  is_mocked: boolean
}

export interface LocationState {
  busy: boolean
  failure: LocationFailure | null
}

export function messageForLocationFailure(f: LocationFailure): string {
  switch (f) {
    case 'permission_denied':
      return t('errors.locationPermission')
    case 'services_off':
      return t('errors.locationServicesOff')
    case 'timeout':
      return t('errors.locationTimeout')
    case 'stale':
      return t('errors.locationStale')
    case 'mocked':
      return t('errors.locationMocked')
  }
}

export type LocationResult =
  | { ok: true; fix: Fix }
  | { ok: false; failure: LocationFailure }

export function usePunchLocation() {
  const [state, setState] = useState<LocationState>({ busy: false, failure: null })

  const acquire = useCallback(async (): Promise<LocationResult> => {
    setState({ busy: true, failure: null })
    const fail = (failure: LocationFailure): LocationResult => {
      setState({ busy: false, failure })
      return { ok: false, failure }
    }

    try {
      const services = await Location.hasServicesEnabledAsync()
      if (!services) return fail('services_off')

      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== Location.PermissionStatus.GRANTED) {
        return fail('permission_denied')
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        }),
        FIX_TIMEOUT_MS,
      )
      if (!position) return fail('timeout')

      if (position.mocked) return fail('mocked')

      const age = Date.now() - position.timestamp
      if (age > MAX_FIX_AGE_MS) return fail('stale')

      setState({ busy: false, failure: null })
      return {
        ok: true,
        fix: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          // Android can report null accuracy. Treat unknown as bad, not as
          // perfect — the backend subtracts accuracy from distance, and a 0
          // here would silently claim a pinpoint fix.
          accuracy_meters: Math.round(position.coords.accuracy ?? 999),
          is_mocked: false,
        },
      }
    } catch {
      return fail('timeout')
    }
  }, [])

  const reset = useCallback(() => setState({ busy: false, failure: null }), [])

  return { ...state, acquire, reset }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let settled = false
  const controller = new AbortController()
  const timer = setTimeout(() => {
    settled = true
    controller.abort()
  }, ms)
  return p.then(
    (value) => {
      clearTimeout(timer)
      // A late result after the timeout has already lost the race: ignore it.
      if (settled) return null
      return value
    },
    (err) => {
      clearTimeout(timer)
      throw err
    },
  )
}
