// API client for upload and review operations
/* global sessionStorage */
import {
  PROGRESS_INITIAL,
  PROGRESS_PROCESSING,
  RELOAD_DELAY,
  REDIRECT_DELAY,
  HISTORY_UPDATE_DELAY,
  PREVIEW_WORDS_LIMIT,
  PREVIEW_CHARS_LIMIT,
  CREDENTIALS_SAME_ORIGIN,
  SLUG_MAX_LENGTH
} from './constants.js'
import { getElements, getFileInput } from './dom-elements.js'
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
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

const JSON_PARSE_ERROR_PATTERNS = ['not valid JSON', 'Unexpected token']

const ENDPOINT_CALLBACK = '/upload-callback'
const serverUrl = 'http://localhost:3001'
  const rawS3Path = 'content-uploads'
  const callbackUrl = `${serverUrl}${ENDPOINT_CALLBACK}`
  const CDP_UPLOADER = 'https://cdp-uploader.dev.cdp-int.defra.cloud'
  const S3_BUCKET = 'dev-service-optimisation-c63f2'


async function extractJsonErrorMessage(response, contentType, defaultMessage) {
  try {
    const errorData = await response.json()
    return errorData.message || defaultMessage
  } catch {
    // Response body is not valid JSON — keep default message and log for diagnosis
    console.error(
      '[UPLOAD-HANDLER] Non-JSON error response from /api/review/text',
      { status: response.status, contentType }
    )
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
  } else if (typeof globalThis.startAutoRefresh === 'function') {
    globalThis.startAutoRefresh()
  } else {
    // No auto-refresh function available
    console.warn(
      '[UPLOAD-HANDLER] No auto-refresh function found on globalThis.'
    )
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
      const contentType = response.headers?.get('content-type') ?? ''
      const message = await extractJsonErrorMessage(
        response,
        contentType,
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
    console.error('[UPLOAD-HANDLER] URL review upload error:', error)
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
      const errorData = await response.json()
      throw new Error(errorData.message || 'Text review submission failed')
    }
    showProgress('Processing review...', PROGRESS_PROCESSING)
    const data = await response.json()
    console.log('[UPLOAD-HANDLER] Text review submitted successfully:', data)
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
    console.error('[UPLOAD-HANDLER] Text review error:', error)
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
  try {
    showProgress('Uploading to server...', PROGRESS_INITIAL)
   
    //initiate cdp upload
  //   const serverUrl = (config.get('serverUrl') || '').replace(/\/$/, '')
  // const rawS3Path = config.get('s3.s3Path')
  // const callbackUrl = `${serverUrl}${ENDPOINT_CALLBACK}`
   const redirectUrl = `/upload-success?reviewId=${encodeURIComponent('123')}`
  // const CDP_UPLOADER = (config.get('cdpUploader.url') || '').replace(
  //     /\/$/,
  //     ''
  //   )
  // const S3_BUCKET = config.get('s3.bucket')

  const initBody = {
    s3Bucket: S3_BUCKET,
    s3Path: rawS3Path,
    redirect: redirectUrl,
    callback: callbackUrl,
    mimeTypes: ACCEPTED_MIME_TYPES,
    maxFileSize: MAX_FILE_BYTES,
    metadata: { reviewId: '123' } // This can be used to correlate the callback with the review
  }

  const initResp = await fetch(`${CDP_UPLOADER}/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'content-reviewer-backend'
    },
    body: JSON.stringify(initBody)
  })

    if (!initResp.ok) {
    const txt = await initResp.text().catch(() => '')
    logger.error(
      { status: initResp.status, body: txt },
      'cdp-uploader /initiate failed'
    )
    throw new Error(`cdp-uploader /initiate failed: ${initResp.status}`)
  }

  const initJson = await initResp.json().catch(() => ({}))
  const { uploadId, uploadUrl } = initJson
  
  // upload and scan file using cdp-uploader
  const uploadAndScanUrl = new URL(uploadUrl, CDP_UPLOADER).href
    const formData = new FormData()
    formData.append('file', file)

   const uploadRes = await fetch(uploadAndScanUrl, {
      method: 'POST',
      body: formData,
      redirect: 'follow'
    })
    if (!uploadRes.ok) {
      const txt = await uploadRes.text().catch(() => '')
      logger.error(
        { status: uploadRes.status, body: txt },
        'cdp-uploader /upload-and-scan failed'
      )
      throw new Error(
        `cdp-uploader /upload-and-scan failed: ${uploadRes.status}`
      )
    }

    showProgress('Processing upload...', PROGRESS_PROCESSING)
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Upload failed')
    }
    const data = await response.json()
    console.log('[UPLOAD-HANDLER] File uploaded successfully:', data)
    hideProgress()
    const fileInputEl = getFileInput()
    if (fileInputEl) {
      fileInputEl.value = ''
    }
    updateMutualExclusion()
    if (typeof globalThis.updateReviewHistory === 'function') {
      setTimeout(() => globalThis.updateReviewHistory(), REDIRECT_DELAY)
    } else {
      addReviewToHistory({
        id: data.reviewId || data.id,
        fileName: file.name,
        timestamp: Date.now(),
        status: 'pending'
      })
    }
    // Start auto-refresh to track review status
    if (typeof globalThis.startAutoRefresh === 'function') {
      globalThis.startAutoRefresh()
    }
    // Set flag so page reload will start auto-refresh
    sessionStorage.setItem('reviewJustSubmitted', 'true')
    setTimeout(() => {
      globalThis.location.reload()
    }, RELOAD_DELAY)
    return data
  } catch (error) {
    console.error('[UPLOAD-HANDLER] Upload error:', error)
    const userMessage = JSON_PARSE_ERROR_PATTERNS.some((p) =>
      error.message.includes(p)
    )
      ? 'Please enter a valid input'
      : error.message
    showDocumentError(`Upload failed: ${userMessage}`)
    const elements = getElements()
    if (elements.uploadButton) {
      elements.uploadButton.disabled = false
    }
    throw error
  }
}
