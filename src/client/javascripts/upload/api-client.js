// API client for upload and review operations
import {
  PROGRESS_INITIAL,
  PROGRESS_PROCESSING,
  HISTORY_UPDATE_DELAY,
  PREVIEW_WORDS_LIMIT,
  PREVIEW_CHARS_LIMIT,
  FILENAME_WORDS_LIMIT,
  CREDENTIALS_SAME_ORIGIN,
  SLUG_MAX_LENGTH
} from './constants.js'
import { getElements } from './dom-elements.js'
import { updateCharacterCount } from './character-counter.js'
import { updateMutualExclusion } from './input-controls.js'
import {
  showProgress,
  hideProgress,
  showError,
  showUrlError,
  showDocumentError,
  hideError
} from './ui-feedback.js'
import { addReviewToHistory } from './review-history.js'

const JSON_PARSE_ERROR_PATTERNS = ['not valid JSON', 'Unexpected token']
const HTTP_UNAUTHORISED = 401

function redirectIfUnauthorised(response) {
  if (response.status === HTTP_UNAUTHORISED) {
    globalThis.location.assign('/auth/login')
    return true
  }
  return false
}

async function extractJsonErrorMessage(response, defaultMessage) {
  try {
    const errorData = await response.json()
    return errorData.message || defaultMessage
  } catch {
    return defaultMessage
  }
}

function getPreviewText(textContent) {
  const words = textContent.trim().split(/\s+/)
  return words.length > 0
    ? `${words.slice(0, PREVIEW_WORDS_LIMIT).join(' ').substring(0, PREVIEW_CHARS_LIMIT)}...`
    : 'Text content'
}

function handleReviewHistory(data, previewText) {
  // Always add pending entry immediately for instant visual feedback
  addReviewToHistory({
    id: data.reviewId || data.id,
    fileName: previewText,
    timestamp: Date.now(),
    status: 'pending'
  })

  // Also trigger a refresh after a delay to update from server
  if (typeof globalThis.updateReviewHistory === 'function') {
    setTimeout(() => globalThis.updateReviewHistory(), HISTORY_UPDATE_DELAY)
  }
}

function startAutoRefresh() {
  if (typeof globalThis.forceStartAutoRefresh === 'function') {
    globalThis.forceStartAutoRefresh()
    return
  }
  if (typeof globalThis.startAutoRefresh === 'function') {
    globalThis.startAutoRefresh()
  }
}

export async function submitUrlReview(sourceUrl) {
  const elements = getElements()
  try {
    showProgress('Submitting URL for review...', PROGRESS_INITIAL)
    const slug = sourceUrl
      .replace(/^https?:\/\//, '')
      .replaceAll(/[^a-z0-9]/gi, '-')
      .replaceAll(/-+/g, '-')
      .substring(0, SLUG_MAX_LENGTH)
    const fileName = `${slug}.html`
    const response = await fetch('/api/review/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: CREDENTIALS_SAME_ORIGIN,
      body: JSON.stringify({ url: sourceUrl })
    })
    showProgress('Processing review...', PROGRESS_PROCESSING)
    if (!response.ok) {
      if (redirectIfUnauthorised(response)) {
        return undefined
      }
      const message = await extractJsonErrorMessage(
        response,
        'URL review upload failed'
      )
      throw new Error(message)
    }
    const data = await response.json()
    hideProgress()
    handleReviewHistory(data, fileName)
    startAutoRefresh()
    return data
  } catch (error) {
    const userMessage = JSON_PARSE_ERROR_PATTERNS.some((p) =>
      error.message.includes(p)
    )
      ? 'The review service returned an unexpected response. Please try again.'
      : error.message
    showUrlError(userMessage)
    if (elements.uploadButton) {
      elements.uploadButton.disabled = false
    }
    throw error
  }
}

export async function submitTextReview(textContent) {
  const elements = getElements()
  try {
    if (elements.textContentInput) {
      elements.textContentInput.disabled = true
    }
    showProgress('Submitting content for review...', PROGRESS_INITIAL)
    const previewText = getPreviewText(textContent)
    const response = await fetch('/api/review/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: CREDENTIALS_SAME_ORIGIN,
      body: JSON.stringify({ textContent })
    })
    if (!response.ok) {
      if (redirectIfUnauthorised(response)) {
        return undefined
      }
      const errorData = await response.json()
      throw new Error(errorData.message || 'Text review submission failed')
    }
    showProgress('Processing review...', PROGRESS_PROCESSING)
    const data = await response.json()
    hideProgress()
    hideError()
    elements.textContentInput.value = ''
    updateMutualExclusion()
    updateCharacterCount()
    if (elements.uploadButton) {
      elements.uploadButton.disabled = false
    }
    handleReviewHistory(data, previewText)
    startAutoRefresh()
    return data
  } catch (error) {
    const userMessage = JSON_PARSE_ERROR_PATTERNS.some((p) =>
      error.message.includes(p)
    )
      ? 'Please enter a valid input'
      : error.message
    showError(userMessage)
    if (elements.textContentInput) {
      elements.textContentInput.disabled = false
    }
    throw error
  }
}

function getDisplayFileName(fileName) {
  const lastDot = fileName.lastIndexOf('.')
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName
  const ext = lastDot > 0 ? fileName.slice(lastDot) : ''
  const words = base.split(/[\s_-]+/).filter(Boolean)
  if (words.length <= FILENAME_WORDS_LIMIT) {
    return fileName
  }
  return `${words.slice(0, FILENAME_WORDS_LIMIT).join(' ')}...${ext}`
}

export async function submitFileUpload(file) {
  const elements = getElements()
  try {
    showProgress(
      'Uploading and scanning document — please wait...',
      PROGRESS_INITIAL
    )

    // POST the file to our own server as a same-origin multipart request.
    // The server proxies it to CDP Uploader server-to-server, avoiding the
    // CORS restriction that blocks direct browser-to-CDP fetch calls.
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/review/file', {
      method: 'POST',
      body: formData,
      credentials: CREDENTIALS_SAME_ORIGIN
    })

    if (!response.ok) {
      if (redirectIfUnauthorised(response)) {
        return undefined
      }
      const message = await extractJsonErrorMessage(
        response,
        'File upload failed'
      )
      throw new Error(message)
    }

    const data = await response.json()
    hideProgress()

    const displayName = getDisplayFileName(file.name)
    handleReviewHistory(data, displayName)
    startAutoRefresh()

    if (elements.uploadButton) {
      elements.uploadButton.disabled = false
    }
    return data
  } catch (error) {
    hideProgress()
    const userMessage = JSON_PARSE_ERROR_PATTERNS.some((p) =>
      error.message.includes(p)
    )
      ? 'Uploaded file could not be processed. Please ensure it is a valid PDF or Word document and try again.'
      : error.message
    showDocumentError(`Upload failed: ${userMessage}`)
    if (elements.uploadButton) {
      elements.uploadButton.disabled = false
    }
    throw error
  }
}
