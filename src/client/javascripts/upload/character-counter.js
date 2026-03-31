// Character counting functionality
import {
  CHARACTER_LIMIT,
  GOVUK_ERROR_MESSAGE_CLASS,
  STYLE_DISPLAY_DEFAULT
} from './constants.js'
import { getElements } from './dom-elements.js'
import {
  showCharLimitError,
  hideCharLimitError,
  showInlineTextError,
  hideInlineTextError
} from './ui-feedback.js'

const FONT_WEIGHT_BOLD = 'bold'
const FONT_WEIGHT_NORMAL = ''
const COLOR_NORMAL = '#505a5f'
const COLOR_ERROR = '#d4351c'

/**
 * Initialises the character count display when the text panel is first shown.
 * Always shows the full remaining count regardless of current textarea length.
 */
export function initCharacterCount() {
  const elements = getElements()
  if (!elements.textContentInput || !elements.characterCountMessage) {
    return
  }
  const currentLength = elements.textContentInput.value.length
  const remaining = CHARACTER_LIMIT - currentLength
  elements.characterCountMessage.style.display = STYLE_DISPLAY_DEFAULT
  if (remaining >= 0) {
    elements.characterCountMessage.textContent = `You have ${remaining} characters remaining`
    elements.characterCountMessage.classList.remove(GOVUK_ERROR_MESSAGE_CLASS)
    elements.characterCountMessage.style.fontWeight = FONT_WEIGHT_NORMAL
    elements.characterCountMessage.style.color = COLOR_NORMAL
    hideCharLimitError()
  } else {
    const excess = Math.abs(remaining)
    elements.characterCountMessage.textContent = `You have ${excess} characters too many`
    elements.characterCountMessage.classList.add(GOVUK_ERROR_MESSAGE_CLASS)
    elements.characterCountMessage.style.fontWeight = FONT_WEIGHT_BOLD
    elements.characterCountMessage.style.color = COLOR_ERROR
    showCharLimitError()
  }
}

export function updateCharacterCount() {
  const elements = getElements()
  if (!elements.textContentInput || !elements.characterCountMessage) {
    return
  }
  const currentLength = elements.textContentInput.value.length
  elements.characterCountMessage.style.display = STYLE_DISPLAY_DEFAULT
  const remaining = CHARACTER_LIMIT - currentLength
  if (remaining >= 0) {
    showRemainingCharacters(remaining)
  } else {
    showExcessCharacters(currentLength, remaining)
  }
}

function showRemainingCharacters(remaining) {
  const elements = getElements()
  elements.characterCountMessage.textContent = `You have ${remaining} characters remaining`
  elements.characterCountMessage.classList.remove(GOVUK_ERROR_MESSAGE_CLASS)
  elements.characterCountMessage.style.fontWeight = FONT_WEIGHT_NORMAL
  elements.characterCountMessage.style.color = COLOR_NORMAL
  hideCharLimitError()
  hideInlineTextError()
}

function showExcessCharacters(_currentLength, remaining) {
  const elements = getElements()
  const excess = Math.abs(remaining)
  const currentLength = elements.textContentInput.value.length
  elements.characterCountMessage.textContent = `You have ${excess} characters too many`
  elements.characterCountMessage.classList.add(GOVUK_ERROR_MESSAGE_CLASS)
  elements.characterCountMessage.style.fontWeight = FONT_WEIGHT_BOLD
  elements.characterCountMessage.style.color = COLOR_ERROR
  showCharLimitError()
  showInlineTextError(
    `Text content too long. Maximum ${CHARACTER_LIMIT} characters. Your content has ${currentLength} characters.`
  )
}
