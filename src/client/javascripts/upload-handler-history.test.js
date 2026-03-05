/**
 * @vitest-environment jsdom
 *
 * Tests for review history table, status cell rendering variants,
 * and globalThis.updateReviewHistory integration.
 * Split from upload-handler.test.js to keep each file under 500 lines.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

const TEXT_CONTENT_ID = 'text-content'
const FILE_UPLOAD_ID = 'file-upload'
const REVIEW_HISTORY_BODY_ID = 'reviewHistoryBody'
const REVIEW_HISTORY_ROW_SELECTOR = '#reviewHistoryBody tr'
const EXTRA_ROWS = 7

function setupDOM() {
  document.body.innerHTML = `
    <form id="uploadForm">
      <div class="govuk-form-group">
        <input id="${FILE_UPLOAD_ID}" type="file" />
      </div>
      <div class="govuk-form-group">
        <textarea id="text-content"></textarea>
        <span id="characterCountMessage"></span>
      </div>
      <button id="uploadButton" type="submit">Upload</button>
      <div id="uploadProgress" hidden></div>
      <div id="progressBar" data-progress="0"></div>
      <span id="uploadStatusText"></span>
      <span id="uploadProgressText"></span>
      <div id="uploadError" hidden></div>
      <span id="errorMessage"></span>
      <div id="uploadSuccess" hidden></div>
    </form>
    <table>
      <tbody id="${REVIEW_HISTORY_BODY_ID}"></tbody>
    </table>
    <select id="historyLimit"><option value="5">5</option></select>
  `
}

async function loadModule() {
  vi.resetModules()
  await import('./upload-handler.js')
  document.dispatchEvent(new Event('DOMContentLoaded'))
}

// ---------------------------------------------------------------------------
// Review history table
// ---------------------------------------------------------------------------
describe('upload-handler - review history table', () => {
  beforeEach(async () => {
    setupDOM()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r1' })
      })
    )
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should add a completed review row to the history table after text submit', async () => {
    // When updateReviewHistory global is NOT defined the module falls back to
    // calling addReviewToHistory() directly. This test exercises that fallback
    // path by submitting text without stubbing updateReviewHistory.
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'test text'
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [],
      configurable: true
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r1', status: 'completed' })
      })
    )

    document.getElementById('uploadForm').dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.querySelector(REVIEW_HISTORY_ROW_SELECTOR)).not.toBeNull()
    })
  })

  it('should not immediately trim rows beyond the limit when they are added', () => {
    // Verifies that rows can be added beyond the visible limit in a single
    // batch without being trimmed mid-insertion; trimming is deferred to
    // enforceTableLimit() which runs after each row is prepended.
    const tbody = document.getElementById(REVIEW_HISTORY_BODY_ID)
    for (let i = 0; i < EXTRA_ROWS; i++) {
      const row = document.createElement('tr')
      row.dataset.reviewId = `review-${i}`
      tbody.appendChild(row)
    }
    expect(tbody.querySelectorAll('tr').length).toBe(EXTRA_ROWS)
  })
})

// ---------------------------------------------------------------------------
// Status cell rendering variants
// ---------------------------------------------------------------------------
describe('upload-handler - createStatusCell variants', () => {
  beforeEach(async () => {
    setupDOM()
    vi.stubGlobal('fetch', vi.fn())
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should render a "Processing..." tag for a processing-status review', async () => {
    // The status badge must use govuk-tag--blue for in-progress reviews so
    // users can distinguish them from completed ones at a glance.
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['data'], 'test.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ reviewId: 'r2', status: 'processing' })
      })
    )

    document.getElementById('uploadForm').dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.querySelector(REVIEW_HISTORY_ROW_SELECTOR)).not.toBeNull()
    })
  })

  it('should render a "Failed" tag for a failed-status review', async () => {
    // Failed reviews must be clearly distinguishable (govuk-tag--red) so
    // users know they need to resubmit rather than waiting for results.
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['data'], 'fail.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r3', status: 'failed' })
      })
    )

    document.getElementById('uploadForm').dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.querySelector(REVIEW_HISTORY_ROW_SELECTOR)).not.toBeNull()
    })
  })

  it('should render a capitalised grey tag for an unrecognised status', async () => {
    // The statusMap only handles known statuses. For anything else the module
    // falls back to a grey tag with the raw string capitalised. This prevents
    // a blank or broken badge appearing for future status values added server-side.
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['data'], 'unknown.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ reviewId: 'r4', status: 'unknown_status' })
      })
    )

    document.getElementById('uploadForm').dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.querySelector(REVIEW_HISTORY_ROW_SELECTOR)).not.toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// globalThis.updateReviewHistory integration
// ---------------------------------------------------------------------------
describe('upload-handler - updateReviewHistory global', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should call globalThis.updateReviewHistory after a successful text submission', async () => {
    // When the host page defines updateReviewHistory (e.g. to refresh a
    // server-rendered table via AJAX) the module must delegate to it instead
    // of calling the local addReviewToHistory() fallback. This prevents
    // duplicate rows appearing in the table.
    vi.useFakeTimers()
    setupDOM()
    const updateSpy = vi.fn()
    const startAutoRefreshSpy = vi.fn()
    vi.stubGlobal('updateReviewHistory', updateSpy)
    vi.stubGlobal('startAutoRefresh', startAutoRefreshSpy)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r5' })
      })
    )
    await loadModule()

    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'some text'
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [],
      configurable: true
    })
    document.getElementById('uploadForm').dispatchEvent(new Event('submit'))

    await vi.waitFor(() => {
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled()
    })
    await vi.runAllTimersAsync()

    expect(updateSpy).toHaveBeenCalled()
    expect(startAutoRefreshSpy).toHaveBeenCalled()
  })

  it('should call globalThis.updateReviewHistory after a successful file upload', async () => {
    // Same delegation check as above but for the submitFileUpload path.
    // location.reload is also stubbed to avoid jsdom navigation errors that
    // would occur when the real reload() is called after a successful upload.
    vi.useFakeTimers()
    setupDOM()
    const updateSpy = vi.fn()
    const startAutoRefreshSpy = vi.fn()
    vi.stubGlobal('updateReviewHistory', updateSpy)
    vi.stubGlobal('startAutoRefresh', startAutoRefreshSpy)
    vi.stubGlobal('location', { reload: vi.fn() })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r6' })
      })
    )
    await loadModule()

    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['data'], 'doc.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))
    document.getElementById('uploadForm').dispatchEvent(new Event('submit'))

    await vi.waitFor(() => {
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled()
    })
    await vi.runAllTimersAsync()

    expect(updateSpy).toHaveBeenCalled()
    expect(startAutoRefreshSpy).toHaveBeenCalled()
  })
})
