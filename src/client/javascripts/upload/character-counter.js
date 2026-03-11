// Character counting functionality
import {
  CHARACTER_LIMIT,
  GOVUK_ERROR_MESSAGE_CLASS,
  STYLE_DISPLAY_NONE,
  STYLE_DISPLAY_DEFAULT
} from './constants.js'
import { getElements } from './dom-elements.js'

export function updateCharacterCount() {
  const elements = getElements()
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
  const elements = getElements()
  elements.characterCountMessage.textContent = ''
  elements.characterCountMessage.style.display = STYLE_DISPLAY_NONE
  elements.characterCountMessage.classList.remove(GOVUK_ERROR_MESSAGE_CLASS)
}

function showRemainingCharacters(remaining) {
  const elements = getElements()
  elements.characterCountMessage.textContent = `${remaining} characters remaining`
  elements.characterCountMessage.classList.remove(GOVUK_ERROR_MESSAGE_CLASS)
}

function showExcessCharacters(remaining) {
  const elements = getElements()
  const excess = Math.abs(remaining)
  elements.characterCountMessage.textContent = `You have ${excess} characters too many`
  elements.characterCountMessage.classList.add(GOVUK_ERROR_MESSAGE_CLASS)
}
