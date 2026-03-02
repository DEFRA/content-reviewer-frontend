// Upload form handler
const DEFAULT_CHARACTER_LIMIT = 100000
const CHARACTER_LIMIT =
  globalThis.contentReviewMaxCharLength || DEFAULT_CHARACTER_LIMIT
const GOVUK_ERROR_MESSAGE_CLASS = 'govuk-error-message'
const STYLE_DISPLAY_NONE = 'none'
const STYLE_DISPLAY_DEFAULT = ''
const APP_DISABLED_CLASS = 'app-disabled'
const APP_HIGHLIGHT_CLASS = 'app-highlight'
const ARIA_DISABLED_ATTR = 'aria-disabled'
const FORM_GROUP_SELECTOR = '.govuk-form-group'
const GOVUK_TABLE_CELL_CLASS = 'govuk-table__cell'
const PROGRESS_INITIAL = 30
const PROGRESS_PROCESSING = 70
const RELOAD_DELAY = 1500
const REDIRECT_DELAY = 500
const HISTORY_UPDATE_DELAY = 500
const PREVIEW_WORDS_LIMIT = 3
const PREVIEW_CHARS_LIMIT = 50
const elements = {}
let fileClearBtn, textClearBtn

function initializeElements() {
  elements.textContentInput = document.getElementById('text-content')
  elements.characterCountMessage = document.getElementById(
    'characterCountMessage'
  )
  elements.uploadButton = document.getElementById('uploadButton')
  elements.uploadProgress = document.getElementById('uploadProgress')
  elements.progressBar = document.getElementById('progressBar')
  elements.uploadStatusText = document.getElementById('uploadStatusText')
  elements.uploadProgressText = document.getElementById('uploadProgressText')
  elements.uploadError = document.getElementById('uploadError')
  elements.uploadSuccess = document.getElementById('uploadSuccess')
  elements.errorMessage = document.getElementById('errorMessage')
  elements.form = document.getElementById('uploadForm')
}
function getFileInput() {
  return document.getElementById('file-upload')
}
function updateCharacterCount() {
  if (!elements.textContentInput || !elements.characterCountMessage) {
    return
  }
  const currentLength = elements.textContentInput.value.length
  if (currentLength === 0) {
    clearCharacterCount()
    return
  }
  elements.characterCountMessage.style.display = STYLE_DISPLAY_DEFAULT
  const remaining = CHARACTER_LIMIT - currentLength
  if (remaining >= 0) {
    showRemainingCharacters(remaining)
  } else {
    showExcessCharacters(remaining)
  }
}
function clearCharacterCount() {
  elements.characterCountMessage.textContent = ''
  elements.characterCountMessage.style.display = STYLE_DISPLAY_NONE
  elements.characterCountMessage.classList.remove(GOVUK_ERROR_MESSAGE_CLASS)
}
function showRemainingCharacters(remaining) {
  elements.characterCountMessage.textContent = `${remaining} characters remaining`
  elements.characterCountMessage.classList.remove(GOVUK_ERROR_MESSAGE_CLASS)
}
function showExcessCharacters(remaining) {
  const excess = Math.abs(remaining)
  elements.characterCountMessage.textContent = `You have ${excess} characters too many`
  elements.characterCountMessage.classList.add(GOVUK_ERROR_MESSAGE_CLASS)
}
function addClearButton(input, label, onClear) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = label
  btn.className =
    'govuk-button govuk-button--secondary govuk-!-margin-left-2 app-clear-button'
  btn.addEventListener('click', onClear)
  input.parentNode.appendChild(btn)
  return btn
}
function initializeFileInput() {
  const fileInput = getFileInput()
  if (!fileInput) {
    return
  }
  fileClearBtn?.remove()
  fileClearBtn = addClearButton(fileInput, 'Clear File', () => {
    const currentFileInput = getFileInput()
    if (currentFileInput) {
      currentFileInput.value = ''
      currentFileInput.disabled = false
    }
    updateMutualExclusion()
  })
  fileInput.addEventListener('change', updateMutualExclusion)
  updateMutualExclusion()
}
function initializeTextInput() {
  if (!elements.textContentInput) {
    return
  }
  textClearBtn?.remove()
  textClearBtn = addClearButton(elements.textContentInput, 'Clear text', () => {
    elements.textContentInput.value = ''
    elements.textContentInput.disabled = false
    updateMutualExclusion()
    updateCharacterCount()
  })
  if (
    elements.characterCountMessage &&
    textClearBtn &&
    elements.characterCountMessage.parentNode ===
      elements.textContentInput.parentNode
  ) {
    elements.characterCountMessage.parentNode.insertBefore(
      textClearBtn,
      elements.characterCountMessage.nextSibling
    )
  }
  if (textClearBtn) {
    textClearBtn.disabled = false
  }
}
function hasFileSelected() {
  const fileInput = getFileInput()
  return fileInput?.files?.length > 0
}
function hasTextEntered() {
  return (
    elements.textContentInput && elements.textContentInput.value.trim() !== ''
  )
}
function toggleInput(input, isDisabled, groupClass, clearBtn) {
  if (!input) {
    return
  }
  input.disabled = isDisabled
  input.setAttribute(ARIA_DISABLED_ATTR, isDisabled.toString())
  const group = input.closest(FORM_GROUP_SELECTOR)
  if (group) {
    if (isDisabled) {
      group.classList.add(groupClass)
    } else {
      group.classList.remove(groupClass)
    }
  }
  if (clearBtn) {
    clearBtn.disabled = isDisabled
  }
}
function highlightInput(input, shouldHighlight) {
  if (!input) {
    return
  }
  const group = input.closest(FORM_GROUP_SELECTOR)
  if (group) {
    if (shouldHighlight) {
      group.classList.add(APP_HIGHLIGHT_CLASS)
    } else {
      group.classList.remove(APP_HIGHLIGHT_CLASS)
    }
  }
}
function updateMutualExclusion() {
  const hasFile = hasFileSelected()
  const hasText = hasTextEntered()
  const fileInput = getFileInput()
  if (hasFile && !hasText) {
    toggleInput(
      elements.textContentInput,
      true,
      APP_DISABLED_CLASS,
      textClearBtn
    )
    highlightInput(fileInput, true)
    highlightInput(elements.textContentInput, false)
  } else if (hasText && !hasFile) {
    toggleInput(fileInput, true, APP_DISABLED_CLASS, fileClearBtn)
    highlightInput(elements.textContentInput, true)
    highlightInput(fileInput, false)
  } else {
    // Neither file nor text present, or both present - enable both inputs
    toggleInput(fileInput, false, APP_DISABLED_CLASS, fileClearBtn)
    toggleInput(
      elements.textContentInput,
      false,
      APP_DISABLED_CLASS,
      textClearBtn
    )
    highlightInput(fileInput, false)
    highlightInput(elements.textContentInput, false)
  }
}
function showError(message) {
  hideSuccess()
  hideProgress()
  if (elements.uploadError) {
    elements.uploadError.hidden = false
  }
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message
  }
  if (elements.uploadButton) {
    elements.uploadButton.disabled = false
  }
}
function hideError() {
  if (elements.uploadError) {
    elements.uploadError.hidden = true
  }
}
function hideSuccess() {
  if (elements.uploadSuccess) {
    elements.uploadSuccess.hidden = true
  }
}
function showProgress(statusText, percentage) {
  if (elements.uploadStatusText) {
    elements.uploadStatusText.textContent = statusText
  }
  if (elements.uploadProgressText) {
    elements.uploadProgressText.textContent = `${percentage}%`
  }
  if (elements.progressBar) {
    elements.progressBar.dataset.progress = Math.round(percentage).toString()
  }
  if (elements.uploadProgress) {
    elements.uploadProgress.hidden = false
  }
}
function hideProgress() {
  if (elements.uploadProgress) {
    elements.uploadProgress.hidden = true
  }
  if (elements.progressBar) {
    elements.progressBar.dataset.progress = '0'
  }
}
function addReviewToHistory(review) {
  const tbody = document.querySelector('#reviewHistoryBody')
  if (!tbody) {
    return
  }
  tbody.prepend(createReviewRow(review))
  enforceTableLimit()
}
function createReviewRow(review) {
  const row = document.createElement('tr')
  row.dataset.reviewId = review.id || review.reviewId
  ;[
    createTextCell(review.fileName || review.filename || 'N/A'),
    createStatusCell(review),
    createTimestampCell(review),
    createResultCell(review),
    createActionCell(review)
  ].forEach((cell) => row.appendChild(cell))
  return row
}
function createTextCell(text) {
  const cell = document.createElement('td')
  cell.className = GOVUK_TABLE_CELL_CLASS
  cell.textContent = text
  return cell
}
function createStatusCell(review) {
  const cell = document.createElement('td')
  const tag = document.createElement('strong')
  cell.className = GOVUK_TABLE_CELL_CLASS
  tag.className = 'govuk-tag'
  const status = (review.status || 'pending').toLowerCase()
  const statusMap = {
    completed: ['govuk-tag--green', 'Completed'],
    processing: ['govuk-tag--blue', 'Processing...'],
    pending: ['govuk-tag--yellow', 'Pending...'],
    failed: ['govuk-tag--red', 'Failed']
  }
  if (statusMap[status]) {
    tag.classList.add(statusMap[status][0])
    tag.textContent = statusMap[status][1]
  } else {
    tag.classList.add('govuk-tag--grey')
    tag.textContent = status.charAt(0).toUpperCase() + status.slice(1)
  }
  cell.appendChild(tag)
  return cell
}
function createTimestampCell(review) {
  const cell = document.createElement('td')
  cell.className = GOVUK_TABLE_CELL_CLASS
  const timestamp = review.uploadedAt || review.timestamp
  if (timestamp) {
    const date = new Date(timestamp)
    cell.textContent = date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } else {
    cell.textContent = 'N/A'
  }
  return cell
}
function createResultCell(review) {
  const cell = document.createElement('td')
  cell.className = GOVUK_TABLE_CELL_CLASS
  const status = (review.status || 'pending').toLowerCase()
  if (status === 'completed') {
    const link = document.createElement('a')
    link.href = `/review/results/${review.id || review.reviewId}`
    link.textContent = 'View results'
    link.className = 'govuk-link'
    cell.appendChild(link)
  } else if (status === 'processing' || status === 'pending') {
    cell.textContent = '-'
  } else if (status === 'failed') {
    const span = document.createElement('span')
    span.className = 'govuk-error-message'
    span.textContent = review.errorMessage || 'Review Failed'
    cell.appendChild(span)
  } else {
    cell.textContent = 'Unknown'
  }
  return cell
}
function createActionCell(review) {
  const cell = document.createElement('td')
  const btn = document.createElement('button')
  cell.className = GOVUK_TABLE_CELL_CLASS
  btn.type = 'button'
  btn.className = 'govuk-link delete-review-btn'
  btn.textContent = 'Delete'
  btn.dataset.reviewId = review.id || review.reviewId
  btn.dataset.filename = review.fileName || review.filename || 'N/A'
  cell.appendChild(btn)
  return cell
}
function enforceTableLimit() {
  const limitSelect = document.getElementById('historyLimit')
  const tbody = document.querySelector('#reviewHistoryBody')
  if (!tbody) {
    return
  }
  const currentLimit = Number.parseInt(limitSelect?.value || '5', 10)
  const rows = tbody.querySelectorAll('tr')
  if (rows.length > currentLimit) {
    Array.from(rows)
      .slice(currentLimit)
      .forEach((row) => row.remove())
  }
}
async function submitTextReview(textContent) {
  try {
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
async function submitFileUpload(file) {
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
async function handleFormSubmit(e) {
  e.preventDefault()
  hideError()
  hideSuccess()
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
function initialize() {
  initializeElements()
  if (!elements.form) {
    return
  }
  if (elements.textContentInput) {
    elements.textContentInput.addEventListener('input', updateCharacterCount)
    updateCharacterCount()
  }
  hideError()
  hideProgress()
  hideSuccess()
  updateCharacterCount()
  initializeFileInput()
  initializeTextInput()
  elements.form.addEventListener('submit', handleFormSubmit)
  console.log('[UPLOAD-HANDLER] Upload handler initialized')
}
document.addEventListener('DOMContentLoaded', initialize)
