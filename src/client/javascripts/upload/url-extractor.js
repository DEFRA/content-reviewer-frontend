// URL extractor: validates a gov.uk URL and extracts content from known selectors
/* global DOMParser */
const GOVUK_HOSTNAME = 'www.gov.uk'
const GOVUK_BASE_URL = 'https://www.gov.uk'
const MAX_EXTRACTED_CHARS = 100_000

/**
 * Ordered list of CSS selectors to try when extracting content.
 * Each is tried in turn; matching elements are collected from all that match.
 */
const CONTENT_SELECTORS = [
  String.raw`.gem-c-heading.govuk-\!-margin-bottom-0`,
  String.raw`.gem-c-heading--inverse.govuk-\!-margin-bottom-0`,
  '.gem-c-heading__text.govuk-heading-xl',
  '.govuk-grid-column-two-thirds',
  String.raw`.gem-c-heading.govuk-\!-margin-bottom-6`,
  '.gem-c-contents-list-with-body__list-container',
  'div[data-module="govspeak"]'
]

/**
 * CSS selectors for structural chrome, banners and page furniture that should
 * be stripped before content extraction.  Removing these ensures that cookie
 * notices, navigation, feedback widgets etc. are not included in the review.
 */
const NOISE_SELECTORS = [
  'header',
  'footer',
  'nav',
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
  '.gem-c-phase-banner'
].join(', ')

/**
 * Validates that the provided string is a well-formed URL pointing to a gov.uk
 * page. Returns the parsed URL on success or null if invalid.
 * @param {string} urlString
 * @returns {URL|null}
 */
export function parseGovUkUrl(urlString) {
  let parsed
  try {
    parsed = new URL(urlString)
  } catch {
    return null
  }
  if (parsed.hostname !== GOVUK_HOSTNAME) {
    return null
  }
  return parsed
}

/**
 * Fetches the HTML for a validated gov.uk URL via the server-side proxy
 * (/api/fetch-url) to avoid CORS errors, then extracts content and returns
 * it as an HTML string ready for S3 upload.
 * Throws with a user-facing message if the content is too long.
 * @param {string} urlString
 * @returns {Promise<string>} HTML file content
 */
export async function extractGovspeakText(urlString) {
  const proxyUrl = `/api/fetch-url?url=${encodeURIComponent(urlString)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    throw new Error(`Proxy fetch failed: ${response.status}`)
  }
  const html = await response.text()
  return buildExtractedHtml(html, urlString)
}

/**
 * Resolve all relative <a href> values in the document to absolute URLs.
 * Relative paths (e.g. /guidance/something) are resolved against the
 * GOV.UK base so links remain navigable after the HTML is stored in S3.
 * External links and already-absolute links are left unchanged.
 * @param {Document} doc
 */
function resolveLinks(doc) {
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href')
    if (!href) {
      return
    }
    // Already absolute — leave as-is
    if (/^https?:\/\//i.test(href)) {
      return
    }
    // Anchor-only links (#section) — leave as-is
    if (href.startsWith('#')) {
      return
    }
    // Relative path — resolve against GOV.UK base
    try {
      anchor.setAttribute('href', new URL(href, GOVUK_BASE_URL).href)
    } catch {
      // Malformed href — leave unchanged
    }
  })
}

/**
 * Parses raw HTML, removes noise elements, resolves relative links to
 * absolute GOV.UK URLs, extracts markup from known content selectors,
 * checks the 100K character limit, and returns a self-contained HTML
 * document string. <a> tags are preserved so links remain clickable in
 * the review results page.
 * @param {string} html
 * @param {string} sourceUrl
 * @returns {string} HTML file content
 */
export function buildExtractedHtml(html, sourceUrl) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove all structural chrome, banners and page furniture
  doc.querySelectorAll(NOISE_SELECTORS).forEach((el) => el.remove())

  // Make all relative links absolute so they remain navigable after storage
  resolveLinks(doc)

  const sections = []

  for (const selector of CONTENT_SELECTORS) {
    try {
      const nodes = doc.querySelectorAll(selector)
      nodes.forEach((node) => {
        const text = node.textContent.replaceAll(/\s+/g, ' ').trim()
        if (text) {
          sections.push(`<section>\n${node.innerHTML.trim()}\n</section>`)
        }
      })
    } catch {
      // Invalid selector or element absent — skip and continue
    }
  }

  const bodyContent = sections.join('\n\n')
  const tempDiv = doc.createElement('div')
  tempDiv.innerHTML = bodyContent
  const totalChars = tempDiv.textContent.replaceAll(/\s+/g, ' ').trim().length

  if (totalChars > MAX_EXTRACTED_CHARS) {
    throw new Error(
      `Extracted text is too long. Maximum ${MAX_EXTRACTED_CHARS} characters. The webpage has ${totalChars} characters`
    )
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Extracted content</title>
  <meta name="source-url" content="${sourceUrl}">
</head>
<body>
${bodyContent}
</body>
</html>`
}
