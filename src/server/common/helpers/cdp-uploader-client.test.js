import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock config before module import
const ALLOWED_MIME_TYPES = ['application/pdf']
const TEST_S3_BUCKET = 'test-bucket'

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        'cdpUploader.url': 'http://localhost:7337',
        'cdpUploader.s3Bucket': TEST_S3_BUCKET,
        'cdpUploader.s3Path': 'test-path/',
        'cdpUploader.maxFileSize': 10000000,
        'cdpUploader.allowedMimeTypes': ALLOWED_MIME_TYPES
      }
      return values[key]
    })
  }
}))

// Mock undici fetch
vi.mock('undici', () => ({
  fetch: vi.fn()
}))

const REDIRECT_URL = 'http://redirect.url'
const CALLBACK_URL = 'http://callback.url'
const POLL_MAX_ATTEMPTS = 5
const POLL_INTERVAL_MS = 100
let fetch
let initiateUpload
let getUploadStatus
let pollUploadStatus

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()

  const undici = await import('undici')
  fetch = undici.fetch

  const module = await import('./cdp-uploader-client.js')
  initiateUpload = module.initiateUpload
  getUploadStatus = module.getUploadStatus
  pollUploadStatus = module.pollUploadStatus
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── initiateUpload ──────────────────────────────────────────────────────────

// ─── initiateUpload ──────────────────────────────────────────────────────────

// Split 'initiateUpload' tests into two smaller describe blocks

describe('initiateUpload - success cases', () => {
  it('should POST to /initiate and return response data on success', async () => {
    const mockData = { uploadId: 'abc123', url: 'http://upload.url' }
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData)
    })
    const result = await initiateUpload({
      redirect: REDIRECT_URL,
      callback: CALLBACK_URL,
      metadata: { userId: '42' }
    })

    const calledBody = JSON.parse(fetch.mock.calls[0][1].body)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:7337/initiate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'User-Agent': 'content-reviewer-frontend'
        }),
        body: expect.any(String)
      })
    )
    expect(calledBody.s3Bucket).toBe(TEST_S3_BUCKET)
    expect(calledBody.callback).toBe(CALLBACK_URL)
    expect(result).toEqual(mockData)
  })

  it('should include callback in payload when provided', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    })

    await initiateUpload({
      redirect: REDIRECT_URL,
      callback: CALLBACK_URL
    })

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.callback).toBe(CALLBACK_URL)
  })

  it('should NOT include callback in payload when not provided', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    })
    await initiateUpload({ redirect: REDIRECT_URL })

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('callback')
  })

  it('should use empty object as default metadata', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    })

    await initiateUpload({ redirect: REDIRECT_URL })

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.metadata).toEqual({})
  })

  it('should include all config values in the payload', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    })

    await initiateUpload({ redirect: 'http://redirect.url' })

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.s3Bucket).toBe(TEST_S3_BUCKET)
    expect(body.mimeTypes).toEqual(ALLOWED_MIME_TYPES)
    expect(body.maxFileSize).toBe(10000000)
  })

  describe('initiateUpload - error cases', () => {
    it('should throw an error when response is not ok', async () => {
      fetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('Invalid payload')
      })
      await expect(initiateUpload({ redirect: REDIRECT_URL })).rejects.toThrow(
        'Failed to initiate upload: Bad Request - Invalid payload'
      )
    })

    // ─── getUploadStatus ─────────────────────────────────────────────────────────

    const UPLOAD_ID = 'upload-123'

    describe('getUploadStatus', () => {
      const S3_DETAILS_LABEL = 'S3 DETAILS:'

      it('should GET /status/:uploadId and return status data', async () => {
        const mockStatus = { uploadStatus: 'ready', form: {} }
        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockStatus)
        })

        const result = await getUploadStatus(UPLOAD_ID)

        expect(fetch).toHaveBeenCalledWith(
          'http://localhost:7337/status/upload-123',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'User-Agent': 'content-reviewer-frontend'
            })
          })
        )
        expect(result).toEqual(mockStatus)
      })

      it('should append debug=true query param when debug is true', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ uploadStatus: 'ready' })
        })
        await getUploadStatus(UPLOAD_ID, true)

        const calledUrl = fetch.mock.calls[0][0]
        expect(calledUrl).toContain('debug=true')
      })

      it('should NOT append debug param when debug is false (default)', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ uploadStatus: 'ready' })
        })

        await getUploadStatus(UPLOAD_ID)

        const calledUrl = fetch.mock.calls[0][0]
        expect(calledUrl).not.toContain('debug')
      })

      it('should throw when response is not ok', async () => {
        fetch.mockResolvedValue({
          ok: false,
          statusText: 'Not Found'
        })

        await expect(getUploadStatus('bad-id')).rejects.toThrow(
          'Failed to get upload status: Not Found'
        )
      })

      it('should log S3 details when s3Bucket is present in response', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const mockStatus = {
          uploadStatus: 'ready',
          form: {
            file: {
              s3Bucket: 'my-bucket',
              s3Key: 'my-key',
              filename: 'doc.pdf',
              detectedContentType: 'application/pdf'
            }
          }
        }

        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockStatus)
        })

        await getUploadStatus(UPLOAD_ID)

        expect(consoleSpy).toHaveBeenCalledWith(S3_DETAILS_LABEL)
        expect(consoleSpy).toHaveBeenCalledWith('- S3 Bucket:', 'my-bucket')
        expect(consoleSpy).toHaveBeenCalledWith('- S3 Key:', 'my-key')
        expect(consoleSpy).toHaveBeenCalledWith('- Filename:', 'doc.pdf')
        expect(consoleSpy).toHaveBeenCalledWith(
          '- Content Type:',
          'application/pdf'
        )
      })

      it('should log S3 details when s3Key is present (but no s3Bucket)', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const mockStatus = {
          uploadStatus: 'ready',
          form: { file: { s3Key: 'my-key' } }
        }

        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockStatus)
        })

        await getUploadStatus(UPLOAD_ID)

        expect(consoleSpy).toHaveBeenCalledWith(S3_DETAILS_LABEL)
        expect(consoleSpy).toHaveBeenCalledWith('- S3 Bucket:', 'NOT SET')
        expect(consoleSpy).toHaveBeenCalledWith('- S3 Key:', 'my-key')
        expect(consoleSpy).toHaveBeenCalledWith('- Filename:', 'NOT SET')
        expect(consoleSpy).toHaveBeenCalledWith('- Content Type:', 'NOT SET')
      })

      it('should NOT log S3 details when neither s3Bucket nor s3Key is present', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ uploadStatus: 'ready', form: {} })
        })

        await getUploadStatus(UPLOAD_ID)

        expect(consoleSpy).not.toHaveBeenCalledWith(S3_DETAILS_LABEL)
      })
    })

    describe('pollUploadStatus', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should return immediately when status is "ready"', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ uploadStatus: 'ready' })
        })

        const result = await pollUploadStatus(
          UPLOAD_ID,
          POLL_MAX_ATTEMPTS,
          POLL_INTERVAL_MS
        )

        expect(result).toEqual({ uploadStatus: 'ready' })
        expect(fetch).toHaveBeenCalledTimes(1)
      })

      it('should return immediately when status is "rejected"', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ uploadStatus: 'rejected' })
        })

        const result = await pollUploadStatus(UPLOAD_ID, POLL_MAX_ATTEMPTS, 100)

        expect(result).toEqual({ uploadStatus: 'rejected' })
        expect(fetch).toHaveBeenCalledTimes(1)
      })

      it('should poll multiple times until status is ready', async () => {
        const POLL_ATTEMPTS_UNTIL_READY = 3
        fetch
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ uploadStatus: 'pending' })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ uploadStatus: 'pending' })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ uploadStatus: 'ready' })
          })

        const pollPromise = pollUploadStatus(UPLOAD_ID, POLL_MAX_ATTEMPTS, 100)

        // Advance timers for each pending poll interval
        await vi.runAllTimersAsync()

        const result = await pollPromise
        expect(result).toEqual({ uploadStatus: 'ready' })
        expect(fetch).toHaveBeenCalledTimes(POLL_ATTEMPTS_UNTIL_READY)
      })

      it('should throw timeout error when maxAttempts is exceeded', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ uploadStatus: 'pending' })
        })

        const MAX_ATTEMPTS = 3
        const pollPromise = pollUploadStatus(UPLOAD_ID, MAX_ATTEMPTS, 100)
        const rejectExpectation = expect(pollPromise).rejects.toThrow(
          'Upload status polling timeout'
        )

        await vi.runAllTimersAsync()
        await rejectExpectation

        expect(fetch).toHaveBeenCalledTimes(MAX_ATTEMPTS)
      })
    })
  })
})
