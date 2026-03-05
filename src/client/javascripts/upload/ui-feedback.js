// UI feedback: error, success, and progress messages
import { getElements } from './dom-elements.js'

export function showError(message) {
  hideSuccess()
  hideProgress()
  const elements = getElements()
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

export function hideError() {
  const elements = getElements()
  if (elements.uploadError) {
    elements.uploadError.hidden = true
  }
}

export function hideSuccess() {
  const elements = getElements()
  if (elements.uploadSuccess) {
    elements.uploadSuccess.hidden = true
  }
}

export function showProgress(statusText, percentage) {
  const elements = getElements()
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

export function hideProgress() {
  const elements = getElements()
  if (elements.uploadProgress) {
    elements.uploadProgress.hidden = true
  }
  if (elements.progressBar) {
    elements.progressBar.dataset.progress = '0'
  }
}
