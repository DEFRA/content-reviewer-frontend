/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as apiClient from './api-client.js'
import * as uiFeedback from './ui-feedback.js'
import * as domElements from './dom-elements.js'
import * as reviewHistory from './review-history.js'
import { PROGRESS_INITIAL, PROGRESS_PROCESSING } from './constants.js'

const TEST_FILE_TYPE = 'application/pdf'
const TEST_FILENAME = 'test.pdf'
const MOCK_UPLOAD_URL =
  'https://cdp-uploader.example.com/upload-and-scan/abc123'
const MOCK_REVIEW_ID = 'mock-review-id-123'
const ERROR_MSG_NETWORK = 'Network error'
const ERROR_MSG_UPLOAD = 'Server rejected the file'
// CDP Uploader responds with an opaque redirect (302 intercepted by redirect:'manual')
const MOCK_CDP_RESPONSE = { type: 'opaqueredirect', ok: false, status: 0 }

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

describe('submitFileUpload - initiating upload', () => {
  it('calls /upload/initiate with filename and mimeType', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: MOCK_UPLOAD_URL,
          reviewId: MOCK_REVIEW_ID
        })
      })
      .mockResolvedValueOnce(MOCK_CDP_RESPONSE)
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(mockFetch).toHaveBeenCalledWith(
      '/upload/initiate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          filename: TEST_FILENAME,
          mimeType: TEST_FILE_TYPE
        })
      })
    )
  })

  it('shows "Preparing upload..." progress before initiating', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: MOCK_UPLOAD_URL,
          reviewId: MOCK_REVIEW_ID
        })
      })
      .mockResolvedValueOnce(MOCK_CDP_RESPONSE)
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(uiFeedback.showProgress).toHaveBeenCalledWith(
      'Preparing upload...',
      PROGRESS_INITIAL
    )
  })

  it('sends FormData to CDP Uploader URL via fetch with redirect:manual', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: MOCK_UPLOAD_URL,
          reviewId: MOCK_REVIEW_ID
        })
      })
      .mockResolvedValueOnce(MOCK_CDP_RESPONSE)
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(mockFetch).toHaveBeenCalledWith(
      MOCK_UPLOAD_URL,
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
        body: expect.any(FormData)
      })
    )
  })

  it('shows uploading progress when sending file to CDP Uploader', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: MOCK_UPLOAD_URL,
          reviewId: MOCK_REVIEW_ID
        })
      })
      .mockResolvedValueOnce(MOCK_CDP_RESPONSE)
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(uiFeedback.showProgress).toHaveBeenCalledWith(
      'Uploading and scanning document — please wait...',
      PROGRESS_PROCESSING
    )
  })
})

// ── Error paths ───────────────────────────────────────────────────────────────

describe('submitFileUpload - errors', () => {
  it('shows document error when /upload/initiate returns non-OK response', async () => {
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

  it('uses "Failed to initiate upload" fallback when error response has no message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file).catch(() => {})

    expect(uiFeedback.showDocumentError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to initiate upload')
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
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: MOCK_UPLOAD_URL,
          reviewId: MOCK_REVIEW_ID
        })
      })
      .mockResolvedValueOnce(MOCK_CDP_RESPONSE)
  }

  it('adds a pending history entry with the reviewId before sending to CDP Uploader', async () => {
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

  it('calls forceStartAutoRefresh after initiating upload', async () => {
    mockHappyPath()
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(globalThis.forceStartAutoRefresh).toHaveBeenCalled()
  })
})

// ── 401 redirect ──────────────────────────────────────────────────────────────

describe('submitFileUpload - authentication', () => {
  it('redirects to /auth/login and returns undefined when /upload/initiate returns 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    const result = await apiClient.submitFileUpload(file)

    expect(globalThis.location.assign).toHaveBeenCalledWith('/auth/login')
    expect(result).toBeUndefined()
  })
})
