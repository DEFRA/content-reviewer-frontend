import { describe, it, expect } from 'vitest'
import { formatCurrency } from './format-currency.js'

const VALUE_1234 = 1234.56
const VALUE_ZERO = 0
const VALUE_NEGATIVE = -500
const VALUE_SMALL = 0.5
const LOCALE_EN_GB = 'en-GB'
const LOCALE_EN_US = 'en-US'
const CURRENCY_GBP = 'GBP'
const CURRENCY_USD = 'USD'
const CURRENCY_EUR = 'EUR'

describe('formatCurrency - default locale and currency', () => {
  it('should format a value with default en-GB locale and GBP', () => {
    const result = formatCurrency(VALUE_1234)

    expect(result).toBe('£1,234.56')
  })

  it('should format zero correctly', () => {
    const result = formatCurrency(VALUE_ZERO)

    expect(result).toBe('£0.00')
  })

  it('should format negative values correctly', () => {
    const result = formatCurrency(VALUE_NEGATIVE)

    expect(result).toContain('500')
    expect(result).toContain('£')
  })

  it('should format small decimal values correctly', () => {
    const result = formatCurrency(VALUE_SMALL)

    expect(result).toBe('£0.50')
  })
})

describe('formatCurrency - custom locale', () => {
  it('should format with en-US locale', () => {
    const result = formatCurrency(VALUE_1234, LOCALE_EN_US, CURRENCY_USD)

    expect(result).toContain('1,234.56')
    expect(result).toContain('$')
  })

  it('should use the supplied locale parameter', () => {
    const result = formatCurrency(VALUE_ZERO, LOCALE_EN_GB, CURRENCY_GBP)

    expect(result).toBe('£0.00')
  })
})

describe('formatCurrency - custom currency', () => {
  it('should format with EUR currency', () => {
    const result = formatCurrency(VALUE_1234, LOCALE_EN_GB, CURRENCY_EUR)

    expect(result).toContain('1,234.56')
    expect(result).toContain('€')
  })

  it('should format with USD currency', () => {
    const result = formatCurrency(VALUE_ZERO, LOCALE_EN_GB, CURRENCY_USD)

    expect(result).toContain('US$')
    expect(result).toContain('0.00')
  })
})
