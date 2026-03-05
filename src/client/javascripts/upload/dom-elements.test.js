/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  initializeElements,
  getElements,
  getFileInput
} from './dom-elements.js'

describe('upload/dom-elements', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="uploadForm">
        <textarea id="text-content"></textarea>
        <div id="characterCountMessage"></div>
        <input type="file" id="file-upload" />
        <button id="uploadButton" type="submit">Upload</button>
        <div id="uploadProgress"></div>
        <div id="progressBar"></div>
        <div id="uploadStatusText"></div>
        <div id="uploadProgressText"></div>
        <div id="uploadError"></div>
        <div id="uploadSuccess"></div>
        <div id="errorMessage"></div>
      </form>
    `
  })

  it('should initialize all required elements', () => {
    initializeElements()
    const elements = getElements()

    expect(elements.textContentInput).toBeDefined()
    expect(elements.characterCountMessage).toBeDefined()
    expect(elements.uploadButton).toBeDefined()
    expect(elements.uploadProgress).toBeDefined()
    expect(elements.progressBar).toBeDefined()
    expect(elements.uploadStatusText).toBeDefined()
    expect(elements.uploadProgressText).toBeDefined()
    expect(elements.uploadError).toBeDefined()
    expect(elements.uploadSuccess).toBeDefined()
    expect(elements.errorMessage).toBeDefined()
    expect(elements.form).toBeDefined()
  })

  it('should return correct element references', () => {
    initializeElements()
    const elements = getElements()

    expect(elements.textContentInput.id).toBe('text-content')
    expect(elements.form.id).toBe('uploadForm')
    expect(elements.uploadButton.id).toBe('uploadButton')
  })

  it('should get file input element', () => {
    const fileInput = getFileInput()
    expect(fileInput).toBeDefined()
    expect(fileInput.id).toBe('file-upload')
    expect(fileInput.type).toBe('file')
  })

  it('should handle missing elements gracefully', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()
    const elements = getElements()

    expect(elements.textContentInput).toBeNull()
    expect(elements.form).toBeNull()
  })

  it('should return null for missing file input', () => {
    document.body.innerHTML = '<div></div>'
    const fileInput = getFileInput()
    expect(fileInput).toBeNull()
  })

  it('should cache elements after initialization', () => {
    initializeElements()
    const elements1 = getElements()
    const elements2 = getElements()

    // Should return same object reference
    expect(elements1).toBe(elements2)
  })
})
