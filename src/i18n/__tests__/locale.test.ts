import { t, tCount, formatTime12, formatMoney, DAY_FORMS } from '..'
import { setLocaleForTests } from '../locale'

afterEach(() => setLocaleForTests('ar'))

describe('locale switching', () => {
  it('translates through t() for the active locale', () => {
    setLocaleForTests('ar')
    expect(t('common.confirm')).toBe('تأكيد')
    setLocaleForTests('en')
    expect(t('common.confirm')).toBe('Confirm')
  })

  it('returns the key for a missing path', () => {
    setLocaleForTests('en')
    expect(t('nope.missing')).toBe('nope.missing')
  })

  it('formats times, money and plurals per locale', () => {
    const d = new Date(2026, 10, 17, 14, 32)
    setLocaleForTests('en')
    expect(formatTime12(d)).toBe('02:32 PM')
    expect(formatMoney(4000)).toBe('4,000 EGP')
    expect(tCount(1, DAY_FORMS)).toBe('1 day')
    expect(tCount(3, DAY_FORMS)).toBe('3 days')
    setLocaleForTests('ar')
    expect(formatTime12(d)).toContain('م')
  })
})
