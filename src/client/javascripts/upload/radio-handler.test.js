/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import { initializeRadioHandler, getSelectedAction } from './radio-handler.js'
import { hideRadioError } from './ui-feedback.js'
import { showTextClearButton, hideTextClearButton } from './input-controls.js'

vi.mock('./ui-feedback.js', () => ({
  hideError: vi.fn(),
  hideUrlError: vi.fn(),
  hideRadioError: vi.fn(),
  hideDocumentError: vi.fn()
}))

vi.mock('./input-controls.js', () => ({
  showTextClearButton: vi.fn(),
  hideTextClearButton: vi.fn(),
  showUrlClearButton: vi.fn(),
  hideUrlClearButton: vi.fn()
}))

vi.mock('./character-counter.js', () => ({
  initCharacterCount: vi.fn(),
  updateCharacterCount: vi.fn()
}))

const ACTION_URL_ID = 'action-url'
const ACTION_TEXT_ID = 'action-text'
const ACTION_DOCUMENT_ID = 'action-document'

function buildDom() {
  document.body.innerHTML = `
    <form id="uploadForm">
      <div class="govuk-form-group" id="actionSelectionGroup">
        <p id="actionOptionError" hidden><span id="actionOptionErrorMessage"></span></p>
        <div id="actionRadios">
          <input
            class="govuk-radios__input"
            id="action-url"
            name="actionOption"
            type="radio"
            value="url"
          >
          <input
            class="govuk-radios__input"
            id="action-text"
            name="actionOption"
            type="radio"
            value="text"
          >
          <input
            class="govuk-radios__input"
            id="action-document"
            name="actionOption"
            type="radio"
            value="document"
          >
        </div>
      </div>
      <div id="urlFormGroup" hidden></div>
      <div id="textFormGroup" hidden></div>
      <div id="documentFormGroup" hidden></div>
      <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
      <div id="uploadError" hidden><span id="errorMessage"></span></div>
      <div id="urlError" hidden><span id="urlErrorMessage"></span></div>
      <input id="url-input" type="text">
      <textarea id="text-content"></textarea>
      <button id="uploadButton"></button>
      <div id="uploadProgress" hidden></div>
      <div id="progressBar"></div>
      <div id="uploadStatusText"></div>
      <div id="uploadProgressText"></div>
      <div id="uploadSuccess" hidden></div>
      <div id="characterCountMessage"></div>
      <div id="textFieldWrapper"></div>
    </form>
  `
  initializeElements()
}

describe('upload/radio-handler - initializeRadioHandler', () => {
  beforeEach(() => {
    buildDom()
    vi.clearAllMocks()
  })

  it('should hide both panels on initialisation', () => {
    initializeRadioHandler()
    expect(document.getElementById('urlFormGroup').hidden).toBe(true)
    expect(document.getElementById('textFormGroup').hidden).toBe(true)
    expect(document.getElementById('documentFormGroup').hidden).toBe(true)
  })

  it('should show URL panel when URL radio is selected', () => {
    initializeRadioHandler()
    const urlRadio = document.getElementById(ACTION_URL_ID)
    urlRadio.checked = true
    urlRadio.dispatchEvent(new Event('change'))

    expect(document.getElementById('urlFormGroup').hidden).toBe(false)
    expect(document.getElementById('textFormGroup').hidden).toBe(true)
  })

  it('should show text panel when text radio is selected', () => {
    initializeRadioHandler()
    const textRadio = document.getElementById(ACTION_TEXT_ID)
    textRadio.checked = true
    textRadio.dispatchEvent(new Event('change'))

    expect(document.getElementById('textFormGroup').hidden).toBe(false)
    expect(document.getElementById('urlFormGroup').hidden).toBe(true)
  })

  it('should call hideRadioError when a radio button is changed', () => {
    initializeRadioHandler()
    const urlRadio = document.getElementById(ACTION_URL_ID)
    urlRadio.checked = true
    urlRadio.dispatchEvent(new Event('change'))
    expect(hideRadioError).toHaveBeenCalled()
  })

  it('should show clear button when text radio is selected', () => {
    initializeRadioHandler()
    const textRadio = document.getElementById(ACTION_TEXT_ID)
    textRadio.checked = true
    textRadio.dispatchEvent(new Event('change'))
    expect(showTextClearButton).toHaveBeenCalled()
  })

  it('should call initCharacterCount when text radio is selected', async () => {
    const { initCharacterCount } = await import('./character-counter.js')
    initializeRadioHandler()
    const textRadio = document.getElementById(ACTION_TEXT_ID)
    textRadio.checked = true
    textRadio.dispatchEvent(new Event('change'))
    expect(initCharacterCount).toHaveBeenCalled()
  })

  it('should hide clear button when URL radio is selected', () => {
    initializeRadioHandler()
    const urlRadio = document.getElementById(ACTION_URL_ID)
    urlRadio.checked = true
    urlRadio.dispatchEvent(new Event('change'))
    expect(hideTextClearButton).toHaveBeenCalled()
  })

  it('should hide clear button on initialisation', () => {
    initializeRadioHandler()
    expect(hideTextClearButton).toHaveBeenCalled()
  })

  it('should show document panel when document radio is selected', () => {
    initializeRadioHandler()
    const docRadio = document.getElementById(ACTION_DOCUMENT_ID)
    docRadio.checked = true
    docRadio.dispatchEvent(new Event('change'))

    expect(document.getElementById('documentFormGroup').hidden).toBe(false)
    expect(document.getElementById('urlFormGroup').hidden).toBe(true)
    expect(document.getElementById('textFormGroup').hidden).toBe(true)
  })

  it('should hide documentFormGroup when URL radio is selected', () => {
    initializeRadioHandler()
    // First show the document panel
    const docRadio = document.getElementById(ACTION_DOCUMENT_ID)
    docRadio.checked = true
    docRadio.dispatchEvent(new Event('change'))

    // Now switch to URL
    const urlRadio = document.getElementById(ACTION_URL_ID)
    urlRadio.checked = true
    urlRadio.dispatchEvent(new Event('change'))

    expect(document.getElementById('documentFormGroup').hidden).toBe(true)
  })

  it('should hide documentFormGroup when text radio is selected', () => {
    initializeRadioHandler()
    // First show the document panel
    const docRadio = document.getElementById(ACTION_DOCUMENT_ID)
    docRadio.checked = true
    docRadio.dispatchEvent(new Event('change'))

    // Now switch to text
    const textRadio = document.getElementById(ACTION_TEXT_ID)
    textRadio.checked = true
    textRadio.dispatchEvent(new Event('change'))

    expect(document.getElementById('documentFormGroup').hidden).toBe(true)
  })

  it('should not throw when radio elements are absent', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()
    expect(() => initializeRadioHandler()).not.toThrow()
  })
})

describe('upload/radio-handler - getSelectedAction', () => {
  beforeEach(buildDom)

  it('should return null when no radio is selected', () => {
    expect(getSelectedAction()).toBeNull()
  })

  it('should return "url" when URL radio is checked', () => {
    document.getElementById(ACTION_URL_ID).checked = true
    expect(getSelectedAction()).toBe('url')
  })

  it('should return "text" when text radio is checked', () => {
    document.getElementById(ACTION_TEXT_ID).checked = true
    expect(getSelectedAction()).toBe('text')
  })

  it('should return "document" when document radio is checked', () => {
    document.getElementById(ACTION_DOCUMENT_ID).checked = true
    expect(getSelectedAction()).toBe('document')
  })
})

describe('upload/radio-handler - hideBothPanels on unknown radio value', () => {
  beforeEach(() => {
    // Add a third radio with an unknown value to the DOM
    document.body.innerHTML = `
      <form id="uploadForm">
        <div class="govuk-form-group" id="actionSelectionGroup">
          <p id="actionOptionError" hidden><span id="actionOptionErrorMessage"></span></p>
          <div id="actionRadios">
            <input class="govuk-radios__input" id="action-url" name="actionOption" type="radio" value="url">
            <input class="govuk-radios__input" id="action-text" name="actionOption" type="radio" value="text">
            <input class="govuk-radios__input" id="action-other" name="actionOption" type="radio" value="other">
          </div>
        </div>
        <div id="urlFormGroup" hidden></div>
        <div id="textFormGroup" hidden></div>
        <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
        <div id="uploadError" hidden><span id="errorMessage"></span></div>
        <div id="urlError" hidden><span id="urlErrorMessage"></span></div>
        <input id="url-input" type="text">
        <textarea id="text-content"></textarea>
        <button id="uploadButton"></button>
        <div id="uploadProgress" hidden></div>
        <div id="progressBar"></div>
        <div id="uploadStatusText"></div>
        <div id="uploadProgressText"></div>
        <div id="uploadSuccess" hidden></div>
        <div id="characterCountMessage"></div>
        <div id="textFieldWrapper"></div>
      </form>
    `
    initializeElements()
    vi.clearAllMocks()
  })

  it('should hide both panels when a radio with an unknown value fires change', () => {
    initializeRadioHandler()

    // First show both panels so we can verify they get hidden
    document.getElementById('urlFormGroup').hidden = false
    document.getElementById('textFormGroup').hidden = false

    const otherRadio = document.getElementById('action-other')
    otherRadio.checked = true
    otherRadio.dispatchEvent(new Event('change'))

    expect(document.getElementById('urlFormGroup').hidden).toBe(true)
    expect(document.getElementById('textFormGroup').hidden).toBe(true)
  })

  it('should call hideTextClearButton when an unknown radio value fires change', () => {
    initializeRadioHandler()
    const otherRadio = document.getElementById('action-other')
    otherRadio.checked = true
    otherRadio.dispatchEvent(new Event('change'))
    expect(hideTextClearButton).toHaveBeenCalled()
  })
})

describe('upload/radio-handler - null element guards in all panel functions', () => {
  beforeEach(() => {
    // Build a minimal DOM that intentionally omits urlFormGroup, textFormGroup,
    // documentFormGroup and characterCountMessage so the null-guard false branches
    // are exercised across showUrlPanel, showTextPanel, showDocumentPanel and hideBothPanels.
    document.body.innerHTML = `
      <form id="uploadForm">
        <div class="govuk-form-group" id="actionSelectionGroup">
          <div id="actionRadios">
            <input class="govuk-radios__input" id="action-url" name="actionOption" type="radio" value="url">
            <input class="govuk-radios__input" id="action-text" name="actionOption" type="radio" value="text">
            <input class="govuk-radios__input" id="action-document" name="actionOption" type="radio" value="document">
          </div>
        </div>
        <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
        <div id="uploadError" hidden><span id="errorMessage"></span></div>
        <div id="urlError" hidden><span id="urlErrorMessage"></span></div>
        <input id="url-input" type="text">
        <textarea id="text-content"></textarea>
        <button id="uploadButton"></button>
        <div id="uploadProgress" hidden></div>
        <div id="progressBar"></div>
        <div id="uploadStatusText"></div>
        <div id="uploadProgressText"></div>
        <div id="uploadSuccess" hidden></div>
        <div id="textFieldWrapper"></div>
      </form>
    `
    // urlFormGroup, textFormGroup, documentFormGroup, characterCountMessage intentionally absent
    initializeElements()
    vi.clearAllMocks()
  })

  it('should not throw when urlFormGroup is absent and URL radio is selected', () => {
    expect(() => {
      initializeRadioHandler()
      const urlRadio = document.getElementById('action-url')
      urlRadio.checked = true
      urlRadio.dispatchEvent(new Event('change'))
    }).not.toThrow()
  })

  it('should not throw when textFormGroup is absent and text radio is selected', () => {
    expect(() => {
      initializeRadioHandler()
      const textRadio = document.getElementById('action-text')
      textRadio.checked = true
      textRadio.dispatchEvent(new Event('change'))
    }).not.toThrow()
  })

  it('should not throw when documentFormGroup is absent and document radio is selected', () => {
    expect(() => {
      initializeRadioHandler()
      const docRadio = document.getElementById('action-document')
      docRadio.checked = true
      docRadio.dispatchEvent(new Event('change'))
    }).not.toThrow()
  })
})
