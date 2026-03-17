/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseGovUkUrl,
  extractGovspeakText,
  parseGovspeakFromHtml
} from './url-extractor.js'

const GOVUK_URL = 'https://www.gov.uk/test-page'
const NON_GOVUK_URL = 'https://example.com/page'
const INVALID_URL = 'not-a-url'

describe('upload/url-extractor - parseGovUkUrl', () => {
  it('should return a URL object for a valid gov.uk URL', () => {
    const result = parseGovUkUrl(GOVUK_URL)
    expect(result).toBeInstanceOf(URL)
    expect(result.hostname).toBe('www.gov.uk')
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
})

describe('upload/url-extractor - parseGovspeakFromHtml', () => {
  it('should extract text from govspeak divs', () => {
    const html = `
      <html><body>
        <header>Header content</header>
        <div data-module="govspeak">First govspeak block</div>
        <div data-module="govspeak">Second govspeak block</div>
        <footer>Footer content</footer>
      </body></html>
    `
    const result = parseGovspeakFromHtml(html)
    expect(result).toContain('First govspeak block')
    expect(result).toContain('Second govspeak block')
  })

  it('should not include header or footer text', () => {
    const html = `
      <html><body>
        <header>Should be removed</header>
        <div data-module="govspeak">Keep this</div>
        <footer>Should be removed</footer>
      </body></html>
    `
    const result = parseGovspeakFromHtml(html)
    expect(result).not.toContain('Should be removed')
    expect(result).toContain('Keep this')
  })

  it('should return empty string when no govspeak divs exist', () => {
    const html = '<html><body><p>No govspeak here</p></body></html>'
    const result = parseGovspeakFromHtml(html)
    expect(result).toBe('')
  })

  it('should join multiple govspeak blocks with double newline', () => {
    const html = `
      <html><body>
        <div data-module="govspeak">Block one</div>
        <div data-module="govspeak">Block two</div>
      </body></html>
    `
    const result = parseGovspeakFromHtml(html)
    expect(result).toBe('Block one\n\nBlock two')
  })

  it('should ignore empty govspeak divs', () => {
    const html = `
      <html><body>
        <div data-module="govspeak">  </div>
        <div data-module="govspeak">Real content</div>
      </body></html>
    `
    const result = parseGovspeakFromHtml(html)
    expect(result).toBe('Real content')
  })
})

describe('upload/url-extractor - extractGovspeakText', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should call the proxy endpoint and return extracted govspeak text', async () => {
    const mockHtml = `
      <html><body>
        <div data-module="govspeak">Fetched content</div>
      </body></html>
    `
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml)
    })

    const result = await extractGovspeakText(GOVUK_URL)
    expect(result).toContain('Fetched content')
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
