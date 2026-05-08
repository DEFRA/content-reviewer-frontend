/**
 * reviews.conditions.test.js
 *
 * Covers the 1 condition branch in reviews.js that remains uncovered
 * after the main test suite:
 *
 * Condition — `accessToken ? { Authorization: ... } : {}` in fetchReviewsFromBackend
 *   Existing tests: request.yar is never set → accessToken is always null (false branch only).
 *   Missing: accessToken is non-null → Authorization: Bearer header included in the
 *   backend fetch call (true branch).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getReviewsController } from './reviews.js'

const ACCESS_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.test-access-token'

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => (key === 'backendUrl' ? 'http://localhost:4000' : null))
  }
}))

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }))
}))

vi.mock('../common/helpers/get-user-identifier.js', () => ({
  getUserIdentifier: vi.fn(() => null)
}))

const { MockAgent } = vi.hoisted(() => ({
  MockAgent: class {
    dispatch() {
      return this
    }
  }
}))

vi.mock('undici', () => ({ Agent: MockAgent }))

globalThis.fetch = vi.fn()

function createMockRequestWithToken(accessToken) {
  return {
    query: {},
    yar: { get: vi.fn(() => ({ accessToken })) },
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  }
}

function createMockH() {
  return {
    response: vi.fn((data) => ({ code: vi.fn(() => data) }))
  }
}

// ── Condition: accessToken truthy → Authorization header sent to backend ───────

describe('getReviewsController – accessToken condition', () => {
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()
    mockH = createMockH()
  })

  it('includes Authorization header in backend fetch when session has an accessToken', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviews: [], pagination: null })
    })

    const req = createMockRequestWithToken(ACCESS_TOKEN)
    await getReviewsController(req, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${ACCESS_TOKEN}`
        })
      })
    )
  })
})
