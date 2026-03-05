/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeElements } from './dom-elements.js'
import { updateCharacterCount } from './character-counter.js'

describe('upload/character-counter', () => {
  let textInput
  let charCountMsg

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="uploadForm">
        <textarea id="text-content"></textarea>
        <div id="characterCountMessage"></div>
      </form>
    `
    initializeElements()
    textInput = document.getElementById('text-content')
    charCountMsg = document.getElementById('characterCountMessage')
  })

  it('should clear count when input is empty', () => {
    textInput.value = ''
    updateCharacterCount()

    expect(charCountMsg.textContent).toBe('')
    expect(charCountMsg.style.display).toBe('none')
  })

  it('should show remaining characters', () => {
    textInput.value = 'Hello World'
    updateCharacterCount()

    expect(charCountMsg.textContent).toContain('characters remaining')
    expect(charCountMsg.style.display).toBe('')
    expect(charCountMsg.classList.contains('govuk-error-message')).toBe(false)
  })

  it('should show error when over limit', () => {
    textInput.value = 'x'.repeat(100001) // Over 100,000 limit
    updateCharacterCount()

    expect(charCountMsg.textContent).toContain('characters too many')
    expect(charCountMsg.classList.contains('govuk-error-message')).toBe(true)
  })

  it('should calculate remaining characters correctly', () => {
    textInput.value = 'x'.repeat(1000)
    updateCharacterCount()

    expect(charCountMsg.textContent).toContain('99000 characters remaining')
  })

  it('should calculate excess characters correctly', () => {
    textInput.value = 'x'.repeat(100010)
    updateCharacterCount()

    expect(charCountMsg.textContent).toContain(
      'You have 10 characters too many'
    )
  })

  it('should handle missing elements gracefully', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()

    // Should not throw error
    expect(() => updateCharacterCount()).not.toThrow()
  })

  it('should update display style when showing count', () => {
    charCountMsg.style.display = 'none'
    textInput.value = 'Test'
    updateCharacterCount()

    expect(charCountMsg.style.display).toBe('')
  })
})
