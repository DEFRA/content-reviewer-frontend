/**
 * text-review.conditions.test.js
 *
 * Covers the 3 condition branches in text-review.js that remain uncovered
 * after the main test suite:
 *
 * Condition 1 — `accessToken ? { Authorization: ... } : {}` (submitToBackend L97)
 *   Existing tests: request.yar is never set → accessToken is always null.
 *   Missing: accessToken is non-null → Authorization header included.
 *
 * Condition 2 — `sourceType || 'text'` (submitToBackend L102)
 *   Existing tests: sourceType is always undefined → right side ('text') always used.
 *   Missing: sourceType is truthy → left side (sourceType value) forwarded.
 *
 * Condition 3 — `sourceUrl || null` (submitToBackend L103)
 *   Existing tests: sourceUrl is always undefined → right side (null) always used.
 *   Missing: sourceUrl is truthy → left side (sourceUrl value) forwarded.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { textReviewApiController } from './text-review.js'

const BACKEND_URL = 'http://localhost:4000'
const TEXT_ENDPOINT = `${BACKEND_URL}/api/review/text`
const LONG_TEXT = 'This is a long enough text content for review submission.'
const ACCESS_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.test-access-token'
const SOURCE_TYPE = 'url'
const SOURCE_URL = 'https://www.gov.uk/guidance/test-page'

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => (key === 'backendUrl' ? BACKEND_URL : null))
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
  getUserIdentifier: vi.fn(() => 'user-123')
}))

const { MockAgent, fetchMock } = vi.hoisted(() => ({
  MockAgent: Object,
  fetchMock: vi.fn()
}))

vi.mock('undici', () => ({ Agent: MockAgent }))
vi.stubGlobal('fetch', fetchMock)

function createMockRequest(payload = {}, accessToken = null) {
  return {
    payload: {
      textContent: LONG_TEXT,
      ...payload
    },
    yar: accessToken ? { get: vi.fn(() => ({ accessToken })) } : undefined,
    auth: { credentials: { user: { id: 'user-123' } } },
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  }
}

function createMockH() {
  const responseMock = { code: vi.fn().mockReturnThis() }
  return { response: vi.fn(() => responseMock), _responseMock: responseMock }
}

function mockBackendSuccess(reviewId = 'rev-001') {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: vi.fn().mockResolvedValueOnce({ reviewId })
  })
}

// ── Condition 1: accessToken truthy → Authorization header included ────────────

describe('textReviewApiController.reviewText – accessToken condition', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('includes Authorization header when session has an accessToken', async () => {
    mockBackendSuccess()
    const req = createMockRequest({}, ACCESS_TOKEN)

    await textReviewApiController.reviewText(req, mockH)

    expect(fetchMock).toHaveBeenCalledWith(
      TEXT_ENDPOINT,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${ACCESS_TOKEN}`
        })
      })
    )
  })
})

// ── Condition 2: sourceType truthy → forwarded as-is (left side of ||) ────────

describe('textReviewApiController.reviewText – sourceType condition', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('forwards the provided sourceType value instead of falling back to "text"', async () => {
    mockBackendSuccess()
    const req = createMockRequest({ sourceType: SOURCE_TYPE })

    await textReviewApiController.reviewText(req, mockH)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.sourceType).toBe(SOURCE_TYPE)
  })
})

// ── Condition 3: sourceUrl truthy → forwarded as-is (left side of ||) ─────────

describe('textReviewApiController.reviewText – sourceUrl condition', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('forwards the provided sourceUrl value instead of falling back to null', async () => {
    mockBackendSuccess()
    const req = createMockRequest({ sourceUrl: SOURCE_URL })

    await textReviewApiController.reviewText(req, mockH)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.sourceUrl).toBe(SOURCE_URL)
  })
})
