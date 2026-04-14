/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
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

const PROGRESS_PERCENTAGE_HALF = 50
const EMPTY_DIV_HTML = '<div></div>'

describe('upload/ui-feedback - missing elements edge cases', () => {
  it('should handle missing elements gracefully', () => {
    document.body.innerHTML = EMPTY_DIV_HTML
    initializeElements()

    expect(() => showError('Test')).not.toThrow()
    expect(() => hideError()).not.toThrow()
    expect(() => hideSuccess()).not.toThrow()
    expect(() => showProgress('Test', PROGRESS_PERCENTAGE_HALF)).not.toThrow()
    expect(() => hideProgress()).not.toThrow()
  })

  it('should handle missing URL and radio elements in showUrlError, hideUrlError, showRadioError', () => {
    // Build DOM that omits urlError, urlErrorMessage, urlFormGroup, urlInput,
    // actionSelectionGroup, actionOptionError, actionOptionErrorMessage
    document.body.innerHTML = `
      <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
      <button id="uploadButton"></button>
      <div id="uploadSuccess" hidden></div>
    `
    initializeElements()

    expect(() => showUrlError('URL error')).not.toThrow()
    expect(() => hideUrlError()).not.toThrow()
    expect(() => showRadioError('Radio error')).not.toThrow()
    expect(() => hideRadioError()).not.toThrow()
  })

  it('should handle absent errorSummary and errorSummaryMessage in showRadioError', () => {
    // DOM has actionSelectionGroup/actionOptionError but NO errorSummary/errorSummaryMessage
    // This covers the false branches for those two if-blocks in showRadioError (lines 204, 207)
    document.body.innerHTML = `
      <div id="actionSelectionGroup">
        <p id="actionOptionError" hidden><span id="actionOptionErrorMessage"></span></p>
      </div>
      <div id="uploadSuccess" hidden></div>
    `
    initializeElements()

    expect(() => showRadioError('Select an option')).not.toThrow()
  })

  it('should handle absent textContentInput in showCharLimitError and hideCharLimitError', () => {
    // No text-content element — false branch for if (elements.textContentInput)
    document.body.innerHTML = EMPTY_DIV_HTML
    initializeElements()

    expect(() => showCharLimitError()).not.toThrow()
    expect(() => hideCharLimitError()).not.toThrow()
  })

  it('should handle absent elements in showInlineTextError and hideInlineTextError', () => {
    // No uploadError, errorMessage, textFormGroup, textContentInput
    document.body.innerHTML = EMPTY_DIV_HTML
    initializeElements()

    expect(() => showInlineTextError('Inline error')).not.toThrow()
    expect(() => hideInlineTextError()).not.toThrow()
  })

  it('should handle ALL absent elements in showUrlError and hideUrlError', () => {
    // No errorSummary, errorSummaryMessage, urlError, urlErrorMessage, urlFormGroup, urlInput, uploadButton
    document.body.innerHTML = '<div id="uploadSuccess" hidden></div>'
    initializeElements()

    expect(() => showUrlError('URL error')).not.toThrow()
    expect(() => hideUrlError()).not.toThrow()
  })

  it('should handle absent actionOptionError and actionOptionErrorMessage in hideRadioError', () => {
    // actionSelectionGroup present but actionOptionError and actionOptionErrorMessage absent
    document.body.innerHTML = `
      <div id="actionSelectionGroup"></div>
      <div id="uploadSuccess" hidden></div>
    `
    initializeElements()

    expect(() => hideRadioError()).not.toThrow()
  })
})
