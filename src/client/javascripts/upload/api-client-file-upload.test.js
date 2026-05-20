/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as apiClient from './api-client.js'
import * as uiFeedback from './ui-feedback.js'
import * as domElements from './dom-elements.js'
import * as reviewHistory from './review-history.js'
import { PROGRESS_INITIAL } from './constants.js'

const TEST_FILE_TYPE = 'application/pdf'
const TEST_FILENAME = 'test.pdf'
const MOCK_REVIEW_ID = 'mock-review-id-123'
const ERROR_MSG_NETWORK = 'Network error'
const ERROR_MSG_UPLOAD = 'Server rejected the file'

let mockFetch

beforeEach(() => {
  mockFetch = vi.fn()
  globalThis.fetch = mockFetch

  vi.spyOn(domElements, 'getElements').mockReturnValue({
    uploadButton: { disabled: false }
  })
  vi.spyOn(uiFeedback, 'showProgress').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'hideProgress').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'showDocumentError').mockImplementation(() => {})
  vi.spyOn(reviewHistory, 'addReviewToHistory').mockImplementation(() => {})

  globalThis.location = { assign: vi.fn() }
  globalThis.forceStartAutoRefresh = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe('submitFileUpload - uploading', () => {
  it('POSTs FormData to /api/review/file', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/review/file',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    )
  })

  it('shows uploading progress at the start', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(uiFeedback.showProgress).toHaveBeenCalledWith(
      'Uploading and scanning document — please wait...',
      PROGRESS_INITIAL
    )
  })

  it('hides progress on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(uiFeedback.hideProgress).toHaveBeenCalled()
  })

  it('re-enables the upload button on success', async () => {
    const uploadButton = { disabled: false }
    vi.spyOn(domElements, 'getElements').mockReturnValue({ uploadButton })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(uploadButton.disabled).toBe(false)
  })
})

// ── Error paths ───────────────────────────────────────────────────────────────

describe('submitFileUpload - errors', () => {
  it('shows document error when /api/review/file returns non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: ERROR_MSG_UPLOAD })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uiFeedback.showDocumentError).toHaveBeenCalledWith(
      expect.stringContaining(ERROR_MSG_UPLOAD)
    )
  })

  it('uses "File upload failed" fallback when error response has no message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uiFeedback.showDocumentError).toHaveBeenCalledWith(
      expect.stringContaining('File upload failed')
    )
  })

  it('shows error when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error(ERROR_MSG_NETWORK))
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uiFeedback.showDocumentError).toHaveBeenCalledWith(
      expect.stringContaining(ERROR_MSG_NETWORK)
    )
  })

  it('hides the progress indicator on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uiFeedback.hideProgress).toHaveBeenCalled()
  })

  it('re-enables the upload button on error', async () => {
    const uploadButton = { disabled: false }
    vi.spyOn(domElements, 'getElements').mockReturnValue({ uploadButton })
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uploadButton.disabled).toBe(false)
  })

  it('does not throw when uploadButton is absent on error', async () => {
    vi.spyOn(domElements, 'getElements').mockReturnValue({ uploadButton: null })
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await expect(apiClient.submitFileUpload(file)).rejects.toThrow('fail')
  })

  it('shows JSON parse error message variant for "not valid JSON" errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('not valid JSON received'))
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uiFeedback.showDocumentError).toHaveBeenCalledWith(
      'Upload failed: Uploaded file could not be processed. Please ensure it is a valid PDF or Word document and try again.'
    )
  })

  it('shows JSON parse error message variant for "Unexpected token" errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Unexpected token < in JSON'))
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uiFeedback.showDocumentError).toHaveBeenCalledWith(
      'Upload failed: Uploaded file could not be processed. Please ensure it is a valid PDF or Word document and try again.'
    )
  })
})

// ── History and auto-refresh ──────────────────────────────────────────────────

describe('submitFileUpload - history and auto-refresh', () => {
  function mockHappyPath() {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
  }

  it('adds a pending history entry with the reviewId after successful upload', async () => {
    mockHappyPath()
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MOCK_REVIEW_ID,
        status: 'pending'
      })
    )
  })

  it('uses the filename as display name for short filenames', async () => {
    mockHappyPath()
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: TEST_FILENAME })
    )
  })

  it('truncates long filenames to first 3 word-segments with ellipsis and extension', async () => {
    mockHappyPath()
    const file = new File(
      ['content'],
      'My Very Long Document Report Extra.pdf',
      { type: TEST_FILE_TYPE }
    )

    await apiClient.submitFileUpload(file)

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'My Very Long....pdf' })
    )
  })

  it('truncates underscore-separated long filenames', async () => {
    mockHappyPath()
    const file = new File(['content'], 'my_long_file_name.pdf', {
      type: TEST_FILE_TYPE
    })

    await apiClient.submitFileUpload(file)

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'my long file....pdf' })
    )
  })

  it('calls forceStartAutoRefresh after successful upload', async () => {
    mockHappyPath()
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(globalThis.forceStartAutoRefresh).toHaveBeenCalled()
  })
})

// ── 401 redirect ──────────────────────────────────────────────────────────────

describe('submitFileUpload - authentication', () => {
  it('redirects to /auth/login and returns undefined when /api/review/file returns 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    const result = await apiClient.submitFileUpload(file)

    expect(globalThis.location.assign).toHaveBeenCalledWith('/auth/login')
    expect(result).toBeUndefined()
  })
})
