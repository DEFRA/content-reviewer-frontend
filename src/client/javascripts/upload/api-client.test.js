import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as apiClient from './api-client.js'
import * as uiFeedback from './ui-feedback.js'
import * as reviewHistory from './review-history.js'
import * as domElements from './dom-elements.js'
import * as characterCounter from './character-counter.js'
import * as inputControls from './input-controls.js'
import {
  PROGRESS_INITIAL,
  PROGRESS_PROCESSING,
  RELOAD_DELAY
} from './constants.js'

// Test constants
const TEST_HTML = '<html></html>'
const TEST_URL = 'https://example.com'
const TEST_TEXT = 'Test content for review'
const TEST_FILE_TYPE = 'text/plain'
const TEST_FILENAME = 'test.txt'
const ERROR_MSG_VALIDATION = 'Content too long'
const ERROR_MSG_NETWORK = 'Network error'
const ERROR_MSG_UPLOAD = 'File too large'
const ERROR_MSG_TIMEOUT = 'Connection timeout'
const ERROR_MSG_EXTRACTION = 'URL extraction failed'
const ERROR_MSG_BAD_REQUEST = 'Bad request'
const MOCK_REVIEW_ID = 'test-review-123'
const MOCK_URL_REVIEW_ID = 'url-review-789'
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_SERVER_ERROR = 500
const TEST_DESCRIPTION_NETWORK_ERRORS = 'should handle network errors'

let mockFetch
let mockElements
let mockLocation

beforeEach(() => {
  mockFetch = vi.fn()
  globalThis.fetch = mockFetch
  mockElements = {
    textContentInput: { value: '', disabled: false },
    uploadButton: { disabled: false },
    urlInput: { value: TEST_URL }
  }
  vi.spyOn(domElements, 'getElements').mockReturnValue(mockElements)
  vi.spyOn(domElements, 'getFileInput').mockReturnValue({
    value: TEST_FILENAME
  })
  vi.spyOn(uiFeedback, 'showProgress').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'hideProgress').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'showError').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'hideError').mockImplementation(() => {})
  vi.spyOn(reviewHistory, 'addReviewToHistory').mockImplementation(() => {})
  vi.spyOn(characterCounter, 'updateCharacterCount').mockImplementation(
    () => {}
  )
  vi.spyOn(inputControls, 'updateMutualExclusion').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mockLocation = { reload: vi.fn() }
  globalThis.location = mockLocation
  globalThis.updateReviewHistory = vi.fn()
  globalThis.startAutoRefresh = vi.fn()
  globalThis.sessionStorage = {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn()
  }
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('submitTextReview - success', () => {
  it('should successfully submit text review', async () => {
    const mockResponse = { reviewId: MOCK_REVIEW_ID, status: 'pending' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    const result = await apiClient.submitTextReview(TEST_TEXT)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/review/text',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent: TEST_TEXT })
      })
    )
    expect(result).toEqual(mockResponse)
    expect(uiFeedback.hideProgress).toHaveBeenCalled()
    expect(uiFeedback.hideError).toHaveBeenCalled()
  })

  it('should clear text input after successful submission and enable upload button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    mockElements.textContentInput.value = TEST_TEXT
    await apiClient.submitTextReview(TEST_TEXT)
    expect(mockElements.textContentInput.value).toBe('')
    expect(mockElements.uploadButton.disabled).toBe(false)
  })

  it('should clear text input after successful submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    mockElements.textContentInput.value = TEST_TEXT
    await apiClient.submitTextReview(TEST_TEXT)
    expect(mockElements.textContentInput.value).toBe('')
  })

  it('should add review to history after submission', async () => {
    const mockResponse = { reviewId: MOCK_REVIEW_ID, status: 'pending' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    await apiClient.submitTextReview(TEST_TEXT)
    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MOCK_REVIEW_ID,
        status: 'pending'
      })
    )
  })
})

describe('submitTextReview - errors', () => {
  it('should handle validation errors from the API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: ERROR_MSG_VALIDATION })
    })
    await expect(apiClient.submitTextReview(TEST_TEXT)).rejects.toThrow(
      ERROR_MSG_VALIDATION
    )
    expect(uiFeedback.showError).toHaveBeenCalledWith(ERROR_MSG_VALIDATION)
    expect(mockElements.textContentInput.disabled).toBe(false)
  })

  it('should handle server errors without message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: HTTP_STATUS_SERVER_ERROR,
      json: async () => ({})
    })
    await expect(apiClient.submitTextReview(TEST_TEXT)).rejects.toThrow(
      'Text review submission failed'
    )
  })

  it(TEST_DESCRIPTION_NETWORK_ERRORS, async () => {
    mockFetch.mockRejectedValueOnce(new Error(ERROR_MSG_NETWORK))
    await expect(apiClient.submitTextReview(TEST_TEXT)).rejects.toThrow(
      ERROR_MSG_NETWORK
    )
    expect(uiFeedback.showError).toHaveBeenCalled()
    expect(mockElements.textContentInput.disabled).toBe(false)
  })
})

describe('submitUrlReview - success', () => {
  it('should successfully submit URL review', async () => {
    const mockResponse = { reviewId: MOCK_URL_REVIEW_ID, status: 'pending' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    const result = await apiClient.submitUrlReview(TEST_HTML, TEST_URL)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/review/text',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('should generate slug from URL', async () => {
    const mockResponse = { reviewId: MOCK_URL_REVIEW_ID }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    await apiClient.submitUrlReview(TEST_HTML, TEST_URL)
    const callArgs = mockFetch.mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body.title).toMatch(/example-com/)
  })
})

describe('submitUrlReview - errors', () => {
  it('should handle URL extraction failures', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: ERROR_MSG_EXTRACTION })
    })
    await expect(
      apiClient.submitUrlReview(TEST_HTML, TEST_URL)
    ).rejects.toThrow(ERROR_MSG_EXTRACTION)
    expect(uiFeedback.showError).toHaveBeenCalledWith(ERROR_MSG_EXTRACTION)
  })

  it(TEST_DESCRIPTION_NETWORK_ERRORS, async () => {
    mockFetch.mockRejectedValueOnce(new Error(ERROR_MSG_TIMEOUT))
    await expect(
      apiClient.submitUrlReview(TEST_HTML, TEST_URL)
    ).rejects.toThrow(ERROR_MSG_TIMEOUT)
    expect(uiFeedback.showError).toHaveBeenCalled()
  })
})

describe('submitFileUpload - success', () => {
  it('should successfully upload a file', async () => {
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    const mockResponse = { reviewId: MOCK_REVIEW_ID, status: 'pending' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    const uploadPromise = apiClient.submitFileUpload(file)
    await vi.advanceTimersByTimeAsync(0)
    const result = await uploadPromise
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/upload',
      expect.objectContaining({
        method: 'POST'
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('should reload page after successful upload', async () => {
    const file = new File(['data'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    const uploadPromise = apiClient.submitFileUpload(file)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise
    await vi.advanceTimersByTimeAsync(RELOAD_DELAY)
    expect(mockLocation.reload).toHaveBeenCalled()
  })

  it('should show progress during file upload', async () => {
    const file = new File(['test'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    const uploadPromise = apiClient.submitFileUpload(file)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise
    expect(uiFeedback.showProgress).toHaveBeenCalledWith(
      'Uploading to server...',
      PROGRESS_INITIAL
    )
    expect(uiFeedback.showProgress).toHaveBeenCalledWith(
      'Processing upload...',
      PROGRESS_PROCESSING
    )
  })
})

describe('submitFileUpload - errors', () => {
  it('should handle file upload failures', async () => {
    const file = new File(['test'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: ERROR_MSG_UPLOAD })
    })
    const uploadPromise = apiClient.submitFileUpload(file).catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    const result = await uploadPromise
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe(ERROR_MSG_UPLOAD)
    expect(uiFeedback.showError).toHaveBeenCalled()
  })

  it(TEST_DESCRIPTION_NETWORK_ERRORS, async () => {
    const file = new File(['data'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockRejectedValueOnce(new Error(ERROR_MSG_NETWORK))
    const uploadPromise = apiClient.submitFileUpload(file).catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    const result = await uploadPromise
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe(ERROR_MSG_NETWORK)
  })

  it('should handle errors without file input element', async () => {
    vi.spyOn(domElements, 'getFileInput').mockReturnValue(null)
    const file = new File(['data'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: HTTP_STATUS_BAD_REQUEST,
      json: async () => ({ message: ERROR_MSG_BAD_REQUEST })
    })
    const uploadPromise = apiClient.submitFileUpload(file).catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    const result = await uploadPromise
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe(ERROR_MSG_BAD_REQUEST)
  })
})

describe('startAutoRefresh - forceStartAutoRefresh branch', () => {
  it('should call forceStartAutoRefresh when it is available', async () => {
    const mockResponse = { reviewId: MOCK_REVIEW_ID }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    globalThis.forceStartAutoRefresh = vi.fn()

    await apiClient.submitTextReview(TEST_TEXT)

    expect(globalThis.forceStartAutoRefresh).toHaveBeenCalled()
    expect(globalThis.startAutoRefresh).not.toHaveBeenCalled()
    delete globalThis.forceStartAutoRefresh
  })

  it('should call startAutoRefresh when forceStartAutoRefresh is absent', async () => {
    const mockResponse = { reviewId: MOCK_REVIEW_ID }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    delete globalThis.forceStartAutoRefresh

    await apiClient.submitTextReview(TEST_TEXT)

    expect(globalThis.startAutoRefresh).toHaveBeenCalled()
  })

  it('should log a warning when neither auto-refresh function is available', async () => {
    const mockResponse = { reviewId: MOCK_REVIEW_ID }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })
    delete globalThis.forceStartAutoRefresh
    delete globalThis.startAutoRefresh

    await apiClient.submitTextReview(TEST_TEXT)

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('No auto-refresh function found')
    )
    globalThis.startAutoRefresh = vi.fn()
  })
})

describe('handleReviewHistory - updateReviewHistory absent', () => {
  it('should not schedule updateReviewHistory when it is not a function', async () => {
    delete globalThis.updateReviewHistory
    const mockResponse = { reviewId: MOCK_REVIEW_ID }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    await apiClient.submitTextReview(TEST_TEXT)

    // No timer scheduled for updateReviewHistory — advance time and confirm no errors
    await vi.advanceTimersByTimeAsync(1000)
    globalThis.updateReviewHistory = vi.fn()
  })
})

describe('submitTextReview - JSON parse error message', () => {
  it('should show "Please enter a valid input" for JSON parse errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('not valid JSON received'))
    await expect(apiClient.submitTextReview(TEST_TEXT)).rejects.toThrow()
    expect(uiFeedback.showError).toHaveBeenCalledWith(
      'Please enter a valid input'
    )
  })

  it('should show "Please enter a valid input" for Unexpected token errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Unexpected token < in JSON'))
    await expect(apiClient.submitTextReview(TEST_TEXT)).rejects.toThrow()
    expect(uiFeedback.showError).toHaveBeenCalledWith(
      'Please enter a valid input'
    )
  })
})

describe('submitFileUpload - updateReviewHistory absent (addReviewToHistory fallback)', () => {
  it('should call addReviewToHistory directly when updateReviewHistory is not a function', async () => {
    delete globalThis.updateReviewHistory
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })

    const uploadPromise = apiClient.submitFileUpload(file)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ id: MOCK_REVIEW_ID, fileName: TEST_FILENAME })
    )
    globalThis.updateReviewHistory = vi.fn()
  })
})

describe('submitFileUpload - JSON parse error message', () => {
  it('should show "Upload failed: Please enter a valid input" for JSON errors', async () => {
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockRejectedValueOnce(new Error('not valid JSON received'))

    const uploadPromise = apiClient.submitFileUpload(file).catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise

    expect(uiFeedback.showError).toHaveBeenCalledWith(
      'Upload failed: Please enter a valid input'
    )
  })
})
