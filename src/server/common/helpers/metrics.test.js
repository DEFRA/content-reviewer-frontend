import { describe, it, expect, vi, beforeEach } from 'vitest'

const METRIC_NAME = 'test-metric'
const DEFAULT_VALUE = 1
const CUSTOM_VALUE = 5

const mockFlush = vi.fn()
const mockPutMetric = vi.fn()
const mockMetricsLogger = { putMetric: mockPutMetric, flush: mockFlush }

vi.mock('aws-embedded-metrics', () => ({
  createMetricsLogger: vi.fn(() => mockMetricsLogger),
  Unit: { Count: 'Count' },
  StorageResolution: { Standard: 60 }
}))

const mockLogger = { error: vi.fn() }
vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

const mockConfig = { get: vi.fn() }
vi.mock('../../../config/config.js', () => ({
  config: mockConfig
}))

const { metricsCounter } = await import('./metrics.js')

describe('metricsCounter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when metrics are disabled', async () => {
    mockConfig.get.mockReturnValue(false)
    await metricsCounter(METRIC_NAME)
    expect(mockPutMetric).not.toHaveBeenCalled()
    expect(mockFlush).not.toHaveBeenCalled()
  })

  it('records a metric with the default value of 1 when metrics are enabled', async () => {
    mockConfig.get.mockReturnValue(true)
    await metricsCounter(METRIC_NAME)
    expect(mockPutMetric).toHaveBeenCalledWith(
      METRIC_NAME,
      DEFAULT_VALUE,
      'Count',
      60
    )
    expect(mockFlush).toHaveBeenCalled()
  })

  it('records a metric with a custom value when provided', async () => {
    mockConfig.get.mockReturnValue(true)
    await metricsCounter(METRIC_NAME, CUSTOM_VALUE)
    expect(mockPutMetric).toHaveBeenCalledWith(
      METRIC_NAME,
      CUSTOM_VALUE,
      'Count',
      60
    )
  })

  it('logs the error when putMetric throws', async () => {
    mockConfig.get.mockReturnValue(true)
    const mockError = new Error('metrics failure')
    mockPutMetric.mockImplementation(() => {
      throw mockError
    })
    await metricsCounter(METRIC_NAME)
    expect(mockLogger.error).toHaveBeenCalledWith(mockError, mockError.message)
  })
})
