import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadController } from './controller.js'
import { initiateUpload } from '../common/helpers/cdp-uploader-client.js'

vi.mock('../common/helpers/cdp-uploader-client.js', () => ({
  initiateUpload: vi.fn()
}))

function makeRequest(yarId = 'session-1') {
  return {
    yar: { id: yarId, set: vi.fn() },
    logger: { info: vi.fn(), error: vi.fn() }
  }
}

describe('uploadController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initiateUpload.mockResolvedValue({
      uploadId: '123',
      uploadUrl: 'http://example.com/upload'
    })
  })

  it('should render the upload form', async () => {
    const h = { view: vi.fn() }
    await uploadController.showUploadForm({}, h)
    expect(h.view).toHaveBeenCalledWith('upload/index', {
      pageTitle: 'Upload Document',
      heading: 'Upload PDF or Word Document'
    })
  })

  it('should initiate upload and return uploadUrl and reviewId as JSON', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }

    await uploadController.initiateUpload(makeRequest(), h)

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadUrl: 'http://example.com/upload',
        reviewId: expect.any(String)
      })
    )
    expect(mockCode).toHaveBeenCalledWith(200)
  })

  it('should register a CDP Uploader callback URL pointing to the backend', async () => {
    const h = { response: vi.fn().mockReturnValue({ code: vi.fn() }) }

    await uploadController.initiateUpload(makeRequest(), h)

    expect(initiateUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        callback: expect.stringContaining('/upload-callback')
      })
    )
  })

  it('should pass a relative redirect URI to CDP Uploader', async () => {
    const h = { response: vi.fn().mockReturnValue({ code: vi.fn() }) }

    await uploadController.initiateUpload(makeRequest(), h)

    // Relative URL per CDP docs: same-host routing resolves it in production;
    // CDP Uploader dev mode converts it via Referer header locally.
    expect(initiateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ redirect: '/' })
    )
  })

  it('should use "unknown" userId when yar.id is not set', async () => {
    const mockCode = vi.fn()
    const h = { response: vi.fn().mockReturnValue({ code: mockCode }) }

    await uploadController.initiateUpload(makeRequest(undefined), h)

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

    await uploadController.initiateUpload(
      {
        yar: { id: 'session-1', set: vi.fn() },
        logger: { info: vi.fn(), error: vi.fn() }
      },
      h
    )

    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Failed to initiate upload')
      })
    )
    expect(mockCode).toHaveBeenCalledWith(500)
  })
})
