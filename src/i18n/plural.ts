export type PluralForms = {
  zero?: string
  one: string
  two: string
  few: string
  many: string
}

export function isolateLtr(value: string): string {
  return `\u2066${value}\u2069`
}

export function pluralAr(n: number, forms: PluralForms): string {
  const count = Math.trunc(n)
  if (count <= 0) return forms.zero ?? 'لا يوجد'
  if (count === 1) return forms.one
  if (count === 2) return forms.two
  if (count <= 10) return `${isolateLtr(String(count))} ${forms.few}`
  return `${isolateLtr(String(count))} ${forms.many}`
}

/**
 * مجموعات كلمات العداد الجاهزة للشاشات المتكررة، تُمرَّر لـ tCount.
 */
export const DAY_FORMS = { zero: 'لا توجد أيام', one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوم' }
export const REQUEST_FORMS = { zero: 'لا توجد طلبات', one: 'طلب', two: 'طلبين', few: 'طلبات', many: 'طلب' }
export const EMPLOYEE_FORMS = { zero: 'لا يوجد موظفون', one: 'موظف', two: 'موظفان', few: 'موظفين', many: 'موظف' }
export const MONTH_FORMS = { zero: 'لا توجد شهور', one: 'شهر', two: 'شهرين', few: 'شهور', many: 'شهر' }
export const HOUR_FORMS = { zero: 'لا توجد ساعات', one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' }
export const SECOND_FORMS = { zero: 'لا توجد ثوان', one: 'ثانية', two: 'ثانيتين', few: 'ثوان', many: 'ثانية' }

/**
 * عدد مع كلمته مضبوطة بالجمع العربي، من غير رقم للصفر حسب الحالات.
 */
export const countAr = pluralAr
