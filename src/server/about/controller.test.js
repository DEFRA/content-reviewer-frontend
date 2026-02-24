import { describe, it, expect, vi } from 'vitest'
import { aboutController } from './controller'

describe('aboutController', () => {
  it('should render the about page with correct context', () => {
    const h = { view: vi.fn() }
    const request = {}
    aboutController.handler(request, h)
    expect(h.view).toHaveBeenCalledWith('about/index', {
      pageTitle: 'Content Review Assistant',
      heading: 'Content Review Assistant'
    })
  })
})
