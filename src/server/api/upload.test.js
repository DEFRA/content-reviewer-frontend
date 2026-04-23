import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { uploadApiController } from './upload.js'
import { config } from '../../config/config.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { fetch as undiciFetch } from 'undici'

// Mock FormData globally
global.FormData = class FormData {
  constructor() {
    this.fields = new Map()
  }

  append(name, value, options) {
    this.fields.set(name, { value, options })
  }

  getHeaders() {
    return {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary'
    }
  }

  *[Symbol.iterator]() {
    yield* this.fields.entries()
  }
}

// Mock dependencies
vi.mock('undici', () => ({
  Agent: vi.fn(function (options) {
    this.keepAliveTimeout = options.keepAliveTimeout
    this.keepAliveMaxTimeout = options.keepAliveMaxTimeout
    this.connections = options.connections
  }),
  fetch: vi.fn()
}))

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

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

vi.mock('../common/helpers/get-user-identifier.js', () => ({
  getUserIdentifier: vi.fn((request) => 'user-123')
}))

describe('uploadApiController - uploadFile', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    // Mock file object that behaves like a stream/blob
    const mockFile = {
      hapi: {
        filename: 'document.pdf',
        headers: {
          'content-type': 'application/pdf'
        }
      },
      // Make it iterable/readable for FormData
      [Symbol.toStringTag]: 'File',
      // Simulate Blob-like behavior
      toString: () => '[File]'
    }

    // Mock request with file from Hapi
    mockRequest = {
      payload: {
        file: mockFile
      },
      headers: {
        'user-agent': 'Mozilla/5.0 Test Browser'
      },
      info: {
        remoteAddress: '127.0.0.1'
      }
    }

    // Mock Hapi response toolkit
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

    // Mock getUserIdentifier
    vi.mocked(getUserIdentifier).mockReturnValue('user-123')

    // Mock logger
    vi.mocked(createLogger).mockReturnValue(mockLogger)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('File Validation', () => {
    it('should accept valid PDF file', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
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
      mockRequest.payload.file.hapi.filename = 'document.docx'
      mockRequest.payload.file.hapi.headers['content-type'] =
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
      mockRequest.payload.file.hapi.filename = 'document.doc'
      mockRequest.payload.file.hapi.headers['content-type'] =
        'application/msword'

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

    it('should reject .exe files', async () => {
      mockRequest.payload.file.hapi.filename = 'malware.exe'
      mockRequest.payload.file.hapi.headers['content-type'] =
        'application/x-msdownload'

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.message).toContain('Invalid file type')
    })

    it('should reject files with invalid MIME type', async () => {
      mockRequest.payload.file.hapi.headers['content-type'] = 'image/png'
      mockRequest.payload.file.hapi.filename = 'image.png'

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.message).toContain('Invalid file type')
    })

    it('should accept case-insensitive extensions', async () => {
      mockRequest.payload.file.hapi.filename = 'document.PDF'

      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123',
          filename: 'document.PDF'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
    })

    it('should validate by extension when MIME type is missing', async () => {
      mockRequest.payload.file.hapi.headers['content-type'] = ''
      mockRequest.payload.file.hapi.filename = 'document.pdf'

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
  })

  describe('File Size Validation', () => {
    it('should accept files under 10MB', async () => {
      mockRequest.payload.file.hapi.filename = 'document.pdf'
      mockRequest.payload.file.hapi.headers['content-type'] = 'application/pdf'
      mockRequest.payload.file.bytes = 5 * 1024 * 1024 // 5MB

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

    it('should accept files exactly 10MB', async () => {
      mockRequest.payload.file.bytes = 10 * 1024 * 1024

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
  })

  describe('File Presence Validation', () => {
    it('should reject when no file is provided', async () => {
      mockRequest.payload.file = null

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.message).toBe('No file provided')
    })

    it('should reject when payload is missing', async () => {
      mockRequest.payload = {}

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.message).toBe('No file provided')
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
            'x-file-name': 'document.pdf',
            'x-user-id': 'user-123'
          })
        })
      )
    })

    it('should encode filename in header', async () => {
      mockRequest.payload.file.hapi.filename = 'my file with spaces.pdf'

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

    it('should use keepAliveAgent dispatcher', async () => {
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
      expect(callArgs.dispatcher).toBeDefined()
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

    it('should handle backend non-OK response', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValueOnce({
          message: 'Backend processing error'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.message).toBe('Backend processing error')
    })

    it('should handle backend response with non-JSON body', async () => {
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
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

  describe('Edge Cases', () => {
    it('should handle filename with special characters', async () => {
      mockRequest.payload.file.hapi.filename = 'document-2024_v1.2.pdf'
      mockRequest.payload.file = {
        hapi: {
          filename: 'document-2024_v1.2.pdf',
          headers: {
            'content-type': ''
          }
        }
      }

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
      mockRequest.payload.file = {
        hapi: {
          filename: 'документ.pdf',
          headers: {
            'content-type': ''
          }
        }
      }

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

    it('should handle file without extension', async () => {
      mockRequest.payload.file = {
        hapi: {
          filename: 'document',
          headers: {
            'content-type': ''
          }
        }
      }

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid file type')
    })

    it('should handle missing content-type header', async () => {
      mockRequest.payload.file.hapi.headers['content-type'] = ''
      mockRequest.payload.file.hapi.filename = 'document.pdf'

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

    it('should use userId when available', async () => {
      vi.mocked(getUserIdentifier).mockReturnValue('user-456')

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
      expect(callArgs.headers['x-user-id']).toBe('user-456')
    })

    it('should omit x-user-id header when userId is undefined', async () => {
      vi.mocked(getUserIdentifier).mockReturnValue(undefined)

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
      expect(callArgs.headers['x-user-id']).toBeUndefined()
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

    it('should return correct error response format', async () => {
      mockRequest.payload.file = null

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result).toMatchObject({
        success: false,
        message: 'No file provided',
        statusCode: 400
      })
    })
  })
})
