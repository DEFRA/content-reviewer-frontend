import { describe, it, expect, beforeEach, vi } from 'vitest'
import { uploadApiController } from './upload.js'

const BACKEND_URL = 'http://localhost:4000'
const UPLOAD_ENDPOINT = `${BACKEND_URL}/api/upload`
const TEST_FILENAME = 'document.pdf'
const TEST_CONTENT_TYPE = 'application/pdf'
const TEST_REVIEW_ID = 'review-upload-001'
const ONE_MB = 1024 * 1024
const VALID_FILE_SIZE = ONE_MB
const MAX_FILE_SIZE_MB = 10
const OVERSIZED_FILE = (MAX_FILE_SIZE_MB + 1) * ONE_MB

const HTTP_STATUS_OK = 200
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'backendUrl') {
        return BACKEND_URL
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

// Use vi.hoisted so all references are available when factories are hoisted
const { MockAgent, undiciFetchMock, FormDataMock } = vi.hoisted(() => {
  function MockAgent() {}
  const undiciFetchMock = vi.fn()
  function FormDataMock() {
    this.append = vi.fn()
    this.getHeaders = vi.fn(() => ({ 'content-type': 'multipart/form-data' }))
  }
  return { MockAgent, undiciFetchMock, FormDataMock }
})

vi.mock('undici', () => ({
  Agent: MockAgent,
  fetch: undiciFetchMock
}))

vi.mock('form-data', () => ({ default: FormDataMock }))

function createMockFile(
  filename = TEST_FILENAME,
  contentType = TEST_CONTENT_TYPE,
  bytes = VALID_FILE_SIZE
) {
  return {
    hapi: {
      filename,
      headers: { 'content-type': contentType }
    },
    bytes
  }
}

function createMockRequest(file = createMockFile()) {
  return {
    payload: { file },
    headers: {
      'user-agent': 'test-agent'
    },
    info: { remoteAddress: '127.0.0.1' },
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
  }
}

function createMockH() {
  const responseMock = {
    code: vi.fn().mockReturnThis()
  }
  return {
    response: vi.fn(() => responseMock),
    _responseMock: responseMock
  }
}

describe('uploadApiController.uploadFile - file rejection', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('returns 400 when no file is provided', async () => {
    const req = createMockRequest(null)

    await uploadApiController.uploadFile(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'No file provided' })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_BAD_REQUEST
    )
  })

  it('returns 400 when file exceeds maximum size', async () => {
    const req = createMockRequest(
      createMockFile(TEST_FILENAME, TEST_CONTENT_TYPE, OVERSIZED_FILE)
    )

    await uploadApiController.uploadFile(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('File too large')
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_BAD_REQUEST
    )
  })

  it('returns 400 for disallowed MIME type and extension', async () => {
    const req = createMockRequest(
      createMockFile('script.exe', 'application/octet-stream', VALID_FILE_SIZE)
    )

    await uploadApiController.uploadFile(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Invalid file type')
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_BAD_REQUEST
    )
  })
})

describe('uploadApiController.uploadFile - accepted file types', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('accepts .doc extension with non-standard MIME type', async () => {
    undiciFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        reviewId: TEST_REVIEW_ID,
        filename: 'doc.doc'
      })
    })

    const req = createMockRequest(
      createMockFile('report.doc', 'application/octet-stream', VALID_FILE_SIZE)
    )

    await uploadApiController.uploadFile(req, mockH)

    expect(mockH._responseMock.code).toHaveBeenCalledWith(HTTP_STATUS_OK)
  })

  it('accepts .docx extension with correct MIME type', async () => {
    undiciFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        reviewId: TEST_REVIEW_ID,
        filename: 'doc.docx'
      })
    })

    const req = createMockRequest(
      createMockFile(
        'report.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        VALID_FILE_SIZE
      )
    )

    await uploadApiController.uploadFile(req, mockH)

    expect(mockH._responseMock.code).toHaveBeenCalledWith(HTTP_STATUS_OK)
  })
})

describe('uploadApiController.uploadFile - backend success', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('returns 200 with reviewId on successful backend upload', async () => {
    undiciFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        reviewId: TEST_REVIEW_ID,
        filename: TEST_FILENAME
      })
    })

    const req = createMockRequest()
    await uploadApiController.uploadFile(req, mockH)

    expect(undiciFetchMock).toHaveBeenCalledWith(
      UPLOAD_ENDPOINT,
      expect.objectContaining({ method: 'POST' })
    )
    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        reviewId: TEST_REVIEW_ID,
        filename: TEST_FILENAME,
        message: 'File uploaded successfully'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(HTTP_STATUS_OK)
  })

  it('includes reviewId null fallback in success response', async () => {
    undiciFetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId: null, filename: null })
    })

    const req = createMockRequest()
    await uploadApiController.uploadFile(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
  })
})

describe('uploadApiController.uploadFile - backend errors', () => {
  let mockH

  beforeEach(() => {
    vi.resetAllMocks()
    mockH = createMockH()
  })

  it('returns 500 when backend responds with error status', async () => {
    undiciFetchMock.mockResolvedValueOnce({
      ok: false,
      status: HTTP_STATUS_SERVICE_UNAVAILABLE,
      statusText: 'Service Unavailable',
      text: vi.fn().mockResolvedValueOnce('Backend error')
    })

    const req = createMockRequest()
    await uploadApiController.uploadFile(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Failed to upload file to backend'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })

  it('returns 500 when fetch throws a network error', async () => {
    undiciFetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const req = createMockRequest()
    await uploadApiController.uploadFile(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'ECONNREFUSED'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })

  it('falls back to "Internal server error" when thrown error has no message', async () => {
    const errorWithNoMessage = new Error('placeholder')
    errorWithNoMessage.message = ''
    undiciFetchMock.mockRejectedValueOnce(errorWithNoMessage)

    const req = createMockRequest()
    await uploadApiController.uploadFile(req, mockH)

    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal server error'
      })
    )
    expect(mockH._responseMock.code).toHaveBeenCalledWith(
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })
})
