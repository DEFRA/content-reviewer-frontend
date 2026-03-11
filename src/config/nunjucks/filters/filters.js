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
