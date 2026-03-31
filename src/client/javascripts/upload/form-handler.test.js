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
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    const GOVUK_ROOT_URL = 'https://www.gov.uk/'
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_ROOT_URL))
    extractGovspeakText.mockResolvedValue('<html><body>Home</body></html>')
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_ROOT_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).not.toHaveBeenCalled()
    expect(submitUrlReview).toHaveBeenCalledWith(
      '<html><body>Home</body></html>',
      GOVUK_ROOT_URL
    )
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

  it('should call submitUrlReview with extracted HTML for valid gov.uk URL', async () => {
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    extractGovspeakText.mockResolvedValue(
      '<html><body>Extracted content</body></html>'
    )
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(submitUrlReview).toHaveBeenCalledWith(
      '<html><body>Extracted content</body></html>',
      GOVUK_TEST_URL
    )
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

  it('should show fetch-failed error when gov.uk URL fetch throws a network error', async () => {
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    extractGovspeakText.mockRejectedValue(new Error('NetworkError'))

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).toHaveBeenCalledWith(
      'Could not retrieve content from that URL'
    )
  })

  it('should show unsupported-layout error when extraction finds no matching content', async () => {
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    extractGovspeakText.mockRejectedValue(
      new Error(
        'Could not extract any content from that URL. The page may use an unsupported layout.'
      )
    )

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).toHaveBeenCalledWith(
      'Could not extract content from that URL. The page layout is not supported'
    )
  })

  it('should show error when extracted text exceeds the character limit', async () => {
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    const limitError = new Error(
      'Extracted text is too long. Maximum 100000 characters. The webpage has 120000 characters'
    )
    extractGovspeakText.mockRejectedValue(limitError)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showUrlError).toHaveBeenCalledWith(
      'Extracted text is too long. Maximum 100000 characters. The webpage has 120000 characters'
    )
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
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    extractGovspeakText.mockResolvedValue('<html><body>Content</body></html>')
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(urlInput.value).toBe('')
  })

  it('should set focus back to the URL input after a successful URL review submission', async () => {
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    extractGovspeakText.mockResolvedValue('<html><body>Content</body></html>')
    submitUrlReview.mockResolvedValue(undefined)

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL
    const focusSpy = vi.spyOn(urlInput, 'focus')

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(focusSpy).toHaveBeenCalledOnce()
  })

  it('should NOT clear the URL input when URL review throws an error', async () => {
    const { parseGovUkUrl, extractGovspeakText } =
      await import('./url-extractor.js')
    parseGovUkUrl.mockReturnValue(new URL(GOVUK_TEST_URL))
    extractGovspeakText.mockRejectedValue(new Error('NetworkError'))

    const urlInput = document.getElementById('url-input')
    urlInput.value = GOVUK_TEST_URL

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(urlInput.value).toBe(GOVUK_TEST_URL)
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
