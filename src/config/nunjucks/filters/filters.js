import assign from 'lodash/assign.js'

import { formatDate } from './format-date.js'
import { formatCurrency } from './format-currency.js'

/**
 * Return the minimum value from an array
 * @param {Array} arr - Array of values
 * @returns {*} Minimum value
 */
export const min = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0
  return Math.min(...arr)
}

export { assign, formatDate, formatCurrency }
