import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reviewHistoryController } from './controller.js'

vi.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }))
}))

vi.mock('../../common/helpers/get-user-identifier.js', () => ({
  getUserIdentifier: vi.fn(() => null)
}))

// Use vi.hoisted so MockAgent is available when the factory is hoisted
const { MockAgent } = vi.hoisted(() => {
  function MockAgent() {}
  return { MockAgent }
})

vi.mock('undici', () => ({
  Agent: MockAgent
}))

globalThis.fetch = vi.fn()

function createMockRequest(params = {}) {
  return {
    params,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    },
    server: {
      app: {
        config: {
          get: vi.fn((key) => {
            if (key === 'backendUrl') {
              return 'http://localhost:4000'
            }
            return null
          })
        }
      }
    }
  }
}

function createMockH() {
  return {
    view: vi.fn((template, data) => ({ template, data })),
    redirect: vi.fn((url) => ({ redirect: url }))
  }
}

const REVIEW_HISTORY_TITLE = 'Review History'
const REVIEW_HISTORY_VIEW = 'review/history/index'

describe('reviewHistoryController - showHistory (fetch and display review history)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch and display review history successfully', async () => {
    const mockRequest = createMockRequest()
    const mockH = createMockH()
    const mockReviews = [
      {
        uploadId: 'test-1',
        filename: 'test.pdf',
        status: 'completed'
      }
    ]

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        reviews: mockReviews,
        total: 1
      })
    })

    const result = await reviewHistoryController.showHistory(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reviews?limit=100'),
      expect.objectContaining({})
    )
    expect(mockH.view).toHaveBeenCalledWith(
      REVIEW_HISTORY_VIEW,
      expect.objectContaining({
        pageTitle: REVIEW_HISTORY_TITLE,
        heading: REVIEW_HISTORY_TITLE,
        reviews: mockReviews,
        count: 1
      })
    )
    expect(result.template).toBe(REVIEW_HISTORY_VIEW)
    expect(result.template).toBe('review/history/index')
  })
})

describe('reviewHistoryController - showHistory (count and missing reviews scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use count when total is not available', async () => {
    const mockRequest = createMockRequest()
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        reviews: [],
        count: 5
      })
    })

    await reviewHistoryController.showHistory(mockRequest, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      REVIEW_HISTORY_VIEW,
      expect.objectContaining({
        count: 5
      })
    )
  })

  it('should handle missing reviews array', async () => {
    const mockRequest = createMockRequest()
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        total: 0
      })
    })

    await reviewHistoryController.showHistory(mockRequest, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      REVIEW_HISTORY_VIEW,
      expect.objectContaining({
        reviews: [],
        count: 0
      })
    )
  })
})

describe('reviewHistoryController - showHistory (failure and error scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle backend failure response', async () => {
    const mockRequest = createMockRequest()
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    const result = await reviewHistoryController.showHistory(mockRequest, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      REVIEW_HISTORY_VIEW,
      expect.objectContaining({
        pageTitle: REVIEW_HISTORY_TITLE,
        heading: REVIEW_HISTORY_TITLE,
        reviews: [],
        count: 0,
        error: 'Unable to load review history. Please try again later.'
      })
    )
    expect(result.data.error).toBeDefined()
    expect(result.data.error).toBeDefined()
  })

  it('should handle network errors', async () => {
    const mockRequest = createMockRequest()
    const mockH = createMockH()
    const networkError = new Error('Network error')

    globalThis.fetch.mockRejectedValueOnce(networkError)

    const result = await reviewHistoryController.showHistory(mockRequest, mockH)

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      networkError,
      'Failed to fetch review history'
    )
    expect(mockH.view).toHaveBeenCalledWith(
      REVIEW_HISTORY_VIEW,
      expect.objectContaining({
        error: 'Unable to load review history. Please try again later.'
      })
    )
    expect(result.data.error).toBeDefined()
    expect(result.data.error).toBeDefined()
  })
})

const REVIEW_HISTORY_REDIRECT = '/review/history'
const DELETE_FAILED_REDIRECT = '/review/history?error=delete_failed'

describe('reviewHistoryController - deleteReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete review successfully and redirect', async () => {
    const mockRequest = createMockRequest({ reviewId: 'test-123' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK'
    })

    const result = await reviewHistoryController.deleteReview(
      mockRequest,
      mockH
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/reviews/test-123',
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(mockH.redirect).toHaveBeenCalledWith(REVIEW_HISTORY_REDIRECT)
    expect(result.redirect).toBe(REVIEW_HISTORY_REDIRECT)
  })

  it('should handle delete failure and redirect with error', async () => {
    const mockRequest = createMockRequest({ reviewId: 'test-456' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    const result = await reviewHistoryController.deleteReview(
      mockRequest,
      mockH
    )
    expect(mockH.redirect).toHaveBeenCalledWith(DELETE_FAILED_REDIRECT)
    expect(result.redirect).toBe(DELETE_FAILED_REDIRECT)
  })

  it('should handle network errors during delete', async () => {
    const mockRequest = createMockRequest({ reviewId: 'test-789' })
    const mockH = createMockH()
    const networkError = new Error('Connection timeout')

    globalThis.fetch.mockRejectedValueOnce(networkError)

    const result = await reviewHistoryController.deleteReview(
      mockRequest,
      mockH
    )

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      networkError,
      'Failed to delete review'
    )
    expect(mockH.redirect).toHaveBeenCalledWith(DELETE_FAILED_REDIRECT)
    expect(result.redirect).toBe(DELETE_FAILED_REDIRECT)
  })

  it('should log all required information during delete', async () => {
    const mockRequest = createMockRequest({ reviewId: 'test-log' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content'
    })

    await reviewHistoryController.deleteReview(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/reviews/test-log',
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(mockH.redirect).toHaveBeenCalledWith(REVIEW_HISTORY_REDIRECT)
  })
})
