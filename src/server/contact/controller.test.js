import { describe, it, expect, vi } from 'vitest'
import { contactController } from './controller.js'

describe('contactController', () => {
  it('should render the contact page with correct context', () => {
    const h = { view: vi.fn() }
    contactController.handler({}, h)
    expect(h.view).toHaveBeenCalledWith('contact/index', {
      pageTitle: 'Contact',
      heading: 'Contact',
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'Contact' }]
    })
  })
})
