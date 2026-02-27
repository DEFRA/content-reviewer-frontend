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
