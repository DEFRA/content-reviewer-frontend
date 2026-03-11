// Review history table management
import { GOVUK_TABLE_CELL_CLASS } from './constants.js'

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
    createTextCell(review.fileName || review.filename || 'N/A'),
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
  } else if (status === 'processing' || status === 'pending') {
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
  const btn = document.createElement('button')
  cell.className = GOVUK_TABLE_CELL_CLASS
  btn.type = 'button'
  btn.className = 'govuk-link delete-review-btn'
  btn.textContent = 'Delete'
  btn.dataset.reviewId = review.id || review.reviewId
  btn.dataset.filename = review.fileName || review.filename || 'N/A'
  cell.appendChild(btn)
  return cell
}

function enforceTableLimit() {
  const limitSelect = document.getElementById('historyLimit')
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
