import { useCallback, useState } from 'react'
import * as Location from 'expo-location'

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
 *    we refuse the punch and let the backend record the attempt.
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
      return 'التطبيق يحتاج إذن الوصول للموقع لتسجيل الحضور. فعّله من إعدادات الجهاز.'
    case 'services_off':
      return 'خدمة تحديد الموقع مغلقة في الجهاز. شغّلها وحاول مرة أخرى.'
    case 'timeout':
      return 'تعذّر تحديد موقعك. اخرج إلى مكان مكشوف وحاول مرة أخرى.'
    case 'stale':
      return 'قراءة الموقع قديمة. انتظر لحظة وحاول مرة أخرى.'
    case 'mocked':
      return 'تم رصد تطبيق لتزييف الموقع على هذا الجهاز. أوقفه لتسجيل الحضور.'
  }
}

export function usePunchLocation() {
  const [state, setState] = useState<LocationState>({ busy: false, failure: null })

  const acquire = useCallback(async (): Promise<Fix | null> => {
    setState({ busy: true, failure: null })
    const fail = (failure: LocationFailure) => {
      setState({ busy: false, failure })
      return null
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
          // Never accept a cached fix: 0 forces a fresh one.
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
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        // Android can report null accuracy. Treat unknown as bad, not as
        // perfect — the backend subtracts accuracy from distance, and a 0
        // here would silently claim a pinpoint fix.
        accuracy_meters: Math.round(position.coords.accuracy ?? 999),
        is_mocked: false,
      }
    } catch {
      return fail('timeout')
    }
  }, [])

  const reset = useCallback(() => setState({ busy: false, failure: null }), [])

  return { ...state, acquire, reset }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}
