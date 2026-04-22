import { load } from 'cheerio'
import { createLogger } from '../common/helpers/logging/logger.js'
import { config } from '../../config/config.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'
import { Agent } from 'undici'
import { fetchGovUkHtml, parseAllowedUrl } from './fetch-url.js'

const logger = createLogger()

const keepAliveAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connections: 5
})

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
}

const GOVUK_BASE_URL = 'https://www.gov.uk'
const GOVUK_HOSTNAME = 'www.gov.uk'
const MAX_EXTRACTED_CHARS = 100_000
const MIN_USEFUL_CONTENT_CHARS = 200
const SLUG_MAX_LENGTH = 50
const TITLE_MAX_LENGTH = 100

/**
 * Ordered list of CSS selectors for content extraction.
 * More-specific selectors are listed before broader containers so that the
 * ancestor/descendant overlap check suppresses redundant outer wrappers.
 *
 * Page-type coverage:
 *  - h1.gem-c-title__text                  : guidance, policy, news, consultation
 *  - h1.gem-c-heading__text                : specialist document, HMRC manual
 *  - .gem-c-lead-paragraph                 : intro/summary paragraph (all types)
 *  - .gem-c-contents-list__list            : guide contents list
 *  - div[data-module="govspeak"]            : guide sub-pages, news, policy, consultation
 *  - .govuk-accordion__section-content     : manual section pages (accordion)
 *  - div[data-module="govspeak-html-publication"] : HTML publication documents
 *  - .gem-c-document-list                  : collection / manual index pages
 *  - .govuk-step-nav__panel                : step-by-step navigation pages
 *  - .gem-c-browse-columns                 : browse / topic index pages
 *  - .govuk-grid-column-two-thirds         : general two-thirds column fallback
 */
const CONTENT_SELECTORS = [
  'h1.gem-c-title__text',
  'h1.gem-c-heading__text',
  '.gem-c-lead-paragraph',
  '.gem-c-contents-list__list',
  'div[data-module="govspeak"]',
  '.govuk-accordion__section-content',
  'div[data-module="govspeak-html-publication"]',
  '.gem-c-document-list',
  '.govuk-step-nav__panel',
  '.gem-c-browse-columns',
  '.govuk-grid-column-two-thirds'
]

/**
 * Structural chrome, banners and page furniture to remove before extraction.
 * 'nav' is intentionally excluded — the GOV.UK contents list lives inside
 * <nav class="gem-c-contents-list"> and must not be stripped wholesale.
 */
const NOISE_SELECTORS = [
  'header',
  'footer',
  'script',
  'style',
  'aside',
  '[data-module="cookie-banner"]',
  '.gem-c-cookie-banner',
  '.govuk-cookie-banner',
  '.gem-c-related-navigation',
  '.gem-c-feedback',
  '.gem-c-contextual-footer',
  '.gem-c-print-link',
  '.gem-c-breadcrumbs',
  '.gem-c-phase-banner',
  '.gem-c-layout-super-navigation-header',
  '.gem-c-skip-link',
  '.gem-c-heading__context',
  '.govuk-caption-xl',
  '.govuk-caption-l',
  '.govuk-caption-m'
].join(', ')

/**
 * Replace <a href="URL">text</a> within a cheerio element with Markdown
 * [text](URL) so link URLs survive tag stripping in the canonical pipeline.
 * Relative paths are resolved to absolute GOV.UK URLs.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').AnyNode} rootEl - raw DOM element
 */
function convertLinksToMarkdown($, rootEl) {
  $(rootEl)
    .find('a[href]')
    .each((_, anchor) => {
      const $anchor = $(anchor)
      const href = $anchor.attr('href') ?? ''
      const text = $anchor.text().replaceAll(/\s+/g, ' ').trim()

      let replacement
      if (!text) {
        replacement = ''
      } else if (!href || href.startsWith('#')) {
        replacement = text
      } else {
        let absHref = href
        if (!/^https?:\/\//i.test(href)) {
          try {
            absHref = new URL(href, GOVUK_BASE_URL).href
          } catch {
            // keep original
          }
        }
        replacement = `[${text}](${absHref})`
      }

      $anchor.replaceWith(replacement)
    })
}

/**
 * Parse raw GOV.UK HTML with cheerio, strip noise, extract content regions
 * using known selectors, convert links to Markdown, and return a minimal
 * HTML document string suitable for forwarding to the backend review API.
 *
 * Throws with a user-facing message if:
 *  - No content selectors matched (unsupported layout)
 *  - The extracted plain text is below the minimum useful threshold
 *  - The extracted plain text exceeds the maximum character limit
 *
 * @param {string} html - raw GOV.UK page HTML
 * @param {string} sourceUrl - original URL (embedded in <meta> and used for title fallback)
 * @returns {{ htmlDoc: string, title: string, charCount: number }}
 */
function extractContent(html, sourceUrl) {
  const $ = load(html)

  // Extract H1 title before any DOM manipulation
  const rawTitle =
    $('h1.gem-c-title__text').first().text().trim() ||
    $('h1.gem-c-heading__text').first().text().trim() ||
    $('h1').first().text().trim()

  // Remove structural noise
  $(NOISE_SELECTORS).remove()

  const sections = []
  const matchedEls = [] // raw DOM nodes for ancestor/descendant overlap detection

  for (const selector of CONTENT_SELECTORS) {
    $(selector).each((_, el) => {
      // Skip if this element is already covered by (or covers) a matched node
      const overlaps = matchedEls.some(
        (matched) => $.contains(matched, el) || $.contains(el, matched)
      )
      if (overlaps) {
        return
      }

      // Convert <a> tags to Markdown before capturing innerHTML
      convertLinksToMarkdown($, el)

      const text = $(el).text().replaceAll(/\s+/g, ' ').trim()
      if (!text) {
        return
      }

      matchedEls.push(el)
      sections.push(`<section>\n${$(el).html().trim()}\n</section>`)
    })
  }

  if (sections.length === 0) {
    throw new Error(
      'Could not extract content from that URL. The page layout is not supported. ' +
        'Please try a different URL or paste the content directly using the text input.'
    )
  }

  const bodyContent = sections.join('\n\n')
  // Strip tags to count plain-text characters (use cheerio to avoid regex ReDoS)
  const plainText = load(bodyContent)
    .root()
    .text()
    .replaceAll(/\s+/g, ' ')
    .trim()
  const charCount = plainText.length

  if (charCount < MIN_USEFUL_CONTENT_CHARS) {
    throw new Error(
      'This page appears to contain very little reviewable content. ' +
        'It may be a navigation or index page. ' +
        'Please try a URL that links directly to an article or guidance document.'
    )
  }

  if (charCount > MAX_EXTRACTED_CHARS) {
    throw new Error(
      `Extracted text is too long. Maximum ${MAX_EXTRACTED_CHARS} characters. ` +
        `The webpage has ${charCount} characters`
    )
  }

  const title = rawTitle ? rawTitle.substring(0, TITLE_MAX_LENGTH) : sourceUrl

  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="source-url" content="${sourceUrl}">
</head>
<body>
${bodyContent}
</body>
</html>`

  return { htmlDoc, title, charCount }
}

/**
 * Map fetch errors (from fetchGovUkHtml) to user-facing messages.
 * @param {Error} error
 * @returns {string}
 */
function mapFetchError(error) {
  const upstreamStatus = Number(/\d{3}/.exec(error.message)?.[0])
  if (error.name === 'AbortError') {
    return 'The request timed out. GOV.UK took too long to respond — please try again in a moment.'
  }
  if (error.message === 'Fastly CDN error 200') {
    return 'GOV.UK is temporarily unable to serve that page via its CDN. Please try again in a moment.'
  }
  if (upstreamStatus === HTTP_STATUS.NOT_FOUND) {
    return 'That page could not be found on GOV.UK. Please check the URL is correct and try again.'
  }
  if (upstreamStatus === HTTP_STATUS.FORBIDDEN) {
    return 'Access to that page was denied. The URL may be restricted or require authentication.'
  }
  if (
    upstreamStatus >= HTTP_STATUS.BAD_REQUEST &&
    upstreamStatus < HTTP_STATUS.INTERNAL_SERVER_ERROR
  ) {
    return 'That URL returned an error. Please check the URL is correct and points to a published GOV.UK page.'
  }
  return 'Could not retrieve content from that URL. Please check the URL is correct and try again.'
}

/**
 * Step 1: Fetch the GOV.UK page server-side.
 * Returns { html, finalUrl } on success so the caller can verify the redirect
 * chain stayed within www.gov.uk (Check 4).
 * @returns {Promise<{ html: string, finalUrl: string } | { errorResponse: object }>}
 */
function fetchPage(parsedUrl, url, h) {
  return fetchGovUkHtml(parsedUrl)
    .then(({ html, finalUrl }) => ({ html, finalUrl }))
    .catch((fetchError) => {
      logger.error(
        { err: fetchError, url },
        'url-review: upstream fetch failed'
      )
      return {
        errorResponse: h
          .response({ success: false, message: mapFetchError(fetchError) })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    })
}

/**
 * Step 1b: Verify the HTTP redirect chain remained within www.gov.uk.
 *
 * node-fetch / undici follow 3xx redirects automatically, so `finalUrl` is the
 * URL that ultimately served the response.  If a redirect leads outside GOV.UK
 * (e.g. a misconfigured domain alias), we must reject the request rather than
 * silently extracting off-domain content.
 *
 * @param {string} finalUrl - response.url from the fetch (final URL after redirects)
 * @param {string} url - original URL submitted by the user (for logging)
 * @param {object} h - Hapi response toolkit
 * @returns {{ errorResponse?: object }}
 */
function checkRedirectTarget(finalUrl, url, h) {
  if (!finalUrl) {
    return {} // Can't determine final URL — allow through (unexpected edge case)
  }
  let finalHostname
  try {
    finalHostname = new URL(finalUrl).hostname
  } catch {
    return {} // Unparseable finalUrl — allow through
  }
  if (finalHostname !== GOVUK_HOSTNAME) {
    logger.warn(
      { url, finalUrl, finalHostname },
      'url-review: redirect led outside www.gov.uk'
    )
    return {
      errorResponse: h
        .response({
          success: false,
          message:
            'The URL redirected to a page outside GOV.UK. ' +
            'Please provide a direct GOV.UK link.'
        })
        .code(HTTP_STATUS.BAD_REQUEST)
    }
  }
  return {}
}

/**
 * Detect whether a fetched GOV.UK page belongs to the Environment topic.
 *
 * Two signals are checked — either is sufficient to pass:
 *  1. A link whose href is "/environment" — present in the breadcrumb trail of
 *     every page that sits beneath the Environment browse topic on GOV.UK
 *     (https://www.gov.uk/environment#sub-topics).
 *  2. The machine-readable "govuk:topics" <meta> tag containing the token
 *     "environment" — set by Whitehall / Search for all Environment-tagged content.
 *
 * Both checks run on the raw, unmodified HTML so that breadcrumbs are still
 * present (they are stripped later in extractContent as noise).
 *
 * @param {string} html - raw GOV.UK page HTML
 * @returns {boolean}
 */
function isEnvironmentPage(html) {
  const $ = load(html)
  // Signal 1: breadcrumb (or any) link pointing to the /environment browse page
  if ($('a[href="/environment"]').length > 0) {
    return true
  }
  // Signal 2: GOV.UK machine-readable taxonomy meta tag
  const topics = $('meta[name="govuk:topics"]').attr('content') ?? ''
  return topics
    .toLowerCase()
    .split(/[\s,]+/)
    .includes('environment')
}

/**
 * Step 1b: Verify the fetched page belongs to the GOV.UK Environment topic.
 * Returns { errorResponse } when the check fails, empty object otherwise.
 * @param {string} html
 * @param {string} url
 * @param {object} h - Hapi response toolkit
 * @returns {{ errorResponse?: object }}
 */
function checkEnvironmentTag(html, url, h) {
  if (isEnvironmentPage(html)) {
    return {}
  }
  logger.warn({ url }, 'url-review: page is not tagged as Environment topic')
  return {
    errorResponse: h
      .response({
        success: false,
        message:
          'This page does not belong to the GOV.UK Environment topic. ' +
          'Only pages listed under https://www.gov.uk/environment can be reviewed.'
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }
}

/**
 * Step 2: Extract content from raw HTML with cheerio.
 * @returns {{ extracted: object } | { errorResponse: object }}
 */
function extractPage(html, url, h) {
  try {
    return { extracted: extractContent(html, url) }
  } catch (extractError) {
    logger.warn(
      { url, message: extractError.message },
      'url-review: content extraction failed'
    )
    return {
      errorResponse: h
        .response({ success: false, message: extractError.message })
        .code(HTTP_STATUS.BAD_REQUEST)
    }
  }
}

/**
 * Step 3: Forward extracted content to the backend review API.
 */
async function submitToBackend(
  url,
  extracted,
  finalTitle,
  userId,
  backendUrl,
  h
) {
  try {
    const backendResponse = await fetch(`${backendUrl}/api/review/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify({
        content: extracted.htmlDoc,
        title: finalTitle,
        sourceType: 'url',
        sourceUrl: url
      }),
      dispatcher: keepAliveAgent
    })

    if (!backendResponse.ok) {
      logger.error(
        { url, status: backendResponse.status },
        'url-review: backend review request failed'
      )
      return h
        .response({
          success: false,
          message: 'Failed to submit content to the review service'
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    const result = await backendResponse.json()
    logger.info(
      { url, reviewId: result.reviewId },
      'url-review: review submitted successfully'
    )
    return h
      .response({
        success: true,
        message: 'URL content submitted for review',
        reviewId: result.reviewId
      })
      .code(HTTP_STATUS.OK)
  } catch (backendError) {
    logger.error(
      { err: backendError, url },
      'url-review: backend submission error'
    )
    return h
      .response({
        success: false,
        message: backendError.message || 'Internal server error'
      })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

/**
 * POST /api/review/url
 * Accepts { url } JSON, fetches and extracts the GOV.UK page content
 * server-side (avoiding WAF inspection of HTML bodies), then forwards the
 * extracted content to the backend review API.
 */
export const urlReviewController = {
  async handler(request, h) {
    const { url } = request.payload

    const parsedUrl = parseAllowedUrl(url)
    if (!parsedUrl) {
      logger.warn({ url }, 'url-review: rejected invalid or non-gov.uk URL')
      return h
        .response({ success: false, message: 'Invalid or non-gov.uk URL' })
        .code(HTTP_STATUS.BAD_REQUEST)
    }

    logger.info({ url: parsedUrl.toString() }, 'url-review: fetching page')

    const {
      html,
      finalUrl,
      errorResponse: fetchErr
    } = await fetchPage(parsedUrl, url, h)
    if (fetchErr) {
      return fetchErr
    }

    const { errorResponse: redirectErr } = checkRedirectTarget(finalUrl, url, h)
    if (redirectErr) {
      return redirectErr
    }

    const { errorResponse: envErr } = checkEnvironmentTag(html, url, h)
    if (envErr) {
      return envErr
    }

    const { extracted, errorResponse: extractErr } = extractPage(html, url, h)
    if (extractErr) {
      return extractErr
    }

    logger.info(
      { url, charCount: extracted.charCount, title: extracted.title },
      'url-review: content extracted, forwarding to backend'
    )

    const slug = url
      .replaceAll(/^https?:\/\//g, '')
      .replaceAll(/[^a-z0-9]/gi, '-')
      .replaceAll(/-+/g, '-')
      .substring(0, SLUG_MAX_LENGTH)
    const fileName = `${slug}.html`
    const finalTitle = extracted.title || fileName

    const userId = getUserIdentifier(request)
    const backendUrl = config.get('backendUrl')

    return submitToBackend(url, extracted, finalTitle, userId, backendUrl, h)
  }
}
