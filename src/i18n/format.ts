import { countAr, isolateLtr } from './plural'
import { getLocale } from './locale'

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS_AR = [
  'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة',
]

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const isAr = () => getLocale() === 'ar'

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** أرقام إنجليزية خالصّة من غير تجميع. */
export function formatNumber(n: number): string {
  return String(Math.trunc(n))
}

/** التاريخ الكامل: "الثلاثاء 17 نوفمبر 2026" / "Tuesday, November 17, 2026". */
export function formatDateFull(date: Date): string {
  if (!isAr()) {
    return `${DAYS_EN[date.getDay()]}, ${MONTHS_EN[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }
  return `${DAYS_AR[(date.getDay() + 1) % 7]} ${isolateLtr(String(date.getDate()))} ${MONTHS_AR[date.getMonth()]} ${isolateLtr(String(date.getFullYear()))}`
}

/** التاريخ المختصر: "17 نوفمبر" / "Nov 17". */
export function formatDateShort(date: Date): string {
  if (!isAr()) return `${MONTHS_EN[date.getMonth()].slice(0, 3)} ${date.getDate()}`
  return `${isolateLtr(String(date.getDate()))} ${MONTHS_AR[date.getMonth()]}`
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** الوقت 12 ساعة: "08:05 ص" / "02:32 م" / "08:05 AM". */
export function formatTime12(date: Date): string {
  let h = date.getHours()
  const period = isAr() ? (h < 12 ? 'ص' : 'م') : (h < 12 ? 'AM' : 'PM')
  h = h % 12 || 12
  return `${isolateLtr(`${pad2(h)}:${pad2(date.getMinutes())}`)} ${period}`
}

/** المبلغ: "4,000 ج.م". فاصل آلاف إنجليزي، من غير كسور إلا لو موجودة. */
export function formatMoney(amount: number): string {
  const [whole, fraction] = Math.abs(amount).toString().split('.')
  const grouped = groupThousands(whole)
  const decimal = fraction === undefined ? '' : `.${fraction}`
  return `${isolateLtr(`${amount < 0 ? '-' : ''}${grouped}${decimal}`)} ${isAr() ? 'ج.م' : 'EGP'}`
}

/** المسافة: "340 م"، ولو أكبر من 1000: "1.2 كم". */
export function formatDistance(meters: number | null): string {
  if (meters === null || meters === undefined) return isAr() ? 'غير محدد' : 'Not set'
  if (meters > 1000) {
    return `${isolateLtr((meters / 1000).toFixed(1))} ${isAr() ? 'كم' : 'km'}`
  }
  return `${isolateLtr(formatNumber(meters))} ${isAr() ? 'م' : 'm'}`
}

/** "منذ {count} {unit}" بالجمع العربي الصحيح / "{count} {unit} ago". */
export function formatSince(n: number, forms: { one: string; two: string; few: string; many: string; zero?: string }): string {
  if (!isAr()) {
    if (n <= 0) return 'Just now'
    return `${countAr(n, forms)} ago`
  }
  if (n <= 0) return 'منذ لحظات'
  return `منذ ${countAr(n, { ...forms, zero: forms.zero })}`
}
