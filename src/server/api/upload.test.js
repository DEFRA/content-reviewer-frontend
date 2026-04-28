import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { uploadApiController } from './upload.js'

import { fetch as undiciFetch } from 'undici'

// Test constants to avoid magic strings and numbers
const BACKEND_URL = 'http://localhost:3001'
const TEST_REVIEW_ID = 'review-123'
const TEST_USER_ID = 'user-123'
const TEST_FILENAME = 'document.pdf'
const SERVICE_FALLBACK_USER_ID = 'content-reviewer-frontend'
const HTTP_STATUS_OK = 200
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500

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
        backendUrl: BACKEND_URL
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
  getUserIdentifier: vi.fn(() => TEST_USER_ID)
}))

vi.mock('../common/helpers/service-token-helper.js', () => ({
  getServiceTokenHeaders: vi.fn(() => ({
    'x-service-token': 'test-token',
    'x-timestamp': '1234567890'
  }))
}))

function makeStream(chunks) {
  return {
    on: vi.fn((event, callback) => {
      if (event === 'data') {
        chunks.forEach((chunk) => callback(chunk))
      } else if (event === 'end') {
        callback()
      } else {
        // no-op for other stream events (e.g. 'error' not triggered here)
      }
    })
  }
}

function makeErrorStream(error) {
  return {
    on: vi.fn((event, callback) => {
      if (event === 'error') {
        callback(error)
      } else {
        // no-op for data/end events not triggered on an error stream
      }
    })
  }
}

function makeSuccessResponse(overrides = {}) {
  return {
    ok: true,
    status: HTTP_STATUS_OK,
    json: vi.fn().mockResolvedValueOnce({
      reviewId: TEST_REVIEW_ID,
      filename: TEST_FILENAME,
      ...overrides
    })
  }
}

function makeErrorResponse(status, message) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValueOnce({ message })
  }
}

describe('uploadApiController - uploadFile', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: makeStream([Buffer.from('PDF file content')]),
      headers: {
        'content-type': 'application/octet-stream',
        'x-file-name': TEST_FILENAME,
        'x-file-content-type': 'application/pdf',
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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('File Validation', () => {
    it('should accept valid PDF file', async () => {
      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(HTTP_STATUS_OK)
      expect(result.message).toBe('File uploaded successfully')
      expect(result.reviewId).toBe(TEST_REVIEW_ID)
    })

    it('should accept valid DOCX file', async () => {
      mockRequest.headers['x-file-name'] = 'document.docx'
      mockRequest.headers['x-file-content-type'] =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-456',
          filename: 'document.docx'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(HTTP_STATUS_OK)
    })

    it('should accept valid DOC file', async () => {
      mockRequest.headers['x-file-name'] = 'document.doc'
      mockRequest.headers['x-file-content-type'] = 'application/msword'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-789',
          filename: 'document.doc'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(HTTP_STATUS_OK)
    })

    it('should validate by extension when MIME type is unrecognized', async () => {
      mockRequest.headers['x-file-name'] = TEST_FILENAME
      mockRequest.headers['x-file-content-type'] = 'application/unknown'

      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should handle filename with special characters', async () => {
      mockRequest.headers['x-file-name'] = 'document-2024_v1.2.pdf'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: TEST_REVIEW_ID,
          filename: 'document-2024_v1.2.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should handle filename with Unicode characters', async () => {
      mockRequest.headers['x-file-name'] = encodeURIComponent('документ.pdf')

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: TEST_REVIEW_ID,
          filename: 'документ.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })
  })

  describe('Backend Integration', () => {
    it('should send file to backend with correct headers', async () => {
      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(undiciFetch).toHaveBeenCalledWith(
        `${BACKEND_URL}/api/upload`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/octet-stream',
            'x-file-name': TEST_FILENAME,
            'x-file-content-type': 'application/pdf',
            'x-user-id': TEST_USER_ID
          })
        })
      )
    })

    it('should encode filename in header', async () => {
      mockRequest.headers['x-file-name'] = encodeURIComponent(
        'my file with spaces.pdf'
      )

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: TEST_REVIEW_ID,
          filename: 'my file with spaces.pdf'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-file-name']).toBe(
        'my%20file%20with%20spaces.pdf'
      )
    })

    it('should use userId when available', async () => {
      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      await uploadApiController.uploadFile(mockRequest, mockH)

      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-user-id']).toBe(TEST_USER_ID)
    })

    it('should use fallback userId when not available', async () => {
      const { getUserIdentifier } =
        await import('../common/helpers/get-user-identifier.js')
      vi.mocked(getUserIdentifier).mockReturnValue(null)

      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      await uploadApiController.uploadFile(mockRequest, mockH)

      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-user-id']).toBe(SERVICE_FALLBACK_USER_ID)
    })

    it('should handle successful backend response', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-abc123',
          filename: TEST_FILENAME
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.reviewId).toBe('review-abc123')
      expect(result.filename).toBe(TEST_FILENAME)
    })

    it('should handle backend error response', async () => {
      undiciFetch.mockResolvedValueOnce(
        makeErrorResponse(
          HTTP_STATUS_INTERNAL_SERVER_ERROR,
          'Backend processing error'
        )
      )

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toBe('Backend processing error')
    })

    it('should handle backend response with non-JSON body', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
      })

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

  describe('Response Formats', () => {
    it('should return correct success response format', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: HTTP_STATUS_OK,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-abc123',
          filename: 'test.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result).toMatchObject({
        success: true,
        message: 'File uploaded successfully',
        reviewId: 'review-abc123',
        filename: 'test.pdf',
        statusCode: HTTP_STATUS_OK
      })
    })
  })

  describe('Stream Handling', () => {
    it('should convert stream to buffer', async () => {
      mockRequest.payload = makeStream([Buffer.from('test data')])

      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(undiciFetch).toHaveBeenCalled()
    })

    it('should handle stream error', async () => {
      mockRequest.payload = makeErrorStream(new Error('Stream read error'))

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(result.message).toContain('Stream read error')
    })
  })

  describe('Header Handling', () => {
    it('should use default filename when header missing', async () => {
      delete mockRequest.headers['x-file-name']

      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should use default content-type when header missing', async () => {
      delete mockRequest.headers['x-file-content-type']
      mockRequest.headers['x-file-name'] = TEST_FILENAME

      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should decode URL-encoded filename', async () => {
      mockRequest.headers['x-file-name'] = encodeURIComponent(TEST_FILENAME)

      undiciFetch.mockResolvedValueOnce(makeSuccessResponse())

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(undiciFetch).toHaveBeenCalled()
    })
  })
})
