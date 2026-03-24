import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reviewStatusPollerController } from './controller.js'

const REVIEW_ID = 'abc-123'
const BACKEND_URL = 'http://backend'
const STATUS_DATA = { status: 'complete', reviewId: REVIEW_ID }
const HTTP_STATUS_OK = 200
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500
const UPLOAD_PATH = '/upload'
const STATUS_POLLER_VIEW = 'review/status-poller/index'

function makeRequest(overrides = {}) {
  return {
    params: { reviewId: REVIEW_ID },
    server: {
      app: {
        config: {
          get: vi.fn((key) => (key === 'backendUrl' ? BACKEND_URL : null))
        }
      }
    },
    logger: {
      error: vi.fn()
    },
    ...overrides
  }
}

function makeH() {
  const codeStub = vi.fn().mockReturnThis()
  return {
    redirect: vi.fn((url) => ({ redirectUrl: url })),
    view: vi.fn((template, ctx) => ({ template, ctx })),
    response: vi.fn(() => ({ code: codeStub, _codeStub: codeStub }))
  }
}

describe('reviewStatusPollerController - showStatusPoller', () => {
  let h

  beforeEach(() => {
    h = makeH()
    vi.clearAllMocks()
  })

  it('should redirect to /upload when reviewId is missing', async () => {
    const request = makeRequest({ params: {} })
    await reviewStatusPollerController.showStatusPoller(request, h)

    expect(h.redirect).toHaveBeenCalledWith(UPLOAD_PATH)
  })

  it('should render the status poller view with reviewId', async () => {
    const request = makeRequest()
    await reviewStatusPollerController.showStatusPoller(request, h)

    expect(h.view).toHaveBeenCalledWith(
      STATUS_POLLER_VIEW,
      expect.objectContaining({
        pageTitle: 'AI Review in Progress',
        heading: 'AI Content Review in Progress',
        reviewId: REVIEW_ID
      })
    )
  })
})

describe('reviewStatusPollerController - getReviewStatus', () => {
  let h

  beforeEach(() => {
    h = makeH()
    vi.clearAllMocks()
    globalThis.fetch = vi.fn()
  })

  it('should return status data with 200 when backend responds ok', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => STATUS_DATA
    })
    const request = makeRequest()
    await reviewStatusPollerController.getReviewStatus(request, h)

    expect(h.response).toHaveBeenCalledWith(STATUS_DATA)
    expect(h.response().code).toHaveBeenCalledWith(HTTP_STATUS_OK)
  })

  it('should return 500 error response when backend responds not ok', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false })
    const request = makeRequest()
    await reviewStatusPollerController.getReviewStatus(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    )
    expect(h.response().code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })

  it('should log error and return 500 when fetch throws', async () => {
    const fetchError = new Error('network failure')
    globalThis.fetch.mockRejectedValueOnce(fetchError)
    const request = makeRequest()
    await reviewStatusPollerController.getReviewStatus(request, h)

    expect(request.logger.error).toHaveBeenCalledWith(
      fetchError,
      'Failed to get review status'
    )
    expect(h.response().code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })
})
