import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { uploadApiController } from './upload.js'

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
  getUserIdentifier: vi.fn(() => 'user-123')
}))

const undici = await import('undici')
const undiciFetch = undici.fetch

function makeMockH() {
  return {
    response: vi.fn((data) => {
      return {
        ...data,
        code: (statusCode) => ({ ...data, statusCode })
      }
    })
  }
}

function createStreamEmitter({ chunks = ['a', 'b'], throwError = null } = {}) {
  const handlers = {}
  return {
    on: vi.fn((event, cb) => {
      handlers[event] = cb
      // immediately invoke for test simplicity
      if (event === 'data' && Array.isArray(chunks)) {
        chunks.forEach((c) => cb(Buffer.from(c)))
      }
      if (event === 'end' && !throwError) {
        cb()
      }
      if (event === 'error' && throwError) {
        cb(new Error(throwError))
      }
    })
  }
}

describe('uploadApiController.uploadFile', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()
    mockH = makeMockH()

    mockRequest = {
      payload: createStreamEmitter(),
      headers: {
        'content-type': 'application/octet-stream',
        'x-file-name': 'document.pdf',
        'x-file-content-type': 'application/pdf',
        'user-agent': 'vitest'
      },
      info: {
        remoteAddress: '127.0.0.1'
      }
    }

    // default successful backend upload + upload-status polling
    undiciFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValueOnce({
        reviewId: 'review-123',
        filename: 'document.pdf'
      })
    })
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ status: 'completed' })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    // restore global.fetch if needed
    delete global.fetch
  })

  it('should convert stream to buffer and return success', async () => {
    const result = await uploadApiController.uploadFile(mockRequest, mockH)

    expect(result.success).toBe(true)
    expect(result.reviewId).toBe('review-123')
    expect(result.filename).toBe('document.pdf')
    expect(undiciFetch).toHaveBeenCalled()
    const callOpts = undiciFetch.mock.calls[0][1]
    expect(callOpts.method).toBe('POST')
    expect(callOpts.headers['x-file-name']).toBe(encodeURIComponent('document.pdf'))
    // body should be a Buffer or Uint8Array-like
    expect(callOpts.body).toBeDefined()
    expect(typeof callOpts.body.length).toBe('number')
  })

  it('should send correct headers to backend', async () => {
    await uploadApiController.uploadFile(mockRequest, mockH)
    const [, opts] = undiciFetch.mock.calls[0]
    expect(opts.headers['content-type']).toBe('application/octet-stream')
    expect(opts.headers['x-file-content-type']).toBe('application/pdf')
    expect(opts.headers['x-user-id']).toBe('user-123')
  })

  it('should handle stream error and return failure', async () => {
    const errorStreamRequest = {
      ...mockRequest,
      payload: createStreamEmitter({ throwError: 'stream-failed' })
    }
    // undiciFetch shouldn't be called in this case; ensure it's not set up
    const result = await uploadApiController.uploadFile(errorStreamRequest, mockH)
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/File stream error/i)
  })
})