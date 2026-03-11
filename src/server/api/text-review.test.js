import { describe, it, expect, beforeEach, vi } from 'vitest'
import { textReviewApiController } from './text-review.js'

const BACKEND_URL = 'http://localhost:4000'
const TEXT_ENDPOINT = `${BACKEND_URL}/api/review/text`
const LONG_TEXT = 'This is a long enough text content for review submission.'
const SHORT_TEXT = 'Short'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'backendUrl') {
        return BACKEND_URL
      }
      return null
    })
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

// vi.hoisted ensures these are available inside the hoisted vi.mock() factory.
// The Agent stub is a plain object factory – undici Agent is only used as `new Agent(opts)`
// and the instance is passed as `dispatcher`; tests never call methods on it.
const { MockAgent, fetchMock } = vi.hoisted(() => ({
  // Use Object as a stand-in constructor: `new Object()` returns `{}`
  MockAgent: Object,
  fetchMock: vi.fn()
}))

// Mock undici Agent – must use vi.hoisted value, not vi.fn() directly in factory
vi.mock('undici', () => ({
  Agent: MockAgent
}))

// Mock global fetch for all tests
vi.stubGlobal('fetch', fetchMock)

function createMockRequest(payload = {}) {
  return {
    payload: {
      textContent: LONG_TEXT,
      title: 'Test Title',
      ...payload
    },
    auth: {
      credentials: {
        user: { id: 'user-123' }
      }
    },
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
  }
}

function createMockH() {
  const responseMock = {
    code: vi.fn().mockReturnThis()
  }
  return {
    response: vi.fn(() => responseMock),
    _responseMock: responseMock
  }
}

describe('textReviewApiController.reviewText - validation', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('returns 400 when textContent is missing', async () => {
    const req = createMockRequest({ textContent: null })

    await textReviewApiController.reviewText(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_BAD_REQUEST
    )
  })

  it('returns 400 when textContent is too short (under 10 chars)', async () => {
    const req = createMockRequest({ textContent: SHORT_TEXT })

    await textReviewApiController.reviewText(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Text content too short. Enter at least 10 characters'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_BAD_REQUEST
    )
  })
})

describe('textReviewApiController.reviewText - title generation', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('uses provided title when given', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId: 'rev-001' })
    })

    const req = createMockRequest({ title: 'My Custom Title' })
    await textReviewApiController.reviewText(req, mockH)

    expect(fetchMock).toHaveBeenCalledWith(
      TEXT_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"title":"My Custom Title"')
      })
    )
  })

  it('auto-generates title from first 3 words when no title given', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId: 'rev-002' })
    })

    const req = createMockRequest({ title: null })
    await textReviewApiController.reviewText(req, mockH)

    expect(fetchMock).toHaveBeenCalledWith(
      TEXT_ENDPOINT,
      expect.objectContaining({
        body: expect.stringContaining('...')
      })
    )
  })
})

describe('textReviewApiController.reviewText - backend success', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('returns 200 with reviewId on successful backend response', async () => {
    const reviewId = 'rev-success-001'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId })
    })

    const req = createMockRequest()
    await textReviewApiController.reviewText(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        reviewId,
        message: 'Text content submitted successfully'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(HTTP_STATUS_OK)
  })

  it('includes x-user-id header when user is identified', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId: 'rev-004' })
    })

    const req = createMockRequest()
    await textReviewApiController.reviewText(req, mockH)

    expect(fetchMock).toHaveBeenCalledWith(
      TEXT_ENDPOINT,
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-user-id': 'user-123' })
      })
    )
  })

  it('omits x-user-id header when getUserIdentifier returns null', async () => {
    const { getUserIdentifier } =
      await import('../common/helpers/get-user-identifier.js')
    getUserIdentifier.mockReturnValueOnce(null)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId: 'rev-005' })
    })

    const req = createMockRequest()
    await textReviewApiController.reviewText(req, mockH)

    expect(fetchMock).toHaveBeenCalledWith(
      TEXT_ENDPOINT,
      expect.objectContaining({
        headers: expect.not.objectContaining({ 'x-user-id': expect.anything() })
      })
    )
  })
})

describe('textReviewApiController.reviewText - backend errors', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('returns 500 when backend response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: HTTP_STATUS_SERVICE_UNAVAILABLE,
      statusText: 'Service Unavailable'
    })

    const req = createMockRequest()
    await textReviewApiController.reviewText(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Failed to submit text content to backend'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })

  it('returns 500 when fetch throws a network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Connection refused'))

    const req = createMockRequest()
    await textReviewApiController.reviewText(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Connection refused'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })

  it('falls back to "Internal server error" when thrown error has no message', async () => {
    const errorWithNoMessage = new Error('placeholder')
    errorWithNoMessage.message = ''
    fetchMock.mockRejectedValueOnce(errorWithNoMessage)

    const req = createMockRequest()
    await textReviewApiController.reviewText(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal server error'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })
})
