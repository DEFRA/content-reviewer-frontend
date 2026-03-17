import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchUrlController } from './fetch-url.js'

// Helper to build a minimal Hapi-style request / response toolkit pair
function buildRequestAndH(url) {
  const responses = []
  const h = {
    response: vi.fn((body) => {
      const chain = {
        _body: body,
        _code: 200,
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
    lastResponse: () => responses[responses.length - 1]
  }
  const request = { query: { url } }
  return { request, h }
}

describe('fetchUrlController - invalid / missing URLs', () => {
  it('should return 400 when no url query param is supplied', async () => {
    const { request, h } = buildRequestAndH(undefined)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(400)
    expect(result._body.success).toBe(false)
  })

  it('should return 400 for a non-gov.uk URL', async () => {
    const { request, h } = buildRequestAndH('https://example.com/page')
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(400)
    expect(result._body.success).toBe(false)
  })

  it('should return 400 for a completely invalid URL string', async () => {
    const { request, h } = buildRequestAndH('not-a-url')
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(400)
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
    expect(result._code).toBe(200)
    expect(result._body).toBe(MOCK_HTML)
    expect(result._type).toBe('text/html')
  })

  it('should call fetch with the validated URL', async () => {
    const { request, h } = buildRequestAndH(GOVUK_URL)
    await fetchUrlController.handler(request, h)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      GOVUK_URL,
      expect.objectContaining({ headers: { Accept: 'text/html' } })
    )
  })

  it('should return 500 when the upstream fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))
    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(500)
    expect(result._body.success).toBe(false)
  })

  it('should return 500 when upstream responds with a non-ok status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    const { request, h } = buildRequestAndH(GOVUK_URL)
    const result = await fetchUrlController.handler(request, h)
    expect(result._code).toBe(500)
  })
})
