/**
 * Resolve the best improvement index for an issue
 * @param {string} issueText - The issue text to match
 * @param {Array} improvements - List of improvements
 * @param {number} fallbackIndex - 1-based loop index fallback
 * @returns {number} 1-based improvement index
 */
function resolveImprovementIndex(issueText, improvements, fallbackIndex) {
  if (!Array.isArray(improvements)) {
    return fallbackIndex
  }

  const exactMatch = improvements.findIndex(
    (imp) => imp.current && imp.current === issueText
  )
  if (exactMatch !== -1) {
    return exactMatch + 1
  }

  const partialMatch = improvements.findIndex(
    (imp) => imp.current && issueText && imp.current.includes(issueText)
  )
  if (partialMatch !== -1) {
    return partialMatch + 1
  }

  return fallbackIndex
}

/**
 * Build a replacement map from issues to their anchor HTML
 * @param {Array} issues - Reviewed content issues
 * @param {Array} improvements - Improvements list
 * @returns {Array<{text: string, html: string}>} Ordered replacement entries
 */
function buildReplacementMap(issues, improvements) {
  const entries = []

  issues.forEach((issue, idx) => {
    const rawText = issue.text
    if (!rawText?.trim()) {
      return
    }
    const issueText = rawText.trim()
    const categoryClass = 'highlight-' + issue.category
    const matchedIndex = resolveImprovementIndex(
      issueText,
      improvements,
      idx + 1
    )
    const anchorId = 'improvement-' + matchedIndex
    const html = `<a href="#${anchorId}" class="highlight-link"><mark class="${categoryClass}">${issueText}</mark></a>`

    entries.push({ text: issueText, html })
  })

  // Sort longest first so longer phrases take priority over substrings
  entries.sort((a, b) => b.text.length - a.text.length)

  return entries
}

/**
 * Apply replacements to content in a single pass using a regex alternation
 * Avoids repeated replacements on already-marked-up HTML
 * @param {string} content - Plain text content
 * @param {Array<{text: string, html: string}>} replacements - Ordered replacements
 * @returns {string} Content with highlighted anchors
 */
function applyReplacements(content, replacements) {
  if (!replacements.length) {
    return content
  }

  const lookup = new Map(replacements.map((r) => [r.text, r.html]))

  const escapedPatterns = replacements.map((r) =>
    r.text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
  )
  const pattern = new RegExp(escapedPatterns.join('|'), 'g')

  return content.replace(pattern, (match) => lookup.get(match) ?? match)
}

/**
 * Nunjucks filter: highlightContent
 * Replaces issue texts in plain content with linked, marked-up HTML in one pass.
 *
 * @param {string} content - Plain text content
 * @param {Array} issues - Array of {text, category} issue objects
 * @param {Array} improvements - Array of improvement objects
 * @returns {string} HTML-safe highlighted content string
 */
export function highlightContent(content, issues, improvements) {
  if (!content || typeof content !== 'string') {
    return content ?? ''
  }
  if (!Array.isArray(issues) || issues.length === 0) {
    return content
  }

  const replacements = buildReplacementMap(issues, improvements ?? [])
  return applyReplacements(content, replacements)
}
