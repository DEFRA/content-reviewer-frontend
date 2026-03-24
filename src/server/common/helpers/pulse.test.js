import { describe, it, expect, vi } from 'vitest'

const PULSE_TIMEOUT_MS = 10000

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}

vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

vi.mock('hapi-pulse', () => ({
  default: { name: 'hapi-pulse', register: vi.fn() }
}))

describe('pulse - module shape', () => {
  it('exports a pulse object with plugin and options', async () => {
    const { pulse } = await import('./pulse.js')
    expect(pulse).toHaveProperty('plugin')
    expect(pulse).toHaveProperty('options')
  })

  it('uses hapi-pulse as the plugin', async () => {
    const { pulse } = await import('./pulse.js')
    expect(pulse.plugin).toEqual(
      expect.objectContaining({ name: 'hapi-pulse' })
    )
  })
})

describe('pulse - options', () => {
  it('sets the timeout to 10 seconds', async () => {
    const { pulse } = await import('./pulse.js')
    expect(pulse.options.timeout).toBe(PULSE_TIMEOUT_MS)
  })

  it('provides a logger instance in options', async () => {
    const { pulse } = await import('./pulse.js')
    expect(pulse.options.logger).toBeDefined()
    expect(typeof pulse.options.logger).toBe('object')
  })
})
