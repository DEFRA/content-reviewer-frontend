import { describe, it, expect } from 'vitest'
import { renderComponent } from './component-helpers.js'

const HEADING_COMPONENT = 'heading'
const HEADING_TEXT = 'Test Heading'
const HEADING_CAPTION = 'Test caption'
const HEADING_TESTID = '[data-testid="app-heading"]'
const HEADING_TITLE_TESTID = '[data-testid="app-heading-title"]'
const HEADING_CAPTION_TESTID = '[data-testid="app-heading-caption"]'

describe('renderComponent - heading component', () => {
  it('should return a cheerio wrapper', () => {
    const $ = renderComponent(HEADING_COMPONENT, { text: HEADING_TEXT })

    expect(typeof $).toBe('function')
  })

  it('should render the heading text', () => {
    const $ = renderComponent(HEADING_COMPONENT, { text: HEADING_TEXT })

    expect($(HEADING_TITLE_TESTID).text()).toBe(HEADING_TEXT)
  })

  it('should render the heading container', () => {
    const $ = renderComponent(HEADING_COMPONENT, { text: HEADING_TEXT })

    expect($(HEADING_TESTID).length).toBe(1)
  })

  it('should render caption when provided', () => {
    const $ = renderComponent(HEADING_COMPONENT, {
      text: HEADING_TEXT,
      caption: HEADING_CAPTION
    })

    expect($(HEADING_CAPTION_TESTID).text()).toBe(HEADING_CAPTION)
  })

  it('should not render caption element when caption is not provided', () => {
    const $ = renderComponent(HEADING_COMPONENT, { text: HEADING_TEXT })

    expect($(HEADING_CAPTION_TESTID).length).toBe(0)
  })
})

describe('renderComponent - callBlock support', () => {
  it('should render with a callBlock when provided', () => {
    const callBlockContent = '<span>call content</span>'
    const $ = renderComponent(
      HEADING_COMPONENT,
      { text: HEADING_TEXT },
      callBlockContent
    )

    // The component should still render without throwing
    expect(typeof $).toBe('function')
  })
})
