// API client for upload and review operations
import {
  PROGRESS_INITIAL,
  PROGRESS_PROCESSING,
  HISTORY_UPDATE_DELAY,
  PREVIEW_WORDS_LIMIT,
  PREVIEW_CHARS_LIMIT,
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

export async function submitFileUpload(file) {
  const elements = getElements()
  try {
    showProgress('Preparing upload...', PROGRESS_INITIAL)

    // Step 1: Ask our server to initiate a CDP Uploader session.
    // The server calls the CDP Uploader /initiate endpoint and returns the
    // URL the browser should POST the file to.
    const initiateResponse = await fetch('/upload/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: CREDENTIALS_SAME_ORIGIN,
      body: JSON.stringify({ filename: file.name, mimeType: file.type })
    })

    if (!initiateResponse.ok) {
      if (!redirectIfUnauthorised(initiateResponse)) {
        const errorMessage = await extractJsonErrorMessage(
          initiateResponse,
          'Failed to initiate upload'
        )
        throw new Error(errorMessage)
      }
      return
    }

    const { uploadUrl } = await initiateResponse.json()

    // Step 2: Submit the file directly to the CDP Uploader via a hidden form POST
    // (multipart/form-data, input name="file") to POST /upload-and-scan/{uploadId}.
    // The browser navigates to CDP Uploader, which virus-scans the file and stores
    // it in S3, then redirects the browser to /upload/status-poller.
    // The status-poller then calls /upload/trigger-review (step c) which fetches
    // the S3 details from the CDP Uploader status endpoint and forwards them to
    // the backend to start the processing pipeline.
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = uploadUrl
    form.enctype = 'multipart/form-data'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.name = 'file'
    const dt = new globalThis.DataTransfer()
    dt.items.add(file)
    fileInput.files = dt.files

    form.appendChild(fileInput)
    document.body.appendChild(form)
    form.submit()
    // Browser navigates away from this point — no further code runs here
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
