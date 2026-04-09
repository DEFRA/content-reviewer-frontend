// Input controls: clear buttons and mutual exclusion
import {
  APP_DISABLED_CLASS,
  APP_HIGHLIGHT_CLASS,
  ARIA_DISABLED_ATTR,
  FORM_GROUP_SELECTOR,
  isValidFileType
} from './constants.js'
import { getElements, getFileInput } from './dom-elements.js'
import { updateCharacterCount } from './character-counter.js'
import {
  hideError,
  hideUrlError,
  hideDocumentError,
  showDocumentError
} from './ui-feedback.js'

let textClearBtn, urlClearBtn

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
  const elements = getElements()

  // Update the file name display when the user picks a file
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (elements.fileNameDisplay) {
      elements.fileNameDisplay.textContent = file?.name || 'No file chosen'
    }
    if (file && !isValidFileType(file)) {
      showDocumentError('The selected file must be a PDF or Word document')
    } else {
      hideDocumentError()
    }
  })

  // Wire the HTML clear button
  if (elements.fileClearButton) {
    elements.fileClearButton.addEventListener('click', () => {
      fileInput.value = ''
      if (elements.fileNameDisplay) {
        elements.fileNameDisplay.textContent = 'No file chosen'
      }
      hideDocumentError()
    })
  }
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
    // Also clear the URL input if present
    if (elements.urlInput) {
      elements.urlInput.value = ''
    }
    updateMutualExclusion()
    updateCharacterCount()
    hideError()
    hideUrlError()
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
    textClearBtn.style.display = 'none'
  }
}

export function initializeUrlInput() {
  const elements = getElements()
  if (!elements.urlInput) {
    return
  }
  urlClearBtn?.remove()
  urlClearBtn = addClearButton(elements.urlInput, 'Clear URL', () => {
    elements.urlInput.value = ''
    elements.urlInput.disabled = false
    hideUrlError()
  })
  if (urlClearBtn) {
    urlClearBtn.style.display = 'none'
  }
}

export function showUrlClearButton() {
  if (urlClearBtn) {
    urlClearBtn.style.display = ''
  }
}

export function hideUrlClearButton() {
  if (urlClearBtn) {
    urlClearBtn.style.display = 'none'
  }
}

export function showTextClearButton() {
  if (textClearBtn) {
    textClearBtn.style.display = ''
  }
}

export function hideTextClearButton() {
  if (textClearBtn) {
    textClearBtn.style.display = 'none'
  }
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
  const hasText =
    getElements().textContentInput &&
    getElements().textContentInput.value.trim() !== ''
  const elements = getElements()
  if (hasText) {
    highlightInput(elements.textContentInput, true)
  } else {
    toggleInput(
      elements.textContentInput,
      false,
      APP_DISABLED_CLASS,
      textClearBtn
    )
    highlightInput(elements.textContentInput, false)
  }
}
