/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeElements } from './dom-elements.js'
import { showDocumentError, hideDocumentError } from './ui-feedback.js'

const ERROR_GROUP_CLASS = 'govuk-form-group--error'
const DOCUMENT_ERROR_MSG = 'The selected file must be a PDF or Word document'
const EMPTY_DIV_HTML = '<div></div>'

function buildDocumentDom() {
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
      <div class="govuk-form-group" id="documentFormGroup" hidden>
        <p id="documentError" hidden><span id="documentErrorMessage"></span></p>
        <input type="file" id="file-upload">
      </div>
      <div id="uploadSuccess" hidden></div>
    </form>
  `
  initializeElements()
}

describe('upload/ui-feedback - showDocumentError', () => {
  beforeEach(buildDocumentDom)

  it('should show the errorSummary element', () => {
    showDocumentError(DOCUMENT_ERROR_MSG)
    expect(document.getElementById('errorSummary').hidden).toBe(false)
  })

  it('should set errorSummaryMessage text and href', () => {
    showDocumentError(DOCUMENT_ERROR_MSG)
    const link = document.getElementById('errorSummaryMessage')
    expect(link.textContent).toBe(DOCUMENT_ERROR_MSG)
    expect(link.getAttribute('href')).toBe('#file-upload')
  })

  it('should show the inline documentError element', () => {
    showDocumentError(DOCUMENT_ERROR_MSG)
    expect(document.getElementById('documentError').hidden).toBe(false)
  })

  it('should set documentErrorMessage text', () => {
    showDocumentError(DOCUMENT_ERROR_MSG)
    expect(document.getElementById('documentErrorMessage').textContent).toBe(
      DOCUMENT_ERROR_MSG
    )
  })

  it('should add error class to documentFormGroup', () => {
    showDocumentError(DOCUMENT_ERROR_MSG)
    expect(
      document
        .getElementById('documentFormGroup')
        .classList.contains(ERROR_GROUP_CLASS)
    ).toBe(true)
  })

  it('should re-enable the upload button', () => {
    const btn = document.getElementById('uploadButton')
    btn.disabled = true
    showDocumentError(DOCUMENT_ERROR_MSG)
    expect(btn.disabled).toBe(false)
  })

  it('should hide success when showing document error', () => {
    document.getElementById('uploadSuccess').hidden = false
    showDocumentError(DOCUMENT_ERROR_MSG)
    expect(document.getElementById('uploadSuccess').hidden).toBe(true)
  })

  it('should hide progress when showing document error', () => {
    document.getElementById('uploadProgress').hidden = false
    showDocumentError(DOCUMENT_ERROR_MSG)
    expect(document.getElementById('uploadProgress').hidden).toBe(true)
  })

  it('should not throw when documentError elements are absent', () => {
    document.body.innerHTML = `
      <div id="errorSummary" hidden><a id="errorSummaryMessage"></a></div>
      <button id="uploadButton"></button>
      <div id="uploadSuccess" hidden></div>
    `
    initializeElements()
    expect(() => showDocumentError(DOCUMENT_ERROR_MSG)).not.toThrow()
  })

  it('should not throw when errorSummary, errorSummaryMessage and uploadButton are absent', () => {
    // Covers the false branches of if (elements.errorSummary), if (elements.errorSummaryMessage)
    // and if (elements.uploadButton) in showDocumentError
    document.body.innerHTML = `
      <div id="documentError" hidden><span id="documentErrorMessage"></span></div>
      <div class="govuk-form-group" id="documentFormGroup"></div>
      <div id="uploadSuccess" hidden></div>
    `
    initializeElements()
    expect(() => showDocumentError(DOCUMENT_ERROR_MSG)).not.toThrow()
  })
})

describe('upload/ui-feedback - hideDocumentError', () => {
  beforeEach(buildDocumentDom)

  it('should hide errorSummary', () => {
    document.getElementById('errorSummary').hidden = false
    hideDocumentError()
    expect(document.getElementById('errorSummary').hidden).toBe(true)
  })

  it('should hide the inline documentError element', () => {
    document.getElementById('documentError').hidden = false
    hideDocumentError()
    expect(document.getElementById('documentError').hidden).toBe(true)
  })

  it('should clear documentErrorMessage text', () => {
    document.getElementById('documentErrorMessage').textContent =
      DOCUMENT_ERROR_MSG
    hideDocumentError()
    expect(document.getElementById('documentErrorMessage').textContent).toBe('')
  })

  it('should remove error class from documentFormGroup', () => {
    document
      .getElementById('documentFormGroup')
      .classList.add(ERROR_GROUP_CLASS)
    hideDocumentError()
    expect(
      document
        .getElementById('documentFormGroup')
        .classList.contains(ERROR_GROUP_CLASS)
    ).toBe(false)
  })

  it('should not throw when documentError elements are absent', () => {
    document.body.innerHTML = EMPTY_DIV_HTML
    initializeElements()
    expect(() => hideDocumentError()).not.toThrow()
  })
})
