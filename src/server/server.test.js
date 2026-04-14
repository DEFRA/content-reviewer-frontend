import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock all dependencies
vi.mock('@hapi/hapi', () => ({ default: { server: vi.fn() } }))
vi.mock('./router.js', () => ({
  router: { plugin: { name: 'router', register: vi.fn() } }
}))
vi.mock('../config/config.js', () => ({ config: { get: vi.fn() } }))
vi.mock('./common/helpers/pulse.js', () => ({
  pulse: { plugin: { name: 'pulse', register: vi.fn() } }
}))
vi.mock('./common/helpers/errors.js', () => ({ catchAll: vi.fn() }))
vi.mock('../config/nunjucks/nunjucks.js', () => ({
  nunjucksConfig: { plugin: { name: 'nunjucks', register: vi.fn() } }
}))
vi.mock('./common/helpers/proxy/setup-proxy.js', () => ({
  setupProxy: vi.fn()
}))
vi.mock('./common/helpers/request-tracing.js', () => ({
  requestTracing: { plugin: { name: 'request-tracing', register: vi.fn() } }
}))
vi.mock('./common/helpers/logging/request-logger.js', () => ({
  requestLogger: { plugin: { name: 'request-logger', register: vi.fn() } }
}))
vi.mock('./common/helpers/session-cache/session-cache.js', () => ({
  sessionCache: { plugin: { name: 'session-cache', register: vi.fn() } }
}))
vi.mock('./common/helpers/session-cache/cache-engine.js', () => ({
  getCacheEngine: vi.fn()
}))
vi.mock('@defra/hapi-secure-context', () => ({
  secureContext: { plugin: { name: 'secure-context', register: vi.fn() } }
}))
vi.mock('./common/helpers/content-security-policy.js', () => ({
  contentSecurityPolicy: { plugin: { name: 'csp', register: vi.fn() } }
}))
vi.mock('./plugins/azure-auth.js', () => ({
  azureAuth: { plugin: { name: 'azure-auth', register: vi.fn() } }
}))
vi.mock('@hapi/cookie', () => ({
  default: { plugin: { name: 'cookie', register: vi.fn() } }
}))
vi.mock('@hapi/scooter', () => ({
  default: { plugin: { name: 'scooter', register: vi.fn() } }
}))

// Test constants
const TEST_HOST = '0.0.0.0'
const TEST_PORT = 3000
const TEST_ROOT_PATH = '/test/root'
const SESSION_CACHE_NAME = 'session-cache'
const SESSION_CACHE_ENGINE = 'memory'
const SESSION_PASSWORD = 'test-password-minimum-32-characters'
const SESSION_TTL = 36000000
const COOKIE_NAME = 'content-reviewer-session'
const COMPRESSION_MIN_BYTES = 512
const HSTS_MAX_AGE = 31536000

const createMockConfig = (isProduction = false) => ({
  get: vi.fn((key) => {
    const map = {
      host: TEST_HOST,
      port: TEST_PORT,
      root: TEST_ROOT_PATH,
      isProduction,
      session: {
        cookie: {
          password: SESSION_PASSWORD,
          ttl: SESSION_TTL
        },
        cache: {
          name: SESSION_CACHE_NAME,
          engine: SESSION_CACHE_ENGINE
        }
      },
      'session.cache.name': SESSION_CACHE_NAME,
      'session.cache.engine': SESSION_CACHE_ENGINE,
      'session.cookie.password': SESSION_PASSWORD,
      'session.cookie.ttl': SESSION_TTL
    }
    return map[key]
  })
})

const createMockServer = () => ({
  register: vi.fn().mockResolvedValue(undefined),
  auth: { strategy: vi.fn(), default: vi.fn() },
  ext: vi.fn(),
  app: {}
})

async function setupMocks(isProduction = false) {
  vi.resetModules()
  vi.clearAllMocks()
  const mockServer = createMockServer()
  const mockConfig = createMockConfig(isProduction)

  const hapiModule = await import('@hapi/hapi')
  hapiModule.default.server.mockReturnValue(mockServer)

  const configModule = await import('../config/config.js')
  configModule.config.get = mockConfig.get

  const cacheEngineModule =
    await import('./common/helpers/session-cache/cache-engine.js')
  cacheEngineModule.getCacheEngine.mockReturnValue({
    start: vi.fn(),
    stop: vi.fn()
  })

  return { mockServer, mockConfig, hapiModule, cacheEngineModule }
}

const TEST_TIMEOUT = 30000

describe('createServer - initialization', () => {
  it(
    'should call setupProxy',
    async () => {
      await setupMocks()
      const proxyModule = await import('./common/helpers/proxy/setup-proxy.js')
      const { createServer } = await import('./server.js')
      await createServer()
      expect(proxyModule.setupProxy).toHaveBeenCalled()
    },
    TEST_TIMEOUT
  )

  it('should create server with host and port', async () => {
    const { hapiModule } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    expect(hapiModule.default.server).toHaveBeenCalledWith(
      expect.objectContaining({ host: TEST_HOST, port: TEST_PORT })
    )
  })

  it('should configure compression', async () => {
    const { hapiModule } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    expect(hapiModule.default.server).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: { minBytes: COMPRESSION_MIN_BYTES }
      })
    )
  })

  it('should set config on server app', async () => {
    await setupMocks()
    const { createServer } = await import('./server.js')
    const server = await createServer()
    expect(server.app.config).toBeDefined()
  })
})

describe('createServer - security', () => {
  it('should configure HSTS', async () => {
    const { hapiModule } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const call = hapiModule.default.server.mock.calls[0][0]
    expect(call.routes.security.hsts).toEqual({
      maxAge: HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: false
    })
  })

  it('should enable XSS protection', async () => {
    const { hapiModule } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const call = hapiModule.default.server.mock.calls[0][0]
    expect(call.routes.security.xss).toBe('enabled')
  })

  it('should enable noSniff', async () => {
    const { hapiModule } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const call = hapiModule.default.server.mock.calls[0][0]
    expect(call.routes.security.noSniff).toBe(true)
  })
})

describe('createServer - plugins', () => {
  it('should register cookie plugin', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const hapiCookie = await import('@hapi/cookie')
    expect(mockServer.register).toHaveBeenCalledWith(hapiCookie.default)
  })

  it('should register router plugin', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const lastCall = mockServer.register.mock.calls.at(-1)
    expect(lastCall[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plugin: expect.objectContaining({ name: 'router' })
        })
      ])
    )
  })
})

describe('createServer - cookie configuration', () => {
  it('should configure session strategy', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    expect(mockServer.auth.strategy).toHaveBeenCalledWith(
      'session',
      'cookie',
      expect.any(Object)
    )
  })

  it('should set cookie name', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.cookie.name).toBe(COOKIE_NAME)
  })

  it('should set cookie password', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.cookie.password).toBe(SESSION_PASSWORD)
  })

  it('should set cookie TTL', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.cookie.ttl).toBe(SESSION_TTL)
  })

  it('should set cookie as insecure in dev', async () => {
    const { mockServer } = await setupMocks(false)
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.cookie.isSecure).toBe(false)
  })

  it('should set cookie as secure in prod', async () => {
    const { mockServer } = await setupMocks(true)
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.cookie.isSecure).toBe(true)
  })
})

describe('createServer - cookie security', () => {
  it('should set SameSite Lax', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.cookie.isSameSite).toBe('Lax')
  })

  it('should set HttpOnly', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.cookie.isHttpOnly).toBe(true)
  })

  it('should enable keepAlive', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const config = mockServer.auth.strategy.mock.calls[0][2]
    expect(config.keepAlive).toBe(true)
  })

  it('should set default auth to optional session', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    expect(mockServer.auth.default).toHaveBeenCalledWith({
      strategy: 'session',
      mode: 'optional'
    })
  })
})

describe('createServer - session validation', () => {
  let validateFn

  beforeEach(async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    validateFn = mockServer.auth.strategy.mock.calls[0][2].validate
  })

  it('should reject null session', async () => {
    const result = await validateFn({}, null)
    expect(result.isValid).toBe(false)
  })

  it('should reject unauthenticated session', async () => {
    const result = await validateFn({}, { isAuthenticated: false })
    expect(result.isValid).toBe(false)
  })

  it('should reject session without user', async () => {
    const result = await validateFn({}, { isAuthenticated: true })
    expect(result.isValid).toBe(false)
  })

  it('should accept authenticated session with user', async () => {
    const session = { isAuthenticated: true, user: { id: '123' } }
    const result = await validateFn({}, session)
    expect(result.isValid).toBe(true)
    expect(result.credentials).toEqual(session)
  })
})

describe('createServer - user context', () => {
  let handler

  beforeEach(async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    handler = mockServer.ext.mock.calls.at(-1)[1]
  })

  it('should skip non-view responses', () => {
    const h = { continue: Symbol('continue') }
    const result = handler({ response: { variety: 'json' }, auth: null }, h)
    expect(result).toBe(h.continue)
  })

  it('should inject null user for unauth', () => {
    const response = { variety: 'view', source: { context: {} } }
    const h = { continue: Symbol('continue') }
    handler({ response, auth: null }, h)
    expect(response.source.context.user).toBeNull()
  })

  it('should inject user for auth', () => {
    const user = { id: '123' }
    const response = { variety: 'view', source: { context: {} } }
    const h = { continue: Symbol('continue') }
    handler({ response, auth: { credentials: { user } } }, h)
    expect(response.source.context.user).toEqual(user)
  })

  it('should create context if missing', () => {
    const user = { id: '456' }
    const response = { variety: 'view', source: {} }
    const h = { continue: Symbol('continue') }
    handler({ response, auth: { credentials: { user } } }, h)
    expect(response.source.context.user).toEqual(user)
  })
})

describe('createServer - error handling', () => {
  it('should register catchAll handler', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const errorsModule = await import('./common/helpers/errors.js')
    const calls = mockServer.ext.mock.calls.filter(
      (c) => c[1] === errorsModule.catchAll
    )
    expect(calls.length).toBeGreaterThan(0)
  })

  it('should return server instance', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    const server = await createServer()
    expect(server).toBe(mockServer)
  })
})
