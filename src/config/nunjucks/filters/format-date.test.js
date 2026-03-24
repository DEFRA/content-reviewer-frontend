import { describe, it, expect } from 'vitest'
import { formatDate } from './format-date.js'

const ISO_DATE = '2024-03-15'
const ISO_DATETIME = '2024-03-15T12:30:00'
const DEFAULT_FORMAT = 'EEE do MMMM yyyy'
const CUSTOM_FORMAT = 'dd/MM/yyyy'
const YEAR_ONLY_FORMAT = 'yyyy'
const EXPECTED_YEAR = '2024'
const EXPECTED_CUSTOM = '15/03/2024'

describe('formatDate - Date object input', () => {
  it('should format a Date object with default format', () => {
    const date = new Date('2024-03-15T12:00:00Z')
    const result = formatDate(date)

    expect(result).toContain('2024')
    expect(result).toContain('March')
  })

  it('should format a Date object with custom format', () => {
    const date = new Date('2024-03-15T12:00:00Z')
    const result = formatDate(date, YEAR_ONLY_FORMAT)

    expect(result).toBe(EXPECTED_YEAR)
  })
})

describe('formatDate - ISO string input', () => {
  it('should format an ISO date string with default format', () => {
    const result = formatDate(ISO_DATE)

    expect(result).toContain('2024')
    expect(result).toContain('March')
  })

  it('should format an ISO date string with custom format', () => {
    const result = formatDate(ISO_DATE, CUSTOM_FORMAT)

    expect(result).toBe(EXPECTED_CUSTOM)
  })

  it('should format an ISO datetime string', () => {
    const result = formatDate(ISO_DATETIME, YEAR_ONLY_FORMAT)

    expect(result).toBe(EXPECTED_YEAR)
  })
})

describe('formatDate - custom format strings', () => {
  it('should apply the custom format string correctly', () => {
    const result = formatDate(ISO_DATE, DEFAULT_FORMAT)

    expect(result).toContain('March')
    expect(result).toContain('2024')
  })

  it('should return year only when year-only format is given', () => {
    const result = formatDate(ISO_DATE, YEAR_ONLY_FORMAT)

    expect(result).toBe(EXPECTED_YEAR)
  })
})
