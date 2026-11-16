/**
 * Development mock.
 *
 * The backend does not exist yet. This patches global fetch so the whole app
 * — screens, auth, refresh, error handling — runs end to end today, against
 * exactly the shapes in types.ts.
 *
 * Enable with EXPO_PUBLIC_USE_MOCK=1. It refuses to activate in a release
 * build, so it cannot ship by accident.
 *
 * When the real API lands, delete nothing: flip the flag off and keep this as
 * the fixture set for offline demos and for reproducing field bug reports.
 */

import { API_BASE } from './client'
import type {
  ApprovalRequestDetail,
  ApprovalRequestSummary,
  CompanyCard,
  LoginResponse,
  Paginated,
} from './types'

const SESSION = {
  user: { id: 12, username: 'ahmed.sayed', full_name: 'أحمد سيد' },
  employee: {
    id: 340,
    employee_number: 'EMP-00340',
    full_name_ar: 'أحمد سيد عبد الحميد محمود',
    job_title: 'مشرف موقع',
    department: 'العمليات',
  },
  site: { id: 4, name_ar: 'مصنع العاشر من رمضان', name_en: '10th of Ramadan Plant' },
  permissions: [
    'core.can_manage_site_attendance',
    'core.can_approve_requests',
    'core.can_approve_loans',
    'core.can_approve_missions',
    'core.can_approve_penalties',
    'core.add_penaltyrecord',
  ],
  capabilities: {
    can_punch: true,
    can_approve: true,
    can_create_penalty: true,
    is_site_supervisor: true,
  },
  password_policy: { force_change: false, days_until_expiry: 12 },
}

const COMPANIES: CompanyCard[] = [
  {
    id: '8f14e45f-ceea-4a1f-9b1e-000000000001',
    slug: 'delton-core',
    name: 'Delton Core',
    name_ar: 'دلتون كور',
    name_en: 'Delton Core',
    logo: null,
    color: null,
    role: 'owner',
  },
]

/**
 * Fixture accounts used to rehearse the login branches:
 * - any password except `wrong` logs straight in;
 * - `twofa` is enrolled in 2FA: it demands a code, and a *trusted* device
 *   (one presenting the secret below) skips it on the next login;
 * - `enroll` must enrol on the web;
 * - `multico` has to pick a company first;
 * - `revoked` signs in, but its device was deactivated by the administrator:
 *   every call after the login answers 401 `device_revoked`, so the session is
 *   dropped instead of being refreshed.
 */
const MOCK_DEVICE_SECRET = 'mock.device.secret'
const MOCK_TOTP_CODE = '123456'
const MOCK_BACKUP_CODE = 'BACKUP-0001'
const TWO_FA_USERNAMES = ['twofa', 'two.fa']
const MULTI_COMPANY_USERNAMES = ['multico', 'multi.company']
const REVOKED_DEVICE_USERNAMES = ['revoked']

const MULTI_COMPANIES: CompanyCard[] = [
  COMPANIES[0],
  {
    id: '8f14e45f-ceea-4a1f-9b1e-000000000002',
    slug: 'delton-agro',
    name: 'Delton Agro',
    name_ar: 'دلتون أجرو',
    name_en: 'Delton Agro',
    logo: null,
    color: null,
    role: 'member',
  },
]

const INBOX: ApprovalRequestSummary[] = [
  {
    id: 'R-leave-901',
    request_type: 'leave',
    status: 'pending',
    approval_level: 1,
    employee: { id: 340, full_name_ar: 'محمود عبد الرحمن حسن', employee_number: 'EMP-00412' },
    title: 'إجازة سنوية',
    subtitle: '٣ أيام · من ٢٢ سبتمبر',
    source_created_at: '2026-09-19T10:42:00Z',
  },
  {
    id: 'R-loan-902',
    request_type: 'loan',
    status: 'pending',
    approval_level: 1,
    employee: { id: 355, full_name_ar: 'سيد محمد علي إبراهيم', employee_number: 'EMP-00355' },
    title: '٤٬٠٠٠ ج',
    subtitle: 'تُسدَّد على ٤ أشهر',
    source_created_at: '2026-09-18T08:15:00Z',
  },
  {
    id: 'R-mission-903',
    request_type: 'mission',
    status: 'pending',
    approval_level: 1,
    employee: { id: 372, full_name_ar: 'كريم أشرف السيد مصطفى', employee_number: 'EMP-00372' },
    title: 'إذن انصراف مبكر',
    subtitle: 'ساعتان · ٢٠ سبتمبر',
    source_created_at: '2026-09-18T07:02:00Z',
  },
  {
    id: 'R-penalty-904',
    request_type: 'penalty',
    status: 'pending',
    approval_level: 1,
    employee: { id: 388, full_name_ar: 'رمضان جمال عبد الله', employee_number: 'EMP-00388' },
    title: 'تأخير متكرر',
    subtitle: 'يوم واحد · سجّله م. طارق',
    source_created_at: '2026-09-17T14:30:00Z',
  },
]

const DETAIL: ApprovalRequestDetail = {
  ...INBOX[0],
  details: [
    { label: 'نوع الإجازة', value: 'سنوية' },
    { label: 'من', value: '٢٢ سبتمبر ٢٠٢٦' },
    { label: 'إلى', value: '٢٤ سبتمبر ٢٠٢٦' },
    { label: 'المدة', value: '٣ أيام' },
    { label: 'الرصيد بعد الاعتماد', value: '٩ أيام' },
    { label: 'السبب', value: 'ظروف عائلية، وسأعود للعمل يوم الخميس ٢٥ سبتمبر.' },
  ],
  actions: [],
  next_step: 'بعد اعتمادك ينتقل إلى الموارد البشرية',
}

const EMPLOYEES = [
  { id: 412, name: 'محمود عبد الرحمن حسن', employee_number: 'EMP-00412' },
  { id: 355, name: 'سيد محمد علي إبراهيم', employee_number: 'EMP-00355' },
  { id: 372, name: 'كريم أشرف السيد مصطفى', employee_number: 'EMP-00372' },
  { id: 388, name: 'رمضان جمال عبد الله', employee_number: 'EMP-00388' },
  { id: 401, name: 'مصطفى إبراهيم فؤاد سالم', employee_number: 'EMP-00401' },
  { id: 433, name: 'هاني سعيد عبد العزيز', employee_number: 'EMP-00433' },
]

const MOCK_PUNCH_ALWAYS_REJECTS = false
let punchAttempt = 0
/** Toggles on every successful mock punch so today alternates check-in / check-out. */
let mockCheckedIn = false
/** Set by the `revoked` fixture login: from then on every protected call is refused. */
let mockDeviceRevoked = false

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Deliberate latency so loading states are exercised during development. */
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms))

/** True only while the mock is patched onto global fetch. */
let mockActive = false

export function installMockApi() {
  if (!__DEV__) return
  if (process.env.EXPO_PUBLIC_USE_MOCK !== '1') return

  mockActive = true

  const realFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (!url.startsWith(API_BASE)) return realFetch(input, init)

    const path = url.slice(API_BASE.length)
    await delay()

    if (path === '/login/') {
      const body = JSON.parse((init?.body as string) ?? '{}')
      const username = String(body.username ?? '')
      if (body.password === 'wrong') {
        return json({ detail: '', code: 'invalid_credentials' }, 400)
      }
      if (username === 'enroll') {
        return json({ detail: '', code: 'two_factor_enrollment_required' }, 403)
      }

      const enrolled = TWO_FA_USERNAMES.includes(username)
      const trusted = enrolled && body.device_secret === MOCK_DEVICE_SECRET
      if (enrolled && !trusted) {
        const code = String(body.totp_code ?? body.backup_code ?? '').trim()
        if (!code) {
          return json(
            { detail: '', code: 'two_factor_required', two_factor_required: true },
            401,
          )
        }
        if (code !== MOCK_TOTP_CODE && code !== MOCK_BACKUP_CODE) {
          return json({ detail: '', code: 'two_factor_invalid' }, 401)
        }
      }

      if (MULTI_COMPANY_USERNAMES.includes(username)) {
        return json({
          companies: MULTI_COMPANIES,
          company_required: true,
          code: 'COMPANY_REQUIRED',
          selection_token: 'mock.selection.token',
          selection_expires_in: 300,
        })
      }

      // Fixture: the administrator deactivated this account's device, so by the
      // time the app calls any protected route the server answers 401
      // device_revoked. Login itself re-registers the device on the real
      // backend, so the refusal can only come *after* it — never here.
      mockDeviceRevoked = REVOKED_DEVICE_USERNAMES.includes(username)

      const res: LoginResponse = {
        access: 'mock.access',
        refresh: 'mock.refresh',
        ...SESSION,
        companies: COMPANIES,
        ...(enrolled
          ? { device_secret: MOCK_DEVICE_SECRET, device_secret_expires_at: '2027-01-01T00:00:00Z' }
          : {}),
      }
      return json(res)
    }

    // A device the administrator deactivated stops authenticating at once, so
    // every protected route below answers 401 device_revoked
    // (core/mobile/auth.py _check_device_binding).
    if (mockDeviceRevoked) {
      return json({ detail: '', code: 'device_revoked' }, 401)
    }

    if (path === '/auth/select-company/') {
      const body = JSON.parse((init?.body as string) ?? '{}')
      const picked = MULTI_COMPANIES.find((c) => c.id === body.company_id)
      if (!picked) return json({ detail: '', code: 'COMPANY_FORBIDDEN' }, 403)
      const res: LoginResponse = {
        access: 'mock.access',
        refresh: 'mock.refresh',
        ...SESSION,
        company: picked,
        companies: MULTI_COMPANIES,
      }
      return json(res)
    }

    if (path === '/me/') return json(SESSION)

    if (path === '/notifications/badge/') {
      return json({
        pending_approvals_count: INBOX.length,
        unread_notifications_count: 2,
      })
    }
    if (path === '/logout/') return json({ ok: true })

    if (path.startsWith('/devices/')) return json({ ok: true, revoked: 1 })

    if (path.startsWith('/requests/') && path.endsWith('/decide/')) {
      return json({ ...DETAIL, status: 'approved' })
    }

    const detailMatch = path.match(/^\/requests\/([^/?]+)\/$/)
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1])
      const base = INBOX.find((r) => r.id === id) ?? INBOX[0]
      return json({ ...DETAIL, ...base, details: DETAIL.details })
    }

    if (path.startsWith('/requests/')) {
      const q = new URLSearchParams(path.split('?')[1] ?? '')
      const type = q.get('type')
      const rows = type ? INBOX.filter((r) => r.request_type === type) : INBOX
      const res: Paginated<ApprovalRequestSummary> = {
        results: rows,
        count: rows.length,
        next: null,
      }
      return json(res)
    }

    if (path.startsWith('/attendance/today/')) {
      return json({
        employee_id: 340,
        last_punch: mockCheckedIn ? 'check_in' : null,
        last_punch_at: mockCheckedIn ? new Date().toISOString() : null,
        next_action: mockCheckedIn ? 'check_out' : 'check_in',
      })
    }

    // Attendance alternates between the two outcomes worth rehearsing: the
    // geofence rejection first, then a clean verified punch. Flip
    // MOCK_PUNCH_ALWAYS_REJECTS to sit on the rejection while styling it.
    if (path === '/attendance/punch/') {
      punchAttempt += 1
      if (MOCK_PUNCH_ALWAYS_REJECTS || punchAttempt % 2 === 1) {
        return json(
          {
            detail: '',
            code: 'out_of_range',
            site_name: 'مصنع العاشر من رمضان',
            gps_distance_meters: 340,
            allowed_radius_meters: 150,
            accuracy_meters: 22,
          },
          400,
        )
      }
      mockCheckedIn = !mockCheckedIn
      return json({
        id: 7781,
        ok: true,
        location_status: 'verified',
        gps_distance_meters: 34,
      })
    }

    if (path === '/penalties/form/') {
      return json({
        penalty_types: [
          { id: 1, name: 'تأخير متكرر' },
          { id: 2, name: 'غياب بدون إذن' },
          { id: 3, name: 'مخالفة سلامة' },
          { id: 4, name: 'سلوك' },
        ],
        open_period: { id: 92, label: 'سبتمبر ٢٠٢٦' },
        max_days_before_review: 5,
      })
    }

    if (path === '/penalties/') {
      return json({ id: 5512, ok: true })
    }

    if (path.startsWith('/site-employees/')) {
      const q = new URLSearchParams(path.split('?')[1] ?? '').get('q')?.trim() ?? ''
      const rows = EMPLOYEES.filter(
        (e) => !q || e.name.includes(q) || e.employee_number.includes(q),
      )
      return json({ results: rows })
    }

    return json({ detail: '', code: 'unknown' }, 404)
  }) as typeof fetch
}

export function isMockActive(): boolean {
  return mockActive
}
