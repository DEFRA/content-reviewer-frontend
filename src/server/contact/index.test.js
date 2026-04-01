import { describe, it, expect, vi } from 'vitest'
import { contact } from './index.js'
import { contactController } from './controller.js'

vi.mock('./controller.js', () => ({
  contactController: {
    handler: vi.fn()
  }
}))

describe('contact plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(contact.plugin.name).toBe('contact')
  })

  it('should register the GET /contact route', () => {
    const mockServer = { route: vi.fn() }

    contact.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      expect.objectContaining({
        method: 'GET',
        path: '/contact',
        handler: contactController.handler
      })
    ])
  })
})
