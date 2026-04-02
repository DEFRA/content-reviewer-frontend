import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reviewHistoryController } from './controller.js'
import { getUserIdentifier } from '../../common/helpers/get-user-identifier.js'

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

// Define mockAgent function in the outer scope to avoid redeclaration and naming issues
function mockAgent() {
  // Intentional empty mock for undici Agent
}

// Use vi.hoisted so mockAgent is available when the factory is hoisted
const { MockAgent } = vi.hoisted(() => {
  return { MockAgent: mockAgent }
})

vi.mock('undici', () => ({
  Agent: MockAgent
}))

globalThis.fetch = vi.fn()

function createMockRequest(params = {}, { payload = {}, query = {} } = {}) {
  return {
    params,
    payload,
    query,
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

describe('reviewHistoryController - showHistory (userId scoping)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include userId in backend URL when getUserIdentifier returns a non-null value', async () => {
    const { getUserIdentifier } =
      await import('../../common/helpers/get-user-identifier.js')
    getUserIdentifier.mockReturnValueOnce('user-xyz')

    const mockRequest = createMockRequest()
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reviews: [], total: 0 })
    })

    await reviewHistoryController.showHistory(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('userId=user-xyz'),
      expect.objectContaining({})
    )
  })
})

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

  it('should default count to 0 when total and count are both absent', async () => {
    const mockRequest = createMockRequest()
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        reviews: []
        // no total, no count → triggers || 0 branch
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

const CONFIRM_DELETE_VIEW = 'review/history/confirm-delete'

describe('reviewHistoryController - deleteReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete review successfully and show success message', async () => {
    const mockRequest = createMockRequest(
      { reviewId: 'test-123' },
      { payload: { filename: 'annual-report.pdf' } }
    )
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
    expect(mockH.view).toHaveBeenCalledWith(
      CONFIRM_DELETE_VIEW,
      expect.objectContaining({
        pageTitle: 'Review deleted',
        successMessage: expect.stringContaining('annual-report.pdf')
      })
    )
    expect(result.template).toBe(CONFIRM_DELETE_VIEW)
  })

  it('should use "this review" as filename fallback when payload has no filename', async () => {
    const mockRequest = createMockRequest({ reviewId: 'test-123' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await reviewHistoryController.deleteReview(mockRequest, mockH)

    expect(mockH.view).toHaveBeenCalledWith(
      CONFIRM_DELETE_VIEW,
      expect.objectContaining({
        successMessage: expect.stringContaining('this review')
      })
    )
  })

  it('should handle delete failure and show error message on the same page', async () => {
    const mockRequest = createMockRequest(
      { reviewId: 'test-456' },
      { payload: { filename: 'report.pdf' } }
    )
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
    expect(mockH.view).toHaveBeenCalledWith(
      CONFIRM_DELETE_VIEW,
      expect.objectContaining({
        pageTitle: 'Delete review',
        errorMessage: expect.stringContaining('problem deleting')
      })
    )
    expect(result.template).toBe(CONFIRM_DELETE_VIEW)
  })

  it('should handle network errors during delete and show error message', async () => {
    const mockRequest = createMockRequest(
      { reviewId: 'test-789' },
      { payload: { filename: 'doc.pdf' } }
    )
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
    expect(mockH.view).toHaveBeenCalledWith(
      CONFIRM_DELETE_VIEW,
      expect.objectContaining({
        errorMessage: expect.stringContaining('problem deleting')
      })
    )
    expect(result.template).toBe(CONFIRM_DELETE_VIEW)
  })

  it('should call the correct backend delete endpoint', async () => {
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
    expect(mockH.view).toHaveBeenCalledWith(
      CONFIRM_DELETE_VIEW,
      expect.objectContaining({ successMessage: expect.any(String) })
    )
  })
})

describe('reviewHistoryController - showHistory with authenticated userId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include userId in the backend request URL when getUserIdentifier returns a value', async () => {
    getUserIdentifier.mockReturnValueOnce('user-abc-123')

    const mockRequest = createMockRequest()
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ reviews: [], total: 0 })
    })

    await reviewHistoryController.showHistory(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('userId=user-abc-123'),
      expect.objectContaining({})
    )
  })
})

describe('reviewHistoryController - showDeleteConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the confirm-delete view with reviewId and filename from query', async () => {
    const mockRequest = {
      params: { reviewId: 'rev-xyz' },
      query: { filename: 'annual-report.pdf' }
    }
    const mockH = createMockH()

    const result = await reviewHistoryController.showDeleteConfirm(
      mockRequest,
      mockH
    )

    expect(mockH.view).toHaveBeenCalledWith(
      'review/history/confirm-delete',
      expect.objectContaining({
        pageTitle: 'Delete review',
        reviewId: 'rev-xyz',
        filename: 'annual-report.pdf'
      })
    )
    expect(result.template).toBe('review/history/confirm-delete')
  })

  it('should fall back to "this review" when filename query param is absent', async () => {
    const mockRequest = {
      params: { reviewId: 'rev-no-name' },
      query: {}
    }
    const mockH = createMockH()

    await reviewHistoryController.showDeleteConfirm(mockRequest, mockH)

    expect(mockH.view).toHaveBeenCalledWith(
      'review/history/confirm-delete',
      expect.objectContaining({
        reviewId: 'rev-no-name',
        filename: 'this review'
      })
    )
  })
})
