import { describe, it, expect, vi } from 'vitest'

vi.mock('hapi-pino', () => ({ default: { name: 'hapi-pino' } }))
vi.mock('./logger-options.js', () => ({
  loggerOptions: { enabled: true, level: 'info' }
}))

describe('requestLogger', () => {
  it('should export a plugin object with hapi-pino as the plugin', async () => {
    const { requestLogger } = await import('./request-logger.js')
    expect(requestLogger).toBeDefined()
    expect(requestLogger.plugin).toEqual({ name: 'hapi-pino' })
  })

  it('should include options from loggerOptions', async () => {
    const { requestLogger } = await import('./request-logger.js')
    expect(requestLogger.options).toEqual({ enabled: true, level: 'info' })
  })
})
