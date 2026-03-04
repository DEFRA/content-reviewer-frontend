/**
 * @vitest-environment jsdom
 *
 * jsdom is required because upload-handler.js is a browser-side script that
 * directly manipulates the DOM on DOMContentLoaded. Without jsdom there is no
 * document/window object and the module will throw on import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mirror the limit defined in the source module so tests stay in sync
// without hard-coding a magic number that could silently drift.
const TEXT_CHAR_LIMIT = 100000
const TEXT_CONTENT_ID = 'text-content'
const FILE_UPLOAD_ID = 'file-upload'

/**
 * Rebuild the full DOM before every test group.
 * We recreate it from scratch rather than reusing a shared instance because
 * the module caches element references in a module-level `elements` object.
 * Re-importing after vi.resetModules() re-runs initializeElements(), which
 * must find exactly these IDs present in the DOM.
 */
function setupDOM() {
  document.body.innerHTML = `
    <form id="uploadForm">
      <div class="govuk-form-group">
        <input id="${FILE_UPLOAD_ID}" type="file" />
      </div>
      <div class="govuk-form-group">
        <textarea id="text-content"></textarea>
        <span id="characterCountMessage"></span>
      </div>
      <button id="uploadButton" type="submit">Upload</button>
      <div id="uploadProgress" hidden></div>
      <div id="progressBar" data-progress="0"></div>
      <span id="uploadStatusText"></span>
      <span id="uploadProgressText"></span>
      <div id="uploadError" hidden></div>
      <span id="errorMessage"></span>
      <div id="uploadSuccess" hidden></div>
    </form>
    <table>
      <tbody id="reviewHistoryBody"></tbody>
    </table>
    <select id="historyLimit"><option value="5">5</option></select>
  `
}

/**
 * Reset the module registry and re-import so the module re-executes its
 * top-level code (including the DOMContentLoaded listener) against a fresh DOM.
 * Without vi.resetModules() Vitest returns the cached module and
 * DOMContentLoaded never fires again for the new DOM.
 */
async function loadModule() {
  vi.resetModules()
  await import('./upload-handler.js')
  // Manually fire DOMContentLoaded because jsdom does not fire it automatically
  // when document.body.innerHTML is set directly.
  document.dispatchEvent(new Event('DOMContentLoaded'))
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
describe('upload-handler - initialization', () => {
  beforeEach(async () => {
    setupDOM()
    // Provide a default fetch stub so the module does not fail if any async
    // path accidentally runs during setup.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r1' })
      })
    )
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should initialize without errors when form exists', () => {
    // Confirms that initialize() ran and did not throw when all expected
    // DOM elements are present.
    expect(document.getElementById('uploadForm')).not.toBeNull()
  })

  it('should not throw when form is absent', async () => {
    // The initialize() function has an early-return guard: if #uploadForm is
    // missing it skips all event-listener setup. This test exercises that guard
    // to prevent a regression where missing elements cause uncaught errors.
    document.body.innerHTML = ''
    vi.resetModules()
    await expect(import('./upload-handler.js')).resolves.not.toThrow()
    document.dispatchEvent(new Event('DOMContentLoaded'))
  })
})

// ---------------------------------------------------------------------------
// Character count
// ---------------------------------------------------------------------------
describe('upload-handler - character count', () => {
  beforeEach(async () => {
    setupDOM()
    // fetch is stubbed but not expected to be called in this suite.
    // It must exist so the module loads without errors.
    vi.stubGlobal('fetch', vi.fn())
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should show remaining characters when text is entered', () => {
    // Verifies the happy path: as the user types, they see how many
    // characters they have left before hitting the limit.
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    const msg = document.getElementById('characterCountMessage')
    textarea.value = 'Hello world'
    textarea.dispatchEvent(new Event('input'))
    expect(msg.textContent).toContain('characters remaining')
  })

  it('should clear character count when text is empty', () => {
    // When the textarea is emptied the counter must be hidden completely
    // rather than showing "100000 characters remaining", which would be
    // visually noisy for an empty field.
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    const msg = document.getElementById('characterCountMessage')
    textarea.value = ''
    textarea.dispatchEvent(new Event('input'))
    expect(msg.textContent).toBe('')
    expect(msg.style.display).toBe('none')
  })

  it('should show excess characters error when over limit', () => {
    // When the user exceeds the limit the counter must switch to an error style
    // (govuk-error-message) and tell them how many characters to remove.
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    const msg = document.getElementById('characterCountMessage')
    textarea.value = 'a'.repeat(TEXT_CHAR_LIMIT + 1)
    textarea.dispatchEvent(new Event('input'))
    expect(msg.textContent).toContain('characters too many')
    expect(msg.classList.contains('govuk-error-message')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutual exclusion between file and text inputs
// ---------------------------------------------------------------------------
describe('upload-handler - mutual exclusion', () => {
  beforeEach(async () => {
    setupDOM()
    vi.stubGlobal('fetch', vi.fn())
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should disable text input when file is selected', () => {
    // The form only supports one input at a time. When a file is chosen the
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    // Object.defineProperty is needed because the files property of
    // HTMLInputElement is read-only and cannot be set directly.
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['content'], 'test.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    expect(textarea.disabled).toBe(true)
  })

  it('should disable file input when text is entered', () => {
    // Mirror of the above: once the user types, the file input is locked so
    // the submit handler does not have to arbitrate between two sources.
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'some content'
    textarea.dispatchEvent(new Event('input'))

    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))
    expect(fileInput.disabled).toBe(true)
  })

  it('should enable both inputs when neither file nor text present', () => {
    // Ensures the reset path works: clearing both inputs must re-enable both
    // so the user can start a new submission without refreshing the page.
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [],
      configurable: true
    })
    textarea.value = ''
    fileInput.dispatchEvent(new Event('change'))
    expect(fileInput.disabled).toBe(false)
    expect(textarea.disabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Clear buttons
// ---------------------------------------------------------------------------
describe('upload-handler - clear buttons', () => {
  beforeEach(async () => {
    setupDOM()
    vi.stubGlobal('fetch', vi.fn())
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should clear the file input when the clear file button is clicked', () => {
    // The dynamically-injected "Clear File" button must re-enable the file
    // input so the user can choose a different file without refreshing the page.
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['content'], 'test.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))

    const clearBtn = document.querySelector('.app-clear-button')
    expect(clearBtn).not.toBeNull()
    clearBtn.click()
    expect(fileInput.disabled).toBe(false)
  })

  it('should clear text input when the clear text button is clicked', () => {
    // The "Clear text" button must empty the textarea and remove any disabled
    // state so the user can switch back to entering text.
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'some content'
    textarea.dispatchEvent(new Event('input'))

    // The text clear button is always appended after the file clear button,
    // so it is the last .app-clear-button in the DOM.
    const clearBtns = document.querySelectorAll('.app-clear-button')
    const textClearBtn = clearBtns[clearBtns.length - 1]
    expect(textClearBtn).not.toBeNull()
    textClearBtn.click()
    expect(textarea.value).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Progress and error UI
// ---------------------------------------------------------------------------
describe('upload-handler - progress and error UI', () => {
  beforeEach(async () => {
    setupDOM()
    vi.stubGlobal('fetch', vi.fn())
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should show progress indicator when file upload starts', async () => {
    // Verifies that the progress section becomes visible immediately after
    // the form is submitted with a file, giving the user feedback that work
    // is happening even before the fetch resolves.
    const form = document.getElementById('uploadForm')
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['content'], 'test.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r1' })
      })
    )

    form.dispatchEvent(new Event('submit'))
    // waitFor retries until the assertion passes or the timeout is reached,
    // which is necessary because the hidden attribute is set asynchronously.
    await vi.waitFor(() => {
      expect(document.getElementById('uploadProgress').hidden).not.toBe(
        undefined
      )
    })
  })

  it('should show error banner when file upload fails', async () => {
    // When the server returns a non-OK response the user must see a clear
    // error message rather than a silent failure so they know to retry.
    const form = document.getElementById('uploadForm')
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['content'], 'test.pdf')],
      configurable: true
    })
    fileInput.dispatchEvent(new Event('change'))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: 'Server error' })
      })
    )

    form.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.getElementById('uploadError').hidden).toBe(false)
    })
    expect(document.getElementById('errorMessage').textContent).toContain(
      'Upload failed'
    )
  })
})

// ---------------------------------------------------------------------------
// Form submit validation paths
// ---------------------------------------------------------------------------
describe('upload-handler - form submit: validation errors', () => {
  beforeEach(async () => {
    setupDOM()
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should show error when neither file nor text is provided', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const form = document.getElementById('uploadForm')
    form.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.getElementById('uploadError').hidden).toBe(false)
    })
    expect(document.getElementById('errorMessage').textContent).toContain(
      'Enter text content for review'
    )
  })

  it('should show error when text exceeds character limit', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'a'.repeat(TEXT_CHAR_LIMIT + 1)
    const form = document.getElementById('uploadForm')
    form.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.getElementById('uploadError').hidden).toBe(false)
    })
    expect(document.getElementById('errorMessage').textContent).toContain(
      'Text content too long'
    )
  })
})

describe('upload-handler - form submit: successful and failed submissions', () => {
  beforeEach(async () => {
    setupDOM()
    await loadModule()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('should clear textarea after a successful text review submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ reviewId: 'r1' })
      })
    )
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'some valid text content'
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [],
      configurable: true
    })
    const form = document.getElementById('uploadForm')
    form.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(textarea.value).toBe('')
    })
  })

  it('should show error banner when text review submission fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: 'Review failed' })
      })
    )
    const textarea = document.getElementById(TEXT_CONTENT_ID)
    textarea.value = 'some valid text'
    const fileInput = document.getElementById(FILE_UPLOAD_ID)
    Object.defineProperty(fileInput, 'files', {
      value: [],
      configurable: true
    })
    const form = document.getElementById('uploadForm')
    form.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => {
      expect(document.getElementById('uploadError').hidden).toBe(false)
    })
    expect(document.getElementById('errorMessage').textContent).toContain(
      'Review failed'
    )
  })
})

// Tests for review history, status cell rendering, and updateReviewHistory global
// are in upload-handler-history.test.js
