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

describe('upload/ui-feedback', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="uploadForm">
        <button id="uploadButton">Upload</button>
        <div id="uploadProgress" hidden>
          <div id="uploadStatusText"></div>
          <div id="uploadProgressText"></div>
          <div id="progressBar" data-progress="0"></div>
        </div>
        <div id="uploadError" hidden>
          <span id="errorMessage"></span>
        </div>
        <div id="uploadSuccess" hidden></div>
      </form>
    `
    initializeElements()
  })

  describe('showError', () => {
    it('should display error message', () => {
      const uploadError = document.getElementById('uploadError')
      const errorMessage = document.getElementById('errorMessage')

      showError('Test error message')

      expect(uploadError.hidden).toBe(false)
      expect(errorMessage.textContent).toBe('Test error message')
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
  })

  describe('hideError', () => {
    it('should hide error element', () => {
      const uploadError = document.getElementById('uploadError')
      uploadError.hidden = false

      hideError()

      expect(uploadError.hidden).toBe(true)
    })
  })

  describe('hideSuccess', () => {
    it('should hide success element', () => {
      const uploadSuccess = document.getElementById('uploadSuccess')
      uploadSuccess.hidden = false

      hideSuccess()

      expect(uploadSuccess.hidden).toBe(true)
    })
  })

  describe('showProgress', () => {
    it('should display progress with status and percentage', () => {
      const uploadProgress = document.getElementById('uploadProgress')
      const uploadStatusText = document.getElementById('uploadStatusText')
      const uploadProgressText = document.getElementById('uploadProgressText')
      const progressBar = document.getElementById('progressBar')

      showProgress('Uploading...', 50)

      expect(uploadProgress.hidden).toBe(false)
      expect(uploadStatusText.textContent).toBe('Uploading...')
      expect(uploadProgressText.textContent).toBe('50%')
      expect(progressBar.dataset.progress).toBe('50')
    })

    it('should round percentage to integer', () => {
      const progressBar = document.getElementById('progressBar')

      showProgress('Processing...', 45.7)

      expect(progressBar.dataset.progress).toBe('46')
    })
  })

  describe('hideProgress', () => {
    it('should hide progress element', () => {
      const uploadProgress = document.getElementById('uploadProgress')
      uploadProgress.hidden = false

      hideProgress()

      expect(uploadProgress.hidden).toBe(true)
    })

    it('should reset progress bar to 0', () => {
      const progressBar = document.getElementById('progressBar')
      progressBar.dataset.progress = '75'

      hideProgress()

      expect(progressBar.dataset.progress).toBe('0')
    })
  })

  it('should handle missing elements gracefully', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()

    expect(() => showError('Test')).not.toThrow()
    expect(() => hideError()).not.toThrow()
    expect(() => hideSuccess()).not.toThrow()
    expect(() => showProgress('Test', 50)).not.toThrow()
    expect(() => hideProgress()).not.toThrow()
  })
})
