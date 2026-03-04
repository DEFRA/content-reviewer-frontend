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

    vi.spyOn(console, 'log').mockImplementation(() => {})
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

    vi.spyOn(console, 'log').mockImplementation(() => {})
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

describe('startServer - configuration and environment variable logging', () => {
  let createServer
  let mockServer
  let consoleSpy

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

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('should output configuration debug block via console.log', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CONFIGURATION DEBUG - CRITICAL SETTINGS:')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CDP UPLOADER CONFIG:')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('SESSION CONFIG:')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('REDIS CONFIG (if applicable):')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('LOGGING CONFIG:')
    )
  })

  it('should output environment variables debug block via console.log', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ENVIRONMENT VARIABLES RELEVANT TO CDP:')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'NODE_ENV:',
      process.env.NODE_ENV || 'NOT SET'
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'ENVIRONMENT:',
      process.env.ENVIRONMENT || 'NOT SET'
    )
  })
})

describe('startServer - config values logging', () => {
  let createServer
  let mockServer
  let consoleSpy

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

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('should log all cdpUploader config values', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(consoleSpy).toHaveBeenCalledWith(
      '- Uploader URL:',
      'http://localhost:7337'
    )
    expect(consoleSpy).toHaveBeenCalledWith('- S3 Bucket:', 'my-bucket')
    expect(consoleSpy).toHaveBeenCalledWith('- S3 Path:', 'uploads/')
    const MAX_FILE_SIZE = 52428800 // 50 MB
    expect(consoleSpy).toHaveBeenCalledWith('- Max File Size:', MAX_FILE_SIZE)
    expect(consoleSpy).toHaveBeenCalledWith('- Allowed MIME Types:', [
      'application/pdf'
    ])
  })

  it('should log all session, redis, and logging config values', async () => {
    const { startServer } = await import('./start-server.js')
    await startServer()
    expect(consoleSpy).toHaveBeenCalledWith('- Cache Engine:', 'memory')
    expect(consoleSpy).toHaveBeenCalledWith('- Cookie Secure:', false)
    expect(consoleSpy).toHaveBeenCalledWith('- Host:', 'localhost')
    expect(consoleSpy).toHaveBeenCalledWith('- Use TLS:', false)
    expect(consoleSpy).toHaveBeenCalledWith('- Single Instance:', true)
    expect(consoleSpy).toHaveBeenCalledWith('- Log Level:', 'info')
    expect(consoleSpy).toHaveBeenCalledWith('- Log Format:', 'pino-pretty')
    expect(consoleSpy).toHaveBeenCalledWith('- Log Enabled:', true)
  })
})
