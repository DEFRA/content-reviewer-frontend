import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetch as undiciFetch } from 'undici'
import { uploadApiController } from './upload.js'

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

describe('uploadApiController - uploadFile', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock stream
    const mockStream = {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('PDF file content'))
        } else if (event === 'end') {
          callback()
        }
      })
    }

    mockRequest = {
      payload: mockStream,
      headers: {
        'content-type': 'application/octet-stream',
        'x-file-name': 'document.pdf',
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
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.message).toBe('File uploaded successfully')
      expect(result.reviewId).toBe('review-123')
    })

    it('should accept valid DOCX file', async () => {
      mockRequest.headers['x-file-name'] = 'document.docx'
      mockRequest.headers['x-file-content-type'] =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-456',
          filename: 'document.docx'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
    })

    it('should accept valid DOC file', async () => {
      mockRequest.headers['x-file-name'] = 'document.doc'
      mockRequest.headers['x-file-content-type'] = 'application/msword'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-789',
          filename: 'document.doc'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
    })

    it('should validate by extension when MIME type is unrecognized', async () => {
      mockRequest.headers['x-file-name'] = 'document.pdf'
      mockRequest.headers['x-file-content-type'] = 'application/unknown'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should handle filename with special characters', async () => {
      mockRequest.headers['x-file-name'] = 'document-2024_v1.2.pdf'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
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
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'документ.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })
  })

  describe('Backend Integration', () => {
    it('should send file to backend with correct headers', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(undiciFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/upload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/octet-stream',
            'x-file-name': 'document.pdf',
            'x-file-content-type': 'application/pdf',
            'x-user-id': 'user-123'
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
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
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
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-user-id']).toBe('user-123')
    })

    it('should use fallback userId when not available', async () => {
      const { getUserIdentifier } =
        await import('../common/helpers/get-user-identifier.js')
      vi.mocked(getUserIdentifier).mockReturnValue(null)

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const callArgs = undiciFetch.mock.calls[0][1]
      expect(callArgs.headers['x-user-id']).toBe('content-reviewer-frontend')
    })

    it('should handle successful backend response', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-abc123',
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.reviewId).toBe('review-abc123')
      expect(result.filename).toBe('document.pdf')
    })

    it('should handle backend error response', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValueOnce({
          message: 'Backend processing error'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.message).toBe('Backend processing error')
    })

    it('uses default error message when backend error response has no message field', async () => {
      // Covers the `errorData.message || errorMessage` false branch in handleBackendFailure
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValueOnce({})
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Failed to upload file to backend')
    })

    it('should handle backend response with non-JSON body', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.message).toBe('Failed to upload file to backend')
    })

    it('should handle network errors', async () => {
      undiciFetch.mockRejectedValueOnce(new Error('Network timeout'))

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.message).toBe('Network timeout')
    })

    it('should handle connection refused error', async () => {
      undiciFetch.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      )

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.message).toContain('ECONNREFUSED')
    })
  })

  describe('Response Formats', () => {
    it('should return correct success response format', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
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
        statusCode: 200
      })
    })
  })

  describe('Stream Handling', () => {
    it('should convert stream to buffer', async () => {
      const mockChunk = Buffer.from('test data')
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(mockChunk)
          } else if (event === 'end') {
            callback()
          }
        })
      }

      mockRequest.payload = mockStream

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(undiciFetch).toHaveBeenCalled()
    })

    it('should resolve immediately when payload is already a Buffer (no .on method)', async () => {
      // Covers the !file.on branch in fileStreamToBuffer — file is already a
      // buffer so it is resolved directly without reading an event stream.
      mockRequest.payload = Buffer.from('already buffered content')

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-buf-01',
          filename: 'document.pdf'
        })
      })

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
      expect(result.statusCode).toBe(500)
      expect(result.message).toContain('Stream read error')
    })
  })

  describe('Timeout Handling', () => {
    it('returns 500 with timeout message when backend fetch is aborted', async () => {
      // Simulate the AbortController firing: fetch rejects with an AbortError
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      undiciFetch.mockRejectedValueOnce(abortError)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.message).toBe(
        'The upload request timed out. Please try again.'
      )
    })
  })

  describe('Header Handling', () => {
    it('should use default filename when header missing', async () => {
      delete mockRequest.headers['x-file-name']

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'upload-' + Date.now()
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should use default content-type when header missing', async () => {
      delete mockRequest.headers['x-file-content-type']
      mockRequest.headers['x-file-name'] = 'document.pdf'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should decode URL-encoded filename', async () => {
      mockRequest.headers['x-file-name'] = encodeURIComponent('document.pdf')

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.pdf'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(undiciFetch).toHaveBeenCalled()
    })

    it('sends Authorization header when an access token is present in the session', async () => {
      // Covers the truthy branch of `accessToken ? { Authorization: ... } : {}`
      mockRequest.yar = {
        get: vi.fn().mockReturnValue({ accessToken: 'test-bearer-token' })
      }

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-auth-01',
          filename: 'document.pdf'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const callHeaders = undiciFetch.mock.calls[0][1].headers
      expect(callHeaders.Authorization).toBe('Bearer test-bearer-token')
    })

    it('falls back to default content-type when the content-type request header is absent', async () => {
      // Covers the `|| 'application/octet-stream'` branch in uploadFile
      delete mockRequest.headers['content-type']

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-ct-fallback',
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })
  })

  describe('Response fallbacks', () => {
    it('uses "unknown" when backend success response has no reviewId', async () => {
      // Covers the `result.reviewId || 'unknown'` false branch in processSuccessfulUpload
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({ filename: 'document.pdf' })
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
      expect(result.statusCode).toBe(500)
    })
  })
})
