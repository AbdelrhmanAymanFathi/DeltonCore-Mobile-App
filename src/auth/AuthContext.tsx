import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import {
  api,
  ApiFailure,
  clearDeviceSecret,
  clearTokens,
  getAccessToken,
  getDeviceId,
  getRefreshToken,
  saveTokens,
  setSessionLostHandler,
} from '../api/client'
import type {
  CompanyCard,
  LoginResponse,
  MobileLoginResult,
  SessionPayload,
} from '../api/types'
import { t } from '../i18n'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthValue {
  status: Status
  session: SessionPayload | null
  /**
   * The companies this identity may enter, as returned by the last login or
   * company switch. Login-only data: the backend exposes no "my companies"
   * endpoint and `/me/` omits it, so after a cold start this is empty and the
   * switch affordance stays hidden until the next login.
   */
  companies: CompanyCard[]
  /**
   * Runs the credential step. When the account is enrolled in two-factor
   * authentication the backend answers `401 two_factor_required` and this
   * rejects with that failure — the caller shows the code screen and calls
   * again with `totp_code` or `backup_code`. The password is never persisted.
   *
   * On a multi-company account the response carries no tokens: it is the
   * `COMPANY_REQUIRED` intermediate and the caller picks a company next.
   */
  signIn: (
    username: string,
    password: string,
    factor?: { totp_code?: string; backup_code?: string },
  ) => Promise<MobileLoginResult>
  /** Commits a login or company-selection response and opens the session. */
  adoptSession: (res: LoginResponse) => Promise<void>
  /**
   * Re-binds the session to another company. `select-company` accepts the
   * current Bearer token in place of a selection token, and returns a fresh
   * pair plus the updated `companies` list.
   */
  switchCompany: (companyId: string) => Promise<void>
  signOut: () => Promise<void>
  /** Re-reads /me/ so permission changes made on the desktop land here. */
  refreshSession: () => Promise<void>
  /** Last transient cold-start error, if any. null when the session is valid. */
  authError: string | null
  /** Re-runs /me/ after a transient cold-start failure. */
  retryAuth: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [companies, setCompanies] = useState<CompanyCard[]>([])
  /** Set on a transient cold-start failure (network, 5xx) so the UI can show a retry. */
  const [authError, setAuthError] = useState<string | null>(null)

  const dropSession = useCallback(() => {
    setSession(null)
    setCompanies([])
    setStatus('signedOut')
  }, [])

  useEffect(() => {
    setSessionLostHandler(dropSession)
    return () => setSessionLostHandler(null)
  }, [dropSession])

  const adoptSession = useCallback(async (res: LoginResponse) => {
    await saveTokens(res.access, res.refresh)
    // `companies` is a login-only list kept for the company picker, and the
    // device secret is already in SecureStore — neither belongs in the session.
    const {
      access: _a,
      refresh: _r,
      companies: list,
      device_secret: _ds,
      device_secret_expires_at: _de,
      ...rest
    } = res
    setCompanies(list ?? [])
    setSession(rest)
    setStatus('signedIn')
    setAuthError(null)
  }, [])

  /** A network error or 5xx at cold start is not an auth failure — keep tokens and offer retry. */
  const isDefiniteAuthFailure = (err: unknown): boolean => {
    if (!(err instanceof ApiFailure)) return false
    if (err.status === 401) return true
    return (
      err.code === 'device_revoked' ||
      err.code === 'device_required' ||
      err.code === 'account_inactive' ||
      err.code === 'password_locked'
    )
  }

  // On cold start we do not trust a stored token: the account may have been
  // locked or stripped of permissions on the desktop since last use. /me/ is
  // the only thing that proves the session is still good. A transient network
  // or server error keeps the tokens and offers a retry instead of logging out.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const token = await getAccessToken()
      if (!token) {
        if (!cancelled) setStatus('signedOut')
        return
      }
      try {
        const me = await api.me()
        if (cancelled) return
        setSession(me)
        setStatus('signedIn')
        setAuthError(null)
      } catch (err) {
        if (cancelled) return
        if (isDefiniteAuthFailure(err)) {
          await clearTokens()
          dropSession()
        } else {
          // Transient: keep the tokens, surface a retry.
          setAuthError(err instanceof Error ? err.message : t('errors.serverError'))
          setStatus('loading')
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [dropSession])

  /** Re-runs /me/ after a transient cold-start failure. Clears the error on success. */
  const retryAuth = useCallback(async () => {
    setAuthError(null)
    const token = await getAccessToken()
    if (!token) {
      setStatus('signedOut')
      return
    }
    try {
      const me = await api.me()
      setSession(me)
      setStatus('signedIn')
    } catch (err) {
      if (isDefiniteAuthFailure(err)) {
        await clearTokens()
        dropSession()
      } else {
        setAuthError(err instanceof Error ? err.message : t('errors.serverError'))
      }
    }
  }, [dropSession])

  const signIn = useCallback(
    async (
      username: string,
      password: string,
      factor?: { totp_code?: string; backup_code?: string },
    ) => {
      const res = await api.login({ username, password, ...factor })
      // A multi-company login returns no tokens; the caller selects a company.
      if ('access' in res && res.access && res.refresh) await adoptSession(res)
      return res
    },
    [adoptSession],
  )

  const signOut = useCallback(async () => {
    // Best effort: the server blacklists the refresh token and revokes this
    // device only when we actually send them — a fire-and-forget logout would
    // leave the refresh token valid for its whole lifetime. A network failure
    // must not trap the user in, so local state is cleared either way.
    try {
      const [refresh, deviceId] = await Promise.all([getRefreshToken(), getDeviceId()])
      await api.logout({ refresh, device_id: deviceId })
    } catch {
      // ignored on purpose
    }
    await clearTokens()
    await clearDeviceSecret()
    dropSession()
  }, [dropSession])

  const switchCompany = useCallback(
    async (companyId: string) => {
      // `select-company` reads the Bearer access token when no selection token
      // is sent, so no password or code is needed to switch.
      const res = await api.selectCompany({ company_id: companyId })
      await adoptSession(res)
    },
    [adoptSession],
  )

  const refreshSession = useCallback(async () => {
    const me = await api.me()
    setSession(me)
  }, [])

  /**
   * Permission edits happen on the desktop while the app sits in the
   * background, so the cached `/me/` is stale on return. Re-reading it also
   * picks up a company that was archived in the meantime.
   */
  useEffect(() => {
    if (status !== 'signedIn') return
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') refreshSession().catch(() => {})
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [status, refreshSession])

  const value = useMemo(
    () => ({
      status,
      session,
      companies,
      authError,
      signIn,
      adoptSession,
      switchCompany,
      signOut,
      refreshSession,
      retryAuth,
    }),
    [status, session, companies, authError, signIn, adoptSession, switchCompany, signOut, refreshSession, retryAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
