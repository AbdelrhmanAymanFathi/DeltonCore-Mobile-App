/**
 * تنسيق التواريخ والأرقام والمبالغ والمسافات باللغة العربية (مصر).
 * لا يعتمد على Intl لضمان ثبات النتائج في محرك Hermes.
 */

import { countAr } from './plural'

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const DAYS_AR = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** أرقام إنجليزية خالصّة من غير تجميع. */
export function formatNumber(n: number): string {
  return String(Math.trunc(n))
}

/** التاريخ الكامل: "الثلاثاء 17 نوفمبر 2026". */
export function formatDateFull(date: Date): string {
  return `${DAYS_AR[date.getDay()]} ${date.getDate()} ${MONTHS_AR[date.getMonth()]} ${date.getFullYear()}`
}

/** التاريخ المختصر: "17 نوفمبر". */
export function formatDateShort(date: Date): string {
  return `${date.getDate()} ${MONTHS_AR[date.getMonth()]}`
}

/** الوقت 12 ساعة: "08:05 ص" / "02:32 م". */
export function formatTime12(date: Date): string {
  let h = date.getHours()
  const period = h < 12 ? 'ص' : 'م'
  h = h % 12 || 12
  return `${pad2(h)}:${pad2(date.getMinutes())} ${period}`
}

/** المبلغ: "4,000 ج.م". فاصل آلاف إنجليزي، من غير كسور إلا لو موجودة. */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount)
  const int = Math.trunc(abs)
  const digits = String(int).split('').reverse()
  const grouped = digits
    .map((c, i) => (i > 0 && i % 3 === 0 ? `,${c}` : c))
    .reverse()
    .join('')
  return amount < 0 ? `-${grouped} ج.م` : `${grouped} ج.م`
}

/** المسافة: "340 م"، ولو أكبر من 1000: "1.2 كم". */
export function formatDistance(meters: number | null): string {
  if (meters === null || meters === undefined) return 'غير محدد'
  if (meters > 1000) {
    return `${(meters / 1000).toFixed(1)} كم`
  }
  return `${Math.trunc(meters)} م`
}

/** "منذ {count} {unit}" بالجمع العربي الصحيح. */
export function formatSince(n: number, forms: { one: string; two: string; few: string; many: string; zero?: string }): string {
  if (n <= 0) return forms.zero ?? 'منذ لحظات'
  return `منذ ${countAr(n, { ...forms, zero: forms.zero })}`
}
