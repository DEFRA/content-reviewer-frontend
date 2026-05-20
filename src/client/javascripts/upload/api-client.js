// API client for upload and review operations
import {
  PROGRESS_INITIAL,
  PROGRESS_SCANNING,
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
    showProgress('Preparing upload...', PROGRESS_INITIAL)

    // Step 1: Ask our server to initiate a CDP Uploader session.
    // Returns { uploadUrl, reviewId }. The server registers a callbackUrl so
    // CDP Uploader calls the backend /upload-callback automatically after
    // scanning — no frontend status-poller step is needed.
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

    const { uploadUrl, reviewId } = await initiateResponse.json()

    // Add a pending history entry immediately so the user sees the review
    // listed as Pending when they return to the homepage after the upload.
    // Auto-refresh updates the status once the backend has processed the file.
    const displayName = getDisplayFileName(file.name)
    handleReviewHistory({ reviewId }, displayName)
    startAutoRefresh()

    // Step 2: Submit the file directly to CDP Uploader via a hidden iframe form POST.
    // Using an iframe keeps the user on the homepage — they see our progress message
    // instead of CDP Uploader's blank loading page. The file bytes go directly from
    // the browser to CDP Uploader (no data touches our server before virus scanning).
    // CDP Uploader scans it, calls the backend /upload-callback (server-to-server),
    // then redirects the iframe to the homepage (same-origin). We detect that redirect,
    // clean up, and reload the main page to show the updated review history.
    const iframe = document.createElement('iframe')
    iframe.name = 'cdp-upload-frame'
    iframe.style.display = 'none'
    document.body.appendChild(iframe)

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = uploadUrl
    form.enctype = 'multipart/form-data'
    form.target = 'cdp-upload-frame'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.name = 'file'
    const dt = new globalThis.DataTransfer()
    dt.items.add(file)
    fileInput.files = dt.files

    form.appendChild(fileInput)
    document.body.appendChild(form)

    showProgress(
      'Uploading and scanning document — please wait...',
      PROGRESS_SCANNING
    )

    iframe.addEventListener('load', () => {
      try {
        // When CDP Uploader finishes and redirects back to our app the iframe
        // becomes same-origin and contentWindow.location is readable. While the
        // iframe is on CDP Uploader (cross-origin) this throws — we just wait.
        const redirectedTo = iframe.contentWindow.location.href
        if (redirectedTo) {
          iframe.remove()
          form.remove()
          globalThis.location.reload()
        }
      } catch {
        // Still on CDP Uploader (cross-origin) — redirect not yet complete
      }
    })

    form.submit()
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
