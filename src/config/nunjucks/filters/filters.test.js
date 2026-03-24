import { describe, it, expect } from 'vitest'
import {
  min,
  assign,
  formatDate,
  formatCurrency,
  highlightContent,
  renderUrlContent
} from './filters.js'

const EMPTY_ARRAY = []
const ARRAY_VALUE_A = 42
const ARRAY_VALUE_B = 5
const ARRAY_VALUE_C = 1
const ARRAY_VALUE_D = 9
const ARRAY_VALUE_E = 3
const ARRAY_NEG_A = -3
const ARRAY_NEG_B = -1
const ARRAY_NEG_C = -7
const SINGLE_ITEM_ARRAY = [ARRAY_VALUE_A]
const MULTI_ITEM_ARRAY = [
  ARRAY_VALUE_B,
  ARRAY_VALUE_C,
  ARRAY_VALUE_D,
  ARRAY_VALUE_E
]
const NEGATIVE_ARRAY = [ARRAY_NEG_A, ARRAY_NEG_B, ARRAY_NEG_C]
const EXPECTED_MIN_MULTI = 1
const EXPECTED_MIN_SINGLE = 42
const EXPECTED_MIN_NEGATIVE = -7
const EXPECTED_ZERO = 0

describe('filters - min function', () => {
  it('should return minimum value from a numeric array', () => {
    expect(min(MULTI_ITEM_ARRAY)).toBe(EXPECTED_MIN_MULTI)
  })

  it('should return the single value from a one-element array', () => {
    expect(min(SINGLE_ITEM_ARRAY)).toBe(EXPECTED_MIN_SINGLE)
  })

  it('should return 0 for an empty array', () => {
    expect(min(EMPTY_ARRAY)).toBe(EXPECTED_ZERO)
  })

  it('should return 0 when given a non-array', () => {
    expect(min('not-an-array')).toBe(EXPECTED_ZERO)
  })

  it('should return 0 when given null', () => {
    expect(min(null)).toBe(EXPECTED_ZERO)
  })

  it('should return 0 when given undefined', () => {
    expect(min(undefined)).toBe(EXPECTED_ZERO)
  })

  it('should return minimum value from negative numbers', () => {
    expect(min(NEGATIVE_ARRAY)).toBe(EXPECTED_MIN_NEGATIVE)
  })
})

describe('filters - assign re-export', () => {
  it('should export assign as a function', () => {
    expect(typeof assign).toBe('function')
  })

  it('should merge objects correctly', () => {
    const target = { a: 1 }
    const source = { b: 2 }
    const result = assign(target, source)

    expect(result).toMatchObject({ a: 1, b: 2 })
  })
})

describe('filters - re-exported functions', () => {
  it('should export formatDate as a function', () => {
    expect(typeof formatDate).toBe('function')
  })

  it('should export formatCurrency as a function', () => {
    expect(typeof formatCurrency).toBe('function')
  })

  it('should export highlightContent as a function', () => {
    expect(typeof highlightContent).toBe('function')
  })

  it('should export renderUrlContent as a function', () => {
    expect(typeof renderUrlContent).toBe('function')
  })
})
