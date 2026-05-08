/**
 * server.silent-token-refresh.test.js
 *
 * Covers all branches of the setupSilentTokenRefresh onPreHandler extension
 * registered by createServer(). These are the 15 uncovered lines and 10
 * uncovered conditions reported by SonarQube for server.js.
 *
 * The handler fires on every request for authenticated users and silently
 * refreshes the backend JWT when it is within 5 minutes of expiry.
 *
 * Guard conditions tested:
 *  1. request.auth.isAuthenticated is false  → h.continue immediately
 *  2. request.auth is absent (null/undefined) → h.continue immediately
 *  3. No auth tokens in session (yar returns null) → h.continue
 *  4. authTokens.refreshToken is absent      → h.continue
 *  5. authTokens.expiresAt is absent         → h.continue
 *  6. Token is more than 5 min from expiry   → h.continue, fetch NOT called
 *
 * Refresh flow conditions tested:
 *  7. Token near expiry + response.ok        → session updated, logger called
 *  8. Token near expiry + response NOT ok    → session NOT updated, h.continue
 *  9. Token near expiry + fetch throws       → error swallowed, h.continue
 */

import { describe, it, expect, vi } from 'vitest'

// ── Module mocks (identical pattern to server.config.test.js) ─────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_HOST = '0.0.0.0'
const TEST_PORT = 3000
const TEST_ROOT_PATH = '/test/root'
const SESSION_CACHE_NAME = 'session-cache'
const SESSION_CACHE_ENGINE = 'memory'
const SESSION_PASSWORD = 'test-password-minimum-32-characters'
const SESSION_TTL = 3600000
const BACKEND_URL = 'http://localhost:4000'
const FIVE_MINUTES_MS = 5 * 60 * 1000
const NEW_ACCESS_TOKEN = 'new-access-token'
const REFRESH_TOKEN = 'old-refresh-token'
const NEW_REFRESH_TOKEN = 'new-refresh-token'
const EXPIRES_IN = 3600

// ── Global fetch mock ─────────────────────────────────────────────────────────

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ── Setup helpers ─────────────────────────────────────────────────────────────

const createMockServer = () => ({
  register: vi.fn().mockResolvedValue(undefined),
  auth: { strategy: vi.fn(), default: vi.fn() },
  ext: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  app: {}
})

const createMockConfig = () => ({
  get: vi.fn((key) => {
    const map = {
      host: TEST_HOST,
      port: TEST_PORT,
      root: TEST_ROOT_PATH,
      isProduction: false,
      backendUrl: BACKEND_URL,
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

async function setupMocks() {
  vi.resetModules()
  vi.clearAllMocks()

  const mockServer = createMockServer()
  const mockConfig = createMockConfig()

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

  return { mockServer, mockConfig }
}

/**
 * Boot the server and return the onPreHandler registered by setupSilentTokenRefresh.
 * Rate limiting is disabled (default) so the first ext call with 'onPreHandler'
 * is always the silent-refresh handler.
 */
async function getSilentRefreshHandler() {
  const { mockServer } = await setupMocks()
  const { createServer } = await import('./server.js')
  await createServer()
  const call = mockServer.ext.mock.calls.find(
    ([event]) => event === 'onPreHandler'
  )
  return { handler: call[1], mockServer }
}

// ── Guard: not authenticated ──────────────────────────────────────────────────

describe('setupSilentTokenRefresh – guard: not authenticated', () => {
  it('returns h.continue when isAuthenticated is false', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const result = await handler({ auth: { isAuthenticated: false } }, h)
    expect(result).toBe(h.continue)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns h.continue when request.auth is null', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const result = await handler({ auth: null }, h)
    expect(result).toBe(h.continue)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Guard: missing auth tokens ────────────────────────────────────────────────

describe('setupSilentTokenRefresh – guard: missing auth tokens', () => {
  it('returns h.continue when yar has no auth entry', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const yar = { get: vi.fn(() => null) }
    const result = await handler({ auth: { isAuthenticated: true }, yar }, h)
    expect(result).toBe(h.continue)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns h.continue when authTokens has no refreshToken', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const yar = { get: vi.fn(() => ({ expiresAt: Date.now() + 10_000 })) }
    const result = await handler({ auth: { isAuthenticated: true }, yar }, h)
    expect(result).toBe(h.continue)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns h.continue when authTokens has no expiresAt', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const yar = { get: vi.fn(() => ({ refreshToken: REFRESH_TOKEN })) }
    const result = await handler({ auth: { isAuthenticated: true }, yar }, h)
    expect(result).toBe(h.continue)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Guard: token not near expiry ──────────────────────────────────────────────

describe('setupSilentTokenRefresh – guard: token not near expiry', () => {
  it('returns h.continue without calling fetch when expiresAt is more than 5 min away', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const yar = {
      get: vi.fn(() => ({
        refreshToken: REFRESH_TOKEN,
        expiresAt: Date.now() + FIVE_MINUTES_MS + 60_000 // 6 minutes away
      }))
    }
    const result = await handler({ auth: { isAuthenticated: true }, yar }, h)
    expect(result).toBe(h.continue)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Refresh flow: successful ──────────────────────────────────────────────────

describe('setupSilentTokenRefresh – refresh flow: successful', () => {
  it('calls backend refresh endpoint and updates session when token is near expiry', async () => {
    const { handler, mockServer } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const yarSet = vi.fn()
    const yar = {
      get: vi.fn(() => ({
        refreshToken: REFRESH_TOKEN,
        expiresAt: Date.now() + 60_000 // 1 minute away — within 5-minute window
      })),
      set: yarSet
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
        expiresIn: EXPIRES_IN
      })
    })

    const result = await handler(
      { auth: { isAuthenticated: true }, yar, path: '/api/reviews' },
      h
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/refresh'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(yarSet).toHaveBeenCalledWith(
      'auth',
      expect.objectContaining({
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
        expiresIn: EXPIRES_IN
      })
    )
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/reviews' }),
      'Backend JWT access token silently refreshed'
    )
    expect(result).toBe(h.continue)
  })

  it('does not update session when backend responds with non-ok status', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const yarSet = vi.fn()
    const yar = {
      get: vi.fn(() => ({
        refreshToken: REFRESH_TOKEN,
        expiresAt: Date.now() + 60_000
      })),
      set: yarSet
    }

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })

    const result = await handler(
      { auth: { isAuthenticated: true }, yar, path: '/api/test' },
      h
    )

    expect(yarSet).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })
})

// ── Refresh flow: fetch throws ────────────────────────────────────────────────

describe('setupSilentTokenRefresh – refresh flow: fetch error swallowed', () => {
  it('returns h.continue and swallows the error when fetch throws', async () => {
    const { handler } = await getSilentRefreshHandler()
    const h = { continue: Symbol('continue') }
    const yarSet = vi.fn()
    const yar = {
      get: vi.fn(() => ({
        refreshToken: REFRESH_TOKEN,
        expiresAt: Date.now() + 60_000
      })),
      set: yarSet
    }

    fetchMock.mockRejectedValueOnce(new Error('Network failure'))

    const result = await handler(
      { auth: { isAuthenticated: true }, yar, path: '/api/test' },
      h
    )

    expect(yarSet).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })
})
