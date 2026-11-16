import { act, renderHook } from '@testing-library/react-native'
import * as Location from 'expo-location'

import { usePunchLocation, messageForLocationFailure } from '../usePunchLocation'

jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { High: 'high' },
}))

const mockHasServices = Location.hasServicesEnabledAsync as jest.Mock
const mockRequestPermissions = Location.requestForegroundPermissionsAsync as jest.Mock
const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockHasServices.mockResolvedValue(true)
  mockRequestPermissions.mockResolvedValue({ status: 'granted' })
})

describe('messageForLocationFailure', () => {
  it('returns Arabic message for permission_denied', () => {
    expect(messageForLocationFailure('permission_denied')).toContain('إذن الوصول للموقع')
  })
  it('returns Arabic message for services_off', () => {
    expect(messageForLocationFailure('services_off')).toContain('خدمة تحديد الموقع')
  })
  it('returns Arabic message for timeout', () => {
    expect(messageForLocationFailure('timeout')).toContain('تعذّر تحديد موقعك')
  })
  it('returns Arabic message for stale', () => {
    expect(messageForLocationFailure('stale')).toContain('قراءة الموقع قديمة')
  })
  it('returns Arabic message for mocked', () => {
    expect(messageForLocationFailure('mocked')).toContain('تزييف')
  })
})

describe('usePunchLocation acquire', () => {
  it('returns services_off when location services are disabled', async () => {
    mockHasServices.mockResolvedValue(false)
    const { result } = await renderHook(() => usePunchLocation())
    await act(async () => {
      const res = await result.current.acquire()
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.failure).toBe('services_off')
    })
  })

  it('returns permission_denied when permission is not granted', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' })
    const { result } = await renderHook(() => usePunchLocation())
    await act(async () => {
      const res = await result.current.acquire()
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.failure).toBe('permission_denied')
    })
  })

  it('returns a fix with lat/long/accuracy on success', async () => {
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 30.0444, longitude: 31.2357, accuracy: 10 },
      timestamp: Date.now(),
      mocked: false,
    })
    const { result } = await renderHook(() => usePunchLocation())
    await act(async () => {
      const res = await result.current.acquire()
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.fix.latitude).toBe(30.0444)
        expect(res.fix.longitude).toBe(31.2357)
        expect(res.fix.accuracy_meters).toBe(10)
      }
    })
  })

  it('returns stale when the fix is older than MAX_FIX_AGE_MS', async () => {
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 30.0444, longitude: 31.2357, accuracy: 10 },
      timestamp: Date.now() - 31_000,
      mocked: false,
    })
    const { result } = await renderHook(() => usePunchLocation())
    await act(async () => {
      const res = await result.current.acquire()
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.failure).toBe('stale')
    })
  })

  it('returns mocked when the fix comes from a mock provider', async () => {
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 30.0444, longitude: 31.2357, accuracy: 10 },
      timestamp: Date.now(),
      mocked: true,
    })
    const { result } = await renderHook(() => usePunchLocation())
    await act(async () => {
      const res = await result.current.acquire()
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.failure).toBe('mocked')
    })
  })

  it('returns timeout on unexpected error', async () => {
    mockGetPosition.mockRejectedValue(new Error('boom'))
    const { result } = await renderHook(() => usePunchLocation())
    await act(async () => {
      const res = await result.current.acquire()
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.failure).toBe('timeout')
    })
  })
})
