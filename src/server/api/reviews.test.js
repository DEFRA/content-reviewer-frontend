import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getReviewsController } from './reviews.js'

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

vi.mock('../common/helpers/get-user-identifier.js', () => ({
  getUserIdentifier: vi.fn(() => null)
}))

// Use vi.hoisted so MockAgent is available when the factory is hoisted
const { MockAgent } = vi.hoisted(() => ({
  MockAgent: class {
    dispatch() {
      return this
    }
  }
}))

vi.mock('undici', () => ({
  Agent: MockAgent
}))

globalThis.fetch = vi.fn()

function createMockRequest(query = {}) {
  return {
    query,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
  }
}

function createMockH() {
  return {
    response: vi.fn((data) => ({
      code: vi.fn(() => data)
    }))
  }
}

function createMockReview() {
  return {
    uploadId: 'test-1',
    filename: 'test.pdf',
    status: 'completed',
    uploadedAt: '2026-02-25T10:00:00Z'
  }
}

function createSuccessResponse(reviews, pagination) {
  return {
    ok: true,
    json: async () => ({
      reviews,
      pagination
    })
  }
}

describe('getReviewsController - Default Pagination', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = createMockRequest()
    mockH = createMockH()
  })

  it('should return reviews with default pagination', async () => {
    const mockReviews = [createMockReview()]
    const pagination = {
      total: 1,
      limit: 25,
      skip: 0,
      returned: 1
    }

    globalThis.fetch.mockResolvedValueOnce(
      createSuccessResponse(mockReviews, pagination)
    )

    await getReviewsController(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/reviews?limit=25&skip=0',
      expect.objectContaining({})
    )
    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      reviews: mockReviews,
      count: 1,
      total: 1,
      pagination
    })
  })

  it('should handle invalid page and limit values', async () => {
    const query = {
      page: 'invalid',
      limit: 'invalid'
    }
    mockRequest = createMockRequest(query)
    const mockReviews = []

    globalThis.fetch.mockResolvedValueOnce(
      createSuccessResponse(mockReviews, null)
    )

    await getReviewsController(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/reviews?limit=25&skip=0',
      expect.objectContaining({})
    )
  })
})

describe('getReviewsController - Custom Pagination', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()
    mockH = createMockH()
  })

  it('should handle custom pagination parameters', async () => {
    const query = {
      page: '2',
      limit: '10'
    }
    mockRequest = createMockRequest(query)
    const mockReviews = []
    const pagination = {
      total: 0,
      limit: 10,
      skip: 10,
      returned: 0
    }

    globalThis.fetch.mockResolvedValueOnce(
      createSuccessResponse(mockReviews, pagination)
    )

    await getReviewsController(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/reviews?limit=10&skip=10',
      expect.objectContaining({})
    )
  })

  it('should use pageSize as effective limit when limit exceeds pageSize', async () => {
    const query = {
      page: '2',
      limit: '50'
    }
    mockRequest = createMockRequest(query)
    const mockReviews = []

    globalThis.fetch.mockResolvedValueOnce(
      createSuccessResponse(mockReviews, null)
    )

    await getReviewsController(mockRequest, mockH)

    // limit=50 > PAGE_SIZE=25, so effectivePageSize=25, skip=(2-1)*25=25
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/reviews?limit=50&skip=25',
      expect.objectContaining({})
    )
  })

  it('should use skip=0 for page 1 when limit exceeds pageSize', async () => {
    const query = {
      page: '1',
      limit: '50'
    }
    mockRequest = createMockRequest(query)
    const mockReviews = [createMockReview()]

    globalThis.fetch.mockResolvedValueOnce(
      createSuccessResponse(mockReviews, null)
    )

    await getReviewsController(mockRequest, mockH)

    // limit=50 > PAGE_SIZE=25, so effectivePageSize=25, skip=(1-1)*25=0
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/reviews?limit=50&skip=0',
      expect.objectContaining({})
    )
  })
})

describe('getReviewsController - Data Normalization', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = createMockRequest()
    mockH = createMockH()
  })

  it('should normalize non-array reviews to empty array', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reviews: null
      })
    })

    await getReviewsController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        reviews: [],
        count: 0
      })
    )
  })

  it('should handle missing pagination in backend response', async () => {
    const mockReviews = [createMockReview()]

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reviews: mockReviews
      })
    })

    await getReviewsController(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        pagination: {
          total: 1,
          limit: 25,
          skip: 0,
          returned: 1
        }
      })
    )
  })
})

describe('getReviewsController - Error Handling', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = createMockRequest()
    mockH = createMockH()
  })

  it('should handle backend failure response', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await getReviewsController(mockRequest, mockH)

    expect(mockRequest.logger.error).toHaveBeenCalled()
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      reviews: [],
      count: 0,
      total: 0,
      error: 'Failed to fetch review history'
    })
  })

  it('should handle network errors', async () => {
    const networkError = new Error('Network error')
    globalThis.fetch.mockRejectedValueOnce(networkError)

    await getReviewsController(mockRequest, mockH)

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      { error: networkError.message },
      'Error fetching review history'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      reviews: [],
      count: 0,
      total: 0,
      error: networkError.message
    })
  })
})
