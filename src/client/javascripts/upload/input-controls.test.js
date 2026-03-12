/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import { initializeTextInput } from './input-controls.js'

vi.mock('./character-counter.js', () => ({
  updateCharacterCount: vi.fn()
}))

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
      const btn = document.querySelector('.app-clear-button')
      expect(btn).not.toBeNull()
      expect(btn.textContent).toBe('Clear text')
    })

    it('should clear textarea value when Clear text is clicked', () => {
      initializeTextInput()
      const textarea = document.getElementById('text-content')
      textarea.value = 'Some content'

      const btn = document.querySelector('.app-clear-button')
      btn.click()

      expect(textarea.value).toBe('')
    })

    it('should hide the error message element when Clear text is clicked', () => {
      initializeTextInput()
      const uploadError = document.getElementById('uploadError')
      uploadError.hidden = false

      const btn = document.querySelector('.app-clear-button')
      btn.click()

      expect(uploadError.hidden).toBe(true)
    })

    it('should remove error classes when Clear text is clicked', () => {
      initializeTextInput()
      const textFormGroup = document.getElementById('textFormGroup')
      const textarea = document.getElementById('text-content')
      textFormGroup.classList.add('govuk-form-group--error')
      textarea.classList.add('govuk-textarea--error')

      const btn = document.querySelector('.app-clear-button')
      btn.click()

      expect(textFormGroup.classList.contains('govuk-form-group--error')).toBe(
        false
      )
      expect(textarea.classList.contains('govuk-textarea--error')).toBe(false)
    })

    it('should not add duplicate buttons when called twice', () => {
      initializeTextInput()
      initializeTextInput()

      const btns = document.querySelectorAll('.app-clear-button')
      expect(btns.length).toBe(1)
    })

    it('should do nothing when textContentInput is absent', () => {
      document.body.innerHTML = '<div></div>'
      initializeElements()

      expect(() => initializeTextInput()).not.toThrow()
    })
  })
})
