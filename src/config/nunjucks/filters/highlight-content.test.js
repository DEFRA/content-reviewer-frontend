import { describe, it, expect } from 'vitest'
import { highlightContent } from './highlight-content.js'

// Test constants
const EMPTY_STRING = ''
const SAMPLE_CONTENT = 'This is a test document with some issues.'
const LONG_CONTENT =
  'The quick brown fox jumps over the lazy dog. The fox is quick and brown.'
const CATEGORY_CLARITY = 'clarity'
const CATEGORY_FORMATTING = 'formatting'
const CATEGORY_COMPLIANCE = 'compliance'
const ANCHOR_PREFIX = 'improvement-'
const HIGHLIGHT_CLASS_PREFIX = 'highlight-'
const LINK_CLASS = 'highlight-link'
const TEST_ISSUE_TEXT = 'test document'
const SOME_ISSUES_TEXT = 'some issues'
const IMPROVEMENT_1_HREF = 'href="#improvement-1"'
const IMPROVEMENT_2_HREF = 'href="#improvement-2"'
const BETTER_TEXT = 'better text'
const TARGET_WORD = 'target word'
const WORD_SPACE = 'word '
const PATH_STRING = String.raw`C:\Users\Documents`

describe('highlightContent - basic functionality', () => {
  it('should return empty string when content is null', () => {
    const result = highlightContent(null, [], [])
    expect(result).toBe(EMPTY_STRING)
  })

  it('should return empty string when content is undefined', () => {
    const result = highlightContent(undefined, [], [])
    expect(result).toBe(EMPTY_STRING)
  })

  it('should return original content when content is not a string', () => {
    const numberInput = 123
    const result = highlightContent(numberInput, [], [])
    expect(result).toBe(numberInput)
  })

  it('should return original content when issues array is empty', () => {
    const result = highlightContent(SAMPLE_CONTENT, [], [])
    expect(result).toBe(SAMPLE_CONTENT)
  })

  it('should return original content when issues is not an array', () => {
    const result = highlightContent(SAMPLE_CONTENT, null, [])
    expect(result).toBe(SAMPLE_CONTENT)
  })

  it('should return original content when issues is undefined', () => {
    const result = highlightContent(SAMPLE_CONTENT, undefined, [])
    expect(result).toBe(SAMPLE_CONTENT)
  })
})

describe('highlightContent - single issue highlighting', () => {
  it('should highlight a single issue in content', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(IMPROVEMENT_1_HREF)
    expect(result).toContain(`class="${LINK_CLASS}"`)
    expect(result).toContain(
      `class="${HIGHLIGHT_CLASS_PREFIX}${CATEGORY_CLARITY}"`
    )
    expect(result).toContain('<mark')
    expect(result).toContain(TEST_ISSUE_TEXT)
  })

  it('should use correct category class for formatting issues', () => {
    const issues = [{ text: SOME_ISSUES_TEXT, category: CATEGORY_FORMATTING }]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(
      `class="${HIGHLIGHT_CLASS_PREFIX}${CATEGORY_FORMATTING}"`
    )
  })

  it('should handle issues with extra whitespace', () => {
    const issues = [
      { text: `  ${TEST_ISSUE_TEXT}  `, category: CATEGORY_CLARITY }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(TEST_ISSUE_TEXT)
    expect(result).toContain('<mark')
  })

  it('should skip issues with empty text', () => {
    const issues = [
      { text: '', category: CATEGORY_CLARITY },
      { text: TEST_ISSUE_TEXT, category: CATEGORY_FORMATTING }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(TEST_ISSUE_TEXT)
    expect(result).toContain(IMPROVEMENT_2_HREF)
  })

  it('should skip issues with only whitespace', () => {
    const issues = [
      { text: '   ', category: CATEGORY_CLARITY },
      { text: TEST_ISSUE_TEXT, category: CATEGORY_FORMATTING }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(TEST_ISSUE_TEXT)
    expect(result).toContain(IMPROVEMENT_2_HREF)
  })

  it('should skip issues with null text', () => {
    const issues = [
      { text: null, category: CATEGORY_CLARITY },
      { text: TEST_ISSUE_TEXT, category: CATEGORY_FORMATTING }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(TEST_ISSUE_TEXT)
  })

  it('should skip issues with null text property', () => {
    const issues = [
      { text: null, category: CATEGORY_CLARITY },
      { text: TEST_ISSUE_TEXT, category: CATEGORY_FORMATTING }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(TEST_ISSUE_TEXT)
  })
})

describe('highlightContent - multiple issues', () => {
  it('should highlight multiple different issues', () => {
    const issues = [
      { text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY },
      { text: SOME_ISSUES_TEXT, category: CATEGORY_FORMATTING }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(TEST_ISSUE_TEXT)
    expect(result).toContain(SOME_ISSUES_TEXT)
    expect(result).toContain(IMPROVEMENT_1_HREF)
    expect(result).toContain(IMPROVEMENT_2_HREF)
  })

  it('should prioritize longer phrases over shorter substrings', () => {
    const content = 'The quick brown fox jumps.'
    const issues = [
      { text: 'quick', category: CATEGORY_CLARITY },
      { text: 'quick brown fox', category: CATEGORY_FORMATTING }
    ]
    const result = highlightContent(content, issues, [])

    const quickBrownFoxMatch = result.match(/quick brown fox/g)
    expect(quickBrownFoxMatch).toBeTruthy()
    expect(quickBrownFoxMatch.length).toBe(1)
  })

  it('should handle overlapping text correctly', () => {
    const issues = [
      { text: 'The quick brown fox', category: CATEGORY_CLARITY },
      { text: 'fox', category: CATEGORY_FORMATTING }
    ]
    const result = highlightContent(LONG_CONTENT, issues, [])

    expect(result).toContain('The quick brown fox')
  })
})

describe('highlightContent - improvement matching', () => {
  it('should match exact improvement text and use its index', () => {
    const issues = [
      { text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY },
      { text: SOME_ISSUES_TEXT, category: CATEGORY_FORMATTING }
    ]
    const improvements = [
      { current: 'different text', suggested: BETTER_TEXT },
      { current: SOME_ISSUES_TEXT, suggested: 'some improvements' }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, improvements)

    expect(result).toContain(IMPROVEMENT_2_HREF)
    expect(result).toContain(SOME_ISSUES_TEXT)
  })

  it('should match partial improvement text', () => {
    const issues = [{ text: 'quick brown', category: CATEGORY_CLARITY }]
    const improvements = [
      { current: 'The quick brown fox is fast', suggested: BETTER_TEXT }
    ]
    const result = highlightContent(LONG_CONTENT, issues, improvements)

    expect(result).toContain(IMPROVEMENT_1_HREF)
  })

  it('should fallback to issue index when no improvement matches', () => {
    const issues = [
      { text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY },
      { text: SOME_ISSUES_TEXT, category: CATEGORY_FORMATTING }
    ]
    const improvements = [{ current: 'unrelated text', suggested: BETTER_TEXT }]
    const result = highlightContent(SAMPLE_CONTENT, issues, improvements)

    expect(result).toContain(IMPROVEMENT_1_HREF)
    expect(result).toContain(IMPROVEMENT_2_HREF)
  })

  it('should handle improvements without current property', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const improvements = [{ suggested: BETTER_TEXT }]
    const result = highlightContent(SAMPLE_CONTENT, issues, improvements)

    expect(result).toContain(TEST_ISSUE_TEXT)
    expect(result).toContain(IMPROVEMENT_1_HREF)
  })

  it('should handle improvements that are not an array', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, null)

    expect(result).toContain(TEST_ISSUE_TEXT)
    expect(result).toContain(IMPROVEMENT_1_HREF)
  })

  it('should handle null improvements parameter', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, null)

    expect(result).toContain(TEST_ISSUE_TEXT)
  })
})

describe('highlightContent - special characters', () => {
  it('should escape regex special characters in issue text', () => {
    const content = 'Cost is $100.00 (excluding tax).'
    const issues = [{ text: '$100.00', category: CATEGORY_CLARITY }]
    const result = highlightContent(content, issues, [])

    expect(result).toContain('$100.00')
    expect(result).toContain('<mark')
  })

  it('should handle parentheses in issue text', () => {
    const content = 'Cost is $100.00 (excluding tax).'
    const issues = [{ text: '(excluding tax)', category: CATEGORY_CLARITY }]
    const result = highlightContent(content, issues, [])

    expect(result).toContain('(excluding tax)')
    expect(result).toContain('<mark')
  })

  it('should handle square brackets in issue text', () => {
    const content = 'The result [see appendix] is clear.'
    const issues = [{ text: '[see appendix]', category: CATEGORY_CLARITY }]
    const result = highlightContent(content, issues, [])

    expect(result).toContain('[see appendix]')
    expect(result).toContain('<mark')
  })

  it('should handle asterisks in issue text', () => {
    const content = 'Important: *do not* ignore this.'
    const issues = [{ text: '*do not*', category: CATEGORY_COMPLIANCE }]
    const result = highlightContent(content, issues, [])

    expect(result).toContain('*do not*')
    expect(result).toContain('<mark')
  })

  it('should handle plus signs in issue text', () => {
    const content = 'The total is 2+2=4.'
    const issues = [{ text: '2+2', category: CATEGORY_CLARITY }]
    const result = highlightContent(content, issues, [])

    expect(result).toContain('2+2')
    expect(result).toContain('<mark')
  })

  it('should handle question marks in issue text', () => {
    const content = 'What is this? A question.'
    const issues = [{ text: 'What is this?', category: CATEGORY_CLARITY }]
    const result = highlightContent(content, issues, [])

    expect(result).toContain('What is this?')
    expect(result).toContain('<mark')
  })

  it('should handle backslashes in issue text', () => {
    const content = `Path: ${PATH_STRING}`
    const issues = [{ text: PATH_STRING, category: CATEGORY_CLARITY }]
    const result = highlightContent(content, issues, [])

    expect(result).toContain(PATH_STRING)
    expect(result).toContain('<mark')
  })
})

describe('highlightContent - edge cases', () => {
  it('should handle content with no matching issues', () => {
    const issues = [{ text: 'nonexistent phrase', category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toBe(SAMPLE_CONTENT)
  })

  it('should handle empty content string', () => {
    const issues = [{ text: 'test', category: CATEGORY_CLARITY }]
    const result = highlightContent(EMPTY_STRING, issues, [])

    expect(result).toBe(EMPTY_STRING)
  })

  it('should handle multiple occurrences of the same issue text', () => {
    const content = 'The fox jumps. The fox runs.'
    const issues = [{ text: 'The fox', category: CATEGORY_CLARITY }]
    const result = highlightContent(content, issues, [])

    const matches = result.match(/The fox/g)
    expect(matches.length).toBe(2)
  })

  it('should preserve content that is not highlighted', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain('This is a')
    expect(result).toContain('with some issues.')
  })

  it('should handle very long content efficiently', () => {
    const longContent = WORD_SPACE.repeat(10000) + TARGET_WORD
    const issues = [{ text: TARGET_WORD, category: CATEGORY_CLARITY }]
    const result = highlightContent(longContent, issues, [])

    expect(result).toContain(TARGET_WORD)
    expect(result).toContain('<mark')
  })
})

describe('highlightContent - HTML generation', () => {
  it('should generate correct anchor structure', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toMatch(/<a href="#improvement-\d+"/)
    expect(result).toContain('</a>')
  })

  it('should generate correct mark structure', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toMatch(/<mark class="highlight-\w+">/)
    expect(result).toContain('</mark>')
  })

  it('should nest mark inside anchor', () => {
    const issues = [{ text: TEST_ISSUE_TEXT, category: CATEGORY_CLARITY }]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toMatch(/<a [^>]*><mark [^>]*>.*<\/mark><\/a>/)
  })

  it('should use sequential improvement numbers', () => {
    const issues = [
      { text: 'test', category: CATEGORY_CLARITY },
      { text: 'document', category: CATEGORY_FORMATTING },
      { text: 'issues', category: CATEGORY_COMPLIANCE }
    ]
    const result = highlightContent(SAMPLE_CONTENT, issues, [])

    expect(result).toContain(`${ANCHOR_PREFIX}1`)
    expect(result).toContain(`${ANCHOR_PREFIX}2`)
    expect(result).toContain(`${ANCHOR_PREFIX}3`)
  })
})
