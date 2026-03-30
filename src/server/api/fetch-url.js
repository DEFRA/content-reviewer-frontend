import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500
}

const ALLOWED_HOSTNAME = 'www.gov.uk'
const FETCH_TIMEOUT_MS = 30_000
const FETCH_MAX_RETRIES = 2

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
 * Validates the supplied URL string.
 * Returns the parsed URL on success or null if invalid / not gov.uk.
 * @param {string} urlString
 * @returns {URL|null}
 */
function parseAllowedUrl(urlString) {
  if (!urlString) {
    return null
  }
  let parsed
  try {
    parsed = new URL(urlString)
  } catch {
    return null
  }
  if (parsed.hostname !== ALLOWED_HOSTNAME) {
    return null
  }
  return parsed
}

/**
 * Fetches the HTML for a validated gov.uk URL server-side, avoiding CORS.
 * Retries up to FETCH_MAX_RETRIES times on transient 5xx / network errors.
 * @param {URL} parsedUrl
 * @returns {Promise<string>}
 */
async function fetchGovUkHtml(parsedUrl) {
  let lastError
  for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: GOVUK_FETCH_HEADERS
      })
      if (!response.ok) {
        throw new Error(`Upstream responded with ${response.status}`)
      }
      return await response.text()
    } catch (err) {
      lastError = err
      logger.warn(
        { err, url: parsedUrl.toString(), attempt },
        `fetch-url: attempt ${attempt + 1} failed`
      )
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

    try {
      const html = await fetchGovUkHtml(parsedUrl)
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
      } else if (upstreamStatus === 404) {
        message =
          'That page could not be found on GOV.UK. Please check the URL is correct and try again.'
      } else if (upstreamStatus === 403) {
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
