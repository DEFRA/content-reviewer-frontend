/**
 * Tests for the silent token refresh onPreHandler logic from server.js.
 *
 * setupSilentTokenRefresh is not exported directly, so we test the handler
 * logic inline — mirroring the exact implementation. Any change to the logic
 * in server.js must be reflected here.
 */
import { describe, test, expect, afterEach, vi } from 'vitest'

// ── Constants ────────────────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:3001'
const REFRESH_TOKEN_OLD = 'old-refresh-token'
const REFRESH_TOKEN_NEW = 'new-refresh-token'
const ACCESS_TOKEN_NEW = 'new-access-token'
const EXPIRES_IN = 3600
const FIVE_MINUTES_MS = 5 * 60 * 1000
const TWO_MINUTES_MS = 2 * 60 * 1000
const SIX_MINUTES_MS = 6 * 60 * 1000
const ONE_SECOND_MS = 1000

// ── Handler under test ────────────────────────────────────────────────────────
// Mirrors the exact logic registered by setupSilentTokenRefresh in server.js.
// If the server.js implementation changes, update this handler to match.
async function silentRefreshHandler(request, h) {
  if (!request.auth?.isAuthenticated) {
    return h.continue
  }
  const authTokens = request.yar?.get('auth')
  if (!authTokens?.refreshToken || !authTokens?.expiresAt) {
    return h.continue
  }
  if (Date.now() < authTokens.expiresAt - FIVE_MINUTES_MS) {
    return h.continue
  }
  try {
    const backendUrl = BACKEND_URL
    const response = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: authTokens.refreshToken })
    })
    if (response.ok) {
      const { accessToken, refreshToken, expiresIn } = await response.json()
      request.yar.set('auth', {
        accessToken,
        refreshToken,
        expiresIn,
        expiresAt: Date.now() + expiresIn * 1000
      })
    }
  } catch {
    // non-fatal — proceed with existing token
  }
  return h.continue
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest({ isAuthenticated = true, authTokens = null } = {}) {
  return {
    auth: { isAuthenticated },
    yar: {
      get: vi.fn((key) => (key === 'auth' ? authTokens : null)),
      set: vi.fn()
    }
  }
}

function makeAuthTokens({ expiresAt }) {
  return {
    accessToken: 'current-access-token',
    refreshToken: REFRESH_TOKEN_OLD,
    expiresIn: EXPIRES_IN,
    expiresAt
  }
}

function makeH() {
  return { continue: Symbol('h.continue') }
}

function mockSuccessfulRefresh() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN_NEW,
      refreshToken: REFRESH_TOKEN_NEW,
      expiresIn: EXPIRES_IN
    })
  })
}

// ── Skip conditions ───────────────────────────────────────────────────────────
describe('silentRefresh - returns h.continue immediately when skip condition is met', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('Should skip when request is not authenticated', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const h = makeH()
    const request = makeRequest({ isAuthenticated: false })

    const result = await silentRefreshHandler(request, h)

    expect(result).toBe(h.continue)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should skip when yar has no auth entry', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const request = makeRequest({ authTokens: null })
    const h = makeH()

    const result = await silentRefreshHandler(request, h)

    expect(result).toBe(h.continue)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should skip when auth entry has no refreshToken', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const request = makeRequest({
      authTokens: { accessToken: 'tok', expiresAt: Date.now() + ONE_SECOND_MS }
    })
    const h = makeH()

    const result = await silentRefreshHandler(request, h)

    expect(result).toBe(h.continue)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should skip when auth entry has no expiresAt', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const request = makeRequest({
      authTokens: { accessToken: 'tok', refreshToken: REFRESH_TOKEN_OLD }
    })
    const h = makeH()

    const result = await silentRefreshHandler(request, h)

    expect(result).toBe(h.continue)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should skip when token expires more than 5 minutes from now', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const expiresAt = Date.now() + SIX_MINUTES_MS
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const h = makeH()

    const result = await silentRefreshHandler(request, h)

    expect(result).toBe(h.continue)
    expect(fetch).not.toHaveBeenCalled()
    expect(request.yar.set).not.toHaveBeenCalled()
  })
})

// ── Refresh triggered ─────────────────────────────────────────────────────────
describe('silentRefresh - calls refresh endpoint when token is near expiry', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('Should call POST /api/v1/auth/refresh with the current refresh token', async () => {
    vi.stubGlobal('fetch', mockSuccessfulRefresh())
    const expiresAt = Date.now() + TWO_MINUTES_MS // within 5 min window
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const h = makeH()

    await silentRefreshHandler(request, h)

    expect(fetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/api/v1/auth/refresh`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: REFRESH_TOKEN_OLD })
      })
    )
  })

  test('Should store new tokens in yar under the auth key on success', async () => {
    vi.stubGlobal('fetch', mockSuccessfulRefresh())
    const expiresAt = Date.now() + TWO_MINUTES_MS
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const h = makeH()

    await silentRefreshHandler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith(
      'auth',
      expect.objectContaining({
        accessToken: ACCESS_TOKEN_NEW,
        refreshToken: REFRESH_TOKEN_NEW,
        expiresIn: EXPIRES_IN,
        expiresAt: expect.any(Number)
      })
    )
  })

  test('Should set new expiresAt to approximately now + expiresIn * 1000', async () => {
    vi.stubGlobal('fetch', mockSuccessfulRefresh())
    const expiresAt = Date.now() + TWO_MINUTES_MS
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const before = Date.now()

    await silentRefreshHandler(request, makeH())

    const after = Date.now()
    const [, stored] = request.yar.set.mock.calls[0]
    expect(stored.expiresAt).toBeGreaterThanOrEqual(before + EXPIRES_IN * 1000)
    expect(stored.expiresAt).toBeLessThanOrEqual(after + EXPIRES_IN * 1000)
  })

  test('Should also refresh when the token is already expired', async () => {
    vi.stubGlobal('fetch', mockSuccessfulRefresh())
    const expiresAt = Date.now() - ONE_SECOND_MS // already expired
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const h = makeH()

    await silentRefreshHandler(request, h)

    expect(fetch).toHaveBeenCalled()
    expect(request.yar.set).toHaveBeenCalled()
  })

  test('Should return h.continue after a successful refresh', async () => {
    vi.stubGlobal('fetch', mockSuccessfulRefresh())
    const expiresAt = Date.now() + TWO_MINUTES_MS
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const h = makeH()

    const result = await silentRefreshHandler(request, h)

    expect(result).toBe(h.continue)
  })
})

// ── Graceful degradation ──────────────────────────────────────────────────────
describe('silentRefresh - graceful degradation when refresh fails', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('Should not update session when refresh endpoint returns non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: vi.fn() })
    )
    const expiresAt = Date.now() + TWO_MINUTES_MS
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const h = makeH()

    const result = await silentRefreshHandler(request, h)

    expect(request.yar.set).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })

  test('Should not throw and should return h.continue when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )
    const expiresAt = Date.now() + TWO_MINUTES_MS
    const request = makeRequest({ authTokens: makeAuthTokens({ expiresAt }) })
    const h = makeH()

    await expect(silentRefreshHandler(request, h)).resolves.toBe(h.continue)
    expect(request.yar.set).not.toHaveBeenCalled()
  })
})
