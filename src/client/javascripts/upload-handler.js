/**
 * Upload form handler - Main entry point
 * This module orchestrates the upload functionality by coordinating
 * between specialized modules for different concerns.
 */

// Import all modular components
import { initializeElements, getElements } from './upload/dom-elements.js'
import { updateCharacterCount } from './upload/character-counter.js'
import {
  initializeFileInput,
  initializeTextInput
} from './upload/input-controls.js'
import { hideError, hideProgress, hideSuccess } from './upload/ui-feedback.js'
import { handleFormSubmit } from './upload/form-handler.js'

/**
 * Initialize the upload form handler
 * Sets up all event listeners and initializes sub-modules
 */
function initialize() {
  // Initialize DOM element references
  initializeElements()

  const elements = getElements()

  // Exit early if form doesn't exist
  if (!elements.form) {
    console.warn(
      '[UPLOAD-HANDLER] Form element not found, skipping initialization'
    )
    return
  }

  // Set up character count listener and initial state
  if (elements.textContentInput) {
    elements.textContentInput.addEventListener('input', updateCharacterCount)
    updateCharacterCount()
  }

  // Initialize UI state
  hideError()
  hideProgress()
  hideSuccess()

  // Initialize input controls (file input, text input, clear buttons, mutual exclusion)
  initializeFileInput()
  initializeTextInput()

  // Set up form submission handler
  elements.form.addEventListener('submit', handleFormSubmit)

  console.log('[UPLOAD-HANDLER] Upload handler initialized successfully')
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initialize)
