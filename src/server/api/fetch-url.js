import { createLogger } from '../common/helpers/logging/logger.js'
import { config } from '../../config/config.js'

const logger = createLogger()

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
}

const ALLOWED_HOSTNAME = 'www.gov.uk'
// Hard timeout (ms) on each GOV.UK upstream fetch. Sourced from `fetch.timeoutMs`
// (FETCH_TIMEOUT_MS) — set in cdp-app-config per environment.
const FETCH_TIMEOUT_MS = config.get('fetch.timeoutMs')
const FETCH_MAX_RETRIES = 2
const FASTLY_ERROR_SNIPPET_CHARS = 300

/**
 * Browser-like headers sent with every GOV.UK proxy request.
 * GOV.UK pages are served via Fastly CDN which inspects request headers.
 * A minimal but realistic browser profile avoids bot-challenge pages and
 * 403/503 responses that would otherwise prevent content extraction.
 */
const GOVUK_FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache'
}

/**
 * Validates and normalises the supplied URL string.
 * Returns the parsed (normalised) URL on success, or null on any failure.
 *
 * Checks applied (in order):
 *  1. Non-empty string and well-formed URL syntax (new URL() must not throw).
 *  2. Scheme must be http or https — rejects javascript:, data:, ftp: etc.
 *  3. No embedded credentials (user:password@host) to prevent SSRF confusion.
 *  4. Hostname must be www.gov.uk.
 *  5. Path is normalised to lower-case so /Guidance/Foo and /guidance/foo
 *     are treated as identical (GOV.UK itself redirects upper-case paths).
 *
 * @param {string} urlString
 * @returns {URL|null}
 */
export function parseAllowedUrl(urlString) {
  if (!urlString) {
    return null
  }
  let parsed
  try {
    parsed = new URL(urlString)
  } catch {
    // Check 1: URL syntax is invalid
    return null
  }
  // Check 2: Only http and https schemes are accepted
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }
  // Check 2 (extended): Reject URLs with embedded credentials
  if (parsed.username || parsed.password) {
    return null
  }
  // Check 4 (hostname): Must be the GOV.UK domain
  if (parsed.hostname !== ALLOWED_HOSTNAME) {
    return null
  }
  // Check 3: Normalise path to lower-case — GOV.UK redirects /Guidance/Foo
  // to /guidance/foo; normalising early prevents duplicate review entries.
  parsed.pathname = parsed.pathname.toLowerCase()
  return parsed
}

/**
 * Detects whether the HTML body is a Fastly CDN error or challenge page
 * rather than the real GOV.UK page content.  Fastly returns these with HTTP
 * 200 so the status check alone is not sufficient.
 * @param {string} html
 * @returns {boolean}
 */
function isFastlyErrorPage(html) {
  // Fastly error pages include a distinctive title and reference to varnish/Fastly
  return (
    /<title>[^<]*fastly error[^<]*<\/title>/i.test(html) ||
    /fastly error\s*:/i.test(html) ||
    (/x-varnish/i.test(html) && /error/i.test(html) && html.length < 10_000)
  )
}

/**
 * Logs Fastly CDN response headers when present, to aid diagnosis of
 * CDN-related failures (cache state, edge node, cache hit/miss).
 * @param {URL} parsedUrl
 * @param {number} attempt
 * @param {Object} fastlyDiagnostics
 */
function logFastlyHeaders(parsedUrl, attempt, fastlyDiagnostics) {
  if (
    fastlyDiagnostics.xServedBy ||
    fastlyDiagnostics.xCache ||
    fastlyDiagnostics.via
  ) {
    logger.info(
      { url: parsedUrl.toString(), attempt, fastlyDiagnostics },
      'fetch-url: Fastly CDN response headers received'
    )
  }
}

/**
 * Fetches the HTML for a validated gov.uk URL server-side, avoiding CORS.
 * Retries up to FETCH_MAX_RETRIES times on transient 5xx / network errors.
 * Logs Fastly CDN response headers to aid diagnosis of CDN-related failures.
 * @param {URL} parsedUrl
 * @returns {Promise<string>}
 */
export async function fetchGovUkHtml(parsedUrl) {
  let lastError
  for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: GOVUK_FETCH_HEADERS
      })

      // Log Fastly CDN response headers on every attempt for diagnostics.
      // These headers reveal whether Fastly served the content from cache,
      // which edge node handled the request, and whether it was a cache hit.
      const fastlyDiagnostics = {
        xServedBy: response.headers?.get('x-served-by'),
        xCache: response.headers?.get('x-cache'),
        xCacheHits: response.headers?.get('x-cache-hits'),
        via: response.headers?.get('via'),
        xVarnish: response.headers?.get('x-varnish')
      }
      logFastlyHeaders(parsedUrl, attempt, fastlyDiagnostics)

      if (!response.ok) {
        throw new Error(`Upstream responded with ${response.status}`)
      }

      const html = await response.text()

      // Fastly sometimes returns a branded error page with HTTP 200 instead
      // of a proper error status.  Detect and surface these explicitly so the
      // user receives a meaningful message rather than an "unsupported layout"
      // error from the content extractor.
      if (isFastlyErrorPage(html)) {
        logger.warn(
          {
            url: parsedUrl.toString(),
            attempt,
            fastlyDiagnostics,
            htmlSnippet: html.substring(0, FASTLY_ERROR_SNIPPET_CHARS)
          },
          'fetch-url: Fastly CDN error page detected in 200 response body'
        )
        throw new Error('Fastly CDN error 200')
      }

      // Check 4: expose the final URL after any HTTP redirects so the caller
      // can verify the chain stayed within www.gov.uk.
      return { html, finalUrl: response.url }
    } catch (err) {
      lastError = err
      if (err.name === 'AbortError') {
        logger.warn(
          { url: parsedUrl.toString(), attempt, timeoutMs: FETCH_TIMEOUT_MS },
          `[TIMEOUT] fetch-url: GOV.UK fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s (attempt ${attempt + 1})`
        )
      } else {
        logger.warn(
          { err, url: parsedUrl.toString(), attempt },
          `fetch-url: attempt ${attempt + 1} failed`
        )
      }
      // Only retry on network errors or 5xx; don't retry 4xx (client error)
      const status = Number(err.message?.match(/\d{3}/)?.[0])
      if (
        status >= HTTP_STATUS.BAD_REQUEST &&
        status < HTTP_STATUS.INTERNAL_SERVER_ERROR
      ) {
        break
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

/**
 * GET /api/fetch-url?url=<gov.uk URL>
 * Server-side proxy: fetches the HTML from a validated gov.uk URL and returns
 * it as plain text so the client can parse govspeak content without CORS errors.
 */
export const fetchUrlController = {
  async handler(request, h) {
    const { url } = request.query

    const parsedUrl = parseAllowedUrl(url)
    if (!parsedUrl) {
      logger.warn({ url }, 'fetch-url: rejected invalid or non-gov.uk URL')
      return h
        .response({ success: false, message: 'Invalid or non-gov.uk URL' })
        .code(HTTP_STATUS.BAD_REQUEST)
    }

    logger.info({ url: parsedUrl.toString() }, 'fetch-url: proxying request')

    const fetchStart = performance.now()
    try {
      const { html } = await fetchGovUkHtml(parsedUrl)
      const fetchDuration = Math.round(performance.now() - fetchStart)
      logger.info(
        { url: parsedUrl.toString(), durationMs: fetchDuration },
        `[RESPONSE TIME] fetch-url: GOV.UK page fetched in ${fetchDuration}ms`
      )
      return h.response(html).code(HTTP_STATUS.OK).type('text/html')
    } catch (error) {
      logger.error(
        { err: error, url, message: error.message },
        'fetch-url: upstream fetch failed after retries'
      )
      const upstreamStatus = Number(error.message?.match(/\d{3}/)?.[0])
      let message
      if (error.name === 'AbortError') {
        message =
          'The request timed out. GOV.UK took too long to respond — please try again in a moment.'
      } else if (error.message === 'Fastly CDN error 200') {
        message =
          'GOV.UK is temporarily unable to serve that page via its CDN (Fastly). Please try again in a moment.'
      } else if (upstreamStatus === HTTP_STATUS.NOT_FOUND) {
        message =
          'That page could not be found on GOV.UK. Please check the URL is correct and try again.'
      } else if (upstreamStatus === HTTP_STATUS.FORBIDDEN) {
        message =
          'Access to that page was denied. The URL may be restricted or require authentication.'
      } else if (
        upstreamStatus >= HTTP_STATUS.BAD_REQUEST &&
        upstreamStatus < HTTP_STATUS.INTERNAL_SERVER_ERROR
      ) {
        message =
          'That URL returned an error. Please check the URL is correct and points to a published GOV.UK page.'
      } else {
        message =
          'Could not retrieve content from that URL. Please check the URL is correct and try again.'
      }
      return h
        .response({ success: false, message })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}
