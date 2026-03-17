/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseGovUkUrl,
  extractGovspeakText,
  buildExtractedHtml
} from './url-extractor.js'

const GOVUK_URL = 'https://www.gov.uk/test-page'
const NON_GOVUK_URL = 'https://example.com/page'
const INVALID_URL = 'not-a-url'
const MAX_EXTRACTED_CHARS = 100_000
const GOVUK_HOSTNAME = 'www.gov.uk'

describe('upload/url-extractor - parseGovUkUrl', () => {
  it('should return a URL object for a valid gov.uk URL', () => {
    const result = parseGovUkUrl(GOVUK_URL)
    expect(result).toBeInstanceOf(URL)
    expect(result.hostname).toBe(GOVUK_HOSTNAME)
  })

  it('should return null for a non-gov.uk URL', () => {
    const result = parseGovUkUrl(NON_GOVUK_URL)
    expect(result).toBeNull()
  })

  it('should return null for a completely invalid URL string', () => {
    const result = parseGovUkUrl(INVALID_URL)
    expect(result).toBeNull()
  })

  it('should return null for an empty string', () => {
    const result = parseGovUkUrl('')
    expect(result).toBeNull()
  })

  it('should accept gov.uk URLs with paths and query strings', () => {
    const result = parseGovUkUrl(
      'https://www.gov.uk/guidance/some-page?ref=123'
    )
    expect(result).toBeInstanceOf(URL)
  })

  it('should accept the root https://www.gov.uk/ URL', () => {
    const result = parseGovUkUrl('https://www.gov.uk/')
    expect(result).toBeInstanceOf(URL)
    expect(result.hostname).toBe(GOVUK_HOSTNAME)
  })

  it('should accept https://www.gov.uk without trailing slash', () => {
    const result = parseGovUkUrl('https://www.gov.uk')
    expect(result).toBeInstanceOf(URL)
    expect(result.hostname).toBe(GOVUK_HOSTNAME)
  })

  it('should return null for a URL with gov.uk in the path but wrong hostname', () => {
    const result = parseGovUkUrl('https://example.com/gov.uk/page')
    expect(result).toBeNull()
  })
})

describe('upload/url-extractor - buildExtractedHtml content extraction', () => {
  it('should extract content from div[data-module="govspeak"]', () => {
    const html = `
      <html><body>
        <header>Header content</header>
        <div data-module="govspeak"><p>Govspeak content</p></div>
        <footer>Footer content</footer>
      </body></html>
    `
    const result = buildExtractedHtml(html, GOVUK_URL)
    expect(result).toContain('Govspeak content')
  })

  it('should extract content from .govuk-grid-column-two-thirds selector', () => {
    const html = `
      <html><body>
        <div class="govuk-grid-column-two-thirds"><p>Main column content</p></div>
      </body></html>
    `
    const result = buildExtractedHtml(html, GOVUK_URL)
    expect(result).toContain('Main column content')
  })

  it('should not include header or footer content', () => {
    const html = `
      <html><body>
        <header>Should be removed</header>
        <div data-module="govspeak"><p>Keep this</p></div>
        <footer>Should be removed</footer>
      </body></html>
    `
    const result = buildExtractedHtml(html, GOVUK_URL)
    expect(result).not.toContain('Should be removed')
    expect(result).toContain('Keep this')
  })

  it('should skip selectors that are absent without throwing', () => {
    const html = `
      <html><body>
        <div data-module="govspeak"><p>Only govspeak present</p></div>
      </body></html>
    `
    expect(() => buildExtractedHtml(html, GOVUK_URL)).not.toThrow()
    const result = buildExtractedHtml(html, GOVUK_URL)
    expect(result).toContain('Only govspeak present')
  })
})

describe('upload/url-extractor - buildExtractedHtml output format and limits', () => {
  it('should return a valid HTML document string', () => {
    const html = `
      <html><body>
        <div data-module="govspeak"><p>Content</p></div>
      </body></html>
    `
    const result = buildExtractedHtml(html, GOVUK_URL)
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<html')
    expect(result).toContain('</html>')
  })

  it('should embed the source URL as a meta tag', () => {
    const html = `
      <html><body>
        <div data-module="govspeak"><p>Content</p></div>
      </body></html>
    `
    const result = buildExtractedHtml(html, GOVUK_URL)
    expect(result).toContain(GOVUK_URL)
  })

  it('should throw when extracted text exceeds the maximum character limit', () => {
    const longText = 'a'.repeat(MAX_EXTRACTED_CHARS + 1)
    const html = `
      <html><body>
        <div data-module="govspeak"><p>${longText}</p></div>
      </body></html>
    `
    expect(() => buildExtractedHtml(html, GOVUK_URL)).toThrow(
      /Extracted text is too long\. Maximum 100000 characters\. The webpage has \d+ characters/
    )
  })

  it('should not throw when extracted text is exactly the maximum character limit', () => {
    const exactText = 'a'.repeat(MAX_EXTRACTED_CHARS)
    const html = `
      <html><body>
        <div data-module="govspeak"><p>${exactText}</p></div>
      </body></html>
    `
    expect(() => buildExtractedHtml(html, GOVUK_URL)).not.toThrow()
  })
})

describe('upload/url-extractor - extractGovspeakText', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should call the proxy endpoint and return extracted HTML string', async () => {
    const mockHtml = `
      <html><body>
        <div data-module="govspeak"><p>Fetched content</p></div>
      </body></html>
    `
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml)
    })

    const result = await extractGovspeakText(GOVUK_URL)
    expect(result).toContain('Fetched content')
    expect(result).toContain('<!DOCTYPE html>')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/fetch-url?url=${encodeURIComponent(GOVUK_URL)}`
    )
  })

  it('should throw when the proxy response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    })

    await expect(extractGovspeakText(GOVUK_URL)).rejects.toThrow(
      'Proxy fetch failed: 500'
    )
  })

  it('should throw when fetch itself rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(extractGovspeakText(GOVUK_URL)).rejects.toThrow(
      'Network error'
    )
  })
})
