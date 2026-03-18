/**
 * Nunjucks filter: highlightIssues
 *
 * Takes plain text and an array of issues (with start, end, type, text fields)
 * and returns an HTML string where each issue span is wrapped in a
 * <mark class="highlight-{type}"> element with an anchor link to the
 * corresponding improvement item.
 *
 * Issues are sorted by start offset so they are inserted in order.
 * Overlapping spans are deduplicated (later-starting span is skipped if it
 * falls inside an already-open span).
 *
 * @param {string} text - Original plain text
 * @param {Array<{start:number,end:number,type:string,text:string}>} issues
 * @returns {string} HTML string (marked safe by the caller via | safe)
 */
export function highlightIssues(text, issues) {
  if (!text || !Array.isArray(issues) || issues.length === 0) {
    return escapeHtml(text || '')
  }

  // Sort by start offset ascending, then end descending (wider spans first)
  const sorted = [...issues]
    .filter(
      (issue) =>
        typeof issue.start === 'number' &&
        typeof issue.end === 'number' &&
        issue.start >= 0 &&
        issue.end > issue.start &&
        issue.end <= text.length
    )
    .sort((a, b) => a.start - b.start || b.end - a.end)

  let html = ''
  let cursor = 0
  let issueIndex = 0

  for (const issue of sorted) {
    // Skip spans that overlap with previous ones
    if (issue.start < cursor) {
      continue
    }

    // Append text before this issue (escaped)
    html += escapeHtml(text.slice(cursor, issue.start))

    // Build the anchor id — 1-based index matching the improvements list
    issueIndex++
    const anchorId = `improvement-${issueIndex}`
    const typeClass = `highlight-${escapeAttr(issue.type || 'plain-english')}`
    const issueText = escapeHtml(text.slice(issue.start, issue.end))

    html += `<a href="#${anchorId}" class="highlight-link"><mark class="${typeClass}">${issueText}</mark></a>`

    cursor = issue.end
  }

  // Append remaining text after last issue
  html += escapeHtml(text.slice(cursor))

  // Preserve line breaks as <br> for readability
  return html.replaceAll('\n', '<br>\n')
}

/**
 * HTML-escape a string
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) {
    return ''
  }
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Escape for use in HTML attribute values
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
  if (!str) {
    return ''
  }
  return str.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase()
}
