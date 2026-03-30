/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import {
  initializeTextInput,
  initializeFileInput,
  showTextClearButton,
  hideTextClearButton,
  updateMutualExclusion
} from './input-controls.js'

vi.mock('./character-counter.js', () => ({
  updateCharacterCount: vi.fn()
}))

const CLEAR_BUTTON_SELECTOR = '.app-clear-button'

function buildDom() {
  document.body.innerHTML = `
    <div id="errorSummary" hidden>
      <a id="errorSummaryMessage"></a>
    </div>
    <form id="uploadForm">
      <div class="govuk-form-group" id="textFormGroup">
        <div id="textFieldWrapper">
          <p id="uploadError" hidden>
            <span class="govuk-visually-hidden">Error:</span>
            <span id="errorMessage"></span>
          </p>
          <textarea class="govuk-textarea" id="text-content"></textarea>
        </div>
      </div>
      <div id="characterCountMessage"></div>
      <button id="uploadButton" type="submit">Review content</button>
      <div id="uploadSuccess" hidden></div>
      <div id="uploadProgress" hidden>
        <div id="uploadStatusText"></div>
        <div id="uploadProgressText"></div>
        <div id="progressBar" data-progress="0"></div>
      </div>
    </form>
  `
}

describe('upload/input-controls', () => {
  beforeEach(() => {
    buildDom()
    initializeElements()
    vi.clearAllMocks()
  })

  describe('initializeTextInput', () => {
    it('should add a Clear text button next to the textarea', () => {
      initializeTextInput()
      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      expect(btn).not.toBeNull()
      expect(btn.textContent).toBe('Clear text')
    })

    it('should be hidden initially after initialisation', () => {
      initializeTextInput()
      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      expect(btn.style.display).toBe('none')
    })

    it('showTextClearButton should make the button visible', () => {
      initializeTextInput()
      showTextClearButton()
      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      expect(btn.style.display).toBe('')
    })

    it('hideTextClearButton should hide the button', () => {
      initializeTextInput()
      showTextClearButton()
      hideTextClearButton()
      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      expect(btn.style.display).toBe('none')
    })

    it('should clear textarea value when Clear text is clicked', () => {
      initializeTextInput()
      const textarea = document.getElementById('text-content')
      textarea.value = 'Some content'

      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      btn.click()

      expect(textarea.value).toBe('')
    })

    it('should hide the error message element when Clear text is clicked', () => {
      initializeTextInput()
      const uploadError = document.getElementById('uploadError')
      uploadError.hidden = false

      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      btn.click()

      expect(uploadError.hidden).toBe(true)
    })

    it('should remove error classes when Clear text is clicked', () => {
      initializeTextInput()
      const textFormGroup = document.getElementById('textFormGroup')
      const textarea = document.getElementById('text-content')
      textFormGroup.classList.add('govuk-form-group--error')
      textarea.classList.add('govuk-textarea--error')

      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      btn.click()

      expect(textFormGroup.classList.contains('govuk-form-group--error')).toBe(
        false
      )
      expect(textarea.classList.contains('govuk-textarea--error')).toBe(false)
    })

    it('should not add duplicate buttons when called twice', () => {
      initializeTextInput()
      initializeTextInput()

      const btns = document.querySelectorAll(CLEAR_BUTTON_SELECTOR)
      expect(btns.length).toBe(1)
    })

    it('should do nothing when textContentInput is absent', () => {
      document.body.innerHTML = '<div></div>'
      initializeElements()

      expect(() => initializeTextInput()).not.toThrow()
    })

    it('should clear url input when Clear text is clicked and urlInput exists', () => {
      // Rebuild DOM with url-input present
      document.body.innerHTML = `
        <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
        <form id="uploadForm">
          <div class="govuk-form-group" id="textFormGroup">
            <div id="textFieldWrapper">
              <p id="uploadError" hidden><span id="errorMessage"></span></p>
              <textarea class="govuk-textarea" id="text-content"></textarea>
            </div>
          </div>
          <div id="characterCountMessage"></div>
          <div id="urlFormGroup"><p id="urlError" hidden><span id="urlErrorMessage"></span></p>
            <input id="url-input" type="text" value="https://www.gov.uk/test">
          </div>
          <button id="uploadButton" type="submit">Review content</button>
          <div id="uploadSuccess" hidden></div>
          <div id="uploadProgress" hidden>
            <div id="uploadStatusText"></div>
            <div id="uploadProgressText"></div>
            <div id="progressBar" data-progress="0"></div>
          </div>
        </form>
      `
      initializeElements()
      initializeTextInput()

      document.getElementById('url-input').value = 'https://www.gov.uk/test'
      const btn = document.querySelector(CLEAR_BUTTON_SELECTOR)
      btn.click()

      expect(document.getElementById('url-input').value).toBe('')
    })
  })
})

function buildFileInputDom() {
  document.body.innerHTML = `
    <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
    <form id="uploadForm">
      <div class="govuk-form-group" id="fileFormGroup">
        <input type="file" id="file-upload">
      </div>
      <div class="govuk-form-group" id="textFormGroup">
        <div id="textFieldWrapper">
          <p id="uploadError" hidden><span id="errorMessage"></span></p>
          <textarea class="govuk-textarea" id="text-content"></textarea>
        </div>
      </div>
      <div id="characterCountMessage"></div>
      <div id="urlFormGroup" hidden>
        <p id="urlError" hidden><span id="urlErrorMessage"></span></p>
        <input id="url-input" type="text">
      </div>
      <button id="uploadButton" type="submit">Review content</button>
      <div id="uploadSuccess" hidden></div>
      <div id="uploadProgress" hidden>
        <div id="uploadStatusText"></div>
        <div id="uploadProgressText"></div>
        <div id="progressBar" data-progress="0"></div>
      </div>
    </form>
  `
  initializeElements()
}

describe('upload/input-controls - initializeFileInput', () => {
  beforeEach(() => {
    buildFileInputDom()
    vi.clearAllMocks()
  })

  it('should add a "Clear File" button next to the file input', () => {
    initializeFileInput()
    const btn = document.querySelector('.app-clear-button')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toBe('Clear File')
  })

  it('should not add a duplicate button when called twice', () => {
    initializeFileInput()
    initializeFileInput()
    const btns = document.querySelectorAll('.app-clear-button')
    expect(btns.length).toBe(1)
  })

  it('should do nothing when file input is absent', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()
    expect(() => initializeFileInput()).not.toThrow()
  })

  it('should clear file input value when Clear File is clicked', () => {
    initializeFileInput()
    const fileInput = document.getElementById('file-upload')
    const btn = document.querySelector('.app-clear-button')
    btn.click()
    expect(fileInput.value).toBe('')
  })
})

describe('upload/input-controls - updateMutualExclusion', () => {
  beforeEach(() => {
    buildFileInputDom()
    vi.clearAllMocks()
    initializeFileInput()
    initializeTextInput()
  })

  it('disables textarea and highlights file input when only a file is selected', () => {
    const fileInput = document.getElementById('file-upload')
    Object.defineProperty(fileInput, 'files', {
      value: { 0: new File(['x'], 'test.txt'), length: 1 },
      configurable: true
    })
    document.getElementById('text-content').value = ''

    updateMutualExclusion()

    expect(document.getElementById('text-content').disabled).toBe(true)
    const fileGroup = document.querySelector('#fileFormGroup')
    expect(fileGroup.classList.contains('app-highlight')).toBe(true)
  })

  it('disables file input and highlights textarea when only text is entered', () => {
    const fileInput = document.getElementById('file-upload')
    Object.defineProperty(fileInput, 'files', {
      value: { length: 0 },
      configurable: true
    })
    document.getElementById('text-content').value = 'some text'

    updateMutualExclusion()

    expect(fileInput.disabled).toBe(true)
    const textGroup = document.querySelector('#textFormGroup')
    expect(textGroup.classList.contains('app-highlight')).toBe(true)
  })

  it('enables both inputs when neither file nor text is present', () => {
    const fileInput = document.getElementById('file-upload')
    Object.defineProperty(fileInput, 'files', {
      value: { length: 0 },
      configurable: true
    })
    document.getElementById('text-content').value = ''

    updateMutualExclusion()

    expect(fileInput.disabled).toBe(false)
    expect(document.getElementById('text-content').disabled).toBe(false)
  })
})
