/**
 * The client is the single place where a wrong assumption turns into a wrong
 * approval or a duplicate deduction, so these tests pin the four behaviours the
 * screens rely on: single-flight refresh, session loss on a dead refresh, the
 * idempotency key surviving a retry, and Arabic copy for every server code.
 */

import * as SecureStore from 'expo-secure-store'

import { ApiFailure, api, messageFor, setSessionLostHandler } from '../client'
import { API_ERROR_CODES } from '../types'

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

/** A stand-in for the parts of `Response` the client actually reads. */
function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

/** The one copy `messageFor` falls back to when a code has no dedicated line. */
const FALLBACK = 'حدث خطأ غير متوقع. حاول مرة أخرى.'

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

it('refreshes once when ten requests are answered with 401 at the same time', async () => {
  let refreshCalls = 0
  let refreshed = false

  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/token/refresh/')) {
      refreshCalls += 1
      // Hold the refresh open so every 401 of the burst arrives first.
      await new Promise((resolve) => setTimeout(resolve, 20))
      refreshed = true
      return json(200, { access: 'access-2' })
    }
    return refreshed
      ? json(200, { user: {}, employee: {} })
      : json(401, { detail: '', code: 'token_invalid' })
  })

  const results = await Promise.all(Array.from({ length: 10 }, () => api.me()))

  expect(refreshCalls).toBe(1)
  expect(results).toHaveLength(10)
  expect(store.get(ACCESS_KEY)).toBe('access-2')
})

it('drops the session locally when the refresh token is rejected', async () => {
  const onSessionLost = jest.fn()
  setSessionLostHandler(onSessionLost)

  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/token/refresh/')) {
      return json(401, { detail: '', code: 'invalid_refresh_token' })
    }
    return json(401, { detail: '', code: 'token_invalid' })
  })

  await expect(api.me()).rejects.toBeInstanceOf(ApiFailure)

  expect(onSessionLost).toHaveBeenCalledTimes(1)
  expect(store.has(ACCESS_KEY)).toBe(false)
  expect(store.has(REFRESH_KEY)).toBe(false)
})

it('drops a revoked device without spending a refresh on it', async () => {
  const onSessionLost = jest.fn()
  setSessionLostHandler(onSessionLost)

  let refreshCalls = 0
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/token/refresh/')) {
      refreshCalls += 1
      return json(200, { access: 'access-2' })
    }
    return json(401, { detail: '', code: 'device_revoked' })
  })

  await expect(api.me()).rejects.toBeInstanceOf(ApiFailure)

  // The refresh token carries the same dead device claim, so rotating it can
  // only be refused again: the client must not try.
  expect(refreshCalls).toBe(0)
  expect(onSessionLost).toHaveBeenCalledTimes(1)
  expect(store.has(ACCESS_KEY)).toBe(false)
  expect(store.has(REFRESH_KEY)).toBe(false)
})

it('drops a token that names no device, the same way', async () => {
  const onSessionLost = jest.fn()
  setSessionLostHandler(onSessionLost)

  let refreshCalls = 0
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/token/refresh/')) {
      refreshCalls += 1
      return json(200, { access: 'access-2' })
    }
    return json(401, { detail: '', code: 'device_required' })
  })

  await expect(api.me()).rejects.toBeInstanceOf(ApiFailure)

  expect(refreshCalls).toBe(0)
  expect(onSessionLost).toHaveBeenCalledTimes(1)
  expect(store.has(ACCESS_KEY)).toBe(false)
})

it('replays the same Idempotency-Key when a write is retried after a 429', async () => {
  let calls = 0
  fetchMock.mockImplementation(async () => {
    calls += 1
    return calls === 1
      ? json(429, { detail: '', code: 'too_many_attempts' })
      : json(200, { ok: true })
  })

  await api.decide('R-leave-41', { decision: 'approve' }, 'idem-1')

  const sentKeys = fetchMock.mock.calls.map(
    (call) => (call[1] as { headers: Record<string, string> }).headers['Idempotency-Key'],
  )
  expect(sentKeys).toEqual(['idem-1', 'idem-1'])
})

it('never replays a write that carries no Idempotency-Key', async () => {
  fetchMock.mockImplementation(async () => json(503, { detail: '', code: 'unknown' }))

  // /logout/ is sent without a key, so a 503 must not be replayed: the refresh
  // token may already be blacklisted, and a second attempt would answer 401.
  await expect(api.logout({ refresh: 'refresh-1' })).rejects.toBeInstanceOf(ApiFailure)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('has Arabic copy for every code the contract can produce', () => {
  for (const code of API_ERROR_CODES) {
    const message = messageFor(new ApiFailure(400, { detail: '', code }))
    expect(message.trim().length).toBeGreaterThan(0)
    // `unknown` is the documented fallback; every other code needs its own line.
    if (code !== 'unknown') {
      expect(message).not.toBe(FALLBACK)
    }
  }
})

it('names the network when the failure never reached the server', () => {
  expect(messageFor(new Error('Network request failed'))).toContain('تعذّر الاتصال')
})

it('tells the supervisor that the administrator deactivated this device', () => {
  const message = messageFor(new ApiFailure(401, { detail: '', code: 'device_revoked' }))
  expect(message).toBe('تم إيقاف هذا الجهاز من الإدارة. راجع الموارد البشرية.')
})
