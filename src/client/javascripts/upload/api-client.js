// API client for upload and review operations
/* global sessionStorage */
import {
  PROGRESS_INITIAL,
  PROGRESS_PROCESSING,
  RELOAD_DELAY,
  REDIRECT_DELAY,
  HISTORY_UPDATE_DELAY,
  PREVIEW_WORDS_LIMIT,
  PREVIEW_CHARS_LIMIT
} from './constants.js'
import { getElements, getFileInput } from './dom-elements.js'
import { updateCharacterCount } from './character-counter.js'
import { updateMutualExclusion } from './input-controls.js'
import {
  showProgress,
  hideProgress,
  showError,
  hideError
} from './ui-feedback.js'
import { addReviewToHistory } from './review-history.js'

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
      credentials: 'same-origin',
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
    showError(error.message)
    if (elements.textContentInput) {
      elements.textContentInput.disabled = false
    }
    throw error
  }
}

export async function submitFileUpload(file) {
  try {
    showProgress('Uploading to server...', PROGRESS_INITIAL)
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    })
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
    showError(`Upload failed: ${error.message}`)
    const elements = getElements()
    if (elements.textContentInput) {
      elements.textContentInput.disabled = false
    }
    throw error
  }
}
