/**
 * The /api/mobile/ contract.
 *
 * This file is the single source of truth the app builds against. It mirrors
 * the shapes specified in the builder prompts. When the backend lands, diff
 * MOBILE_API.md against this file first — a mismatch here is a bug there or
 * here, never something to paper over in a screen.
 */

// ---------------------------------------------------------------- auth

export interface LoginRequest {
  username: string
  password: string
  /**
   * The app's stable installation id. The backend trusts a device only when
   * this is paired with the `device_secret` it issued once — a bare id is not
   * enough (see `core/auth_views.py:mobile_gate`).
   */
  device_id?: string
  /** Returned once inside the login response, then replayed on every login. */
  device_secret?: string
  platform?: 'android'
  /**
   * Descriptive metadata for the admin devices screen. Never used for
   * authorization: the server clips it and stores it for display only, and a
   * later login that omits a field leaves the stored value intact.
   */
  device_name?: string
  os_version?: string
  app_version?: string
  /** Six-digit authenticator code from the 2FA step. */
  totp_code?: string
  /** Alternative one-time recovery code. */
  backup_code?: string
}

export interface MobileUser {
  id: number
  username: string
  full_name: string
}

/**
 * One company an identity may enter (T26). `id` is the company's public id —
 * an opaque string, never an integer: pass it back verbatim to the
 * select-company endpoint.
 */
export interface CompanyCard {
  id: string
  slug: string
  name: string
  name_ar: string | null
  name_en: string | null
  logo: string | null
  color: string | null
  role: string
}

export interface MobileEmployee {
  id: number
  employee_number: string
  full_name_ar: string
  job_title: string | null
  department: string | null
}

export interface MobileSite {
  id: number
  name_ar: string
  name_en: string | null
}

/**
 * Feature flags computed server-side from RBAC permissions.
 * The app reads these and never checks a permission string itself, so
 * renaming a permission in the backend cannot break a shipped build.
 */
export interface Capabilities {
  can_punch: boolean
  can_approve: boolean
  can_create_penalty: boolean
  is_site_supervisor: boolean
  is_superuser?: boolean
}

export interface PasswordPolicy {
  /** Login is allowed but the password is past its expiry: the web app must change it. */
  force_change: boolean
  /**
   * Always an integer, never null: the backend sends
   * `int(policy.get('days_until_expiry') or 0)`, so 0 means "expired today"
   * (which arrives together with `force_change`).
   */
  days_until_expiry: number
}

export interface SessionPayload {
  user: MobileUser
  employee: MobileEmployee
  site: MobileSite | null
  permissions: string[]
  capabilities: Capabilities
  password_policy: PasswordPolicy
  /**
   * Additive (T26): the company the token pair is bound to. Present on the
   * login response in multi-company mode; `/me/` does not return it.
   */
  company?: CompanyCard
}

export interface LoginResponse extends SessionPayload {
  access: string
  refresh: string
  /**
   * Additive (T26): every company this identity may enter. Login-only — keep
   * it in memory for the company picker rather than reading it from `/me/`.
   */
  companies?: CompanyCard[]
  /**
   * Present only when the server issued or rotated the trusted-device secret.
   * It is shown once: persist it or the next login needs a fresh code.
   */
  device_secret?: string
  device_secret_expires_at?: string
}

/**
 * The multi-company login intermediate: the password and second factor were
 * accepted, but no token pair is issued until a company is chosen. Send
 * `selection_token` to the select-company endpoint together with a `company_id`
 * taken from `companies`.
 */
export interface CompanySelectionRequired {
  companies: CompanyCard[]
  company_required: true
  code: 'COMPANY_REQUIRED'
  selection_token: string
  selection_expires_in: number
}

/** POST /api/mobile/auth/select-company/ — same shape as a successful login. */
export type CompanySelectionResponse = LoginResponse

/**
 * What `POST /api/mobile/login/` can answer with: a token pair, or — when the
 * identity may enter several companies — the intermediate that asks the app to
 * choose one first (HTTP 200, no tokens yet).
 */
export type MobileLoginResult = LoginResponse | CompanySelectionRequired

/** GET /api/mobile/me/ — same as login minus the tokens. */
export type MeResponse = SessionPayload

// ---------------------------------------------------------------- errors

/**
 * Every rejection the backend can return, as a closed set.
 *
 * It is a runtime array as well as a type so a test can hold `messageFor` to
 * its contract: adding a code without Arabic copy fails the suite instead of
 * silently falling through to "حدث خطأ غير متوقع".
 */
export const API_ERROR_CODES = [
  // auth
  'invalid_credentials',
  'password_locked',
  'too_many_attempts',
  'account_inactive',
  'no_employee_profile',
  'no_mobile_access',
  'token_invalid',
  // device binding (core/mobile/auth.py _check_device_binding + the login view)
  'device_id_required',
  'device_required',
  'device_revoked',
  // two-factor (core/auth_views.py mobile_gate)
  'two_factor_required',
  'two_factor_invalid',
  'two_factor_enrollment_required',
  // token lifecycle
  'missing_refresh_token',
  'invalid_refresh_token',
  // multi-company (tenancy/identity.py)
  'no_company_access',
  'COMPANY_FORBIDDEN',
  'COMPANY_ARCHIVED',
  'COMPANY_REQUIRED',
  'COMPANY_UNAVAILABLE',
  'unauthorized',
  // requests inbox decisions
  'invalid_reason',
  'no_permission',
  'state_conflict',
  // attendance / geofence
  'out_of_range',
  'gps_inaccurate',
  'gps_unavailable',
  'period_closed',
  'duplicate_punch',
  'already_checked_in',
  'not_checked_in',
  'attendance_method_not_allowed',
  'location_mocked',
  'no_open_period',
  // write safety
  'idempotency_key_reuse',
  // client-side: the request outlived its 15s budget (no server code exists)
  'timeout',
  // fallback
  'unknown',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export interface ApiError {
  detail: string
  code: ApiErrorCode
  /** Present on 429 only. */
  retry_after_seconds?: number
  /** Present on out_of_range / gps_inaccurate — the screen shows these numbers. */
  site_name?: string
  /** out_of_range reports this; there is no plain `distance_meters`. */
  gps_distance_meters?: number
  allowed_radius_meters?: number
  accuracy_meters?: number
  /** Present on two_factor_required — true when a code must be supplied. */
  two_factor_required?: boolean
  /** Present on COMPANY_REQUIRED — the companies to choose from. */
  companies?: CompanyCard[]
  /** Present on password_locked — the server's own view of the policy. */
  password_policy?: PasswordPolicy
}

// ---------------------------------------------------------------- requests inbox

export type RequestType = 'leave' | 'loan' | 'mission' | 'penalty'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface RequestDetailRow {
  label: string
  value: string
}

/**
 * One row in the inbox. `title` / `subtitle` / `details` are rendered by the
 * backend's per-type adapter, so adding a fifth request type needs no app
 * release.
 */
export interface ApprovalRequestSummary {
  /**
   * A composite id such as "R-leave-41", not an integer: the backend keeps
   * the four request types in their own tables and mints one unified id
   * across them. Never parse it — pass it back exactly as received.
   */
  id: string
  request_type: RequestType
  status: RequestStatus
  approval_level: number
  employee: {
    id: number
    full_name_ar: string
    employee_number: string
  }
  title: string
  subtitle: string
  source_created_at: string
}

export interface ApprovalActionRecord {
  id: number
  decision: 'approved' | 'rejected'
  actor_name: string
  reason: string
  level: number
  client_source: 'app' | 'desktop'
  decided_at: string
}

export interface ApprovalRequestDetail extends ApprovalRequestSummary {
  details: RequestDetailRow[]
  actions: ApprovalActionRecord[]
  /** What happens after this approval — e.g. "ينتقل إلى الموارد البشرية". */
  next_step: string | null
}

export interface InboxQuery {
  status?: 'pending' | 'decided'
  type?: RequestType
  page?: number
}

export interface Paginated<T> {
  results: T[]
  count: number
  next: number | null
}

export interface DecideRequest {
  decision: 'approve' | 'reject'
  /** Required when decision is 'reject'. */
  reason?: string
}

/**
 * GET /api/mobile/notifications/badge/
 *
 * Polling is the guaranteed delivery path in this deployment: push is
 * optional and may be disabled entirely. These counts come straight from the
 * database, so they are correct whether or not push is configured.
 */
export interface BadgeCounts {
  pending_approvals_count: number
  unread_notifications_count: number
}

// ---------------------------------------------------------------- attendance

export type AttendanceType = 'check_in' | 'check_out'

export interface PunchRequest {
  employee_id: number
  attendance_type: AttendanceType
  latitude: number
  longitude: number
  accuracy_meters: number
  /**
   * The device reported the fix as coming from a mock-location provider.
   * The app already refuses to send one, so a `true` reaching the server
   * means the client was tampered with — the backend should reject it and
   * record the attempt rather than trust the app's own check.
   */
  is_mocked: boolean
}

/**
 * `verified` — inside the site fence; `no_gps` — the site has coordinates but
 * the request carried none; `no_coordinates` — the site itself has no
 * coordinates, so the fence was not enforced. `not_enforced` is kept as a
 * defensive superset; the current punch endpoint does not emit it (the fence
 * being off surfaces as `no_coordinates`).
 */
export type LocationStatus =
  | 'verified'
  | 'not_enforced'
  | 'no_coordinates'
  | 'no_gps'

export interface PunchResponse {
  id: number
  ok: true
  location_status: LocationStatus
  gps_distance_meters: number | null
}

export interface TodayStatus {
  employee_id: number
  /** null when nothing recorded today. */
  last_punch: AttendanceType | null
  last_punch_at: string | null
  /** What the big button should do next. */
  next_action: AttendanceType
}

// ---------------------------------------------------------------- penalties

export interface PenaltyTypeOption {
  id: number
  name: string
}

/** GET /api/mobile/penalties/form/ — everything the penalty screen needs. */
export interface PenaltyFormContext {
  penalty_types: PenaltyTypeOption[]
  /** null when no payroll period is open — the screen must block submission. */
  open_period: { id: number; label: string } | null
  max_days_before_review: number
}

export interface SiteEmployee {
  id: number
  name: string
  employee_number: string
}

export interface CreatePenaltyRequest {
  employee_id: number
  penalty_type_id: number
  /** Decimal as string to avoid float drift on payroll-affecting values. */
  days: string
  penalty_date: string
  reason: string
}

// ---------------------------------------------------------------- devices

export interface RegisterDeviceRequest {
  fcm_token: string
  device_id: string
  platform: 'android'
}
