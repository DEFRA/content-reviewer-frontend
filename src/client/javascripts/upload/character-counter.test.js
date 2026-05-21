/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeElements } from './dom-elements.js'
import {
  updateCharacterCount,
  initCharacterCount
} from './character-counter.js'

// Mock ui-feedback so showCharLimitError / hideCharLimitError are observable
vi.mock('./ui-feedback.js', () => ({
  showCharLimitError: vi.fn(),
  hideCharLimitError: vi.fn(),
  showInlineTextError: vi.fn(),
  hideInlineTextError: vi.fn(),
  showError: vi.fn(),
  hideError: vi.fn(),
  hideSuccess: vi.fn(),
  showProgress: vi.fn(),
  hideProgress: vi.fn(),
  showUrlError: vi.fn(),
  hideUrlError: vi.fn(),
  showRadioError: vi.fn(),
  hideRadioError: vi.fn()
}))

const CHARACTER_LIMIT = 100000
const GOVUK_ERROR_MESSAGE_CLASS = 'govuk-error-message'
const SAMPLE_TEXT = 'Hello World'
const COLOR_NORMAL = 'rgb(80, 90, 95)'
const COLOR_ERROR = 'rgb(212, 53, 28)'
const SMALL_EXCESS = 5
const TEXT_CONTENT_ID = 'text-content'
const CHAR_COUNT_MSG_ID = 'characterCountMessage'

function buildDom() {
  document.body.innerHTML = `
    <form id="uploadForm">
      <textarea id="text-content"></textarea>
      <p id="uploadError" hidden><span id="errorMessage"></span></p>
      <div id="characterCountMessage"></div>
    </form>
  `
  initializeElements()
}

async function getFeedbackMocks() {
  const mod = await import('./ui-feedback.js')
  return {
    showCharLimitError: mod.showCharLimitError,
    hideCharLimitError: mod.hideCharLimitError,
    showInlineTextError: mod.showInlineTextError,
    hideInlineTextError: mod.hideInlineTextError
  }
}

// ─── updateCharacterCount: empty input ────────────────────────────────────────

describe('upload/character-counter - empty input', () => {
  let textInput, charCountMsg, hideCharLimitError

  beforeEach(async () => {
    buildDom()
    textInput = document.getElementById(TEXT_CONTENT_ID)
    charCountMsg = document.getElementById(CHAR_COUNT_MSG_ID)
    ;({ hideCharLimitError } = await getFeedbackMocks())
    vi.clearAllMocks()
  })

  it('shows "You have 100000 characters remaining" when textarea is empty', () => {
    textInput.value = ''
    updateCharacterCount()
    expect(charCountMsg.textContent).toBe(
      `You have ${CHARACTER_LIMIT} characters remaining`
    )
  })

  it('makes the count message visible when textarea is empty', () => {
    textInput.value = ''
    updateCharacterCount()
    expect(charCountMsg.style.display).toBe('')
  })

  it('does not add the error class when textarea is empty', () => {
    charCountMsg.classList.add(GOVUK_ERROR_MESSAGE_CLASS)
    textInput.value = ''
    updateCharacterCount()
    expect(charCountMsg.classList.contains(GOVUK_ERROR_MESSAGE_CLASS)).toBe(
      false
    )
  })

  it('calls hideCharLimitError when textarea is empty', () => {
    textInput.value = ''
    updateCharacterCount()
    expect(hideCharLimitError).toHaveBeenCalled()
  })

  it('resets to full count after typing then clearing all text', () => {
    textInput.value = 'some text'
    updateCharacterCount()
    textInput.value = ''
    updateCharacterCount()
    expect(charCountMsg.textContent).toBe(
      `You have ${CHARACTER_LIMIT} characters remaining`
    )
    expect(charCountMsg.style.fontWeight).toBe('')
    expect(charCountMsg.style.color).toBe(COLOR_NORMAL)
  })

  it('resets to full count after going over limit then clearing', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + SMALL_EXCESS)
    updateCharacterCount()
    textInput.value = ''
    updateCharacterCount()
    expect(charCountMsg.textContent).toBe(
      `You have ${CHARACTER_LIMIT} characters remaining`
    )
    expect(charCountMsg.style.fontWeight).toBe('')
    expect(charCountMsg.style.color).toBe(COLOR_NORMAL)
    expect(hideCharLimitError).toHaveBeenCalled()
  })
})

// ─── updateCharacterCount: within limit ───────────────────────────────────────

describe('upload/character-counter - within limit', () => {
  let textInput, charCountMsg, hideCharLimitError

  beforeEach(async () => {
    buildDom()
    textInput = document.getElementById(TEXT_CONTENT_ID)
    charCountMsg = document.getElementById(CHAR_COUNT_MSG_ID)
    ;({ hideCharLimitError } = await getFeedbackMocks())
    vi.clearAllMocks()
  })

  it('shows "You have n characters remaining" label', () => {
    textInput.value = SAMPLE_TEXT
    updateCharacterCount()
    expect(charCountMsg.textContent).toContain('You have')
    expect(charCountMsg.textContent).toContain('characters remaining')
  })

  it('makes the count message visible', () => {
    textInput.value = SAMPLE_TEXT
    updateCharacterCount()
    expect(charCountMsg.style.display).toBe('')
  })

  it('does not add the error class to the count message', () => {
    textInput.value = SAMPLE_TEXT
    updateCharacterCount()
    expect(charCountMsg.classList.contains(GOVUK_ERROR_MESSAGE_CLASS)).toBe(
      false
    )
  })

  it('displays normal (non-bold) font weight', () => {
    textInput.value = SAMPLE_TEXT
    updateCharacterCount()
    expect(charCountMsg.style.fontWeight).toBe('')
  })

  it('calls hideCharLimitError', () => {
    textInput.value = SAMPLE_TEXT
    updateCharacterCount()
    expect(hideCharLimitError).toHaveBeenCalled()
  })

  it('sets normal colour (#505a5f) on the count message', () => {
    textInput.value = SAMPLE_TEXT
    updateCharacterCount()
    expect(charCountMsg.style.color).toBe(COLOR_NORMAL)
  })

  it('calculates remaining characters correctly for 1000 chars', () => {
    textInput.value = 'x'.repeat(1000)
    updateCharacterCount()
    expect(charCountMsg.textContent).toContain(
      'You have 99000 characters remaining'
    )
  })

  it('shows "You have 0 characters remaining" at exactly the limit', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT)
    updateCharacterCount()
    expect(charCountMsg.textContent).toBe('You have 0 characters remaining')
  })
})

// ─── updateCharacterCount: over limit ─────────────────────────────────────────

describe('upload/character-counter - over limit', () => {
  let textInput, charCountMsg, showCharLimitError, showInlineTextError

  beforeEach(async () => {
    buildDom()
    textInput = document.getElementById(TEXT_CONTENT_ID)
    charCountMsg = document.getElementById(CHAR_COUNT_MSG_ID)
    ;({ showCharLimitError, showInlineTextError } = await getFeedbackMocks())
    vi.clearAllMocks()
  })

  it('shows "You have n characters too many" label', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 1)
    updateCharacterCount()
    expect(charCountMsg.textContent).toContain('characters too many')
  })

  it('adds the error class to the count message', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 1)
    updateCharacterCount()
    expect(charCountMsg.classList.contains(GOVUK_ERROR_MESSAGE_CLASS)).toBe(
      true
    )
  })

  it('sets bold font weight on the count message', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 1)
    updateCharacterCount()
    expect(charCountMsg.style.fontWeight).toBe('bold')
  })

  it('sets error colour (#d4351c) on the count message', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 1)
    updateCharacterCount()
    expect(charCountMsg.style.color).toBe(COLOR_ERROR)
  })

  it('calls showCharLimitError when over limit', () => {
    const overCount = CHARACTER_LIMIT + 10
    textInput.value = 'x'.repeat(overCount)
    updateCharacterCount()
    expect(showCharLimitError).toHaveBeenCalled()
  })

  it('calls showInlineTextError with the correct message when over limit', () => {
    const overCount = CHARACTER_LIMIT + 10
    textInput.value = 'x'.repeat(overCount)
    updateCharacterCount()
    expect(showInlineTextError).toHaveBeenCalledWith(
      `Text content too long. Maximum ${CHARACTER_LIMIT} characters. Your content has ${overCount} characters.`
    )
  })

  it('calculates excess characters correctly (10 over)', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 10)
    updateCharacterCount()
    expect(charCountMsg.textContent).toContain(
      'You have 10 characters too many'
    )
  })

  it('persists error class when typing more characters (still over limit)', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + SMALL_EXCESS)
    updateCharacterCount()
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 10)
    updateCharacterCount()
    expect(charCountMsg.classList.contains(GOVUK_ERROR_MESSAGE_CLASS)).toBe(
      true
    )
    expect(charCountMsg.style.fontWeight).toBe('bold')
  })
})

// ─── updateCharacterCount: state transitions ──────────────────────────────────

describe('upload/character-counter - state transitions', () => {
  let textInput, charCountMsg, hideCharLimitError, hideInlineTextError

  beforeEach(async () => {
    buildDom()
    textInput = document.getElementById(TEXT_CONTENT_ID)
    charCountMsg = document.getElementById(CHAR_COUNT_MSG_ID)
    ;({ hideCharLimitError, hideInlineTextError } = await getFeedbackMocks())
    vi.clearAllMocks()
  })

  it('clears error state when count returns from over to exactly at limit', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 1)
    updateCharacterCount()
    expect(charCountMsg.classList.contains(GOVUK_ERROR_MESSAGE_CLASS)).toBe(
      true
    )

    textInput.value = 'x'.repeat(CHARACTER_LIMIT)
    updateCharacterCount()
    expect(charCountMsg.classList.contains(GOVUK_ERROR_MESSAGE_CLASS)).toBe(
      false
    )
    expect(charCountMsg.style.fontWeight).toBe('')
    expect(hideCharLimitError).toHaveBeenCalled()
    expect(hideInlineTextError).toHaveBeenCalled()
  })

  it('clears error state when count drops below the limit', () => {
    textInput.value = 'x'.repeat(CHARACTER_LIMIT + 1)
    updateCharacterCount()

    textInput.value = 'x'.repeat(CHARACTER_LIMIT - 1)
    updateCharacterCount()
    expect(charCountMsg.classList.contains(GOVUK_ERROR_MESSAGE_CLASS)).toBe(
      false
    )
    expect(charCountMsg.style.fontWeight).toBe('')
    expect(charCountMsg.style.color).toBe(COLOR_NORMAL)
  })
})

// ─── updateCharacterCount: missing elements / display ─────────────────────────

describe('upload/character-counter - missing elements and display', () => {
  let textInput, charCountMsg

  beforeEach(() => {
    buildDom()
    textInput = document.getElementById(TEXT_CONTENT_ID)
    charCountMsg = document.getElementById(CHAR_COUNT_MSG_ID)
    vi.clearAllMocks()
  })

  it('does not throw when elements are absent', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()
    expect(() => updateCharacterCount()).not.toThrow()
  })

  it('makes count message visible for empty textarea', () => {
    charCountMsg.style.display = 'none'
    textInput.value = ''
    updateCharacterCount()
    expect(charCountMsg.style.display).toBe('')
  })

  it('makes count message visible when showing count for non-empty input', () => {
    charCountMsg.style.display = 'none'
    textInput.value = 'Test'
    updateCharacterCount()
    expect(charCountMsg.style.display).toBe('')
  })
})

// ─── updateCharacterCount / initCharacterCount: textFormGroup hidden guard ─────

describe('upload/character-counter - textFormGroup hidden guard', () => {
  function buildDomWithHiddenGroup() {
    document.body.innerHTML = `
      <form id="uploadForm">
        <div id="textFormGroup" hidden>
          <textarea id="text-content"></textarea>
          <div id="characterCountMessage"></div>
        </div>
      </form>
    `
    initializeElements()
  }

  it('updateCharacterCount returns early and leaves count message unchanged when textFormGroup is hidden', () => {
    buildDomWithHiddenGroup()
    const charCountMsg = document.getElementById('characterCountMessage')
    charCountMsg.textContent = 'sentinel'
    updateCharacterCount()
    expect(charCountMsg.textContent).toBe('sentinel')
  })

  it('initCharacterCount returns early and leaves count message unchanged when textFormGroup is hidden', () => {
    buildDomWithHiddenGroup()
    const charCountMsg = document.getElementById('characterCountMessage')
    charCountMsg.textContent = 'sentinel'
    initCharacterCount()
    expect(charCountMsg.textContent).toBe('sentinel')
  })
})

// ─── initCharacterCount ───────────────────────────────────────────────────────

describe('upload/character-counter - initCharacterCount', () => {
  let textInput, charCountMsg, showCharLimitError, hideCharLimitError

  beforeEach(async () => {
    buildDom()
    textInput = document.getElementById(TEXT_CONTENT_ID)
    charCountMsg = document.getElementById(CHAR_COUNT_MSG_ID)
    ;({ showCharLimitError, hideCharLimitError } = await getFeedbackMocks())
    vi.clearAllMocks()
  })

  it('shows full remaining count when textarea is empty', () => {
    textInput.value = ''
    initCharacterCount()
    expect(charCountMsg.textContent).toBe(
      `You have ${CHARACTER_LIMIT} characters remaining`
    )
  })

  it('makes count message visible even when textarea is empty', () => {
    textInput.value = ''
    initCharacterCount()
    expect(charCountMsg.style.display).toBe('')
  })

  it('sets normal colour when empty', () => {
    textInput.value = ''
    initCharacterCount()
    expect(charCountMsg.style.color).toBe(COLOR_NORMAL)
  })

  it('sets normal font weight when empty', () => {
    textInput.value = ''
    initCharacterCount()
    expect(charCountMsg.style.fontWeight).toBe('')
  })

  it('calls hideCharLimitError when textarea is empty', () => {
    textInput.value = ''
    initCharacterCount()
    expect(hideCharLimitError).toHaveBeenCalled()
  })

  it('shows remaining count correctly when textarea has content within limit', () => {
    textInput.value = 'x'.repeat(1000)
    initCharacterCount()
    expect(charCountMsg.textContent).toBe('You have 99000 characters remaining')
    expect(charCountMsg.style.color).toBe(COLOR_NORMAL)
  })

  it('shows error state when textarea is already over limit', () => {
    const overCount = CHARACTER_LIMIT + SMALL_EXCESS
    textInput.value = 'x'.repeat(overCount)
    initCharacterCount()
    expect(charCountMsg.textContent).toContain('characters too many')
    expect(charCountMsg.style.color).toBe(COLOR_ERROR)
    expect(charCountMsg.style.fontWeight).toBe('bold')
    expect(showCharLimitError).toHaveBeenCalled()
  })

  it('does not throw when elements are absent', () => {
    document.body.innerHTML = '<div></div>'
    initializeElements()
    expect(() => initCharacterCount()).not.toThrow()
  })
})
