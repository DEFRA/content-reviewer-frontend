import { describe, it, expect } from 'vitest'
import { renderUrlContent } from './render-url-content.js'

describe('renderUrlContent filter - guard clauses', () => {
  it('returns empty string for null input', () => {
    expect(renderUrlContent(null)).toBe('')
  })

  it('returns empty string for undefined input', () => {
    expect(renderUrlContent(undefined)).toBe('')
  })

  it('returns the input unchanged (wrapped in <p>) for plain text with no special characters', () => {
    expect(renderUrlContent('Hello world')).toBe('<p>Hello world</p>')
  })
})

describe('renderUrlContent filter - HTML escaping', () => {
  it('escapes & to &amp;', () => {
    expect(renderUrlContent('cats & dogs')).toBe('<p>cats &amp; dogs</p>')
  })

  it('escapes < to &lt;', () => {
    expect(renderUrlContent('x < y')).toBe('<p>x &lt; y</p>')
  })

  it('escapes > to &gt;', () => {
    expect(renderUrlContent('x > y')).toBe('<p>x &gt; y</p>')
  })

  it('escapes " to &quot;', () => {
    expect(renderUrlContent('say "hello"')).toBe('<p>say &quot;hello&quot;</p>')
  })

  it("escapes ' to &#39;", () => {
    expect(renderUrlContent("it's")).toBe('<p>it&#39;s</p>')
  })
})

describe('renderUrlContent filter - Markdown link conversion', () => {
  it('converts a Markdown link [text](url) to a GOV.UK-styled <a>', () => {
    const result = renderUrlContent(
      '[Read the guidance](https://www.gov.uk/guidance/test)'
    )
    expect(result).toContain(
      '<a href="https://www.gov.uk/guidance/test" class="govuk-link" rel="noopener noreferrer">Read the guidance</a>'
    )
  })

  it('converts multiple Markdown links in a single string', () => {
    const result = renderUrlContent(
      'See [page one](https://www.gov.uk/one) and [page two](https://www.gov.uk/two).'
    )
    expect(result).toContain('href="https://www.gov.uk/one"')
    expect(result).toContain('href="https://www.gov.uk/two"')
  })

  it('does NOT convert non-http link schemes (security: javascript: blocked)', () => {
    const result = renderUrlContent('[click](javascript:alert(1))')
    expect(result).not.toContain('href="javascript:')
    expect(result).toContain('click')
  })

  it('does NOT convert data: URI links', () => {
    const result = renderUrlContent('[file](data:text/html,<h1>hi</h1>)')
    expect(result).not.toContain('href="data:')
  })

  it('correctly escapes special characters in link anchor text', () => {
    const result = renderUrlContent('[cats & dogs](https://www.gov.uk/pets)')
    expect(result).toContain('href="https://www.gov.uk/pets"')
    expect(result).toContain('cats &amp; dogs')
  })

  it('preserves & in URL query strings without double-escaping to &amp;amp;', () => {
    const result = renderUrlContent(
      '[search](https://www.gov.uk/search?q=cats&lang=en)'
    )
    expect(result).toContain('href="https://www.gov.uk/search?q=cats&lang=en"')
  })
})

describe('renderUrlContent filter - paragraph and line-break conversion', () => {
  it('wraps output in <p>...</p>', () => {
    const result = renderUrlContent('Some text.')
    expect(result).toMatch(/^<p>/)
    expect(result).toMatch(/<\/p>$/)
  })

  it(String.raw`converts \n\n (paragraph break) to </p><p>`, () => {
    const result = renderUrlContent('Para one.\n\nPara two.')
    expect(result).toBe('<p>Para one.</p><p>Para two.</p>')
  })

  it(String.raw`converts single \n (line break) to <br>`, () => {
    const result = renderUrlContent('Line one.\nLine two.')
    expect(result).toBe('<p>Line one.<br>Line two.</p>')
  })

  it('handles mixed paragraph and line breaks', () => {
    const result = renderUrlContent(
      'Para one line A.\nPara one line B.\n\nPara two.'
    )
    expect(result).toBe(
      '<p>Para one line A.<br>Para one line B.</p><p>Para two.</p>'
    )
  })

  it('handles multiple consecutive paragraph breaks without crashing', () => {
    const result = renderUrlContent('Para one.\n\n\nPara two.')
    expect(typeof result).toBe('string')
    expect(result).toContain('Para one.')
    expect(result).toContain('Para two.')
  })
})

describe('renderUrlContent filter - end-to-end', () => {
  it('correctly renders a paragraph containing a Markdown link', () => {
    const result = renderUrlContent(
      'You must [apply online](https://www.gov.uk/apply) before the deadline.\n\nLate applications will not be accepted.'
    )
    expect(result).toBe(
      '<p>You must <a href="https://www.gov.uk/apply" class="govuk-link" rel="noopener noreferrer">apply online</a> before the deadline.</p><p>Late applications will not be accepted.</p>'
    )
  })
})
