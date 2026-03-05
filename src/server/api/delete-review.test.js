import { describe, it, expect, beforeEach, vi } from 'vitest'
import { deleteReviewController } from './delete-review.js'
import fetch from 'node-fetch'

const BACKEND_URL = 'http://localhost:4000'
const REVIEW_ID = 'review-abc-123'
const DELETE_ENDPOINT = `${BACKEND_URL}/api/reviews/${REVIEW_ID}`

const HTTP_STATUS_OK = 200
const HTTP_STATUS_NOT_FOUND = 404
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'backendUrl') {
        return 'http://localhost:4000'
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

vi.mock('node-fetch', () => ({
  default: vi.fn()
}))

function createMockRequest(reviewId = REVIEW_ID) {
  return {
    params: { reviewId },
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

describe('deleteReviewController - success responses', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockRequest = createMockRequest()
    mockH = createMockH()
  })

  it('returns 200 with success true when backend responds ok', async () => {
    const backendData = { message: 'Review deleted successfully' }
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(backendData)
    })

    await deleteReviewController(mockRequest, mockH)

    expect(fetch).toHaveBeenCalledWith(
      DELETE_ENDPOINT,
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, reviewId: REVIEW_ID })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(HTTP_STATUS_OK)
  })

  it('uses data.message from backend when present', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ message: 'Custom delete message' })
    })

    await deleteReviewController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom delete message' })
    )
  })

  it('falls back to default message when backend data has no message', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({})
    })

    await deleteReviewController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Review deleted successfully' })
    )
  })
})

describe('deleteReviewController - error responses', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockRequest = createMockRequest()
    mockH = createMockH()
  })

  it('returns backend status code with error details when response is not ok (JSON error)', async () => {
    const errorBody = JSON.stringify({
      error: 'Not found',
      message: 'Review does not exist'
    })
    fetch.mockResolvedValueOnce({
      ok: false,
      status: HTTP_STATUS_NOT_FOUND,
      text: vi.fn().mockResolvedValueOnce(errorBody)
    })

    await deleteReviewController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Not found',
        message: 'Review does not exist'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(HTTP_STATUS_NOT_FOUND)
  })

  it('wraps plain text error body when JSON.parse fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: HTTP_STATUS_SERVICE_UNAVAILABLE,
      text: vi.fn().mockResolvedValueOnce('Service unavailable')
    })

    await deleteReviewController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Service unavailable'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_SERVICE_UNAVAILABLE
    )
  })

  it('uses fallback error/message when error fields are absent in JSON error body', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: HTTP_STATUS_NOT_FOUND,
      text: vi.fn().mockResolvedValueOnce(JSON.stringify({}))
    })

    await deleteReviewController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Failed to delete review'
      })
    )
  })

  it('returns 500 when fetch throws an error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network failure'))

    await deleteReviewController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Internal server error',
        message: 'Network failure'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })
})
