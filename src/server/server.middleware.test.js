import { describe, it, expect, beforeEach, vi } from 'vitest'

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

const TEST_HOST = '0.0.0.0'
const TEST_PORT = 3000
const TEST_ROOT_PATH = '/test/root'
const SESSION_CACHE_NAME = 'session-cache'
const SESSION_CACHE_ENGINE = 'memory'
const SESSION_PASSWORD = 'test-password-minimum-32-characters'
const SESSION_TTL = 3600000
const HTTP_UNAUTHORISED = 401
const HTTP_NOT_FOUND = 404
const HTTP_TOO_MANY_REQUESTS = 429
const RATE_LIMIT_WINDOW_MS = 60000
const RATE_LIMIT_MAX_REQUESTS = 5

const createMockConfig = (isProduction = false) => ({
  get: vi.fn((key) => {
    const map = {
      host: TEST_HOST,
      port: TEST_PORT,
      root: TEST_ROOT_PATH,
      isProduction,
      session: {
        cookie: { password: SESSION_PASSWORD, ttl: SESSION_TTL },
        cache: { name: SESSION_CACHE_NAME, engine: SESSION_CACHE_ENGINE }
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
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
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

// ── Auth redirect ─────────────────────────────────────────────────────────────

async function getAuthRedirectHandler() {
  const { mockServer } = await setupMocks()
  const { createServer } = await import('./server.js')
  await createServer()
  // onPreResponse ext calls: [0] authRedirect, [1] catchAll, [2] headers, [3] userContext
  const firstPreResponseCall = mockServer.ext.mock.calls.find(
    ([event]) => event === 'onPreResponse'
  )
  return firstPreResponseCall[1]
}

describe('createServer - auth redirect - pass-through', () => {
  it('should continue for non-401 Boom responses', async () => {
    const handler = await getAuthRedirectHandler()
    const h = { continue: Symbol('continue') }
    const response = { isBoom: true, output: { statusCode: HTTP_NOT_FOUND } }
    const result = handler({ response, path: '/' }, h)
    expect(result).toBe(h.continue)
  })

  it('should continue for non-Boom responses', async () => {
    const handler = await getAuthRedirectHandler()
    const h = { continue: Symbol('continue') }
    const result = handler({ response: { isBoom: false }, path: '/' }, h)
    expect(result).toBe(h.continue)
  })
})

describe('createServer - auth redirect - API requests', () => {
  it('should return JSON 401 for API requests', async () => {
    const handler = await getAuthRedirectHandler()
    const responseMock = {
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
    }
    const h = {
      continue: Symbol('continue'),
      response: vi.fn().mockReturnValue(responseMock)
    }
    const response = { isBoom: true, output: { statusCode: HTTP_UNAUTHORISED } }
    handler(
      {
        response,
        path: '/api/reviews',
        url: { pathname: '/api/reviews', search: '' }
      },
      h
    )
    expect(h.response).toHaveBeenCalledWith({ error: 'Unauthorised' })
    expect(responseMock.code).toHaveBeenCalledWith(HTTP_UNAUTHORISED)
  })
})

describe('createServer - auth redirect - page requests', () => {
  it('should redirect page requests to /auth/login', async () => {
    const handler = await getAuthRedirectHandler()
    const redirectMock = { takeover: vi.fn().mockReturnThis() }
    const h = {
      continue: Symbol('continue'),
      redirect: vi.fn().mockReturnValue(redirectMock)
    }
    const yar = { set: vi.fn() }
    const response = { isBoom: true, output: { statusCode: HTTP_UNAUTHORISED } }
    handler(
      {
        response,
        path: '/review/results/123',
        url: { pathname: '/review/results/123', search: '' },
        yar
      },
      h
    )
    expect(h.redirect).toHaveBeenCalledWith('/auth/login')
  })

  it('should save return URL in session for page requests', async () => {
    const handler = await getAuthRedirectHandler()
    const redirectMock = { takeover: vi.fn().mockReturnThis() }
    const h = {
      continue: Symbol('continue'),
      redirect: vi.fn().mockReturnValue(redirectMock)
    }
    const yar = { set: vi.fn() }
    const response = { isBoom: true, output: { statusCode: HTTP_UNAUTHORISED } }
    handler({ response, path: '/', url: { pathname: '/', search: '' }, yar }, h)
    expect(yar.set).toHaveBeenCalledWith('returnTo', '/')
  })
})

// ── Rate limiting ─────────────────────────────────────────────────────────────

async function setupWithRateLimit(maxRequests = RATE_LIMIT_MAX_REQUESTS) {
  vi.resetModules()
  vi.clearAllMocks()
  const mockServer = createMockServer()

  const hapiModule = await import('@hapi/hapi')
  hapiModule.default.server.mockReturnValue(mockServer)

  const configModule = await import('../config/config.js')
  configModule.config.get = vi.fn((key) => {
    const map = {
      host: TEST_HOST,
      port: TEST_PORT,
      root: TEST_ROOT_PATH,
      isProduction: false,
      session: {
        cookie: { password: SESSION_PASSWORD, ttl: SESSION_TTL },
        cache: { name: SESSION_CACHE_NAME, engine: SESSION_CACHE_ENGINE }
      },
      'session.cache.name': SESSION_CACHE_NAME,
      'session.cache.engine': SESSION_CACHE_ENGINE,
      'session.cookie.password': SESSION_PASSWORD,
      'session.cookie.ttl': SESSION_TTL,
      'rateLimit.enabled': true,
      'rateLimit.windowMs': RATE_LIMIT_WINDOW_MS,
      'rateLimit.maxRequests': maxRequests
    }
    return map[key]
  })

  const cacheEngineModule =
    await import('./common/helpers/session-cache/cache-engine.js')
  cacheEngineModule.getCacheEngine.mockReturnValue({
    start: vi.fn(),
    stop: vi.fn()
  })

  const { createServer } = await import('./server.js')
  await createServer()

  const rateLimitHandler = mockServer.ext.mock.calls.find(
    ([event]) => event === 'onRequest'
  )?.[1]

  return { mockServer, rateLimitHandler }
}

describe('createServer - rate limiting', () => {
  it('should skip rate limiting for /health path', async () => {
    const { rateLimitHandler } = await setupWithRateLimit()
    const h = { continue: Symbol('continue') }
    const result = rateLimitHandler(
      { path: '/health', info: { remoteAddress: '127.0.0.1' } },
      h
    )
    expect(result).toBe(h.continue)
  })

  it('should allow requests under the limit', async () => {
    const { rateLimitHandler } = await setupWithRateLimit(10)
    const h = { continue: Symbol('continue') }
    const result = rateLimitHandler(
      { path: '/api/test', info: { remoteAddress: '10.0.0.1' } },
      h
    )
    expect(result).toBe(h.continue)
  })

  it('should return 429 and warn when limit is exceeded', async () => {
    const { rateLimitHandler, mockServer } = await setupWithRateLimit(1)
    const responseMock = {
      type: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
    }
    const h = {
      continue: Symbol('continue'),
      response: vi.fn().mockReturnValue(responseMock)
    }
    const request = { path: '/api/test', info: { remoteAddress: '10.0.0.2' } }

    rateLimitHandler(request, h) // first request — at limit
    rateLimitHandler(request, h) // second request — exceeds limit

    expect(h.response).toHaveBeenCalled()
    expect(responseMock.code).toHaveBeenCalledWith(HTTP_TOO_MANY_REQUESTS)
    expect(responseMock.takeover).toHaveBeenCalled()
    expect(mockServer.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '10.0.0.2' }),
      'Rate limit exceeded'
    )
  })

  it('should reset counter after the window expires', async () => {
    const { rateLimitHandler } = await setupWithRateLimit(1)
    const responseMock = {
      type: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
    }
    const hOver = {
      continue: Symbol('continue'),
      response: vi.fn().mockReturnValue(responseMock)
    }
    const h = { continue: Symbol('continue') }
    const request = { path: '/api/test', info: { remoteAddress: '10.0.0.3' } }

    rateLimitHandler(request, h)
    rateLimitHandler(request, hOver)
    expect(responseMock.code).toHaveBeenCalledWith(HTTP_TOO_MANY_REQUESTS)

    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + RATE_LIMIT_WINDOW_MS + 1000)

    const result = rateLimitHandler(request, h)
    expect(result).toBe(h.continue)

    nowSpy.mockRestore()
  })

  it('should not register onRequest handler when rate limiting is disabled', async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    const hasRateLimitExt = mockServer.ext.mock.calls.some(
      ([event]) => event === 'onRequest'
    )
    expect(hasRateLimitExt).toBe(false)
  })
})

// ── Security headers ──────────────────────────────────────────────────────────

describe('createServer - security headers', () => {
  let headersHandler

  beforeEach(async () => {
    const { mockServer } = await setupMocks()
    const { createServer } = await import('./server.js')
    await createServer()
    // onPreResponse ext calls: [0] authRedirect, [1] catchAll, [2] headers, [3] userContext
    const preResponseCalls = mockServer.ext.mock.calls.filter(
      ([event]) => event === 'onPreResponse'
    )
    headersHandler = preResponseCalls[2][1]
  })

  it('should add Referrer-Policy header to normal responses', () => {
    const header = vi.fn()
    const h = { continue: Symbol('continue') }
    headersHandler({ response: { isBoom: false, header } }, h)
    expect(header).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer')
  })

  it('should add Permissions-Policy header to normal responses', () => {
    const header = vi.fn()
    const h = { continue: Symbol('continue') }
    headersHandler({ response: { isBoom: false, header } }, h)
    expect(header).toHaveBeenCalledWith(
      'Permissions-Policy',
      'geolocation=(), camera=(), microphone=()'
    )
  })

  it('should add headers to Boom error responses', () => {
    const response = { isBoom: true, output: { headers: {} } }
    const h = { continue: Symbol('continue') }
    headersHandler({ response }, h)
    expect(response.output.headers['Referrer-Policy']).toBe('no-referrer')
    expect(response.output.headers['Permissions-Policy']).toBe(
      'geolocation=(), camera=(), microphone=()'
    )
  })

  it('should return h.continue for normal responses', () => {
    const h = { continue: Symbol('continue') }
    const result = headersHandler(
      { response: { isBoom: false, header: vi.fn() } },
      h
    )
    expect(result).toBe(h.continue)
  })

  it('should return h.continue for Boom responses', () => {
    const h = { continue: Symbol('continue') }
    const result = headersHandler(
      { response: { isBoom: true, output: { headers: {} } } },
      h
    )
    expect(result).toBe(h.continue)
  })
})
