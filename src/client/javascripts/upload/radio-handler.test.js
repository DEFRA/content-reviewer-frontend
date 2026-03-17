/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import { initializeRadioHandler, getSelectedAction } from './radio-handler.js'
import { hideRadioError } from './ui-feedback.js'

vi.mock('./ui-feedback.js', () => ({
  hideError: vi.fn(),
  hideUrlError: vi.fn(),
  hideRadioError: vi.fn()
}))

const ACTION_URL_ID = 'action-url'
const ACTION_TEXT_ID = 'action-text'

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
})
