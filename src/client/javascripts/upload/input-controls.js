// Input controls: clear buttons and mutual exclusion
import {
  APP_DISABLED_CLASS,
  APP_HIGHLIGHT_CLASS,
  ARIA_DISABLED_ATTR,
  FORM_GROUP_SELECTOR
} from './constants.js'
import { getElements, getFileInput } from './dom-elements.js'
import { updateCharacterCount } from './character-counter.js'
import { hideError } from './ui-feedback.js'

let fileClearBtn, textClearBtn

function addClearButton(input, label, onClear) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = label
  btn.className = 'govuk-button govuk-button--secondary app-clear-button'
  btn.dataset.module = 'govuk-button'
  btn.addEventListener('click', onClear)
  input.parentNode.appendChild(btn)
  return btn
}

export function initializeFileInput() {
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

export function initializeTextInput() {
  const elements = getElements()
  if (!elements.textContentInput) {
    return
  }
  textClearBtn?.remove()
  textClearBtn = addClearButton(elements.textContentInput, 'Clear text', () => {
    elements.textContentInput.value = ''
    elements.textContentInput.disabled = false
    updateMutualExclusion()
    updateCharacterCount()
    hideError()
  })
  // Place the Clear button after the character count message so the order is:
  // textarea → character count → Clear button
  if (elements.characterCountMessage && textClearBtn) {
    const countParent = elements.characterCountMessage.parentNode
    if (countParent) {
      countParent.insertBefore(
        textClearBtn,
        elements.characterCountMessage.nextSibling
      )
    }
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
  const elements = getElements()
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

export function updateMutualExclusion() {
  const hasFile = hasFileSelected()
  const hasText = hasTextEntered()
  const fileInput = getFileInput()
  const elements = getElements()
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
