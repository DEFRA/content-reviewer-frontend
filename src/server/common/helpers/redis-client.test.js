import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOn = vi.fn()
const mockRedisInstance = { on: mockOn }
const mockClusterInstance = { on: mockOn }

const MockRedis = vi.fn(function () {
  return mockRedisInstance
})
const MockCluster = vi.fn(function () {
  return mockClusterInstance
})

vi.mock('ioredis', () => ({
  Redis: MockRedis,
  Cluster: MockCluster
}))

const mockLogger = { info: vi.fn(), error: vi.fn() }
vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

const { buildRedisClient } = await import('./redis-client.js')

const REDIS_CLUSTER_HOST = 'redis-cluster'
const TEST_CREDENTIALS = { username: 'admin', secret: 'test-value-xyz' }

// Instance Creation tests
describe('buildRedisClient - Single Instance - Instance Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOn.mockReturnValue(mockRedisInstance)
  })

  it('creates a single Redis instance when useSingleInstanceCache is true', () => {
    const config = {
      host: 'localhost',
      keyPrefix: 'test:',
      username: '',
      password: '',
      useTLS: false,
      useSingleInstanceCache: true
    }
    const client = buildRedisClient(config)
    expect(MockRedis).toHaveBeenCalledWith({
      port: 6379,
      host: 'localhost',
      db: 0,
      keyPrefix: 'test:'
    })
    expect(client).toBe(mockRedisInstance)
  })
})

// Credentials tests
describe('buildRedisClient - Single Instance - Credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOn.mockReturnValue(mockRedisInstance)
  })

  it('includes credentials when username is not empty', () => {
    const config = {
      host: 'localhost',
      keyPrefix: 'test:',
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.secret,
      useTLS: false,
      useSingleInstanceCache: true
    }
    buildRedisClient(config)
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        username: TEST_CREDENTIALS.username,
        password: TEST_CREDENTIALS.secret
      })
    )
  })

  it('omits credentials when username is empty string', () => {
    const config = {
      host: 'localhost',
      keyPrefix: 'test:',
      username: '',
      password: '',
      useTLS: false,
      useSingleInstanceCache: true
    }
    buildRedisClient(config)
    const callArgs = MockRedis.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('username')
    expect(callArgs).not.toHaveProperty('password')
  })
})

// TLS Options tests
describe('buildRedisClient - Single Instance - TLS Options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOn.mockReturnValue(mockRedisInstance)
  })

  it('includes tls option when useTLS is true', () => {
    const config = {
      host: 'localhost',
      keyPrefix: 'test:',
      username: '',
      password: '',
      useTLS: true,
      useSingleInstanceCache: true
    }
    buildRedisClient(config)
    expect(MockRedis).toHaveBeenCalledWith(expect.objectContaining({ tls: {} }))
  })

  it('omits tls option when useTLS is false', () => {
    const config = {
      host: 'localhost',
      keyPrefix: 'test:',
      username: '',
      password: '',
      useTLS: false,
      useSingleInstanceCache: true
    }
    buildRedisClient(config)
    const callArgs = MockRedis.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('tls')
  })
})

// Logging tests
describe('buildRedisClient - Single Instance - Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOn.mockReturnValue(mockRedisInstance)
  })

  it('logs info on connect event', () => {
    const config = {
      host: 'localhost',
      keyPrefix: 'test:',
      username: '',
      password: '',
      useTLS: false,
      useSingleInstanceCache: true
    }
    buildRedisClient(config)
    const connectHandler = mockOn.mock.calls.find((c) => c[0] === 'connect')[1]
    connectHandler()
    expect(mockLogger.info).toHaveBeenCalledWith('Connected to Redis server', {
      host: 'localhost',
      port: 6379
    })
  })

  it('logs error on error event', () => {
    const config = {
      host: 'localhost',
      keyPrefix: 'test:',
      username: '',
      password: '',
      useTLS: false,
      useSingleInstanceCache: true
    }
    buildRedisClient(config)
    const errorHandler = mockOn.mock.calls.find((c) => c[0] === 'error')[1]
    errorHandler(new Error('Connection refused'))
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Redis connection error Error: Connection refused'
    )
  })
})

describe('buildRedisClient - Cluster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOn.mockReturnValue(mockClusterInstance)
  })

  it('creates a Redis Cluster instance when useSingleInstanceCache is false', () => {
    const config = {
      host: REDIS_CLUSTER_HOST,
      keyPrefix: 'cluster:',
      username: '',
      password: '',
      useTLS: false,
      useSingleInstanceCache: false
    }
    const client = buildRedisClient(config)
    expect(MockCluster).toHaveBeenCalledWith(
      [{ host: REDIS_CLUSTER_HOST, port: 6379 }],
      expect.objectContaining({
        keyPrefix: 'cluster:',
        slotsRefreshTimeout: 10000
      })
    )
    expect(client).toBe(mockClusterInstance)
  })

  it('includes credentials in cluster options when username is not empty', () => {
    const config = {
      host: REDIS_CLUSTER_HOST,
      keyPrefix: 'cluster:',
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.secret,
      useTLS: false,
      useSingleInstanceCache: false
    }
    buildRedisClient(config)
    const clusterOptions = MockCluster.mock.calls[0][1]
    expect(clusterOptions.redisOptions).toMatchObject({
      username: TEST_CREDENTIALS.username,
      password: TEST_CREDENTIALS.secret
    })
  })

  it('includes tls option in cluster options when useTLS is true', () => {
    const config = {
      host: REDIS_CLUSTER_HOST,
      keyPrefix: 'cluster:',
      username: '',
      password: '',
      useTLS: true,
      useSingleInstanceCache: false
    }
    buildRedisClient(config)
    const clusterOptions = MockCluster.mock.calls[0][1]
    expect(clusterOptions.redisOptions).toMatchObject({ tls: {} })
  })
})
