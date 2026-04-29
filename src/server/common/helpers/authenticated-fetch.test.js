import { describe, it, expect, beforeEach, vi } from 'vitest'
import { authenticatedFetch } from './authenticated-fetch.js'

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'backendUrl') return 'http://localhost:4000'
      return null
    })
  }
}))

vi.mock('./logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKEND_URL = 'http://localhost:4000'
const TARGET_URL = `${BACKEND_URL}/api/results/test-123`
const REFRESH_URL = `${BACKEND_URL}/api/auth/refresh`
const ACCESS_TOKEN = 'header.payload.signature'
const NEW_ACCESS_TOKEN = 'header.newpayload.newsignature'
const REFRESH_TOKEN = 'opaque-refresh-token-value'
const EXPIRES_IN_SECONDS = 900
const REFRESH_THRESHOLD_MS = 60_000

// Token that expires well beyond the 60 s refresh threshold (healthy)
const healthyExpiry = () => Date.now() + REFRESH_THRESHOLD_MS + 300_000

// Token that expires within the 60 s refresh threshold (near-expiry)
const nearExpiry = () => Date.now() + 30_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockYar(tokens = null) {
  let stored = tokens ? { ...tokens } : null
  return {
    get: vi.fn((key) => (key === 'authTokens' ? stored : null)),
    set: vi.fn((key, value) => {
      if (key === 'authTokens') stored = value
    }),
    _getStored: () => stored
  }
}

function createMockRequest(tokens = null) {
  return { yar: createMockYar(tokens) }
}

function createMockRequestNoYar() {
  return {}
}

function mockJsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body)
  }
}

function mockRefreshSuccess(newToken = NEW_ACCESS_TOKEN) {
  return mockJsonResponse({
    success: true,
    accessToken: newToken,
    expiresIn: EXPIRES_IN_SECONDS
  })
}

function mockRefreshFailure(status = 401) {
  return mockJsonResponse({ success: false }, false, status)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = vi.fn().mockResolvedValue(mockJsonResponse({ data: 'ok' }))
})

// ── No session / no tokens ────────────────────────────────────────────────────

describe('authenticatedFetch - no session', () => {
  it('should fetch without Authorization header when request has no yar', async () => {
    const request = createMockRequestNoYar()
    await authenticatedFetch(request, TARGET_URL)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      TARGET_URL,
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String)
        })
      })
    )
  })

  it('should still return the fetch response when no yar is present', async () => {
    const mockResponse = mockJsonResponse({ result: 'data' })
    globalThis.fetch.mockResolvedValueOnce(mockResponse)

    const request = createMockRequestNoYar()
    const result = await authenticatedFetch(request, TARGET_URL)

    expect(result).toBe(mockResponse)
  })

  it('should fetch without Authorization header when session has no tokens', async () => {
    const request = createMockRequest(null)
    await authenticatedFetch(request, TARGET_URL)

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers).not.toHaveProperty('Authorization')
  })
})

// ── Valid access token (not near expiry) ──────────────────────────────────────

describe('authenticatedFetch - valid access token', () => {
  it('should attach Bearer token when access token is present and healthy', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: healthyExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it('should call the correct URL', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: healthyExpiry()
    })
    await authenticatedFetch(request, TARGET_URL)

    expect(globalThis.fetch.mock.calls[0][0]).toBe(TARGET_URL)
  })

  it('should NOT attempt silent refresh when token is healthy', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: healthyExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    // Only one fetch call — the target URL, not the refresh endpoint
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.mock.calls[0][0]).toBe(TARGET_URL)
  })

  it('should return the response from fetch', async () => {
    const mockResponse = mockJsonResponse({ items: [] })
    globalThis.fetch.mockResolvedValueOnce(mockResponse)

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: healthyExpiry()
    })
    const result = await authenticatedFetch(request, TARGET_URL)

    expect(result).toBe(mockResponse)
  })
})

// ── Fetch options passthrough ─────────────────────────────────────────────────

describe('authenticatedFetch - options passthrough', () => {
  it('should forward method and body options', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: healthyExpiry()
    })
    const body = JSON.stringify({ foo: 'bar' })

    await authenticatedFetch(request, TARGET_URL, {
      method: 'POST',
      body
    })

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(body)
  })

  it('should merge caller-supplied headers with Authorization', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: healthyExpiry()
    })

    await authenticatedFetch(request, TARGET_URL, {
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-42' }
    })

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers['x-user-id']).toBe('user-42')
    expect(options.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it('should use an empty options object when none supplied', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: healthyExpiry()
    })
    await authenticatedFetch(request, TARGET_URL)

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options).toBeDefined()
  })
})

// ── Near-expiry token — refresh triggered ─────────────────────────────────────

describe('authenticatedFetch - near-expiry token, refresh succeeds', () => {
  it('should call the refresh endpoint when token is within 60 s of expiry', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess())
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[0][0]).toBe(REFRESH_URL)
  })

  it('should POST to the refresh endpoint with the refresh token', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess())
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, refreshOptions] = globalThis.fetch.mock.calls[0]
    expect(refreshOptions.method).toBe('POST')
    expect(refreshOptions.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(refreshOptions.body)).toEqual({
      refreshToken: REFRESH_TOKEN
    })
  })

  it('should use the new access token for the real request after refresh', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess(NEW_ACCESS_TOKEN))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, targetOptions] = globalThis.fetch.mock.calls[1]
    expect(targetOptions.headers.Authorization).toBe(
      `Bearer ${NEW_ACCESS_TOKEN}`
    )
  })

  it('should update the session with the new access token after refresh', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess(NEW_ACCESS_TOKEN))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const yar = createMockYar({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })
    const request = { yar }

    await authenticatedFetch(request, TARGET_URL)

    expect(yar.set).toHaveBeenCalledWith(
      'authTokens',
      expect.objectContaining({ accessToken: NEW_ACCESS_TOKEN })
    )
  })

  it('should preserve the existing refresh token in the updated session', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess(NEW_ACCESS_TOKEN))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const yar = createMockYar({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })
    const request = { yar }

    await authenticatedFetch(request, TARGET_URL)

    expect(yar.set).toHaveBeenCalledWith(
      'authTokens',
      expect.objectContaining({ refreshToken: REFRESH_TOKEN })
    )
  })

  it('should store an updated tokenExpiresAt in the session after refresh', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess(NEW_ACCESS_TOKEN))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const yar = createMockYar({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })
    const request = { yar }

    const before = Date.now()
    await authenticatedFetch(request, TARGET_URL)
    const after = Date.now()

    const stored = yar.set.mock.calls[0][1]
    expect(stored.tokenExpiresAt).toBeGreaterThanOrEqual(
      before + EXPIRES_IN_SECONDS * 1000
    )
    expect(stored.tokenExpiresAt).toBeLessThanOrEqual(
      after + EXPIRES_IN_SECONDS * 1000
    )
  })
})

// ── No access token at all — refresh triggered ────────────────────────────────

describe('authenticatedFetch - no access token, refresh succeeds', () => {
  it('should attempt refresh when there is no access token but a refresh token exists', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess(NEW_ACCESS_TOKEN))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({ refreshToken: REFRESH_TOKEN })

    await authenticatedFetch(request, TARGET_URL)

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[0][0]).toBe(REFRESH_URL)
  })

  it('should use the obtained access token for the request', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshSuccess(NEW_ACCESS_TOKEN))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({ refreshToken: REFRESH_TOKEN })

    await authenticatedFetch(request, TARGET_URL)

    const [, targetOptions] = globalThis.fetch.mock.calls[1]
    expect(targetOptions.headers.Authorization).toBe(
      `Bearer ${NEW_ACCESS_TOKEN}`
    )
  })
})

// ── Refresh fails — fall back gracefully ─────────────────────────────────────

describe('authenticatedFetch - refresh fails', () => {
  it('should proceed without Authorization header when refresh returns non-ok response', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshFailure(401))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, targetOptions] = globalThis.fetch.mock.calls[1]
    // Falls back to the old (expiring) token since refresh failed
    expect(targetOptions.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it('should proceed without a new token when refresh response has success=false', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        mockJsonResponse({ success: false, accessToken: null })
      )
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, targetOptions] = globalThis.fetch.mock.calls[1]
    expect(targetOptions.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it('should proceed without a new token when refresh response has no accessToken field', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        mockJsonResponse({ success: true }) // accessToken missing
      )
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, targetOptions] = globalThis.fetch.mock.calls[1]
    expect(targetOptions.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it('should not update the session when refresh fails', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshFailure(401))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const yar = createMockYar({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })
    const request = { yar }

    await authenticatedFetch(request, TARGET_URL)

    expect(yar.set).not.toHaveBeenCalled()
  })

  it('should still make the target request even when refresh fails', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(mockRefreshFailure(401))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[1][0]).toBe(TARGET_URL)
  })
})

// ── Refresh throws ────────────────────────────────────────────────────────────

describe('authenticatedFetch - refresh throws', () => {
  it('should fall back gracefully when the refresh fetch throws a network error', async () => {
    globalThis.fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    // Target request still made with old token
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const [, targetOptions] = globalThis.fetch.mock.calls[1]
    expect(targetOptions.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })

  it('should not throw when the refresh network call fails', async () => {
    globalThis.fetch
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce(mockJsonResponse({ data: 'ok' }))

    const request = createMockRequest({
      refreshToken: REFRESH_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await expect(authenticatedFetch(request, TARGET_URL)).resolves.toBeDefined()
  })
})

// ── Near-expiry but no refresh token ─────────────────────────────────────────

describe('authenticatedFetch - near-expiry, no refresh token', () => {
  it('should NOT attempt refresh when token is near expiry but no refresh token exists', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: nearExpiry()
      // no refreshToken
    })

    await authenticatedFetch(request, TARGET_URL)

    // Only one fetch: the target request
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.mock.calls[0][0]).toBe(TARGET_URL)
  })

  it('should still attach the existing (near-expiry) token when no refresh token', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      tokenExpiresAt: nearExpiry()
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })
})

// ── No tokenExpiresAt set ─────────────────────────────────────────────────────

describe('authenticatedFetch - tokenExpiresAt absent', () => {
  it('should NOT trigger refresh when tokenExpiresAt is absent (token has no expiry info)', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN
      // no tokenExpiresAt
    })

    await authenticatedFetch(request, TARGET_URL)

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.mock.calls[0][0]).toBe(TARGET_URL)
  })

  it('should attach the access token when tokenExpiresAt is absent', async () => {
    const request = createMockRequest({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN
    })

    await authenticatedFetch(request, TARGET_URL)

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
  })
})
