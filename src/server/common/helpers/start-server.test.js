import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('../../server.js', () => ({
  createServer: vi.fn()
}))

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configValues = {
        port: 3000,
        backendUrl: 'http://localhost:3001',
        'cdpUploader.url': 'http://localhost:7337',
        'cdpUploader.s3Bucket': 'my-bucket',
        'cdpUploader.s3Path': 'uploads/',
        'cdpUploader.maxFileSize': 52428800,
        'cdpUploader.allowedMimeTypes': ['application/pdf'],
        'session.cache.engine': 'memory',
        'session.cookie.secure': false,
        'redis.host': 'localhost',
        'redis.useTLS': false,
        'redis.useSingleInstanceCache': true,
        'log.level': 'info',
        'log.format': 'pino-pretty',
        'log.enabled': true
      }
      return configValues[key]
    })
  }
}))

const SERVER_STARTED_MSG = 'Server started successfully'

describe('startServer - server creation and startup', () => {
  let createServer
  let mockServer

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      logger: {
        info: vi.fn()
      }
    }

    const serverModule = await import('../../server.js')
    createServer = serverModule.createServer
    createServer.mockResolvedValue(mockServer)
  })

  it('should call createServer', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(createServer).toHaveBeenCalledTimes(1)
  })

  it('should call server.start()', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(mockServer.start).toHaveBeenCalledTimes(1)
  })

  it('should return the server instance', async () => {
    const { startServer } = await import('./start-server.js')
    const result = await startServer()
    expect(result).toBe(mockServer)
  })
})

describe('startServer - logging and environment', () => {
  let createServer
  let mockServer

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      logger: {
        info: vi.fn()
      }
    }

    const serverModule = await import('../../server.js')
    createServer = serverModule.createServer
    createServer.mockResolvedValue(mockServer)
  })

  it('should log server started info with port and environment', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      SERVER_STARTED_MSG,
      expect.objectContaining({ port: 3000 })
    )
  })

  it('should log the localhost access URL', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000'),
      expect.objectContaining({ port: 3000 })
    )
  })

  it('should log "local" as environment when ENVIRONMENT env var is not set', async () => {
    const { startServer } = await import('./start-server.js')
    delete process.env.ENVIRONMENT
    await startServer()
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      SERVER_STARTED_MSG,
      expect.objectContaining({ environment: 'local' })
    )
  })

  it('should log the ENVIRONMENT value when ENVIRONMENT env var is set', async () => {
    const { startServer } = await import('./start-server.js')
    process.env.ENVIRONMENT = 'production'
    await startServer()
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      SERVER_STARTED_MSG,
      expect.objectContaining({ environment: 'production' })
    )
    delete process.env.ENVIRONMENT
  })
})

describe('startServer - configuration logging', () => {
  let createServer
  let mockServer

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      logger: {
        info: vi.fn()
      }
    }

    const serverModule = await import('../../server.js')
    createServer = serverModule.createServer
    createServer.mockResolvedValue(mockServer)
  })

  it('should log server configuration via server.logger.info', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3000,
        backendUrl: 'http://localhost:3001',
        cdpUploaderUrl: 'http://localhost:7337',
        s3Bucket: 'my-bucket',
        sessionCacheEngine: 'memory',
        redisHost: 'localhost'
      }),
      'Server configuration'
    )
  })

  it('should log nodeEnv as undefined when NODE_ENV is not set', async () => {
    const origNodeEnv = process.env.NODE_ENV
    delete process.env.NODE_ENV
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ nodeEnv: undefined }),
      'Server configuration'
    )
    process.env.NODE_ENV = origNodeEnv
  })
})
