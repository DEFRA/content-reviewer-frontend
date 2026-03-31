/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import {
  showError,
  hideError,
  hideSuccess,
  showProgress,
  hideProgress,
  showUrlError,
  hideUrlError,
  showRadioError,
  hideRadioError,
  showCharLimitError,
  hideCharLimitError,
  showInlineTextError,
  hideInlineTextError
} from './ui-feedback.js'

const ERROR_GROUP_CLASS = 'govuk-form-group--error'
const ERROR_TEXTAREA_CLASS = 'govuk-textarea--error'
const TEXT_CONTENT_ID = 'text-content'
const ENTER_TEXT_ERROR = 'Enter text content for review'
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

    showError(ENTER_TEXT_ERROR)

    expect(errorSummary.hidden).toBe(false)
    expect(errorSummaryMessage.textContent).toBe(ENTER_TEXT_ERROR)
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

function buildFullTestDom() {
  document.body.innerHTML = `
    <div id="errorSummary" hidden>
      <ul><li><a id="errorSummaryMessage" href="#text-content"></a></li></ul>
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
          <p id="uploadError" hidden><span id="errorMessage"></span></p>
          <textarea class="govuk-textarea" id="text-content"></textarea>
        </div>
      </div>
      <div id="characterCountMessage"></div>
      <div id="uploadSuccess" hidden></div>
      <div class="govuk-form-group" id="urlFormGroup" hidden>
        <p id="urlError" hidden><span id="urlErrorMessage"></span></p>
        <input id="url-input" type="text">
      </div>
      <div class="govuk-form-group" id="actionSelectionGroup">
        <p id="actionOptionError" hidden>
          <span id="actionOptionErrorMessage"></span>
        </p>
        <div id="actionRadios"></div>
      </div>
    </form>
  `
  initializeElements()
}

const ERROR_INPUT_CLASS = 'govuk-input--error'
const ERROR_GROUP_CLASS_URL = 'govuk-form-group--error'
const ENTER_VALID_URL_ERROR = 'Enter a valid URL'
const INVALID_URL_ERROR = 'Invalid URL'
const SELECT_OPTION_ERROR = 'Select an option'

describe('upload/ui-feedback - showUrlError', () => {
  beforeEach(buildFullTestDom)

  it('should show the URL error element', () => {
    showUrlError(ENTER_VALID_URL_ERROR)
    expect(document.getElementById('urlError').hidden).toBe(false)
  })

  it('should set urlErrorMessage text', () => {
    showUrlError(ENTER_VALID_URL_ERROR)
    expect(document.getElementById('urlErrorMessage').textContent).toBe(
      ENTER_VALID_URL_ERROR
    )
  })

  it('should show errorSummary with the message', () => {
    showUrlError(INVALID_URL_ERROR)
    expect(document.getElementById('errorSummary').hidden).toBe(false)
    expect(document.getElementById('errorSummaryMessage').textContent).toBe(
      INVALID_URL_ERROR
    )
  })

  it('should set errorSummaryMessage href to #url-input', () => {
    showUrlError(INVALID_URL_ERROR)
    expect(
      document.getElementById('errorSummaryMessage').getAttribute('href')
    ).toBe('#url-input')
  })

  it('should add error class to urlFormGroup', () => {
    showUrlError(INVALID_URL_ERROR)
    expect(
      document
        .getElementById('urlFormGroup')
        .classList.contains(ERROR_GROUP_CLASS_URL)
    ).toBe(true)
  })

  it('should add input error class to urlInput', () => {
    showUrlError(INVALID_URL_ERROR)
    expect(
      document.getElementById('url-input').classList.contains(ERROR_INPUT_CLASS)
    ).toBe(true)
  })

  it('should re-enable the upload button', () => {
    const btn = document.getElementById('uploadButton')
    btn.disabled = true
    showUrlError(INVALID_URL_ERROR)
    expect(btn.disabled).toBe(false)
  })

  it('should hide success element when showing URL error', () => {
    document.getElementById('uploadSuccess').hidden = false
    showUrlError(INVALID_URL_ERROR)
    expect(document.getElementById('uploadSuccess').hidden).toBe(true)
  })
})

describe('upload/ui-feedback - hideUrlError', () => {
  beforeEach(buildFullTestDom)

  it('should hide the URL error element', () => {
    document.getElementById('urlError').hidden = false
    hideUrlError()
    expect(document.getElementById('urlError').hidden).toBe(true)
  })

  it('should hide errorSummary', () => {
    document.getElementById('errorSummary').hidden = false
    hideUrlError()
    expect(document.getElementById('errorSummary').hidden).toBe(true)
  })

  it('should clear urlErrorMessage text', () => {
    document.getElementById('urlErrorMessage').textContent = 'Some error'
    hideUrlError()
    expect(document.getElementById('urlErrorMessage').textContent).toBe('')
  })

  it('should remove error class from urlFormGroup', () => {
    document.getElementById('urlFormGroup').classList.add(ERROR_GROUP_CLASS_URL)
    hideUrlError()
    expect(
      document
        .getElementById('urlFormGroup')
        .classList.contains(ERROR_GROUP_CLASS_URL)
    ).toBe(false)
  })

  it('should remove input error class from urlInput', () => {
    document.getElementById('url-input').classList.add(ERROR_INPUT_CLASS)
    hideUrlError()
    expect(
      document.getElementById('url-input').classList.contains(ERROR_INPUT_CLASS)
    ).toBe(false)
  })
})

describe('upload/ui-feedback - showRadioError', () => {
  beforeEach(buildFullTestDom)

  it('should show actionOptionError element', () => {
    showRadioError(SELECT_OPTION_ERROR)
    expect(document.getElementById('actionOptionError').hidden).toBe(false)
  })

  it('should set actionOptionErrorMessage text', () => {
    showRadioError(SELECT_OPTION_ERROR)
    expect(
      document.getElementById('actionOptionErrorMessage').textContent
    ).toBe(SELECT_OPTION_ERROR)
  })

  it('should add error class to actionSelectionGroup', () => {
    showRadioError(SELECT_OPTION_ERROR)
    expect(
      document
        .getElementById('actionSelectionGroup')
        .classList.contains(ERROR_GROUP_CLASS_URL)
    ).toBe(true)
  })

  it('should show errorSummary with the message', () => {
    showRadioError(SELECT_OPTION_ERROR)
    expect(document.getElementById('errorSummary').hidden).toBe(false)
    expect(document.getElementById('errorSummaryMessage').textContent).toBe(
      SELECT_OPTION_ERROR
    )
  })

  it('should set errorSummaryMessage href to #actionRadios', () => {
    showRadioError(SELECT_OPTION_ERROR)
    expect(
      document.getElementById('errorSummaryMessage').getAttribute('href')
    ).toBe('#actionRadios')
  })
})

describe('upload/ui-feedback - hideRadioError', () => {
  beforeEach(buildFullTestDom)

  it('should hide actionOptionError element', () => {
    document.getElementById('actionOptionError').hidden = false
    hideRadioError()
    expect(document.getElementById('actionOptionError').hidden).toBe(true)
  })

  it('should clear actionOptionErrorMessage text', () => {
    document.getElementById('actionOptionErrorMessage').textContent =
      'Some error'
    hideRadioError()
    expect(
      document.getElementById('actionOptionErrorMessage').textContent
    ).toBe('')
  })

  it('should remove error class from actionSelectionGroup', () => {
    document
      .getElementById('actionSelectionGroup')
      .classList.add(ERROR_GROUP_CLASS_URL)
    hideRadioError()
    expect(
      document
        .getElementById('actionSelectionGroup')
        .classList.contains(ERROR_GROUP_CLASS_URL)
    ).toBe(false)
  })
})

describe('upload/ui-feedback - showCharLimitError', () => {
  beforeEach(buildTestDom)

  it('should add error class to textarea', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    showCharLimitError()
    expect(textarea.classList.contains(ERROR_TEXTAREA_CLASS)).toBe(true)
  })

  it('should not add form-group error class to textFormGroup', () => {
    const textFormGroup = document.getElementById('textFormGroup')
    showCharLimitError()
    expect(textFormGroup.classList.contains(ERROR_GROUP_CLASS)).toBe(false)
  })

  it('should not touch the inline uploadError element', () => {
    const uploadError = document.getElementById('uploadError')
    showCharLimitError()
    expect(uploadError.hidden).toBe(true)
  })
})

describe('upload/ui-feedback - hideCharLimitError', () => {
  beforeEach(buildTestDom)

  it('should remove error class from textarea', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.classList.add(ERROR_TEXTAREA_CLASS)
    hideCharLimitError()
    expect(textarea.classList.contains(ERROR_TEXTAREA_CLASS)).toBe(false)
  })

  it('should not hide uploadError set by showError', () => {
    const uploadError = document.getElementById('uploadError')
    uploadError.hidden = false
    hideCharLimitError()
    expect(uploadError.hidden).toBe(false)
  })

  it('should not clear errorMessage set by showError', () => {
    const errorMessage = document.getElementById('errorMessage')
    errorMessage.textContent = ENTER_TEXT_ERROR
    hideCharLimitError()
    expect(errorMessage.textContent).toBe(ENTER_TEXT_ERROR)
  })
})

describe('upload/ui-feedback - showInlineTextError', () => {
  beforeEach(buildTestDom)

  it('should show the inline uploadError element', () => {
    const uploadError = document.getElementById('uploadError')
    showInlineTextError('Too long.')
    expect(uploadError.hidden).toBe(false)
  })

  it('should set the errorMessage text', () => {
    const errorMessage = document.getElementById('errorMessage')
    showInlineTextError(ENTER_TEXT_ERROR)
    expect(errorMessage.textContent).toBe(ENTER_TEXT_ERROR)
  })

  it('should add form-group error class to textFormGroup', () => {
    const textFormGroup = document.getElementById('textFormGroup')
    showInlineTextError('Too long.')
    expect(textFormGroup.classList.contains(ERROR_GROUP_CLASS)).toBe(true)
  })

  it('should add textarea error class when inline error is shown', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    showInlineTextError('Too long.')
    expect(textarea.classList.contains(ERROR_TEXTAREA_CLASS)).toBe(true)
  })

  it('should NOT steal focus from the textarea', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    const focusSpy = vi.spyOn(textarea, 'focus')
    showInlineTextError('Too long.')
    expect(focusSpy).not.toHaveBeenCalled()
  })
})

describe('upload/ui-feedback - hideInlineTextError', () => {
  beforeEach(buildTestDom)

  it('should hide the inline uploadError element', () => {
    const uploadError = document.getElementById('uploadError')
    uploadError.hidden = false
    hideInlineTextError()
    expect(uploadError.hidden).toBe(true)
  })

  it('should clear the errorMessage text', () => {
    const errorMessage = document.getElementById('errorMessage')
    errorMessage.textContent = ENTER_TEXT_ERROR
    hideInlineTextError()
    expect(errorMessage.textContent).toBe('')
  })

  it('should remove form-group error class from textFormGroup', () => {
    const textFormGroup = document.getElementById('textFormGroup')
    textFormGroup.classList.add(ERROR_GROUP_CLASS)
    hideInlineTextError()
    expect(textFormGroup.classList.contains(ERROR_GROUP_CLASS)).toBe(false)
  })

  it('should remove textarea error class when inline error is hidden', () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.classList.add(ERROR_TEXTAREA_CLASS)
    hideInlineTextError()
    expect(textarea.classList.contains(ERROR_TEXTAREA_CLASS)).toBe(false)
  })
})
