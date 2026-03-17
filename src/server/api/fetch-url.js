import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500
}

const ALLOWED_HOSTNAME = 'www.gov.uk'
const FETCH_TIMEOUT_MS = 10_000

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
 * @param {URL} parsedUrl
 * @returns {Promise<string>}
 */
async function fetchGovUkHtml(parsedUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: 'text/html' }
    })
    if (!response.ok) {
      throw new Error(`Upstream responded with ${response.status}`)
    }
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
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
      logger.error({ err: error, url }, 'fetch-url: upstream fetch failed')
      return h
        .response({
          success: false,
          message: 'Could not retrieve content from that URL'
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}
