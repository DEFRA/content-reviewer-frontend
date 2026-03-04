import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLogConfig = {
  enabled: true,
  level: 'info',
  format: 'ecs',
  redact: []
}

const mockConfig = { get: vi.fn() }
vi.mock('../../../../config/config.js', () => ({
  config: mockConfig
}))

const mockTraceId = vi.fn()
vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: mockTraceId
}))

vi.mock('@elastic/ecs-pino-format', () => ({
  ecsFormat: vi.fn(() => ({ ecsKey: 'ecsValue' }))
}))

const CONFIG_VALUES = {
  log: mockLogConfig,
  serviceName: 'test-service',
  serviceVersion: '1.0.0'
}

mockConfig.get.mockImplementation((key) => CONFIG_VALUES[key] ?? null)

const { loggerOptions } = await import('./logger-options.js')

const HTTP_OK = 200
const HTTP_REDIRECT = 301
const HTTP_CLIENT_ERROR = 400
const HTTP_SERVER_ERROR = 500

describe('loggerOptions', () => {
  it('has the expected top-level properties', () => {
    expect(loggerOptions).toHaveProperty('enabled', true)
    expect(loggerOptions).toHaveProperty('level', 'info')
    expect(loggerOptions).toHaveProperty('nesting', true)
    expect(loggerOptions).toHaveProperty('ignorePaths')
    expect(loggerOptions.ignorePaths).toContain('/health')
    expect(loggerOptions).toHaveProperty('redact')
    expect(loggerOptions).toHaveProperty('customLogLevel')
    expect(loggerOptions).toHaveProperty('mixin')
  })
})

describe('loggerOptions.customLogLevel', () => {
  const { customLogLevel } = loggerOptions

  it('returns error when err is provided', () => {
    const result = customLogLevel(
      {},
      { statusCode: HTTP_OK },
      new Error('fail')
    )
    expect(result).toBe('error')
  })

  it('returns error when statusCode >= 500', () => {
    const result = customLogLevel({}, { statusCode: HTTP_SERVER_ERROR }, null)
    expect(result).toBe('error')
  })

  it('returns warn when statusCode >= 400 and < 500', () => {
    const result = customLogLevel({}, { statusCode: HTTP_CLIENT_ERROR }, null)
    expect(result).toBe('warn')
  })

  it('returns info when statusCode >= 300 and < 400', () => {
    const result = customLogLevel({}, { statusCode: HTTP_REDIRECT }, null)
    expect(result).toBe('info')
  })

  it('returns info when statusCode < 300', () => {
    const result = customLogLevel({}, { statusCode: HTTP_OK }, null)
    expect(result).toBe('info')
  })
})

describe('loggerOptions.mixin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes trace id when getTraceId returns a value', () => {
    mockTraceId.mockReturnValue('abc-123')
    const result = loggerOptions.mixin()
    expect(result).toEqual({ trace: { id: 'abc-123' } })
  })

  it('returns empty object when getTraceId returns null', () => {
    mockTraceId.mockReturnValue(null)
    const result = loggerOptions.mixin()
    expect(result).toEqual({})
  })
})
