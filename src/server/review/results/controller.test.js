import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resultsController } from './controller.js'

vi.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }))
}))

globalThis.fetch = vi.fn()
globalThis.performance = {
  now: vi.fn()
}

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
    response: vi.fn((data) => ({
      code: vi.fn((statusCode) => ({ data, statusCode }))
    }))
  }
}

const HTTP_BAD_REQUEST = 400

const ERROR_TEMPLATE = 'review/results/error'

// Setup performance mocks and clearAllMocks before each test group
beforeEach(() => {
  vi.clearAllMocks()
  let performanceCounter = 0
  globalThis.performance.now.mockImplementation(() => {
    performanceCounter += 10
    return performanceCounter
  })
})

// Missing review id scenarios
describe('resultsController - missing review id scenarios', () => {
  it('should handle missing review id', async () => {
    const mockRequest = createMockRequest({})
    const mockH = createMockH()

    const result = await resultsController.handler(mockRequest, mockH)

    expect(mockRequest.logger.warn).toHaveBeenCalledWith(
      'Missing review id for results route'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      error: 'Review id is required in the URL'
    })
    expect(result.statusCode).toBe(HTTP_BAD_REQUEST)
    expect(result.statusCode).toBe(HTTP_BAD_REQUEST)
  })

  it('should handle undefined review id', async () => {
    const mockRequest = createMockRequest({ id: null })
    const mockH = createMockH()

    const result = await resultsController.handler(mockRequest, mockH)

    expect(mockRequest.logger.warn).toHaveBeenCalled()
    expect(result.statusCode).toBe(HTTP_BAD_REQUEST)
  })
})

// Completed review scenarios - fetch and display
describe('resultsController - completed review fetch and display', () => {
  it('should fetch and display completed review results', async () => {
    const mockRequest = createMockRequest({ id: 'test-123' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'test-123',
          status: 'completed',
          scores: {},
          annotatedSections: [],
          issues: [],
          improvements: []
        }
      })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/result/test-123'
    )
    expect(mockH.view).toHaveBeenCalledWith(
      'review/results/index',
      expect.objectContaining({
        pageTitle: 'Review Results',
        heading: 'AI Content Review Results',
        reviewId: 'test-123'
      })
    )
    expect(result.template).toBe('review/results/index')
  })
})

// Completed review scenarios - transform backend data
describe('resultsController - completed review transform backend data', () => {
  it('should transform backend data correctly', async () => {
    const TRANSFORM_TEST_ID = 'transform-test'
    const mockRequest = createMockRequest({ id: TRANSFORM_TEST_ID })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: TRANSFORM_TEST_ID,
          status: 'completed',
          processedAt: '2026-02-25T11:00:00Z',
          scores: { overall: 80 },
          annotatedSections: [],
          issues: [],
          improvements: []
        }
      })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    expect(result.data.results).toEqual(
      expect.objectContaining({
        id: TRANSFORM_TEST_ID,
        status: 'completed',
        processedAt: '2026-02-25T11:00:00Z'
      })
    )
  })
})

// Completed review scenarios - log performance metrics
describe('resultsController - completed review log performance metrics', () => {
  it('should log performance metrics', async () => {
    const mockRequest = createMockRequest({ id: 'perf-test' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          status: 'completed',
          scores: {},
          annotatedSections: [],
          issues: [],
          improvements: []
        }
      })
    })

    await resultsController.handler(mockRequest, mockH)

    expect(mockRequest.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewId: 'perf-test'
      }),
      expect.stringContaining('[FRONTEND] Results page rendered')
    )
  })
})

// Pending review scenarios
describe('resultsController - pending review scenarios', () => {
  it('should render pending view for processing status', async () => {
    const PENDING_REVIEW_ID = 'pending-123'
    const mockRequest = createMockRequest({ id: PENDING_REVIEW_ID })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          documentId: PENDING_REVIEW_ID,
          status: 'processing'
        }
      })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    expect(mockH.view).toHaveBeenCalledWith(
      'review/results/pending',
      expect.objectContaining({
        pageTitle: 'Review In Progress',
        heading: 'Review In Progress',
        reviewId: PENDING_REVIEW_ID,
        currentStatus: 'processing',
        progress: 50
      })
    )
    expect(result.template).toBe('review/results/pending')
  })

  it('should handle pending status with default progress', async () => {
    const mockRequest = createMockRequest({ id: 'pending-456' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          documentId: 'pending-456',
          status: 'pending'
        }
      })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    expect(result.data.progress).toBe(0)
  })
})

// Error handling scenarios
describe('resultsController - error handling scenarios', () => {
  it('should handle backend error response', async () => {
    const mockRequest = createMockRequest({ id: 'error-123' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    expect(result.template).toBe(ERROR_TEMPLATE)
  })

  it('should handle invalid API response', async () => {
    const mockRequest = createMockRequest({ id: 'invalid-123' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: false
      })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewId: 'invalid-123'
      }),
      'Failed to fetch review results'
    )
    expect(result.template).toBe(ERROR_TEMPLATE)
  })

  it('should handle network errors', async () => {
    const mockRequest = createMockRequest({ id: 'network-error' })
    const mockH = createMockH()
    const networkError = new Error('Network timeout')
    networkError.code = 'ETIMEDOUT'

    globalThis.fetch.mockRejectedValueOnce(networkError)

    const result = await resultsController.handler(mockRequest, mockH)

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Network timeout',
        errorName: 'Error',
        reviewId: 'network-error'
      }),
      'Failed to fetch review results'
    )
    expect(result.template).toBe('review/results/error')
  })

  it('should handle fetch errors with stack trace', async () => {
    const mockRequest = createMockRequest({ id: 'stack-test' })
    const mockH = createMockH()
    const fetchError = new Error('Connection refused')

    globalThis.fetch.mockRejectedValueOnce(fetchError)

    await resultsController.handler(mockRequest, mockH)

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.any(String)
      }),
      'Failed to fetch review results'
    )
  })
})

// Data transformation scenarios
describe('resultsController - data transformation scenarios', () => {
  it('should handle missing result data', async () => {
    const mockRequest = createMockRequest({ id: 'missing-data' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          status: 'completed',
          processedAt: '2026-02-25T13:00:00Z'
          // no scores, annotatedSections, issues, improvements
        }
      })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    // New controller returns envelope shape; result.reviewData should be present but empty
    expect(result.data.results.result.reviewData.scores).toEqual({})
    expect(
      result.data.results.result.reviewData.reviewedContent.annotatedSections
    ).toEqual([])
    expect(
      result.data.results.result.reviewData.reviewedContent.issues
    ).toEqual([])
    expect(result.data.results.result.reviewData.improvements).toEqual([])
  })

  it('should handle legacy API response format', async () => {
    const mockRequest = createMockRequest({ id: 'legacy-format' })
    const mockH = createMockH()

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          status: 'completed',
          processedAt: '2026-02-25T14:00:00Z',
          scores: { overall: 60 },
          annotatedSections: [],
          issues: [],
          improvements: []
        }
      })
    })

    const result = await resultsController.handler(mockRequest, mockH)

    expect(result.data.results).toEqual(
      expect.objectContaining({
        id: 'legacy-format',
        status: 'completed'
      })
    )
  })
})
