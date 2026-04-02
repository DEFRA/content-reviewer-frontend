/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import { handleFormSubmit } from './form-handler.js'
import { submitTextReview, submitUrlReview } from './api-client.js'
import { hideError, showError } from './ui-feedback.js'

// Mock api-client so we control when submitTextReview resolves
vi.mock('./api-client.js', () => ({
  submitTextReview: vi.fn(),
  submitFileUpload: vi.fn(),
  submitUrlReview: vi.fn()
}))

// Mock ui-feedback so we can spy on hideError / showError
vi.mock('./ui-feedback.js', () => ({
  showError: vi.fn(),
  hideError: vi.fn(),
  hideSuccess: vi.fn(),
  showProgress: vi.fn(),
  hideProgress: vi.fn(),
  showUrlError: vi.fn(),
  hideUrlError: vi.fn(),
  showRadioError: vi.fn(),
  hideRadioError: vi.fn(),
  showCharLimitError: vi.fn(),
  hideCharLimitError: vi.fn()
}))

// Mock character-counter — updateCharacterCount re-applies char-limit state
vi.mock('./character-counter.js', () => ({
  updateCharacterCount: vi.fn()
}))

// Mock radio-handler — default to null (no selection)
vi.mock('./radio-handler.js', () => ({
  getSelectedAction: vi.fn(() => null),
  initializeRadioHandler: vi.fn()
}))

// Mock url-extractor
vi.mock('./url-extractor.js', () => ({
  parseGovUkUrl: vi.fn(),
  extractGovspeakText: vi.fn()
}))

const VALID_TEXT =
  'This is some valid content that is long enough to submit for review purposes.'

const CHARACTER_LIMIT = 100000
const OVER_LIMIT_LENGTH = CHARACTER_LIMIT + 1

const TEXT_CONTENT_ID = 'text-content'
const GOVUK_TEST_URL = 'https://www.gov.uk/test'

function buildDom() {
  document.body.innerHTML = `
    <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
    <form id="uploadForm">
      <div class="govuk-form-group" id="actionSelectionGroup">
        <p id="actionOptionError" hidden><span id="actionOptionErrorMessage"></span></p>
        <div id="actionRadios">
          <input class="govuk-radios__input" id="action-url" name="actionOption" type="radio" value="url">
          <input class="govuk-radios__input" id="action-text" name="actionOption" type="radio" value="text">
        </div>
      </div>
      <div id="urlFormGroup" hidden>
        <p id="urlError" hidden><span id="urlErrorMessage"></span></p>
        <input id="url-input" type="text">
      </div>
      <div id="textFormGroup" hidden>
        <div id="textFieldWrapper">
          <p id="uploadError" hidden>
            <span id="errorMessage"></span>
          </p>
          <textarea id="text-content"></textarea>
        </div>
      </div>
      <input type="file" id="file-upload" />
      <button id="uploadButton" type="submit">Review content</button>
      <div id="uploadProgress" hidden>
        <div id="uploadStatusText"></div>
        <div id="uploadProgressText"></div>
        <div id="progressBar" data-progress="0"></div>
      </div>
      <div id="uploadSuccess" hidden></div>
      <div id="characterCountMessage"></div>
    </form>
  `
  initializeElements()
}

function makeSubmitEvent() {
  return { preventDefault: vi.fn() }
}

describe('upload/form-handler - no radio selected', () => {
  let showRadioError

  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue(null)
    const feedbackMod = await import('./ui-feedback.js')
    showRadioError = feedbackMod.showRadioError
  })

  it('should show radio error when no option is selected', async () => {
    const event = makeSubmitEvent()
    await handleFormSubmit(event)
    expect(showRadioError).toHaveBeenCalledWith('Select an option to proceed')
  })

  it('should not call submitTextReview when no option is selected', async () => {
    const event = makeSubmitEvent()
    await handleFormSubmit(event)
    expect(submitTextReview).not.toHaveBeenCalled()
  })

  it('should not call updateCharacterCount when no option is selected', async () => {
    const { updateCharacterCount } = await import('./character-counter.js')
    const event = makeSubmitEvent()
    await handleFormSubmit(event)
    expect(updateCharacterCount).not.toHaveBeenCalled()
  })
})

describe('upload/form-handler - hideError before valid submit', () => {
  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    // Set action to 'text' so text-submit path is exercised
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue('text')
  })

  it('should call hideError before submitTextReview when text is valid', async () => {
    const callOrder = []
    hideError.mockImplementation(() => callOrder.push('hideError'))
    submitTextReview.mockImplementation(() => {
      callOrder.push('submitTextReview')
      return Promise.resolve({ reviewId: 'abc' })
    })

    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = VALID_TEXT

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    // hideError must appear before submitTextReview in the call order
    const hideIdx = callOrder.indexOf('hideError')
    const submitIdx = callOrder.indexOf('submitTextReview')
    expect(hideIdx).toBeGreaterThanOrEqual(0)
    expect(submitIdx).toBeGreaterThan(hideIdx)
  })

  it('should call showError when no text and no file', async () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = ''

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showError).toHaveBeenCalledWith('Enter text content for review')
  })

  it('should call hideError at the start of every submission', async () => {
    submitTextReview.mockResolvedValue({ reviewId: 'xyz' })
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = VALID_TEXT

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    // hideError is called at least twice: once at top of handleFormSubmit,
    // once explicitly before submitTextReview
    expect(hideError).toHaveBeenCalled()
  })
})

describe('upload/form-handler - URL action validation', () => {
  let getSelectedAction
  let showUrlError

  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    getSelectedAction = radioMod.getSelectedAction
    const feedbackMod = await import('./ui-feedback.js')
    showUrlError = feedbackMod.showUrlError
    getSelectedAction.mockReturnValue('url')
  })

  it('should show empty-URL error when url input is blank', async () => {
    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).toHaveBeenCalledWith('Enter URL for content review')
  })

  it('should not call updateCharacterCount for URL action', async () => {
    const { updateCharacterCount } = await import('./character-counter.js')
    const event = makeSubmitEvent()
    await handleFormSubmit(event)
    expect(updateCharacterCount).not.toHaveBeenCalled()
  })

  it('should show invalid-URL error when URL is not a gov.uk URL', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(null)

    const urlInput = document.getElementById('url-input')
    urlInput.value = 'https://example.com/page'

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).toHaveBeenCalledWith('Enter a valid GOV.UK URL')
  })

  it('should accept the root https://www.gov.uk/ URL without showing an error', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    const GOVUK_ROOT_URL = 'https://www.gov.uk/'
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_ROOT_URL))
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_ROOT_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).not.toHaveBeenCalled()
    expect(submitUrlReview).toHaveBeenCalledWith(GOVUK_ROOT_URL)
  })
})

describe('upload/form-handler - URL action submission', () => {
  let getSelectedAction

  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    getSelectedAction = radioMod.getSelectedAction
    getSelectedAction.mockReturnValue('url')
  })

  it('should call submitUrlReview with URL for valid gov.uk URL', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(submitUrlReview).toHaveBeenCalledWith(GOVUK_TEST_URL)
  })
})

describe('upload/form-handler - URL action error handling', () => {
  let getSelectedAction
  let showUrlError

  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    getSelectedAction = radioMod.getSelectedAction
    const feedbackMod = await import('./ui-feedback.js')
    showUrlError = feedbackMod.showUrlError
    getSelectedAction.mockReturnValue('url')
  })

  it('should show fetch-failed error when submitUrlReview throws a network error', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    submitUrlReview.mockRejectedValue(new Error('NetworkError when fetching'))

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).toHaveBeenCalledWith(
      'Could not retrieve content from that URL'
    )
  })

  it('should not show duplicate error when submitUrlReview throws with a meaningful message', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    submitUrlReview.mockRejectedValue(
      new Error(
        'Could not extract any content from that URL. The page may use an unsupported layout.'
      )
    )

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    // submitUrlReview (mocked) threw but did not call showUrlError itself;
    // form-handler only calls showUrlError for bare network failures
    expect(showUrlError).not.toHaveBeenCalled()
  })

  it('should not show duplicate error when extracted text exceeds the character limit', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    submitUrlReview.mockRejectedValue(
      new Error(
        'Extracted text is too long. Maximum 100000 characters. The webpage has 120000 characters'
      )
    )

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    // submitUrlReview (mocked) threw but did not call showUrlError;
    // form-handler only shows fallback for network-level failures
    expect(showUrlError).not.toHaveBeenCalled()
  })
})

describe('upload/form-handler - URL clear and refocus after success', () => {
  let getSelectedAction

  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    getSelectedAction = radioMod.getSelectedAction
    getSelectedAction.mockReturnValue('url')
  })

  it('should clear the URL input after a successful URL review submission', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(urlInput.value).toBe('')
  })

  it('should set focus back to the URL input after a successful URL review submission', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL
    const focusSpy = vi.spyOn(urlInput, 'focus')

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(focusSpy).toHaveBeenCalledOnce()
  })

  it('should NOT clear the URL input when URL review throws an error', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    submitUrlReview.mockRejectedValue(new Error('NetworkError'))

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(urlInput.value).toBe(GOVUK_TEST_URL)
  })

  it('should not show additional error when submitUrlReview throws with a specific message', async () => {
    const { parseGovUkUrl } = await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    const { showUrlError } = await import('./ui-feedback.js')
    const specificError = new Error('Rate limit exceeded on GOV.UK')
    submitUrlReview.mockRejectedValue(specificError)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    // submitUrlReview (mocked) handles its own error display;
    // form-handler only shows fallback for bare network failures
    expect(showUrlError).not.toHaveBeenCalled()
  })
})

describe('upload/form-handler - text action file-only submit', () => {
  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue('text')
    const { submitFileUpload } = await import('./api-client.js')
    submitFileUpload.mockResolvedValue({ reviewId: 'file-review-1' })
  })

  it('should call submitFileUpload when a file is selected and text is empty', async () => {
    const fileInput = document.getElementById('file-upload')
    const mockFile = new File(['content'], 'report.pdf', {
      type: 'application/pdf'
    })
    Object.defineProperty(fileInput, 'files', {
      value: { 0: mockFile, length: 1 },
      configurable: true
    })
    document.getElementById(TEXT_CONTENT_ID).value = ''

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    const { submitFileUpload } = await import('./api-client.js')
    expect(submitFileUpload).toHaveBeenCalledWith(mockFile)
  })

  it('should not call submitTextReview when submitting a file', async () => {
    const fileInput = document.getElementById('file-upload')
    Object.defineProperty(fileInput, 'files', {
      value: { 0: new File(['x'], 'test.txt'), length: 1 },
      configurable: true
    })
    document.getElementById(TEXT_CONTENT_ID).value = ''

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(submitTextReview).not.toHaveBeenCalled()
  })
})

describe('upload/form-handler - text action both file and text present', () => {
  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue('text')
  })

  it('should call showError with ERROR_ENTER_TEXT when both file and text are present', async () => {
    const fileInput = document.getElementById('file-upload')
    Object.defineProperty(fileInput, 'files', {
      value: {
        0: new File(['content'], 'doc.pdf', { type: 'application/pdf' }),
        length: 1
      },
      configurable: true
    })
    document.getElementById(TEXT_CONTENT_ID).value = VALID_TEXT

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    // line 144: both file and text present → handleTextError(ERROR_ENTER_TEXT)
    expect(showError).toHaveBeenCalledWith('Enter text content for review')
    expect(submitTextReview).not.toHaveBeenCalled()
  })
})

describe('upload/form-handler - handleFormSubmit catch block', () => {
  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue('text')
  })

  it('should log the error when handleTextSubmit throws (catch block at line 144)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    document.getElementById(TEXT_CONTENT_ID).value = VALID_TEXT
    const { submitTextReview: submitMock } = await import('./api-client.js')
    submitMock.mockRejectedValueOnce(new Error('Unexpected server failure'))

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(consoleSpy).toHaveBeenCalledWith(
      '[UPLOAD-HANDLER] Form submission error:',
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })
})

describe('upload/form-handler - text action text-too-long', () => {
  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue('text')
  })

  it('should show error when text exceeds 100000 characters', async () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'x'.repeat(OVER_LIMIT_LENGTH)

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining('Text content too long')
    )
  })

  it('should not call submitTextReview when text is too long', async () => {
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'x'.repeat(OVER_LIMIT_LENGTH)

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(submitTextReview).not.toHaveBeenCalled()
  })

  it('should call updateCharacterCount to re-apply char-limit state after hideError', async () => {
    const { updateCharacterCount } = await import('./character-counter.js')
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'x'.repeat(OVER_LIMIT_LENGTH)

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(updateCharacterCount).toHaveBeenCalled()
  })
})

describe('upload/form-handler - absent uploadButton (disableSubmit/enableSubmit false branch)', () => {
  beforeEach(async () => {
    // Build DOM without uploadButton so disableSubmit/enableSubmit hit false branch
    document.body.innerHTML = `
      <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
      <div class="govuk-form-group" id="actionSelectionGroup">
        <p id="actionOptionError" hidden><span id="actionOptionErrorMessage"></span></p>
        <div id="actionRadios"></div>
      </div>
      <div id="urlFormGroup" hidden>
        <p id="urlError" hidden><span id="urlErrorMessage"></span></p>
        <input id="url-input" type="text">
      </div>
      <div id="textFormGroup" hidden>
        <p id="uploadError" hidden><span id="errorMessage"></span></p>
        <textarea id="text-content"></textarea>
      </div>
      <input type="file" id="file-upload" />
      <div id="uploadProgress" hidden></div>
      <div id="uploadSuccess" hidden></div>
      <div id="characterCountMessage"></div>
    `
    const { initializeElements } = await import('./dom-elements.js')
    initializeElements()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue('text')
  })

  it('should not throw when uploadButton is absent (disableSubmit/enableSubmit false branch)', async () => {
    document.getElementById(TEXT_CONTENT_ID).value = VALID_TEXT
    const { submitTextReview: submitMock } = await import('./api-client.js')
    submitMock.mockResolvedValueOnce({ reviewId: 'abc' })

    const event = makeSubmitEvent()
    await expect(handleFormSubmit(event)).resolves.toBeUndefined()
  })

  it('should not throw when uploadButton is absent and no action selected (enableSubmit false branch)', async () => {
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue(null)

    const event = makeSubmitEvent()
    await expect(handleFormSubmit(event)).resolves.toBeUndefined()
    // enableSubmit called after showRadioError — no uploadButton → false branch covered
  })
})

describe('upload/form-handler - unknown action (neither url nor text)', () => {
  beforeEach(async () => {
    buildDom()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    // Return a value that is neither 'url' nor 'text'
    radioMod.getSelectedAction.mockReturnValue('file')
  })

  it('should not throw and not call submitTextReview for unknown action', async () => {
    const event = makeSubmitEvent()
    await handleFormSubmit(event)
    expect(submitTextReview).not.toHaveBeenCalled()
  })
})

describe('upload/form-handler - clearAndRefocusUrlInput with absent urlInput', () => {
  beforeEach(async () => {
    // Build DOM without url-input so clearAndRefocusUrlInput hits false branch
    document.body.innerHTML = `
      <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
      <div id="urlFormGroup" hidden>
        <p id="urlError" hidden><span id="urlErrorMessage"></span></p>
      </div>
      <div id="actionSelectionGroup">
        <p id="actionOptionError" hidden><span id="actionOptionErrorMessage"></span></p>
        <div id="actionRadios"></div>
      </div>
      <div id="textFormGroup" hidden>
        <p id="uploadError" hidden><span id="errorMessage"></span></p>
        <textarea id="text-content"></textarea>
      </div>
      <input type="file" id="file-upload" />
      <button id="uploadButton">Upload</button>
      <div id="uploadProgress" hidden></div>
      <div id="uploadSuccess" hidden></div>
      <div id="characterCountMessage"></div>
    `
    const { initializeElements } = await import('./dom-elements.js')
    initializeElements()
    vi.clearAllMocks()
    const radioMod = await import('./radio-handler.js')
    radioMod.getSelectedAction.mockReturnValue('url')
  })

  it('should not throw when urlInput is absent after successful URL submit', async () => {
    const { extractGovspeakText, parseGovUkUrl } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL('https://www.gov.uk/test'))
    extractGovspeakText.mockResolvedValueOnce('<html>Content</html>')
    const { submitUrlReview } = await import('./api-client.js')
    submitUrlReview.mockResolvedValueOnce({ reviewId: 'url-review-1' })

    const event = makeSubmitEvent()
    await expect(handleFormSubmit(event)).resolves.toBeUndefined()
    // clearAndRefocusUrlInput called with no url-input element → no throw
  })
})
