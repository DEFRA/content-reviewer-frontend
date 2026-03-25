// URL extractor: validates a gov.uk URL and extracts content from known selectors
/* global DOMParser */
const GOVUK_HOSTNAME = 'www.gov.uk'
const GOVUK_BASE_URL = 'https://www.gov.uk'
const MAX_EXTRACTED_CHARS = 100_000

/**
 * Ordered list of CSS selectors to try when extracting content.
 * Each is tried in turn; matching elements are collected from all that match.
 *
 * Ordering is significant: more-specific selectors must come before broader
 * container selectors (e.g. .govuk-grid-column-two-thirds) so that the
 * ancestor/descendant overlap check does not suppress specific content regions
 * that happen to sit inside the wider container.
 *
 * Page-type coverage:
 *  - h1.gem-c-title__text                  : main page title (guidance, policy, news)
 *  - .gem-c-lead-paragraph                 : intro/summary paragraph (all page types)
 *  - .gem-c-contents-list__list            : contents list on guidance/policy pages
 *  - div[data-module="govspeak"]            : guidance, policy, news, consultation,
 *                                             specialist document, HMRC manual
 *  - .govuk-accordion__section-content     : manual section pages (accordion layout)
 *  - div[data-module="govspeak-html-publication"] : HTML publication full documents
 *  - .gem-c-document-list                  : collection pages, manual index pages
 *  - .govuk-step-nav__panel                : step-by-step navigation pages
 *  - .gem-c-browse-columns                 : browse/topic index pages
 *  - .govuk-grid-column-two-thirds         : fallback for any two-thirds column page
 *                                            not already captured by a finer selector
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
 * CSS selectors for structural chrome, banners and page furniture that should
 * be stripped before content extraction.  Removing these ensures that cookie
 * notices, navigation, feedback widgets etc. are not included in the review.
 *
 * Note: 'nav' is intentionally NOT included here because the GOV.UK contents
 * list is rendered inside a <nav class="gem-c-contents-list"> element — stripping
 * all <nav> elements would remove the contents list before it can be extracted.
 * Instead, specific navigation components that are noise are listed explicitly.
 *
 * Also strips GOV.UK heading context spans (e.g. "Guidance" labels) that sit
 * inside headings as decorative sub-captions — these are not content and
 * produce garbled text when stripped of their surrounding markup.
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
 * Replace every <a href="URL">anchor text</a> in the given element with a
 * Markdown-style link placeholder [anchor text](URL).  This is done BEFORE
 * collecting innerHTML so that when canonical-document strips HTML tags the
 * link URL and label survive in plain text and are preserved for Bedrock.
 *
 * Anchor-only links (#fragment), links with no href, and links whose text
 * is empty after trimming are converted to plain text only (no parenthesised
 * URL) to avoid cluttering the canonical document with useless fragment URLs.
 *
 * @param {Element} root  - DOM element whose <a> descendants should be converted
 */
function convertLinksToMarkdown(root) {
  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? ''
    const text = anchor.textContent.replaceAll(/\s+/g, ' ').trim()

    let replacement
    if (!text) {
      // Empty link — drop entirely
      replacement = ''
    } else if (!href || href.startsWith('#')) {
      // Anchor-only or empty href — keep text only
      replacement = text
    } else {
      // Full link → Markdown format so the URL survives tag stripping
      replacement = `[${text}](${href})`
    }

    anchor.replaceWith(replacement)
  })
}

/**
 * Parses raw HTML, removes noise elements, resolves relative links to
 * absolute GOV.UK URLs, converts <a> tags to Markdown placeholders so
 * links survive plain-text processing, extracts markup from known content
 * selectors, checks the 100K character limit, and returns a self-contained
 * HTML document string.
 *
 * Link preservation strategy
 * ──────────────────────────
 * <a href="URL">text</a> is converted to the Markdown form [text](URL) before
 * section innerHTML is captured.  canonical-document.js strips all remaining
 * HTML tags, leaving the Markdown links intact in canonicalText.  The results
 * page template then converts [text](URL) back to <a> elements when rendering.
 *
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
  // Keep matched DOM nodes so we can detect ancestor/descendant overlaps
  const matchedNodes = []

  for (const selector of CONTENT_SELECTORS) {
    try {
      const nodes = doc.querySelectorAll(selector)
      nodes.forEach((node) => {
        // Skip if this node is already covered by a previously matched node
        // (i.e. it is a descendant of one) or if it would re-include content
        // already captured inside a narrower match (i.e. it is an ancestor).
        const overlaps = matchedNodes.some(
          (matched) => matched.contains(node) || node.contains(matched)
        )
        if (overlaps) {
          return
        }

        // Convert <a> tags to Markdown [text](url) so links survive HTML
        // stripping in the canonical-document pipeline
        convertLinksToMarkdown(node)

        const text = node.textContent.replaceAll(/\s+/g, ' ').trim()
        if (text) {
          matchedNodes.push(node)
          sections.push(`<section>\n${node.innerHTML.trim()}\n</section>`)
        }
      })
    } catch {
      // Invalid selector or element absent — skip and continue
    }
  }

  if (sections.length === 0) {
    throw new Error(
      'Could not extract any content from that URL. The page may use an unsupported layout.'
    )
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
  <meta name="source-url" content="${sourceUrl}">
</head>
<body>
${bodyContent}
</body>
</html>`
}
