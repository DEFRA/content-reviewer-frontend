/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeElements } from './dom-elements.js'
import {
  showError,
  hideError,
  hideSuccess,
  showProgress,
  hideProgress
} from './ui-feedback.js'

const ERROR_GROUP_CLASS = 'govuk-form-group--error'
const ERROR_TEXTAREA_CLASS = 'govuk-textarea--error'
const TEXT_CONTENT_ID = 'text-content'
const PROGRESS_PERCENTAGE_HALF = 50
const PROGRESS_PERCENTAGE_DECIMAL = 45.7
const PROGRESS_PERCENTAGE_ROUNDED = '46'
const PROGRESS_PERCENTAGE_HIGH = '75'

function buildTestDom() {
  document.body.innerHTML = `
    <div
      class="govuk-error-summary"
      id="errorSummary"
      aria-labelledby="error-summary-title"
      role="alert"
      tabindex="-1"
      hidden
    >
      <h2 id="error-summary-title">There is a problem</h2>
      <ul>
        <li><a href="#text-content" id="errorSummaryMessage"></a></li>
      </ul>
    </div>
    <form id="uploadForm">
      <button id="uploadButton">Upload</button>
      <div id="uploadProgress" hidden>
        <div id="uploadStatusText"></div>
        <div id="uploadProgressText"></div>
        <div id="progressBar" data-progress="0"></div>
      </div>
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
      <div id="uploadSuccess" hidden></div>
    </form>
  `
  initializeElements()
}

describe('upload/ui-feedback - showError', () => {
  beforeEach(buildTestDom)

  it('should display error message', () => {
    const uploadError = document.getElementById('uploadError')
    const errorMessage = document.getElementById('errorMessage')

    showError('Test error message')

    expect(uploadError.hidden).toBe(false)
    expect(errorMessage.textContent).toBe('Test error message')
  })

  it('should show error summary with message', () => {
    const errorSummary = document.getElementById('errorSummary')
    const errorSummaryMessage = document.getElementById('errorSummaryMessage')

    showError('Enter text content for review')

    expect(errorSummary.hidden).toBe(false)
    expect(errorSummaryMessage.textContent).toBe(
      'Enter text content for review'
    )
  })

  it('should add error class to form group', () => {
    const textFormGroup = document.getElementById('textFormGroup')

    showError('Test error')

    expect(textFormGroup.classList.contains(ERROR_GROUP_CLASS)).toBe(true)
  })

  it('should add error class to textarea', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)

    showError('Test error')

    expect(textarea.classList.contains(ERROR_TEXTAREA_CLASS)).toBe(true)
  })

  it('should hide success when showing error', () => {
    const uploadSuccess = document.getElementById('uploadSuccess')
    uploadSuccess.hidden = false

    showError('Error')

    expect(uploadSuccess.hidden).toBe(true)
  })

  it('should hide progress when showing error', () => {
    const uploadProgress = document.getElementById('uploadProgress')
    uploadProgress.hidden = false

    showError('Error')

    expect(uploadProgress.hidden).toBe(true)
  })

  it('should re-enable upload button', () => {
    const uploadButton = document.getElementById('uploadButton')
    uploadButton.disabled = true

    showError('Error')

    expect(uploadButton.disabled).toBe(false)
  })

  it('should focus the textarea when showing an error', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    let focused = false
    textarea.focus = () => {
      focused = true
    }

    showError('Error')

    expect(focused).toBe(true)
  })
})

describe('upload/ui-feedback - hideError', () => {
  beforeEach(buildTestDom)

  it('should hide error element', () => {
    const uploadError = document.getElementById('uploadError')
    uploadError.hidden = false

    hideError()

    expect(uploadError.hidden).toBe(true)
  })

  it('should hide error summary', () => {
    const errorSummary = document.getElementById('errorSummary')
    errorSummary.hidden = false

    hideError()

    expect(errorSummary.hidden).toBe(true)
  })

  it('should remove error class from form group', () => {
    const textFormGroup = document.getElementById('textFormGroup')
    textFormGroup.classList.add(ERROR_GROUP_CLASS)

    hideError()

    expect(textFormGroup.classList.contains(ERROR_GROUP_CLASS)).toBe(false)
  })

  it('should remove error class from textarea', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.classList.add(ERROR_TEXTAREA_CLASS)

    hideError()

    expect(textarea.classList.contains(ERROR_TEXTAREA_CLASS)).toBe(false)
  })

  it('should clear the inline error message text', () => {
    const errorMessage = document.getElementById('errorMessage')
    errorMessage.textContent = 'Some previous error'

    hideError()

    expect(errorMessage.textContent).toBe('')
  })
})

describe('upload/ui-feedback - hideSuccess', () => {
  beforeEach(buildTestDom)

  it('should hide success element', () => {
    const uploadSuccess = document.getElementById('uploadSuccess')
    uploadSuccess.hidden = false

    hideSuccess()

    expect(uploadSuccess.hidden).toBe(true)
  })
})

describe('upload/ui-feedback - showProgress and hideProgress', () => {
  beforeEach(buildTestDom)

  it('should display progress with status and percentage', () => {
    const uploadProgress = document.getElementById('uploadProgress')
    const uploadStatusText = document.getElementById('uploadStatusText')
    const uploadProgressText = document.getElementById('uploadProgressText')
    const progressBar = document.getElementById('progressBar')

    showProgress('Uploading...', PROGRESS_PERCENTAGE_HALF)

    expect(uploadProgress.hidden).toBe(false)
    expect(uploadStatusText.textContent).toBe('Uploading...')
    expect(uploadProgressText.textContent).toBe(`${PROGRESS_PERCENTAGE_HALF}%`)
    expect(progressBar.dataset.progress).toBe(
      PROGRESS_PERCENTAGE_HALF.toString()
    )
  })

  it('should round percentage to integer', () => {
    const progressBar = document.getElementById('progressBar')

    showProgress('Processing...', PROGRESS_PERCENTAGE_DECIMAL)

    expect(progressBar.dataset.progress).toBe(PROGRESS_PERCENTAGE_ROUNDED)
  })

  it('should hide progress element', () => {
    const uploadProgress = document.getElementById('uploadProgress')
    uploadProgress.hidden = false

    hideProgress()

    expect(uploadProgress.hidden).toBe(true)
  })

  it('should reset progress bar to 0', () => {
    const progressBar = document.getElementById('progressBar')
    progressBar.dataset.progress = PROGRESS_PERCENTAGE_HIGH

    hideProgress()

    expect(progressBar.dataset.progress).toBe('0')
  })
})

describe('upload/ui-feedback - missing elements', () => {
  it('should handle missing elements gracefully', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()

    expect(() => showError('Test')).not.toThrow()
    expect(() => hideError()).not.toThrow()
    expect(() => hideSuccess()).not.toThrow()
    expect(() => showProgress('Test', PROGRESS_PERCENTAGE_HALF)).not.toThrow()
    expect(() => hideProgress()).not.toThrow()
  })
})
