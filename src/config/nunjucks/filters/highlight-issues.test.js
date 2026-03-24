import { describe, it, expect } from 'vitest'
import { highlightIssues } from './highlight-issues.js'

const PLAIN_TEXT = 'Hello world this is a test.'
const MULTILINE_TEXT = 'Line one.\nLine two.\nLine three.'
const AMPERSAND_TEXT = 'Fish & chips'
const HTML_CHARS_TEXT = '<script>alert("xss")</script>'
const QUOTE_TEXT = "It's a test"
const ISSUE_TYPE_CLARITY = 'clarity'
const ISSUE_TYPE_PLAIN_ENGLISH = 'plain-english'
const MARK_OPEN = '<mark'
const MARK_CLOSE = '</mark>'
const ANCHOR_OPEN = '<a '
const ANCHOR_CLOSE = '</a>'
const HIGHLIGHT_LINK_CLASS = 'highlight-link'
const BR_TAG = '<br>'
const HELLO_START = 0
const HELLO_END = 5
const WORLD_START = 6
const WORLD_END = 11
const OVERLAPPING_START = 3
const OVERLAPPING_END = 8

describe('highlightIssues - null and empty inputs', () => {
  it('should return empty string for null text', () => {
    const result = highlightIssues(null, [])

    expect(result).toBe('')
  })

  it('should return empty string for empty string text', () => {
    const result = highlightIssues('', [])

    expect(result).toBe('')
  })

  it('should return escaped text when issues is not an array', () => {
    const result = highlightIssues(PLAIN_TEXT, null)

    expect(result).toBe(PLAIN_TEXT)
  })

  it('should return escaped text when issues is an empty array', () => {
    const result = highlightIssues(PLAIN_TEXT, [])

    expect(result).toBe(PLAIN_TEXT)
  })

  it('should return escaped text when issues is undefined', () => {
    const result = highlightIssues(PLAIN_TEXT, undefined)

    expect(result).toBe(PLAIN_TEXT)
  })
})

describe('highlightIssues - single issue wrapping', () => {
  it('should wrap a matched span in a mark and anchor', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain(MARK_OPEN)
    expect(result).toContain(MARK_CLOSE)
    expect(result).toContain(ANCHOR_OPEN)
    expect(result).toContain(ANCHOR_CLOSE)
  })

  it('should use highlight-link class on anchor', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain(`class="${HIGHLIGHT_LINK_CLASS}"`)
  })

  it('should link to improvement-1 for the first issue', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('href="#improvement-1"')
  })

  it('should apply the type as a CSS class on mark', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('highlight-clarity')
  })

  it('should include the extracted text inside the mark', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('Hello')
  })

  it('should append remaining text after the issue', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain(' world this is a test.')
  })

  it('should include text before the issue unmodified', () => {
    const issues = [
      { start: WORLD_START, end: WORLD_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('Hello ')
  })
})

describe('highlightIssues - multiple non-overlapping issues', () => {
  it('should wrap both issues in separate marks', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY },
      { start: WORLD_START, end: WORLD_END, type: ISSUE_TYPE_PLAIN_ENGLISH }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    const markCount = (result.match(/<mark/g) || []).length
    expect(markCount).toBe(2)
  })

  it('should use sequential anchor ids for multiple issues', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY },
      { start: WORLD_START, end: WORLD_END, type: ISSUE_TYPE_PLAIN_ENGLISH }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('href="#improvement-1"')
    expect(result).toContain('href="#improvement-2"')
  })
})

describe('highlightIssues - overlapping issues', () => {
  it('should skip an issue whose start falls inside a previous span', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: ISSUE_TYPE_CLARITY },
      {
        start: OVERLAPPING_START,
        end: OVERLAPPING_END,
        type: ISSUE_TYPE_PLAIN_ENGLISH
      }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    const markCount = (result.match(/<mark/g) || []).length
    expect(markCount).toBe(1)
  })
})

describe('highlightIssues - invalid offset filtering', () => {
  it('should skip issues with non-numeric start', () => {
    const issues = [{ start: 'abc', end: HELLO_END, type: ISSUE_TYPE_CLARITY }]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).not.toContain(MARK_OPEN)
  })

  it('should skip issues where end is not greater than start', () => {
    const issues = [
      { start: HELLO_END, end: HELLO_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).not.toContain(MARK_OPEN)
  })

  it('should skip issues where end exceeds text length', () => {
    const issues = [{ start: HELLO_START, end: 9999, type: ISSUE_TYPE_CLARITY }]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).not.toContain(MARK_OPEN)
  })

  it('should skip issues with negative start offset', () => {
    const issues = [{ start: -1, end: HELLO_END, type: ISSUE_TYPE_CLARITY }]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).not.toContain(MARK_OPEN)
  })
})

describe('highlightIssues - HTML escaping in plain text', () => {
  it('should escape ampersands in plain text', () => {
    const result = highlightIssues(AMPERSAND_TEXT, [])

    expect(result).toContain('&amp;')
    expect(result).not.toContain(' & ')
  })

  it('should escape angle brackets in plain text', () => {
    const result = highlightIssues(HTML_CHARS_TEXT, [])

    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
    expect(result).not.toContain('<script>')
  })

  it('should escape double quotes in plain text', () => {
    const text = 'Say "hello"'
    const result = highlightIssues(text, [])

    expect(result).toContain('&quot;')
  })

  it('should escape single quotes in plain text', () => {
    const result = highlightIssues(QUOTE_TEXT, [])

    expect(result).toContain('&#39;')
  })
})

describe('highlightIssues - line break handling', () => {
  const LINE_BREAK_START = 0
  const LINE_BREAK_END = 4

  it('should convert newlines to br tags', () => {
    const issues = [
      { start: LINE_BREAK_START, end: LINE_BREAK_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(MULTILINE_TEXT, issues)

    expect(result).toContain(BR_TAG)
  })

  it('should preserve newline after br tag', () => {
    const issues = [
      { start: LINE_BREAK_START, end: LINE_BREAK_END, type: ISSUE_TYPE_CLARITY }
    ]
    const result = highlightIssues(MULTILINE_TEXT, issues)

    expect(result).toContain('<br>\n')
  })
})

describe('highlightIssues - type attribute escaping', () => {
  it('should convert special chars in type to dashes', () => {
    const issues = [
      { start: HELLO_START, end: HELLO_END, type: 'plain english' }
    ]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('highlight-plain-english')
  })

  it('should lowercase the type class', () => {
    const issues = [{ start: HELLO_START, end: HELLO_END, type: 'Clarity' }]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('highlight-clarity')
  })

  it('should use plain-english fallback when type is undefined', () => {
    const issues = [{ start: HELLO_START, end: HELLO_END }]
    const result = highlightIssues(PLAIN_TEXT, issues)

    expect(result).toContain('highlight-plain-english')
  })
})
