// Review history table management
import { GOVUK_TABLE_CELL_CLASS } from './constants.js'

/**
 * Truncate a filename to the first 3 words of the base name, preserving the
 * file extension. Names with 3 or fewer words are returned unchanged.
 * Also decodes any %20-style URL encoding left in the string.
 */
function formatFilename(filename) {
  if (!filename) return 'N/A'
  const decoded = decodeURIComponent(filename)
  const lastDot = decoded.lastIndexOf('.')
  const ext = lastDot !== -1 ? decoded.slice(lastDot + 1) : ''
  const base = lastDot !== -1 ? decoded.slice(0, lastDot) : decoded
  const words = base.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 3) return decoded
  return words.slice(0, 3).join(' ') + '...' + ext
}

export function addReviewToHistory(review) {
  const tbody = document.querySelector('#reviewHistoryBody')
  if (!tbody) {
    return
  }
  tbody.prepend(createReviewRow(review))
  enforceTableLimit()
}

function createReviewRow(review) {
  const row = document.createElement('tr')
  row.dataset.reviewId = review.id || review.reviewId
  ;[
    createTextCell(formatFilename(review.fileName || review.filename || '')),
    createStatusCell(review),
    createTimestampCell(review),
    createResultCell(review),
    createActionCell(review)
  ].forEach((cell) => row.appendChild(cell))
  return row
}

function createTextCell(text) {
  const cell = document.createElement('td')
  cell.className = GOVUK_TABLE_CELL_CLASS
  cell.textContent = text
  return cell
}

function createStatusCell(review) {
  const cell = document.createElement('td')
  const tag = document.createElement('strong')
  cell.className = GOVUK_TABLE_CELL_CLASS
  tag.className = 'govuk-tag'
  const status = (review.status || 'pending').toLowerCase()
  const statusMap = {
    completed: ['govuk-tag--green', 'Completed'],
    processing: ['govuk-tag--blue', 'Processing...'],
    retrying: ['govuk-tag--blue', 'Retrying...'],
    pending: ['govuk-tag--yellow', 'Pending...'],
    failed: ['govuk-tag--red', 'Failed']
  }
  if (statusMap[status]) {
    tag.classList.add(statusMap[status][0])
    tag.textContent = statusMap[status][1]
  } else {
    tag.classList.add('govuk-tag--grey')
    tag.textContent = status.charAt(0).toUpperCase() + status.slice(1)
  }
  cell.appendChild(tag)
  return cell
}

function createTimestampCell(review) {
  const cell = document.createElement('td')
  cell.className = GOVUK_TABLE_CELL_CLASS
  const timestamp = review.uploadedAt || review.timestamp
  if (timestamp) {
    const date = new Date(timestamp)
    cell.textContent = date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } else {
    cell.textContent = 'N/A'
  }
  return cell
}

function createResultCell(review) {
  const cell = document.createElement('td')
  cell.className = GOVUK_TABLE_CELL_CLASS
  const status = (review.status || 'pending').toLowerCase()
  if (status === 'completed') {
    const link = document.createElement('a')
    link.href = `/review/results/${review.id || review.reviewId}`
    link.textContent = 'View results'
    link.className = 'govuk-link'
    cell.appendChild(link)
  } else if (
    status === 'processing' ||
    status === 'retrying' ||
    status === 'pending'
  ) {
    cell.textContent = '-'
  } else if (status === 'failed') {
    const span = document.createElement('span')
    span.className = 'govuk-error-message'
    span.textContent = review.errorMessage || 'Review Failed'
    cell.appendChild(span)
  } else {
    cell.textContent = 'Unknown'
  }
  return cell
}

function createActionCell(review) {
  const cell = document.createElement('td')
  const link = document.createElement('a')
  const reviewId = review.id || review.reviewId
  const filename = review.fileName || review.filename || 'N/A'
  cell.className = GOVUK_TABLE_CELL_CLASS
  link.className = 'govuk-link delete-review-btn'
  link.textContent = 'Delete'
  link.href = `/review/history/${reviewId}/delete?filename=${encodeURIComponent(filename)}`
  cell.appendChild(link)
  return cell
}

function enforceTableLimit() {
  const limitSelect = document.getElementById('reviewLimit')
  const tbody = document.querySelector('#reviewHistoryBody')
  if (!tbody) {
    return
  }
  const currentLimit = Number.parseInt(limitSelect?.value || '5', 10)
  const rows = tbody.querySelectorAll('tr')
  if (rows.length > currentLimit) {
    Array.from(rows)
      .slice(currentLimit)
      .forEach((row) => row.remove())
  }
}
