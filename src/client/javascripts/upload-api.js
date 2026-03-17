// API submission functions
import {
  CHARACTER_LIMIT,
  PROGRESS_INITIAL,
  PROGRESS_PROCESSING,
  HISTORY_UPDATE_DELAY,
  REDIRECT_DELAY,
  RELOAD_DELAY,
  PREVIEW_WORDS_LIMIT,
  PREVIEW_CHARS_LIMIT
} from './upload-constants.js'
import { showProgress, hideProgress, showError } from './upload-ui-state.js'
import { getFileInput, updateMutualExclusion } from './upload-input-manager.js'
import { addReviewToHistory } from './upload-history.js'

let elements = {}

export function setElements(els) {
  elements = els
}

function generatePreviewText(textContent) {
  const words = textContent.trim().split(/\s+/)
  return words.length > 0
    ? `${words.slice(0, PREVIEW_WORDS_LIMIT).join(' ').substring(0, PREVIEW_CHARS_LIMIT)}...`
    : 'Text content'
}

function cleanupAfterTextReview() {
  hideProgress()
  elements.textContentInput.value = ''
  updateMutualExclusion()
  if (typeof elements.updateCharacterCount === 'function') {
    elements.updateCharacterCount()
  }
  if (elements.uploadButton) {
    elements.uploadButton.disabled = false
  }
}

function handleReviewHistoryUpdate(data, previewText) {
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
  if (typeof globalThis.startAutoRefresh === 'function') {
    globalThis.startAutoRefresh()
  }
}

export async function submitTextReview(textContent) {
  try {
    if (elements.textContentInput) {
      elements.textContentInput.disabled = true
    }
    showProgress('Submitting content for review...', PROGRESS_INITIAL)
    const previewText = generatePreviewText(textContent)
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
    cleanupAfterTextReview()
    handleReviewHistoryUpdate(data, previewText)
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
    setTimeout(() => {
      globalThis.location.reload()
    }, RELOAD_DELAY)
    return data
  } catch (error) {
    console.error('[UPLOAD-HANDLER] Upload error:', error)
    showError(`Upload failed: ${error.message}`)
    if (elements.textContentInput) {
      elements.textContentInput.disabled = false
    }
    throw error
  }
}

export async function handleFormSubmit(e) {
  e.preventDefault()
  const { hideError: hideErr, hideSuccess: hideSucc } =
    await import('./upload-ui-state.js')
  hideErr()
  hideSucc()
  if (elements.uploadButton) {
    elements.uploadButton.disabled = true
  }
  const file = getFileInput()?.files?.[0]
  const textContent = elements.textContentInput?.value?.trim()

  // Helper function for error handling and button state
  function handleError(message) {
    showError(message)
    if (elements.uploadButton) {
      elements.uploadButton.disabled = false
    }
  }

  try {
    if (file && !textContent) {
      await submitFileUpload(file)
      return
    }
    if (textContent && !file) {
      if (textContent.length > CHARACTER_LIMIT) {
        handleError(
          `Text content too long. Maximum ${CHARACTER_LIMIT} characters. Your content has ${textContent.length} characters.`
        )
        return
      }
      await submitTextReview(textContent)
      return
    }
    handleError('Enter text content for review')
  } catch (error) {
    console.error('[UPLOAD-HANDLER] Form submission error:', error)
  }
}
