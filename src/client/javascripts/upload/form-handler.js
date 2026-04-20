// Form submission handler
import { CHARACTER_LIMIT, isValidFileType } from './constants.js'
import { getElements, getFileInput } from './dom-elements.js'
import {
  hideError,
  hideSuccess,
  showError,
  showUrlError,
  hideUrlError,
  showRadioError,
  hideRadioError,
  showDocumentError,
  hideDocumentError
} from './ui-feedback.js'
import { updateCharacterCount } from './character-counter.js'
import {
  submitTextReview,
  submitFileUpload,
  submitUrlReview
} from './api-client.js'
import { parseGovUkUrl } from './url-extractor.js'
import { getSelectedAction } from './radio-handler.js'

const ERROR_ENTER_TEXT = 'Enter text content for review'
const ERROR_ENTER_URL = 'Enter URL for content review'
const ERROR_INVALID_URL = 'Enter a valid GOV.UK URL'
const ERROR_NO_OPTION = 'Select an option to proceed'
const ERROR_FETCH_FAILED = 'Could not retrieve content from that URL'
const ERROR_UNSUPPORTED_LAYOUT =
  'Could not extract content from that URL. The page layout is not supported. Please try a different URL or paste the content directly using the text input.'
const ERROR_NO_FILE = 'Select a file to upload'
const ERROR_INVALID_FILE_TYPE =
  'The selected file must be a PDF or Word document'

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
    await submitUrlReview(urlValue)
    clearAndRefocusUrlInput(elements)
    enableSubmit(elements)
  } catch (error) {
    // submitUrlReview already showed the error via showUrlError; just re-enable submit.
    // For network failures where submitUrlReview could not display a message, show fallback.
    if (
      !error.message ||
      error.message === 'Failed to fetch' ||
      error.message.startsWith('NetworkError')
    ) {
      showUrlError(ERROR_FETCH_FAILED)
    } else if (error.message.startsWith('Could not extract')) {
      showUrlError(ERROR_UNSUPPORTED_LAYOUT)
    } else {
      // All other errors: submitUrlReview already displayed its own error message
    }
    enableSubmit(elements)
  }
}

async function handleDocumentSubmit(elements) {
  const file = getFileInput()?.files?.[0]
  if (!file) {
    showDocumentError(ERROR_NO_FILE)
    enableSubmit(elements)
    return
  }
  if (!isValidFileType(file)) {
    showDocumentError(ERROR_INVALID_FILE_TYPE)
    enableSubmit(elements)
    return
  }
  hideDocumentError()
  await submitFileUpload(file)
}

async function handleTextSubmit(elements) {
  const textContent = elements.textContentInput?.value?.trim()
  if (!textContent) {
    handleTextError(ERROR_ENTER_TEXT, elements)
    return
  }
  if (textContent.length > CHARACTER_LIMIT) {
    handleTextError(
      `Text content too long. Maximum ${CHARACTER_LIMIT} characters. Your content has ${textContent.length} characters.`,
      elements
    )
    return
  }
  hideError()
  await submitTextReview(textContent)
}

export async function handleFormSubmit(e) {
  e.preventDefault()
  hideError()
  hideUrlError()
  hideDocumentError()
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
    if (action === 'document') {
      await handleDocumentSubmit(elements)
      return
    }
    if (action === 'text') {
      // Re-apply char-limit state if still over limit (hideError clears the border)
      updateCharacterCount()
      await handleTextSubmit(elements)
    }
  } catch (error) {
    console.error('[UPLOAD-HANDLER] Form submission error:', error) // NOSONAR
  }
}
