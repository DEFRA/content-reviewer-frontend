/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import {
  initializeTextInput,
  initializeFileInput,
  initializeUrlInput,
  showTextClearButton,
  hideTextClearButton,
  showUrlClearButton,
  hideUrlClearButton,
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
      <div class="govuk-form-group" id="documentFormGroup">
        <p id="documentError" hidden><span id="documentErrorMessage"></span></p>
        <div id="fileNameDisplay">No file chosen</div>
        <input type="file" id="file-upload">
        <button type="button" id="fileClearButton" class="app-clear-button">Clear file</button>
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

  it('should wire the HTML Clear file button to clear the file input', () => {
    initializeFileInput()
    const btn = document.getElementById('fileClearButton')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toBe('Clear file')
  })

  it('should not throw when called twice', () => {
    expect(() => {
      initializeFileInput()
      initializeFileInput()
    }).not.toThrow()
  })

  it('should do nothing when file input is absent', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()
    expect(() => initializeFileInput()).not.toThrow()
  })

  it('should clear file input value when Clear File button is clicked', () => {
    initializeFileInput()
    const fileInput = document.getElementById('file-upload')
    const btn = document.getElementById('fileClearButton')
    btn.click()
    expect(fileInput.value).toBe('')
  })

  it('should reset fileNameDisplay to "No file chosen" when Clear File is clicked', () => {
    initializeFileInput()
    const display = document.getElementById('fileNameDisplay')
    display.textContent = 'report.pdf'
    const btn = document.getElementById('fileClearButton')
    btn.click()
    expect(display.textContent).toBe('No file chosen')
  })

  it('should show document error when an invalid file type is selected', () => {
    initializeFileInput()
    const fileInput = document.getElementById('file-upload')
    const invalidFile = new File(['content'], 'image.png', {
      type: 'image/png'
    })
    Object.defineProperty(fileInput, 'files', {
      value: { 0: invalidFile, length: 1 },
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))
    const errorMsg = document.getElementById('documentErrorMessage')
    expect(errorMsg.textContent).toBe(
      'The selected file must be a PDF or Word document'
    )
  })

  it('should clear document error when a valid file type is selected', () => {
    initializeFileInput()
    const fileInput = document.getElementById('file-upload')
    const errorEl = document.getElementById('documentError')
    errorEl.hidden = false
    const validFile = new File(['content'], 'report.pdf', {
      type: 'application/pdf'
    })
    Object.defineProperty(fileInput, 'files', {
      value: { 0: validFile, length: 1 },
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))
    expect(errorEl.hidden).toBe(true)
  })
})

describe('upload/input-controls - updateMutualExclusion', () => {
  beforeEach(() => {
    buildFileInputDom()
    vi.clearAllMocks()
    initializeFileInput()
    initializeTextInput()
  })

  it('does not disable or highlight textarea when only a file is selected (document is a separate panel)', () => {
    const fileInput = document.getElementById('file-upload')
    Object.defineProperty(fileInput, 'files', {
      value: { 0: new File(['x'], 'test.txt'), length: 1 },
      configurable: true
    })
    document.getElementById('text-content').value = ''

    updateMutualExclusion()

    expect(document.getElementById('text-content').disabled).toBe(false)
    const textGroup = document.querySelector('#textFormGroup')
    expect(textGroup.classList.contains('app-highlight')).toBe(false)
  })

  it('highlights textarea form group when text is entered', () => {
    document.getElementById('text-content').value = 'some text'

    updateMutualExclusion()

    const textGroup = document.querySelector('#textFormGroup')
    expect(textGroup.classList.contains('app-highlight')).toBe(true)
  })

  it('enables textarea and removes highlight when no text is present', () => {
    document.getElementById('text-content').value = ''

    updateMutualExclusion()

    expect(document.getElementById('text-content').disabled).toBe(false)
    const textGroup = document.querySelector('#textFormGroup')
    expect(textGroup.classList.contains('app-highlight')).toBe(false)
  })
})

describe('upload/input-controls - URL input', () => {
  function buildDomWithUrl() {
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
        <div class="govuk-form-group" id="urlFormGroup">
          <p id="urlError" hidden>
            <span id="urlErrorMessage"></span>
          </p>
          <div id="urlInputWrapper">
            <input type="url" id="url-input" />
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

  beforeEach(() => {
    buildDomWithUrl()
    initializeElements()
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('initializeUrlInput should add a Clear URL button next to the url input', () => {
    initializeUrlInput()
    const btns = document.querySelectorAll('.app-clear-button')
    const urlBtn = Array.from(btns).find((b) => b.textContent === 'Clear URL')
    expect(urlBtn).not.toBeNull()
  })

  it('initializeUrlInput should hide the Clear URL button initially', () => {
    initializeUrlInput()
    const btns = document.querySelectorAll('.app-clear-button')
    const urlBtn = Array.from(btns).find((b) => b.textContent === 'Clear URL')
    expect(urlBtn.style.display).toBe('none')
  })

  it('showUrlClearButton should make the Clear URL button visible', () => {
    initializeUrlInput()
    showUrlClearButton()
    const btns = document.querySelectorAll('.app-clear-button')
    const urlBtn = Array.from(btns).find((b) => b.textContent === 'Clear URL')
    expect(urlBtn.style.display).toBe('')
  })

  it('hideUrlClearButton should hide the Clear URL button', () => {
    initializeUrlInput()
    showUrlClearButton()
    hideUrlClearButton()
    const btns = document.querySelectorAll('.app-clear-button')
    const urlBtn = Array.from(btns).find((b) => b.textContent === 'Clear URL')
    expect(urlBtn.style.display).toBe('none')
  })

  it('initializeUrlInput should return early when url input element is absent', () => {
    document.getElementById('url-input').remove()
    initializeElements()
    // Should not throw, no button added
    initializeUrlInput()
    const btns = document.querySelectorAll('.app-clear-button')
    const urlBtn = Array.from(btns).find((b) => b.textContent === 'Clear URL')
    expect(urlBtn).toBeUndefined()
  })

  it('showUrlClearButton should do nothing when button was never created', () => {
    // urlClearBtn is null – just ensure no error thrown
    expect(() => showUrlClearButton()).not.toThrow()
  })

  it('hideUrlClearButton should do nothing when button was never created', () => {
    expect(() => hideUrlClearButton()).not.toThrow()
  })
})
