import { describe, it, expect, vi } from 'vitest'

vi.mock('@defra/hapi-tracing', () => ({
  tracing: {
    plugin: { name: 'hapi-tracing-plugin' }
  }
}))

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'tracing.header') return 'x-cdp-request-id'
      return null
    })
  }
}))

describe('requestTracing', () => {
  it('should export a plugin object with the tracing plugin', async () => {
    const { requestTracing } = await import('./request-tracing.js')
    expect(requestTracing).toBeDefined()
    expect(requestTracing.plugin).toEqual({ name: 'hapi-tracing-plugin' })
  })

  it('should set tracingHeader from config', async () => {
    const { requestTracing } = await import('./request-tracing.js')
    expect(requestTracing.options).toEqual({
      tracingHeader: 'x-cdp-request-id'
    })
  })
})
