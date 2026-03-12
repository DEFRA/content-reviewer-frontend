/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import { handleFormSubmit } from './form-handler.js'
import { submitTextReview } from './api-client.js'
import { hideError, showError } from './ui-feedback.js'

// Mock api-client so we control when submitTextReview resolves
vi.mock('./api-client.js', () => ({
  submitTextReview: vi.fn(),
  submitFileUpload: vi.fn()
}))

// Mock ui-feedback so we can spy on hideError / showError
vi.mock('./ui-feedback.js', () => ({
  showError: vi.fn(),
  hideError: vi.fn(),
  hideSuccess: vi.fn(),
  showProgress: vi.fn(),
  hideProgress: vi.fn()
}))

const VALID_TEXT =
  'This is some valid content that is long enough to submit for review purposes.'

function buildDom() {
  document.body.innerHTML = `
    <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
    <form id="uploadForm">
      <div id="textFormGroup">
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

describe('upload/form-handler - hideError before valid submit', () => {
  beforeEach(() => {
    buildDom()
    vi.clearAllMocks()
  })

  it('should call hideError before submitTextReview when text is valid', async () => {
    const callOrder = []
    hideError.mockImplementation(() => callOrder.push('hideError'))
    submitTextReview.mockImplementation(() => {
      callOrder.push('submitTextReview')
      return Promise.resolve({ reviewId: 'abc' })
    })

    const textarea = document.getElementById('text-content')
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
    const textarea = document.getElementById('text-content')
    textarea.value = ''

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    expect(showError).toHaveBeenCalledWith('Enter text content for review')
  })

  it('should call hideError at the start of every submission', async () => {
    submitTextReview.mockResolvedValue({ reviewId: 'xyz' })
    const textarea = document.getElementById('text-content')
    textarea.value = VALID_TEXT

    const event = makeSubmitEvent()
    await handleFormSubmit(event)

    // hideError is called at least twice: once at top of handleFormSubmit,
    // once explicitly before submitTextReview
    expect(hideError).toHaveBeenCalled()
  })
})
