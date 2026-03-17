// Radio button handler: shows/hides URL input or text content based on selection
import { getElements } from './dom-elements.js'
import { hideError, hideUrlError, hideRadioError } from './ui-feedback.js'

/**
 * Shows the URL input panel and hides the text content panel.
 */
function showUrlPanel() {
  const elements = getElements()
  if (elements.urlFormGroup) {
    elements.urlFormGroup.hidden = false
  }
  if (elements.textFormGroup) {
    elements.textFormGroup.hidden = true
  }
  if (elements.characterCountMessage) {
    elements.characterCountMessage.textContent = ''
    elements.characterCountMessage.style.display = 'none'
    elements.characterCountMessage.classList.remove('govuk-error-message')
  }
  hideError()
}

/**
 * Shows the text content panel and hides the URL input panel.
 */
function showTextPanel() {
  const elements = getElements()
  if (elements.textFormGroup) {
    elements.textFormGroup.hidden = false
  }
  if (elements.urlFormGroup) {
    elements.urlFormGroup.hidden = true
  }
  hideUrlError()
}

/**
 * Hides both the URL and text content panels.
 */
function hideBothPanels() {
  const elements = getElements()
  if (elements.urlFormGroup) {
    elements.urlFormGroup.hidden = true
  }
  if (elements.textFormGroup) {
    elements.textFormGroup.hidden = true
  }
}

/**
 * Handles a radio button change event and shows the appropriate panel.
 * @param {Event} event
 */
function handleRadioChange(event) {
  const value = event.target.value
  hideRadioError()
  if (value === 'url') {
    showUrlPanel()
  } else if (value === 'text') {
    showTextPanel()
  } else {
    hideBothPanels()
  }
}

/**
 * Attaches change listeners to the action radio buttons.
 * Should be called once during page initialisation.
 */
export function initializeRadioHandler() {
  hideBothPanels()
  const radios = document.querySelectorAll('input[name="actionOption"]')
  radios.forEach((radio) => {
    radio.addEventListener('change', handleRadioChange)
  })
}

/**
 * Returns the currently selected action value ('url', 'text', or null).
 * @returns {string|null}
 */
export function getSelectedAction() {
  const checked = document.querySelector('input[name="actionOption"]:checked')
  return checked ? checked.value : null
}
