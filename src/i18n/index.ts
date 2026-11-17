/**
 * طبقة النصوص البسيطة للتطبيق.
 * t("المفتاح.الفرعي", { para: "قيمة" }) يستبدل {para} أو {{para}} بالقيمة الممررة.
 * لا تُضاف أي مكتبة خارجية — دالة t بسيطة تكفي.
 */

import { strings } from './ar-EG'
import {
  countAr,
  DAY_FORMS,
  HOUR_FORMS,
  MONTH_FORMS,
  REQUEST_FORMS,
  SECOND_FORMS,
} from './plural'
import {
  formatDateFull,
  formatDateShort,
  formatDistance,
  formatMoney,
  formatSince,
  formatTime12,
  formatNumber,
} from './format'

function get(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{\{([^}]+)\}\}|\{([^}]+)\}/g, (_match, p1, p2) => {
    const key = p1 ?? p2
    const value = params[key]
    return value === undefined || value === null ? `{${key ?? p1 ?? p2}}` : String(value)
  })
}

/**
 * تسترجع نص واجهة بالمفتاح، مثلاً t("home.punchIn") أو t("errors.required").
 * تعيد المفتاح نفسه لو لم يُوجد (لتسهيل التصحيح أثناء النقل).
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const value = get(strings as Record<string, unknown>, path)
  if (typeof value === 'function') {
    return interpolate(value(...(params ? Object.values(params) : [])), params)
  }
  if (typeof value === 'string') {
    return interpolate(value, params)
  }
  return path
}

/**
 * عداد مع كلمته بالجمع العربي، مثلاً tCount(3, { one: "يوم", two: "يومين", few: "أيام", many: "يوم" }).
 */
export function tCount(n: number, forms: { one: string; two: string; few: string; many: string; zero?: string }): string {
  return countAr(n, forms)
}

export {
  countAr,
  DAY_FORMS,
  HOUR_FORMS,
  MONTH_FORMS,
  REQUEST_FORMS,
  SECOND_FORMS,
}

/** خطأ متوقع تُعرض رسالته للمستخدم ويُسجل الأصل في وحدة التحكم. */
export class AppError extends Error {
  constructor(public code: string, message: string, public original?: unknown) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * تحوّل رمز/رسالة خطأ API إلى نص عربي آمن للعرض.
 * أي رمز غير معروف يتحول إلى "حصل خطأ غير متوقع، حاول مرة أخرى." والأصل يُسجل في console.
 */
export function mapError(error: unknown): string {
  // AppError يحمل نصًا عربيًا جاهزًا في رسالته.
  if (error instanceof AppError) {
    console.error(`[Delton] AppError ${error.code}:`, error.original)
    return error.message
  }

  const code = (error as { code?: string })?.code ?? 'unknown'
  const payload = (error as { payload?: Record<string, unknown> })?.payload ?? {}

  const mapped: Record<string, string | ((p: Record<string, unknown>) => string)> = {
    invalid_credentials: strings.errors.invalidCredentials,
    password_locked: strings.errors.accountLocked,
    too_many_attempts: (_p) => {
      const seconds = (_p.retry_after_seconds ?? 60) as number
      return t('errors.tooManyAttempts', { seconds: tCount(seconds, SECOND_FORMS) })
    },
    account_inactive: strings.errors.accountInactive,
    no_employee_profile: strings.errors.noEmployeeProfile,
    no_mobile_access: strings.errors.noMobileAccess,
    two_factor_required: strings.errors.twoFactorRequired,
    two_factor_invalid: strings.errors.twoFactorInvalid,
    two_factor_enrollment_required: strings.errors.twoFactorEnrollmentRequired,
    token_invalid: strings.errors.sessionExpired,
    missing_refresh_token: strings.errors.sessionExpired,
    invalid_refresh_token: strings.errors.sessionExpired,
    device_id_required: strings.errors.deviceNotRecognized,
    device_required: strings.errors.deviceNotLinked,
    device_revoked: strings.errors.deviceRevoked,
    no_company_access: strings.errors.noCompanyAccess,
    COMPANY_REQUIRED: strings.errors.companyRequired,
    COMPANY_FORBIDDEN: strings.errors.companyForbidden,
    COMPANY_ARCHIVED: strings.errors.companyArchived,
    COMPANY_UNAVAILABLE: strings.errors.companyUnavailable,
    unauthorized: strings.errors.sessionExpired,
    invalid_reason: strings.errors.invalidReason,
    no_permission: strings.errors.noPermission,
    state_conflict: strings.errors.stateConflict,
    out_of_range: (_p) => {
      const distance = formatDistance((_p.gps_distance_meters ?? null) as number | null)
      const allowed = formatDistance((_p.allowed_radius_meters ?? null) as number | null)
      return t('home.outOfRange', { distance, allowed })
    },
    gps_inaccurate: strings.errors.gpsInaccurate,
    gps_unavailable: strings.errors.locationNotAllowed,
    period_closed: strings.errors.periodClosed,
    duplicate_punch: strings.errors.duplicatePunch,
    already_checked_in: strings.errors.alreadyCheckedIn,
    not_checked_in: strings.errors.notCheckedIn,
    attendance_method_not_allowed: strings.errors.attendanceMethodNotAllowed,
    location_mocked: strings.errors.locationMocked,
    no_open_period: strings.errors.noOpenPeriod,
    idempotency_key_reuse: strings.errors.idempotencyReuse,
    timeout: strings.errors.timeout,
    unknown: strings.errors.unexpected,
  }

  const entry = mapped[code]
  let message: string
  if (typeof entry === 'function') {
    message = (entry as (p: Record<string, unknown>) => string)(payload)
  } else {
    message = entry ?? strings.errors.unexpected
  }

  console.error(`[Delton] API error ${code}:`, payload)
  return message
}

export { formatDateFull, formatDateShort, formatDistance, formatMoney, formatSince, formatTime12, formatNumber }
