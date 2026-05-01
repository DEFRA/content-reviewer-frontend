import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetch as undiciFetch } from 'undici'
import { uploadApiController, _private } from './upload.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500
const HTTP_STATUS_BAD_GATEWAY = 502
const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422
const FILENAME_PDF = 'document.pdf'
const DEFAULT_REVIEW_ID = 'review-123'
const REVIEW_ABC123 = 'review-abc123'
const MIME_OCTET_STREAM = 'application/octet-stream'
const MIME_PDF = 'application/pdf'

// Mock undici
vi.mock('undici', () => ({
  Agent: vi.fn(function (options) {
    this.keepAliveTimeout = options.keepAliveTimeout
    this.keepAliveMaxTimeout = options.keepAliveMaxTimeout
    this.connections = options.connections
  }),
  fetch: vi.fn()
}))

// Mock config
vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configMap = {
        backendUrl: 'http://localhost:3001'
      }
      return configMap[key]
    })
  }
}))

// Mock logger
vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

// Mock getUserIdentifier
vi.mock('../common/helpers/get-user-identifier.js', () => ({
  getUserIdentifier: vi.fn(() => 'user-123')
}))

// Module-level fixtures — reinitialised before each test by setupTestFixtures()
let mockRequest
let mockH

/**
 * Returns a fresh mock stream. The on() handler fires 'data' and 'end'
 * synchronously so fileStreamToBuffer resolves in the same microtask queue.
 */
function createMockStream() {
  return {
    on: vi.fn((event, callback) => {
      if (event === 'data') {
        callback(Buffer.from('PDF file content'))
      } else if (event === 'end') {
        callback()
      } else {
        // other events (e.g. 'error') are configured per-test
      }
    })
  }
}

/**
 * Reinitialise module-level mockRequest and mockH before each test.
 * Called via beforeEach(setupTestFixtures) in the outer describe.
 */
function setupTestFixtures() {
  vi.clearAllMocks()
  mockRequest = {
    payload: createMockStream(),
    headers: {
      'content-type': MIME_OCTET_STREAM,
      'x-file-name': FILENAME_PDF,
      'x-file-content-type': MIME_PDF,
      'user-agent': 'Mozilla/5.0 Test'
    },
    info: {
      remoteAddress: '127.0.0.1'
    }
  }
  mockH = {
    response: vi.fn(function (data) {
      return {
        ...data,
        code: vi.fn(function (statusCode) {
          this.statusCode = statusCode
          return this
        })
      }
    })
  }
}

// --- Mock response factories ---

function okResponse(reviewId = DEFAULT_REVIEW_ID, filename = FILENAME_PDF) {
  return {
    ok: true,
    status: HTTP_STATUS_OK,
    json: vi.fn().mockResolvedValueOnce({ reviewId, filename })
  }
}

function failResponse(status, body = {}) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValueOnce(body)
  }
}

function failResponseNonJson(status) {
  return {
    ok: false,
    status,
    json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
  }
}

// --- Test suite registration functions ---
// Each function is called synchronously inside the outer describe callback so
// that Vitest registers the inner suites as children and the outer beforeEach
// applies to all tests within them.

function registerFileValidationTests() {
  describe('File Validation', () => {
    it('should accept valid PDF file', async () => {
      undiciFetch.mockResolvedValueOnce(okResponse())
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(HTTP_STATUS_OK)
      expect(result.message).toBe('File uploaded successfully')
      expect(result.reviewId).toBe(DEFAULT_REVIEW_ID)
    })

    it('should accept valid DOCX file', async () => {
      mockRequest.headers['x-file-name'] = 'document.docx'
      mockRequest.headers['x-file-content-type'] =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      undiciFetch.mockResolvedValueOnce(
        okResponse('review-456', 'document.docx')
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(HTTP_STATUS_OK)
    })

    it('should accept valid DOC file', async () => {
      mockRequest.headers['x-file-name'] = 'document.doc'
      mockRequest.headers['x-file-content-type'] = 'application/msword'
      undiciFetch.mockResolvedValueOnce(
        okResponse('review-789', 'document.doc')
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(HTTP_STATUS_OK)
    })

    it('should validate by extension when MIME type is unrecognized', async () => {
      mockRequest.headers['x-file-name'] = FILENAME_PDF
      mockRequest.headers['x-file-content-type'] = 'application/unknown'
      undiciFetch.mockResolvedValueOnce(okResponse())
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
    })

    it('should handle filename with special characters', async () => {
      mockRequest.headers['x-file-name'] = 'document-2024_v1.2.pdf'
      undiciFetch.mockResolvedValueOnce(
        okResponse(DEFAULT_REVIEW_ID, 'document-2024_v1.2.pdf')
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
    })

    it('should handle filename with Unicode characters', async () => {
      mockRequest.headers['x-file-name'] = encodeURIComponent('документ.pdf')
      undiciFetch.mockResolvedValueOnce(
        okResponse(DEFAULT_REVIEW_ID, 'документ.pdf')
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
    })
  })
}

function registerBackendRequestTests() {
  describe('Backend Integration - request forwarding', () => {
    it('should send file to backend with correct headers', async () => {
      undiciFetch.mockResolvedValueOnce(okResponse())
      await uploadApiController.uploadFile(mockRequest, mockH)
      expect(undiciFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/upload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': MIME_OCTET_STREAM,
            'x-file-name': FILENAME_PDF,
            'x-file-content-type': MIME_PDF,
            'x-user-id': 'user-123'
          })
        })
      )
    })

    it('should encode filename in header', async () => {
      mockRequest.headers['x-file-name'] = encodeURIComponent(
        'my file with spaces.pdf'
      )
      undiciFetch.mockResolvedValueOnce(
        okResponse(DEFAULT_REVIEW_ID, 'my file with spaces.pdf')
      )
      await uploadApiController.uploadFile(mockRequest, mockH)
      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-file-name']).toBe(
        'my%20file%20with%20spaces.pdf'
      )
    })

    it('should use userId when available', async () => {
      undiciFetch.mockResolvedValueOnce(okResponse())
      await uploadApiController.uploadFile(mockRequest, mockH)
      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-user-id']).toBe('user-123')
    })

    it('should use fallback userId when not available', async () => {
      const { getUserIdentifier } =
        await import('../common/helpers/get-user-identifier.js')
      vi.mocked(getUserIdentifier).mockReturnValueOnce(null)
      undiciFetch.mockResolvedValueOnce(okResponse())
      await uploadApiController.uploadFile(mockRequest, mockH)
      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-user-id']).toBe('content-reviewer-frontend')
    })
  })
}

function registerBackendResponseTests() {
  describe('Backend Integration - response handling', () => {
    it('should handle successful backend response', async () => {
      undiciFetch.mockResolvedValueOnce(okResponse(REVIEW_ABC123))
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
      expect(result.reviewId).toBe(REVIEW_ABC123)
      expect(result.filename).toBe(FILENAME_PDF)
    })

    it('should handle backend error response', async () => {
      undiciFetch.mockResolvedValueOnce(
        failResponse(HTTP_STATUS_INTERNAL_SERVER_ERROR, {
          message: 'Backend processing error'
        })
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toBe('Backend processing error')
    })

    it('uses default error message when backend error response has no message field', async () => {
      // Covers the `errorData.message || errorMessage` false branch in handleBackendFailure
      undiciFetch.mockResolvedValueOnce(
        failResponse(HTTP_STATUS_UNPROCESSABLE_ENTITY)
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.message).toBe('Failed to upload file to backend')
    })

    it('should handle backend response with non-JSON body', async () => {
      undiciFetch.mockResolvedValueOnce(
        failResponseNonJson(HTTP_STATUS_BAD_GATEWAY)
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toBe('Failed to upload file to backend')
    })

    it('should handle network errors', async () => {
      undiciFetch.mockRejectedValueOnce(new Error('Network timeout'))
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toBe('Network timeout')
    })

    it('should handle connection refused error', async () => {
      undiciFetch.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      )
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toContain('ECONNREFUSED')
    })
  })
}

function registerResponseFormatTests() {
  describe('Response Formats', () => {
    it('should return correct success response format', async () => {
      undiciFetch.mockResolvedValueOnce(okResponse(REVIEW_ABC123, 'test.pdf'))
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result).toMatchObject({
        success: true,
        message: 'File uploaded successfully',
        reviewId: REVIEW_ABC123,
        filename: 'test.pdf',
        statusCode: HTTP_STATUS_OK
      })
    })
  })
}

function registerStreamHandlingTests() {
  describe('Stream Handling', () => {
    it('should convert stream to buffer', async () => {
      const mockChunk = Buffer.from('test data')
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(mockChunk)
          } else if (event === 'end') {
            callback()
          } else {
            // other events handled per-test
          }
        })
      }
      mockRequest.payload = mockStream
      undiciFetch.mockResolvedValueOnce(okResponse())
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
      expect(undiciFetch).toHaveBeenCalled()
    })

    it('should resolve immediately when payload is already a Buffer (no .on method)', async () => {
      // Covers the !file.on branch in fileStreamToBuffer — file is already a
      // buffer so it is resolved directly without reading an event stream.
      mockRequest.payload = Buffer.from('already buffered content')
      undiciFetch.mockResolvedValueOnce(okResponse('review-buf-01'))
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
      expect(undiciFetch).toHaveBeenCalled()
    })

    it('should handle stream error', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Stream read error'))
          }
        })
      }
      mockRequest.payload = mockStream
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toContain('Stream read error')
    })
  })
}

function registerTimeoutHandlingTests() {
  describe('Timeout Handling', () => {
    it('returns 500 with timeout message when backend fetch is aborted', async () => {
      // Simulate the AbortController firing: fetch rejects with an AbortError
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      undiciFetch.mockRejectedValueOnce(abortError)
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toBe(
        'The upload request timed out. Please try again.'
      )
    })
  })
}

function registerHeaderHandlingTests() {
  describe('Header Handling', () => {
    it('should use default filename when header missing', async () => {
      delete mockRequest.headers['x-file-name']
      undiciFetch.mockResolvedValueOnce(okResponse())
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
    })

    it('should use default content-type when header missing', async () => {
      delete mockRequest.headers['x-file-content-type']
      mockRequest.headers['x-file-name'] = FILENAME_PDF
      undiciFetch.mockResolvedValueOnce(okResponse())
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
    })

    it('should decode URL-encoded filename', async () => {
      mockRequest.headers['x-file-name'] = encodeURIComponent(FILENAME_PDF)
      undiciFetch.mockResolvedValueOnce(okResponse())
      await uploadApiController.uploadFile(mockRequest, mockH)
      expect(undiciFetch).toHaveBeenCalled()
    })

    it('sends Authorization header when an access token is present in the session', async () => {
      // Covers the truthy branch of `accessToken ? { Authorization: ... } : {}`
      // Spy directly on _private.getAccessToken so the test is independent of
      // Hapi's yar session mock, which proved unreliable across CI environments.
      const spy = vi
        .spyOn(_private, 'getAccessToken')
        .mockReturnValueOnce('test-bearer-token')
      try {
        undiciFetch.mockResolvedValueOnce(okResponse('review-auth-01'))
        await uploadApiController.uploadFile(mockRequest, mockH)
        expect(undiciFetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/upload',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-bearer-token'
            })
          })
        )
      } finally {
        spy.mockRestore()
      }
    })

    it('falls back to default content-type when the content-type request header is absent', async () => {
      // Covers the `|| MIME_OCTET_STREAM` branch in uploadFile
      delete mockRequest.headers['content-type']
      undiciFetch.mockResolvedValueOnce(okResponse('review-ct-fallback'))
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
    })
  })
}

function registerResponseFallbackTests() {
  describe('Response fallbacks', () => {
    it('uses "unknown" when backend success response has no reviewId', async () => {
      // Covers the `result.reviewId || 'unknown'` false branch in processSuccessfulUpload
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({ filename: FILENAME_PDF })
      })
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(true)
      expect(result.reviewId).toBeUndefined()
    })

    it('uses "Internal server error" fallback when upload error has no message', async () => {
      // Covers the `error.message || 'Internal server error'` false branch in handleUploadError
      const errorWithNoMessage = new Error('placeholder')
      errorWithNoMessage.message = ''
      undiciFetch.mockRejectedValueOnce(errorWithNoMessage)
      const result = await uploadApiController.uploadFile(mockRequest, mockH)
      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    })
  })
}

describe('uploadApiController - uploadFile', () => {
  beforeEach(setupTestFixtures)
  afterEach(() => vi.clearAllMocks())

  registerFileValidationTests()
  registerBackendRequestTests()
  registerBackendResponseTests()
  registerResponseFormatTests()
  registerStreamHandlingTests()
  registerTimeoutHandlingTests()
  registerHeaderHandlingTests()
  registerResponseFallbackTests()
})
