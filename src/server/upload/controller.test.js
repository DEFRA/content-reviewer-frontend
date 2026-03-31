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

  it('should initiate upload and redirect', async () => {
    const h = { redirect: vi.fn(), view: vi.fn() }
    const request = {
      server: { info: { protocol: 'http' } },
      info: { host: 'localhost' },
      yar: { id: 'session-1', set: vi.fn() },
      logger: { error: vi.fn() }
    }

    await uploadController.initiateUpload(request, h)
    expect(h.redirect).toHaveBeenCalledWith('http://example.com/upload')
  })

  it('should return upload status', async () => {
    const h = { response: vi.fn().mockReturnValue({ code: vi.fn() }) }
    const request = {
      params: { uploadId: '123' },
      logger: { error: vi.fn() }
    }

    await uploadController.getStatus(request, h)
    expect(h.response).toHaveBeenCalledWith({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 0,
      form: { file: { filename: 'test.pdf' } }
    })
  })

  it('should handle upload completion with success', async () => {
    const h = { redirect: vi.fn() }
    const request = {
      yar: {
        get: vi.fn().mockReturnValue('123'),
        clear: vi.fn(),
        set: vi.fn(),
        flash: vi.fn()
      },
      server: {
        app: { config: { get: vi.fn().mockReturnValue('http://backend') } }
      },
      logger: { error: vi.fn() }
    }

    await uploadController.uploadComplete(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/review/status-poller/review-abc')
  })
})

// ─── initiateUpload error path ────────────────────────────────────────────────

describe('uploadController - initiateUpload error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initiateUpload.mockRejectedValue(new Error('CDP uploader unavailable'))
  })

  it('should render upload form with error message on initiateUpload failure', async () => {
    const h = { view: vi.fn(), redirect: vi.fn() }
    const request = {
      server: { info: { protocol: 'http' } },
      info: { host: 'localhost' },
      yar: { id: 'session-1', set: vi.fn() },
      logger: { error: vi.fn() }
    }

    await uploadController.initiateUpload(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload/index',
      expect.objectContaining({
        errorMessage: expect.stringContaining('Failed to initiate upload')
      })
    )
    expect(request.logger.error).toHaveBeenCalled()
  })
})

// ─── statusPoller — no uploadId in session ───────────────────────────────────

describe('uploadController - statusPoller', () => {
  it('should redirect to /upload when no uploadId in session', async () => {
    const h = { redirect: vi.fn(), view: vi.fn() }
    const request = {
      yar: { get: vi.fn().mockReturnValue(null) }
    }

    await uploadController.statusPoller(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/upload')
    expect(h.view).not.toHaveBeenCalled()
  })

  it('should render status-poller view when uploadId is present', async () => {
    const h = { redirect: vi.fn(), view: vi.fn() }
    const request = {
      yar: { get: vi.fn().mockReturnValue('upload-789') }
    }

    await uploadController.statusPoller(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload/status-poller',
      expect.objectContaining({ uploadId: 'upload-789' })
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
      logger: { error: vi.fn() }
    }

    await uploadController.getStatus(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Failed to get upload status' })
    )
    expect(mockCodeFn).toHaveBeenCalledWith(500)
    expect(request.logger.error).toHaveBeenCalled()
  })
})

// ─── handleSuccessfulUpload — AI review failure path ─────────────────────────

describe('uploadController - handleSuccessfulUpload AI review failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({})
      })
    )
  })

  it('should render success view when AI review initiation fails', async () => {
    const h = { view: vi.fn(), redirect: vi.fn() }
    const request = {
      yar: { set: vi.fn(), flash: vi.fn() },
      logger: { error: vi.fn() }
    }
    const fileDetails = {
      filename: 'doc.pdf',
      contentLength: 1024,
      detectedContentType: 'application/pdf',
      fileId: 'f1',
      s3Bucket: 'bucket',
      s3Key: 'key/doc.pdf'
    }

    await uploadController.handleSuccessfulUpload(
      request,
      h,
      fileDetails,
      'http://backend'
    )

    expect(request.logger.error).toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(
      'upload/success',
      expect.objectContaining({
        pageTitle: 'Upload Successful'
      })
    )
    expect(request.yar.flash).toHaveBeenCalledWith(
      'uploadSuccess',
      expect.stringContaining('AI review could not start')
    )
  })
})

// ─── renderUploadSuccessView ───────────────────────────────────────────────────

describe('uploadController - renderUploadSuccessView', () => {
  it('should render upload/success view with formatted file details', () => {
    const h = { view: vi.fn() }
    const fileDetails = {
      filename: 'report.pdf',
      contentLength: 2048,
      detectedContentType: 'application/pdf',
      fileId: 'fid-1',
      s3Bucket: 'my-bucket',
      s3Key: 'uploads/report.pdf'
    }

    uploadController.renderUploadSuccessView(h, fileDetails)

    expect(h.view).toHaveBeenCalledWith(
      'upload/success',
      expect.objectContaining({
        pageTitle: 'Upload Successful',
        heading: 'Upload Successful',
        fileDetails: expect.objectContaining({
          filename: 'report.pdf',
          fileStatus: 'Uploaded (Review pending)'
        })
      })
    )
  })
})

// ─── uploadComplete — no uploadId in session ─────────────────────────────────

describe('uploadController - uploadComplete no uploadId', () => {
  it('should redirect to / when no uploadId in session', async () => {
    const h = { redirect: vi.fn() }
    const request = {
      yar: { get: vi.fn().mockReturnValue(null) },
      logger: { error: vi.fn() }
    }

    await uploadController.uploadComplete(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})

// ─── uploadComplete — rejected files path ────────────────────────────────────

describe('uploadController - uploadComplete rejected files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUploadStatus.mockResolvedValue({
      uploadStatus: 'rejected',
      numberOfRejectedFiles: 1,
      form: { file: { errorMessage: 'File type not allowed' } }
    })
  })

  it('should flash uploadError and redirect to / when files are rejected', async () => {
    const h = { redirect: vi.fn() }
    const flashFn = vi.fn()
    const request = {
      yar: {
        get: vi.fn().mockReturnValue('upload-rej'),
        clear: vi.fn(),
        set: vi.fn(),
        flash: flashFn
      },
      server: {
        app: { config: { get: vi.fn().mockReturnValue('http://backend') } }
      },
      logger: { error: vi.fn() }
    }

    await uploadController.uploadComplete(request, h)

    expect(flashFn).toHaveBeenCalledWith('uploadError', 'File type not allowed')
    expect(h.redirect).toHaveBeenCalledWith('/')
  })

  it('should use default error message when file errorMessage is absent', async () => {
    getUploadStatus.mockResolvedValue({
      uploadStatus: 'rejected',
      numberOfRejectedFiles: 1,
      form: { file: {} }
    })

    const h = { redirect: vi.fn() }
    const flashFn = vi.fn()
    const request = {
      yar: {
        get: vi.fn().mockReturnValue('upload-rej2'),
        clear: vi.fn(),
        set: vi.fn(),
        flash: flashFn
      },
      server: {
        app: { config: { get: vi.fn().mockReturnValue('http://backend') } }
      },
      logger: { error: vi.fn() }
    }

    await uploadController.uploadComplete(request, h)

    expect(flashFn).toHaveBeenCalledWith(
      'uploadError',
      'The file could not be uploaded. Please try again.'
    )
    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})

// ─── uploadComplete — catch / error path ─────────────────────────────────────

describe('uploadController - uploadComplete error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUploadStatus.mockRejectedValue(new Error('Status check failed'))
  })

  it('should flash uploadError and redirect to / when getUploadStatus throws', async () => {
    const h = { redirect: vi.fn() }
    const flashFn = vi.fn()
    const request = {
      yar: {
        get: vi.fn().mockReturnValue('upload-err'),
        clear: vi.fn(),
        set: vi.fn(),
        flash: flashFn
      },
      server: {
        app: { config: { get: vi.fn().mockReturnValue('http://backend') } }
      },
      logger: { error: vi.fn() }
    }

    await uploadController.uploadComplete(request, h)

    expect(flashFn).toHaveBeenCalledWith(
      'uploadError',
      'An error occurred while processing your upload.'
    )
    expect(h.redirect).toHaveBeenCalledWith('/')
    expect(request.logger.error).toHaveBeenCalled()
  })
})

// ─── handleCallback ───────────────────────────────────────────────────────────

describe('uploadController - handleCallback', () => {
  it('should return received:true on success', async () => {
    const mockCodeFn = vi.fn()
    const h = {
      response: vi.fn().mockReturnValue({ code: mockCodeFn })
    }
    const request = {
      payload: { uploadId: 'cb-123' },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await uploadController.handleCallback(request, h)

    expect(h.response).toHaveBeenCalledWith({ received: true })
    expect(mockCodeFn).toHaveBeenCalledWith(200)
  })

  it('should return 500 when callback processing throws', async () => {
    const mockCodeFn = vi.fn()
    const h = {
      response: vi.fn().mockReturnValue({ code: mockCodeFn })
    }
    const request = {
      // logger.info throws to trigger the catch block
      logger: {
        info: vi.fn(() => {
          throw new Error('Logging failed')
        }),
        error: vi.fn()
      },
      payload: null
    }

    await uploadController.handleCallback(request, h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Failed to process callback' })
    )
    expect(mockCodeFn).toHaveBeenCalledWith(500)
    expect(request.logger.error).toHaveBeenCalled()
  })
})
