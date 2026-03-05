import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCatboxRedisInstance = {}
const mockCatboxMemoryInstance = {}

const MockCatboxRedis = vi.fn(function () {
  return mockCatboxRedisInstance
})
const MockCatboxMemory = vi.fn(function () {
  return mockCatboxMemoryInstance
})

vi.mock('@hapi/catbox-redis', () => ({ Engine: MockCatboxRedis }))
vi.mock('@hapi/catbox-memory', () => ({ Engine: MockCatboxMemory }))

const mockLogger = { info: vi.fn(), error: vi.fn() }
vi.mock('../logging/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

const mockRedisClient = {}
vi.mock('../redis-client.js', () => ({
  buildRedisClient: vi.fn(() => mockRedisClient)
}))

const mockConfig = { get: vi.fn() }
vi.mock('../../../../config/config.js', () => ({
  config: mockConfig
}))

const { getCacheEngine } = await import('./cache-engine.js')
const { buildRedisClient } = await import('../redis-client.js')

const REDIS_ENGINE = 'redis'
const MEMORY_ENGINE = 'memory'
const REDIS_CONFIG_KEY = 'redis'
const IS_PRODUCTION_KEY = 'isProduction'

function makeRedisConfigMock() {
  return (key) => {
    if (key === REDIS_CONFIG_KEY) {
      return {}
    }
    return undefined
  }
}

function makeMemoryConfigMock(isProduction) {
  return (key) => {
    if (key === IS_PRODUCTION_KEY) {
      return isProduction
    }
    return undefined
  }
}

describe('getCacheEngine - redis engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a CatboxRedis engine with the built redis client', () => {
    const redisSettings = { host: 'redis-host', keyPrefix: 'test:' }
    mockConfig.get.mockImplementation((key) => {
      if (key === REDIS_CONFIG_KEY) {
        return redisSettings
      }
      return undefined
    })

    const result = getCacheEngine(REDIS_ENGINE)

    expect(buildRedisClient).toHaveBeenCalledWith(redisSettings)
    expect(MockCatboxRedis).toHaveBeenCalledWith({ client: mockRedisClient })
    expect(result).toBe(mockCatboxRedisInstance)
  })

  it('logs info when using redis engine', () => {
    mockConfig.get.mockImplementation(makeRedisConfigMock())

    getCacheEngine(REDIS_ENGINE)

    expect(mockLogger.info).toHaveBeenCalledWith('Using Redis session cache', {
      engine: REDIS_ENGINE
    })
  })

  it('falls back to CatboxMemory when buildRedisClient throws', () => {
    const mockError = new Error('Redis connection refused')
    buildRedisClient.mockImplementationOnce(() => {
      throw mockError
    })

    const result = getCacheEngine(REDIS_ENGINE)

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to connect to Redis, falling back to memory cache:',
      mockError.message
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Using Catbox Memory session cache (fallback)',
      { reason: 'Redis connection failed' }
    )
    expect(result).toBe(mockCatboxMemoryInstance)
  })
})

describe('getCacheEngine - memory engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a CatboxMemory engine', () => {
    mockConfig.get.mockImplementation(makeMemoryConfigMock(false))

    const result = getCacheEngine(MEMORY_ENGINE)

    expect(MockCatboxMemory).toHaveBeenCalled()
    expect(result).toBe(mockCatboxMemoryInstance)
  })

  it('logs info when using memory engine', () => {
    mockConfig.get.mockImplementation(makeMemoryConfigMock(false))

    getCacheEngine(MEMORY_ENGINE)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Using Catbox Memory session cache',
      { engine: MEMORY_ENGINE }
    )
  })

  it('logs an error when memory engine is used in production', () => {
    mockConfig.get.mockImplementation(makeMemoryConfigMock(true))

    getCacheEngine(MEMORY_ENGINE)

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Catbox Memory is for local development only, it should not be used in production!'
    )
  })

  it('does not log an error when memory engine is used outside production', () => {
    mockConfig.get.mockImplementation(makeMemoryConfigMock(false))

    getCacheEngine(MEMORY_ENGINE)

    expect(mockLogger.error).not.toHaveBeenCalled()
  })
})
