import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// Import after mocks
import { uploadApiController } from './upload.js'
import { config } from '../../config/config.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'
import { readFile } from 'fs/promises'
import { fetch as undiciFetch } from 'undici'

// Mock dependencies
vi.mock('undici', () => {
  const mockAgent = class Agent {
    constructor(options) {
      this.keepAliveTimeout = options.keepAliveTimeout
      this.keepAliveMaxTimeout = options.keepAliveMaxTimeout
      this.connections = options.connections
    }
  }

  return {
    Agent: mockAgent,
    fetch: vi.fn()
  }
})

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'backendUrl') return 'http://localhost:3001'
      return null
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

vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('form-data', () => ({
  FormData: class FormData {
    constructor() {
      this.fields = []
    }
    append(name, value, filename) {
      this.fields.push({ name, value, filename })
    }
  }
}))

describe('uploadApiController - uploadFile', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock request
    mockRequest = {
      payload: {
        file: {
          path: '/tmp/upload-abc123.pdf',

          filename: 'document.pdf',
          headers: {
            'content-type': 'application/pdf'
          }
        }
      },
      headers: {
        'user-agent': 'Mozilla/5.0 Test Browser'
      },
      info: {
        remoteAddress: '127.0.0.1'
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    }

    // Create mock Hapi response toolkit
    mockH = {
      response: vi.fn(function (data) {
        return {
          ...data,
          code: vi.fn(function (statusCode) {
            this._statusCode = statusCode
            return this
          })
        }
      })
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('extractFileInfo - hapi multipart file structure', () => {
    it('should read filename from file.hapi.filename when present', async () => {
      // Hapi streams multipart uploads with a .hapi sub-object containing filename and headers.
      // extractFileInfo must fall through to file.hapi.filename when file.filename is absent.
      mockRequest.payload.file = {
        path: '/tmp/upload-hapi.pdf',
        hapi: {
          filename: 'hapi-document.pdf',
          headers: { 'content-type': 'application/pdf' }
        }
      }
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({ reviewId: 'review-hapi' })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
      // Confirm the hapi filename was used in the x-file-name header
      const call = undiciFetch.mock.calls[0]
      expect(call[1].headers['x-file-name']).toBe('hapi-document.pdf')
    })

    it('should read content-type from file.contentType fallback when headers are absent', async () => {
      // Covers the third branch: file?.contentType (when both hapi headers and headers
      // are absent). Extension-based validation still passes for .pdf.
      mockRequest.payload.file = {
        path: '/tmp/upload-alt.pdf',
        filename: 'alt-document.pdf',
        contentType: 'application/pdf'
        // no .headers, no .hapi
      }
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({ reviewId: 'review-alt' })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })
  })

  describe('File Presence Validation', () => {
    it('should accept request with valid file object', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          success: true,
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result._statusCode).toBe(200)
    })
  })

  describe('File Type Validation', () => {
    it('should accept PDF files', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
      expect(result.success).toBe(true)
    })

    it('should accept .doc files', async () => {
      mockRequest.payload.file.filename = 'document.doc'
      mockRequest.payload.file.headers['content-type'] = 'application/msword'

      readFile.mockResolvedValueOnce(Buffer.from('DOC content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should accept .docx files', async () => {
      mockRequest.payload.file.filename = 'document.docx'
      mockRequest.payload.file.headers['content-type'] =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      readFile.mockResolvedValueOnce(Buffer.from('DOCX content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should reject .exe files', async () => {
      mockRequest.payload.file.filename = 'malware.exe'
      mockRequest.payload.file.headers['content-type'] = 'application/exe'

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(400)
      expect(result.message).toContain('Invalid file type')
    })

    it('should reject .zip files', async () => {
      mockRequest.payload.file.filename = 'archive.zip'
      mockRequest.payload.file.headers['content-type'] = 'application/zip'

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(400)
    })

    it('should reject image files', async () => {
      mockRequest.payload.file.filename = 'photo.jpg'
      mockRequest.payload.file.headers['content-type'] = 'image/jpeg'

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(400)
    })

    it('should be case-insensitive for extension validation', async () => {
      mockRequest.payload.file.filename = 'document.PDF'
      mockRequest.payload.file.headers['content-type'] = 'application/pdf'

      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should validate extension before buffering file', async () => {
      mockRequest.payload.file.filename = 'notallowed.exe'
      mockRequest.payload.file.headers['content-type'] = 'application/exe'

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(readFile).not.toHaveBeenCalled()
    })

    it('should accept uppercase DOC extension', async () => {
      mockRequest.payload.file.filename = 'contract.DOC'
      mockRequest.payload.file.headers['content-type'] = 'application/msword'

      readFile.mockResolvedValueOnce(Buffer.from('DOC content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should accept uppercase DOCX extension', async () => {
      mockRequest.payload.file.filename = 'contract.DOCX'
      mockRequest.payload.file.headers['content-type'] =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      readFile.mockResolvedValueOnce(Buffer.from('DOCX content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should accept mixed case extensions', async () => {
      mockRequest.payload.file.filename = 'document.PdF'
      mockRequest.payload.file.headers['content-type'] = 'application/pdf'

      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should validate by MIME type if extension validation passes', async () => {
      mockRequest.payload.file.filename = 'document.pdf'
      mockRequest.payload.file.headers['content-type'] = 'application/pdf'

      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })
  })

  describe('File Size Validation', () => {
    it('should accept files under 10MB limit', async () => {
      const buffer = Buffer.alloc(5 * 1024 * 1024)
      readFile.mockResolvedValueOnce(buffer)
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
      expect(result.success).toBe(true)
    })

    it('should accept files at exactly 10MB', async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024)
      readFile.mockResolvedValueOnce(buffer)
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should reject files exceeding 10MB limit', async () => {
      const buffer = Buffer.alloc(11 * 1024 * 1024)
      readFile.mockResolvedValueOnce(buffer)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(400)
      expect(result.message).toContain('File too large')
      expect(result.message).toContain('10MB')
    })

    it('should include file size in error message', async () => {
      const buffer = Buffer.alloc(15 * 1024 * 1024)
      readFile.mockResolvedValueOnce(buffer)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.message).toContain(
        'File too large. Maximum size is 10MB. Your file is 15.00MB'
      )
    })

    it('should accept very small files (1 byte)', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('a'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should accept empty files (0 bytes)', async () => {
      readFile.mockResolvedValueOnce(Buffer.alloc(0))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })
  })

  describe('File Reading', () => {
    it('should read file from temporary path', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(readFile).toHaveBeenCalledWith('/tmp/upload-abc123.pdf')
    })

    it('should handle file read errors', async () => {
      readFile.mockRejectedValueOnce(
        new Error('ENOENT: no such file or directory')
      )

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toContain('ENOENT')
    })

    it('should handle permission denied errors', async () => {
      readFile.mockRejectedValueOnce(new Error('EACCES: permission denied'))

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toContain('EACCES')
    })

    it('should handle timeout on file read', async () => {
      readFile.mockRejectedValueOnce(new Error('ETIMEDOUT'))

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })

    it('should read file only once', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(readFile).toHaveBeenCalledTimes(1)
    })

    it('should handle EISDIR error (directory instead of file)', async () => {
      readFile.mockRejectedValueOnce(
        new Error('EISDIR: illegal operation on a directory')
      )

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toContain('EISDIR')
    })
  })

  describe('Backend Communication', () => {
    it('should send file to backend with correct endpoint', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(undiciFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/upload',
        expect.any(Object)
      )
    })

    it('should use POST method for backend request', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].method).toBe('POST')
    })

    it('should include x-file-name header', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].headers['x-file-name']).toBe('document.pdf')
    })

    it('should URL encode filename in header', async () => {
      mockRequest.payload.file.filename = 'contract 2024!.pdf'
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].headers['x-file-name']).toBe('contract%202024!.pdf')
    })

    it('should include x-user-id header when user is identified', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].headers['x-user-id']).toBe('user-123')
      expect(getUserIdentifier).toHaveBeenCalledWith(mockRequest)
    })

    it('should omit x-user-id header when no user identified', async () => {
      getUserIdentifier.mockReturnValueOnce(null)
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].headers['x-user-id']).toBeUndefined()
    })

    it('should use keep-alive agent for connection pooling', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].dispatcher).toBeDefined()
    })

    it('should send file content in FormData', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].body).toBeDefined()
    })

    it('should handle successful backend response (200)', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-456',
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result._statusCode).toBe(200)
      expect(result.message).toBe('File uploaded successfully')
      expect(result.reviewId).toBe('review-456')
      expect(result.filename).toBe('document.pdf')
    })

    it('should handle backend error response (400)', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValueOnce({
          message: 'Invalid file format'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toBe('Invalid file format')
    })

    it('should handle backend error response (500)', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValueOnce({
          message: 'Backend processing failed'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toBe('Backend processing failed')
    })

    it('should use default error message when backend response is not JSON', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toBe('Failed to upload file to backend')
    })

    it('should use default error message when backend has no error message', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValueOnce({})
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Failed to upload file to backend')
    })

    it('should handle 413 Payload Too Large from backend', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        json: vi.fn().mockResolvedValueOnce({
          message: 'Request entity too large'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toBe('Request entity too large')
    })

    it('should handle 503 Service Unavailable from backend', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: vi.fn().mockResolvedValueOnce({
          message: 'Backend service unavailable'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })

    it('should handle 204 No Content from backend', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: vi.fn().mockRejectedValueOnce(new Error('No content'))
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })
  })

  describe('Network Error Handling', () => {
    it('should handle request timeout', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockRejectedValueOnce(new Error('Request timeout'))

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toContain('Request timeout')
    })

    it('should handle connection refused error', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      const error = new Error('ECONNREFUSED')
      error.code = 'ECONNREFUSED'
      undiciFetch.mockRejectedValueOnce(error)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toContain('ECONNREFUSED')
    })

    it('should handle DNS resolution errors', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      const error = new Error('getaddrinfo ENOTFOUND backend-service')
      error.code = 'ENOTFOUND'
      undiciFetch.mockRejectedValueOnce(error)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })

    it('should handle generic network errors', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toContain('Network error')
    })

    it('should handle connection reset during upload', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      const error = new Error('Connection reset by peer')
      error.code = 'ECONNRESET'
      undiciFetch.mockRejectedValueOnce(error)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })

    it('should handle broken pipe error', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      const error = new Error('EPIPE: broken pipe')
      error.code = 'EPIPE'
      undiciFetch.mockRejectedValueOnce(error)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })
  })

  describe('Response Format', () => {
    it('should return response with success flag', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
      expect(result).toHaveProperty('_statusCode')
    })

    it('should include reviewId in successful response', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-456'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.reviewId).toBe('review-456')
    })

    it('should include filename in successful response', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
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

      expect(result.filename).toBe('document.pdf')
    })

    it('should set 200 status code for successful upload', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should set 400 status code for validation errors', async () => {
      mockRequest.payload.file = null

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(400)
    })

    it('should set 500 status code for server errors', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockRejectedValueOnce(new Error('Server error'))

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(500)
    })

    it('should return proper message format for success', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.message).toBe('File uploaded successfully')
    })

    it('should return proper error message format', async () => {
      mockRequest.payload.file = null

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.message).toBe('No file provided')
    })

    it('should handle response with missing reviewId', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          filename: 'document.pdf'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.reviewId).toBeUndefined()
    })

    it('should handle response with missing filename', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result.filename).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle filename with spaces', async () => {
      mockRequest.payload.file.filename = 'my document.pdf'
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
      expect(undiciFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-file-name': 'my%20document.pdf'
          })
        })
      )
    })

    it('should handle filename with special characters', async () => {
      mockRequest.payload.file.filename = 'contract_2024!@#$.pdf'
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should handle very long filenames', async () => {
      mockRequest.payload.file.filename = 'a'.repeat(255) + '.pdf'
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should handle filename with unicode characters', async () => {
      mockRequest.payload.file.filename = 'документ.pdf'
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should handle missing user agent header', async () => {
      delete mockRequest.headers['user-agent']
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should handle missing client IP', async () => {
      mockRequest.info = {}
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should handle filename with multiple dots', async () => {
      mockRequest.payload.file.filename = 'document.backup.2024.pdf'
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result._statusCode).toBe(200)
    })

    it('should handle path traversal attempt in filename', async () => {
      mockRequest.payload.file.filename = '../../../etc/passwd.pdf'

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
    })

    it('should handle error object without message property', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      const errorObj = new Error()
      errorObj.message = undefined
      undiciFetch.mockRejectedValueOnce(errorObj)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
      expect(result.message).toBe('Internal server error')
    })

    it('should handle null error in catch block', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockRejectedValueOnce(null)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })

    it('should handle Promise rejection with string error message', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockRejectedValueOnce('String error message')

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(500)
    })
  })

  describe('Integration - Full Upload Flow', () => {
    it('should not read file if type validation fails early', async () => {
      mockRequest.payload.file.filename = 'notallowed.exe'
      mockRequest.payload.file.headers['content-type'] = 'application/exe'

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(readFile).not.toHaveBeenCalled()
      expect(undiciFetch).not.toHaveBeenCalled()
    })

    it('should not send to backend if size validation fails', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024)
      readFile.mockResolvedValueOnce(largeBuffer)

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(undiciFetch).not.toHaveBeenCalled()
    })
  })

  describe('User Identification', () => {
    it('should include empty user ID when getUserIdentifier returns empty string', async () => {
      getUserIdentifier.mockReturnValueOnce('')
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].headers['x-user-id']).toBeUndefined()
    })

    it('should include user ID when getUserIdentifier returns value', async () => {
      getUserIdentifier.mockReturnValueOnce('user-456')
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].headers['x-user-id']).toBe('user-456')
    })
  })

  describe('Backend Configuration', () => {
    it('should use backend URL from config', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(config.get).toHaveBeenCalledWith('backendUrl')
      expect(undiciFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/upload',
        expect.any(Object)
      )
    })
  })

  describe('FormData Construction', () => {
    it('should append file to FormData with correct field name', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].body).toBeDefined()
      expect(call[1].method).toBe('POST')
    })
  })

  describe('Error Recovery', () => {
    it('should recover from malformed backend response JSON', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockRejectedValueOnce(new SyntaxError('Unexpected token'))
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Failed to upload file to backend')
    })
  })

  describe('Keep-Alive Agent', () => {
    it('should use keep-alive dispatcher for backend request', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].dispatcher).toBeDefined()
      expect(call[1].dispatcher).toHaveProperty('keepAliveTimeout')
      expect(call[1].dispatcher).toHaveProperty('keepAliveMaxTimeout')
      expect(call[1].dispatcher).toHaveProperty('connections')
    })

    it('should configure keep-alive with correct timeout values', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      await uploadApiController.uploadFile(mockRequest, mockH)

      const call = undiciFetch.mock.calls[0]
      expect(call[1].dispatcher.keepAliveTimeout).toBe(30000)
      expect(call[1].dispatcher.keepAliveMaxTimeout).toBe(300000)
      expect(call[1].dispatcher.connections).toBe(5)
    })
  })

  describe('Slow Network Scenarios', () => {
    it('should handle slow backend response', async () => {
      readFile.mockResolvedValueOnce(Buffer.from('PDF content'))

      undiciFetch.mockImplementationOnce(() => {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: vi.fn().mockResolvedValueOnce({
                  reviewId: 'review-123'
                })
              }),
            50
          )
        )
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result._statusCode).toBe(200)
    })

    it('should handle slow file read', async () => {
      readFile.mockImplementationOnce(() => {
        return new Promise((resolve) =>
          setTimeout(() => resolve(Buffer.from('PDF content')), 50)
        )
      })
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result._statusCode).toBe(200)
    })

    it('should complete even with multiple slow operations', async () => {
      readFile.mockImplementationOnce(() => {
        return new Promise((resolve) =>
          setTimeout(() => resolve(Buffer.from('PDF content')), 25)
        )
      })

      undiciFetch.mockImplementationOnce(() => {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: vi.fn().mockResolvedValueOnce({
                  reviewId: 'review-123'
                })
              }),
            25
          )
        )
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result._statusCode).toBe(200)
    })
  })

  describe('Validation Order', () => {
    it('should perform validation in correct order', async () => {
      mockRequest.payload.file = null

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(readFile).not.toHaveBeenCalled()
    })

    it('should validate type before buffering', async () => {
      mockRequest.payload.file.filename = 'malware.exe'
      mockRequest.payload.file.headers['content-type'] = 'application/exe'

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(readFile).not.toHaveBeenCalled()
      expect(undiciFetch).not.toHaveBeenCalled()
    })

    it('should validate size after buffering but before sending', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024)
      readFile.mockResolvedValueOnce(largeBuffer)

      await uploadApiController.uploadFile(mockRequest, mockH)

      expect(readFile).toHaveBeenCalled()
      expect(undiciFetch).not.toHaveBeenCalled()
    })
  })

  describe('File Size Boundary Tests', () => {
    it('should handle file exactly 1 byte under limit', async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024 - 1)
      readFile.mockResolvedValueOnce(buffer)
      undiciFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValueOnce({
          reviewId: 'review-123'
        })
      })

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(true)
      expect(result._statusCode).toBe(200)
    })

    it('should handle file exactly 1 byte over limit', async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024 + 1)
      readFile.mockResolvedValueOnce(buffer)

      const result = await uploadApiController.uploadFile(mockRequest, mockH)

      expect(result.success).toBe(false)
      expect(result._statusCode).toBe(400)
    })
  })
})
