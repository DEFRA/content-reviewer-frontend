// Form submission handler
import { CHARACTER_LIMIT } from './constants.js'
import { getElements, getFileInput } from './dom-elements.js'
import {
  hideError,
  hideSuccess,
  showError,
  showUrlError,
  hideUrlError,
  showRadioError,
  hideRadioError
} from './ui-feedback.js'
import {
  submitTextReview,
  submitFileUpload,
  submitUrlReview
} from './api-client.js'
import { parseGovUkUrl, extractGovspeakText } from './url-extractor.js'
import { getSelectedAction } from './radio-handler.js'

const ERROR_ENTER_TEXT = 'Enter text content for review'
const ERROR_ENTER_URL = 'Enter URL for content review'
const ERROR_INVALID_URL = 'Enter a valid GOV.UK URL'
const ERROR_NO_OPTION = 'Select an option to proceed'
const ERROR_FETCH_FAILED = 'Could not retrieve content from that URL'

function disableSubmit(elements) {
  if (elements.uploadButton) {
    elements.uploadButton.disabled = true
  }
}

function enableSubmit(elements) {
  if (elements.uploadButton) {
    elements.uploadButton.disabled = false
  }
}

function handleTextError(message, elements) {
  showError(message)
  enableSubmit(elements)
}

function clearAndRefocusUrlInput(elements) {
  if (elements.urlInput) {
    elements.urlInput.value = ''
    elements.urlInput.focus()
  }
}

async function handleUrlSubmit(elements) {
  const urlValue = elements.urlInput?.value?.trim()
  if (!urlValue) {
    showUrlError(ERROR_ENTER_URL)
    enableSubmit(elements)
    return
  }
  const parsed = parseGovUkUrl(urlValue)
  if (!parsed) {
    showUrlError(ERROR_INVALID_URL)
    enableSubmit(elements)
    return
  }
  try {
    hideUrlError()
    const htmlContent = await extractGovspeakText(urlValue)
    await submitUrlReview(htmlContent, urlValue)
    clearAndRefocusUrlInput(elements)
    enableSubmit(elements)
  } catch (error) {
    console.error('[UPLOAD-HANDLER] Failed to extract content:', error)
    const message = error.message?.startsWith('Extracted text is too long')
      ? error.message
      : ERROR_FETCH_FAILED
    showUrlError(message)
    enableSubmit(elements)
  }
}

async function handleTextSubmit(elements) {
  const textContent = elements.textContentInput?.value?.trim()
  const file = getFileInput()?.files?.[0]
  if (file && !textContent) {
    await submitFileUpload(file)
    return
  }
  if (textContent && !file) {
    if (textContent.length > CHARACTER_LIMIT) {
      handleTextError(
        `Text content too long. Maximum ${CHARACTER_LIMIT} characters. Your content has ${textContent.length} characters.`,
        elements
      )
      return
    }
    hideError()
    await submitTextReview(textContent)
    return
  }
  handleTextError(ERROR_ENTER_TEXT, elements)
}

export async function handleFormSubmit(e) {
  e.preventDefault()
  hideError()
  hideUrlError()
  hideRadioError()
  hideSuccess()
  const elements = getElements()
  disableSubmit(elements)

  const action = getSelectedAction()

  if (!action) {
    showRadioError(ERROR_NO_OPTION)
    enableSubmit(elements)
    return
  }

  try {
    if (action === 'url') {
      await handleUrlSubmit(elements)
      return
    }
    if (action === 'text') {
      await handleTextSubmit(elements)
    }
  } catch (error) {
    console.error('[UPLOAD-HANDLER] Form submission error:', error)
  }
}
