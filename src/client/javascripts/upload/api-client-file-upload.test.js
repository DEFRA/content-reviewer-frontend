import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as apiClient from './api-client.js'
import * as uiFeedback from './ui-feedback.js'
import * as reviewHistory from './review-history.js'
import * as domElements from './dom-elements.js'
import * as inputControls from './input-controls.js'
import { PROGRESS_INITIAL, PROGRESS_PROCESSING } from './constants.js'

const TEST_FILE_TYPE = 'text/plain'
const TEST_FILENAME = 'test.txt'
const ERROR_MSG_UPLOAD = 'File too large'
const ERROR_MSG_NETWORK = 'Network error'
const ERROR_MSG_BAD_REQUEST = 'Bad request'
const MOCK_REVIEW_ID = 'test-review-123'
const HTTP_STATUS_BAD_REQUEST = 400
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
    urlInput: { value: '' }
  }
  vi.spyOn(domElements, 'getElements').mockReturnValue(mockElements)
  vi.spyOn(domElements, 'getFileInput').mockReturnValue({
    value: TEST_FILENAME
  })
  vi.spyOn(uiFeedback, 'showProgress').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'hideProgress').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'showError').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'showDocumentError').mockImplementation(() => {})
  vi.spyOn(uiFeedback, 'hideError').mockImplementation(() => {})
  vi.spyOn(reviewHistory, 'addReviewToHistory').mockImplementation(() => {})
  vi.spyOn(inputControls, 'updateMutualExclusion').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mockLocation = { reload: vi.fn(), assign: vi.fn() }
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
    expect(uiFeedback.showDocumentError).toHaveBeenCalled()
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
  it('should show "Upload failed: Uploaded file could not be processed. Please ensure it is a valid PDF or Word document and try again." for JSON errors', async () => {
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockRejectedValueOnce(new Error('not valid JSON received'))

    const uploadPromise = apiClient.submitFileUpload(file).catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise

    expect(uiFeedback.showDocumentError).toHaveBeenCalledWith(
      'Upload failed: Uploaded file could not be processed. Please ensure it is a valid PDF or Word document and try again.'
    )
  })
})

describe('submitFileUpload - startAutoRefresh absent', () => {
  it('should skip startAutoRefresh call when globalThis.startAutoRefresh is not a function', async () => {
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })
    delete globalThis.startAutoRefresh

    const uploadPromise = apiClient.submitFileUpload(file)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise

    expect(uiFeedback.showError).not.toHaveBeenCalled()
    globalThis.startAutoRefresh = vi.fn()
  })
})

describe('submitFileUpload - fileInput absent in success path', () => {
  it('should not throw when getFileInput returns null after successful upload', async () => {
    vi.spyOn(domElements, 'getFileInput').mockReturnValue(null)
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reviewId: MOCK_REVIEW_ID })
    })

    const uploadPromise = apiClient.submitFileUpload(file)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise

    expect(uiFeedback.showError).not.toHaveBeenCalled()
  })
})

describe('submitFileUpload - uploadButton null in error catch', () => {
  it('should not throw when uploadButton is absent during catch', async () => {
    vi.spyOn(domElements, 'getElements').mockReturnValue({
      ...mockElements,
      uploadButton: null
    })
    const file = new File(['data'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: ERROR_MSG_UPLOAD })
    })

    const uploadPromise = apiClient.submitFileUpload(file).catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    const result = await uploadPromise

    expect(result).toBeInstanceOf(Error)
    expect(uiFeedback.showDocumentError).toHaveBeenCalled()
  })
})

describe('submitFileUpload - errorData.message absent (|| Upload failed fallback)', () => {
  it('should throw with Upload failed when errorData has no message', async () => {
    const file = new File(['data'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    })

    const uploadPromise = apiClient.submitFileUpload(file).catch((err) => err)
    await vi.advanceTimersByTimeAsync(0)
    const result = await uploadPromise

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('Upload failed')
  })
})

describe('submitFileUpload - data.id fallback when reviewId absent (in else/addReviewToHistory path)', () => {
  it('should use data.id when data.reviewId is absent in the addReviewToHistory else path', async () => {
    delete globalThis.updateReviewHistory
    const file = new File(['content'], TEST_FILENAME, { type: TEST_FILE_TYPE })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'fallback-id-456' })
    })

    const uploadPromise = apiClient.submitFileUpload(file)
    await vi.advanceTimersByTimeAsync(0)
    await uploadPromise

    expect(reviewHistory.addReviewToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fallback-id-456' })
    )
    globalThis.updateReviewHistory = vi.fn()
  })
})
