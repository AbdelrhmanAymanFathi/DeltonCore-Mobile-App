import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import appConfig from '../../app.json'
import type {
  ApiError,
  BadgeCounts,
  ApiErrorCode,
  ApprovalRequestDetail,
  ApprovalRequestSummary,
  CompanySelectionResponse,
  CreatePenaltyRequest,
  DecideRequest,
  InboxQuery,
  LoginRequest,
  MeResponse,
  MobileLoginResult,
  Paginated,
  PenaltyFormContext,
  PunchRequest,
  PunchResponse,
  RegisterDeviceRequest,
  SiteEmployee,
  TodayStatus,
} from './types'

const ACCESS_KEY = 'dcp.access'
const REFRESH_KEY = 'dcp.refresh'
const DEVICE_ID_KEY = 'dcp.device_id'
const DEVICE_SECRET_KEY = 'dcp.device_secret'

/** Set per build. Must be https in anything but local development. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'https://hr.example.com/api/mobile'

/** Thrown for every non-2xx response. Screens switch on `code`. */
export class ApiFailure extends Error {
  code: ApiErrorCode
  status: number
  payload: ApiError

  constructor(status: number, payload: ApiError) {
    super(payload.detail || 'حدث خطأ غير متوقع')
    this.name = 'ApiFailure'
    this.status = status
    this.code = payload.code ?? 'unknown'
    this.payload = payload
  }
}

// ------------------------------------------------------------ token storage

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access)
  await SecureStore.setItemAsync(REFRESH_KEY, refresh)
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY)
  await SecureStore.deleteItemAsync(REFRESH_KEY)
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY)
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY)
}

// ------------------------------------------------------------ device identity

/**
 * The installation id, minted once and kept for the life of the install.
 * It is not a secret — it only names this device — so it survives logout;
 * the `device_secret` that makes it trusted does not.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  if (existing) return existing
  const fresh = Crypto.randomUUID()
  await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh)
  return fresh
}

/** The server-issued proof that this device already passed 2FA. May be null. */
export async function getDeviceSecret() {
  return SecureStore.getItemAsync(DEVICE_SECRET_KEY)
}

/**
 * The secret is returned exactly once (on the login that passed the code, or
 * on a rotation). Persist it immediately or the next login needs a fresh code.
 */
export async function saveDeviceSecret(secret: string) {
  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, secret)
}

export async function clearDeviceSecret() {
  await SecureStore.deleteItemAsync(DEVICE_SECRET_KEY)
}

/** The shipped app version, read from app.json so it cannot drift from the build. */
const APP_VERSION: string = appConfig.expo.version

/**
 * What an administrator sees for this install on the devices screen. The
 * server clips every field and never authorizes on them, so a missing or
 * odd-looking value is cosmetic, not a security problem.
 *
 * `Platform.constants` carries the Android brand/model and OS release without
 * adding a dependency. iOS exposes no model name, so it reports the system
 * name instead; anything else falls back to the platform identifier.
 */
function deviceMetadata() {
  const app_version = APP_VERSION
  if (Platform.OS === 'android') {
    const c = Platform.constants
    const name = [c.Brand, c.Model].filter(Boolean).join(' ').trim()
    return {
      device_name: name || 'Android',
      os_version: c.Release || String(c.Version),
      app_version,
    }
  }
  if (Platform.OS === 'ios') {
    return {
      device_name: Platform.constants.systemName || 'iOS',
      os_version: Platform.constants.osVersion,
      app_version,
    }
  }
  return { device_name: Platform.OS, os_version: String(Platform.Version), app_version }
}

// ------------------------------------------------------------ idempotency

/**
 * Every write carries one of these. Field networks retry; without it an
 * approval can deduct a leave balance twice. The key is generated once per
 * user intent, not per HTTP attempt — so a retry of the same tap reuses it.
 */
export function newIdempotencyKey() {
  return Crypto.randomUUID()
}

// ------------------------------------------------------------ core request

type Method = 'GET' | 'POST' | 'DELETE'

interface RequestOptions {
  method?: Method
  body?: unknown
  idempotencyKey?: string
  /**
   * Login/company-selection: a 401 here is an answer the caller acts on (a
   * missing second factor, a dead refresh token), not an expired session, so
   * it must never trigger a refresh nor clear the stored tokens.
   */
  noSessionHandling?: boolean
  /** Internal: prevents infinite refresh loops. */
  _retried?: boolean
}

/** Set by AuthContext so a hard 401 can drop the session from anywhere. */
let onSessionLost: (() => void) | null = null
export function setSessionLostHandler(fn: (() => void) | null) {
  onSessionLost = fn
}

/** A request that has not answered in this long is treated as failed. */
const REQUEST_TIMEOUT_MS = 15_000
/** One initial attempt plus two retries. */
const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 400

/** 429 (rate limited) and 503 (briefly overloaded) are worth another try. */
function isRetryableStatus(status: number) {
  return status === 429 || status === 503
}

/** Exponential ceiling with full jitter, so parallel retries do not sync up. */
function backoffDelay(attempt: number) {
  const ceiling = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), 3_000)
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbort(err: unknown) {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError'
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, noSessionHandling } = opts
  const access = await getAccessToken()

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client': 'mobile-app',
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (access) headers.Authorization = `Bearer ${access}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const url = `${API_BASE}${path}`
  const payload = body === undefined ? undefined : JSON.stringify(body)
  /**
   * A retry may only re-run a request that cannot be applied twice: a read, or
   * a write carrying an Idempotency-Key — and that key is reused verbatim, so
   * the server recognises the repeat instead of acting on it again.
   */
  const retryable = method === 'GET' || Boolean(idempotencyKey)

  let attempt = 0
  for (;;) {
    attempt += 1
    let res: Response
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      res = await fetch(url, { method, headers, body: payload, signal: controller.signal })
    } catch (err) {
      if (retryable && attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt))
        continue
      }
      // A dropped connection is rethrown as-is (messageFor names the network);
      // our own timeout gets a code so the copy can say "took too long".
      throw isAbort(err) ? new ApiFailure(408, { detail: '', code: 'timeout' }) : err
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      if (retryable && isRetryableStatus(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt))
        continue
      }
      const errorPayload = await safeJson<ApiError>(res)

      // A dead device binding cannot be repaired by rotating the token: the
      // refresh token carries the same claim and would be refused identically
      // (see core/mobile/auth.py _check_device_binding). Do not spend a round
      // trip on it — fall through and drop the session.
      const deviceBindingLost =
        errorPayload?.code === 'device_revoked' || errorPayload?.code === 'device_required'

      if (res.status === 401 && !noSessionHandling && !opts._retried && !deviceBindingLost) {
        const refreshed = await tryRefresh()
        if (refreshed) return request<T>(path, { ...opts, _retried: true })
      }

      // The account was locked or deactivated on the desktop, or the device was
      // revoked: the token is dead on arrival and refreshing will not help.
      if (
        !noSessionHandling &&
        (res.status === 401 ||
          errorPayload?.code === 'account_inactive' ||
          errorPayload?.code === 'password_locked')
      ) {
        await clearTokens()
        onSessionLost?.()
      }
      throw new ApiFailure(res.status, errorPayload ?? { detail: '', code: 'unknown' })
    }

    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

let refreshInFlight: Promise<boolean> | null = null

/** Single-flight: ten parallel 401s must not fire ten refreshes. */
async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const refresh = await SecureStore.getItemAsync(REFRESH_KEY)
      if (!refresh) return false
      const res = await fetch(`${API_BASE}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile-app' },
        body: JSON.stringify({ refresh }),
        signal: controller.signal,
      })
      if (!res.ok) return false
      const data = (await res.json()) as { access: string; refresh?: string }
      await SecureStore.setItemAsync(ACCESS_KEY, data.access)
      if (data.refresh) await SecureStore.setItemAsync(REFRESH_KEY, data.refresh)
      return true
    } catch {
      return false
    } finally {
      clearTimeout(timer)
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

// ------------------------------------------------------------ endpoints

export const api = {
  /**
   * Sends the installation id and, when the server has issued one, the
   * device secret that lets this device skip the second factor. The password
   * and any 2FA code are passed straight through and never persisted.
   */
  login: async (body: LoginRequest): Promise<MobileLoginResult> => {
    const deviceId = await getDeviceId()
    const deviceSecret = await getDeviceSecret()
    const res = await request<MobileLoginResult>('/login/', {
      method: 'POST',
      body: {
        device_id: deviceId,
        platform: Platform.OS as 'android',
        ...deviceMetadata(),
        ...(deviceSecret ? { device_secret: deviceSecret } : {}),
        ...body,
      },
      noSessionHandling: true,
    })
    // Issued once, on the login that passed the code or on a rotation.
    if ('device_secret' in res && res.device_secret) await saveDeviceSecret(res.device_secret)
    return res
  },

  /**
   * Picks a company. Two callers use it:
   *  - right after a multi-company login, with the `selection_token` the
   *    login returned (no session yet, hence `noSessionHandling`);
   *  - a company switch from inside a session, with only `company_id` — the
   *    backend then authenticates the Bearer access token instead.
   */
  selectCompany: (body: { company_id: string; selection_token?: string }) =>
    request<CompanySelectionResponse>('/auth/select-company/', {
      method: 'POST',
      body,
      noSessionHandling: true,
    }),

  /**
   * Blacklists the refresh token and revokes the device server-side. Best
   * effort: the caller clears local state regardless of the outcome.
   */
  logout: (body: { refresh?: string | null; device_id?: string | null }) =>
    request<void>('/logout/', {
      method: 'POST',
      body: {
        ...(body.refresh ? { refresh: body.refresh } : {}),
        ...(body.device_id ? { device_id: body.device_id } : {}),
      },
    }),

  me: () => request<MeResponse>('/me/'),

  badge: () => request<BadgeCounts>('/notifications/badge/'),

  inbox: (q: InboxQuery = {}) => {
    const p = new URLSearchParams()
    if (q.status) p.set('status', q.status)
    if (q.type) p.set('type', q.type)
    if (q.page) p.set('page', String(q.page))
    const qs = p.toString()
    return request<Paginated<ApprovalRequestSummary>>(
      `/requests/${qs ? `?${qs}` : ''}`,
    )
  },

  requestDetail: (id: string) =>
    request<ApprovalRequestDetail>(`/requests/${encodeURIComponent(id)}/`),

  decide: (id: string, body: DecideRequest, idempotencyKey: string) =>
    request<ApprovalRequestDetail>(`/requests/${encodeURIComponent(id)}/decide/`, {
      method: 'POST',
      body,
      idempotencyKey,
    }),

  punch: (body: PunchRequest, idempotencyKey: string) =>
    request<PunchResponse>('/attendance/punch/', {
      method: 'POST',
      body,
      idempotencyKey,
    }),

  today: (employeeId: number) =>
    request<TodayStatus>(`/attendance/today/?employee_id=${employeeId}`),

  siteEmployees: (siteId: number, q?: string) =>
    request<{ results: SiteEmployee[] }>(
      `/site-employees/?site_id=${siteId}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),

  penaltyForm: () => request<PenaltyFormContext>('/penalties/form/'),

  createPenalty: (body: CreatePenaltyRequest, idempotencyKey: string) =>
    request<{ id: number; ok: true }>('/penalties/', {
      method: 'POST',
      body,
      idempotencyKey,
    }),

  registerDevice: (body: RegisterDeviceRequest) =>
    request<void>('/devices/', { method: 'POST', body }),

  /** The backend routes this as DELETE /devices/<device_id>/ — not a query param. */
  unregisterDevice: (deviceId: string) =>
    request<void>(`/devices/${encodeURIComponent(deviceId)}/`, {
      method: 'DELETE',
    }),
}

// ------------------------------------------------------------ user-facing copy

/**
 * One place that turns an error code into something a supervisor standing in
 * a factory yard can act on. Never show a raw `detail` from the server.
 */
export function messageFor(err: unknown): string {
  if (!(err instanceof ApiFailure)) {
    return 'تعذّر الاتصال بالخادم. تأكد من الشبكة وحاول مرة أخرى.'
  }
  const p = err.payload
  switch (err.code) {
    case 'invalid_credentials':
      return 'اسم المستخدم أو كلمة المرور غير صحيحة.'
    case 'password_locked':
      return 'الحساب مقفول لانتهاء صلاحية كلمة المرور. راجع الموارد البشرية.'
    case 'too_many_attempts':
      return `محاولات كثيرة. حاول بعد ${(p.retry_after_seconds ?? 60).toLocaleString('ar-EG-u-nu-latn')} ثانية.`
    case 'account_inactive':
      return 'الحساب غير نشط. راجع الموارد البشرية.'
    case 'no_employee_profile':
      return 'حسابك غير مرتبط بسجل موظف، فلا يمكن استخدام التطبيق.'
    case 'no_mobile_access':
      return 'حسابك لا يملك صلاحية اعتماد أو تسجيل حضور.'
    case 'two_factor_required':
      return 'أدخل رمز التحقق بخطوتين لإكمال الدخول.'
    case 'two_factor_invalid':
      return 'رمز التحقق غير صحيح. تأكد من الرمز الظاهر في التطبيق وحاول مرة أخرى.'
    case 'two_factor_enrollment_required':
      return 'التحقق بخطوتين إلزامي لحسابك. فعّله من النسخة الويب أولًا.'
    case 'token_invalid':
    case 'missing_refresh_token':
    case 'invalid_refresh_token':
      return 'انتهت صلاحية الجلسة. سجّل الدخول من جديد.'
    case 'device_id_required':
      return 'تعذّر التعرّف على هذا الجهاز. أعد تشغيل التطبيق وحاول مرة أخرى.'
    case 'device_required':
      return 'هذه الجلسة غير مرتبطة بجهاز. سجّل الدخول من جديد.'
    case 'device_revoked':
      return 'تم إيقاف هذا الجهاز من الإدارة. راجع الموارد البشرية.'
    case 'no_company_access':
      return 'حسابك غير مرتبط بأي شركة، فلا يمكن استخدام التطبيق.'
    case 'COMPANY_REQUIRED':
      return 'اختر الشركة التي تريد الدخول إليها.'
    case 'COMPANY_FORBIDDEN':
      return 'لا تملك صلاحية الدخول إلى هذه الشركة.'
    case 'COMPANY_ARCHIVED':
      return 'هذه الشركة مؤرشفة ولا يمكن الدخول إليها.'
    case 'COMPANY_UNAVAILABLE':
      return 'الشركة غير متاحة الآن. حاول بعد قليل.'
    case 'unauthorized':
      return 'انتهت صلاحية الجلسة. سجّل الدخول من جديد.'
    case 'invalid_reason':
      return 'سبب الرفض مطلوب.'
    case 'no_permission':
      return 'لم تعد مخوَّلًا بالبتّ في هذا الطلب. حدّث القائمة.'
    case 'state_conflict':
      return 'تم البتّ في هذا الطلب من مكان آخر. سنحدّث القائمة الآن.'
    case 'out_of_range':
      return `أنت على بعد ${p.gps_distance_meters?.toLocaleString('ar-EG-u-nu-latn') ?? 'غير محدد'} مترًا من ${p.site_name ?? 'الموقع'}. المسموح ${p.allowed_radius_meters?.toLocaleString('ar-EG-u-nu-latn') ?? 'غير محدد'} مترًا.`
    case 'gps_inaccurate':
      return 'إشارة الموقع ضعيفة. اخرج إلى مكان مكشوف وحاول مرة أخرى.'
    case 'gps_unavailable':
      return 'لم نتمكن من تحديد موقعك. فعّل خدمة الموقع وحاول مرة أخرى.'
    case 'period_closed':
      return 'الفترة المحاسبية لهذا التاريخ مغلقة.'
    case 'duplicate_punch':
      return 'سُجّلت بصمة مطابقة قبل قليل. انتظر دقائق قبل إعادة المحاولة.'
    case 'already_checked_in':
      return 'مسجَّل حضور بالفعل. سجّل الانصراف أولًا.'
    case 'not_checked_in':
      return 'لا يوجد حضور مسجَّل. سجّل الحضور أولًا.'
    case 'attendance_method_not_allowed':
      return 'طريقة الحضور المسموحة لهذا الموظف لا تشمل التطبيق.'
    case 'location_mocked':
      return 'تم رصد تزييف للموقع. سُجّلت المحاولة ولم يُسجَّل الحضور.'
    case 'no_open_period':
      return 'لا توجد فترة محاسبية مفتوحة، فلا يمكن تسجيل جزاء الآن.'
    case 'idempotency_key_reuse':
      return 'تعارض في إعادة الإرسال. أعد فتح الشاشة وحاول مجددًا.'
    case 'timeout':
      return 'استغرق الاتصال وقتًا أطول من اللازم. تحقّق من الشبكة وحاول مرة أخرى.'
    default:
      return 'حدث خطأ غير متوقع. حاول مرة أخرى.'
  }
}
