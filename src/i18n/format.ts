import { countAr, isolateLtr } from './plural'

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const DAYS_AR = [
  'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة',
]

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

/** التاريخ الكامل: "الثلاثاء 17 نوفمبر 2026". */
export function formatDateFull(date: Date): string {
  return `${DAYS_AR[(date.getDay() + 1) % 7]} ${isolateLtr(String(date.getDate()))} ${MONTHS_AR[date.getMonth()]} ${isolateLtr(String(date.getFullYear()))}`
}

/** التاريخ المختصر: "17 نوفمبر". */
export function formatDateShort(date: Date): string {
  return `${isolateLtr(String(date.getDate()))} ${MONTHS_AR[date.getMonth()]}`
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** الوقت 12 ساعة: "08:05 ص" / "02:32 م". */
export function formatTime12(date: Date): string {
  let h = date.getHours()
  const period = h < 12 ? 'ص' : 'م'
  h = h % 12 || 12
  return `${isolateLtr(`${pad2(h)}:${pad2(date.getMinutes())}`)} ${period}`
}

/** المبلغ: "4,000 ج.م". فاصل آلاف إنجليزي، من غير كسور إلا لو موجودة. */
export function formatMoney(amount: number): string {
  const [whole, fraction] = Math.abs(amount).toString().split('.')
  const grouped = groupThousands(whole)
  const decimal = fraction === undefined ? '' : `.${fraction}`
  return `${isolateLtr(`${amount < 0 ? '-' : ''}${grouped}${decimal}`)} ج.م`
}

/** المسافة: "340 م"، ولو أكبر من 1000: "1.2 كم". */
export function formatDistance(meters: number | null): string {
  if (meters === null || meters === undefined) return 'غير محدد'
  if (meters > 1000) {
    return `${isolateLtr((meters / 1000).toFixed(1))} كم`
  }
  return `${isolateLtr(formatNumber(meters))} م`
}

/** "منذ {count} {unit}" بالجمع العربي الصحيح. */
export function formatSince(n: number, forms: { one: string; two: string; few: string; many: string; zero?: string }): string {
  if (n <= 0) return 'منذ لحظات'
  return `منذ ${countAr(n, { ...forms, zero: forms.zero })}`
}
