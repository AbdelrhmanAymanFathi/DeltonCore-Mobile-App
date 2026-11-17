/**
 * الجمع العربي لمعدادات واجهة المستخدم.
 *
 * القواعد المطبقة:
 * - 0: صيغة العدامة الممررة صراحةً ("لا يوجد ...", "لا توجد ...")
 * - 1: المفرد بدون رقم ("يوم", "ساعة", "شهر", "طلب")
 * - 2: المثنى بدون رقم ("يومين", "ساعتين", "شهرين", "طلبين")
 * - 3 إلى 10: "{n} جمع+tاء" ("3 أيام", "10 طلبات")
 * - 11 فأكثر: "{n} مفرد" ("11 يوم", "100 طلب")
 */
export type PluralForms = {
  zero?: string
  one: string
  two: string
  few: string
  many: string
}

export function pluralAr(n: number, forms: PluralForms): string {
  if (n === 0) return forms.zero ?? forms.one
  if (n === 1) return forms.one
  if (n === 2) return forms.two
  if (n >= 3 && n <= 10) return forms.few
  return forms.many
}

/**
 * مجموعات كلمات العداد الجاهزة للشاشات المتكررة، تُمرَّر لـ tCount.
 */
export const DAY_FORMS = { zero: 'لا يوجد', one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوم' }
export const REQUEST_FORMS = { zero: 'لا يوجد', one: 'طلب', two: 'طلبين', few: 'طلبات', many: 'طلب' }
export const MONTH_FORMS = { zero: 'لا يوجد', one: 'شهر', two: 'شهرين', few: 'شهور', many: 'شهر' }
export const HOUR_FORMS = { zero: 'لا يوجد', one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' }
export const SECOND_FORMS = { zero: 'لا توجد', one: 'ثانية', two: 'ثانيتين', few: 'ثواني', many: 'ثانية' }

/**
 * عدد مع كلمته مضبوطة بالجمع العربي، من غير رقم للصفر حسب الحالات.
 */
export function countAr(n: number, forms: PluralForms): string {
  const word = pluralAr(n, forms)
  if (n === 0) return forms.zero ?? word
  if (n === 1 || n === 2) return word
  return `${n} ${word}`
}
