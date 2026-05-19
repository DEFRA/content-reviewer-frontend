import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadController } from './controller.js'
import {
  initiateUpload,
  getUploadStatus
} from '../common/helpers/cdp-uploader-client.js'

vi.mock('../common/helpers/cdp-uploader-client.js', () => ({
  initiateUpload: vi.fn(),
  getUploadStatus: vi.fn()
}))

describe('uploadController', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    initiateUpload.mockResolvedValue({
      uploadId: '123',
      uploadUrl: 'http://example.com/upload'
    })

    getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 0,
      form: { file: { filename: 'test.pdf' } }
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'review-abc' })
      })
    )
  })

  it('should render the upload form', async () => {
    const h = { view: vi.fn() }
    await uploadController.showUploadForm({}, h)
    expect(h.view).toHaveBeenCalledWith('upload/index', {
      pageTitle: 'Upload Document',
      heading: 'Upload PDF or Word Document'
    })
  })

  it('should initiate upload and return the CDP Uploader URL as JSON', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      server: { info: { protocol: 'http' } },
      info: { host: 'localhost' },
      yar: { id: 'session-1', set: vi.fn() },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.initiateUpload(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ uploadUrl: 'http://example.com/upload' })
    )
    expect(mockCode).toHaveBeenCalledWith(200)
  })

  it('should not register a CDP Uploader webhook callback (frontend orchestrates step c)', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      server: { info: { protocol: 'http' } },
      info: { host: 'localhost' },
      yar: { id: 'session-1', set: vi.fn() },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.initiateUpload(request, h)

    expect(initiateUpload).toHaveBeenCalledWith(
      expect.not.objectContaining({ callback: expect.anything() })
    )
  })

  it('should return upload status', async () => {
    const h = { response: vi.fn().mockReturnValue({ code: vi.fn() }) }
    const request = {
      params: { uploadId: '123' },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.getStatus(request, h)
    expect(h.response).toHaveBeenCalledWith({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 0,
      form: { file: { filename: 'test.pdf' } }
    })
  })

  it('should use "unknown" userId when yar.id is not set', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      server: { info: { protocol: 'http' } },
      info: { host: 'localhost' },
      yar: { id: undefined, set: vi.fn() },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.initiateUpload(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ uploadUrl: 'http://example.com/upload' })
    )
    expect(mockCode).toHaveBeenCalledWith(200)
  })
})

// ─── initiateUpload error path ────────────────────────────────────────────────

describe('uploadController - initiateUpload error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initiateUpload.mockRejectedValue(new Error('CDP uploader unavailable'))
  })

  it('should return JSON 500 with error message when initiateUpload fails', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      server: { info: { protocol: 'http' } },
      info: { host: 'localhost' },
      yar: { id: 'session-1', set: vi.fn() },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.initiateUpload(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Failed to initiate upload')
      })
    )
    expect(mockCode).toHaveBeenCalledWith(500)
    expect(request.logger.error).toHaveBeenCalled()
  })
})

// ─── statusPoller — no uploadId in session ───────────────────────────────────

describe('uploadController - statusPoller', () => {
  it('should redirect to / when neither reviewId nor uploadId is available', async () => {
    const h = { redirect: vi.fn(), view: vi.fn() }
    const request = {
      query: {},
      yar: { get: vi.fn().mockReturnValue(null), set: vi.fn() }
    }

    await uploadController.statusPoller(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/')
    expect(h.view).not.toHaveBeenCalled()
  })

  it('should render status-poller view with uploadId and reviewId from session', async () => {
    const h = { redirect: vi.fn(), view: vi.fn() }
    const request = {
      query: { reviewId: 'review-abc' },
      yar: {
        get: vi.fn((key) => (key === 'currentUploadId' ? 'upload-789' : null)),
        set: vi.fn()
      }
    }

    await uploadController.statusPoller(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload/status-poller',
      expect.objectContaining({
        uploadId: 'upload-789',
        reviewId: 'review-abc'
      })
    )
  })
})

// ─── getStatus error path ─────────────────────────────────────────────────────

describe('uploadController - getStatus error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUploadStatus.mockRejectedValue(new Error('Status service down'))
  })

  it('should return 500 when getUploadStatus throws', async () => {
    const mockCodeFn = vi.fn()
    const h = {
      response: vi.fn().mockReturnValue({ code: mockCodeFn })
    }
    const request = {
      params: { uploadId: 'fail-id' },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Failed to get upload status' })
    )
    expect(mockCodeFn).toHaveBeenCalledWith(500)
    expect(request.logger.error).toHaveBeenCalled()
  })
})

// ─── triggerReview ────────────────────────────────────────────────────────────

describe('uploadController - triggerReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 0,
      form: {
        file: {
          filename: 'doc.pdf',
          s3Key: 'uploads/doc.pdf',
          contentType: 'application/pdf'
        }
      }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      })
    )
  })

  it('should call getUploadStatus and forward S3 details to backend /upload-callback', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      payload: { uploadId: 'upload-123', reviewId: 'review-abc' },
      yar: { id: 'session-1' },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.triggerReview(request, h)

    expect(getUploadStatus).toHaveBeenCalledWith('upload-123')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/upload-callback'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('"reviewId":"review-abc"')
      })
    )
    expect(h.response).toHaveBeenCalledWith({ reviewId: 'review-abc' })
    expect(mockCode).toHaveBeenCalledWith(200)
  })

  it('should include the S3 form data from CDP Uploader status in the backend call', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      payload: { uploadId: 'upload-123', reviewId: 'review-abc' },
      yar: { id: 'session-1' },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.triggerReview(request, h)

    const [, fetchOptions] = fetch.mock.calls[0]
    const body = JSON.parse(fetchOptions.body)
    expect(body.form).toEqual({
      file: {
        filename: 'doc.pdf',
        s3Key: 'uploads/doc.pdf',
        contentType: 'application/pdf'
      }
    })
    expect(body.uploadStatus).toBe('ready')
    expect(body.numberOfRejectedFiles).toBe(0)
  })

  it('should return 500 when getUploadStatus throws', async () => {
    getUploadStatus.mockRejectedValue(new Error('CDP Uploader unreachable'))
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      payload: { uploadId: 'fail-id', reviewId: 'review-abc' },
      yar: { id: 'session-1' },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.triggerReview(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Failed to trigger review')
      })
    )
    expect(mockCode).toHaveBeenCalledWith(500)
    expect(request.logger.error).toHaveBeenCalled()
  })

  it('should return 500 when backend /upload-callback returns non-OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({ message: 'Backend unavailable' })
      })
    )
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }
    const request = {
      payload: { uploadId: 'upload-123', reviewId: 'review-abc' },
      yar: { id: 'session-1' },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.triggerReview(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Failed to trigger review')
      })
    )
    expect(mockCode).toHaveBeenCalledWith(500)
  })
})
