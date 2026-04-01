import { describe, it, beforeEach, expect, vi } from 'vitest'
import { homeController } from './controller'

// Use vi.hoisted so these are available when the vi.mock factory runs (hoisted to top)
const { mockLoggerError, mockLoggerInfo } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn()
}))

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn()
  }))
}))

vi.mock('../common/helpers/get-user-identifier.js', () => ({
  getUserIdentifier: vi.fn(() => null)
}))

const mockConfig = {
  get: vi.fn((key) => {
    if (key === 'backendUrl') {
      return 'https://mock-backend'
    }
    if (key === 'contentReview.maxCharLength') {
      return '100000'
    }
    return ''
  })
}
const mockRequest = (overrides = {}) => ({
  query: {},
  yar: {
    flash: vi.fn(() => [])
  },
  server: {
    app: {
      config: mockConfig
    }
  },
  ...overrides
})
const mockH = { view: vi.fn() }

globalThis.fetch = vi.fn()

const HOME_INDEX_VIEW = 'home/index'

// Default rendering tests
describe('homeController - default rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders home page with default pagination and no reviews', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({ reviews: [] })
    })
    const req = mockRequest()
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        pageTitle: 'Home',
        heading: 'Home',
        reviewHistory: [],
        backendUrl: 'https://mock-backend',
        contentReviewMaxCharLength: '100000',
        pagination: expect.objectContaining({ currentPage: 1, totalPages: 1 })
      })
    )
  })
})

// Flash messages tests
describe('homeController - flash messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles uploadSuccess and uploadError flash messages', async () => {
    const req = mockRequest()
    req.yar.flash = vi.fn((type) =>
      type === 'uploadSuccess' ? ['Success!'] : ['Error!']
    )
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({ reviews: [] })
    })
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        uploadSuccess: 'Success!',
        uploadError: 'Error!'
      })
    )
  })
})

// Pagination and backend data tests
describe('homeController - pagination and backend data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles pagination params and backend data', async () => {
    const req = mockRequest({ query: { limit: '50', page: '2' } })
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({
        reviews: [{ id: '1' }, { id: '2' }],
        pagination: { total: 100 }
      })
    })
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        reviewHistory: [
          { id: '1', reviewId: '1' },
          { id: '2', reviewId: '2' }
        ],
        pagination: expect.objectContaining({
          currentPage: 2,
          totalReviews: 50,
          totalPages: 2
        })
      })
    )
  })
})

// Error handling tests
describe('homeController - error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles backend errors gracefully', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('Backend down'))
    const req = mockRequest()
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        reviewHistory: [],
        pagination: expect.objectContaining({ totalReviews: 0, totalPages: 1 })
      })
    )
  })

  it('calls logger.error with error details when backend fetch throws', async () => {
    const backendError = new Error('Connection refused')
    globalThis.fetch.mockRejectedValueOnce(backendError)
    const req = mockRequest()
    await homeController.handler(req, mockH)
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('Connection refused'),
      expect.objectContaining({ stack: expect.any(String) })
    )
  })
})

// Review id normalization tests
describe('homeController - review id normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes review ids from backend', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({ reviews: [{ reviewId: 'abc' }] })
    })
    const req = mockRequest()
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        reviewHistory: [{ id: 'abc', reviewId: 'abc' }]
      })
    )
  })

  it('returns empty array when reviews is not an array', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({ reviews: null })
    })
    const req = mockRequest()
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({ reviewHistory: [] })
    )
  })
})

describe('homeController - userId scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes userId in backend URL when user is identified', async () => {
    const { getUserIdentifier } =
      await import('../common/helpers/get-user-identifier.js')
    getUserIdentifier.mockReturnValueOnce('user-99')

    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({ reviews: [] })
    })

    const req = mockRequest()
    await homeController.handler(req, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('userId=user-99'),
      expect.objectContaining({})
    )
  })
})

// Pagination edge-case branches
describe('homeController - calculatePagination edge branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to limit when pagination.total and data.total are absent (limit > pageSize path)', async () => {
    // limit=50 > pageSize=25, but no pagination.total or data.total → triggers || limit branch
    const req = mockRequest({ query: { limit: '50' } })
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({
        reviews: [{ id: '1' }]
        // no pagination.total, no data.total
      })
    })
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        pagination: expect.objectContaining({
          totalReviews: 50 // Math.min(50, limit) = 50
        })
      })
    )
  })

  it('falls back to normalizedLength when pagination.total, total, and count are all absent (limit <= pageSize path)', async () => {
    // limit=5 <= pageSize=25, no pagination.total, no data.total, no data.count → normalizedLength
    const req = mockRequest()
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({
        reviews: [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
        // no total, no count → normalizedLength (3) is used
      })
    })
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        pagination: expect.objectContaining({
          totalReviews: 3
        })
      })
    )
  })

  it('falls back to 0 when all count sources are absent and reviews is empty (|| 0 branch)', async () => {
    // limit=5 <= pageSize=25, no pagination.total, no data.total, no data.count, reviews=[] → normalizedLength=0 → || 0
    const req = mockRequest()
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({ reviews: [] })
      // no total, no count, empty reviews → normalizedLength=0 → || 0
    })
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        pagination: expect.objectContaining({
          totalReviews: 0
        })
      })
    )
  })

  it('falls back to [] when data.reviews, data.data and data itself are all falsy', async () => {
    // data = false → data.reviews = undefined, data.data = undefined, data = false → [] fallback
    const req = mockRequest()
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => false
    })
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        reviewHistory: []
      })
    )
  })

  it('evaluates !review.reviewId when review has neither id nor reviewId (missingId right branch)', async () => {
    // Review with no id and no reviewId → normalized id = undefined → !review.id = true → right side !review.reviewId evaluated
    const req = mockRequest()
    globalThis.fetch.mockResolvedValueOnce({
      json: async () => ({
        reviews: [{ status: 'pending', title: 'No ID review' }]
      })
    })
    await homeController.handler(req, mockH)
    expect(mockH.view).toHaveBeenCalledWith(
      HOME_INDEX_VIEW,
      expect.objectContaining({
        reviewHistory: expect.arrayContaining([
          expect.objectContaining({ status: 'pending' })
        ])
      })
    )
  })
})
