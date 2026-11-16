import * as SecureStore from 'expo-secure-store'

import { api, setSessionLostHandler } from '../client'

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-from-crypto'),
}))

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

let fetchMock: jest.Mock
let refreshResolve: ((val: Response) => void) | null = null

beforeEach(() => {
  refreshResolve = null
  ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token')
  ;(SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined)
  ;(SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined)

  fetchMock = jest.fn()
  global.fetch = fetchMock as unknown as typeof fetch
  setSessionLostHandler(null)
})

afterEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  refreshResolve = null
})

describe('tryRefresh timeout', () => {
  it('includes X-Client header on refresh request', async () => {
    let meCall = 0
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).includes('/token/refresh/')) {
        expect(init?.headers).toMatchObject({ 'X-Client': 'mobile-app' })
        return json(200, { access: 'access-2' })
      }
      meCall += 1
      if (meCall === 1) return json(401, { detail: '', code: 'token_invalid' })
      return json(200, { user: {}, employee: {} })
    })

    const res = await api.me()
    expect(res).toBeDefined()

    const refreshCall = fetchMock.mock.calls.find(
      (call) => String(call[0]).includes('/token/refresh/'),
    )
    expect(refreshCall).toBeDefined()
    expect(refreshCall![1]?.headers).toMatchObject({ 'X-Client': 'mobile-app' })
  })
})
