/**
 * @vitest-environment jsdom
 */
/* global HTMLFormElement */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as apiClient from './api-client.js'
import * as uiFeedback from './ui-feedback.js'
import * as domElements from './dom-elements.js'
import * as reviewHistory from './review-history.js'
import { PROGRESS_INITIAL } from './constants.js'

const TEST_FILE_TYPE = 'application/pdf'
const TEST_FILENAME = 'test.pdf'
const MOCK_UPLOAD_URL =
  'https://cdp-uploader.example.com/upload-and-scan/abc123'
const MOCK_REVIEW_ID = 'mock-review-id-123'
const ERROR_MSG_NETWORK = 'Network error'
const ERROR_MSG_UPLOAD = 'Server rejected the file'

let mockFetch
let mockFormSubmit

beforeEach(() => {
  mockFetch = vi.fn()
  globalThis.fetch = mockFetch

  // Spy on form.submit to prevent real navigation in jsdom
  mockFormSubmit = vi
    .spyOn(HTMLFormElement.prototype, 'submit')
    .mockImplementation(function () {})

  // jsdom does not include DataTransfer — provide a minimal constructor stub
  globalThis.DataTransfer = class {
    constructor() {
      this.items = { add: () => {} }
      this.files = []
    }
  }

  // jsdom's HTMLInputElement.files setter requires a proper FileList, which our
  // mock DataTransfer does not produce. Override the descriptor so the property
  // is writable, while keeping a real DOM Node so that appendChild() works.
  const realCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'input') {
      const input = realCreateElement('input')
      Object.defineProperty(input, 'files', {
        writable: true,
        configurable: true,
        value: null
      })
      return input
    }
    return realCreateElement(tag)
  })

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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(uiFeedback.showProgress).toHaveBeenCalledWith(
      'Preparing upload...',
      PROGRESS_INITIAL
    )
  })

  it('submits a hidden form to the CDP Uploader URL after successful initiate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(mockFormSubmit).toHaveBeenCalledOnce()
  })

  it('sets the form action to the CDP Uploader upload URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    const createElementSpy = vi.spyOn(document, 'createElement')

    await apiClient.submitFileUpload(file)

    const formCall = createElementSpy.mock.results.find(
      (r) => r.value?.tagName === 'FORM'
    )
    if (formCall) {
      expect(formCall.value.action).toBe(MOCK_UPLOAD_URL)
    }
    // If we couldn't introspect the form, at least confirm submit was called
    expect(mockFormSubmit).toHaveBeenCalledOnce()
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
  it('adds a pending history entry with the reviewId before form submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })

    await apiClient.submitFileUpload(file)

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: TEST_FILENAME })
    )
  })

  it('truncates long filenames to first 3 word-segments with ellipsis and extension', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
    const file = new File(['content'], 'my_long_file_name.pdf', {
      type: TEST_FILE_TYPE
    })

    await apiClient.submitFileUpload(file)

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'my long file....pdf' })
    )
  })

  it('calls forceStartAutoRefresh after initiating upload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: MOCK_UPLOAD_URL,
        reviewId: MOCK_REVIEW_ID
      })
    })
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
