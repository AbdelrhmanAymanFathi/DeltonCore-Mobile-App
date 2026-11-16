import { act, renderHook } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'

import { AuthProvider, useAuth } from '../AuthContext'

jest.mock('../../api/client', () => ({
  api: {
    me: jest.fn(),
  },
  clearTokens: jest.fn(),
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setSessionLostHandler: jest.fn(),
  ApiFailure: class ApiFailure extends Error {
    code: string
    status: number
    payload: any
    constructor(status: number, payload: any) {
      super(payload.detail || 'خطأ')
      this.name = 'ApiFailure'
      this.status = status
      this.code = payload.code ?? 'unknown'
      this.payload = payload
    }
  },
}))

import { ApiFailure, api, clearTokens, getAccessToken } from '../../api/client'

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const mockMe = api.me as jest.Mock
const mockClearTokens = clearTokens as jest.Mock
mockClearTokens.mockImplementation(async () => {
  store.delete('dcp.access')
  store.delete('dcp.refresh')
})
const mockGetAccessToken = getAccessToken as jest.Mock

const store: Map<string, string> = new Map()

function setupStore(access: string | null) {
  store.clear()
  if (access) store.set('dcp.access', access)
  ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(
    async (key: string) => store.get(key) ?? null,
  )
  ;(SecureStore.setItemAsync as jest.Mock).mockImplementation(
    async (key: string, value: string) => {
      store.set(key, value)
    },
  )
  ;(SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
    store.delete(key)
  })
  mockGetAccessToken.mockResolvedValue(access)
}

function renderAuth() {
  return renderHook(() => useAuth(), {
    wrapper: AuthProvider,
  })
}

describe('AuthContext cold start', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMe.mockReset()
    mockClearTokens.mockReset()
    mockClearTokens.mockImplementation(async () => {
      store.delete('dcp.access')
      store.delete('dcp.refresh')
    })
  })

  it('keeps tokens on network error and shows retry state', async () => {
    setupStore('access-1')
    mockMe.mockRejectedValue(new Error('Network request failed'))

    const { result: hookResult } = await renderAuth()

    expect(mockClearTokens).not.toHaveBeenCalled()
    expect(store.has('dcp.access')).toBe(true)
    expect(typeof hookResult.current.retryAuth).toBe('function')
  })

  it('clears tokens on 401 token_invalid', async () => {
    setupStore('access-1')
    mockMe.mockRejectedValue(new ApiFailure(401, { detail: '', code: 'token_invalid' }))

    await act(async () => {
      await renderAuth()
    })

    expect(mockClearTokens).toHaveBeenCalled()
  })

  it('clears tokens on device_revoked', async () => {
    setupStore('access-1')
    mockMe.mockRejectedValue(new ApiFailure(401, { detail: '', code: 'device_revoked' }))

    await act(async () => {
      await renderAuth()
    })

    expect(mockClearTokens).toHaveBeenCalled()
  })

  it('clears tokens on account_inactive', async () => {
    setupStore('access-1')
    mockMe.mockRejectedValue(new ApiFailure(401, { detail: '', code: 'account_inactive' }))

    await act(async () => {
      await renderAuth()
    })

    expect(mockClearTokens).toHaveBeenCalled()
  })

  it('clears tokens on password_locked', async () => {
    setupStore('access-1')
    mockMe.mockRejectedValue(new ApiFailure(401, { detail: '', code: 'password_locked' }))

    await act(async () => {
      await renderAuth()
    })

    expect(mockClearTokens).toHaveBeenCalled()
  })

  it('clears tokens on device_required', async () => {
    setupStore('access-1')
    mockMe.mockRejectedValue(new ApiFailure(401, { detail: '', code: 'device_required' }))

    await act(async () => {
      await renderAuth()
    })

    expect(mockClearTokens).toHaveBeenCalled()
  })

  it('keeps tokens on 5xx server error', async () => {
    setupStore('access-1')
    mockMe.mockRejectedValue(new ApiFailure(500, { detail: '', code: 'unknown' }))

    await act(async () => {
      await renderAuth()
    })

    expect(mockClearTokens).not.toHaveBeenCalled()
    expect(store.has('dcp.access')).toBe(true)
  })
})
