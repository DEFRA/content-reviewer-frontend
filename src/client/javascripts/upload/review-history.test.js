/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { addReviewToHistory } from './review-history.js'
import { GOVUK_TABLE_CELL_CLASS } from './constants.js'

const BASE_REVIEW = {
  id: 'review-1',
  fileName: 'test-doc.pdf',
  uploadedAt: '2024-01-15T10:30:00.000Z',
  status: 'completed'
}

function buildDom(limitValue = '5') {
  document.body.innerHTML = `
    <table>
      <tbody id="reviewHistoryBody"></tbody>
    </table>
    <select id="reviewLimit">
      <option value="${limitValue}" selected>${limitValue}</option>
    </select>
  `
}

describe('review-history - addReviewToHistory', () => {
  beforeEach(() => buildDom())

  it('returns early without throwing when #reviewHistoryBody is absent', () => {
    document.body.innerHTML = '<div></div>'
    expect(() => addReviewToHistory(BASE_REVIEW)).not.toThrow()
  })

  it('prepends a row to the history tbody', () => {
    addReviewToHistory(BASE_REVIEW)
    expect(document.querySelectorAll('#reviewHistoryBody tr').length).toBe(1)
  })

  it('sets data-review-id from review.id', () => {
    addReviewToHistory(BASE_REVIEW)
    const row = document.querySelector('#reviewHistoryBody tr')
    expect(row.dataset.reviewId).toBe('review-1')
  })

  it('falls back to review.reviewId when review.id is absent', () => {
    addReviewToHistory({ reviewId: 'rv-99', status: 'pending' })
    const row = document.querySelector('#reviewHistoryBody tr')
    expect(row.dataset.reviewId).toBe('rv-99')
  })

  it('uses review.filename when fileName is absent', () => {
    addReviewToHistory({
      id: '1',
      filename: 'alt-name.docx',
      status: 'pending'
    })
    const firstCell = document.querySelector('#reviewHistoryBody td')
    expect(firstCell.textContent).toBe('alt-name.docx')
  })

  it('uses N/A when both fileName and filename are absent', () => {
    addReviewToHistory({ id: '1', status: 'pending' })
    const firstCell = document.querySelector('#reviewHistoryBody td')
    expect(firstCell.textContent).toBe('N/A')
  })

  it('creates a row with exactly 5 table cells', () => {
    addReviewToHistory(BASE_REVIEW)
    expect(document.querySelectorAll('#reviewHistoryBody td').length).toBe(5)
  })

  it('applies govuk-table__cell class to every cell', () => {
    addReviewToHistory(BASE_REVIEW)
    document.querySelectorAll('#reviewHistoryBody td').forEach((cell) => {
      expect(cell.classList.contains(GOVUK_TABLE_CELL_CLASS)).toBe(true)
    })
  })

  it('prepends newest entry to the top of the table', () => {
    addReviewToHistory({ id: 'first', status: 'pending' })
    addReviewToHistory({ id: 'second', status: 'pending' })
    const rows = document.querySelectorAll('#reviewHistoryBody tr')
    expect(rows[0].dataset.reviewId).toBe('second')
    expect(rows[1].dataset.reviewId).toBe('first')
  })
})

describe('review-history - status cell rendering', () => {
  beforeEach(() => buildDom())

  it('renders completed status with govuk-tag--green and "Completed" label', () => {
    addReviewToHistory({ id: '1', status: 'completed' })
    const tag = document.querySelector('.govuk-tag')
    expect(tag.classList.contains('govuk-tag--green')).toBe(true)
    expect(tag.textContent).toBe('Completed')
  })

  it('renders processing status with govuk-tag--blue and "Processing..." label', () => {
    addReviewToHistory({ id: '1', status: 'processing' })
    const tag = document.querySelector('.govuk-tag')
    expect(tag.classList.contains('govuk-tag--blue')).toBe(true)
    expect(tag.textContent).toBe('Processing...')
  })

  it('renders pending status with govuk-tag--yellow and "Pending..." label', () => {
    addReviewToHistory({ id: '1', status: 'pending' })
    const tag = document.querySelector('.govuk-tag')
    expect(tag.classList.contains('govuk-tag--yellow')).toBe(true)
    expect(tag.textContent).toBe('Pending...')
  })

  it('renders failed status with govuk-tag--red and "Failed" label', () => {
    addReviewToHistory({ id: '1', status: 'failed' })
    const tag = document.querySelector('.govuk-tag')
    expect(tag.classList.contains('govuk-tag--red')).toBe(true)
    expect(tag.textContent).toBe('Failed')
  })

  it('renders unknown status with govuk-tag--grey and capitalised text', () => {
    addReviewToHistory({ id: '1', status: 'draft' })
    const tag = document.querySelector('.govuk-tag')
    expect(tag.classList.contains('govuk-tag--grey')).toBe(true)
    expect(tag.textContent).toBe('Draft')
  })

  it('defaults to pending when status is absent', () => {
    addReviewToHistory({ id: '1' })
    const tag = document.querySelector('.govuk-tag')
    expect(tag.classList.contains('govuk-tag--yellow')).toBe(true)
  })
})

describe('review-history - timestamp cell rendering', () => {
  beforeEach(() => buildDom())

  it('formats uploadedAt as a localised date/time string', () => {
    addReviewToHistory({
      id: '1',
      status: 'pending',
      uploadedAt: '2024-06-15T09:00:00.000Z'
    })
    const cells = document.querySelectorAll('#reviewHistoryBody td')
    expect(cells[2].textContent).not.toBe('N/A')
    expect(cells[2].textContent.length).toBeGreaterThan(0)
  })

  it('uses review.timestamp when uploadedAt is absent', () => {
    addReviewToHistory({
      id: '1',
      status: 'pending',
      timestamp: '2024-06-15T09:00:00.000Z'
    })
    const cells = document.querySelectorAll('#reviewHistoryBody td')
    expect(cells[2].textContent).not.toBe('N/A')
  })

  it('shows N/A when no timestamp field is present', () => {
    addReviewToHistory({ id: '1', status: 'pending' })
    const cells = document.querySelectorAll('#reviewHistoryBody td')
    expect(cells[2].textContent).toBe('N/A')
  })
})

describe('review-history - result cell rendering', () => {
  beforeEach(() => buildDom())

  it('renders a "View results" govuk-link for completed status', () => {
    addReviewToHistory({ id: 'r1', status: 'completed' })
    const link = document.querySelector('#reviewHistoryBody td:nth-child(4) a')
    expect(link).not.toBeNull()
    expect(link.textContent).toBe('View results')
    expect(link.getAttribute('href')).toBe('/review/results/r1')
  })

  it('uses reviewId in the results link when id is absent', () => {
    addReviewToHistory({ reviewId: 'r2', status: 'completed' })
    const link = document.querySelector('#reviewHistoryBody a')
    expect(link.getAttribute('href')).toBe('/review/results/r2')
  })

  it('renders a dash for processing status', () => {
    addReviewToHistory({ id: '1', status: 'processing' })
    const cells = document.querySelectorAll('#reviewHistoryBody td')
    expect(cells[3].textContent).toBe('-')
  })

  it('renders a dash for pending status', () => {
    addReviewToHistory({ id: '1', status: 'pending' })
    const cells = document.querySelectorAll('#reviewHistoryBody td')
    expect(cells[3].textContent).toBe('-')
  })

  it('renders a govuk-error-message span with errorMessage when status is failed', () => {
    addReviewToHistory({ id: '1', status: 'failed', errorMessage: 'Timed out' })
    const span = document.querySelector(
      '#reviewHistoryBody .govuk-error-message'
    )
    expect(span).not.toBeNull()
    expect(span.textContent).toBe('Timed out')
  })

  it('renders "Review Failed" when failed with no errorMessage', () => {
    addReviewToHistory({ id: '1', status: 'failed' })
    const span = document.querySelector(
      '#reviewHistoryBody .govuk-error-message'
    )
    expect(span.textContent).toBe('Review Failed')
  })

  it('renders "Unknown" for an unrecognised status', () => {
    addReviewToHistory({ id: '1', status: 'archived' })
    const cells = document.querySelectorAll('#reviewHistoryBody td')
    expect(cells[3].textContent).toBe('Unknown')
  })
})

describe('review-history - action cell rendering', () => {
  beforeEach(() => buildDom())

  it('renders a Delete link navigating to the confirm-delete page', () => {
    addReviewToHistory({ id: 'r1', status: 'pending' })
    const link = document.querySelector('.delete-review-btn')
    expect(link).not.toBeNull()
    expect(link.tagName).toBe('A')
    expect(link.textContent).toBe('Delete')
  })

  it('sets review ID in the Delete link href', () => {
    addReviewToHistory({ id: 'r1', status: 'pending' })
    expect(document.querySelector('.delete-review-btn').href).toContain('r1')
  })

  it('sets data-filename from fileName', () => {
    addReviewToHistory({ id: '1', status: 'pending', fileName: 'report.docx' })
    expect(document.querySelector('.delete-review-btn').href).toContain(
      'report.docx'
    )
  })

  it('uses filename when fileName is absent', () => {
    addReviewToHistory({ id: '1', status: 'pending', filename: 'alt.pdf' })
    expect(document.querySelector('.delete-review-btn').href).toContain(
      'alt.pdf'
    )
  })

  it('defaults data-filename to N/A when no filename field is present', () => {
    addReviewToHistory({ id: '1', status: 'pending' })
    const href = document
      .querySelector('.delete-review-btn')
      .getAttribute('href')
    expect(decodeURIComponent(href)).toContain('N/A')
  })
})

describe('review-history - enforceTableLimit', () => {
  it('removes rows that exceed the selected limit', () => {
    buildDom('2')
    for (let i = 0; i < 4; i++) {
      addReviewToHistory({ id: `r${i}`, status: 'pending' })
    }
    expect(document.querySelectorAll('#reviewHistoryBody tr').length).toBe(2)
  })

  it('keeps all rows when count is within the limit', () => {
    buildDom('5')
    addReviewToHistory({ id: 'r1', status: 'pending' })
    addReviewToHistory({ id: 'r2', status: 'pending' })
    expect(document.querySelectorAll('#reviewHistoryBody tr').length).toBe(2)
  })

  it('defaults to limit of 5 when #reviewLimit select is absent', () => {
    document.body.innerHTML = `
      <table><tbody id="reviewHistoryBody"></tbody></table>
    `
    for (let i = 0; i < 7; i++) {
      addReviewToHistory({ id: `r${i}`, status: 'pending' })
    }
    expect(document.querySelectorAll('#reviewHistoryBody tr').length).toBe(5)
  })
})
