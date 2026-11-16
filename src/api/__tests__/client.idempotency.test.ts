import * as SecureStore from 'expo-secure-store'

import { ApiFailure, api, setSessionLostHandler } from '../client'

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-from-crypto'),
}))

const ACCESS_KEY = 'dcp.access'
const REFRESH_KEY = 'dcp.refresh'

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

let store: Map<string, string>
let fetchMock: jest.Mock

beforeEach(() => {
  store = new Map([
    [ACCESS_KEY, 'access-1'],
    [REFRESH_KEY, 'refresh-1'],
  ])
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

  fetchMock = jest.fn()
  global.fetch = fetchMock as unknown as typeof fetch
  setSessionLostHandler(null)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('idempotency key lifecycle', () => {
  it('keeps the same key after network errors', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'))

    // Multiple attempts all use the same key
    for (let i = 0; i < 3; i++) {
      try {
        await api.decide('R-leave-41', { decision: 'approve' }, 'idem-1')
      } catch {
        // expected
      }
    }

    const sentKeys = fetchMock.mock.calls.map(
      (call) => (call[1] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    )
    // Every call uses the same key — never rotated on network error
    expect(sentKeys.every((k) => k === 'idem-1')).toBe(true)
    expect(sentKeys.length).toBeGreaterThan(0)
  })

  it('keeps the same key after an ApiFailure timeout', async () => {
    fetchMock.mockRejectedValue(new ApiFailure(408, { detail: '', code: 'timeout' }))

    for (let i = 0; i < 2; i++) {
      try {
        await api.decide('R-leave-41', { decision: 'approve' }, 'idem-1')
      } catch {
        // expected
      }
    }

    const sentKeys = fetchMock.mock.calls.map(
      (call) => (call[1] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    )
    expect(sentKeys.every((k) => k === 'idem-1')).toBe(true)
  })

  it('rotates the key on a definite server answer (4xx/5xx with code)', async () => {
    fetchMock.mockRejectedValue(new ApiFailure(400, { detail: '', code: 'out_of_range' }))

    try {
      await api.decide('R-leave-41', { decision: 'approve' }, 'idem-1')
    } catch {
      // expected
    }
    // Next attempt with a new key (rotated)
    try {
      await api.decide('R-leave-41', { decision: 'approve' }, 'uuid-from-crypto')
    } catch {
      // expected
    }

    const sentKeys = fetchMock.mock.calls.map(
      (call) => (call[1] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    )
    expect(sentKeys).toContain('idem-1')
    expect(sentKeys).toContain('uuid-from-crypto')
  })
})
