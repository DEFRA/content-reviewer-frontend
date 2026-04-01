import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchUrlController } from './fetch-url.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500

// Helper to build a minimal Hapi-style request / response toolkit pair
function buildRequestAndH(url) {
  const responses = []
  const h = {
    response: vi.fn((body) => {
      const chain = {
        _body: body,
        _code: HTTP_STATUS_OK,
        _type: 'application/json',
        code(c) {
          this._code = c
          return this
        },
        type(t) {
          this._type = t
          return this
        }
      }
      responses.push(chain)
      return chain
    }),
    lastResponse: () => responses.at(-1)
  }
  const request = { query: { url } }
  return { request, h }
}

describe('fetchUrlController - invalid / missing URLs', () => {
  it('should return 400 when no url query param is supplied', async () => {
    const { request, h } = buildRequestAndH(undefined)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(result._body.success).toBe(false)
  })

  it('should return 400 for a non-gov.uk URL', async () => {
    const { request, h } = buildRequestAndH('https://example.com/page')
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(result._body.success).toBe(false)
  })

  it('should return 400 for a completely invalid URL string', async () => {
    const { request, h } = buildRequestAndH('not-a-url')
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(HTTP_STATUS_BAD_REQUEST)
  })
})

describe('fetchUrlController - valid gov.uk URLs', () => {
  const GOVUK_URL = 'https://www.gov.uk/test-page'
  const MOCK_HTML =
    '<html><body><div data-module="govspeak">Content</div></body></html>'

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_HTML)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return 200 with HTML body for a valid gov.uk URL', async () => {
    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(HTTP_STATUS_OK)
    expect(result._body).toBe(MOCK_HTML)
    expect(result._type).toBe('text/html')
  })

  it('should call fetch with a browser-like Accept header and Chrome User-Agent', async () => {
    const { request, h } = buildRequestAndH(GOVUK_URL)
    await fetchUrlController.handler(request, h)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      GOVUK_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('text/html'),
          'User-Agent': expect.stringContaining('Chrome')
        })
      })
    )
  })

  it('should return 500 when the upstream fetch fails (after retries)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))
    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    expect(result._body.success).toBe(false)
    // Retries up to FETCH_MAX_RETRIES times (3 total attempts)
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('should return 500 when upstream responds with a 5xx status (after retries)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    // 5xx triggers retries
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('should return 500 immediately (no retry) when upstream responds with 4xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    // 4xx is not retried — only 1 attempt
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('fetchUrlController - upstream error message variants', () => {
  const GOVUK_URL = 'https://www.gov.uk/test-page'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return timeout message when fetch is aborted (AbortError)', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    globalThis.fetch = vi.fn().mockRejectedValue(abortError)

    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)

    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    expect(result._body.message).toContain('timed out')
  })

  it('should return 404-specific message when upstream returns 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })

    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)

    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    expect(result._body.message).toContain('could not be found')
  })

  it('should return 403-specific message when upstream returns 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 })

    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)

    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    expect(result._body.message).toContain('denied')
  })

  it('should return generic 4xx message when upstream returns a non-404/403 4xx status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })

    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)

    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    expect(result._body.message).toContain('returned an error')
  })
})

describe('fetchUrlController - setTimeout abort arrow function', () => {
  const GOVUK_URL = 'https://www.gov.uk/test-page'

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should abort the fetch via controller.abort() when the 30s timeout fires', async () => {
    vi.useFakeTimers()

    // fetch hangs until the signal is aborted (timeout fires → controller.abort())
    globalThis.fetch = vi.fn((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })

    const { request, h } = buildRequestAndH(GOVUK_URL)
    const handlerPromise = fetchUrlController.handler(request, h)

    // Advance past FETCH_TIMEOUT_MS (30_000ms) for all 3 attempts
    await vi.advanceTimersByTimeAsync(30_001 * 3)

    const result = await handlerPromise
    expect(result._code).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    expect(result._body.message).toContain('timed out')
  })
})
