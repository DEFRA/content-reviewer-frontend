import assign from 'lodash/assign.js'

/**
 * Return the minimum value from an array
 * @param {Array} arr - Array of values
 * @returns {*} Minimum value
 */
export const min = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0
  }
  return Math.min(...arr)
}

export { assign }
export { formatDate } from './format-date.js'
export { formatCurrency } from './format-currency.js'
export { highlightContent } from './highlight-content.js'
export { renderUrlContent, convertNewlines } from './render-url-content.js'

/**
 * Truncate a filename to the first 3 words of the base name, preserving the
 * extension. If the base name has 3 or fewer words the filename is returned
 * unchanged. %20-encoded names from URL sources are decoded first.
 *
 * Examples:
 *   "Assessing the sustainability of fishing catch limits for 2026.pdf"
 *     → "Assessing the sustainability...pdf"
 *   "approval_lr448.pdf"  → "approval_lr448.pdf"  (1 word, unchanged)
 */
export function truncateFilename(filename) {
  if (!filename) return ''
  const decoded = decodeURIComponent(String(filename))
  const lastDot = decoded.lastIndexOf('.')
  const ext = lastDot !== -1 ? decoded.slice(lastDot + 1) : ''
  const base = lastDot !== -1 ? decoded.slice(0, lastDot) : decoded
  const words = base.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 3) return decoded
  return words.slice(0, 3).join(' ') + '...' + ext
}
