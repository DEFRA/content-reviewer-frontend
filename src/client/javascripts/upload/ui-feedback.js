// UI feedback: error, success, and progress messages
import { getElements } from './dom-elements.js'

const FORM_GROUP_ERROR_CLASS = 'govuk-form-group--error'
const TEXTAREA_ERROR_CLASS = 'govuk-textarea--error'
const INPUT_ERROR_CLASS = 'govuk-input--error'

export function showError(message) {
  hideSuccess()
  hideProgress()
  const elements = getElements()
  if (elements.errorSummary) {
    elements.errorSummary.hidden = false
  }
  if (elements.errorSummaryMessage) {
    elements.errorSummaryMessage.textContent = message
    elements.errorSummaryMessage.href = '#text-content'
  }
  if (elements.uploadError) {
    elements.uploadError.hidden = false
  }
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message
  }
  if (elements.textFormGroup) {
    elements.textFormGroup.classList.add(FORM_GROUP_ERROR_CLASS)
  }
  if (elements.textContentInput) {
    elements.textContentInput.classList.add(TEXTAREA_ERROR_CLASS)
  }
  if (elements.uploadButton) {
    elements.uploadButton.disabled = false
  }
  if (elements.textContentInput) {
    elements.textContentInput.focus()
  }
}

export function hideError() {
  const elements = getElements()
  if (elements.errorSummary) {
    elements.errorSummary.hidden = true
  }
  if (elements.uploadError) {
    elements.uploadError.hidden = true
  }
  if (elements.errorMessage) {
    elements.errorMessage.textContent = ''
  }
  if (elements.textFormGroup) {
    elements.textFormGroup.classList.remove(FORM_GROUP_ERROR_CLASS)
  }
  if (elements.textContentInput) {
    elements.textContentInput.classList.remove(TEXTAREA_ERROR_CLASS)
  }
}

export function showUrlError(message) {
  hideSuccess()
  const elements = getElements()
  if (elements.errorSummary) {
    elements.errorSummary.hidden = false
  }
  if (elements.errorSummaryMessage) {
    elements.errorSummaryMessage.textContent = message
    elements.errorSummaryMessage.href = '#url-input'
  }
  if (elements.urlError) {
    elements.urlError.hidden = false
  }
  if (elements.urlErrorMessage) {
    elements.urlErrorMessage.textContent = message
  }
  if (elements.urlFormGroup) {
    elements.urlFormGroup.classList.add(FORM_GROUP_ERROR_CLASS)
  }
  if (elements.urlInput) {
    elements.urlInput.classList.add(INPUT_ERROR_CLASS)
    elements.urlInput.focus()
  }
  if (elements.uploadButton) {
    elements.uploadButton.disabled = false
  }
}

export function hideUrlError() {
  const elements = getElements()
  if (elements.errorSummary) {
    elements.errorSummary.hidden = true
  }
  if (elements.urlError) {
    elements.urlError.hidden = true
  }
  if (elements.urlErrorMessage) {
    elements.urlErrorMessage.textContent = ''
  }
  if (elements.urlFormGroup) {
    elements.urlFormGroup.classList.remove(FORM_GROUP_ERROR_CLASS)
  }
  if (elements.urlInput) {
    elements.urlInput.classList.remove(INPUT_ERROR_CLASS)
  }
}

export function hideSuccess() {
  const elements = getElements()
  if (elements.uploadSuccess) {
    elements.uploadSuccess.hidden = true
  }
}

export function showProgress(statusText, percentage) {
  hideError()
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

export function showRadioError(message) {
  const elements = getElements()
  if (elements.actionSelectionGroup) {
    elements.actionSelectionGroup.classList.add(FORM_GROUP_ERROR_CLASS)
  }
  if (elements.actionOptionError) {
    elements.actionOptionError.hidden = false
  }
  if (elements.actionOptionErrorMessage) {
    elements.actionOptionErrorMessage.textContent = message
  }
  if (elements.errorSummary) {
    elements.errorSummary.hidden = false
  }
  if (elements.errorSummaryMessage) {
    elements.errorSummaryMessage.textContent = message
    elements.errorSummaryMessage.href = '#actionRadios'
  }
}

export function hideRadioError() {
  const elements = getElements()
  if (elements.actionSelectionGroup) {
    elements.actionSelectionGroup.classList.remove(FORM_GROUP_ERROR_CLASS)
  }
  if (elements.actionOptionError) {
    elements.actionOptionError.hidden = true
  }
  if (elements.actionOptionErrorMessage) {
    elements.actionOptionErrorMessage.textContent = ''
  }
}
