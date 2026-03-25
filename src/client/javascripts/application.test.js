import { describe, it, expect, vi } from 'vitest'

const GOVUK_COMPONENT_COUNT = 7

// Mock govuk-frontend before the module is imported
const {
  mockCreateAll,
  mockAccordion,
  mockButton,
  mockCheckboxes,
  mockErrorSummary,
  mockHeader,
  mockRadios,
  mockSkipLink
} = vi.hoisted(() => ({
  mockCreateAll: vi.fn(),
  mockAccordion: class Accordion {
    static isMock = true
  },
  mockButton: class Button {
    static isMock = true
  },
  mockCheckboxes: class Checkboxes {
    static isMock = true
  },
  mockErrorSummary: class ErrorSummary {
    static isMock = true
  },
  mockHeader: class Header {
    static isMock = true
  },
  mockRadios: class Radios {
    static isMock = true
  },
  mockSkipLink: class SkipLink {
    static isMock = true
  }
}))

vi.mock('govuk-frontend', () => ({
  createAll: mockCreateAll,
  Accordion: mockAccordion,
  Button: mockButton,
  Checkboxes: mockCheckboxes,
  ErrorSummary: mockErrorSummary,
  Header: mockHeader,
  Radios: mockRadios,
  SkipLink: mockSkipLink
}))

describe('application.js - govuk-frontend initialisation', () => {
  it('should call createAll for each govuk-frontend component', async () => {
    await import('./application.js')

    expect(mockCreateAll).toHaveBeenCalledWith(mockAccordion)
    expect(mockCreateAll).toHaveBeenCalledWith(mockButton)
    expect(mockCreateAll).toHaveBeenCalledWith(mockCheckboxes)
    expect(mockCreateAll).toHaveBeenCalledWith(mockErrorSummary)
    expect(mockCreateAll).toHaveBeenCalledWith(mockHeader)
    expect(mockCreateAll).toHaveBeenCalledWith(mockRadios)
    expect(mockCreateAll).toHaveBeenCalledWith(mockSkipLink)
  })

  it('should call createAll exactly 7 times', async () => {
    vi.resetModules()
    mockCreateAll.mockClear()
    await import('./application.js')

    expect(mockCreateAll).toHaveBeenCalledTimes(GOVUK_COMPONENT_COUNT)
  })
})
