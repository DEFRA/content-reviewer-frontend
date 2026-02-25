import { describe, it, expect, vi } from 'vitest'
import { accessibilityController } from './controller'

const ACCESSIBILITY_STATEMENT = 'Accessibility statement'

describe('accessibilityController', () => {
  it('should render the accessibility page with correct context', () => {
    const h = { view: vi.fn() }
    const request = {}
    accessibilityController.handler(request, h)
    expect(h.view).toHaveBeenCalledWith('accessibility/index', {
      pageTitle: ACCESSIBILITY_STATEMENT,
      heading: ACCESSIBILITY_STATEMENT,
      breadcrumbs: [
        { text: 'Home', href: '/' },
        { text: ACCESSIBILITY_STATEMENT }
      ]
    })
  })
})
