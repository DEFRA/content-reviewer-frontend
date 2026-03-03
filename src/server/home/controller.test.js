import { describe, it, beforeEach, expect, vi } from 'vitest'
import { homeController } from './controller'

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
})
