import { describe, it, expect, beforeEach, vi } from 'vitest'
import { urlReviewController } from './url-review.js'

const BACKEND_URL = 'http://localhost:4000'
const TEST_URL = 'https://www.gov.uk/guidance/test-page'
const PARSED_URL = new URL(TEST_URL)

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => (key === 'backendUrl' ? BACKEND_URL : null))
  }
}))

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }))
}))

vi.mock('../common/helpers/get-user-identifier.js', () => ({
  getUserIdentifier: vi.fn(() => 'user-abc')
}))

const { fetchGovUkHtmlMock, parseAllowedUrlMock } = vi.hoisted(() => ({
  fetchGovUkHtmlMock: vi.fn(),
  parseAllowedUrlMock: vi.fn()
}))

vi.mock('./fetch-url.js', () => ({
  fetchGovUkHtml: fetchGovUkHtmlMock,
  parseAllowedUrl: parseAllowedUrlMock
}))

vi.mock('undici', () => ({ Agent: Object }))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGovUkHtml(bodyText, h1 = 'Test Page Title') {
  return `<html><head></head><body>
    <h1 class="gem-c-title__text">${h1}</h1>
    <div data-module="govspeak">${bodyText}</div>
  </body></html>`
}

// Wrap arbitrary body HTML in a minimal HTML document for tests that use custom markup.
function withEnvMeta(bodyHtml) {
  return `<html><head></head><body>${bodyHtml}</body></html>`
}

// Returns a resolved fetchGovUkHtml mock value with the standard shape { html, finalUrl }
function mockFetchHtml(html, finalUrl = TEST_URL) {
  return { html, finalUrl }
}

// 300 chars of plain text — well above the 200-char minimum
const SUFFICIENT_TEXT = 'Content for review. '.repeat(15)
const VALID_HTML = makeGovUkHtml(SUFFICIENT_TEXT)

function createRequest(urlValue = TEST_URL) {
  return {
    payload: { url: urlValue },
    auth: { credentials: { user: { id: 'user-abc' } } },
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  }
}

function createH() {
  const responseMock = { code: vi.fn().mockReturnThis() }
  return { response: vi.fn(() => responseMock), _mock: responseMock }
}

function mockBackendSuccess(reviewId = 'rev-001') {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: vi.fn().mockResolvedValueOnce({ reviewId })
  })
}

// ── handler: URL validation ───────────────────────────────────────────────────

describe('urlReviewController.handler - invalid URL', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(null)
  })

  it('returns 400 when URL is rejected by parseAllowedUrl', async () => {
    const h = createH()
    await urlReviewController.handler(createRequest('https://example.com'), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Invalid or non-gov.uk URL'
      })
    )
    expect(h._mock.code).toHaveBeenCalledWith(400)
  })
})

// ── handler: GOV.UK fetch failure ─────────────────────────────────────────────

describe('urlReviewController.handler - GOV.UK fetch failure', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(PARSED_URL)
  })

  it('returns 500 when fetchGovUkHtml rejects', async () => {
    fetchGovUkHtmlMock.mockRejectedValue(new Error('Network failure'))
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
    expect(h._mock.code).toHaveBeenCalledWith(500)
  })
})

// ── handler: redirect check ───────────────────────────────────────────────────

describe('urlReviewController.handler - redirect check', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(PARSED_URL)
  })

  it('returns 400 when fetch redirects to a non-gov.uk URL', async () => {
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(VALID_HTML, 'https://www.external-site.com/page')
    )
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('redirected')
      })
    )
    expect(h._mock.code).toHaveBeenCalledWith(400)
  })

  it('continues normally when fetch stays within www.gov.uk', async () => {
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(
        VALID_HTML,
        'https://www.gov.uk/guidance/test-page-redirected'
      )
    )
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h._mock.code).toHaveBeenCalledWith(200)
  })

  it('allows through when finalUrl is missing (edge case)', async () => {
    // Pass null directly — mockFetchHtml(VALID_HTML, undefined) would trigger
    // the default parameter and resolve to TEST_URL instead of a falsy value.
    fetchGovUkHtmlMock.mockResolvedValue({ html: VALID_HTML, finalUrl: null })
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h._mock.code).toHaveBeenCalledWith(200)
  })

  it('allows through when finalUrl is an unparseable string', async () => {
    // Covers the catch branch in checkRedirectTarget: new URL('://bad') throws,
    // the catch returns {} (allow through) rather than a 400 error response.
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(VALID_HTML, '://not-a-valid-url')
    )
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h._mock.code).toHaveBeenCalledWith(200)
  })
})

// ── handler: content extraction failures ─────────────────────────────────────

describe('urlReviewController.handler - content extraction failures', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(PARSED_URL)
  })

  it('returns 400 when no content selectors match the page', async () => {
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(withEnvMeta('<p>No matching content</p>'))
    )
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
    expect(h._mock.code).toHaveBeenCalledWith(400)
  })

  it('returns 400 when extracted text is below the minimum useful length', async () => {
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(makeGovUkHtml('Too short'))
    )
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h._mock.code).toHaveBeenCalledWith(400)
  })

  it('returns 400 when extracted text exceeds MAX_EXTRACTED_CHARS', async () => {
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(makeGovUkHtml('a'.repeat(110_000)))
    )
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h._mock.code).toHaveBeenCalledWith(400)
  })
})

// ── handler: successful flow ──────────────────────────────────────────────────

describe('urlReviewController.handler - successful submission', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(PARSED_URL)
    fetchGovUkHtmlMock.mockResolvedValue(mockFetchHtml(VALID_HTML))
  })

  it('returns 200 with reviewId on successful backend response', async () => {
    mockBackendSuccess('rev-xyz')
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'URL content submitted for review',
        reviewId: 'rev-xyz'
      })
    )
    expect(h._mock.code).toHaveBeenCalledWith(200)
  })

  it('includes x-user-id header when userId is present', async () => {
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_URL}/api/review/text`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-user-id': 'user-abc' })
      })
    )
  })

  it('omits x-user-id header when getUserIdentifier returns null', async () => {
    const { getUserIdentifier } =
      await import('../common/helpers/get-user-identifier.js')
    getUserIdentifier.mockReturnValueOnce(null)
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({ 'x-user-id': expect.anything() })
      })
    )
  })

  it('uses sourceUrl as title when no H1 is found in the page', async () => {
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(
        withEnvMeta(`<div data-module="govspeak">${SUFFICIENT_TEXT}</div>`)
      )
    )
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    // When rawTitle is absent, extractContent sets title = sourceUrl;
    // finalTitle falls back to that truthy value rather than the slug.html
    expect(body.title).toBe(TEST_URL)
  })

  it('uses gem-c-heading__text H1 as title when gem-c-title__text is absent', async () => {
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(
        withEnvMeta(`
        <h1 class="gem-c-heading__text">HMRC Manual Page</h1>
        <div data-module="govspeak">${SUFFICIENT_TEXT}</div>
      `)
      )
    )
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.title).toBe('HMRC Manual Page')
  })

  it('returns 500 when backend returns a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Failed to submit content to the review service'
      })
    )
    expect(h._mock.code).toHaveBeenCalledWith(500)
  })

  it('returns 500 with error message when backend fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Connection refused'))
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Connection refused' })
    )
    expect(h._mock.code).toHaveBeenCalledWith(500)
  })

  it('uses "Internal server error" fallback when backend error has no message', async () => {
    const err = new Error()
    err.message = ''
    fetchMock.mockRejectedValueOnce(err)
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' })
    )
  })

  it('returns 500 with timeout message when the backend fetch is aborted', async () => {
    // Simulate the AbortController firing: fetch rejects with an AbortError
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(abortError)
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'The request timed out. Please try again.'
      })
    )
    expect(h._mock.code).toHaveBeenCalledWith(500)
  })
})

// ── mapFetchError branches ────────────────────────────────────────────────────

describe('urlReviewController.handler - mapFetchError branches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(PARSED_URL)
  })

  async function fetchErrorMessage(error) {
    fetchGovUkHtmlMock.mockRejectedValue(error)
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    return h.response.mock.calls[0][0].message
  }

  it('returns timeout message for AbortError', async () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    expect(await fetchErrorMessage(err)).toContain('timed out')
  })

  it('returns CDN message for Fastly CDN error 200', async () => {
    expect(
      await fetchErrorMessage(new Error('Fastly CDN error 200'))
    ).toContain('CDN')
  })

  it('returns not-found message for HTTP 404 status', async () => {
    expect(await fetchErrorMessage(new Error('HTTP 404 Not Found'))).toContain(
      'could not be found'
    )
  })

  it('returns forbidden message for HTTP 403 status', async () => {
    expect(await fetchErrorMessage(new Error('HTTP 403 Forbidden'))).toContain(
      'denied'
    )
  })

  it('returns client-error message for other 4xx status', async () => {
    expect(
      await fetchErrorMessage(new Error('HTTP 422 Unprocessable Entity'))
    ).toContain('returned an error')
  })

  it('returns generic message for unknown error', async () => {
    expect(
      await fetchErrorMessage(new Error('Something unexpected happened'))
    ).toContain('Could not retrieve')
  })
})

// ── convertLinksToMarkdown via content extraction ─────────────────────────────

describe('urlReviewController.handler - link conversion in extracted HTML', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(PARSED_URL)
  })

  async function getSubmittedContent(bodyHtml) {
    fetchGovUkHtmlMock.mockResolvedValue(mockFetchHtml(makeGovUkHtml(bodyHtml)))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId: 'rev-links' })
    })
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    return JSON.parse(fetchMock.mock.calls[0][1].body).content
  }

  it('converts relative hrefs to absolute GOV.UK URLs', async () => {
    const content = await getSubmittedContent(
      `<a href="/some/path">Read more</a>${'x'.repeat(200)}`
    )
    expect(content).toContain('[Read more](https://www.gov.uk/some/path)')
  })

  it('keeps only the text for hash-only hrefs', async () => {
    const content = await getSubmittedContent(
      `<a href="#section">Jump to section</a>${'x'.repeat(200)}`
    )
    expect(content).toContain('Jump to section')
    expect(content).not.toContain('[Jump to section](')
  })

  it('replaces empty-text anchors with an empty string', async () => {
    const content = await getSubmittedContent(
      `<a href="/path"></a>${'x'.repeat(200)}`
    )
    expect(content).not.toContain('href')
  })

  it('keeps original href when URL construction throws', async () => {
    const content = await getSubmittedContent(
      `<a href="://invalid">Bad link</a>${'x'.repeat(200)}`
    )
    expect(content).toContain('Bad link')
  })

  it('keeps an already-absolute href without re-resolving it', async () => {
    // Covers the false branch of if (!/^https?:\/\//i.test(href)) at line 112
    const content = await getSubmittedContent(
      `<a href="https://www.gov.uk/absolute-path">Absolute link</a>${'x'.repeat(200)}`
    )
    expect(content).toContain(
      '[Absolute link](https://www.gov.uk/absolute-path)'
    )
  })
})

// ── overlap detection in extractContent ──────────────────────────────────────

describe('urlReviewController.handler - overlap detection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    parseAllowedUrlMock.mockReturnValue(PARSED_URL)
  })

  it('skips a matched element whose text is whitespace-only', async () => {
    // Covers the true branch of if (!text) at line 169:
    // first govspeak div has only whitespace → text.trim() = '' → skipped
    // second govspeak div has real content → contributes to sections → 200 returned
    fetchGovUkHtmlMock.mockResolvedValue(
      mockFetchHtml(
        withEnvMeta(`
        <div data-module="govspeak">   </div>
        <div data-module="govspeak">${SUFFICIENT_TEXT}</div>
      `)
      )
    )
    mockBackendSuccess()
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h._mock.code).toHaveBeenCalledWith(200)
  })

  it('skips ancestor elements already covered by a matched descendant', async () => {
    // .gem-c-lead-paragraph (selector index 3) is matched before
    // div[data-module="govspeak"] (index 5). When the govspeak div is processed
    // the overlap check detects it contains the already-matched lead paragraph
    // and skips it, so no content is duplicated.
    const html = withEnvMeta(`
      <div data-module="govspeak">
        <div class="gem-c-lead-paragraph">${SUFFICIENT_TEXT}</div>
      </div>
    `)
    fetchGovUkHtmlMock.mockResolvedValue(mockFetchHtml(html))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ reviewId: 'rev-overlap' })
    })
    const h = createH()
    await urlReviewController.handler(createRequest(), h)
    expect(h._mock.code).toHaveBeenCalledWith(200)
  })
})
