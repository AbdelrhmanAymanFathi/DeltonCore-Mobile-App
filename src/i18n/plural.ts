import { getLocale } from './locale'

export type PluralForms = {
  zero?: string
  one: string
  two: string
  few: string
  many: string
}

/** Wraps a value so digits/Latin text keep their order inside Arabic text. No-op in English. */
export function isolateLtr(value: string): string {
  return getLocale() === 'ar' ? `⁦${value}⁩` : value
}

export function pluralAr(n: number, forms: PluralForms): string {
  const count = Math.trunc(n)
  if (count <= 0) return forms.zero ?? 'لا يوجد'
  if (count === 1) return forms.one
  if (count === 2) return forms.two
  if (count <= 10) return `${isolateLtr(String(count))} ${forms.few}`
  return `${isolateLtr(String(count))} ${forms.many}`
}

/** English: "No items" / "1 item" / "3 items". `one` is singular, `many` plural. */
export function pluralEn(n: number, forms: PluralForms): string {
  const count = Math.trunc(n)
  if (count <= 0) return forms.zero ?? 'None'
  return `${count} ${count === 1 ? forms.one : forms.many}`
}

/** Counter with its noun, in the active language's plural rules. */
export function countAr(n: number, forms: PluralForms): string {
  return getLocale() === 'ar' ? pluralAr(n, forms) : pluralEn(n, forms)
}

/** Builds a forms object whose words follow the active language. */
function localizedForms(ar: PluralForms, en: PluralForms): PluralForms {
  const pick = () => (getLocale() === 'ar' ? ar : en)
  return {
    get zero() { return pick().zero },
    get one() { return pick().one },
    get two() { return pick().two },
    get few() { return pick().few },
    get many() { return pick().many },
  }
}

/**
 * Ready-made noun forms for recurring screens, passed to tCount.
 */
export const DAY_FORMS = localizedForms(
  { zero: 'لا توجد أيام', one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوم' },
  { zero: 'No days', one: 'day', two: 'days', few: 'days', many: 'days' },
)
export const REQUEST_FORMS = localizedForms(
  { zero: 'لا توجد طلبات', one: 'طلب', two: 'طلبين', few: 'طلبات', many: 'طلب' },
  { zero: 'No requests', one: 'request', two: 'requests', few: 'requests', many: 'requests' },
)
export const EMPLOYEE_FORMS = localizedForms(
  { zero: 'لا يوجد موظفون', one: 'موظف', two: 'موظفان', few: 'موظفين', many: 'موظف' },
  { zero: 'No employees', one: 'employee', two: 'employees', few: 'employees', many: 'employees' },
)
export const MONTH_FORMS = localizedForms(
  { zero: 'لا توجد شهور', one: 'شهر', two: 'شهرين', few: 'شهور', many: 'شهر' },
  { zero: 'No months', one: 'month', two: 'months', few: 'months', many: 'months' },
)
export const HOUR_FORMS = localizedForms(
  { zero: 'لا توجد ساعات', one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' },
  { zero: 'No hours', one: 'hour', two: 'hours', few: 'hours', many: 'hours' },
)
export const SECOND_FORMS = localizedForms(
  { zero: 'لا توجد ثوان', one: 'ثانية', two: 'ثانيتين', few: 'ثوان', many: 'ثانية' },
  { zero: 'No seconds', one: 'second', two: 'seconds', few: 'seconds', many: 'seconds' },
)
