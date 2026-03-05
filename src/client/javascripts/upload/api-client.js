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
import { showProgress, hideProgress, showError } from './ui-feedback.js'
import { addReviewToHistory } from './review-history.js'

export async function submitTextReview(textContent) {
  try {
    const elements = getElements()
    if (elements.textContentInput) {
      elements.textContentInput.disabled = true
    }
    showProgress('Submitting content for review...', PROGRESS_INITIAL)
    const words = textContent.trim().split(/\s+/)
    const previewText =
      words.length > 0
        ? `${words.slice(0, PREVIEW_WORDS_LIMIT).join(' ').substring(0, PREVIEW_CHARS_LIMIT)}...`
        : 'Text content'
    const response = await fetch('/api/review/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    elements.textContentInput.value = ''
    updateMutualExclusion()
    updateCharacterCount()
    if (elements.uploadButton) {
      elements.uploadButton.disabled = false
    }
    if (typeof globalThis.updateReviewHistory === 'function') {
      setTimeout(() => globalThis.updateReviewHistory(), HISTORY_UPDATE_DELAY)
    } else {
      addReviewToHistory({
        id: data.reviewId || data.id,
        fileName: previewText,
        timestamp: Date.now(),
        status: 'pending'
      })
    }
    // Start auto-refresh to track review status (force restart to ensure it's running)
    if (typeof globalThis.forceStartAutoRefresh === 'function') {
      globalThis.forceStartAutoRefresh()
    } else if (typeof globalThis.startAutoRefresh === 'function') {
      globalThis.startAutoRefresh()
    }
    return data
  } catch (error) {
    console.error('[UPLOAD-HANDLER] Text review error:', error)
    showError(error.message)
    const elements = getElements()
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
