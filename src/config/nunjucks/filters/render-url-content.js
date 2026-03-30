/**
 * render-url-content filter
 *
 * Converts plain-text canonical content produced from URL sources into safe
 * HTML for display in the review results page.
 *
 * Three transformations are applied in order:
 *
 *   1. Extract Markdown-style links [anchor text](https://…) into sentinels
 *      so they are not corrupted by HTML escaping in step 2.
 *
 *   2. Escape all remaining HTML special characters so that any residual
 *      markup from the source page cannot be injected into the rendered output.
 *
 *   3. Restore Markdown links as GOV.UK-styled anchor elements.  Only
 *      https:// and http:// URLs are allowed; other schemes are dropped and
 *      the anchor text is rendered as plain text instead.
 *
 *   4. Convert paragraph and line breaks:
 *        \n\n (blank line) → paragraph boundary  </p><p>
 *        \n   (single LF)  → line break           <br>
 *      The output is wrapped in a <p>…</p> container.
 *
 * Security
 * ────────
 * Extracting links before HTML escaping (step 1) means that URLs containing
 * & (query strings) are not corrupted to &amp; inside the href attribute.
 * The anchor text IS HTML-escaped in step 2 so XSS through link labels is
 * prevented.  Only http:// and https:// URL schemes are allowed in hrefs.
 *
 * @param {string} text - Plain-text section content (may contain \n and
 *                        [anchor](url) placeholders)
 * @returns {string} HTML-safe string, NOT auto-escaped by Nunjucks
 *                   (caller must use | safe or nunjucks.markSafe)
 */

/**
 * Markdown link pattern — bounded quantifiers prevent ReDoS on malformed input.
 *  Group 1: anchor text  (max 2 000 chars)
 *  Group 2: URL          (max 2 048 chars, must start with http:// or https://)
 */
const MARKDOWN_LINK_RE = /\[([^\]]{0,2000})\]\((https?:\/\/[^)\s]{0,2048})\)/g

/**
 * Sentinel used to temporarily replace Markdown links so they survive
 * HTML escaping.  The sentinel wraps a numeric index using characters
 * that are not affected by HTML escaping and cannot appear in normal
 * GOV.UK content text (no <, >, &, ", ' characters).
 *
 * Format: __GOVUK_LINK_SENTINEL_<index>__
 */
const LINK_SENTINEL_PREFIX = '__GOVUK_LINK_SENTINEL_'
const LINK_SENTINEL_SUFFIX = '__'
const LINK_SENTINEL_RE = /__GOVUK_LINK_SENTINEL_(\d+)__/g

/**
 * Escape HTML special characters to prevent injection from residual markup.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Nunjucks filter: renderUrlContent
 *
 * @param {string} text
 * @param {boolean} [inline=false] - When true, skips paragraph/line-break wrapping
 *   (step 4). Use for inline contexts such as highlighted <mark> spans where a
 *   block-level <p> wrapper would produce invalid HTML.
 * @returns {string} HTML string (must be rendered with | safe)
 */
export function renderUrlContent(text, inline = false) {
  if (!text || typeof text !== 'string') {
    return text ?? ''
  }

  // Step 1: extract Markdown links into sentinels before HTML escaping so
  // that & in URLs (query strings) is not corrupted to &amp; in hrefs.
  const links = []
  let withSentinels = text.replaceAll(
    MARKDOWN_LINK_RE,
    (_match, anchor, url) => {
      const idx = links.length
      links.push({ anchor, url })
      return `${LINK_SENTINEL_PREFIX}${idx}${LINK_SENTINEL_SUFFIX}`
    }
  )

  // Step 2: escape remaining HTML special characters (sentinel chars are safe)
  withSentinels = escapeHtml(withSentinels)

  // Step 3: restore sentinels as GOV.UK anchor elements.
  // The anchor text is HTML-escaped in step 2 via the sentinel round-trip;
  // the URL is used verbatim (only http/https schemes were captured).
  const withLinks = withSentinels.replaceAll(LINK_SENTINEL_RE, (_m, idxStr) => {
    const { anchor, url } = links[Number(idxStr)]
    // Escape the anchor text that was NOT yet escaped (it was inside the sentinel)
    const safeAnchor = escapeHtml(anchor)
    return `<a href="${url}" class="govuk-link" rel="noopener noreferrer">${safeAnchor}</a>`
  })

  // Step 4: convert newlines to HTML structural elements (skipped in inline mode)
  if (inline) {
    return withLinks
  }

  const paragraphs = withLinks.split('\n\n')
  const rendered = paragraphs
    .map((para) => para.replaceAll('\n', '<br>'))
    .join('</p><p>')

  return `<p>${rendered}</p>`
}

/**
 * Nunjucks filter: convertNewlines
 *
 * Converts newline characters in an already-assembled HTML string into HTML
 * structural elements, preserving inline markup such as <mark> and <a> tags.
 *
 * Use this after assembling all annotated sections in inline mode so that
 * paragraph/line-break structure is applied to the full output rather than
 * per-section, which would create invalid block/inline nesting.
 *
 *   \n\n → paragraph boundary  </p><p>
 *   \n   → line break          <br>
 *
 * The result is wrapped in a <p>…</p> container.
 *
 * @param {string} html - Assembled HTML with raw newline characters
 * @returns {string} HTML string wrapped in <p> tags (must be rendered with | safe)
 */
export function convertNewlines(html) {
  if (!html || typeof html !== 'string') {
    return html ?? ''
  }
  const segments = html
    .split('\n\n')
    .map((para) => {
      const lines = para.split('\n').filter((l) => l.trim())
      if (lines.length === 0) {
        return ''
      }
      // If every non-empty line starts with a bullet marker, render as a list.
      // trimStart() handles any residual leading whitespace from inline assembly.
      const allBullets = lines.every((l) => l.trimStart().startsWith('• '))
      if (allBullets) {
        const items = lines
          .map((l) => `<li>${l.trimStart().slice(2)}</li>`)
          .join('')
        return `<ul class="govuk-list govuk-list--bullet">${items}</ul>`
      }
      return `<p>${para.replaceAll('\n', '<br>')}</p>`
    })
    .filter(Boolean)
  return segments.join('')
}
