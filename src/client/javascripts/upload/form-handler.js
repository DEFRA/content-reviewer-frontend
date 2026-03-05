// Form submission handler
import { CHARACTER_LIMIT } from './constants.js'
import { getElements, getFileInput } from './dom-elements.js'
import { hideError, hideSuccess, showError } from './ui-feedback.js'
import { submitTextReview, submitFileUpload } from './api-client.js'

export async function handleFormSubmit(e) {
  e.preventDefault()
  hideError()
  hideSuccess()
  const elements = getElements()
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
